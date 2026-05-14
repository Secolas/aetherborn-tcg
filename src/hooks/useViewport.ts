import { useEffect, useState } from 'react';

/**
 * Tracks the viewport width and exposes the standard breakpoints we use
 * across the app. Returns sensible defaults during SSR / when window is
 * undefined so screens render without crashing.
 *
 *   mobile  : < 768  — single-column, dense, thumb-friendly
 *   tablet  : 768–1023 — balanced density
 *   desktop : >= 1024 — multi-column, side panels
 *
 * Centralised here so PackOpening and DeckBuilder agree on where the
 * breakpoints fall and so future screens can hook in trivially.
 */
export interface Viewport {
  width: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useViewport(): Viewport {
  const [width, setWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return {
    width,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}
