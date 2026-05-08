import { useState } from 'react';
import { Card } from '../components/Card';
import { ELEMENTS } from '../data/elements';
import { iconBtn, PALETTE } from '../components/styles';
import type { CollectionCard } from '../game/types';

interface Props {
  collection: CollectionCard[];
  onBack: () => void;
}

/**
 * "Life Album" — every card you've summoned with a photo, displayed like
 * a scrapbook of your own life. Tap any entry to inspect the full card.
 */
export function Album({ collection, onBack }: Props) {
  const summoned = collection.filter(c => c.photo);
  const [inspect, setInspect] = useState<CollectionCard | null>(null);

  // Group by theme so the gallery has rhythm
  const byTheme = (themeId: 'family' | 'work' | 'animals') =>
    summoned.filter(c => c.el === themeId);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
        linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)
      `,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '52px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Life Album</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            {summoned.length === 0
              ? 'You haven’t summoned anything yet'
              : `${summoned.length} memory${summoned.length === 1 ? '' : 'ies'} captured`}
          </div>
        </div>
      </div>

      <div style={{
        flex: 1, padding: '8px 16px 24px',
        overflowY: 'auto',
      }} className="no-scrollbar">
        {summoned.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ThemeSection title="Family"  cards={byTheme('family')}  onTap={setInspect} />
            <ThemeSection title="Work"    cards={byTheme('work')}    onTap={setInspect} />
            <ThemeSection title="Animals" cards={byTheme('animals')} onTap={setInspect} />
          </>
        )}
      </div>

      {inspect && (
        <div
          onClick={() => setInspect(null)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(58, 46, 42, .65)',
            display: 'grid', placeItems: 'center',
            zIndex: 200,
            animation: 'fadeIn .2s',
          }}
        >
          <div style={{ animation: 'cardSummon 0.4s cubic-bezier(.2,.8,.3,1)' }}>
            <Card card={inspect} hovered scale={1.1} />
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
    </div>
  );
}

function ThemeSection({
  title, cards, onTap,
}: {
  title: string;
  cards: CollectionCard[];
  onTap: (c: CollectionCard) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: PALETTE.textMid,
        letterSpacing: '0.15em', textTransform: 'uppercase',
        marginBottom: 10, paddingLeft: 4,
      }}>
        {title} · {cards.length}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
      }}>
        {cards.map((c, i) => (
          <PolaroidEntry key={c.uid} card={c} idx={i} onClick={() => onTap(c)} />
        ))}
      </div>
    </div>
  );
}

function PolaroidEntry({
  card, idx, onClick,
}: {
  card: CollectionCard;
  idx: number;
  onClick: () => void;
}) {
  const e = ELEMENTS[card.el];
  const tilt = (idx % 2 === 0 ? -1.2 : 1.2);
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '8px 8px 12px',
        boxShadow: '0 6px 14px rgba(58, 46, 42, .15), 0 1px 0 rgba(58, 46, 42, .06)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transform: `rotate(${tilt}deg)`,
        transition: 'transform .15s',
      }}
      onPointerDown={(ev) => { (ev.currentTarget as HTMLElement).style.transform = `rotate(${tilt}deg) scale(0.97)`; }}
      onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = `rotate(${tilt}deg) scale(1)`; }}
      onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = `rotate(${tilt}deg) scale(1)`; }}
    >
      <div style={{
        width: '100%', aspectRatio: '1 / 1',
        borderRadius: 3, overflow: 'hidden',
        background: e.deep,
        position: 'relative',
      }}>
        {card.photo && (
          <img src={card.photo} alt={card.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{
          position: 'absolute', top: 6, left: 6,
          background: e.color, color: '#fff',
          fontSize: 9, fontWeight: 700,
          padding: '2px 6px', borderRadius: 8,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{e.name}</div>
      </div>
      <div style={{
        marginTop: 8, paddingLeft: 2,
        fontSize: 13, fontWeight: 600, color: PALETTE.text,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {card.nickname || card.name}
      </div>
      {card.nickname && (
        <div style={{
          fontSize: 10, color: PALETTE.textMid, marginTop: 1,
          paddingLeft: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {card.name}
        </div>
      )}
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{
      marginTop: 60, textAlign: 'center', padding: '40px 30px',
      background: '#fff', borderRadius: 18,
      boxShadow: '0 6px 14px rgba(58, 46, 42, .08)',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, marginBottom: 6 }}>
        Your album is empty
      </div>
      <div style={{ fontSize: 12, color: PALETTE.textMid, lineHeight: 1.5 }}>
        Open a pack, then summon your dormant cards by taking photos. Each photo becomes a piece of your album.
      </div>
    </div>
  );
}
