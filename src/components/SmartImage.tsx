import { useState } from 'react';

interface Props {
  src: string | null;
  alt: string;
  fallbackSeed: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Image with automatic fallback. If the primary src fails to load (404,
 * network error, etc.), falls back to a deterministic picsum.photos URL
 * keyed by `fallbackSeed`. So a card's slot is never empty.
 *
 * Also fades the image in once the bytes arrive so the player doesn't
 * see a hard pop on cold-cache loads — relevant on mobile where the
 * 1.5-MB-ish placeholder PNGs can take a beat to come down. Cached
 * loads (decoded already) hit `complete` on first render and skip the
 * transition entirely.
 *
 * User-uploaded photos (data URIs) skip the fallback path.
 */
export function SmartImage({ src, alt, fallbackSeed, style, className }: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src) return null;

  const isDataURI = src.startsWith('data:');
  const finalSrc = (failed && !isDataURI)
    ? `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/400/400`
    : src;

  return (
    <img
      src={finalSrc}
      alt={alt}
      style={{
        ...style,
        opacity: isDataURI || loaded ? 1 : 0,
        transition: 'opacity .25s ease-out',
      }}
      className={className}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      // Captures cache hits where the img is `complete` before React
      // attaches the onLoad handler. Without this, cached images would
      // briefly render at opacity 0 until the next state tick.
      ref={(el) => {
        if (el && el.complete && el.naturalWidth > 0 && !loaded) setLoaded(true);
      }}
      draggable={false}
    />
  );
}
