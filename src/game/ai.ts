import {
  attack, playCard, readyAttackers, displayName,
  type AttackTarget, type SpellTarget,
} from './match';
import type { BattleCard, MatchState, Owner } from './types';

/** Combat info reported by the AI so the UI can animate the right cards. */
export type AiCombat = {
  attackerId: string;
  attackerOwner: Owner;
  defenderKind: 'face' | 'creature';
  defenderId?: string;       // when defenderKind === 'creature'
  defenderOwner: Owner;
  damageToDef: number;
  damageToAtk: number;
};

export type AiStepResult = {
  next: MatchState;
  action: string;
  combat?: AiCombat;
};

/**
 * One AI step. Returns the next state plus a brief description of what it did,
 * or null when the AI is done with its turn.
 *
 * If the step was an attack, `combat` is populated so the UI can play the
 * lunge + damage popup animations on the right creatures.
 */
export function aiStep(state: MatchState): AiStepResult | null {
  if (state.outcome !== 'ongoing') return null;
  if (state.turn !== 'opponent') return null;

  const me = state.opponent;
  const them = state.player;

  // 1. Lethal check
  const lethal = findLethal(state);
  if (lethal) return lethal;

  // 2. Play the best card we can afford
  const playable = me.hand
    .filter(c => c.cost <= me.mana)
    .sort((a, b) => scoreCard(b, state) - scoreCard(a, state));

  for (const card of playable) {
    const result = tryPlay(state, card);
    if (result) return result;
  }

  // 3. Attack
  const attackers = readyAttackers(me);
  for (const a of attackers) {
    const target = chooseAttackTarget(a, state);
    if (target) {
      const r = attack(state, 'opponent', a.battleId, target);
      if (r.ok) {
        const defender = target.kind === 'creature'
          ? them.field.find(x => x.battleId === target.battleId)
          : null;
        const desc = target.kind === 'face'
          ? `${displayName(a)} attacks you for ${a.currentAtk}`
          : `${displayName(a)} attacks ${defender ? displayName(defender) : '?'}`;
        return {
          next: r.state,
          action: desc,
          combat: {
            attackerId: a.battleId,
            attackerOwner: 'opponent',
            defenderKind: target.kind,
            defenderId: target.kind === 'creature' ? target.battleId : undefined,
            defenderOwner: 'player',
            damageToDef: a.currentAtk,
            damageToAtk: target.kind === 'creature' ? (defender?.currentAtk ?? 0) : 0,
          },
        };
      }
    }
  }

  return null;
}

function findLethal(state: MatchState): AiStepResult | null {
  const me = state.opponent;
  const them = state.player;
  const taunters = them.field.filter(c => c.abilityKind === 'taunt');
  if (taunters.length > 0) return null;

  const ready = readyAttackers(me);
  const totalAtk = ready.reduce((sum, c) => sum + c.currentAtk, 0);
  if (totalAtk >= them.hp && ready.length > 0) {
    const a = ready[0];
    const r = attack(state, 'opponent', a.battleId, { kind: 'face' });
    if (r.ok) {
      return {
        next: r.state,
        action: `${displayName(a)} pushes for ${a.currentAtk}`,
        combat: {
          attackerId: a.battleId,
          attackerOwner: 'opponent',
          defenderKind: 'face',
          defenderOwner: 'player',
          damageToDef: a.currentAtk,
          damageToAtk: 0,
        },
      };
    }
  }
  return null;
}

function tryPlay(state: MatchState, card: BattleCard): AiStepResult | null {
  if (card.type === 'Creature') {
    if (state.opponent.field.length >= 6) return null;
    const r = playCard(state, 'opponent', card.battleId);
    if (r.ok) return { next: r.state, action: `Vex summons ${displayName(card)}` };
    return null;
  }

  const target = chooseSpellTarget(card, state);
  if (target === undefined || target === null) return null;
  const r = playCard(state, 'opponent', card.battleId, target);
  if (r.ok) return { next: r.state, action: `Vex casts ${displayName(card)}` };
  return null;
}

