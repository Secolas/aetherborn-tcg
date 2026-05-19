import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit,
  onSnapshot, query, serverTimestamp, updateDoc, where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import { createMatchFromDecks } from '../game/match';
import type { CollectionCard, MatchState, Owner } from '../game/types';

/**
 * PVP networking primitives.
 *
 * A PVP room mirrors the **full** single-player match engine state in
 * Firestore. Both clients subscribe to the room doc; whoever's turn it
 * is runs the engine locally and pushes the resulting MatchState back.
 *
 * Convention: the HOST is always `'player'` in MatchState; the GUEST is
 * always `'opponent'`. This keeps the on-wire shape stable. Clients
 * swap the two sides at render time so each player sees themselves on
 * the bottom of the board (their own avatar, their own hand).
 *
 * Photos are tiny URLs (Storage download URLs), not inline data URIs,
 * so a full MatchState with both decks easily fits inside Firestore's
 * 1 MB doc cap.
 */

export type PvpSeat = 'host' | 'guest';

export type PvpOutcome =
  | 'waiting'   // no guest yet
  | 'ongoing'   // match in progress
  | 'host_won'
  | 'guest_won'
  | 'draw'
  | 'host_left'
  | 'guest_left';

export interface PvpRoom {
  id: string;
  code: string;
  hostUid: string;
  hostName: string;
  hostAvatar?: string;
  guestUid: string | null;
  guestName: string | null;
  guestAvatar?: string;
  /** Full source decks for each side. Stored once at join time; never
   *  mutated after. The engine's BattleCard copies live inside
   *  `matchState` instead. */
  hostDeck: CollectionCard[];
  guestDeck: CollectionCard[];
  /** The shared engine state. Null until the guest joins; otherwise
   *  the full MatchState from game/match. The HOST is `'player'`. */
  matchState: MatchState | null;
  outcome: PvpOutcome;
  createdAt: unknown;
}

/* -------------------- Internal helpers -------------------- */

function pvpDoc(roomId: string) {
  if (!db) throw new Error('Firestore not configured');
  return doc(db, 'pvpRooms', roomId);
}

function randomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

function trimDeckForMatch(cards: CollectionCard[]): CollectionCard[] {
  return cards.filter(c => !!c.photo).slice(0, 12);
}

/** Strip undefined fields from a deep object before writing to
 *  Firestore — undefined is not allowed in Firestore field values. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/** Sanity-check that a stored deck is in the new full-CollectionCard
 *  shape. Old demo-PVP rooms wrote a stripped "PvpCardLite" instead,
 *  which is missing the template fields the engine needs (id,
 *  abilityKind, type, etc.) — feeding one of those into
 *  createMatchFromDecks crashes the engine downstream. */
function looksLikeFullDeck(deck: unknown): deck is CollectionCard[] {
  if (!Array.isArray(deck) || deck.length === 0) return false;
  const first = deck[0] as Partial<CollectionCard>;
  return (
    typeof first?.id === 'string' &&
    typeof first?.abilityKind === 'string' &&
    typeof first?.type === 'string'
  );
}

/* -------------------- Public API -------------------- */

/** Create a new room. The host's deck is stored but no MatchState is
 *  created yet — that happens when the guest joins. */
export async function createRoom(
  hostUid: string,
  hostName: string,
  hostDeck: CollectionCard[],
  hostAvatar?: string,
): Promise<{ id: string; code: string }> {
  if (!db) throw new Error('Firestore not configured');
  const deck = trimDeckForMatch(hostDeck);
  if (deck.length < 6) throw new Error('Need at least 6 photographed cards to play online.');
  const code = randomCode();
  const payload = stripUndefined({
    code,
    hostUid,
    hostName,
    hostAvatar: hostAvatar ?? null,
    guestUid: null,
    guestName: null,
    guestAvatar: null,
    hostDeck: deck,
    guestDeck: [],
    matchState: null,
    outcome: 'waiting' as PvpOutcome,
    createdAt: serverTimestamp(),
  });
  const ref = await addDoc(collection(db, 'pvpRooms'), payload);
  return { id: ref.id, code };
}

/** Join an open room by code. Creates the initial MatchState from both
 *  decks via createMatchFromDecks — same path as the single-player
 *  campaign, including the coin flip for who goes first. */
