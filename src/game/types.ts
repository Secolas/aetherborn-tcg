/** Themes are the deck-organizing axis. Each theme is a photo prompt set. */
export type ElementId = 'family' | 'work' | 'animals' | 'travel' | 'food' | 'education';

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
  | 'silence'        // (Spell) strip all abilities from an enemy creature
  // ---- Food theme additions ----
  | 'spell_nourish'      // (Spell) +0/+2 HP to a friendly creature (defensive buff)
  | 'spell_share_meal'   // (Spell) heal all your creatures by X
  | 'spell_feast'        // (Spell) heal owner X face HP AND your creatures by Y
  | 'recover_on_death'   // when this creature dies, return a random Spell from your discard to your hand
  | 'mana_prep'          // on play: gain +1 mana NEXT turn only (one-shot ramp)
  // ---- Cheap-card pass + Payroll ----
  | 'spell_heal_friend'  // (Spell) restore X HP to a friendly creature (current-HP heal, capped at max)
  | 'spell_both_draw'    // (Spell) both players draw 1 — neutral cycle (Stand-up Meeting)
  | 'spell_buff_all'     // (Spell) +X/+X to every friendly creature (Payroll, Graduation Day on-play variant)
  // ---- Education theme additions ----
  | 'level_up'           // (Creature) at end of your turn, this gains +1/+1 permanently
  | 'graduate'           // (Creature) level up each turn; after X turns alive, gains +2/+2 AND Untargetable permanently
  | 'exam_pass'          // (Spell) if you have 3+ creatures, deal X to enemy face; otherwise heal owner X
  | 'pop_quiz';          // (Spell) discard a random card from your hand, then draw 2

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
  /** Cosmetic filter id applied to the photo on this card. Defaults to
   *  `none` when missing. See src/data/filters.ts. Pure presentation —
   *  never affects gameplay. */
  filterId?: import('../data/filters').FilterId;
}

/** Live battlefield instance — copy of a card with mutable battle state. */
export interface BattleCard extends CollectionCard {
  battleId: string;
  currentHp: number;
  currentAtk: number;
  tapped: boolean;
  justPlayed: boolean;
  frozen: boolean;
  /** Turn number after which the freeze must wear off. Together with the
      end-of-turn cleanup in match.ts:endTurn this ensures freeze lasts at
      most one full owner-turn even if some edge case skips the cleanup. */
  frozenUntilTurn?: number;
  /** True once this creature has been hit by a silence spell. abilityKind
      is set to 'none' on silence, but that's indistinguishable from a
      vanilla creature without this flag — so the UI can keep showing a
      muted "silenced" badge. Silence wears off at the end of the
      silenced creature's owner's turn (parallels freeze). */
  silenced?: boolean;
  /** Turn number after which silence must wear off — same safety net as
      frozenUntilTurn. */
  silencedUntilTurn?: number;
  /** When silence is applied we stash the original ability so we can
      restore it when the silence wears off. */
  originalAbilityKind?: AbilityKind;
  originalAbility?: string;
  /** Education-theme bookkeeping. Counts how many owner-turn-ends this
      creature has survived (not counting the turn it was summoned).
      Drives `level_up` per-turn buffs and `graduate` transformations.
      Reset to 0 when freshly summoned. */
  turnsAlive?: number;
  /** True once a `graduate` creature has hit its threshold and applied
      the one-shot +2/+2 + Untargetable transformation. Prevents re-firing
      and locks in the permanent state. */
  graduated?: boolean;
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
  /** Per-turn flags used by bond effects with "once per turn" gating.
      Cleared at the start of every owner-turn. Keyed by bond id. */
  bondFlags?: Record<string, boolean>;
  /** Currently-claimed bond ids. First-bond-wins: when two creatures
      that form a bond both reach the field, that bond claims them — its
      cards are now exclusively bound to it. Other potential bonds that
      share a card with a claimed bond cannot form until the claim
      releases (i.e. one of the bonded cards leaves the field). On a tie
      where multiple bonds become eligible at once, the bond with the
      higher `amount` wins. Recomputed by recomputeBondClaims after every
      field change. */
  claimedBonds?: string[];
  /** Carry-over mana for next turn. Spent down by beginTurn (added once,
      then cleared). Set by `mana_prep` creatures (Slow Cooker) and any
      future one-shot ramp effect. Doesn't raise maxMana — only the
      immediate spend for the upcoming turn — so ramp can't snowball. */
  manaBonusNextTurn?: number;
}

