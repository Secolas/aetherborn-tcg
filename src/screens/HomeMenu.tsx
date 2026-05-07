import { Card } from '../components/Card';
import { btnPrimary, btnSecondary } from '../components/styles';
import { TEMPLATES } from '../data/templates';
import type { SaveData } from '../game/types';

interface Props {
  save: SaveData;
  onNav: (screen: 'collection' | 'pack' | 'deck' | 'match') => void;
}

export function HomeMenu({ save, onNav }: Props) {
  // Featured cards: an alive one (if any) and a dormant template for contrast.
  const summoned = save.collection.find(c => c.photo);
  const dormant = TEMPLATES.find(t => t.rarity === 'legendary')!;
  const playableInDeck = save.deckUids.filter(uid => {
    const c = save.collection.find(x => x.uid === uid);
    return c && c.photo;
  }).length;
  const canMatch = playableInDeck >= 4;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, #1a2348 0%, #0a0e22 60%, #050816 100%)',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"Inter", system-ui, sans-serif',
      color: '#fff',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Stars */}
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.6, width: '100%', height: '100%' }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <circle key={i}
            cx={`${(i * 37) % 100}%`}
            cy={`${(i * 53) % 100}%`}
            r={i % 4 === 0 ? 1.2 : 0.6}
            fill="#fff"
            opacity={((i * 7) % 10) / 10 * 0.6 + 0.3}
          />
        ))}
      </svg>

      {/* Top status */}
      <div style={{
        paddingTop: 'max(56px, env(safe-area-inset-top, 56px))', paddingLeft: 20, paddingRight: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'relative', zIndex: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #e8633a, #7a2a13)',
            display: 'grid', placeItems: 'center',
            fontSize: 16, fontWeight: 700,
            border: '2px solid #f4d04a',
          }}>K</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Keldra</div>
            <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6 }}>
              {save.matchesWon} W · {save.matchesLost} L
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(244,208,74,.15)',
          padding: '5px 10px', borderRadius: 14,
          border: '1px solid rgba(244,208,74,.3)',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f4d04a' }} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>{save.coins}</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginTop: 24, position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase', opacity: 0.5, fontFamily: '"Cinzel", Georgia, serif' }}>
          Realm of
        </div>
        <div style={{
          fontSize: 44, fontWeight: 700, lineHeight: 1,
          fontFamily: '"Cinzel", Georgia, serif',
          background: 'linear-gradient(180deg, #f4d04a, #c4801a)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 30px rgba(244,208,74,.3)',
          marginTop: 4,
        }}>AETHER<br />BORN</div>
        <div style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', opacity: 0.55, marginTop: 8, fontStyle: 'italic' }}>
          your world. summoned.
        </div>
      </div>

      {/* Card preview area */}
      <div style={{
        position: 'relative', flex: 1, minHeight: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 8,
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          ['--r' as string]: '-9deg', ['--x' as string]: '-60px', ['--s' as string]: '0.7',
          transform: 'translate(-50%, -50%) rotate(-9deg) translateX(-60px) scale(0.7)',
          opacity: 0.85,
          animation: 'float 4s ease-in-out infinite',
        }}>
          <Card card={dormant} scale={0.7} />
        </div>
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          ['--r' as string]: '9deg', ['--x' as string]: '60px', ['--s' as string]: '0.7',
          transform: 'translate(-50%, -50%) rotate(9deg) translateX(60px) scale(0.7)',
          opacity: 1,
          animation: 'float 4s ease-in-out infinite',
          animationDelay: '0.5s',
          zIndex: 2,
        }}>
          {summoned ? (
            <Card card={summoned} scale={0.7} />
          ) : (
            <Card card={TEMPLATES[0]} scale={0.7} />
          )}
        </div>
      </div>

      {/* Buttons */}
      <div style={{
        paddingBottom: 'max(40px, env(safe-area-inset-bottom, 40px))', paddingLeft: 20, paddingRight: 20,
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative', zIndex: 2,
      }}>
        <button
          onClick={() => canMatch && onNav('match')}
          disabled={!canMatch}
          style={{
            ...btnPrimary,
            opacity: canMatch ? 1 : 0.55,
            cursor: canMatch ? 'pointer' : 'not-allowed',
          }}
        >
          ⚔ {canMatch ? 'Play Match' : `Need ${4 - playableInDeck} more in deck`}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onNav('collection')} style={btnSecondary}>Collection</button>
          <button onClick={() => onNav('pack')} style={btnSecondary}>📦 Packs</button>
          <button onClick={() => onNav('deck')} style={btnSecondary}>Deck</button>
        </div>
      </div>
    </div>
  );
}
