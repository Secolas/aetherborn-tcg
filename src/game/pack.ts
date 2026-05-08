import { TEMPLATES, templatesByTheme } from '../data/templates';
import { RARITY_WEIGHT } from '../data/elements';
import type { CardTemplate, CollectionCard, ElementId, Rarity } from './types';

export const PACK_SIZE = 3;
export const PACK_COST = 100;
export const STARTER_REWARD = 200;
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
  return pickWeighted(filtered.length > 0 ? filtered : pool);
}

/**
 * Open a themed pack: 3 cards from the chosen theme, all dormant.
 * One slot is guaranteed rare+ so opening always feels good.
 */
export function openPack(theme: ElementId): CollectionCard[] {
  const pool = templatesByTheme(theme);
  const cards: CollectionCard[] = [];
  for (let i = 0; i < PACK_SIZE - 1; i++) {
    const t = pickWeighted(pool);
    cards.push({ ...t, uid: newUid(), photo: null });
  }
  const guaranteed = pickAtLeast(pool, 'rare');
  cards.push({ ...guaranteed, uid: newUid(), photo: null });
  return cards;
}

/**
 * Starter pack: a coherent Family deck so a new player can immediately
 * photograph their family and play a match. Family is the most universal
 * theme (everyone has one, even if complicated).
 */
export function starterPack(): CollectionCard[] {
  const ids = [
    'fam-01', // Family Pet — 1c rush
    'fam-02', // Cousin — 2c rush
    'fam-03', // Abuela's Soup — 2c heal
    'fam-04', // Tio — 3c draw
    'fam-05', // Mom — 3c body
    'fam-06', // The Look — 3c freeze
    'fam-07', // Older Sibling — 4c body
    'fam-09', // Birthday Cake — 4c heal
  ];
  return ids
    .map(id => TEMPLATES.find(t => t.id === id))
    .filter((t): t is CardTemplate => !!t)
    .map(t => ({ ...t, uid: newUid(), photo: null }));
}
