import { useEffect, useMemo, useState } from 'react';
import {
  concedeMatch, leaveRoom, pushMatchState, subscribeRoom, swapPerspective,
  type PvpRoom as PvpRoomT, type PvpSeat,
} from '../firebase/pvp';
import { useAuth } from '../firebase/auth';
import { MatchBoard } from './MatchBoard';
import type { BossDef } from '../data/bosses';
import type { MatchState } from '../game/types';
import type { Settings } from '../state/settings';

interface Props {
  roomId: string;
  playerAvatar?: string;
  settings: Settings;
  onLeave: () => void;
}

/**
 * Real-time PVP match room.
 *
 * Renders the **full single-player MatchBoard** with the engine state
 * synced through Firestore. Both clients see the same MatchState; the
 * acting player's local move pushes the new state up via pushMatchState
 * and the other client receives it through the room subscription.
 *
 * Convention: the HOST is always 'player' in the on-wire MatchState.
 * The guest's render flips player/opponent so both players see
 * themselves on the bottom of the board.
 */
export function PvpRoom({ roomId, playerAvatar, settings, onLeave }: Props) {
  const { user } = useAuth();
  const [room, setRoom] = useState<PvpRoomT | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const unsub = subscribeRoom(roomId, (r) => {
      if (!r) { setMissing(true); return; }
      setRoom(r);
    });
    return () => unsub();
  }, [roomId]);

  // Compute the seat first so we always know who the local player is.
  const seat: PvpSeat | null = !room || !user ? null
    : room.hostUid === user.uid ? 'host'
    : room.guestUid === user.uid ? 'guest'
    : null;

  // Build a "synthetic" boss representing the opponent player so the
  // existing MatchBoard chrome (portrait, name, intro banner) works
  // unchanged. We never use this boss's deck — the engine state already
  // has both sides loaded — but the props plumbing needs an object here.
  const opponentBoss = useMemo<BossDef | null>(() => {
    if (!room || !seat) return null;
    const oppName = seat === 'host' ? room.guestName : room.hostName;
    const oppAvatar = seat === 'host' ? room.guestAvatar : room.hostAvatar;
    if (!oppName) return null;
    return {
      id: `pvp:${seat === 'host' ? room.guestUid : room.hostUid}`,
      name: oppName,
      subtitle: 'Online challenger',
      themeId: 'family',
      avatar: oppName.slice(0, 1).toUpperCase(),
      avatarPhoto: oppAvatar ?? undefined,
      intro: `${oppName} accepts your challenge.`,
      playstyle: 'A real player. Read their plays.',
      rewardCoins: 0,
      deck: [],
    };
  }, [room, seat]);

  if (missing) {
    return (
      <Centered>
        <Stack>
          <div>Room closed.</div>
          <button style={btnPrimary} onClick={onLeave}>Back</button>
        </Stack>
      </Centered>
    );
  }
  if (!room || !user || !seat) {
    return <Centered><div>Loading room…</div></Centered>;
  }

  // Lobby: host waiting for a guest. Shows the share code.
  if (room.outcome === 'waiting') {
    return (
      <Centered>
        <Stack>
          <div style={{ fontSize: 13, letterSpacing: 2, color: 'rgba(255,255,255,.5)' }}>
            WAITING FOR OPPONENT
          </div>
          <div style={{
            fontSize: 42, fontFamily: 'Fredoka,sans-serif', color: '#f4d04a',
            letterSpacing: 8, margin: '12px 0',
          }}>
            {room.code}
          </div>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, maxWidth: 280, textAlign: 'center' }}>
            Share this code. As soon as your opponent joins, the match begins with a coin flip.
          </p>
          <button style={btnGhost} onClick={async () => { await leaveRoom(roomId, seat); onLeave(); }}>
            Cancel & Leave
          </button>
        </Stack>
      </Centered>
    );
  }

  if (room.outcome === 'host_left' || room.outcome === 'guest_left') {
    const leftName = room.outcome === 'host_left' ? room.hostName : room.guestName;
    return (
      <Centered>
        <Stack>
          <div style={{ fontSize: 18 }}>{leftName ?? 'Opponent'} left the match.</div>
          <button style={btnPrimary} onClick={onLeave}>Back</button>
        </Stack>
      </Centered>
    );
  }

  if (!room.matchState || !opponentBoss) {
    return <Centered><div>Starting match…</div></Centered>;
  }

  // The on-wire state is always host = 'player'. For the guest we
  // flip sides so they render themselves on the bottom of the board.
  const renderState: MatchState = seat === 'host'
    ? room.matchState
    : swapPerspective(room.matchState);

  // Acting player's deck — used only for MatchBoard's initial deck prop
  // (not the actual gameplay deck which lives inside MatchState).
  const myDeck = seat === 'host' ? room.hostDeck : room.guestDeck;

  // When the local player moves, MatchBoard hands us the new state from
  // *their* perspective. The guest's view is swapped, so we have to
  // un-swap before writing back to Firestore.
  const onMove = (nextLocal: MatchState) => {
    const wire = seat === 'host' ? nextLocal : swapPerspective(nextLocal);
    pushMatchState(roomId, wire).catch(() => { /* network blip — engine retries on next move */ });
  };

  const onExit = async (outcome: 'win' | 'loss' | 'draw' | 'quit') => {
    if (outcome === 'quit' && room.outcome === 'ongoing') {
      await concedeMatch(roomId, seat).catch(() => {});
    }
    onLeave();
  };

  return (
    <MatchBoard
      deck={myDeck}
      boss={opponentBoss}
      difficulty="normal"
      playerAvatar={playerAvatar}
      settings={settings}
      online={{ state: renderState, onMove }}
      onExit={onExit}
    />
  );
}

/* -------------------- Layout helpers -------------------- */

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid', placeItems: 'center',
      background: 'radial-gradient(ellipse at 50% 30%, #1c2244 0%, #0a0c1c 70%)',
      color: '#fff', padding: 24,
    }}>{children}</div>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      textAlign: 'center',
    }}>{children}</div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg, #f4d04a, #f49a4a)',
  color: '#2a1a06', fontWeight: 700, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 12,
};
