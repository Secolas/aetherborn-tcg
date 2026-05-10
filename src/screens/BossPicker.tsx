import { useState } from 'react';
import { ArrowLeft, Check, Coins, Flame, Skull } from 'lucide-react';
import { BOSSES, type BossDef } from '../data/bosses';
import { ELEMENTS } from '../data/elements';
import { ElementGlyph } from '../components/ElementGlyph';
import { iconBtn, PALETTE } from '../components/styles';
import type { Difficulty } from '../game/types';
import { difficultyProfile } from '../game/match';

interface Props {
  defeatedIds: string[];
  /** Highest difficulty the player has *beaten* per boss id. Drives the
   *  small medal that decorates an already-conquered boss. */
  beatenAt: Record<string, Difficulty>;
  onPick: (boss: BossDef, difficulty: Difficulty) => void;
  onBack: () => void;
}

const DIFFICULTIES: Difficulty[] = ['normal', 'hard', 'mythic'];

export function BossPicker({ defeatedIds, beatenAt, onPick, onBack }: Props) {
  /** Per-boss difficulty selector — sticky per session so the picker
   *  remembers what tier you tapped on each card. Defaults to Normal. */
  const [picked, setPicked] = useState<Record<string, Difficulty>>({});

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
        linear-gradient(180deg, #ffe8d6 0%, #ffd4b3 60%, #ffbe9c 100%)
      `,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '52px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Pick a fight</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            {defeatedIds.length} of {BOSSES.length} defeated
          </div>
        </div>
      </div>

      <div style={{
        flex: 1, padding: '8px 16px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }} className="no-scrollbar">
        {BOSSES.map(boss => {
          const cur = picked[boss.id] ?? 'normal';
          return (
            <BossCard
              key={boss.id}
              boss={boss}
              defeated={defeatedIds.includes(boss.id)}
              beatenAt={beatenAt[boss.id]}
              difficulty={cur}
              onChangeDifficulty={(d) => setPicked(p => ({ ...p, [boss.id]: d }))}
              onClick={() => onPick(boss, cur)}
            />
          );
        })}
      </div>
    </div>
  );
}

function BossCard({
  boss, defeated, beatenAt, difficulty, onChangeDifficulty, onClick,
}: {
  boss: BossDef;
  defeated: boolean;
  beatenAt?: Difficulty;
  difficulty: Difficulty;
  onChangeDifficulty: (d: Difficulty) => void;
  onClick: () => void;
}) {
  const e = ELEMENTS[boss.themeId];
  const profile = difficultyProfile(difficulty);
  const reward = Math.round(boss.rewardCoins * profile.rewardMult);
  return (
    <div
      style={{
        width: '100%',
        background: '#fff',
        border: 'none',
        borderRadius: 18,
        boxShadow: '0 8px 24px rgba(58, 46, 42, .12), 0 1.5px 0 rgba(58, 46, 42, .06)',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: 'inherit',
      }}
    >
      {/* Banner — themed gradient with avatar. Tapping the banner picks
          the fight at the currently-selected difficulty; the difficulty
          chips below are independent so the player can flip tiers without
          accidentally launching. */}
      <button
        onClick={onClick}
        style={{
          display: 'block', width: '100%',
          background: `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 100%)`,
          border: 'none', padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
        onPointerDown={(ev) => { (ev.currentTarget as HTMLElement).style.filter = 'brightness(0.92)'; }}
        onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.filter = 'brightness(1)'; }}
        onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.filter = 'brightness(1)'; }}
      >
        <div style={{
          height: 90,
          position: 'relative',
          display: 'flex', alignItems: 'center', padding: '0 18px',
          gap: 14,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#fff',
            padding: 3,
            display: 'grid', placeItems: 'center',
            flex: '0 0 auto',
            boxShadow: '0 4px 12px rgba(0,0,0,.18)',
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: boss.avatarPhoto
                ? `url(${boss.avatarPhoto}) center/cover`
                : `linear-gradient(160deg, ${e.deep} 0%, ${e.color} 100%)`,
              display: 'grid', placeItems: 'center',
              fontSize: 26, fontWeight: 700,
              color: '#fff',
              fontFamily: '"Fredoka", system-ui',
            }}>{!boss.avatarPhoto && boss.avatar}</div>
          </div>
          <div style={{ flex: 1, color: '#fff' }}>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.05 }}>{boss.name}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2, fontStyle: 'italic' }}>
              {boss.subtitle}
            </div>
          </div>
          <ElementGlyph el={boss.themeId} size={32} />
          {defeated && (
            <BeatenBadge tier={beatenAt ?? 'normal'} />
          )}
        </div>
      </button>

      {/* Body */}
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ fontSize: 13, color: PALETTE.text, fontStyle: 'italic', marginBottom: 10 }}>
          “{boss.intro}”
        </div>

        {/* Difficulty segment — Normal / Hard / Mythic. Same idiom as the
            Settings screen and the Album tab bar, so the visual language
            stays consistent across the app. */}
        <div style={{
          display: 'flex', gap: 4, padding: 4,
          background: '#f5ede2', borderRadius: 12,
          marginBottom: 10,
        }}>
          {DIFFICULTIES.map(d => {
            const active = difficulty === d;
            const dp = difficultyProfile(d);
            return (
              <button
                key={d}
                onClick={() => onChangeDifficulty(d)}
                style={{
                  flex: 1, padding: '7px 0',
                  background: active ? '#fff' : 'transparent',
                  color: active ? PALETTE.text : PALETTE.textMid,
                  border: 'none', borderRadius: 9,
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 11,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  boxShadow: active ? '0 2px 6px rgba(58,46,42,.10)' : 'none',
                  transition: 'background .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                {d === 'mythic' ? <Skull size={12} strokeWidth={2.4} /> : d === 'hard' ? <Flame size={12} strokeWidth={2.4} /> : null}
                {dp.label}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 10, color: PALETTE.textMid, lineHeight: 1.4, marginBottom: 6 }}>
          {/* Stat boost line */}
          Boss starts at <strong style={{ color: PALETTE.text }}>{profile.bossHp} HP</strong>
          {profile.bossStartMana > 1 ? <> · <strong style={{ color: PALETTE.text }}>+{profile.bossStartMana - 1} mana</strong></> : null}
          {profile.bossHand > 4 ? <> · <strong style={{ color: PALETTE.text }}>+{profile.bossHand - 4} card</strong></> : null}
        </div>
        <div style={{
          fontSize: 10, color: PALETTE.textMid, lineHeight: 1.4,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {/* AI behavior line — what kind of opponent the player is
              actually fighting at this tier. */}
          <span style={{ flex: 1 }}>
            {difficulty === 'normal' && <>Plays straightforward — best card, attack threats.</>}
            {difficulty === 'hard' && <>Plays smart — saves spells, picks threats, refuses bad trades.</>}
            {difficulty === 'mythic' && <>Plays brutal — completes its own bonds, breaks yours.</>}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 800,
            color: '#e85d3c',
            flex: '0 0 auto', marginLeft: 8,
          }}>
            <Coins size={14} fill="#ffd166" strokeWidth={2.2} />
            +{reward}
          </span>
        </div>
      </div>
    </div>
  );
}

/** "Beaten on Hard" / "Mythic" medal in the banner corner. Color escalates
 *  with tier so the player can scan their progress at a glance. */
function BeatenBadge({ tier }: { tier: Difficulty }) {
  const cfg: Record<Difficulty, { bg: string; fg: string; label: string }> = {
    normal: { bg: '#ffd166', fg: '#5a3a0e', label: 'Beaten' },
    hard:   { bg: '#ff7e5f', fg: '#fff',    label: 'Beaten · Hard' },
    mythic: { bg: '#3a2e2a', fg: '#ffd166', label: 'Beaten · Mythic' },
  };
  const c = cfg[tier];
  return (
    <div style={{
      position: 'absolute', top: 10, right: 10,
      background: c.bg, color: c.fg,
      padding: '4px 8px 4px 6px', borderRadius: 12,
      fontSize: 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', gap: 3,
      boxShadow: '0 2px 6px rgba(0,0,0,.2)',
    }}>
      <Check size={12} strokeWidth={3} /> {c.label}
    </div>
  );
}
