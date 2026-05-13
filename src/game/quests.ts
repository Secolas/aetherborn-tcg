/**
 * Daily quests + login streak system.
 *
 * Quests roll fresh each calendar day (local time). On the first session of
 * a new day, the previous day's progress is wiped and three new quests are
 * generated, scaled to the player's general progress so newcomers get easy
 * goals and veterans get meaningful targets.
 *
 * Each quest tracks a single integer counter against a goal. Progress is
 * reported via `recordEvent` — the same call surfaces UI toasts and credits
 * coins when a quest tips from incomplete to complete. Claiming the reward
 * is a separate explicit action so the player gets a satisfying button.
 *
 * Login streak: increments by 1 when the player opens the app on a calendar
 * day that immediately follows the previous login. Skipping a full day
 * resets to 1. The reward table is per-day in the streak — higher streaks
 * pay better, capped at the day-7 tier to avoid runaway scaling.
 */

export type QuestEvent =
  | { kind: 'match_win'; difficulty: 'normal' | 'hard' | 'mythic' }
  | { kind: 'match_played' }
  | { kind: 'pack_opened' }
  | { kind: 'bond_triggered' }
  | { kind: 'boss_defeated'; bossId: string }
  | { kind: 'creature_played' };

export type QuestKind =
  | 'win_matches'
  | 'win_hard_or_higher'
  | 'play_matches'
  | 'open_packs'
  | 'trigger_bonds'
  | 'play_creatures';

export interface Quest {
  id: string;
  kind: QuestKind;
  /** Short verb-first label rendered in the UI. */
  title: string;
  /** Optional one-line clarification under the title. */
  hint?: string;
  goal: number;
  progress: number;
  rewardCoins: number;
  claimed: boolean;
}

export interface DailyState {
  /** Local-date key (YYYY-MM-DD) the quests + streak were last refreshed on. */
  dayKey: string;
  /** Current consecutive-day login streak. Always >= 1 once initialized. */
  streak: number;
  /** True once the player has claimed today's streak reward. */
  streakClaimed: boolean;
  quests: Quest[];
}

/** Local-time calendar day key. Local matters because daily resets should
 *  feel "midnight" to the player, not to UTC. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Number of full days between two local day keys (b - a). 0 means same
 *  day, 1 means consecutive, >1 means a streak break. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad);
  const db = new Date(by, bm - 1, bd);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** Streak reward curve. Index = streak day (1..). Tier caps at 7+. */
const STREAK_REWARDS = [0, 20, 30, 50, 75, 100, 140, 200];
export function streakReward(streak: number): number {
  if (streak <= 0) return 0;
  const i = Math.min(streak, STREAK_REWARDS.length - 1);
  return STREAK_REWARDS[i];
}
export function streakRewardTable(): { day: number; coins: number }[] {
  return STREAK_REWARDS.slice(1).map((coins, i) => ({ day: i + 1, coins }));
}

/** Roll three fresh quests for the new day. Pulls one easy + one medium +
 *  one stretch goal so every player has at least one trivially-completable
 *  quest to taste the reward loop. */
export function rollDailyQuests(seedDayKey: string): Quest[] {
  // Deterministic per-day so reopening the app same day doesn't re-roll.
  let h = 0;
  for (let i = 0; i < seedDayKey.length; i++) h = (h * 31 + seedDayKey.charCodeAt(i)) | 0;
  const rng = () => {
    h = (h * 1664525 + 1013904223) | 0;
    return ((h >>> 0) % 1000) / 1000;
  };

  const easy: Quest[] = [
    { id: 'play_1', kind: 'play_matches', title: 'Step Into The Arena', hint: 'Start a match — win or lose', goal: 1, progress: 0, rewardCoins: 25, claimed: false },
    { id: 'creatures_3', kind: 'play_creatures', title: 'Summon Three Allies', hint: 'Play any 3 creatures', goal: 3, progress: 0, rewardCoins: 30, claimed: false },
    { id: 'bond_1', kind: 'trigger_bonds', title: 'Spark A Bond', hint: 'Trigger any bond effect', goal: 1, progress: 0, rewardCoins: 30, claimed: false },
  ];
  const medium: Quest[] = [
    { id: 'win_1', kind: 'win_matches', title: 'Claim A Victory', hint: 'Win one match', goal: 1, progress: 0, rewardCoins: 60, claimed: false },
    { id: 'creatures_6', kind: 'play_creatures', title: 'Field Marshal', hint: 'Play 6 creatures total', goal: 6, progress: 0, rewardCoins: 55, claimed: false },
    { id: 'pack_1', kind: 'open_packs', title: 'Crack A Pack', hint: 'Open one pack', goal: 1, progress: 0, rewardCoins: 50, claimed: false },
  ];
  const stretch: Quest[] = [
    { id: 'win_2', kind: 'win_matches', title: 'Back-To-Back', hint: 'Win two matches', goal: 2, progress: 0, rewardCoins: 110, claimed: false },
    { id: 'win_hard_1', kind: 'win_hard_or_higher', title: 'Hard Mode Hero', hint: 'Win on Hard or Mythic', goal: 1, progress: 0, rewardCoins: 130, claimed: false },
    { id: 'bond_3', kind: 'trigger_bonds', title: 'Forge Three Bonds', hint: 'Trigger 3 bond effects', goal: 3, progress: 0, rewardCoins: 90, claimed: false },
  ];

  const pick = (pool: Quest[]) => pool[Math.floor(rng() * pool.length)];
  return [pick(easy), pick(medium), pick(stretch)];
}

