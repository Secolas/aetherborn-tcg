import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit,
  onSnapshot, query, serverTimestamp, updateDoc, where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import type { CollectionCard } from '../game/types';

/** Minimal real-time PVP game state. Two players, each with a tiny
 *  deck dealt at room start, take turns playing creatures and attacking
 *  the opponent's face. State lives in one Firestore doc; both clients
 *  subscribe and write moves via authoritative-host updates.
 *
 *  This is intentionally NOT the full single-player engine — that's
 *  ~1200 lines and not trivially serializable. Treat this as the
 *  proven netcode primitive; the full engine can be ported onto the
 *  same room doc later (replace `state` with the full MatchState
 *  and route playCard / attack / endTurn through the same write path). */

export type PvpSeat = 'host' | 'guest';

export interface PvpCardLite {
  uid: string;
  name: string;
  cost: number;
  atk: number;
  hp: number;
  photo: string | null;
  el: string;
}

export interface PvpPlayer {
  uid: string;
  name: string;
  hp: number;
  mana: number;
  maxMana: number;
  hand: PvpCardLite[];
  /** Cards on board with current hp + an "ready" flag (false on play turn) */
  board: { card: PvpCardLite; hp: number; ready: boolean }[];
  deckRemaining: number;
}

export interface PvpState {
  host: PvpPlayer;
  guest: PvpPlayer | null;
  turn: PvpSeat;
  turnNumber: number;
  log: string[];
  outcome: 'waiting' | 'ongoing' | 'host' | 'guest' | 'draw';
}

export interface PvpRoom {
  id: string;
  code: string;
  hostUid: string;
  hostName: string;
  guestUid: string | null;
  guestName: string | null;
  state: PvpState;
  createdAt: unknown;
}

function pvpDoc(roomId: string) {
  if (!db) throw new Error('Firestore not configured');
  return doc(db, 'pvpRooms', roomId);
}

