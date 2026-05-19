import type { ComponentType } from 'react';
import {
  PartyPopper, ThumbsUp, Frown, Brain, Flame, Heart,
} from 'lucide-react';

/**
 * In-match chat emotes — short reactions a player can send mid-PVP by
 * long-pressing their own portrait. Distinct from victory emotes
 * (src/data/victoryEmotes.ts) which fire on the post-match overlay.
 *
 * v1: 6 emotes, all free for every player. No shop / equip /
 * customization UI yet — every player can send any of these. Shop
 * integration can layer on later by gating the set on a save field.
 */

export type ChatEmoteId = 'gg' | 'nice' | 'oops' | 'thinking' | 'salty' | 'love';

interface LucideIconProps {
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
}

export interface ChatEmoteDef {
  id: ChatEmoteId;
  /** Bubble text. Short and punchy. */
  label: string;
  /** Lucide icon component rendered inside the bubble + picker tile. */
  Icon: ComponentType<LucideIconProps>;
  /** Accent color for the bubble border / glow + picker tile chip. */
  color: string;
}

export const CHAT_EMOTES: Record<ChatEmoteId, ChatEmoteDef> = {
  gg:       { id: 'gg',       label: 'GG!',     Icon: PartyPopper, color: '#ffd166' },
  nice:     { id: 'nice',     label: 'Nice!',   Icon: ThumbsUp,    color: '#06d6a0' },
  oops:     { id: 'oops',     label: 'Oops…',   Icon: Frown,       color: '#a47bff' },
  thinking: { id: 'thinking', label: 'Hmm…',    Icon: Brain,       color: '#5ea3e8' },
  salty:    { id: 'salty',    label: 'Salty!',  Icon: Flame,       color: '#ef5a5a' },
  love:     { id: 'love',     label: 'Love',    Icon: Heart,       color: '#ff7e5f' },
};

/** Default display order in the picker (left-to-right, top-to-bottom). */
export const CHAT_EMOTE_ORDER: ChatEmoteId[] = ['gg', 'nice', 'oops', 'thinking', 'salty', 'love'];

export function getChatEmote(id: string | undefined): ChatEmoteDef | null {
  if (!id) return null;
  return CHAT_EMOTES[id as ChatEmoteId] ?? null;
}
