import { useMemo, useRef, useState, useEffect, type CSSProperties, type ComponentType } from 'react';
import { Heart, Briefcase, PawPrint, Plane, UtensilsCrossed, GraduationCap } from 'lucide-react';
import { ELEMENTS } from '../data/elements';
import {
  UserRound, Flag, Swords, Target, ShieldHalf, Zap, Snowflake, Ban,
  Users, Flame, Lock, ChevronDown,
} from 'lucide-react';
import { PackCinematic, type PackVibe } from './PackOpening';
import { ElementGlyph } from '../components/ElementGlyph';
import { iconBtn } from '../components/styles';
import { BattlefieldCard } from '../components/BattlefieldCard';
import { Portrait, ManaCrystals, EmoteBubble, GraveyardButton, TurnChip } from './MatchBoard';
import { CosmeticsProvider } from '../state/cosmetics';
import { getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import type { BattleCard, ElementId } from '../game/types';

/** Per-theme art glyph. Matches the in-game ElementGlyph icon set so the
 *  landing page reads as native to the rest of the app — paws for
 *  Animals, briefcase for Work, heart for Family, etc. */
const THEME_ICON: Record<ElementId, ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>> = {
  family:    Heart,
  work:      Briefcase,
  animals:   PawPrint,
  travel:    Plane,
  food:      UtensilsCrossed,
  education: GraduationCap,
};

/** Marketing landing page for Memoria. Scrollable, mobile-first, with a
 *  Balantix-style tactile feel:
 *    - 3D mouse-tilt foil hero card with pointer-tracked sheen
 *    - Prismatic rainbow shiny overlay (animated)
 *    - Idle "breathing" float on supporting cards
 *    - Infinite "Live captures" ticker marquee
 *    - Embedded sign-in / sign-up form
 */
interface LandingPageProps {
  /** Called when the user taps any CTA that should hand them over to
   *  the auth flow. The mode tells the Login screen which form to
   *  mount in — 'signup' for "Begin your album", 'signin' for the
   *  topbar "Sign in" chip. */
  onEnterApp: (mode: 'signin' | 'signup') => void;
}

export function LandingPage({ onEnterApp }: LandingPageProps) {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      // Match the in-game palette — same cream paper (#fef8f0) the
      // HomeMenu sits on, with a soft peach radial in the top-right
      // for a touch of depth. Dark text (#3a2e2a) is set per-element
      // because the floating dark TCG cards still need white text.
      background: 'radial-gradient(ellipse at 80% 0%, #ffe8d6 0%, #fef8f0 55%, #fef8f0 100%)',
      color: '#3a2e2a',
    }}>
      <LandingStyles />
      <WarmDecor />

      {/* Sticky top bar — always reachable Sign In */}
      <div className="landing-topbar">
        <div className="landing-topbar-brand">
          <img src="/logo.png" alt="" width={28} height={28} />
          <span>MEMORIA</span>
        </div>
        <button className="landing-topbar-btn" onClick={() => onEnterApp('signin')}>
          Sign in
        </button>
      </div>

      {/* Scroll container — every panel below stacks vertically */}
      <div className="landing-scroll">

        <HeroSection onCta={() => onEnterApp('signup')} onSignIn={() => onEnterApp('signin')} />

        <PitchSection />

        <GameplayPreview />

        <AbilitiesSection />

        <BondsSection />

        <ThemeGrid />

        <SpellsSection />

        <PackOpeningPreview />

        <GameModesSection />

        <LiveTicker />

        <PrivacyBlock />

        <FAQSection />

        {/* Pre-footer conversion CTA — once the FAQ has knocked down
            the last objections, surface one more "Begin your album"
            button so the user doesn't have to scroll back up to
            convert. The auth form itself lives on its own Login
            screen now; this CTA hands off to it. */}
        <FinalCta onEnterApp={onEnterApp} />

        <LandingFooter />

      </div>
    </div>
  );
}

// ============================================================================
// Hero — interactive 3D foil card + idle floating supporting cards
// ============================================================================

/** Showcase card per theme — one signature card pulled directly from
 *  templates.ts so the landing page tells the truth about stats /
 *  rarity / ability. Picked for iconic-ness:
 *    family    → Mom            (fam-05, rare, vanilla)
 *    animals   → Lion           (ani-12, legendary, AoE on play)
 *    work      → The Boss       (wrk-12, legendary, Taunt)
 *    travel    → Mountain Summit (trv-12, legendary, Rush)
 *    food      → The Cook       (fd-11,  epic,      heal all friendlies)
 *    education → Graduation Day (edu-12, legendary, theme-buff on play)
 */
const HERO_DATA: Record<ElementId, Omit<HoloCardProps, 'el'>> = {
  family: {
    name: 'Mom', type: 'Creature', rarity: 'rare',
    cost: 3, atk: 3, hp: 4,
    ability: '',
    flavor: 'She just shows up when you need her.',
  },
  animals: {
    name: 'Lion', type: 'Creature', rarity: 'legendary',
    cost: 6, atk: 6, hp: 6,
    ability: 'On play: deal 1 to all enemy creatures.',
    flavor: 'Apex predator.',
  },
  work: {
    name: 'The Boss', type: 'Creature', rarity: 'legendary',
    cost: 6, atk: 5, hp: 6,
    ability: 'Taunt.',
    flavor: 'Everyone has to deal with the Boss first.',
  },
  travel: {
    name: 'Mountain Summit', type: 'Creature', rarity: 'legendary',
    cost: 6, atk: 6, hp: 5,
    ability: 'Rush.',
    flavor: 'You made it to the top.',
  },
  food: {
    name: 'The Cook', type: 'Creature', rarity: 'epic',
    cost: 4, atk: 3, hp: 4,
    ability: 'On play: heal each of your creatures +1 HP.',
    flavor: 'They taste-tested every plate.',
  },
  education: {
    name: 'Graduation Day', type: 'Creature', rarity: 'legendary',
    cost: 6, atk: 4, hp: 5,
    ability: 'On play: give each of your Education-type creatures +1/+1.',
    flavor: 'You made it. Now what?',
  },
};

/** Slot positions for the floating theme cards around the hero. Only
 *  the four corner slots are used — a fifth top-center slot tested
 *  earlier sat directly behind the hero card and crashed into it on
 *  hover. With six themes total and one active in the center, this
 *  means one theme rotates out of view at any given time; clicking
 *  another card cycles it back in. */
const FLOATING_SLOTS: { left: string; top: string; rot: number; delay: number }[] = [
  { left: '2%',  top: '6%',  rot: -12, delay: 0   },
  { left: '76%', top: '12%', rot:  10, delay: 1.4 },
  { left: '78%', top: '68%', rot:  -6, delay: 0.7 },
  { left: '0%',  top: '62%', rot:   5, delay: 2.1 },
];

const ALL_THEMES: ElementId[] = ['family', 'animals', 'work', 'travel', 'food', 'education'];

