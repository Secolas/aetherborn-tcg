import { TEMPLATES, getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import type { BossDef } from '../data/bosses';
import type {
  BattleCard, CollectionCard, MatchState, Owner, PlayerState, CardTemplate, AbilityKind,
} from './types';

export const STARTING_HP = 24;
export const STARTING_HAND = 4;
export const MAX_MANA = 10;
export const MAX_FIELD = 6;
export const MAX_HAND = 7;

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
  return { hp: STARTING_HP, mana: 1, maxMana: 1, hand: [], field: [], deck: [], discard: [] };
}

export function createMatch(playerCards: CollectionCard[], boss?: BossDef): MatchState {
  const playerDeck = shuffle(playerCards.filter(c => c.photo)).map(toBattleCard);
  const oppDeck = shuffle(buildOpponentDeck(boss)).map(toBattleCard);

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

  // Player goes first; their turn starts immediately so they can act with mana=1.
  return {
    player,
    opponent,
    turn: 'player',
    turnNumber: 1,
    log: ['Match begins'],
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

  // Mana ramp
  me.maxMana = Math.min(MAX_MANA, me.maxMana + 1);
  me.mana = me.maxMana;

  // Untap, clear sickness
  me.field.forEach(c => {
    if (c.frozen) {
      c.frozen = false;
      c.tapped = true; // stay tapped this turn
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

  // Draw
  if (me.deck.length > 0 && me.hand.length < MAX_HAND) {
    const c = me.deck.shift()!;
    c.tapped = false;
    me.hand.push(c);
  } else if (me.deck.length === 0) {
    me.hp -= 1;
    state.log.push(`${owner === 'player' ? 'You' : 'The Boss'} took 1 fatigue damage`);
  }

  checkOutcome(state);
  return state;
}

export function endTurn(prev: MatchState): MatchState {
  const next = beginTurn(prev, opp(prev.turn));
  return next;
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

export function playCard(prev: MatchState, owner: Owner, battleId: string, target?: SpellTarget): PlayResult {
  const state = clone(prev);
  const me = side(state, owner);
  const them = side(state, opp(owner));
  const idx = me.hand.findIndex(c => c.battleId === battleId);
  if (idx < 0) return { state: prev, ok: false, reason: 'Not in hand' };
  const card = me.hand[idx];
  if (card.cost > me.mana) return { state: prev, ok: false, reason: 'Not enough mana' };

  if (card.type === 'Creature') {
    if (me.field.length >= MAX_FIELD) return { state: prev, ok: false, reason: 'Field is full' };
    me.mana -= card.cost;
    me.hand.splice(idx, 1);
    card.justPlayed = card.abilityKind !== 'rush';
    card.tapped = card.abilityKind !== 'rush'; // rush creatures can attack
    me.field.push(card);
    state.log.push(`${owner === 'player' ? 'You' : 'The Boss'} summon ${displayName(card)}`);

    // On-play triggers
    resolveOnPlay(state, owner, card);
  } else {
    // Spell
    if (!isValidSpellTarget(state, owner, card, target)) {
      return { state: prev, ok: false, reason: 'Invalid target' };
    }
    me.mana -= card.cost;
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
  const v = card.abilityValue ?? 0;

  if (card.abilityKind === 'spell_damage' && target) {
    if (target.kind === 'face') {
      const t = side(state, target.owner);
      t.hp -= v;
    } else {
      const t = side(state, target.owner);
      const c = t.field.find(x => x.battleId === target.battleId);
      if (c) {
        c.currentHp -= v;
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
    if (c) c.frozen = true;
  } else if (card.abilityKind === 'spell_buff' && target?.kind === 'creature') {
    const t = side(state, target.owner);
    const c = t.field.find(x => x.battleId === target.battleId);
    if (c) {
      c.currentAtk += v;
      c.currentHp += v;
      c.hp += v;
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

  // Taunt rule: if any taunters on enemy, must attack one of them
  const taunters = them.field.filter(c => c.abilityKind === 'taunt');
  if (target.kind === 'face' && taunters.length > 0) {
    return { state: prev, ok: false, reason: 'Must attack taunt first' };
  }
  if (target.kind === 'creature' && taunters.length > 0) {
    const targetCreature = them.field.find(c => c.battleId === target.battleId);
    if (targetCreature && targetCreature.abilityKind !== 'taunt') {
      return { state: prev, ok: false, reason: 'Must attack taunt first' };
    }
  }

  if (target.kind === 'face') {
    them.hp -= attacker.currentAtk;
    state.log.push(`${displayName(attacker)} hits face for ${attacker.currentAtk}`);
    attacker.tapped = true;
  } else {
    const defender = them.field.find(c => c.battleId === target.battleId);
    if (!defender) return { state: prev, ok: false, reason: 'No defender' };
    defender.currentHp -= attacker.currentAtk;
    attacker.currentHp -= defender.currentAtk;
    state.log.push(`${displayName(attacker)} ⚔ ${displayName(defender)}`);
    attacker.tapped = true;
    cleanField(me);
    cleanField(them);
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
