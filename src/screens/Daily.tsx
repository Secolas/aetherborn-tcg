import { ArrowLeft, Coins, Flame, Check, Gift, Trophy, Swords, Package, Link2, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { btnPrimary, iconBtn, PALETTE } from '../components/styles';
import type { DailyState, Quest } from '../game/quests';
import { streakRewardTable, streakReward } from '../game/quests';

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
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
        linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)
      `,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}
      className="no-scrollbar"
    >
      <div style={{
        padding: '52px 20px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, background: 'inherit', zIndex: 5,
      }}>
        <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Daily</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Coins size={12} color="#e8a93a" fill="#ffd166" strokeWidth={2.2} />
            {coins} coins
            {claimableQuests > 0 && (
              <span style={{
                marginLeft: 8, padding: '1px 8px', borderRadius: 10,
                background: '#ee5a52', color: '#fff', fontWeight: 700, fontSize: 10,
              }}>{claimableQuests} ready</span>
            )}
          </div>
        </div>
      </div>

      {/* Login streak card */}
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div style={{
          padding: 16, borderRadius: 18,
          background: 'linear-gradient(135deg, #ff9f1c 0%, #ee5a52 100%)',
          color: '#fff',
          boxShadow: '0 8px 20px rgba(238, 90, 82, .30)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Flame size={18} fill="#ffd166" color="#ffd166" strokeWidth={2.2} />
            <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.85, fontWeight: 600 }}>
              Login Streak
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, fontFamily: '"Cinzel", Georgia, serif' }}>
              Day {daily.streak}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>keep it alive!</div>
          </div>

          {/* Reward strip */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {table.map(({ day, coins: c }) => {
              const reached = daily.streak >= day;
              const isToday = daily.streak === day || (day === table.length && daily.streak >= day);
              return (
                <div key={day} style={{
                  flex: 1,
                  background: isToday
                    ? 'rgba(255,255,255,0.95)'
                    : reached
                      ? 'rgba(255,255,255,0.55)'
                      : 'rgba(255,255,255,0.18)',
                  color: isToday ? '#ee5a52' : '#fff',
                  borderRadius: 10,
                  padding: '6px 0',
                  textAlign: 'center',
                  fontWeight: 700,
                  border: isToday ? '2px solid #ffd166' : '2px solid transparent',
                }}>
                  <div style={{ fontSize: 9, opacity: 0.85, letterSpacing: '0.05em' }}>
                    {day === table.length ? `D${day}+` : `D${day}`}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{c}</div>
                </div>
              );
            })}
          </div>

          {daily.streakClaimed ? (
            <div style={{
              padding: '10px 14px', borderRadius: 14,
              background: 'rgba(255,255,255,0.18)',
              fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Check size={14} /> Today's bonus claimed — back tomorrow!
            </div>
          ) : (
            <button
              onClick={onClaimStreak}
              style={{
                ...btnPrimary,
                width: '100%',
                background: '#fff',
                color: '#ee5a52',
                padding: '12px 16px',
                fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,.20)',
              }}
            >
              <Gift size={16} />
              Claim {todayReward} coins
            </button>
          )}
        </div>
      </div>

      {/* Quests list */}
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: PALETTE.textMid, fontWeight: 600, marginBottom: 10, marginLeft: 4,
        }}>
          Today's Quests
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {daily.quests.map(q => (
            <QuestRow key={q.id} q={q} onClaim={() => onClaimQuest(q.id)} />
          ))}
        </div>
        <div style={{
          fontSize: 10, opacity: 0.55, marginTop: 14, textAlign: 'center',
          fontStyle: 'italic',
        }}>
          New quests roll over at midnight.
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
    <div style={{
      padding: 12, borderRadius: 16,
      background: q.claimed ? '#f3ece4' : '#fff',
      opacity: q.claimed ? 0.55 : 1,
      border: `1.5px solid ${done && !q.claimed ? '#ffd166' : PALETTE.border}`,
      boxShadow: done && !q.claimed
        ? '0 4px 14px rgba(244, 208, 74, .35)'
        : '0 2px 6px rgba(58,46,42,.06)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 12,
        background: done ? 'linear-gradient(135deg, #ffd166, #ff9f1c)' : '#fef3e8',
        color: done ? '#fff' : PALETTE.accentDeep,
        display: 'grid', placeItems: 'center',
        flex: '0 0 auto',
      }}>
        {q.claimed ? <Check size={18} /> : icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 1 }}>{q.title}</div>
        {q.hint && (
          <div style={{ fontSize: 10, color: PALETTE.textMid, marginBottom: 6 }}>{q.hint}</div>
        )}
        <div style={{
          width: '100%', height: 6, borderRadius: 999,
          background: '#f0e3d6', overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: done
              ? 'linear-gradient(90deg, #06d6a0, #ffd166)'
              : 'linear-gradient(90deg, #ff9f1c, #ee5a52)',
            transition: 'width .35s ease-out',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ fontSize: 10, color: PALETTE.textMid }}>
            {q.progress} / {q.goal}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, color: '#e8a93a' }}>
            <Coins size={11} fill="#ffd166" color="#e8a93a" strokeWidth={2.2} />
            {q.rewardCoins}
          </div>
        </div>
      </div>
      {done && !q.claimed && (
        <button
          onClick={onClaim}
          style={{
            background: 'linear-gradient(180deg, #ffa07a 0%, #ee5a52 100%)',
            color: '#fff', border: 'none', borderRadius: 14,
            padding: '8px 12px', fontWeight: 700, fontSize: 11,
            cursor: 'pointer', flex: '0 0 auto',
            boxShadow: '0 3px 10px rgba(238, 90, 82, .35)',
            fontFamily: 'inherit',
            animation: 'questClaimPulse 1.4s ease-in-out infinite',
          }}
        >
          Claim
        </button>
      )}
    </div>
  );
}

function questIcon(q: Quest): ReactNode {
  switch (q.kind) {
    case 'win_matches':         return <Trophy size={18} />;
    case 'win_hard_or_higher':  return <Sparkles size={18} />;
    case 'play_matches':        return <Swords size={18} />;
    case 'open_packs':          return <Package size={18} />;
    case 'trigger_bonds':       return <Link2 size={18} />;
    case 'play_creatures':      return <Swords size={18} />;
  }
}
