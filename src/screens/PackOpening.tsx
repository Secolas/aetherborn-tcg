import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Coins, Sparkles, Lock, Star, Cake, Sun, Heart, PawPrint, ChevronUp } from 'lucide-react';
import { Card } from '../components/Card';
import { CardBack } from '../components/CardBack';
import { TiltCard } from '../components/TiltCard';
import { ElementGlyph } from '../components/ElementGlyph';
import { btnPrimary, btnSecondary, iconBtn, PALETTE } from '../components/styles';
import { openPack, openMemoryPack, PACK_COST, PACK_SIZE } from '../game/pack';
import { ELEMENTS, RARITY_COLOR } from '../data/elements';
import { MEMORY_PACKS, type MemoryPackDef } from '../data/memoryPacks';
import { playSfx } from '../audio/sfx';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';
import { useViewport } from '../hooks/useViewport';
import type { CollectionCard, ElementId, Rarity } from '../game/types';

/** Pack-opening cinematic stages.
 *  pick    — booster grid
 *  lift    — pack animates into the centre
 *  tension — pack rattles
 *  unbox   — white slash beam sweeps; pack art dissolves into a
 *            translucent wireframe stack of cards. User swipes up to advance.
 *  stack   — wireframes collapse into a single face-down card back.
 *            User swipes up on the back to begin revealing.
 *  revealing — per-card Y-flip + slide-off-top while the next card
 *              slides in from the bottom. Rare+ cards get a pulse glow
 *              tease before the flip.
 *  done    — pack summary grid.
 */
type Stage = 'pick' | 'lift' | 'tension' | 'unbox' | 'stack' | 'revealing' | 'done';

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

/** What's queued in the confirm bottom sheet — same discriminated
 *  union as PackPick but without the resolved vibe (which we only
 *  build at the moment the cinematic starts). */
type ConfirmPick =
  | { kind: 'theme'; theme: ElementId }
  | { kind: 'memory'; def: MemoryPackDef; firstOpen: boolean };

interface Props {
  coins: number;
  /** Current element-pack legendary pity counter from the save. Passed
   *  into openPack so the guaranteed slot can force a legendary once
   *  the threshold is reached. */
  legendaryPity?: number;
  onPackOpened: (cards: CollectionCard[], coinsSpent: number, newPity: number) => void;
  onMemoryPackOpened?: (packId: string, cards: CollectionCard[], cost: number) => void;
  openedMemoryPacks?: string[];
  onBack: () => void;
  settings?: Settings;
  /** Onboarding gate. Same pattern as Campaign — the pack shop is
   *  hidden behind a "Finish setup first" overlay until the player
   *  has picked a starter (which only happens post-tutorial), so
   *  brand-new players can't burn coins on a shop they don't yet
   *  know how to use. */
  unlocked?: boolean;
  /** Routes the player into Tutorial.tsx when they tap the gate CTA. */
  onStartTutorial?: () => void;
}

/** Only the auto-advancing stages have durations. `unbox`, `stack`,
 *  `revealing`, and `done` are driven by user swipes. */
const STAGE_DURATIONS: Record<'lift' | 'tension', number> = {
  lift: 600,
  tension: 900,
};

