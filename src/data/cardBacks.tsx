/**
 * Card-back cosmetics — the face-down design shown on the player's draw
 * pile and hand-back animations. Equipped globally (one back applies to
 * every player draw). Future entries can introduce themed seasonal
 * backs, theme-tied backs ("Family Crest"), or boss-rewards.
 *
 * Each entry owns its own render so the visuals can vary wildly — solid
 * geometric like the default Navy Diamond, hand-drawn paper backs,
 * gradient holos, etc. The CardBack component is a thin dispatcher.
 */

import type { CSSProperties, ReactElement } from 'react';

export type CardBackId = 'navy-diamond';

export const DEFAULT_CARD_BACK: CardBackId = 'navy-diamond';

export interface CardBackDef {
  id: CardBackId;
  name: string;
  description: string;
  cost: number;
  /** Rendered preview + actual face-down card. Receives layout props. */
  render: (props: { scale: number; rotate: number }) => ReactElement;
}

/** Starter set — owned automatically. App.tsx seeds these on save load. */
export const STARTER_CARD_BACKS: CardBackId[] = ['navy-diamond'];

export const CARD_BACK_ORDER: CardBackId[] = ['navy-diamond'];

export const CARD_BACKS: Record<CardBackId, CardBackDef> = {
  'navy-diamond': {
    id: 'navy-diamond',
    name: 'Navy Diamond',
    description: 'The classic — deep navy with a gold-set diamond emblem.',
    cost: 0,
    render: ({ scale, rotate }) => <NavyDiamond scale={scale} rotate={rotate} />,
  },
};

function NavyDiamond({ scale, rotate }: { scale: number; rotate: number }) {
  const w = 220 * scale;
  const h = 320 * scale;
  const wrap: CSSProperties = {
    width: w, height: h,
    borderRadius: 12 * scale,
    background: 'linear-gradient(160deg, #2a3a5e 0%, #14223e 60%, #0a1428 100%)',
    boxShadow: `0 ${4 * scale}px ${8 * scale}px rgba(0,0,0,.35), inset 0 0 0 ${2 * scale}px rgba(255,255,255,.10)`,
    transform: `rotate(${rotate}deg)`,
    position: 'relative',
    overflow: 'hidden',
    flex: '0 0 auto',
  };
  return (
    <div style={wrap}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 35%, rgba(180,200,255,.18) 0%, transparent 55%)',
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: w * 0.42, height: w * 0.42,
        transform: 'translate(-50%, -50%) rotate(45deg)',
        border: `${1.5 * scale}px solid rgba(220,230,255,.45)`,
        background: 'rgba(120,140,200,.15)',
        borderRadius: 4 * scale,
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: w * 0.18, height: w * 0.18,
        transform: 'translate(-50%, -50%) rotate(45deg)',
        background: 'linear-gradient(160deg, #f4d04a, #c8901a)',
        borderRadius: 3 * scale,
        boxShadow: `0 0 ${6 * scale}px rgba(244,208,74,.5)`,
      }} />
    </div>
  );
}
