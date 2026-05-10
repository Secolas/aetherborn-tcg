import { useState } from 'react';
import { ArrowLeft, Heart, Briefcase, PawPrint, Plane, Swords, Sparkles, Lock, Camera, Trash2, X, LayoutGrid, Rows3 } from 'lucide-react';
import { Card } from '../components/Card';
import { iconBtn, PALETTE } from '../components/styles';
import { ELEMENTS } from '../data/elements';
import type { CollectionCard, ElementId } from '../game/types';

type Filter =
  | 'All'
  | 'Family' | 'Work' | 'Animals' | 'Travel'
  | 'Creatures' | 'Spells'
  | 'Dormant';

const FILTERS: { id: Filter; label: string; icon: React.ReactNode; tone?: 'theme' | 'type' | 'state'; themeId?: ElementId }[] = [
  { id: 'All',       label: 'All',       icon: null },
  { id: 'Family',    label: 'Family',    icon: <Heart     size={13} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'family' },
  { id: 'Work',      label: 'Work',      icon: <Briefcase size={13} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'work' },
  { id: 'Animals',   label: 'Animals',   icon: <PawPrint  size={13} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'animals' },
  { id: 'Travel',    label: 'Travel',    icon: <Plane     size={13} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'travel' },
  { id: 'Creatures', label: 'Creatures', icon: <Swords    size={13} strokeWidth={2.4} />, tone: 'type' },
  { id: 'Spells',    label: 'Spells',    icon: <Sparkles  size={13} strokeWidth={2.4} />, tone: 'type' },
  { id: 'Dormant',   label: 'Dormant',   icon: <Lock      size={13} strokeWidth={2.4} />, tone: 'state' },
];

interface Props {
  collection: CollectionCard[];
  onCapture: (card: CollectionCard) => void;
  onClearPhoto: (uid: string) => void;
  onQuickFill: () => void;
  onBack: () => void;
}

