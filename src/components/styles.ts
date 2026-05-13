import type { CSSProperties } from 'react';
import {
  BRAND, BRAND_LIGHT, BRAND_DEEP,
  OWNED, PREMIUM,
  TEXT, TEXT_MID, TEXT_LIGHT, PAPER, BG, BG_WARM, BG_PEACH, BORDER,
} from '../design/tokens';

/**
 * PALETTE is the legacy import surface that the rest of the app uses
 * (e.g. `PALETTE.accent`, `PALETTE.textMid`). Its keys are kept
 * stable, but their values now come from the central design tokens in
 * src/design/tokens.ts. New code is encouraged to import the semantic
 * token directly (BRAND, OWNED, DAMAGE, etc.) — PALETTE will
 * eventually become a thin compatibility shim.
 *
 * No visual change in this commit: every token maps to the exact hex
 * the codebase was already using.
 */
export const PALETTE = {
  bg:        BG,
  bgWarm:    BG_WARM,
  bgPeach:   BG_PEACH,
  paper:     PAPER,
  text:      TEXT,
  textMid:   TEXT_MID,
  textLight: TEXT_LIGHT,
  accent:    BRAND_LIGHT,   // sunset coral
  accentDeep:BRAND_DEEP,
  yellow:    PREMIUM,
  green:     OWNED,
  shadow:    'rgba(255, 126, 95, 0.18)',
  border:    BORDER,
};

export const btnPrimary: CSSProperties = {
  background: `linear-gradient(180deg, #ffa07a 0%, ${BRAND_LIGHT} 60%, ${BRAND} 100%)`,
  color: PAPER,
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
  background: PAPER,
  color: TEXT,
  border: `1.5px solid ${BORDER}`,
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
  background: PAPER,
  border: `1.5px solid ${BORDER}`,
  color: TEXT,
  fontSize: 18,
  display: 'grid', placeItems: 'center',
  cursor: 'pointer',
  fontFamily: 'inherit',
  flex: '0 0 auto',
  boxShadow: '0 2px 6px rgba(58, 46, 42, .08)',
};
