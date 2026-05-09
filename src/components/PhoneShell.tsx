import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const BASE_W = 430;
const BASE_H = 900;

/**
 * Portrait viewport that genuinely expands on bigger screens.
 *
 *   - Phone (< 540 wide  OR  < 600 tall):
 *       fill the screen edge-to-edge, no transform, no border. The
 *       existing %-based layouts adapt naturally to the viewport.
 *
 *   - Tablet / desktop:
 *       render the 430×900 design at a FIXED size and scale it up via
 *       CSS transform until it fits the available space. So on a
 *       1024×1366 iPad portrait the phone view actually appears at
 *       roughly 632×1323 (≈1.47×); on a 1080p portrait monitor it
 *       blows up to ~900×1881 (≈2.1×). This gives the user the
 *       genuinely-bigger view they asked for, while preserving the
 *       phone-first proportions every screen was designed against.
 */
export function PhoneShell({ children }: Props) {
  const [framed, setFramed] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isFramed = vw >= 540 && vh >= 600;
      setFramed(isFramed);
      if (isFramed) {
        const padding = 40; // breathing room around the framed device
        const fit = Math.min((vw - padding) / BASE_W, (vh - padding) / BASE_H);
        const MAX_SCALE = 3;
        setScale(Math.min(fit, MAX_SCALE));
      } else {
        setScale(1);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // The inner stage is the fixed-size design canvas (430×900) on tablet/
  // desktop, or fluid 100% on phone. Transform-scale is applied to the
  // stage so all input coordinates remain consistent — pointer / touch
  // events transform with the element, so taps still hit the right spots.
  const stageStyle: React.CSSProperties = framed
    ? {
        width: BASE_W,
        height: BASE_H,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
      }
    : {
        width: '100vw',
        height: '100dvh',
      };

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      display: 'grid',
      placeItems: 'center',
      background: 'radial-gradient(ellipse at center, #0a0c1c 0%, #050816 70%)',
      overflow: 'hidden',
    }}>
      <div style={{
        ...stageStyle,
        position: 'relative',
        overflow: 'hidden',
        background: '#fef8f0',
        borderRadius: framed ? 28 : 0,
        boxShadow: framed
          ? '0 0 80px rgba(244, 208, 74, 0.08), 0 24px 60px rgba(0,0,0,0.45)'
          : 'none',
        border: framed ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}>
        {children}
      </div>
    </div>
  );
}
