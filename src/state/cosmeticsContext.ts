import { createContext, useContext } from 'react';
import { type FrameId } from '../data/frames';
import { type BoardSkinId } from '../data/boardSkins';
import { type EmoteId } from '../data/victoryEmotes';

/**
 * Context primitive + read hook for globally-equipped cosmetics. Lives in
 * its own .ts file (no JSX) so React Fast Refresh stays happy — the
 * Provider component is in cosmetics.tsx and imports from here.
 *
 * Default values match the starter cosmetics so any consumer rendered
 * outside the provider (storybook, tests, dev tools) still works.
 */
export interface CosmeticsCtx {
  frame: FrameId;
  boardSkin: BoardSkinId;
  emote: EmoteId;
}

export const DEFAULT_COSMETICS: CosmeticsCtx = {
  frame: 'classic',
  boardSkin: 'daylight',
  emote: 'gg',
};

export const CosmeticsContext = createContext<CosmeticsCtx>(DEFAULT_COSMETICS);

export function useCosmetics(): CosmeticsCtx {
  return useContext(CosmeticsContext);
}
