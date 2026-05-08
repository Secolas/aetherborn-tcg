import { useState } from 'react';
import { ArrowLeft, Heart, Briefcase, PawPrint, Swords, Sparkles, Lock } from 'lucide-react';
import { Card } from '../components/Card';
import { iconBtn, PALETTE } from '../components/styles';
import { ELEMENTS } from '../data/elements';
import type { CollectionCard, ElementId } from '../game/types';

type Filter =
  | 'All'
  | 'Family' | 'Work' | 'Animals'
  | 'Creatures' | 'Spells'
  | 'Dormant';

const FILTERS: { id: Filter; label: string; icon: React.ReactNode; tone?: 'theme' | 'type' | 'state'; themeId?: ElementId }[] = [
  { id: 'All',       label: 'All',       icon: null },
  { id: 'Family',    label: 'Family',    icon: <Heart     size={13} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'family' },
  { id: 'Work',      label: 'Work',      icon: <Briefcase size={13} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'work' },
  { id: 'Animals',   label: 'Animals',   icon: <PawPrint  size={13} fill="currentColor" strokeWidth={2.4} />, tone: 'theme', themeId: 'animals' },
  { id: 'Creatures', label: 'Creatures', icon: <Swords    size={13} strokeWidth={2.4} />, tone: 'type' },
  { id: 'Spells',    label: 'Spells',    icon: <Sparkles  size={13} strokeWidth={2.4} />, tone: 'type' },
  { id: 'Dormant',   label: 'Dormant',   icon: <Lock      size={13} strokeWidth={2.4} />, tone: 'state' },
];

interface Props {
  collection: CollectionCard[];
  onCapture: (card: CollectionCard) => void;
  onBack: () => void;
}

export function Collection({ collection, onCapture, onBack }: Props) {
  const [filter, setFilter] = useState<Filter>('All');
  const summoned = collection.filter(c => c.photo).length;
  const total = collection.length;

  const filtered = collection.filter(c => {
    switch (filter) {
      case 'Creatures': return c.type === 'Creature';
      case 'Spells':    return c.type === 'Spell';
      case 'Dormant':   return !c.photo;
      case 'Family':    return c.el === 'family';
      case 'Work':      return c.el === 'work';
      case 'Animals':   return c.el === 'animals';
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
          </div>
        </div>
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

      <div className="no-scrollbar" style={{ padding: '4px 16px 12px', display: 'flex', gap: 6, overflow: 'auto' }}>
        {FILTERS.map(f => {
          const active = f.id === filter;
          const count = countFor(f.id);
          const bg = active
            ? (f.themeId ? ELEMENTS[f.themeId].color : PALETTE.accent)
            : '#fff';
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              disabled={count === 0 && f.id !== 'All'}
              style={{
                padding: '7px 12px', borderRadius: 14,
                background: bg,
                color: active ? '#fff' : PALETTE.text,
                fontSize: 12, fontWeight: 600,
                border: active ? 'none' : `1.5px solid ${PALETTE.border}`,
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
                cursor: count === 0 && f.id !== 'All' ? 'default' : 'pointer',
                fontFamily: 'inherit',
                opacity: count === 0 && f.id !== 'All' ? 0.45 : 1,
                boxShadow: active
                  ? '0 4px 10px rgba(255,126,95,.35)'
                  : '0 2px 4px rgba(58,46,42,.06)',
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {f.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{f.icon}</span>}
              <span>{f.label}</span>
              {f.id !== 'All' && count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: active ? 'rgba(255,255,255,.25)' : 'rgba(58,46,42,.08)',
                  color: active ? '#fff' : PALETTE.textMid,
                  padding: '1px 6px', borderRadius: 8,
                  marginLeft: 1,
                }}>{count}</span>
              )}
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
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 18,
            justifyItems: 'center',
            alignContent: 'start',
          }}>
            {filtered.map(card => (
              <div key={card.uid}
                onClick={() => !card.photo && onCapture(card)}
                style={{ cursor: card.photo ? 'default' : 'pointer', position: 'relative' }}
              >
                <Card card={card} scale={0.7} />
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
