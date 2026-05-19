/**
 * Boss AI emote personalities.
 *
 * In single-player matches the boss occasionally "speaks" by popping
 * the same in-match chat-emote bubble that PVP opponents use. Which
 * emote fires depends on the boss's personality + an in-match trigger
 * (creature kill, took big hit, played a legendary, dropped to low
 * HP, idle turn-start). All triggers roll a probability so the boss
 * doesn't feel mechanical; a per-side cooldown stops back-to-back
 * pops on busy frames.
 *
 * PVP matches set the boss prop to a synthesized BossDef without a
 * personality, so the trigger code stays bossless there.
 */

import type { ChatEmoteId } from './chatEmotes';

export type EmotePersonality = 'friendly' | 'cocky' | 'shy' | 'silent';

export type EmoteTrigger =
  /** Boss attack just killed one of the player's creatures. */
  | 'playerCreatureKilled'
  /** Boss took 3+ damage in a single tick (face or AOE hit). */
  | 'tookBigHit'
  /** Boss summoned a legendary creature. */
  | 'playedLegendary'
  /** Boss HP crossed below 8 for the first time this match. */
  | 'ownLowHp'
  /** Top of the boss's main phase — a small chance to "think out loud". */
  | 'turnStartIdle';

interface TriggerSpec {
  emoteId: ChatEmoteId;
  /** 0..1 probability the emote actually fires when the trigger hits.
   *  Combined with a cooldown so a busy frame can drop the second
   *  emote even if both triggers rolled true. */
  chance: number;
}

export const BOSS_EMOTE_PROFILES: Record<EmotePersonality, Partial<Record<EmoteTrigger, TriggerSpec>>> = {
  // Warm and a little self-deprecating. Apologetic when they hurt you,
  // smitten with their own legendary plays, quiet sigh when behind.
  friendly: {
    playerCreatureKilled: { emoteId: 'oops',     chance: 0.30 },
    tookBigHit:           { emoteId: 'oops',     chance: 0.30 },
    playedLegendary:      { emoteId: 'love',     chance: 0.55 },
    ownLowHp:             { emoteId: 'thinking', chance: 0.60 },
    turnStartIdle:        { emoteId: 'thinking', chance: 0.05 },
  },
  // Smug. Salty on every domination, sarcastic "hmm" when hit, double
  // down on Salty when cornered.
  cocky: {
    playerCreatureKilled: { emoteId: 'salty',    chance: 0.40 },
    tookBigHit:           { emoteId: 'thinking', chance: 0.20 },
    playedLegendary:      { emoteId: 'salty',    chance: 0.60 },
    ownLowHp:             { emoteId: 'salty',    chance: 0.55 },
    turnStartIdle:        { emoteId: 'salty',    chance: 0.05 },
  },
  // Reserved. Only emotes on big moments (legendary play, low HP).
  shy: {
    tookBigHit:           { emoteId: 'thinking', chance: 0.20 },
    playedLegendary:      { emoteId: 'love',     chance: 0.40 },
    ownLowHp:             { emoteId: 'thinking', chance: 0.55 },
  },
  // No emotes at all — tutorial dummy, anything that should feel inert.
  silent: {},
};
