import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, Flame, Lock, Skull, Swords,
  ChevronLeft, ChevronRight, Sparkles, AlertCircle, Layers,
} from 'lucide-react';
import { BOSSES, type BossDef } from '../data/bosses';
import { ELEMENTS } from '../data/elements';
import { TEMPLATES } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { Card } from '../components/Card';
import { ElementGlyph } from '../components/ElementGlyph';
import { iconBtn, PALETTE } from '../components/styles';
import type { CollectionCard, DeckSlot, Difficulty, ElementId } from '../game/types';
import { difficultyProfile } from '../game/match';

const DIFFICULTIES: Difficulty[] = ['normal', 'hard', 'mythic'];
const ORDER: Difficulty[] = ['normal', 'hard', 'mythic'];
/** Min horizontal drag (px) for a swipe to commit to a page change. */
const SWIPE_THRESHOLD = 60;
/** Minimum playable cards required to start a real (non-test) match.
 *  A "playable" card is one whose photo has been captured. */
const MIN_PLAYABLE_DECK = 8;

interface Props {
  defeatedIds: string[];
  /** Highest difficulty the player has *beaten* per boss id. */
  beatenAt: Record<string, Difficulty>;
  /** All saved deck slots. Used by the deck rail. */
  decks: DeckSlot[];
  /** Currently-active deck id. May be missing if the player has no
   *  decks at all; the picker falls back to the first deck. */
  activeDeckId: string | undefined;
  /** Full owned collection — used to count "playable" cards (cards with
   *  a captured photo) inside each saved deck so the rail can surface a
   *  readiness status per deck. */
  collection: CollectionCard[];
  /** Set which saved deck is active. */
  onSetActiveDeck: (deckId: string) => void;
  /** Launch a match. testThemeId === null means "use the active saved deck";
   *  any ElementId here means "synthesize a placeholder deck from that
   *  theme's templates" (no rewards). */
  onPick: (boss: BossDef, difficulty: Difficulty, testThemeId: ElementId | null) => void;
  onBack: () => void;
  /** Optional: takes the player to the Deck Builder. Surfaced as a CTA
   *  in the friendly empty state when no decks exist. */
  onOpenDeckBuilder?: () => void;
}

/** Listen to `prefers-reduced-motion` so we can skip the non-essential
 *  animations (CTA pulse, sparkle) for users who've opted out. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);
  return reduced;
}

/**
 * Boss Picker — entry point to every PvE fight. Built around three rails:
 *   1) Boss Rail   — every boss, one tap to jump.
 *   2) Carousel    — the focused boss card (banner + deck preview).
 *   3) Deck Rail   — every saved deck + optional test-theme overrides.
 *
 * Selection is sticky-by-boss: difficulty and test-theme persist per boss
 * for the session so A/B-ing different setups across bosses doesn't lose
 * state. The active deck (used when test-theme is null) is the player's
 * global active-deck id, so changing it here changes it everywhere.
 */
