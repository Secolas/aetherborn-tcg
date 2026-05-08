import { useState } from 'react';
import { Card } from '../components/Card';
import { ElementGlyph } from '../components/ElementGlyph';
import { btnPrimary, btnSecondary, iconBtn, PALETTE } from '../components/styles';
import { openPack, PACK_COST, PACK_SIZE } from '../game/pack';
import { ELEMENTS, RARITY_COLOR } from '../data/elements';
import type { CollectionCard, ElementId } from '../game/types';

type Stage = 'pick' | 'shaking' | 'revealing' | 'done';
const THEMES: ElementId[] = ['family', 'work', 'animals'];

interface Props {
  coins: number;
  onPackOpened: (cards: CollectionCard[], coinsSpent: number) => void;
  onBack: () => void;
}

export function PackOpening({ coins, onPackOpened, onBack }: Props) {
  const [stage, setStage] = useState<Stage>('pick');
  const [pickedTheme, setPickedTheme] = useState<ElementId | null>(null);
  const [pack, setPack] = useState<CollectionCard[]>([]);
  const [revealedIdx, setRevealedIdx] = useState(0);

  const canBuy = coins >= PACK_COST;

  const buy = (theme: ElementId) => {
    if (!canBuy) return;
    const cards = openPack(theme);
    setPickedTheme(theme);
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

  const reset = () => {
    setStage('pick');
    setPickedTheme(null);
    setPack([]);
    setRevealedIdx(0);
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
        linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)
      `,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Packs</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            {coins} coins
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '0 16px' }}>
        {stage === 'pick' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center', fontSize: 12, color: PALETTE.textMid, fontStyle: 'italic', marginBottom: 4 }}>
              Choose what to photograph today
            </div>
            {THEMES.map(theme => (
              <ThemePackOption
                key={theme}
                theme={theme}
                disabled={!canBuy}
                onClick={() => buy(theme)}
              />
            ))}
            {!canBuy && (
              <div style={{ textAlign: 'center', fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                Need {PACK_COST} coins. Win matches to earn more.
              </div>
            )}
          </div>
        )}

        {stage === 'shaking' && pickedTheme && (
          <div style={{ position: 'relative' }}>
            <div style={{ animation: 'packShake 0.3s ease-in-out infinite' }}>
              <PackArt theme={pickedTheme} />
            </div>
            <div style={{
              position: 'absolute', inset: '50%',
              width: 200, height: 200, borderRadius: '50%',
              background: `radial-gradient(circle, ${ELEMENTS[pickedTheme].glow} 0%, transparent 70%)`,
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
              display: 'flex', justifyContent: 'center',
              gap: 8, marginBottom: 24,
            }}>
              {pack.map(c => (
                <div key={c.uid} style={{ transform: 'scale(0.55)', transformOrigin: 'top center', height: 180, width: 130 }}>
                  <Card card={c} scale={0.55} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 18, fontStyle: 'italic' }}>
              Visit Collection and tap any card to summon it with a photo.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={reset} style={{ ...btnSecondary, width: '100%' }}>Open another</button>
              <button onClick={onBack} style={{ ...btnPrimary, width: '100%' }}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThemePackOption({
  theme, disabled, onClick,
}: { theme: ElementId; disabled: boolean; onClick: () => void }) {
  const e = ELEMENTS[theme];
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        borderRadius: 14,
        border: 'none',
        background: `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 100%)`,
        boxShadow: `0 6px 14px rgba(0,0,0,.35), inset 0 0 0 1.5px ${e.glow}55`,
        color: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        textAlign: 'left',
        transition: 'transform .15s',
        fontFamily: 'inherit',
      }}
      onMouseDown={(ev) => { if (!disabled) (ev.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
      onMouseUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
    >
      <ElementGlyph el={theme} size={42} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 18, fontWeight: 700,
          fontFamily: '"Cinzel", Georgia, serif',
          letterSpacing: '0.05em',
        }}>{e.name}</div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, fontStyle: 'italic' }}>
          {e.blurb}
        </div>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        fontSize: 11, fontWeight: 700,
      }}>
        <div style={{ fontSize: 14 }}>{PACK_COST}</div>
        <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.7, marginTop: 1 }}>
          {PACK_SIZE} cards
        </div>
      </div>
    </button>
  );
}

function PackArt({ theme }: { theme: ElementId }) {
  const e = ELEMENTS[theme];
  return (
    <div style={{
      width: 200, height: 280,
      borderRadius: 16,
      background: `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 50%, ${e.deep} 100%)`,
      boxShadow: `
        0 18px 40px rgba(0,0,0,.5),
        inset 0 0 0 3px ${e.glow},
        inset 0 0 30px ${e.glow}55,
        0 0 60px ${e.glow}55
      `,
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12,
      transition: 'transform .2s',
    }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase',
        color: e.glow, fontFamily: '"Cinzel", Georgia, serif',
      }}>Lifedeck</div>
      <div style={{
        fontSize: 32, fontWeight: 700, fontFamily: '"Cinzel", Georgia, serif',
        color: '#fff', textShadow: `0 0 20px ${e.glow}`,
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>{e.name}</div>
      <ElementGlyph el={theme} size={70} />
      <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.85 }}>
        {PACK_SIZE} dormant cards
      </div>
    </div>
  );
}
