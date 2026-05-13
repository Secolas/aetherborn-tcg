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
 * Pre-match coin flip. The disc spins in place around its Y axis (no airborne
 * bounce — we want the read to be "flipping" not "tossing"), pulsing slightly
 * to add weight. Lands on the right face based on `result`, then a result
 * plate fades in for ~1s before onDone() unblocks the game.
 */
export function CoinFlip({ result, bossAvatar, bossName, onDone }: Props) {
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
      background: 'radial-gradient(ellipse at center, rgba(40,28,18,.92) 0%, rgba(8,4,12,.96) 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 32,
      zIndex: 300,
      animation: 'fadeIn .25s',
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      color: '#fff',
    }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase',
        opacity: 0.55, fontWeight: 700,
        color: '#f4d04a',
      }}>
        ◆ Coin Flip ◆
      </div>

      {/* The coin itself — fixed in place; spins around Y. The wrapper does a
          subtle scale-pulse so the motion has weight. */}
      <div style={{
        width: 160, height: 160,
        perspective: 900,
        position: 'relative',
        animation: 'coinPulse 2.2s ease-in-out forwards',
      }}>
        {/* Soft ground-shadow under the coin so it reads as suspended in the
            spin, not floating in void. */}
        <div style={{
          position: 'absolute', bottom: -22, left: '50%',
          width: 130, height: 16,
          transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse, rgba(0,0,0,.55) 0%, transparent 70%)',
          filter: 'blur(2px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          width: '100%', height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: `${animation} 2.2s cubic-bezier(.3,.7,.4,1) forwards`,
        }}>
          <CoinFace label="YOU" sub="Player" accent="#f4d04a" back={false} />
          <CoinFace label={bossAvatar} sub={bossName} accent="#ee5a52" back />
        </div>
      </div>

      {/* Result plate — always occupies the same space (minHeight) so the
          coin above it never shifts position when the text fades in. */}
      <div style={{ minHeight: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    </div>
  );
}

/**
 * One face of the 3D coin disc. Layered:
 *   - Outer rim with knurled-edge texture (radial gradient repeating ring)
 *   - Inner field with metallic sheen
 *   - Center label + subtitle
 *   - Decorative star burst behind the label
 */
function CoinFace({ label, sub, accent, back }: {
  label: string;
  sub: string;
  accent: string;
  /** Tails — sits on the opposite side of the 3D disc. */
  back: boolean;
}) {
  // Slight tonal differences between the two faces so the player can tell
  // which side landed even before the result plate appears.
  const fieldGradient = back
    ? 'radial-gradient(circle at 35% 30%, #fef0c8 0%, #f4d04a 30%, #c8901a 65%, #6e4a14 100%)'
    : 'radial-gradient(circle at 35% 30%, #fff5d8 0%, #f4d04a 30%, #d8a428 65%, #8a5a14 100%)';
  const labelColor = back ? '#3a1a08' : '#3a2406';
  return (
    <div style={{
      position: 'absolute', inset: 0,
      borderRadius: '50%',
      backfaceVisibility: 'hidden',
      transform: back ? 'rotateY(180deg)' : 'rotateY(0)',
      // Outer rim
      background: 'conic-gradient(from 0deg, #c8901a 0deg, #ffe480 30deg, #c8901a 60deg, #8a5a14 90deg, #ffe480 120deg, #c8901a 150deg, #ffe480 180deg, #c8901a 210deg, #8a5a14 240deg, #ffe480 270deg, #c8901a 300deg, #ffe480 330deg, #c8901a 360deg)',
      padding: 5,
      boxShadow: '0 0 0 2px #6e4a14, 0 24px 36px rgba(0,0,0,.6), 0 0 40px rgba(244,208,74,.25)',
    }}>
      {/* Inner metallic field */}
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: fieldGradient,
        boxShadow: 'inset 0 0 0 2px rgba(110,74,20,.6), inset 0 4px 10px rgba(255,255,255,.35), inset 0 -4px 10px rgba(0,0,0,.3)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        color: labelColor,
        fontFamily: '"Fredoka", system-ui',
      }}>
        {/* Star burst behind label */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '70%', height: '70%',
          transform: 'translate(-50%, -50%) rotate(15deg)',
          background: `conic-gradient(from 0deg, transparent 0deg, ${accent}33 22deg, transparent 45deg, ${accent}33 67deg, transparent 90deg, ${accent}33 112deg, transparent 135deg, ${accent}33 157deg, transparent 180deg, ${accent}33 202deg, transparent 225deg, ${accent}33 247deg, transparent 270deg, ${accent}33 292deg, transparent 315deg, ${accent}33 337deg, transparent 360deg)`,
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
        {/* Label */}
        <div style={{
          fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: '0.02em',
          textShadow: '0 2px 0 rgba(255,255,255,.3), 0 -1px 0 rgba(0,0,0,.2)',
          zIndex: 2,
        }}>{label}</div>
        <div style={{
          fontSize: 9, letterSpacing: '0.32em', textTransform: 'uppercase',
          opacity: 0.85, marginTop: 6, fontWeight: 700, zIndex: 2,
        }}>{sub}</div>
        {/* Tiny notch dots around the inner edge — adds the embossed-coin feel */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 360) / 24;
          return (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 3, height: 3, borderRadius: '50%',
              background: 'rgba(110,74,20,.55)',
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-58px)`,
              pointerEvents: 'none',
            }} />
          );
        })}
      </div>
    </div>
  );
}
