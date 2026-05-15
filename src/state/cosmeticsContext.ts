import { createContext, useContext } from 'react';
import { type FrameId } from '../data/frames';
import { type BoardSkinId } from '../data/boardSkins';
import { type EmoteId } from '../data/victoryEmotes';
import { type CardBackId, DEFAULT_CARD_BACK } from '../data/cardBacks';

/**
 * Context primitive + read hook for globally-equipped cosmetics. Lives in
 * its own .ts file (no JSX) so React Fast Refresh stays happy — the
 * Provider component is in cosmetics.tsx and imports from here.
 *
 * Default values match the starter cosmetics so any consumer rendered
 * outside the provider (storybook, tests, dev tools) still works.
 *
 * `inMatch` gates frame cosmetics specifically: frames are intended to
 * decorate the player's cards during an actual match, not in the
 * Collection / DeckBuilder / Capture browsing surfaces. The MatchBoard
 * wraps its render with a nested provider that flips inMatch to true.
 * Board-skin and emote are match-only by nature already, so they don't
 * need their own gate.
 */
export interface CosmeticsCtx {
  frame: FrameId;
  boardSkin: BoardSkinId;
  emote: EmoteId;
  /** Equipped face-down card-back template. Read by CardBack. */
  cardBack: CardBackId;
  inMatch: boolean;
}

export const DEFAULT_COSMETICS: CosmeticsCtx = {
  frame: 'classic',
  boardSkin: 'daylight',
  emote: 'gg',
  cardBack: DEFAULT_CARD_BACK,
  inMatch: false,
};

export const CosmeticsContext = createContext<CosmeticsCtx>(DEFAULT_COSMETICS);

export function useCosmetics(): CosmeticsCtx {
  return useContext(CosmeticsContext);
}