export function BossPicker({
  defeatedIds, beatenAt, decks, activeDeckId, collection,
  onSetActiveDeck, onPick, onBack, onOpenDeckBuilder,
}: Props) {
  const reduced = useReducedMotion();
  const [pageIdx, setPageIdx] = useState(0);
  /** Difficulty pick per boss, sticky for the session. */
  const [picked, setPicked] = useState<Record<string, Difficulty>>({});
  /** Per-boss test-deck theme. null = use the player's active deck. */
  const [testTheme, setTestTheme] = useState<Record<string, ElementId | null>>({});

  // Swipe gesture state
  const startX = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const total = BOSSES.length;
  const clampPage = (i: number) => Math.max(0, Math.min(total - 1, i));

  // Resolve active deck with a safe fallback to the first deck if the
  // stored id has gone stale (deleted, never set, etc.).
  const resolvedActiveDeckId =
    (activeDeckId && decks.find(d => d.id === activeDeckId)?.id)
    ?? decks[0]?.id
    ?? null;
  const activeDeck = decks.find(d => d.id === resolvedActiveDeckId) ?? null;

  // Pre-compute playable count per deck. O(decks * cards) but both are
  // small in practice (≤5 decks, ~60 cards), so a memo per render is
  // plenty.
  const playableByDeck = useMemo(() => {
    const playableUids = new Set(collection.filter(c => !!c.photo).map(c => c.uid));
    const map: Record<string, number> = {};
    for (const d of decks) {
      map[d.id] = d.uids.reduce((n, uid) => n + (playableUids.has(uid) ? 1 : 0), 0);
    }
    return map;
  }, [decks, collection]);
  const activePlayable = activeDeck ? (playableByDeck[activeDeck.id] ?? 0) : 0;

  const currentBoss = BOSSES[pageIdx];
  const currentDifficulty = picked[currentBoss?.id ?? ''] ?? 'normal';
  const currentTestTheme = testTheme[currentBoss?.id ?? ''] ?? null;

  const isUnlocked = (boss: BossDef, d: Difficulty) => {
    if (d === 'normal') return true;
    const beaten = beatenAt[boss.id];
    if (d === 'hard')   return !!beaten && ORDER.indexOf(beaten) >= ORDER.indexOf('normal');
    /* mythic */          return !!beaten && ORDER.indexOf(beaten) >= ORDER.indexOf('hard');
  };

  // ---------------------------------------------------------------
  // Smart CTA state. Drives the Start button label, color, and disabled
  // logic. Computed once per render against the *current* boss because
  // every rail above the CTA can change inputs (difficulty pill,
  // test-theme chip, deck chip).
  // ---------------------------------------------------------------
  const tierLocked = currentBoss ? !isUnlocked(currentBoss, currentDifficulty) : true;
  const usingTest = currentTestTheme !== null;
  const needsMoreCards = !usingTest && activePlayable < MIN_PLAYABLE_DECK;
  type CtaState = 'LOCKED' | 'NEED_DECK' | 'READY';
  const ctaState: CtaState =
    tierLocked ? 'LOCKED' :
    needsMoreCards ? 'NEED_DECK' :
    'READY';

  // ---------------------------------------------------------------
  // Swipe handling — preserved from previous picker. Interactive
  // controls opt out via [data-no-swipe].
  // ---------------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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

  // ---------------------------------------------------------------
  // Empty state — no decks at all. Shouldn't usually happen because
  // App.tsx migrates legacy saves to at least one deck slot, but the
  // picker is the first place the player would notice missing decks,
  // so handle it gracefully with a friendly CTA toward the builder.
  // ---------------------------------------------------------------
  if (decks.length === 0) {
    return (
      <EmptyDecksState
        onBack={onBack}
        onOpenDeckBuilder={onOpenDeckBuilder}
      />
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
        linear-gradient(180deg, #ffe8d6 0%, #ffd4b3 60%, #ffbe9c 100%)
      `,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Centered content stage. The PhoneShell expands to 1200px on
          desktop, but the picker is mobile-first — letting the carousel
          / rails / CTA stretch that wide looks unfriendly. We cap the
          content column at a phone-ish width and center it so desktop
          feels like a comfortable game window. Mobile is unaffected
          because the stage is already narrower than this max. */}
      <div style={{
        width: '100%',
        maxWidth: 540,
        height: '100%',
        display: 'flex', flexDirection: 'column',
        minHeight: 0,
        position: 'relative',
      }}>
      {/* ------------------------------------------------------- */}
      {/* 1) Header                                               */}
      {/* ------------------------------------------------------- */}
      <div style={{
        padding: '52px 16px 6px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'relative', zIndex: 2,
      }}>
        <button onClick={onBack} style={iconBtn} aria-label="Back" data-no-swipe>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Pick a fight</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            {defeatedIds.length} of {total} defeated
          </div>
        </div>
        {/* Position chip — keeps users oriented mid-swipe. */}
        <div
          aria-live="polite"
          aria-label={`Boss ${pageIdx + 1} of ${total}`}
          style={{
            background: '#fff',
            border: `1.5px solid ${PALETTE.border}`,
            borderRadius: 999,
            padding: '5px 11px',
            fontSize: 11, fontWeight: 800,
            color: PALETTE.text,
            letterSpacing: '0.04em',
            boxShadow: '0 2px 6px rgba(58,46,42,.08)',
          }}
        >
          {pageIdx + 1} / {total}
        </div>
      </div>

      {/* ------------------------------------------------------- */}
      {/* 2) Boss Rail                                            */}
      {/* ------------------------------------------------------- */}
      <BossRail
        currentIdx={pageIdx}
        defeatedIds={defeatedIds}
        reducedMotion={reduced}
        onJump={(i) => setPageIdx(clampPage(i))}
      />

      {/* ------------------------------------------------------- */}
      {/* 3) Deck Rail + readiness                                */}
      {/* ------------------------------------------------------- */}
      <DeckRail
        decks={decks}
        playableByDeck={playableByDeck}
        activeDeckId={activeDeck?.id ?? null}
        currentTestTheme={currentTestTheme}
        onPickDeck={(id) => {
          // Picking a saved deck clears any test-theme override for
          // THIS boss so the user's intent ("fight with my deck") is
          // honored without surprising them.
          if (currentBoss) {
            setTestTheme(t => ({ ...t, [currentBoss.id]: null }));
          }
          onSetActiveDeck(id);
        }}
        onPickTestTheme={(t) => {
          if (currentBoss) {
            setTestTheme(s => ({ ...s, [currentBoss.id]: t }));
          }
        }}
      />
      <ReadinessLine
        usingTest={usingTest}
        playable={activePlayable}
        min={MIN_PLAYABLE_DECK}
      />

      {/* ------------------------------------------------------- */}
      {/* 4) Carousel — boss banner + deck preview                */}
      {/* ------------------------------------------------------- */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="region"
        aria-roledescription="carousel"
        aria-label="Bosses"
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
      >
        <div style={{
          display: 'flex',
          height: '100%',
          width: `${total * 100}%`,
          transform: `translate3d(calc(${-pageIdx * (100 / total)}% + ${dragX}px), 0, 0)`,
          transition: dragging
            ? 'none'
            : `transform ${reduced ? '.18s' : '.45s'} cubic-bezier(.22,.85,.28,1)`,
          willChange: 'transform',
        }}>
          {BOSSES.map((boss, i) => (
            <div key={boss.id} style={{ width: `${100 / total}%`, flex: '0 0 auto', padding: '0 16px' }}>
              <BossPage
                boss={boss}
                visible={i === pageIdx}
                defeated={defeatedIds.includes(boss.id)}
                beatenAt={beatenAt[boss.id]}
                reducedMotion={reduced}
              />
            </div>
          ))}
        </div>

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

      {/* Pagination dots — secondary navigation. */}
      <div role="tablist" aria-label="Boss pagination" style={{
        padding: '6px 0 6px',
        display: 'flex', justifyContent: 'center', gap: 8,
      }}>
        {BOSSES.map((b, i) => {
          const active = i === pageIdx;
          return (
            <button
              key={b.id}
              role="tab"
              aria-selected={active}
              aria-label={`Go to ${b.name}`}
              data-no-swipe
              onClick={() => setPageIdx(i)}
              style={{
                width: active ? 22 : 8, height: 8, borderRadius: 4,
                background: active ? PALETTE.accent : 'rgba(58,46,42,.22)',
                border: 'none',
                padding: 0, cursor: 'pointer',
                transition: reduced ? 'none' : 'width .25s, background .25s',
              }}
            />
          );
        })}
      </div>

      {/* ------------------------------------------------------- */}
      {/* 5) Difficulty row + 6) Start CTA (anchored)             */}
      {/* ------------------------------------------------------- */}
      {currentBoss && (
        <div data-no-swipe style={{
          padding: '6px 16px 18px',
          display: 'flex', flexDirection: 'column', gap: 8,
          flex: '0 0 auto',
        }}>
          <DifficultyRow
            boss={currentBoss}
            value={currentDifficulty}
            isUnlocked={(d) => isUnlocked(currentBoss, d)}
            onChange={(d) => setPicked(p => ({ ...p, [currentBoss.id]: d }))}
          />
          <StartButton
            state={ctaState}
            boss={currentBoss}
            difficulty={currentDifficulty}
            usingTest={usingTest}
            playable={activePlayable}
            min={MIN_PLAYABLE_DECK}
            reducedMotion={reduced}
            onOpenDeckBuilder={onOpenDeckBuilder}
            onStart={() => onPick(currentBoss, currentDifficulty, currentTestTheme)}
          />
        </div>
      )}
      </div>
    </div>
  );
}

// =================================================================
// BOSS RAIL
// =================================================================
/**
 * Compact horizontal row of every boss. Tap an avatar to jump straight
 * to that boss in the carousel. Active boss is ringed in its element
 * gradient; beaten state is intentionally NOT marked on the rail —
 * a checkmark on the rail avatar reads like a finished to-do, which
 * undercuts the "pick a fight" mood. The beaten medal still appears
 * in the boss banner when the boss is focused.
 */
function BossRail({
  currentIdx, defeatedIds, reducedMotion, onJump,
}: {
  currentIdx: number;
  defeatedIds: string[];
  reducedMotion: boolean;
  onJump: (i: number) => void;
}) {
  // Auto-scroll the rail so the active boss stays in view when the
  // user swipes the carousel. Quietly best-effort — if the ref isn't
  // mounted yet on the first paint we just no-op.
  const railRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const el = rail.querySelector<HTMLButtonElement>(`[data-rail-idx="${currentIdx}"]`);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIdx, reducedMotion]);

  return (
    <div
      ref={railRef}
      role="tablist"
      aria-label="Boss list"
      data-no-swipe
      className="no-scrollbar"
      style={{
        display: 'flex', gap: 10,
        overflowX: 'auto', overflowY: 'hidden',
        padding: '6px 16px 8px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {BOSSES.map((b, i) => {
        const active = i === currentIdx;
        const e = ELEMENTS[b.themeId];
        const defeated = defeatedIds.includes(b.id);
        return (
          <button
            key={b.id}
            role="tab"
            aria-selected={active}
            aria-label={`${b.name}${defeated ? ', defeated' : ''}`}
            data-rail-idx={i}
            onClick={() => onJump(i)}
            style={{
              flex: '0 0 auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '4px 4px 6px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              width: 64,
              borderRadius: 12,
              fontFamily: 'inherit',
              transition: reducedMotion ? 'none' : 'transform .15s',
            }}
            onPointerDown={(ev) => { if (!reducedMotion) (ev.currentTarget as HTMLElement).style.transform = 'scale(0.96)'; }}
            onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <div style={{
              position: 'relative',
              width: 48, height: 48, borderRadius: '50%',
              padding: 2,
              background: active
                ? `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 100%)`
                : '#ffffff',
              boxShadow: active
                ? `0 4px 12px ${e.color}66`
                : '0 2px 6px rgba(58,46,42,.10)',
              transition: reducedMotion ? 'none' : 'box-shadow .15s, background .15s',
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: b.avatarPhoto
                  ? `url(${b.avatarPhoto}) center/cover`
                  : `linear-gradient(160deg, ${e.deep} 0%, ${e.color} 100%)`,
                display: 'grid', placeItems: 'center',
                color: '#fff', fontWeight: 700, fontSize: 18,
                border: active ? '2px solid #fff' : '1.5px solid rgba(58,46,42,.10)',
              }} aria-hidden>
                {!b.avatarPhoto && b.avatar}
              </div>
              {/* No "beaten" check badge on the rail avatar — the medal
                  inside the boss banner already tells that story when
                  the boss is focused. A small dot on the rail just
                  makes the avatar read like a completed to-do, which
                  isn't the vibe we want for the picker. */}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: active ? PALETTE.text : PALETTE.textMid,
              maxWidth: 64,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
            }}>
              {b.name}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// =================================================================
// DECK RAIL
// =================================================================
/**
 * Row of chips for every saved deck plus the optional test-deck themes.
 * Active selection (saved deck OR test theme) is highlighted clearly.
 * Tapping a saved-deck chip sets it active globally; tapping a test
 * theme chip sets that test override locally (no rewards on win).
 */
function DeckRail({
  decks, playableByDeck, activeDeckId, currentTestTheme,
  onPickDeck, onPickTestTheme,
}: {
  decks: DeckSlot[];
  playableByDeck: Record<string, number>;
  activeDeckId: string | null;
  currentTestTheme: ElementId | null;
  onPickDeck: (id: string) => void;
  onPickTestTheme: (t: ElementId | null) => void;
}) {
  return (
    <div data-no-swipe style={{ padding: '2px 16px 0' }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
        color: PALETTE.textMid, marginBottom: 5, paddingLeft: 2,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Layers size={11} strokeWidth={2.6} />
        <span>YOUR DECK</span>
        {currentTestTheme && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            color: PALETTE.text,
            padding: '2px 7px', borderRadius: 8,
            background: PALETTE.yellow,
          }}>
            TEST · NO REWARDS
          </span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label="Pick a deck"
        className="no-scrollbar"
        style={{
          display: 'flex', gap: 6,
          overflowX: 'auto', overflowY: 'hidden',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {decks.map(d => {
          const count = playableByDeck[d.id] ?? 0;
          const ready = count >= MIN_PLAYABLE_DECK;
          const active = currentTestTheme === null && d.id === activeDeckId;
          return (
            <DeckChip
              key={d.id}
              label={d.name}
              count={count}
              ready={ready}
              active={active}
              onClick={() => onPickDeck(d.id)}
            />
          );
        })}

        {/* Visual divider before the test-deck section. */}
        <div aria-hidden style={{
          flex: '0 0 auto',
          width: 1, alignSelf: 'stretch',
          background: 'rgba(58,46,42,.18)',
          margin: '4px 4px',
        }} />

        {/* Test-deck theme chips — secondary group. */}
        {(Object.keys(ELEMENTS) as ElementId[]).map(t => {
          const active = currentTestTheme === t;
          return (
            <ThemeChip
              key={t}
              active={active}
              label={`Test · ${ELEMENTS[t].name}`}
              themeId={t}
              onClick={() => onPickTestTheme(active ? null : t)}
            />
          );
        })}
      </div>
    </div>
  );
}

// =================================================================
// READINESS LINE
// =================================================================
/**
 * Short status line that explains what'll happen if Start is tapped.
 * Lives between the deck rail and the carousel so it's always visible
 * without scrolling.
 */
function ReadinessLine({
  usingTest, playable, min,
}: { usingTest: boolean; playable: number; min: number }) {
  if (usingTest) {
    return (
      <div style={{
        margin: '0 16px 4px',
        fontSize: 11, fontWeight: 600,
        color: PALETTE.textMid,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Sparkles size={11} strokeWidth={2.4} />
        <span>Test deck — quick fight, no rewards.</span>
      </div>
    );
  }
  const ready = playable >= min;
  return (
    <div style={{
      margin: '0 16px 4px',
      fontSize: 11, fontWeight: 700,
      color: ready ? '#1f7a4c' : '#b04a2e',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {ready ? <Check size={12} strokeWidth={3} /> : <AlertCircle size={12} strokeWidth={2.6} />}
      <span>
        {ready
          ? `Ready to battle (${playable} cards)`
          : `Need at least ${min} playable cards (${playable}/${min})`}
      </span>
    </div>
  );
}

// =================================================================
// BOSS PAGE (carousel slide content)
// =================================================================
function BossPage({
  boss, visible, defeated, beatenAt, reducedMotion,
}: {
  boss: BossDef;
  visible: boolean;
  defeated: boolean;
  beatenAt?: Difficulty;
  reducedMotion: boolean;
}) {
  const e = ELEMENTS[boss.themeId];
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      gap: 8,
      padding: '6px 0 4px',
      minHeight: 0,
    }}>
      {/* Banner */}
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
          }} aria-hidden>{!boss.avatarPhoto && boss.avatar}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.05 }}>{boss.name}</div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.92 }}>
            <ElementGlyph el={boss.themeId} size={13} />
            <span>{e.name} deck</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.88, fontStyle: 'italic', lineHeight: 1.3 }}>
            “{boss.intro}”
          </div>
        </div>
        {defeated && (
          <BeatenBadge tier={beatenAt ?? 'normal'} reducedMotion={reducedMotion} />
        )}
      </div>

      {/* Playstyle blurb */}
      <div style={{
        background: 'rgba(255,255,255,.7)',
        borderRadius: 12,
        padding: '8px 12px',
        fontSize: 11, lineHeight: 1.35,
        color: PALETTE.text,
        boxShadow: '0 2px 6px rgba(58,46,42,.05)',
        flex: '0 0 auto',
      }}>
        {boss.playstyle}
      </div>

      {/* Marquee preview */}
      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <BossDeckPreview boss={boss} paused={!visible} reducedMotion={reducedMotion} />
      </div>
    </div>
  );
}

// =================================================================
// DIFFICULTY ROW
// =================================================================
function DifficultyRow({
  boss, value, isUnlocked, onChange,
}: {
  boss: BossDef;
  value: Difficulty;
  isUnlocked: (d: Difficulty) => boolean;
  onChange: (d: Difficulty) => void;
}) {
  return (
    <div data-no-swipe>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
        color: PALETTE.textMid, marginBottom: 5, paddingLeft: 4,
      }}>
        DIFFICULTY
      </div>
      <div role="radiogroup" aria-label={`Difficulty for ${boss.name}`} style={{ display: 'flex', gap: 6 }}>
        {DIFFICULTIES.map(d => {
          const active = value === d;
          const dp = difficultyProfile(d);
          const unlocked = isUnlocked(d);
          return (
            <button
              key={d}
              role="radio"
              aria-checked={active}
              aria-label={`${dp.label}${unlocked ? '' : ', locked'}`}
              data-no-swipe
              onClick={() => unlocked && onChange(d)}
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
                transition: 'background .15s, border-color .15s, box-shadow .15s, opacity .15s, transform .1s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                outline: 'none',
              }}
              onFocus={(ev) => { (ev.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(244,208,74,.6)'; }}
              onBlur={(ev) => {
                (ev.currentTarget as HTMLElement).style.boxShadow = active && unlocked
                  ? '0 4px 10px rgba(58,46,42,.22)'
                  : '0 1px 2px rgba(58,46,42,.06)';
              }}
            >
              {!unlocked
                ? <Lock size={13} strokeWidth={2.6} aria-hidden />
                : d === 'mythic' ? <Skull size={14} strokeWidth={2.4} aria-hidden />
                : d === 'hard'   ? <Flame size={14} strokeWidth={2.4} aria-hidden />
                : null}
              {dp.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =================================================================
// START BUTTON
// =================================================================
function StartButton({
  state, boss, difficulty, usingTest, playable, min, reducedMotion,
  onStart, onOpenDeckBuilder,
}: {
  state: 'LOCKED' | 'NEED_DECK' | 'READY';
  boss: BossDef;
  difficulty: Difficulty;
  usingTest: boolean;
  playable: number;
  min: number;
  reducedMotion: boolean;
  onStart: () => void;
  onOpenDeckBuilder?: () => void;
}) {
  const profile = difficultyProfile(difficulty);
  const e = ELEMENTS[boss.themeId];
  const reward = Math.round(boss.rewardCoins * profile.rewardMult);

  const disabled = state !== 'READY';
  // Tertiary affordance when blocked by deck — a tappable "build deck"
  // hint so the player has somewhere to go to resolve it.
  const showBuildHint = state === 'NEED_DECK' && !!onOpenDeckBuilder;

  const label =
    state === 'LOCKED'    ? 'LOCKED'    :
    state === 'NEED_DECK' ? 'NEED DECK' :
    'FIGHT';

  return (
    <div data-no-swipe style={{
      background: '#fff',
      borderRadius: 16,
      padding: 4,
      boxShadow: `0 8px 20px ${e.deep}33, 0 0 0 1.5px ${e.color}33`,
      display: 'flex', flexDirection: 'column', gap: 4,
      flex: '0 0 auto',
    }}>
      <button
        onClick={onStart}
        disabled={disabled}
        aria-disabled={disabled}
        aria-label={
          state === 'READY'    ? `Fight ${boss.name} on ${profile.label}` :
          state === 'LOCKED'   ? `${profile.label} is locked — beat this boss on a lower tier first` :
                                 `Need at least ${min} playable cards. Currently ${playable}.`
        }
        style={{
          width: '100%', padding: '14px 16px',
          border: 'none', borderRadius: 14,
          background: disabled
            ? '#3a2e2a55'
            : 'linear-gradient(180deg, #3a2e2a 0%, #1a1414 100%)',
          color: '#fff',
          fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
          letterSpacing: '0.04em',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          boxShadow: disabled ? 'none' : '0 6px 14px rgba(0,0,0,.18)',
          transition: 'transform .1s, filter .15s',
          // The ready pulse uses the new bossCtaReady keyframe defined
          // in index.css. Reduced-motion users skip it entirely.
          animation: (!disabled && !reducedMotion) ? 'bossCtaReady 2.4s ease-in-out infinite' : undefined,
          outline: 'none',
        }}
        onPointerDown={(ev) => { if (!disabled) (ev.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.99)'; }}
        onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
        onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
        onFocus={(ev) => { (ev.currentTarget as HTMLElement).style.outline = '3px solid rgba(244,208,74,.7)'; (ev.currentTarget as HTMLElement).style.outlineOffset = '2px'; }}
        onBlur={(ev) => { (ev.currentTarget as HTMLElement).style.outline = 'none'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {state === 'LOCKED'
            ? <Lock size={18} strokeWidth={2.6} aria-hidden />
            : state === 'NEED_DECK'
              ? <AlertCircle size={18} strokeWidth={2.6} aria-hidden />
              : <Swords size={18} strokeWidth={2.6} aria-hidden />}
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.06em' }}>
            {label}
          </span>
          {state === 'READY' && (
            <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 700, letterSpacing: '0.12em' }}>
              · {profile.label.toUpperCase()}
            </span>
          )}
        </span>
        {state === 'READY' && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,.14)',
            padding: '5px 11px', borderRadius: 10,
            fontSize: 11, fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.04em',
          }}>
            {usingTest ? 'TEST' : `+${reward}`}
          </span>
        )}
      </button>
      {showBuildHint && (
        <button
          onClick={onOpenDeckBuilder}
          data-no-swipe
          style={{
            background: 'transparent',
            border: 'none',
            color: PALETTE.accent,
            fontWeight: 700,
            fontSize: 12,
            padding: '4px 10px 6px',
            cursor: 'pointer',
            textAlign: 'center',
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
          }}
        >
          Open Deck Builder →
        </button>
      )}
    </div>
  );
}

// =================================================================
// DECK CHIP
// =================================================================
function DeckChip({
  label, count, ready, active, onClick,
}: {
  label: string;
  count: number;
  ready: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={active}
      aria-label={`${label}, ${count} playable cards${ready ? '' : ', not ready'}`}
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        padding: '7px 11px',
        borderRadius: 12,
        border: active ? '2px solid #3a2e2a' : `1.5px solid ${PALETTE.border}`,
        background: active ? PALETTE.text : '#fff',
        color: active ? '#fff' : PALETTE.text,
        fontSize: 12, fontWeight: 800,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 6,
        boxShadow: active ? '0 4px 10px rgba(58,46,42,.18)' : '0 1px 3px rgba(58,46,42,.05)',
        transition: 'background .12s, color .12s, border-color .12s, transform .1s, box-shadow .12s',
        outline: 'none',
      }}
      onPointerDown={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(0.96)'; }}
      onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      onFocus={(ev) => { (ev.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(244,208,74,.6)'; }}
      onBlur={(ev) => {
        (ev.currentTarget as HTMLElement).style.boxShadow = active
          ? '0 4px 10px rgba(58,46,42,.18)'
          : '0 1px 3px rgba(58,46,42,.05)';
      }}
    >
      {/* Status dot — mint for ready, coral for "low cards". */}
      <span
        aria-hidden
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: ready ? PALETTE.green : PALETTE.accent,
          boxShadow: ready ? '0 0 0 2px rgba(6,214,160,.18)' : '0 0 0 2px rgba(238,90,82,.18)',
          flex: '0 0 auto',
        }}
      />
      <span style={{
        maxWidth: 110,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 10,
        fontWeight: 800,
        padding: '2px 6px',
        borderRadius: 8,
        background: active ? 'rgba(255,255,255,.18)' : 'rgba(58,46,42,.08)',
        color: active ? '#fff' : PALETTE.textMid,
        letterSpacing: '0.04em',
      }}>
        {count}
      </span>
    </button>
  );
}

// =================================================================
// THEME (TEST) CHIP
// =================================================================
function ThemeChip({
  active, label, themeId, onClick,
}: {
  active: boolean;
  label: string;
  themeId: ElementId;
  onClick: () => void;
}) {
  const el = ELEMENTS[themeId];
  return (
    <button
      role="radio"
      aria-checked={active}
      aria-label={`${label}, placeholder deck (no rewards)`}
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        padding: '7px 11px',
        borderRadius: 999,
        border: active ? `2px solid ${el.deep}` : `1.5px solid ${PALETTE.border}`,
        background: active ? el.color : '#fff',
        color: active ? '#fff' : PALETTE.textMid,
        fontSize: 11, fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'background .12s, color .12s, border-color .12s, transform .1s',
        outline: 'none',
      }}
      onPointerDown={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(0.96)'; }}
      onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      onFocus={(ev) => { (ev.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(244,208,74,.55)'; }}
      onBlur={(ev) => { (ev.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      <ElementGlyph el={themeId} size={11} />
      {label}
    </button>
  );
}

// =================================================================
// MISC
// =================================================================
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
 * Continuously-scrolling preview of the boss's deck. Pause when not
 * the visible page (cheap optimization — six animated marquees
 * running off-screen would still eat CPU on lower-end phones).
 */
function BossDeckPreview({
  boss, paused, reducedMotion,
}: { boss: BossDef; paused: boolean; reducedMotion: boolean }) {
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

  const duration = 22;
  const doubled = [...cards, ...cards];

  return (
    <div style={{
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
      maskImage: 'linear-gradient(90deg, transparent 0, #000 8%, #000 92%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 8%, #000 92%, transparent 100%)',
    }}>
      <div style={{
        display: 'flex',
        gap: 8,
        width: 'max-content',
        animation: reducedMotion ? 'none' : `deckMarquee ${duration}s linear infinite`,
        animationPlayState: paused ? 'paused' : 'running',
        willChange: 'transform',
        padding: '6px 0',
      }}>
        {doubled.map((c, i) => (
          <div key={`${c.uid}-${i}`} style={{ flex: '0 0 auto' }}>
            <Card card={c} scale={0.32} owned={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * "Beaten on Hard/Mythic/etc" medal in the banner corner. Sparkles
 * gently around it (suppressed under prefers-reduced-motion).
 */
function BeatenBadge({
  tier, reducedMotion,
}: { tier: Difficulty; reducedMotion: boolean }) {
  const cfg: Record<Difficulty, { bg: string; fg: string; label: string }> = {
    normal: { bg: '#ffd166', fg: '#5a3a0e', label: 'Beaten' },
    hard:   { bg: '#ff7e5f', fg: '#fff',    label: 'Hard' },
    mythic: { bg: '#3a2e2a', fg: '#ffd166', label: 'Mythic' },
  };
  const c = cfg[tier];

  // Three deterministic positions around the badge — kept stable across
  // renders so the sparkles don't twitch when React reconciles.
  const sparklePositions: Array<[number, number, number]> = [
    [-6, -6, 0],
    [12, -10, 0.6],
    [-10, 10, 1.2],
  ];
  return (
    <div style={{
      position: 'absolute', top: 10, right: 10,
      background: c.bg, color: c.fg,
      padding: '4px 8px 4px 6px', borderRadius: 12,
      fontSize: 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', gap: 3,
      boxShadow: '0 2px 6px rgba(0,0,0,.2)',
    }}>
      <Check size={12} strokeWidth={3} aria-hidden /> {c.label}
      {!reducedMotion && sparklePositions.map(([x, y, delay], i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 6, height: 6, borderRadius: '50%',
            background: '#fff8d6',
            boxShadow: '0 0 6px rgba(255, 248, 214, .9)',
            ['--sx' as never]: `${x}px`,
            ['--sy' as never]: `${y}px`,
            animation: `bossSparkle 2.6s ease-in-out ${delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
}

// =================================================================
// EMPTY STATE — no decks
// =================================================================
function EmptyDecksState({
  onBack, onOpenDeckBuilder,
}: { onBack: () => void; onOpenDeckBuilder?: () => void }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
        linear-gradient(180deg, #ffe8d6 0%, #ffd4b3 60%, #ffbe9c 100%)
      `,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '100%', maxWidth: 540, height: '100%',
        display: 'flex', flexDirection: 'column',
      }}>
      <div style={{ padding: '52px 16px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Pick a fight</div>
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center', gap: 16,
      }}>
        <div style={{
          width: 78, height: 78, borderRadius: '50%',
          background: '#fff',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 6px 18px rgba(58,46,42,.15)',
        }}>
          <Layers size={36} strokeWidth={2.2} color={PALETTE.accent} aria-hidden />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>You need a deck first</div>
        <div style={{ fontSize: 13, color: PALETTE.textMid, maxWidth: 320, lineHeight: 1.45 }}>
          Build a deck of your captured photos to start picking fights with the bosses.
        </div>
        {onOpenDeckBuilder && (
          <button
            onClick={onOpenDeckBuilder}
            style={{
              marginTop: 8,
              padding: '14px 22px',
              border: 'none', borderRadius: 14,
              background: 'linear-gradient(180deg, #ffa07a 0%, #ff7e5f 60%, #ee5a52 100%)',
              color: '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              boxShadow: '0 6px 18px rgba(255,94,60,.35)',
            }}
          >
            Go to Deck Builder
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
