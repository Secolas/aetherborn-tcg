/**
 * "Power Deck" — cross-theme stat-stick build. Ignores the storyline
 * theme/flavor constraints; picks the most cost-efficient creature and
 * spell at each curve slot, respects only the universal rarity caps
 * (3/2/1/1 for common/rare/epic/legendary).
 *
 * Tested against the same 10-deck field as src/sim/balance.ts so the
 * win-rate comparison is apples-to-apples with the current meta.
 *
 * Composition rationale:
 *
 *   2x fam-01 Family Pet       (1c 2/1 Rush, rare)
 *     The only 1-cost Rush 2/1. Two face damage on T1 = +11% of opp's HP.
 *
 *   2x trv-02 Carry-On         (2c 1/2 Untargetable, rare)
 *     Spell-proof body that has to be answered with creatures.
 *
 *   2x ani-04 Cat              (3c 2/2 Untargetable, rare)
 *     Same protection at 3-mana, same body as Carry-On.
 *
 *   2x ani-02 Snake Bite       (2c spell, 3 dmg, common)
 *     Removes most 2-drops + chips face.
 *
 *   2x wrk-06 Sales Pitch      (3c spell, 4 dmg, common)
 *     One-shots almost every 3-drop in the game and burns 4 face.
 *
 *   1x trv-13 Ticket Stub      (1c spell, draw 1, common)
 *     Cycle / curve enabler.
 *
 *   1x ani-12 Lion             (6c 6/6, AOE 1 on play, legendary)
 *     Closer: 6/6 body that also clears 1-HP boards on landing.
 *
 * Hypothesis: aggressive curve + 14 face/removal burn + 4 untargetable
 * bodies should crack 60% across the field — "broken" by the balance
 * pass's own tier list (≥60% = OP).
 *
 * Run via:  npx tsx src/sim/power-deck.ts
 */

import type { CollectionCard, MatchState, Owner } from '../game/types';
import { getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { BOSSES } from '../data/bosses';
import { STARTER_THEMES } from '../data/starterDecks';
import { createMatchFromDecks, endTurn, TURN_LIMIT, type Rng } from '../game/match';
import { aiStep } from '../game/ai';
import { mulberry32 } from '../game/sim';

const POWER_DECK: string[] = [
  'fam-01', 'fam-01',
  'trv-02', 'trv-02',
  'ani-04', 'ani-04',
  'ani-02', 'ani-02',
  'wrk-06', 'wrk-06',
  'trv-13',
  'ani-12',
];

const MATCHES_PER_OPP = 100;
const BASE_SEED = 9001;

type Entrant = { id: string; label: string; deck: string[] };

function buildField(): Entrant[] {
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

function makeDeck(prefix: string, ids: string[]): CollectionCard[] {
  return ids.map((tid, i) => {
    const t = getTemplateById(tid);
    if (!t) throw new Error(`Unknown template ${tid}`);
    return { ...t, uid: `${prefix}_${i}_${tid}`, photo: aiPhoto(t.id), nickname: undefined };
  });
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

function simulateMatch(deckA: CollectionCard[], deckB: CollectionCard[], seed: number) {
  const rng: Rng = mulberry32(seed);
  let state = createMatchFromDecks(deckA, deckB, 'normal', rng);
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
    hitTurnLimit: state.turnNumber > TURN_LIMIT,
  };
}

function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }
function padL(s: string, n: number) { return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s; }

function main() {
  const field = buildField();
  const power = makeDeck('PWR', POWER_DECK);

  console.log(`\n=== Power Deck vs the field ===`);
  console.log('Composition (12 cards, cross-theme, respects rarity caps):');
  for (const id of POWER_DECK) {
    const t = getTemplateById(id)!;
    const body = t.type === 'Creature' ? `${t.atk}/${t.hp}` : 'spell';
    console.log(`  ${t.cost}c  ${pad(t.name, 18)} ${pad(body, 8)} ${pad(t.ability || '', 32)} (${t.rarity})`);
  }
  console.log(`\n${MATCHES_PER_OPP} matches per opponent (${field.length} opponents = ${field.length * MATCHES_PER_OPP} matches)\n`);

  console.log(`${pad('Opponent', 22)} ${pad('Win%', 7)} ${pad('AvgTurns', 9)} ${pad('TL hit', 7)}`);
  console.log('─'.repeat(55));

  let totalWins = 0, totalMatches = 0, totalTurns = 0, totalTL = 0;
  const rows: Array<{ label: string; wr: number; avgT: number; tl: number }> = [];

  for (const opp of field) {
    const oppDeck = makeDeck(opp.id, opp.deck);
    let wins = 0, draws = 0, turns = 0, tl = 0;
    for (let i = 0; i < MATCHES_PER_OPP; i++) {
      const r = simulateMatch(power, oppDeck, BASE_SEED + i + opp.id.charCodeAt(0));
      if (r.outcome === 'A') wins++;
      else if (r.outcome === 'draw') draws++;
      turns += r.turns;
      if (r.hitTurnLimit) tl++;
    }
    const wr = wins / MATCHES_PER_OPP;
    rows.push({ label: opp.label, wr, avgT: turns / MATCHES_PER_OPP, tl });
    totalWins += wins;
    totalMatches += MATCHES_PER_OPP;
    totalTurns += turns;
    totalTL += tl;
  }

  // Sort by win rate descending so the "easiest matchups" are at the top.
  rows.sort((a, b) => b.wr - a.wr);
  for (const r of rows) {
    console.log(`${pad(r.label, 22)} ${padL(`${(r.wr * 100).toFixed(0)}%`, 7)} ${padL(r.avgT.toFixed(1), 9)} ${padL(`${r.tl}%`, 7)}`);
  }

  console.log('─'.repeat(55));
  const overall = totalWins / totalMatches;
  console.log(`${pad('OVERALL', 22)} ${padL(`${(overall * 100).toFixed(1)}%`, 7)} ${padL((totalTurns / totalMatches).toFixed(1), 9)} ${padL(`${((totalTL / totalMatches) * 100).toFixed(0)}%`, 7)}`);

  console.log('\n=== Tier verdict ===');
  const tier =
    overall >= 0.65 ? 'BROKEN — needs nerf before public release'
    : overall >= 0.60 ? 'OP — strongest deck in the game'
    : overall >= 0.55 ? 'Strong — tier 1 but beatable'
    : overall >= 0.45 ? 'Balanced — sits in the existing pack'
    : 'Underperforms';
  console.log(`  ${(overall * 100).toFixed(1)}% across the field → ${tier}`);

  // Context — top live deck in the meta (Mom) is at ~54%
  console.log(`  Reference: top live deck (Mom) ≈ 54%, bottom (Manager) ≈ 43%.`);
}

main();
