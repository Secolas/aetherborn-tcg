/**
 * Headless match simulator for balance testing.
 *
 * Drives both sides with the existing AI heuristics (src/game/ai.ts) using
 * an injected seeded PRNG so the same seed always produces the same match.
 * No UI, DOM, or React imports — safe to run from a Node script or test.
 */

import type { CollectionCard, MatchState, Owner } from './types';
import { createMatchFromDecks, endTurn, type Rng } from './match';
import { aiStep } from './ai';
import { BONDS } from '../data/bonds';

/** Seeded PRNG — mulberry32. Cheap, fast, good enough for shuffle + AI noise. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimOptions {
  /** Match difficulty tier — controls AI sophistication. Defaults to 'normal'. */
  difficulty?: MatchState['difficulty'];
  /** Seed for the PRNG. Defaults to a fixed value so repeat runs match. */
  seed?: number;
  /** Hard cap on engine steps before we declare a draw. Guards against any
   *  AI loop that would otherwise hang the sim. Should never trip in
   *  practice — TURN_LIMIT in the engine resolves matches well before
   *  this fires. */
  maxSteps?: number;
}

export type Outcome = 'A' | 'B' | 'draw';

export interface SimResult {
  /** Which deck won. 'A' === deckA wins ('player' side), 'B' === deckB wins. */
  outcome: Outcome;
  /** Final turn number the match ended on. */
  turns: number;
  /** Total AI step actions resolved across both sides. */
  actions: number;
  /** Final HP for each side. */
  hpA: number;
  hpB: number;
  /** Per-bond activation counts, keyed by bond id. Counts every *transition*
   *  from "not claimed" to "claimed" — re-forming after a break counts again. */
  bondActivations: {
    A: Record<string, number>;
    B: Record<string, number>;
  };
  /** Total bond activations across the match (sum of both sides). */
  totalBondActivations: number;
}

export interface BatchSummary {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgTurns: number;
  avgActions: number;
  avgBondActivations: number;
  /** Aggregate per-bond activation totals across all matches. */
  bondActivations: {
    A: Record<string, number>;
    B: Record<string, number>;
  };
}

const DEFAULT_MAX_STEPS = 2000;

/** Run a single deterministic match. */
export function simulateOne(
  deckA: CollectionCard[],
  deckB: CollectionCard[],
  options: SimOptions = {},
): SimResult {
  const seed = options.seed ?? 1;
  const rng = mulberry32(seed);
  const difficulty = options.difficulty ?? 'normal';
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;

  let state = createMatchFromDecks(deckA, deckB, difficulty, rng);
  const bondActivations = { A: {} as Record<string, number>, B: {} as Record<string, number> };
  let prevA = new Set<string>();
  let prevB = new Set<string>();
  let actions = 0;
  let steps = 0;

  while (state.outcome === 'ongoing' && steps < maxSteps) {
    steps++;
    const step = stepActiveSide(state);
    if (step) {
      state = step;
      actions++;
    } else {
      state = endTurn(state);
    }
    [prevA, prevB] = recordBondTransitions(state, prevA, prevB, bondActivations);
  }

  const outcome: Outcome =
    state.outcome === 'win' ? 'A'
    : state.outcome === 'loss' ? 'B'
    : 'draw';

  const totalBondActivations = sumCounts(bondActivations.A) + sumCounts(bondActivations.B);

  return {
    outcome,
    turns: state.turnNumber,
    actions,
    hpA: state.player.hp,
    hpB: state.opponent.hp,
    bondActivations,
    totalBondActivations,
  };
}

/** Run a batch of matches with seeds derived from the base seed. */
export function simulateBatch(
  deckA: CollectionCard[],
  deckB: CollectionCard[],
  options: SimOptions & { matches?: number } = {},
): BatchSummary {
  const n = Math.max(1, options.matches ?? 100);
  const baseSeed = options.seed ?? 1;
  let wins = 0, losses = 0, draws = 0;
  let totalTurns = 0, totalActions = 0, totalBonds = 0;
  const aggBondA: Record<string, number> = {};
  const aggBondB: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const r = simulateOne(deckA, deckB, { ...options, seed: baseSeed + i });
    if (r.outcome === 'A') wins++;
    else if (r.outcome === 'B') losses++;
    else draws++;
    totalTurns += r.turns;
    totalActions += r.actions;
    totalBonds += r.totalBondActivations;
    mergeCounts(aggBondA, r.bondActivations.A);
    mergeCounts(aggBondB, r.bondActivations.B);
  }

  return {
    matches: n,
    wins,
    losses,
    draws,
    winRate: wins / n,
    avgTurns: totalTurns / n,
    avgActions: totalActions / n,
    avgBondActivations: totalBonds / n,
    bondActivations: { A: aggBondA, B: aggBondB },
  };
}

/** Drive whichever side currently has the turn. The engine AI is written
 *  from the opponent's perspective, so for player-turn we run it through
 *  a perspective-swap and undo it on the way back out. */
function stepActiveSide(state: MatchState): MatchState | null {
  if (state.turn === 'opponent') {
    const r = aiStep(state);
    return r?.next ?? null;
  }
  const swapped = swapPerspective(state);
  const r = aiStep(swapped);
  return r ? swapPerspective(r.next) : null;
}

function swapPerspective(state: MatchState): MatchState {
  // Swap `player` and `opponent` (and the turn / outcome that reference
  // them). bond / hand / field references are by-value within each side
  // so a shallow swap is safe. Log / difficulty / rngState are
  // perspective-neutral.
  const flippedOutcome =
    state.outcome === 'win' ? 'loss'
    : state.outcome === 'loss' ? 'win'
    : state.outcome;
  const flipOwner = (o: Owner): Owner => (o === 'player' ? 'opponent' : 'player');
  return {
    ...state,
    player: state.opponent,
    opponent: state.player,
    turn: flipOwner(state.turn),
    outcome: flippedOutcome,
  };
}

function recordBondTransitions(
  state: MatchState,
  prevA: Set<string>,
  prevB: Set<string>,
  acc: { A: Record<string, number>; B: Record<string, number> },
): [Set<string>, Set<string>] {
  const curA = new Set(state.player.claimedBonds ?? []);
  const curB = new Set(state.opponent.claimedBonds ?? []);
  for (const id of curA) if (!prevA.has(id)) acc.A[id] = (acc.A[id] ?? 0) + 1;
  for (const id of curB) if (!prevB.has(id)) acc.B[id] = (acc.B[id] ?? 0) + 1;
  return [curA, curB];
}

function sumCounts(c: Record<string, number>): number {
  let s = 0;
  for (const k in c) s += c[k];
  return s;
}

function mergeCounts(into: Record<string, number>, from: Record<string, number>) {
  for (const k in from) into[k] = (into[k] ?? 0) + from[k];
}

/** Sanity helper for callers that want to print a list of known bonds. */
export function knownBondIds(): string[] {
  return BONDS.map(b => b.id);
}
