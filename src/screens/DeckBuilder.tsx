import { Card } from '../components/Card';
import { ELEMENTS } from '../data/elements';
import { iconBtn } from '../components/styles';
import type { CollectionCard } from '../game/types';

const DECK_SIZE = 8;

interface Props {
  collection: CollectionCard[];
  deckUids: string[];
  onChange: (uids: string[]) => void;
  onBack: () => void;
}

export function DeckBuilder({ collection, deckUids, onChange, onBack }: Props) {
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
      background: 'linear-gradient(180deg, #161a2e 0%, #0a0c1c 100%)',
      color: '#fff', fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: '"Cinzel", Georgia, serif' }}>Deck</div>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.6, marginTop: 2 }}>
            {deckUids.length} / {DECK_SIZE} cards
          </div>
        </div>
      </div>

      {/* Active deck strip */}
      <div style={{
        margin: '0 16px 16px',
        background: 'rgba(255,255,255,.04)',
        border: '1px dashed rgba(255,255,255,.15)',
        borderRadius: 12,
        padding: 12,
        minHeight: 90,
      }}>
        <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 8 }}>
          Active Deck
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {deckUids.map(uid => {
            const c = collection.find(x => x.uid === uid);
            if (!c) return null;
            return <DeckChip key={uid} card={c} onRemove={() => toggle(uid)} />;
          })}
          {deckUids.length === 0 && (
            <div style={{ fontSize: 11, opacity: 0.5, fontStyle: 'italic' }}>
              Tap a summoned card below to add it.
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 20px 8px', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.5 }}>
        Library · only summoned cards are playable
      </div>

      {/* Library grid */}
      <div style={{
        flex: 1, overflow: 'auto',
        padding: '0 16px 30px',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 14,
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
              <Card card={card} scale={0.65} hovered={inDeck} />
              {inDeck && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#f4d04a', color: '#3a2a0e',
                  display: 'grid', placeItems: 'center',
                  fontSize: 16, fontWeight: 800,
                  boxShadow: '0 0 0 3px #161a2e',
                }}>✓</div>
              )}
              {!playable && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'grid', placeItems: 'center',
                  background: 'rgba(10,12,28,.6)',
                  borderRadius: 12,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: '#f4d04a',
                }}>🔒 Dormant</div>
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
