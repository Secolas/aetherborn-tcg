import { type ReactNode } from 'react';
import { CosmeticsContext } from './cosmeticsContext';
import { type FrameId } from '../data/frames';
import { type BoardSkinId } from '../data/boardSkins';
import { type EmoteId } from '../data/victoryEmotes';

/**
 * Wraps the app and publishes the player's currently-equipped cosmetics to
 * the context. The Card component / MatchBoard / match-end overlay read
 * the values via useCosmetics from cosmeticsContext.ts.
 */
interface ProviderProps {
  frame?: FrameId;
  boardSkin?: BoardSkinId;
  emote?: EmoteId;
  children: ReactNode;
}

export function CosmeticsProvider({ frame, boardSkin, emote, children }: ProviderProps) {
  return (
    <CosmeticsContext.Provider value={{
      frame: frame ?? 'classic',
      boardSkin: boardSkin ?? 'daylight',
      emote: emote ?? 'gg',
    }}>
      {children}
    </CosmeticsContext.Provider>
  );
}
