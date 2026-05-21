import { TEMPLATES, getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { BONDS, type BondDef } from './../data/bonds';
import type { BossDef } from '../data/bosses';
import type {
  BattleCard, CollectionCard, MatchState, Owner, PlayerState, CardTemplate, AbilityKind,
  Difficulty,
} from './types';

/**
 * Per-difficulty tweaks. Boss starting stats are intentionally identical
 * across tiers — Normal / Hard / Mythic differ purely in AI smarts (see
 * src/game/ai.ts → caps()). Reward multiplier scales the payout so the
 * harder tiers pay better even though the boss isn't bigger.
 */
const DIFFICULTY_PROFILE: Record<Difficulty, {
  /** Multiplier on `boss.rewardCoins`. The harder tiers pay better even
   *  though the boss isn't bigger — the work the player did to win is
   *  qualitative (against smarter play), not quantitative. */
  rewardMult: number;
  label: string;
}> = {
  normal: { rewardMult: 1.0, label: 'Normal' },
  hard:   { rewardMult: 1.5, label: 'Hard'   },
  mythic: { rewardMult: 2.0, label: 'Mythic' },
};

export function difficultyProfile(d: Difficulty) { return DIFFICULTY_PROFILE[d]; }

export const STARTING_HP = 18;
export const STARTING_HAND = 4;
export const MAX_MANA = 7;
export const MAX_FIELD = 3;
export const MAX_HAND = 7;
/** Hard cap on total turns. If both players are still alive when turn 15
    ends, whoever has more HP wins; ties resolve as a player loss so
    aggressive play is rewarded over heal-stalling. */
export const TURN_LIMIT = 12;

let battleIdCounter = 0;
function newBattleId() { return `b${++battleIdCounter}`; }

function toBattleCard(c: CollectionCard): BattleCard {
  return {
    ...c,
    battleId: newBattleId(),
    currentHp: c.hp,
    currentAtk: c.atk,
    tapped: true,
    justPlayed: false,
    frozen: false,
    turnsAlive: 0,
    graduated: false,
  };
}

/** RNG type — match accepts an injected source for deterministic sims.
 *  Defaults to Math.random in normal play. */
export type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Per-state PRNG step using a mulberry32 stream over `rngState`. Mutates
 *  the state in place and returns a value in [0, 1). When `rngState` isn't
 *  set (default play), falls back to Math.random so behavior is unchanged.
 *  Sim code seeds rngState on createMatch so in-engine randomness (pop_quiz,
 *  recover_on_death) becomes deterministic too. */
function nextRand(state: MatchState): number {
  if (state.rngState == null) return Math.random();
  let t = (state.rngState = (state.rngState + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Build the AI's deck. When a boss is provided, the AI plays *that boss's
 * curated 12-card list* — so Mom always plays a heal-heavy Family deck,
 * The Manager plays a spell-heavy Work deck, Pack Alpha plays a body-
 * heavy Animals deck. Each boss can also override individual card photos
 * so their iconic cards (Lion, The Boss, Sunday Dinner) look distinct.
 *
 * Without a boss spec we fall back to a random themed pool — used for
 * future free-play modes.
 */
function buildOpponentDeck(boss?: BossDef, difficulty: Difficulty = 'normal', rng: Rng = Math.random): CollectionCard[] {
  if (boss) {
    const out: CollectionCard[] = [];
    // Difficulty-aware deck selection. Mythic uses the boss's mythic
    // override if present (doubled bond enablers + best cards). Hard
    // can opt-in to a custom hard deck; otherwise it runs the Normal
    // deck against smarter AI. Normal always uses the base deck.
    const deckList = difficulty === 'mythic' ? (boss.mythicDeck ?? boss.deck)
                  : difficulty === 'hard'    ? (boss.hardDeck ?? boss.deck)
                  : boss.deck;
    deckList.forEach((tid, i) => {
      const template = getTemplateById(tid);
      if (!template) return;
      const photo = boss.photoOverrides?.[tid] ?? aiPhoto(tid);
      out.push({
        ...template,
        uid: `opp_${i}_${tid}`,
        photo,
        nickname: undefined,
      });
    });
    return out;
  }

  // Fallback: random sample (used if no boss is specified)
  const pool = TEMPLATES.filter(t => t.cost <= 7);
  const base = shuffle(pool, rng);
  const picks = base.concat(base.slice(0, Math.max(0, 12 - base.length))).slice(0, 12);
  return picks.map((t, i) => ({
    ...t,
    uid: `opp_${i}`,
    photo: aiPhoto(t.id),
    nickname: undefined,
  }));
}

function emptyPlayer(): PlayerState {
  return {
    hp: STARTING_HP, mana: 1, maxMana: 1, hand: [], field: [], deck: [], discard: [],
    fatigueCount: 0, bondFlags: {}, claimedBonds: [],
  };
}

/**
 * First-bond-wins resolution. When a card lands on the field (or another
 * leaves), we re-evaluate which bonds are claimed:
 *
 *  1. Existing claims survive only if BOTH bonded cards are still present.
 *     If either has left the field, the claim releases and its cards
 *     become free to form new bonds.
 *  2. Already-claimed cards block any other bond they participate in
 *     from forming. Mom locked in Family Reunion with Dad → Generations
 *     stays dormant even if Abuela is also on the field. Family Reunion
 *     stays the link until Dad leaves.
 *  3. Newly eligible bonds (both cards present, neither claimed) compete
 *     by `amount` — higher amount wins the tie, so when all three Family
 *     creatures land at once, Generations (+2) beats Family Reunion (+1).
 *     Same-amount ties fall back to definition order.
 *
 * Both UI and effects read through `activeBonds(p)` which simply returns
 * the claimed list, so the visual link is always 1:1 with what's actually
 * firing. No more "two bonds active on the same card."
 */
export function recomputeBondClaims(p: PlayerState): void {
  const ids = new Set(p.field.map(c => c.id));
  // (1) Drop claims whose bonded cards are no longer both on the field.
  let claims = (p.claimedBonds ?? []).filter(bondId => {
    const b = BONDS.find(x => x.id === bondId);
    return !!b && ids.has(b.cardA) && ids.has(b.cardB);
  });

  // (2) Build the set of cards currently locked by surviving claims.
  const lockedCards = new Set<string>();
  for (const bondId of claims) {
    const b = BONDS.find(x => x.id === bondId)!;
    lockedCards.add(b.cardA);
    lockedCards.add(b.cardB);
  }

  // (3) Eligible new bonds: both cards on field, neither already locked,
  // bond not already claimed. Sort by amount desc so a tie of equally-
  // formed bonds resolves to the strongest one.
  const eligible = BONDS
    .filter(b =>
      ids.has(b.cardA) &&
      ids.has(b.cardB) &&
      !lockedCards.has(b.cardA) &&
      !lockedCards.has(b.cardB) &&
      !claims.includes(b.id)
    )
    .sort((x, y) => (y.effect.amount ?? 0) - (x.effect.amount ?? 0));

  // (4) Greedy claim — strongest first; once a bond claims its cards,
  // they're locked for the remainder of this pass.
  for (const b of eligible) {
    if (lockedCards.has(b.cardA) || lockedCards.has(b.cardB)) continue;
    claims.push(b.id);
    lockedCards.add(b.cardA);
    lockedCards.add(b.cardB);
  }

  p.claimedBonds = claims;
}

/** All bonds currently active on `p`'s side. With first-bond-wins this is
 *  exactly the claim list — no two active bonds can share a card, so both
 *  the UI badge and the engine effects see the same set. */
export function activeBonds(p: PlayerState): BondDef[] {
  const claims = p.claimedBonds ?? [];
  const out: BondDef[] = [];
  for (const id of claims) {
    const b = BONDS.find(x => x.id === id);
    if (b) out.push(b);
  }
  return out;
}

/** Returns true if `card` is one of the two creatures in any active bond
 *  whose effect is `kind`. Used by attack() for ATK / Rush / Taunt buffs. */
function cardHasBondKind(p: PlayerState, card: BattleCard, kind: BondDef['effect']['kind']): BondDef | null {
  for (const b of activeBonds(p)) {
    if (b.effect.kind !== kind) continue;
    if (card.id === b.cardA || card.id === b.cardB) return b;
  }
  return null;
}

/** Effective ATK for a creature in combat — includes pack_atk_rush bonus. */
function effectiveAtk(p: PlayerState, card: BattleCard): number {
  const bond = cardHasBondKind(p, card, 'pack_atk_rush');
  return card.currentAtk + (bond?.effect.amount ?? 0);
}

/** Whether `card` should count as Taunt right now. Either intrinsic taunt or
 *  granted by the House Pets bond. Frozen creatures lose Taunt for the
 *  duration of the freeze — they can't act, so they shouldn't redirect
 *  attacks either, and the on-card Taunt badge is already hidden while
 *  frozen so the engine state matches what the player sees. */
function effectiveTaunt(p: PlayerState, card: BattleCard): boolean {
  if (card.frozen) return false;
  if (card.abilityKind === 'taunt') return true;
  return cardHasBondKind(p, card, 'pair_taunt') !== null;
}

export function createMatch(
  playerCards: CollectionCard[],
  boss?: BossDef,
  difficulty: Difficulty = 'normal',
  rng: Rng = Math.random,
): MatchState {
  return assembleMatch(
    playerCards.filter(c => c.photo),
    buildOpponentDeck(boss, difficulty, rng),
    difficulty,
    rng,
    boss?.startingHp,
    boss?.firstPlayer,
    !!boss?.skipShuffle,
    boss?.turnLimit,
  );
}

/** Build a match from two raw CollectionCard decks. Used by the headless
 *  sim where both sides are AI-controlled and the opponent isn't a
 *  curated BossDef. Same shuffle + dealing logic as createMatch; the only
 *  thing skipped is buildOpponentDeck. */
export function createMatchFromDecks(
  deckA: CollectionCard[],
  deckB: CollectionCard[],
  difficulty: Difficulty = 'normal',
  rng: Rng = Math.random,
): MatchState {
  return assembleMatch(deckA, deckB, difficulty, rng);
}

function assembleMatch(
  playerCards: CollectionCard[],
  opponentCards: CollectionCard[],
  difficulty: Difficulty,
  rng: Rng,
  /** Optional override for the opponent's starting HP. Used by the
   *  tutorial boss so the match wraps up in 3-4 turns. Undefined for
   *  every other boss; they all keep the engine-wide STARTING_HP. */
  opponentStartingHp?: number,
  /** Optional first-player override. Skips the engine's 50/50 coin
   *  flip and forces this side to open. Used by the tutorial so the
   *  scripted hints always line up with the player's first turn. */
  forceFirst?: Owner,
  /** When true, both decks keep their input array order (no shuffle).
   *  Used by the tutorial so each step's hint refers to a specific
   *  card guaranteed to be in hand at that moment. */
  skipShuffle: boolean = false,
  /** Optional per-match turn-limit override (default is the global
   *  TURN_LIMIT). Stored on MatchState so the end-of-turn check can
   *  consult it. */
  turnLimit?: number,
): MatchState {
  const playerDeck = (skipShuffle ? playerCards : shuffle(playerCards, rng)).map(toBattleCard);
  let oppDeck = (skipShuffle ? opponentCards : shuffle(opponentCards, rng)).map(toBattleCard);

  // Keep the two decks the same length so neither side gets a draw advantage
  // over the course of a match.
  const matchSize = Math.min(playerDeck.length, oppDeck.length);
  if (playerDeck.length > matchSize) playerDeck.length = matchSize;
  if (oppDeck.length > matchSize) oppDeck = oppDeck.slice(0, matchSize);

  // Identical starting stats for both sides regardless of tier — the
  // difficulty curve lives entirely in the AI's decision-making (see
  // src/game/ai.ts → caps()), not in stat advantages. Same HP, same hand
  // size, same mana ramp. The boss just plays better.
  //
  // Exception: when assembleMatch receives an opponentStartingHp
  // override (today, only the tutorial Practice Dummy), the opponent
  // boots at that HP instead. Player HP is untouched — the tutorial
  // is meant to be winnable, not a coin-flip.
  const player = emptyPlayer();
  const opponent = emptyPlayer();
  if (opponentStartingHp !== undefined) opponent.hp = opponentStartingHp;

  // Initial draw — STARTING_HAND for both sides.
  for (let i = 0; i < STARTING_HAND && playerDeck.length; i++) {
    const c = playerDeck.shift()!;
    c.tapped = false;
    player.hand.push(c);
  }
  for (let i = 0; i < STARTING_HAND && oppDeck.length; i++) {
    const c = oppDeck.shift()!;
    c.tapped = false;
    opponent.hand.push(c);
  }

  player.deck = playerDeck;
  opponent.deck = oppDeck;

  // Coin flip — neither side has an inherent "I go first" advantage.
  // Exception: tutorial / fixture matches can force a specific opener
  // via forceFirst so scripted hint sequences line up.
  const first: Owner = forceFirst ?? (rng() < 0.5 ? 'player' : 'opponent');

  // Seed an in-state PRNG so in-engine randomness (pop_quiz discard,
  // recover_on_death spell pick) is deterministic when an rng was
  // injected. When rng === Math.random the seed is itself random and
  // play stays indistinguishable from the un-seeded version.
  const rngState = Math.floor(rng() * 0xFFFFFFFF) >>> 0;

  return {
    player,
    opponent,
    turn: first,
    turnNumber: 1,
    log: [`Match begins — ${first === 'player' ? 'you' : 'the boss'} go first`],
    outcome: 'ongoing',
    difficulty,
    turnLimit,
    rngState,
    turnStartedAt: Date.now(),
  };
}

function clone(state: MatchState): MatchState {
  // Deep clone — safe because all values are JSON-serializable except photo URLs (strings).
  return JSON.parse(JSON.stringify(state));
}

function side(state: MatchState, owner: Owner): PlayerState {
  return owner === 'player' ? state.player : state.opponent;
}

function opp(owner: Owner): Owner {
  return owner === 'player' ? 'opponent' : 'player';
}

function checkOutcome(state: MatchState) {
  if (state.player.hp <= 0 && state.opponent.hp <= 0) state.outcome = 'draw';
  else if (state.player.hp <= 0) state.outcome = 'loss';
  else if (state.opponent.hp <= 0) state.outcome = 'win';
}

/** Begin a turn for `owner`. Returns next state. */
export function beginTurn(prev: MatchState, owner: Owner): MatchState {
  const state = clone(prev);
  state.turn = owner;
  state.turnNumber += 1;
  state.turnStartedAt = Date.now();
  const me = side(state, owner);

  // Reset per-turn bond flags (e.g. First Class Window's "draw once per turn").
  me.bondFlags = {};
  // Reset the "attacked this turn" lock so the side can play creatures
  // and spells again until its first attack of the new turn.
  me.hasAttackedThisTurn = false;

  // Mana ramp
  me.maxMana = Math.min(MAX_MANA, me.maxMana + 1);
  me.mana = me.maxMana;
  // One-shot ramp from `mana_prep` creatures (Slow Cooker etc.). Adds to
  // THIS turn's spendable mana only — doesn't raise maxMana — so the
  // boost can't snowball across multiple turns. Cleared after applying.
  if (me.manaBonusNextTurn && me.manaBonusNextTurn > 0) {
    me.mana += me.manaBonusNextTurn;
    state.log.push(`${owner === 'player' ? 'You gain' : 'The Boss gains'} +${me.manaBonusNextTurn} mana this turn`);
    me.manaBonusNextTurn = 0;
  }

  // Untap, clear sickness. Frozen creatures stay frozen through their owner's
  // turn (so the snowflake is visible the whole time the freeze is "active");
  // the freeze actually wears off at the end of that turn. See endTurn below.
  // Safety net: if a freeze / silence somehow survived beyond its
  // frozenUntilTurn / silencedUntilTurn (set when the spell resolved),
  // force-clear it here so the lock can never last more than one full
  // owner-turn even if endTurn cleanup is skipped for any reason.
  me.field.forEach(c => {
    if (c.frozenUntilTurn != null && state.turnNumber >= c.frozenUntilTurn) {
      c.frozen = false;
      c.frozenUntilTurn = undefined;
    }
    if (c.silencedUntilTurn != null && state.turnNumber >= c.silencedUntilTurn && c.silenced) {
      c.abilityKind = c.originalAbilityKind ?? 'none';
      c.ability = c.originalAbility ?? '';
      c.silenced = false;
      c.silencedUntilTurn = undefined;
      c.originalAbilityKind = undefined;
      c.originalAbility = undefined;
    }
    if (c.frozen) {
      c.tapped = true; // can't act while frozen
    } else {
      c.tapped = false;
    }
    c.justPlayed = false;
  });

  // Spell-lock safety net — same +2 model as freeze/silence. If the
  // deadline has passed (e.g. multiple turns elapsed without endTurn
  // cleanup), force-clear so the lock can never outlast its turn.
  if (me.spellLockedUntilTurn != null && state.turnNumber >= me.spellLockedUntilTurn) {
    me.spellLockedUntilTurn = undefined;
  }

  // Heal-each-turn triggers. Skip when owner is already at max HP —
  // there's nothing to restore, and firing the ability would pop a
  // wasted reveal animation for "Library restores 1 HP" that did
  // nothing.
  me.field.forEach(c => {
    if (c.abilityKind !== 'heal_each_turn' || !c.abilityValue) return;
    if (me.hp >= STARTING_HP) return;
    me.hp = Math.min(STARTING_HP, me.hp + c.abilityValue);
    state.log.push(`${displayName(c)} heals ${owner === 'player' ? 'you' : 'The Boss'} for ${c.abilityValue}`);
  });

  // Bond: heal_face_per_turn (Family — Family Reunion)
  for (const b of activeBonds(me)) {
    if (b.effect.kind === 'heal_face_per_turn' && b.effect.amount) {
      const before = me.hp;
      me.hp = Math.min(STARTING_HP, me.hp + b.effect.amount);
      if (me.hp > before) {
        state.log.push(`Bond: ${b.name} heals ${owner === 'player' ? 'you' : 'The Boss'} for ${me.hp - before}`);
      }
    }
    // Bond: heal_creatures_per_turn (Food — Breakfast Combo)
    if (b.effect.kind === 'heal_creatures_per_turn' && b.effect.amount) {
      let totalHealed = 0;
      for (const c of me.field) {
        const before = c.currentHp;
        c.currentHp = Math.min(c.hp, c.currentHp + b.effect.amount);
        totalHealed += (c.currentHp - before);
      }
      if (totalHealed > 0) {
        state.log.push(`Bond: ${b.name} heals your creatures for ${totalHealed}`);
      }
    }
  }

  // Draw — escalating fatigue when the deck runs out, so games can't drag
  // forever even if both sides are healing. First fatigue = 1 dmg, second = 2,
  // third = 3, etc.
  if (me.deck.length > 0 && me.hand.length < MAX_HAND) {
    const c = me.deck.shift()!;
    c.tapped = false;
    me.hand.push(c);
  } else if (me.deck.length === 0) {
    me.fatigueCount += 1;
    me.hp -= me.fatigueCount;
    state.log.push(`${owner === 'player' ? 'You' : 'The Boss'} took ${me.fatigueCount} fatigue damage`);
  }

  // Turn-limit check — once the configured turn limit has been
  // played, whoever has more HP wins. Ties resolve as a loss so
  // aggressive play is rewarded. Tutorial matches use a higher
  // override (set on BossDef.turnLimit -> MatchState.turnLimit) so
  // the 19-step scripted lesson has room to finish.
  const effectiveTurnLimit = state.turnLimit ?? TURN_LIMIT;
  if (state.turnNumber > effectiveTurnLimit) {
    if (state.player.hp > state.opponent.hp) state.outcome = 'win';
    else if (state.player.hp === state.opponent.hp) state.outcome = 'draw';
    else state.outcome = 'loss';
    const label = state.outcome === 'win' ? 'you win' : state.outcome === 'draw' ? 'draw' : 'you lose';
    state.log.push(`Turn limit reached — ${label} (${state.player.hp} HP vs ${state.opponent.hp} HP)`);
    return state;
  }

  checkOutcome(state);
  return state;
}

export function endTurn(prev: MatchState): MatchState {
  // Wear off freeze + silence tokens on the active player's creatures at
  // the END of their turn so both icons stay visible the whole turn the
  // creature is locked. By the time the opponent's beginTurn fires the
  // status icons are gone and the original ability is restored.
  const cleared = clone(prev);
  const me = side(cleared, cleared.turn);
  const them = side(cleared, opp(cleared.turn));
  me.field.forEach(c => {
    if (c.frozen) {
      c.frozen = false;
      c.frozenUntilTurn = undefined;
    }
    // Education theme: per-turn growth. Fires at end of every owner
    // turn the creature is on the field — INCLUDING the turn it was
    // summoned, so the player sees the leveling effect right away
    // (waiting two full opponent turns to see any +1/+1 felt broken).
    // The creature still can't attack the turn it's played (summoning
    // sickness via `justPlayed` is enforced separately on the attack
    // path), it just gains its stat tick.
    //
    // CAPPED AT 3 LEVELS (max +3/+3). Without a cap, a Teacher
    // that survives mid-late game spirals into a 7/9 or worse, which
    // out-scales every other deck's creatures. With the cap, level_up
    // gives 3 turns of growth then plateaus — a clear ceiling — so
    // the opponent always knows what they're playing against. Study
    // Group bond doubles the tick (+2/+2 instead of +1/+1) which lets
    // it hit the cap faster, not exceed it. Graduate uses abilityValue
    // as the threshold turn for transformation; once graduated the
    // ability swaps to untargetable and level ticks stop naturally.
    //
    // ORDER MATTERS: we run the level-up check BEFORE the silence
    // wear-off below, so a silenced creature has abilityKind='none'
    // here and is naturally skipped. That's how Muzzle / Tough Love
    // suppress level_up for one turn. If you reorder this, silence
    // becomes a no-op against the Education deck.
    const LEVEL_CAP = 2;
    if ((c.abilityKind === 'level_up' || c.abilityKind === 'graduate') && (c.turnsAlive ?? 0) < LEVEL_CAP) {
      const doubled = activeBonds(me).some(b => b.effect.kind === 'level_up_doubled');
      const bump = doubled ? 2 : 1;
      c.turnsAlive = (c.turnsAlive ?? 0) + 1;
      c.currentAtk += bump;
      c.currentHp += bump;
      c.hp += bump;
      cleared.log.push(`${displayName(c)} levels up (+${bump}/+${bump})`);
      // Graduation transformation — one-shot, fires when turnsAlive
      // reaches the threshold stored in abilityValue. Adds a bonus
      // +2/+2 on top of the regular level-up tick AND swaps the
      // ability to Untargetable. Subsequent ticks won't apply more
      // level-ups because `graduate` has transitioned to 'untargetable'.
      const threshold = c.abilityValue ?? 3;
      if (c.abilityKind === 'graduate' && !c.graduated && (c.turnsAlive ?? 0) >= threshold) {
        c.graduated = true;
        c.currentAtk += 2;
        c.currentHp += 2;
        c.hp += 2;
        // Swap ability — they're now spell-proof for the rest of the
        // match. Stash original so silence still has something to
        // strip and restore (parallels existing silence bookkeeping).
        c.originalAbilityKind = c.abilityKind;
        c.originalAbility = c.ability;
        c.abilityKind = 'untargetable';
        c.ability = 'Graduated. Untargetable.';
        cleared.log.push(`${displayName(c)} graduates — +2/+2 and Untargetable`);
      }
    }
    // Wear off silence at end of the silenced creature's owner-turn.
    // Runs AFTER the level_up check above, so silence properly
    // suppresses the ability for the full silenced turn before
    // wearing off here.
    if (c.silenced) {
      c.abilityKind = c.originalAbilityKind ?? 'none';
      c.ability = c.originalAbility ?? '';
      c.silenced = false;
      c.silencedUntilTurn = undefined;
      c.originalAbilityKind = undefined;
      c.originalAbility = undefined;
    }
  });

  // Bond: damage_at_end_turn (Travel — The Long Way). Fires at the end of
  // the active player's turn against the enemy face. activeBonds
  // ensures we don't double-fire if two same-kind bonds were ever added.
  for (const b of activeBonds(me)) {
    if (b.effect.kind === 'damage_at_end_turn' && b.effect.amount) {
      them.hp -= b.effect.amount;
      cleared.log.push(`Bond: ${b.name} pings the boss for ${b.effect.amount}`);
    }
    // Family — The Kids: top off a low hand at end of turn so a control
    // family deck doesn't run dry.
    if (b.effect.kind === 'draw_at_end_if_low_hand') {
      if (me.hand.length < 3 && me.deck.length && me.hand.length < MAX_HAND) {
        const c = me.deck.shift()!;
        c.tapped = false;
        me.hand.push(c);
        cleared.log.push(`Bond: ${b.name} tops up your hand`);
      }
    }
  }
  // Spell-lock wears off at the end of the locked side's turn (parallels
  // freeze/silence wear-off above). After this, the next beginTurn for
  // the other side resets timers; the lock has done its single-turn job.
  if (me.spellLockedUntilTurn != null) {
    me.spellLockedUntilTurn = undefined;
  }

  checkOutcome(cleared);
  if (cleared.outcome !== 'ongoing') return cleared;

  return beginTurn(cleared, opp(cleared.turn));
}

interface PlayResult {
  state: MatchState;
  ok: boolean;
  reason?: string;
}

/**
 * Play a card from `owner`'s hand. For spells, `target` describes who to hit.
 * `target.kind = 'face'` hits the opposing player; `target.kind = 'creature'`
 * hits a battlefield creature by battleId; `target.kind = 'friendly'` for buffs.
 */
export type SpellTarget =
  | { kind: 'face'; owner: Owner }
  | { kind: 'creature'; owner: Owner; battleId: string };

/** Effective cost of a card given the player's currently active bonds.
 *  Spells get a discount from `spell_cost_reduction` bonds (e.g. Reporting
 *  Line). Floor of 1. */
export function effectiveCost(p: PlayerState, card: BattleCard): number {
  if (card.type !== 'Spell') return card.cost;
  let discount = 0;
  // Only one cost-reduction bond at a time (whichever discounts more).
  for (const b of activeBonds(p)) {
    if (b.effect.kind === 'spell_cost_reduction') discount += b.effect.amount ?? 0;
  }
  return Math.max(1, card.cost - discount);
}

export function playCard(prev: MatchState, owner: Owner, battleId: string, target?: SpellTarget): PlayResult {
  const state = clone(prev);
  const me = side(state, owner);
  const them = side(state, opp(owner));
  const idx = me.hand.findIndex(c => c.battleId === battleId);
  if (idx < 0) return { state: prev, ok: false, reason: 'Not in hand' };
  const card = me.hand[idx];
  const cost = effectiveCost(me, card);
  if (cost > me.mana) return { state: prev, ok: false, reason: 'Not enough mana' };
  // Spell-lock: All-Hands Meeting (wrk-18) bans the opposing side's
  // spells for one full owner-turn. Creatures still play normally.
  if (card.type === 'Spell' && me.spellLockedUntilTurn != null && state.turnNumber < me.spellLockedUntilTurn) {
    return { state: prev, ok: false, reason: 'Your spells are locked this turn' };
  }
  // Phase lock: once a side has attacked on its current turn it can't
  // play more cards. Mirrors the player's main → battle progression
  // for the AI so the boss can't interleave attacks and summons.
  if (me.hasAttackedThisTurn) return { state: prev, ok: false, reason: 'Battle phase — no more plays this turn' };

  if (card.type === 'Creature') {
    if (me.field.length >= MAX_FIELD) return { state: prev, ok: false, reason: 'Field is full' };
    me.mana -= cost;
    me.hand.splice(idx, 1);
    me.field.push(card);
    // Re-evaluate bond claims now that a new creature has landed — first-
    // bond-wins decides whether this summon completes a new bond, and
    // (for pack_atk_rush) whether this creature gets Rush from the bond.
    recomputeBondClaims(me);
    const packsRush = cardHasBondKind(me, card, 'pack_atk_rush') !== null;
    const hasRush = card.abilityKind === 'rush' || packsRush;
    card.justPlayed = !hasRush;
    card.tapped = !hasRush;
    state.log.push(`${owner === 'player' ? 'You' : 'The Boss'} summon ${displayName(card)}`);
    // The partner creature might also now gain Rush (it landed earlier and
    // is currently sleeping). Wake it up.
    if (packsRush) {
      me.field.forEach(c => {
        if (c.battleId !== card.battleId && cardHasBondKind(me, c, 'pack_atk_rush')) {
          if (c.justPlayed) { c.justPlayed = false; c.tapped = false; }
        }
      });
    }

    // On-play triggers
    resolveOnPlay(state, owner, card);
  } else {
    // Spell
    if (!isValidSpellTarget(state, owner, card, target)) {
      return { state: prev, ok: false, reason: 'Invalid target' };
    }
    me.mana -= cost;
    me.hand.splice(idx, 1);
    state.log.push(`${owner === 'player' ? 'You' : 'The Boss'} cast ${displayName(card)}`);
    resolveSpell(state, owner, card, target);
    // Spell goes to its caster's graveyard so the player can review it later.
    me.discard.push(card);

    // Spell-synergy creatures: deal X to opponent
    me.field.forEach(c => {
      if (c.abilityKind === 'spell_synergy' && c.abilityValue) {
        them.hp -= c.abilityValue;
        state.log.push(`${displayName(c)} pings for ${c.abilityValue}`);
      }
    });
  }

  checkOutcome(state);
  return { state, ok: true };
}

function isValidSpellTarget(state: MatchState, owner: Owner, card: BattleCard, target?: SpellTarget): boolean {
  // Spells that don't need a target
  const noTarget: AbilityKind[] = [
    'draw_on_play', 'spell_heal', 'spell_share_meal', 'spell_feast',
    'spell_both_draw', 'spell_buff_all', 'exam_pass', 'pop_quiz',
    'spell_lock', 'spell_luck',
  ];
  if (noTarget.includes(card.abilityKind)) return true;

  if (!target) return false;

  if (card.abilityKind === 'spell_damage') {
    // Damage spells only hit the OPPONENT side — their creatures or
    // their portrait. Casters can't damage their own board (no
    // self-damage strategies, and the visual highlight system already
    // matches this expectation). Untargetable enemy creatures stay
    // safe.
    if (target.owner === owner) return false;
    if (target.kind === 'creature') {
      const c = side(state, target.owner).field.find(x => x.battleId === target.battleId);
      if (!c) return false;
      if (c.abilityKind === 'untargetable') return false;
    }
    return true;
  }
  if (card.abilityKind === 'spell_freeze') {
    if (target.kind !== 'creature') return false;
    if (target.owner === owner) return false;
    const c = side(state, target.owner).field.find(x => x.battleId === target.battleId);
    return !!c && c.abilityKind !== 'untargetable';
  }
  if (card.abilityKind === 'spell_buff' || card.abilityKind === 'spell_buff_taunt') {
    // Theme-locked at common / rare — card text reads "Give a X-type
    // creature ..." and the engine enforces c.el === card.el so the
    // cheap spells stay honest. Epic and legendary buffs bypass the
    // theme check (mirrors the spell_buff_all on-play cross-theme
    // rule) — the premium-rarity tax is what lets cross-theme decks
    // (e.g. the couple memory pack) actually buff their mixed pieces.
    if (target.kind !== 'creature') return false;
    if (target.owner !== owner) return false;
    const c = side(state, owner).field.find(x => x.battleId === target.battleId);
    if (!c) return false;
    const crossTheme = card.rarity === 'epic' || card.rarity === 'legendary';
    return crossTheme || c.el === card.el;
  }
  if (card.abilityKind === 'spell_buff_any') {
    // Cross-theme flex buff — any friendly creature, no theme check.
    if (target.kind !== 'creature') return false;
    if (target.owner !== owner) return false;
    return !!side(state, owner).field.find(x => x.battleId === target.battleId);
  }
  if (card.abilityKind === 'spell_nourish' || card.abilityKind === 'spell_heal_friend') {
    // Friendly-creature targeting. Spell_heal_friend (Food — Sip)
    // restores current HP without raising max HP.
    if (target.kind !== 'creature') return false;
    if (target.owner !== owner) return false;
    return !!side(state, owner).field.find(x => x.battleId === target.battleId);
  }
  if (card.abilityKind === 'silence') {
    // Silence respects 'untargetable' — that ability is the creature's
    // protection from spells, and silence is a spell. If you want to
    // remove the ability, you need a way around the immunity first.
    if (target.kind !== 'creature') return false;
    if (target.owner === owner) return false;
    const c = side(state, target.owner).field.find(x => x.battleId === target.battleId);
    return !!c && c.abilityKind !== 'untargetable';
  }
  return false;
}

function resolveOnPlay(state: MatchState, owner: Owner, card: BattleCard) {
  const me = side(state, owner);
  const them = side(state, opp(owner));
  if (card.abilityKind === 'aoe_on_play' && card.abilityValue) {
    them.field.forEach(c => { c.currentHp -= card.abilityValue!; });
    cleanField(them, state);
    state.log.push(`${displayName(card)} blasts for ${card.abilityValue} to all`);
  } else if (card.abilityKind === 'draw_on_play' && card.abilityValue) {
    for (let i = 0; i < card.abilityValue; i++) {
      if (me.deck.length && me.hand.length < MAX_HAND) {
        const c = me.deck.shift()!;
        c.tapped = false;
        me.hand.push(c);
      }
    }
    state.log.push(`${displayName(card)} draws ${card.abilityValue}`);
  } else if (card.abilityKind === 'mana_prep') {
    // One-shot ramp — caches a +1 onto next turn. Stacks if multiple
    // `mana_prep` creatures are played in the same turn (rare; cost
    // makes it expensive to do).
    const amt = card.abilityValue ?? 1;
    me.manaBonusNextTurn = (me.manaBonusNextTurn ?? 0) + amt;
    state.log.push(`${displayName(card)} preps +${amt} mana for next turn`);
  } else if (card.abilityKind === 'spell_share_meal' && card.type === 'Creature') {
    // The Cook (Food creature) heals its own creatures on-play. Uses the
    // same kind as the spell variant — applying it via on-play instead
    // of a target keeps the ability table compact.
    const amt = card.abilityValue ?? 1;
    for (const c of me.field) {
      c.currentHp = Math.min(c.hp, c.currentHp + amt);
    }
    state.log.push(`${displayName(card)} feeds your creatures +${amt}`);
  } else if (card.abilityKind === 'spell_buff_all' && card.type === 'Creature') {
    // Graduation Day (legendary on-play variant) — at epic/legendary
    // rarity, the buff hits every friendly creature regardless of
    // theme; common/rare stays theme-locked so the cheap spells can't
    // double-dip across themes. The premium rarity discount is the
    // whole reason cross-theme decks (e.g. the couple memory pack)
    // can ever build to a board-wide finisher.
    const amt = card.abilityValue ?? 1;
    const crossTheme = card.rarity === 'epic' || card.rarity === 'legendary';
    for (const c of me.field) {
      if (crossTheme || c.el === card.el) {
        c.currentAtk += amt;
        c.currentHp += amt;
        c.hp += amt;
      }
    }
    state.log.push(`${displayName(card)} buffs your creatures +${amt}/+${amt}`);
  }
}

function resolveSpell(state: MatchState, owner: Owner, card: BattleCard, target?: SpellTarget) {
  const me = side(state, owner);
  const them = side(state, opp(owner));
  // Spell damage bonus from Top Brass (Senior Engineer + The Boss). One
  // bonus at a time — same-kind shadowing rule.
  let spellBonus = 0;
  for (const b of activeBonds(me)) {
    if (b.effect.kind === 'spell_damage_bonus') spellBonus += b.effect.amount ?? 0;
  }
  const v = card.abilityValue ?? 0;

  if (card.abilityKind === 'spell_damage' && target) {
    const dmg = v + spellBonus;
    if (target.kind === 'face') {
      const t = side(state, target.owner);
      t.hp -= dmg;
    } else {
      const t = side(state, target.owner);
      const c = t.field.find(x => x.battleId === target.battleId);
      if (c) {
        c.currentHp -= dmg;
        cleanField(t, state);
      }
    }
    // Special: Soul Drain heals owner 3 (the only spell with both effects in our pool)
    if (card.id === 'vo-06') {
      me.hp = Math.min(STARTING_HP, me.hp + 3);
    }
  } else if (card.abilityKind === 'spell_heal') {
    me.hp = Math.min(STARTING_HP, me.hp + v);
  } else if (card.abilityKind === 'spell_nourish' && target?.kind === 'creature') {
    // HP-only buff on a friendly creature. Doesn't raise ATK — Food's
    // identity is sustain, not power. Increases both currentHp and max
    // hp so the bonus persists through later damage / spell_buff.
    const t = side(state, target.owner);
    const c = t.field.find(x => x.battleId === target.battleId);
    if (c) {
      c.currentHp += v;
      c.hp += v;
    }
  } else if (card.abilityKind === 'spell_share_meal') {
    // Board-wide creature heal. Only owner's creatures, capped at their
    // max hp. Theme-locked at every rarity — same-theme creatures only.
    for (const c of me.field) {
      if (c.el === card.el) {
        c.currentHp = Math.min(c.hp, c.currentHp + v);
      }
    }
    state.log.push(`${displayName(card)} feeds your creatures +${v}`);
  } else if (card.abilityKind === 'spell_feast') {
    // The deck's late-game stabilizer. Heals owner's face by `abilityValue`
    // and creatures by half of that (rounded down). Single number on the
    // template keeps the data simple.
    me.hp = Math.min(STARTING_HP, me.hp + v);
    const creatureHeal = Math.max(1, Math.floor(v / 2));
    for (const c of me.field) {
      c.currentHp = Math.min(c.hp, c.currentHp + creatureHeal);
    }
    state.log.push(`${displayName(card)} restores ${v} HP and feeds your creatures +${creatureHeal}`);
  } else if (card.abilityKind === 'spell_heal_friend' && target?.kind === 'creature') {
    // Food — Sip: restore CURRENT HP on a friendly creature, capped at
    // its max hp. Doesn't raise max (that's spell_nourish).
    const t = side(state, target.owner);
    const c = t.field.find(x => x.battleId === target.battleId);
    if (c) c.currentHp = Math.min(c.hp, c.currentHp + v);
  } else if (card.abilityKind === 'spell_both_draw') {
    // Work — Stand-up Meeting: both players draw 1. Neutral cycle.
    for (const p of [me, them]) {
      if (p.deck.length && p.hand.length < MAX_HAND) {
        const c = p.deck.shift()!;
        c.tapped = false;
        p.hand.push(c);
      }
    }
    state.log.push(`${displayName(card)} — both players draw`);
  } else if (card.abilityKind === 'spell_buff_all') {
    // Payroll / Group Project / Family Photo / etc: +V/+V to friendly
    // creatures. Common/rare stays theme-locked. Epic and legendary
    // bypass the theme lock so they can act as cross-theme finishers
    // in hybrid decks (e.g. the couple memory pack) — the rarity gate
    // keeps cheap spells from swinging mixed boards too aggressively.
    const crossTheme = card.rarity === 'epic' || card.rarity === 'legendary';
    for (const c of me.field) {
      if (crossTheme || c.el === card.el) {
        c.currentAtk += v;
        c.currentHp += v;
        c.hp += v;
      }
    }
    state.log.push(`${displayName(card)} buffs your creatures +${v}/+${v}`);
  } else if (card.abilityKind === 'exam_pass') {
    // Education — Final Exam: conditional payoff based on board state.
    // Reward keeping a board (3+ creatures) with damage; otherwise
    // get a smaller heal as a consolation. Encourages playing on
    // curve rather than holding the spell for raw burn.
    if (me.field.length >= 3) {
      them.hp -= v;
      state.log.push(`${displayName(card)} aces the exam — ${v} to enemy face`);
    } else {
      me.hp = Math.min(STARTING_HP, me.hp + v);
      state.log.push(`${displayName(card)} settles for partial credit — heal ${v}`);
    }
  } else if (card.abilityKind === 'pop_quiz') {
    // Education — Pop Quiz: discard a random card from hand, draw 2.
    // Net +1 card with a random downside. Don't include the spell
    // itself in the discard pool (it's already leaving hand via the
    // normal spell resolution path).
    if (me.hand.length > 0) {
      const idx = Math.floor(nextRand(state) * me.hand.length);
      const [discarded] = me.hand.splice(idx, 1);
      me.discard.push(discarded);
      state.log.push(`${displayName(card)} discards ${displayName(discarded)}`);
    }
    for (let i = 0; i < 2; i++) {
      if (me.deck.length && me.hand.length < MAX_HAND) {
        const c = me.deck.shift()!;
        c.tapped = false;
        me.hand.push(c);
      }
    }
  } else if (card.abilityKind === 'spell_freeze' && target?.kind === 'creature') {
    const t = side(state, target.owner);
    const c = t.field.find(x => x.battleId === target.battleId);
    if (c) {
      c.frozen = true;
      // Hard cap: by the time we reach this turn number the freeze MUST
      // be gone, no matter what. The normal cleanup happens in endTurn
      // when the owner's turn ends; this is the safety net.
      c.frozenUntilTurn = state.turnNumber + 2;
    }
  } else if ((card.abilityKind === 'spell_buff' || card.abilityKind === 'spell_buff_any') && target?.kind === 'creature') {
    // Validity (target exists, same theme for spell_buff, etc.) was
    // already checked in isValidSpellTarget at the playCard gate; by
    // the time we get here the target is legal. Apply the buff.
    const t = side(state, target.owner);
    const c = t.field.find(x => x.battleId === target.battleId);
    if (c) {
      c.currentAtk += v;
      c.currentHp += v;
      c.hp += v;
    }
  } else if (card.abilityKind === 'spell_buff_taunt' && target?.kind === 'creature') {
    // Proposal-style: +V/+V AND grant Taunt to a same-theme friendly
    // creature (theme-lock enforced upstream in isValidSpellTarget).
    // Taunt sticks permanently — overwrites the creature's current
    // abilityKind. originalAbilityKind / originalAbility get stashed
    // so a later silence can still revert it.
    const t = side(state, target.owner);
    const c = t.field.find(x => x.battleId === target.battleId);
    if (c) {
      c.currentAtk += v;
      c.currentHp += v;
      c.hp += v;
      if (c.abilityKind !== 'taunt') {
        c.originalAbilityKind = c.abilityKind;
        c.originalAbility = c.ability;
        c.abilityKind = 'taunt';
        c.ability = 'Taunt.';
      }
    }
  } else if (card.abilityKind === 'silence' && target?.kind === 'creature') {
    // Strip the target's ability for ONE turn — until the silenced
    // creature's next begin-turn. Cast silence on a taunt to swing
    // through; cast on heal_each_turn to skip one heal; cast on bonded
    // to break the bond effect for the rest of YOUR turn. We stash the
    // original abilityKind / ability text so beginTurn restores them
    // when the lock wears off.
    const t = side(state, target.owner);
    const c = t.field.find(x => x.battleId === target.battleId);
    if (c) {
      c.originalAbilityKind = c.abilityKind;
      c.originalAbility = c.ability;
      c.abilityKind = 'none';
      c.ability = '';
      c.silenced = true;
      // Persist the silence through the SILENCED creature's full next
      // owner-turn. silencedUntilTurn = N+2 means: cast at boss turn N,
      // safety net on player turn N+1 sees N+1 < N+2 (silence stays),
      // player ends turn N+1 — endTurn skips level_up (gated on
      // !silenced) and then restores the ability. So silence
      // suppresses the target's level_up / heal_each_turn / etc. for
      // exactly one of their turns, which is what "Muzzle disables
      // Teacher for 1 turn" should mean.
      c.silencedUntilTurn = state.turnNumber + 2;
    }
  } else if (card.abilityKind === 'draw_on_play') {
    // Reflecting Pool (a draw "spell") — reuse logic
    for (let i = 0; i < v; i++) {
      if (me.deck.length && me.hand.length < MAX_HAND) {
        const c = me.deck.shift()!;
        c.tapped = false;
        me.hand.push(c);
      }
    }
  } else if (card.abilityKind === 'spell_lock') {
    // All-Hands Meeting — opposing side can't cast spells next turn.
    // Use the same +2 timing as freeze/silence: cast on turn N, the
    // opposing side's turn N+1 beginTurn sees N+1 < N+2 (still locked),
    // and the ban lifts at their endTurn. Doesn't stack — re-casting
    // just resets the deadline.
    them.spellLockedUntilTurn = state.turnNumber + 2;
    state.log.push(`${displayName(card)} — opponent's spells are locked next turn`);
  } else if (card.abilityKind === 'spell_luck') {
    // Where to Travel? — roll a d6 against the in-state PRNG so the
    // outcome is deterministic per seed. Five favorable destinations,
    // one bad (Flight Canceled). Buff outcomes pick the strongest
    // friendly creature (a real player would do that); if the board
    // is empty they fizzle but the spell still resolves (mana spent).
    const roll = Math.floor(nextRand(state) * 6) + 1;
    const strongestFriendly = (): BattleCard | null => {
      if (me.field.length === 0) return null;
      return me.field.slice().sort((a, b) => (b.currentAtk + b.currentHp) - (a.currentAtk + a.currentHp))[0];
    };
    if (roll === 1) {
      // Europe — heal owner +5
      const before = me.hp;
      me.hp = Math.min(STARTING_HP, me.hp + 5);
      state.log.push(`Rolled 1 — Europe: restore ${me.hp - before} HP`);
    } else if (roll === 2) {
      // South America — strongest friendly creature +2/+0
      const tgt = strongestFriendly();
      if (tgt) {
        tgt.currentAtk += 2;
        state.log.push(`Rolled 2 — South America: ${displayName(tgt)} gains +2/+0`);
      } else {
        state.log.push(`Rolled 2 — South America: no creature to buff`);
      }
    } else if (roll === 3) {
      // North America — strongest friendly creature +0/+3
      const tgt = strongestFriendly();
      if (tgt) {
        tgt.currentHp += 3;
        tgt.hp += 3;
        state.log.push(`Rolled 3 — North America: ${displayName(tgt)} gains +0/+3`);
      } else {
        state.log.push(`Rolled 3 — North America: no creature to buff`);
      }
    } else if (roll === 4) {
      // Asia — +2 mana this turn only (doesn't raise maxMana)
      me.mana += 2;
      state.log.push(`Rolled 4 — Asia: +2 mana this turn`);
    } else if (roll === 5) {
      // Africa — 5 face damage to opponent
      them.hp -= 5;
      state.log.push(`Rolled 5 — Africa: deal 5 damage`);
    } else {
      // 6 — Flight canceled: 2 self damage
      me.hp -= 2;
      state.log.push(`Rolled 6 — Flight canceled: take 2 damage`);
    }
  }

  // Hide the unused `them` lint
  void them;
}

function cleanField(p: PlayerState, state: MatchState) {
  // Move dead creatures into the graveyard instead of dropping them on the
  // floor. The player can review what was killed via the graveyard button.
  const dead = p.field.filter(c => c.currentHp <= 0);
  // `recover_on_death` (Food theme): when a creature with this ability
  // dies, pull a random Spell out of the existing discard back into the
  // owner's hand BEFORE the creature itself joins the pile (so it can't
  // recover itself). One Spell per death; if the discard has no spells,
  // nothing happens. The dying creature still goes to the graveyard
  // normally — the recovery is value on top, not a substitute.
  for (const c of dead) {
    if (c.abilityKind !== 'recover_on_death') continue;
    if (p.hand.length >= MAX_HAND) continue;
    const spellIdxs: number[] = [];
    for (let i = 0; i < p.discard.length; i++) {
      if (p.discard[i].type === 'Spell') spellIdxs.push(i);
    }
    if (!spellIdxs.length) continue;
    const pickIdx = spellIdxs[Math.floor(nextRand(state) * spellIdxs.length)];
    const [recovered] = p.discard.splice(pickIdx, 1);
    recovered.tapped = false;
    p.hand.push(recovered);
  }
  if (dead.length) p.discard.push(...dead);
  p.field = p.field.filter(c => c.currentHp > 0);
  // Deaths can release bond claims (Mom locked with Dad → Dad dies → Mom
  // is freed → Generations re-evaluates if Abuela is alive). Recomputing
  // here keeps the engine state and UI in sync without the caller having
  // to remember to do it after every kill.
  recomputeBondClaims(p);
}

interface AttackResult {
  state: MatchState;
  ok: boolean;
  reason?: string;
}

/**
 * `attackerId` is the battleId of the attacking creature.
 * `target.kind = 'face'` for face damage; `target.kind = 'creature'` for trade.
 */
export type AttackTarget =
  | { kind: 'face' }
  | { kind: 'creature'; battleId: string };

export function attack(prev: MatchState, owner: Owner, attackerId: string, target: AttackTarget): AttackResult {
  const state = clone(prev);
  const me = side(state, owner);
  const them = side(state, opp(owner));
  const attacker = me.field.find(c => c.battleId === attackerId);
  if (!attacker) return { state: prev, ok: false, reason: 'No attacker' };
  if (attacker.tapped || attacker.justPlayed) return { state: prev, ok: false, reason: 'Cannot attack yet' };

  // Taunt rule: intrinsic Taunt + House Pets bond Taunt both count.
  const taunters = them.field.filter(c => effectiveTaunt(them, c));
  if (target.kind === 'face' && taunters.length > 0) {
    return { state: prev, ok: false, reason: 'Must attack taunt first' };
  }
  if (target.kind === 'creature' && taunters.length > 0) {
    const targetCreature = them.field.find(c => c.battleId === target.battleId);
    if (targetCreature && !effectiveTaunt(them, targetCreature)) {
      return { state: prev, ok: false, reason: 'Must attack taunt first' };
    }
  }

  // Pack bond: attacker's effective ATK gets a +N bonus while both bonded
  // creatures are on the field. Defender's counter uses *their* effective
  // ATK (also potentially bond-boosted on the opposing side).
  const atkValue = effectiveAtk(me, attacker);

  // Either branch below taps the attacker and marks the side as
  // having attacked — once set, playCard refuses further plays this
  // turn. Same lock applies to both player and AI.
  me.hasAttackedThisTurn = true;
  if (target.kind === 'face') {
    them.hp -= atkValue;
    state.log.push(`${displayName(attacker)} hits face for ${atkValue}`);
    attacker.tapped = true;
  } else {
    const defender = them.field.find(c => c.battleId === target.battleId);
    if (!defender) return { state: prev, ok: false, reason: 'No defender' };
    const defValue = effectiveAtk(them, defender);
    defender.currentHp -= atkValue;
    attacker.currentHp -= defValue;
    state.log.push(`${displayName(attacker)} ⚔ ${displayName(defender)}`);
    attacker.tapped = true;
    cleanField(me, state);
    cleanField(them, state);
  }

  // Bond: First Class Window — when a bonded creature attacks, draw 1
  // (once per turn).
  for (const b of activeBonds(me)) {
    if (b.effect.kind !== 'draw_on_attack') continue;
    if (attacker.id !== b.cardA && attacker.id !== b.cardB) continue;
    me.bondFlags = me.bondFlags ?? {};
    if (me.bondFlags[b.id]) break;
    me.bondFlags[b.id] = true;
    if (me.deck.length && me.hand.length < MAX_HAND) {
      const c = me.deck.shift()!;
      c.tapped = false;
      me.hand.push(c);
      state.log.push(`Bond: ${b.name} draws a card`);
    }
    break;
  }

  checkOutcome(state);
  return { state, ok: true };
}

export function displayName(c: BattleCard): string {
  // Card titles always show the underlying template name now — the
  // legacy nickname is migrated away and never read.
  return c.name;
}

/** Helpers for the AI / UI to ask if any of my creatures can act. */
export function readyAttackers(p: PlayerState): BattleCard[] {
  return p.field.filter(c => !c.tapped && !c.justPlayed && c.currentAtk > 0);
}

/** Convert a CardTemplate into a BattleCard (used to pre-populate AI deck etc). */
export function templateToBattleCard(t: CardTemplate, photo?: string | null, nickname?: string): BattleCard {
  return toBattleCard({ ...t, uid: `tpl_${t.id}_${Date.now()}_${Math.random()}`, photo: photo ?? null, nickname });
}
