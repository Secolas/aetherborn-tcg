import { useState } from 'react';
import { ArrowLeft, Check, Lock, LayoutGrid, Rows3 } from 'lucide-react';
import { Card } from '../components/Card';
import { ELEMENTS } from '../data/elements';
import { iconBtn, PALETTE } from '../components/styles';
import type { CollectionCard } from '../game/types';

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
  /** Big = 2-column for full card detail; Compact = 4-column smaller cards
      so you can scan a large library when picking your deck. */
  const [layout, setLayout] = useState<'big' | 'compact'>('big');
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
        {collection.map(card => {
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
        {collection.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.5, padding: 40, fontSize: 13 }}>
            Open a pack to start building.
          </div>
        )}
      </div>
    </div>
  );
}

function DeckChip({ card, onRemove }: { card: CollectionCard; onRemove: () => void }) {
  const e = ELEMENTS[card.el];
  return (
    <div onClick={onRemove} style={{
      width: 50, height: 68,
      borderRadius: 8,
      background: card.photo ? `url(${card.photo}) center/cover, ${e.color}` : e.color,
      boxShadow: `inset 0 0 0 1.5px ${e.glow}, 0 2px 6px rgba(0,0,0,.3)`,
      position: 'relative',
      cursor: 'pointer',
      flex: '0 0 auto',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: 2,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fef4d8', color: e.deep,
        fontSize: 9, fontWeight: 700,
        display: 'grid', placeItems: 'center',
      }}>{card.cost}</div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: `linear-gradient(0deg, ${e.deep}ee, transparent)`,
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
