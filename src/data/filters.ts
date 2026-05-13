/**
 * Photo filters / borders the player can apply to a summoned card's photo.
 * Each filter is a presentational layer on top of the captured photo —
 * a CSS filter chain, an optional color overlay, and an optional border
 * accent. Filters never affect gameplay; they're pure cosmetics.
 *
 * Two ways to unlock:
 *  1. Coin purchase from the in-Capture cosmetic picker.
 *  2. Free grant on first opening of the matching Memory Pack (see
 *     src/data/memoryPacks.ts).
 *
 * `none` is always available — it represents the default unfiltered look.
 */

export type FilterId =
  | 'none'
  | 'sepia'
  | 'noir'
  | 'holo'
  | 'dreamy'
  | 'sunset'
  | 'frost'
  | 'vintage';

export interface PhotoFilter {
  id: FilterId;
  name: string;
  description: string;
  /** CSS `filter` property applied to the photo <img>. */
  cssFilter: string;
  /** Optional overlay painted on top of the photo (inside the photo frame).
   *  Use sparingly — strong overlays can wash out faces. */
  overlay?: {
    background: string;
    mixBlendMode?: React.CSSProperties['mixBlendMode'];
    /** Animated CSS keyframe name to play infinitely on the overlay
     *  (e.g. holo sheen sweep). */
    animation?: string;
  };
  /** Optional accent color for the inner photo-frame ring. */
  accent?: string;
  /** Coin cost to buy. 0 = free / always unlocked. */
  cost: number;
  /** Set by content tagging — what kind of "vibe" this filter is for.
   *  Surfaced as a soft label in the picker. */
  tag?: 'classic' | 'premium' | 'mood' | 'event';
}

export const FILTERS: Record<FilterId, PhotoFilter> = {
  none: {
    id: 'none', name: 'Original', description: 'No filter — your photo as captured.',
    cssFilter: 'none', cost: 0, tag: 'classic',
  },
  sepia: {
    id: 'sepia', name: 'Sepia', description: 'Warm vintage tones, like a faded family album.',
    cssFilter: 'sepia(0.65) saturate(1.15) brightness(0.96) contrast(1.05)',
    accent: '#c9a26b',
    cost: 0, tag: 'classic',
  },
  noir: {
    id: 'noir', name: 'Noir', description: 'High-contrast black & white. Dramatic.',
    cssFilter: 'grayscale(1) contrast(1.25) brightness(0.95)',
    accent: '#2a2a2a',
    cost: 200, tag: 'mood',
  },
  holo: {
    id: 'holo', name: 'Holo', description: 'Iridescent shimmer that catches the light.',
    cssFilter: 'saturate(1.3) brightness(1.05) contrast(1.05)',
    overlay: {
      background: 'linear-gradient(115deg, rgba(255,0,128,.18), rgba(64,255,255,.18) 35%, rgba(255,255,64,.18) 65%, rgba(180,64,255,.18))',
      mixBlendMode: 'screen',
      animation: 'holoFilterSweep 3.4s linear infinite',
    },
    accent: '#a47bff',
    cost: 500, tag: 'premium',
  },
  dreamy: {
    id: 'dreamy', name: 'Dreamy', description: 'Soft glow, gentle bloom. Memory-core.',
    cssFilter: 'saturate(1.1) brightness(1.08) contrast(0.95)',
    overlay: {
      background: 'radial-gradient(ellipse at center, rgba(255,225,200,.20), transparent 70%)',
      mixBlendMode: 'screen',
    },
    accent: '#ffd1b3',
    cost: 250, tag: 'mood',
  },
  sunset: {
    id: 'sunset', name: 'Sunset', description: 'Golden-hour glow across the photo.',
    cssFilter: 'saturate(1.2) brightness(1.02) contrast(1.05)',
    overlay: {
      background: 'linear-gradient(180deg, rgba(255,160,90,.22) 0%, transparent 50%, rgba(238,90,82,.18) 100%)',
      mixBlendMode: 'overlay',
    },
    accent: '#ff9f1c',
    cost: 250, tag: 'event',
  },
  frost: {
    id: 'frost', name: 'Frost', description: 'Cool blue mist — calm, distant.',
    cssFilter: 'saturate(0.85) brightness(1.02) hue-rotate(10deg)',
    overlay: {
      background: 'linear-gradient(180deg, rgba(190,225,255,.20) 0%, rgba(120,170,220,.12) 100%)',
      mixBlendMode: 'screen',
    },
    accent: '#8fbfe8',
    cost: 250, tag: 'mood',
  },
  vintage: {
    id: 'vintage', name: 'Vintage', description: 'Faded edges, soft grain. Like a Polaroid.',
    cssFilter: 'sepia(0.25) saturate(0.85) contrast(1.05) brightness(0.98)',
    overlay: {
      background: `
        radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.30) 100%),
        repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0px, rgba(255,255,255,.04) 1px, transparent 1px, transparent 3px)
      `,
      mixBlendMode: 'multiply',
    },
    accent: '#b8a079',
    cost: 300, tag: 'event',
  },
};

/** Stable display order — drives the picker UI. Free filters first, then
 *  by cost ascending. */
export const FILTER_ORDER: FilterId[] = [
  'none', 'sepia', 'noir', 'dreamy', 'sunset', 'frost', 'vintage', 'holo',
];

/** Filter ids unlocked for a brand-new player. */
export const STARTER_FILTERS: FilterId[] = ['none', 'sepia'];

export function getFilter(id: FilterId | undefined): PhotoFilter {
  return FILTERS[id ?? 'none'] ?? FILTERS.none;
}
