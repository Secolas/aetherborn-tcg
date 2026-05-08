import type { CSSProperties } from 'react';

/**
 * Fun, bright button language. Sunset coral primary, cream secondary,
 * soft drop shadows. Designed for a warm light background.
 */

export const PALETTE = {
  bg:        '#fef8f0',
  bgWarm:    '#ffe8d6',
  bgPeach:   '#ffd1b3',
  paper:     '#ffffff',
  text:      '#3a2e2a',
  textMid:   '#7a5a52',
  textLight: '#a89580',
  accent:    '#ff7e5f', // sunset coral
  accentDeep:'#e85d3c',
  yellow:    '#ffd166',
  green:     '#06d6a0',
  shadow:    'rgba(255, 126, 95, 0.18)',
  border:    'rgba(58, 46, 42, 0.10)',
};

export const btnPrimary: CSSProperties = {
  background: 'linear-gradient(180deg, #ffa07a 0%, #ff7e5f 60%, #ee5a52 100%)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 22,
  padding: '14px 24px',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(255, 94, 60, .35), inset 0 1px 0 rgba(255,255,255,.4)',
  fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
  transition: 'transform .1s, box-shadow .15s',
};

export const btnSecondary: CSSProperties = {
  flex: 1,
  background: '#ffffff',
  color: PALETTE.text,
  border: `1.5px solid ${PALETTE.border}`,
  borderRadius: 18,
  padding: '11px 0',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.03em',
  cursor: 'pointer',
  fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
  boxShadow: '0 2px 6px rgba(58, 46, 42, .06)',
  transition: 'transform .1s, box-shadow .15s',
};

export const iconBtn: CSSProperties = {
  width: 36, height: 36, borderRadius: '50%',
  background: '#ffffff',
  border: `1.5px solid ${PALETTE.border}`,
  color: PALETTE.text,
  fontSize: 18,
  display: 'grid', placeItems: 'center',
  cursor: 'pointer',
  fontFamily: 'inherit',
  flex: '0 0 auto',
  boxShadow: '0 2px 6px rgba(58, 46, 42, .08)',
};