export function Collection({ collection, onCapture, onClearPhoto, onQuickFill, onBack }: Props) {
  const [filter, setFilter] = useState<Filter>('All');
  const [actionFor, setActionFor] = useState<CollectionCard | null>(null);
  /** Card opened for read-only preview — tapped a real-photo card. The
   *  modal shows the full card at readable scale so the player can re-read
   *  ability text or just admire the photo. Separate from `actionFor`
   *  which is the placeholder-only "replace / discard" menu. */
  const [preview, setPreview] = useState<CollectionCard | null>(null);
  /** Compact = 4-column tighter cards (default — fits ~2x more on screen);
      Big = 2-column with full card detail when you need to read abilities. */
  const [layout, setLayout] = useState<'big' | 'compact'>('compact');
  const summoned = collection.filter(c => c.photo).length;
  const total = collection.length;

  const dormantCount = collection.filter(c => !c.photo).length;
  const placeholderCount = collection.filter(c => c.isPlaceholder).length;

  const filtered = collection.filter(c => {
    switch (filter) {
      case 'Creatures': return c.type === 'Creature';
      case 'Spells':    return c.type === 'Spell';
      case 'Dormant':   return !c.photo;
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
      case 'Dormant':   return collection.filter(c => !c.photo).length;
      case 'Family':    return collection.filter(c => c.el === 'family').length;
      case 'Work':      return collection.filter(c => c.el === 'work').length;
      case 'Animals':   return collection.filter(c => c.el === 'animals').length;
      case 'Travel':    return collection.filter(c => c.el === 'travel').length;
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
          <div style={{ fontSize: 20, fontWeight: 700 }}>Collection</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            {summoned} summoned · {total - summoned} dormant
            {placeholderCount > 0 && ` · ${placeholderCount} placeholder`}
          </div>
        </div>
        {/* Layout toggle — switch between the default 2-column big-card view
            and a 4-column compact view that fits twice as many cards on
            screen for browsing a large collection. */}
        <button
          onClick={() => setLayout(l => l === 'big' ? 'compact' : 'big')}
          style={{
            ...iconBtn,
            display: 'grid', placeItems: 'center',
          }}
          aria-label={layout === 'big' ? 'Compact view' : 'Big view'}
          title={layout === 'big' ? 'Compact view' : 'Big view'}
        >
          {layout === 'big' ? <LayoutGrid size={17} /> : <Rows3 size={17} />}
        </button>
        {dormantCount > 0 && (
          <button
            onClick={onQuickFill}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#fff',
              color: PALETTE.accentDeep,
              border: `1.5px dashed ${PALETTE.accent}`,
              borderRadius: 14,
              padding: '6px 11px',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 6px rgba(58,46,42,.06)',
              whiteSpace: 'nowrap',
            }}
            title="Fill all dormant cards with placeholder photos"
          >
            <Sparkles size={13} strokeWidth={2.4} />
            Fill all
          </button>
        )}
      </div>

      <div style={{ padding: '0 20px 12px' }}>
        <div style={{
          height: 8, borderRadius: 4,
          background: 'rgba(58,46,42,.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: total > 0 ? `${(summoned / total) * 100}%` : '0%',
            height: '100%',
            background: 'linear-gradient(90deg, #ffa07a, #ee5a52)',
            transition: 'width .4s',
            boxShadow: '0 0 8px rgba(238,90,82,.45)',
          }} />
        </div>
      </div>

      {/* Filter chips — icon-only with count badge. Wraps to two rows on
          a narrow phone instead of horizontal-scrolling, so every filter
          stays visible without swiping. */}
      <div style={{
        padding: '4px 12px 12px',
        display: 'flex', flexWrap: 'wrap', gap: 5,
      }}>
        {FILTERS.map(f => {
          const active = f.id === filter;
          const count = countFor(f.id);
          const bg = active
            ? (f.themeId ? ELEMENTS[f.themeId].color : PALETTE.accent)
            : '#fff';
          const isAll = f.id === 'All';
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              disabled={count === 0 && !isAll}
              aria-label={f.label}
              title={f.label}
              style={{
                padding: isAll ? '6px 10px' : '6px 8px',
                borderRadius: 12,
                background: bg,
                color: active ? '#fff' : PALETTE.text,
                fontSize: 12, fontWeight: 700,
                border: active ? 'none' : `1.5px solid ${PALETTE.border}`,
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
                cursor: count === 0 && !isAll ? 'default' : 'pointer',
                fontFamily: 'inherit',
                opacity: count === 0 && !isAll ? 0.45 : 1,
                boxShadow: active
                  ? '0 4px 10px rgba(255,126,95,.35)'
                  : '0 2px 4px rgba(58,46,42,.06)',
                transition: 'all .15s',
                display: 'inline-flex', alignItems: 'center', gap: 4,
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

      <div style={{
        flex: 1, overflow: 'auto',
        padding: '0 16px 30px',
      }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: PALETTE.textMid, padding: 40, fontSize: 13 }}>
            {collection.length === 0
              ? 'Empty collection. Open a pack to get your first cards.'
              : 'Nothing matches this filter.'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: layout === 'compact'
              ? 'repeat(auto-fill, minmax(90px, 1fr))'
              : 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: layout === 'compact' ? 8 : 18,
            justifyItems: 'center',
            alignContent: 'start',
          }}>
            {filtered.map(card => {
              return (
                <div key={card.uid}
                  onClick={() => {
                    // Dormant card → go capture a photo
                    if (!card.photo) onCapture(card);
                    // Placeholder photo → small action menu to retake / clear
                    else if (card.isPlaceholder) setActionFor(card);
                    // Real photo → just preview the card so the player can
                    // read ability text or look at the full art.
                    else setPreview(card);
                  }}
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  <Card card={card} scale={layout === 'compact' ? 0.4 : 0.7} />
                  {!card.photo && (
                    <div style={{
                      position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
                      fontSize: 10, fontWeight: 700,
                      color: '#fff',
                      background: PALETTE.accent,
                      padding: '4px 10px', borderRadius: 10,
                      boxShadow: '0 4px 10px rgba(255,126,95,.4)',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                    }}>tap to summon</div>
                  )}
                  {card.isPlaceholder && (
                    <div style={{
                      position: 'absolute', top: 4, right: 4,
                      fontSize: 9, fontWeight: 700,
                      color: '#fff',
                      background: 'rgba(58,46,42,.85)',
                      padding: '3px 7px', borderRadius: 8,
                      letterSpacing: '0.05em',
                      display: 'flex', alignItems: 'center', gap: 3,
                      boxShadow: '0 2px 6px rgba(0,0,0,.25)',
                      pointerEvents: 'none',
                    }}>
                      <Sparkles size={10} strokeWidth={2.4} />
                      placeholder
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Read-only preview — opens when the player taps a real-photo
          card in the grid. Just a centered Card at readable scale; tap
          anywhere outside (or the card itself) to dismiss. */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(58, 46, 42, .65)',
            display: 'grid', placeItems: 'center',
            zIndex: 200,
            animation: 'fadeIn .2s',
          }}
        >
          <div style={{ animation: 'cardSummon 0.35s cubic-bezier(.2,.8,.3,1)' }}>
            <Card card={preview} hovered scale={1.1} />
          </div>
          <div style={{
            position: 'absolute', bottom: 50, left: 0, right: 0,
            textAlign: 'center', fontSize: 11, color: '#fff', opacity: 0.85,
            fontStyle: 'italic',
          }}>
            tap anywhere to close
          </div>
        </div>
      )}

      {actionFor && (
        <div
          onClick={() => setActionFor(null)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(58,46,42,.55)',
            display: 'flex', alignItems: 'flex-end',
            zIndex: 200,
            animation: 'fadeIn .2s',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', background: '#fff',
              borderRadius: '20px 20px 0 0',
              padding: '18px 18px 28px',
              boxShadow: '0 -4px 20px rgba(0,0,0,.15)',
              animation: 'slideUp .25s cubic-bezier(.2,.8,.3,1)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: PALETTE.text, marginBottom: 2 }}>
              {actionFor.nickname || actionFor.name}
            </div>
            <div style={{ fontSize: 11, color: PALETTE.textMid, marginBottom: 16 }}>
              This card has a placeholder photo
            </div>
            <button
              onClick={() => { onCapture(actionFor); setActionFor(null); }}
              style={{
                width: '100%', padding: '14px 16px',
                background: PALETTE.accent, color: '#fff',
                border: 'none', borderRadius: 14,
                fontSize: 14, fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(255,126,95,.35)',
                marginBottom: 8,
              }}
            >
              <Camera size={18} strokeWidth={2.4} />
              Take my own photo
            </button>
            <button
              onClick={() => { onClearPhoto(actionFor.uid); setActionFor(null); }}
              style={{
                width: '100%', padding: '12px 16px',
                background: '#fff', color: PALETTE.text,
                border: `1.5px solid ${PALETTE.border}`,
                borderRadius: 14,
                fontSize: 13, fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 8,
              }}
            >
              <Trash2 size={16} strokeWidth={2.2} />
              Clear photo (return to dormant)
            </button>
            <button
              onClick={() => setActionFor(null)}
              style={{
                width: '100%', padding: '10px 16px',
                background: 'transparent', color: PALETTE.textMid,
                border: 'none',
                fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