export function PackOpening({
  coins, legendaryPity = 0, onPackOpened, onMemoryPackOpened, openedMemoryPacks = [],
  onBack, settings = DEFAULT_SETTINGS,
  unlocked = true, onStartTutorial,
}: Props) {
  // Onboarding gate — render a clean locked view instead of the shop
  // when the player hasn't picked a starter yet. Matches the
  // Campaign screen's gate one-for-one so the player learns the
  // pattern: locked screens explain what to do, in their own words.
  if (!unlocked) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        background: PALETTE.bg,
        color: PALETTE.text,
        fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
        display: 'flex', flexDirection: 'column',
        padding: 24,
      }}>
        <button
          onClick={onBack}
          aria-label="Back to Home"
          style={{
            ...iconBtn,
            alignSelf: 'flex-start',
            marginBottom: 'auto',
          }}
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', gap: 12,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: PALETTE.paper,
            border: `1.5px solid ${PALETTE.border}`,
            display: 'grid', placeItems: 'center',
            color: PALETTE.accent,
            boxShadow: '0 6px 14px rgba(28,24,20,.10)',
            marginBottom: 6,
          }}>
            <Lock size={28} strokeWidth={2.4} />
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10, fontWeight: 800,
            letterSpacing: '0.18em',
            color: PALETTE.accent,
          }}>
            <Sparkles size={12} strokeWidth={2.4} />
            <span>PACK SHOP LOCKED</span>
          </div>
          <div style={{
            fontSize: 24, fontWeight: 800,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}>
            Finish setup first
          </div>
          <div style={{
            fontSize: 13,
            color: PALETTE.textMid,
            lineHeight: 1.5,
            maxWidth: 320,
            marginBottom: 6,
          }}>
            Booster packs unlock once you've finished the tutorial and
            picked a starter deck. Won't take long.
          </div>
          {onStartTutorial && (
            <button
              onClick={onStartTutorial}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '14px 22px',
                background: `linear-gradient(180deg, #ffa07a 0%, ${PALETTE.accent} 60%, ${PALETTE.accentDeep} 100%)`,
                color: '#fff',
                border: 0,
                borderRadius: 999,
                fontFamily: 'inherit',
                fontSize: 15, fontWeight: 800,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(238,90,82,.32)',
              }}
            >
              <Sparkles size={16} strokeWidth={2.4} />
              <span>Begin Tutorial</span>
            </button>
          )}
        </div>
        <div style={{ marginTop: 'auto' }} />
      </div>
    );
  }

  const [stage, setStage] = useState<Stage>('pick');
  const [pick, setPick] = useState<PackPick | null>(null);
  const [pack, setPack] = useState<CollectionCard[]>([]);
  const [revealedIdx, setRevealedIdx] = useState(0);
  /** Pack queued in the confirm bottom sheet. Lets the player review
   *  cost / contents / bonus filter before committing the coins. */
  const [confirming, setConfirming] = useState<ConfirmPick | null>(null);
  const { isMobile, isDesktop } = useViewport();

  const sfxVol = settings.sfxVolume;
  const sfx = (cue: Parameters<typeof playSfx>[0]) => playSfx(cue, sfxVol);

  const canBuyTheme = coins >= PACK_COST;

  useEffect(() => {
    if (stage !== 'lift' && stage !== 'tension') return;
    const dur = STAGE_DURATIONS[stage];
    const next: Stage = stage === 'lift' ? 'tension' : 'unbox';
    const t = setTimeout(() => setStage(next), dur);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (stage === 'tension') sfx('packRip');
    if (stage === 'unbox') sfx('packBurst');
    // Rarity cues fire on flip from inside RevealStack (onSfx), so we
    // intentionally don't ping rarity here — that would double-play
    // for the first card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const buyTheme = (theme: ElementId) => {
    if (!canBuyTheme) return;
    const { cards, pity } = openPack(theme, legendaryPity);
    const e = ELEMENTS[theme];
    const vibe: PackVibe = {
      deep: e.deep, color: e.color, glow: e.glow, title: e.name,
      icon: <ElementGlyph el={theme} size={70} />, el: theme,
    };
    setPick({ kind: 'theme', theme, vibe });
    setPack(cards);
    onPackOpened(cards, PACK_COST, pity);
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
          <>
            <PackShopStyles />
            <div
              className="no-scrollbar"
              style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
                width: '100%',
                padding: isMobile ? '4px 16px 60px' : '0 24px 60px',
              }}
            >
              <div className="ps-page" style={{ maxWidth: stageMax }}>
                {/* Curator's note hero */}
                <section className="ps-featured">
                  <div className="ps-featured-eyebrow">
                    <Sparkles size={12} strokeWidth={2.2} />
                    <span>Curator's pick · this week</span>
                  </div>
                  <div className="ps-featured-body">
                    <div className="ps-featured-copy">
                      <div className="ps-featured-h">
                        A pack is a prompt<span className="dot">.</span>
                      </div>
                      <p className="ps-featured-p">
                        Pick a theme, photograph it this week, and we'll print the cards.
                        Every pack guarantees one rare or better.
                      </p>
                    </div>
                    {/* Mini stack of three memory backs — purely decorative */}
                    <div className="ps-featured-stack" aria-hidden>
                      {MEMORY_PACKS.slice(0, 3).map((p, i) => (
                        <div
                          key={p.id}
                          className={`ps-stack-card s${i}`}
                          style={{ background: `linear-gradient(155deg, ${p.gradient[0]} 0%, ${p.gradient[1]} 100%)` }}
                        >
                          {memoryIcon(p.id, 24)}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Section 1 · Element packs */}
                <header className="ps-sec">
                  <div className="ps-sec-l">
                    <div className="ps-sec-eyebrow">01 · Element packs</div>
                    <div className="ps-sec-title">Photograph a theme</div>
                  </div>
                  <div className="ps-sec-r">
                    Six themes. Pick one, shoot for a week.
                  </div>
                </header>
                <div className="ps-grid">
                  {THEMES.map(theme => (
                    <BoosterElement
                      key={theme}
                      theme={theme}
                      affordable={canBuyTheme}
                      onClick={() => setConfirming({ kind: 'theme', theme })}
                    />
                  ))}
                </div>
                {!canBuyTheme && (
                  <div className="ps-need-coins">
                    Need {PACK_COST} coins. Win matches to earn more.
                  </div>
                )}

                {/* Section 2 · Memory packs */}
                <header className="ps-sec">
                  <div className="ps-sec-l">
                    <div className="ps-sec-eyebrow">02 · Memory packs</div>
                    <div className="ps-sec-title">Curated moments</div>
                  </div>
                  <div className="ps-sec-r">
                    Themed cards that fit the moment.
                  </div>
                </header>
                <div className="ps-grid">
                  {MEMORY_PACKS.map(def => (
                    <BoosterMemory
                      key={def.id}
                      def={def}
                      coins={coins}
                      onClick={() => setConfirming({ kind: 'memory', def, firstOpen: false })}
                    />
                  ))}
                  {/* Locked "coming soon" tile — matches design's Season 2 placeholder. */}
                  <BoosterLocked label="Season 2" sub="more memories soon" />
                </div>

                <footer className="ps-foot">
                  <span>Cards stay yours forever, even across decks.</span>
                </footer>
              </div>
            </div>

            {confirming && (
              <ConfirmSheet
                confirming={confirming}
                coins={coins}
                onClose={() => setConfirming(null)}
                onConfirm={() => {
                  const c = confirming;
                  setConfirming(null);
                  if (c.kind === 'theme') buyTheme(c.theme);
                  else buyMemory(c.def);
                }}
              />
            )}
          </>
        )}

        {pick && (stage === 'lift' || stage === 'tension') && (
          <div style={{ display: 'grid', placeItems: 'center', flex: 1, minHeight: 0 }}>
            <PackCinematic vibe={pick.vibe} stage={stage} />
          </div>
        )}

        {pick && stage === 'unbox' && (
          <div style={{ display: 'grid', placeItems: 'center', flex: 1, minHeight: 0 }}>
            <UnboxStage
              vibe={pick.vibe}
              count={pack.length}
              onAdvance={() => setStage('stack')}
            />
          </div>
        )}

        {pick && stage === 'stack' && (
          <div style={{ display: 'grid', placeItems: 'center', flex: 1, minHeight: 0 }}>
            <StackStage
              vibe={pick.vibe}
              count={pack.length}
              firstRarity={pack[0]?.rarity}
              onAdvance={() => setStage('revealing')}
            />
          </div>
        )}

        {stage === 'revealing' && pick && pack.length > 0 && (
          <div style={{ display: 'grid', placeItems: 'center', flex: 1, minHeight: 0, padding: 16, overflow: 'hidden' }}>
            <RevealStack
              key={revealedIdx}
              cards={pack}
              vibe={pick.vibe}
              idx={revealedIdx}
              onNext={revealNext}
              onSfx={(r) => sfx(rarityCue(r))}
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
// BOOSTER PACKS — element + memory + locked tile
// =================================================================
/**
 * Per-memory-pack lucide icon. The MemoryPackDef shape doesn't carry
 * an icon, so we map by id here — keeps the data file untouched while
 * still giving each pack a thematic glyph on the booster.
 */
function memoryIcon(id: string, size = 56) {
  const props = { size, strokeWidth: 1.8, color: 'rgba(255,255,255,.96)' as const };
  switch (id) {
    case 'birthday':  return <Cake {...props} />;
    case 'vacation':  return <Sun {...props} />;
    case 'pet':       return <PawPrint {...props} />;
    case 'milestone': return <Star {...props} fill="rgba(255,255,255,.96)" />;
    case 'couple':    return <Heart {...props} fill="rgba(255,255,255,.96)" />;
    default:          return <Sparkles {...props} />;
  }
}

/** Element booster — full-surface gradient pack with tear-strip, sigil,
 *  wordmark, and bottom band. The shell + foil + insets are all scoped
 *  to `.bp` in PackShopStyles so the markup stays compact. */
function BoosterElement({
  theme, affordable, onClick,
}: { theme: ElementId; affordable: boolean; onClick: () => void }) {
  const e = ELEMENTS[theme];
  return (
    <button
      className="bp"
      data-disabled={!affordable}
      disabled={!affordable}
      onClick={onClick}
      aria-label={`Open ${e.name} element pack for ${PACK_COST} coins`}
      style={{
        background: `linear-gradient(165deg, ${e.color} 0%, ${e.deep} 100%)`,
      }}
    >
      <div className="bp-tear" aria-hidden>
        <div className="bp-tear-pattern" />
        <div className="bp-tear-label">PULL</div>
      </div>
      <div className="bp-foil" aria-hidden />
      <div className="bp-sigil" aria-hidden>
        <ElementGlyph el={theme} size={56} />
      </div>
      <div className="bp-wordmark">
        <div className="bp-eyebrow">Element pack</div>
        <div className="bp-name">{e.name}</div>
      </div>
      <div className="bp-band">
        <div className="bp-band-l">
          <span>{PACK_SIZE} cards</span>
          <span className="bp-band-dot">·</span>
          <span className="bp-band-rare">1 rare+</span>
        </div>
        <span className="bp-coin">
          <Coins size={11} fill="#ffd166" color="#c08620" strokeWidth={2.2} />
          {PACK_COST}
        </span>
      </div>
    </button>
  );
}

/** Memory booster — same shape, but uses the memory pack's gradient and
 *  same shape as the element boosters above. */
function BoosterMemory({
  def, coins, onClick,
}: { def: MemoryPackDef; coins: number; onClick: () => void }) {
  const canAfford = coins >= def.cost;
  const [hue, hue2] = def.gradient;
  return (
    <button
      className="bp"
      data-disabled={!canAfford}
      disabled={!canAfford}
      onClick={onClick}
      aria-label={`Open ${def.name} memory pack for ${def.cost} coins`}
      style={{
        background: `linear-gradient(155deg, ${hue} 0%, ${hue2} 100%)`,
      }}
    >
      <div className="bp-tear" aria-hidden>
        <div className="bp-tear-pattern" />
        <div className="bp-tear-label">PULL</div>
      </div>
      <div className="bp-foil" aria-hidden />
      <div className="bp-sigil" aria-hidden>
        {memoryIcon(def.id, 56)}
      </div>
      <div className="bp-wordmark">
        <div className="bp-eyebrow">Memory pack</div>
        <div className="bp-name">{def.name}</div>
      </div>
      <div className="bp-band">
        <div className="bp-band-l">
          <span>{PACK_SIZE} cards</span>
          <span className="bp-band-dot">·</span>
          <span className="bp-band-rare">1 rare+</span>
        </div>
        <span className="bp-coin">
          <Coins size={11} fill="#ffd166" color="#c08620" strokeWidth={2.2} />
          {def.cost}
        </span>
      </div>
    </button>
  );
}

/** "Coming soon" placeholder tile that lives at the end of the memory
 *  grid. Same footprint as a booster so the grid stays rhythmic. */
function BoosterLocked({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="bp bp-locked" aria-label={`${label} coming soon`}>
      <div className="bp-locked-icon">
        <Lock size={20} strokeWidth={2.2} color={PALETTE.textLight} />
      </div>
      <div className="bp-locked-name">{label}</div>
      <div className="bp-locked-sub">{sub}</div>
    </div>
  );
}

// =================================================================
// CONFIRM BOTTOM SHEET
// =================================================================
/**
 * Slides up when the player taps a pack — shows the pack's identity
 * card, three quick stats (count, rare guarantee, no-dupes), and a
 * prominent "Open for X coins" CTA. Confirming triggers the existing
 * cinematic; cancel/backdrop dismisses.
 */
function ConfirmSheet({
  confirming, coins, onClose, onConfirm,
}: {
  confirming: ConfirmPick;
  coins: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isMemory = confirming.kind === 'memory';
  const name = isMemory ? confirming.def.name : ELEMENTS[confirming.theme].name;
  const blurb = isMemory ? confirming.def.blurb : ELEMENTS[confirming.theme].blurb;
  const cost = isMemory ? confirming.def.cost : PACK_COST;
  const canAfford = coins >= cost;
  const gradient = isMemory
    ? `linear-gradient(155deg, ${confirming.def.gradient[0]} 0%, ${confirming.def.gradient[1]} 100%)`
    : `linear-gradient(165deg, ${ELEMENTS[confirming.theme].color} 0%, ${ELEMENTS[confirming.theme].deep} 100%)`;

  return (
    <>
      <div className="ps-sheet-bk" onClick={onClose} />
      <div className="ps-sheet" role="dialog" aria-label="Confirm pack open">
        <div className="ps-sheet-grab" />
        <div className="ps-sheet-pack" style={{ background: gradient }} aria-hidden>
          {isMemory
            ? memoryIcon(confirming.def.id, 44)
            : <ElementGlyph el={confirming.theme} size={44} />}
        </div>
        <div className="ps-sheet-eyebrow">{isMemory ? 'Memory pack' : 'Element pack'}</div>
        <div className="ps-sheet-name">{name}</div>
        <div className="ps-sheet-desc">{blurb}</div>
        <div className="ps-sheet-stats">
          <div className="ps-stat">
            <div className="ps-stat-n">{PACK_SIZE}</div>
            <div className="ps-stat-l">cards</div>
          </div>
          <div className="ps-stat">
            <div className="ps-stat-n">≥1</div>
            <div className="ps-stat-l">rare+</div>
          </div>
          <div className="ps-stat">
            <div className="ps-stat-n">0</div>
            <div className="ps-stat-l">dupes</div>
          </div>
        </div>
        <button
          className="ps-sheet-cta"
          onClick={onConfirm}
          disabled={!canAfford}
        >
          <span>{canAfford ? 'Open for' : 'Need more'}</span>
          <span className="ps-sheet-cta-cost">
            <Coins size={13} fill="#ffd166" color="#c08620" strokeWidth={2.2} />
            {cost}
          </span>
        </button>
        <button className="ps-sheet-cancel" onClick={onClose}>Not yet</button>
      </div>
    </>
  );
}

// =================================================================
// SCOPED STYLESHEET FOR THE PICK STAGE
// =================================================================
/**
 * Scoped under `.ps-page` (the pick-stage wrapper). Uses Fredoka +
 * the app's PALETTE so the booster shop reads as the same product
 * as the rest of the app, while still hitting the design's foil-pack
 * silhouettes via gradients + insets + tear strip. The cinematic and
 * reveal stages live below and don't import this stylesheet.
 */
function PackShopStyles() {
  return (
    <style>{`
      .ps-page {
        margin: 0 auto;
        display: flex; flex-direction: column;
        gap: 22px;
        width: 100%;
      }
      @media (min-width: 720px) { .ps-page { gap: 28px; } }
      @media (min-width: 1024px) { .ps-page { gap: 32px; } }

      /* Curator's note hero */
      .ps-featured {
        position: relative;
        background: #fff;
        border: 1px solid ${PALETTE.border};
        border-radius: 22px;
        padding: 18px 20px;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        overflow: hidden;
      }
      .ps-featured::before {
        content: ""; position: absolute; inset: 0;
        background: radial-gradient(ellipse 100% 80% at 100% 0%, ${PALETTE.accent}22, transparent 60%);
        pointer-events: none;
      }
      .ps-featured-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 10px; font-weight: 800; letter-spacing: 0.22em;
        text-transform: uppercase; color: ${PALETTE.accent};
        margin-bottom: 12px;
      }
      .ps-featured-body {
        display: grid; grid-template-columns: 1fr; gap: 18px;
        align-items: center; position: relative;
      }
      @media (min-width: 560px) {
        .ps-featured-body { grid-template-columns: 1fr auto; gap: 24px; }
      }
      .ps-featured-h {
        font-family: inherit; font-weight: 800;
        font-size: 24px; line-height: 1.05;
        letter-spacing: -0.01em;
        color: ${PALETTE.text};
      }
      @media (min-width: 720px) { .ps-featured-h { font-size: 30px; } }
      .ps-featured-h .dot { color: ${PALETTE.accent}; }
      .ps-featured-p {
        margin: 6px 0 0;
        font-size: 13px; line-height: 1.5;
        color: ${PALETTE.textMid};
        max-width: 52ch;
        text-wrap: pretty;
      }
      .ps-featured-stack {
        position: relative; width: 152px; height: 110px;
        flex-shrink: 0;
      }
      .ps-stack-card {
        position: absolute; top: 5px; left: 40px;
        width: 72px; height: 100px; border-radius: 10px;
        display: grid; place-items: center;
        box-shadow:
          0 4px 0 rgba(0,0,0,.10),
          0 14px 24px -8px rgba(0,0,0,.25);
      }
      .ps-stack-card.s0 { transform: rotate(-8deg) translateX(-26px); }
      .ps-stack-card.s1 { transform: rotate(0deg); z-index: 1; }
      .ps-stack-card.s2 { transform: rotate(8deg) translateX(26px); }

      /* Section header */
      .ps-sec {
        display: flex; justify-content: space-between; align-items: flex-end;
        gap: 12px; padding-bottom: 10px;
        border-bottom: 1px solid rgba(58,46,42,.22);
        flex-wrap: wrap;
      }
      .ps-sec-eyebrow {
        font-size: 10px; font-weight: 800; letter-spacing: 0.22em;
        text-transform: uppercase; color: ${PALETTE.textLight};
      }
      .ps-sec-title {
        font-family: inherit; font-weight: 800;
        font-size: 22px; letter-spacing: -0.01em;
        color: ${PALETTE.text}; margin-top: 2px;
      }
      @media (min-width: 720px) { .ps-sec-title { font-size: 26px; } }
      .ps-sec-r {
        font-size: 13px; font-style: italic; color: ${PALETTE.textMid};
        max-width: 32ch; text-align: right; flex: 1; min-width: 220px;
      }

      /* Pack grid — responsive 2 → 3 → 4 columns */
      .ps-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
      }
      @media (min-width: 560px) {
        .ps-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
      }
      @media (min-width: 1024px) {
        .ps-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; }
      }

      .ps-need-coins {
        margin-top: -6px;
        font-size: 11px; color: ${PALETTE.textMid}; opacity: 0.8;
      }

      /* Booster pack */
      .bp {
        position: relative;
        aspect-ratio: 0.72;
        border-radius: 16px;
        border: 0; padding: 0;
        cursor: pointer; color: #fff;
        font-family: inherit;
        overflow: hidden;
        box-shadow:
          0 4px 0 rgba(28,24,20,.08),
          0 14px 28px -10px rgba(28,24,20,.18),
          inset 0 -3px 0 rgba(0,0,0,.22),
          inset 0 1.5px 0 rgba(255,255,255,.18);
        transition: transform .18s cubic-bezier(.2,.7,.2,1), box-shadow .2s;
      }
      .bp:hover { transform: translateY(-4px) rotate(-0.4deg); }
      .bp:active { transform: translateY(-1px); }
      .bp[data-disabled="true"] {
        cursor: not-allowed; opacity: 0.55;
        transform: none;
      }
      .bp[data-disabled="true"]:hover { transform: none; }

      /* Foil sheen overlay */
      .bp-foil {
        position: absolute; inset: 22px 0 0 0;
        background:
          radial-gradient(ellipse 60% 40% at 10% 0%, rgba(255,255,255,.32), transparent 60%),
          radial-gradient(ellipse 60% 60% at 90% 100%, rgba(0,0,0,.22), transparent 60%);
        mix-blend-mode: overlay;
        opacity: 0.85;
        pointer-events: none;
      }

      /* Sigil disc */
      .bp-sigil {
        position: absolute; top: 24%; left: 50%;
        width: 78px; height: 78px;
        transform: translate(-50%, 0);
        border-radius: 50%;
        background: rgba(255,255,255,.10);
        border: 1.5px solid rgba(255,255,255,.22);
        box-shadow: inset 0 0 0 6px rgba(255,255,255,.05);
        display: grid; place-items: center;
      }

      /* Wordmark */
      .bp-wordmark {
        position: absolute;
        left: 12px; right: 12px; bottom: 56px;
        text-align: left;
      }
      .bp-eyebrow {
        font-family: inherit; font-weight: 800;
        font-size: 9px; letter-spacing: 0.22em;
        text-transform: uppercase; opacity: 0.75;
      }
      .bp-name {
        font-family: inherit; font-weight: 800;
        font-size: 20px; letter-spacing: -0.005em;
        margin-top: 2px;
        text-shadow: 0 1px 0 rgba(0,0,0,.18);
        line-height: 1.05;
      }
      @media (min-width: 720px) { .bp-name { font-size: 22px; } }

      /* Tear strip */
      .bp-tear {
        position: absolute; top: 0; left: 0; right: 0;
        height: 22px;
        background: rgba(0,0,0,.18);
        border-bottom: 1.5px dashed rgba(255,255,255,.35);
        display: grid; place-items: center;
        overflow: hidden;
      }
      .bp-tear-pattern {
        position: absolute; inset: 0;
        background: repeating-linear-gradient(90deg,
          transparent 0 6px,
          rgba(255,255,255,.10) 6px 8px);
      }
      .bp-tear-label {
        position: relative;
        font-family: inherit; font-weight: 800;
        font-size: 8px; letter-spacing: 0.35em;
        color: rgba(255,255,255,.65);
      }

      /* Bottom band */
      .bp-band {
        position: absolute; left: 10px; right: 10px; bottom: 10px;
        padding: 7px 10px;
        background: rgba(0,0,0,.32);
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 10px;
        display: flex; justify-content: space-between; align-items: center;
        gap: 8px;
        font-family: inherit; font-weight: 700;
        font-size: 10px; letter-spacing: 0.04em;
      }
      .bp-band-l { display: inline-flex; align-items: center; gap: 5px; color: rgba(255,255,255,.92); }
      .bp-band-dot { opacity: 0.6; }
      .bp-band-rare { color: #ffd96b; }
      .bp-coin {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 8px;
        background: rgba(0,0,0,.30);
        border-radius: 999px;
        font-weight: 800; font-size: 11px;
      }

      /* Bonus chip — first-open memory only */
      .bp-bonus {
        position: absolute; top: 30px; left: 10px;
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 8px;
        background: rgba(0,0,0,.32);
        border: 1px solid rgba(255,255,255,.20);
        border-radius: 999px;
        font-family: inherit; font-weight: 700;
        font-size: 9px; letter-spacing: 0.04em;
        color: rgba(255,255,255,.92);
      }
      .bp-bonus strong { color: #ffd96b; font-weight: 800; }

      /* Locked tile */
      .bp.bp-locked {
        background: #fff7e6;
        border: 1.5px dashed rgba(58,46,42,.22);
        box-shadow: none;
        cursor: default;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 6px;
        color: ${PALETTE.text};
      }
      .bp.bp-locked:hover { transform: none; }
      .bp-locked-icon {
        width: 50px; height: 50px; border-radius: 50%;
        background: #fff;
        border: 1px solid ${PALETTE.border};
        display: grid; place-items: center;
      }
      .bp-locked-name {
        font-family: inherit; font-weight: 800; font-size: 16px;
        color: ${PALETTE.text};
      }
      .bp-locked-sub {
        font-family: inherit; font-weight: 700;
        font-size: 9px; letter-spacing: 0.18em;
        text-transform: uppercase; color: ${PALETTE.textLight};
      }

      /* Footer */
      .ps-foot {
        margin-top: 4px;
        padding: 10px 4px;
        font-style: italic; font-size: 13px;
        color: ${PALETTE.textMid};
        text-align: center;
      }

      /* ==== Confirm bottom sheet ==== */
      .ps-sheet-bk {
        position: absolute; inset: 0;
        background: rgba(28,24,20,.45);
        backdrop-filter: blur(3px);
        z-index: 50;
        animation: psFadeIn .2s ease-out;
      }
      .ps-sheet {
        position: absolute; left: 0; right: 0; bottom: 0;
        background: #fff;
        border-radius: 24px 24px 0 0;
        padding: 12px 22px 26px;
        box-shadow: 0 -16px 40px rgba(0,0,0,.25);
        z-index: 51;
        display: flex; flex-direction: column; align-items: center;
        gap: 8px;
        animation: psSlideUp .25s cubic-bezier(.2,.7,.2,1);
        max-height: 92%;
        overflow-y: auto;
      }
      .ps-sheet-grab {
        width: 36px; height: 4px; border-radius: 2px;
        background: rgba(58,46,42,.22);
        margin: 2px auto 8px;
      }
      .ps-sheet-pack {
        width: 110px; aspect-ratio: 0.72;
        border-radius: 14px;
        display: grid; place-items: center;
        margin-bottom: 6px;
        box-shadow:
          0 4px 0 rgba(0,0,0,.10),
          0 14px 28px -10px rgba(0,0,0,.25),
          inset 0 1.5px 0 rgba(255,255,255,.2);
        color: #fff;
      }
      .ps-sheet-eyebrow {
        font-size: 10px; font-weight: 800; letter-spacing: 0.22em;
        text-transform: uppercase; color: ${PALETTE.accent};
      }
      .ps-sheet-name {
        font-family: inherit; font-weight: 800;
        font-size: 28px; letter-spacing: -0.015em;
        color: ${PALETTE.text};
      }
      .ps-sheet-desc {
        font-size: 13px; font-style: italic; color: ${PALETTE.textMid};
        text-align: center; max-width: 36ch;
        margin-bottom: 4px;
      }
      .ps-sheet-stats {
        display: flex; gap: 18px;
        padding: 12px 20px;
        background: #fff7e6;
        border: 1px solid ${PALETTE.border};
        border-radius: 14px;
        margin: 4px 0;
      }
      .ps-stat { text-align: center; min-width: 50px; }
      .ps-stat-n {
        font-family: inherit; font-weight: 800;
        font-size: 22px; line-height: 1;
        color: ${PALETTE.text};
      }
      .ps-stat-l {
        font-size: 9px; font-weight: 800; letter-spacing: 0.18em;
        text-transform: uppercase; color: ${PALETTE.textLight};
        margin-top: 2px;
      }
      .ps-sheet-bonus {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; color: ${PALETTE.text};
        padding: 6px 10px;
        background: ${PALETTE.accent}1A;
        border-radius: 999px;
      }
      .ps-sheet-bonus strong { color: ${PALETTE.accent}; font-weight: 800; }
      .ps-sheet-cta {
        width: 100%; max-width: 320px;
        margin-top: 8px;
        padding: 14px 22px;
        background: linear-gradient(180deg, #ffa07a 0%, ${PALETTE.accent} 100%);
        color: #fff;
        border: 0; border-radius: 999px;
        font-family: inherit; font-weight: 800;
        font-size: 15px; letter-spacing: 0.02em;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 10px;
        box-shadow: 0 8px 20px rgba(238,90,82,.32);
        transition: transform .12s, box-shadow .12s, filter .12s;
      }
      .ps-sheet-cta:hover { transform: translateY(-1px); filter: brightness(1.04); }
      .ps-sheet-cta:active { transform: translateY(1px); box-shadow: 0 4px 12px rgba(238,90,82,.32); }
      .ps-sheet-cta[disabled] {
        background: ${PALETTE.textLight}; cursor: not-allowed;
        box-shadow: 0 4px 10px rgba(58,46,42,.18); filter: none;
      }
      .ps-sheet-cta-cost {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px;
        background: rgba(0,0,0,.22);
        border-radius: 999px;
        font-family: inherit; font-weight: 800; font-size: 14px;
      }
      .ps-sheet-cancel {
        background: transparent; border: 0;
        font-family: inherit; font-weight: 700;
        font-size: 13px; color: ${PALETTE.textLight};
        cursor: pointer; padding: 6px;
      }

      @keyframes psFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes psSlideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .bp, .bp:hover, .bp:active,
        .ps-sheet, .ps-sheet-bk, .ps-sheet-cta,
        .ps-sheet-cta:hover, .ps-sheet-cta:active {
          animation: none !important;
          transition: none !important;
          transform: none !important;
        }
      }
    `}</style>
  );
}

// =================================================================
// CINEMATIC + REVEAL (unchanged)
// =================================================================
function PackCinematic({ vibe, stage }: { vibe: PackVibe; stage: 'lift' | 'tension' }) {
  const animation = stage === 'lift'
    ? 'packLift 0.6s cubic-bezier(.18,.85,.3,1.1) both'
    : 'packLift 0.6s cubic-bezier(.18,.85,.3,1.1) both, packTension 0.32s ease-in-out 0.6s 3';

  return (
    <div style={{ position: 'relative', width: 240, height: 320, display: 'grid', placeItems: 'center' }}>
      <div style={{ animation, position: 'relative', zIndex: 2 }}>
        <PackArt vibe={vibe} />
      </div>
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
    </div>
  );
}

// =================================================================
// UNBOX — slash beam + wireframe-card cascade. User swipes up to advance.
// =================================================================
/** Threshold for accepting an upward swipe (px or px/s). */
const SWIPE_THRESHOLD_PX = 60;
const SWIPE_THRESHOLD_V = 350;

/** Returns true if the drag-end gesture counts as a deliberate
 *  upward swipe. Matches the same threshold across all three swipe
 *  stages so the gesture feels consistent. */
function isUpSwipe(offset: number, velocity: number) {
  return offset < -SWIPE_THRESHOLD_PX || velocity < -SWIPE_THRESHOLD_V;
}

function UnboxStage({
  vibe, count, onAdvance,
}: { vibe: PackVibe; count: number; onAdvance: () => void }) {
  const [ready, setReady] = useState(false);
  // Hold off accepting swipes until the slash + cascade have finished
  // landing — feels jankier if the user can yank cards through the
  // intro animation.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 750);
    return () => clearTimeout(t);
  }, []);

  return (
    <SwipeUpStage
      enabled={ready}
      promptText={ready ? 'SWIPE TO REVEAL' : undefined}
      onSwipe={onAdvance}
    >
      {/* White slash beam — single horizontal sweep across the upper third. */}
      <div aria-hidden style={{
        position: 'absolute', left: '50%', top: '34%',
        width: 'min(140vw, 700px)', height: 6,
        background: 'linear-gradient(90deg, transparent 0%, #fff 50%, transparent 100%)',
        boxShadow: '0 0 24px 6px rgba(255,255,255,.9)',
        transform: 'translate(-50%, -50%)',
        animation: 'packSlashBeam 0.6s cubic-bezier(.4,.1,.2,1) both',
        pointerEvents: 'none',
        zIndex: 4,
        mixBlendMode: 'screen',
      }} />
      {/* Pack art dissolves out. */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        animation: 'packArtDissolve 0.55s ease-out 0.15s both',
        zIndex: 2,
      }}>
        <PackArt vibe={vibe} />
      </div>
      {/* Wireframe stack cascades in. */}
      <WireframeStack vibe={vibe} count={count} mode="in" />
    </SwipeUpStage>
  );
}

