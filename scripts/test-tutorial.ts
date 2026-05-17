/**
 * Headless tutorial-script driver. Loads the tutorial player deck +
 * tutorial-dummy boss, walks the STEPS array from src/screens/Tutorial.tsx,
 * and executes the required action at each step against the real engine.
 *
 * Goal: prove that every step is reachable and the required card / target
 * is in the right place at the right moment, so a live player following
 * the script never dead-ends.
 *
 * Run:   npx tsx scripts/test-tutorial.ts
 */

import { aiStep } from '../src/game/ai';
import { getBoss } from '../src/data/bosses';
import { getTemplateById } from '../src/data/templates';
import { aiPhoto } from '../src/data/samplePhotos';
import {
  createMatch,
  playCard,
  attack,
  endTurn,
  readyAttackers,
  effectiveCost,
} from '../src/game/match';
import { mulberry32 } from '../src/game/sim';
import type { CollectionCard, MatchState } from '../src/game/types';

// Mirror Tutorial.tsx's TUTORIAL_DECK_IDS — keep in sync if that file
// changes. Imported as a literal here so the sim is self-contained
// (no React imports).
const TUTORIAL_DECK_IDS: string[] = [
  'fd-01', 'ani-02', 'fd-04', 'fam-14',
  'ani-05', 'fam-01', 'fd-01', 'fd-04', 'fam-14', 'ani-02', 'fd-01', 'fam-01',
];

// Mirror Tutorial.tsx's STEPS — same shape, just enough for the sim to
// know what to execute at each beat. Keep in sync with the live script.
interface Step {
  title: string;
  advanceOn: 'card-played' | 'spell-cast' | 'attack' | 'turn-end' | 'auto' | 'tap' | null;
  requireCardId?: string;
  requireAttackTarget?: 'face' | 'creature';
  anatomy?: boolean;
}
const STEPS: Step[] = [
  { title: 'CARD CREATURE',  advanceOn: 'tap', anatomy: true },
  { title: 'CARD SPELL',     advanceOn: 'tap', anatomy: true },
  { title: 'FIELD LAYOUT',   advanceOn: 'tap', anatomy: true },
  { title: 'TURN 1 SUMMON',  advanceOn: 'card-played', requireCardId: 'fd-01' },
  { title: 'END TURN T1',    advanceOn: 'turn-end' },
  { title: 'TURN 3 SPELL',   advanceOn: 'spell-cast',  requireCardId: 'ani-02' },
  { title: 'TURN 3 ATTACK',  advanceOn: 'attack',      requireAttackTarget: 'face' },
  { title: 'END TURN T3',    advanceOn: 'turn-end' },
  { title: 'TURN 5 BOND',    advanceOn: 'card-played', requireCardId: 'fd-04' },
  { title: 'BOND ACTIVE',    advanceOn: 'auto' },
  { title: 'END TURN T5',    advanceOn: 'turn-end' },
  { title: 'TURN 7 HEAL',    advanceOn: 'spell-cast',  requireCardId: 'fam-14' },
  { title: 'TURN 7 ATTACK',  advanceOn: 'attack',      requireAttackTarget: 'face' },
  { title: 'END TURN T7',    advanceOn: 'turn-end' },
  { title: 'TURN 9 TAUNT',   advanceOn: 'card-played', requireCardId: 'ani-05' },
  { title: 'END TURN T9',    advanceOn: 'turn-end' },
  { title: 'TURN 11 RUSH',   advanceOn: 'card-played', requireCardId: 'fam-01' },
  { title: 'FINISH',         advanceOn: null },
];

function buildPlayerDeck(): CollectionCard[] {
  return TUTORIAL_DECK_IDS.map((id, i) => {
    const tpl = getTemplateById(id);
    if (!tpl) throw new Error(`Unknown template: ${id}`);
    return {
      ...tpl,
      uid: `tut_${i}_${id}`,
      photo: aiPhoto(tpl.id),
      isPlaceholder: true,
    } as CollectionCard;
  });
}

