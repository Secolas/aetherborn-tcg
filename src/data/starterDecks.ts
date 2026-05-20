import type { ElementId } from '../game/types';

/**
 * Pokémon-style starter decks — the player picks ONE on first boot and
 * receives those 12 cards (with empty photos) as their starting pool.
 *
 * Three themes are presented in the picker (`PICKABLE_STARTER_THEMES`):
 *   - Family    — long-game sustain. Heals + chunky bodies. Photos:
 *                 your relatives.
 *   - Work      — fast tempo. Cheap aggressive bodies + two damage
 *                 spells. Photos: your desk, coworkers, office objects.
 *   - Education — scaling ramp. Level-up creatures and a wide-board
 *                 finisher. Photos: school stuff (books, pencil,
 *                 backpack), old school photos, library/classroom.
 *
 * Animals and Food themes remain defined below (but excluded from the
 * picker) so saves from earlier builds where the player chose one of
 * them resolve cleanly through `getStarterTheme`.
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
   *  tile (e.g. Dad for Family, The Boss for Work, Graduation Day for
   *  Education). Renders large on the tile. */
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
    id: 'work',
    name: 'Work',
    pitch: 'Spam the inbox. Close the deal.',
    description: 'Cheap bodies, four damage spells, and Hired turning every email into bonus face damage. The 6c Boss closes when you finally have the mana for him.',
    iconCardId: 'wrk-12',
    /* Identity: tempo / aggressive curve / spell-burn synergy.
     * Toolkit: 1c body + 1c removal spell on turn 1, two 2c bodies
     * for turn 2 momentum, a 3c value-creature with draw + a 3c
     * spell-synergy creature + 2x 3c 4-dmg spells to keep pressure
     * on, a sticky untargetable body, two Taunt closers (Custodian
     * + The Boss). Cheaper curve than Family
     * — Work wins on tempo, not stats. 6 creatures / 6 spells keeps
     * the body count in line with the other two starters. */
    deck: [
      'wrk-01',                 // 1c 1/1  — Intern
      'wrk-02', 'wrk-02',       // 1c spell x2 — Spam Email (2 dmg)
      'wrk-03', 'wrk-03',       // 2c 2/2 x2 — Coworker
      // Balance pass (starter parity): two swaps to close the 7 pp
      // gap with Family/Education starters. Iteration log:
      //   • Coworker → Hired alone: 44.8% → 44.2% (tempo loss).
      //   • Custodian → Hired alone: 44.8% → 42.9% (Custodian was
      //     load-bearing vs aggro).
      //   • Promotion → Hired alone: 44.8% (net-zero — Hired's
      //     synergy didn't compensate for losing the buff).
      // Working theory: the deck doesn't lack synergy, it lacks
      // burn. boss-Manager's win comes from 2x Sales Pitch + 2x
      // Spam Email = 12 base damage from spells. The starter only
      // had 1x Sales Pitch + 2x Spam Email = 8 burn.
      //
      // Two swaps:
      //   − Performance Review (2c situational silence) and
      //     Promotion (4c conditional buff) — both often held dead.
      //   + Hired (3c 2/3 spell_synergy 1) — pings 1 face per
      //     spell cast while alive. Across the deck's 5 remaining
      //     spells that's ~5 bonus face damage per game.
      //   + 2nd Sales Pitch (3c 4-damage burn) — same package boss
      //     Manager runs. Doubles the deck's reliable removal/burn.
      // Trade-off: no more silence answer to enemy Taunt/Untargetable;
      // the deck leans harder on Sales Pitch to break through.
      'wrk-19',                 // 3c 2/3  — Hired (spell_synergy 1)
      'wrk-05',                 // 3c 2/3  — IT Support (draw on play)
      'wrk-06', 'wrk-06',       // 3c spell x2 — Sales Pitch (4 dmg)
      'wrk-07',                 // 4c 3/4  — HR (untargetable)
      'wrk-16',                 // 5c 4/5  — Custodian (Taunt)
      'wrk-12',                 // 6c 5/6  — The Boss (taunt, finisher)
    ],
  },
  {
    id: 'education',
    name: 'Education',
    pitch: 'Study. Level up. Graduate.',
    description: 'Level-up creatures grow stronger each turn, draw engines keep your hand full, and Graduation Day buffs your whole team to close.',
    iconCardId: 'edu-12',
    /* Identity: scaling / ramp / wide-board payoff.
     * Toolkit: 1c body + 1c draw spell + duplicate draw spell to
     * dig fast, two 2c level_up bodies that grow over time, a 2c
     * freeze and a 2c discard-2/draw-2 cycle, a 3c rush creature
     * and a 3c 4/2 pressure body, a 4c heal-each-turn tank, a 4c
     * graduating creature (Senior Year), and a 6c Graduation Day
     * buff-all finisher. Slowest of the three — Education wants
     * to survive into turn 5+ where the level_up math takes over. */
    deck: [
      'edu-01',                 // 1c 1/1  — Pencil
      'edu-02', 'edu-02',       // 1c spell x2 — Backpack (draw)
      'edu-03',                 // 2c 1/3  — Math Teacher (level_up)
      'edu-04',                 // 2c spell — Bathroom Break (freeze)
      'edu-07',                 // 2c spell — Pop Quiz (discard 1, draw 2)
      'edu-13',                 // 3c 3/3  — Physical Ed Class (rush)
      'edu-06',                 // 3c 2/4  — Physics Class (level_up)
      'edu-08',                 // 3c 4/2  — The Bully
      'edu-09',                 // 4c 1/6  — Library (heal each turn)
      'edu-11',                 // 4c 2/3  — Senior Year (graduate)
      'edu-12',                 // 6c 4/5  — Graduation Day (buff_all on play)
    ],
  },

  // ─── Retired starter themes ──────────────────────────────────────
  // Kept defined so saves where the player picked one of these in an
  // earlier build still resolve through getStarterTheme — the new
  // picker (PICKABLE_STARTER_THEMES below) excludes them.
  {
    id: 'animals',
    name: 'Animals',
    pitch: 'Strike fast. Strike often.',
    description: 'A rush creature swings the turn you play it, a damage spell finishes wounded creatures, and Wolf closes the game.',
    iconCardId: 'ani-11',
    deck: [
      'fam-01',                 // 1c 2/1 Rush — Family Pet (themed: animals)
      'ani-01',                 // 1c 1/1  — Mouse
      'ani-16',                 // 1c spell — Good Boy (+0/+2 buff)
      'ani-03',                 // 2c 2/2  — Rabbit
      'ani-15',                 // 2c spell — Belly Rub (heal +4)
      'ani-02',                 // 2c spell — Snake Bite (3 dmg)
      'ani-17',                 // 2c spell — Walkies (draw 2)
      'ani-04',                 // 3c 2/2  — Cat (bond piece)
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
    description: 'Sticky 1-cost plays, on-play card draw, and a 6c board-wide heal to flip a losing late game.',
    iconCardId: 'fd-10',
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

/** Themes shown in the StarterPick picker. Family / Work / Education
 *  are the three options new players see — chosen for clear playstyle
 *  separation (sustain / tempo / scaling) AND because every adult has
 *  easy access to photographable subjects for each (relatives, the
 *  office / coworkers / desk objects, old school memorabilia or
 *  current school stuff for parents). Animals and Food are still
 *  defined in STARTER_THEMES so legacy saves resolve, but they don't
 *  appear here. */
export const PICKABLE_STARTER_THEMES: StarterTheme[] =
  STARTER_THEMES.filter(t => t.id === 'family' || t.id === 'work' || t.id === 'education');

export function getStarterTheme(id: ElementId): StarterTheme | undefined {
  return STARTER_THEMES.find(t => t.id === id);
}
