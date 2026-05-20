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
 *
 * Pool rules are internal — `tags` and `excludeTags` reference fields on
 * CardTemplate that NEVER render in the UI. They're the curation knob
 * that lets the Pet pack be actual pets (dog/cat/belly rub) and the
 * Couple pack stay focused on the relationship arc instead of bleeding
 * the entire Family element in.
 */

import type { ElementId } from '../game/types';
import type { FilterId } from './filters';
import type { PoolRule } from './templates';

export interface MemoryPackDef {
  id: string;
  name: string;
  blurb: string;
  /** Display-only — used to pick a representative element for the pack
   *  vibe (icon/glow) and to label the gradient row. The actual draw
   *  pool is built from `pool`, not from this list. */
  themes: ElementId[];
  /** Pool-build rules. Union of slices; see templatesByPool(). */
  pool: PoolRule[];
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
    // Family + food, minus the couple arc — your ex doesn't show up to
    // your birthday. (excludeTags is the gate that keeps cou-* cards out.)
    pool: [{ themes: ['family', 'food'], excludeTags: ['relationship'] }],
    cost: 150,
    gradient: ['#ff9f1c', '#ee5a52'],
    glow: '#ffd166',
    bonusFilter: 'sunset',
  },
  {
    id: 'vacation',
    name: 'Vacation',
    blurb: 'Postcards from somewhere you needed to be.',
    themes: ['travel', 'food'],
    // Travel + food. Animals removed — a lion in the vacation pack
    // felt off; if you want a safari card it belongs in a future
    // dedicated pack, not here.
    pool: [{ themes: ['travel', 'food'] }],
    cost: 160,
    gradient: ['#06d6a0', '#3a8fc4'],
    glow: '#9be7ff',
    bonusFilter: 'dreamy',
  },
  {
    id: 'pet',
    name: 'My Pet',
    blurb: 'The fluffy, scaly, or feathered roommate.',
    themes: ['animals'],
    // Tag-only pool. Pulls Cat/Dog/Family Pet/Belly Rub/Walkies/Treats/
    // Vet Visit/Good Boy/Muzzle/Rabbit — and nothing else. Wolves and
    // lions stay in the Animals element pack where they belong.
    pool: [{ tags: ['pet'] }],
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
    // Education + work + family, minus the couple arc. The graduation
    // photo is your family, not your dating history.
    pool: [{ themes: ['education', 'work', 'family'], excludeTags: ['relationship'] }],
    cost: 200,
    gradient: ['#a47bff', '#ee5a52'],
    glow: '#ffb7d8',
    bonusFilter: 'holo',
  },
  {
    id: 'couple',
    name: 'Couple',
    blurb: 'First date to anniversary, and the laundry in between.',
    themes: ['family', 'travel', 'food'],
    // Tag-only pool: the cou-* arc (Crush, Boyfriend/Girlfriend, Wedding
    // Day, Honeymoon, Date Night Dinner, Cleaning Day, etc.). The arc
    // already spans family/travel/food/work in its element assignments,
    // so the tag does the focusing — no need to also union the full
    // travel/food pools, which would dilute the pack back to noise.
    pool: [{ tags: ['relationship'] }],
    cost: 180,
    gradient: ['#ff79a4', '#a44a7a'],
    glow: '#ffc6dc',
    bonusFilter: 'dreamy',
  },
];

export function getMemoryPack(id: string): MemoryPackDef | undefined {
  return MEMORY_PACKS.find(p => p.id === id);
}
