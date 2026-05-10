import { useState } from 'react';
import { ArrowLeft, Check, Lock, LayoutGrid, Rows3, Heart, Briefcase, PawPrint, Plane, Swords, Sparkles } from 'lucide-react';
import { Card } from '../components/Card';
import { ELEMENTS } from '../data/elements';
import { iconBtn, PALETTE } from '../components/styles';
import type { CollectionCard, ElementId } from '../game/types';

type Filter =
  | 'All'
  | 'Family' | 'Work' | 'Animals' | 'Travel'
  | 'Creatures' | 'Spells';

const FILTERS: { id: Filter; label: string; icon: React.ReactNode; tone?: 'theme' | 'type'; themeId?: ElementId }[] = [
  { id: 'All',       label: 'All',       icon: null },
  { id: 'Family',    label: 'Family',    icon: <Heart     size={11} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'family' },
  { id: 'Work',      label: 'Work',      icon: <Briefcase size={11} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'work' },
  { id: 'Animals',   label: 'Animals',   icon: <PawPrint  size={11} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'animals' },
  { id: 'Travel',    label: 'Travel',    icon: <Plane     size={11} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'travel' },
  { id: 'Creatures', label: 'Creatures', icon: <Swords    size={11} strokeWidth={2.4} />, tone: 'type' },
  { id: 'Spells',    label: 'Spells',    icon: <Sparkles  size={11} strokeWidth={2.4} />, tone: 'type' },
];

// Matches the boss deck size in data/bosses.ts so player and opponent always
// start with the same number of cards.
const DECK_SIZE = 12;

interface Props {
  collection: CollectionCard[];
  deckUids: string[];
  onChange: (uids: string[]) => void;
  onBack: () => void;
}

export function DeckBuilder({ collection, deckUids, onChange, onBack }: Props) {
  /** Compact = 4-column smaller cards (default — scans a large library
      faster when picking the 12 deck slots); Big = 2-column for detail. */
  const [layout, setLayout] = useState<'big' | 'compact'>('compact');
  const [filter, setFilter] = useState<Filter>('All');
  /** Card opened from the Active Deck strip — shows preview + Remove button. */
  const [inspectActive, setInspectActive] = useState<CollectionCard | null>(null);

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
    }
  };

  const toggle = (uid: string) => {
    if (deckUids.includes(uid)) {
      onChange(deckUids.filter(x => x !== uid));
    } else if (deckUids.length < DECK_SIZE) {
      onChange([...deckUids, uid]);
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
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Deck</div>
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
          {sortedDeckUids.map(uid => {
            const c = collection.find(x => x.uid === uid);
            if (!c) return null;
            return (
              <div
                key={uid}
                onClick={() => setInspectActive(c)}
                style={{ cursor: 'pointer', position: 'relative', flex: '0 0 auto' }}
              >
                <Card card={c} scale={0.32} />
              </div>
            );
          })}
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
        {filtered.map(card => {
          const inDeck = deckUids.includes(card.uid);
          const playable = !!card.photo;
          return (
            <div key={card.uid}
              onClick={() => playable && toggle(card.uid)}
              style={{
                cursor: playable ? 'pointer' : 'not-allowed',
                position: 'relative',
                opacity: playable ? 1 : 0.6,
                transform: inDeck ? 'scale(0.95)' : 'scale(1)',
                transition: 'transform .15s',
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
            </div>
          );
        })}
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

