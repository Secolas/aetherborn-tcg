import { useState } from 'react';
import { Card } from '../components/Card';
import { btnPrimary, btnSecondary, iconBtn } from '../components/styles';
import { openPack, PACK_COST, PACK_SIZE } from '../game/pack';
import { RARITY_COLOR } from '../data/elements';
import type { CollectionCard } from '../game/types';

type Stage = 'idle' | 'shaking' | 'revealing' | 'done';

interface Props {
  coins: number;
  onPackOpened: (cards: CollectionCard[], coinsSpent: number) => void;
  onBack: () => void;
}

export function PackOpening({ coins, onPackOpened, onBack }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [pack, setPack] = useState<CollectionCard[]>([]);
  const [revealedIdx, setRevealedIdx] = useState(0);

  const canBuy = coins >= PACK_COST;

  const buy = () => {
    if (!canBuy) return;
    const cards = openPack();
    setPack(cards);
    setStage('shaking');
    onPackOpened(cards, PACK_COST);
    setTimeout(() => setStage('revealing'), 1200);
  };

  const revealNext = () => {
    if (revealedIdx < pack.length - 1) {
      setRevealedIdx(i => i + 1);
    } else {
      setStage('done');
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse at 50% 30%, #2a3a5e 0%, #0e1428 70%, #050816 100%)',
      color: '#fff', fontFamily: '"Inter", system-ui, sans-serif',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: '"Cinzel", Georgia, serif' }}>Packs</div>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.6, marginTop: 2 }}>
            {coins} coins
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {stage === 'idle' && (
          <PackArt onClick={buy} disabled={!canBuy} />
        )}

        {stage === 'shaking' && (
          <div style={{ position: 'relative' }}>
            <div style={{ animation: 'packShake 0.3s ease-in-out infinite' }}>
              <PackArt />
            </div>
            <div style={{
              position: 'absolute', inset: '50%',
              width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, #f4d04a 0%, transparent 70%)',
              transform: 'translate(-50%, -50%)',
              animation: 'packBurst 1s ease-out forwards',
              pointerEvents: 'none',
            }} />
          </div>
        )}

        {stage === 'revealing' && (
          <div
            onClick={revealNext}
            style={{
              cursor: 'pointer',
              animation: 'cardSummon 0.5s cubic-bezier(.2,.8,.3,1)',
              textAlign: 'center',
            }}
            key={revealedIdx}
          >
            <Card card={pack[revealedIdx]} hovered />
            <div style={{
              marginTop: 18, fontSize: 11, letterSpacing: '0.25em',
              textTransform: 'uppercase', color: RARITY_COLOR[pack[revealedIdx].rarity],
              fontWeight: 700,
            }}>
              {pack[revealedIdx].rarity} · {revealedIdx + 1} / {PACK_SIZE}
            </div>
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6 }}>tap to continue</div>
          </div>
        )}

        {stage === 'done' && (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 14, opacity: 0.7, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
              {PACK_SIZE} new dormant cards
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 6, marginBottom: 24,
            }}>
              {pack.map(c => (
                <div key={c.uid} style={{ transform: 'scale(0.45)', transformOrigin: 'top center', height: 150 }}>
                  <Card card={c} scale={0.5} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 18, fontStyle: 'italic' }}>
              Visit Collection and tap any card to summon it with a photo.
            </div>
            <button onClick={onBack} style={{ ...btnPrimary, width: '100%' }}>Done</button>
          </div>
        )}
      </div>

      {stage === 'idle' && (
        <div style={{ padding: '0 20px 40px' }}>
          <button
            onClick={buy}
            disabled={!canBuy}
            style={{
              ...btnPrimary,
              width: '100%',
              opacity: canBuy ? 1 : 0.55,
              cursor: canBuy ? 'pointer' : 'not-allowed',
            }}
          >
            Open Pack · {PACK_COST} coins
          </button>
          {!canBuy && (
            <div style={{ textAlign: 'center', fontSize: 10, opacity: 0.6, marginTop: 10 }}>
              Win matches to earn more coins.
            </div>
          )}
          <button onClick={onBack} style={{ ...btnSecondary, width: '100%', marginTop: 8 }}>Maybe later</button>
        </div>
      )}
    </div>
  );
}

function PackArt({ onClick, disabled = false }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        width: 200, height: 280,
        borderRadius: 16,
        background: 'linear-gradient(135deg, #2a163f 0%, #7a4ea8 50%, #2a163f 100%)',
        boxShadow: `
          0 18px 40px rgba(0,0,0,.5),
          inset 0 0 0 3px #f4d04a,
          inset 0 0 30px rgba(244,208,74,.3),
          0 0 60px rgba(244,208,74,.2)
        `,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10,
        transition: 'transform .2s',
        transform: disabled ? 'none' : undefined,
      }}
    >
      <div style={{
        fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase',
        color: '#f4d04a', fontFamily: '"Cinzel", Georgia, serif',
      }}>Aetherborn</div>
      <div style={{
        fontSize: 28, fontWeight: 700, fontFamily: '"Cinzel", Georgia, serif',
        color: '#fff', textShadow: '0 0 20px rgba(244,208,74,.8)',
        letterSpacing: '0.05em',
      }}>PACK</div>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #f4d04a, #c4801a 70%, #2a163f)',
        boxShadow: '0 0 30px rgba(244,208,74,.6)',
      }} />
      <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7 }}>
        5 dormant cards
      </div>
      <div style={{ fontSize: 9, opacity: 0.5, marginTop: 4 }}>
        ✨ rare+ guaranteed
      </div>
    </div>
  );
}
