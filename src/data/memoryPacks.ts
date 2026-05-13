/**
 * Memory Packs — event-themed packs that pull from a curated mix of
 * existing theme templates. Each pack ships with its own vibe: a name,
 * tagline, gradient, and (most importantly) a free cosmetic filter that
 * unlocks the FIRST time the player opens it. Subsequent opens drop
 * three cards like a normal pack but skip the cosmetic grant.
 *
 * Gameplay-wise these are interchangeable with element packs — they just
 * draw from a different pool. The "memory" framing nudges players to use
 * the photo personalization for real life moments (a birthday, a trip,
 * the new puppy) rather than abstract themes.
 */

import type { ElementId } from '../game/types';
import type { FilterId } from './filters';

export interface MemoryPackDef {
  id: string;
  name: string;
  blurb: string;
  /** Themes this pack draws cards from. Cards are weighted by their
   *  baseline rarity within the combined pool. */
  themes: ElementId[];
  /** Cost in coins. Premium tier compared to single-theme packs. */
  cost: number;
  /** Gradient stops for the pack art + nav row. */
  gradient: [string, string];
  /** Accent / glow color for borders, halo, etc. */
  glow: string;
  /** Filter granted free on first open. */
  bonusFilter: FilterId;
}

export const MEMORY_PACKS: MemoryPackDef[] = [
  {
    id: 'birthday',
    name: 'Birthday',
    blurb: 'Candles, cake, and the people who showed up.',
    themes: ['family', 'food'],
    cost: 150,
    gradient: ['#ff9f1c', '#ee5a52'],
    glow: '#ffd166',
    bonusFilter: 'sunset',
  },
  {
    id: 'vacation',
    name: 'Vacation',
    blurb: 'Postcards from somewhere you needed to be.',
    themes: ['travel', 'food', 'animals'],
    cost: 160,
    gradient: ['#06d6a0', '#3a8fc4'],
    glow: '#9be7ff',
    bonusFilter: 'dreamy',
  },
  {
    id: 'pet',
    name: 'My Pet',
    blurb: 'The fluffy, scaly, or feathered roommate.',
    themes: ['animals', 'family'],
    cost: 140,
    gradient: ['#7a4ea8', '#a47bff'],
    glow: '#d4baff',
    bonusFilter: 'vintage',
  },
  {
    id: 'milestone',
    name: 'Milestone',
    blurb: 'Graduations, promotions, the big firsts.',
    themes: ['education', 'work', 'family'],
    cost: 200,
    gradient: ['#a47bff', '#ee5a52'],
    glow: '#ffb7d8',
    bonusFilter: 'holo',
  },
];

export function getMemoryPack(id: string): MemoryPackDef | undefined {
  return MEMORY_PACKS.find(p => p.id === id);
}
