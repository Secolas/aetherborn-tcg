import { useState } from 'react';
import { Card } from '../components/Card';
import { iconBtn, PALETTE } from '../components/styles';
import type { CollectionCard } from '../game/types';

type Filter = 'All' | 'Creatures' | 'Spells' | 'Dormant';

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
    if (filter === 'Creatures') return c.type === 'Creature';
    if (filter === 'Spells')    return c.type === 'Spell';
    if (filter === 'Dormant')   return !c.photo;
    return true;
  });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)',
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}>←</button>
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

      <div className="no-scrollbar" style={{ padding: '4px 20px 12px', display: 'flex', gap: 6, overflow: 'auto' }}>
        {(['All', 'Creatures', 'Spells', 'Dormant'] as Filter[]).map(f => {
          const active = f === filter;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '7px 14px', borderRadius: 14,
              background: active ? PALETTE.accent : '#fff',
              color: active ? '#fff' : PALETTE.text,
              fontSize: 12, fontWeight: 600,
              border: active ? 'none' : `1.5px solid ${PALETTE.border}`,
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: active
                ? '0 4px 10px rgba(255,126,95,.35)'
                : '0 2px 4px rgba(58,46,42,.06)',
              transition: 'all .15s',
            }}>{f}</button>
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
