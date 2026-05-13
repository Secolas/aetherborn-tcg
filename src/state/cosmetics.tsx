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
  /** When true, the equipped frame is applied to player Card renders.
   *  Defaults to false at the app root so frames don't bleed into
   *  Collection, DeckBuilder, Capture, or the Cosmetics locker. The
   *  MatchBoard wraps its match UI with a nested provider that flips
   *  this to true. */
  inMatch?: boolean;
  children: ReactNode;
}

export function CosmeticsProvider({ frame, boardSkin, emote, inMatch = false, children }: ProviderProps) {
  return (
    <CosmeticsContext.Provider value={{
      frame: frame ?? 'classic',
      boardSkin: boardSkin ?? 'daylight',
      emote: emote ?? 'gg',
      inMatch,
    }}>
      {children}
    </CosmeticsContext.Provider>
  );
}