// ─── Action executors ──────────────────────────────────────────────

function runOppAi(state: MatchState, oppCreatureCap: boolean): MatchState {
  // Mirror MatchBoard's AI driver: aiStep until null, with the
  // tutorial creature-cap if enabled.
  let creaturesPlayed = 0;
  let safety = 50;
  while (state.turn === 'opponent' && state.outcome === 'ongoing' && safety-- > 0) {
    const skipCreaturePlays = oppCreatureCap && creaturesPlayed >= 1;
    const r = aiStep(state, { skipCreaturePlays });
    if (!r) break;
    if (r.played?.type === 'Creature') creaturesPlayed += 1;
    state = r.next;
  }
  return state;
}

function executeStep(state: MatchState, step: Step, oppCreatureCap: boolean): { state: MatchState; ok: boolean; reason?: string } {
  // Anatomy + auto + tap have no engine action — just pass through.
  if (step.anatomy || step.advanceOn === 'auto' || step.advanceOn === 'tap') {
    return { state, ok: true };
  }
  // Make sure it's the player's turn for player-driven actions.
  if (state.turn !== 'player') {
    return { state, ok: false, reason: `not player turn (was ${state.turn})` };
  }

  if (step.advanceOn === 'card-played' && step.requireCardId) {
    const card = state.player.hand.find(c => c.id === step.requireCardId && c.type === 'Creature');
    if (!card) {
      return { state, ok: false, reason: `creature ${step.requireCardId} not in hand. Hand=${state.player.hand.map(c => `${c.id}(${c.type})`).join(',')}` };
    }
    if (effectiveCost(state.player, card) > state.player.mana) {
      return { state, ok: false, reason: `not enough mana to play ${step.requireCardId} (cost ${card.cost}, mana ${state.player.mana})` };
    }
    if (state.player.field.length >= 3) {
      return { state, ok: false, reason: `player field full, cannot summon ${step.requireCardId}` };
    }
    const r = playCard(state, 'player', card.battleId);
    if (!r.ok) return { state, ok: false, reason: `playCard failed: ${r.reason}` };
    return { state: r.state, ok: true };
  }

  if (step.advanceOn === 'spell-cast' && step.requireCardId) {
    const card = state.player.hand.find(c => c.id === step.requireCardId && c.type === 'Spell');
    if (!card) return { state, ok: false, reason: `spell ${step.requireCardId} not in hand` };
    if (effectiveCost(state.player, card) > state.player.mana) {
      return { state, ok: false, reason: `not enough mana for ${step.requireCardId} (cost ${card.cost}, mana ${state.player.mana})` };
    }
    // Target selection:
    // - spell_damage (Snake Bite) → opp creature if any, else opp face.
    //   The script for ani-02 expects a Mouse on opp board to one-shot.
    // - spell_heal (Hug) → player face.
    let target: any = undefined;
    if (card.abilityKind === 'spell_damage') {
      const opp = state.opponent.field.find(c => c.abilityKind !== 'untargetable');
      target = opp
        ? { kind: 'creature', owner: 'opponent', battleId: opp.battleId }
        : { kind: 'face', owner: 'opponent' };
    } else if (card.abilityKind === 'spell_heal') {
      target = { kind: 'face', owner: 'player' };
    }
    const r = playCard(state, 'player', card.battleId, target);
    if (!r.ok) return { state, ok: false, reason: `playCard(spell) failed: ${r.reason}` };
    return { state: r.state, ok: true };
  }

  if (step.advanceOn === 'attack') {
    const ready = readyAttackers(state.player);
    if (ready.length === 0) return { state, ok: false, reason: `no ready attackers. Field=${state.player.field.map(c => `${c.id}(slept=${c.summonedTurn === state.turnNumber})`).join(',')}` };
    const attacker = ready[0];
    const target = step.requireAttackTarget === 'creature'
      ? (state.opponent.field[0]
          ? { kind: 'creature' as const, battleId: state.opponent.field[0].battleId }
          : { kind: 'face' as const })
      : { kind: 'face' as const };
    const r = attack(state, 'player', attacker.battleId, target);
    if (!r.ok) return { state, ok: false, reason: `attack failed: ${r.reason}` };
    return { state: r.state, ok: true };
  }

  if (step.advanceOn === 'turn-end') {
    return { state: endTurn(state), ok: true };
  }

  if (step.advanceOn === null) {
    // FINISH — swing every ready attacker at face until opp dies or we run out.
    let cur = state;
    let safety = 20;
    while (cur.outcome === 'ongoing' && cur.turn === 'player' && safety-- > 0) {
      const ready = readyAttackers(cur.player);
      if (ready.length === 0) break;
      const r = attack(cur, 'player', ready[0].battleId, { kind: 'face' });
      if (!r.ok) break;
      cur = r.state;
    }
    return { state: cur, ok: true };
  }

  return { state, ok: false, reason: `unhandled step kind: ${step.advanceOn}` };
}

