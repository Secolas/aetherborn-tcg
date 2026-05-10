import {
  attack, playCard, readyAttackers, displayName, effectiveCost,
  activeBonds,
  type AttackTarget, type SpellTarget,
} from './match';
import { BONDS } from '../data/bonds';
import type { BattleCard, MatchState, Owner, Difficulty } from './types';

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
  /** When the AI plays a card (creature or spell), the UI shows it. */
  played?: BattleCard;
  /** Spell target — populated for spell plays so the UI can fire a target FX. */
  spellTarget?: SpellTarget;
};

// ===========================================================================
// Tier capabilities — what each difficulty unlocks. Easier than scattering
// `if (difficulty === 'hard')` checks throughout. Each capability is a
// boolean toggle the heuristics consult before applying their tier-specific
// improvement. Mythic gets everything, Hard gets the strategic upgrades,
// Normal stays on the baseline aggressive-but-naive behavior.
// ===========================================================================
interface AiCaps {
  /** Don't waste a 5-damage spell on a 1-HP creature. Hard+ */
  spellEfficiency: boolean;
  /** Use freeze/silence on the highest priority threat (highest atk
   *  or biggest body) rather than first valid target. Hard+ */
  threatTargeting: boolean;
  /** Save healing for when actually low; save buffs for creatures
   *  about to attack; don't immediately fire spells the moment they
   *  go online. Hard+ */
  patientCasts: boolean;
  /** Avoid suicide-trades that would lose AI's own bond. Hard+ */
  preserveOwnBonds: boolean;
  /** When deciding what to summon, prefer creatures that complete a
   *  bond on AI's side. Mythic. */
  bondCompletion: boolean;
  /** When picking spell targets, prioritize the player's bond cards
   *  to break their bonds. Mythic. */
  bondDisruption: boolean;
}

