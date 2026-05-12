import { useRef, useState } from 'react';
import { ArrowLeft, Check, Flame, Lock, Skull, Swords, ChevronLeft, ChevronRight } from 'lucide-react';
import { BOSSES, type BossDef } from '../data/bosses';
import { ELEMENTS } from '../data/elements';
import { TEMPLATES } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { Card } from '../components/Card';
import { ElementGlyph } from '../components/ElementGlyph';
import { iconBtn, PALETTE } from '../components/styles';
import type { CollectionCard, Difficulty, ElementId } from '../game/types';
import { difficultyProfile } from '../game/match';

interface Props {
  defeatedIds: string[];
  /** Highest difficulty the player has *beaten* per boss id. Drives the
   *  small medal that decorates an already-conquered boss. */
  beatenAt: Record<string, Difficulty>;
  /** When `testThemeId` is provided, the match runs with an auto-built
   *  placeholder deck made from that theme's templates instead of the
   *  player's saved deck. Lets you test boss balance without first
   *  capturing 12+ photos and building a deck. */
  onPick: (boss: BossDef, difficulty: Difficulty, testThemeId: ElementId | null) => void;
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
  /** Per-boss test-deck choice. null = use the player's saved deck.
   *  Any ElementId here means "build a placeholder deck from that
   *  theme's templates and use it instead." Stored per-boss so the
   *  user can A/B different themes against each boss without losing
   *  their picks. */
  const [testTheme, setTestTheme] = useState<Record<string, ElementId | null>>({});

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
            const test = testTheme[boss.id] ?? null;
            return (
              <div key={boss.id} style={{ width: `${100 / total}%`, flex: '0 0 auto', padding: '0 16px' }}>
                <BossPage
                  boss={boss}
                  defeated={defeatedIds.includes(boss.id)}
                  beatenAt={beatenAt[boss.id]}
                  difficulty={cur}
                  testThemeId={test}
                  onChangeTestTheme={(t) => setTestTheme(s => ({ ...s, [boss.id]: t }))}
                  onChangeDifficulty={(d) => setPicked(p => ({ ...p, [boss.id]: d }))}
                  onStart={() => onPick(boss, cur, test)}
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
  boss, defeated, beatenAt, difficulty, onChangeDifficulty,
  testThemeId, onChangeTestTheme,
  onStart,
}: {
  boss: BossDef;
  defeated: boolean;
  beatenAt?: Difficulty;
  difficulty: Difficulty;
  onChangeDifficulty: (d: Difficulty) => void;
  /** Selected test-deck theme (null = use the player's saved deck). */
  testThemeId: ElementId | null;
  onChangeTestTheme: (t: ElementId | null) => void;
  onStart: () => void;
}) {
  const e = ELEMENTS[boss.themeId];
  const profile = difficultyProfile(difficulty);
  const reward = Math.round(boss.rewardCoins * profile.rewardMult);
  // Tier progression — Hard unlocks after Normal win on this boss,
  // Mythic unlocks after Hard win. Test-deck matches DON'T count
  // (onMatchExit skips bossesBeatenAt for test runs), so the player
  // has to earn each tier with their own deck. This is per-boss:
  // beating Mom on Hard doesn't unlock Mythic for The Manager.
  const ORDER: Difficulty[] = ['normal', 'hard', 'mythic'];
  const beaten = beatenAt; // highest difficulty cleared on THIS boss
  const isUnlocked = (d: Difficulty) => {
    if (d === 'normal') return true;
    if (d === 'hard')   return !!beaten && ORDER.indexOf(beaten) >= ORDER.indexOf('normal');
    /* mythic */         return !!beaten && ORDER.indexOf(beaten) >= ORDER.indexOf('hard');
  };
  const tierLocked = !isUnlocked(difficulty);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      gap: 8,
      padding: '6px 4px 4px',
      minHeight: 0,
    }}>
      {/* Banner — themed gradient with avatar + name + theme glyph.
          Intro quote moved INTO the banner (no separate row) so the
          page has fewer chunks competing for vertical space. */}
      <div style={{
        background: `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 100%)`,
        borderRadius: 18,
        padding: '14px 16px 14px',
        position: 'relative',
        boxShadow: '0 8px 20px rgba(58,46,42,.15)',
        color: '#fff',
        display: 'flex', alignItems: 'center', gap: 14,
        flex: '0 0 auto',
      }}>
        <div style={{
          width: 76, height: 76, borderRadius: '50%',
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
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.05 }}>{boss.name}</div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.92 }}>
            <ElementGlyph el={boss.themeId} size={13} />
            <span>{e.name} deck</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85, fontStyle: 'italic', lineHeight: 1.3 }}>
            “{boss.intro}”
          </div>
        </div>
        {defeated && (
          <BeatenBadge tier={beatenAt ?? 'normal'} />
        )}
      </div>

      {/* Setup row — DIFFICULTY pills. Compact label above so they
          read as a labelled segmented control. */}
      <div data-no-swipe style={{ flex: '0 0 auto' }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
          color: PALETTE.textMid, marginBottom: 5, paddingLeft: 4,
        }}>
          DIFFICULTY
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIFFICULTIES.map(d => {
            const active = difficulty === d;
            const dp = difficultyProfile(d);
            const unlocked = isUnlocked(d);
            return (
              <button
                key={d}
                data-no-swipe
                onClick={() => unlocked && onChangeDifficulty(d)}
                disabled={!unlocked}
                style={{
                  flex: 1, padding: '10px 0',
                  background: !unlocked
                    ? 'rgba(255,255,255,.25)'
                    : active ? '#fff' : 'rgba(255,255,255,.55)',
                  color: !unlocked
                    ? '#9a958c'
                    : active ? PALETTE.text : PALETTE.textMid,
                  border: active && unlocked
                    ? '2px solid #3a2e2a'
                    : '2px solid transparent',
                  borderRadius: 12,
                  fontFamily: 'inherit', fontWeight: 800, fontSize: 13,
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.04em',
                  opacity: unlocked ? 1 : 0.6,
                  boxShadow: active && unlocked
                    ? '0 4px 10px rgba(58,46,42,.22)'
                    : '0 1px 2px rgba(58,46,42,.06)',
                  transition: 'background .15s, border-color .15s, box-shadow .15s, opacity .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                {!unlocked
                  ? <Lock size={13} strokeWidth={2.6} />
                  : d === 'mythic' ? <Skull size={14} strokeWidth={2.4} />
                  : d === 'hard'   ? <Flame size={14} strokeWidth={2.4} />
                  : null}
                {dp.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Test-deck picker — quick-fight using a placeholder theme
          deck instead of your saved one. Sits in its own labelled
          row so users always know which deck they're committing to
          when they tap Start. */}
      <div data-no-swipe style={{ flex: '0 0 auto' }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
          color: PALETTE.textMid, marginBottom: 5, paddingLeft: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>YOUR DECK</span>
          {testThemeId && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              color: PALETTE.textMid,
              padding: '1px 6px', borderRadius: 8,
              background: 'rgba(58,46,42,.08)',
            }}>
              TEST · NO REWARDS
            </span>
          )}
        </div>
        <div
          style={{
            display: 'flex', gap: 6,
            overflowX: 'auto', overflowY: 'hidden',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <ThemeChip
            active={testThemeId === null}
            label="My Deck"
            color={PALETTE.text}
            onClick={() => onChangeTestTheme(null)}
          />
          {(Object.keys(ELEMENTS) as ElementId[]).map(t => (
            <ThemeChip
              key={t}
              active={testThemeId === t}
              label={ELEMENTS[t].name}
              color={ELEMENTS[t].color}
              onClick={() => onChangeTestTheme(t)}
            />
          ))}
        </div>
      </div>

      {/* Boss deck preview — continuously scrolling marquee. Flex
          shrinks first so the Start block below is ALWAYS visible. */}
      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <BossDeckPreview boss={boss} />
      </div>

      {/* Playstyle blurb + Start. Pinned to bottom (flex 0 0 auto)
          so the button never gets pushed off-screen by anything
          above it. Big themed gradient, FIGHT framing, reward chip
          on the right. Pulses subtly on press. */}
      <div data-no-swipe style={{
        background: '#fff',
        borderRadius: 16,
        padding: 4,
        boxShadow: `0 8px 20px ${e.deep}33, 0 0 0 1.5px ${e.color}33`,
        display: 'flex', flexDirection: 'column', gap: 4,
        flex: '0 0 auto',
      }}>
        <div style={{
          padding: '10px 14px 4px',
          fontSize: 12, color: PALETTE.text, lineHeight: 1.35,
        }}>
          {boss.playstyle}
        </div>
        <button
          onClick={onStart}
          disabled={tierLocked}
          style={{
            width: '100%', padding: '14px 16px',
            border: 'none', borderRadius: 14,
            // Standardized button — same across every boss / theme so
            // the action reads as one consistent commit. (Banner above
            // is still theme-colored, that's the boss identity. The
            // button is the player action and shouldn't compete.)
            background: tierLocked
              ? '#3a2e2a55'
              : 'linear-gradient(180deg, #3a2e2a 0%, #1a1414 100%)',
            color: '#fff',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
            letterSpacing: '0.04em',
            cursor: tierLocked ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            boxShadow: tierLocked ? 'none' : '0 6px 14px rgba(0,0,0,.18)',
            transition: 'transform .1s, filter .15s',
          }}
          onPointerDown={(ev) => { if (!tierLocked) (ev.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.99)'; }}
          onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
          onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Swords size={18} strokeWidth={2.6} />
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.06em' }}>
              {tierLocked ? 'LOCKED' : 'FIGHT'}
            </span>
            {!tierLocked && (
              <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 700, letterSpacing: '0.12em' }}>
                · {profile.label.toUpperCase()}
              </span>
            )}
          </span>
          {!tierLocked && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,.14)',
              padding: '5px 11px', borderRadius: 10,
              fontSize: 11, fontWeight: 800,
              color: '#fff',
              letterSpacing: '0.04em',
            }}>
              {testThemeId === null ? `+${reward}` : 'TEST'}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Continuously-scrolling preview of the boss's deck. Renders all 12 cards
 * the boss will play (using the same AI photos the match engine uses,
 * with `photoOverrides` honoured) at small scale in a horizontal row that
 * marquees right-to-left forever. Duplicated inline so the loop is
 * seamless. Soft fade-edges hint that more cards exist off-screen.
 */
function BossDeckPreview({ boss }: { boss: BossDef }) {
  // Resolve each deck template id into a CollectionCard the Card
  // component can render. Memoise inline: this only recomputes when the
  // boss object changes, which only happens when the player swipes.
  const cards: CollectionCard[] = boss.deck.map((tid, i) => {
    const tpl = TEMPLATES.find(t => t.id === tid);
    if (!tpl) return null;
    const photo = boss.photoOverrides?.[tid] ?? aiPhoto(tid);
    const c: CollectionCard = {
      ...tpl,
      uid: `preview-${boss.id}-${i}`,
      photo,
      nickname: undefined,
      isPlaceholder: true,
    };
    return c;
  }).filter((c): c is CollectionCard => !!c);

  if (cards.length === 0) return null;

  // Slow scroll (~22s for the full cycle) so the player can actually
  // read individual cards as they pass. Pauses on pointer hover so they
  // can inspect anything that catches their eye.
  const duration = 22;
  const doubled = [...cards, ...cards];

  return (
    <div style={{
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
      // Soft cream fade at the left + right edges so cards seem to drift
      // in / out of view instead of hard-clipping at the container edge.
      maskImage: 'linear-gradient(90deg, transparent 0, #000 8%, #000 92%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 8%, #000 92%, transparent 100%)',
    }}>
      <div style={{
        display: 'flex',
        gap: 8,
        width: 'max-content',
        animation: `deckMarquee ${duration}s linear infinite`,
        willChange: 'transform',
        padding: '6px 0',
      }}>
        {doubled.map((c, i) => (
          <div key={`${c.uid}-${i}`} style={{ flex: '0 0 auto' }}>
            <Card card={c} scale={0.32} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Small pill button used in the test-deck picker row. Neutral
 *  styling — active state is a dark filled pill, inactive is a
 *  bordered light pill. Consistent across themes so the user reads
 *  the SELECTION state, not the theme color. */
function ThemeChip({ active, label, onClick, disabled }: {
  active: boolean;
  label: string;
  /** Kept for backwards-compat with the call site but ignored — chips
   *  no longer tint by theme. Pass anything. */
  color?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: '0 0 auto',
        padding: '6px 12px',
        borderRadius: 999,
        border: active ? '1.5px solid #3a2e2a' : '1.5px solid rgba(58,46,42,.18)',
        background: active ? PALETTE.text : '#fff',
        color: active ? '#fff' : (disabled ? PALETTE.textMid : PALETTE.text),
        opacity: disabled ? 0.5 : 1,
        fontSize: 11, fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'background .12s, color .12s, border-color .12s',
      }}
    >
      {label}
    </button>
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
