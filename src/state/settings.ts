export interface Settings {
  /** 0..1 — sound effect volume. 0 disables. */
  sfxVolume: number;
  /** 0..1 — placeholder for future background music volume. */
  bgmVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sfxVolume: 0.6,
  bgmVolume: 0.3,
};

export const SETTINGS_KEY = 'lifedeck-settings-v1';
