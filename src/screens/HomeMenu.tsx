import { useEffect, useState } from 'react';
import { Coins, Package, Images, Layers, Swords, ScrollText, Sparkles } from 'lucide-react';
import { Card } from '../components/Card';
import { btnPrimary, btnSecondary, PALETTE } from '../components/styles';
import { TEMPLATES } from '../data/templates';
import type { CardTemplate, CollectionCard, SaveData } from '../game/types';

interface Props {
  save: SaveData;
  onNav: (screen: 'collection' | 'pack' | 'deck' | 'play' | 'album') => void;
  onQuickFill: () => void;
}

export function HomeMenu({ save, onNav, onQuickFill }: Props) {
  const dormant = TEMPLATES.find(t => t.id === 'fam-11')!; // Dad — iconic
  const playableInDeck = save.deckUids.filter(uid => {
    const c = save.collection.find(x => x.uid === uid);
    return c && c.photo;
  }).length;
  const canMatch = playableInDeck >= 4;
  const summonedCount = save.collection.filter(c => c.photo).length;
  const dormantCount = save.collection.filter(c => !c.photo).length;
  const showQuickFill = !canMatch && dormantCount > 0;

  // Slideshow source: every summoned card the player owns. With <2 cards we
  // fall back to a single-card loop or the original "dormant + first card"
  // pair so the showcase area never goes empty.
  const summonedAll: (CollectionCard | CardTemplate)[] = save.collection.filter(c => c.photo);
  const slideshow: (CollectionCard | CardTemplate)[] =
    summonedAll.length >= 2 ? summonedAll
    : summonedAll.length === 1 ? [summonedAll[0], dormant]
    : [dormant, TEMPLATES[0]];

  // Auto-advance every ~3s. The two slots show consecutive cards; on each
  // tick we step forward by one so the right card slides into the left
  // position visually (and a new card slides in on the right).
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    if (slideshow.length <= 2) return; // nothing to cycle
    const id = window.setInterval(() => {
      setSlideIdx(i => (i + 1) % slideshow.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [slideshow.length]);
  const leftCard = slideshow[slideIdx % slideshow.length];
  const rightCard = slideshow[(slideIdx + 1) % slideshow.length];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 120% 80% at 50% 0%, #fff4e6 0%, transparent 70%),
        linear-gradient(180deg, #ffe8d6 0%, #ffd1b3 50%, #ffb89a 100%)
      `,
      position: 'relative', overflow: 'hidden',
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      color: PALETTE.text,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Soft confetti dots */}
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.5, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {Array.from({ length: 22 }).map((_, i) => {
          const colors = ['#ffd166', '#ff7e5f', '#06d6a0', '#ffa07a', '#ee5a52'];
          return (
            <circle key={i}
              cx={`${(i * 47) % 100}%`}
              cy={`${(i * 31) % 100}%`}
              r={3 + (i % 3)}
              fill={colors[i % colors.length]}
              opacity={0.45}
            />
          );
        })}
      </svg>

      {/* Top bar */}
      <div style={{
        paddingTop: 'max(56px, env(safe-area-inset-top, 56px))', paddingLeft: 20, paddingRight: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'relative', zIndex: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff9f1c, #ee5a52)',
            display: 'grid', placeItems: 'center',
            fontSize: 18, fontWeight: 700,
            color: '#fff',
            boxShadow: '0 4px 10px rgba(238, 90, 82, .35)',
          }}>Y</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>You</div>
            <div style={{ fontSize: 10, letterSpacing: '0.05em', color: PALETTE.textMid, marginTop: 1 }}>
              {save.matchesWon} W · {save.matchesLost} L · {summonedCount} summoned
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#fff',
          padding: '6px 12px', borderRadius: 16,
          boxShadow: '0 3px 8px rgba(58,46,42,.08)',
          border: `1.5px solid ${PALETTE.border}`,
        }}>
          <Coins size={16} color="#e8a93a" fill="#ffd166" strokeWidth={2.2} />
          <span style={{ fontSize: 14, fontWeight: 700, color: PALETTE.text }}>{save.coins}</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginTop: 28, position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: PALETTE.textMid, fontWeight: 500 }}>
          welcome to
        </div>
        <div style={{
          fontSize: 56, fontWeight: 700, lineHeight: 1,
          fontFamily: '"Fredoka", system-ui, sans-serif',
          background: 'linear-gradient(180deg, #ff9f1c 0%, #ee5a52 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginTop: 4,
          letterSpacing: '-0.01em',
        }}>Lifedeck</div>
        <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 6, fontStyle: 'italic' }}>
          your life. in cards.
        </div>
      </div>

      {/* Card preview area — sliding showcase. Two slots auto-cycle through
          every summoned card the player owns. The React `key` includes the
          slide index so each tick remounts the slot, replaying the slide-in
          keyframe, while the floating idle animation keeps running between
          ticks. */}
      <div style={{
        position: 'relative', flex: 1, minHeight: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 12,
      }}>
        <div
          key={`left-${slideIdx}`}
          style={{
            position: 'absolute', left: '50%', top: '50%',
            ['--r' as string]: '-9deg', ['--x' as string]: '-60px', ['--s' as string]: '0.7',
            transform: 'translate(-50%, -50%) rotate(-9deg) translateX(-60px) scale(0.7)',
            opacity: 0.95,
            animation: 'homeSlideInLeft .55s cubic-bezier(.2,.8,.3,1) forwards, float 4s ease-in-out .55s infinite',
            filter: 'drop-shadow(0 8px 16px rgba(58, 46, 42, .15))',
          }}
        >
          <Card card={leftCard} scale={0.7} />
        </div>
        <div
          key={`right-${slideIdx}`}
          style={{
            position: 'absolute', left: '50%', top: '50%',
            ['--r' as string]: '9deg', ['--x' as string]: '60px', ['--s' as string]: '0.7',
            transform: 'translate(-50%, -50%) rotate(9deg) translateX(60px) scale(0.7)',
            opacity: 1,
            animation: 'homeSlideInRight .55s cubic-bezier(.2,.8,.3,1) forwards, float 4s ease-in-out .55s infinite',
            animationDelay: '0.1s',
            zIndex: 2,
            filter: 'drop-shadow(0 10px 18px rgba(58, 46, 42, .18))',
          }}
        >
          <Card card={rightCard} scale={0.7} />
        </div>

        {/* Tiny progress dots so the slideshow feels intentional, not random */}
        {slideshow.length > 2 && (
          <div style={{
            position: 'absolute', bottom: 4, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 5,
            zIndex: 3,
          }}>
            {slideshow.map((_, i) => (
              <span key={i} style={{
                width: i === slideIdx ? 16 : 5, height: 5, borderRadius: 3,
                background: i === slideIdx ? PALETTE.accent : 'rgba(58,46,42,.18)',
                transition: 'width .25s, background .25s',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom: Play button + nav */}
      <div style={{
        paddingBottom: 'max(36px, env(safe-area-inset-bottom, 36px))', paddingLeft: 16, paddingRight: 16,
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative', zIndex: 2,
      }}>
        <button
          onClick={() => canMatch && onNav('play')}
          disabled={!canMatch}
          style={{
            ...btnPrimary,
            width: '100%',
            opacity: canMatch ? 1 : 0.5,
            cursor: canMatch ? 'pointer' : 'not-allowed',
            fontSize: 16,
            padding: '16px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {canMatch ? <><Swords size={20} strokeWidth={2.4} /> Play Match</> : `Need ${4 - playableInDeck} more in deck`}
        </button>

        {showQuickFill && (
          <button
            onClick={onQuickFill}
            style={{
              ...btnSecondary,
              width: '100%',
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'rgba(255,255,255,0.85)',
              color: PALETTE.text,
              border: `1.5px dashed ${PALETTE.accent}`,
            }}
          >
            <Sparkles size={16} color={PALETTE.accent} strokeWidth={2.4} />
            <span>Quick Play with placeholder photos</span>
          </button>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <NavButton label="Packs"      icon={<Package    size={18} />} onClick={() => onNav('pack')} />
          <NavButton label="Collection" icon={<Layers     size={18} />} onClick={() => onNav('collection')} />
          <NavButton label="Deck"       icon={<ScrollText size={18} />} onClick={() => onNav('deck')} />
          <NavButton label="Album"      icon={<Images     size={18} />} onClick={() => onNav('album')} />
        </div>
      </div>
    </div>
  );
}

function NavButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      ...btnSecondary,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 4, padding: '9px 0',
      color: PALETTE.text,
    }}>
      <span style={{ color: PALETTE.accentDeep, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 11 }}>{label}</span>
    </button>
  );
}