export async function joinRoomByCode(
  code: string,
  guestUid: string,
  guestName: string,
  guestDeck: CollectionCard[],
  guestAvatar?: string,
): Promise<string> {
  if (!db) throw new Error('Firestore not configured');
  const upper = code.trim().toUpperCase();
  const q = query(
    collection(db, 'pvpRooms'),
    where('code', '==', upper),
    where('guestUid', '==', null),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('No open room with that code.');
  const docSnap = snap.docs[0];
  const data = docSnap.data() as { hostUid: string; hostDeck: unknown };
  if (data.hostUid === guestUid) throw new Error("That's your own room.");

  // Legacy demo-PVP rooms stored a stripped deck shape that the real
  // engine can't ingest. Detect those and refuse rather than crashing
  // downstream with a cryptic "cannot read properties of undefined"
  // error. The host needs to re-create the room on the new build.
  if (!looksLikeFullDeck(data.hostDeck)) {
    // Clean up the stale room so it stops showing up in the join query.
    try { await deleteDoc(docSnap.ref); } catch { /* fine */ }
    throw new Error('This room was created on an older build. Ask the host to create a new one.');
  }
  const hostDeck = data.hostDeck;

  const deck = trimDeckForMatch(guestDeck);
  if (deck.length < 6) throw new Error('Need at least 6 photographed cards to play online.');

  // Build the engine state from both real decks. createMatchFromDecks
  // shuffles, deals opening hands, and runs the same coin flip the
  // single-player campaign uses for first turn.
  const matchState = createMatchFromDecks(hostDeck, deck, 'normal');

  await updateDoc(docSnap.ref, stripUndefined({
    guestUid,
    guestName,
    guestAvatar: guestAvatar ?? null,
    guestDeck: deck,
    matchState,
    outcome: 'ongoing' as PvpOutcome,
  }));
  return docSnap.id;
}

export function subscribeRoom(
  roomId: string,
  cb: (room: PvpRoom | null) => void,
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(pvpDoc(roomId), (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id: snap.id, ...(snap.data() as Omit<PvpRoom, 'id'>) });
  });
}

/** Write a fresh MatchState (after a player applied one of the engine
 *  functions). Also derives the room-level outcome from matchState.outcome. */
export async function pushMatchState(roomId: string, state: MatchState): Promise<void> {
  if (!db) return;
  let outcome: PvpOutcome = 'ongoing';
  if (state.outcome === 'win') outcome = 'host_won';
  else if (state.outcome === 'loss') outcome = 'guest_won';
  else if (state.outcome === 'draw') outcome = 'draw';
  await updateDoc(pvpDoc(roomId), stripUndefined({ matchState: state, outcome }));
}

/** A player concedes mid-match. Other side wins. */
export async function concedeMatch(roomId: string, seat: PvpSeat): Promise<void> {
  if (!db) return;
  const snap = await getDoc(pvpDoc(roomId));
  if (!snap.exists()) return;
  const data = snap.data() as PvpRoom;
  if (!data.matchState || data.outcome !== 'ongoing') return;
  const next: MatchState = {
    ...data.matchState,
    outcome: seat === 'host' ? 'loss' : 'win',
    log: [...data.matchState.log, `${seat === 'host' ? data.hostName : data.guestName ?? 'Guest'} conceded.`],
  };
  const outcome: PvpOutcome = seat === 'host' ? 'guest_won' : 'host_won';
  await updateDoc(pvpDoc(roomId), stripUndefined({ matchState: next, outcome }));
}

/** Tear down the room (host) or notify (guest). */
export async function leaveRoom(roomId: string, asSeat: PvpSeat): Promise<void> {
  if (!db) return;
  if (asSeat === 'host') {
    await deleteDoc(pvpDoc(roomId));
    return;
  }
  const snap = await getDoc(pvpDoc(roomId));
  if (!snap.exists()) return;
  const data = snap.data() as PvpRoom;
  if (data.outcome !== 'ongoing' && data.outcome !== 'waiting') return;
  await updateDoc(pvpDoc(roomId), stripUndefined({ outcome: 'guest_left' as PvpOutcome }));
}

/* -------------------- Perspective helpers -------------------- */

/** From a given seat's perspective, which engine Owner is "me"? */
export function seatToOwner(seat: PvpSeat): Owner {
  return seat === 'host' ? 'player' : 'opponent';
}

/** Swap player/opponent in a MatchState so the guest can render
 *  themselves on the bottom of the board. The engine on-the-wire is
 *  always host = 'player'; this is a pure presentation flip. */
export function swapPerspective(state: MatchState): MatchState {
  return {
    ...state,
    player: state.opponent,
    opponent: state.player,
    turn: state.turn === 'player' ? 'opponent' : 'player',
    // The outcome flips too — 'win' from host POV is 'loss' from guest POV.
    outcome: state.outcome === 'win' ? 'loss'
      : state.outcome === 'loss' ? 'win'
      : state.outcome,
  };
}
