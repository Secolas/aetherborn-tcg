import type { ElementId } from '../game/types';

export interface BossDef {
  id: string;
  name: string;
  subtitle: string;
  themeId: ElementId;
  avatar: string;
  /** Optional photo URL for the boss avatar — replaces the letter
      `avatar` in the picker, the match header, and the win/loss screen. */
  avatarPhoto?: string;
  intro: string;
  /**
   * One-sentence playstyle blurb shown on the boss picker. Tells the
   * player what this boss's deck actually *does* — synergies, threats,
   * tempo — so they can think about how to counter-build, instead of
   * giving them a generic "Normal AI does X" line. Stays consistent
   * across difficulty tiers (those just change AI smarts, not the deck).
   */
  playstyle: string;
  rewardCoins: number;
  /**
   * The exact 12 cards this boss plays at NORMAL difficulty. Order
   * doesn't matter (the engine shuffles before dealing) but duplicates
   * do — repeating a card adds it to the deck twice. This is what
   * gives each boss a *style*: Mom plays lots of healing, the Manager
   * plays lots of spells, Pack Alpha plays lots of bodies.
   */
  deck: string[];
  /**
   * Optional Mythic-tier deck override. Used in place of `deck` when
   * the player picks Mythic difficulty. By design these are tuned to
   * include the boss's legendary card and DOUBLE-UP on bond enablers
   * so the boss's signature synergy is much more reliable. Falls back
   * to `deck` if undefined.
   */
  mythicDeck?: string[];
  /**
   * Optional Hard-tier deck override. Most bosses leave this undefined
   * because Hard tier already boosts AI smarts (threat targeting,
   * spell efficiency); the deck stays Normal-tier. Provided as an
   * escape hatch for bosses that need a small mid-tier deck nudge.
   */
  hardDeck?: string[];
  /**
   * Optional per-card photo overrides so a boss's iconic cards look
   * distinct from the generic AI photo for that template.
   */
  photoOverrides?: Record<string, string>;
  /**
   * Optional themed backdrop image rendered behind the field during the
   * match. Heavily blurred + de-saturated in the UI so cards still pop.
   * Sets the "stage" of where this duel is happening — Mom's kitchen,
   * the Manager's conference room, the wolf's forest, etc. Using a
   * realistic photograph instead of a stylized illustration makes the
   * scene feel like a place, not just a backdrop.
   */
  backdrop?: string;
}

const U = (id: string) => `https://images.unsplash.com/${id}?w=400&q=80`;

