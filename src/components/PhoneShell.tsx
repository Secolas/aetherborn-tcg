import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/**
 * Phone-shaped viewport. On mobile it fills the screen; on desktop it shows
 * a centered phone-sized frame so the design still reads.
 */
export function PhoneShell({ children }: Props) {
  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      display: 'grid',
      placeItems: 'center',
      background: '#050816',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 430,
        height: '100%',
        maxHeight: 'min(900px, 100dvh)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 60px rgba(244, 208, 74, 0.05)',
        borderRadius: 'min(30px, 0px)',
      }}>
        {children}
      </div>
    </div>
  );
}
