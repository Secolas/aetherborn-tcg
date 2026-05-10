/** Themes are the deck-organizing axis. Each theme is a photo prompt set. */
export type ElementId = 'family' | 'work' | 'animals' | 'travel';

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
  | 'spell_freeze'   // (Spell) tap an enemy creature
  | 'silence';       // (Spell) strip all abilities from an enemy creature

export interface CardTemplate {
  id: string;
  name: string;
  el: ElementId;
  cost: number;
  atk: number;
  hp: number;
  type: CardType;
  /** Mechanical text — what the card does. Bold/themed color. Empty = no special ability. */
  ability: string;
  /** Italic flavor prose. De-emphasized in the card description. */
  flavor?: string;
  abilityKind: AbilityKind;
  abilityValue?: number;
  rarity: Rarity;
  suggested: string;
}

/** A template combined with the user's photo + nickname, after summoning. */
export interface CollectionCard extends CardTemplate {
  uid: string;
  photo: string | null;
  nickname?: string;
  /**
   * True when this photo is a placeholder (thematic stock image filled in
   * by Quick Play) rather than a real photo the user took. Lets the UI
   * mark these cards so the player knows which ones to retake.
   */
  isPlaceholder?: boolean;
}

/** Live battlefield instance — copy of a card with mutable battle state. */
export interface BattleCard extends CollectionCard {
  battleId: string;
  currentHp: number;
  currentAtk: number;
  tapped: boolean;
  justPlayed: boolean;
  frozen: boolean;
  /** True once this creature has been hit by a silence spell. abilityKind
      is set to 'none' on silence, but that's indistinguishable from a
      vanilla creature without this flag — so the UI can keep showing a
      muted "silenced" badge as a permanent reminder. */
  silenced?: boolean;
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
  /** Cards that have left play — spells that resolved + creatures that died.
      Surfaced via the in-match graveyard button so the player can review
      what was used. Newest entries are at the end of the array. */
  discard: BattleCard[];
  /** Number of times this player has tried to draw from an empty deck. Each
      subsequent fatigue draw deals 1 more damage (Hearthstone-style), so
      stalling becomes self-destructive. */
  fatigueCount: number;
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
  bossesDefeated: string[];
}
