import { useState } from 'react';
import { Card } from '../components/Card';
import { iconBtn } from '../components/styles';
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
      background: 'linear-gradient(180deg, #161a2e 0%, #0a0c1c 100%)',
      color: '#fff', fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: '"Cinzel", Georgia, serif' }}>Collection</div>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.6, marginTop: 2 }}>
            {summoned} summoned · {total - summoned} dormant
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 12px' }}>
        <div style={{
          height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: total > 0 ? `${(summoned / total) * 100}%` : '0%',
            height: '100%',
            background: 'linear-gradient(90deg, #f4d04a, #c4801a)',
            transition: 'width .4s',
          }} />
        </div>
      </div>

      <div className="no-scrollbar" style={{ padding: '4px 20px 16px', display: 'flex', gap: 6, overflow: 'auto' }}>
        {(['All', 'Creatures', 'Spells', 'Dormant'] as Filter[]).map(f => {
          const active = f === filter;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', borderRadius: 12,
              background: active ? 'rgba(244,208,74,.18)' : 'rgba(255,255,255,.06)',
              color: active ? '#f4d04a' : '#fff',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
              border: active ? '1px solid rgba(244,208,74,.4)' : '1px solid rgba(255,255,255,.08)',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
              cursor: 'pointer',
            }}>{f}</button>
          );
        })}
      </div>

      <div style={{
        flex: 1, overflow: 'auto',
        padding: '0 16px 30px',
      }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', opacity: 0.5, padding: 40, fontSize: 13 }}>
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
                    position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center',
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: '#f4d04a',
                    pointerEvents: 'none',
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
