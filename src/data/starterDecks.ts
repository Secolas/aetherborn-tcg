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
    description: 'Tanky bodies, multiple heals, and the 2/6 Abuela holding the line. Hard to die, easy to grind down a faster deck.',
    iconCardId: 'fam-11',
    /* Identity: control / sustain / late-game tank.
     * Toolkit: 2 heals (Hug, Niece passive), 2 card draw (Chat, Tio),
     * 1 freeze (The Look), 1 silence (Tough Love), bond pair
     * (Cousin x2 + Older Sibling = "The Kids"), finisher (Dad). The
     * heaviest mana curve of the three — Family trades tempo for
     * raw stats and inevitability. */
    // Entry-tier deck: no epics or legendaries. Players unlock the
    // premium finishers (Dad, Sunday Dinner, Generations bond) later
    // by opening Memory Packs. The starter teaches the heal/Taunt/
    // bond identity but caps out below boss tier so progression
    // matters. Previous balance pass had Dad in here (epic 5c 4/6
    // Taunt) and the deck sat at #2 overall, ahead of every boss —
    // that's backwards for TCG progression.
    deck: [
      'fam-14', 'fam-14',       // 1c spell x2 — Hug (heal +3 friend)
                                //   2nd copy replaces 4c Abuela (rare
                                //   2/6 Taunt — unlocked via packs)
      'fam-16',                 // 1c 1/2  — Niece (heal +1/turn)
      'fam-15',                 // 2c spell — Family Chat (draw 1)
      'fam-02', 'fam-02',       // 2c 2/2  — Cousin x2 (bond piece)
      'fam-04',                 // 3c 2/3  — Tio (draw on play)
      'fam-05',                 // 3c 3/4  — Mom
      'fam-06',                 // 3c spell — The Look (freeze)
      'fam-07',                 // 4c 4/4  — Older Sibling (bond)
      'fam-09',                 // 4c spell — Birthday Cake (heal 5)
                                //   replaces 5c Dad (epic finisher)
      'fam-13',                 // 2c spell — Tough Love (silence)
    ],
  },
  {
    id: 'work',
    name: 'Work',
    pitch: 'Spam the inbox. Close the deal.',
    description: 'Cheap bodies, four damage spells, and Hired turning every email into bonus face damage. The 4/5 Custodian shuts the door once the inbox is empty.',
    iconCardId: 'wrk-16',
    /* Identity: tempo / aggressive curve / spell-burn synergy.
     * Entry-tier deck: no legendary. The Boss (6c 5/6 Taunt
     * legendary finisher) is unlocked later via Memory Packs —
     * Custodian (5c 4/5 Taunt common) holds the closer slot here
     * so the deck teaches the same Taunt-wall pattern at common
     * rarity. Toolkit: 1c body + 1c removal spell on turn 1, two
     * 2c bodies for turn 2 momentum, a 3c value-creature with
     * draw + a 3c spell-synergy creature + 2x 3c 4-dmg spells, a
     * sticky untargetable body, Senior Engineer as the 4c beater,
     * and Custodian to close. Cheaper curve than Family
     * — Work wins on tempo, not stats. 6 creatures / 6 spells keeps
     * the body count in line with the other two starters. */
    // Entry-tier composition: no epics, no legendaries, no premium
    // synergy engine. Players unlock HR (epic untargetable), The
    // Boss (legendary closer), Hired (spell-synergy), and Senior
    // Engineer (4/4 vanilla — surprisingly OP in starter density)
    // later via Memory Packs. The starter keeps the burn identity
    // (Spam Email + Sales Pitch) but at lower density and without
    // the multiplier. 2nd Intern as chump filler.
    deck: [
      'wrk-01', 'wrk-01',       // 1c 1/1 x2 — Intern (chump bodies
                                //   fill the slots vacated by Boss/HR/
                                //   Senior Engineer)
      'wrk-02', 'wrk-02',       // 1c spell x2 — Spam Email (2 dmg)
      'wrk-03', 'wrk-03',       // 2c 2/2 x2 — Coworker
      'wrk-13',                 // 2c spell — Performance Review (silence)
      'wrk-05',                 // 3c 2/3  — IT Support (draw on play)
      'wrk-06',                 // 3c spell — Sales Pitch (4 dmg).
                                //   Single copy at entry tier; 2nd copy
                                //   pushed the starter to 52% (above
                                //   every boss). Reserved for pack
                                //   unlocks.
      'wrk-13',                 // 2c spell — Performance Review (silence)
      'wrk-10',                 // 4c spell — Promotion (+4/+4 rare buff)
      'wrk-16',                 // 5c 4/5  — Custodian (Taunt closer)
    ],
  },
  {
    id: 'education',
    name: 'Education',
    pitch: 'Study. Level up.',
    description: 'Level-up creatures grow stronger each turn, draw engines keep your hand full, and Senior Year graduates into a permanent threat. Slow to start, scary by turn 5.',
    iconCardId: 'edu-11',
    /* Identity: scaling / ramp / level-up payoff. Entry-tier deck:
     * no legendary. Graduation Day (the wide-board legendary finisher)
     * is unlocked later via Memory Packs — the starter teaches the
     * level_up + graduate mechanics with Senior Year as the cap.
     * Toolkit: 1c body + 1c draw spell + duplicate draw spell to
     * dig fast, two 2c level_up bodies that grow over time, a 2c
     * freeze and a 2c discard-2/draw-2 cycle, a 3c rush creature
     * and a 3c 4/2 pressure body, a 4c heal-each-turn tank, a 4c
     * graduating creature (Senior Year), and a duplicate Physical
     * Ed Class to keep Rush pressure flowing. Slowest of the three
     * — Education wants to survive into turn 5+ where the level_up
     * math takes over. */
    deck: [
      'edu-01',                 // 1c 1/1  — Pencil
      'edu-02', 'edu-02',       // 1c spell x2 — Backpack (draw)
      'edu-15',                 // 2c 2/2  — Classmate (common vanilla).
                                //   Replaces 2c Math Teacher (rare
                                //   level_up). Math Teacher's scaling
                                //   was the engine keeping Education at
                                //   52% above every boss — the deck
                                //   teaches level_up via the remaining
                                //   Physics Class, and Classmate fills
                                //   the 2-cost slot at common rarity.
      'edu-04',                 // 2c spell — Bathroom Break (freeze)
      'edu-07',                 // 2c spell — Pop Quiz (discard 1, draw 2)
                                //   Restored after the Classmate-for-Math
                                //   Teacher swap dropped Education to 40%
                                //   (Underpowered). Pop Quiz alone keeps
                                //   the deck playable at ~43% without
                                //   pushing it back above the boss tier.
      'edu-13',                 // 3c 3/3 — Physical Ed Class (rush)
      'edu-06', 'edu-06',       // 3c 2/4 x2 — Physics Class (level_up).
                                //   2nd copy restores enough scaling
                                //   to lift Education out of
                                //   Underpowered (40%) after dropping
                                //   Math Teacher for Classmate. The
                                //   deck teaches level_up via this
                                //   duplicate; players unlock Math
                                //   Teacher + Senior Year via packs.
      'edu-08',                 // 3c 4/2 — The Bully (common)
      'edu-09',                 // 4c 1/6  — Library (heal each turn)
      'edu-14',                 // 1c 1/2 — Notebook (draw on play, common)
                                //   replaces 6c Graduation Day (legendary)
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