// ─── Driver ──────────────────────────────────────────────────────

function runOnce(seed: number): { ok: boolean; lines: string[]; finalState: MatchState } {
  const lines: string[] = [];
  const rng = mulberry32(seed);
  const boss = getBoss('tutorial-dummy');
  if (!boss) throw new Error('tutorial-dummy boss missing');

  let state = createMatch(buildPlayerDeck(), boss, 'normal', rng);
  lines.push(`init: player HP ${state.player.hp}, opp HP ${state.opponent.hp}, turn ${state.turnNumber} (${state.turn})`);

  // Anatomy steps + initial turn flip — if opp goes first by some override,
  // run AI; tutorial pins firstPlayer to 'player' so this should be a no-op.
  if (state.turn === 'opponent') state = runOppAi(state, !!boss.oneCreaturePerTurn);

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const r = executeStep(state, step, !!boss.oneCreaturePerTurn);
    if (!r.ok) {
      lines.push(`✗ STEP ${i + 1} (${step.title}) FAILED: ${r.reason}`);
      return { ok: false, lines, finalState: state };
    }
    state = r.state;
    lines.push(`✓ STEP ${i + 1} (${step.title}) — turn ${state.turnNumber} (${state.turn}), pHP ${state.player.hp}, oHP ${state.opponent.hp}, pField [${state.player.field.map(c => c.id).join(',')}], oField [${state.opponent.field.map(c => c.id).join(',')}]`);

    // After a turn-end (or FINISH), let opp run its turn.
    if (state.turn === 'opponent' && state.outcome === 'ongoing') {
      state = runOppAi(state, !!boss.oneCreaturePerTurn);
      if (state.outcome === 'ongoing') {
        state = endTurn(state); // opp ends its turn; engine flips back to player
      }
      lines.push(`  → after opp turn: turn ${state.turnNumber} (${state.turn}), pHP ${state.player.hp}, oHP ${state.opponent.hp}, pField [${state.player.field.map(c => c.id).join(',')}], oField [${state.opponent.field.map(c => c.id).join(',')}]`);
    }
  }

  lines.push(`final: outcome=${state.outcome}, turn ${state.turnNumber}, pHP ${state.player.hp}, oHP ${state.opponent.hp}`);
  return { ok: state.outcome === 'win', lines, finalState: state };
}

// ─── Entry ──────────────────────────────────────────────────────

const seeds = [1, 2, 3, 7, 42];
let allOk = true;
for (const seed of seeds) {
  const { ok, lines } = runOnce(seed);
  console.log(`\n=== seed ${seed} ${ok ? 'OK' : 'FAIL'} ===`);
  for (const l of lines) console.log(l);
  if (!ok) allOk = false;
}
console.log(`\n${allOk ? '✓ all seeds passed' : '✗ at least one seed failed'}`);
process.exit(allOk ? 0 : 1);
