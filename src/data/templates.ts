import type { CardTemplate, ElementId } from '../game/types';

/**
 * 36 cards. Three themes (Family, Work, Animals), each with its own playstyle:
 *
 *   FAMILY  — defensive / heal / buff. They protect you.
 *   WORK    — control / spells. They manipulate.
 *   ANIMALS — aggro / bodies. They attack.
 *
 * `ability` = mechanical text (what the card does in-game).
 * `flavor`  = italic prose (vibe, not mechanics). Empty for vanilla cards.
 */
export const TEMPLATES: CardTemplate[] = [

  // ============================================================
  // FAMILY
  // ============================================================

  { id: 'fam-01', name: 'Family Pet', el: 'animals', cost: 1, atk: 2, hp: 1, type: 'Creature',
    ability: 'Rush.',
    flavor: 'First to the rescue.',
    abilityKind: 'rush',
    rarity: 'rare', tags: ['pet'], suggested: 'my first puppy, my first pet, or any pet you grew up with' },

  { id: 'fam-02', name: 'Cousin', el: 'family', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'Always down to throw hands for you.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a cousin, niece, or nephew' },

  { id: 'fam-03', name: "Abuela's Soup", el: 'food', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 5 HP.',
    abilityKind: 'spell_heal', abilityValue: 5,
    rarity: 'common', suggested: 'a homemade soup or stew' },

  { id: 'fam-04', name: 'Tio', el: 'family', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: draw a card.',
    flavor: 'He always has a story.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'rare', suggested: 'an uncle or aunt' },

  { id: 'fam-05', name: 'Mom', el: 'family', cost: 3, atk: 3, hp: 4, type: 'Creature',
    ability: '',
    flavor: 'She just shows up when you need her.',
    abilityKind: 'none',
    rarity: 'rare', suggested: 'your mom' },

  { id: 'fam-06', name: 'The Look', el: 'family', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Freeze an enemy.',
    flavor: "They've been silenced.",
    abilityKind: 'spell_freeze',
    rarity: 'rare', suggested: "a stern face — mom's, dad's, anyone's" },

  { id: 'fam-07', name: 'Older Sibling', el: 'family', cost: 4, atk: 4, hp: 4, type: 'Creature',
    ability: '',
    flavor: 'They tease you, but no one else gets to.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a sibling' },

  { id: 'fam-08', name: 'Abuela', el: 'family', cost: 4, atk: 2, hp: 6, type: 'Creature',
    ability: 'Taunt.',
    flavor: 'Harder to take down than she looks.',
    abilityKind: 'taunt',
    rarity: 'rare', suggested: 'a grandparent' },

  { id: 'fam-09', name: 'Birthday Cake', el: 'food', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 5 HP.',
    abilityKind: 'spell_heal', abilityValue: 5,
    rarity: 'common', suggested: 'a birthday cake or dessert' },

  { id: 'fam-10', name: 'Family Photo', el: 'family', cost: 5, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a Family-type creature +3/+3.',
    flavor: 'They remember why they fight.',
    abilityKind: 'spell_buff', abilityValue: 3,
    rarity: 'rare', suggested: 'everyone in one shot — group photo' },

  { id: 'fam-11', name: 'Dad', el: 'family', cost: 5, atk: 4, hp: 6, type: 'Creature',
    ability: 'Taunt.',
    flavor: 'Nothing gets past Dad.',
    abilityKind: 'taunt',
    rarity: 'epic', suggested: 'your dad' },

  { id: 'fam-12', name: 'Sunday Dinner', el: 'food', cost: 6, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 8 HP.',
    flavor: 'Everyone is at the table.',
    abilityKind: 'spell_heal', abilityValue: 8,
    rarity: 'legendary', suggested: 'a meal with the whole family' },

  { id: 'fam-13', name: 'Tough Love', el: 'family', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Silence an enemy creature.',
    flavor: 'They mean well.',
    abilityKind: 'silence',
    rarity: 'rare', suggested: 'a stern parent or grandparent' },

  { id: 'fam-14', name: 'Hug', el: 'family', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 2 HP.',
    flavor: 'Sometimes that\'s all it takes.',
    abilityKind: 'spell_heal', abilityValue: 2,
    rarity: 'common', suggested: 'two people hugging, or anyone embracing' },

  { id: 'fam-15', name: 'Family Chat', el: 'family', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Draw a card.',
    flavor: "Everybody's got something to say.",
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'common', suggested: 'people sitting together talking, a family gathered' },


  // ============================================================
  // WORK
  // ============================================================

  { id: 'wrk-01', name: 'Intern', el: 'work', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: '',
    flavor: 'Eager, ready, expendable.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a young coworker, or a workspace' },

  { id: 'wrk-02', name: 'Spam Email', el: 'work', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 2 damage to an enemy.',
    abilityKind: 'spell_damage', abilityValue: 2,
    rarity: 'common', suggested: 'an inbox, a screen, anything annoying' },

  { id: 'wrk-03', name: 'Coworker', el: 'work', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'A reliable colleague.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a coworker or office buddy' },

  { id: 'wrk-04', name: 'Coffee', el: 'food', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a Food-type creature +2/+2.',
    flavor: 'Wakes the kitchen up too.',
    abilityKind: 'spell_buff', abilityValue: 2,
    rarity: 'common', suggested: 'a coffee, mug, or barista shot' },

  { id: 'wrk-05', name: 'IT Support', el: 'work', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: draw a card.',
    flavor: 'They explain things.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'rare', suggested: 'a tangle of cables, a tech setup' },

  { id: 'wrk-06', name: 'Sales Pitch', el: 'work', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 4 damage to an enemy.',
    abilityKind: 'spell_damage', abilityValue: 4,
    rarity: 'common', suggested: 'a presentation, a whiteboard, a slide' },

  { id: 'wrk-07', name: 'HR', el: 'work', cost: 4, atk: 3, hp: 4, type: 'Creature',
    ability: 'Spells cannot target this.',
    flavor: 'Protected by policy.',
    abilityKind: 'untargetable',
    rarity: 'epic', suggested: 'an HR rep, or an office sign' },

  { id: 'wrk-08', name: 'Senior Engineer', el: 'work', cost: 4, atk: 4, hp: 4, type: 'Creature',
    ability: '',
    flavor: 'They get things done.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a senior coworker, or a desk' },

  { id: 'wrk-09', name: 'Meeting', el: 'work', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Freeze an enemy creature.',
    flavor: "Nothing gets done.",
    abilityKind: 'spell_freeze',
    rarity: 'rare', suggested: 'a conference room, calendar, Zoom call' },

  { id: 'wrk-10', name: 'Promotion', el: 'work', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a Work-type creature +4/+4.',
    flavor: 'They earned it.',
    abilityKind: 'spell_buff', abilityValue: 4,
    rarity: 'rare', suggested: 'a name plaque, an award, a trophy' },

  { id: 'wrk-11', name: 'Lunch Break', el: 'work', cost: 5, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 7 HP.',
    flavor: 'The only sacred hour.',
    abilityKind: 'spell_heal', abilityValue: 7,
    rarity: 'rare', suggested: 'lunch — a sandwich, takeout, or break room' },

  { id: 'wrk-12', name: 'The Boss', el: 'work', cost: 6, atk: 5, hp: 6, type: 'Creature',
    ability: 'Taunt.',
    flavor: 'Everyone has to deal with the Boss first.',
    abilityKind: 'taunt',
    rarity: 'legendary', suggested: 'your boss, or their office door' },

  { id: 'wrk-13', name: 'Performance Review', el: 'work', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Silence an enemy creature.',
    flavor: 'Constructive feedback.',
    abilityKind: 'silence',
    rarity: 'rare', suggested: 'a manager, a meeting room, or a binder' },

  { id: 'wrk-14', name: 'Stand-up Meeting', el: 'work', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Both players draw 1 card.',
    flavor: '"Just a quick sync."',
    abilityKind: 'spell_both_draw',
    rarity: 'common', suggested: 'a team gathered around a desk or whiteboard' },

  { id: 'wrk-15', name: 'Payroll', el: 'work', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give each of your Work-type creatures +1/+1.',
    flavor: 'Cleared. Direct deposit.',
    abilityKind: 'spell_buff_all', abilityValue: 1,
    rarity: 'rare', suggested: 'a paycheck, an ATM screen, or your bank app' },


  // ============================================================
  // ANIMALS
  // ============================================================

  { id: 'ani-01', name: 'Mouse', el: 'animals', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: '',
    flavor: 'Sneaks past defenses.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'any small animal you can find' },

  { id: 'ani-02', name: 'Snake Bite', el: 'animals', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 3 damage to an enemy.',
    abilityKind: 'spell_damage', abilityValue: 3,
    rarity: 'common', suggested: 'a snake, lizard, or bug' },

  { id: 'ani-03', name: 'Rabbit', el: 'animals', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'Quick on its feet.',
    abilityKind: 'none',
    rarity: 'common', tags: ['pet'], suggested: 'a rabbit, hare, or other prey animal' },

  { id: 'ani-04', name: 'Cat', el: 'animals', cost: 3, atk: 2, hp: 2, type: 'Creature',
    ability: 'Spells cannot target this.',
    flavor: 'Sneaky and untouchable.',
    abilityKind: 'untargetable',
    rarity: 'rare', tags: ['pet'], suggested: 'a cat — yours, a stranger, a stray' },

  { id: 'ani-05', name: 'Dog', el: 'animals', cost: 3, atk: 2, hp: 4, type: 'Creature',
    ability: 'Taunt.',
    flavor: 'Stays at your side. Always.',
    abilityKind: 'taunt',
    rarity: 'rare', tags: ['pet'], suggested: 'a dog — any dog' },

  { id: 'ani-06', name: 'Owl', el: 'animals', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: draw a card.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'rare', suggested: 'a bird — owl, eagle, sparrow, anything' },

  { id: 'ani-07', name: 'Treats', el: 'animals', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give an Animals-type creature +3/+3.',
    flavor: 'Good boy.',
    abilityKind: 'spell_buff', abilityValue: 3,
    rarity: 'common', tags: ['pet'], suggested: 'pet food, a treat, a bowl' },

  { id: 'ani-08', name: 'Vet Visit', el: 'animals', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 6 HP.',
    abilityKind: 'spell_heal', abilityValue: 6,
    rarity: 'rare', tags: ['pet'], suggested: 'a vet, a clinic, or a pet carrier' },

  { id: 'ani-09', name: 'Bear Trap', el: 'animals', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Freeze an enemy creature.',
    abilityKind: 'spell_freeze',
    rarity: 'rare', suggested: 'a fence, cage, or trap of any kind' },

  { id: 'ani-10', name: 'Horse', el: 'animals', cost: 4, atk: 3, hp: 3, type: 'Creature',
    ability: 'Rush.',
    flavor: 'Charges in.',
    abilityKind: 'rush',
    rarity: 'epic', suggested: 'a horse, donkey, or large animal' },

  { id: 'ani-11', name: 'Wolf', el: 'animals', cost: 5, atk: 5, hp: 4, type: 'Creature',
    ability: '',
    flavor: 'Pack hunter.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a dog with serious eyes, a wolf, a husky' },

  { id: 'ani-12', name: 'Lion', el: 'animals', cost: 6, atk: 6, hp: 6, type: 'Creature',
    ability: 'On play: deal 1 to all enemy creatures.',
    flavor: 'Apex predator.',
    abilityKind: 'aoe_on_play', abilityValue: 1,
    rarity: 'legendary', suggested: 'the most majestic creature you can find' },

  { id: 'ani-13', name: 'Muzzle', el: 'animals', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Silence an enemy creature.',
    flavor: 'Calm down.',
    abilityKind: 'silence',
    rarity: 'rare', tags: ['pet'], suggested: 'a leash, harness, or quiet animal' },

  { id: 'ani-14', name: 'Mosquito', el: 'animals', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: '',
    flavor: 'Small. Annoying. Persistent.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a mosquito, fly, or any flying insect' },

  // Family Pet micro-set — three cheap support spells that pair with
  // fam-01 Family Pet and the rest of the animals theme. Belly Rub
  // is a creature heal (reuses fd-13 Sip's targeting + heal_friend
  // engine path; works on any friendly creature, not just animals).
  // Good Boy is a 1c Nourish bump (raises max HP). Walkies is a
  // 2c draw 2 — Suitcase-cheap, but for the animals pool.
  { id: 'ani-15', name: 'Belly Rub', el: 'animals', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 4 HP to a friendly creature.',
    flavor: 'Right behind the ear.',
    abilityKind: 'spell_heal_friend', abilityValue: 4,
    rarity: 'common', tags: ['pet'], suggested: 'a hand on a pet, a happy dog, a cat being scratched' },

  { id: 'ani-16', name: 'Good Boy', el: 'animals', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a creature +0/+2 HP.',
    flavor: 'He knew before you said it.',
    abilityKind: 'spell_nourish', abilityValue: 2,
    rarity: 'common', tags: ['pet'], suggested: 'a beaming dog, an attentive pet, a treat moment' },

  { id: 'ani-17', name: 'Walkies', el: 'animals', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Draw 2 cards.',
    flavor: 'Leash. Door. Run.',
    abilityKind: 'draw_on_play', abilityValue: 2,
    rarity: 'rare', tags: ['pet'], suggested: 'a leash by the door, a dog on a walk, paws on a sidewalk' },


  // ============================================================
  // TRAVEL — tempo / evasion. They move fast and slip past defenses.
  // ============================================================

  { id: 'trv-01', name: 'Boarding Pass', el: 'travel', cost: 1, atk: 2, hp: 1, type: 'Creature',
    ability: '',
    flavor: 'You\'re already through security.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a boarding pass, ticket stub, or gate sign' },

  { id: 'trv-02', name: 'Carry-On', el: 'travel', cost: 2, atk: 1, hp: 2, type: 'Creature',
    ability: 'Spells cannot target this.',
    flavor: 'Never leaves your side.',
    abilityKind: 'untargetable',
    rarity: 'rare', suggested: 'a backpack, duffel, or wheeled bag' },

  { id: 'trv-03', name: 'Suitcase', el: 'travel', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Draw 2 cards.',
    flavor: 'You packed for everything.',
    abilityKind: 'draw_on_play', abilityValue: 2,
    rarity: 'common', suggested: 'a packed suitcase or open luggage' },

  { id: 'trv-04', name: 'Lost Luggage', el: 'travel', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Silence an enemy creature.',
    flavor: 'They\'re going to need to fill out a form.',
    abilityKind: 'silence',
    rarity: 'rare', suggested: 'a baggage carousel, claim tag, or empty rack' },

  { id: 'trv-05', name: 'Window Seat', el: 'travel', cost: 3, atk: 3, hp: 3, type: 'Creature',
    ability: '',
    flavor: 'Best view in the house.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'an airplane window, a view from above the clouds' },

  { id: 'trv-06', name: 'Train Conductor', el: 'travel', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: draw a card.',
    flavor: 'They know every stop by heart.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'rare', suggested: 'a train, station, or platform sign' },

  { id: 'trv-07', name: 'Roadmap', el: 'travel', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 3 damage to an enemy.',
    flavor: 'Some routes shouldn\'t be taken.',
    abilityKind: 'spell_damage', abilityValue: 3,
    rarity: 'common', suggested: 'a paper map, a GPS screen, a road sign' },

  { id: 'trv-08', name: 'Layover', el: 'travel', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Freeze an enemy creature.',
    flavor: 'Hours bleed into hours.',
    abilityKind: 'spell_freeze',
    rarity: 'rare', suggested: 'a departure board, a quiet terminal, a long hall' },

  { id: 'trv-09', name: 'Hotel', el: 'travel', cost: 4, atk: 2, hp: 5, type: 'Creature',
    ability: 'Taunt.',
    flavor: 'Where the night ends.',
    abilityKind: 'taunt',
    rarity: 'rare', suggested: 'a hotel facade, room key, or lobby' },

  { id: 'trv-10', name: 'Beach', el: 'travel', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 6 HP.',
    flavor: 'You can breathe again.',
    abilityKind: 'spell_heal', abilityValue: 6,
    rarity: 'common', suggested: 'a beach, ocean view, or shoreline' },

  { id: 'trv-11', name: 'First Class', el: 'travel', cost: 5, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a Travel-type creature +4/+4.',
    flavor: 'Some people travel differently.',
    abilityKind: 'spell_buff', abilityValue: 4,
    rarity: 'rare', suggested: 'a lie-flat seat, a champagne flute, a lounge' },

  { id: 'trv-12', name: 'Mountain Summit', el: 'travel', cost: 6, atk: 6, hp: 5, type: 'Creature',
    ability: 'Rush.',
    flavor: 'You made it to the top.',
    abilityKind: 'rush',
    rarity: 'legendary', suggested: 'a peak, summit, or panoramic mountain view' },

  { id: 'trv-13', name: 'Ticket Stub', el: 'travel', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Draw a card.',
    flavor: 'A receipt for somewhere you\'ve been.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'common', suggested: 'a torn ticket, boarding stub, or museum pass' },

  // ============================================================
  // FOOD — sustain / nourish / recovery / one-shot ramp
  //
  // Owns the "keep your board alive" lane: creature-level healing
  // (nourish, share_meal, feast), one-shot mana prep (ramp without
  // snowballing), and recovery (leftovers — return a spell from your
  // discard when a creature dies). Slower than Animals, less spell-y
  // than Work, doesn't heal-the-face like Family — its own identity.
  // ============================================================

  { id: 'fd-01', name: 'Toast', el: 'food', cost: 1, atk: 1, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'Crisp edges, warm center.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a slice of toast, butter, jam, or breakfast bread' },

  { id: 'fd-02', name: 'Hot Soup', el: 'food', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a Food-type creature +0/+2 HP.',
    flavor: 'The cure for almost everything.',
    abilityKind: 'spell_nourish', abilityValue: 2,
    rarity: 'common', suggested: 'a bowl of soup or stew' },

  { id: 'fd-03', name: 'Snack', el: 'food', cost: 1, atk: 2, hp: 1, type: 'Creature',
    ability: 'Rush.',
    flavor: 'Just a little something.',
    abilityKind: 'rush',
    rarity: 'common', suggested: 'a chip bag, granola bar, or finger food' },

  { id: 'fd-04', name: 'Breakfast Plate', el: 'food', cost: 2, atk: 1, hp: 3, type: 'Creature',
    ability: 'On play: draw a card.',
    flavor: 'Most important meal of the day.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'rare', suggested: 'eggs, pancakes, a full breakfast spread' },

  { id: 'fd-05', name: 'Lunch Box', el: 'food', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: 'When this dies, return a random Spell from your graveyard to your hand.',
    flavor: 'You can always go back for more.',
    abilityKind: 'recover_on_death',
    rarity: 'rare', suggested: 'a lunch box, takeout container, or packed meal' },

  { id: 'fd-06', name: 'Slow Cooker', el: 'food', cost: 3, atk: 1, hp: 4, type: 'Creature',
    ability: 'On play: gain +1 mana next turn.',
    flavor: 'It will be ready when it is ready.',
    abilityKind: 'mana_prep', abilityValue: 1,
    rarity: 'rare', suggested: 'a crockpot, slow cooker, or simmering pot' },

  { id: 'fd-07', name: 'Recipe Card', el: 'food', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a Food-type creature +1/+1.',
    flavor: 'Pinch of salt, ten more minutes.',
    abilityKind: 'spell_buff', abilityValue: 1,
    rarity: 'common', suggested: 'a handwritten recipe or cookbook page' },

  { id: 'fd-08', name: 'Share the Meal', el: 'food', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Heal each of your Food-type creatures +2 HP.',
    flavor: 'Nobody eats alone tonight.',
    abilityKind: 'spell_share_meal', abilityValue: 2,
    rarity: 'rare', suggested: 'a shared plate, family-style dinner, friends eating' },

  { id: 'fd-09', name: 'Comfort Food', el: 'food', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 4 HP.',
    flavor: 'Tastes like a hug.',
    abilityKind: 'spell_heal', abilityValue: 4,
    rarity: 'common', suggested: 'mac and cheese, mashed potatoes, your favorite' },

  { id: 'fd-10', name: 'Grandma\'s Pie', el: 'food', cost: 3, atk: 2, hp: 5, type: 'Creature',
    ability: 'At the start of your turn, restore 2 HP.',
    flavor: "There's always one more slice.",
    abilityKind: 'heal_each_turn', abilityValue: 2,
    rarity: 'rare', suggested: 'a homemade pie, fruit crumble, or dessert' },

  { id: 'fd-11', name: 'The Cook', el: 'food', cost: 4, atk: 3, hp: 4, type: 'Creature',
    ability: 'On play: heal each of your creatures +1 HP.',
    flavor: 'They taste-tested every plate.',
    abilityKind: 'spell_share_meal', abilityValue: 1,
    rarity: 'epic', suggested: 'a chef at work, or someone cooking at the stove' },

  { id: 'fd-12', name: 'Family Feast', el: 'food', cost: 6, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 8 HP and heal each of your creatures +4 HP.',
    flavor: 'Everyone leaves the table fuller.',
    abilityKind: 'spell_feast', abilityValue: 8,
    rarity: 'legendary', suggested: 'a holiday spread, big dinner table, feast scene' },

  { id: 'fd-13', name: 'Sip', el: 'food', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 3 HP to a Food-type creature.',
    flavor: 'A small drink. A small reset.',
    abilityKind: 'spell_heal_friend', abilityValue: 3,
    rarity: 'common', suggested: 'a glass of water, an iced tea, a smoothie' },

  { id: 'fd-14', name: 'Spicy Sauce', el: 'food', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 2 damage to an enemy.',
    flavor: 'Too much? Never.',
    abilityKind: 'spell_damage', abilityValue: 2,
    rarity: 'common', suggested: 'a hot sauce bottle, chili peppers, a spicy dish' },

  // ============================================================
  // EDUCATION — scaling / growth / conditional payoffs
  //
  // Owns a mechanical lane no other theme touches: PERMANENT stat
  // growth across turns. Level-up creatures gain +1/+1 every end of
  // your turn forever; Graduates transform into Untargetable threats
  // after surviving long enough. Slow to start, hard to remove late.
  // Counter is fast aggro (kill them before they level) or silence
  // (strips the level_up ability).
  // ============================================================

  { id: 'edu-01', name: 'Pencil', el: 'education', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: '',
    flavor: 'You will need this every day.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a pencil, a pen, a marker — your writing tool' },

  { id: 'edu-02', name: 'Backpack', el: 'education', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Draw a card.',
    flavor: 'You haven\'t unpacked it since Sunday.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'common', suggested: 'a school backpack, tote, or messenger bag' },

  { id: 'edu-03', name: 'Math Teacher', el: 'education', cost: 2, atk: 1, hp: 3, type: 'Creature',
    ability: 'At the end of your turn, this gains +1/+1 (max 2 levels).',
    flavor: 'Show your work.',
    abilityKind: 'level_up',
    rarity: 'rare', suggested: 'a teacher at a chalkboard, with numbers or formulas' },

  { id: 'edu-04', name: 'Bathroom Break', el: 'education', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Freeze an enemy creature.',
    flavor: '"Can I be excused?"',
    abilityKind: 'spell_freeze',
    rarity: 'common', suggested: 'a school hallway, lockers, or a hall pass' },

  { id: 'edu-05', name: 'Group Project', el: 'education', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give each of your Education-type creatures +1/+1.',
    flavor: 'Two people do the work. Everyone signs.',
    abilityKind: 'spell_buff_all', abilityValue: 1,
    rarity: 'rare', suggested: 'students gathered around a table working together' },

  { id: 'edu-06', name: 'Physics Class', el: 'education', cost: 3, atk: 2, hp: 4, type: 'Creature',
    ability: 'At the end of your turn, this gains +1/+1 (max 2 levels).',
    flavor: 'For every action, an equal and opposite reaction.',
    abilityKind: 'level_up',
    rarity: 'rare', suggested: 'a science classroom, lab equipment, or an experiment' },

  { id: 'edu-07', name: 'Pop Quiz', el: 'education', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Discard a random card from your hand, then draw 2.',
    flavor: 'Clear your desks.',
    abilityKind: 'pop_quiz',
    rarity: 'rare', suggested: 'a test sheet, scantron, or stack of exams' },

  { id: 'edu-08', name: 'The Bully', el: 'education', cost: 3, atk: 4, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'The hallway feels longer when he\'s in it.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a tough-looking kid, a closed locker, or a tense scene' },

  { id: 'edu-09', name: 'Library', el: 'education', cost: 4, atk: 1, hp: 6, type: 'Creature',
    ability: 'At the start of your turn, restore 1 HP.',
    flavor: 'Quiet places win quiet wars.',
    abilityKind: 'heal_each_turn', abilityValue: 1,
    rarity: 'rare', suggested: 'a library, bookshelves, or a quiet reading nook' },

  { id: 'edu-10', name: 'Final Exam', el: 'education', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'If you have 3+ creatures, deal 5 to the enemy boss. Otherwise, restore 5 HP.',
    flavor: 'Bring a pencil. And a backup.',
    abilityKind: 'exam_pass', abilityValue: 5,
    rarity: 'epic', suggested: 'a packed exam room, a clock on the wall, an answer sheet' },

  { id: 'edu-11', name: 'Senior Year', el: 'education', cost: 4, atk: 2, hp: 3, type: 'Creature',
    ability: 'At the end of your turn, this gains +1/+1 (3 turns). On the 3rd, also gain +2/+2 and Untargetable.',
    flavor: 'Almost done. Almost free.',
    abilityKind: 'graduate', abilityValue: 3,
    rarity: 'epic', suggested: 'a yearbook portrait, a senior photo, a cap and gown closeup' },

  { id: 'edu-12', name: 'Graduation Day', el: 'education', cost: 6, atk: 4, hp: 5, type: 'Creature',
    ability: 'On play: give each of your Education-type creatures +1/+1.',
    flavor: 'You made it. Now what?',
    abilityKind: 'spell_buff_all', abilityValue: 1,
    rarity: 'legendary', suggested: 'graduating students throwing caps, a diploma, a celebration' },

  { id: 'edu-13', name: 'Physical Ed Class', el: 'education', cost: 3, atk: 3, hp: 3, type: 'Creature',
    ability: 'Rush.',
    flavor: 'Suit up. Lap one.',
    abilityKind: 'rush',
    rarity: 'rare', suggested: 'a gym class, kids running, basketball hoop, sports equipment' },

  // ============================================================
  // VANILLA FILLER — common-rarity creatures with no abilities.
  // Add depth to early-game across themes that were thin on plain
  // bodies (Travel / Food / Education only had 2 each). These are
  // the "stat sticks" of each theme — predictable trades, no surprises.
  // ============================================================

  { id: 'fam-16', name: 'Niece', el: 'family', cost: 1, atk: 1, hp: 2, type: 'Creature',
    ability: 'At the start of your turn, restore 1 HP.',
    flavor: 'Too smart for her own good.',
    abilityKind: 'heal_each_turn', abilityValue: 1,
    rarity: 'common', suggested: 'a niece, nephew, or any young kid in the family' },

  { id: 'wrk-16', name: 'Custodian', el: 'work', cost: 5, atk: 4, hp: 5, type: 'Creature',
    ability: 'Taunt.',
    flavor: 'Keeps the lights on. Literally.',
    abilityKind: 'taunt',
    rarity: 'common', suggested: 'a janitor, cleaning crew, or empty office at night' },

  // Manager's signature anti-spell tech. 1-turn spell lock on the
  // opposing side — they can still play creatures and attack, but their
  // heals / removal / draws are dead in hand. Costs 3 so it's playable
  // on curve and forces hard timing decisions: cast too early and the
  // opponent's hand has no spells worth banning; cast too late and the
  // game is already decided. Rare (not legendary) — fine in Normal.
  { id: 'wrk-18', name: 'All-Hands Meeting', el: 'work', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Your opponent cannot cast spells next turn.',
    flavor: 'Mandatory attendance. Cameras on.',
    abilityKind: 'spell_lock',
    rarity: 'rare', suggested: 'a packed conference room, raised hands, Zoom grid of faces' },

  // Manager's missing finisher. Work theme's epic body — a 5-cost 3/4
  // that pumps every other Work creature on play. Manager runs cheap
  // bodies (Intern, Coworker, Senior Engineer) that scale poorly into
  // late game; Colleagues turns the whole desk into actual threats.
  // Theme-locked on-play buff (rare/epic only hits same-theme) so it
  // doesn't bleed into cross-theme abuse.
  { id: 'wrk-17', name: 'Colleagues', el: 'work', cost: 5, atk: 3, hp: 4, type: 'Creature',
    ability: 'On play: give each of your Work-type creatures +1/+1.',
    flavor: 'Monday morning, coffee in hand. We can do this.',
    abilityKind: 'spell_buff_all', abilityValue: 1,
    rarity: 'epic', suggested: 'a team huddled around a desk, coworkers laughing, an office crew' },

  // Spell-synergy enabler for Manager's spell-pile playstyle. 2/3 for
  // 3 mana is sub-baseline (Owl is 2/3 for 3 with on-play draw at
  // rare), so the value lives in the trigger: every spell cast pings
  // the opponent for 1. Manager casts ~5 spells per match, so a
  // single Hired adds ~5 face damage over the game; with two on the
  // board the deck effectively burns ~10 HP through spell triggers
  // alone. Common rarity (max 3 copies) so the trigger can stack.
  { id: 'wrk-19', name: 'Hired', el: 'work', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'When you cast a spell, deal 1 damage to the opponent.',
    flavor: 'First day. New badge, new desk, no idea what anyone does.',
    abilityKind: 'spell_synergy', abilityValue: 1,
    rarity: 'common', suggested: 'your first-day-at-work photo, a new ID badge, an empty desk' },

  { id: 'trv-14', name: 'Backpacker', el: 'travel', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: 'On play: draw a card.',
    flavor: 'No itinerary, no problem.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'common', suggested: 'someone with a backpack, hostel bunk, train platform' },

  { id: 'trv-15', name: 'Hitchhiker', el: 'travel', cost: 3, atk: 3, hp: 2, type: 'Creature',
    ability: 'Rush.',
    flavor: 'Thumb out. Trust the road.',
    abilityKind: 'rush',
    rarity: 'common', suggested: 'a person at a roadside, a thumb up, an open highway' },

  // Random-destination spell. Rolls a d6 inside the engine — each face
  // resolves into a different effect. Designed as Drifter's signature
  // chaos card: high expected value (5 of 6 outcomes are positive) at
  // a low 2-mana price, but the 1/6 self-damage on Flight Canceled
  // keeps casters from spamming it when low on HP.
  { id: 'trv-16', name: 'Where to Travel?', el: 'travel', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Roll a die. 1: heal 5. 2: a friendly creature +2/+0. 3: a friendly creature +0/+3. 4: +2 mana this turn. 5: deal 5 damage. 6: Flight canceled — take 2 damage.',
    flavor: 'A pin on every continent. The board picks for you.',
    abilityKind: 'spell_luck',
    rarity: 'rare', suggested: 'a map with pushpins, a globe, a stack of boarding passes from different trips' },

  // Big sustain body. Travel theme. Fills Drifter's missing "real
  // mid-game wall" slot — his old curve had no 4-cost creature
  // bigger than Hotel's 2/5. Cruise is 3/5 with self-heal each turn,
  // common rarity so multiple copies fit. Compares to Grandma's Pie
  // (3c 2/5 heal_each_turn 2 rare): Cruise pays +1 cost for +1 ATK
  // and the lower rarity (3 copies vs 2), with half the heal rate.
  { id: 'trv-17', name: 'Cruise', el: 'travel', cost: 4, atk: 3, hp: 5, type: 'Creature',
    ability: 'At the start of your turn, restore 1 HP.',
    flavor: 'Salt air, sun deck. Forget what day it is.',
    abilityKind: 'heal_each_turn', abilityValue: 1,
    rarity: 'common', suggested: 'a cruise ship, ocean horizon, deck chair, or your trip photo' },

  { id: 'fd-15', name: 'Apple', el: 'food', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: 'At the start of your turn, restore 1 HP.',
    flavor: 'A day, kept away.',
    abilityKind: 'heal_each_turn', abilityValue: 1,
    rarity: 'common', suggested: 'an apple, any single piece of fruit' },

  { id: 'fd-16', name: 'Sandwich', el: 'food', cost: 3, atk: 3, hp: 3, type: 'Creature',
    ability: '',
    flavor: 'Cut diagonally. Always.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a packed sandwich, a deli wrap, your lunch' },

  { id: 'edu-14', name: 'Notebook', el: 'education', cost: 1, atk: 1, hp: 2, type: 'Creature',
    ability: 'On play: draw a card.',
    flavor: 'Every blank page is a fresh start.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'common', suggested: 'a notebook, a binder, a fresh page of paper' },

  { id: 'edu-15', name: 'Classmate', el: 'education', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'You saw them every day. You never asked their name.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a school friend, a kid at the desk next to you' },

  // ============================================================
  // COUPLE ARC — relationship-life cards distributed across the
  // existing six themes by what the photo subject is (people →
  // family, dates and trips → travel, meals → food, chores →
  // work). The "Couple" memory pack curates these into a single
  // narrative deck. Bonds in src/data/bonds.ts stitch them
  // together: Boyfriend + Wedding, Cleaning + Laundry, etc.
  // ============================================================

  { id: 'cou-01', name: 'Crush', el: 'family', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: 'Rush.',
    flavor: 'Heart racing. Stomach gone.',
    abilityKind: 'rush',
    rarity: 'common', tags: ['relationship'], suggested: 'someone you had a crush on, an old photo of an early flame' },

  { id: 'cou-02', name: 'Boyfriend / Girlfriend', el: 'family', cost: 2, atk: 2, hp: 3, type: 'Creature',
    ability: '',
    flavor: 'Your person. Your favourite.',
    abilityKind: 'none',
    rarity: 'rare', tags: ['relationship'], suggested: 'your partner, or someone you love' },

  { id: 'cou-03', name: 'The Ex', el: 'family', cost: 3, atk: 3, hp: 2, type: 'Creature',
    ability: 'On play: deal 2 damage to the enemy face.',
    flavor: 'A door you closed. A scar you kept.',
    abilityKind: 'aoe_on_play', abilityValue: 2,
    rarity: 'rare', tags: ['relationship'], suggested: 'a dramatic photo, a memory, a closed door' },

  { id: 'cou-04', name: 'Couple Photo', el: 'family', cost: 4, atk: 3, hp: 3, type: 'Creature',
    ability: '',
    flavor: 'Both smiling. Same year. Different reasons.',
    abilityKind: 'none',
    rarity: 'common', tags: ['relationship'], suggested: 'a photo of you and your partner together' },

  { id: 'cou-05', name: 'Movie Night', el: 'family', cost: 2, atk: 1, hp: 4, type: 'Creature',
    ability: 'Taunt.',
    flavor: 'Couch fort. One blanket, two people.',
    abilityKind: 'taunt',
    rarity: 'common', tags: ['relationship'], suggested: 'couch + tv, popcorn, the living-room set-up' },

  { id: 'cou-06', name: 'Proposal', el: 'family', cost: 5, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a Family-type creature +3/+3 and Taunt.',
    flavor: 'On one knee. Heart in your throat.',
    abilityKind: 'spell_buff_taunt', abilityValue: 3,
    rarity: 'epic', tags: ['relationship'], suggested: 'the ring, the moment, the question' },

  { id: 'cou-07', name: 'Wedding Day', el: 'family', cost: 7, atk: 5, hp: 8, type: 'Creature',
    ability: 'On play: restore 5 HP.',
    flavor: 'Two families. One day.',
    abilityKind: 'spell_heal', abilityValue: 5,
    rarity: 'legendary', tags: ['relationship'], suggested: 'a wedding photo, vows, rings, the ceremony' },

  { id: 'cou-08', name: 'Anniversary', el: 'family', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a friendly creature +1/+1.',
    flavor: 'You remembered. You both did.',
    // Cross-theme flex buff. The couple memory pack spans Family,
    // Travel, Food, and Work, so theme-locked buffs barely fire in
    // a true hybrid deck. Anniversary fills the gap as a same-cost
    // counterpart to Date Night Dinner: small permanent stat bump
    // on any friendly creature regardless of theme.
    abilityKind: 'spell_buff_any', abilityValue: 1,
    rarity: 'rare', tags: ['relationship'], suggested: 'the dated photo, a card you wrote, a small gift' },

  { id: 'cou-09', name: 'First Date', el: 'travel', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Draw a card.',
    flavor: 'Three hours. Felt like ten minutes.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'common', tags: ['relationship'], suggested: 'the restaurant, the cafe, the venue of an early date' },

  { id: 'cou-10', name: 'Beach Day', el: 'travel', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: heal each of your Travel-type creatures by 2.',
    flavor: 'Sand everywhere. Sunburn worth it.',
    abilityKind: 'spell_share_meal', abilityValue: 2,
    rarity: 'rare', tags: ['relationship'], suggested: 'a beach trip together, the ocean, sunset on sand' },

  { id: 'cou-11', name: 'Honeymoon', el: 'travel', cost: 5, atk: 0, hp: 0, type: 'Spell',
    ability: 'Heal each of your Travel-type creatures by 3, then draw a card.',
    flavor: 'No phones. No emails. Just you two.',
    abilityKind: 'spell_share_meal', abilityValue: 3,
    rarity: 'epic', tags: ['relationship'], suggested: 'the honeymoon trip, the resort, the boarding passes' },

  { id: 'cou-12', name: 'Date Night Dinner', el: 'food', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a friendly creature +1/+1.',
    flavor: 'Candles. Wine. The good plates.',
    // Cross-theme flex buff — sits in the couple arc which spans
    // family + travel + food + work. The theme-locked Recipe Card
    // does +1/+1 to Food only; Date Night Dinner is the universal
    // counterpart at the same cost, same stat bump, but works on
    // any creature so a couple deck can buff its Family or Travel
    // pieces too.
    abilityKind: 'spell_buff_any', abilityValue: 1,
    rarity: 'common', tags: ['relationship'], suggested: 'a candle-lit meal, a restaurant table, plated food' },

  { id: 'cou-13', name: 'Cooking Together', el: 'food', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a friendly creature +0/+3 HP.',
    flavor: 'Someone chops. Someone stirs. Both taste.',
    abilityKind: 'spell_nourish', abilityValue: 3,
    rarity: 'rare', tags: ['relationship'], suggested: 'a shared kitchen, two pairs of hands, an in-progress meal' },

  { id: 'cou-14', name: 'Anniversary Cake', el: 'food', cost: 3, atk: 1, hp: 4, type: 'Creature',
    ability: 'On play: restore 3 HP.',
    flavor: 'One slice. Two forks.',
    abilityKind: 'spell_heal', abilityValue: 3,
    rarity: 'common', tags: ['relationship'], suggested: 'an anniversary cake, candles, a small celebration' },

  { id: 'cou-15', name: 'Cleaning Day', el: 'work', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 2 HP, then draw a card.',
    flavor: 'A clean apartment is a love language.',
    abilityKind: 'spell_heal', abilityValue: 2,
    rarity: 'common', tags: ['relationship'], suggested: 'a tidied living room, vacuumed carpet, fresh laundry' },

  { id: 'cou-16', name: 'Laundry Day', el: 'work', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 2 HP to a friendly creature.',
    flavor: 'You folded. They put them away. Eventually.',
    abilityKind: 'spell_heal_friend', abilityValue: 2,
    rarity: 'common', tags: ['relationship'], suggested: 'a laundry pile, folded clothes, the dryer' },

  { id: 'cou-17', name: 'House Hunting', el: 'work', cost: 4, atk: 3, hp: 4, type: 'Creature',
    ability: 'On play: gain +1 mana next turn.',
    flavor: 'Every door, you wonder what your life would be.',
    abilityKind: 'mana_prep', abilityValue: 1,
    rarity: 'rare', tags: ['relationship'], suggested: 'a house tour, moving boxes, an empty apartment, "For Sale" sign' },

  // Cheap rush body for the couple arc. The deck only had Crush at 1c
  // Rush, so if it didn't draw Crush it had no early pressure. Holding
  // Hands gives the deck a second 1-drop Rush option so the curve isn't
  // dead by turn 3.
  { id: 'cou-18', name: 'Holding Hands', el: 'family', cost: 1, atk: 2, hp: 1, type: 'Creature',
    ability: 'Rush.',
    flavor: 'Fingers laced. Already in step.',
    abilityKind: 'rush',
    rarity: 'common', tags: ['relationship'], suggested: 'two hands clasped, fingers interlocked, a close-up' },

  // FOOD — mid-cost burn. Food previously only had Spicy Sauce (2 dmg)
  // for removal, which couldn't stabilize against early aggro. Stew
  // gives Cook a 3-mana 4-damage option on parity with Sales Pitch
  // (wrk-06) so the sustain plan can survive long enough to come online.
  { id: 'fd-17', name: 'Stew Pot', el: 'food', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 4 damage to an enemy.',
    flavor: 'Hot enough to clear a room.',
    abilityKind: 'spell_damage', abilityValue: 4,
    rarity: 'rare', suggested: 'a bubbling pot, ladle, a thick stew' },
];

export function getTemplateById(id: string): CardTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function templatesByTheme(theme: ElementId): CardTemplate[] {
  return TEMPLATES.filter(t => t.el === theme);
}

/** A pool-build rule for Memory Packs. Each rule contributes a filtered
 *  slice of the catalogue; the final pool is the de-duplicated union of
 *  every rule's slice. All fields are AND-ed within a single rule. */
export interface PoolRule {
  /** Restrict to cards whose element is one of these. Omit for "any". */
  themes?: ElementId[];
  /** Require at least one of these tags. Omit for "no tag requirement". */
  tags?: string[];
  /** Drop any card carrying one of these tags. Used to keep the Birthday
   *  / Milestone packs free of ex-partner cards while still pulling from
   *  the broader family pool. */
  excludeTags?: string[];
}

export function templatesByPool(rules: PoolRule[]): CardTemplate[] {
  const seen = new Set<string>();
  const out: CardTemplate[] = [];
  for (const r of rules) {
    for (const t of TEMPLATES) {
      if (seen.has(t.id)) continue;
      if (r.themes && !r.themes.includes(t.el)) continue;
      if (r.tags && !(t.tags ?? []).some(tag => r.tags!.includes(tag))) continue;
      if (r.excludeTags && (t.tags ?? []).some(tag => r.excludeTags!.includes(tag))) continue;
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}
