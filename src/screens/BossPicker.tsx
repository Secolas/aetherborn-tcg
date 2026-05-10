import { useRef, useState } from 'react';
import { ArrowLeft, Check, Coins, Flame, Skull, Swords, ChevronLeft, ChevronRight } from 'lucide-react';
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
/** Min horizontal drag (px) for a swipe to commit to a page change. Below
 *  this, the slider snaps back to the current page. */
const SWIPE_THRESHOLD = 60;

/**
 * Mobile-first boss picker — one boss fills the screen at a time. Players
 * swipe horizontally between bosses, with chevron buttons + pagination
 * dots as visible affordances for mouse / keyboard / accessibility. The
 * difficulty pills and Start button live INSIDE each page so they're
 * always visible without scrolling.
 */
export function BossPicker({ defeatedIds, beatenAt, onPick, onBack }: Props) {
  const [pageIdx, setPageIdx] = useState(0);
  /** Difficulty pick per boss, sticky for the session. */
  const [picked, setPicked] = useState<Record<string, Difficulty>>({});

  // Swipe gesture state
  const startX = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const total = BOSSES.length;
  const clampPage = (i: number) => Math.max(0, Math.min(total - 1, i));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore drags that originate on interactive controls (buttons, pills)
    // so tapping them doesn't accidentally start a swipe.
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-swipe]')) return;
    startX.current = e.clientX;
    setDragging(true);
    setDragX(0);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (!dragging) return;
    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      setPageIdx(p => clampPage(p + (dragX < 0 ? 1 : -1)));
    }
    setDragX(0);
    setDragging(false);
  };

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
      {/* Header */}
      <div style={{ padding: '52px 16px 6px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 2 }}>
        <button onClick={onBack} style={iconBtn} data-no-swipe><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Pick a fight</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            {defeatedIds.length} of {total} defeated
          </div>
        </div>
      </div>

      {/* Carousel viewport — hides everything outside the current page.
          The inner track holds all boss pages laid out horizontally and
          translates left/right via transform; while dragging the
          transition is off so the track follows the finger. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          // touch-action: pan-y allows the page to vertically scroll if
          // ever needed while we still own horizontal swipes.
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
      >
        <div style={{
          display: 'flex',
          height: '100%',
          width: `${total * 100}%`,
          transform: `translate3d(calc(${-pageIdx * (100 / total)}% + ${dragX}px), 0, 0)`,
          transition: dragging ? 'none' : 'transform .35s cubic-bezier(.2,.8,.3,1)',
          willChange: 'transform',
        }}>
          {BOSSES.map(boss => {
            const cur = picked[boss.id] ?? 'normal';
            return (
              <div key={boss.id} style={{ width: `${100 / total}%`, flex: '0 0 auto', padding: '0 16px' }}>
                <BossPage
                  boss={boss}
                  defeated={defeatedIds.includes(boss.id)}
                  beatenAt={beatenAt[boss.id]}
                  difficulty={cur}
                  onChangeDifficulty={(d) => setPicked(p => ({ ...p, [boss.id]: d }))}
                  onStart={() => onPick(boss, cur)}
                />
              </div>
            );
          })}
        </div>

        {/* Edge chevrons — visible affordance for swipe on desktop /
            anyone who didn't realize it's a carousel. Hidden at the
            extremes. */}
        {pageIdx > 0 && (
          <button
            data-no-swipe
            onClick={() => setPageIdx(p => clampPage(p - 1))}
            aria-label="Previous boss"
            style={chevronBtn('left')}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </button>
        )}
        {pageIdx < total - 1 && (
          <button
            data-no-swipe
            onClick={() => setPageIdx(p => clampPage(p + 1))}
            aria-label="Next boss"
            style={chevronBtn('right')}
          >
            <ChevronRight size={22} strokeWidth={2.6} />
          </button>
        )}
      </div>

      {/* Pagination dots — also tappable as a backup navigation. */}
      <div style={{
        padding: '8px 0 20px',
        display: 'flex', justifyContent: 'center', gap: 8,
      }}>
        {BOSSES.map((b, i) => {
          const active = i === pageIdx;
          return (
            <button
              key={b.id}
              data-no-swipe
              onClick={() => setPageIdx(i)}
              aria-label={`Go to ${b.name}`}
              style={{
                width: active ? 22 : 8, height: 8, borderRadius: 4,
                background: active ? '#ee5a52' : 'rgba(58,46,42,.22)',
                border: 'none',
                padding: 0, cursor: 'pointer',
                transition: 'width .25s, background .25s',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function chevronBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%', [side]: 8, transform: 'translateY(-50%)',
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(255,255,255,.85)',
    border: '1.5px solid rgba(58,46,42,.12)',
    display: 'grid', placeItems: 'center',
    cursor: 'pointer',
    color: PALETTE.text,
    boxShadow: '0 4px 10px rgba(0,0,0,.15)',
    zIndex: 3,
  };
}

/**
 * One boss's full-screen "page" inside the carousel. Lays out everything
 * the player needs to commit to a fight — avatar, name, intro, difficulty,
 * AI behavior, reward, and the Start button — on a single phone screen
 * without scrolling.
 */
function BossPage({
  boss, defeated, beatenAt, difficulty, onChangeDifficulty, onStart,
}: {
  boss: BossDef;
  defeated: boolean;
  beatenAt?: Difficulty;
  difficulty: Difficulty;
  onChangeDifficulty: (d: Difficulty) => void;
  onStart: () => void;
}) {
  const e = ELEMENTS[boss.themeId];
  const profile = difficultyProfile(difficulty);
  const reward = Math.round(boss.rewardCoins * profile.rewardMult);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      gap: 10,
      padding: '8px 4px 4px',
    }}>
      {/* Banner — themed gradient with avatar + name + subtitle. */}
      <div style={{
        background: `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 100%)`,
        borderRadius: 18,
        padding: '18px 18px 16px',
        position: 'relative',
        boxShadow: '0 8px 20px rgba(58,46,42,.15)',
        color: '#fff',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
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
            fontSize: 30, fontWeight: 700,
            color: '#fff',
            fontFamily: '"Fredoka", system-ui',
          }}>{!boss.avatarPhoto && boss.avatar}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.05 }}>{boss.name}</div>
          <div style={{ fontSize: 12, opacity: 0.92, marginTop: 2, fontStyle: 'italic' }}>
            {boss.subtitle}
          </div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.9 }}>
            <ElementGlyph el={boss.themeId} size={14} />
            <span>{e.name} deck</span>
          </div>
        </div>
        {defeated && (
          <BeatenBadge tier={beatenAt ?? 'normal'} />
        )}
      </div>

      {/* Intro quote */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        padding: '12px 14px',
        fontSize: 13, color: PALETTE.text, fontStyle: 'italic',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(58,46,42,.06)',
      }}>
        “{boss.intro}”
      </div>

      {/* Difficulty selector */}
      <div data-no-swipe>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
          color: PALETTE.textMid, marginBottom: 6, paddingLeft: 4,
        }}>
          DIFFICULTY
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIFFICULTIES.map(d => {
            const active = difficulty === d;
            const dp = difficultyProfile(d);
            return (
              <button
                key={d}
                data-no-swipe
                onClick={() => onChangeDifficulty(d)}
                style={{
                  flex: 1, padding: '11px 0',
                  background: active ? '#fff' : 'rgba(255,255,255,.55)',
                  color: active ? PALETTE.text : PALETTE.textMid,
                  border: active ? '2px solid #ee5a52' : '2px solid transparent',
                  borderRadius: 12,
                  fontFamily: 'inherit', fontWeight: 800, fontSize: 13,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  boxShadow: active
                    ? '0 4px 10px rgba(238,90,82,.22)'
                    : '0 1px 2px rgba(58,46,42,.06)',
                  transition: 'background .15s, border-color .15s, box-shadow .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                {d === 'mythic' ? <Skull size={14} strokeWidth={2.4} /> : d === 'hard' ? <Flame size={14} strokeWidth={2.4} /> : null}
                {dp.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Spacer — push the playstyle + Start block toward the bottom so
          the difficulty pills sit visually in the upper half. */}
      <div style={{ flex: '1 0 auto', minHeight: 4 }} />

      {/* Playstyle + Start block — visually grouped so the player reads
          "what this fight is about" right before tapping Start. Themed
          color frame keys to the boss's element so each fight feels
          distinct. The difficulty pills are stylistic AI knobs above;
          the playstyle blurb is about THIS BOSS and stays consistent
          across tiers. */}
      <div data-no-swipe style={{
        background: '#fff',
        borderRadius: 16,
        padding: 4,
        boxShadow: `0 8px 20px ${e.deep}33, 0 0 0 1.5px ${e.color}33`,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{
          padding: '10px 14px 4px',
          fontSize: 12, color: PALETTE.text, lineHeight: 1.4,
        }}>
          {boss.playstyle}
        </div>
        <button
          onClick={onStart}
          style={{
            width: '100%', padding: '14px 16px',
            border: 'none', borderRadius: 14,
            background: `linear-gradient(180deg, ${e.color} 0%, ${e.deep} 100%)`,
            color: '#fff',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
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
            <Swords size={17} strokeWidth={2.6} />
            Start · {profile.label}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(0,0,0,.18)', padding: '5px 11px', borderRadius: 10,
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
    hard:   { bg: '#ff7e5f', fg: '#fff',    label: 'Hard' },
    mythic: { bg: '#3a2e2a', fg: '#ffd166', label: 'Mythic' },
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
