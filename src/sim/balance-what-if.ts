/**
 * What-if balance comparison. Runs the same matchup grid under several
 * candidate engine-constant tunings and prints them side-by-side so a
 * designer can see whether changing TURN_LIMIT / STARTING_HAND /
 * STARTING_HP / deckSize *actually* improves pacing — without editing
 * the real constants in match.ts.
 *
 * Each row is one config. Columns:
 *   - top deck win%   - bottom deck win%   - spread (pp)
 *   - avg turns       - hit-turn-limit %
 *   - fatigue %       - draw %             - avg HP delta
 *
 * Run with:  npx tsx src/sim/balance-what-if.ts
 *
 * Edit the CONFIGS array below to test new tunings. This is a designer
 * tool, not part of the app build.
 */

import type { CollectionCard, MatchState, Owner, PlayerState } from '../game/types';
import { getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { BOSSES } from '../data/bosses';
import { STARTER_THEMES } from '../data/starterDecks';
import { createMatchFromDecks, endTurn, type Rng } from '../game/match';
import { aiStep } from '../game/ai';
import { mulberry32 } from '../game/sim';

interface Config {
  label: string;
  turnLimit: number;
  startingHand: number;
  deckSize: number;
  startingHp: number;
}

/** Tunings to compare. The first row should be the shipped defaults
 *  (so every other row reads as a diff from "live"). */
const CONFIGS: Config[] = [
  { label: 'live (TL=12 HP=20)',       turnLimit: 12, startingHand: 4, deckSize: 12, startingHp: 20 },
  { label: '+1 turn (TL=13)',          turnLimit: 13, startingHand: 4, deckSize: 12, startingHp: 20 },
  { label: '−2 HP (HP=18)',            turnLimit: 12, startingHand: 4, deckSize: 12, startingHp: 18 },
  { label: '−4 HP (HP=16)',            turnLimit: 12, startingHand: 4, deckSize: 12, startingHp: 16 },
  { label: 'bigger opener (HAND=5)',   turnLimit: 12, startingHand: 5, deckSize: 12, startingHp: 20 },
  { label: 'long format (TL=15 D=15)', turnLimit: 15, startingHand: 4, deckSize: 15, startingHp: 20 },
];

const MATCHES_PER_PAIR = 100;
const BASE_SEED = 4242;

type Entrant = { id: string; label: string; deck: string[] };

function buildEntrants(): Entrant[] {
  const out: Entrant[] = [];
  for (const b of BOSSES) {
    if (b.id === 'tutorial-dummy') continue;
    if (b.id.startsWith('mini-')) continue;
    out.push({ id: b.id, label: b.name, deck: b.deck });
  }
  for (const s of STARTER_THEMES) {
    if (s.id !== 'family' && s.id !== 'work' && s.id !== 'education') continue;
    out.push({ id: `starter-${s.id}`, label: `Starter: ${s.name}`, deck: s.deck });
  }
  return out;
}

function deckCards(e: Entrant, deckSize: number): CollectionCard[] {
  const cards = e.deck.map((tid, i) => {
    const t = getTemplateById(tid);
    if (!t) throw new Error(`Unknown template ${tid}`);
    return { ...t, uid: `${e.id}_${i}_${tid}`, photo: aiPhoto(t.id), nickname: undefined };
  });
  if (cards.length >= deckSize) return cards.slice(0, deckSize);
  // Pad shorter decks by duplicating the cheapest creatures, so a
  // larger deckSize what-if can still be evaluated. We dup the lowest-
  // cost cards because they're the ones a designer would realistically
  // add as filler.
  const padded = cards.slice();
  const sorted = cards.slice().sort((a, b) => a.cost - b.cost);
  let i = 0;
  while (padded.length < deckSize) {
    const t = sorted[i % sorted.length];
    padded.push({ ...t, uid: `${e.id}_pad_${padded.length}_${t.id}` });
    i++;
  }
  return padded;
}

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
  const flippedOutcome =
    state.outcome === 'win'  ? 'loss'
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

function topUpHand(me: PlayerState, target: number) {
  while (me.hand.length < target && me.deck.length > 0) {
    const c = me.deck.shift()!;
    c.tapped = false;
    me.hand.push(c);
  }
}

function simulateMatch(cfg: Config, deckA: CollectionCard[], deckB: CollectionCard[], seed: number) {
  const rng: Rng = mulberry32(seed);
  let state = createMatchFromDecks(deckA, deckB, 'normal', rng);
  state.turnLimit = cfg.turnLimit;
  if (cfg.startingHp !== 20) {
    state.player.hp = cfg.startingHp;
    state.opponent.hp = cfg.startingHp;
  }
  if (cfg.startingHand > 4) {
    topUpHand(state.player, cfg.startingHand);
    topUpHand(state.opponent, cfg.startingHand);
  }
  let steps = 0;
  while (state.outcome === 'ongoing' && steps < 2000) {
    steps++;
    const next = stepActiveSide(state);
    state = next ?? endTurn(state);
  }
  return {
    outcome: state.outcome === 'win'  ? 'A' as const
           : state.outcome === 'loss' ? 'B' as const
           : 'draw' as const,
    turns: state.turnNumber,
    hpA: state.player.hp,
    hpB: state.opponent.hp,
    fatigue: state.player.fatigueCount > 0 || state.opponent.fatigueCount > 0,
    hitTurnLimit: state.turnNumber > cfg.turnLimit,
  };
}

function hash2(a: string, b: string): number {
  let h = 2166136261 >>> 0;
  for (const ch of `${a}|${b}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h & 0xffff;
}

function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }
function padL(s: string, n: number) { return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s; }

interface ConfigResult {
  cfg: Config;
  topLabel: string; topRate: number;
  botLabel: string; botRate: number;
  avgTurns: number;
  hitLimitPct: number;
  fatiguePct: number;
  drawPct: number;
  avgHpDelta: number;
}

function runOne(cfg: Config, entrants: Entrant[]): ConfigResult {
  const winCount: Record<string, { w: number; total: number }> = {};
  entrants.forEach(e => (winCount[e.id] = { w: 0, total: 0 }));
  let matches = 0, turns = 0, tlHits = 0, fatHits = 0, draws = 0, hpDelta = 0, nonDraw = 0;

  // Pre-build decks for this config (deckSize varies).
  const decks: Record<string, CollectionCard[]> = {};
  for (const e of entrants) decks[e.id] = deckCards(e, cfg.deckSize);

  for (const a of entrants) {
    for (const b of entrants) {
      if (a.id === b.id) continue;
      for (let i = 0; i < MATCHES_PER_PAIR; i++) {
        const r = simulateMatch(cfg, decks[a.id], decks[b.id], BASE_SEED + hash2(a.id, b.id) + i);
        matches++;
        turns += r.turns;
        if (r.hitTurnLimit) tlHits++;
        if (r.fatigue) fatHits++;
        if (r.outcome === 'draw') draws++;
        if (r.outcome !== 'draw') { hpDelta += Math.abs(r.hpA - r.hpB); nonDraw++; }
        winCount[a.id].total++;
        if (r.outcome === 'A') winCount[a.id].w++;
        winCount[b.id].total++;
        if (r.outcome === 'B') winCount[b.id].w++;
      }
    }
  }

  const ranked = entrants
    .map(e => ({ label: e.label, rate: winCount[e.id].w / winCount[e.id].total }))
    .sort((x, y) => y.rate - x.rate);
  return {
    cfg,
    topLabel: ranked[0].label, topRate: ranked[0].rate,
    botLabel: ranked[ranked.length - 1].label, botRate: ranked[ranked.length - 1].rate,
    avgTurns: turns / matches,
    hitLimitPct: tlHits / matches,
    fatiguePct: fatHits / matches,
    drawPct: draws / matches,
    avgHpDelta: hpDelta / Math.max(1, nonDraw),
  };
}

function main() {
  const entrants = buildEntrants();
  console.log(`\n=== Memoria what-if balance comparison ===`);
  console.log(`${MATCHES_PER_PAIR} matches per pairing × ${entrants.length * (entrants.length - 1)} pairings × ${CONFIGS.length} configs\n`);

  const results: ConfigResult[] = [];
  for (const c of CONFIGS) {
    const r = runOne(c, entrants);
    results.push(r);
    console.log(`  ${pad(c.label, 26)}  top=${(r.topRate * 100).toFixed(0)}% bot=${(r.botRate * 100).toFixed(0)}% turns=${r.avgTurns.toFixed(1)}`);
  }

  console.log(`\n${pad('config', 26)} ${pad('top deck', 18)} ${pad('top%', 6)} ${pad('bot deck', 18)} ${pad('bot%', 6)} ${pad('spread', 7)} ${pad('avgT', 6)} ${pad('TL%', 5)} ${pad('Fat%', 5)} ${pad('Drw%', 5)} ${pad('Δhp', 5)}`);
  console.log('─'.repeat(110));
  for (const r of results) {
    console.log([
      pad(r.cfg.label, 26),
      pad(r.topLabel, 18),
      padL(`${(r.topRate * 100).toFixed(0)}%`, 6),
      pad(r.botLabel, 18),
      padL(`${(r.botRate * 100).toFixed(0)}%`, 6),
      padL(`${((r.topRate - r.botRate) * 100).toFixed(0)}pp`, 7),
      padL(r.avgTurns.toFixed(1), 6),
      padL(`${(r.hitLimitPct * 100).toFixed(0)}%`, 5),
      padL(`${(r.fatiguePct * 100).toFixed(0)}%`, 5),
      padL(`${(r.drawPct * 100).toFixed(0)}%`, 5),
      padL(r.avgHpDelta.toFixed(1), 5),
    ].join(' '));
  }

  console.log('\nLegend: TL% = matches hit turn limit; Fat% = matches w/ fatigue;');
  console.log('        Drw% = draws; Δhp = avg HP gap winner vs loser.');
  console.log('Health bands: TL% < 25% good; Fat% < 15% good; spread < 25pp good.\n');
}

main();
