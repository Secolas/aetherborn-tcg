import type { ElementId } from '../game/types';

export interface ElementDef {
  name: string;
  color: string;
  deep: string;
  glow: string;
  /** What kind of photo prompt this theme is — shown on pack cover and intros. */
  blurb: string;
}

/**
 * Themes are the photo-prompt categories. Each one tells the player what
 * to point their camera at. Color palette is tuned to evoke the theme:
 * Family is warm/coral, Work is steel-blue corporate, Animals is earthy green.
 */
export const ELEMENTS: Record<ElementId, ElementDef> = {
  family:  { name: 'Family',  color: '#d96658', deep: '#6e1f1a', glow: '#f4b8a8',
             blurb: 'the people who raised you' },
  work:    { name: 'Work',    color: '#4a6280', deep: '#1c2a3d', glow: '#b6c5da',
             blurb: 'the office, the grind, the boss' },
  animals: { name: 'Animals', color: '#5ea863', deep: '#1f4524', glow: '#b9e3b8',
             blurb: 'pets, wildlife, the creatures around you' },
  travel:  { name: 'Travel',  color: '#3aa8c4', deep: '#155a73', glow: '#a8dde8',
             blurb: 'planes, trains, hotels, the road' },
  food:    { name: 'Food',    color: '#d99a3a', deep: '#6e4818', glow: '#f4d59a',
             blurb: 'meals, snacks, coffee — what fuels your day' },
  education:{ name: 'Education', color: '#5a5fd9', deep: '#1a1f6e', glow: '#b8bdf5',
             blurb: 'school days — classrooms, teachers, exams, graduation' },
};

/**
 * Card chrome is colored by TYPE, not theme. Every creature looks the same;
 * every spell looks the same. Themes are signaled via the element glyph and
 * the type chip text, never the card color.
 *
 * Stage 2 of the color unification (see src/design/README.md): Creature
 * chrome moved from forest green (#5ea76b / #1f4d2d) to a muted teal so
 * it no longer reads as "yours" in competition with the OWNED mint
 * (#06d6a0) used for player-side bond badges + reward indicators.
 * Distance from OWNED is the goal — a desaturated cyan-teal is far
 * enough from mint that the eye reads them as two separate cues.
 */
export const TYPE_PALETTE = {
  Creature: { top: '#5a8a7e', deep: '#1f4641', chip: '#3d7a72' },
  Spell:    { top: '#9c6fc8', deep: '#3d2456', chip: '#7a4ea8' },
} as const;

export const RARITY_COLOR: Record<string, string> = {
  common: '#9a958c',
  rare: '#5a8fc4',
  epic: '#a45ec8',
  legendary: '#e0a93a',
};

export const RARITY_WEIGHT: Record<string, number> = {
  common: 60,
  rare: 28,
  epic: 10,
  legendary: 2,
};