function chooseSpellTarget(card: BattleCard, state: MatchState): SpellTarget | null | undefined {
  const them = state.player;
  const me = state.opponent;

  if (card.abilityKind === 'spell_damage') {
    const v = card.abilityValue ?? 0;
    // Prefer killing a player creature, otherwise face
    const killable = them.field
      .filter(c => c.abilityKind !== 'untargetable' && c.currentHp <= v)
      .sort((a, b) => (b.currentAtk + b.currentHp) - (a.currentAtk + a.currentHp))[0];
    if (killable) return { kind: 'creature', owner: 'player', battleId: killable.battleId };
    if (them.hp <= v + 2) return { kind: 'face', owner: 'player' };
    // Otherwise hit face anyway if no good removal option
    return { kind: 'face', owner: 'player' };
  }
  if (card.abilityKind === 'spell_freeze') {
    const big = them.field
      .filter(c => c.abilityKind !== 'untargetable' && !c.tapped)
      .sort((a, b) => b.currentAtk - a.currentAtk)[0];
    if (!big) return undefined;
    return { kind: 'creature', owner: 'player', battleId: big.battleId };
  }
  if (card.abilityKind === 'spell_buff') {
    const tgt = me.field
      .filter(c => !c.tapped)
      .sort((a, b) => b.currentAtk - a.currentAtk)[0];
    if (!tgt) return undefined;
    return { kind: 'creature', owner: 'opponent', battleId: tgt.battleId };
  }
  if (card.abilityKind === 'spell_heal') {
    if (me.hp >= 18) return undefined; // don't waste healing at near-full
    return { kind: 'face', owner: 'opponent' }; // target unused but required
  }
  if (card.abilityKind === 'draw_on_play') {
    if (me.hand.length >= 6) return undefined;
    return { kind: 'face', owner: 'opponent' };
  }
  return undefined;
}

function chooseAttackTarget(attacker: BattleCard, state: MatchState): AttackTarget | null {
  const them = state.player;
  const taunters = them.field.filter(c => c.abilityKind === 'taunt');

  if (taunters.length > 0) {
    // Pick taunter we can actually trade well with (lowest hp / highest atk)
    const best = taunters.sort((a, b) => a.currentHp - b.currentHp)[0];
    return { kind: 'creature', battleId: best.battleId };
  }

  // If a player creature can be killed without us dying, do it (favor removing big atk)
  const cleanKill = them.field
    .filter(c => c.currentHp <= attacker.currentAtk && c.currentAtk < attacker.currentHp)
    .sort((a, b) => b.currentAtk - a.currentAtk)[0];
  if (cleanKill) return { kind: 'creature', battleId: cleanKill.battleId };

  // If a high-atk creature threatens us next turn, suicide-trade into it if our atk is lower-value
  const threat = them.field
    .filter(c => c.currentAtk >= 4)
    .sort((a, b) => b.currentAtk - a.currentAtk)[0];
  if (threat && attacker.currentAtk + attacker.currentHp <= threat.currentAtk + threat.currentHp + 2) {
    return { kind: 'creature', battleId: threat.battleId };
  }

  // Otherwise smash face
  return { kind: 'face' };
}

function scoreCard(card: BattleCard, state: MatchState): number {
  // Higher score = play sooner. Roughly: card value − cost adjustment.
  let s = card.cost; // baseline — bigger cards have more impact
  if (card.type === 'Creature') {
    s += card.atk + card.hp;
    if (card.abilityKind === 'rush') s += 1;
    if (card.abilityKind === 'taunt' && state.opponent.hp < 14) s += 2;
    if (card.abilityKind === 'untargetable') s += 1;
    // On-curve play preference: prefer playing a card that uses most of available mana
    if (card.cost === state.opponent.mana) s += 0.5;
  } else {
    if (card.abilityKind === 'spell_damage') s += (card.abilityValue ?? 0);
    if (card.abilityKind === 'spell_heal' && state.opponent.hp < 14) s += 4;
    if (card.abilityKind === 'spell_freeze') s += 2;
    if (card.abilityKind === 'draw_on_play') s += 2;
  }
  return s;
}

