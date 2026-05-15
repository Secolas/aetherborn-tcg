import { PALETTE } from './styles';

/**
 * Face-down card. Two variants today, room to grow:
 *
 *   - 'opponent' (default for opponent draws): deep navy with the
 *     diamond emblem — reads as the "deck the boss plays" since the
 *     player doesn't choose its cosmetic.
 *   - 'player'   (player draws + future deck inspector views): cream
 *     paper with a hand-drawn coral outline + emblem. Matches the rest
 *     of the app's warm, sketched language and gives the player an
 *     equippable surface that future card-back cosmetics will swap.
 *
 * The cosmetic-back system isn't wired yet — once it is, this component
 * stays the entry point: add a new entry to BACK_VARIANTS and pass its
 * id via `variant`. Default falls back to side-appropriate visuals.
 */
export type CardBackVariant = 'opponent' | 'player-classic';

interface Props {
  scale?: number;
  /** Slight rotation for the fanned hand effect. */
  rotate?: number;
  /** Which side is drawing this card. Selects the default variant when
   *  no explicit `variant` is given. */
  side?: 'player' | 'opponent';
  /** Explicit visual override — wins over `side`. Reserved for the
   *  future cosmetic equip path. */
  variant?: CardBackVariant;
}

export function CardBack({ scale = 0.34, rotate = 0, side = 'opponent', variant }: Props) {
  const resolved: CardBackVariant =
    variant ?? (side === 'player' ? 'player-classic' : 'opponent');

  if (resolved === 'player-classic') return <PlayerHandDrawnBack scale={scale} rotate={rotate} />;
  return <OpponentNavyBack scale={scale} rotate={rotate} />;
}

// ────────────────────────────────────────────────────────────────────
// Variants
// ────────────────────────────────────────────────────────────────────

/**
 * The player's default card back — warm cream paper with a coral
 * sketched outline + a stylized "L" mark in the center. Pairs visually
 * with the rest of the app's hand-drawn Fredoka language.
 */
function PlayerHandDrawnBack({ scale, rotate }: { scale: number; rotate: number }) {
  const w = 220 * scale;
  const h = 320 * scale;
  return (
    <div style={{
      width: w, height: h,
      borderRadius: 14 * scale,
      background: `
        radial-gradient(circle at 50% 35%, #fff7e6 0%, ${PALETTE.bg} 60%, #f6e3c8 100%),
        linear-gradient(160deg, ${PALETTE.bg} 0%, #f6e3c8 100%)
      `,
      boxShadow: `
        0 ${4 * scale}px ${8 * scale}px rgba(58,46,42,.25),
        inset 0 0 0 ${2 * scale}px rgba(58,46,42,.12)
      `,
      transform: `rotate(${rotate}deg)`,
      position: 'relative',
      overflow: 'hidden',
      flex: '0 0 auto',
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
    }}>
      {/* Dashed coral border — the "hand drawn" outline. */}
      <div aria-hidden style={{
        position: 'absolute',
        top: 6 * scale, left: 6 * scale, right: 6 * scale, bottom: 6 * scale,
        borderRadius: 9 * scale,
        border: `${1.5 * scale}px dashed ${PALETTE.accent}`,
        opacity: 0.85,
      }} />
      {/* Subtle warm vignette so the center reads as the "page" of the card. */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,.6) 0%, transparent 60%)',
      }} />
      {/* Center emblem — Lifedeck "L" wordmark in a coral coin. */}
      <div aria-hidden style={{
        position: 'absolute', top: '50%', left: '50%',
        width: w * 0.46, height: w * 0.46,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: `linear-gradient(160deg, #ffa07a 0%, ${PALETTE.accent} 100%)`,
        boxShadow: `
          0 ${4 * scale}px ${8 * scale}px rgba(238,90,82,.35),
          inset 0 0 0 ${2 * scale}px rgba(255,255,255,.55)
        `,
        display: 'grid', placeItems: 'center',
        color: '#fff',
        fontFamily: '"Fredoka", "Inter", system-ui',
        fontWeight: 700,
        fontSize: w * 0.28,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        textShadow: `0 ${1.5 * scale}px ${2 * scale}px rgba(0,0,0,.18)`,
      }}>
        L
      </div>
      {/* Tiny "doodled" flourishes in the corners — three dots. */}
      {[
        { top: 12 * scale, left: 12 * scale },
        { top: 12 * scale, right: 12 * scale },
        { bottom: 12 * scale, left: 12 * scale },
        { bottom: 12 * scale, right: 12 * scale },
      ].map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            width: 4 * scale, height: 4 * scale, borderRadius: '50%',
            background: PALETTE.accent,
            opacity: 0.55,
            ...pos,
          }}
        />
      ))}
    </div>
  );
}

/** The opponent / boss's deck back — the existing navy diamond design. */
function OpponentNavyBack({ scale, rotate }: { scale: number; rotate: number }) {
  const w = 220 * scale;
  const h = 320 * scale;
  return (
    <div style={{
      width: w, height: h,
      borderRadius: 12 * scale,
      background: 'linear-gradient(160deg, #2a3a5e 0%, #14223e 60%, #0a1428 100%)',
      boxShadow: `0 ${4 * scale}px ${8 * scale}px rgba(0,0,0,.35), inset 0 0 0 ${2 * scale}px rgba(255,255,255,.10)`,
      transform: `rotate(${rotate}deg)`,
      position: 'relative',
      overflow: 'hidden',
      flex: '0 0 auto',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 35%, rgba(180,200,255,.18) 0%, transparent 55%)',
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: w * 0.42, height: w * 0.42,
        transform: 'translate(-50%, -50%) rotate(45deg)',
        border: `${1.5 * scale}px solid rgba(220,230,255,.45)`,
        background: 'rgba(120,140,200,.15)',
        borderRadius: 4 * scale,
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: w * 0.18, height: w * 0.18,
        transform: 'translate(-50%, -50%) rotate(45deg)',
        background: 'linear-gradient(160deg, #f4d04a, #c8901a)',
        borderRadius: 3 * scale,
        boxShadow: `0 0 ${6 * scale}px rgba(244,208,74,.5)`,
      }} />
    </div>
  );
}
