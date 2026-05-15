import type { ElementId } from '../game/types';

/**
 * Campaign mode — ordered "journey" arcs, each ending at one of the
 * main pickable bosses.
 *
 * Each arc has FOUR stops. The first three are campaign-only mini
 * bosses (ids prefixed `mini-`, defined in src/data/bosses.ts as
 * MINI_BOSSES). The fourth is one of the existing main bosses; the
 * campaign fights it on Normal difficulty, but beating it unlocks
 * that boss in the Boss Picker for all three tiers.
 *
 * Arcs are strict-linear-gated *across* the campaign too: you must
 * complete arc N to unlock arc N+1. The order is hand-tuned so each
 * arc's payoff mechanic builds on the previous arc's lessons:
 *
 *   1. Family    — heal-per-turn bonds (forgiving, teaches survival)
 *   2. Animals   — wide aggro / Rush (teaches combat trading)
 *   3. Work      — spells / freeze / removal (first spell archetype)
 *   4. Food      — board heal + recovery + ramp (long-game muscle)
 *   5. Education — level_up / graduate scaling (protect value engine)
 *   6. Travel    — tempo + hand cycling (fast play, hand mgmt)
 *   7. Couple    — all bond types stacked (capstone, requires 1–6)
 *
 * Dialogue lines live HERE, not on BossDef, so the same boss can have
 * different dialogue in the campaign vs. the picker (e.g. Mom's
 * campaign-finale lines reference the journey home; her picker lines
 * are theme-neutral).
 */

export interface CampaignStop {
  /** Boss id from src/data/bosses.ts (BOSSES or MINI_BOSSES). */
  bossId: string;
  /** Spoken just before the match starts, in a dialogue card. */
  preDialogue: string;
  /** Spoken on the win screen after the player beats this stop. */
  winDialogue: string;
  /** Spoken on the loss screen so the boss feels like a character,
   *  not just a defeat banner. */
  loseDialogue: string;
  /** True only for the arc's final boss (one per arc). The finale
   *  fights the *main* pickable boss; beating it unlocks that boss
   *  in the Boss Picker for all three tiers. */
  isFinal: boolean;
}

export interface CampaignDef {
  id: string;
  /** Display title (shown on the campaign tile and the arc header). */
  title: string;
  /** Element / theme — used to tint the arc tile and order arcs in
   *  the campaign list by theme color. */
  themeId: ElementId;
  /** One-line description rendered on the arc tile. */
  blurb: string;
  /** Bridging line shown on the arc-complete screen — foreshadows the
   *  next arc thematically. Undefined for the very last arc. */
  nextArcHint?: string;
  /** Ordered list of stops. Linear-gated within the arc: stop N
   *  unlocks only when stop N-1 has been beaten. */
  stops: CampaignStop[];
}

