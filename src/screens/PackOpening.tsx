import { useEffect, useState } from 'react';
import { ArrowLeft, Coins } from 'lucide-react';
import { Card } from '../components/Card';
import { ElementGlyph } from '../components/ElementGlyph';
import { btnPrimary, btnSecondary, iconBtn, PALETTE } from '../components/styles';
import { openPack, PACK_COST, PACK_SIZE } from '../game/pack';
import { ELEMENTS, RARITY_COLOR } from '../data/elements';
import { playSfx } from '../audio/sfx';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';
import type { CollectionCard, ElementId, Rarity } from '../game/types';

/** Pack-opening cinematic stages.
 *  - pick:       choose a theme
 *  - lift:       pack rises from below (~600ms)
 *  - tension:    pack rattles + brightens, building anticipation (~900ms)
 *  - burst:      shockwave + light streaks + screen flash (~700ms)
 *  - revealing:  cards fly in one-by-one, rarity-scaled flourish
 *  - done:       summary + actions */
type Stage = 'pick' | 'lift' | 'tension' | 'burst' | 'revealing' | 'done';

const THEMES: ElementId[] = ['family', 'work', 'animals', 'travel', 'food', 'education'];

interface Props {
  coins: number;
  onPackOpened: (cards: CollectionCard[], coinsSpent: number) => void;
  onBack: () => void;
  settings?: Settings;
}

const STAGE_DURATIONS: Record<Exclude<Stage, 'pick' | 'revealing' | 'done'>, number> = {
  lift: 600,
  tension: 900,
  burst: 700,
};

