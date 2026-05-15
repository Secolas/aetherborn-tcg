import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Coins, X, Lock, FlaskConical, BookOpen } from 'lucide-react';
import { BOSSES, type BossDef } from '../data/bosses';
import { ELEMENTS } from '../data/elements';
import { TEMPLATES } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { Card } from '../components/Card';
import { CardBack } from '../components/CardBack';
import type { CollectionCard, DeckSlot, Difficulty, ElementId } from '../game/types';
import { difficultyProfile } from '../game/match';

// ─── Constants ──────────────────────────────────────────────────────

const DIFFICULTIES: { id: Difficulty; roman: string; label: string }[] = [
  { id: 'normal', roman: 'I',   label: 'Normal' },
  { id: 'hard',   roman: 'II',  label: 'Hard'   },
  { id: 'mythic', roman: 'III', label: 'Mythic' },
];
const ORDER: Difficulty[] = ['normal', 'hard', 'mythic'];
const MIN_PLAYABLE_DECK = 8;

/** Per-theme "house color" used by the plate band, photo ring, deck
 *  swatch, and small house chip. Pulled straight from the app's
 *  existing ELEMENTS palette so the picker stays in sync with every
 *  other surface that touches element colors (cards, glyphs, packs). */
const HOUSE_COLOR: Record<ElementId, string> = {
  family:    ELEMENTS.family.color,
  work:      ELEMENTS.work.color,
  animals:   ELEMENTS.animals.color,
  travel:    ELEMENTS.travel.color,
  food:      ELEMENTS.food.color,
  education: ELEMENTS.education.color,
};

// ─── Props ──────────────────────────────────────────────────────────

interface Props {
  defeatedIds: string[];
  /** Highest difficulty tier the player has beaten per boss. */
  beatenAt: Record<string, Difficulty>;
  /** Per-boss lifetime wins (non-test). Drives the bestiary tally. */
  wonAt: Record<string, number>;
  /** Per-boss lifetime losses. */
  lostAt: Record<string, number>;
  /** Current coin balance — surfaced as a chip in the desktop topbar. */
  coins: number;
  decks: DeckSlot[];
  activeDeckId: string | undefined;
  collection: CollectionCard[];
  onSetActiveDeck: (deckId: string) => void;
  onPick: (boss: BossDef, difficulty: Difficulty, testThemeId: ElementId | null) => void;
  onBack: () => void;
  onOpenDeckBuilder?: () => void;
}

// ─── Main screen ────────────────────────────────────────────────────

/**
 * Boss Duel — pre-fight screen. Single component drives
 * both mobile (single column) and desktop (3-column grid) via container
 * queries. Wired to all existing game data: BOSSES, save.decks,
 * save.collection, save.bossesBeatenAt/WonAt/LostAt.
 */
