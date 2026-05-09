import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/**
 * Viewport shell.
 *
 *   - Phone (≤ 540 wide):
 *       fills the screen edge-to-edge, no rounding.
 *
 *   - Tablet / desktop:
 *       fills as much of the viewport as is comfortable (capped at
 *       1200×1100 so it doesn't sprawl on huge 4K monitors), then a
 *       soft glow + rounded outline around the inner stage so the
 *       design reads as a "device" rather than full-bleed app chrome.
 *
 * The inner stage no longer gets a CSS transform-scale — the previous
 * approach broke `position: fixed` (drag-from-hand) and made
 * `getBoundingClientRect`-based math (attack arrow, spell-target burst)
 * off by the scale factor. Now the existing flex-column layouts inside
 * each screen simply expand to fill whatever stage they get.
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
            --shell-w: min(100vw, 1200px);
            --shell-h: min(100dvh, 1100px);
            --shell-radius: 24px;
            --shell-border: 1px solid rgba(255,255,255,0.06);
            --shell-shadow: 0 0 80px rgba(244, 208, 74, 0.06), 0 24px 60px rgba(0,0,0,0.4);
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
