import type { ElementId } from '../game/types';

/**
 * BondEffect is the mechanical handle the engine uses. Each kind hooks into
 * a specific moment in match flow:
 *
 *   - heal_face_per_turn   → beginTurn (owner's turn): heal owner by `amount`
 *   - spell_cost_reduction → playCard cost calc: subtract `amount` (min 1)
 *   - spell_damage_bonus   → resolveSpell: add `amount` to spell_damage hits
 *   - pack_atk_rush        → attack: bonded creatures get +`amount` ATK and Rush
 *   - pair_taunt           → attack: bonded creatures both count as Taunt
 *   - draw_on_attack       → attack: draw 1 (once per turn)
 *   - damage_at_end_turn   → endTurn (owner's turn): deal `amount` to enemy face
 */
export type BondEffectKind =
  | 'heal_face_per_turn'
  | 'spell_cost_reduction'
  | 'spell_damage_bonus'
  | 'pack_atk_rush'
  | 'pair_taunt'
  | 'draw_on_attack'
  | 'damage_at_end_turn'
  | 'draw_at_end_if_low_hand';

export interface BondDef {
  id: string;
  name: string;
  themeId: ElementId;
  /** Card template ids — both must be on the same player's field for the
   *  bond to be active. Same-category only by design. */
  cardA: string;
  cardB: string;
  /** One-line player-facing description of what activates. */
  description: string;
  /** Italic flavor line. */
  flavor: string;
  effect: { kind: BondEffectKind; amount?: number };
}

export const BONDS: BondDef[] = [
  // ============================================================
  // FAMILY — heal / sustain
  // ============================================================
  {
    id: 'sunday-dinner',
    name: 'Sunday Dinner',
    themeId: 'family',
    cardA: 'fam-05', // Mom
    cardB: 'fam-11', // Dad
    description: 'Heal +1 HP at the start of your turn.',
    flavor: 'Everyone showed up.',
    effect: { kind: 'heal_face_per_turn', amount: 1 },
  },
  {
    id: 'generations',
    name: 'Generations',
    themeId: 'family',
    cardA: 'fam-08', // Abuela
    cardB: 'fam-05', // Mom
    description: 'Heal +2 HP at the start of your turn.',
    flavor: 'She raised the woman who raised you.',
    effect: { kind: 'heal_face_per_turn', amount: 2 },
  },
  {
    id: 'the-kids',
    name: 'The Kids',
    themeId: 'family',
    cardA: 'fam-02', // Cousin
    cardB: 'fam-07', // Older Sibling
    description: 'Draw a card at end of your turn if your hand has fewer than 3.',
    flavor: 'They always knew where the snacks were.',
    effect: { kind: 'draw_at_end_if_low_hand' },
  },

  // ============================================================
  // WORK — efficiency / spells
  // ============================================================
  {
    id: 'reporting-line',
    name: 'Reporting Line',
    themeId: 'work',
    cardA: 'wrk-01', // Intern
    cardB: 'wrk-08', // Senior Engineer
    description: 'Your spells cost 1 less mana (minimum 1).',
    flavor: 'He never reads your messages but he’s online.',
    effect: { kind: 'spell_cost_reduction', amount: 1 },
  },
  {
    id: 'top-brass',
    name: 'Top Brass',
    themeId: 'work',
    cardA: 'wrk-08', // Senior Engineer — appears in both Work bonds, fine since each card is in at most one ACTIVE bond per match (via mutual exclusivity not enforced here; see note below).
    cardB: 'wrk-12', // The Boss
    description: 'Your damage spells deal +1 damage.',
    flavor: 'Decisions, made.',
    effect: { kind: 'spell_damage_bonus', amount: 1 },
  },

  // ============================================================
  // ANIMALS — aggression / pack
  // ============================================================
  {
    id: 'the-pack',
    name: 'The Pack',
    themeId: 'animals',
    cardA: 'ani-11', // Wolf
    cardB: 'ani-12', // Lion
    description: 'Both gain +1 ATK and Rush.',
    flavor: 'Move as one. Strike as one.',
    effect: { kind: 'pack_atk_rush', amount: 1 },
  },
  {
    id: 'house-pets',
    name: 'House Pets',
    themeId: 'animals',
    cardA: 'ani-04', // Cat
    cardB: 'ani-05', // Dog
    description: 'Both gain Taunt.',
    flavor: 'They were both yours first.',
    effect: { kind: 'pair_taunt' },
  },

  // ============================================================
  // TRAVEL — tempo / draw
  // ============================================================
  {
    id: 'first-class-window',
    name: 'First Class Window',
    themeId: 'travel',
    cardA: 'trv-05', // Window Seat
    cardB: 'trv-11', // First Class
    description: 'When either attacks, draw 1 (once per turn).',
    flavor: 'The good seat with the better view.',
    effect: { kind: 'draw_on_attack' },
  },
  {
    id: 'the-long-way',
    name: 'The Long Way',
    themeId: 'travel',
    cardA: 'trv-06', // Train Conductor
    cardB: 'trv-12', // Mountain Summit
    description: 'Deal 1 damage to the enemy face at end of your turn.',
    flavor: 'Slow burn. Big payoff.',
    effect: { kind: 'damage_at_end_turn', amount: 1 },
  },
];

export function getBond(id: string): BondDef | undefined {
  return BONDS.find(b => b.id === id);
}

/** All bonds that include the given card template id (one card may appear
 *  in more than one bond definition; in a real match only one bond per
 *  template-pair on the same field is active at a time). */
export function bondsForCard(cardId: string): BondDef[] {
  return BONDS.filter(b => b.cardA === cardId || b.cardB === cardId);
}
