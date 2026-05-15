import type { ElementId } from '../game/types';

/**
 * Pokémon-style starter decks — the player picks ONE on first boot and
 * receives those 12 cards (with empty photos) as their starting pool.
 *
 * Each deck is hand-curated for the new-player experience:
 *   - Family   — long-game sustain. Heals + chunky bodies. Hardest to
 *                lose with, easiest to mis-play with.
 *   - Animals  — fast aggro. Cheap bodies and burst spells. Teaches
 *                trading and tempo.
 *   - Food     — board control. Lots of 1-2c plays that snowball with
 *                heals + buffs. Teaches sustain and value.
 *
 * Curves are tuned so the deck has at least one 1-cost and one 2-cost
 * for every opening hand: even a brand-new player can land a play on
 * turn 1 without mulligan logic.
 *
 * Card IDs are template ids from src/data/templates.ts — the starter
 * pack generator resolves them to fresh CollectionCard instances with
 * `photo: null` (the starter open flow walks the player through
 * photographing each one).
 */

export interface StarterTheme {
  id: ElementId;
  /** Display name on the picker tile. */
  name: string;
  /** One-line pitch — appears under the name on the picker. */
  pitch: string;
  /** Slightly longer body copy — appears on the picker tile's back. */
  description: string;
  /** Template id that previews the deck's "iconic" card on the picker
   *  tile (e.g. Dad for Family, Wolf for Animals, Grandma's Pie for
   *  Food). Renders large on the tile. */
  iconCardId: string;
  /** Ordered list of 12 template ids granted on starter pick. Order is
   *  the sequence the starter pack open flow reveals them in. */
  deck: string[];
}

export const STARTER_THEMES: StarterTheme[] = [
  {
    id: 'family',
    name: 'Family',
    pitch: 'Heal. Defend. Outlast.',
    description: 'Big bodies, sturdy heals. Hard to die, easy to grind a slow win.',
    iconCardId: 'fam-11',
    deck: [
      'fam-01', 'fam-14', 'fam-16',
      'fam-02', 'fam-02', 'fam-13', 'fam-15',
      'fam-04', 'fam-05',
      'fam-07', 'fam-08',
      'fam-11',
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    pitch: 'Strike fast. Strike often.',
    description: 'Cheap creatures, quick trades. Aggression beats hesitation.',
    iconCardId: 'ani-11',
    deck: [
      'ani-01', 'ani-01', 'ani-14', 'ani-16',
      'ani-03', 'ani-03', 'ani-13', 'ani-15',
      'ani-04', 'ani-05',
      'ani-10',
      'ani-11',
    ],
  },
  {
    id: 'food',
    name: 'Food',
    pitch: 'Snack. Recover. Win late.',
    description: 'Tiny plays that snowball. Heals and ramp into a fat finisher.',
    iconCardId: 'fd-10',
    deck: [
      'fd-01', 'fd-02', 'fd-03', 'fd-03', 'fd-13',
      'fd-04', 'fd-05', 'fd-07',
      'fd-06', 'fd-08', 'fd-10',
      'fd-16',
    ],
  },
];

export function getStarterTheme(id: ElementId): StarterTheme | undefined {
  return STARTER_THEMES.find(t => t.id === id);
}
