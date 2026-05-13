import { useEffect, useRef, useState } from 'react';
import { Coins, Package, Images, Layers, Swords, ScrollText, Sparkles, Settings as SettingsIcon, Flame } from 'lucide-react';
import { Card } from '../components/Card';
import { btnPrimary, btnSecondary, PALETTE } from '../components/styles';
import { TEMPLATES } from '../data/templates';
import type { CardTemplate, CollectionCard, SaveData } from '../game/types';

interface Props {
  save: SaveData;
  /** Total claimable items in Daily (completed quests + unclaimed streak).
   *  Drives the badge on the Daily nav chip. */
  dailyReadyCount?: number;
  onNav: (screen: 'collection' | 'pack' | 'deck' | 'play' | 'album' | 'settings' | 'daily') => void;
  onQuickFill: () => void;
  onSetAvatar: (dataUrl: string | undefined) => void;
}

export function HomeMenu({ save, dailyReadyCount = 0, onNav, onQuickFill, onSetAvatar }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') onSetAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
    // reset so picking the same file twice still fires
    e.target.value = '';
  };
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

  // Auto-advance every ~4s. Long enough for the burst to dissipate and the
  // new pair to settle into its float-idle pose before the next explosion.
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    if (slideshow.length <= 2) return; // nothing to cycle
    const id = window.setInterval(() => {
      setSlideIdx(i => (i + 1) % slideshow.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [slideshow.length]);

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
          {/* Tap-to-upload player avatar — falls back to a "Y" letter on
              the orange gradient when no photo has been chosen. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            style={{ display: 'none' }}
            aria-label="Upload avatar"
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: save.playerAvatar
                ? `url(${save.playerAvatar}) center/cover`
                : 'linear-gradient(135deg, #ff9f1c, #ee5a52)',
              display: 'grid', placeItems: 'center',
              fontSize: 18, fontWeight: 700,
              color: '#fff',
              boxShadow: '0 4px 10px rgba(238, 90, 82, .35), inset 0 0 0 2px rgba(255,255,255,.5)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
            }}
            aria-label={save.playerAvatar ? 'Change avatar' : 'Upload avatar'}
            title={save.playerAvatar ? 'Tap to change avatar' : 'Tap to upload your avatar'}
          >
            {!save.playerAvatar && 'Y'}
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>You</div>
            <div style={{ fontSize: 10, letterSpacing: '0.05em', color: PALETTE.textMid, marginTop: 1 }}>
              {save.matchesWon} W · {save.matchesLost} L · {summonedCount} summoned
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onNav('daily')}
            aria-label="Daily quests"
            style={{
              position: 'relative',
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff9f1c, #ee5a52)',
              border: '2px solid #fff',
              boxShadow: '0 3px 10px rgba(238,90,82,.40)',
              display: 'grid', placeItems: 'center',
              cursor: 'pointer',
              padding: 0,
              color: '#fff',
            }}
          >
            <Flame size={18} strokeWidth={2.2} fill="#ffd166" color="#ffd166" />
            {dailyReadyCount > 0 && (
              <span style={{
                position: 'absolute', top: -3, right: -3,
                minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 999, background: '#06d6a0', color: '#fff',
                fontSize: 9, fontWeight: 800, lineHeight: '16px',
                border: '2px solid #fff',
              }}>{dailyReadyCount}</span>
            )}
          </button>
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
          <button
            onClick={() => onNav('settings')}
            aria-label="Settings"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#fff',
              border: `1.5px solid ${PALETTE.border}`,
              boxShadow: '0 3px 8px rgba(58,46,42,.08)',
              display: 'grid', placeItems: 'center',
              cursor: 'pointer',
              padding: 0,
              color: PALETTE.text,
            }}
          >
            <SettingsIcon size={18} strokeWidth={2.2} />
          </button>
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

      {/* Card preview area — hand fan-out. On each tick a fresh hand of
          ~6 cards arcs in from below the showcase one card at a time,
          forming a curved fan in the center. The hand sits gently swaying
          before the cycle replaces it with the next set. */}
      <div style={{
        position: 'relative', flex: 1, minHeight: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 12,
      }}>
        {(() => {
          const N = Math.min(6, Math.max(2, slideshow.length));
          return Array.from({ length: N }).map((_, i) => {
            // Distribute around the centered fan: leftmost negative,
            // rightmost positive. Edge cards rotate further out and sink
            // slightly to form a natural arc.
            const offset = i - (N - 1) / 2;
            const finalX = offset * 32;            // px — horizontal stride
            const finalY = Math.abs(offset) * 8;   // px — arc curve, edges sink
            const finalRot = offset * 8;            // deg — fan splay
            const delay = i * 0.11;                 // s — staggered entry
            const card = slideshow[(slideIdx * N + i) % slideshow.length];
            const cardStyle: React.CSSProperties & Record<string, string | number> = {
              position: 'absolute', left: '50%', top: '50%',
              animation:
                `homeFanIn 0.85s cubic-bezier(.22,.85,.3,1.15) ${delay}s both, ` +
                `homeFanIdle 4s ease-in-out ${delay + 0.85}s infinite`,
              willChange: 'transform, opacity',
              pointerEvents: 'none',
              zIndex: 10 + i,
              filter: 'drop-shadow(0 8px 16px rgba(58, 46, 42, .18))',
              ['--final-x']: `${finalX}px`,
              ['--final-y']: `${finalY}px`,
              ['--final-rot']: `${finalRot}deg`,
            };
            return (
              <div key={`fan-${slideIdx}-${i}`} style={cardStyle}>
                <Card card={card} scale={0.6} />
              </div>
            );
          });
        })()}

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
