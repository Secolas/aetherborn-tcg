/**
 * Round-robin sim. Every boss deck vs every other boss deck. Prints a
 * win-rate matrix (rows = deckA, cols = deckB) and an overall ranking.
 * Throwaway dev script — run via `npx tsx src/sim/round-robin.ts`.
 */

import type { CollectionCard } from '../game/types';
import { getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { BOSSES } from '../data/bosses';
import { simulateBatch } from '../game/sim';

function deckFor(id: string): CollectionCard[] {
  const b = BOSSES.find(x => x.id === id);
  if (!b) throw new Error(`No boss ${id}`);
  return b.deck.map((tid, i) => {
    const t = getTemplateById(tid)!;
    return { ...t, uid: `${id}_${i}_${tid}`, photo: aiPhoto(tid), nickname: undefined };
  });
}

const ids = BOSSES.map(b => b.id);
const MATCHES = 50;
const SEED = 1000;

const matrix: Record<string, Record<string, number>> = {};
const turnsMatrix: Record<string, Record<string, number>> = {};

for (const a of ids) {
  matrix[a] = {};
  turnsMatrix[a] = {};
  for (const b of ids) {
    const summary = simulateBatch(deckFor(a), deckFor(b), {
      matches: MATCHES, seed: SEED, difficulty: 'normal',
    });
    matrix[a][b] = summary.winRate;
    turnsMatrix[a][b] = summary.avgTurns;
  }
}

// Overall win rate per deck (averaged across all matchups, excluding mirror).
const overall: Array<{ id: string; rate: number }> = [];
for (const a of ids) {
  let sum = 0, n = 0;
  for (const b of ids) {
    if (a === b) continue;
    sum += matrix[a][b];
    n++;
  }
  overall.push({ id: a, rate: sum / n });
}
overall.sort((x, y) => y.rate - x.rate);

console.log('=== Win-rate matrix (row beats col, normal difficulty, 50 matches per cell) ===');
const header = ['         ', ...ids.map(i => i.padEnd(10))].join('');
console.log(header);
for (const a of ids) {
  const row = [a.padEnd(9), ...ids.map(b => {
    const v = matrix[a][b];
    return (a === b ? '   —      ' : `   ${(v * 100).toFixed(0).padStart(3)}%   `);
  })].join('');
  console.log(row);
}

console.log('\n=== Overall win rate (excludes mirror matches) ===');
for (const o of overall) {
  console.log(`  ${o.id.padEnd(10)} ${(o.rate * 100).toFixed(1)}%`);
}

console.log('\n=== Avg turns per matchup ===');
console.log(header);
for (const a of ids) {
  const row = [a.padEnd(9), ...ids.map(b => `   ${turnsMatrix[a][b].toFixed(1).padStart(4)}   `)].join('');
  console.log(row);
}