/** Initialize a fresh daily state for a brand new save. Streak = 1, fresh
 *  quests, nothing claimed. */
export function initialDaily(today: string = dayKey()): DailyState {
  return {
    dayKey: today,
    streak: 1,
    streakClaimed: false,
    quests: rollDailyQuests(today),
  };
}

/** Advance a stored daily state to "today". Handles three cases:
 *  - same day → no change
 *  - +1 day → streak++, fresh quests, streak unclaimed
 *  - +2 or more days → streak resets to 1, fresh quests
 *  Returns the up-to-date state. */
export function advanceDaily(prev: DailyState | undefined, today: string = dayKey()): DailyState {
  if (!prev) return initialDaily(today);
  const gap = daysBetween(prev.dayKey, today);
  if (gap <= 0) return prev;
  const streak = gap === 1 ? prev.streak + 1 : 1;
  return {
    dayKey: today,
    streak,
    streakClaimed: false,
    quests: rollDailyQuests(today),
  };
}

/** Fold a quest event into the current daily state. Returns the new state
 *  and the list of quests that *just* became complete (so the caller can
 *  surface a toast). Already-claimed and already-complete quests don't
 *  re-trigger. */
export function recordEvent(
  state: DailyState,
  event: QuestEvent,
): { state: DailyState; newlyCompleted: Quest[] } {
  const newlyCompleted: Quest[] = [];
  const quests = state.quests.map(q => {
    if (q.claimed || q.progress >= q.goal) return q;
    const delta = progressFor(q.kind, event);
    if (delta === 0) return q;
    const next: Quest = { ...q, progress: Math.min(q.goal, q.progress + delta) };
    if (q.progress < q.goal && next.progress >= q.goal) newlyCompleted.push(next);
    return next;
  });
  return { state: { ...state, quests }, newlyCompleted };
}

function progressFor(kind: QuestKind, event: QuestEvent): number {
  switch (kind) {
    case 'win_matches':
      return event.kind === 'match_win' ? 1 : 0;
    case 'win_hard_or_higher':
      return event.kind === 'match_win' && (event.difficulty === 'hard' || event.difficulty === 'mythic') ? 1 : 0;
    case 'play_matches':
      return event.kind === 'match_played' ? 1 : 0;
    case 'open_packs':
      return event.kind === 'pack_opened' ? 1 : 0;
    case 'trigger_bonds':
      return event.kind === 'bond_triggered' ? 1 : 0;
    case 'play_creatures':
      return event.kind === 'creature_played' ? 1 : 0;
  }
}

/** Mark a quest claimed. Returns updated state + coin payout (0 if invalid). */
export function claimQuest(state: DailyState, questId: string): { state: DailyState; payout: number } {
  let payout = 0;
  const quests = state.quests.map(q => {
    if (q.id !== questId) return q;
    if (q.claimed || q.progress < q.goal) return q;
    payout = q.rewardCoins;
    return { ...q, claimed: true };
  });
  return { state: { ...state, quests }, payout };
}

/** Claim today's login-streak reward. Returns updated state + payout. */
export function claimStreak(state: DailyState): { state: DailyState; payout: number } {
  if (state.streakClaimed) return { state, payout: 0 };
  const payout = streakReward(state.streak);
  return { state: { ...state, streakClaimed: true }, payout };
}