// =================================================================
// STACK — wireframes collapse into a solid back-of-card. User swipes
//         up on the back to begin revealing.
// =================================================================
function StackStage({
  vibe, count, firstRarity, onAdvance,
}: { vibe: PackVibe; count: number; firstRarity?: Rarity; onAdvance: () => void }) {
  // Phase 1: wireframes collapse + back card fades up.
  // Phase 2: back card is stable, prompt fades in, swipe enabled.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCollapsed(true), 520);
    return () => clearTimeout(t);
  }, []);

  const teaseRarity = firstRarity === 'epic' || firstRarity === 'legendary';

  return (
    <SwipeUpStage
      enabled={collapsed}
      promptText={collapsed ? 'SWIPE UP TO COLLECT' : undefined}
      onSwipe={onAdvance}
    >
      {!collapsed && <WireframeStack vibe={vibe} count={count} mode="collapse" />}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        width: 220, height: 320,
        marginLeft: -110, marginTop: -160,
        animation: 'cardBackFadeIn 0.55s cubic-bezier(.2,.8,.3,1.05) 0.2s both',
        zIndex: 3,
      }}>
        {teaseRarity && (
          <RarityAura rarity={firstRarity!} vibe={vibe} />
        )}
        <CardBack scale={1} side="player" />
      </div>
    </SwipeUpStage>
  );
}