export function PackOpening({ coins, onPackOpened, onBack, settings = DEFAULT_SETTINGS }: Props) {
  const [stage, setStage] = useState<Stage>('pick');
  const [pickedTheme, setPickedTheme] = useState<ElementId | null>(null);
  const [pack, setPack] = useState<CollectionCard[]>([]);
  const [revealedIdx, setRevealedIdx] = useState(0);
  // SFX cues read the current volume from props directly. The cinematic
  // is short enough that re-binding sfx on each render is fine; we don't
  // need a ref to capture stale values across timers.
  const sfxVol = settings.sfxVolume;
  const sfx = (cue: Parameters<typeof playSfx>[0]) => playSfx(cue, sfxVol);

  const canBuy = coins >= PACK_COST;

  // Drive the cinematic timeline forward. Each non-interactive stage has
  // a fixed duration; setTimeout chains them. Reveal stage is player-paced
  // (taps to advance).
  useEffect(() => {
    if (stage === 'pick' || stage === 'revealing' || stage === 'done') return;
    const dur = STAGE_DURATIONS[stage];
    const next: Record<typeof stage, Stage> = {
      lift: 'tension',
      tension: 'burst',
      burst: 'revealing',
    };
    const t = setTimeout(() => setStage(next[stage]), dur);
    return () => clearTimeout(t);
  }, [stage]);

  // SFX cues fire on stage entry. packRip when the tension builds,
  // packBurst at the moment of explosion.
  useEffect(() => {
    if (stage === 'tension') sfx('packRip');
    if (stage === 'burst') sfx('packBurst');
    if (stage === 'revealing' && pack[revealedIdx]) {
      sfx(rarityCue(pack[revealedIdx].rarity));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Fire the per-card rarity stinger every time the player advances to a
  // new card during the reveal.
  useEffect(() => {
    if (stage !== 'revealing') return;
    const card = pack[revealedIdx];
    if (!card) return;
    sfx(rarityCue(card.rarity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedIdx]);

  const buy = (theme: ElementId) => {
    if (!canBuy) return;
    const cards = openPack(theme);
    setPickedTheme(theme);
    setPack(cards);
    onPackOpened(cards, PACK_COST);
    setStage('lift');
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
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 4 }}>
        <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Packs</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Coins size={12} color="#e8a93a" fill="#ffd166" strokeWidth={2.2} />
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

        {pickedTheme && (stage === 'lift' || stage === 'tension' || stage === 'burst') && (
          <PackCinematic theme={pickedTheme} stage={stage} />
        )}

        {stage === 'revealing' && pack[revealedIdx] && (
          <RevealCard
            card={pack[revealedIdx]}
            idx={revealedIdx}
            total={pack.length}
            theme={pickedTheme!}
            onTap={revealNext}
          />
        )}

        {stage === 'done' && (
          <div style={{ textAlign: 'center', padding: 30, animation: 'fadeIn .35s ease-out both' }}>
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

/** Cinematic stages preceding the reveal. The packs animate in a single
 *  element whose animation switches per stage so each transition is a
 *  clean keyframe change instead of remount + flicker. */
function PackCinematic({ theme, stage }: { theme: ElementId; stage: 'lift' | 'tension' | 'burst' }) {
  const e = ELEMENTS[theme];
  const animation =
    stage === 'lift'    ? 'packLift 0.6s cubic-bezier(.18,.85,.3,1.1) both'
  : stage === 'tension' ? 'packLift 0.6s cubic-bezier(.18,.85,.3,1.1) both, packTension 0.32s ease-in-out 0.6s 3'
  :                       'packExplode 0.7s cubic-bezier(.4,.1,.6,1) both';

  return (
    <div style={{ position: 'relative', width: 240, height: 320, display: 'grid', placeItems: 'center' }}>
      {/* Shockwave + light streaks at the moment of burst */}
      {stage === 'burst' && (
        <>
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 240, height: 240, borderRadius: '50%',
            border: `4px solid ${e.glow}`,
            animation: 'packShockRing 0.7s ease-out both',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 180, height: 180, borderRadius: '50%',
            background: `radial-gradient(circle, #fff 0%, ${e.glow} 35%, transparent 75%)`,
            transform: 'translate(-50%,-50%) scale(0.5)',
            animation: 'packBurst 0.7s ease-out both',
            pointerEvents: 'none',
            mixBlendMode: 'screen',
          }} />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 360 / 8) + 12;
            return (
              <div key={i} style={{
                position: 'absolute', left: '50%', top: '50%',
                width: 6, height: 90,
                background: `linear-gradient(180deg, ${e.glow}, transparent)`,
                borderRadius: 3,
                transformOrigin: 'center bottom',
                ['--r' as string]: `${angle}deg`,
                animation: 'packLightStreak 0.7s ease-out both',
                pointerEvents: 'none',
                mixBlendMode: 'screen',
              }} />
            );
          })}
          <div style={{
            position: 'fixed', inset: 0,
            background: '#fff',
            animation: 'screenWhiteFlash 0.55s ease-out both',
            pointerEvents: 'none',
            zIndex: 3,
            mixBlendMode: 'screen',
          }} />
        </>
      )}

      <div style={{ animation, position: 'relative', zIndex: 2 }}>
        <PackArt theme={theme} />
      </div>

      {/* Subtle aura under the pack while it's lifted/tensioning */}
      {(stage === 'lift' || stage === 'tension') && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${e.glow}88 0%, transparent 65%)`,
          transform: 'translate(-50%,-50%)',
          animation: stage === 'tension' ? 'flash 0.32s ease-in-out 3 both' : undefined,
          opacity: stage === 'tension' ? undefined : 0.45,
          pointerEvents: 'none',
          zIndex: 1,
        }} />
      )}
    </div>
  );
}

/** A single revealed card, animated in with rarity-scaled flourish. Click
 *  to advance. */
function RevealCard({
  card, idx, total, theme, onTap,
}: { card: CollectionCard; idx: number; total: number; theme: ElementId; onTap: () => void }) {
  const e = ELEMENTS[theme];
  const showHalo = card.rarity === 'epic' || card.rarity === 'legendary';
  const showSheen = card.rarity !== 'common';
  // Key off idx so each new reveal remounts and the animation restarts.
  return (
    <div
      key={idx}
      onClick={onTap}
      style={{ cursor: 'pointer', textAlign: 'center', position: 'relative' }}
    >
      {showHalo && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 320, height: 320, borderRadius: '50%',
          background: `radial-gradient(circle,
            ${card.rarity === 'legendary' ? '#ffd166' : e.glow} 0%,
            transparent 60%)`,
          animation: 'rarityHalo 1.4s ease-out both',
          pointerEvents: 'none', zIndex: 0,
          mixBlendMode: 'screen',
        }} />
      )}
      <div style={{
        position: 'relative',
        animation: 'cardRevealFlight 0.8s cubic-bezier(.18,.85,.3,1.1) both',
        zIndex: 1,
        display: 'inline-block',
      }}>
        <Card card={card} hovered />
        {showSheen && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,.85) 50%, transparent 70%)',
            animation: 'cardHoloSheen 1.1s ease-out 0.45s both',
            pointerEvents: 'none',
            mixBlendMode: 'screen',
            borderRadius: 12,
          }} />
        )}
      </div>
      <div style={{
        marginTop: 18, fontSize: 11, letterSpacing: '0.25em',
        textTransform: 'uppercase', color: RARITY_COLOR[card.rarity],
        fontWeight: 700, position: 'relative', zIndex: 2,
        textShadow: card.rarity === 'legendary' ? '0 0 12px rgba(255, 209, 102, .6)' : 'none',
      }}>
        {card.rarity} · {idx + 1} / {total}
      </div>
      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6, position: 'relative', zIndex: 2 }}>
        tap to continue
      </div>
    </div>
  );
}

/** Map a card rarity to the appropriate reveal sting cue. */
function rarityCue(r: Rarity): Parameters<typeof playSfx>[0] {
  switch (r) {
    case 'common':    return 'rarityCommon';
    case 'rare':      return 'rarityRare';
    case 'epic':      return 'rarityEpic';
    case 'legendary': return 'rarityLegendary';
  }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15 }}>
          <Coins size={14} fill="#ffd166" color="#e8a93a" strokeWidth={2.2} />
          {PACK_COST}
        </div>
        <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2, fontWeight: 500 }}>
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
