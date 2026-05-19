export interface Settings {
  /** 0..1 — sound effect volume. 0 disables. */
  sfxVolume: number;
  /** 0..1 — placeholder for future background music volume. */
  bgmVolume: number;
  /** When true, incoming PVP emote cues from the opponent are dropped
   *  on this client (the local player's own emotes still send + show
   *  on their side). Off by default. */
  hideOpponentEmotes: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sfxVolume: 0.6,
  bgmVolume: 0.3,
  hideOpponentEmotes: false,
};

export const SETTINGS_KEY = 'lifedeck-settings-v1';