export function BossPicker({
  defeatedIds, beatenAt, wonAt, lostAt, coins,
  decks, activeDeckId, collection,
  onSetActiveDeck, onPick, onBack, onOpenDeckBuilder,
}: Props) {
  const initialBossId =
    BOSSES.find(b => !defeatedIds.includes(b.id))?.id ?? BOSSES[0].id;

  const [bossId, setBossId] = useState<string>(initialBossId);
  const [diffId, setDiffId] = useState<Difficulty>('normal');
  const [deckSheetOpen, setDeckSheetOpen] = useState(false);
  /** Test-theme override per boss (null = use the player's saved active
   *  deck). Surviving feature from the prior picker — accessed through
   *  the deck swap sheet. */
  const [testTheme, setTestTheme] = useState<Record<string, ElementId | null>>({});

  // Resolve active deck with fallback.
  const resolvedActiveDeckId =
    (activeDeckId && decks.find(d => d.id === activeDeckId)?.id)
    ?? decks[0]?.id
    ?? null;
  const activeDeck = decks.find(d => d.id === resolvedActiveDeckId) ?? null;

  // Pre-compute playable count per deck.
  const playableByDeck = useMemo(() => {
    const playableUids = new Set(collection.filter(c => !!c.photo).map(c => c.uid));
    const map: Record<string, number> = {};
    for (const d of decks) {
      map[d.id] = d.uids.reduce((n, uid) => n + (playableUids.has(uid) ? 1 : 0), 0);
    }
    return map;
  }, [decks, collection]);
  const activePlayable = activeDeck ? (playableByDeck[activeDeck.id] ?? 0) : 0;

  // Resolve which boss is in focus.
  const boss = BOSSES.find(b => b.id === bossId) ?? BOSSES[0];
  const bossUnlocked = isBossUnlocked(boss, defeatedIds);
  const currentTestTheme = testTheme[boss.id] ?? null;
  const usingTest = currentTestTheme !== null;

  // Difficulty unlock + reward derive from the existing engine.
  const profile = difficultyProfile(diffId);
  const reward = Math.round(boss.rewardCoins * profile.rewardMult);
  const isDiffUnlocked = (d: Difficulty) => {
    if (d === 'normal') return true;
    const prev = beatenAt[boss.id];
    if (d === 'hard')   return !!prev && ORDER.indexOf(prev) >= ORDER.indexOf('normal');
    return !!prev && ORDER.indexOf(prev) >= ORDER.indexOf('hard');
  };
  const diffLocked = !isDiffUnlocked(diffId);

  // Engage button blockers — boss locked, tier locked, or (real) deck too small.
  const needsDeck = !usingTest && activePlayable < MIN_PLAYABLE_DECK;
  const engageBlocked = !bossUnlocked || diffLocked || needsDeck;

  // Per-boss record + win rate.
  const won  = wonAt[boss.id]  ?? 0;
  const lost = lostAt[boss.id] ?? 0;
  const wr   = (won + lost) ? Math.round((won / (won + lost)) * 100) : 0;

  // Signature cards: top three highest-cost unique templates from the
  // deck variant that matches the *selected* difficulty. Mythic gets
  // boss.mythicDeck if present (where legendaries live); Hard can also
  // override via boss.hardDeck. Falls back to the Normal-tier deck.
  const signature = useMemo(() => {
    const deckForDiff =
      diffId === 'mythic' && boss.mythicDeck ? boss.mythicDeck
      : diffId === 'hard' && boss.hardDeck ? boss.hardDeck
      : boss.deck;
    return pickSignature(boss, deckForDiff);
  }, [boss, diffId]);

  // Keep difficulty in sync with what's actually unlocked when the
  // player swaps bosses — never leave them stranded on a locked tier.
  useEffect(() => {
    if (!isDiffUnlocked(diffId)) setDiffId('normal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossId, beatenAt]);

  const beatenCount = BOSSES.filter(b => defeatedIds.includes(b.id)).length;
  const totalBosses = BOSSES.length;

  const engage = () => {
    if (engageBlocked) return;
    onPick(boss, diffId, currentTestTheme);
  };

  return (
    <div className="duel-container">
      {/* Scoped bestiary stylesheet — injected once when the screen
          mounts. Container queries here so the same DOM produces both
          layouts based on viewport width without touching React state. */}
      <BestiaryStyles />

      <div className="duel" style={{ '--deck-color': HOUSE_COLOR[boss.themeId] } as React.CSSProperties}>
        {/* ─── Topbar ─── */}
        <div className="topbar">
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
            <div className="vol">Vol. III · Bestiary</div>
            <div className="title">Pick a fight</div>
          </div>
          <div className="right-tools">
            <span className="coin-chip" aria-label={`${beatenCount} of ${totalBosses} defeated`}>
              <strong>{beatenCount}/{totalBosses}</strong> defeated
            </span>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="duel-body">
          {/* COL 1 · Roster */}
          <div className="col-roster">
            <div className="col-head">
              <span className="label">Roster</span>
              <span className="meta"><em>{beatenCount}</em>/{totalBosses} beaten</span>
            </div>
            <div className="roster-list" role="tablist" aria-label="Bosses">
              {BOSSES.map((b) => {
                const unlocked = isBossUnlocked(b, defeatedIds);
                const beaten = defeatedIds.includes(b.id);
                const active = b.id === bossId;
                return (
                  <button
                    key={b.id}
                    role="tab"
                    aria-selected={active}
                    aria-label={`${b.name} — ${b.subtitle}`}
                    className="roster-entry"
                    data-active={active}
                    data-locked={!unlocked}
                    disabled={!unlocked}
                    onClick={() => unlocked && setBossId(b.id)}
                    title={!unlocked ? `Locked` : undefined}
                    style={{ '--deck-color': HOUSE_COLOR[b.themeId] } as React.CSSProperties}
                  >
                    <span
                      className="photo"
                      style={{
                        backgroundImage: b.avatarPhoto ? `url(${b.avatarPhoto})` : undefined,
                        background: b.avatarPhoto
                          ? `url(${b.avatarPhoto}) center/cover`
                          : `linear-gradient(160deg, ${ELEMENTS[b.themeId].deep} 0%, ${ELEMENTS[b.themeId].color} 100%)`,
                      }}
                      aria-hidden
                    />
                    <span className="info">
                      <span className="name">{b.name}</span>
                      <span className="row">{ELEMENTS[b.themeId].name}</span>
                    </span>
                    {beaten && <span className="badge beaten" aria-label="Defeated">✓</span>}
                    {!unlocked && (
                      <span className="badge locked" aria-label="Locked">
                        <Lock size={9} strokeWidth={2.4} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* COL 2 · Hero */}
          <div className="col-hero">
            {/* Plate */}
            <div className="plate">
              <div className="plate-band" />
              <div className="plate-body">
                <div className="plate-photo-wrap">
                  <div
                    className="plate-photo"
                    style={{
                      background: boss.avatarPhoto
                        ? `url(${boss.avatarPhoto}) center/cover`
                        : `linear-gradient(160deg, ${ELEMENTS[boss.themeId].deep} 0%, ${ELEMENTS[boss.themeId].color} 100%)`,
                    }}
                    aria-hidden
                  />
                </div>
                <div className="plate-meta">
                  <div className="house">{ELEMENTS[boss.themeId].name} deck</div>
                  <div className="name">{boss.name}</div>
                  <div className="epithet">{boss.subtitle.toLowerCase()}</div>
                </div>
              </div>
              {/* Boss playstyle — replaces the short quote so the player
                  gets concrete tactical info ("Sunday dinner regulars…")
                  instead of a one-liner. */}
              <div className="plate-quote">{boss.playstyle}</div>
            </div>

            {/* Record */}
            <div className="record">
              <div className="record-cell" role="group" aria-label={`${won} victories`}>
                <div className="lbl">Victories</div>
                <div className="row">
                  <span className="num">{pad2(won)}</span>
                  <Tally count={won} color={ELEMENTS.animals.color} />
                </div>
              </div>
              <div className="record-cell loss" role="group" aria-label={`${lost} defeats`}>
                <div className="lbl">Defeats</div>
                <div className="row">
                  <span className="num">{pad2(lost)}</span>
                  <Tally count={lost} color={ELEMENTS.family.color} />
                </div>
              </div>
            </div>

            {/* Signature cards — switches deck per selected difficulty
                so Mythic surfaces the boss's mythic-only legendaries. */}
            <div className="block">
              <div className="sec-head">
                <span className="label">Cards used · {profile.label}</span>
                <span className="meta"><em>{wr}%</em> win rate</span>
              </div>
              <div className="sig-row">
                {signature.map(c => (
                  <div key={c.uid} className="sig-card-wrap">
                    <Card card={c} scale={0.52} owned={false} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COL 3 · Controls */}
          <div className="col-controls">
            <div className="block">
              <div className="sec-head">
                <span className="label">Difficulty</span>
                <span className="meta"><em>{profile.label}</em></span>
              </div>
              <div className="diff">
                {DIFFICULTIES.map(d => {
                  const unlocked = isDiffUnlocked(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      data-active={d.id === diffId}
                      data-locked={!unlocked}
                      disabled={!unlocked}
                      onClick={() => unlocked && setDiffId(d.id)}
                      aria-label={`${d.label}${unlocked ? '' : ' (locked)'}`}
                    >
                      <span className="roman">{!unlocked ? <Lock size={14} strokeWidth={2.4} /> : d.roman}</span>
                      <span className="lbl">{d.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="diff-meta">
                <span><em>+{reward}</em> coins on win</span>
              </div>
            </div>

            <div className="block">
              <div className="sec-head">
                <span className="label">Bring your deck</span>
                <span className="meta">
                  {usingTest
                    ? <em>Test · no rewards</em>
                    : <>{activePlayable} cards · <em style={{ color: activePlayable >= MIN_PLAYABLE_DECK ? ELEMENTS.animals.color : ELEMENTS.family.color }}>{activePlayable >= MIN_PLAYABLE_DECK ? 'ready' : `${activePlayable}/${MIN_PLAYABLE_DECK}`}</em></>
                  }
                </span>
              </div>
              <button
                className="deck-row"
                onClick={() => setDeckSheetOpen(true)}
                style={{
                  '--deck-color': usingTest
                    ? HOUSE_COLOR[currentTestTheme]
                    : (activeDeck ? HOUSE_COLOR[primaryDeckTheme(activeDeck, collection)] : ELEMENTS.family.color),
                } as React.CSSProperties}
                aria-label="Change deck"
              >
                {/* Equipped card-back preview — shows the actual back
                    template (Navy Diamond by default) the player will
                    use in this match. Updates when the player swaps
                    backs in the Cosmetics locker. */}
                <div className="back-preview" aria-hidden>
                  <CardBack scale={0.17} side="player" />
                </div>
                <div>
                  <div className="name">
                    {usingTest
                      ? <>Test · {ELEMENTS[currentTestTheme!].name}</>
                      : (activeDeck?.name ?? 'No deck')}
                  </div>
                  <div className="meta">
                    {usingTest
                      ? 'Pre-built · no rewards on win'
                      : `${activePlayable} / 12 · ${ELEMENTS[primaryDeckTheme(activeDeck, collection)].name.toUpperCase()} HOUSE`}
                  </div>
                </div>
                <span className="swap">Swap</span>
              </button>
            </div>

            <button
              className="engage"
              disabled={engageBlocked}
              onClick={engage}
              aria-label={
                !bossUnlocked
                  ? `${boss.name} is locked`
                  : diffLocked
                    ? `${profile.label} difficulty is locked — beat ${boss.name} on a lower tier first`
                    : needsDeck
                      ? `Need at least ${MIN_PLAYABLE_DECK} playable cards in your deck`
                      : `Battle ${boss.name} on ${profile.label}`
              }
            >
              <span className="roman">
                {!bossUnlocked || diffLocked || needsDeck ? <Lock size={18} strokeWidth={2.4} /> : DIFFICULTIES.find(d => d.id === diffId)?.roman}
              </span>
              <span className="label">
                <span className="sub">
                  {!bossUnlocked ? 'Locked' : diffLocked ? 'Tier Locked' : needsDeck ? 'Need Deck' : `Battle · ${profile.label}`}
                </span>
                <span>vs {boss.name}</span>
              </span>
              <span className="reward">
                <Coins size={13} color="#fff" strokeWidth={2.2} />
                {usingTest ? 'TEST' : `+${reward}`}
              </span>
            </button>

            {needsDeck && onOpenDeckBuilder && (
              <button
                onClick={onOpenDeckBuilder}
                className="open-deck-builder"
              >
                <BookOpen size={13} strokeWidth={2.2} />
                Open Deck Builder
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Deck swap sheet — overlays the screen. */}
      {deckSheetOpen && (
        <DeckSheet
          decks={decks}
          playableByDeck={playableByDeck}
          activeDeckId={resolvedActiveDeckId}
          currentTestTheme={currentTestTheme}
          onClose={() => setDeckSheetOpen(false)}
          onPickDeck={(id) => {
            setTestTheme(t => ({ ...t, [boss.id]: null }));
            onSetActiveDeck(id);
            setDeckSheetOpen(false);
          }}
          onPickTest={(t) => {
            setTestTheme(s => ({ ...s, [boss.id]: t }));
            setDeckSheetOpen(false);
          }}
          onOpenDeckBuilder={onOpenDeckBuilder}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────


/**
 * Hand-drawn tally marks for the bestiary record. Groups of 5 (four
 * verticals + a diagonal slash). Empty count renders an em-dash.
 */
function Tally({ count, color }: { count: number; color: string }) {
  if (count === 0) {
    return <span style={{ fontFamily: 'inherit', fontSize: 11, color: '#a89580' }}>—</span>;
  }
  const groups = Math.floor(count / 5);
  const rem = count % 5;
  return (
    <span className="tally" aria-hidden>
      {Array.from({ length: groups }).map((_, i) => <TallyGroup key={i} n={5} color={color} />)}
      {rem > 0 && <TallyGroup n={rem} color={color} />}
    </span>
  );
}
function TallyGroup({ n, color }: { n: number; color: string }) {
  return (
    <svg width={14} height={16} viewBox="0 0 14 16" style={{ display: 'block' }}>
      {Array.from({ length: Math.min(n, 4) }).map((_, i) => (
        <line key={i} x1={2 + i * 3} y1={1} x2={2 + i * 3} y2={15} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      ))}
      {n === 5 && <line x1={0} y1={14} x2={14} y2={2} stroke={color} strokeWidth={1.4} strokeLinecap="round" />}
    </svg>
  );
}

/**
 * Deck swap sheet — bottom-sheet on mobile, centered modal on desktop.
 * Shows the player's saved decks with their playable count, plus a
 * "Test decks" section so the legacy quick-fight test mode stays
 * accessible (just not at the top level).
 */
function DeckSheet({
  decks, playableByDeck, activeDeckId, currentTestTheme,
  onClose, onPickDeck, onPickTest, onOpenDeckBuilder,
}: {
  decks: DeckSlot[];
  playableByDeck: Record<string, number>;
  activeDeckId: string | null;
  currentTestTheme: ElementId | null;
  onClose: () => void;
  onPickDeck: (id: string) => void;
  onPickTest: (t: ElementId) => void;
  onOpenDeckBuilder?: () => void;
}) {
  return (
    <div className="deck-sheet-backdrop" onClick={onClose}>
      <div className="deck-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="deck-sheet-head">
          <div className="title">Choose a deck</div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>

        <div className="sec-head">
          <span className="label">Your decks</span>
          {onOpenDeckBuilder && (
            <button className="link-btn" onClick={onOpenDeckBuilder}>
              Open builder →
            </button>
          )}
        </div>
        {decks.length === 0 && (
          <div className="empty-line">
            You have no saved decks yet.
          </div>
        )}
        <div className="deck-sheet-list">
          {decks.map(d => {
            const count = playableByDeck[d.id] ?? 0;
            const ready = count >= MIN_PLAYABLE_DECK;
            const active = currentTestTheme === null && d.id === activeDeckId;
            return (
              <button
                key={d.id}
                className="deck-sheet-row"
                data-active={active}
                onClick={() => onPickDeck(d.id)}
              >
                <span className="dot" style={{ background: ready ? ELEMENTS.animals.color : '#ee5a52' }} />
                <span className="name">{d.name}</span>
                <span className={`count ${ready ? 'ok' : 'low'}`}>
                  {count} {count === 1 ? 'card' : 'cards'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="sec-head" style={{ marginTop: 14 }}>
          <span className="label"><FlaskConical size={11} strokeWidth={2.4} style={{ verticalAlign: -1, marginRight: 4 }} />Test decks · no rewards</span>
        </div>
        <div className="deck-sheet-test-grid">
          {(Object.keys(ELEMENTS) as ElementId[]).map(t => {
            const active = currentTestTheme === t;
            return (
              <button
                key={t}
                className="test-chip"
                data-active={active}
                onClick={() => onPickTest(t)}
                style={{ '--deck-color': HOUSE_COLOR[t] } as React.CSSProperties}
              >
                <span className="dot" />
                {ELEMENTS[t].name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isBossUnlocked(boss: BossDef, defeatedIds: string[]): boolean {
  // All bosses are unlocked at all times in the existing engine. Keep
  // the helper here so it's trivial to gate future bosses behind story
  // progression by swapping in real prerequisite checks.
  // `defeatedIds` kept in the signature so the call site reads cleanly
  // once that gating lands.
  void defeatedIds; void boss;
  return true;
}

/** Pick three signature cards (highest-cost unique templates) from a
 *  boss's deck so the picker can preview what the player will actually
 *  face. Caller passes the deck variant matching the selected tier so
 *  Mythic surfaces Mythic-only legendaries, Hard surfaces its overrides
 *  if defined, and Normal surfaces the baseline deck. */
function pickSignature(boss: BossDef, deck: string[]): CollectionCard[] {
  const seen = new Set<string>();
  const uniques = [] as { id: string }[];
  for (const tid of deck) {
    if (seen.has(tid)) continue;
    seen.add(tid);
    uniques.push({ id: tid });
  }
  return uniques
    .map(({ id }) => {
      const tpl = TEMPLATES.find(t => t.id === id);
      if (!tpl) return null;
      const photo = boss.photoOverrides?.[id] ?? aiPhoto(id);
      const c: CollectionCard = {
        ...tpl,
        uid: `sig-${boss.id}-${id}`,
        photo,
        isPlaceholder: true,
      };
      return c;
    })
    .filter((c): c is CollectionCard => !!c)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3);
}

/** Best-effort primary theme for a player's deck — picks the most
 *  represented element across the deck's currently playable cards. Used
 *  to color the deck-row swatch. Defaults to the first element if the
 *  deck is empty or all dormant. */
function primaryDeckTheme(deck: DeckSlot | null, collection: CollectionCard[]): ElementId {
  if (!deck) return 'family';
  const counts: Record<ElementId, number> = {
    family: 0, work: 0, animals: 0, travel: 0, food: 0, education: 0,
  };
  for (const uid of deck.uids) {
    const c = collection.find(x => x.uid === uid);
    if (c) counts[c.el]++;
  }
  let best: ElementId = 'family';
  let bestN = -1;
  for (const k of Object.keys(counts) as ElementId[]) {
    if (counts[k] > bestN) { best = k; bestN = counts[k]; }
  }
  return best;
}

// ─── Scoped stylesheet ──────────────────────────────────────────────

/**
 * Bestiary styles are scoped inside `.duel-container`. Container queries
 * drive the mobile/desktop split — the same DOM produces both layouts
 * based on its own width, so the screen also adapts cleanly to the
 * desktop PhoneShell stage when rails collapse.
 */
function BestiaryStyles() {
  // Inline stylesheet scoped under .duel-container. Hex values pulled
  // from the same palette the rest of the app uses (Fredoka headlines,
  // warm cream backgrounds, coral accent, element colors via inline
  // --deck-color). No app-foreign fonts; no parallel design tokens.
  return (
    <style>{`
      .duel-container {
        container-type: inline-size;
        width: 100%; height: 100%;
        overflow-y: auto;
        background:
          radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
          linear-gradient(180deg, #ffe8d6 0%, #ffd4b3 60%, #ffbe9c 100%);
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        color: #3a2e2a;
      }
      .duel { padding: 56px 16px 28px; }
      @container (min-width: 1024px) {
        .duel { max-width: 1180px; margin: 0 auto; padding: 28px 32px 40px; }
      }

      /* Topbar */
      .duel .topbar {
        display: grid; grid-template-columns: 1fr auto 1fr;
        align-items: center; gap: 12px; padding-bottom: 14px;
      }
      .duel .left-tools, .duel .right-tools { display: flex; align-items: center; gap: 8px; }
      .duel .left-tools  { justify-self: start; }
      .duel .right-tools { justify-self: end; }
      .duel .icon-btn {
        width: 38px; height: 38px; border-radius: 50%;
        background: #fff; border: 1.5px solid rgba(58,46,42,.10);
        box-shadow: 0 2px 6px rgba(58,46,42,.08);
        cursor: pointer; padding: 0;
        display: grid; place-items: center;
        color: #3a2e2a;
        transition: transform .12s;
        flex-shrink: 0;
        font-family: inherit;
      }
      .duel .icon-btn:hover { transform: translateY(-1px); }
      .duel .crest { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .duel .crest .vol {
        font-family: inherit; font-size: 9px; font-weight: 800;
        letter-spacing: 0.22em;
        color: #a89580; text-transform: uppercase;
      }
      .duel .crest .title {
        font-family: inherit;
        font-size: 20px; font-weight: 700; line-height: 1;
        color: #3a2e2a;
      }
      .duel .coin-chip { display: none; }
      @container (min-width: 1024px) {
        .duel .topbar {
          padding-bottom: 22px;
          border-bottom: 1px solid rgba(58,46,42,.22);
          margin-bottom: 24px;
        }
        .duel .crest .vol { font-size: 10px; letter-spacing: 0.26em; }
        .duel .crest .title { font-size: 24px; }
        .duel .icon-btn { width: 42px; height: 42px; }
        .duel .coin-chip {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 14px;
          background: #fff7e6;
          border: 1px solid rgba(58,46,42,.10);
          border-radius: 999px;
          box-shadow: 0 2px 6px rgba(58,46,42,.08);
          font-family: inherit; font-weight: 600; font-size: 13px;
          color: #3a2e2a; white-space: nowrap;
        }
        .duel .coin-chip strong { font-weight: 800; font-size: 14px; }
      }

      /* Body */
      .duel .duel-body { display: flex; flex-direction: column; gap: 18px; }
      @container (min-width: 1024px) {
        .duel .duel-body {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr) 340px;
          gap: 24px; align-items: start;
        }
        .duel .col-controls {
          position: sticky; top: 24px;
          display: flex; flex-direction: column; gap: 16px;
        }
      }
      .duel .col-hero { display: flex; flex-direction: column; gap: 16px; }
      @container (min-width: 1024px) { .duel .col-hero { gap: 20px; } }

      /* Roster */
      .duel .col-head {
        display: none;
        align-items: baseline; justify-content: space-between;
        padding: 4px 6px 10px;
        border-bottom: 1px solid rgba(58,46,42,.10);
        margin-bottom: 10px;
      }
      .duel .col-head .label {
        font-family: inherit; font-size: 10px; font-weight: 800;
        letter-spacing: 0.22em; text-transform: uppercase; color: #a89580;
      }
      .duel .col-head .meta {
        font-family: inherit; font-size: 13px; color: #7a5a52; font-weight: 600;
      }
      .duel .col-head .meta em { font-style: normal; font-weight: 800; color: #3a2e2a; }
      .duel .roster-list {
        display: flex; gap: 8px;
        margin: 0 -16px; padding: 4px 16px 6px;
        overflow-x: auto; scrollbar-width: none;
      }
      .duel .roster-list::-webkit-scrollbar { display: none; }
      @container (min-width: 1024px) {
        .duel .col-roster {
          background: #fff;
          border: 1px solid rgba(58,46,42,.10);
          border-radius: 22px; padding: 16px 14px 14px;
          box-shadow: 0 2px 6px rgba(58,46,42,.08);
        }
        .duel .col-roster .col-head { display: flex; }
        .duel .roster-list {
          flex-direction: column; gap: 3px; margin: 0; padding: 0;
          overflow: visible;
        }
      }

      /* Roster entry */
      .duel .roster-entry {
        flex-shrink: 0; width: 88px; padding: 10px 8px 8px;
        background: #fff;
        border: 1px solid rgba(58,46,42,.10);
        border-radius: 16px; cursor: pointer; text-align: center;
        box-shadow: 0 2px 6px rgba(58,46,42,.08);
        color: inherit; font-family: inherit;
        position: relative;
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        transition: transform .15s, background .2s, border-color .2s;
      }
      .duel .roster-entry:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(58,46,42,.15); }
      .duel .roster-entry[data-active="true"] {
        background: #3a2e2a; color: #fff;
        border-color: #3a2e2a; box-shadow: 0 6px 14px rgba(58,46,42,.18);
      }
      .duel .roster-entry[data-locked="true"] { opacity: 0.45; cursor: not-allowed; }
      .duel .roster-entry[data-locked="true"]:hover { transform: none; box-shadow: 0 2px 6px rgba(58,46,42,.08); }
      .duel .roster-entry .fol {
        font-family: inherit; font-size: 9px; font-weight: 800;
        letter-spacing: 0.18em; opacity: 0.7;
      }
      .duel .roster-entry .photo {
        width: 48px; height: 48px; border-radius: 50%;
        background-size: cover; background-position: center; flex-shrink: 0;
        box-shadow: inset 0 0 0 2px #fff, inset 0 0 0 3px rgba(58,46,42,.22);
      }
      .duel .roster-entry[data-active="true"] .photo {
        box-shadow: inset 0 0 0 2px #3a2e2a, inset 0 0 0 3px #ee5a52;
      }
      .duel .roster-entry .info {
        display: flex; flex-direction: column; align-items: center;
        min-width: 0; max-width: 100%;
      }
      .duel .roster-entry .info .name {
        font-family: inherit; font-weight: 700; font-size: 11px;
        letter-spacing: -0.01em; line-height: 1.1;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
      }
      .duel .roster-entry .info .row { display: none; }
      .duel .roster-entry .diff-pips { display: none; }
      .duel .roster-entry .badge {
        position: absolute; top: -4px; right: -4px;
        width: 18px; height: 18px; border-radius: 50%;
        display: grid; place-items: center;
        border: 2px solid #fef8f0;
        font-family: inherit; font-weight: 900; font-size: 11px;
        flex-shrink: 0; color: #fff;
      }
      .duel .roster-entry .badge.beaten { background: ${'${'}ELEMENTS.animals.color${'}'}; }
      .duel .roster-entry .badge.locked { background: #a89580; }
      @container (min-width: 1024px) {
        .duel .roster-entry {
          width: 100%; padding: 8px 10px;
          background: transparent; border: 1px solid transparent;
          border-radius: 12px; box-shadow: none;
          flex-direction: row; align-items: center; gap: 12px;
          text-align: left;
        }
        .duel .roster-entry:hover { background: #fff7e6; box-shadow: none; transform: none; }
        .duel .roster-entry[data-active="true"] {
          background: #3a2e2a; border-color: #3a2e2a;
          box-shadow: 0 2px 6px rgba(58,46,42,.10);
        }
        .duel .roster-entry > .fol { display: none; }
        .duel .roster-entry .photo { width: 38px; height: 38px; }
        .duel .roster-entry .info { align-items: flex-start; flex: 1; min-width: 0; gap: 2px; }
        .duel .roster-entry .info .name { font-size: 14px; font-weight: 700; white-space: nowrap; }
        .duel .roster-entry .info .row {
          display: block;
          font-family: inherit; font-size: 9px; font-weight: 800;
          opacity: 0.6; letter-spacing: 0.14em;
        }
        .duel .roster-entry .diff-pips {
          display: inline-flex; gap: 3px; flex-shrink: 0;
        }
        .duel .roster-entry .diff-pip {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(58,46,42,0.15);
        }
        .duel .roster-entry[data-active="true"] .diff-pip { background: rgba(255,255,255,0.25); }
        .duel .roster-entry .diff-pip.on { background: #ee5a52; }
        .duel .roster-entry[data-active="true"] .diff-pip.on { background: #fff; }
        .duel .roster-entry .badge {
          position: static; border: 0; width: 18px; height: 18px; font-size: 11px;
        }
        .duel .roster-entry[data-active="true"] .badge.beaten { background: #fff; color: ${'${'}ELEMENTS.animals.color${'}'}; }
      }

      /* Plate */
      .duel .plate {
        position: relative;
        background: #fff7e6;
        border: 1.5px solid #3a2e2a; border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 8px 20px rgba(58,46,42,.15);
      }
      .duel .plate-band { height: 6px; background: var(--deck-color, #ee5a52); }
      .duel .plate-body {
        display: grid; grid-template-columns: 96px 1fr; gap: 14px;
        padding: 16px 18px 14px; align-items: center;
      }
      .duel .plate-photo-wrap { position: relative; width: 96px; height: 96px; }
      .duel .plate-photo {
        width: 96px; height: 96px; border-radius: 50%;
        background-size: cover; background-position: center;
        box-shadow:
          inset 0 0 0 3px #fff,
          inset 0 0 0 5px var(--deck-color, #ee5a52),
          0 2px 6px rgba(58,46,42,.08);
      }
      .duel .plate-photo-lvl {
        position: absolute; bottom: -2px; right: -4px;
        background: #3a2e2a; color: #fff;
        width: 30px; height: 30px; border-radius: 50%;
        display: grid; place-items: center;
        font-family: inherit; font-weight: 800; font-size: 13px;
        box-shadow: 0 0 0 3px #fff7e6;
      }
      .duel .plate-meta { min-width: 0; }
      .duel .plate-meta .house {
        font-family: inherit; font-size: 9px; font-weight: 800;
        letter-spacing: 0.22em; text-transform: uppercase;
        color: var(--deck-color, #ee5a52);
      }
      .duel .plate-meta .name {
        font-family: inherit; font-weight: 800;
        font-size: 28px; line-height: 1; letter-spacing: -0.02em;
        margin-top: 4px; color: #3a2e2a;
      }
      .duel .plate-meta .epithet {
        font-family: inherit; font-style: italic; font-weight: 500;
        font-size: 13px; color: #7a5a52; margin-top: 4px;
      }
      .duel .plate-quote {
        padding: 10px 18px 14px;
        font-family: inherit; font-style: italic;
        font-size: 14px; color: #7a5a52; line-height: 1.4;
        border-top: 1px dashed rgba(58,46,42,.10);
      }
      @container (min-width: 1024px) {
        .duel .plate-body { grid-template-columns: 140px 1fr; gap: 22px; padding: 22px 26px 20px; }
        .duel .plate-photo-wrap { width: 140px; height: 140px; }
        .duel .plate-photo { width: 140px; height: 140px;
          box-shadow:
            inset 0 0 0 4px #fff,
            inset 0 0 0 7px var(--deck-color, #ee5a52),
            0 6px 14px rgba(58,46,42,.18);
        }
        .duel .plate-photo-lvl { width: 40px; height: 40px; font-size: 18px; }
        .duel .plate-meta .name { font-size: 44px; }
        .duel .plate-meta .epithet { font-size: 17px; }
        .duel .plate-quote { padding: 14px 26px 20px; font-size: 16px; }
      }

      /* Record */
      .duel .record {
        display: grid; grid-template-columns: 1fr 1fr;
        border: 1.5px solid #3a2e2a; border-radius: 18px;
        overflow: hidden; background: #fff7e6;
      }
      .duel .record-cell { padding: 12px 16px; position: relative; }
      .duel .record-cell + .record-cell { border-left: 1.5px solid #3a2e2a; }
      .duel .record-cell .lbl {
        font-family: inherit; font-size: 9px; font-weight: 800;
        letter-spacing: 0.18em; text-transform: uppercase; color: #a89580;
      }
      .duel .record-cell .row { display: flex; align-items: baseline; gap: 10px; margin-top: 6px; }
      .duel .record-cell .num {
        font-family: inherit; font-weight: 800;
        font-size: 28px; line-height: 1; color: #3a2e2a;
      }
      .duel .record-cell.loss .num { color: #ee5a52; }
      .duel .record-cell .tally {
        display: inline-flex; gap: 6px; flex-wrap: wrap;
        align-items: flex-end; padding-bottom: 2px;
      }
      @container (min-width: 1024px) {
        .duel .record-cell { padding: 18px 24px; }
        .duel .record-cell .num { font-size: 40px; }
        .duel .record-cell .lbl { font-size: 10px; letter-spacing: 0.22em; }
      }

      /* Section heads */
      .duel .sec-head {
        display: flex; align-items: baseline; justify-content: space-between;
        gap: 12px; padding-bottom: 8px;
        border-bottom: 1px solid rgba(58,46,42,.22);
        margin-bottom: 12px;
      }
      .duel .sec-head .label {
        font-family: inherit; font-size: 10px; font-weight: 800;
        letter-spacing: 0.22em; color: #a89580; text-transform: uppercase;
      }
      .duel .sec-head .meta {
        font-family: inherit; font-style: italic; font-size: 13px;
        color: #7a5a52;
      }
      .duel .sec-head .meta em { font-style: normal; font-weight: 800; color: #3a2e2a; }
      @container (min-width: 1024px) {
        .duel .sec-head .label { font-size: 11px; letter-spacing: 0.24em; }
        .duel .sec-head .meta { font-size: 14px; }
      }
      .duel .block { display: flex; flex-direction: column; }

      /* Signature row uses the existing Card component at small scale. */
      .duel .sig-row {
        display: flex; gap: 10px; justify-content: space-between;
        padding: 0 2px;
      }
      .duel .sig-card-wrap { flex: 0 0 auto; }
      @container (min-width: 1024px) {
        .duel .sig-row { gap: 14px; justify-content: flex-start; padding: 4px 2px 0; }
      }
      .duel .playstyle {
        margin-top: 12px;
        padding: 10px 12px;
        background: rgba(255,255,255,.7);
        border: 1px solid rgba(58,46,42,.10);
        border-radius: 12px;
        font-family: inherit; font-style: italic;
        font-size: 13px; color: #7a5a52; line-height: 1.4;
      }

      /* Difficulty */
      .duel .diff {
        display: grid; grid-template-columns: repeat(3, 1fr);
        border: 1.5px solid #3a2e2a; border-radius: 16px;
        overflow: hidden; background: #fff7e6;
      }
      .duel .diff button {
        background: transparent; border: 0; padding: 14px 8px 12px;
        color: #3a2e2a; cursor: pointer; font-family: inherit;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
      }
      .duel .diff button + button { border-left: 1.5px solid #3a2e2a; }
      .duel .diff button[data-active="true"] { background: #3a2e2a; color: #fff; }
      .duel .diff button[data-locked="true"] { color: #a89580; cursor: not-allowed; }
      .duel .diff .roman {
        font-family: inherit; font-weight: 800; font-size: 22px;
        line-height: 1; letter-spacing: 0.04em;
      }
      .duel .diff .lbl {
        font-family: inherit; font-size: 10px; font-weight: 800;
        letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.7;
      }
      .duel .diff button[data-active="true"] .lbl { opacity: 0.9; }
      .duel .diff-meta {
        display: flex; justify-content: flex-end; padding-top: 8px;
        font-family: inherit; font-size: 11px; color: #a89580;
        font-weight: 600; letter-spacing: 0.02em;
      }
      .duel .diff-meta em { font-style: normal; color: #ee5a52; font-weight: 800; }
      @container (min-width: 1024px) {
        .duel .diff button { padding: 18px 8px 16px; }
        .duel .diff .roman { font-size: 28px; }
        .duel .diff .lbl { font-size: 11px; }
        .duel .diff-meta { font-size: 12px; }
      }

      /* Deck row */
      .duel .deck-row {
        width: 100%; padding: 12px 14px;
        background: #fff;
        border: 1px solid rgba(58,46,42,.10);
        border-radius: 16px;
        box-shadow: 0 2px 6px rgba(58,46,42,.08);
        display: grid; grid-template-columns: 38px 1fr auto; gap: 12px; align-items: center;
        cursor: pointer; color: inherit; font-family: inherit; text-align: left;
        transition: transform .12s, box-shadow .2s;
      }
      .duel .deck-row:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(58,46,42,.15); }
      .duel .deck-row .back-preview {
        display: grid; place-items: center;
        /* Sized to the card-back's intrinsic 220×320 × 0.17 = ~37×54. */
        width: 38px; height: 56px;
      }
      .duel .deck-row .name {
        font-family: inherit; font-weight: 800; font-size: 17px;
        line-height: 1; color: #3a2e2a;
      }
      .duel .deck-row .meta {
        font-family: inherit; font-size: 11px;
        color: #a89580; font-weight: 600;
        margin-top: 4px; letter-spacing: 0.04em;
      }
      .duel .deck-row .swap {
        background: #3a2e2a; color: #fff; padding: 6px 12px; border-radius: 999px;
        font-family: inherit; font-weight: 800; font-size: 11px;
        letter-spacing: 0.08em; text-transform: uppercase;
      }
      @container (min-width: 1024px) {
        .duel .deck-row { padding: 14px 16px; }
        .duel .deck-row .name { font-size: 19px; }
      }

      /* Battle CTA — soft warm drop shadow, no chunky stacked base. */
      .duel .engage {
        width: 100%; height: 60px; padding: 0 18px;
        background: linear-gradient(180deg, #ffa07a 0%, #ee5a52 100%);
        color: #fff;
        border: 0; border-radius: 18px; cursor: pointer;
        box-shadow: 0 8px 20px rgba(238,90,82,.32);
        display: grid; grid-template-columns: auto 1fr auto; align-items: center;
        gap: 12px;
        font-family: inherit; font-weight: 800; font-size: 20px;
        letter-spacing: 0.04em;
        transition: transform .12s, box-shadow .12s, filter .12s;
      }
      .duel .engage:hover { transform: translateY(-1px); filter: brightness(1.04); }
      .duel .engage:active:not([disabled]) {
        transform: translateY(1px);
        box-shadow: 0 4px 12px rgba(238,90,82,.32);
      }
      .duel .engage[disabled] {
        background: #a89580; cursor: not-allowed;
        box-shadow: 0 4px 10px rgba(58,46,42,.18);
        filter: none;
      }
      .duel .engage .roman {
        width: 36px; height: 36px; border-radius: 10px;
        background: rgba(0,0,0,0.22);
        display: grid; place-items: center;
        font-family: inherit; font-weight: 800; font-size: 16px;
        line-height: 1;
      }
      .duel .engage .label { text-align: left; line-height: 1; }
      .duel .engage .label .sub {
        display: block; font-family: inherit; font-weight: 800;
        font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
        opacity: 0.78; margin-bottom: 4px;
      }
      .duel .engage .reward {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(0,0,0,0.22); padding: 6px 12px; border-radius: 999px;
        font-family: inherit; font-weight: 800; font-size: 13px;
      }
      @container (min-width: 1024px) {
        .duel .engage { height: 76px; padding: 0 22px; border-radius: 22px; font-size: 22px; }
        .duel .engage .roman { width: 44px; height: 44px; font-size: 20px; border-radius: 12px; }
        .duel .engage .label .sub { font-size: 11px; letter-spacing: 0.2em; }
        .duel .engage .reward { padding: 8px 14px; font-size: 14px; }
      }

      .duel .open-deck-builder {
        background: transparent; border: 0;
        color: #ee5a52;
        font-family: inherit; font-weight: 800;
        font-size: 12px; letter-spacing: 0.04em;
        padding: 8px; cursor: pointer; text-align: center;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        align-self: center;
      }

      /* Deck swap sheet */
      .duel-container .deck-sheet-backdrop {
        position: absolute; inset: 0;
        background: rgba(28,24,20,.55);
        z-index: 200;
        display: flex; align-items: flex-end; justify-content: center;
        animation: bestiaryFadeIn .18s ease-out;
      }
      @container (min-width: 1024px) {
        .duel-container .deck-sheet-backdrop { align-items: center; padding: 24px; }
      }
      .duel-container .deck-sheet {
        background: #fff;
        border-radius: 24px 24px 0 0;
        padding: 18px 18px 24px;
        width: 100%; max-width: 480px;
        max-height: 80vh; overflow-y: auto;
        animation: bestiarySlideUp .25s cubic-bezier(.2,.85,.3,1);
        box-shadow: 0 -10px 40px rgba(0,0,0,.25);
      }
      @container (min-width: 1024px) {
        .duel-container .deck-sheet { border-radius: 22px; }
      }
      .duel-container .deck-sheet .deck-sheet-head {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 14px;
      }
      .duel-container .deck-sheet .title {
        font-family: inherit; font-weight: 800; font-size: 18px;
      }
      .duel-container .deck-sheet .icon-btn {
        width: 32px; height: 32px; border-radius: 50%;
        background: transparent; border: 1px solid rgba(58,46,42,.10);
        cursor: pointer; display: grid; place-items: center;
        color: #3a2e2a;
      }
      .duel-container .deck-sheet .link-btn {
        background: transparent; border: 0;
        font-family: inherit; font-weight: 700;
        font-size: 11px; color: #ee5a52;
        cursor: pointer; padding: 2px 4px;
        text-transform: none; letter-spacing: 0.02em;
      }
      .duel-container .deck-sheet .empty-line {
        padding: 12px; font-size: 12px; color: #a89580;
        font-style: italic;
      }
      .duel-container .deck-sheet-list {
        display: flex; flex-direction: column; gap: 6px;
      }
      .duel-container .deck-sheet-row {
        display: grid; grid-template-columns: 12px 1fr auto;
        gap: 10px; align-items: center;
        padding: 12px 14px; border-radius: 12px;
        background: #fff7e6;
        border: 1px solid rgba(58,46,42,.10);
        font-family: inherit; cursor: pointer; text-align: left;
        color: #3a2e2a;
      }
      .duel-container .deck-sheet-row[data-active="true"] {
        background: #3a2e2a; color: #fff; border-color: #3a2e2a;
      }
      .duel-container .deck-sheet-row .dot {
        width: 10px; height: 10px; border-radius: 50%;
        box-shadow: 0 0 0 2px rgba(255,255,255,.5);
      }
      .duel-container .deck-sheet-row .name {
        font-family: inherit; font-weight: 700; font-size: 15px;
      }
      .duel-container .deck-sheet-row .count {
        font-family: inherit; font-weight: 800; font-size: 11px;
        padding: 3px 8px; border-radius: 8px;
        letter-spacing: 0.04em;
      }
      .duel-container .deck-sheet-row .count.ok { background: rgba(94, 168, 99, .15); color: #3f7448; }
      .duel-container .deck-sheet-row .count.low { background: rgba(238, 90, 82, .15); color: #ee5a52; }
      .duel-container .deck-sheet-row[data-active="true"] .count.ok,
      .duel-container .deck-sheet-row[data-active="true"] .count.low {
        background: rgba(255,255,255,.15); color: #fff;
      }
      .duel-container .deck-sheet-test-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 6px;
      }
      .duel-container .test-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 12px; border-radius: 12px;
        background: #fff7e6;
        border: 1px solid rgba(58,46,42,.10);
        font-family: inherit; font-weight: 700; font-size: 13px;
        color: #3a2e2a;
        cursor: pointer;
      }
      .duel-container .test-chip[data-active="true"] {
        background: var(--deck-color); color: #fff; border-color: var(--deck-color);
      }
      .duel-container .test-chip .dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--deck-color);
      }
      .duel-container .test-chip[data-active="true"] .dot {
        background: rgba(255,255,255,.85);
      }
      @keyframes bestiaryFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes bestiarySlideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .duel-container, .duel-container * {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  );
}
