import { TEMPLATES } from '../data/templates';
import { RARITY_WEIGHT } from '../data/elements';
import type { CardTemplate, CollectionCard, Rarity } from './types';

export const PACK_SIZE = 5;
export const PACK_COST = 100;
export const STARTER_REWARD = 200;   // coins given on first launch
export const MATCH_WIN_REWARD = 75;
export const MATCH_LOSS_REWARD = 20;

function newUid(): string {
  return `c_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function pickWeighted(pool: CardTemplate[]): CardTemplate {
  const weights = pool.map(t => RARITY_WEIGHT[t.rarity]);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function pickAtLeast(pool: CardTemplate[], minRarity: Rarity): CardTemplate {
  const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const minIdx = order.indexOf(minRarity);
  const filtered = pool.filter(t => order.indexOf(t.rarity) >= minIdx);
  return pickWeighted(filtered);
}

/**
 * Open a pack: 5 cards, all dormant. Guaranteed at least one rare+.
 */
export function openPack(): CollectionCard[] {
  const cards: CollectionCard[] = [];
  for (let i = 0; i < PACK_SIZE - 1; i++) {
    const t = pickWeighted(TEMPLATES);
    cards.push({ ...t, uid: newUid(), photo: null });
  }
  // Last slot: guaranteed rare+
  const guaranteed = pickAtLeast(TEMPLATES, 'rare');
  cards.push({ ...guaranteed, uid: newUid(), photo: null });
  return cards;
}

/** Starter pack: a fixed handful of low-cost cards so a new player can build a deck. */
export function starterPack(): CollectionCard[] {
  const ids = ['em-01', 'em-02', 'gu-02', 'bl-01', 'bl-02', 'ti-01', 'em-05', 'vo-04'];
  return ids
    .map(id => TEMPLATES.find(t => t.id === id))
    .filter((t): t is CardTemplate => !!t)
    .map(t => ({ ...t, uid: newUid(), photo: null }));
}
