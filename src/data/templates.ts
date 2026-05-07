import type { CardTemplate } from '../game/types';

/**
 * 30 templates spread across rarity/element/cost so deck building has texture.
 * Each ability maps to a machine-readable AbilityKind so the engine + AI can
 * actually act on them.
 */
export const TEMPLATES: CardTemplate[] = [
  // ============== EMBER (aggro / direct damage) ==============
  { id: 'em-01', name: 'Ember Hound',     el: 'ember', cost: 2, atk: 3, hp: 2, type: 'Creature',
    ability: 'Rush. Bite first, ask later.',
    abilityKind: 'rush',
    rarity: 'common', suggested: 'a pet' },

  { id: 'em-02', name: 'Cinder Imp',      el: 'ember', cost: 1, atk: 2, hp: 1, type: 'Creature',
    ability: 'Rush.',
    abilityKind: 'rush',
    rarity: 'common', suggested: 'something small' },

  { id: 'em-03', name: 'Ashen Pyre',      el: 'ember', cost: 5, atk: 4, hp: 4, type: 'Creature',
    ability: 'On play: deal 2 to all enemies.',
    abilityKind: 'aoe_on_play', abilityValue: 2,
    rarity: 'epic', suggested: 'something hot' },

  { id: 'em-04', name: 'Coalmaw Ogre',    el: 'ember', cost: 4, atk: 5, hp: 3, type: 'Creature',
    ability: 'A simple, hungry brute.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'something tough' },

  { id: 'em-05', name: 'Spark',           el: 'ember', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 2 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 2,
    rarity: 'common', suggested: 'something bright' },

  { id: 'em-06', name: 'Wildfire',        el: 'ember', cost: 4, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 5 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 5,
    rarity: 'rare', suggested: 'a flame' },

  // ============== TIDE (control / draw) ==============
  { id: 'ti-01', name: 'Tide Familiar',   el: 'tide', cost: 2, atk: 1, hp: 3, type: 'Creature',
    ability: 'On play: draw a card.',
    abilityKind: 'draw_on_play', abilityValue: 1,
    rarity: 'rare', suggested: 'an animal' },

  { id: 'ti-02', name: 'Mistwalker',      el: 'tide', cost: 3, atk: 2, hp: 4, type: 'Creature',
    ability: 'A patient hunter.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'something calm' },

  { id: 'ti-03', name: 'Deepscale Sage',  el: 'tide', cost: 5, atk: 3, hp: 5, type: 'Creature',
    ability: 'On play: draw 2 cards.',
    abilityKind: 'draw_on_play', abilityValue: 2,
    rarity: 'epic', suggested: 'someone wise' },

  { id: 'ti-04', name: 'Frostlock',       el: 'tide', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: "Freeze an enemy. They can't attack next turn.",
    abilityKind: 'spell_freeze',
    rarity: 'rare', suggested: 'something cold' },

  { id: 'ti-05', name: 'Reflecting Pool', el: 'tide', cost: 1, atk: 0, hp: 0, type: 'Spell',
    ability: 'Draw 2 cards.',
    abilityKind: 'draw_on_play', abilityValue: 2,  // also reused as spell — engine treats spell as draw
    rarity: 'common', suggested: 'water' },

  // ============== BLOOM (taunt / heal / sustain) ==============
  { id: 'bl-01', name: 'Bloomshield',     el: 'bloom', cost: 3, atk: 2, hp: 5, type: 'Creature',
    ability: 'Taunt. Roots run deep.',
    abilityKind: 'taunt',
    rarity: 'common', suggested: 'a plant' },

  { id: 'bl-02', name: 'Bloompetal',      el: 'bloom', cost: 1, atk: 1, hp: 2, type: 'Creature',
    ability: 'Heal you for 1 each turn.',
    abilityKind: 'heal_each_turn', abilityValue: 1,
    rarity: 'common', suggested: 'a flower' },

  { id: 'bl-03', name: 'Greatroot',       el: 'bloom', cost: 6, atk: 5, hp: 8, type: 'Creature',
    ability: 'Taunt.',
    abilityKind: 'taunt',
    rarity: 'rare', suggested: 'a tree' },

  { id: 'bl-04', name: 'Mosswarden',      el: 'bloom', cost: 4, atk: 3, hp: 6, type: 'Creature',
    ability: 'Taunt.',
    abilityKind: 'taunt',
    rarity: 'common', suggested: 'a guardian' },

  { id: 'bl-05', name: 'Verdant Mend',    el: 'bloom', cost: 2, atk: 0, hp: 0, type: 'Spell',
    ability: 'Restore 5 HP to yourself.',
    abilityKind: 'spell_heal', abilityValue: 5,
    rarity: 'common', suggested: 'something green' },

  { id: 'bl-06', name: 'Vinerush',        el: 'bloom', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Give a creature +2/+2.',
    abilityKind: 'spell_buff', abilityValue: 2,
    rarity: 'rare', suggested: 'a vine' },

  // ============== GUST (fast / evasive) ==============
  { id: 'gu-01', name: 'Gust Dancer',     el: 'gust', cost: 2, atk: 3, hp: 1, type: 'Creature',
    ability: 'Spells cannot target this.',
    abilityKind: 'untargetable',
    rarity: 'rare', suggested: 'something fast' },

  { id: 'gu-02', name: 'Sky Sparrow',     el: 'gust', cost: 1, atk: 1, hp: 1, type: 'Creature',
    ability: 'Rush.',
    abilityKind: 'rush',
    rarity: 'common', suggested: 'a bird' },

  { id: 'gu-03', name: 'Storm Caller',    el: 'gust', cost: 4, atk: 4, hp: 3, type: 'Creature',
    ability: 'Rush.',
    abilityKind: 'rush',
    rarity: 'rare', suggested: 'something stormy' },

  { id: 'gu-04', name: 'Cloudpiercer',    el: 'gust', cost: 6, atk: 6, hp: 4, type: 'Creature',
    ability: 'Rush. Spells cannot target this.',
    abilityKind: 'rush', // rush takes precedence; treated as evasive in AI scoring
    rarity: 'epic', suggested: 'something high up' },

  { id: 'gu-05', name: 'Cyclone',         el: 'gust', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 3 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 3,
    rarity: 'common', suggested: 'wind' },

  // ============== VOID (high-cost / spell synergy) ==============
  { id: 'vo-01', name: 'Voidlash',        el: 'void', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 4 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 4,
    rarity: 'epic', suggested: 'something dark' },

  { id: 'vo-02', name: 'Voidtouched Oracle', el: 'void', cost: 6, atk: 5, hp: 5, type: 'Creature',
    ability: 'When you cast a spell, deal 2 to opponent.',
    abilityKind: 'spell_synergy', abilityValue: 2,
    rarity: 'legendary', suggested: 'something mysterious' },

  { id: 'vo-03', name: 'Shade Warden',    el: 'void', cost: 4, atk: 4, hp: 4, type: 'Creature',
    ability: 'A balanced shadow.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'a shadow' },

  { id: 'vo-04', name: 'Whisperer',       el: 'void', cost: 2, atk: 2, hp: 2, type: 'Creature',
    ability: 'A balanced presence.',
    abilityKind: 'none',
    rarity: 'common', suggested: 'something quiet' },

  { id: 'vo-05', name: 'Eclipse',         el: 'void', cost: 5, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 6 damage to any target.',
    abilityKind: 'spell_damage', abilityValue: 6,
    rarity: 'epic', suggested: 'darkness' },

  { id: 'vo-06', name: 'Soul Drain',      el: 'void', cost: 3, atk: 0, hp: 0, type: 'Spell',
    ability: 'Deal 3 damage and heal yourself 3.',
    abilityKind: 'spell_damage', abilityValue: 3,  // heal handled in engine via element flag
    rarity: 'rare', suggested: 'something draining' },

  // ============== NEUTRAL-ISH BIG ==============
  { id: 'em-07', name: 'Magma Titan',     el: 'ember', cost: 7, atk: 7, hp: 6, type: 'Creature',
    ability: 'A walking inferno.',
    abilityKind: 'none',
    rarity: 'legendary', suggested: 'something massive' },

  { id: 'ti-06', name: 'Leviathan',       el: 'tide', cost: 8, atk: 8, hp: 8, type: 'Creature',
    ability: 'Taunt.',
    abilityKind: 'taunt',
    rarity: 'legendary', suggested: 'something huge' },
];

export function getTemplateById(id: string): CardTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}
