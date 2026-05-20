import { useMemo, useRef, useState, useEffect, type CSSProperties, type ComponentType } from 'react';
import { Heart, Briefcase, PawPrint, Plane, UtensilsCrossed, GraduationCap } from 'lucide-react';
import { useAuth } from '../firebase/auth';
import { ELEMENTS } from '../data/elements';
import { UserRound } from 'lucide-react';
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
export function LandingPage() {
  const { signUp, signIn, signInWithGoogle, unconfigured } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unconfigured) { setErr('Firebase not configured — see .env.example'); return; }
    setBusy(true); setErr(null);
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName || email.split('@')[0]);
      } else {
        await signIn(email, password);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, '').trim());
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    if (unconfigured) { setErr('Firebase not configured — see .env.example'); return; }
    setBusy(true); setErr(null);
    try { await signInWithGoogle(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
        <button className="landing-topbar-btn" onClick={scrollToForm}>
          Sign in
        </button>
      </div>

      {/* Scroll container — every panel below stacks vertically */}
      <div className="landing-scroll">

        <HeroSection onCta={scrollToForm} />

        <PitchSection />

        <GameplayPreview />

        <ThemeGrid />

        <LiveTicker />

        <div ref={formRef}>
          <AuthPanel
            mode={mode} setMode={setMode}
            email={email} setEmail={setEmail}
            password={password} setPassword={setPassword}
            displayName={displayName} setDisplayName={setDisplayName}
            err={err} busy={busy}
            submit={submit} onGoogle={onGoogle}
            unconfigured={unconfigured}
          />
        </div>

        <footer className="landing-footer">
          A photo TCG. Your life becomes the deck.
        </footer>

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

function HeroSection({ onCta }: { onCta: () => void }) {
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
            <button className="landing-cta-ghost" onClick={onCta}>
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
    { n: '1', title: 'Open packs', body: 'Five cards per pack. All dormant. Stats, abilities, no picture.' },
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
 *  internal keyframes: lungeUp is 750ms, the impact burst is 800ms,
 *  the dying slice is 850ms, so each phase gets just enough screen
 *  time to read before the next one stacks on. */
const GP_SCHEDULE: { phase: GpPhase; ms: number }[] = [
  { phase: 'rest',   ms: 1400 },
  { phase: 'lunge',  ms: 750  },
  { phase: 'impact', ms: 250  },
  { phase: 'dying',  ms: 900  },
  { phase: 'empty',  ms: 700  },
];

/** Build a `BattleCard` from a template id plus a fresh `battleId`.
 *  Everything the BattlefieldCard reads (currentAtk, currentHp,
 *  tapped, frozen…) is hard-coded since there's no engine running
 *  here. `justPlayed` is true so the cardSlam summon animation plays
 *  the moment the card mounts — gives the loop's "next turn" reset a
 *  visible beat. */
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
    justPlayed: true,
    frozen: false,
  };
}

function GameplayPreview() {
  const [phase, setPhase] = useState<GpPhase>('rest');
  // Increments every time the loop wraps. Used as the key on the
  // defender so it remounts with a fresh cardSlam after a kill.
  const [loopKey, setLoopKey] = useState(0);
  // Bumps the moment the defender takes lethal damage. Re-keys the
  // EmoteBubble so its in/out animation replays — Mom reacts "Oops…"
  // every time her creature gets killed.
  const [oppEmoteKey, setOppEmoteKey] = useState(0);
  // Re-keys the opponent's graveyard chip so the gravePulse animation
  // plays each time a card lands in the bin.
  const [graveCount, setGraveCount] = useState(0);
  const [gravePulseKey, setGravePulseKey] = useState(0);
  // Demo "turn counter" — ticks forward each loop. Starts at 4 (the
  // turn Dog goes online in the actual tutorial) so the chip reads
  // like a real mid-match shot.
  const [turn, setTurn] = useState(4);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idx = 0;
    const tick = () => {
      const step = GP_SCHEDULE[idx];
      setPhase(step.phase);
      // Trigger Mom's "Oops…" emote + bump the opponent graveyard
      // count the moment the defender takes lethal damage, so the
      // emote bubble and the skull pulse arrive on the same beat.
      if (step.phase === 'impact') {
        setOppEmoteKey(k => k + 1);
        setGraveCount(c => c + 1);
        setGravePulseKey(k => k + 1);
      }
      timer = setTimeout(() => {
        idx = (idx + 1) % GP_SCHEDULE.length;
        if (idx === 0) {
          setLoopKey(k => k + 1);
          setTurn(t => t + 1);
        }
        tick();
      }, step.ms);
    };
    tick();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  // Build the two cards. The attacker is stable across the loop (a
  // single ref so its mount-time cardSlam doesn't re-fire every time
  // setPhase rerenders). The defender is keyed on loopKey so a new
  // BattleCard instance arrives on every loop wrap, replaying the
  // summon dust just like a freshly-summoned card would in-game.
  // Dog (2/4 Taunt, animals) attacks Cousin (2/2 family). Dog deals
  // 2 damage → Cousin dies cleanly in one hit. Cousin is the boss
  // (Mom)'s thematic minion; Intern would have been off-deck for a
  // family boss. Both photos are bundled / sample-photo URLs so the
  // landing renders them without a Firestore round-trip.
  const attacker = useMemo(() => makeDemoBattleCard('ani-05', 'gp-attacker'), []);
  const defender = useMemo(
    () => makeDemoBattleCard('fam-02', `gp-defender-${loopKey}`),
    [loopKey],
  );

  const isLunging = phase === 'lunge';
  const isImpact  = phase === 'impact';
  const isDying   = phase === 'dying' || phase === 'impact';
  const damage    = phase === 'impact' || phase === 'dying' ? 2 : null;
  const showDefender = phase !== 'empty';

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
                hp={24}
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

          {/* Opponent field — defender centered. */}
          <div className="gp-field">
            {showDefender && (
              <BattlefieldCard
                key={defender.battleId}
                card={defender}
                impact={isImpact}
                dying={isDying}
                damage={damage}
                owned={false}
              />
            )}
          </div>

          {/* Center band — dashed lane separator with the TurnChip
              hanging in the middle, same as the in-game divider. */}
          <div className="gp-divider">
            <div className="gp-divider-line" aria-hidden />
            <TurnChip turnNumber={turn} limit={20} />
            <div className="gp-divider-line" aria-hidden />
          </div>

          {/* Player field — attacker centered. */}
          <div className="gp-field">
            <div className={`gp-attacker-wrap ${phase === 'rest' ? 'gp-attacker-rest' : ''}`}>
              <BattlefieldCard
                card={attacker}
                lunging={isLunging ? 'up' : null}
                owned={true}
              />
            </div>
          </div>

          {/* Player footer: portrait + mana + name on the left,
              graveyard on the right. Same shape as the opp header. */}
          <div className="gp-header">
            <Portrait
              avatar={<UserRound size={18} strokeWidth={2.2} />}
              avatarBg="linear-gradient(135deg, #ffd166, #ff7e5f)"
              avatarRing="conic-gradient(from 90deg, #ff7e5f, #ffd166, #ff7e5f)"
              hp={24}
              ring={null}
              hit={false}
              damage={null}
              onClick={() => {}}
            />
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
// Theme grid — six photo prompts, each one a mini themed tile
// ============================================================================

function ThemeGrid() {
  const ids: ElementId[] = ['family', 'animals', 'work', 'travel', 'food', 'education'];
  return (
    <section className="landing-themes">
      <div className="landing-section-title">
        <span>Six photo prompts</span>
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
  { who: 'jules',    what: 'beat Vex on Mythic',        rarity: 'rare' },
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
// Auth panel — the embedded sign-in / sign-up form
// ============================================================================

function AuthPanel(props: {
  mode: 'signin' | 'signup'; setMode: (m: 'signin' | 'signup') => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  displayName: string; setDisplayName: (v: string) => void;
  err: string | null; busy: boolean;
  submit: (e: React.FormEvent) => void;
  onGoogle: () => void;
  unconfigured: boolean;
}) {
  const { mode, setMode, email, setEmail, password, setPassword,
    displayName, setDisplayName, err, busy, submit, onGoogle, unconfigured } = props;

  return (
    <section className="landing-auth">
      <div className="landing-auth-card">
        <div className="landing-auth-brand">
          <img src="/logo.png" alt="" width={64} height={64}
            style={{ filter: 'drop-shadow(0 0 14px rgba(255, 159, 28, .45))' }} />
          <h2 className="landing-auth-title">
            {mode === 'signin' ? 'Welcome back' : 'Begin your album'}
          </h2>
          <div className="landing-auth-sub">
            {mode === 'signin'
              ? 'Sign in to your collection'
              : 'Create an account — your cards travel with you'}
          </div>
        </div>

        <form onSubmit={submit} className="landing-auth-form">
          {mode === 'signup' && (
            <Field label="Player Name" value={displayName} onChange={setDisplayName}
              placeholder="The legend they will remember" autoComplete="nickname" />
          )}
          <Field label="Email" value={email} onChange={setEmail}
            placeholder="you@aether.example" type="email" autoComplete="email" required />
          <Field label="Password" value={password} onChange={setPassword}
            placeholder="6+ characters" type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />

          {err && <div className="landing-auth-err">{err}</div>}

          <button type="submit" disabled={busy} className="landing-auth-submit">
            {busy ? 'Summoning…' : (mode === 'signin' ? 'Enter the Arena' : 'Create Account')}
          </button>

          <div className="landing-auth-or">
            <span /> OR <span />
          </div>

          <button type="button" onClick={onGoogle} disabled={busy} className="landing-auth-google">
            <GoogleGlyph />
            Continue with Google
          </button>

          <button type="button" className="landing-auth-switch"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin'
              ? 'New here? Create an account →'
              : 'Already have a deck? Sign in →'}
          </button>
        </form>

        {unconfigured && (
          <div className="landing-auth-hint">
            Firebase keys missing. Copy <code>.env.example</code> to <code>.env.local</code> and
            fill in your Firebase web app config.
          </div>
        )}
      </div>
    </section>
  );
}

function Field(props: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoComplete?: string; required?: boolean;
}) {
  return (
    <label className="landing-field">
      <span className="landing-field-label">{props.label}</span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        required={props.required}
        className="landing-field-input"
      />
    </label>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.5 29.4 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13.5 24 13.5c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 7.5 29.4 5.5 24 5.5 16.3 5.5 9.7 9.6 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5.3 0 10.1-2 13.7-5.3l-6.3-5.2c-2 1.4-4.6 2.3-7.4 2.3-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.6 38.4 16.2 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.2C40.9 36.4 43.5 30.7 43.5 24c0-1.2-.1-2.3-.3-3.5z"/>
    </svg>
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

  /* Auth panel — same paper-on-cream surface as the rest of the app -- */
  .landing-auth {
    padding: 36px 20px 24px;
    display: flex; justify-content: center;
    position: relative; z-index: 2;
  }
  .landing-auth-card {
    width: min(440px, 100%);
    background: #ffffff;
    border: 1.5px solid rgba(58, 46, 42, .08);
    border-radius: 22px;
    padding: 26px 22px 22px;
    box-shadow: 0 18px 48px rgba(58, 46, 42, .12);
  }
  .landing-auth-brand { text-align: center; margin-bottom: 18px; }
  .landing-auth-title {
    margin: 8px 0 4px;
    font-family: Fredoka, system-ui, sans-serif;
    font-size: 24px; font-weight: 700;
    background: linear-gradient(135deg, #ff9f1c 0%, #ff7e5f 60%, #ee5a52 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: .4px;
  }
  .landing-auth-sub {
    font-size: 12px; letter-spacing: 2px; color: #a89580;
    text-transform: uppercase; font-weight: 600;
  }
  .landing-auth-form { display: flex; flex-direction: column; gap: 10px; }
  .landing-field { display: flex; flex-direction: column; gap: 4px; }
  .landing-field-label {
    font-size: 11px; letter-spacing: 1.5px;
    color: #7a5a52; text-transform: uppercase; font-weight: 600;
  }
  .landing-field-input {
    padding: 11px 12px; border-radius: 10px;
    border: 1.5px solid rgba(58, 46, 42, .12);
    background: #fef8f0;
    color: #3a2e2a; font-size: 14px; outline: none;
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .landing-field-input::placeholder { color: #a89580; }
  .landing-field-input:focus {
    border-color: #ee5a52;
    box-shadow: 0 0 0 3px rgba(238, 90, 82, .12);
    background: #fff;
  }
  .landing-auth-err {
    font-size: 12px; color: #c8362e;
    background: rgba(238, 90, 82, .08);
    border: 1px solid rgba(238, 90, 82, .3);
    border-radius: 10px; padding: 8px 10px;
  }
  /* Mirrors btnPrimary — same gradient + shadow stack the in-game CTAs use */
  .landing-auth-submit {
    margin-top: 6px; padding: 14px 16px; border-radius: 22px; border: none;
    cursor: pointer;
    background: linear-gradient(180deg, #ffa07a 0%, #ff7e5f 60%, #ee5a52 100%);
    color: #fff; font-weight: 700; font-size: 15px; letter-spacing: .5px;
    box-shadow: 0 6px 18px rgba(255, 94, 60, .35), inset 0 1px 0 rgba(255,255,255,.4);
    font-family: Fredoka, system-ui, sans-serif;
  }
  .landing-auth-submit:disabled { opacity: .6; cursor: wait; }
  .landing-auth-or {
    display: flex; align-items: center; gap: 8px; margin: 4px 0;
    color: #a89580; font-size: 11px;
  }
  .landing-auth-or span { flex: 1; height: 1px; background: rgba(58, 46, 42, .12); }
  .landing-auth-google {
    padding: 11px 14px; border-radius: 22px;
    border: 1.5px solid rgba(58, 46, 42, .14);
    background: #fff; color: #3a2e2a;
    font-weight: 600; font-size: 14px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
  }
  .landing-auth-google:hover { background: #fef8f0; border-color: rgba(58, 46, 42, .25); }
  .landing-auth-google:disabled { opacity: .6; cursor: wait; }
  .landing-auth-switch {
    margin-top: 8px; padding: 6px; background: none; border: none;
    color: #ee5a52; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .landing-auth-switch:hover { text-decoration: underline; }
  .landing-auth-hint {
    margin-top: 14px; font-size: 11px; line-height: 1.5;
    color: #7a5a52; text-align: center;
    border-top: 1px solid rgba(58, 46, 42, .08); padding-top: 12px;
  }
  .landing-auth-hint code { color: #ee5a52; background: #ffe8d6; padding: 1px 4px; border-radius: 4px; }

  .landing-footer {
    text-align: center;
    padding: 20px;
    font-size: 12px; letter-spacing: 2px; text-transform: uppercase;
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

  /* Center band — dashed lane on either side of the TurnChip, same
     visual the in-game MatchBoard uses to mark the turn count. */
  .gp-divider {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 0;
  }
  .gp-divider-line {
    flex: 1;
    border-top: 1px dashed rgba(58, 46, 42, .22);
  }

  /* Field rows — creatures are dead-center horizontally. The min-
     height carves out enough room for the BattlefieldCard's 56×76px
     box plus a little breathing room for the lunge animation. */
  .gp-field {
    display: flex; align-items: center; justify-content: center;
    min-height: 92px;
    padding: 4px 0;
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
