import { TEMPLATES, templatesByTheme, templatesByPool } from '../data/templates';
import { RARITY_WEIGHT } from '../data/elements';
import { getMemoryPack } from '../data/memoryPacks';
import type { CardTemplate, CollectionCard, ElementId, Rarity } from './types';

export const PACK_SIZE = 3;
export const PACK_COST = 100;
export const STARTER_REWARD = 200;
export const MATCH_WIN_REWARD = 75;
export const MATCH_LOSS_REWARD = 20;
export const MATCH_DRAW_REWARD = 40;

/**
 * Element-pack legendary pity threshold. After this many element packs
 * without rolling a legendary, the next pack's guaranteed slot is
 * forced to be a legendary. Memory packs never roll legendaries, so
 * they neither increment nor consume pity.
 */
export const PITY_THRESHOLD = 25;

/**
 * Memory pack rarity weights — legendary is omitted entirely (memory
 * packs are the "focused / mini" packs and are cheaper than element
 * packs, so they top out at epic), and epic is sharply dialed down vs
 * the element-pack weights so the rare-or-epic guaranteed slot stays
 * mostly rare and the player has to grind for the epic payoff.
 *
 * Element packs continue to use RARITY_WEIGHT (60/28/10/2).
 */
const MEMORY_RARITY_WEIGHT: Record<Rarity, number> = {
  common: 65,
  rare: 30,
  epic: 5,
  legendary: 0,
};

function newUid(): string {
  return `c_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function toCollection(t: CardTemplate): CollectionCard {
  return { ...t, uid: newUid(), photo: null };
}

function pickWeightedFrom(pool: CardTemplate[], weights: Record<Rarity, number>): CardTemplate {
  const ws = pool.map(t => weights[t.rarity] ?? 0);
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= ws[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function pickWeighted(pool: CardTemplate[]): CardTemplate {
  return pickWeightedFrom(pool, RARITY_WEIGHT as Record<Rarity, number>);
}

function pickAtLeast(pool: CardTemplate[], minRarity: Rarity, weights: Record<Rarity, number> = RARITY_WEIGHT as Record<Rarity, number>): CardTemplate {
  const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const minIdx = order.indexOf(minRarity);
  const filtered = pool.filter(t => order.indexOf(t.rarity) >= minIdx);
  return pickWeightedFrom(filtered.length > 0 ? filtered : pool, weights);
}

export interface OpenPackResult {
  cards: CollectionCard[];
  /** New pity counter to persist on the save. Reset to 0 when the pack
   *  rolled a legendary (either by pity force or natural luck), else
   *  incremented by 1. */
  pity: number;
}

/**
 * Open an element pack: 3 cards from the chosen theme, all dormant.
 *
 * Rarity rules:
 *   - Slots 1 & 2: weighted pick from commons / rares / epics only.
 *     Legendaries can only appear in slot 3 — caps the pack at one
 *     legendary, which is what the design calls for ("only 1 legendary
 *     for theme pack").
 *   - Slot 3: guaranteed rare+, with a pity override — once the player
 *     has opened PITY_THRESHOLD element packs without seeing a
 *     legendary, this slot is forced to a uniform-random legendary
 *     from the theme.
 */
export function openPack(theme: ElementId, currentPity: number = 0): OpenPackResult {
  const pool = templatesByTheme(theme);
  const nonLegendary = pool.filter(t => t.rarity !== 'legendary');
  const cards: CollectionCard[] = [];
  for (let i = 0; i < PACK_SIZE - 1; i++) {
    cards.push(toCollection(pickWeighted(nonLegendary)));
  }
  const nextPity = currentPity + 1;
  let guaranteed: CardTemplate;
  if (nextPity >= PITY_THRESHOLD) {
    const legendaries = pool.filter(t => t.rarity === 'legendary');
    guaranteed = legendaries.length > 0
      ? legendaries[Math.floor(Math.random() * legendaries.length)]
      : pickAtLeast(pool, 'rare');
  } else {
    guaranteed = pickAtLeast(pool, 'rare');
  }
  cards.push(toCollection(guaranteed));
  const gotLegendary = cards.some(c => c.rarity === 'legendary');
  return { cards, pity: gotLegendary ? 0 : nextPity };
}

/**
 * Open a Memory Pack: 3 cards drawn from the pack's curated pool (see
 * memoryPacks.ts — built from element themes + tag filters so the Pet
 * pack is actually pets, not lions and wolves).
 *
 * Memory packs NEVER roll legendaries — they're the focused / cheaper
 * "mini packs" and their pool is narrower, so making legendaries
 * exclusive to element packs preserves the chase. The guaranteed slot
 * is still rare+, but capped at epic via the memory-specific weights.
 */
export function openMemoryPack(packId: string): CollectionCard[] {
  const def = getMemoryPack(packId);
  if (!def) return [];
  const pool = templatesByPool(def.pool).filter(t => t.rarity !== 'legendary');
  if (pool.length === 0) return [];
  const cards: CollectionCard[] = [];
  for (let i = 0; i < PACK_SIZE - 1; i++) {
    const t = pickWeightedFrom(pool, MEMORY_RARITY_WEIGHT);
    cards.push(toCollection(t));
  }
  const guaranteed = pickAtLeast(pool, 'rare', MEMORY_RARITY_WEIGHT);
  cards.push(toCollection(guaranteed));
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
