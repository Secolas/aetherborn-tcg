import type { CollectionCard, Rarity } from './types';

/**
 * Per-rarity copy caps inside a single 12-card deck. Graduated so that
 * common fillers can stack for curve consistency, rares can pair for
 * bond synergies (Cousin x2 = "The Kids", Toast x2 = "Breakfast Combo"),
 * and premium-rarity cards stay singular finishers.
 *
 * Same rule applies to player decks, boss decks (Normal/Hard/Mythic),
 * and campaign mini-boss decks. The tutorial dummy is the one
 * documented exemption — its scripted deck is intentionally 10x Mouse
 * and is flagged with `ignoreDeckRules` on its BossDef.
 */
export const MAX_COPIES_PER_RARITY: Record<Rarity, number> = {
  common: 3,
  rare: 2,
  epic: 1,
  legendary: 1,
};

export function maxCopiesForRarity(rarity: Rarity): number {
  return MAX_COPIES_PER_RARITY[rarity];
}

/** How many copies of `templateId` are already in the deck. */
export function countCopiesInDeck(
  deckUids: string[],
  collection: CollectionCard[],
  templateId: string,
): number {
  let n = 0;
  for (const uid of deckUids) {
    const c = collection.find(x => x.uid === uid);
    if (c && c.id === templateId) n++;
  }
  return n;
}

/** True when another copy of `card`'s template can still be added. */
export function canAddCopy(
  deckUids: string[],
  collection: CollectionCard[],
  card: CollectionCard,
): boolean {
  const cap = maxCopiesForRarity(card.rarity);
  return countCopiesInDeck(deckUids, collection, card.id) < cap;
}
