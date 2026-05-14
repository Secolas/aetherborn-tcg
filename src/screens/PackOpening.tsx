import { useEffect, useState } from 'react';
import { ArrowLeft, Coins, Sparkles, Lock, Star, Shield, Package } from 'lucide-react';
import { Card } from '../components/Card';
import { TiltCard } from '../components/TiltCard';
import { ElementGlyph } from '../components/ElementGlyph';
import { btnPrimary, btnSecondary, iconBtn, PALETTE } from '../components/styles';
import { openPack, openMemoryPack, PACK_COST, PACK_SIZE } from '../game/pack';
import { ELEMENTS, RARITY_COLOR } from '../data/elements';
import { MEMORY_PACKS, type MemoryPackDef } from '../data/memoryPacks';
import { FILTERS } from '../data/filters';
import { playSfx } from '../audio/sfx';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';
import { useViewport } from '../hooks/useViewport';
import type { CollectionCard, ElementId, Rarity } from '../game/types';

/** Pack-opening cinematic stages. See PackCinematic for the visual contract. */
type Stage = 'pick' | 'lift' | 'tension' | 'burst' | 'revealing' | 'done';

const THEMES: ElementId[] = ['family', 'work', 'animals', 'travel', 'food', 'education'];

interface PackVibe {
  deep: string;
  color: string;
  glow: string;
  title: string;
  icon: React.ReactNode | null;
  el: ElementId;
}

type PackPick =
  | { kind: 'theme'; theme: ElementId; vibe: PackVibe }
  | { kind: 'memory'; pack: MemoryPackDef; vibe: PackVibe; firstOpen: boolean };

interface Props {
  coins: number;
  onPackOpened: (cards: CollectionCard[], coinsSpent: number) => void;
  onMemoryPackOpened?: (packId: string, cards: CollectionCard[], cost: number) => void;
  openedMemoryPacks?: string[];
  onBack: () => void;
  settings?: Settings;
}

const STAGE_DURATIONS: Record<Exclude<Stage, 'pick' | 'revealing' | 'done'>, number> = {
  lift: 600,
  tension: 900,
  burst: 700,
};

