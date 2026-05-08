import type { CardTemplate } from '../game/types';

/**
 * 36 cards. Three themes (Family, Work, Animals), each with its own playstyle:
 *
 *   FAMILY  — defensive / heal / buff. Tanky bodies, big heals. They protect you.
 *   WORK    — control / spells. Lots of removal, freeze, draw. They manipulate.
 *   ANIMALS — aggro / bodies. Lots of creatures, fewer spells. They attack.
 *
 * Every card's `suggested` field is a real-world photo prompt — the player
 * is meant to point their camera at *that thing in their life*.
 */
export const TEMPLATES: CardTemplate[] = [

  // ============================================================
  // FAMILY — defense, heal, buff. The people who protect you.
  // ============================================================

  { id: 'fam-01', name: 'Family Pet', el: 'family', cost: 1, atk: 2, hp: 1, type: 'Creature',
    ability: 'Rush. Loyal and ready.',
    abilityKind: 'rush',
    rarity: 'common', suggested: 'your pet, or any pet you love' },

  { id: 'fam-02', name: 'Cousin', el: 'family', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: 'Rush. Always down to throw hands for you.',
    abilityKind: 'rush',
    rarity: 'common', suggested: 'a cousin, niece, or nephew' },

  { id: 'fam-03', name: "Abuela's Soup", el: 'family', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 6 HP.',
    abilityKind: 'spell_heal', abilityValue: 6,
    rarity: 'common', suggested: 'a homemade soup or stew' },

  { id: 'fam-04', name: 'Tio', el: 'family', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: draw a card. He always has a story.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'common', suggested: 'an uncle or aunt' },

  { id: 'fam-05', name: 'Mom', el: 'family', cost: 3, atk: 3, hp: 4, type: 'Creature',
    ability: 'She just shows up when you need her.',
    abilityKind: 'none',
    rarity: 'rare', suggested: 'your mom' },

  { id: 'fam-06', name: 'The Look', el: 'family', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: "Freeze an enemy. They've been silenced.",
    abilityKind: 'spell_freeze',
    rarity: 'rare', suggested: "a stern face — mom's, dad's, anyone's" },

  { id: 'fam-07', name: 'Older Sibling', el: 'family', cost: 4, atk: 4, hp: 4, type: 'Creature',
    ability: "They tease you, but no one else gets to.",
    abilityKind: 'none',
    rarity: 'common', suggested: 'a sibling' },

  { id: 'fam-08', name: 'Abuela', el: 'family', cost: 4, atk: 2, hp: 6, type: 'Creature',
    ability: 'A grandmother is harder to take down than she looks.',
    abilityKind: 'none',
    rarity: 'rare', suggested: 'a grandparent' },

  { id: 'fam-09', name: 'Birthday Cake', el: 'family', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 8 HP.',
    abilityKind: 'spell_heal', abilityValue: 8,
    rarity: 'common', suggested: 'a birthday cake or dessert' },

  { id: 'fam-10', name: 'Family Photo', el: 'family', cost: 5, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a creature +5/+5. They remember why they fight.',
    abilityKind: 'spell_buff', abilityValue: 5,
    rarity: 'rare', suggested: 'everyone in one shot — group photo' },

  { id: 'fam-11', name: 'Dad', el: 'family', cost: 5, atk: 4, hp: 6, type: 'Creature',
    ability: 'Taunt. Nothing gets past Dad.',
    abilityKind: 'taunt',
    rarity: 'epic', suggested: 'your dad' },

  { id: 'fam-12', name: 'Sunday Dinner', el: 'family', cost: 7, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 12 HP. Everyone is at the table.',
    abilityKind: 'spell_heal', abilityValue: 12,
    rarity: 'legendary', suggested: 'a meal with the whole family' },


  // ============================================================
  // WORK — control, spells, removal. Tempo and manipulation.
  // ============================================================

  { id: 'wrk-01', name: 'Intern', el: 'work', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: 'Rush. Eager, ready, expendable.',
    abilityKind: 'rush',
    rarity: 'common', suggested: 'a young coworker, or a workspace' },

  { id: 'wrk-02', name: 'Spam Email', el: 'work', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 2 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 2,
    rarity: 'common', suggested: 'an inbox, a screen, anything annoying' },

  { id: 'wrk-03', name: 'Coworker', el: 'work', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: 'A reliable colleague.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a coworker or office buddy' },

  { id: 'wrk-04', name: 'Coffee', el: 'work', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a creature +3/+3. Now they can think.',
    abilityKind: 'spell_buff', abilityValue: 3,
    rarity: 'common', suggested: 'a coffee, mug, or barista shot' },

  { id: 'wrk-05', name: 'IT Support', el: 'work', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: draw a card. They explain things.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'rare', suggested: 'a tangle of cables, a tech setup' },

  { id: 'wrk-06', name: 'Sales Pitch', el: 'work', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 4 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 4,
    rarity: 'common', suggested: 'a presentation, a whiteboard, a slide' },

  { id: 'wrk-07', name: 'HR', el: 'work', cost: 4, atk: 3, hp: 4, type: 'Creature',
    ability: 'Spells cannot target this. Protected by policy.',
    abilityKind: 'untargetable',
    rarity: 'epic', suggested: 'an HR rep, or an office sign' },

  { id: 'wrk-08', name: 'Senior Engineer', el: 'work', cost: 4, atk: 4, hp: 4, type: 'Creature',
    ability: 'They get things done.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a senior coworker, or a desk' },

  { id: 'wrk-09', name: 'Meeting', el: 'work', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: "Freeze an enemy creature. Nothing gets done.",
    abilityKind: 'spell_freeze',
    rarity: 'rare', suggested: 'a conference room, calendar, Zoom call' },

  { id: 'wrk-10', name: 'Promotion', el: 'work', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a creature +5/+5. They earned it.',
    abilityKind: 'spell_buff', abilityValue: 5,
    rarity: 'rare', suggested: 'a name plaque, an award, a trophy' },

  { id: 'wrk-11', name: 'Lunch Break', el: 'work', cost: 5, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 10 HP. The only sacred hour.',
    abilityKind: 'spell_heal', abilityValue: 10,
    rarity: 'rare', suggested: 'lunch — a sandwich, takeout, or break room' },

  { id: 'wrk-12', name: 'The Boss', el: 'work', cost: 6, atk: 5, hp: 6, type: 'Creature',
    ability: 'Taunt. Everyone has to deal with the Boss first.',
    abilityKind: 'taunt',
    rarity: 'legendary', suggested: 'your boss, or their office door' },


  // ============================================================
  // ANIMALS — aggro, bodies, attack. Pure creatures.
  // ============================================================

  { id: 'ani-01', name: 'Mouse', el: 'animals', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: 'Rush. Sneaks past defenses.',
    abilityKind: 'rush',
    rarity: 'common', suggested: 'any small animal you can find' },

  { id: 'ani-02', name: 'Snake Bite', el: 'animals', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 3 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 3,
    rarity: 'common', suggested: 'a snake, lizard, or bug' },

  { id: 'ani-03', name: 'Rabbit', el: 'animals', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: 'Quick on its feet.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a rabbit, hare, or other prey animal' },

  { id: 'ani-04', name: 'Cat', el: 'animals', cost: 3, atk: 3, hp: 2, type: 'Creature',
    ability: 'Spells cannot target this. Sneaky and untouchable.',
    abilityKind: 'untargetable',
    rarity: 'rare', suggested: 'a cat — yours, a stranger, a stray' },

  { id: 'ani-05', name: 'Dog', el: 'animals', cost: 3, atk: 2, hp: 4, type: 'Creature',
    ability: 'Taunt. Loyal to a fault.',
    abilityKind: 'taunt',
    rarity: 'rare', suggested: 'a dog — any dog' },

  { id: 'ani-06', name: 'Owl', el: 'animals', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: draw a card.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'common', suggested: 'a bird — owl, eagle, sparrow, anything' },

  { id: 'ani-07', name: 'Treats', el: 'animals', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a creature +3/+3. Good boy.',
    abilityKind: 'spell_buff', abilityValue: 3,
    rarity: 'common', suggested: 'pet food, a treat, a bowl' },

  { id: 'ani-08', name: 'Vet Visit', el: 'animals', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 8 HP.',
    abilityKind: 'spell_heal', abilityValue: 8,
    rarity: 'rare', suggested: 'a vet, a clinic, or a pet carrier' },

  { id: 'ani-09', name: 'Bear Trap', el: 'animals', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Freeze an enemy creature.',
    abilityKind: 'spell_freeze',
    rarity: 'rare', suggested: 'a fence, cage, or trap of any kind' },

  { id: 'ani-10', name: 'Horse', el: 'animals', cost: 4, atk: 4, hp: 4, type: 'Creature',
    ability: 'Rush. Charges in.',
    abilityKind: 'rush',
    rarity: 'epic', suggested: 'a horse, donkey, or large animal' },

  { id: 'ani-11', name: 'Wolf', el: 'animals', cost: 5, atk: 5, hp: 4, type: 'Creature',
    ability: 'Pack hunter.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a dog with serious eyes, a wolf, a husky' },

  { id: 'ani-12', name: 'Lion', el: 'animals', cost: 6, atk: 6, hp: 6, type: 'Creature',
    ability: 'Apex predator.',
    abilityKind: 'none',
    rarity: 'legendary', suggested: 'the most majestic creature you can find' },
];

export function getTemplateById(id: string): CardTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function templatesByTheme(theme: 'family' | 'work' | 'animals'): CardTemplate[] {
  return TEMPLATES.filter(t => t.el === theme);
}