// =================================================================
// REVEAL — per-card Y-flip + slide. Driven by user swipes.
// =================================================================
/** One revealed card stays on screen until the user flips it.
 *  Each card has three phases:
 *    'back'    — face-down, awaiting swipe-up flip
 *    'face'    — flipped to face, paused for the player to read
 *    'exiting' — sliding off the top while the next card slides in
 */
type RevealPhase = 'back' | 'face' | 'exiting';

const FACE_PAUSE_MS_BY_RARITY: Record<Rarity, number> = {
  common: 850,
  rare: 1000,
  epic: 1300,
  legendary: 1600,
};

function RevealStack({
  cards, vibe, idx, onNext, onSfx,
}: {
  cards: CollectionCard[];
  vibe: PackVibe;
  idx: number;
  onNext: () => void;
  onSfx: (r: Rarity) => void;
}) {
  const card = cards[idx];
  const total = cards.length;
  // Parent remounts this component on `idx` change via a `key`, so we
  // don't need to manually reset phase — useState's initial value
  // handles it.
  const [phase, setPhase] = useState<RevealPhase>('back');

  // After flip, hold the face up for a beat, then trigger the exit
  // transition. Length scales with rarity so legendaries get a moment.
  useEffect(() => {
    if (phase !== 'face') return;
    const ms = FACE_PAUSE_MS_BY_RARITY[card.rarity];
    const t = setTimeout(() => setPhase('exiting'), ms);
    return () => clearTimeout(t);
  }, [phase, card.rarity]);

  // Once the slide-off finishes, advance to the next card.
  useEffect(() => {
    if (phase !== 'exiting') return;
    const t = setTimeout(onNext, 480);
    return () => clearTimeout(t);
  }, [phase, onNext]);

  const handleFlip = () => {
    if (phase !== 'back') return;
    onSfx(card.rarity);
    setPhase('face');
  };

  const showHalo = card.rarity === 'epic' || card.rarity === 'legendary';
  const showSheen = card.rarity !== 'common';

  return (
    <div style={{
      position: 'relative',
      width: '100%', height: '100%',
      display: 'grid', placeItems: 'center',
      perspective: 1400,
    }}>
      <div style={{
        position: 'absolute', top: 14, left: 0, right: 0,
        textAlign: 'center',
        fontSize: 11, letterSpacing: '0.25em',
        textTransform: 'uppercase',
        color: PALETTE.textMid,
        zIndex: 1,
      }}>
        {idx + 1} / {total}
      </div>

      {/* Slide the NEXT face-down card in from the bottom in parallel
          with the current card sliding off the top. Rendered behind the
          exiting card so the layering reads naturally. */}
      {phase === 'exiting' && idx + 1 < total && (
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          width: 220, height: 320,
          marginLeft: -110, marginTop: -160,
          animation: 'cardSlideInBottom 0.45s cubic-bezier(.2,.8,.3,1.05) both',
          zIndex: 1,
        }}>
          {(cards[idx + 1].rarity === 'epic' || cards[idx + 1].rarity === 'legendary') && (
            <RarityAura rarity={cards[idx + 1].rarity} vibe={vibe} />
          )}
          <CardBack scale={1} side="player" />
        </div>
      )}

      <SwipeableCard
        enabled={phase === 'back'}
        onSwipe={handleFlip}
        style={{
          position: 'relative',
          zIndex: 2,
          animation: phase === 'exiting' ? 'cardSlideOffTop 0.48s cubic-bezier(.5,0,.7,.4) both' : undefined,
        }}
      >
        {/* Flip container. Y-rotates 180deg on flip; the back is shown
            at 0deg and the face at 180deg via backface-visibility. */}
        <div style={{
          position: 'relative',
          width: 220, height: 320,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.55s cubic-bezier(.4,.1,.2,1)',
          transform: phase === 'back' ? 'rotateY(0deg)' : 'rotateY(180deg)',
        }}>
          {/* Pulsing rare/epic/legendary aura — only shown pre-flip, as a tease. */}
          {showHalo && phase === 'back' && (
            <RarityAura rarity={card.rarity} vibe={vibe} pulsing />
          )}
          {/* BACK face */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}>
            <CardBack scale={1} side="player" />
          </div>
          {/* FRONT face — rotated 180 so it shows when parent flips. */}
          <div style={{
            position: 'absolute', inset: 0,
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            display: 'grid', placeItems: 'center',
          }}>
            <TiltCard maxTilt={phase === 'face' ? 12 : 0} hoverScale={1.04} shine={showSheen}>
              <Card card={card} hovered />
              {showSheen && phase === 'face' && (
                <div aria-hidden style={{
                  position: 'absolute', left: 0, top: 0,
                  width: 220, height: 320,
                  overflow: 'hidden', borderRadius: 18,
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,.85) 50%, transparent 70%)',
                    animation: 'cardHoloSheen 1.1s ease-out 0.2s both',
                    mixBlendMode: 'screen',
                  }} />
                </div>
              )}
            </TiltCard>
          </div>
        </div>
      </SwipeableCard>

      {phase === 'back' && (
        <div style={{
          position: 'absolute', bottom: 24, left: 0, right: 0,
          textAlign: 'center', pointerEvents: 'none',
          color: PALETTE.text,
        }}>
          <ChevronUp size={22} strokeWidth={2.4} style={{
            animation: 'swipeHintNudge 1.4s ease-in-out infinite',
          }} />
          <div style={{
            fontSize: 11, letterSpacing: '0.3em',
            textTransform: 'uppercase', fontWeight: 700,
            opacity: 0.7, marginTop: 4,
          }}>
            Swipe up to flip
          </div>
        </div>
      )}

      {phase === 'face' && (
        <div style={{
          position: 'absolute', bottom: 28, left: 0, right: 0,
          textAlign: 'center', pointerEvents: 'none',
          fontSize: 11, letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: RARITY_COLOR[card.rarity],
          fontWeight: 800,
          textShadow: card.rarity === 'legendary' ? '0 0 12px rgba(255, 209, 102, .6)' : 'none',
          animation: 'fadeIn 0.35s ease-out both',
        }}>
          {card.rarity}
        </div>
      )}
    </div>
  );
}