export interface MatchState {
  player: PlayerState;
  opponent: PlayerState;
  turn: Turn;
  turnNumber: number;
  log: string[];
  outcome: 'ongoing' | 'win' | 'loss' | 'draw';
  /** Difficulty tier this match was created at. Read by the AI to scale
      its decision-making — Normal plays the baseline heuristics, Hard
      adds threat targeting + spell efficiency + smarter lethal, Mythic
      additionally tries to complete its own bonds and break the
      player's. */
  difficulty: Difficulty;
}

/** Difficulty tier for a single match. Picked by the player on the boss
 *  picker; scales the boss's starting HP / hand / mana and the coin reward. */
export type Difficulty = 'normal' | 'hard' | 'mythic';

/** A named, saved deck slot. Players can have multiple decks for
 *  different playstyles (e.g. a Family heal deck and an Animals aggro
 *  deck) and swap which one is active at any time. */
export interface DeckSlot {
  id: string;
  name: string;
  uids: string[];
}

export interface SaveData {
  version: number;
  collection: CollectionCard[];
  /** Legacy field — the original "single active deck" representation.
   *  Still present for older saves; migrated into `decks` on load. New
   *  code should use `decks` + `activeDeckId` instead. */
  deckUids: string[];
  /** Up to MAX_DECKS named deck slots. Empty for legacy saves until the
   *  first load migrates `deckUids` into a single "My Deck" slot. */
  decks?: DeckSlot[];
  /** Id of the currently-active deck slot. Initial migration sets this
   *  to the migrated slot's id. */
  activeDeckId?: string;
  coins: number;
  packsOpened: number;
  matchesWon: number;
  matchesLost: number;
  bossesDefeated: string[];
  /** Optional uploaded player avatar (data URL). When present, the player
      portrait shows this image instead of the default "Y" letter. */
  playerAvatar?: string;
  /** Bond ids the player has triggered at least once. Used by the Album to
      reveal locked bonds as they're discovered through play. */
  discoveredBonds?: string[];
  /** Per-boss highest difficulty tier the player has *defeated*. Surfaces
      on the boss picker as a small medal. Bosses not yet beaten on Normal
      have no entry. */
  bossesBeatenAt?: Record<string, Difficulty>;
  /** Daily quests + login streak. Lazily initialized on first boot of the
   *  schema (App.tsx migration). Rolled over to a fresh day on the first
   *  session of any new calendar day. */
  daily?: import('./quests').DailyState;
  /** Filter ids the player has unlocked. Starter filters (see
   *  STARTER_FILTERS) are added at save creation time. Memory packs grant
   *  additional filters on first open; the cosmetic picker can also buy
   *  filters directly with coins. */
  unlockedFilters?: import('../data/filters').FilterId[];
  /** Card frame ids the player has unlocked. One frame is equipped
   *  globally (see equippedFrame) and applied to every card render. */
  unlockedFrames?: import('../data/frames').FrameId[];
  equippedFrame?: import('../data/frames').FrameId;
  /** Board skin ids the player has unlocked. One is equipped globally. */
  unlockedBoardSkins?: import('../data/boardSkins').BoardSkinId[];
  equippedBoardSkin?: import('../data/boardSkins').BoardSkinId;
  /** Victory emote ids the player has unlocked. One is equipped. */
  unlockedEmotes?: import('../data/victoryEmotes').EmoteId[];
  equippedEmote?: import('../data/victoryEmotes').EmoteId;
  /** Memory pack ids the player has opened at least once. Used to gate
   *  the "first-open bonus filter" — subsequent opens of the same memory
   *  pack don't re-grant the cosmetic. */
  openedMemoryPacks?: string[];
}
