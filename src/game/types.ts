/** Themes are the deck-organizing axis. Each theme is a photo prompt set. */
export type ElementId = 'family' | 'work' | 'animals';

export type CardType = 'Creature' | 'Spell';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * AbilityKind drives the match engine. Each card maps to one of these
 * (or 'none') so the AI and the engine can reason about cards programmatically
 * instead of parsing prose.
 */
export type AbilityKind =
  | 'none'
  | 'rush'           // can attack the turn it's played
  | 'taunt'          // enemies must hit this first
  | 'untargetable'   // spells cannot target this creature
  | 'draw_on_play'   // draw 1 when summoned
  | 'aoe_on_play'    // deal X to all enemies on play
  | 'heal_each_turn' // heal owner X at start of their turn
  | 'spell_synergy'  // when owner casts a spell, deal X to opponent
  | 'spell_damage'   // (Spell) deal X damage to any target
  | 'spell_heal'     // (Spell) heal owner X
  | 'spell_buff'     // (Spell) +X/+X to a friendly creature
  | 'spell_freeze';  // (Spell) tap an enemy creature

export interface CardTemplate {
  id: string;
  name: string;
  el: ElementId;
  cost: number;
  atk: number;
  hp: number;
  type: CardType;
  ability: string;            // human-readable text
  abilityKind: AbilityKind;   // machine-readable
  abilityValue?: number;
  rarity: Rarity;
  suggested: string;          // photo prompt — what to take a photo of
}

/** A template combined with the user's photo + nickname, after summoning. */
export interface CollectionCard extends CardTemplate {
  uid: string;
  photo: string | null;
  nickname?: string;
}

/** Live battlefield instance — copy of a card with mutable battle state. */
export interface BattleCard extends CollectionCard {
  battleId: string;
  currentHp: number;
  currentAtk: number;
  tapped: boolean;
  justPlayed: boolean;
  frozen: boolean;
}

export type Owner = 'player' | 'opponent';
export type Turn = Owner;

export interface PlayerState {
  hp: number;
  mana: number;
  maxMana: number;
  hand: BattleCard[];
  field: BattleCard[];
  deck: BattleCard[];
}

export interface MatchState {
  player: PlayerState;
  opponent: PlayerState;
  turn: Turn;
  turnNumber: number;
  log: string[];
  outcome: 'ongoing' | 'win' | 'loss';
}

export interface SaveData {
  version: number;
  collection: CollectionCard[];
  deckUids: string[];
  coins: number;
  packsOpened: number;
  matchesWon: number;
  matchesLost: number;
}
