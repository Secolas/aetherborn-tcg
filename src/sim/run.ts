/**
 * Headless sim runner. Builds two sample decks from existing boss
 * templates and prints a JSON summary of a batch of matches.
 *
 * Run with a TS-aware runner (e.g. `npx tsx src/sim/run.ts`) — there's
 * no build step required for the sim itself, but the project doesn't
 * ship a tsx dep so `npm run build` covers the type-check path.
 */

import type { CollectionCard } from '../game/types';
import { getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { BOSSES } from '../data/bosses';
import { simulateBatch } from '../game/sim';

/** Turn a list of template ids into a playable CollectionCard deck.
 *  Photos come from the same sample-photo table the AI uses for its
 *  bosses, so every card has a valid placeholder. */
function deckFromTemplateIds(ids: string[], prefix: string): CollectionCard[] {
  const out: CollectionCard[] = [];
  ids.forEach((tid, i) => {
    const t = getTemplateById(tid);
    if (!t) return;
    out.push({
      ...t,
      uid: `${prefix}_${i}_${tid}`,
      photo: aiPhoto(tid),
      nickname: undefined,
    });
  });
  return out;
}

function pickBossDeck(id: string): string[] {
  const b = BOSSES.find(x => x.id === id);
  if (!b) throw new Error(`No boss ${id}`);
  return b.deck;
}

function main() {
  // Mom (family/heal) vs Pack Alpha (animals/aggro) — established curated
  // 12-card lists; both expose interesting bond synergies.
  const deckA = deckFromTemplateIds(pickBossDeck('mom'), 'A');
  const deckB = deckFromTemplateIds(pickBossDeck('alpha'), 'B');

  const summary = simulateBatch(deckA, deckB, {
    matches: 100,
    seed: 42,
    difficulty: 'normal',
  });

  const out = {
    deckA: 'mom',
    deckB: 'alpha',
    difficulty: 'normal' as const,
    ...summary,
  };
  // Headless — print and exit.
  console.log(JSON.stringify(out, null, 2));
}

main();
