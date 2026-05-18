import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Check, Lock, LayoutGrid, Rows3, Heart, Briefcase, PawPrint,
  Plane, UtensilsCrossed, GraduationCap, Swords, Sparkles, Plus, Pencil,
  Trash2, X, Search, ChevronDown, ChevronUp, Activity,
} from 'lucide-react';
import { Card } from '../components/Card';
import { MemoryPanel } from '../components/MemoryPanel';
import { ELEMENTS } from '../data/elements';
import { iconBtn, PALETTE } from '../components/styles';
import { useViewport } from '../hooks/useViewport';
import type { CollectionCard, DeckSlot, ElementId } from '../game/types';

type Filter =
  | 'All'
  | 'Family' | 'Work' | 'Animals' | 'Travel' | 'Food' | 'Education'
  | 'Creatures' | 'Spells';

const FILTERS: { id: Filter; label: string; icon: React.ReactNode; tone?: 'theme' | 'type'; themeId?: ElementId }[] = [
  { id: 'All',       label: 'All',       icon: null },
  { id: 'Family',    label: 'Family',    icon: <Heart     size={11} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'family' },
  { id: 'Work',      label: 'Work',      icon: <Briefcase size={11} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'work' },
  { id: 'Animals',   label: 'Animals',   icon: <PawPrint  size={11} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'animals' },
  { id: 'Travel',    label: 'Travel',    icon: <Plane     size={11} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'travel' },
  { id: 'Food',      label: 'Food',      icon: <UtensilsCrossed size={11} strokeWidth={2.4} />, tone: 'theme', themeId: 'food' },
  { id: 'Education', label: 'Education', icon: <GraduationCap size={11} strokeWidth={2.4} />, tone: 'theme', themeId: 'education' },
  { id: 'Creatures', label: 'Creatures', icon: <Swords    size={11} strokeWidth={2.4} />, tone: 'type' },
  { id: 'Spells',    label: 'Spells',    icon: <Sparkles  size={11} strokeWidth={2.4} />, tone: 'type' },
];

const DECK_SIZE = 12;

interface Props {
  collection: CollectionCard[];
  decks: DeckSlot[];
  activeDeckId: string;
  maxDecks: number;
  onChange: (deckId: string, uids: string[]) => void;
  onSetActive: (deckId: string) => void;
  onCreate: () => void;
  onRename: (deckId: string, name: string) => void;
  onDelete: (deckId: string) => void;
  /** Update the player's memory text for a card. Optional. */
  onUpdateMemory?: (uid: string, memory: string) => void;
  onBack: () => void;
  /** When true, hides the internal back button and tightens the top
   *  padding — the screen assumes an outer wrapper (the Cards tabbed
   *  shell) is supplying the navigation chrome above. */
  embedded?: boolean;
}