// =================================================================
// SWIPE GESTURE — shared between unbox / stack / per-card reveal.
// =================================================================
/** Full-stage swipe area: any upward drag inside the container counts.
 *  Used for the unbox + stack stages, where the whole screen is the
 *  swipe target rather than the card itself. */
function SwipeUpStage({
  enabled, promptText, onSwipe, children,
}: {
  enabled: boolean;
  promptText?: string;
  onSwipe: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', perspective: 1400 }}>
      <motion.div
        drag={enabled ? 'y' : false}
        dragConstraints={{ top: -120, bottom: 40 }}
        dragElastic={0.25}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (enabled && isUpSwipe(info.offset.y, info.velocity.y)) onSwipe();
        }}
        onClick={() => { if (enabled) onSwipe(); }}
        style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          touchAction: 'pan-x',
          cursor: enabled ? 'pointer' : 'default',
        }}
      >
        {children}
      </motion.div>
      {promptText && (
        <div style={{
          position: 'absolute', bottom: 24, left: 0, right: 0,
          textAlign: 'center', pointerEvents: 'none',
          color: PALETTE.text,
          zIndex: 5,
          animation: 'fadeIn 0.4s ease-out both',
        }}>
          <ChevronUp size={22} strokeWidth={2.4} style={{
            animation: 'swipeHintNudge 1.4s ease-in-out infinite',
          }} />
          <div style={{
            fontSize: 11, letterSpacing: '0.3em',
            textTransform: 'uppercase', fontWeight: 700,
            opacity: 0.7, marginTop: 4,
          }}>
            {promptText}
          </div>
        </div>
      )}
    </div>
  );
}

