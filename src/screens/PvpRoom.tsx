import { useEffect, useState } from 'react';
import {
  attackFace, concede, endTurn, leaveRoom, playCard,
  subscribeRoom, writeRoomState,
  type PvpCardLite, type PvpRoom as PvpRoomT, type PvpSeat,
} from '../firebase/pvp';
import { useAuth } from '../firebase/auth';
import { ELEMENTS } from '../data/elements';
import { SmartImage } from '../components/SmartImage';
import type { ElementId } from '../game/types';

interface Props {
  roomId: string;
  onLeave: () => void;
}

/** Real-time PVP match room. State lives in one Firestore doc; either
 *  player applies a move helper and writes the result. The opponent
 *  re-renders via onSnapshot. */
export function PvpRoom({ roomId, onLeave }: Props) {
  const { user } = useAuth();
  const [room, setRoom] = useState<PvpRoomT | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = subscribeRoom(roomId, (r) => {
      if (!r) { setMissing(true); return; }
      setRoom(r);
    });
    return () => unsub();
  }, [roomId]);

  if (missing) {
    return (
      <Centered>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, marginBottom: 12 }}>Room closed.</div>
          <button style={btnPrimary} onClick={onLeave}>Back</button>
        </div>
      </Centered>
    );
  }
  if (!room || !user) {
    return <Centered><div>Loading room…</div></Centered>;
  }

  const seat: PvpSeat | null =
    room.hostUid === user.uid ? 'host'
    : room.guestUid === user.uid ? 'guest'
    : null;

  if (!seat) {
    return (
      <Centered>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18 }}>This room is full.</div>
          <button style={btnPrimary} onClick={onLeave}>Back</button>
        </div>
      </Centered>
    );
  }

  const me = seat === 'host' ? room.state.host : room.state.guest;
  const opp = seat === 'host' ? room.state.guest : room.state.host;
  const isMyTurn = room.state.turn === seat && room.state.outcome === 'ongoing';

  const apply = async (next: typeof room.state) => {
    if (busy) return;
    setBusy(true);
    try { await writeRoomState(roomId, next); }
    finally { setBusy(false); }
  };

  const onPlay = (uid: string) => me && apply(playCard(room.state, seat, uid));
  const onAttack = (uid: string) => apply(attackFace(room.state, seat, uid));
  const onEnd = () => apply(endTurn(room.state, seat));
  const onConcede = async () => {
    await apply(concede(room.state, seat));
  };
  const onExit = async () => {
    await leaveRoom(roomId, seat);
    onLeave();
  };

  if (room.state.outcome === 'waiting') {
    return (
      <Centered>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 13, letterSpacing: 2, color: 'rgba(255,255,255,.5)' }}>WAITING FOR OPPONENT</div>
          <div style={{ fontSize: 42, fontFamily: 'Fredoka,sans-serif', color: '#f4d04a', letterSpacing: 8, margin: '12px 0' }}>
            {room.code}
          </div>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, maxWidth: 280 }}>
            Share this code. As soon as your opponent joins, the match begins.
          </p>
          <button style={btnGhost} onClick={onExit}>Cancel & Leave</button>
        </div>
      </Centered>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: 'radial-gradient(ellipse at 50% 0%, #1c2244 0%, #0a0c1c 70%)',
      color: '#fff',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,.08)',
      }}>
        <button onClick={onExit} style={btnGhost}>Leave</button>
        <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,.55)' }}>
          ROOM {room.code} · Turn {room.state.turnNumber}
        </div>
        <button onClick={onConcede} style={btnGhost}>Concede</button>
      </header>

      {/* Opponent zone */}
      {opp && <PlayerZone player={opp} mine={false} active={!isMyTurn && room.state.outcome === 'ongoing'} />}

      {/* Battlefield strip */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 6,
        padding: '8px 12px', overflow: 'auto',
      }}>
        <BoardRow board={opp?.board ?? []} canAttack={false} onAttack={() => {}} />
        <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '6px 0' }} />
        <BoardRow
          board={me?.board ?? []}
          canAttack={isMyTurn}
          onAttack={onAttack}
        />
      </div>

      {/* My hand */}
      {me && (
        <PlayerZone player={me} mine active={isMyTurn} />
      )}
      {me && (
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {me.hand.map((c) => (
            <HandCard
              key={c.uid}
              card={c}
              playable={isMyTurn && c.cost <= me.mana}
              onPlay={() => onPlay(c.uid)}
            />
          ))}
          {me.hand.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, padding: 8 }}>(empty hand)</div>
          )}
        </div>
      )}

      <div style={{ padding: '8px 16px 14px', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={onEnd}
          disabled={!isMyTurn}
          style={{
            padding: '10px 22px', borderRadius: 14, border: 'none',
            background: isMyTurn ? 'linear-gradient(135deg, #f4d04a, #f49a4a)' : 'rgba(255,255,255,.08)',
            color: isMyTurn ? '#2a1a06' : 'rgba(255,255,255,.4)',
            fontWeight: 700, fontSize: 14, cursor: isMyTurn ? 'pointer' : 'not-allowed',
          }}
        >
          {isMyTurn ? 'End Turn' : "Opponent's Turn…"}
        </button>
      </div>

      {room.state.outcome !== 'ongoing' && (
        <Overlay outcome={room.state.outcome} seat={seat} onExit={onExit} />
      )}
    </div>
  );
}