export const CAMPAIGNS: CampaignDef[] = [

  // ============================================================
  // 1. FAMILY — the forgiving starter arc.
  // ============================================================
  {
    id: 'arc-family',
    title: "Sunday's Coming",
    themeId: 'family',
    blurb: "Walk back through the door. Everyone's waiting.",
    nextArcHint: "And feed the dog while you're out.",
    stops: [
      {
        bossId: 'mini-family-pet',
        preDialogue: "Wait — you brought a stranger home?",
        winDialogue: "Tail wag. Forgiven.",
        loseDialogue: "You sat on the couch wrong.",
        isFinal: false,
      },
      {
        bossId: 'mini-family-cousins',
        preDialogue: "Bet you can't beat all of us.",
        winDialogue: "Rematch. Rematch. Rematch.",
        loseDialogue: "Told you we had numbers.",
        isFinal: false,
      },
      {
        bossId: 'mini-family-dad-tio',
        preDialogue: "Set the table. We'll talk after.",
        winDialogue: "Tell your mother.",
        loseDialogue: "We'll go again after dessert.",
        isFinal: false,
      },
      {
        bossId: 'mom',
        preDialogue: "You finally made it. Now sit.",
        winDialogue: "Fine. But you're still doing the dishes.",
        loseDialogue: "I knew you'd come around.",
        isFinal: true,
      },
    ],
  },

  // ============================================================
  // 2. ANIMALS — first combat-archetype lesson.
  // ============================================================
  {
    id: 'arc-animals',
    title: "Into the Wild",
    themeId: 'animals',
    blurb: "Past the back fence. Eyes everywhere.",
    nextArcHint: "You smell like the city now.",
    stops: [
      {
        bossId: 'mini-animals-stray',
        preDialogue: "Don't move. Don't blink.",
        winDialogue: "It blinked first.",
        loseDialogue: "Should have run when I had the chance.",
        isFinal: false,
      },
      {
        bossId: 'mini-animals-hound',
        preDialogue: "Run. He likes that.",
        winDialogue: "Sit. Stay. Beaten.",
        loseDialogue: "He got the bone.",
        isFinal: false,
      },
      {
        bossId: 'mini-animals-bear',
        preDialogue: "You shouldn't have left food out.",
        winDialogue: "It went back to the trees.",
        loseDialogue: "It got the cooler too.",
        isFinal: false,
      },
      {
        bossId: 'alpha',
        preDialogue: "Bare your teeth or run.",
        winDialogue: "You earned the howl.",
        loseDialogue: "You weren't pack.",
        isFinal: true,
      },
    ],
  },

  // ============================================================
  // 3. WORK — first spell-archetype lesson.
  // ============================================================
  {
    id: 'arc-work',
    title: "Climb the Ladder",
    themeId: 'work',
    blurb: "First day. Last day. Every day in between.",
    nextArcHint: "Take your lunch break. You earned it.",
    stops: [
      {
        bossId: 'mini-work-intern',
        preDialogue: "Hi! Sorry. Can I — sorry.",
        winDialogue: "…I'll redo it tonight.",
        loseDialogue: "I'll just stay late.",
        isFinal: false,
      },
      {
        bossId: 'mini-work-hr',
        preDialogue: "Close the door. This is informal.",
        winDialogue: "I'll document this.",
        loseDialogue: "We'll put a note in your file.",
        isFinal: false,
      },
      {
        bossId: 'mini-work-senior',
        preDialogue: "I'll need to see the spec.",
        winDialogue: "Document this in the wiki.",
        loseDialogue: "We can pair on it next sprint.",
        isFinal: false,
      },
      {
        bossId: 'manager',
        preDialogue: "Got a minute? It will only take a minute.",
        winDialogue: "Loop me in next time.",
        loseDialogue: "Quick sync tomorrow. Bring a deck.",
        isFinal: true,
      },
    ],
  },

  // ============================================================
  // 4. FOOD — long-game sustain / recovery.
  // ============================================================
  {
    id: 'arc-food',
    title: "Family Feast",
    themeId: 'food',
    blurb: "Pull up a chair. Plate's almost ready.",
    nextArcHint: "You can't learn this from a book. But try anyway.",
    stops: [
      {
        bossId: 'mini-food-snack-vendor',
        preDialogue: "You hungry or not?",
        winDialogue: "…on the house.",
        loseDialogue: "Come back when you've got cash.",
        isFinal: false,
      },
      {
        bossId: 'mini-food-barista',
        preDialogue: "Same as yesterday?",
        winDialogue: "Refill's on me.",
        loseDialogue: "I'll have it ready when you get back.",
        isFinal: false,
      },
      {
        bossId: 'mini-food-sous-chef',
        preDialogue: "On your six.",
        winDialogue: "Yes, chef.",
        loseDialogue: "Reset the station. Try again.",
        isFinal: false,
      },
      {
        bossId: 'cook',
        preDialogue: "Pull up a chair. Plate's almost ready.",
        winDialogue: "Eat. Then we'll talk.",
        loseDialogue: "Always more on the stove.",
        isFinal: true,
      },
    ],
  },

  // ============================================================
  // 5. EDUCATION — patience / value engine / protect-the-piece.
  // ============================================================
  {
    id: 'arc-education',
    title: "Pass or Fail",
    themeId: 'education',
    blurb: "Roll call. Pencils ready.",
    nextArcHint: "There's a world past these halls. Go see it.",
    stops: [
      {
        bossId: 'mini-edu-new-kid',
        preDialogue: "Anyone sitting here?",
        winDialogue: "…thanks.",
        loseDialogue: "I'll find another desk.",
        isFinal: false,
      },
      {
        bossId: 'mini-edu-tutor',
        preDialogue: "From the top.",
        winDialogue: "Office hours, Friday.",
        loseDialogue: "We'll work on it.",
        isFinal: false,
      },
      {
        bossId: 'mini-edu-vice-principal',
        preDialogue: "This is your last warning.",
        winDialogue: "I'll write you up later.",
        loseDialogue: "Detention. Tomorrow.",
        isFinal: false,
      },
      {
        bossId: 'principal',
        preDialogue: "Sit. Down.",
        winDialogue: "Excused.",
        loseDialogue: "Detention. Indefinite.",
        isFinal: true,
      },
    ],
  },

  // ============================================================
  // 6. TRAVEL — fast tempo / hand cycling.
  // ============================================================
  {
    id: 'arc-travel',
    title: "Departure",
    themeId: 'travel',
    blurb: "Bag packed. Don't look back.",
    nextArcHint: "Stay still long enough and someone catches up.",
    stops: [
      {
        bossId: 'mini-travel-tourist',
        preDialogue: "Wait — is this the right gate?",
        winDialogue: "…I'll figure it out.",
        loseDialogue: "I'll just buy a new ticket.",
        isFinal: false,
      },
      {
        bossId: 'mini-travel-conductor',
        preDialogue: "All aboard. Final call.",
        winDialogue: "Train leaves without you.",
        loseDialogue: "Catch the next one.",
        isFinal: false,
      },
      {
        bossId: 'mini-travel-pilot',
        preDialogue: "Buckle up.",
        winDialogue: "Smooth landing.",
        loseDialogue: "Mayday. Reroute.",
        isFinal: false,
      },
      {
        bossId: 'drifter',
        preDialogue: "Don't get attached.",
        winDialogue: "See you in the next town.",
        loseDialogue: "Told you.",
        isFinal: true,
      },
    ],
  },

  // ============================================================
  // 7. COUPLE — capstone. All bond types stacked.
  // ============================================================
  {
    id: 'arc-couple',
    title: "Til Dishes Do Us Part",
    themeId: 'family',
    blurb: "Best two out of three. Loser does dishes for a month.",
    // Last arc — loops back to Mom thematically.
    nextArcHint: "Same time next Sunday? Bring your mom.",
    stops: [
      {
        bossId: 'mini-couple-crush',
        preDialogue: "Wait — are you free Saturday?",
        winDialogue: "…I'll text you.",
        loseDialogue: "Maybe next weekend.",
        isFinal: false,
      },
      {
        bossId: 'mini-couple-first-date',
        preDialogue: "You like… everything?",
        winDialogue: "There's a part two.",
        loseDialogue: "I had a great time anyway.",
        isFinal: false,
      },
      {
        bossId: 'mini-couple-engagement',
        preDialogue: "There's something I want to ask you.",
        winDialogue: "…ask me again later.",
        loseDialogue: "I had a whole speech.",
        isFinal: false,
      },
      {
        bossId: 'partner',
        preDialogue: "Best two out of three. Loser does dishes for a month.",
        winDialogue: "Fine. But I'm picking the movie.",
        loseDialogue: "Dishes. Month. Pay up.",
        isFinal: true,
      },
    ],
  },
];

