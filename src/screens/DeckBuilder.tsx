import { useState } from 'react';
import { ArrowLeft, Check, Lock, LayoutGrid, Rows3, Heart, Briefcase, PawPrint, Plane, Swords, Sparkles } from 'lucide-react';
import { Card } from '../components/Card';
import { ELEMENTS, TYPE_PALETTE } from '../data/elements';
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {deckUids.map(uid => {
            const c = collection.find(x => x.uid === uid);
            if (!c) return null;
            return <DeckChip key={uid} card={c} onRemove={() => toggle(uid)} />;
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

      {/* Filter chips — same set as Collection so the player can scan their
          library by theme or by type when picking the 12 deck slots. */}
      <div style={{
        padding: '0 16px 10px',
        display: 'flex', flexWrap: 'wrap', gap: 6,
      }}>
        {FILTERS.map(f => {
          const count = countFor(f.id);
          const active = filter === f.id;
          const tint = active && f.themeId ? ELEMENTS[f.themeId].color : PALETTE.accent;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              disabled={count === 0 && f.id !== 'All'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 9px',
                borderRadius: 12,
                fontSize: 11, fontWeight: 700,
                background: active ? tint : '#fff',
                color: active ? '#fff' : (count === 0 && f.id !== 'All' ? PALETTE.textMid : PALETTE.text),
                opacity: count === 0 && f.id !== 'All' ? 0.45 : 1,
                border: active ? `1.5px solid ${tint}` : '1.5px solid rgba(58,46,42,.10)',
                cursor: count === 0 && f.id !== 'All' ? 'default' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: active ? `0 2px 8px ${tint}55` : '0 2px 6px rgba(58,46,42,.06)',
                whiteSpace: 'nowrap',
              }}
            >
              {f.icon}
              <span>{f.label}</span>
              <span style={{ opacity: 0.7, fontWeight: 600 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Library grid */}
      <div style={{
        flex: 1, overflow: 'auto',
        padding: '0 16px 30px',
        display: 'grid',
        gridTemplateColumns: layout === 'compact' ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
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
    </div>
  );
}

function DeckChip({ card, onRemove }: { card: CollectionCard; onRemove: () => void }) {
  // Active-deck chips are tinted by TYPE rather than theme so the player
  // can see at a glance how creature- vs spell-heavy their deck is.
  // Green = creature, violet = spell — same palette the actual cards use.
  const tp = TYPE_PALETTE[card.type === 'Spell' ? 'Spell' : 'Creature'];
  const e = ELEMENTS[card.el];
  return (
    <div onClick={onRemove} style={{
      width: 50, height: 68,
      borderRadius: 8,
      background: card.photo ? `url(${card.photo}) center/cover, ${tp.top}` : tp.top,
      boxShadow: `inset 0 0 0 2px ${tp.deep}, 0 2px 6px rgba(0,0,0,.3)`,
      position: 'relative',
      cursor: 'pointer',
      flex: '0 0 auto',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: 2,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fef4d8', color: tp.deep,
        fontSize: 9, fontWeight: 700,
        display: 'grid', placeItems: 'center',
      }}>{card.cost}</div>
      {/* Tiny element glyph in the top-right so the theme is still
          identifiable (Family / Work / Animals / Travel) — type drives the
          big color, theme drives this little corner pip. */}
      <div style={{
        position: 'absolute', top: 2, right: 2,
        width: 10, height: 10, borderRadius: '50%',
        background: e.color,
        boxShadow: '0 0 0 1px rgba(0,0,0,.2)',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: `linear-gradient(0deg, ${tp.deep}ee, transparent)`,
        padding: '8px 3px 3px',
        fontSize: 7, fontWeight: 700,
        color: '#fff', textAlign: 'center',
        textShadow: '0 1px 0 #000',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{card.nickname || card.name}</div>
    </div>
  );
}
