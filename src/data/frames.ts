/**
 * Card-frame cosmetics — purely visual rings around the Card chrome.
 * Equipped globally (one frame applies to every card the player owns,
 * in matches as well as previews), unlike filters which are per-card.
 *
 * Frames never modify card stats, abilities, or interactions — strictly
 * a cosmetic overlay rendered at z-index above the card's own border but
 * below the photo. This means they read like a metal/wood/neon trim
 * sitting on the rim of the card.
 *
 * Visual is driven by `inset` and `outset` style objects so the Card
 * component can compose two layered effects: an outer halo / outline,
 * and an optional inner bevel ring. Frames can also override the card's
 * baseline boxShadow with their own (e.g. a gilded glow for the Gilded
 * frame). Pass `inset = undefined` to leave the card's default ring.
 */

import type { CSSProperties } from 'react';

export type FrameId = 'classic' | 'gilded' | 'neon' | 'etched';

export interface FrameDef {
  id: FrameId;
  name: string;
  description: string;
  cost: number;
  /** Outer ring + drop shadow. Painted as an absolutely-positioned
   *  sibling of the card body so it can extend beyond the card's
   *  bounding box (subtle glow halo for premium frames). */
  outer?: CSSProperties;
  /** Inner ring sitting just inside the card's rounded rect. */
  inner?: CSSProperties;
  /** Accent tint applied to the player's chrome (chips, name plate). */
  accent?: string;
}

export const FRAMES: Record<FrameId, FrameDef> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'The default look — clean and unfussy.',
    cost: 0,
  },
  gilded: {
    id: 'gilded',
    name: 'Gilded',
    description: 'Polished gold trim with a soft warm glow.',
    cost: 400,
    // Layered ring: 1px dark amber bezel (provides edge separation on
    // light backgrounds like Collection/DeckBuilder), then a thicker
    // bright-gold ring, then the warm glow + drop shadow. Without the
    // dark bezel the gold was blending into the cream surfaces and the
    // frame looked invisible outside the match.
    outer: {
      boxShadow:
        '0 0 0 1px #8a6a14, 0 0 0 3.5px #f4d04a, 0 0 24px rgba(244,208,74,.65), 0 10px 26px rgba(0,0,0,.40)',
    },
    inner: {
      boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.6), inset 0 0 14px rgba(244,208,74,.35)',
    },
    accent: '#f4d04a',
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    description: 'Cyan-magenta arcade glow that pulses with the cards.',
    cost: 350,
    outer: {
      boxShadow:
        '0 0 0 1px #4a0d3d, 0 0 0 3px #ff4dd2, 0 0 24px rgba(255,77,210,.55), 0 0 38px rgba(64,255,255,.35), 0 10px 22px rgba(0,0,0,.40)',
    },
    inner: {
      boxShadow: 'inset 0 0 0 1.5px rgba(64,255,255,.7), inset 0 0 16px rgba(255,77,210,.30)',
    },
    accent: '#ff4dd2',
  },
  etched: {
    id: 'etched',
    name: 'Etched',
    description: 'Dark engraved bezel with a subtle inner highlight.',
    cost: 300,
    outer: {
      boxShadow:
        '0 0 0 2.5px #2a2018, 0 8px 22px rgba(0,0,0,.55)',
    },
    inner: {
      boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,.55), inset 0 0 16px rgba(0,0,0,.35)',
    },
    accent: '#cfa962',
  },
};

export const FRAME_ORDER: FrameId[] = ['classic', 'gilded', 'neon', 'etched'];
export const STARTER_FRAMES: FrameId[] = ['classic'];

export function getFrame(id: FrameId | undefined): FrameDef {
  return FRAMES[id ?? 'classic'] ?? FRAMES.classic;
}
