import { useEffect, useState } from 'react';
import type { Owner } from '../game/types';

interface Props {
  /** Who actually goes first — drives which face the coin lands on. */
  result: Owner;
  /** Boss avatar character (e.g. 'M' for Manager) for the tails face. */
  bossAvatar: string;
  /** Boss display name, shown in the result label. */
  bossName: string;
  /** Fired ~2.6s in, when the spin + result settle finishes. */
  onDone: () => void;
}

/**
 * Pre-match coin flip. Spins a 3D disc for ~2.2s, holds for ~400ms on the
 * landed face, then a "X goes first" plate appears for ~1s before onDone()
 * unblocks the game. The result is decided up front by the match engine —
 * this is purely cosmetic.
 */
export function CoinFlip({ result, bossAvatar, bossName, onDone }: Props) {
  // Phase 1: spinning. Phase 2: result plate fades in. Phase 3: dismiss.
  const [phase, setPhase] = useState<'spin' | 'result'>('spin');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('result'), 2200);
    const t2 = setTimeout(onDone, 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  const animation = result === 'player' ? 'coinFlipPlayer' : 'coinFlipBoss';

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(8,4,12,.85)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 28,
      zIndex: 300,
      animation: 'fadeIn .25s',
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      color: '#fff',
    }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase',
        opacity: 0.7, fontWeight: 600,
      }}>
        Coin flip
      </div>

      {/* The coin itself — a 3D disc with heads + tails on opposing faces. */}
      <div style={{
        width: 140, height: 140,
        perspective: 800,
        position: 'relative',
      }}>
        <div style={{
          width: '100%', height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: `${animation} 2.2s cubic-bezier(.3,.7,.4,1) forwards`,
        }}>
          <CoinFace label="YOU" sub="Player" gradient="linear-gradient(160deg, #f4d04a 0%, #e0a93a 50%, #c8901a 100%)" rim="#8a5a14" textColor="#3a2406" />
          <CoinFace
            label={bossAvatar}
            sub={bossName}
            gradient="linear-gradient(160deg, #6e3a32 0%, #3a2018 60%, #1a0a08 100%)"
            rim="#8a5a14"
            textColor="#f4d04a"
            back
          />
        </div>
      </div>

      {phase === 'result' && (
        <div style={{
          animation: 'coinFlipResult .5s cubic-bezier(.2,.8,.3,1) forwards',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase',
            color: '#f4d04a', fontWeight: 700, marginBottom: 8,
          }}>
            {result === 'player' ? 'You go first' : `${bossName} goes first`}
          </div>
          <div style={{
            fontSize: 30, fontWeight: 800,
            background: result === 'player'
              ? 'linear-gradient(180deg, #ffe9a8, #f4d04a)'
              : 'linear-gradient(180deg, #ffa07a, #ee5a52)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.05em',
          }}>
            {result === 'player' ? 'YOUR TURN' : `${bossName.toUpperCase()}'S TURN`}
          </div>
        </div>
      )}
    </div>
  );
}

function CoinFace({ label, sub, gradient, rim, textColor, back }: {
  label: string;
  sub: string;
  gradient: string;
  rim: string;
  textColor: string;
  /** Tails face — sits on the opposite side of the 3D disc. */
  back?: boolean;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      borderRadius: '50%',
      background: gradient,
      boxShadow: `inset 0 0 0 4px ${rim}, 0 0 0 4px ${rim}, 0 18px 32px rgba(0,0,0,.5)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backfaceVisibility: 'hidden',
      transform: back ? 'rotateY(180deg)' : 'rotateY(0)',
      color: textColor,
      fontFamily: '"Fredoka", system-ui',
    }}>
      <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: '0.02em' }}>{label}</div>
      <div style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', opacity: 0.85, marginTop: 6, fontWeight: 600 }}>{sub}</div>
    </div>
  );
}
