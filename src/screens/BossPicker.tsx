import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, Flame, Lock, Skull, Swords,
  ChevronLeft, ChevronRight, ChevronDown,
  Sparkles, AlertCircle, Layers, FlaskConical,
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
      {/* 3) Deck Picker (dropdown) + readiness                   */}
      {/* ------------------------------------------------------- */}
      <DeckPicker
        decks={decks}
        playableByDeck={playableByDeck}
        activeDeckId={activeDeck?.id ?? null}
        currentTestTheme={currentTestTheme}
        minPlayable={MIN_PLAYABLE_DECK}
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
function DeckPicker({
  decks, playableByDeck, activeDeckId, currentTestTheme, minPlayable,
  onPickDeck, onPickTestTheme,
}: {
  decks: DeckSlot[];
  playableByDeck: Record<string, number>;
  activeDeckId: string | null;
  currentTestTheme: ElementId | null;
  minPlayable: number;
  onPickDeck: (id: string) => void;
  onPickTestTheme: (t: ElementId | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Close the menu when the user taps outside the trigger / menu, or
  // hits Escape. The dropdown sits absolutely over the carousel, so it
  // needs explicit dismissal.
  useEffect(() => {
    if (!open) return;
    const onPointer = (ev: PointerEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(ev.target as Node)) return;
      setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Selection summary on the trigger. Test-theme override takes
  // precedence over the saved active deck — same as the actual fight
  // logic, so the trigger never lies about what'll happen on FIGHT.
  const activeDeck = decks.find(d => d.id === activeDeckId) ?? null;
  const triggerLabel = currentTestTheme
    ? `Test · ${ELEMENTS[currentTestTheme].name}`
    : (activeDeck?.name ?? 'No deck');
  const activeCount = activeDeck ? (playableByDeck[activeDeck.id] ?? 0) : 0;
  const triggerCount = currentTestTheme ? null : activeCount;
  const triggerReady = currentTestTheme !== null || activeCount >= minPlayable;
  const triggerThemeColor = currentTestTheme ? ELEMENTS[currentTestTheme].color : null;

  const pickAndClose = (fn: () => void) => {
    fn();
    setOpen(false);
    // Return focus to the trigger so keyboard users don't lose place.
    setTimeout(() => triggerRef.current?.focus(), 0);
  };

  return (
    <div ref={rootRef} data-no-swipe style={{ padding: '2px 16px 0', position: 'relative', zIndex: 5 }}>
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

      {/* Trigger — shows the current selection at a glance. */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Deck selection: ${triggerLabel}${triggerCount !== null ? `, ${triggerCount} cards` : ''}. Tap to change.`}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 14,
          border: `1.5px solid ${PALETTE.border}`,
          background: '#fff',
          color: PALETTE.text,
          fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: open
            ? '0 6px 14px rgba(58,46,42,.16)'
            : '0 2px 6px rgba(58,46,42,.08)',
          transition: 'box-shadow .15s, transform .1s',
          outline: 'none',
        }}
        onFocus={(ev) => { (ev.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(244,208,74,.55)'; }}
        onBlur={(ev) => {
          (ev.currentTarget as HTMLElement).style.boxShadow = open
            ? '0 6px 14px rgba(58,46,42,.16)'
            : '0 2px 6px rgba(58,46,42,.08)';
        }}
      >
        {/* Status dot — mint = ready, coral = low cards, themed for test. */}
        <span aria-hidden style={{
          width: 10, height: 10, borderRadius: '50%',
          background: triggerThemeColor ?? (triggerReady ? PALETTE.green : PALETTE.accent),
          boxShadow: triggerThemeColor
            ? `0 0 0 2px ${triggerThemeColor}33`
            : triggerReady
              ? '0 0 0 2px rgba(6,214,160,.18)'
              : '0 0 0 2px rgba(238,90,82,.18)',
          flex: '0 0 auto',
        }} />
        <span style={{
          flex: 1, textAlign: 'left',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {triggerLabel}
        </span>
        {triggerCount !== null && (
          <span style={{
            fontSize: 11, fontWeight: 800,
            padding: '3px 8px', borderRadius: 10,
            background: triggerReady ? 'rgba(6,214,160,.16)' : 'rgba(238,90,82,.14)',
            color: triggerReady ? '#1f7a4c' : '#b04a2e',
            letterSpacing: '0.04em',
            flex: '0 0 auto',
          }}>
            {triggerCount} cards
          </span>
        )}
        <ChevronDown
          size={16} strokeWidth={2.4}
          style={{
            color: PALETTE.textMid,
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform .15s',
            flex: '0 0 auto',
          }}
          aria-hidden
        />
      </button>

      {/* Menu — absolute so it overlays the carousel below. */}
      {open && (
        <div
          role="listbox"
          aria-label="Available decks"
          style={{
            position: 'absolute',
            top: '100%', left: 16, right: 16,
            marginTop: 6,
            background: '#fff',
            border: `1.5px solid ${PALETTE.border}`,
            borderRadius: 14,
            boxShadow: '0 14px 32px rgba(58,46,42,.22)',
            padding: 6,
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {/* Section: saved decks */}
          <div style={sectionLabelStyle}>YOUR DECKS</div>
          {decks.map(d => {
            const count = playableByDeck[d.id] ?? 0;
            const ready = count >= minPlayable;
            const selected = currentTestTheme === null && d.id === activeDeckId;
            return (
              <DeckMenuRow
                key={d.id}
                selected={selected}
                onClick={() => pickAndClose(() => onPickDeck(d.id))}
                left={
                  <span aria-hidden style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: ready ? PALETTE.green : PALETTE.accent,
                    boxShadow: ready
                      ? '0 0 0 2px rgba(6,214,160,.18)'
                      : '0 0 0 2px rgba(238,90,82,.18)',
                  }} />
                }
                label={d.name}
                meta={`${count} ${count === 1 ? 'card' : 'cards'}${ready ? '' : ' · low'}`}
                metaTone={ready ? 'ok' : 'warn'}
              />
            );
          })}

          {/* Section: test decks */}
          <div style={{ ...sectionLabelStyle, marginTop: 8 }}>
            <FlaskConical size={10} strokeWidth={2.6} style={{ marginRight: 4, verticalAlign: '-1px' }} aria-hidden />
            TEST DECKS · NO REWARDS
          </div>
          {(Object.keys(ELEMENTS) as ElementId[]).map(t => {
            const selected = currentTestTheme === t;
            const el = ELEMENTS[t];
            return (
              <DeckMenuRow
                key={t}
                selected={selected}
                onClick={() => pickAndClose(() => onPickTestTheme(selected ? null : t))}
                left={
                  <span aria-hidden style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: el.color,
                    boxShadow: `0 0 0 2px ${el.color}33`,
                  }} />
                }
                label={`Test · ${el.name}`}
                meta="placeholder"
                metaTone="muted"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.16em',
  color: PALETTE.textMid,
  padding: '6px 10px 4px',
};

function DeckMenuRow({
  selected, onClick, left, label, meta, metaTone,
}: {
  selected: boolean;
  onClick: () => void;
  left: React.ReactNode;
  label: string;
  meta: string;
  metaTone: 'ok' | 'warn' | 'muted';
}) {
  const metaColor =
    metaTone === 'ok'   ? '#1f7a4c' :
    metaTone === 'warn' ? '#b04a2e' :
                          PALETTE.textMid;
  return (
    <button
      role="option"
      aria-selected={selected}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px',
        borderRadius: 10,
        border: 'none',
        background: selected ? 'rgba(58,46,42,.06)' : 'transparent',
        color: PALETTE.text,
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background .12s',
        outline: 'none',
      }}
      onPointerEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = selected ? 'rgba(58,46,42,.10)' : 'rgba(58,46,42,.05)'; }}
      onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = selected ? 'rgba(58,46,42,.06)' : 'transparent'; }}
      onFocus={(ev) => { (ev.currentTarget as HTMLElement).style.background = selected ? 'rgba(58,46,42,.10)' : 'rgba(58,46,42,.05)'; }}
      onBlur={(ev) => { (ev.currentTarget as HTMLElement).style.background = selected ? 'rgba(58,46,42,.06)' : 'transparent'; }}
    >
      {left}
      <span style={{
        flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700, color: metaColor,
        letterSpacing: '0.02em',
        flex: '0 0 auto',
      }}>
        {meta}
      </span>
      {selected && (
        <Check size={14} strokeWidth={3} color={PALETTE.text} aria-hidden style={{ flex: '0 0 auto' }} />
      )}
    </button>
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
      // Center the content vertically inside the carousel viewport.
      // Without this, any leftover space falls into one big empty
      // band below the marquee on tall phones; with it, the slack is
      // shared evenly above and below so the page reads as balanced.
      justifyContent: 'center',
      gap: 10,
      padding: '4px 0',
      minHeight: 0,
    }}>
      {/* Banner — themed gradient with a faded signature-cards layer
          on the right so the bar itself hints at what the boss plays. */}
      <div style={{
        background: `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 100%)`,
        borderRadius: 18,
        padding: '14px 110px 14px 16px',
        position: 'relative',
        boxShadow: '0 8px 20px rgba(58,46,42,.15)',
        color: '#fff',
        display: 'flex', alignItems: 'center', gap: 14,
        flex: '0 0 auto',
        overflow: 'hidden',
      }}>
        {/* Signature-cards fan — peek at the cards this boss leans on.
            Only rendered when this banner is the focused page so we
            don't keep six pages' worth of mini-Cards mounted off-screen
            on lower-end phones. */}
        {visible && <SignatureCardsFan boss={boss} />}

        <div style={{
          width: 76, height: 76, borderRadius: '50%',
          background: '#fff',
          padding: 3,
          display: 'grid', placeItems: 'center',
          flex: '0 0 auto',
          boxShadow: '0 4px 12px rgba(0,0,0,.18)',
          position: 'relative', zIndex: 2,
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
        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.05, textShadow: '0 1px 2px rgba(0,0,0,.18)' }}>{boss.name}</div>
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

      {/* Marquee preview — intrinsic height so it doesn't stretch and
          leave an empty band on tall phones. The parent's
          justify-content: center balances the leftover space. */}
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
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
 * Faded "signature cards" peek inside the boss banner. Picks up to
 * three unique cards from the boss's deck (highest cost first — those
 * tend to be the cards the player will actually remember being hit
 * by) and fans them on the right edge of the banner with a soft mask
 * so they read as background art, not as foreground content. The
 * marquee below still scrolls the full deck for anyone who wants to
 * inspect every card.
 */
function SignatureCardsFan({ boss }: { boss: BossDef }) {
  const cards: CollectionCard[] = useMemo(() => {
    const seen = new Set<string>();
    const uniques: typeof TEMPLATES = [];
    for (const tid of boss.deck) {
      if (seen.has(tid)) continue;
      seen.add(tid);
      const tpl = TEMPLATES.find(t => t.id === tid);
      if (tpl) uniques.push(tpl);
    }
    return uniques
      .slice()
      // Highest-cost first — proxy for "signature" / big-impact play.
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3)
      .map((tpl, i) => ({
        ...tpl,
        uid: `sig-${boss.id}-${tpl.id}-${i}`,
        photo: boss.photoOverrides?.[tpl.id] ?? aiPhoto(tpl.id),
        isPlaceholder: true,
      }));
  }, [boss]);

  if (cards.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0,
        // Wider than the visible banner so the leftmost card fades
        // through the mask rather than hard-clipping into the text.
        width: 200,
        pointerEvents: 'none',
        // Linear mask: invisible on the left edge (where text lives),
        // fully visible by ~45% in. Cards on the right are crisp.
        maskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.55) 35%, #000 70%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.55) 35%, #000 70%)',
        zIndex: 1,
      }}
    >
      {cards.map((c, i) => {
        // Three-card fan: back card tilted left, mid upright, front
        // tilted right. Slight x-offset so they stack from a single
        // anchor on the right edge of the banner.
        const tilt = [-12, -2, 9][i] ?? 0;
        const rightOffset = [98, 56, 14][i] ?? 0;
        const opacity = [0.55, 0.68, 0.82][i] ?? 0.6;
        return (
          <div
            key={c.uid}
            style={{
              position: 'absolute',
              top: '50%', right: rightOffset,
              transform: `translateY(-50%) rotate(${tilt}deg)`,
              opacity,
              filter: 'saturate(0.92)',
              // Render back-to-front via DOM order: rendering card 0
              // first puts it at the bottom of the stack, card 2 on top.
              zIndex: i + 1,
            }}
          >
            <Card card={c} scale={0.28} owned={false} />
          </div>
        );
      })}
    </div>
  );
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
