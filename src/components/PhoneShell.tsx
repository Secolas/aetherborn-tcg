import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/**
 * Portrait-shaped viewport that scales gracefully across phones, tablets,
 * and desktop:
 *
 *   - Phones (≤ 540 wide):  fills the screen edge-to-edge, no rounding,
 *                           no border (true mobile feel).
 *   - Tablets / desktop:    a tablet-sized portrait frame centered on the
 *                           page with a subtle rounded outline + soft glow,
 *                           so the design reads as a "device" rather than
 *                           a tiny window in a black void.
 *
 * The inner frame caps at 560×1100 so on huge desktops the UI stays
 * comfortably readable instead of stretching the phone-first layout.
 */
export function PhoneShell({ children }: Props) {
  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      display: 'grid',
      placeItems: 'center',
      background: 'radial-gradient(ellipse at center, #0a0c1c 0%, #050816 70%)',
      overflow: 'hidden',
      // CSS variables flip the inner frame between "fill the phone" and
      // "framed tablet" using a single media query rather than JS.
    }}>
      <style>{`
        :root {
          --shell-w: 100vw;
          --shell-h: 100dvh;
          --shell-radius: 0px;
          --shell-border: 0px solid transparent;
          --shell-shadow: none;
        }
        @media (min-width: 540px) and (min-height: 600px) {
          :root {
            --shell-w: min(560px, calc(100dvh * 0.52));
            --shell-h: min(1100px, calc(100dvh - 24px));
            --shell-radius: 28px;
            --shell-border: 1px solid rgba(255,255,255,0.08);
            --shell-shadow: 0 0 80px rgba(244, 208, 74, 0.08), 0 24px 60px rgba(0,0,0,0.45);
          }
        }
      `}</style>
      <div style={{
        width: 'var(--shell-w)',
        height: 'var(--shell-h)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--shell-radius)',
        border: 'var(--shell-border)',
        boxShadow: 'var(--shell-shadow)',
        background: '#fef8f0',
      }}>
        {children}
      </div>
    </div>
  );
}