function HeroSection({ onCta, onSignIn }: { onCta: () => void; onSignIn: () => void }) {
  const [activeEl, setActiveEl] = useState<ElementId>('family');
  const heroData = HERO_DATA[activeEl];
  const others = ALL_THEMES.filter(e => e !== activeEl);

  return (
    <section className="landing-hero">
      <div className="landing-hero-inner">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow">A PHOTO TCG</div>
          <h1 className="landing-h1">
            You don't earn art.<br />
            <span className="landing-h1-accent">You make it.</span>
          </h1>
          <p className="landing-lede">
            Every card arrives dormant — stats only, no picture.
            Summon them by photographing the real moments of your life.
            Your dog wakes up as a 2/4 Taunt. Your morning coffee becomes a +2/+2 buff for the team. The photo of your grandma? A 2/6 Abuela who refuses to fall.
          </p>
          <p className="landing-hint">
            Tap any card to bring it forward.
          </p>
          <div className="landing-cta-row">
            <button className="landing-cta-primary" onClick={onCta}>
              Begin your album →
            </button>
            <button className="landing-cta-ghost" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        </div>

        <div className="landing-hero-stage">
          {/* Four corner slots ring the hero. With 6 themes and 1
              active, one theme is always off-screen until the player
              cycles to it by tapping a visible card. */}
          {others.slice(0, FLOATING_SLOTS.length).map((el, i) => {
            const slot = FLOATING_SLOTS[i];
            return (
              <FloatingShowcaseCard
                key={el}
                el={el}
                left={slot.left}
                top={slot.top}
                rot={slot.rot}
                delay={slot.delay}
                onClick={() => setActiveEl(el)}
              />
            );
          })}

          {/* The interactive hero card — re-mounted on activeEl change
              so the flip-in entrance animation plays for each new card. */}
          <HoloCard
            key={activeEl}
            el={activeEl}
            {...heroData}
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// HoloCard — the 3D tilt + foil + prismatic showcase card
// ============================================================================

interface HoloCardProps {
  el: ElementId;
  name: string;
  type: 'Creature' | 'Spell';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  cost: number;
  atk: number;
  hp: number;
  flavor: string;
  ability?: string;
}

function HoloCard({ el, name, type, rarity, cost, atk, hp, flavor, ability }: HoloCardProps) {
  const def = ELEMENTS[el];
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; px: number; py: number; active: boolean }>({
    rx: 0, ry: 0, px: 50, py: 50, active: false,
  });

  // Map pointer position inside the card to a tilt + sheen origin.
  // Corner tilt caps at ~14 deg either side — enough to feel chunky
  // without crossing into uncanny territory.
  const update = (clientX: number, clientY: number) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const dx = (clientX - rect.left) / rect.width - 0.5;
    const dy = (clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: -dy * 18,
      ry: dx * 18,
      px: (dx + 0.5) * 100,
      py: (dy + 0.5) * 100,
      active: true,
    });
  };
  const reset = () => setTilt({ rx: 0, ry: 0, px: 50, py: 50, active: false });

  return (
    <div className="holo-wrap"
      onMouseMove={(e) => update(e.clientX, e.clientY)}
      onMouseLeave={reset}
      onTouchMove={(e) => {
        const t = e.touches[0]; if (t) update(t.clientX, t.clientY);
      }}
      onTouchEnd={reset}
    >
      <div
        ref={ref}
        className="holo-card"
        style={{
          transform: `perspective(1000px) rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg) scale(${tilt.active ? 1.04 : 1})`,
          transition: tilt.active ? 'transform 80ms ease-out' : 'transform 600ms cubic-bezier(.2,1,.3,1)',
          background: `linear-gradient(160deg, ${def.color} 0%, ${def.deep} 100%)`,
          borderColor: def.glow,
          // Warm-tinted drop shadow so the hero card lifts off the
          // cream page without leaving a harsh inky silhouette.
          boxShadow: `0 28px 56px rgba(58, 46, 42, .28), 0 0 40px ${def.glow}66`,
        }}
      >
        {/* Top bar: cost gem + element name + rarity chip.
            Rarity color comes from the in-game palette range so a
            "legendary" card on the landing reads the same as one in
            the collection. */}
        <div className="holo-toprow">
          <div className="holo-cost" style={{ background: def.glow, color: def.deep }}>{cost}</div>
          <div className="holo-element">{def.name}</div>
          <div className={`holo-rarity rar-${rarity}`}>{rarity}</div>
        </div>

        {/* Art window — themed photo placeholder. The lucide icon
            matches the in-game ElementGlyph so a Family card carries
            a heart, Animals carries paws, Work a briefcase, etc. */}
        <div className="holo-art">
          <div className="holo-art-bg" style={{
            background: `radial-gradient(ellipse at 50% 35%, ${def.glow}cc 0%, ${def.deep} 70%)`,
          }} />
          <div className="holo-art-icon">
            <ThemeIcon el={el} size={96} />
          </div>
        </div>

        {/* Foil sheen — pointer-tracked radial highlight. Sits above the
            art so the gloss appears to ride on the card surface. */}
        <div className="holo-sheen" style={{
          opacity: tilt.active ? 0.9 : 0,
          background: `radial-gradient(circle at ${tilt.px}% ${tilt.py}%,
            rgba(255,255,255,.7) 0%,
            rgba(255,255,255,.25) 20%,
            transparent 55%)`,
        }} />

        {/* Prismatic rainbow shiny overlay. Two stacked gradients with
            mix-blend-mode and animated background-position give the
            iridescent "rainbow shifts as it moves" feel. The pointer
            tilt amplifies it by shifting the gradient origin. */}
        <div className="holo-prismatic" style={{
          opacity: tilt.active ? 0.55 : 0.32,
          backgroundPosition: `${tilt.px}% ${tilt.py}%, ${100 - tilt.px}% ${100 - tilt.py}%`,
        }} />

        {/* Name banner */}
        <div className="holo-name">{name}</div>

        {/* Ability line (mechanical text) — only rendered if the card
            actually has one. Vanilla creatures (e.g. Mom) skip it. */}
        {ability && <div className="holo-ability">{ability}</div>}

        {/* Flavor */}
        <div className="holo-flavor">{flavor}</div>

        {/* Footer stat ribbon. Creatures show ⚔ ATK / ♥ HP — the two
            numbers that drive combat. Spells don't have those, so the
            footer collapses to a single "SPELL" chip. */}
        <div className="holo-footer">
          <div className="holo-type">{type}</div>
          {type === 'Creature' ? (
            <div className="holo-stats">
              <span className="holo-stat" title={`${atk} attack`}>
                <span className="holo-stat-icon">⚔</span>
                <span className="holo-atk">{atk}</span>
                <span className="holo-stat-label">ATK</span>
              </span>
              <span className="holo-stat" title={`${hp} health`}>
                <span className="holo-stat-icon">♥</span>
                <span className="holo-hp">{hp}</span>
                <span className="holo-stat-label">HP</span>
              </span>
            </div>
          ) : (
            <div className="holo-stats">
              <span className="holo-stat-label" style={{ letterSpacing: 2 }}>SPELL</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Themed art icon for the hero card's photo window. Uses the same
 *  lucide-react icons the in-game ElementGlyph uses, so the landing
 *  page art reads as native to the rest of the app. */
function ThemeIcon({ el, size = 88 }: { el: ElementId; size?: number }) {
  const Icon = THEME_ICON[el];
  return <Icon size={size} color="#fff" strokeWidth={1.6} fill="rgba(255,255,255,.9)" />;
}

// ============================================================================
// Floating idle card — decorative, bobs in place, has rainbow shimmer
// ============================================================================

function FloatingShowcaseCard(props: {
  el: ElementId; top: string; left: string; rot: number; delay: number;
  onClick?: () => void;
}) {
  const def = ELEMENTS[props.el];
  // Per-card jitter is randomized once at mount so the float animation
  // doesn't reset to a new path on every render.
  const { dx, dy, spin } = useMemo(() => ({
    dx: (Math.random() * 24 - 12).toFixed(1) + 'px',
    dy: (Math.random() * 24 - 12).toFixed(1) + 'px',
    spin: (Math.random() * 6 - 3).toFixed(1) + 'deg',
  }), []);
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="landing-floating"
      aria-label={`Bring ${def.name} forward`}
      style={{
        position: 'absolute', top: props.top, left: props.left,
        width: 110, height: 158,
        ['--rot' as string]: `${props.rot}deg`,
        ['--dx' as string]: dx,
        ['--dy' as string]: dy,
        ['--spin' as string]: spin,
        ['--card-delay' as string]: `${props.delay}s`,
        borderRadius: 12,
        background: `linear-gradient(160deg, ${def.color} 0%, ${def.deep} 100%)`,
        border: `1.5px solid ${def.glow}`,
        // Softer shadow now that the page is cream — a dark
        // saturated drop shadow would look harsh against paper.
        boxShadow: `0 14px 28px rgba(58, 46, 42, .22), 0 0 22px ${def.glow}44`,
        padding: 9,
        display: 'flex', flexDirection: 'column',
        cursor: 'pointer',
        overflow: 'hidden',
        color: '#fff',
        textAlign: 'left',
        font: 'inherit',
      } as CSSProperties}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
        {def.name}
      </div>
      <div style={{
        flex: 1, margin: '6px 0', borderRadius: 6,
        background: `radial-gradient(ellipse at center, ${def.glow}cc 0%, transparent 70%)`,
        display: 'grid', placeItems: 'center',
        color: '#fff',
      }}>
        <ThemeIcon el={props.el} size={42} />
      </div>
      <div style={{
        fontSize: 9, lineHeight: 1.3,
        color: 'rgba(255,255,255,.85)', fontStyle: 'italic',
        textShadow: '0 1px 2px rgba(0,0,0,.4)',
      }}>
        {def.blurb}
      </div>
      {/* Subtle prismatic flow on every floating card — soft so it
          doesn't compete with the hero card's brighter shine */}
      <div className="landing-floating-prism" />
    </button>
  );
}

// ============================================================================
// Pitch — three small how-it-works cards
// ============================================================================

function PitchSection() {
  const steps = [
    { n: '1', title: 'Open packs', body: 'Three cards per pack. All dormant. Stats, abilities, no picture.' },
    { n: '2', title: 'Snap to summon', body: 'Photograph something real. Your dog. The succulent on your desk. The card wakes up.' },
    { n: '3', title: 'Battle', body: 'Build a deck of summoned cards. Fight bosses or other players online.' },
  ];
  return (
    <section className="landing-pitch">
      <div className="landing-section-title">
        <span>How it works</span>
      </div>
      <div className="landing-pitch-grid">
        {steps.map((s) => (
          <div key={s.n} className="landing-pitch-card">
            <div className="landing-pitch-num">{s.n}</div>
            <div className="landing-pitch-title">{s.title}</div>
            <div className="landing-pitch-body">{s.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Gameplay preview — reuses the actual in-game BattlefieldCard component
// so the demo is pixel-identical to a real match. A state machine cycles
// through the same lunge → impact → damage popup → dying sequence the
// engine triggers when one creature attacks another. No engine code is
// shipped to the landing — we just toggle the visual props the
// BattlefieldCard already exposes (`lunging`, `impact`, `damage`,
// `dying`). After the defender dies it's remounted with a fresh key so
// the cardSlam summon animation plays on the next loop.
// ============================================================================

type GpPhase = 'rest' | 'lunge' | 'impact' | 'dying' | 'empty';

/** Phase timings, in ms. Picked to line up with BattlefieldCard's
 *  internal keyframes plus the flyToGrave overlay: lungeUp is 750ms,
 *  the impact burst is 800ms, and the flyToGrave keyframe (the card
 *  arcing into the graveyard) runs 1.1s. The dying phase has to
 *  cover that flight or the wrapper unmounts mid-air. */
const GP_SCHEDULE: { phase: GpPhase; ms: number }[] = [
  { phase: 'rest',   ms: 1400 },
  { phase: 'lunge',  ms: 750  },
  { phase: 'impact', ms: 250  },
  { phase: 'dying',  ms: 1200 },
  { phase: 'empty',  ms: 600  },
];

/** Match's TURN_LIMIT — kept in lockstep with src/game/match.ts. We
 *  don't import the constant to avoid pulling the whole engine module
 *  into the landing chunk; 12 is the published default. */
const GP_TURN_LIMIT = 12;

/** Build a `BattleCard` from a template id plus a fresh `battleId`.
 *  Hard-coded everything BattlefieldCard reads — no engine running
 *  here. `justPlayed: false` so neither creature renders the sleeping
 *  moon overlay; the demo treats both as already-awake board state.
 *  cardSlam (the summon-dust animation) fires once on first mount of
 *  the component and never again, because we keep the BattlefieldCards
 *  permanently mounted across loop cycles. */
function makeDemoBattleCard(templateId: string, battleId: string): BattleCard {
  const tpl = getTemplateById(templateId)!;
  return {
    ...tpl,
    uid: battleId,
    photo: aiPhoto(templateId),
    battleId,
    currentAtk: tpl.atk,
    currentHp: tpl.hp,
    tapped: false,
    justPlayed: false,
    frozen: false,
  };
}

function GameplayPreview() {
  const [phase, setPhase] = useState<GpPhase>('rest');
  // Bumps the moment the defender takes lethal damage. Re-keys the
  // EmoteBubble so its in/out animation replays — Mom reacts "Oops…"
  // every time her creature gets killed, and the player throws back
  // a "Nice!" on the same beat.
  const [oppEmoteKey, setOppEmoteKey] = useState(0);
  const [playerEmoteKey, setPlayerEmoteKey] = useState(0);
  // Re-keys the opponent's graveyard chip so the gravePulse animation
  // plays each time a card lands in the bin.
  const [graveCount, setGraveCount] = useState(0);
  const [gravePulseKey, setGravePulseKey] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idx = 0;
    const tick = () => {
      const step = GP_SCHEDULE[idx];
      setPhase(step.phase);
      // On the impact beat: Mom's "Oops…" + the player's "Nice!"
      // emote both pop, the opponent graveyard count bumps, and the
      // grave-chip's pulse keyframe replays.
      if (step.phase === 'impact') {
        setOppEmoteKey(k => k + 1);
        setPlayerEmoteKey(k => k + 1);
        setGraveCount(c => c + 1);
        setGravePulseKey(k => k + 1);
      }
      timer = setTimeout(() => {
        idx = (idx + 1) % GP_SCHEDULE.length;
        tick();
      }, step.ms);
    };
    tick();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  // Dog (2/4, animals) attacks Cousin (2/2, family). Dog deals 2 →
  // Cousin dies in one hit, but Cousin's 2 atk counter-hits Dog so
  // Dog drops 4 → 2 hp. Cousin is Mom's thematic minion. Both
  // creatures are memoized once and never re-mounted, so cardSlam
  // only plays once (on initial scroll-into-view), not on every loop.
  // Both creatures are mounted once and stay across every loop —
  // keeping them stable suppresses the cardSlam summon animation on
  // each cycle. The user reads "Cousin was already on the board"
  // instead of "Mom just played Cousin again". The wrapper's
  // flyToGrave animation visually clears the defender during dying,
  // and removing that animation on the next 'rest' phase silently
  // restores it.
  const attacker = useMemo(() => makeDemoBattleCard('ani-05', 'gp-attacker'), []);
  const defender = useMemo(() => makeDemoBattleCard('fam-02', 'gp-defender'), []);

  const isLunging = phase === 'lunge';
  const isImpact  = phase === 'impact';
  const isDying   = phase === 'dying' || phase === 'impact';
  const damage    = phase === 'impact' || phase === 'dying' ? 2 : null;

  // Counter-damage from the trade. Dog (2/4) hits Cousin (2/2):
  // Cousin dies to Dog's 2 atk, but Dog also takes Cousin's 2 atk
  // back. Reflect that on the attacker — drop currentHp from 4 → 2
  // through impact/dying/empty, and show the matching damage popup
  // on the same beat. Loop wraps to 'rest' which restores 4/4 (next
  // turn: Mom plays a fresh minion, Dog comes in healed).
  const attackerDamaged = phase !== 'rest' && phase !== 'lunge';
  const attackerHp = attackerDamaged ? 2 : 4;
  const attackerDmg = phase === 'impact' || phase === 'dying' ? 2 : null;
  const attackerCard: BattleCard = { ...attacker, currentHp: attackerHp };

  // Match the in-game OpponentPortrait wiring for the Mom boss: family
  // theme palette, photo avatar from /cards/mom.webp. The themeed
  // gradient ring is exactly what the match header uses.
  const fam = ELEMENTS.family;

  return (
    <section className="landing-gameplay">
      <div className="landing-section-title"><span>Combat in motion</span></div>

      {/* Daylight board skin — same warm tabletop the in-game match
          uses by default. CosmeticsProvider (inMatch: false) so
          BattlefieldCard's useCosmetics hook has a context; leaving
          inMatch off keeps the demo on unframed default chrome,
          which is what a brand-new player sees. */}
      <CosmeticsProvider>
        <div className="gp-board">
          {/* Opponent header: portrait + mana + name on the left,
              graveyard chip on the right. The Portrait wrapper is
              position: relative so the EmoteBubble (absolutely
              positioned) anchors to it. The bubble re-keys whenever
              Mom's minion is killed — same wiring the PVP code path
              uses for live chat reactions. */}
          <div className="gp-header">
            <div className="gp-portrait-wrap">
              <Portrait
                avatar=""
                avatarPhoto="/cards/mom.webp"
                avatarBg={`linear-gradient(160deg, ${fam.deep}, ${fam.color})`}
                avatarRing={`conic-gradient(from 90deg, ${fam.deep}, ${fam.color}, ${fam.deep})`}
                hp={20}
                ring={null}
                hit={false}
                damage={null}
                onClick={() => {}}
              />
              {oppEmoteKey > 0 && (
                <EmoteBubble id="oops" bubbleKey={oppEmoteKey} placement="below" />
              )}
            </div>
            <ManaCrystals mana={3} maxMana={3} />
            <div className="gp-header-name">Mom</div>
            <div className="gp-header-spacer" />
            <GraveyardButton
              count={graveCount}
              pulseKey={gravePulseKey}
              onClick={() => {}}
            />
          </div>

          {/* Opponent field — three slot zones, same scaffolding the
              real FieldRow uses (64×88px, dashed border, faint white
              tint). Cousin lives permanently in the center slot; the
              dying prop on BattlefieldCard handles the kill visuals
              (red tint + diagonal slash flash) without removing her
              from the layout. Earlier versions had her fly to the
              graveyard and back each loop, but the reappearance read
              as a "pop in" — letting her stay in the slot matches
              how Dog also persists, and keeps the field stable. */}
          <div className="gp-field">
            <div className="gp-slot" />
            <div className="gp-slot">
              <BattlefieldCard
                card={defender}
                impact={isImpact}
                dying={isDying}
                damage={damage}
                owned={false}
                skipSummonFx
              />
            </div>
            <div className="gp-slot" />
          </div>

          {/* Center band — same shape as the in-game divider:
              dashed border top + bottom, TurnChip + Flag (give-up)
              on the LEFT, Swords (Battle Phase) on the right. Turn
              held static at 4 / 12 since the demo loops on a single
              attack beat; matches the player's 4/4 mana ramp. */}
          <div className="gp-divider">
            <TurnChip turnNumber={4} limit={GP_TURN_LIMIT} />
            <button style={iconBtn} aria-label="Give up" type="button">
              <Flag size={16} strokeWidth={2.4} />
            </button>
            <div className="gp-divider-spacer" />
            <button style={iconBtn} aria-label="Go to Battle" type="button">
              <Swords size={18} strokeWidth={2.2} />
            </button>
          </div>

          {/* Player field — three slot zones, same scaffolding as
              the opponent side. Dog sits in the center slot. The
              idle pulse ring lives on the wrapper, not the slot, so
              the slot chrome stays consistent. */}
          <div className="gp-field">
            <div className="gp-slot" />
            <div className="gp-slot">
              <div className={`gp-attacker-wrap ${phase === 'rest' ? 'gp-attacker-rest' : ''}`}>
                <BattlefieldCard
                  card={attackerCard}
                  lunging={isLunging ? 'up' : null}
                  damage={attackerDmg}
                  owned={true}
                  skipSummonFx
                />
              </div>
            </div>
            <div className="gp-slot" />
          </div>

          {/* Player footer: portrait + mana + name on the left,
              graveyard on the right. The portrait wrapper carries
              a "Nice!" emote that re-keys on every kill, so the
              player throws a victory reaction on the same beat
              Mom's "Oops…" lands. */}
          <div className="gp-header">
            <div className="gp-portrait-wrap">
              <Portrait
                avatar={<UserRound size={18} strokeWidth={2.2} />}
                avatarBg="linear-gradient(135deg, #ffd166, #ff7e5f)"
                avatarRing="conic-gradient(from 90deg, #ff7e5f, #ffd166, #ff7e5f)"
                hp={20}
                ring={null}
                hit={false}
                damage={null}
                onClick={() => {}}
              />
              {playerEmoteKey > 0 && (
                <EmoteBubble id="nice" bubbleKey={playerEmoteKey} placement="above" />
              )}
            </div>
            <ManaCrystals mana={4} maxMana={4} />
            <div className="gp-header-name">You</div>
            <div className="gp-header-spacer" />
            <GraveyardButton count={0} onClick={() => {}} />
          </div>
        </div>
      </CosmeticsProvider>

      <div className="gp-caption">
        Drag your creature onto an enemy. Whoever has higher attack wins the trade — and Taunt creatures must be hit first.
      </div>
    </section>
  );
}

// ============================================================================
// Abilities — the in-game keyword roster, colored + iconed to match
// the actual BattlefieldCard status pills. New visitors get a one-
// glance read on what the keywords on the showcase cards mean.
// ============================================================================

interface AbilityDef {
  name: string;
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  desc: string;
}

/** Same icon + color set BattlefieldCard's StatusPills use, so the
 *  ability tile feels like a legend for what the cards on the field
 *  are already showing. Pulled from src/components/BattlefieldCard.tsx
 *  lines 510-513. */
const ABILITIES: AbilityDef[] = [
  {
    name: 'Rush',
    Icon: Zap,
    color: '#ee5a52',
    desc: 'Attacks the turn it’s summoned. No waking up — straight into the fight.',
  },
  {
    name: 'Taunt',
    Icon: Target,
    color: '#3d8e57',
    desc: 'Enemies must hit Taunt creatures first. Wall up your board with one.',
  },
  {
    name: 'Untargetable',
    Icon: ShieldHalf,
    color: '#7a4ea8',
    desc: 'Spells can’t pick this creature. The only way through is combat.',
  },
  {
    name: 'Freeze',
    Icon: Snowflake,
    color: '#3a8fc4',
    desc: 'Skips its next turn — can’t attack, can’t trigger end-of-turn effects.',
  },
  {
    name: 'Silence',
    Icon: Ban,
    color: '#a47bff',
    desc: 'Disables an ability for one turn. Taunt stops taunting, healers stop healing — the body stays.',
  },
];

function AbilitiesSection() {
  return (
    <section className="landing-abilities">
      <div className="landing-section-title"><span>Abilities</span></div>
      <div className="landing-abilities-grid">
        {ABILITIES.map(({ name, Icon, color, desc }) => (
          <div key={name} className="landing-ability-card">
            <div className="landing-ability-icon" style={{
              background: `${color}1a`,
              color,
              boxShadow: `inset 0 0 0 1.5px ${color}55`,
            }}>
              <Icon size={18} color={color} strokeWidth={2.4} />
            </div>
            <div className="landing-ability-body">
              <div className="landing-ability-name">{name}</div>
              <div className="landing-ability-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Bonds — pairs of cards that, when both are on your field, unlock a
// combo effect. Pulled straight from src/data/bonds.ts so the
// names / effects / flavor on the landing match the engine. Showcase
// three bonds across three themes for variety.
// ============================================================================

interface BondShowcase {
  /** Internal id used as the React key — not rendered. */
  name: string;
  themeEl: ElementId;
  cardA: string;
  cardB: string;
  effect: string;
}

const SHOWCASE_BONDS: BondShowcase[] = [
  {
    name: 'Family Reunion',
    themeEl: 'family',
    cardA: 'Mom',
    cardB: 'Dad',
    effect: 'Heal +1 HP at the start of your turn.',
  },
  {
    name: 'House Pets',
    themeEl: 'animals',
    cardA: 'Dog',
    cardB: 'Cat',
    effect: 'Both gain Taunt.',
  },
  {
    name: 'Reporting Line',
    themeEl: 'work',
    cardA: 'Intern',
    cardB: 'Senior Engineer',
    effect: 'Your spells cost 1 less mana (minimum 1).',
  },
];

function BondsSection() {
  return (
    <section className="landing-bonds">
      <div className="landing-section-title"><span>Bonds</span></div>
      <p className="landing-bonds-lede">
        When both halves of a pair are on the field, a combo effect activates.
      </p>
      <div className="landing-bonds-grid">
        {SHOWCASE_BONDS.map(({ name, themeEl, cardA, cardB, effect }) => {
          const def = ELEMENTS[themeEl];
          return (
            <div key={name} className="landing-bond-card">
              <div className="landing-bond-pair">
                <span className="landing-bond-pill" style={{
                  background: `linear-gradient(135deg, ${def.color}, ${def.deep})`,
                }}>{cardA}</span>
                <span className="landing-bond-plus">+</span>
                <span className="landing-bond-pill" style={{
                  background: `linear-gradient(135deg, ${def.color}, ${def.deep})`,
                }}>{cardB}</span>
              </div>
              <div className="landing-bond-effect">{effect}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// Theme grid — six photo prompts, each one a mini themed tile
// ============================================================================

function ThemeGrid() {
  const ids: ElementId[] = ['family', 'animals', 'work', 'travel', 'food', 'education'];
  return (
    <section className="landing-themes">
      <div className="landing-section-title">
        <span>Creatures</span>
      </div>
      <div className="landing-theme-grid">
        {ids.map((id) => {
          const def = ELEMENTS[id];
          return (
            <div key={id} className="landing-theme-tile" style={{
              background: `linear-gradient(155deg, ${def.color} 0%, ${def.deep} 100%)`,
              borderColor: def.glow + '55',
              boxShadow: `0 8px 18px rgba(58, 46, 42, .18), inset 0 0 30px ${def.glow}22`,
            }}>
              <div className="landing-theme-name">{def.name}</div>
              <div className="landing-theme-blurb">{def.blurb}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// Spells — companion to the Creatures grid. Each theme owns at least
// one signature spell pulled straight from templates.ts; surface six
// of them (one per theme) so visitors see the full effect lane:
// damage, heal, freeze, draw, silence, buff.
// ============================================================================

interface SpellShowcase {
  name: string;
  themeEl: ElementId;
  /** Mechanical text from templates.ts — never paraphrased. */
  ability: string;
}

/** One iconic spell per theme. Names + ability text copied directly
 *  from the matching template id in src/data/templates.ts so this
 *  section stays accurate as the game balances. */
const SHOWCASE_SPELLS: SpellShowcase[] = [
  { name: 'The Look',      themeEl: 'family',    ability: 'Freeze an enemy.' },                  // fam-06
  { name: 'Sales Pitch',   themeEl: 'work',      ability: 'Deal 4 damage to an enemy.' },        // wrk-06
  { name: 'Treats',        themeEl: 'animals',   ability: 'Give an Animals-type creature +3/+3.' }, // ani-07
  { name: 'Suitcase',      themeEl: 'travel',    ability: 'Draw 2 cards.' },                     // trv-03
  { name: 'Sunday Dinner', themeEl: 'food',      ability: 'Restore 8 HP.' },                     // fam-12
  { name: 'Pop Quiz',      themeEl: 'education', ability: 'Discard a random card, then draw 2.' }, // edu-07
];

function SpellsSection() {
  return (
    <section className="landing-themes">
      <div className="landing-section-title">
        <span>Spells</span>
      </div>
      <div className="landing-theme-grid">
        {SHOWCASE_SPELLS.map(({ name, themeEl, ability }) => {
          const def = ELEMENTS[themeEl];
          return (
            <div key={name} className="landing-theme-tile" style={{
              background: `linear-gradient(155deg, ${def.color} 0%, ${def.deep} 100%)`,
              borderColor: def.glow + '55',
              boxShadow: `0 8px 18px rgba(58, 46, 42, .18), inset 0 0 30px ${def.glow}22`,
            }}>
              <div className="landing-theme-name">{name}</div>
              <div className="landing-theme-blurb">{ability}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// Live ticker — infinite marquee of recent "captures"
// ============================================================================

/** Live-ticker stunt feed — every card and rarity here is real, pulled
 *  from templates.ts. Keeps the landing page from advertising cards
 *  that don't exist in the game. */
const TICKER_ITEMS: { who: string; what: string; rarity: 'common' | 'rare' | 'legendary' }[] = [
  { who: 'maya',     what: 'summoned Dog',              rarity: 'rare' },
  { who: 'kenji',    what: 'photographed Mom',          rarity: 'rare' },
  { who: 'leon',     what: 'awoke Lion',                rarity: 'legendary' },
  { who: 'priya',    what: 'snapped Coffee',            rarity: 'common' },
  { who: 'sasha',    what: 'pulled The Boss',           rarity: 'legendary' },
  { who: 'alex',     what: 'opened Family pack',        rarity: 'common' },
  { who: 'devon',    what: 'reached Mountain Summit',   rarity: 'legendary' },
  { who: 'noor',     what: 'summoned Cousin',           rarity: 'common' },
  { who: 'jules',    what: 'beat The Manager on Mythic', rarity: 'rare' },
  { who: 'ren',      what: 'photographed Abuela',       rarity: 'rare' },
  { who: 'tomas',    what: 'captured Family Pet',       rarity: 'rare' },
  { who: 'iris',     what: 'summoned Graduation Day',   rarity: 'legendary' },
];

function LiveTicker() {
  // Duplicate the list so the second copy seamlessly follows when the
  // first scrolls off — gives the marquee its infinite feel.
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <section className="landing-ticker-section">
      <div className="landing-ticker-label">
        <span className="landing-ticker-dot" /> Live captures
      </div>
      <div className="landing-ticker-track-wrap">
        <div className="landing-ticker-track">
          {items.map((it, i) => (
            <div key={i} className="landing-ticker-chip">
              <span className={`landing-ticker-rarity rar-${it.rarity}`} />
              <span className="landing-ticker-who">@{it.who}</span>
              <span className="landing-ticker-what">{it.what}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Pack opening preview — reuses PackCinematic + PackArt from
// PackOpening.tsx so the landing animation is byte-for-byte the same
// pack art and packLift/packTension keyframes a real player sees
// when they tap a pack. Loops the lift → tension cycle indefinitely.
// ============================================================================

const PACK_PREVIEW_VIBE_EL: ElementId = 'family';

function PackOpeningPreview() {
  const def = ELEMENTS[PACK_PREVIEW_VIBE_EL];
  // Re-keys whenever a fresh lift cycle starts, so the packLift +
  // packTension keyframes restart cleanly. Without the key bump the
  // browser may not replay a same-named animation on re-render.
  const [cycleKey, setCycleKey] = useState(0);
  const [stage, setStage] = useState<'lift' | 'tension'>('lift');

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    const cycle = () => {
      setStage('lift');
      // 0.6s lift → switch to tension. PackCinematic's tension stage
      // adds the packTension shake (3 iterations of 0.32s) on top of
      // the 0.6s lift, so it lasts ~1.56s before we hold for a
      // breath and restart.
      t1 = setTimeout(() => setStage('tension'), 600);
      t2 = setTimeout(() => {
        setCycleKey(k => k + 1);
        cycle();
      }, 600 + 1600 + 700);
    };
    cycle();
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Build the same PackVibe shape the in-game flow constructs at
  // line 212 of PackOpening.tsx: themed colors from ELEMENTS plus an
  // ElementGlyph as the centerpiece icon.
  const vibe: PackVibe = {
    deep: def.deep,
    color: def.color,
    glow: def.glow,
    title: def.name,
    icon: <ElementGlyph el={PACK_PREVIEW_VIBE_EL} size={70} />,
    el: PACK_PREVIEW_VIBE_EL,
  };

  return (
    <section className="landing-packopen">
      <div className="landing-section-title"><span>Open a pack</span></div>
      <p className="landing-packopen-lede">
        Every pack lifts, glints, shakes — then bursts. Three dormant cards spill out, each waiting for a photo to wake them up.
      </p>
      <div className="landing-packopen-stage">
        <PackCinematic key={cycleKey} vibe={vibe} stage={stage} />
      </div>
    </section>
  );
}

// ============================================================================
// Game modes — surfaces the three play modes that aren't visible in
// the gameplay preview: PVP rooms, Campaign arcs, and Daily quests.
// ============================================================================

interface ModeDef {
  name: string;
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  desc: string;
}

const GAME_MODES: ModeDef[] = [
  {
    name: 'Online PVP',
    Icon: Users,
    color: '#3a8fc4',
    desc: 'Create a room, share a 5-letter code, fight a friend with your real-life deck.',
  },
  {
    name: 'Campaign',
    Icon: Flag,
    color: '#ee5a52',
    desc: 'A bosses-and-arcs ladder. Mom, The Manager, Pack Alpha — beat them all.',
  },
  {
    name: 'Daily Quests',
    Icon: Flame,
    color: '#ff9f1c',
    desc: 'Three quests refresh every day. Stack a streak for bigger coin payouts.',
  },
];

function GameModesSection() {
  return (
    <section className="landing-modes">
      <div className="landing-section-title"><span>Game modes</span></div>
      <div className="landing-modes-grid">
        {GAME_MODES.map(({ name, Icon, color, desc }) => (
          <div key={name} className="landing-mode-card">
            <div className="landing-mode-icon" style={{
              background: `linear-gradient(135deg, ${color}33, ${color}11)`,
              color,
              boxShadow: `inset 0 0 0 1.5px ${color}55`,
            }}>
              <Icon size={22} color={color} strokeWidth={2.4} />
            </div>
            <div className="landing-mode-name">{name}</div>
            <div className="landing-mode-desc">{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Privacy block — the single biggest objection for a photo-collecting
// game. One short, plain-language paragraph: photos stay private, no
// feed, no AI training. Trust signal before the auth panel.
// ============================================================================

function PrivacyBlock() {
  return (
    <section className="landing-privacy">
      <div className="landing-privacy-card">
        <div className="landing-privacy-icon" aria-hidden>
          <Lock size={22} strokeWidth={2.4} />
        </div>
        <div className="landing-privacy-body">
          <div className="landing-privacy-title">Your photos stay yours</div>
          <p className="landing-privacy-text">
            Memoria stores the photos you take privately in your own collection. There's no public feed, no social timeline, no other player can see your cards, and we never use your photos to train AI. Delete a card and the photo is gone from our servers. <a href="/privacy.html" className="landing-privacy-link">Read the full policy →</a>
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FAQ — five questions covering the most-asked-on-discovery objections
// for a photo TCG. Plain HTML <details> so it works without JS state.
// ============================================================================

interface FAQ { q: string; a: string }
const FAQS: FAQ[] = [
  {
    q: 'Is it free?',
    a: 'Yes — the full game is free. Open packs with coins you earn from playing matches and completing daily quests. No paid currency, no pay-to-win.',
  },
  {
    q: 'Do I need a real camera?',
    a: 'No. The capture screen uses your phone camera when available, but every step also has a file-upload fallback. Pick a photo from your gallery and the card wakes up the same way.',
  },
  {
    q: "What if I don't have a dog / a sibling / a grandparent?",
    a: 'Each card has a flexible photo prompt. "Family Pet" accepts any pet, including a friend\'s. "Mom" can be a maternal figure. Skip the card or fill it later — you only need 8 photographed cards to build a deck.',
  },
  {
    q: 'Can I play offline?',
    a: 'You can play solo (vs. AI bosses, campaign) once your collection is loaded. Online PVP and Firestore sync need a connection, but campaign matches and boss fights run locally.',
  },
  {
    q: 'Is online PVP real-time?',
    a: 'Turn-based, but live — both clients sync through a shared Firestore room. Both players need at least 6 photographed cards to enter a match.',
  },
];

function FAQSection() {
  return (
    <section className="landing-faq">
      <div className="landing-section-title"><span>FAQ</span></div>
      <div className="landing-faq-list">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="landing-faq-item">
            <summary className="landing-faq-q">
              <span>{q}</span>
              <ChevronDown size={16} strokeWidth={2.4} />
            </summary>
            <div className="landing-faq-a">{a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Footer — replaces the previous single-line footer with a small
// nav: tagline, the three legal/contact links, copyright stamp.
// ============================================================================

function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-row">
        <div className="landing-footer-brand">
          <img src="/logo.png" alt="" width={24} height={24} />
          <span>MEMORIA</span>
        </div>
        <nav className="landing-footer-nav">
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <a href="mailto:hello@memoria.tcg">Contact</a>
        </nav>
      </div>
      <div className="landing-footer-tagline">
        A photo TCG. Your life becomes the deck.
      </div>
      <div className="landing-footer-copy">
        © {new Date().getFullYear()} Memoria · Built with love
      </div>
    </footer>
  );
}

// ============================================================================
// Final CTA — pre-footer hand-off to the auth flow. The Login screen
// lives at its own route (driven by AuthGate) so we don't embed the
// form on the landing; this section is just one more conversion
// button after the FAQ knocks down the last objections.
// ============================================================================

function FinalCta({ onEnterApp }: { onEnterApp: (mode: 'signin' | 'signup') => void }) {
  return (
    <section className="landing-finalcta">
      <div className="landing-finalcta-card">
        <h2 className="landing-finalcta-title">Ready to start your album?</h2>
        <p className="landing-finalcta-sub">
          Free, no card required. Your photos stay private — see above.
        </p>
        <div className="landing-finalcta-row">
          <button className="landing-cta-primary" onClick={() => onEnterApp('signup')}>
            Begin your album →
          </button>
          <button className="landing-cta-ghost" onClick={() => onEnterApp('signin')}>
            I already have an account
          </button>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Background decor — soft warm dots in the page tint, mimicking the
// drifting starfield's energy without breaking the paper aesthetic.
// ============================================================================

function WarmDecor() {
  return (
    <div className="landing-starfield" aria-hidden style={{
      position: 'absolute', inset: 0,
      background: `radial-gradient(2px 2px at 22% 28%, rgba(255, 159, 28, .22) 0%, transparent 50%),
                   radial-gradient(1px 1px at 72% 62%, rgba(238, 90, 82, .18) 0%, transparent 50%),
                   radial-gradient(2px 2px at 42% 82%, rgba(255, 159, 28, .15) 0%, transparent 50%),
                   radial-gradient(1px 1px at 86% 24%, rgba(238, 90, 82, .2) 0%, transparent 50%),
                   radial-gradient(1px 1px at 12% 72%, rgba(255, 159, 28, .18) 0%, transparent 50%)`,
      backgroundSize: '600px 600px',
      animation: 'drift-bg 60s linear infinite',
      opacity: 0.6,
      pointerEvents: 'none',
    }} />
  );
}

// ============================================================================
// Styles — every landing-specific rule lives here so the rest of the app
// stays untouched. Keyframes + media queries are in one place.
// ============================================================================

function LandingStyles() {
  // Inline the stylesheet once. Mount on first render via a global flag
  // so re-mounts (e.g. during HMR) don't duplicate the <style> node.
  useEffect(() => {
    const id = 'landing-page-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = LANDING_CSS;
    document.head.appendChild(el);
  }, []);
  return null;
}

const LANDING_CSS = `
  @keyframes drift-bg { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }
  @keyframes title-shimmer {
    0%, 100% { filter: brightness(1) drop-shadow(0 0 12px rgba(255, 159, 28, .35)); }
    50%      { filter: brightness(1.08) drop-shadow(0 0 22px rgba(238, 90, 82, .55)); }
  }
  @keyframes float-card {
    0%   { transform: translate(0,0) rotate(var(--rot)); }
    50%  { transform: translate(var(--dx), var(--dy)) rotate(calc(var(--rot) + var(--spin))); }
    100% { transform: translate(0,0) rotate(var(--rot)); }
  }
  @keyframes landing-card-in {
    0% { opacity: 0; transform: rotate(var(--rot)) scale(.9); }
    100% { opacity: .9; transform: rotate(var(--rot)) scale(1); }
  }
  @keyframes prism-flow {
    0%   { background-position: 0% 0%, 100% 100%; }
    100% { background-position: 100% 100%, 0% 0%; }
  }
  @keyframes ticker-scroll {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes ticker-dot-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(238, 90, 82, .55); }
    50%      { box-shadow: 0 0 0 6px rgba(238, 90, 82, 0); }
  }
  @keyframes holo-idle {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-8px); }
  }
  /* Flip-in entrance for the swapped hero card. Starts mirrored + small,
     settles upright + full size. Combined with the existing perspective
     on .holo-card it reads as a card flipping into the front spot. */
  @keyframes holo-flip-in {
    0%   { opacity: 0; transform: rotateY(-180deg) scale(.7); }
    60%  { opacity: 1; }
    100% { opacity: 1; transform: rotateY(0) scale(1); }
  }

  .landing-scroll {
    position: absolute; inset: 0;
    overflow-y: auto;
    /* Lock horizontal scrolling — a few absolutely-positioned
       hero-stage cards can extend past the viewport's right edge on
       narrow phones, and without this Mobile Safari treats that as
       a draggable horizontal scroll. */
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    padding-top: 56px; /* clearance for sticky topbar */
  }

  /* Sticky top bar ----------------------------------------------------- */
  .landing-topbar {
    position: absolute; top: 0; left: 0; right: 0; z-index: 20;
    height: 56px; padding: 0 16px;
    display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(180deg, rgba(254,248,240,.92) 0%, rgba(254,248,240,.7) 70%, rgba(254,248,240,0) 100%);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .landing-topbar-brand {
    display: flex; align-items: center; gap: 8px;
    font-family: Fredoka, system-ui, sans-serif; font-weight: 700;
    letter-spacing: 3px; font-size: 13px;
    color: #ee5a52;
  }
  .landing-topbar-btn {
    padding: 7px 14px;
    border-radius: 999px;
    background: #fff;
    border: 1.5px solid rgba(238, 90, 82, .35);
    color: #ee5a52;
    font-weight: 700; font-size: 13px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(238, 90, 82, .12);
  }
  .landing-topbar-btn:hover { background: #fff5ec; border-color: #ee5a52; }

  /* Hero -------------------------------------------------------------- */
  .landing-hero {
    position: relative; z-index: 2;
    padding: 24px 20px 32px;
    min-height: 540px;
  }
  .landing-hero-inner {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    align-items: center;
  }
  .landing-eyebrow {
    font-size: 11px; letter-spacing: 4px;
    color: #ee5a52;
    font-weight: 700; margin-bottom: 8px;
  }
  .landing-h1 {
    margin: 0;
    font-family: Fredoka, system-ui, sans-serif;
    font-size: 38px; line-height: 1.05; font-weight: 700;
    color: #3a2e2a;
  }
  /* Same orange-to-coral gradient HomeMenu uses on the player name. */
  .landing-h1-accent {
    background: linear-gradient(135deg, #ff9f1c 0%, #ff7e5f 60%, #ee5a52 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: title-shimmer 4s ease-in-out infinite;
  }
  .landing-lede {
    margin: 14px 0 0;
    color: #7a5a52;
    font-size: 15px; line-height: 1.55;
    max-width: 520px;
  }
  .landing-hint {
    margin: 12px 0 0;
    font-size: 12px; letter-spacing: 2px; text-transform: uppercase;
    color: #ee5a52;
    font-weight: 600;
  }
  .landing-cta-row {
    display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;
  }
  /* Same gradient stack the in-game btnPrimary uses, so the landing
     CTA feels like the orange button players see throughout the app. */
  .landing-cta-primary {
    padding: 13px 22px; border-radius: 22px; border: none;
    background: linear-gradient(180deg, #ffa07a 0%, #ff7e5f 60%, #ee5a52 100%);
    color: #fff; font-weight: 700; font-size: 15px;
    letter-spacing: 0.4px;
    box-shadow: 0 6px 18px rgba(255, 94, 60, .35), inset 0 1px 0 rgba(255,255,255,.4);
    cursor: pointer;
    font-family: Fredoka, system-ui, sans-serif;
  }
  .landing-cta-primary:hover { transform: translateY(-1px); }
  .landing-cta-ghost {
    padding: 13px 22px; border-radius: 22px;
    background: #fff;
    border: 1.5px solid rgba(58, 46, 42, 0.14);
    color: #3a2e2a; font-weight: 600; font-size: 14px;
    cursor: pointer;
  }
  .landing-cta-ghost:hover { background: #fff5ec; border-color: rgba(238,90,82,.4); }

  .landing-hero-stage {
    position: relative;
    height: 380px;
    display: flex; align-items: center; justify-content: center;
    margin-top: 8px;
    /* Clip any floating showcase card that drifts past the stage
       edge — they're absolutely positioned by % and would otherwise
       extend the parent on narrow viewports. */
    overflow: hidden;
  }
  @media (min-width: 760px) {
    .landing-hero-inner {
      grid-template-columns: 1.1fr 1fr;
      gap: 32px;
    }
    .landing-h1 { font-size: 52px; }
    .landing-hero-stage { height: 460px; }
  }

  /* Floating tappable cards — reset native button chrome, layer the
     intro fade-in on top of the idle bob, and add a hover lift +
     active press feedback so taps feel responsive.

     Note z-index: 1 (and never higher) — the hero card sits at z 5,
     so even when a floating card is hovered or scaled it stays behind
     and never crashes into the front card. */
  .landing-floating {
    opacity: 0;
    animation:
      landing-card-in 600ms ease-out both,
      float-card 8s ease-in-out infinite;
    animation-delay: 0s, var(--card-delay, 0s);
    transform: rotate(var(--rot));
    will-change: transform, opacity;
    transition: filter 200ms ease, box-shadow 200ms ease;
    z-index: 1;
  }
  .landing-floating:hover { filter: brightness(1.15); }
  .landing-floating:focus-visible {
    outline: 2px solid #ee5a52;
    outline-offset: 4px;
  }
  .landing-floating:active { filter: brightness(1.25); }
  /* Idle prismatic ribbon on every floating card — gentler than the
     hero card's interactive shine. */
  .landing-floating-prism {
    position: absolute; inset: 0;
    border-radius: inherit;
    pointer-events: none;
    mix-blend-mode: color-dodge;
    opacity: .35;
    background:
      repeating-linear-gradient(115deg,
        rgba(255, 90, 200, .35) 0%,
        rgba(255, 220, 80, .35) 15%,
        rgba(80, 255, 220, .35) 30%,
        rgba(120, 120, 255, .35) 45%,
        rgba(255, 90, 200, .35) 60%),
      repeating-linear-gradient(-65deg,
        rgba(255,255,255,.18) 0%,
        rgba(255,255,255,0) 20%);
    background-size: 200% 200%, 100% 100%;
    animation: prism-flow 6s linear infinite;
  }

  /* Hero hide on narrow */
  @media (max-width: 560px) {
    .landing-hero-stage { height: 340px; }
  }

  /* HoloCard ---------------------------------------------------------- */
  .holo-wrap {
    position: relative;
    width: 220px; height: 320px;
    perspective: 1000px;
    /* Two animations layered: the 600ms flip-in plays once on mount
       (re-runs each time the parent swaps activeEl via key=), the
       idle bob loops forever in the background. */
    animation:
      holo-flip-in 700ms cubic-bezier(.2, .9, .3, 1.1) both,
      holo-idle 5s ease-in-out infinite 700ms;
    z-index: 5;
    transform-style: preserve-3d;
  }
  @media (min-width: 760px) {
    .holo-wrap { width: 250px; height: 360px; }
  }
  .holo-card {
    position: relative;
    width: 100%; height: 100%;
    border-radius: 16px;
    border-style: solid;
    border-width: 1.5px;
    padding: 10px;
    display: flex; flex-direction: column;
    transform-style: preserve-3d;
    overflow: hidden;
    cursor: pointer;
  }
  .holo-toprow {
    display: flex; align-items: center; justify-content: space-between;
    gap: 6px;
    font-size: 11px; font-weight: 700;
    color: rgba(255,255,255,.95);
    text-shadow: 0 1px 2px rgba(0,0,0,.5);
  }
  .holo-cost {
    width: 24px; height: 24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800;
    box-shadow: 0 2px 6px rgba(0,0,0,.4);
  }
  .holo-element { letter-spacing: 1.5px; text-transform: uppercase; opacity: .85; }
  .holo-rarity {
    font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
    padding: 2px 6px; border-radius: 999px;
    border: 1px solid currentColor;
  }
  .holo-rarity.rar-common    { color: rgba(255,255,255,.75); }
  .holo-rarity.rar-rare      { color: #6db4e8; text-shadow: 0 0 8px rgba(109,180,232,.5); }
  .holo-rarity.rar-epic      { color: #c084fc; text-shadow: 0 0 8px rgba(192,132,252,.6); }
  .holo-rarity.rar-legendary { color: #f4d04a; text-shadow: 0 0 10px rgba(244,208,74,.7); }
  .holo-art {
    flex: 1; position: relative;
    margin: 8px 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.18);
  }
  .holo-art-bg { position: absolute; inset: 0; }
  .holo-art-icon {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 88px;
    color: rgba(255,255,255,.92);
    text-shadow: 0 6px 22px rgba(0,0,0,.5);
    font-family: Georgia, serif;
  }
  .holo-name {
    text-align: center;
    font-family: Fredoka, system-ui, sans-serif;
    font-size: 18px; font-weight: 700;
    color: #fff;
    text-shadow: 0 2px 6px rgba(0,0,0,.6);
    margin-top: 2px;
  }
  .holo-ability {
    text-align: center;
    font-size: 11px; font-weight: 600;
    color: #fff;
    margin: 6px 6px 0;
    line-height: 1.35;
    text-shadow: 0 1px 2px rgba(0,0,0,.5);
  }
  .holo-flavor {
    text-align: center;
    font-size: 11px; font-style: italic;
    color: rgba(255,255,255,.78);
    margin: 4px 4px 0;
    line-height: 1.35;
  }
  .holo-footer {
    margin-top: 8px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 4px 0;
    border-top: 1px solid rgba(255,255,255,.12);
  }
  .holo-type {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: rgba(255,255,255,.7);
  }
  .holo-stats {
    display: flex; align-items: center; gap: 10px;
    font-family: Fredoka, system-ui, sans-serif;
  }
  .holo-stat {
    display: inline-flex; align-items: baseline; gap: 3px;
    font-size: 16px; font-weight: 700;
  }
  .holo-stat-icon {
    font-size: 13px;
    text-shadow: 0 1px 2px rgba(0,0,0,.6);
  }
  .holo-stat-label {
    font-size: 9px;
    letter-spacing: 1px;
    color: rgba(255,255,255,.6);
    margin-left: 1px;
  }
  .holo-atk { color: #ffb86c; }
  .holo-hp  { color: #ff6c8a; }
  .holo-sheen {
    position: absolute; inset: 0;
    border-radius: 16px;
    pointer-events: none;
    mix-blend-mode: screen;
    transition: opacity 240ms ease-out;
  }
  /* Prismatic rainbow shiny — two-layer rainbow gradient with
     color-dodge blend produces the iridescent rare-card look. */
  .holo-prismatic {
    position: absolute; inset: 0;
    border-radius: 16px;
    pointer-events: none;
    mix-blend-mode: color-dodge;
    background:
      repeating-linear-gradient(115deg,
        rgba(255, 90, 200, .55) 0%,
        rgba(255, 220, 80, .55) 14%,
        rgba(80, 255, 220, .55) 28%,
        rgba(120, 120, 255, .55) 42%,
        rgba(255, 90, 200, .55) 56%),
      repeating-linear-gradient(-65deg,
        rgba(255,255,255,.22) 0%,
        rgba(255,255,255,0) 18%);
    background-size: 220% 220%, 100% 100%;
    animation: prism-flow 5s linear infinite;
    transition: opacity 240ms ease-out, background-position 80ms ease-out;
  }

  /* Pitch ------------------------------------------------------------- */
  .landing-pitch { padding: 24px 20px; position: relative; z-index: 2; }
  .landing-section-title {
    text-align: center; margin-bottom: 18px;
    color: #a89580;
    font-size: 11px; letter-spacing: 4px; text-transform: uppercase;
    font-weight: 600;
  }
  .landing-section-title span {
    padding: 0 12px; position: relative;
  }
  .landing-section-title span::before,
  .landing-section-title span::after {
    content: ''; position: absolute; top: 50%; width: 36px; height: 1px;
    background: rgba(58, 46, 42, .15);
  }
  .landing-section-title span::before { right: 100%; }
  .landing-section-title span::after  { left: 100%; }

  .landing-pitch-grid {
    display: grid; grid-template-columns: 1fr; gap: 12px;
    max-width: 880px; margin: 0 auto;
  }
  @media (min-width: 720px) { .landing-pitch-grid { grid-template-columns: repeat(3, 1fr); } }
  .landing-pitch-card {
    background: #fff;
    border: 1.5px solid rgba(58, 46, 42, .08);
    border-radius: 16px;
    padding: 18px 16px;
    box-shadow: 0 6px 18px rgba(58, 46, 42, .06);
  }
  .landing-pitch-num {
    width: 28px; height: 28px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #ff9f1c 0%, #ee5a52 100%);
    color: #fff; font-weight: 800; font-size: 14px;
    margin-bottom: 10px;
    box-shadow: 0 4px 10px rgba(238, 90, 82, .3);
  }
  .landing-pitch-title { font-weight: 700; font-size: 16px; margin-bottom: 4px; color: #3a2e2a; }
  .landing-pitch-body { font-size: 13px; line-height: 1.5; color: #7a5a52; }

  /* Abilities --------------------------------------------------------- */
  /* Keyword roster — same icon + color treatment the in-game
     BattlefieldCard StatusPills use, just blown up so the keyword
     name + description fit alongside. Card surface is paper white
     to match the auth/pitch cards. */
  .landing-abilities { padding: 24px 20px; position: relative; z-index: 2; }
  .landing-abilities-grid {
    display: grid; grid-template-columns: 1fr; gap: 10px;
    max-width: 720px; margin: 0 auto;
  }
  @media (min-width: 720px) {
    .landing-abilities-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .landing-ability-card {
    display: flex; align-items: center; gap: 12px;
    background: #fff;
    border: 1.5px solid rgba(58, 46, 42, .08);
    border-radius: 14px;
    padding: 12px 14px;
    box-shadow: 0 4px 12px rgba(58, 46, 42, .05);
  }
  .landing-ability-icon {
    width: 36px; height: 36px; border-radius: 10px;
    display: grid; place-items: center;
    flex: 0 0 auto;
  }
  .landing-ability-name {
    font-family: Fredoka, system-ui, sans-serif;
    font-weight: 700; font-size: 15px;
    color: #3a2e2a;
  }
  .landing-ability-desc {
    margin-top: 2px;
    font-size: 12px; line-height: 1.45;
    color: #7a5a52;
  }

  /* Bonds ------------------------------------------------------------- */
  /* Pair-of-cards combo showcase. Stripped to just the two themed
     pills + the mechanical effect — no bond name, no flavor — so the
     section reads as "these pairs do this" without colorful prose. */
  .landing-bonds { padding: 24px 20px; position: relative; z-index: 2; }
  .landing-bonds-lede {
    max-width: 540px; margin: 0 auto 18px;
    text-align: center;
    font-size: 13px; line-height: 1.55;
    color: #7a5a52;
  }
  .landing-bonds-grid {
    display: grid; grid-template-columns: 1fr; gap: 12px;
    max-width: 880px; margin: 0 auto;
  }
  @media (min-width: 720px) {
    .landing-bonds-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .landing-bond-card {
    background: #fff;
    border: 1.5px solid rgba(58, 46, 42, .08);
    border-radius: 14px;
    padding: 14px;
    box-shadow: 0 4px 12px rgba(58, 46, 42, .05);
    display: flex; flex-direction: column; gap: 10px;
  }
  .landing-bond-pair {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  }
  .landing-bond-pill {
    padding: 4px 10px; border-radius: 999px;
    color: #fff;
    font-size: 12px; font-weight: 700;
    text-shadow: 0 1px 1px rgba(0,0,0,.3);
    box-shadow: 0 2px 6px rgba(58, 46, 42, .14);
  }
  .landing-bond-plus {
    color: #a89580;
    font-weight: 700;
    font-size: 13px;
  }
  .landing-bond-effect {
    font-size: 13px; line-height: 1.45;
    color: #3a2e2a;
    font-weight: 600;
  }

  /* Themes ------------------------------------------------------------ */
  .landing-themes { padding: 24px 20px; position: relative; z-index: 2; }
  .landing-theme-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
    max-width: 880px; margin: 0 auto;
  }
  @media (min-width: 720px) { .landing-theme-grid { grid-template-columns: repeat(3, 1fr); } }
  .landing-theme-tile {
    border-radius: 14px; padding: 14px;
    border: 1px solid;
    min-height: 92px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .landing-theme-name {
    font-family: Fredoka, system-ui, sans-serif;
    font-weight: 700; font-size: 18px; color: #fff;
    text-shadow: 0 2px 4px rgba(0,0,0,.4);
  }
  .landing-theme-blurb {
    margin-top: 6px;
    font-size: 12px; line-height: 1.4;
    color: rgba(255,255,255,.82);
    font-style: italic;
  }

  /* Ticker ------------------------------------------------------------ */
  .landing-ticker-section {
    padding: 22px 0;
    border-top: 1px solid rgba(58, 46, 42, .08);
    border-bottom: 1px solid rgba(58, 46, 42, .08);
    background: #ffe8d6;
    position: relative; z-index: 2;
  }
  .landing-ticker-label {
    display: flex; align-items: center; gap: 8px;
    padding: 0 20px 12px;
    font-size: 11px; letter-spacing: 3px; text-transform: uppercase;
    color: #7a5a52;
    font-weight: 700;
  }
  .landing-ticker-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #ee5a52;
    animation: ticker-dot-pulse 1.6s ease-out infinite;
  }
  .landing-ticker-track-wrap {
    overflow: hidden;
    mask-image: linear-gradient(90deg, transparent 0, #000 6%, #000 94%, transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 6%, #000 94%, transparent 100%);
  }
  .landing-ticker-track {
    display: flex; gap: 10px;
    width: max-content;
    padding: 6px 0;
    animation: ticker-scroll 38s linear infinite;
  }
  .landing-ticker-track:hover { animation-play-state: paused; }
  .landing-ticker-chip {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px;
    background: #fff;
    border: 1.5px solid rgba(58, 46, 42, .1);
    border-radius: 999px;
    font-size: 13px;
    white-space: nowrap;
    color: #3a2e2a;
    box-shadow: 0 2px 6px rgba(58, 46, 42, .05);
  }
  .landing-ticker-rarity { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .landing-ticker-rarity.rar-common    { background: #a89580; }
  .landing-ticker-rarity.rar-rare      { background: #3a8fc4; box-shadow: 0 0 8px #3a8fc4aa; }
  .landing-ticker-rarity.rar-legendary { background: #ffd166; box-shadow: 0 0 10px #ffd166cc; }
  .landing-ticker-who  { color: #ee5a52; font-weight: 700; }
  .landing-ticker-what { color: #7a5a52; }

  /* Final CTA — pre-footer conversion card. White paper surface
     with a soft warm shadow, centered copy, and the same primary +
     ghost button pair the hero carries. */
  .landing-finalcta {
    padding: 32px 20px 12px;
    display: flex; justify-content: center;
    position: relative; z-index: 2;
  }
  .landing-finalcta-card {
    width: min(560px, 100%);
    background: #fff;
    border: 1.5px solid rgba(58, 46, 42, .08);
    border-radius: 22px;
    padding: 26px 24px;
    box-shadow: 0 18px 36px rgba(58, 46, 42, .10);
    text-align: center;
  }
  .landing-finalcta-title {
    margin: 0 0 6px;
    font-family: Fredoka, system-ui, sans-serif;
    font-size: 22px; font-weight: 700;
    background: linear-gradient(135deg, #ff9f1c 0%, #ff7e5f 60%, #ee5a52 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .landing-finalcta-sub {
    margin: 0 0 18px;
    font-size: 13px; color: #7a5a52; line-height: 1.5;
  }
  .landing-finalcta-row {
    display: flex; justify-content: center; flex-wrap: wrap; gap: 10px;
  }

  /* Pack opening preview -------------------------------------------- */
  /* Reuses PackCinematic (packLift + packTension keyframes from
     src/index.css) so this is the exact same animation a player sees
     when they tap a pack in-game. */
  .landing-packopen { padding: 24px 20px; position: relative; z-index: 2; }
  .landing-packopen-lede {
    max-width: 540px; margin: 0 auto 22px;
    text-align: center;
    font-size: 13px; line-height: 1.55;
    color: #7a5a52;
  }
  .landing-packopen-stage {
    display: flex; align-items: center; justify-content: center;
    min-height: 320px;
  }

  /* Game modes ------------------------------------------------------- */
  /* Three-up grid surfacing PVP / Campaign / Daily — the modes the
     gameplay preview doesn't show. White paper cards, themed icon
     tiles, plain-language one-liners. */
  .landing-modes { padding: 24px 20px; position: relative; z-index: 2; }
  .landing-modes-grid {
    display: grid; grid-template-columns: 1fr; gap: 12px;
    max-width: 880px; margin: 0 auto;
  }
  @media (min-width: 720px) {
    .landing-modes-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .landing-mode-card {
    background: #fff;
    border: 1.5px solid rgba(58, 46, 42, .08);
    border-radius: 14px;
    padding: 18px 16px;
    box-shadow: 0 4px 12px rgba(58, 46, 42, .05);
    text-align: center;
  }
  .landing-mode-icon {
    width: 48px; height: 48px; border-radius: 14px;
    margin: 0 auto 10px;
    display: grid; place-items: center;
  }
  .landing-mode-name {
    font-family: Fredoka, system-ui, sans-serif;
    font-weight: 700; font-size: 16px;
    color: #3a2e2a;
    margin-bottom: 6px;
  }
  .landing-mode-desc {
    font-size: 12px; line-height: 1.5;
    color: #7a5a52;
  }

  /* Privacy block ---------------------------------------------------- */
  /* Trust-signal block before the auth panel. Calmer-than-CTA visual
     so the message reads as fact, not marketing. */
  .landing-privacy { padding: 18px 20px 0; position: relative; z-index: 2; }
  .landing-privacy-card {
    max-width: 720px; margin: 0 auto;
    display: flex; align-items: flex-start; gap: 14px;
    background: #fffbf5;
    border: 1.5px solid rgba(58, 46, 42, .12);
    border-left: 4px solid #ee5a52;
    border-radius: 14px;
    padding: 16px 18px;
  }
  .landing-privacy-icon {
    flex: 0 0 auto;
    width: 40px; height: 40px; border-radius: 12px;
    background: #ee5a521a;
    color: #ee5a52;
    display: grid; place-items: center;
    margin-top: 2px;
  }
  .landing-privacy-title {
    font-family: Fredoka, system-ui, sans-serif;
    font-weight: 700; font-size: 15px;
    color: #3a2e2a;
    margin-bottom: 4px;
  }
  .landing-privacy-text {
    margin: 0;
    font-size: 12.5px; line-height: 1.55;
    color: #7a5a52;
  }
  .landing-privacy-link {
    color: #ee5a52;
    text-decoration: none;
    font-weight: 600;
    white-space: nowrap;
  }
  .landing-privacy-link:hover { text-decoration: underline; }

  /* FAQ -------------------------------------------------------------- */
  /* Native <details> accordion — no JS state needed. Card surface
     matches the pitch/mode cards so the section reads consistent. */
  .landing-faq { padding: 24px 20px; position: relative; z-index: 2; }
  .landing-faq-list {
    max-width: 720px; margin: 0 auto;
    display: flex; flex-direction: column; gap: 8px;
  }
  .landing-faq-item {
    background: #fff;
    border: 1.5px solid rgba(58, 46, 42, .08);
    border-radius: 12px;
    padding: 0 14px;
    transition: box-shadow .15s ease;
  }
  .landing-faq-item[open] {
    box-shadow: 0 6px 16px rgba(58, 46, 42, .08);
  }
  .landing-faq-q {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    cursor: pointer;
    list-style: none;
    font-family: Fredoka, system-ui, sans-serif;
    font-weight: 600; font-size: 14px;
    color: #3a2e2a;
  }
  .landing-faq-q::-webkit-details-marker { display: none; }
  .landing-faq-q > svg { transition: transform .2s ease; flex: 0 0 auto; color: #a89580; }
  .landing-faq-item[open] .landing-faq-q > svg { transform: rotate(180deg); color: #ee5a52; }
  .landing-faq-a {
    padding: 0 0 14px;
    font-size: 13px; line-height: 1.55;
    color: #7a5a52;
  }

  /* Footer ----------------------------------------------------------- */
  .landing-footer {
    margin-top: 12px;
    padding: 28px 20px 24px;
    border-top: 1px solid rgba(58, 46, 42, .08);
    text-align: center;
    background: rgba(255, 255, 255, .35);
  }
  .landing-footer-row {
    display: flex; align-items: center; justify-content: space-between;
    max-width: 720px; margin: 0 auto 14px;
    flex-wrap: wrap; gap: 12px;
  }
  .landing-footer-brand {
    display: flex; align-items: center; gap: 8px;
    font-family: Fredoka, system-ui, sans-serif; font-weight: 700;
    letter-spacing: 3px; font-size: 13px;
    color: #ee5a52;
  }
  .landing-footer-nav {
    display: flex; gap: 18px;
    font-size: 13px;
  }
  .landing-footer-nav a {
    color: #7a5a52;
    text-decoration: none;
    font-weight: 600;
  }
  .landing-footer-nav a:hover { color: #ee5a52; }
  .landing-footer-tagline {
    font-size: 13px; color: #7a5a52;
    margin-bottom: 6px;
  }
  .landing-footer-copy {
    font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
    color: #a89580;
  }

  /* Gameplay preview ------------------------------------------------- */
  /* Reuses the in-game Portrait, ManaCrystals, and BattlefieldCard
     components on a daylight-skin board. The component handles every
     visual beat (lunge, impact, damage popup, dying slice, summon
     dust); this stylesheet only lays out the four rows: opponent
     header, opponent field (creature centered), divider, player
     field (creature centered), player footer. */
  @keyframes gp-attacker-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(238, 90, 82, 0); }
    50%      { box-shadow: 0 0 0 6px rgba(238, 90, 82, .12); }
  }

  .landing-gameplay { padding: 24px 20px; position: relative; z-index: 2; }

  .gp-board {
    max-width: 520px; margin: 0 auto;
    background:
      radial-gradient(ellipse 120% 80% at 50% 0%, #fff4e6 0%, transparent 70%),
      linear-gradient(180deg, #ffe8d6 0%, #ffd1b3 50%, #ffb89a 100%);
    border: 1.5px solid rgba(58, 46, 42, .12);
    border-radius: 18px;
    padding: 12px 14px 14px;
    box-shadow:
      0 12px 28px rgba(58, 46, 42, .14),
      inset 0 0 0 1px rgba(255,255,255,.45);
    overflow: hidden;
  }

  /* Header strip — mirrors the match's player + opp header rows:
     portrait + mana + name on the left, graveyard chip on the right.
     The flex spacer between the two clusters pushes the graveyard
     to the far edge, same layout the in-game MatchBoard uses. */
  .gp-header {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 0;
  }
  .gp-header-name {
    font-family: Fredoka, system-ui, sans-serif;
    font-weight: 700; font-size: 13px;
    color: #3a2e2a;
    margin-left: 2px;
  }
  .gp-header-spacer { flex: 1; }
  /* Position context for the EmoteBubble — the bubble positions
     itself absolutely against the closest positioned ancestor. */
  .gp-portrait-wrap { position: relative; }

  /* Center band — same shape as the in-game match divider:
     dashed border on top + bottom, transparent white wash, TurnChip
     + Flag (give-up) anchored on the left, Swords (Battle Phase) on
     the right. The spacer in between is what splits the two
     clusters apart, same as the in-game flex layout. */
  .gp-divider {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    border-top: 1px dashed rgba(58, 46, 42, .20);
    border-bottom: 1px dashed rgba(58, 46, 42, .20);
    background: rgba(255, 255, 255, .30);
  }
  .gp-divider-spacer { flex: 1; }

  /* Field rows — three slot zones per side, centered. The slots
     are the same 64×88 dashed scaffolding the in-game FieldRow uses;
     when a slot is empty it shows as a constant placeholder, when
     occupied a BattlefieldCard renders on top. */
  .gp-field {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 96px;
    padding: 4px 0;
  }
  .gp-slot {
    width: 64px; height: 88px;
    border-radius: 8px;
    border: 1.5px dashed rgba(58, 46, 42, .14);
    background: rgba(255, 255, 255, .18);
    position: relative;
    display: flex; align-items: center; justify-content: center;
    flex: 0 0 auto;
  }

  /* Soft red pulse around the attacker while it's idle, so the
     viewer's eye lands on "this is the creature about to swing"
     before the lunge actually starts. */
  .gp-attacker-wrap {
    border-radius: 12px;
    transition: box-shadow 200ms ease;
  }
  .gp-attacker-rest {
    animation: gp-attacker-pulse 1.8s ease-out infinite;
  }

  .gp-caption {
    margin: 14px auto 0;
    max-width: 520px;
    text-align: center;
    font-size: 12px; color: #7a5a52; line-height: 1.5;
  }
`;