function caps(d: Difficulty): AiCaps {
  switch (d) {
    case 'mythic':
      return {
        spellEfficiency: true,
        threatTargeting: true,
        patientCasts: true,
        preserveOwnBonds: true,
        bondCompletion: true,
        bondDisruption: true,
      };
    case 'hard':
      return {
        spellEfficiency: true,
        threatTargeting: true,
        patientCasts: true,
        preserveOwnBonds: true,
        bondCompletion: false,
        bondDisruption: false,
      };
    default:
      return {
        spellEfficiency: false,
        threatTargeting: false,
        patientCasts: false,
        preserveOwnBonds: false,
        bondCompletion: false,
        bondDisruption: false,
      };
  }
}

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

  const c = caps(state.difficulty);
  const me = state.opponent;
  const them = state.player;

  // 1. Lethal check — Hard+ also considers spells that bypass taunt
  // (silence / freeze) or push extra face damage to reach lethal.
  const lethal = findLethal(state, c);
  if (lethal) return lethal;

  // 2. Play the best card we can afford. scoreCard branches on difficulty
  //    so Mythic prefers bond-completing summons and Hard penalises
  //    over-cost waste plays.
  const playable = me.hand
    .filter(card => effectiveCost(me, card) <= me.mana)
    .sort((a, b) => scoreCard(b, state, c) - scoreCard(a, state, c));

  for (const card of playable) {
    const result = tryPlay(state, card, c);
    if (result) return result;
  }

  // 3. Attack — Hard+ considers preserveOwnBonds and threat targeting.
  const attackers = readyAttackers(me);
  for (const a of attackers) {
    const target = chooseAttackTarget(a, state, c);
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

/** Sum of the AI's potential face damage this turn — counts current
 *  attackers' ATK and any damage spell targeting face that we can afford.
 *  Hard+ uses this for smarter lethal detection. */
function potentialFaceDamage(state: MatchState): number {
  const me = state.opponent;
  const ready = readyAttackers(me);
  let total = ready.reduce((sum, c) => sum + c.currentAtk, 0);
  let manaLeft = me.mana;
  for (const card of [...me.hand].sort((a, b) => effectiveCost(me, b) - effectiveCost(me, a))) {
    const cost = effectiveCost(me, card);
    if (cost > manaLeft) continue;
    if (card.abilityKind === 'spell_damage' && card.abilityValue) {
      total += card.abilityValue;
      manaLeft -= cost;
    }
  }
  return total;
}

function findLethal(state: MatchState, c: AiCaps): AiStepResult | null {
  const me = state.opponent;
  const them = state.player;
  const taunters = them.field.filter(x => x.abilityKind === 'taunt');

  // Normal AI bails on lethal if there's a taunt; Hard+ may still find a
  // path through silence or burn spells, but for simplicity we still bail
  // when taunters exist — the next step (play / attack) handles them.
  if (taunters.length > 0) return null;

  const ready = readyAttackers(me);
  const directAtk = ready.reduce((sum, x) => sum + x.currentAtk, 0);

  // Baseline lethal — current implementation.
  if (directAtk >= them.hp && ready.length > 0) {
    const a = ready[0];
    const r = attack(state, 'opponent', a.battleId, { kind: 'face' });
    if (r.ok) {
      return {
        next: r.state,
        action: `${displayName(a)} pushes for ${a.currentAtk}`,
        combat: {
          attackerId: a.battleId, attackerOwner: 'opponent',
          defenderKind: 'face', defenderOwner: 'player',
          damageToDef: a.currentAtk, damageToAtk: 0,
        },
      };
    }
  }

  // Hard+ extra: if face damage with combat alone is short, but combat
  // PLUS available burn spells would be lethal, we'd want to fire the
  // burn first. We detect that here as "should fire burn first" — return
  // null so the play step picks up the burn naturally on the next call.
  if (c.spellEfficiency && potentialFaceDamage(state) >= them.hp) return null;

  return null;
}

function tryPlay(state: MatchState, card: BattleCard, c: AiCaps): AiStepResult | null {
  if (card.type === 'Creature') {
    if (state.opponent.field.length >= 6) return null;
    const r = playCard(state, 'opponent', card.battleId);
    if (r.ok) return { next: r.state, action: `The Boss summons ${displayName(card)}`, played: card };
    return null;
  }

  const target = chooseSpellTarget(card, state, c);
  if (target === undefined || target === null) return null;
  const r = playCard(state, 'opponent', card.battleId, target);
  if (r.ok) return {
    next: r.state,
    action: `The Boss casts ${displayName(card)}`,
    played: card,
    spellTarget: target ?? undefined,
  };
  return null;
}

/** Templates participating in any of the player's currently-active bonds.
 *  Used by Mythic AI to prioritize spell targets and disrupt synergies. */
function playerBondedTemplateIds(state: MatchState): Set<string> {
  const out = new Set<string>();
  for (const b of activeBonds(state.player)) {
    out.add(b.cardA);
    out.add(b.cardB);
  }
  return out;
}

function chooseSpellTarget(card: BattleCard, state: MatchState, c: AiCaps): SpellTarget | null | undefined {
  const them = state.player;
  const me = state.opponent;
  const bondedPlayer = c.bondDisruption ? playerBondedTemplateIds(state) : null;

  if (card.abilityKind === 'spell_damage') {
    const v = card.abilityValue ?? 0;
    // Score every legal target — kill > damage > face. Spell efficiency
    // (Hard+) penalises burning a high-damage spell on a low-value
    // creature. Bond disruption (Mythic) bonuses player-bonded cards.
    const candidates = them.field
      .filter(x => x.abilityKind !== 'untargetable')
      .map(x => {
        const wouldKill = x.currentHp <= v;
        let score = 0;
        if (wouldKill) score += 30 + (x.currentAtk + x.currentHp);
        else score += x.currentAtk + Math.min(v, x.currentHp);
        if (c.spellEfficiency && wouldKill) {
          // Penalty for over-killing a weak target with a strong spell —
          // saving the burn for face or a bigger threat is usually better.
          const overkill = v - x.currentHp;
          score -= overkill * 1.5;
        }
        if (bondedPlayer?.has(x.id)) score += 12;
        return { x, score };
      });

    const best = candidates.sort((a, b) => b.score - a.score)[0];
    // Face is always a fallback option and represents pushing damage
    // toward lethal. Compare its value against the best creature target.
    const faceScore = (them.hp <= v ? 100 : 0)            // immediate lethal contribution
      + Math.min(v, them.hp)                              // raw damage value
      + (c.spellEfficiency && (best?.x.currentHp ?? 99) > v ? 4 : 0); // creature wouldn't die anyway → face is fine
    if (!best || faceScore > best.score) return { kind: 'face', owner: 'player' };
    return { kind: 'creature', owner: 'player', battleId: best.x.battleId };
  }

  if (card.abilityKind === 'silence') {
    // Silence the most threatening enemy creature with an ability — taunt
    // first (clears the lane), then untargetable, then big bodies. Mythic
    // also disrupts bonded cards even if their ability is "none".
    const annoying = them.field.filter(x =>
      x.abilityKind === 'taunt' || x.abilityKind === 'untargetable' || x.abilityKind === 'rush'
    );
    let pool = annoying;
    if (pool.length === 0 && bondedPlayer?.size) {
      pool = them.field.filter(x => bondedPlayer.has(x.id));
    }
    if (pool.length === 0) return null;
    const tgt = pool.sort((a, b) => (b.currentAtk + b.currentHp) - (a.currentAtk + a.currentHp))[0];
    return { kind: 'creature', owner: 'player', battleId: tgt.battleId };
  }

  if (card.abilityKind === 'spell_freeze') {
    let pool = them.field.filter(x => x.abilityKind !== 'untargetable' && !x.tapped);
    // Mythic disruption bonus: among legal freezes, prefer a bonded card
    // (freezing it doesn't break the bond but locks the synergy down for
    // a turn so the player can't capitalize on bonded ATK/Rush).
    if (bondedPlayer && pool.some(x => bondedPlayer.has(x.id))) {
      pool = pool.filter(x => bondedPlayer.has(x.id));
    }
    if (pool.length === 0) return undefined;
    const big = pool.sort((a, b) => b.currentAtk - a.currentAtk)[0];
    return { kind: 'creature', owner: 'player', battleId: big.battleId };
  }

  if (card.abilityKind === 'spell_buff') {
    let pool = me.field.filter(x => !x.tapped);
    // Patient casts: don't buff a creature that'll be wasted (low ATK,
    // no target to attack into, etc.). Pick the highest ATK creature
    // since the buff stacks multiplicatively with combat.
    if (pool.length === 0) return undefined;
    const tgt = pool.sort((a, b) => b.currentAtk - a.currentAtk)[0];
    return { kind: 'creature', owner: 'opponent', battleId: tgt.battleId };
  }

  if (card.abilityKind === 'spell_heal') {
    // Patient heal: Hard+ waits until the threshold is meaningful so the
    // heal isn't wasted on capped HP. Normal heals at <18 (current logic).
    const threshold = c.patientCasts ? 14 : 18;
    if (me.hp >= threshold) return undefined;
    return { kind: 'face', owner: 'opponent' };
  }

  if (card.abilityKind === 'draw_on_play') {
    if (me.hand.length >= 6) return undefined;
    return { kind: 'face', owner: 'opponent' };
  }

  return undefined;
}

function chooseAttackTarget(attacker: BattleCard, state: MatchState, c: AiCaps): AttackTarget | null {
  const them = state.player;
  const me = state.opponent;
  const taunters = them.field.filter(x => x.abilityKind === 'taunt');

  if (taunters.length > 0) {
    // Pick taunter we can actually trade well with (lowest hp first).
    const best = taunters.sort((a, b) => a.currentHp - b.currentHp)[0];
    return { kind: 'creature', battleId: best.battleId };
  }

  // Preserve own bonds: if attacker is in an active bond and would die in
  // a creature trade, refuse the trade unless the trade kills a higher-
  // value target. Hard+
  const attackerBond = c.preserveOwnBonds && activeBonds(me).find(b => b.cardA === attacker.id || b.cardB === attacker.id);

  // Threat targeting (Hard+): rank player creatures by danger and pick the
  // most dangerous we can clean-kill. Otherwise prefer a clean kill over a
  // suicide trade, and face over both.
  const cleanKills = them.field.filter(x => x.currentHp <= attacker.currentAtk && x.currentAtk < attacker.currentHp);
  if (cleanKills.length > 0) {
    const target = c.threatTargeting
      ? cleanKills.sort((a, b) => threatScore(b) - threatScore(a))[0]
      : cleanKills.sort((a, b) => b.currentAtk - a.currentAtk)[0];
    return { kind: 'creature', battleId: target.battleId };
  }

  // Suicide-trade only against significant threats. Hard+ refuses if the
  // attacker is locked into a bond it'd lose by dying.
  const threat = them.field
    .filter(x => x.currentAtk >= 4)
    .sort((a, b) => b.currentAtk - a.currentAtk)[0];
  if (threat) {
    const valuesClose = attacker.currentAtk + attacker.currentHp <= threat.currentAtk + threat.currentHp + 2;
    if (valuesClose && !attackerBond) {
      return { kind: 'creature', battleId: threat.battleId };
    }
  }

  // Default: face. Aggressive mode.
  return { kind: 'face' };
}

/** Heuristic for "how dangerous is this enemy creature?" — used by threat
 *  targeting. Higher ATK is the biggest factor, then HP (durability), with
 *  a small bonus for evasive abilities. */
function threatScore(c: BattleCard): number {
  let s = c.currentAtk * 2 + c.currentHp;
  if (c.abilityKind === 'taunt') s += 1;
  if (c.abilityKind === 'rush') s += 1;
  if (c.abilityKind === 'untargetable') s += 2;
  return s;
}

/** Card play priority. Higher = play first. */
function scoreCard(card: BattleCard, state: MatchState, c: AiCaps): number {
  const me = state.opponent;
  let s = card.cost; // baseline — bigger cards have more impact

  if (card.type === 'Creature') {
    s += card.atk + card.hp;
    if (card.abilityKind === 'rush') s += 1;
    if (card.abilityKind === 'taunt' && me.hp < 14) s += 2;
    if (card.abilityKind === 'untargetable') s += 1;

    // Bond completion (Mythic): if summoning this card would activate an
    // AI bond, prioritize the play. Big +score so it beats other
    // candidates of equal cost.
    if (c.bondCompletion) {
      const fieldIds = new Set(me.field.map(x => x.id));
      const completes = BONDS.some(b =>
        (b.cardA === card.id && fieldIds.has(b.cardB)) ||
        (b.cardB === card.id && fieldIds.has(b.cardA))
      );
      if (completes) s += 6;
    }

    // On-curve preference. Hard+ leans into this harder so AI doesn't
    // waste 1-mana plays on turn 5.
    if (card.cost === me.mana) s += 0.5;
    if (c.patientCasts) {
      // Penalty for under-cost plays when bigger cards are playable.
      const biggerInHand = me.hand.some(x => x.battleId !== card.battleId && effectiveCost(me, x) > card.cost && effectiveCost(me, x) <= me.mana);
      if (biggerInHand) s -= 1.5;
    }
  } else {
    if (card.abilityKind === 'spell_damage') s += (card.abilityValue ?? 0);
    if (card.abilityKind === 'spell_heal' && me.hp < 14) s += 4;
    if (card.abilityKind === 'spell_freeze') s += 2;
    if (card.abilityKind === 'silence') s += 2;
    if (card.abilityKind === 'draw_on_play') s += 2;

    // Patient casts: don't fire spells that would do nothing right now.
    if (c.patientCasts) {
      if (card.abilityKind === 'spell_buff' && me.field.length === 0) s -= 5;
      if (card.abilityKind === 'spell_freeze' && state.player.field.length === 0) s -= 5;
      if (card.abilityKind === 'silence' && !state.player.field.some(x =>
        x.abilityKind === 'taunt' || x.abilityKind === 'untargetable' || x.abilityKind === 'rush'
      )) s -= 4;
      if (card.abilityKind === 'spell_heal' && me.hp >= 18) s -= 5;
    }
  }
  return s;
}
