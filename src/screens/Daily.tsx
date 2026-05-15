import { ArrowLeft, Coins, Flame, Check, Gift, Trophy, Swords, Package, Link2, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { PALETTE } from '../components/styles';
import type { DailyState, Quest } from '../game/quests';
import { streakRewardTable, streakReward } from '../game/quests';

/**
 * Daily — login streak + today's quests. Same design language as
 * Boss Picker / Pack Shop / Cosmetics / Home: scoped inline styles
 * under `.daily-container`, container queries for mobile / desktop,
 * Fredoka + app PALETTE, eyebrow-numbered section headers, coral
 * CTAs. No game-logic changes — onClaimStreak / onClaimQuest still
 * flow through the existing handlers.
 */
interface Props {
  daily: DailyState;
  coins: number;
  onClaimQuest: (questId: string) => void;
  onClaimStreak: () => void;
  onBack: () => void;
}

export function Daily({ daily, coins, onClaimQuest, onClaimStreak, onBack }: Props) {
  const table = streakRewardTable();
  const todayReward = streakReward(daily.streak);
  const claimableQuests = daily.quests.filter(q => q.progress >= q.goal && !q.claimed).length;

  return (
    <div className="daily-container">
      <DailyStyles />

      <div className="daily">
        {/* Topbar */}
        <div className="daily-topbar">
          <div className="left-tools">
            <button className="icon-btn" aria-label="Back" onClick={onBack}>
              <ArrowLeft size={16} strokeWidth={2.2} />
            </button>
            <span className="coin-chip" aria-label={`${coins} coins`}>
              <Coins size={13} color="#c08620" fill="#ffd166" strokeWidth={2} />
              <strong>{coins.toLocaleString()}</strong> coins
            </span>
          </div>
          <div className="crest">
            <div className="vol">Today</div>
            <div className="title">Daily</div>
          </div>
          <div className="right-tools">
            {claimableQuests > 0 && (
              <span className="coin-chip claim-ready">
                <Sparkles size={11} fill="#fff" color="#fff" strokeWidth={2.2} />
                <strong>{claimableQuests}</strong> ready
              </span>
            )}
          </div>
        </div>

        {/* Streak hero */}
        <section className="daily-streak">
          <div className="daily-streak-eyebrow">
            <Flame size={12} fill="#ffd166" color="#ffd166" strokeWidth={2.2} />
            <span>Login streak · keep it alive</span>
          </div>
          <div className="daily-streak-row">
            <div className="daily-streak-num">Day {daily.streak}</div>
            <div className="daily-streak-claim">
              {daily.streakClaimed ? (
                <div className="daily-streak-claimed">
                  <Check size={14} strokeWidth={2.6} />
                  Back tomorrow
                </div>
              ) : (
                <button className="daily-streak-btn" onClick={onClaimStreak}>
                  <Gift size={16} strokeWidth={2.2} />
                  Claim {todayReward}
                </button>
              )}
            </div>
          </div>

          {/* Reward strip */}
          <div className="daily-streak-strip" aria-label="Streak rewards">
            {table.map(({ day, coins: c }) => {
              const reached = daily.streak >= day;
              const isToday = daily.streak === day || (day === table.length && daily.streak >= day);
              return (
                <div
                  key={day}
                  className="streak-cell"
                  data-reached={reached}
                  data-today={isToday}
                  aria-label={`Day ${day}: ${c} coins${isToday ? ' (today)' : ''}`}
                >
                  <div className="streak-cell-day">{day === table.length ? `D${day}+` : `D${day}`}</div>
                  <div className="streak-cell-coins">
                    <Coins size={10} fill="#ffd166" color="#c08620" strokeWidth={2.2} />
                    {c}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quests section header */}
        <header className="daily-sec">
          <div className="daily-sec-l">
            <div className="daily-sec-eyebrow">01 · Today's quests</div>
            <div className="daily-sec-title">Earn while you play</div>
          </div>
          <div className="daily-sec-r">
            New quests roll over at midnight.
          </div>
        </header>

        {/* Quest list */}
        <div className="daily-quests">
          {daily.quests.map(q => (
            <QuestRow key={q.id} q={q} onClaim={() => onClaimQuest(q.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestRow({ q, onClaim }: { q: Quest; onClaim: () => void }) {
  const done = q.progress >= q.goal;
  const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
  const icon = questIcon(q);
  return (
    <div
      className="quest"
      data-done={done && !q.claimed}
      data-claimed={q.claimed}
    >
      <div className="quest-icon">
        {q.claimed ? <Check size={18} strokeWidth={2.6} /> : icon}
      </div>
      <div className="quest-body">
        <div className="quest-title">{q.title}</div>
        {q.hint && <div className="quest-hint">{q.hint}</div>}
        <div className="quest-bar">
          <div className="quest-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="quest-meta">
          <span className="quest-prog">{q.progress} / {q.goal}</span>
          <span className="quest-reward">
            <Coins size={11} fill="#ffd166" color="#c08620" strokeWidth={2.2} />
            {q.rewardCoins}
          </span>
        </div>
      </div>
      {done && !q.claimed && (
        <button className="quest-claim" onClick={onClaim}>
          Claim
        </button>
      )}
    </div>
  );
}

function questIcon(q: Quest): ReactNode {
  switch (q.kind) {
    case 'win_matches':         return <Trophy size={18} strokeWidth={2.2} />;
    case 'win_hard_or_higher':  return <Sparkles size={18} strokeWidth={2.2} />;
    case 'play_matches':        return <Swords size={18} strokeWidth={2.2} />;
    case 'open_packs':          return <Package size={18} strokeWidth={2.2} />;
    case 'trigger_bonds':       return <Link2 size={18} strokeWidth={2.2} />;
    case 'play_creatures':      return <Swords size={18} strokeWidth={2.2} />;
  }
}

// ─── Scoped stylesheet ──────────────────────────────────────────────

function DailyStyles() {
  return (
    <style>{`
      .daily-container {
        container-type: inline-size;
        width: 100%; height: 100%;
        overflow-y: auto;
        background:
          radial-gradient(ellipse 90% 60% at 50% -10%, #ffd1b3, transparent 60%),
          radial-gradient(ellipse 80% 60% at 0% 110%, #fff0d6, transparent 60%),
          #fef8f0;
        color: ${PALETTE.text};
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
      }
      .daily {
        padding: 56px 16px 32px;
        display: flex; flex-direction: column;
        gap: 18px;
      }
      @container (min-width: 1024px) {
        .daily { max-width: 920px; margin: 0 auto; padding: 28px 32px 40px; gap: 24px; }
      }

      /* Topbar */
      .daily .daily-topbar {
        display: grid; grid-template-columns: 1fr auto 1fr;
        align-items: center; gap: 12px;
      }
      .daily .left-tools, .daily .right-tools {
        display: flex; align-items: center; gap: 8px;
      }
      .daily .left-tools  { justify-self: start; }
      .daily .right-tools { justify-self: end; }
      .daily .icon-btn {
        width: 38px; height: 38px; border-radius: 50%;
        background: #fff; border: 1.5px solid ${PALETTE.border};
        box-shadow: 0 2px 6px rgba(58,46,42,.08);
        cursor: pointer; padding: 0;
        display: grid; place-items: center;
        color: ${PALETTE.text};
        transition: transform .12s;
      }
      .daily .icon-btn:hover { transform: translateY(-1px); }
      .daily .crest { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .daily .crest .vol {
        font-size: 9px; font-weight: 800; letter-spacing: 0.22em;
        color: ${PALETTE.textLight}; text-transform: uppercase;
      }
      .daily .crest .title {
        font-size: 20px; font-weight: 700; line-height: 1;
      }
      .daily .coin-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 12px;
        background: #fff7e6;
        border: 1px solid ${PALETTE.border};
        border-radius: 999px;
        box-shadow: 0 2px 6px rgba(58,46,42,.08);
        font-family: inherit; font-weight: 600; font-size: 12px;
        color: ${PALETTE.text}; white-space: nowrap;
      }
      .daily .coin-chip strong { font-weight: 800; font-size: 13px; }
      .daily .coin-chip.claim-ready {
        background: linear-gradient(135deg, #ff9f1c, ${PALETTE.accent});
        color: #fff; border-color: rgba(255,255,255,.6);
      }
      .daily .coin-chip.claim-ready strong { color: #fff; }

      /* Streak hero */
      .daily .daily-streak {
        position: relative;
        padding: 18px 20px;
        background: linear-gradient(135deg, #ff9f1c 0%, ${PALETTE.accent} 100%);
        color: #fff;
        border-radius: 22px;
        box-shadow: 0 8px 20px rgba(238,90,82,.30);
        overflow: hidden;
      }
      .daily .daily-streak::before {
        content: ""; position: absolute; inset: 0;
        background: radial-gradient(ellipse 80% 60% at 100% 0%, rgba(255,255,255,.22), transparent 60%);
        pointer-events: none;
      }
      .daily .daily-streak-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.22em; text-transform: uppercase;
        opacity: 0.92;
        margin-bottom: 8px;
      }
      .daily .daily-streak-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; margin-bottom: 12px;
      }
      .daily .daily-streak-num {
        font-family: inherit; font-weight: 800;
        font-size: 36px; line-height: 1;
        letter-spacing: -0.01em;
      }
      @container (min-width: 720px) {
        .daily .daily-streak-num { font-size: 44px; }
      }
      .daily .daily-streak-claim { display: flex; align-items: center; }
      .daily .daily-streak-btn {
        background: #fff; color: ${PALETTE.accent};
        border: 0;
        padding: 10px 16px;
        border-radius: 999px;
        font-family: inherit; font-weight: 800;
        font-size: 13px; letter-spacing: 0.02em;
        cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px;
        box-shadow: 0 6px 16px rgba(0,0,0,.18);
        animation: questClaimPulse 2s ease-in-out infinite;
        transition: transform .12s, box-shadow .12s, filter .12s;
      }
      .daily .daily-streak-btn:hover { transform: translateY(-1px); filter: brightness(1.04); }
      .daily .daily-streak-btn:active {
        transform: translateY(1px);
        box-shadow: 0 3px 10px rgba(0,0,0,.18);
      }
      .daily .daily-streak-claimed {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 14px;
        background: rgba(255,255,255,.18);
        border: 1px solid rgba(255,255,255,.30);
        border-radius: 999px;
        font-family: inherit; font-weight: 700;
        font-size: 12px;
        color: #fff;
      }

      .daily .daily-streak-strip {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        position: relative;
      }
      .daily .streak-cell {
        padding: 6px 0;
        background: rgba(255,255,255,.18);
        border-radius: 10px;
        text-align: center;
        font-weight: 700;
        border: 2px solid transparent;
      }
      .daily .streak-cell[data-reached="true"] {
        background: rgba(255,255,255,.55);
      }
      .daily .streak-cell[data-today="true"] {
        background: #fff; color: ${PALETTE.accent};
        border-color: #ffd166;
        box-shadow: 0 4px 12px rgba(255,255,255,.4);
      }
      .daily .streak-cell-day {
        font-size: 9px; opacity: 0.85; letterSpacing: 0.04em;
      }
      .daily .streak-cell-coins {
        display: inline-flex; align-items: center; gap: 3px;
        font-size: 11px; margin-top: 3px;
        font-weight: 800;
      }

      /* Section header */
      .daily .daily-sec {
        display: flex; justify-content: space-between; align-items: flex-end;
        gap: 12px; padding-bottom: 10px;
        border-bottom: 1px solid rgba(58,46,42,.22);
        flex-wrap: wrap;
      }
      .daily .daily-sec-eyebrow {
        font-size: 10px; font-weight: 800; letter-spacing: 0.22em;
        text-transform: uppercase; color: ${PALETTE.textLight};
      }
      .daily .daily-sec-title {
        font-size: 22px; font-weight: 800; letter-spacing: -0.01em;
        margin-top: 2px;
      }
      @container (min-width: 720px) {
        .daily .daily-sec-title { font-size: 26px; }
      }
      .daily .daily-sec-r {
        font-size: 12px; font-style: italic; color: ${PALETTE.textMid};
        max-width: 28ch; text-align: right;
      }

      /* Quest list */
      .daily .daily-quests {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
      }
      @container (min-width: 720px) {
        .daily .daily-quests { grid-template-columns: 1fr 1fr; gap: 12px; }
      }

      .daily .quest {
        padding: 12px;
        background: #fff;
        border: 1.5px solid ${PALETTE.border};
        border-radius: 16px;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        display: flex; align-items: center; gap: 12px;
        transition: transform .12s, box-shadow .15s, border-color .15s;
      }
      .daily .quest[data-claimed="true"] {
        background: #f3ece4;
        opacity: 0.7;
        border-color: ${PALETTE.border};
        box-shadow: none;
      }
      .daily .quest[data-done="true"] {
        border-color: #ffd166;
        box-shadow:
          0 6px 14px rgba(255,209,102,.30),
          inset 4px 0 0 0 #ffd166;
      }
      .daily .quest-icon {
        width: 40px; height: 40px; border-radius: 12px;
        flex: 0 0 auto;
        background: #fef3e8;
        color: ${PALETTE.accentDeep};
        display: grid; place-items: center;
      }
      .daily .quest[data-done="true"] .quest-icon {
        background: linear-gradient(135deg, #ffd166, #ff9f1c);
        color: #fff;
      }
      .daily .quest[data-claimed="true"] .quest-icon {
        background: rgba(58,46,42,.08);
        color: ${PALETTE.textMid};
      }
      .daily .quest-body { flex: 1; min-width: 0; }
      .daily .quest-title {
        font-size: 13px; font-weight: 800;
        color: ${PALETTE.text};
        line-height: 1.2;
      }
      .daily .quest-hint {
        font-size: 10.5px; color: ${PALETTE.textMid};
        margin-top: 2px; line-height: 1.3;
      }
      .daily .quest-bar {
        margin-top: 6px;
        height: 6px; border-radius: 999px;
        background: #f0e3d6; overflow: hidden;
      }
      .daily .quest-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #ff9f1c, ${PALETTE.accent});
        transition: width .35s ease-out;
      }
      .daily .quest[data-done="true"] .quest-bar-fill {
        background: linear-gradient(90deg, #06d6a0, #ffd166);
      }
      .daily .quest-meta {
        display: flex; justify-content: space-between;
        margin-top: 4px;
        font-size: 10px;
      }
      .daily .quest-prog { color: ${PALETTE.textMid}; }
      .daily .quest-reward {
        display: inline-flex; align-items: center; gap: 3px;
        color: #c08620; font-weight: 800;
      }
      .daily .quest-claim {
        flex: 0 0 auto;
        padding: 8px 14px;
        background: linear-gradient(180deg, #ffa07a, ${PALETTE.accent});
        color: #fff; border: 0;
        border-radius: 999px;
        font-family: inherit; font-weight: 800;
        font-size: 12px; letter-spacing: 0.02em;
        cursor: pointer;
        box-shadow: 0 6px 14px rgba(238,90,82,.30);
        animation: questClaimPulse 1.6s ease-in-out infinite;
        transition: transform .12s, box-shadow .12s, filter .12s;
      }
      .daily .quest-claim:hover { transform: translateY(-1px); filter: brightness(1.04); }
      .daily .quest-claim:active {
        transform: translateY(1px);
        box-shadow: 0 3px 8px rgba(238,90,82,.30);
      }

      @media (prefers-reduced-motion: reduce) {
        .daily-container, .daily-container * {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  );
}