export function DeckBuilder({
  collection, decks, activeDeckId, maxDecks,
  onChange, onSetActive, onCreate, onRename, onDelete, onUpdateMemory, onBack,
  embedded = false,
}: Props) {
  const { isMobile, isDesktop } = useViewport();
  /** Compact = dense grid; Big = roomier preview cards. */
  const [layout, setLayout] = useState<'big' | 'compact'>('compact');
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [inspectActive, setInspectActive] = useState<CollectionCard | null>(null);
  const [managing, setManaging] = useState<string | null>(null);
  /** Mobile-only: the deck-health panel collapses by default so the
   *  library stays on-screen. On desktop the same panel lives in the
   *  right sidebar permanently. */
  const [healthOpen, setHealthOpen] = useState(false);

  const activeDeck = decks.find(d => d.id === activeDeckId) ?? decks[0];
  const deckUids = activeDeck?.uids ?? [];

  // Sort the active deck: creatures before spells, ascending cost
  // within each group, then alphabetic.
  const sortedDeckUids = useMemo(() => {
    return [...deckUids].sort((a, b) => {
      const ca = collection.find(x => x.uid === a);
      const cb = collection.find(x => x.uid === b);
      if (!ca || !cb) return 0;
      if (ca.type !== cb.type) return ca.type === 'Creature' ? -1 : 1;
      if (ca.cost !== cb.cost) return ca.cost - cb.cost;
      return ca.name.localeCompare(cb.name);
    });
  }, [deckUids, collection]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return collection.filter(c => {
      // Filter chip
      switch (filter) {
        case 'Creatures': if (c.type !== 'Creature') return false; break;
        case 'Spells':    if (c.type !== 'Spell')    return false; break;
        case 'Family':    if (c.el !== 'family')     return false; break;
        case 'Work':      if (c.el !== 'work')       return false; break;
        case 'Animals':   if (c.el !== 'animals')    return false; break;
        case 'Travel':    if (c.el !== 'travel')     return false; break;
        case 'Food':      if (c.el !== 'food')       return false; break;
        case 'Education': if (c.el !== 'education')  return false; break;
        default: break;
      }
      // Search text — match name or the player's memory text so the
      // story they wrote at summon time is searchable.
      if (q) {
        const haystack = `${c.name} ${c.memory ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [collection, filter, search]);

  const countFor = (f: Filter): number => {
    switch (f) {
      case 'All':       return collection.length;
      case 'Creatures': return collection.filter(c => c.type === 'Creature').length;
      case 'Spells':    return collection.filter(c => c.type === 'Spell').length;
      case 'Family':    return collection.filter(c => c.el === 'family').length;
      case 'Work':      return collection.filter(c => c.el === 'work').length;
      case 'Animals':   return collection.filter(c => c.el === 'animals').length;
      case 'Travel':    return collection.filter(c => c.el === 'travel').length;
      case 'Food':      return collection.filter(c => c.el === 'food').length;
      case 'Education': return collection.filter(c => c.el === 'education').length;
    }
  };

  const toggle = (uid: string) => {
    if (!activeDeck) return;
    if (deckUids.includes(uid)) {
      onChange(activeDeck.id, deckUids.filter(x => x !== uid));
    } else if (deckUids.length < DECK_SIZE) {
      onChange(activeDeck.id, [...deckUids, uid]);
    }
  };

  // Pre-compute deck-health stats so both the sidebar panel and the
  // mobile collapsible read from the same source of truth.
  const deckCards = sortedDeckUids
    .map(uid => collection.find(x => x.uid === uid))
    .filter((c): c is CollectionCard => !!c);
  const stats = useMemo(() => computeDeckStats(deckCards), [deckCards]);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)',
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ===================== HEADER ===================== */}
      <div style={{
        padding: embedded
          ? (isMobile ? '4px 16px 4px' : '6px 24px 6px')
          : (isMobile ? '52px 16px 8px' : '36px 24px 10px'),
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%',
      }}>
        {!embedded && (
          <button onClick={onBack} style={iconBtn} aria-label="Back"><ArrowLeft size={18} /></button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!embedded && (
            <div style={{
              fontSize: isMobile ? 20 : 22, fontWeight: 700,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{activeDeck?.name ?? 'Deck'}</div>
          )}
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: embedded ? 0 : 2 }}>
            {deckUids.length} / {DECK_SIZE} cards
            {!isMobile && stats.playableCount < deckUids.length && (
              <span style={{ marginLeft: 8, color: '#b04a2e', fontWeight: 700 }}>
                · {deckUids.length - stats.playableCount} dormant
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setLayout(l => l === 'big' ? 'compact' : 'big')}
          style={{ ...iconBtn, display: 'grid', placeItems: 'center' }}
          aria-label={layout === 'big' ? 'Compact view' : 'Big view'}
          title={layout === 'big' ? 'Compact view' : 'Big view'}
        >
          {layout === 'big' ? <LayoutGrid size={17} /> : <Rows3 size={17} />}
        </button>
      </div>

      {/* ===================== BODY ===================== */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex',
        // Desktop: main + right sidebar; mobile: single column.
        flexDirection: isDesktop ? 'row' : 'column',
        gap: isDesktop ? 16 : 0,
        padding: isDesktop ? '0 24px 16px' : 0,
      }}>
        {/* ----- MAIN COLUMN ----- */}
        {/* On mobile the entire column is one scroll surface so the
            active deck + library all share a single, natural page
            scroll. (Previously the library had its own internal scroll
            which got squeezed into one visible row when the deck was
            full.) On desktop we keep the inner library scroll because
            the sidebar + main split needs each to scroll independently. */}
        <div style={{
          flex: 1, minWidth: 0, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          overflowY: isDesktop ? 'hidden' : 'auto',
        }}>
          <DeckSwitcher
            decks={decks}
            activeDeckId={activeDeckId}
            maxDecks={maxDecks}
            onSetActive={onSetActive}
            onCreate={onCreate}
            onManage={(id) => setManaging(id)}
          />

          {/* Mobile-only active deck strip — desktop puts it in the
              sidebar so the library doesn't have to share screen real
              estate with it. */}
          {!isDesktop && (
            <ActiveDeckStrip
              cards={sortedDeckUids
                .map(uid => collection.find(x => x.uid === uid))
                .filter((c): c is CollectionCard => !!c)}
              onTap={(c) => setInspectActive(c)}
            />
          )}

          {/* Mobile-only deck health collapsible. */}
          {!isDesktop && (
            <DeckHealthCollapsible
              stats={stats}
              open={healthOpen}
              onToggle={() => setHealthOpen(o => !o)}
            />
          )}

          {/* Search + filters live in a sticky utility bar so they
              stay reachable while the library scrolls. */}
          <SearchAndFilters
            search={search} onSearch={setSearch}
            filter={filter} onFilter={setFilter}
            countFor={countFor}
          />

          {/* Library grid */}
          <LibraryGrid
            cards={filtered}
            layout={layout}
            deckUids={deckUids}
            onInspect={setInspectActive}
            isMobile={isMobile}
            collectionEmpty={collection.length === 0}
          />
        </div>

        {/* ----- DESKTOP RIGHT SIDEBAR ----- */}
        {isDesktop && (
          <aside style={{
            width: 320, flex: '0 0 auto',
            display: 'flex', flexDirection: 'column', gap: 12,
            paddingTop: 6,
          }}>
            <DeckHealthPanel stats={stats} />
            <ActiveDeckSidebar
              cards={sortedDeckUids
                .map(uid => collection.find(x => x.uid === uid))
                .filter((c): c is CollectionCard => !!c)}
              onTap={(c) => setInspectActive(c)}
            />
          </aside>
        )}
      </div>

      {/* ===================== MODALS ===================== */}
      {managing && (() => {
        const d = decks.find(x => x.id === managing);
        if (!d) { setManaging(null); return null; }
        const canDelete = decks.length > 1;
        return (
          <ManageDeckModal
            deck={d}
            canDelete={canDelete}
            onRename={(name) => { onRename(d.id, name); setManaging(null); }}
            onDelete={() => { onDelete(d.id); setManaging(null); }}
            onClose={() => setManaging(null)}
          />
        );
      })()}

      {inspectActive && (
        <CardInspectModal
          card={inspectActive}
          inDeck={deckUids.includes(inspectActive.uid)}
          onClose={() => setInspectActive(null)}
          onToggle={() => {
            toggle(inspectActive.uid);
            setInspectActive(null);
          }}
          onUpdateMemory={onUpdateMemory ? (text) => {
            onUpdateMemory(inspectActive.uid, text);
            setInspectActive({ ...inspectActive, memory: text.trim() || undefined });
          } : undefined}
        />
      )}
    </div>
  );
}

// =================================================================
// DECK SWITCHER
// =================================================================
function DeckSwitcher({
  decks, activeDeckId, maxDecks, onSetActive, onCreate, onManage,
}: {
  decks: DeckSlot[]; activeDeckId: string; maxDecks: number;
  onSetActive: (id: string) => void;
  onCreate: () => void;
  onManage: (id: string) => void;
}) {
  return (
    <div className="no-scrollbar" style={{
      padding: '0 12px 8px',
      display: 'flex', gap: 6,
      overflowX: 'auto',
      flex: '0 0 auto',
    }}>
      {decks.map(d => {
        const active = d.id === activeDeckId;
        return (
          <button
            key={d.id}
            onClick={() => active ? onManage(d.id) : onSetActive(d.id)}
            aria-label={active ? `Manage ${d.name}` : `Switch to ${d.name}`}
            style={{
              padding: '10px 14px',
              minHeight: 40,
              borderRadius: 12,
              border: 'none',
              background: active ? '#fff' : 'rgba(255,255,255,.55)',
              color: active ? PALETTE.text : PALETTE.textMid,
              fontFamily: 'inherit',
              fontWeight: 700, fontSize: 12,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: active
                ? '0 4px 10px rgba(255, 126, 95, .18), 0 0 0 1.5px rgba(238,90,82,.55)'
                : '0 1px 3px rgba(58,46,42,.06)',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background .15s, box-shadow .15s',
            }}
          >
            {active && <Check size={11} strokeWidth={3} color="#ee5a52" />}
            {d.name}
            <span style={{ fontSize: 10, color: PALETTE.textLight, fontWeight: 600 }}>
              {d.uids.length}
            </span>
          </button>
        );
      })}
      <button
        onClick={onCreate}
        disabled={decks.length >= maxDecks}
        aria-label="New deck"
        title={decks.length >= maxDecks ? `Max ${maxDecks} decks` : 'New deck'}
        style={{
          padding: '10px 12px',
          minHeight: 40,
          borderRadius: 12,
          border: '1.5px dashed rgba(58,46,42,.25)',
          background: 'transparent',
          color: PALETTE.textMid,
          fontFamily: 'inherit',
          fontWeight: 700, fontSize: 12,
          cursor: decks.length >= maxDecks ? 'not-allowed' : 'pointer',
          opacity: decks.length >= maxDecks ? 0.4 : 1,
          display: 'flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap',
        }}
      >
        <Plus size={13} strokeWidth={2.6} /> New
      </button>
    </div>
  );
}

// =================================================================
// ACTIVE DECK — MOBILE STRIP / DESKTOP SIDEBAR
// =================================================================
function ActiveDeckStrip({
  cards, onTap,
}: { cards: CollectionCard[]; onTap: (c: CollectionCard) => void }) {
  return (
    <div style={{
      margin: '0 16px 12px',
      background: '#fff',
      border: `2px dashed ${PALETTE.accent}`,
      borderRadius: 14,
      padding: 10,
      boxShadow: '0 4px 10px rgba(58,46,42,.06)',
      flex: '0 0 auto',
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: PALETTE.textMid, marginBottom: 8, fontWeight: 700,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Active Deck</span>
        <span style={{ color: PALETTE.text, fontWeight: 800 }}>{cards.length} / {DECK_SIZE}</span>
      </div>
      {/* Wrap grid so every card in the active deck is visible at once
          on a small phone. Was a single horizontal-scroll row before,
          which hid cards past the 5th slot behind the right edge. */}
      <div
        className="no-scrollbar"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(58px, 1fr))',
          gap: 4,
          maxHeight: 200,
          overflowY: 'auto',
          alignContent: 'start',
          justifyItems: 'center',
        }}
      >
        <AnimatePresence initial={false}>
          {cards.map(c => (
            <motion.div
              key={c.uid}
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              onClick={() => onTap(c)}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              <Card card={c} scale={0.26} />
            </motion.div>
          ))}
        </AnimatePresence>
        {cards.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            fontSize: 12, color: PALETTE.textMid, fontStyle: 'italic',
            padding: '8px 4px',
          }}>
            Tap a summoned card below to add it.
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveDeckSidebar({
  cards, onTap,
}: { cards: CollectionCard[]; onTap: (c: CollectionCard) => void }) {
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${PALETTE.border}`,
      borderRadius: 14,
      padding: 12,
      boxShadow: '0 4px 10px rgba(58,46,42,.06)',
      flex: '1 1 auto', minHeight: 0,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: PALETTE.textMid, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Active Deck</span>
        <span style={{ color: PALETTE.text, fontWeight: 800 }}>{cards.length} / {DECK_SIZE}</span>
      </div>
      <div
        className="no-scrollbar"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
          gap: 6,
          overflowY: 'auto',
          paddingBottom: 4,
          minHeight: 0, flex: '1 1 auto',
          alignContent: 'start',
          justifyItems: 'center',
        }}
      >
        <AnimatePresence initial={false}>
          {cards.map(c => (
            <motion.div
              key={c.uid}
              layout
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              onClick={() => onTap(c)}
              style={{ cursor: 'pointer' }}
            >
              <Card card={c} scale={0.3} />
            </motion.div>
          ))}
        </AnimatePresence>
        {cards.length === 0 && (
          <div style={{
            gridColumn: '1 / -1', textAlign: 'center',
            fontSize: 12, color: PALETTE.textMid, fontStyle: 'italic',
            padding: '12px 8px',
          }}>
            Tap a summoned card to add it.
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// DECK HEALTH
// =================================================================
interface DeckStats {
  total: number;
  playableCount: number;
  creatures: number;
  spells: number;
  byTheme: Record<ElementId, number>;
  byCost: number[]; // index 0..7+, count per mana cost (cost 7+ rolls into 7)
  avgCost: number;
}

function computeDeckStats(cards: CollectionCard[]): DeckStats {
  const byTheme: Record<ElementId, number> = {
    family: 0, work: 0, animals: 0, travel: 0, food: 0, education: 0,
  };
  const byCost = Array.from({ length: 8 }, () => 0);
  let creatures = 0, spells = 0, costSum = 0, playableCount = 0;
  for (const c of cards) {
    if (c.type === 'Creature') creatures++; else spells++;
    byTheme[c.el]++;
    const ci = Math.min(c.cost, 7);
    byCost[ci]++;
    costSum += c.cost;
    if (c.photo) playableCount++;
  }
  return {
    total: cards.length,
    playableCount,
    creatures,
    spells,
    byTheme,
    byCost,
    avgCost: cards.length ? costSum / cards.length : 0,
  };
}

function DeckHealthCollapsible({
  stats, open, onToggle,
}: { stats: DeckStats; open: boolean; onToggle: () => void }) {
  const summary = stats.total === 0
    ? 'Empty deck'
    : `${stats.creatures}C / ${stats.spells}S · avg cost ${stats.avgCost.toFixed(1)}`;
  return (
    <div style={{
      margin: '0 16px 10px',
      background: '#fff',
      border: `1.5px solid ${PALETTE.border}`,
      borderRadius: 12,
      boxShadow: '0 2px 6px rgba(58,46,42,.05)',
      flex: '0 0 auto',
    }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none',
          fontFamily: 'inherit', cursor: 'pointer',
          color: PALETTE.text,
          minHeight: 44,
        }}
      >
        <Activity size={14} strokeWidth={2.4} color={PALETTE.accent} />
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: PALETTE.textMid, fontWeight: 700 }}>
            Deck Health
          </div>
          <div style={{ fontSize: 12, color: PALETTE.text, fontWeight: 600, marginTop: 1 }}>
            {summary}
          </div>
        </div>
        {open ? <ChevronUp size={16} color={PALETTE.textMid} /> : <ChevronDown size={16} color={PALETTE.textMid} />}
      </button>
      {open && (
        <div style={{ padding: '4px 14px 14px' }}>
          <DeckHealthBody stats={stats} />
        </div>
      )}
    </div>
  );
}

function DeckHealthPanel({ stats }: { stats: DeckStats }) {
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${PALETTE.border}`,
      borderRadius: 14,
      padding: 14,
      boxShadow: '0 4px 10px rgba(58,46,42,.06)',
      flex: '0 0 auto',
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: PALETTE.textMid, fontWeight: 700, marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Activity size={12} strokeWidth={2.4} color={PALETTE.accent} />
        Deck Health
      </div>
      <DeckHealthBody stats={stats} />
    </div>
  );
}

function DeckHealthBody({ stats }: { stats: DeckStats }) {
  const slots = Array.from({ length: DECK_SIZE });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Slot progress */}
      <div>
        <div style={{ fontSize: 10, color: PALETTE.textMid, marginBottom: 4, fontWeight: 700 }}>
          Slots · {stats.total} / {DECK_SIZE}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {slots.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 6, borderRadius: 3,
              background: i < stats.total ? PALETTE.accent : 'rgba(58,46,42,.10)',
            }} />
          ))}
        </div>
      </div>

      {/* Creature vs Spell ratio */}
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: PALETTE.textMid, fontWeight: 700, marginBottom: 4,
        }}>
          <span>Creatures · {stats.creatures}</span>
          <span>Spells · {stats.spells}</span>
        </div>
        <div style={{
          height: 6, borderRadius: 3, overflow: 'hidden',
          background: 'rgba(58,46,42,.10)',
          display: 'flex',
        }}>
          <div style={{
            width: stats.total ? `${(stats.creatures / stats.total) * 100}%` : 0,
            background: '#5a8a7e',
          }} />
          <div style={{
            width: stats.total ? `${(stats.spells / stats.total) * 100}%` : 0,
            background: '#9c6fc8',
          }} />
        </div>
      </div>

      {/* Mana curve */}
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: PALETTE.textMid, fontWeight: 700, marginBottom: 4,
        }}>
          <span>Mana Curve</span>
          <span>avg {stats.avgCost.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
          {stats.byCost.map((n, i) => {
            const max = Math.max(1, ...stats.byCost);
            const h = (n / max) * 32;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  width: '100%',
                  height: Math.max(2, h),
                  background: n > 0 ? PALETTE.accent : 'rgba(58,46,42,.10)',
                  borderRadius: 2,
                  transition: 'height .2s',
                }} />
                <div style={{ fontSize: 8, color: PALETTE.textMid, fontWeight: 700 }}>
                  {i === 7 ? '7+' : i}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Theme spread */}
      <div>
        <div style={{ fontSize: 10, color: PALETTE.textMid, marginBottom: 4, fontWeight: 700 }}>
          Themes
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {(Object.keys(stats.byTheme) as ElementId[]).map(t => {
            const n = stats.byTheme[t];
            if (n === 0) return null;
            const el = ELEMENTS[t];
            return (
              <span key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: `${el.color}1A`,
                color: el.deep,
                padding: '2px 7px', borderRadius: 8,
                fontSize: 10, fontWeight: 700,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: el.color,
                }} />
                {el.name} · {n}
              </span>
            );
          })}
          {stats.total === 0 && (
            <span style={{ fontSize: 10, color: PALETTE.textLight, fontStyle: 'italic' }}>
              Add cards to see your theme spread.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// SEARCH + FILTERS
// =================================================================
function SearchAndFilters({
  search, onSearch, filter, onFilter, countFor,
}: {
  search: string; onSearch: (v: string) => void;
  filter: Filter; onFilter: (f: Filter) => void;
  countFor: (f: Filter) => number;
}) {
  return (
    <div style={{
      padding: '0 12px 8px',
      display: 'flex', flexDirection: 'column', gap: 8,
      flex: '0 0 auto',
    }}>
      {/* Search input */}
      <div style={{
        position: 'relative',
        margin: '0 4px',
      }}>
        <Search
          size={14} strokeWidth={2.4} color={PALETTE.textMid}
          style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', pointerEvents: 'none',
          }}
          aria-hidden
        />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search cards…"
          aria-label="Search cards by name"
          style={{
            width: '100%',
            padding: '10px 36px 10px 34px',
            minHeight: 40,
            borderRadius: 10,
            border: `1.5px solid ${PALETTE.border}`,
            background: '#fff',
            color: PALETTE.text,
            fontFamily: 'inherit', fontSize: 13,
            outline: 'none',
            boxShadow: '0 2px 6px rgba(58,46,42,.04)',
          }}
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            aria-label="Clear search"
            style={{
              position: 'absolute', right: 8, top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent', border: 'none',
              cursor: 'pointer', padding: 4,
              color: PALETTE.textMid,
              display: 'grid', placeItems: 'center',
            }}
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* Filter chips — wraps to multiple rows on narrow phones. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '0 4px' }}>
        {FILTERS.map(f => {
          const count = countFor(f.id);
          const active = filter === f.id;
          const tint = active && f.themeId ? ELEMENTS[f.themeId].color : PALETTE.accent;
          const isAll = f.id === 'All';
          return (
            <button
              key={f.id}
              onClick={() => onFilter(f.id)}
              disabled={count === 0 && !isAll}
              aria-label={f.label}
              title={f.label}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: isAll ? '6px 11px' : '6px 9px',
                minHeight: 28,
                borderRadius: 12,
                fontSize: 11, fontWeight: 700,
                background: active ? tint : '#fff',
                color: active ? '#fff' : (count === 0 && !isAll ? PALETTE.textMid : PALETTE.text),
                opacity: count === 0 && !isAll ? 0.45 : 1,
                border: active ? `1.5px solid ${tint}` : `1.5px solid ${PALETTE.border}`,
                cursor: count === 0 && !isAll ? 'default' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: active ? `0 2px 8px ${tint}55` : '0 2px 6px rgba(58,46,42,.05)',
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
                transition: 'transform .1s',
              }}
            >
              {isAll
                ? <span style={{ fontSize: 11, letterSpacing: '0.06em' }}>ALL</span>
                : <span style={{ display: 'flex', alignItems: 'center' }}>{f.icon}</span>}
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: active ? 'rgba(255,255,255,.25)' : 'rgba(58,46,42,.08)',
                color: active ? '#fff' : PALETTE.textMid,
                padding: '1px 6px', borderRadius: 7,
              }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =================================================================
// LIBRARY GRID
// =================================================================
function LibraryGrid({
  cards, layout, deckUids, onInspect, isMobile, collectionEmpty,
}: {
  cards: CollectionCard[];
  layout: 'big' | 'compact';
  deckUids: string[];
  onInspect: (c: CollectionCard) => void;
  isMobile: boolean;
  collectionEmpty: boolean;
}) {
  // Card sizing per breakpoint. Compact on a 360px phone gives ~5 cards
  // per row (vs 2-3 before) so the player can see the whole library at
  // a glance and scroll less. Big mode stays roomy enough to read every
  // card's stats and ability text.
  const compactMin = isMobile ? 58 : 90;
  const bigMin     = isMobile ? 110 : 150;
  const compactScale = isMobile ? 0.26 : 0.34;
  const bigScale     = isMobile ? 0.46 : 0.6;
  const gridGap = layout === 'compact' ? (isMobile ? 4 : 6) : (isMobile ? 8 : 12);
  const scale = layout === 'compact' ? compactScale : bigScale;
  const inDeckBadge = layout === 'compact' && isMobile ? 18 : (layout === 'compact' ? 22 : 30);
  const inDeckIcon  = layout === 'compact' && isMobile ? 10 : (layout === 'compact' ? 13 : 18);

  return (
    <div style={{
      // Mobile: extend naturally and let the parent column scroll the
      // whole page. Desktop: keep an internal scroll so the sidebar
      // stays fixed while the library scrolls independently.
      flex: isMobile ? '0 0 auto' : 1,
      minHeight: 0,
      overflow: isMobile ? 'visible' : 'auto',
      padding: isMobile ? '0 12px 24px' : '0 16px 30px',
      display: 'grid',
      gridTemplateColumns: layout === 'compact'
        ? `repeat(auto-fill, minmax(${compactMin}px, 1fr))`
        : `repeat(auto-fill, minmax(${bigMin}px, 1fr))`,
      gap: gridGap,
      justifyItems: 'center',
      alignContent: 'start',
    }}>
      <AnimatePresence initial={false} mode="popLayout">
        {cards.map(card => {
          const inDeck = deckUids.includes(card.uid);
          const playable = !!card.photo;
          return (
            <motion.div key={card.uid}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: playable ? 1 : 0.6, scale: inDeck ? 0.95 : 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 480, damping: 32 }}
              onClick={() => playable && onInspect(card)}
              style={{
                cursor: playable ? 'pointer' : 'not-allowed',
                position: 'relative',
              }}
            >
              <Card card={card} scale={scale} hovered={inDeck} />
              {inDeck && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  width: inDeckBadge,
                  height: inDeckBadge,
                  borderRadius: '50%',
                  background: PALETTE.accent, color: '#fff',
                  display: 'grid', placeItems: 'center',
                  boxShadow: '0 0 0 2px #fef3e8, 0 4px 8px rgba(255,126,95,.4)',
                }}>
                  <Check size={inDeckIcon} strokeWidth={3.5} />
                </div>
              )}
              {!playable && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  background: 'rgba(58,46,42,.55)',
                  borderRadius: 12,
                  fontSize: layout === 'compact' ? 9 : 12, fontWeight: 700,
                  color: '#fff',
                }}>
                  <Lock size={layout === 'compact' ? 10 : 14} strokeWidth={2.5} />
                  {layout === 'compact' && isMobile ? '' : layout === 'compact' ? '' : ' Dormant'}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {cards.length === 0 && (
        <div style={{
          gridColumn: '1 / -1', textAlign: 'center',
          opacity: 0.5, padding: 40, fontSize: 13,
        }}>
          {collectionEmpty ? 'Open a pack to start building.' : 'Nothing matches this filter.'}
        </div>
      )}
    </div>
  );
}

// =================================================================
// MODALS
// =================================================================
function ManageDeckModal({
  deck, canDelete, onRename, onDelete, onClose,
}: {
  deck: DeckSlot;
  canDelete: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,.55)', zIndex: 200,
        display: 'grid', placeItems: 'center',
        padding: 16,
        animation: 'fadeIn .2s',
      }}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 18,
          padding: '20px 22px',
          width: '100%', maxWidth: 360,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 18px 40px rgba(0,0,0,.4)',
          animation: 'cardSummon .3s cubic-bezier(.2,.8,.3,1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: PALETTE.text }}>Manage deck</div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'transparent', border: '1.5px solid rgba(58,46,42,.15)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer', color: PALETTE.text,
          }}>
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
        <DeckRenameField key={deck.id} initial={deck.name} onCommit={onRename} />
        <button
          onClick={() => { if (canDelete) onDelete(); }}
          disabled={!canDelete}
          style={{
            width: '100%', marginTop: 12,
            padding: '12px 14px',
            background: canDelete ? '#fff' : '#f5ede2',
            color: canDelete ? '#c8362e' : PALETTE.textLight,
            border: `1.5px solid ${canDelete ? 'rgba(200,54,46,.4)' : 'rgba(58,46,42,.1)'}`,
            borderRadius: 12,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            cursor: canDelete ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Trash2 size={14} strokeWidth={2.4} /> Delete deck
        </button>
        {!canDelete && (
          <div style={{ fontSize: 10, color: PALETTE.textLight, marginTop: 6, textAlign: 'center' }}>
            Can't delete your last deck.
          </div>
        )}
      </div>
    </div>
  );
}

function CardInspectModal({
  card, inDeck, onClose, onToggle, onUpdateMemory,
}: {
  card: CollectionCard;
  inDeck: boolean;
  onClose: () => void;
  onToggle: () => void;
  onUpdateMemory?: (text: string) => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(8,4,12,.7)',
        display: 'grid', placeItems: 'center',
        zIndex: 220,
        padding: 16,
        animation: 'fadeIn .2s',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 14, maxHeight: '100%',
          animation: 'cardSummon 0.3s cubic-bezier(.2,.8,.3,1)',
        }}
      >
        <Card card={card} hovered scale={0.9} />
        {onUpdateMemory && (
          <MemoryPanel
            memory={card.memory}
            surface="dark"
            onSave={onUpdateMemory}
          />
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              background: '#fff', color: PALETTE.text,
              border: `1.5px solid ${PALETTE.border}`,
              borderRadius: 18, padding: '11px 20px',
              minHeight: 44,
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 10px rgba(58,46,42,.15)',
            }}
          >Close</button>
          <button
            onClick={onToggle}
            style={{
              background: inDeck
                ? 'linear-gradient(180deg, #ee5a52, #c8362e)'
                : 'linear-gradient(180deg, #ffa07a, #ee5a52)',
              color: '#fff',
              border: 'none',
              borderRadius: 18, padding: '11px 24px',
              minHeight: 44,
              fontSize: 13, fontWeight: 800,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: inDeck
                ? '0 4px 14px rgba(200,54,46,.4)'
                : '0 4px 14px rgba(238,90,82,.4)',
            }}
          >{inDeck ? 'Remove from deck' : 'Add to deck'}</button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// RENAME FIELD
// =================================================================
function DeckRenameField({
  initial, onCommit,
}: { initial: string; onCommit: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();
  const dirty = trimmed.length > 0 && trimmed !== initial;
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, color: PALETTE.textMid,
        letterSpacing: '0.15em', textTransform: 'uppercase',
        fontWeight: 700, marginBottom: 6,
      }}>
        Deck name
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          autoFocus
          value={value}
          maxLength={24}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && dirty) onCommit(trimmed); }}
          style={{
            flex: 1,
            padding: '10px 12px',
            minHeight: 40,
            border: '1.5px solid rgba(58,46,42,.18)',
            borderRadius: 10,
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            color: PALETTE.text,
            outline: 'none',
            background: '#fef8f0',
          }}
        />
        <button
          onClick={() => onCommit(trimmed)}
          disabled={!dirty}
          style={{
            padding: '10px 16px',
            minHeight: 40,
            background: dirty ? 'linear-gradient(180deg, #ffa07a 0%, #ee5a52 100%)' : '#f5ede2',
            color: dirty ? '#fff' : PALETTE.textLight,
            border: 'none', borderRadius: 10,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            cursor: dirty ? 'pointer' : 'not-allowed',
          }}
        >
          <Pencil size={13} strokeWidth={2.6} style={{ marginRight: 6, verticalAlign: -2 }} />
          Save
        </button>
      </div>
    </div>
  );
}
