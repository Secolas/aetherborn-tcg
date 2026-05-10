import { useState } from 'react';
import { ArrowLeft, Check, Coins, Flame, Skull, Swords } from 'lucide-react';
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
      // Tapping anywhere on the card (banner, intro line, etc.) launches
      // the fight at the currently-picked tier. The difficulty pills below
      // call `stopPropagation` so picking a tier doesn't also launch. The
      // explicit Start button at the bottom is a redundant, unambiguous
      // path for players who want to see the tier label before tapping.
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') onClick(); }}
      style={{
        width: '100%',
        background: '#fff',
        border: 'none',
        borderRadius: 18,
        boxShadow: '0 8px 24px rgba(58, 46, 42, .12), 0 1.5px 0 rgba(58, 46, 42, .06)',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'transform .1s, box-shadow .15s',
      }}
      onPointerDown={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.995)'; }}
      onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
      onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
    >
      {/* Banner — themed gradient with avatar. The launch action lives in
          the explicit Start button below; the banner is now decorative
          (no nested button so the difficulty pills + Start button are
          unambiguous). */}
      <div style={{
        background: `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 100%)`,
      }}>
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
      </div>

      {/* Body */}
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ fontSize: 13, color: PALETTE.text, fontStyle: 'italic', marginBottom: 10 }}>
          “{boss.intro}”
        </div>

        {/* Difficulty segment — Normal / Hard / Mythic. Visible "DIFFICULTY"
            header above so the player understands these chips control how
            the boss plays. Active tier gets a coral ring + drop shadow so
            it pops out from the inactive ones rather than blending into
            the card body. */}
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
          color: PALETTE.textMid, marginBottom: 6,
        }}>
          DIFFICULTY
        </div>
        <div style={{
          display: 'flex', gap: 6,
          marginBottom: 10,
        }}>
          {DIFFICULTIES.map(d => {
            const active = difficulty === d;
            const dp = difficultyProfile(d);
            return (
              <button
                key={d}
                onClick={(ev) => { ev.stopPropagation(); onChangeDifficulty(d); }}
                style={{
                  flex: 1, padding: '10px 0',
                  background: active ? '#fff' : '#f7eee0',
                  color: active ? PALETTE.text : PALETTE.textMid,
                  border: active ? '2px solid #ee5a52' : '2px solid transparent',
                  borderRadius: 12,
                  fontFamily: 'inherit', fontWeight: 800, fontSize: 12,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  boxShadow: active
                    ? '0 4px 10px rgba(238,90,82,.20), inset 0 -2px 0 rgba(0,0,0,.04)'
                    : '0 1px 2px rgba(58,46,42,.06)',
                  transition: 'background .15s, border-color .15s, box-shadow .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                {d === 'mythic' ? <Skull size={13} strokeWidth={2.4} /> : d === 'hard' ? <Flame size={13} strokeWidth={2.4} /> : null}
                {dp.label}
              </button>
            );
          })}
        </div>

        {/* AI behavior line — same starting stats across all tiers; what
            actually changes is HOW the boss plays. */}
        <div style={{ fontSize: 11, color: PALETTE.textMid, lineHeight: 1.4, marginBottom: 12 }}>
          {difficulty === 'normal' && <>Plays straightforward — best card, attack threats.</>}
          {difficulty === 'hard' && <>Plays smart — saves spells, picks threats, refuses bad trades.</>}
          {difficulty === 'mythic' && <>Plays brutal — completes its own bonds, breaks yours.</>}
        </div>

        {/* Start button — the unambiguous launch trigger for this fight at
            the currently-picked tier. Big, full width, includes the
            difficulty label + reward so the player can see exactly what
            they're committing to before tapping. */}
        <button
          onClick={onClick}
          style={{
            width: '100%', padding: '12px 14px',
            border: 'none', borderRadius: 14,
            background: `linear-gradient(180deg, ${e.color} 0%, ${e.deep} 100%)`,
            color: '#fff',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            boxShadow: '0 6px 14px rgba(0,0,0,.18)',
            transition: 'transform .1s, filter .15s',
          }}
          onPointerDown={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.99)'; }}
          onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
          onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Swords size={16} strokeWidth={2.6} />
            Start · {profile.label}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(0,0,0,.18)', padding: '4px 10px', borderRadius: 10,
            fontSize: 12, fontWeight: 800,
          }}>
            <Coins size={13} fill="#ffd166" strokeWidth={2.2} color="#ffd166" />
            +{reward}
          </span>
        </button>
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
