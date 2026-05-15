/**
 * Face-down card. Renders one of the equippable back templates from
 * `src/data/cardBacks.ts`. Default is the navy/diamond design used by
 * both the player's draws and the boss's deck.
 *
 *   - `side`     hints which player owns this draw. Reserved so future
 *                "boss-only" backs (e.g. a black-and-red boss back the
 *                player can't equip) can render distinctly.
 *   - `variant`  explicit override of the back template. The player's
 *                equipped back comes through CosmeticsContext when no
 *                variant is passed.
 */
import { CARD_BACKS, type CardBackId, DEFAULT_CARD_BACK } from '../data/cardBacks';
import { useCosmetics } from '../state/cosmeticsContext';

export type { CardBackId } from '../data/cardBacks';

interface Props {
  scale?: number;
  /** Slight rotation for the fanned hand effect. */
  rotate?: number;
  /** Which side is drawing. Player draws fall back to the equipped
   *  cosmetic; opponent draws always render the default until a future
   *  boss-back system swaps them. */
  side?: 'player' | 'opponent';
  /** Explicit template override — wins over context + side defaults. */
  variant?: CardBackId;
}

export function CardBack({ scale = 0.34, rotate = 0, side = 'opponent', variant }: Props) {
  const cosm = useCosmetics();
  // Player draws pick up the equipped cosmetic back. Opponent draws
  // stay on the default — keeps the boss's "their deck looks like
  // theirs, not yours" feel intact and is easy to extend later.
  const resolved: CardBackId =
    variant
    ?? (side === 'player' ? (cosm.cardBack ?? DEFAULT_CARD_BACK) : DEFAULT_CARD_BACK);
  const def = CARD_BACKS[resolved] ?? CARD_BACKS[DEFAULT_CARD_BACK];
  return def.render({ scale, rotate });
}
