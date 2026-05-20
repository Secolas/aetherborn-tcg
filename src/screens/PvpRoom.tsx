import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, Copy, Share2, Swords } from 'lucide-react';
import { LogoLoader } from '../components/LogoLoader';
import {
  concedeMatch, forfeitOnUnload, leaveRoom, pushMatchState, subscribeRoom, swapPerspective,
  type PvpRoom as PvpRoomT, type PvpSeat,
} from '../firebase/pvp';
import { useAuth } from '../firebase/auth';
import { MatchBoard } from './MatchBoard';
import type { BossDef } from '../data/bosses';
import type { MatchState } from '../game/types';
import type { Settings } from '../state/settings';
import { iconBtn, PALETTE, btnPrimary as btnPrimaryStyle } from '../components/styles';
import {
  BRAND, BRAND_LIGHT, BRAND_DEEP, OWNED,
  BG_WARM, TEXT_MID,
} from '../design/tokens';

interface Props {
  roomId: string;
  playerAvatar?: string;
  settings: Settings;
  onLeave: () => void;
  /** Called once when a PVP match reaches a terminal outcome
   *  (host_won / guest_won / draw / host_left / guest_left). The
   *  parent records the result into save.pvpHistory. */
  onMatchEnded?: (entry: {
    opponentName: string;
    opponentAvatar?: string;
    outcome: 'win' | 'loss' | 'draw';
    byForfeit?: boolean;
  }) => void;
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
export function PvpRoom({ roomId, playerAvatar, settings, onLeave, onMatchEnded }: Props) {
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

  // Tab close / page refresh = forfeit. Browsers don't fire React's
  // unmount cleanup when the user closes the tab, so without this hook
  // a player who rage-quits by closing the window would leave the other
  // side stuck on "waiting for opponent". We fire on both beforeunload
  // (desktop) and pagehide (mobile / bfcache) for coverage; the write
  // is a single small updateDoc that the browser usually lets through
  // before tearing down the page. Only arms while a match is actually
  // running so we don't bork rooms that are already over.
  const armForfeit = !!seat && (room?.outcome === 'ongoing' || room?.outcome === 'waiting');
  useEffect(() => {
    if (!armForfeit || !seat) return;
    const fire = () => { forfeitOnUnload(roomId, seat).catch(() => {}); };
    window.addEventListener('beforeunload', fire);
    window.addEventListener('pagehide', fire);
    return () => {
      window.removeEventListener('beforeunload', fire);
      window.removeEventListener('pagehide', fire);
    };
  }, [roomId, seat, armForfeit]);

  // Record the result into save.pvpHistory the first time the room
  // outcome transitions from non-terminal to terminal. Uses a ref to
  // dedupe so re-renders / Firestore echoes don't write twice.
  const historyWrittenRef = useRef(false);
  useEffect(() => {
    if (!room || !seat || !onMatchEnded) return;
    if (historyWrittenRef.current) return;
    const terminal: PvpRoomT['outcome'][] = ['host_won', 'guest_won', 'draw', 'host_left', 'guest_left'];
    if (!terminal.includes(room.outcome)) return;
    historyWrittenRef.current = true;

    // Outcome from THIS seat's perspective.
    let outcome: 'win' | 'loss' | 'draw';
    let byForfeit = false;
    if (room.outcome === 'draw') outcome = 'draw';
    else if (room.outcome === 'host_won') outcome = seat === 'host' ? 'win' : 'loss';
    else if (room.outcome === 'guest_won') outcome = seat === 'guest' ? 'win' : 'loss';
    else {
      // host_left / guest_left — the side that LEFT loses, the other wins.
      const leftIsHost = room.outcome === 'host_left';
      outcome = (leftIsHost ? seat !== 'host' : seat !== 'guest') ? 'win' : 'loss';
      byForfeit = true;
    }
    const oppName = seat === 'host' ? room.guestName : room.hostName;
    const oppAvatar = seat === 'host' ? room.guestAvatar : room.hostAvatar;
    onMatchEnded({
      opponentName: oppName ?? 'Opponent',
      opponentAvatar: oppAvatar ?? undefined,
      outcome,
      byForfeit,
    });
  }, [room, seat, onMatchEnded]);

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
      <ChromeScreen title="Room closed" onBack={onLeave}>
        <CenteredCard>
          <div style={{ fontSize: 15, color: PALETTE.text }}>This room no longer exists.</div>
          <div style={{ marginTop: 18 }}>
            <button onClick={onLeave} style={fullPrimary(false)}>Back</button>
          </div>
        </CenteredCard>
      </ChromeScreen>
    );
  }
  if (!room || !user || !seat) {
    return (
      <ChromeScreen title="Loading room" onBack={onLeave}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <LogoLoader tone="light" caption="Connecting" size={120} />
        </div>
      </ChromeScreen>
    );
  }

  // Legacy demo-PVP rooms stored their state under a different field
  // and won't ever produce a valid matchState here. Surface a clean
  // exit path instead of leaving the host stuck on "Starting match…".
  const validOutcomes: PvpRoomT['outcome'][] = [
    'waiting', 'ongoing', 'host_won', 'guest_won', 'draw', 'host_left', 'guest_left',
  ];
  if (!validOutcomes.includes(room.outcome)) {
    return (
      <ChromeScreen title="Old room" onBack={onLeave}>
        <CenteredCard>
          <div style={{ fontSize: 14, color: PALETTE.text, lineHeight: 1.4 }}>
            This room was created on an older build. Please leave and create a new one.
          </div>
          <div style={{ marginTop: 18 }}>
            <button
              onClick={async () => { await leaveRoom(roomId, seat); onLeave(); }}
              style={fullPrimary(false)}
            >Leave room</button>
          </div>
        </CenteredCard>
      </ChromeScreen>
    );
  }

  // Lobby: host waiting for a guest. Shows the share code.
  if (room.outcome === 'waiting') {
    return (
      <WaitingScreen
        code={room.code}
        onCancel={async () => { await leaveRoom(roomId, seat); onLeave(); }}
        onBack={async () => { await leaveRoom(roomId, seat); onLeave(); }}
      />
    );
  }

  if (room.outcome === 'host_left' || room.outcome === 'guest_left') {
    const leftName = room.outcome === 'host_left' ? room.hostName : room.guestName;
    return (
      <OpponentLeftScreen
        opponentName={leftName ?? 'Opponent'}
        onBack={onLeave}
        onFindNew={onLeave}
      />
    );
  }

  if (!room.matchState || !opponentBoss) {
    const myName = seat === 'host' ? room.hostName : (room.guestName ?? 'You');
    const oppName = seat === 'host' ? room.guestName : room.hostName;
    const myAvatar = seat === 'host' ? room.hostAvatar : room.guestAvatar;
    const oppAvatar = seat === 'host' ? room.guestAvatar : room.hostAvatar;
    return (
      <MatchmakingScreen
        you={{ name: myName ?? 'You', avatar: myAvatar ?? undefined }}
        opp={{ name: oppName ?? 'Opponent', avatar: oppAvatar ?? undefined }}
        onBack={async () => { await leaveRoom(roomId, seat); onLeave(); }}
      />
    );
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
    if (outcome === 'quit') {
      // Player tapped Give Up. Concede in Firestore — that flips
      // matchState.outcome to a terminal value, and the subscription
      // (line 53) pushes the new state down so MatchBoard re-renders
      // the MatchEnd cinematic. We deliberately DON'T call onLeave
      // here; otherwise the lobby pops in immediately and the player
      // never sees their loss screen. The MatchEnd's own exit
      // button hits this same onExit with the resolved outcome
      // ('loss') and falls through to onLeave below.
      if (room?.outcome === 'ongoing') {
        await concedeMatch(roomId, seat).catch(() => {});
      }
      return;
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

/* =========================================================================
 *  Screens — every PVP intermediate state uses the same warm chrome.
 * ======================================================================= */

function ChromeScreen({
  title, subtitle, onBack, children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={screenWrap}>
      <div style={headerWrap}>
        <button onClick={onBack} style={iconBtn} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <div style={bodyWrap}>{children}</div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={elevatedCard}>{children}</div>
    </div>
  );
}

function WaitingScreen({
  code, onCancel, onBack,
}: { code: string; onCancel: () => void; onBack: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in unsecure contexts — silently ignore.
    }
  };

  const handleShare = async () => {
    const text = `Join my Memoria match — code: ${code}`;
    type Nav = Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> };
    const nav = navigator as Nav;
    if (nav.share) {
      try { await nav.share({ title: 'Memoria PVP', text }); return; } catch { /* user cancelled */ }
    }
    // Fallback to clipboard so the user still has something to paste.
    handleCopy();
  };

  return (
    <ChromeScreen title="Room Created" subtitle="Waiting for opponent…" onBack={onBack}>
      <div style={{ ...elevatedCard, position: 'relative', overflow: 'hidden', textAlign: 'center', padding: '22px 18px 18px' }}>
        <div style={{
          position: 'absolute', inset: -40,
          background: `radial-gradient(circle at 50% 30%, ${BRAND_LIGHT}22, transparent 60%)`,
          animation: 'pvpPulse 2.4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        <div style={{
          fontSize: 11, fontWeight: 700,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: BRAND_DEEP, position: 'relative',
        }}>Your Room Code</div>

        <div style={{
          display: 'flex', gap: 8, justifyContent: 'center',
          marginTop: 14, position: 'relative',
        }}>
          {code.split('').map((l, i) => (
            <div key={i} style={{
              width: 46, height: 56,
              background: BG_WARM,
              border: `1.5px solid ${PALETTE.border}`,
              borderRadius: 14,
              display: 'grid', placeItems: 'center',
              fontWeight: 700, fontSize: 30,
              color: PALETTE.text,
              boxShadow: 'inset 0 -2px 0 rgba(58,46,42,.04)',
            }}>{l}</div>
          ))}
        </div>

        <div style={{
          display: 'flex', gap: 10, justifyContent: 'center',
          marginTop: 18, position: 'relative',
        }}>
          <button onClick={handleCopy} style={{
            flex: 1, background: BG_WARM,
            border: `1.5px solid ${PALETTE.border}`,
            color: PALETTE.text,
            borderRadius: 14, padding: '11px 0',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
            cursor: 'pointer',
          }}>
            <Copy size={16} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={handleShare} style={{
            flex: 1,
            background: `linear-gradient(180deg, #ffa07a 0%, ${BRAND_LIGHT} 60%, ${BRAND} 100%)`,
            border: 'none', color: '#fff',
            borderRadius: 14, padding: '11px 0',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            boxShadow: '0 6px 14px -4px rgba(255,94,60,.4), inset 0 1px 0 rgba(255,255,255,.4)',
            cursor: 'pointer',
          }}>
            <Share2 size={16} />
            Share
          </button>
        </div>

        <div style={{
          marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, fontSize: 12, color: TEXT_MID, position: 'relative',
        }}>
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: BRAND_LIGHT,
                animation: 'pvpDot 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.18}s`,
              }} />
            ))}
          </div>
          Waiting for your friend to join
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <TurnTimerTip />
      </div>

      <button onClick={onCancel} style={{ ...ghostFull, marginTop: 14 }}>
        Cancel & close room
      </button>

      <style>{`
        @keyframes pvpPulse {
          0%, 100% { opacity: .55; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.06); }
        }
        @keyframes pvpDot {
          0%, 80%, 100% { transform: translateY(0); opacity: .4; }
          40%           { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </ChromeScreen>
  );
}

function MatchmakingScreen({
  you, opp, onBack,
}: {
  you: { name: string; avatar?: string };
  opp: { name: string; avatar?: string };
  onBack: () => void;
}) {
  return (
    <ChromeScreen title="Opponent Found" subtitle="The match begins after the coin flip" onBack={onBack}>
      <div style={elevatedCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlayerColumn name={you.name} avatar={you.avatar} initial={you.name.slice(0, 1).toUpperCase()} hue="coral" meta="Your deck is ready" />
          <div style={{
            fontWeight: 800, fontSize: 14, color: BRAND_DEEP,
            padding: '8px 12px', borderRadius: 12,
            background: BG_WARM,
            letterSpacing: '0.08em',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            border: `1.5px solid ${PALETTE.border}`,
          }}>
            <Swords size={16} color={BRAND_LIGHT} />
            VS
          </div>
          <PlayerColumn name={opp.name} avatar={opp.avatar} initial={opp.name.slice(0, 1).toUpperCase()} hue="mint" meta="Online challenger" animate />
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{
            height: 6, borderRadius: 3, background: BG_WARM, overflow: 'hidden',
            border: `1px solid ${PALETTE.border}`,
          }}>
            <div style={{
              height: '100%', width: '70%',
              background: `linear-gradient(90deg, ${BRAND_LIGHT}, ${BRAND})`,
              borderRadius: 3,
              animation: 'pvpFill 2s ease-out forwards',
            }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_MID, textAlign: 'center' }}>
            Syncing decks…
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <TurnTimerTip />
      </div>

      <style>{`
        @keyframes pvpAvIn { 0% { transform: scale(.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pvpFill { 0% { width: 0%; } 100% { width: 70%; } }
      `}</style>
    </ChromeScreen>
  );
}

function TurnTimerTip() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: BG_WARM,
      border: `1.5px solid ${PALETTE.border}`,
      borderRadius: 14,
      padding: '10px 12px',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 10,
        background: BRAND_LIGHT, color: '#fff',
        display: 'grid', placeItems: 'center', flex: '0 0 auto',
      }}>
        <Clock size={15} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.4, color: PALETTE.text }}>
        <b style={{ color: BRAND_DEEP }}>60 seconds per turn.</b>{' '}
        <span style={{ color: TEXT_MID }}>
          Finish your plays before the clock runs out or your turn auto-ends.
        </span>
      </div>
    </div>
  );
}

function PlayerColumn({
  name, avatar, initial, hue, meta, animate,
}: {
  name: string;
  avatar?: string;
  initial: string;
  hue: 'coral' | 'mint';
  meta: string;
  animate?: boolean;
}) {
  const grad = hue === 'coral'
    ? `linear-gradient(135deg, #ffa07a, ${BRAND_LIGHT})`
    : `linear-gradient(135deg, #5be3b3, ${OWNED})`;
  const shadow = hue === 'coral'
    ? 'inset 0 1px 0 rgba(255,255,255,.4), 0 4px 10px rgba(255,94,60,.3)'
    : 'inset 0 1px 0 rgba(255,255,255,.4), 0 4px 10px rgba(6,214,160,.3)';
  return (
    <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18, margin: '0 auto',
        backgroundImage: avatar ? `url(${avatar})` : grad,
        backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'grid', placeItems: 'center',
        color: '#fff', fontWeight: 700, fontSize: 28,
        boxShadow: shadow,
        overflow: 'hidden',
        animation: animate ? 'pvpAvIn .5s ease-out' : undefined,
      }}>
        {avatar ? '' : initial}
      </div>
      <div style={{
        marginTop: 8, fontWeight: 800, fontSize: 14,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}</div>
      <div style={{ fontSize: 10.5, color: TEXT_MID, marginTop: 1 }}>{meta}</div>
    </div>
  );
}

function OpponentLeftScreen({
  opponentName, onBack, onFindNew,
}: { opponentName: string; onBack: () => void; onFindNew: () => void }) {
  return (
    <ChromeScreen title="Match Ended" onBack={onBack}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ ...elevatedCard, padding: '28px 22px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: '0 auto 14px',
            background: BG_WARM,
            border: '1.5px dashed rgba(58,46,42,0.18)',
            display: 'grid', placeItems: 'center',
            color: TEXT_MID, fontWeight: 700, fontSize: 28,
          }}>—</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: PALETTE.text }}>
            {opponentName} left the match
          </div>
          <div style={{ fontSize: 13, color: TEXT_MID, marginTop: 6, lineHeight: 1.4 }}>
            Your record is unaffected. Try another opponent or jump back to your collection.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button style={{ ...ghostFull, flex: 1 }} onClick={onBack}>Back</button>
            <button style={{ ...fullPrimary(false), flex: 1 }} onClick={onFindNew}>Find New</button>
          </div>
        </div>
      </div>
    </ChromeScreen>
  );
}

