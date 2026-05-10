import { TEMPLATES, getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { BONDS, type BondDef } from './../data/bonds';
import type { BossDef } from '../data/bosses';
import type {
  BattleCard, CollectionCard, MatchState, Owner, PlayerState, CardTemplate, AbilityKind,
} from './types';

export const STARTING_HP = 20;
export const STARTING_HAND = 4;
export const MAX_MANA = 7;
export const MAX_FIELD = 3;
export const MAX_HAND = 7;
/** Hard cap on total turns. If both players are still alive when turn 15
    ends, whoever has more HP wins; ties resolve as a player loss so
    aggressive play is rewarded over heal-stalling. */
export const TURN_LIMIT = 15;

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
  };
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
function buildOpponentDeck(boss?: BossDef): CollectionCard[] {
  if (boss) {
    const out: CollectionCard[] = [];
    boss.deck.forEach((tid, i) => {
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
  const base = shuffle(pool);
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
 *     from forming. Mom locked in Sunday Dinner with Dad → Generations
 *     stays dormant even if Abuela is also on the field. Sunday Dinner
 *     stays the link until Dad leaves.
 *  3. Newly eligible bonds (both cards present, neither claimed) compete
 *     by `amount` — higher amount wins the tie, so when all three Family
 *     creatures land at once, Generations (+2) beats Sunday Dinner (+1).
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

export function createMatch(playerCards: CollectionCard[], boss?: BossDef): MatchState {
  const playerDeck = shuffle(playerCards.filter(c => c.photo)).map(toBattleCard);
  let oppDeck = shuffle(buildOpponentDeck(boss)).map(toBattleCard);

  // Keep the two decks the same length so neither side gets a draw advantage
  // over the course of a match. If the player's collection is short, trim
  // the boss's deck to match; if the player has more, trim theirs down to
  // the boss's count.
  const matchSize = Math.min(playerDeck.length, oppDeck.length);
  if (playerDeck.length > matchSize) playerDeck.length = matchSize;
  if (oppDeck.length > matchSize) oppDeck = oppDeck.slice(0, matchSize);

  const player = emptyPlayer();
  const opponent = emptyPlayer();

  // Initial draw
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
  const first: Owner = Math.random() < 0.5 ? 'player' : 'opponent';

  return {
    player,
    opponent,
    turn: first,
    turnNumber: 1,
    log: [`Match begins — ${first === 'player' ? 'you' : 'the boss'} go first`],
    outcome: 'ongoing',
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
  if (state.player.hp <= 0 && state.opponent.hp <= 0) state.outcome = 'loss'; // tie → loss
  else if (state.player.hp <= 0) state.outcome = 'loss';
  else if (state.opponent.hp <= 0) state.outcome = 'win';
}

/** Begin a turn for `owner`. Returns next state. */
export function beginTurn(prev: MatchState, owner: Owner): MatchState {
  const state = clone(prev);
  state.turn = owner;
  state.turnNumber += 1;
  const me = side(state, owner);

  // Reset per-turn bond flags (e.g. First Class Window's "draw once per turn").
  me.bondFlags = {};

  // Mana ramp
  me.maxMana = Math.min(MAX_MANA, me.maxMana + 1);
  me.mana = me.maxMana;

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

  // Heal-each-turn triggers
  me.field.forEach(c => {
    if (c.abilityKind === 'heal_each_turn' && c.abilityValue) {
      me.hp = Math.min(STARTING_HP, me.hp + c.abilityValue);
      state.log.push(`${displayName(c)} heals ${owner === 'player' ? 'you' : 'The Boss'} for ${c.abilityValue}`);
    }
  });

  // Bond: heal_face_per_turn (Family — Sunday Dinner)
  for (const b of activeBonds(me)) {
    if (b.effect.kind === 'heal_face_per_turn' && b.effect.amount) {
      const before = me.hp;
      me.hp = Math.min(STARTING_HP, me.hp + b.effect.amount);
      if (me.hp > before) {
        state.log.push(`Bond: ${b.name} heals ${owner === 'player' ? 'you' : 'The Boss'} for ${me.hp - before}`);
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

  // Turn-limit check — once turn 15 has been played, whoever has more HP
  // wins. Ties resolve as a loss so aggressive play is rewarded.
  if (state.turnNumber > TURN_LIMIT) {
    state.outcome = state.player.hp > state.opponent.hp ? 'win' : 'loss';
    state.log.push(`Turn limit reached — ${state.outcome === 'win' ? 'you win' : 'you lose'} on HP`);
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
  const noTarget: AbilityKind[] = ['draw_on_play', 'spell_heal'];
  if (noTarget.includes(card.abilityKind)) return true;

  if (!target) return false;

  if (card.abilityKind === 'spell_damage') {
    // Can hit anything (face or creature). Can't target untargetable creatures.
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
  if (card.abilityKind === 'spell_buff') {
    if (target.kind !== 'creature') return false;
    if (target.owner !== owner) return false;
    return !!side(state, owner).field.find(x => x.battleId === target.battleId);
  }
  if (card.abilityKind === 'silence') {
    // Silence bypasses 'untargetable' on purpose — that's its job.
    if (target.kind !== 'creature') return false;
    if (target.owner === owner) return false;
    return !!side(state, target.owner).field.find(x => x.battleId === target.battleId);
  }
  return false;
}

function resolveOnPlay(state: MatchState, owner: Owner, card: BattleCard) {
  const me = side(state, owner);
  const them = side(state, opp(owner));
  if (card.abilityKind === 'aoe_on_play' && card.abilityValue) {
    them.field.forEach(c => { c.currentHp -= card.abilityValue!; });
    cleanField(them);
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
        cleanField(t);
      }
    }
    // Special: Soul Drain heals owner 3 (the only spell with both effects in our pool)
    if (card.id === 'vo-06') {
      me.hp = Math.min(STARTING_HP, me.hp + 3);
    }
  } else if (card.abilityKind === 'spell_heal') {
    me.hp = Math.min(STARTING_HP, me.hp + v);
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
  } else if (card.abilityKind === 'spell_buff' && target?.kind === 'creature') {
    const t = side(state, target.owner);
    const c = t.field.find(x => x.battleId === target.battleId);
    if (c) {
      c.currentAtk += v;
      c.currentHp += v;
      c.hp += v;
    }
  } else if (card.abilityKind === 'silence' && target?.kind === 'creature') {
    // Strip the target's ability for one turn — taunt creatures lose the
    // redirect, untargetable creatures become spell-targetable, etc. We
    // stash the original abilityKind / ability text so endTurn can restore
    // them when the silence wears off (parallels freeze: a single-turn lock).
    const t = side(state, target.owner);
    const c = t.field.find(x => x.battleId === target.battleId);
    if (c) {
      c.originalAbilityKind = c.abilityKind;
      c.originalAbility = c.ability;
      c.abilityKind = 'none';
      c.ability = '';
      c.silenced = true;
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
  }

  // Hide the unused `them` lint
  void them;
}

function cleanField(p: PlayerState) {
  // Move dead creatures into the graveyard instead of dropping them on the
  // floor. The player can review what was killed via the graveyard button.
  const dead = p.field.filter(c => c.currentHp <= 0);
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
    cleanField(me);
    cleanField(them);
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
  return c.nickname || c.name;
}

/** Helpers for the AI / UI to ask if any of my creatures can act. */
export function readyAttackers(p: PlayerState): BattleCard[] {
  return p.field.filter(c => !c.tapped && !c.justPlayed && c.currentAtk > 0);
}

/** Convert a CardTemplate into a BattleCard (used to pre-populate AI deck etc). */
export function templateToBattleCard(t: CardTemplate, photo?: string | null, nickname?: string): BattleCard {
  return toBattleCard({ ...t, uid: `tpl_${t.id}_${Date.now()}_${Math.random()}`, photo: photo ?? null, nickname });
}
