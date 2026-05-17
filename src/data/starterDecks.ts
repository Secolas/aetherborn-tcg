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
    description: 'Tanky bodies, multiple heals, and a 4/6 Dad to close it out. Hard to die, easy to grind down a faster deck.',
    iconCardId: 'fam-11',
    /* Identity: control / sustain / late-game tank.
     * Toolkit: 2 heals (Hug, Niece passive), 2 card draw (Chat, Tio),
     * 1 freeze (The Look), 1 silence (Tough Love), bond pair
     * (Cousin x2 + Older Sibling = "The Kids"), finisher (Dad). The
     * heaviest mana curve of the three — Family trades tempo for
     * raw stats and inevitability. */
    deck: [
      'fam-14',                 // 1c spell — Hug, heal +3 friend
      'fam-16',                 // 1c 1/2  — Niece (heal +1/turn)
      'fam-15',                 // 2c spell — Family Chat (draw 1)
      'fam-02', 'fam-02',       // 2c 2/2  — Cousin x2 (bond piece)
      'fam-13',                 // 2c spell — Tough Love (silence)
      'fam-04',                 // 3c 2/3  — Tio (draw on play)
      'fam-05',                 // 3c 3/4  — Mom
      'fam-06',                 // 3c spell — The Look (freeze)
      'fam-07',                 // 4c 4/4  — Older Sibling (bond)
      'fam-08',                 // 4c 2/6  — Abuela (big tank)
      'fam-11',                 // 5c 4/6  — Dad (finisher)
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    pitch: 'Strike fast. Strike often.',
    description: 'Family Pet attacks the turn you play it. Snake Bite finishes wounded creatures. Wolf closes the game.',
    iconCardId: 'ani-11',
    /* Identity: aggro / Rush / burst.
     * Toolkit: 1 Rush creature (Family Pet, cross-theme by design —
     * the existing animals theme has no Rush creatures of its own),
     * 1 heal (Belly Rub), 1 damage spell (Snake Bite), 1 draw spell
     * (Walkies, draws 2), 1 buff (Good Boy), bond pair (Cat + Dog
     * = "Tale of Tails"), finisher (Wolf). Cheapest curve so the
     * player can lead with multiple 1-cost plays. */
    deck: [
      'fam-01',                 // 1c 2/1 Rush — Family Pet (themed: animals)
      'ani-01',                 // 1c 1/1  — Mouse
      'ani-16',                 // 1c spell — Good Boy (+0/+2 buff)
      'ani-03',                 // 2c 2/2  — Rabbit
      'ani-15',                 // 2c spell — Belly Rub (heal +4)
      'ani-02',                 // 2c spell — Snake Bite (3 dmg)
      'ani-17',                 // 2c spell — Walkies (draw 2)
      'ani-04',                 // 3c 3/2  — Cat (bond piece)
      'ani-05',                 // 3c 2/4  — Dog (bond piece)
      'ani-06',                 // 3c 2/3  — Owl
      'ani-10',                 // 4c 3/3  — Horse
      'ani-11',                 // 5c 5/4  — Wolf (finisher)
    ],
  },
  {
    id: 'food',
    name: 'Food',
    pitch: 'Snack. Recover. Win late.',
    description: 'Sticky 1-cost plays, on-play card draw, and Family Feast to flip a losing late game with +4 HP across the board.',
    iconCardId: 'fd-10',
    /* Identity: value / sustain / late-game flip.
     * Toolkit: 1 Rush creature (Snack), 2 heals (Sip, Grandma's Pie
     * passive), 1 draw (Breakfast Plate on-play), 1 damage spell
     * (Spicy Sauce), 1 buff (Recipe Card), bond pair (Toast
     * + Breakfast Plate = "Breakfast Combo"), finishers (The Cook
     * + Family Feast late-game heal flip). Lower raw ATK total than
     * the others — Food wins by outlasting and out-trading, not by
     * out-damaging. */
    deck: [
      'fd-01',                  // 1c 1/2  — Toast (bond piece)
      'fd-03',                  // 1c 2/1 Rush — Snack
      'fd-13',                  // 1c spell — Sip (heal +3 friend)
      'fd-04',                  // 2c 1/3  — Breakfast Plate (bond, draw)
      'fd-05',                  // 2c 2/2  — Lunch Box
      'fd-07',                  // 2c spell — Recipe Card (+1/+1 buff)
      'fd-14',                  // 2c spell — Spicy Sauce (2 dmg)
      'fd-06',                  // 3c 1/4  — Slow Cooker
      'fd-10',                  // 3c 2/5  — Grandma's Pie (heal/turn)
      'fd-16',                  // 3c 3/3  — Sandwich
      'fd-11',                  // 4c 3/4  — The Cook
      'fd-12',                  // 6c spell — Family Feast (heal flip)
    ],
  },
];

export function getStarterTheme(id: ElementId): StarterTheme | undefined {
  return STARTER_THEMES.find(t => t.id === id);
}
