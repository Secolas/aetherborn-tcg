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

  { id: 'fam-01', name: 'Family Pet', el: 'family', cost: 1, atk: 2, hp: 1, type: 'Creature',
    ability: 'Rush.',
    flavor: 'First to the rescue.',
    abilityKind: 'rush',
    rarity: 'rare', suggested: 'your pet, or any pet you love' },

  { id: 'fam-02', name: 'Cousin', el: 'family', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'Always down to throw hands for you.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a cousin, niece, or nephew' },

  { id: 'fam-03', name: "Abuela's Soup", el: 'family', cost: 3, atk: 0, hp: 0, type: 'Spell',
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

  { id: 'fam-09', name: 'Birthday Cake', el: 'family', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 6 HP.',
    abilityKind: 'spell_heal', abilityValue: 6,
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

  { id: 'fam-12', name: 'Sunday Dinner', el: 'family', cost: 6, atk: 0, hp: 0, type: 'Spell',
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
    ability: 'Deal 2 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 2,
    rarity: 'common', suggested: 'an inbox, a screen, anything annoying' },

  { id: 'wrk-03', name: 'Coworker', el: 'work', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'A reliable colleague.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a coworker or office buddy' },

  { id: 'wrk-04', name: 'Coffee', el: 'work', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a Work-type creature +2/+2.',
    flavor: 'Now they can think.',
    abilityKind: 'spell_buff', abilityValue: 2,
    rarity: 'common', suggested: 'a coffee, mug, or barista shot' },

  { id: 'wrk-05', name: 'IT Support', el: 'work', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: draw a card.',
    flavor: 'They explain things.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'rare', suggested: 'a tangle of cables, a tech setup' },

  { id: 'wrk-06', name: 'Sales Pitch', el: 'work', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 4 damage to any target.',
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
    ability: 'Deal 3 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 3,
    rarity: 'common', suggested: 'a snake, lizard, or bug' },

  { id: 'ani-03', name: 'Rabbit', el: 'animals', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'Quick on its feet.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a rabbit, hare, or other prey animal' },

  { id: 'ani-04', name: 'Cat', el: 'animals', cost: 3, atk: 3, hp: 2, type: 'Creature',
    ability: 'Spells cannot target this.',
    flavor: 'Sneaky and untouchable.',
    abilityKind: 'untargetable',
    rarity: 'rare', suggested: 'a cat — yours, a stranger, a stray' },

  { id: 'ani-05', name: 'Dog', el: 'animals', cost: 3, atk: 2, hp: 4, type: 'Creature',
    ability: 'Taunt.',
    flavor: 'Stays at your side. Always.',
    abilityKind: 'taunt',
    rarity: 'rare', suggested: 'a dog — any dog' },

  { id: 'ani-06', name: 'Owl', el: 'animals', cost: 3, atk: 2, hp: 3, type: 'Creature',
    ability: 'On play: draw a card.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'rare', suggested: 'a bird — owl, eagle, sparrow, anything' },

  { id: 'ani-07', name: 'Treats', el: 'animals', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give an Animals-type creature +3/+3.',
    flavor: 'Good boy.',
    abilityKind: 'spell_buff', abilityValue: 3,
    rarity: 'common', suggested: 'pet food, a treat, a bowl' },

  { id: 'ani-08', name: 'Vet Visit', el: 'animals', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 6 HP.',
    abilityKind: 'spell_heal', abilityValue: 6,
    rarity: 'rare', suggested: 'a vet, a clinic, or a pet carrier' },

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
    rarity: 'rare', suggested: 'a leash, harness, or quiet animal' },

  { id: 'ani-14', name: 'Mosquito', el: 'animals', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: '',
    flavor: 'Small. Annoying. Persistent.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a mosquito, fly, or any flying insect' },


  // ============================================================
  // TRAVEL — tempo / evasion. They move fast and slip past defenses.
  // ============================================================

  { id: 'trv-01', name: 'Boarding Pass', el: 'travel', cost: 1, atk: 2, hp: 1, type: 'Creature',
    ability: '',
    flavor: 'You\'re already through security.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a boarding pass, ticket stub, or gate sign' },

  { id: 'trv-02', name: 'Carry-On', el: 'travel', cost: 2, atk: 2, hp: 2, type: 'Creature',
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
    ability: 'Deal 3 damage to any target.',
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

  { id: 'fd-01', name: 'Coffee Mug', el: 'food', cost: 1, atk: 1, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'The first sip of the day.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a coffee cup, latte, or steaming mug' },

  { id: 'fd-02', name: 'Hot Soup', el: 'food', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a Food-type creature +0/+2 HP.',
    flavor: 'The cure for almost everything.',
    abilityKind: 'spell_nourish', abilityValue: 2,
    rarity: 'common', suggested: 'a bowl of soup or stew' },

  { id: 'fd-03', name: 'Snack', el: 'food', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: '',
    flavor: 'Just a little something.',
    abilityKind: 'none',
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
    ability: 'Deal 2 damage to any target.',
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
    ability: 'On play: give each of your creatures +1/+1.',
    flavor: 'You made it. Now what?',
    abilityKind: 'spell_buff_all', abilityValue: 1,
    rarity: 'legendary', suggested: 'graduating students throwing caps, a diploma, a celebration' },

  { id: 'edu-13', name: 'Physical Ed Class', el: 'education', cost: 3, atk: 3, hp: 3, type: 'Creature',
    ability: 'Rush.',
    flavor: 'Suit up. Lap one.',
    abilityKind: 'rush',
    rarity: 'rare', suggested: 'a gym class, kids running, basketball hoop, sports equipment' },
];

export function getTemplateById(id: string): CardTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function templatesByTheme(theme: ElementId): CardTemplate[] {
  return TEMPLATES.filter(t => t.el === theme);
}
