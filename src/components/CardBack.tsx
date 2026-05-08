/**
 * Face-down card — used for the opponent's hand row at the top of the
 * match screen so the player can see how many cards the AI is holding.
 *
 * Fixed creature/spell-agnostic look: deep navy with a subtle pattern.
 */
interface Props {
  scale?: number;
  /** Slight rotation for the fanned hand effect. */
  rotate?: number;
}

export function CardBack({ scale = 0.34, rotate = 0 }: Props) {
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
      {/* Subtle radial sheen */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 35%, rgba(180,200,255,.18) 0%, transparent 55%)',
      }} />
      {/* Center diamond emblem */}
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
