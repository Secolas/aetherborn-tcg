import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../game/types';

interface Props {
  photo: string | null;
  el: ElementId;
  scale?: number;
  dashed?: boolean;
}

export function PhotoFrame({ photo, el, scale = 1, dashed = true }: Props) {
  const e = ELEMENTS[el];

  if (photo) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(160deg, ${e.color}30 0%, transparent 40%, ${e.deep}55 100%)`,
          mixBlendMode: 'overlay',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          boxShadow: `inset 0 0 20px ${e.glow}33`,
          pointerEvents: 'none',
        }} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: `repeating-linear-gradient(45deg, ${e.deep}88 0 8px, ${e.deep}55 8px 16px)`,
      display: 'grid', placeItems: 'center',
      border: dashed ? `${2 * scale}px dashed ${e.glow}66` : 'none',
      borderRadius: 'inherit',
    }}>
      <div style={{ textAlign: 'center', color: e.glow }}>
        <svg width={32 * scale} height={32 * scale} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="8" width="26" height="18" rx="3" />
          <circle cx="16" cy="17" r="5" />
          <path d="M11 8 L13 5 L19 5 L21 8" />
        </svg>
        <div style={{
          fontSize: 8 * scale, marginTop: 4 * scale,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          letterSpacing: '0.15em', textTransform: 'uppercase',
          opacity: 0.85,
        }}>
          Take photo<br />to summon
        </div>
      </div>
    </div>
  );
}