/** Index of the arc in CAMPAIGNS, or -1 if not found. */
export function arcIndex(arcId: string): number {
  return CAMPAIGNS.findIndex(c => c.id === arcId);
}

export function getCampaign(arcId: string): CampaignDef | undefined {
  return CAMPAIGNS.find(c => c.id === arcId);
}

/** True if `arcId` is unlocked — all preceding arcs have been completed.
 *  The very first arc (index 0) is always unlocked. */
export function isArcUnlocked(
  arcId: string,
  progress: Record<string, number> | undefined,
): boolean {
  const idx = arcIndex(arcId);
  if (idx <= 0) return true;
  const prevArc = CAMPAIGNS[idx - 1];
  return (progress?.[prevArc.id] ?? -1) >= prevArc.stops.length - 1;
}

/** True if a specific stop within an arc is unlocked. The arc itself
 *  must be unlocked, AND every prior stop in the arc must have been
 *  beaten. */
export function isStopUnlocked(
  arcId: string,
  stopIndex: number,
  progress: Record<string, number> | undefined,
): boolean {
  if (!isArcUnlocked(arcId, progress)) return false;
  if (stopIndex === 0) return true;
  return (progress?.[arcId] ?? -1) >= stopIndex - 1;
}

/** True if the *finale* of an arc has been beaten — equivalent to the
 *  arc being fully complete. Used by the Boss Picker to decide whether
 *  a pickable boss (Mom, Manager, …) should be unlocked. */
export function isArcComplete(
  arcId: string,
  progress: Record<string, number> | undefined,
): boolean {
  const arc = getCampaign(arcId);
  if (!arc) return false;
  return (progress?.[arcId] ?? -1) >= arc.stops.length - 1;
}

/** Given a main-boss id (e.g. 'mom'), return the arc whose finale it
 *  is — or undefined if the boss isn't a campaign finale. */
export function arcForFinaleBossId(bossId: string): CampaignDef | undefined {
  return CAMPAIGNS.find(c => c.stops[c.stops.length - 1].bossId === bossId);
}

/** True if a main pickable boss should be unlocked in the Boss Picker.
 *  A finale boss is unlocked iff its arc is complete. Non-finale bosses
 *  (none exist today, but kept future-proof) are always unlocked. */
export function isPickableBossUnlocked(
  bossId: string,
  progress: Record<string, number> | undefined,
): boolean {
  const arc = arcForFinaleBossId(bossId);
  if (!arc) return true;
  return isArcComplete(arc.id, progress);
}
