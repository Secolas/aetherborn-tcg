/**
 * Victory emotes — short, cosmetic exclamations shown on the match-end
 * overlay when the player wins. Equipped globally (one emote per save).
 * Pure cosmetic; never alters rewards or anything mechanical.
 *
 * Each emote has a headline string and an optional sub-line that drops
 * in just after. Animation handled by the match-end overlay so we don't
 * carry per-emote keyframes here.
 */

export type EmoteId = 'gg' | 'sealed' | 'photofinish';

export interface EmoteDef {
  id: EmoteId;
  name: string;
  description: string;
  cost: number;
  headline: string;
  sub?: string;
  /** Optional accent color for the headline glow. */
  glow?: string;
}

export const EMOTES: Record<EmoteId, EmoteDef> = {
  gg: {
    id: 'gg',
    name: 'GG',
    description: 'Classic good-game sign-off.',
    cost: 0,
    headline: 'GG!',
    sub: 'Well played.',
    glow: '#ffd166',
  },
  sealed: {
    id: 'sealed',
    name: 'Sealed It',
    description: 'For when you stuck the landing.',
    cost: 200,
    headline: 'Sealed it!',
    sub: 'No notes.',
    glow: '#06d6a0',
  },
  photofinish: {
    id: 'photofinish',
    name: 'Photo Finish',
    description: 'Lean into the personal-photo theme.',
    cost: 250,
    headline: 'Photo Finish!',
    sub: 'One for the album.',
    glow: '#ff7e5f',
  },
};

export const EMOTE_ORDER: EmoteId[] = ['gg', 'sealed', 'photofinish'];
export const STARTER_EMOTES: EmoteId[] = ['gg'];

export function getEmote(id: EmoteId | undefined): EmoteDef {
  return EMOTES[id ?? 'gg'] ?? EMOTES.gg;
}
