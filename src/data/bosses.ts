import type { ElementId } from '../game/types';

export interface BossDef {
  id: string;
  name: string;
  subtitle: string;
  themeId: ElementId;
  avatar: string;
  intro: string;
  rewardCoins: number;
  /**
   * The exact 12 cards this boss plays. Order doesn't matter (the engine
   * shuffles before dealing) but duplicates do — repeating a card adds it
   * to the deck twice. This is what gives each boss a *style*: Mom plays
   * lots of healing, the Manager plays lots of spells, Pack Alpha plays
   * lots of bodies.
   */
  deck: string[];
  /**
   * Optional per-card photo overrides so a boss's iconic cards look
   * distinct from the generic AI photo for that template.
   */
  photoOverrides?: Record<string, string>;
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
    intro: "You haven't called.",
    rewardCoins: 150,
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
      'fam-12',          // Sunday Dinner — finisher heal
    ],
    photoOverrides: {
      'fam-11': U('photo-1539571696357-5a69c17a67c6'),  // her own warm-smile dad
      'fam-08': U('photo-1581579439459-13e44f060f9e'),  // her own grandmother
      'fam-12': U('photo-1559847844-5315695dadae'),    // her own dinner table
    },
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
    intro: 'Got a minute? It will only take a minute.',
    rewardCoins: 150,
    deck: [
      'wrk-01',          // Intern
      'wrk-02', 'wrk-02',// Spam Email x2 — chip damage
      'wrk-04',          // Coffee — buff
      'wrk-05',          // IT Support
      'wrk-06', 'wrk-06',// Sales Pitch x2 — removal
      'wrk-08',          // Senior Engineer
      'wrk-09',          // Meeting — freeze
      'wrk-10',          // Promotion
      'wrk-11',          // Lunch Break
      'wrk-12',          // The Boss
    ],
    photoOverrides: {
      'wrk-12': U('photo-1573497019940-1c28c88b4f3e'),  // his own dapper boss photo
      'wrk-07': U('photo-1580489944761-15a19d654956'),  // his own HR rep
      'wrk-09': U('photo-1542744173-8e7e53415bb0'),    // his own conference room
    },
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
    intro: 'Bare your teeth or run.',
    rewardCoins: 150,
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
      'ani-12',          // Lion
    ],
    photoOverrides: {
      'ani-12': U('photo-1546182990-dffeafbe841d'),    // their own apex lion
      'ani-11': U('photo-1564415051543-c4b21afae0bd'),  // their own wolf
      'ani-05': U('photo-1587300003388-59208cc962cb'),  // their own guard dog
    },
  },
];

export function getBoss(id: string): BossDef | undefined {
  return BOSSES.find(b => b.id === id);
}
