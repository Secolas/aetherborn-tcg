import type { ElementId } from '../game/types';

export interface BossDef {
  id: string;
  name: string;
  subtitle: string;
  themeId: ElementId;
  avatar: string;       // single-letter avatar
  intro: string;        // one-line taunt before the match
  rewardCoins: number;  // first-time-victory bonus on top of the standard win
}

/**
 * Three named opponents, one per theme. Each fights with their theme's deck
 * so the player learns what that theme plays like by fighting against it.
 *
 * First-time defeat awards a bonus on top of the standard win reward, so
 * each boss is a *moment* — a milestone unlock instead of a grind enemy.
 */
export const BOSSES: BossDef[] = [
  {
    id: 'mom',
    name: 'Mom',
    subtitle: 'Disappointed',
    themeId: 'family',
    avatar: 'M',
    intro: "You haven't called.",
    rewardCoins: 150,
  },
  {
    id: 'manager',
    name: 'The Manager',
    subtitle: 'Has thoughts',
    themeId: 'work',
    avatar: 'M',
    intro: 'Got a minute? It will only take a minute.',
    rewardCoins: 150,
  },
  {
    id: 'alpha',
    name: 'Pack Alpha',
    subtitle: "Doesn't like strangers",
    themeId: 'animals',
    avatar: 'A',
    intro: 'Bare your teeth or run.',
    rewardCoins: 150,
  },
];

export function getBoss(id: string): BossDef | undefined {
  return BOSSES.find(b => b.id === id);
}