/* -------------------- Styles -------------------- */

const screenWrap: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column',
  background: 'linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)',
  color: PALETTE.text,
  fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
  overflow: 'hidden',
};

const headerWrap: React.CSSProperties = {
  padding: '52px 20px 8px',
  display: 'flex', alignItems: 'center', gap: 12,
};

const bodyWrap: React.CSSProperties = {
  flex: 1, overflowY: 'auto',
  padding: '8px 20px 24px',
  display: 'flex', flexDirection: 'column', gap: 12,
};

const elevatedCard: React.CSSProperties = {
  background: '#fff',
  border: `1.5px solid ${PALETTE.border}`,
  borderRadius: 22,
  padding: '20px 16px',
  boxShadow: '0 6px 18px rgba(58,46,42,.10)',
};

const ghostFull: React.CSSProperties = {
  background: '#fff',
  color: PALETTE.text,
  border: `1.5px solid ${PALETTE.border}`,
  borderRadius: 22,
  padding: '13px 24px',
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
  fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
  boxShadow: '0 2px 6px rgba(58,46,42,.06)',
  width: '100%',
};

function fullPrimary(disabled: boolean): React.CSSProperties {
  return {
    ...btnPrimaryStyle,
    background: disabled
      ? '#e5d6c9'
      : `linear-gradient(180deg, #ffa07a 0%, ${BRAND_LIGHT} 60%, ${BRAND} 100%)`,
    boxShadow: disabled
      ? 'none'
      : '0 6px 18px rgba(255, 94, 60, .35), inset 0 1px 0 rgba(255,255,255,.4)',
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: '100%',
  };
}