function PlayerZone({ player, mine, active }: { player: { name: string; hp: number; mana: number; maxMana: number; deckRemaining: number; hand: PvpCardLite[] }; mine: boolean; active: boolean }) {
  return (
    <div style={{
      padding: '8px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: active ? 'rgba(244,208,74,0.10)' : 'transparent',
      borderTop: !mine ? 'none' : '1px solid rgba(255,255,255,.08)',
      borderBottom: !mine ? '1px solid rgba(255,255,255,.08)' : 'none',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {player.name} {active && <span style={{ color: '#f4d04a', fontSize: 11, marginLeft: 6 }}>● active</span>}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>
          Hand {player.hand?.length ?? '—'} · Deck {player.deckRemaining}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Pill icon="♥" value={player.hp} color="#ff7e6e" />
        <Pill icon="◆" value={`${player.mana}/${player.maxMana}`} color="#7ec8ff" />
      </div>
    </div>
  );
}

function Pill({ icon, value, color }: { icon: string; value: string | number; color: string }) {
  return (
    <div style={{
      padding: '4px 10px', borderRadius: 999,
      background: 'rgba(255,255,255,.06)', border: `1px solid ${color}40`,
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700,
    }}>
      <span style={{ color }}>{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function BoardRow({ board, canAttack, onAttack }: {
  board: { card: PvpCardLite; hp: number; ready: boolean }[];
  canAttack: boolean;
  onAttack: (uid: string) => void;
}) {
  return (
    <div style={{
      minHeight: 110,
      display: 'flex', gap: 8, alignItems: 'center', padding: 8,
      background: 'rgba(255,255,255,.02)',
      border: '1px dashed rgba(255,255,255,.10)', borderRadius: 12,
    }}>
      {board.length === 0 && <div style={{ color: 'rgba(255,255,255,.32)', fontSize: 12, margin: 'auto' }}>(no creatures)</div>}
      {board.map((b) => {
        const can = canAttack && b.ready;
        return (
          <button
            key={b.card.uid}
            onClick={() => can && onAttack(b.card.uid)}
            disabled={!can}
            style={{
              ...miniCardStyle(b.card.el),
              opacity: b.ready ? 1 : 0.55,
              cursor: can ? 'pointer' : 'default',
              boxShadow: can ? `0 0 20px ${ELEMENTS[b.card.el as ElementId]?.glow ?? '#fff'}80` : undefined,
            }}
          >
            <MiniPhoto photo={b.card.photo} el={b.card.el} cardUid={b.card.uid} />
            <span style={miniLabelStyle}>{b.card.name}</span>
            <span style={miniStatStyle}>{b.card.atk}/{b.hp}</span>
          </button>
        );
      })}
    </div>
  );
}

function HandCard({ card, playable, onPlay }: { card: PvpCardLite; playable: boolean; onPlay: () => void }) {
  return (
    <button
      onClick={playable ? onPlay : undefined}
      disabled={!playable}
      style={{
        ...miniCardStyle(card.el),
        minWidth: 76, height: 110,
        cursor: playable ? 'pointer' : 'not-allowed',
        opacity: playable ? 1 : 0.55,
        transform: playable ? 'translateY(0)' : 'translateY(0)',
        transition: 'transform .12s ease',
      }}
      onMouseEnter={(e) => playable && (e.currentTarget.style.transform = 'translateY(-6px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <MiniPhoto photo={card.photo} el={card.el} cardUid={card.uid} />
      <div style={{ ...miniLabelStyle, fontSize: 10 }}>{card.name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 11, marginTop: 'auto', position: 'relative', zIndex: 1 }}>
        <span>◆{card.cost}</span>
        <span>{card.atk}/{card.hp}</span>
      </div>
    </button>
  );
}

/** Tiny photo strip across the top of a PVP mini-card. Photos are
 *  Firebase Storage download URLs (player-captured) — SmartImage
 *  handles the fade-in + picsum fallback if a URL 404s. No photo →
 *  the strip is skipped so the element-gradient background shows
 *  through and the card still reads as theirs. */
function MiniPhoto({ photo, el, cardUid }: { photo: string | null; el: string; cardUid: string }) {
  if (!photo) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: '55%',
      overflow: 'hidden',
      borderRadius: '8px 8px 0 0',
      zIndex: 0,
    }}>
      <SmartImage
        src={photo}
        alt=""
        fallbackSeed={`pvp-${el}-${cardUid}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

const miniLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, lineHeight: 1.1,
  position: 'relative', zIndex: 1,
  textShadow: '0 1px 2px rgba(0,0,0,.7)',
};
const miniStatStyle: React.CSSProperties = {
  fontSize: 11,
  position: 'relative', zIndex: 1,
  textShadow: '0 1px 2px rgba(0,0,0,.7)',
};

function miniCardStyle(el: string): React.CSSProperties {
  const def = ELEMENTS[el as ElementId] ?? { color: '#666', deep: '#222', glow: '#aaa' };
  return {
    minWidth: 70, height: 84,
    background: `linear-gradient(160deg, ${def.color} 0%, ${def.deep} 100%)`,
    border: `1.5px solid ${def.glow}`,
    borderRadius: 10,
    padding: 6,
    color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,.5)',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  };
}

function Overlay({ outcome, seat, onExit }: { outcome: 'host' | 'guest' | 'draw'; seat: PvpSeat; onExit: () => void }) {
  const won = outcome === seat;
  const tie = outcome === 'draw';
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(5, 8, 22, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, color: '#fff', zIndex: 10,
    }}>
      <div style={{
        fontFamily: 'Fredoka,sans-serif', fontSize: 56, fontWeight: 700,
        color: won ? '#f4d04a' : tie ? '#fff' : '#ff7e6e',
        textShadow: `0 0 30px ${won ? '#f4d04a' : tie ? '#fff' : '#ff7e6e'}66`,
      }}>
        {won ? 'VICTORY' : tie ? 'DRAW' : 'DEFEAT'}
      </div>
      <button style={btnPrimary} onClick={onExit}>Return to Lobby</button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid', placeItems: 'center',
      background: 'radial-gradient(ellipse at 50% 30%, #1c2244 0%, #0a0c1c 70%)',
      color: '#fff',
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