function deckLiteFromCollection(cards: CollectionCard[]): PvpCardLite[] {
  return cards
    .filter(c => !!c.photo)
    .slice(0, 12)
    .map(c => ({
      uid: c.uid,
      name: c.name,
      cost: c.cost,
      atk: c.atk,
      hp: c.hp,
      photo: c.photo,
      el: c.el,
    }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

function freshState(hostUid: string, hostName: string, hostDeck: PvpCardLite[]): PvpState {
  const shuffled = shuffle(hostDeck);
  const hand = shuffled.slice(0, 3);
  return {
    host: {
      uid: hostUid, name: hostName,
      hp: 25, mana: 1, maxMana: 1,
      hand,
      board: [],
      deckRemaining: Math.max(0, shuffled.length - 3),
    },
    guest: null,
    turn: 'host',
    turnNumber: 1,
    log: [`${hostName} created the room.`],
    outcome: 'waiting',
  };
}

/** Create a room. Returns the new room id + the share code. */
export async function createRoom(
  hostUid: string,
  hostName: string,
  hostDeck: CollectionCard[],
): Promise<{ id: string; code: string }> {
  if (!db) throw new Error('Firestore not configured');
  const deck = deckLiteFromCollection(hostDeck);
  if (deck.length < 6) throw new Error('Need at least 6 photographed cards to play online.');
  const code = randomCode();
  const ref = await addDoc(collection(db, 'pvpRooms'), {
    code,
    hostUid,
    hostName,
    guestUid: null,
    guestName: null,
    state: freshState(hostUid, hostName, deck),
    hostDeck: deck,
    guestDeck: null,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, code };
}

/** Join a room by short code. Returns the room id. */
export async function joinRoomByCode(
  code: string,
  guestUid: string,
  guestName: string,
  guestDeck: CollectionCard[],
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
  const data = docSnap.data() as { state: PvpState; hostUid: string };
  if (data.hostUid === guestUid) throw new Error("That's your own room.");
  const deck = deckLiteFromCollection(guestDeck);
  if (deck.length < 6) throw new Error('Need at least 6 photographed cards to play online.');
  const shuffled = shuffle(deck);
  const guestPlayer: PvpPlayer = {
    uid: guestUid, name: guestName,
    hp: 25, mana: 0, maxMana: 0,
    hand: shuffled.slice(0, 3),
    board: [],
    deckRemaining: Math.max(0, shuffled.length - 3),
  };
  const state: PvpState = {
    ...data.state,
    guest: guestPlayer,
    outcome: 'ongoing',
    log: [...data.state.log, `${guestName} joined.`],
  };
  await updateDoc(docSnap.ref, {
    guestUid, guestName, state, guestDeck: deck,
  });
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

export async function writeRoomState(roomId: string, state: PvpState): Promise<void> {
  await updateDoc(pvpDoc(roomId), { state });
}

export async function leaveRoom(roomId: string, asSeat: PvpSeat): Promise<void> {
  if (!db) return;
  if (asSeat === 'host') {
    await deleteDoc(pvpDoc(roomId));
    return;
  }
  const snap = await getDoc(pvpDoc(roomId));
  if (!snap.exists()) return;
  const data = snap.data() as PvpRoom & { state: PvpState };
  const state: PvpState = {
    ...data.state,
    outcome: 'host',
    log: [...data.state.log, `${data.state.guest?.name ?? 'Guest'} left.`],
  };
  await updateDoc(pvpDoc(roomId), { state });
}

/* -------------------- Game-logic helpers --------------------
 * Pure functions over PvpState. Either client may call these; the
 * resulting state is written back to Firestore. Both clients see it
 * via onSnapshot. There's no anti-cheat — both seats can in principle
 * write any state, so this is fine for friendly play but not for
 * ranked. For ranked, gate writes behind a Cloud Function later.
 */

const HAND_LIMIT = 7;
const MAX_TURNS = 25;

function drawOne(p: PvpPlayer): PvpPlayer {
  if (p.deckRemaining <= 0) return p;
  if (p.hand.length >= HAND_LIMIT) return { ...p, deckRemaining: p.deckRemaining - 1 };
  // We don't store the deck in PvpState (only its length) — the join
  // path encoded the actual deck order into hand draws. For ongoing
  // draws we synthesize a placeholder card so a small online demo can
  // run end-to-end. A future pass should serialize the full deck order
  // into the room doc and pop from it here.
  const synth: PvpCardLite = {
    uid: `synth_${p.uid}_${p.deckRemaining}`,
    name: 'Draw',
    cost: 1, atk: 1, hp: 1,
    photo: null,
    el: 'family',
  };
  return { ...p, hand: [...p.hand, synth], deckRemaining: p.deckRemaining - 1 };
}

export function playCard(state: PvpState, seat: PvpSeat, cardUid: string): PvpState {
  if (state.outcome !== 'ongoing') return state;
  if (state.turn !== seat) return state;
  const me = seat === 'host' ? state.host : state.guest;
  if (!me) return state;
  const card = me.hand.find(c => c.uid === cardUid);
  if (!card) return state;
  if (card.cost > me.mana) return state;
  const next: PvpPlayer = {
    ...me,
    mana: me.mana - card.cost,
    hand: me.hand.filter(c => c.uid !== cardUid),
    board: [...me.board, { card, hp: card.hp, ready: false }],
  };
  const log = [...state.log, `${me.name} played ${card.name}.`];
  return seat === 'host'
    ? { ...state, host: next, log }
    : { ...state, guest: next, log };
}

export function attackFace(state: PvpState, seat: PvpSeat, attackerUid: string): PvpState {
  if (state.outcome !== 'ongoing') return state;
  if (state.turn !== seat) return state;
  const me = seat === 'host' ? state.host : state.guest;
  const opp = seat === 'host' ? state.guest : state.host;
  if (!me || !opp) return state;
  const idx = me.board.findIndex(b => b.card.uid === attackerUid);
  if (idx < 0) return state;
  const attacker = me.board[idx];
  if (!attacker.ready) return state;
  const updatedBoard = [...me.board];
  updatedBoard[idx] = { ...attacker, ready: false };
  const oppNext: PvpPlayer = { ...opp, hp: Math.max(0, opp.hp - attacker.card.atk) };
  const meNext: PvpPlayer = { ...me, board: updatedBoard };
  const log = [...state.log, `${me.name}'s ${attacker.card.name} hit ${opp.name} for ${attacker.card.atk}.`];
  let next: PvpState = seat === 'host'
    ? { ...state, host: meNext, guest: oppNext, log }
    : { ...state, guest: meNext, host: oppNext, log };
  if (oppNext.hp <= 0) {
    next = { ...next, outcome: seat, log: [...next.log, `${me.name} wins!`] };
  }
  return next;
}

export function endTurn(state: PvpState, seat: PvpSeat): PvpState {
  if (state.outcome !== 'ongoing') return state;
  if (state.turn !== seat) return state;
  const nextSeat: PvpSeat = seat === 'host' ? 'guest' : 'host';
  const incoming = nextSeat === 'host' ? state.host : state.guest;
  if (!incoming) return state;
  const newMax = Math.min(10, incoming.maxMana + 1);
  const refreshed: PvpPlayer = {
    ...incoming,
    maxMana: newMax,
    mana: newMax,
    board: incoming.board.map(b => ({ ...b, ready: true })),
  };
  const withDraw = drawOne(refreshed);
  const turnNumber = state.turnNumber + 1;
  let outcome: PvpState['outcome'] = 'ongoing';
  let log = [...state.log, `${withDraw.name}'s turn.`];
  if (turnNumber > MAX_TURNS) {
    const hp = (nextSeat === 'host' ? withDraw : state.host).hp;
    const oppHp = (nextSeat === 'host' ? state.guest! : withDraw).hp;
    outcome = hp === oppHp ? 'draw' : (hp > oppHp ? nextSeat : seat);
    log = [...log, `Turn limit reached.`];
  }
  return nextSeat === 'host'
    ? { ...state, host: withDraw, guest: state.guest, turn: nextSeat, turnNumber, outcome, log }
    : { ...state, host: state.host, guest: withDraw, turn: nextSeat, turnNumber, outcome, log };
}

export function concede(state: PvpState, seat: PvpSeat): PvpState {
  if (state.outcome !== 'ongoing') return state;
  const winner: PvpSeat = seat === 'host' ? 'guest' : 'host';
  const meName = (seat === 'host' ? state.host : state.guest)?.name ?? 'Player';
  return { ...state, outcome: winner, log: [...state.log, `${meName} conceded.`] };
}
