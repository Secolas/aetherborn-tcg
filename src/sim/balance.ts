/**
 * Balance analysis sim. Runs 100 matches between every pair of "main"
 * decks (the 7 storyline bosses + the 3 pickable starter decks), then
 * surfaces metrics designers care about:
 *
 *   - Win rate per deck (mirror excluded) → tier list / outliers
 *   - Avg turn count per matchup        → pace check
 *   - % matches hitting TURN_LIMIT      → "drag" rate (should be <15%)
 *   - % matches ending by turn 5        → "stomp" rate (should be <15%)
 *   - Avg final HP-delta (winner−loser) → blowout detection
 *   - Fatigue-rate                      → does deck size starve play?
 *
 * The end of the script renders a designer-readable verdict on whether
 * TURN_LIMIT (12), MAX_HAND (7), or deck size (12) should change.
 *
 * Run via:  npx tsx src/sim/balance.ts
 */

import type { CollectionCard, MatchState, Owner } from '../game/types';
import { getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { BOSSES } from '../data/bosses';
import { STARTER_THEMES } from '../data/starterDecks';
import {
  createMatchFromDecks, endTurn,
  TURN_LIMIT, MAX_HAND, STARTING_HAND, STARTING_HP, type Rng,
} from '../game/match';
import { aiStep } from '../game/ai';
import { mulberry32 } from '../game/sim';

const MATCHES_PER_PAIR = 100;
const BASE_SEED = 4242;

// The "main" decks we balance against each other. Starter decks get a
// `starter-` prefix so they don't collide with boss ids.
type Entrant = { id: string; label: string; deck: string[] };

function buildEntrants(): Entrant[] {
  const out: Entrant[] = [];
  // Storyline bosses (skip tutorial-dummy + mini bosses).
  for (const b of BOSSES) {
    if (b.id === 'tutorial-dummy') continue;
    if (b.id.startsWith('mini-')) continue;
    out.push({ id: b.id, label: b.name, deck: b.deck });
  }
  // Starter decks (only the pickable three; retired starters are excluded
  // from balance ranks the same way they're excluded from the picker).
  for (const s of STARTER_THEMES) {
    if (s.id !== 'family' && s.id !== 'work' && s.id !== 'education') continue;
    out.push({ id: `starter-${s.id}`, label: `Starter: ${s.name}`, deck: s.deck });
  }
  return out;
}

function deckCards(e: Entrant): CollectionCard[] {
  return e.deck.map((tid, i) => {
    const t = getTemplateById(tid);
    if (!t) throw new Error(`Unknown template ${tid} in deck ${e.id}`);
    return { ...t, uid: `${e.id}_${i}_${tid}`, photo: aiPhoto(t.id), nickname: undefined };
  });
}

interface PairStats {
  matches: number;
  winsA: number;
  winsB: number;
  draws: number;
  turnsSum: number;
  hpDeltaSum: number;        // |winner HP − loser HP|, draws contribute 0
  turnLimitHits: number;     // matches that ended by hitting TURN_LIMIT
  fatigueHits: number;       // matches where at least one side took fatigue
  earlyStomps: number;       // matches ending by turn 5
}

function emptyPair(): PairStats {
  return {
    matches: 0, winsA: 0, winsB: 0, draws: 0,
    turnsSum: 0, hpDeltaSum: 0,
    turnLimitHits: 0, fatigueHits: 0, earlyStomps: 0,
  };
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

/** Run one match and emit detailed result fields the pair-stat accumulator
 *  needs. Mirrors simulateOne in src/game/sim.ts but exposes the extra
 *  signals (fatigue, turn-limit) that the balance pass cares about. */
function simulateMatch(
  deckA: CollectionCard[], deckB: CollectionCard[], seed: number,
): {
  outcome: 'A' | 'B' | 'draw';
  turns: number;
  hpA: number;
  hpB: number;
  fatigue: boolean;
  hitTurnLimit: boolean;
} {
  const rng: Rng = mulberry32(seed);
  let state = createMatchFromDecks(deckA, deckB, 'normal', rng);
  let steps = 0;
  const MAX_STEPS = 2000;
  while (state.outcome === 'ongoing' && steps < MAX_STEPS) {
    steps++;
    const next = stepActiveSide(state);
    state = next ?? endTurn(state);
  }
  const outcome: 'A' | 'B' | 'draw' =
    state.outcome === 'win'  ? 'A'
    : state.outcome === 'loss' ? 'B'
    : 'draw';
  return {
    outcome,
    turns: state.turnNumber,
    hpA: state.player.hp,
    hpB: state.opponent.hp,
    fatigue: state.player.fatigueCount > 0 || state.opponent.fatigueCount > 0,
    hitTurnLimit: state.turnNumber > TURN_LIMIT,
  };
}

function pct(n: number, d: number): string {
  if (!d) return ' --- ';
  return `${((n / d) * 100).toFixed(0).padStart(3)}%`;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function main() {
  console.log(`\n=== Memoria balance pass ===`);
  console.log(`STARTING_HP=${STARTING_HP}  STARTING_HAND=${STARTING_HAND}  MAX_HAND=${MAX_HAND}  TURN_LIMIT=${TURN_LIMIT}`);
  console.log(`Matches per pairing: ${MATCHES_PER_PAIR}  (seed family: ${BASE_SEED})\n`);

  const entrants = buildEntrants();
  const pair: Record<string, Record<string, PairStats>> = {};
  for (const a of entrants) {
    pair[a.id] = {};
    for (const b of entrants) pair[a.id][b.id] = emptyPair();
  }

  // Run every ordered (A,B) pairing including mirrors — mirrors are useful
  // for finding decks that beat themselves into a stall (high draw / high
  // turn-limit hits). We exclude them from the headline ranking later.
  for (const a of entrants) {
    const deckA = deckCards(a);
    for (const b of entrants) {
      const deckB = deckCards(b);
      const stats = pair[a.id][b.id];
      for (let i = 0; i < MATCHES_PER_PAIR; i++) {
        const seed = BASE_SEED + hash2(a.id, b.id) + i;
        const r = simulateMatch(deckA, deckB, seed);
        stats.matches++;
        if (r.outcome === 'A') stats.winsA++;
        else if (r.outcome === 'B') stats.winsB++;
        else stats.draws++;
        stats.turnsSum += r.turns;
        if (r.outcome !== 'draw') {
          stats.hpDeltaSum += Math.abs(r.hpA - r.hpB);
        }
        if (r.hitTurnLimit) stats.turnLimitHits++;
        if (r.fatigue) stats.fatigueHits++;
        if (r.outcome !== 'draw' && r.turns <= 5) stats.earlyStomps++;
      }
    }
  }

  // ─── Win-rate matrix (rows beat cols), excluding mirrors from the
  // overall ranking calculation ────────────────────────────────────────
  console.log('=== Win-rate matrix (row = deck A, col = deck B, 100 matches each) ===');
  const colW = 9;
  const headerCols = entrants.map(e => pad(shortId(e.id), colW)).join(' ');
  console.log(`${pad('', 16)} ${headerCols}`);
  for (const a of entrants) {
    const cells = entrants.map(b => {
      if (a.id === b.id) return pad('  --  ', colW);
      const s = pair[a.id][b.id];
      return pad(`  ${pct(s.winsA, s.matches)} `, colW);
    });
    console.log(`${pad(a.label, 16)} ${cells.join(' ')}`);
  }

  // ─── Headline ranking — average win rate across all non-mirror matchups
  const overall: Array<{ id: string; label: string; rate: number; }> = [];
  for (const a of entrants) {
    let wins = 0, total = 0;
    for (const b of entrants) {
      if (a.id === b.id) continue;
      wins += pair[a.id][b.id].winsA;
      total += pair[a.id][b.id].matches;
    }
    overall.push({ id: a.id, label: a.label, rate: wins / total });
  }
  overall.sort((x, y) => y.rate - x.rate);

  console.log('\n=== Deck ranking (excludes mirror matches) ===');
  console.log(`${pad('Rank', 5)} ${pad('Deck', 22)} ${pad('Win%', 7)} ${pad('Tier', 8)}`);
  overall.forEach((o, i) => {
    const winPct = (o.rate * 100).toFixed(1);
    const tier =
      o.rate >= 0.60 ? 'OP'
      : o.rate >= 0.55 ? 'Strong'
      : o.rate >= 0.45 ? 'Balanced'
      : o.rate >= 0.40 ? 'Weak'
      : 'Underpowered';
    console.log(`${pad(`#${i + 1}`, 5)} ${pad(o.label, 22)} ${pad(`${winPct}%`, 7)} ${pad(tier, 8)}`);
  });

  // ─── Pacing — avg turns + turn-limit / stomp / fatigue rates ───────
  let allMatches = 0, allTurns = 0, allTurnLimit = 0, allFatigue = 0, allDraws = 0, allStomps = 0, allHpDelta = 0, allNonDraw = 0;
  for (const a of entrants) for (const b of entrants) {
    if (a.id === b.id) continue;
    const s = pair[a.id][b.id];
    allMatches += s.matches;
    allTurns += s.turnsSum;
    allTurnLimit += s.turnLimitHits;
    allFatigue += s.fatigueHits;
    allDraws += s.draws;
    allStomps += s.earlyStomps;
    allHpDelta += s.hpDeltaSum;
    allNonDraw += (s.matches - s.draws);
  }

  console.log('\n=== Pacing metrics (all non-mirror matches) ===');
  console.log(`  Total matches simulated:   ${allMatches}`);
  console.log(`  Avg turns / match:         ${(allTurns / allMatches).toFixed(2)} (TURN_LIMIT=${TURN_LIMIT})`);
  console.log(`  Hit turn limit:            ${pct(allTurnLimit, allMatches)} ${flag(allTurnLimit / allMatches, 0.15, 'high', 0.05, 'low')}`);
  console.log(`  Early stomp (≤ turn 5):    ${pct(allStomps, allMatches)} ${flag(allStomps / allMatches, 0.15, 'high', 0.05, 'low')}`);
  console.log(`  Fatigue triggered:         ${pct(allFatigue, allMatches)} ${flag(allFatigue / allMatches, 0.25, 'high', 0.05, 'low')}`);
  console.log(`  Draws:                     ${pct(allDraws, allMatches)} ${flag(allDraws / allMatches, 0.08, 'high', 0, '')}`);
  console.log(`  Avg HP delta (non-draw):   ${(allHpDelta / Math.max(1, allNonDraw)).toFixed(1)} HP (closer to 0 = closer games)`);

  // ─── Designer verdict ──────────────────────────────────────────────
  console.log('\n=== Verdict ===');
  const turnLimitRate = allTurnLimit / allMatches;
  const stompRate = allStomps / allMatches;
  const fatigueRate = allFatigue / allMatches;
  const avgTurns = allTurns / allMatches;

  // TURN_LIMIT recommendation
  if (turnLimitRate >= 0.20) {
    console.log(`  • TURN_LIMIT (${TURN_LIMIT}): too short — ${(turnLimitRate * 100).toFixed(0)}% of games end by guillotine. Consider 14–15.`);
  } else if (turnLimitRate >= 0.10) {
    console.log(`  • TURN_LIMIT (${TURN_LIMIT}): borderline — ${(turnLimitRate * 100).toFixed(0)}% of games hit it. Watch but no change needed.`);
  } else if (avgTurns < 7) {
    console.log(`  • TURN_LIMIT (${TURN_LIMIT}): unused — avg game ends turn ${avgTurns.toFixed(1)}. Could be lowered, but slack helps slow decks.`);
  } else {
    console.log(`  • TURN_LIMIT (${TURN_LIMIT}): healthy — only ${(turnLimitRate * 100).toFixed(0)}% guillotine, avg ${avgTurns.toFixed(1)} turns.`);
  }

  // MAX_HAND recommendation
  if (stompRate >= 0.25) {
    console.log(`  • MAX_HAND (${MAX_HAND}) / STARTING_HAND (${STARTING_HAND}): aggression too strong — ${(stompRate * 100).toFixed(0)}% stomps by turn 5. Consider lowering STARTING_HAND to 3 to slow openers.`);
  } else if (stompRate <= 0.03 && turnLimitRate >= 0.15) {
    console.log(`  • MAX_HAND (${MAX_HAND}) / STARTING_HAND (${STARTING_HAND}): control too strong — almost no early kills, lots of grind. Consider raising STARTING_HAND to 5 to enable openers.`);
  } else {
    console.log(`  • MAX_HAND (${MAX_HAND}) / STARTING_HAND (${STARTING_HAND}): looks reasonable.`);
  }

  // Deck size recommendation
  const deckLen = entrants[0].deck.length; // bosses + starters are all 12
  if (fatigueRate >= 0.40) {
    console.log(`  • Deck size (${deckLen}): too small — ${(fatigueRate * 100).toFixed(0)}% of games hit fatigue. Consider 15 cards.`);
  } else if (fatigueRate >= 0.20) {
    console.log(`  • Deck size (${deckLen}): borderline — ${(fatigueRate * 100).toFixed(0)}% fatigue. OK but could nudge up to 14.`);
  } else {
    console.log(`  • Deck size (${deckLen}): healthy — only ${(fatigueRate * 100).toFixed(0)}% fatigue.`);
  }

  // Closeness recommendation
  const avgHpDelta = allHpDelta / Math.max(1, allNonDraw);
  if (avgHpDelta > 12) {
    console.log(`  • Avg HP delta ${avgHpDelta.toFixed(1)} — games are blowouts. Some decks are over/underpowered.`);
  } else if (avgHpDelta < 4) {
    console.log(`  • Avg HP delta ${avgHpDelta.toFixed(1)} — most matches end on the wire. Excellent closeness.`);
  } else {
    console.log(`  • Avg HP delta ${avgHpDelta.toFixed(1)} — reasonable spread (decisive but not lopsided).`);
  }

  // Outlier deck flag
  const top = overall[0], bottom = overall[overall.length - 1];
  if (top.rate - bottom.rate > 0.30) {
    console.log(`  • Spread: ${top.label} (${(top.rate * 100).toFixed(0)}%) vs ${bottom.label} (${(bottom.rate * 100).toFixed(0)}%) — ${((top.rate - bottom.rate) * 100).toFixed(0)} pp gap. Buff bottom or nerf top.`);
  } else if (top.rate - bottom.rate > 0.20) {
    console.log(`  • Spread: ${top.label} → ${bottom.label} is ${((top.rate - bottom.rate) * 100).toFixed(0)} pp — borderline acceptable.`);
  } else {
    console.log(`  • Spread: top ${(top.rate * 100).toFixed(0)}% → bottom ${(bottom.rate * 100).toFixed(0)}% — tight ranking.`);
  }

  console.log('');
}

function shortId(id: string): string {
  if (id.startsWith('starter-')) return `S:${id.slice(8, 12)}`;
  return id.slice(0, 8);
}

function hash2(a: string, b: string): number {
  let h = 2166136261 >>> 0;
  for (const ch of `${a}|${b}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h & 0xffff;
}

function flag(rate: number, hiThreshold: number, hiLabel: string, loThreshold: number, loLabel: string): string {
  if (rate >= hiThreshold) return `← ${hiLabel}`;
  if (loLabel && rate <= loThreshold) return `← ${loLabel}`;
  return '';
}

main();
