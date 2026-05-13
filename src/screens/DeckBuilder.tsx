import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Lock, LayoutGrid, Rows3, Heart, Briefcase, PawPrint, Plane, UtensilsCrossed, GraduationCap, Swords, Sparkles, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Card } from '../components/Card';
import { ELEMENTS } from '../data/elements';
import { iconBtn, PALETTE } from '../components/styles';
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

// Matches the boss deck size in data/bosses.ts so player and opponent always
// start with the same number of cards.
const DECK_SIZE = 12;

interface Props {
  collection: CollectionCard[];
  /** All saved deck slots. Always at least one (App.tsx guarantees this).
   *  The deck currently being edited is `activeDeckId` — every change
   *  this screen makes flows back through `onChange(deckId, uids)`. */
  decks: DeckSlot[];
  activeDeckId: string;
  /** Max number of saved decks the player can keep. Drives the disabled
   *  state on the "+" pill in the switcher. */
  maxDecks: number;
  onChange: (deckId: string, uids: string[]) => void;
  onSetActive: (deckId: string) => void;
  onCreate: () => void;
  onRename: (deckId: string, name: string) => void;
  onDelete: (deckId: string) => void;
  onBack: () => void;
}

export function DeckBuilder({
  collection, decks, activeDeckId, maxDecks,
  onChange, onSetActive, onCreate, onRename, onDelete, onBack,
}: Props) {
  /** Compact = 4-column smaller cards (default — scans a large library
      faster when picking the 12 deck slots); Big = 2-column for detail. */
  const [layout, setLayout] = useState<'big' | 'compact'>('compact');
  const [filter, setFilter] = useState<Filter>('All');
  /** Card opened from the Active Deck strip — shows preview + Remove button. */
  const [inspectActive, setInspectActive] = useState<CollectionCard | null>(null);
  /** Deck-management modal state — null = closed; deckId = editing that deck. */
  const [managing, setManaging] = useState<string | null>(null);

  // Resolve the active deck. Fallback to first deck if activeDeckId is
  // somehow stale (defensive — App.tsx keeps this in sync).
  const activeDeck = decks.find(d => d.id === activeDeckId) ?? decks[0];
  const deckUids = activeDeck?.uids ?? [];

  // Sort the active deck so creatures come before spells, with cost
  // ascending inside each group. Lets the player see deck composition
  // at a glance — the green half is creatures, the violet half is spells.
  const sortedDeckUids = [...deckUids].sort((a, b) => {
    const ca = collection.find(x => x.uid === a);
    const cb = collection.find(x => x.uid === b);
    if (!ca || !cb) return 0;
    if (ca.type !== cb.type) return ca.type === 'Creature' ? -1 : 1;
    if (ca.cost !== cb.cost) return ca.cost - cb.cost;
    return (ca.nickname ?? ca.name).localeCompare(cb.nickname ?? cb.name);
  });

  const filtered = collection.filter(c => {
    switch (filter) {
      case 'Creatures': return c.type === 'Creature';
      case 'Spells':    return c.type === 'Spell';
      case 'Family':    return c.el === 'family';
      case 'Work':      return c.el === 'work';
      case 'Animals':   return c.el === 'animals';
      case 'Travel':    return c.el === 'travel';
      case 'Food':      return c.el === 'food';
      case 'Education': return c.el === 'education';
      default:          return true;
    }
  });

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

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)',
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '52px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{activeDeck?.name ?? 'Deck'}</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            {deckUids.length} / {DECK_SIZE} cards
          </div>
        </div>
        {/* Layout toggle — same big / compact switch as Collection + Album. */}
        <button
          onClick={() => setLayout(l => l === 'big' ? 'compact' : 'big')}
          style={{ ...iconBtn, display: 'grid', placeItems: 'center' }}
          aria-label={layout === 'big' ? 'Compact view' : 'Big view'}
          title={layout === 'big' ? 'Compact view' : 'Big view'}
        >
          {layout === 'big' ? <LayoutGrid size={17} /> : <Rows3 size={17} />}
        </button>
      </div>

      {/* Deck switcher — horizontal pills, one per saved slot, plus a
          trailing "+" to create a new deck. Tap a pill to switch the
          active deck (the rest of the screen retargets to its uids). Tap
          the active pill again to open a small Manage modal where you can
          rename or delete it. */}
      <div style={{
        padding: '0 12px 8px',
        display: 'flex', gap: 6,
        overflowX: 'auto',
      }} className="no-scrollbar">
        {decks.map(d => {
          const active = d.id === activeDeckId;
          return (
            <button
              key={d.id}
              onClick={() => active ? setManaging(d.id) : onSetActive(d.id)}
              style={{
                padding: '8px 12px',
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
            padding: '8px 10px',
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

      {/* Deck-management modal — opens when the player taps the
          currently-active deck pill. Lets them rename or delete that
          slot. Renames close the modal automatically; delete asks for
          confirmation by hitting the button twice. */}
      {managing && (() => {
        const d = decks.find(x => x.id === managing);
        if (!d) { setManaging(null); return null; }
        const canDelete = decks.length > 1;
        return (
          <div
            onClick={() => setManaging(null)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,.55)', zIndex: 200,
              display: 'grid', placeItems: 'center',
              animation: 'fadeIn .2s',
            }}
          >
            <div
              onClick={(ev) => ev.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 18,
                padding: '20px 22px',
                width: '88%', maxWidth: 320,
                boxShadow: '0 18px 40px rgba(0,0,0,.4)',
                animation: 'cardSummon .3s cubic-bezier(.2,.8,.3,1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: PALETTE.text }}>Manage deck</div>
                <button onClick={() => setManaging(null)} style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'transparent', border: '1.5px solid rgba(58,46,42,.15)',
                  display: 'grid', placeItems: 'center',
                  cursor: 'pointer', color: PALETTE.text,
                }}>
                  <X size={14} strokeWidth={2.4} />
                </button>
              </div>
              <DeckRenameField
                key={d.id}
                initial={d.name}
                onCommit={(name) => { onRename(d.id, name); setManaging(null); }}
              />
              <button
                onClick={() => {
                  if (!canDelete) return;
                  onDelete(d.id);
                  setManaging(null);
                }}
                disabled={!canDelete}
                style={{
                  width: '100%', marginTop: 12,
                  padding: '11px 14px',
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
      })()}

      {/* Active deck strip */}
      <div style={{
        margin: '0 16px 16px',
        background: '#fff',
        border: `2px dashed ${PALETTE.accent}`,
        borderRadius: 14,
        padding: 12,
        minHeight: 90,
        boxShadow: '0 4px 10px rgba(58,46,42,.06)',
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: PALETTE.textMid, marginBottom: 8, fontWeight: 600 }}>
          Active Deck
        </div>
        {/* Active-deck strip — single horizontal scrollable row. Saves
            vertical space (was a 3-row grid that hogged half the screen)
            so the library below stays visible while you tweak the deck.
            Sorted creatures-first then spells, so swiping left → right
            takes you from green half to violet half. */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: 2,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Deck strip — uses AnimatePresence so toggling a card in or
              out of the deck plays a brief scale + fade transition
              instead of snapping. layout makes the remaining cards
              glide horizontally to fill the gap. */}
          <AnimatePresence initial={false}>
            {sortedDeckUids.map(uid => {
              const c = collection.find(x => x.uid === uid);
              if (!c) return null;
              return (
                <motion.div
                  key={uid}
                  layout
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  onClick={() => setInspectActive(c)}
                  style={{ cursor: 'pointer', position: 'relative', flex: '0 0 auto' }}
                >
                  <Card card={c} scale={0.32} />
                </motion.div>
              );
            })}
          </AnimatePresence>
          {deckUids.length === 0 && (
            <div style={{ fontSize: 12, color: PALETTE.textMid, fontStyle: 'italic' }}>
              Tap a summoned card below to add it.
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 20px 8px', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: PALETTE.textMid, fontWeight: 600 }}>
        Library · only summoned cards are playable
      </div>

      {/* Filter chips — icon-only with count, wraps to multiple rows on
          narrow phones so every filter stays visible without scrolling. */}
      <div style={{
        padding: '0 12px 10px',
        display: 'flex', flexWrap: 'wrap', gap: 5,
      }}>
        {FILTERS.map(f => {
          const count = countFor(f.id);
          const active = filter === f.id;
          const tint = active && f.themeId ? ELEMENTS[f.themeId].color : PALETTE.accent;
          const isAll = f.id === 'All';
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              disabled={count === 0 && !isAll}
              aria-label={f.label}
              title={f.label}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: isAll ? '5px 10px' : '5px 8px',
                borderRadius: 12,
                fontSize: 11, fontWeight: 700,
                background: active ? tint : '#fff',
                color: active ? '#fff' : (count === 0 && !isAll ? PALETTE.textMid : PALETTE.text),
                opacity: count === 0 && !isAll ? 0.45 : 1,
                border: active ? `1.5px solid ${tint}` : '1.5px solid rgba(58,46,42,.10)',
                cursor: count === 0 && !isAll ? 'default' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: active ? `0 2px 8px ${tint}55` : '0 2px 6px rgba(58,46,42,.06)',
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
              }}
            >
              {isAll
                ? <span style={{ fontSize: 11, letterSpacing: '0.06em' }}>ALL</span>
                : <span style={{ display: 'flex', alignItems: 'center' }}>{f.icon}</span>}
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: active ? 'rgba(255,255,255,.25)' : 'rgba(58,46,42,.08)',
                color: active ? '#fff' : PALETTE.textMid,
                padding: '1px 5px', borderRadius: 7,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Library grid — auto-fill so columns adapt to the viewport instead
          of forcing a fixed 4-col layout that ran off the right edge on
          narrow phones. Compact uses ~90px-min cards; big uses ~150px. */}
      <div style={{
        flex: 1, overflow: 'auto',
        padding: '0 16px 30px',
        display: 'grid',
        gridTemplateColumns: layout === 'compact'
          ? 'repeat(auto-fill, minmax(90px, 1fr))'
          : 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: layout === 'compact' ? 8 : 14,
        justifyItems: 'center',
        alignContent: 'start',
      }}>
        <AnimatePresence initial={false} mode="popLayout">
        {filtered.map(card => {
          const inDeck = deckUids.includes(card.uid);
          const playable = !!card.photo;
          return (
            <motion.div key={card.uid}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: playable ? 1 : 0.6, scale: inDeck ? 0.95 : 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 480, damping: 32 }}
              onClick={() => playable && toggle(card.uid)}
              style={{
                cursor: playable ? 'pointer' : 'not-allowed',
                position: 'relative',
              }}>
              <Card card={card} scale={layout === 'compact' ? 0.4 : 0.65} hovered={inDeck} />
              {inDeck && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  width: layout === 'compact' ? 22 : 30,
                  height: layout === 'compact' ? 22 : 30,
                  borderRadius: '50%',
                  background: PALETTE.accent, color: '#fff',
                  display: 'grid', placeItems: 'center',
                  boxShadow: '0 0 0 3px #fef3e8, 0 4px 8px rgba(255,126,95,.4)',
                }}>
                  <Check size={layout === 'compact' ? 13 : 18} strokeWidth={3.5} />
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
                  {layout === 'compact' ? '' : ' Dormant'}
                </div>
              )}
            </motion.div>
          );
        })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.5, padding: 40, fontSize: 13 }}>
            {collection.length === 0 ? 'Open a pack to start building.' : 'Nothing matches this filter.'}
          </div>
        )}
      </div>

      {/* Active-deck preview modal — tap any chip in the active deck strip
          to see the full card and pull it out of the deck (or just close
          the preview). Reads-only otherwise. */}
      {inspectActive && (
        <div
          onClick={() => setInspectActive(null)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(8,4,12,.7)',
            display: 'grid', placeItems: 'center',
            zIndex: 220,
            animation: 'fadeIn .2s',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 14,
              animation: 'cardSummon 0.3s cubic-bezier(.2,.8,.3,1)',
            }}
          >
            <Card card={inspectActive} hovered scale={1.0} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setInspectActive(null)}
                style={{
                  background: '#fff', color: PALETTE.text,
                  border: `1.5px solid ${PALETTE.border}`,
                  borderRadius: 18, padding: '10px 18px',
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 10px rgba(58,46,42,.15)',
                }}
              >Close</button>
              <button
                onClick={() => {
                  toggle(inspectActive.uid);
                  setInspectActive(null);
                }}
                style={{
                  background: 'linear-gradient(180deg, #ee5a52, #c8362e)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 18, padding: '10px 22px',
                  fontSize: 13, fontWeight: 800,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 14px rgba(200,54,46,.4)',
                }}
              >Remove from deck</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Rename input + Save button used inside the manage-deck modal. Local
 * state so typing doesn't fire a save on every keystroke; commits on
 * Save click or Enter.
 */
function DeckRenameField({ initial, onCommit }: { initial: string; onCommit: (name: string) => void }) {
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