export const BOSSES: BossDef[] = [
  // ============================================================
  // MOM — Family theme. Heal/buff/tank-focused. Hard to kill.
  // ============================================================
  {
    id: 'mom',
    name: 'Mom',
    subtitle: 'Disappointed',
    themeId: 'family',
    avatar: 'M',
    avatarPhoto: U('photo-1438761681033-6461ffad8d80'),  // smiling woman portrait
    intro: "You haven't called.",
    playstyle: "Sunday dinner regulars. Mom heals every turn she stands, and when Dad joins the table the family grows stronger together.",
    rewardCoins: 150,
    // Normal-tier deck deliberately OMITS legendary cards so fresh
    // players can win their first encounter against Mom. The Sunday
    // Dinner legendary heal (fam-12) shows up only in the mythicDeck
    // override. Hard tier (which uses this same deck under smarter
    // AI) also stays legendary-free; legendaries are a Mythic-only
    // reward for opting into that difficulty.
    deck: [
      'fam-01',          // Family Pet
      'fam-02',          // Cousin
      'fam-03', 'fam-03',// Abuela's Soup x2 — Mom heals herself
      'fam-04',          // Tio
      'fam-05',          // Mom card
      'fam-06',          // The Look
      'fam-07',          // Older Sibling
      'fam-08',          // Abuela
      'fam-09',          // Birthday Cake
      'fam-11',          // Dad
      'fam-15',          // Family Chat (draw — gives Mom card advantage)
    ],
    photoOverrides: {
      'fam-11': U('photo-1539571696357-5a69c17a67c6'),  // her own warm-smile dad
      'fam-08': U('photo-1566616213894-2d4e1baee5d8'),  // her own grandmother
      'fam-12': U('photo-1559847844-5315695dadae'),    // her own dinner table
    },
    // Warm sunlit kitchen — Mom's natural habitat, soft yellows + wood.
    backdrop: U('photo-1556909114-f6e7ad7d3136'),
    // Mythic: 2x Abuela and 2x Dad so the Generations / Sunday Dinner
    // bonds fire reliably. Drops the cheaper bodies that the Normal
    // deck used as filler. Includes the cheap Hug heal.
    mythicDeck: [
      'fam-02',         // Cousin
      'fam-04',         // Tio (draw engine)
      'fam-05',         // Mom card
      'fam-06',         // The Look
      'fam-08', 'fam-08',// Abuela x2 — Generations enabler
      'fam-10',         // Family Photo (epic buff)
      'fam-11', 'fam-11',// Dad x2 — Sunday Dinner enabler
      'fam-12',         // Sunday Dinner finisher heal
      'fam-14',         // Hug
      'fam-15',         // Family Chat draw engine
    ],
  },

  // ============================================================
  // THE MANAGER — Work theme. Spell/control/freeze-focused.
  // ============================================================
  {
    id: 'manager',
    name: 'The Manager',
    subtitle: 'Has thoughts',
    themeId: 'work',
    avatar: 'M',
    avatarPhoto: U('photo-1573497019940-1c28c88b4f3e'),  // dapper manager portrait
    intro: 'Got a minute? It will only take a minute.',
    playstyle: "Runs the room from the corner office. Freezes your plays, pings with spam, and promotes loyal staff into spell-amplifying closers.",
    rewardCoins: 150,
    // Normal: no legendary. The Boss (wrk-12) is the Mythic-tier
    // exclusive. Hard uses this same deck under smarter AI.
    deck: [
      'wrk-01',          // Intern
      'wrk-02', 'wrk-02',// Spam Email x2 — chip damage
      'wrk-05',          // IT Support
      'wrk-06', 'wrk-06',// Sales Pitch x2 — removal
      'wrk-07',          // HR — Untargetable 3/4 body. Replaces Coffee
                         // (which was el='food' and could only buff Food
                         // creatures Manager doesn't run — a dead card).
                         // HR is the spell-proof mid-curve threat the
                         // Normal deck previously lacked.
      'wrk-08',          // Senior Engineer
      'wrk-09',          // Meeting — freeze
      'wrk-15',          // Payroll — board buff finisher (replaces
                         // Promotion's single-target +4/+4; Payroll is
                         // board-wide so it always does something with
                         // Manager's small bodies)
      'wrk-11',          // Lunch Break — 7 face heal stabilizer
      'wrk-14',          // Stand-up Meeting (cheap draw)
    ],
    photoOverrides: {
      'wrk-12': U('photo-1573497019940-1c28c88b4f3e'),  // his own dapper boss photo
      'wrk-07': U('photo-1580489944761-15a19d654956'),  // his own HR rep
      'wrk-09': U('photo-1542744173-8e7e53415bb0'),    // his own conference room
    },
    // Empty conference room — cold blues / fluorescent / rows of chairs.
    backdrop: U('photo-1497366216548-37526070297c'),
    // Mythic: 2x Senior Engineer + 2x Boss to chain Reporting Line and
    // Top Brass bonds. Adds Payroll (board buff) and Stand-up Meeting
    // for tempo. Drops Lunch Break (Normal's spell_heal) since the
    // Manager already has plenty of value sources.
    mythicDeck: [
      'wrk-01',          // Intern (Reporting Line enabler)
      'wrk-02',          // Spam Email
      'wrk-04',          // Coffee buff
      'wrk-06',          // Sales Pitch (spell removal)
      'wrk-08', 'wrk-08',// Senior Engineer x2
      'wrk-09',          // Meeting freeze
      'wrk-10',          // Promotion buff
      'wrk-12', 'wrk-12',// The Boss x2 — bond + body
      'wrk-14',          // Stand-up Meeting
      'wrk-15',          // Payroll +1/+1 all
    ],
  },

  // ============================================================
  // PACK ALPHA — Animals theme. Aggro/bodies-focused. Wide board.
  // ============================================================
  {
    id: 'alpha',
    name: 'Pack Alpha',
    subtitle: "Doesn't like strangers",
    themeId: 'animals',
    avatar: 'A',
    avatarPhoto: U('photo-1516934024742-b461fba47600'),  // wolf portrait
    intro: 'Bare your teeth or run.',
    playstyle: "Hunts as a pack. Floods the board with small bodies and finishes with apex predators that strike together — Wolf and Lion gain Rush when both are out.",
    rewardCoins: 150,
    // Normal: no legendary. Lion (ani-12, legendary 6/6) is the
    // Mythic-only finisher. Pack Alpha still has Wolf (epic) at the
    // top of curve. The Pack bond won't activate on Normal without
    // Lion present — that's intentional, the bond is a Mythic reward.
    deck: [
      'ani-01', 'ani-01',// Mouse x2 — flood the board
      'ani-02',          // Snake Bite
      'ani-03',          // Rabbit
      'ani-04',          // Cat
      'ani-05',          // Dog
      'ani-06',          // Owl
      'ani-07',          // Treats
      'ani-09',          // Bear Trap
      'ani-10',          // Horse
      'ani-11',          // Wolf
      'ani-14',          // Mosquito (cheap vanilla — replaces Lion)
    ],
    photoOverrides: {
      'ani-12': U('photo-1546182990-dffeafbe841d'),    // their own apex lion
      'ani-11': U('photo-1474511320723-9a56873867b5'),  // their own wolf
      'ani-05': U('photo-1587300003388-59208cc962cb'),  // their own guard dog
    },
    // Misty pine forest — deep greens, fog, "you're not alone out here."
    backdrop: U('photo-1448375240586-882707db888b'),
    // Mythic: 2x Wolf + 2x Lion so The Pack bond becomes the centerpiece.
    // Adds Mosquito (1m rush chip), keeps the silence and snake bite.
    // Drops Mouse and Treats — the Mythic Alpha doesn't bother with
    // filler when she has apex predators to deploy.
    mythicDeck: [
      'ani-01',          // Mouse (1m rush)
      'ani-02',          // Snake Bite damage
      'ani-04',          // Cat
      'ani-05',          // Dog
      'ani-06',          // Owl (untargetable)
      'ani-09',          // Bear Trap freeze
      'ani-11', 'ani-11',// Wolf x2
      'ani-12', 'ani-12',// Lion x2
      'ani-13',          // Muzzle silence
      'ani-14',          // Mosquito
    ],
  },

  // ============================================================
  // THE DRIFTER — Travel theme. Tempo / rush / draw-focused.
  // Plays cheap evasive bodies, cycles through their hand fast,
  // closes the game with a rushing finisher.
  // ============================================================
  {
    id: 'drifter',
    name: 'The Drifter',
    subtitle: 'Already gone',
    themeId: 'travel',
    avatar: 'D',
    avatarPhoto: U('photo-1488646953014-85cb44e25828'),  // backpacker silhouette
    intro: "Don't get attached.",
    playstyle: "Always moving. Cycles cards fast, swings with Rushers the turn they land, and pushes for lethal before you can settle in.",
    rewardCoins: 150,
    // Normal: no legendary. Mountain Summit (trv-12, legendary 6/5
    // Rush finisher) is Mythic-only.
    deck: [
      'trv-01', 'trv-01',// Boarding Pass x2 — keep the pressure on early
      'trv-02',          // Carry-On — small evasive body
      'trv-03',          // Suitcase — draw 2
      'trv-04',          // Lost Luggage — silence
      'trv-05',          // Window Seat — 3/3 Rush
      'trv-06',          // Train Conductor — value body + draw
      'trv-07',          // Roadmap — burn
      'trv-09',          // Hotel — defensive anchor
      'trv-10',          // Beach — heal
      'trv-11',          // First Class — finisher buff
      'trv-13',          // Ticket Stub (cheap draw — replaces Mountain Summit)
    ],
    photoOverrides: {
      'trv-12': U('photo-1464822759023-fed622ff2c3b'),  // their own mountain summit
      'trv-09': U('photo-1566073771259-6a8506099945'),  // their own hotel facade
      'trv-05': U('photo-1436491865332-7a61a109cc05'),  // their own airplane window
    },
    // Airport gate at dawn — gradient sky behind the runway, "leaving."
    backdrop: U('photo-1436491865332-7a61a109cc05'),
    // Mythic: 2x Window Seat (First Class Window bond enabler) and 2x
    // Mountain Summit (the legendary Rush finisher). Replaces filler
    // (Carry-On, Layover) with a Ticket Stub for early cycling.
    mythicDeck: [
      'trv-01',          // Boarding Pass (1m rush)
      'trv-03',          // Suitcase draw 2
      'trv-04',          // Lost Luggage silence
      'trv-05', 'trv-05',// Window Seat x2 — First Class Window enabler
      'trv-06',          // Train Conductor
      'trv-07',          // Roadmap damage
      'trv-10',          // Beach heal
      'trv-11',          // First Class buff
      'trv-12', 'trv-12',// Mountain Summit x2 — finisher
      'trv-13',          // Ticket Stub draw
    ],
  },

  // ============================================================
  // THE COOK — Food theme. Sustain / nourish / outlast-focused.
  // Patient deck. Heals the board, recovers spells from the graveyard,
  // ramps one turn ahead, and finishes by feasting back to full HP.
  // Doesn't race — wins by refusing to die.
  // ============================================================
  {
    id: 'cook',
    name: 'The Cook',
    subtitle: 'Always more on the stove',
    themeId: 'food',
    avatar: 'C',
    // Chef portrait — apron, kitchen, warm light.
    avatarPhoto: U('photo-1583394293214-28ded15ee548'),
    intro: 'Pull up a chair. Plate\'s almost ready.',
    playstyle: "Outlasts you. Heals her board every turn the breakfast combo is up, recovers spells when Lunch Box dies, and stabilizes any near-death turn with Family Feast.",
    rewardCoins: 150,
    // Normal: no legendary. Family Feast (fd-12, legendary +8 face
    // heal + creature heal) is Mythic-only.
    deck: [
      'fd-01', 'fd-01',  // Coffee Mug x2 — early body + Breakfast Combo enabler
      'fd-02',           // Hot Soup — defensive buff
      'fd-03',           // Snack — early rush body
      'fd-04',           // Breakfast Plate — Breakfast Combo partner + draw
      'fd-05',           // Lunch Box — recover_on_death
      'fd-06',           // Slow Cooker — ramp
      'fd-17',           // Stew Pot — 4-damage removal (replaces Spicy
                         // Sauce 2-dmg; lets the sustain plan survive
                         // early aggression long enough to come online)
      'fd-08',           // Share the Meal — board heal
      'fd-09',           // Comfort Food — face heal
      'fd-10',           // Grandma's Pie — heal_each_turn
      'fd-11',           // The Cook — on-play heal
      'fd-13',           // Sip (cheap creature heal — replaces Family Feast)
    ],
    photoOverrides: {
      // Her own iconic plates — distinct photos for the cards she's
      // famous for so the deck reads like a kitchen, not random food.
      'fd-04': U('photo-1490645935967-10de6ba17061'),  // her own breakfast plate
      'fd-10': U('photo-1568571780765-9276ac8b75a2'),  // her own pie
      'fd-12': U('photo-1414235077428-338989a2e8c0'),  // her own feast table
    },
    // Warm restaurant kitchen — copper pans, low light, food prep counter.
    backdrop: U('photo-1517248135467-4c7edcad34c4'),
    // Mythic: 2x Coffee Mug + 2x Breakfast Plate so the Breakfast Combo
    // bond fires turn 2-3 every game. Adds Sip (cheap creature heal).
    mythicDeck: [
      'fd-01', 'fd-01',  // Coffee Mug x2 — Breakfast Combo enabler
      'fd-14',           // Spicy Sauce removal
      'fd-04', 'fd-04',  // Breakfast Plate x2 — Breakfast Combo enabler + draw
      'fd-05',           // Lunch Box recover
      'fd-06',           // Slow Cooker ramp
      'fd-08',           // Share the Meal board heal
      'fd-10',           // Grandma's Pie heal_each_turn
      'fd-11',           // The Cook on-play heal
      'fd-12',           // Family Feast finisher
      'fd-13',           // Sip
    ],
  },

  // ============================================================
  // THE PRINCIPAL — Education theme. Scaling / level-up-focused.
  // Plays patient: drops level-up creatures early, defends them with
  // freeze + library wall, and finishes when Senior Year graduates
  // or Graduation Day pumps the board. Loses to fast aggro that
  // kills students before they grow up; wins long games hard.
  // ============================================================
  {
    id: 'principal',
    name: 'The Principal',
    subtitle: 'Won\'t sign your slip',
    themeId: 'education',
    avatar: 'P',
    // Distinguished older man in a suit with glasses, reading lower
    // half of frame — authoritative posture, classic "principal at
    // his desk" read. Different Unsplash ID family from the others
    // so it doesn't share rotation fate.
    avatarPhoto: U('photo-1568602471122-7832951cc4c5'),
    intro: 'Sit. Down.',
    playstyle: "Patient teacher. Drops Math Teacher and Physics Class early, freezes your attackers with Bathroom Break, and wins long games when his Seniors graduate into Untargetable threats.",
    rewardCoins: 150,
    // Normal-tier deck deliberately OMITS the epic/legendary finishers
    // (Senior Year, Graduation Day) so Family / Animals / Travel players
    // can win a first encounter without being run over by an
    // Untargetable 7/8 graduate. Those threats only appear in the
    // mythicDeck override below for players who opt into Mythic.
    deck: [
      'edu-01', 'edu-01',// Pencil x2 — vanilla filler
      'edu-02',          // Backpack (1m draw)
      'edu-03',          // Math Teacher (level_up)
      'edu-04',          // Bathroom Break (freeze)
      'edu-05',          // Group Project (+1/+1 all)
      'edu-06',          // Physics Class (level_up)
      'edu-07',          // Pop Quiz (discard + draw 2)
      'edu-08',          // The Bully (vanilla 4/2)
      'edu-09',          // Library (heal_each_turn 1)
      'edu-10',          // Final Exam (conditional damage / heal)
      'edu-13',          // Physical Ed Class (3/3 Rush)
    ],
    photoOverrides: {
      'edu-03': U('photo-1577896851231-70ef18881754'),  // his own chalkboard teacher
      // No override for edu-08 The Bully here — the previous override
      // accidentally reused the Family Cousin photo. Let the global
      // edu-08 photo (varsity teen) carry the card so it doesn't
      // duplicate another theme's portrait.
      'edu-09': U('photo-1481627834876-b7833e8f5570'),  // his own library
      'edu-12': U('photo-1627556704290-2b1f5853ff78'),  // his own graduation day
    },
    // School hallway — lockers, fluorescent lighting, polished floor.
    backdrop: U('photo-1503676260728-1c00da094a0b'),
    // Mythic: 2x Math Teacher + 2x Physics Class to lock Study Group
    // bond + double Senior Year copies to chain graduations. Drops
    // Pencil and Bathroom Break — Mythic Principal doesn't need
    // training wheels.
    mythicDeck: [
      'edu-02',          // Backpack
      'edu-03', 'edu-03',// Math Teacher x2 — Study Group enabler
      'edu-05',          // Group Project
      'edu-06', 'edu-06',// Physics Class x2 — Study Group enabler
      'edu-07',          // Pop Quiz
      'edu-09',          // Library
      'edu-10',          // Final Exam
      'edu-11', 'edu-11',// Senior Year x2
      'edu-12',          // Graduation Day legendary
      'edu-08',          // The Bully (one early threat)
    ],
  },

  // ============================================================
  // YOUR PARTNER — Couple-arc boss. Bond-synergy focused. Boyfriend/
  // Girlfriend + Wedding Day on the field heals every turn (Soulmates
  // bond); Cleaning + Laundry refills card draw (House Together);
  // Movie Night + Date Dinner cuts spell costs (Date Routine). Plays
  // patient: drops a small body, drops their partner, then bonds and
  // grows. Loses to fast burn that finishes before bonds stack.
  // ============================================================
  {
    id: 'partner',
    name: 'Your Partner',
    subtitle: 'Loser does dishes for a month',
    // Themed family because most of their iconic cards live there
    // (Boyfriend/Girlfriend, Wedding Day, Anniversary). The deck
    // still pulls from food + travel + work bond enablers.
    themeId: 'family',
    avatar: '♥',
    // Universal silhouetted couple at sunset — keeps the boss
    // identity intentionally neutral (any gender, any relationship
    // shape). Long-stable Unsplash ID known to render reliably.
    avatarPhoto: U('photo-1518621736915-f3b1c41bfd00'),
    intro: "Best two out of three. Loser does dishes for a month.",
    playstyle: "The relationship arc as a deck. Crush rushes early, Boyfriend/Girlfriend anchors mid, and once a bond clicks the board heals, draws, and discounts spells every turn.",
    rewardCoins: 175,
    // Normal-tier: NO legendary (Wedding Day) and NO epic (Proposal /
    // Honeymoon). Twelve approachable cards drawn from all four
    // contributing themes so new players see the cross-theme nature
    // of the couple memory pack without getting swung by a 7-cost
    // legendary first time. Bond enablers are present but only
    // single copies, so synergies are possible but not guaranteed.
    deck: [
      'cou-01',           // Crush (1c Rush — early pressure)
      'cou-02',           // Boyfriend / Girlfriend (Soulmates / Made It Official enabler)
      'cou-18',           // Holding Hands (1c Rush — second 1-drop so
                          // the deck doesn't brick its curve when Crush
                          // is at the bottom of the deck)
      'cou-05',           // Movie Night (Date Routine enabler — Taunt)
      'cou-08',           // Anniversary (cross-theme +1/+1 buff)
      'cou-09',           // First Date (1c draw — tempo)
      'cou-10',           // Beach Day (creature + small board heal)
      'cou-12',           // Date Night Dinner (Date Routine enabler — buff)
      'cou-13',           // Cooking Together (Married Life enabler — buff)
      'cou-14',           // Anniversary Cake (creature + heal)
      'cou-15',           // Cleaning Day (House Together enabler — heal + draw)
      'cou-17',           // House Hunting (mana ramp creature)
    ],
    // Photo overrides for the boss's iconic couple cards so the player
    // sees thematically-coherent photos when the boss plays them. Same
    // pattern Mom and the Manager use for their signature cards.
    photoOverrides: {
      'cou-02': U('photo-1518621736915-f3b1c41bfd00'),  // Boyfriend/GF — silhouette couple
      'cou-07': U('photo-1519741497674-611481863552'),  // Wedding Day — ceremony rings
      'cou-10': U('photo-1507525428034-b723cf961d3e'),  // Beach Day — ocean shore
      'cou-11': U('photo-1505228395891-9a51e7e86bf6'),  // Honeymoon — beach hut / tropical resort
      'cou-13': U('photo-1556909114-f6e7ad7d3136'),    // Cooking Together — kitchen + plate
      'cou-17': U('photo-1576941089067-2de3c901e126'),  // House Hunting — front door / keys
    },
    // Mythic: 2x Boyfriend + 2x Wedding Day legendary so Soulmates
    // is almost guaranteed; 2x Cleaning + 2x Laundry for House
    // Together draw engine; adds Proposal (epic buff) and Honeymoon
    // (epic board heal). Drops Couple Photo + Anniversary Cake to
    // make room.
    mythicDeck: [
      'cou-01',           // Crush
      'cou-02', 'cou-02', // Boyfriend / Girlfriend x2 — Soulmates enabler
      'cou-05',           // Movie Night
      'cou-06',           // Proposal (epic +3/+3 + Taunt)
      'cou-07',           // Wedding Day LEGENDARY (Soulmates pair)
      'cou-11',           // Honeymoon (epic board heal)
      'cou-12',           // Date Night Dinner
      'cou-13',           // Cooking Together
      'cou-15', 'cou-15', // Cleaning Day x2 — House Together enabler
      'cou-16',           // Laundry Day — House Together pair
    ],
  },
];

export function getBoss(id: string): BossDef | undefined {
  return BOSSES.find(b => b.id === id);
}