/** Local swipe target — the card itself moves with the drag and
 *  snaps back if the swipe doesn't clear the threshold. Tap also
 *  triggers the swipe action, so desktop / accessibility users
 *  don't have to drag. */
function SwipeableCard({
  enabled, onSwipe, children, style,
}: {
  enabled: boolean;
  onSwipe: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      drag={enabled ? 'y' : false}
      dragConstraints={{ top: -100, bottom: 30 }}
      dragElastic={0.3}
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        if (enabled && isUpSwipe(info.offset.y, info.velocity.y)) onSwipe();
      }}
      onClick={() => { if (enabled) onSwipe(); }}
      style={{ touchAction: 'pan-x', cursor: enabled ? 'pointer' : 'default', ...style }}
    >
      {children}
    </motion.div>
  );
}

// =================================================================
// WIREFRAME STACK + CARD BACK + RARITY AURA — shared visuals.
// =================================================================
/** Translucent wireframe cards arranged as a clean stacked deck.
 *  Cards recede in depth (smaller + slightly higher peek so the player
 *  sees each top edge), no horizontal fan and no rotation — that's what
 *  was reading as "skewed" before.
 *  `mode="in"` cascades them into place; `mode="collapse"` slides them
 *  down to a single aligned stack and fades them out as the solid back
 *  card takes over. */
