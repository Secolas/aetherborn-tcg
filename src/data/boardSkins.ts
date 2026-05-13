/**
 * Board-skin cosmetics — the background painted on the MatchBoard while
 * the player is in a match. Equipped globally (one skin applies to every
 * match). Pure presentation — never affects gameplay, board layout, or
 * card positioning.
 *
 * Each skin is a CSS background string compatible with the inline
 * `background` property. MatchBoard composes it with the in-match
 * grid/lines overlay so any skin works without further tweaks.
 */

export type BoardSkinId = 'daylight' | 'twilight' | 'inkwell';

export interface BoardSkinDef {
  id: BoardSkinId;
  name: string;
  description: string;
  cost: number;
  /** Top-of-board ambient color used in headers / chips that pick up
   *  the room mood (e.g. mana glow). Optional — when missing the skin
   *  uses MatchBoard's default warm tone. */
  ambient?: string;
  background: string;
  /** True when the skin renders a dark background. Text overlays
   *  (center divider message, dashed drop-zone outlines) switch to a
   *  light palette so they stay readable. */
  isDark?: boolean;
}

export const BOARD_SKINS: Record<BoardSkinId, BoardSkinDef> = {
  daylight: {
    id: 'daylight',
    name: 'Daylight',
    description: 'The original warm tabletop look.',
    cost: 0,
    background: `
      radial-gradient(ellipse 120% 80% at 50% 0%, #fff4e6 0%, transparent 70%),
      linear-gradient(180deg, #ffe8d6 0%, #ffd1b3 50%, #ffb89a 100%)
    `,
    ambient: '#ffd1b3',
  },
  twilight: {
    id: 'twilight',
    name: 'Twilight',
    description: 'Cool dusk gradient with a violet sky.',
    cost: 250,
    background: `
      radial-gradient(ellipse 110% 70% at 50% 0%, #4f3a72 0%, transparent 70%),
      linear-gradient(180deg, #2a2546 0%, #3d2b56 50%, #5b3a6e 100%)
    `,
    ambient: '#7d62a4',
    isDark: true,
  },
  inkwell: {
    id: 'inkwell',
    name: 'Inkwell',
    description: 'Deep navy paper with starlight specks.',
    cost: 300,
    background: `
      radial-gradient(circle at 20% 20%, rgba(255,255,255,.06) 0px, transparent 2px),
      radial-gradient(circle at 60% 30%, rgba(255,255,255,.06) 0px, transparent 2px),
      radial-gradient(circle at 80% 70%, rgba(255,255,255,.06) 0px, transparent 2px),
      radial-gradient(circle at 35% 80%, rgba(255,255,255,.06) 0px, transparent 2px),
      radial-gradient(ellipse 100% 60% at 50% 0%, #1f3057 0%, transparent 70%),
      linear-gradient(180deg, #0e1730 0%, #131e3d 60%, #1c2a52 100%)
    `,
    ambient: '#3a5380',
    isDark: true,
  },
};

export const BOARD_SKIN_ORDER: BoardSkinId[] = ['daylight', 'twilight', 'inkwell'];
export const STARTER_BOARD_SKINS: BoardSkinId[] = ['daylight'];

export function getBoardSkin(id: BoardSkinId | undefined): BoardSkinDef {
  return BOARD_SKINS[id ?? 'daylight'] ?? BOARD_SKINS.daylight;
}
