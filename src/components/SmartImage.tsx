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
 * User-uploaded photos (data URIs) skip the fallback path.
 */
export function SmartImage({ src, alt, fallbackSeed, style, className }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src) return null;

  const isDataURI = src.startsWith('data:');
  const finalSrc = (failed && !isDataURI)
    ? `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/400/400`
    : src;

  return (
    <img
      src={finalSrc}
      alt={alt}
      style={style}
      className={className}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