export function PackOpening({
  coins, onPackOpened, onMemoryPackOpened, openedMemoryPacks = [],
  onBack, settings = DEFAULT_SETTINGS,
}: Props) {
  const [stage, setStage] = useState<Stage>('pick');
  const [pick, setPick] = useState<PackPick | null>(null);
  const [pack, setPack] = useState<CollectionCard[]>([]);
  const [revealedIdx, setRevealedIdx] = useState(0);
  const { isMobile, isDesktop } = useViewport();

  const sfxVol = settings.sfxVolume;
  const sfx = (cue: Parameters<typeof playSfx>[0]) => playSfx(cue, sfxVol);

  const canBuyTheme = coins >= PACK_COST;

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

  useEffect(() => {
    if (stage === 'tension') sfx('packRip');
    if (stage === 'burst') sfx('packBurst');
    if (stage === 'revealing' && pack[revealedIdx]) {
      sfx(rarityCue(pack[revealedIdx].rarity));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (stage !== 'revealing') return;
    const card = pack[revealedIdx];
    if (!card) return;
    sfx(rarityCue(card.rarity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedIdx]);

  const buyTheme = (theme: ElementId) => {
    if (!canBuyTheme) return;
    const cards = openPack(theme);
    const e = ELEMENTS[theme];
    const vibe: PackVibe = {
      deep: e.deep, color: e.color, glow: e.glow, title: e.name,
      icon: <ElementGlyph el={theme} size={70} />, el: theme,
    };
    setPick({ kind: 'theme', theme, vibe });
    setPack(cards);
    onPackOpened(cards, PACK_COST);
    setStage('lift');
  };

  const buyMemory = (def: MemoryPackDef) => {
    if (coins < def.cost) return;
    const cards = openMemoryPack(def.id);
    if (cards.length === 0) return;
    const firstOpen = !openedMemoryPacks.includes(def.id);
    const [deep, color] = def.gradient;
    const vibe: PackVibe = {
      deep, color, glow: def.glow, title: def.name,
      icon: null,
      el: def.themes[0],
    };
    setPick({ kind: 'memory', pack: def, vibe, firstOpen });
    setPack(cards);
    onMemoryPackOpened?.(def.id, cards, def.cost);
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
    setPick(null);
    setPack([]);
    setRevealedIdx(0);
  };

  // Layout column width that keeps the centerpiece "stage" comfortable
  // on desktop. The pack grid + cinematic centre inside this.
  const stageMax = isDesktop ? 1100 : 720;

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
      {/* Header */}
      <div style={{
        padding: isMobile ? '52px 16px 10px' : '40px 24px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'relative', zIndex: 4,
        maxWidth: stageMax, width: '100%', margin: '0 auto',
      }}>
        <button onClick={onBack} style={iconBtn} aria-label="Back"><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700 }}>Packs</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Coins size={12} color="#e8a93a" fill="#ffd166" strokeWidth={2.2} />
            {coins} coins
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'stretch', justifyContent: stage === 'pick' || stage === 'done' ? 'flex-start' : 'center',
        position: 'relative',
        minHeight: 0,
        width: '100%',
      }}>
        {stage === 'pick' && (
          <div
            className="no-scrollbar"
            style={{
              flex: 1, minHeight: 0, overflowY: 'auto',
              width: '100%',
              padding: isMobile ? '4px 16px 24px' : '0 24px 32px',
            }}
          >
            <div style={{ maxWidth: stageMax, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Element packs section */}
              <PackSection
                title="Element Packs"
                tagline="Pick a theme and photograph it. Every pack is one rare+ guaranteed."
              >
                <div style={packGridStyle(isDesktop)}>
                  {THEMES.map(theme => (
                    <ThemePackOption
                      key={theme}
                      theme={theme}
                      disabled={!canBuyTheme}
                      onClick={() => buyTheme(theme)}
                    />
                  ))}
                </div>
                {!canBuyTheme && (
                  <div style={{ marginTop: 8, fontSize: 11, color: PALETTE.textMid, opacity: 0.8 }}>
                    Need {PACK_COST} coins. Win matches to earn more.
                  </div>
                )}
              </PackSection>

              {/* Memory packs section */}
              <PackSection
                title="Memory Packs"
                tagline="Curated moments — first open also unlocks a free cosmetic filter."
              >
                <div style={packGridStyle(isDesktop)}>
                  {MEMORY_PACKS.map(def => (
                    <MemoryPackOption
                      key={def.id}
                      def={def}
                      coins={coins}
                      firstOpen={!openedMemoryPacks.includes(def.id)}
                      onClick={() => buyMemory(def)}
                    />
                  ))}
                </div>
              </PackSection>
            </div>
          </div>
        )}

        {pick && (stage === 'lift' || stage === 'tension' || stage === 'burst') && (
          <div style={{ display: 'grid', placeItems: 'center', flex: 1, minHeight: 0 }}>
            <PackCinematic vibe={pick.vibe} stage={stage} />
          </div>
        )}

        {stage === 'revealing' && pack[revealedIdx] && pick && (
          <div style={{ display: 'grid', placeItems: 'center', flex: 1, minHeight: 0, padding: 16 }}>
            <RevealCard
              card={pack[revealedIdx]}
              idx={revealedIdx}
              total={pack.length}
              vibe={pick.vibe}
              onTap={revealNext}
            />
          </div>
        )}

        {stage === 'done' && pick && (
          <div
            className="no-scrollbar"
            style={{
              flex: 1, minHeight: 0, overflowY: 'auto',
              padding: isMobile ? '8px 16px 24px' : '0 24px 32px',
              animation: 'fadeIn .35s ease-out both',
              width: '100%',
            }}
          >
            <div style={{ maxWidth: stageMax, margin: '0 auto' }}>
              <div style={{
                fontSize: 12, opacity: 0.7, letterSpacing: '0.2em',
                textTransform: 'uppercase', marginBottom: 14, textAlign: 'center',
              }}>
                {pack.length} new dormant cards
              </div>

              {/* Responsive summary grid — wraps card count to viewport. */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12, marginBottom: 18,
                justifyItems: 'center',
              }}>
                {pack.map(c => (
                  <Card key={c.uid} card={c} scale={isMobile ? 0.5 : 0.6} />
                ))}
              </div>

              {pick.kind === 'memory' && pick.firstOpen && (
                <div style={{
                  margin: '0 auto 18px', maxWidth: 380,
                  padding: '12px 14px', borderRadius: 14,
                  background: `linear-gradient(135deg, ${pick.vibe.deep}, ${pick.vibe.color})`,
                  color: '#fff',
                  boxShadow: `0 6px 18px ${pick.vibe.glow}55`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Sparkles size={18} color={pick.vibe.glow} fill={pick.vibe.glow} />
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: 10, opacity: 0.85, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
                      Cosmetic Filter Unlocked
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {FILTERS[pick.pack.bonusFilter].name}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2, fontStyle: 'italic' }}>
                      Apply it to any card when you take its photo.
                    </div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11, color: PALETTE.textMid, marginBottom: 18, fontStyle: 'italic', textAlign: 'center' }}>
                Visit Collection and tap any card to summon it with a photo.
              </div>

              <div style={{
                display: 'flex', gap: 10,
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'center',
                maxWidth: 480, margin: '0 auto',
              }}>
                <button onClick={reset} style={{ ...btnSecondary, flex: 1 }}>Open another</button>
                <button onClick={onBack} style={{ ...btnPrimary, flex: 1 }}>Done</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// SECTION HEADING
// =================================================================
function PackSection({
  title, tagline, children,
}: { title: string; tagline: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
        margin: '0 4px 10px',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.2em',
          color: PALETTE.text, textTransform: 'uppercase',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 11, color: PALETTE.textMid, fontStyle: 'italic',
          flex: 1, minWidth: 200, textAlign: 'right',
        }}>
          {tagline}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Grid template used by both element + memory pack sections so they
 * align. Mobile: single column. Desktop: auto-fill 2–3 columns.
 */
function packGridStyle(isDesktop: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: isDesktop
      ? 'repeat(auto-fill, minmax(320px, 1fr))'
      : 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  };
}

// =================================================================
// PACK OPTION CARDS
// =================================================================
/**
 * One element-pack option. Surface is intentionally neutral (paper +
 * border) — the theme identity reads through a small color stripe on
 * the left and the colored glyph, not a full-surface gradient. Keeps
 * the page palette calm so the cinematic + reveal moments pop instead
 * of competing with a wall of saturated swatches.
 */
function ThemePackOption({
  theme, disabled, onClick,
}: { theme: ElementId; disabled: boolean; onClick: () => void }) {
  const e = ELEMENTS[theme];
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      aria-label={`Open ${e.name} pack for ${PACK_COST} coins`}
      style={packOptionShellStyle(disabled, e.color)}
      onPointerDown={(ev) => { if (!disabled) (ev.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.99)'; }}
      onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
      onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 100%)`,
        boxShadow: `0 4px 10px ${e.color}66`,
        display: 'grid', placeItems: 'center',
        color: '#fff', flex: '0 0 auto',
      }} aria-hidden>
        <ElementGlyph el={theme} size={28} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{
          fontSize: 16, fontWeight: 800,
          letterSpacing: '0.02em', color: PALETTE.text,
        }}>{e.name}</div>
        <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2, lineHeight: 1.35 }}>
          {e.blurb}
        </div>
        <PackMeta cost={PACK_COST} themeAccent={e.color} />
      </div>
    </button>
  );
}

/**
 * One memory-pack option. Same neutral shell as the element packs but
 * the icon tile uses the memory-pack gradient and we surface the
 * bonus-filter pill prominently when the player hasn't opened it yet.
 */
function MemoryPackOption({
  def, coins, firstOpen, onClick,
}: { def: MemoryPackDef; coins: number; firstOpen: boolean; onClick: () => void }) {
  const canAfford = coins >= def.cost;
  const filter = FILTERS[def.bonusFilter];
  const [deep, color] = def.gradient;
  return (
    <button
      onClick={canAfford ? onClick : undefined}
      disabled={!canAfford}
      aria-label={`Open ${def.name} memory pack for ${def.cost} coins`}
      style={packOptionShellStyle(!canAfford, color)}
      onPointerDown={(ev) => { if (canAfford) (ev.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.99)'; }}
      onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
      onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: `linear-gradient(135deg, ${deep} 0%, ${color} 100%)`,
        boxShadow: `0 4px 10px ${color}66`,
        display: 'grid', placeItems: 'center',
        color: '#fff', flex: '0 0 auto',
        position: 'relative',
      }} aria-hidden>
        <Package size={22} strokeWidth={2.2} />
        {firstOpen && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            background: def.glow, color: deep,
            fontSize: 8, fontWeight: 900,
            letterSpacing: '0.15em',
            padding: '2px 5px', borderRadius: 6,
            boxShadow: '0 2px 4px rgba(0,0,0,.18)',
          }}>BONUS</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{
          fontSize: 16, fontWeight: 800,
          color: PALETTE.text, letterSpacing: '0.02em',
        }}>{def.name}</div>
        <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2, lineHeight: 1.35 }}>
          {def.blurb}
        </div>
        <div style={{
          marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
          background: firstOpen ? `${def.glow}33` : 'rgba(58,46,42,.08)',
          color: firstOpen ? PALETTE.text : PALETTE.textMid,
          padding: '2px 8px', borderRadius: 8,
          fontSize: 10, fontWeight: 700,
        }}>
          {firstOpen
            ? <><Sparkles size={10} /> Unlocks {filter.name}</>
            : <><Lock size={10} /> {filter.name} already unlocked</>}
        </div>
        <PackMeta cost={def.cost} themeAccent={color} />
      </div>
    </button>
  );
}

/**
 * Shared shell for both pack option buttons. Neutral paper surface with
 * a thin accent stripe on the left so the theme identity reads at a
 * glance without flooding the page with saturated gradients.
 */
function packOptionShellStyle(disabled: boolean, accent: string): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px 14px 18px',
    borderRadius: 16,
    border: `1.5px solid ${PALETTE.border}`,
    background: '#fff',
    color: PALETTE.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    textAlign: 'left',
    transition: 'transform .12s, box-shadow .15s',
    fontFamily: 'inherit',
    boxShadow: `0 4px 12px rgba(58,46,42,.06), inset 4px 0 0 0 ${accent}`,
    minHeight: 88,
    outline: 'none',
  };
}

/**
 * Bottom-of-card meta row — cost, pack size, guaranteed rarity. Three
 * concise chips so the player can compare packs without reading prose.
 */
function PackMeta({ cost, themeAccent }: { cost: number; themeAccent: string }) {
  return (
    <div style={{
      marginTop: 8,
      display: 'flex', gap: 6, flexWrap: 'wrap',
    }}>
      <span style={metaChip} aria-label={`${cost} coins`}>
        <Coins size={11} fill="#ffd166" color="#e8a93a" strokeWidth={2.2} />
        <strong>{cost}</strong>
      </span>
      <span style={metaChip} aria-label={`${PACK_SIZE} cards`}>
        <Shield size={11} strokeWidth={2.4} color={themeAccent} />
        {PACK_SIZE} cards
      </span>
      <span style={{ ...metaChip, background: 'rgba(255, 209, 102, .14)', color: '#7a5414' }} aria-label="One rare or better guaranteed">
        <Star size={11} strokeWidth={2.4} fill="#ffd166" color="#e8a93a" />
        1 rare+
      </span>
    </div>
  );
}

const metaChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 11, fontWeight: 700,
  padding: '3px 9px',
  borderRadius: 9,
  background: 'rgba(58,46,42,.06)',
  color: PALETTE.text,
  whiteSpace: 'nowrap',
};

// =================================================================
// CINEMATIC + REVEAL (unchanged)
// =================================================================
function PackCinematic({ vibe, stage }: { vibe: PackVibe; stage: 'lift' | 'tension' | 'burst' }) {
  const animation =
    stage === 'lift'    ? 'packLift 0.6s cubic-bezier(.18,.85,.3,1.1) both'
  : stage === 'tension' ? 'packLift 0.6s cubic-bezier(.18,.85,.3,1.1) both, packTension 0.32s ease-in-out 0.6s 3'
  :                       'packExplode 0.7s cubic-bezier(.4,.1,.6,1) both';

  return (
    <div style={{ position: 'relative', width: 240, height: 320, display: 'grid', placeItems: 'center' }}>
      {stage === 'burst' && (
        <>
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 240, height: 240, borderRadius: '50%',
            border: `4px solid ${vibe.glow}`,
            animation: 'packShockRing 0.7s ease-out both',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 180, height: 180, borderRadius: '50%',
            background: `radial-gradient(circle, #fff 0%, ${vibe.glow} 35%, transparent 75%)`,
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
                background: `linear-gradient(180deg, ${vibe.glow}, transparent)`,
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
        <PackArt vibe={vibe} />
      </div>

      {(stage === 'lift' || stage === 'tension') && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${vibe.glow}88 0%, transparent 65%)`,
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

function RevealCard({
  card, idx, total, vibe, onTap,
}: { card: CollectionCard; idx: number; total: number; vibe: PackVibe; onTap: () => void }) {
  const showHalo = card.rarity === 'epic' || card.rarity === 'legendary';
  const showSheen = card.rarity !== 'common';
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
            ${card.rarity === 'legendary' ? '#ffd166' : vibe.glow} 0%,
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
        willChange: 'transform, opacity',
      }}>
        <TiltCard
          maxTilt={12}
          hoverScale={1.04}
          shine={showSheen}
        >
          <Card card={card} hovered />
          {showSheen && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0, top: 0,
                width: 220, height: 320,
                overflow: 'hidden',
                borderRadius: 18,
                pointerEvents: 'none',
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,.85) 50%, transparent 70%)',
                animation: 'cardHoloSheen 1.1s ease-out 0.45s both',
                mixBlendMode: 'screen',
              }} />
            </div>
          )}
        </TiltCard>
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

function rarityCue(r: Rarity): Parameters<typeof playSfx>[0] {
  switch (r) {
    case 'common':    return 'rarityCommon';
    case 'rare':      return 'rarityRare';
    case 'epic':      return 'rarityEpic';
    case 'legendary': return 'rarityLegendary';
  }
}

function PackArt({ vibe }: { vibe: PackVibe }) {
  return (
    <div style={{
      width: 200, height: 280,
      borderRadius: 16,
      background: `linear-gradient(135deg, ${vibe.deep} 0%, ${vibe.color} 50%, ${vibe.deep} 100%)`,
      boxShadow: `
        0 18px 40px rgba(0,0,0,.5),
        inset 0 0 0 3px ${vibe.glow},
        inset 0 0 30px ${vibe.glow}55,
        0 0 60px ${vibe.glow}55
      `,
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12,
      transition: 'transform .2s',
    }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase',
        color: vibe.glow, fontFamily: '"Cinzel", Georgia, serif',
      }}>Lifedeck</div>
      <div style={{
        fontSize: 28, fontWeight: 700, fontFamily: '"Cinzel", Georgia, serif',
        color: '#fff', textShadow: `0 0 20px ${vibe.glow}`,
        letterSpacing: '0.05em', textTransform: 'uppercase',
        textAlign: 'center', padding: '0 8px',
      }}>{vibe.title}</div>
      {vibe.icon}
      <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.85 }}>
        {PACK_SIZE} dormant cards
      </div>
    </div>
  );
}
