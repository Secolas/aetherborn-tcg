import { ELEMENTS } from '../data/elements';
import { SmartImage } from './SmartImage';
import { getFilter, type FilterId } from '../data/filters';
import type { ElementId } from '../game/types';

interface Props {
  photo: string | null;
  el: ElementId;
  scale?: number;
  dashed?: boolean;
  /** Used for picsum fallback if photo URL fails to load. */
  fallbackSeed?: string;
  /** Cosmetic photo filter to apply (sepia, holo, etc.). Defaults to
   *  `none`. Has no effect when `photo` is null. */
  filterId?: FilterId;
}

export function PhotoFrame({ photo, el, scale = 1, dashed = true, fallbackSeed = el, filterId }: Props) {
  const e = ELEMENTS[el];
  const filter = getFilter(filterId);

  if (photo) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        <SmartImage
          src={photo}
          alt=""
          fallbackSeed={fallbackSeed}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            // Per-card cosmetic filter. Applied to the image element only
            // so it doesn't drag the element-theme overlay below into the
            // tonal shift (which would look muddy on top of an already
            // sepia / noir photo).
            filter: filter.cssFilter === 'none' ? undefined : filter.cssFilter,
          }}
        />
        {/* Optional cosmetic overlay — paints over the photo with the
            filter's mood color. Sits BELOW the element-theme glaze so the
            element identity still reads through. */}
        {filter.overlay && (
          <div style={{
            position: 'absolute', inset: 0,
            background: filter.overlay.background,
            mixBlendMode: filter.overlay.mixBlendMode,
            animation: filter.overlay.animation,
            pointerEvents: 'none',
            // Slight width bump so the holo sweep can translate without
            // exposing the photo's edge through a gap; container's
            // overflow:hidden still clips it to the frame.
            width: filter.overlay.animation ? '160%' : '100%',
            left: filter.overlay.animation ? '-30%' : 0,
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(160deg, ${e.color}30 0%, transparent 40%, ${e.deep}55 100%)`,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          // Cosmetic accent ring overrides the element glow when a filter
          // sets one. Keeps the photo frame visually tied to the chosen
          // filter (e.g. Holo gets a violet inner glow).
          boxShadow: `inset 0 0 20px ${(filter.accent ?? e.glow)}55`,
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