function WireframeStack({
  vibe, count, mode,
}: { vibe: PackVibe; count: number; mode: 'in' | 'collapse' }) {
  // Cap the visible stack at 5 wireframes — past that the depth reads
  // as visual noise.
  const visible = Math.min(count, 5);
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'grid', placeItems: 'center',
      pointerEvents: 'none',
      zIndex: 3,
    }}>
      {Array.from({ length: visible }).map((_, i) => {
        // depth = 0 (front) .. 1 (back)
        const depth = i / Math.max(1, visible - 1);
        // Back cards slightly smaller AND shifted slightly UP so each
        // top edge peeks above the card in front — gives the read of
        // "stack of cards" without skewing or fanning.
        const scale = 1 - depth * 0.06;
        const peek = -depth * 10;
        const delay = mode === 'in' ? (visible - 1 - i) * 0.06 : i * 0.04;
        const anim = mode === 'in'
          ? `wireframeCardIn 0.45s cubic-bezier(.2,.8,.3,1.05) ${delay}s both`
          : `wireframeCollapse 0.45s cubic-bezier(.4,.1,.2,1) ${delay}s both`;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: 220, height: 320,
              marginTop: -160, marginLeft: -110, // center the card on (50%, 50%)
              borderRadius: 18,
              border: `1.5px solid ${vibe.glow}`,
              boxShadow: `0 0 24px ${vibe.glow}55, inset 0 0 18px ${vibe.glow}33`,
              opacity: 1 - depth * 0.25,
              ['--scale' as string]: String(scale),
              ['--peek' as string]: `${peek}px`,
              animation: anim,
              // Cross-hatch wireframe pattern.
              backgroundImage: `
                linear-gradient(135deg, ${vibe.glow}18 0%, ${vibe.glow}06 100%),
                linear-gradient(0deg,   ${vibe.glow}44 1px, transparent 1px),
                linear-gradient(90deg,  ${vibe.glow}44 1px, transparent 1px)
              `,
              backgroundSize: '100% 100%, 100% 28px, 28px 100%',
            }}
          />
        );
      })}
    </div>
  );
}

/** Pulsing aura behind a face-down card, signalling a rare pull
 *  before the flip happens. `pulsing` makes it breathe; without it
 *  the aura is static (used during the slide-in transition where a
 *  pulse on a moving target reads as jitter). */
function RarityAura({
  rarity, vibe, pulsing = false,
}: { rarity: Rarity; vibe: PackVibe; pulsing?: boolean }) {
  const color = rarity === 'legendary' ? '#ffd166' : rarity === 'epic' ? '#c084fc' : vibe.glow;
  return (
    <div aria-hidden style={{
      position: 'absolute', left: '50%', top: '50%',
      width: 360, height: 360, borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
      transform: 'translate(-50%, -50%)',
      animation: pulsing ? 'rarityPulseGlow 1.6s ease-in-out infinite' : undefined,
      opacity: pulsing ? undefined : 0.5,
      pointerEvents: 'none',
      mixBlendMode: 'screen',
      zIndex: 0,
    }} />
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
      }}>Memoria</div>
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
