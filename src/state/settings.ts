export interface Settings {
  /** When true, decorative motion (home fan, slam, dust, slice) is replaced
   *  with simple fades. Combat still plays in shorter form so feedback is
   *  preserved. Honors prefers-reduced-motion if the user hasn't picked. */
  reducedMotion: boolean;
  /** Scales JS-driven match timing (combat, AI delays, turn banners). 1=Normal,
   *  1.5=Fast, 2=Very Fast. CSS keyframes are short enough to leave alone. */
  animSpeed: 1 | 1.5 | 2;
  /** 0..1 — sound effect volume. 0 disables. */
  sfxVolume: number;
  /** 0..1 — placeholder for future background music volume. */
  bgmVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  reducedMotion: false,
  animSpeed: 1,
  sfxVolume: 0.6,
  bgmVolume: 0.3,
};

export const SETTINGS_KEY = 'lifedeck-settings-v1';
