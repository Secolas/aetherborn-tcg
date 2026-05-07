import type { CSSProperties } from 'react';

export const btnPrimary: CSSProperties = {
  background: 'linear-gradient(180deg, #f4d04a, #c4801a)',
  color: '#3a2a0e',
  border: 'none', borderRadius: 28,
  padding: '13px 24px',
  fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: '0 6px 16px rgba(244,208,74,.4)',
  fontFamily: 'inherit',
};

export const btnSecondary: CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,.08)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,.15)',
  borderRadius: 22,
  padding: '11px 0',
  fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export const iconBtn: CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'rgba(255,255,255,.08)',
  border: '1px solid rgba(255,255,255,.15)',
  color: '#fff',
  fontSize: 18,
  display: 'grid', placeItems: 'center',
  cursor: 'pointer',
  fontFamily: 'inherit',
  flex: '0 0 auto',
};
