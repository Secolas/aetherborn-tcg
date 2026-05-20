import { useMemo, useRef, useState, useEffect, type CSSProperties } from 'react';
import { useAuth } from '../firebase/auth';
import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../game/types';

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
      background: 'radial-gradient(ellipse at 30% 10%, #2a1b4a 0%, #0a0c1c 55%, #050816 100%)',
      color: '#fff',
    }}>
      <LandingStyles />
      <Starfield />

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

function HeroSection({ onCta }: { onCta: () => void }) {
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
            Your dog becomes an Ember Hound. Your morning coffee becomes a Bloomshield.
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
          {/* Idle-floating supporting cards. Tilt is disabled — they're
              decoration; the hero card below owns the interactive role. */}
          <FloatingShowcaseCard el="animals" left="2%"  top="6%"  rot={-12} delay={0}   small />
          <FloatingShowcaseCard el="food"    left="76%" top="12%" rot={10}  delay={1.4} small />
          <FloatingShowcaseCard el="travel"  left="78%" top="68%" rot={-6}  delay={0.7} small />
          <FloatingShowcaseCard el="education" left="0%" top="62%" rot={5}  delay={2.1} small />

          {/* The interactive hero card — 3D tilt + foil sheen + prismatic
              shiny overlay. Center stage. */}
          <HoloCard el="family" name="Mom" type="Creature" rarity="legendary"
            cost={4} atk={3} hp={6} flavor="She was always the one who carried you." />
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
  rarity: 'common' | 'rare' | 'legendary';
  cost: number;
  atk: number;
  hp: number;
  flavor: string;
}

function HoloCard({ el, name, type, rarity, cost, atk, hp, flavor }: HoloCardProps) {
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
          boxShadow: `0 30px 70px rgba(0,0,0,0.6), 0 0 40px ${def.glow}66`,
        }}
      >
        {/* Top bar: cost gem + element name */}
        <div className="holo-toprow">
          <div className="holo-cost" style={{ background: def.glow, color: def.deep }}>{cost}</div>
          <div className="holo-element">{def.name}</div>
          <div className="holo-rarity">{rarity}</div>
        </div>

        {/* Art window — a stylized photo placeholder.
            Sits inside its own border so the foil layers above clip cleanly. */}
        <div className="holo-art">
          <div className="holo-art-bg" style={{
            background: `radial-gradient(ellipse at 50% 35%, ${def.glow}cc 0%, ${def.deep} 70%)`,
          }} />
          <div className="holo-art-icon">{cardEmoji(el, name)}</div>
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

        {/* Flavor */}
        <div className="holo-flavor">{flavor}</div>

        {/* Footer stat ribbon */}
        <div className="holo-footer">
          <div className="holo-type">{type}</div>
          <div className="holo-stats">
            <span className="holo-atk">{atk}</span>
            <span className="holo-sep">/</span>
            <span className="holo-hp">{hp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tiny inline glyph stand-in for the photo art — keeps the landing
 *  page self-contained without bundling sample images. */
function cardEmoji(el: ElementId, _name: string): string {
  switch (el) {
    case 'family': return '♥';
    case 'work': return '⚙';
    case 'animals': return '★';
    case 'travel': return '✈';
    case 'food': return '◉';
    case 'education': return '✦';
    default: return '✦';
  }
}

// ============================================================================
// Floating idle card — decorative, bobs in place, has rainbow shimmer
// ============================================================================

function FloatingShowcaseCard(props: {
  el: ElementId; top: string; left: string; rot: number; delay: number; small?: boolean;
}) {
  const def = ELEMENTS[props.el];
  const w = props.small ? 80 : 110;
  const h = props.small ? 116 : 158;
  const { dx, dy, spin } = useMemo(() => ({
    dx: (Math.random() * 24 - 12).toFixed(1) + 'px',
    dy: (Math.random() * 24 - 12).toFixed(1) + 'px',
    spin: (Math.random() * 6 - 3).toFixed(1) + 'deg',
  }), []);
  return (
    <div
      className="landing-floating"
      style={{
        position: 'absolute', top: props.top, left: props.left,
        width: w, height: h,
        ['--rot' as string]: `${props.rot}deg`,
        ['--dx' as string]: dx,
        ['--dy' as string]: dy,
        ['--spin' as string]: spin,
        ['--card-delay' as string]: `${props.delay}s`,
        borderRadius: 12,
        background: `linear-gradient(160deg, ${def.color} 0%, ${def.deep} 100%)`,
        border: `1.5px solid ${def.glow}`,
        boxShadow: `0 14px 36px rgba(0,0,0,0.55), 0 0 22px ${def.glow}33`,
        padding: 7,
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'none',
        overflow: 'hidden',
      } as CSSProperties}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{def.name}</div>
      <div style={{
        flex: 1, margin: '5px 0', borderRadius: 6,
        background: `radial-gradient(ellipse at center, ${def.glow}cc 0%, transparent 70%)`,
      }} />
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,.78)', fontStyle: 'italic' }}>
        {def.blurb.slice(0, 28)}
      </div>
      {/* Subtle prismatic flow on every floating card — soft so it
          doesn't compete with the hero card's brighter shine */}
      <div className="landing-floating-prism" />
    </div>
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
              boxShadow: `0 10px 24px rgba(0,0,0,.45), inset 0 0 30px ${def.glow}22`,
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

const TICKER_ITEMS: { who: string; what: string; rarity: 'common' | 'rare' | 'legendary' }[] = [
  { who: 'maya',     what: 'summoned Ember Hound',   rarity: 'rare' },
  { who: 'kenji',    what: 'photographed Mom',       rarity: 'legendary' },
  { who: 'leon',     what: 'caught a Bloomshield',   rarity: 'rare' },
  { who: 'priya',    what: 'snapped Morning Coffee', rarity: 'common' },
  { who: 'sasha',    what: 'pulled a Mythic pack',   rarity: 'legendary' },
  { who: 'alex',     what: 'opened Family pack',     rarity: 'common' },
  { who: 'devon',    what: 'awoke The Boss',         rarity: 'legendary' },
  { who: 'noor',     what: 'summoned Cousin',        rarity: 'common' },
  { who: 'jules',    what: 'beat Vex on Mythic',     rarity: 'rare' },
  { who: 'ren',      what: 'photographed Abuela',    rarity: 'rare' },
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
            style={{ filter: 'drop-shadow(0 0 14px rgba(244,208,74,.45))' }} />
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
// Background starfield
// ============================================================================

function Starfield() {
  return (
    <div className="landing-starfield" aria-hidden style={{
      position: 'absolute', inset: 0,
      background: `radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,.6) 0%, transparent 50%),
                   radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,.5) 0%, transparent 50%),
                   radial-gradient(2px 2px at 40% 80%, rgba(255,255,255,.4) 0%, transparent 50%),
                   radial-gradient(1px 1px at 85% 25%, rgba(255,255,255,.7) 0%, transparent 50%),
                   radial-gradient(1px 1px at 10% 70%, rgba(255,255,255,.5) 0%, transparent 50%)`,
      backgroundSize: '600px 600px',
      animation: 'drift-bg 60s linear infinite',
      opacity: 0.7,
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
    0%, 100% { filter: brightness(1) drop-shadow(0 0 12px rgba(244,208,74,.4)); }
    50%      { filter: brightness(1.15) drop-shadow(0 0 24px rgba(244,208,74,.85)); }
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
    0%, 100% { box-shadow: 0 0 0 0 rgba(244, 102, 88, .55); }
    50%      { box-shadow: 0 0 0 6px rgba(244, 102, 88, 0); }
  }
  @keyframes holo-idle {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-8px); }
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
    background: linear-gradient(180deg, rgba(5,8,22,.85) 0%, rgba(5,8,22,.55) 70%, rgba(5,8,22,0) 100%);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .landing-topbar-brand {
    display: flex; align-items: center; gap: 8px;
    font-family: Fredoka, system-ui, sans-serif; font-weight: 700;
    letter-spacing: 3px; font-size: 13px; color: #f4d04a;
  }
  .landing-topbar-btn {
    padding: 7px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(244,208,74,.35);
    color: #f4d04a;
    font-weight: 600; font-size: 13px;
    cursor: pointer;
  }
  .landing-topbar-btn:hover { background: rgba(244,208,74,.12); }

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
    font-size: 11px; letter-spacing: 4px; color: rgba(244,208,74,.85);
    font-weight: 700; margin-bottom: 8px;
  }
  .landing-h1 {
    margin: 0;
    font-family: Fredoka, system-ui, sans-serif;
    font-size: 38px; line-height: 1.05; font-weight: 700;
    color: #fff;
    text-shadow: 0 4px 18px rgba(0,0,0,.55);
  }
  .landing-h1-accent {
    background: linear-gradient(135deg, #f4d04a 0%, #f49a4a 60%, #d96658 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: title-shimmer 4s ease-in-out infinite;
  }
  .landing-lede {
    margin: 14px 0 0;
    color: rgba(255,255,255,.78);
    font-size: 15px; line-height: 1.55;
    max-width: 520px;
  }
  .landing-cta-row {
    display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;
  }
  .landing-cta-primary {
    padding: 13px 22px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #f4d04a 0%, #f49a4a 100%);
    color: #2a1a06; font-weight: 700; font-size: 15px;
    letter-spacing: 0.4px;
    box-shadow: 0 10px 28px rgba(244,154,74,.4);
    cursor: pointer;
  }
  .landing-cta-primary:hover { transform: translateY(-1px); }
  .landing-cta-ghost {
    padding: 13px 22px; border-radius: 12px;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.18);
    color: #fff; font-weight: 600; font-size: 14px;
    cursor: pointer;
  }
  .landing-cta-ghost:hover { background: rgba(255,255,255,.1); }

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

  /* Floating decorative cards */
  .landing-floating {
    opacity: 0;
    animation:
      landing-card-in 600ms ease-out both,
      float-card 8s ease-in-out infinite;
    animation-delay: 0s, var(--card-delay, 0s);
    transform: rotate(var(--rot));
    will-change: transform, opacity;
  }
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
    animation: holo-idle 5s ease-in-out infinite;
    z-index: 2;
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
  .holo-rarity { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; opacity: .8; }
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
  .holo-stats { font-family: Fredoka, system-ui, sans-serif; font-size: 16px; font-weight: 700; }
  .holo-atk { color: #ffb86c; }
  .holo-hp  { color: #ff6c8a; }
  .holo-sep { color: rgba(255,255,255,.4); margin: 0 4px; }
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
    color: rgba(255,255,255,.55);
    font-size: 11px; letter-spacing: 4px; text-transform: uppercase;
  }
  .landing-section-title span {
    padding: 0 12px; position: relative;
  }
  .landing-section-title span::before,
  .landing-section-title span::after {
    content: ''; position: absolute; top: 50%; width: 36px; height: 1px;
    background: rgba(255,255,255,.18);
  }
  .landing-section-title span::before { right: 100%; }
  .landing-section-title span::after  { left: 100%; }

  .landing-pitch-grid {
    display: grid; grid-template-columns: 1fr; gap: 12px;
    max-width: 880px; margin: 0 auto;
  }
  @media (min-width: 720px) { .landing-pitch-grid { grid-template-columns: repeat(3, 1fr); } }
  .landing-pitch-card {
    background: rgba(8, 10, 24, 0.6);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 16px;
    padding: 18px 16px;
    backdrop-filter: blur(8px);
  }
  .landing-pitch-num {
    width: 28px; height: 28px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #f4d04a 0%, #f49a4a 100%);
    color: #2a1a06; font-weight: 800; font-size: 14px;
    margin-bottom: 10px;
  }
  .landing-pitch-title { font-weight: 700; font-size: 16px; margin-bottom: 4px; color: #fff; }
  .landing-pitch-body { font-size: 13px; line-height: 1.5; color: rgba(255,255,255,.7); }

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
    border-top: 1px solid rgba(255,255,255,.08);
    border-bottom: 1px solid rgba(255,255,255,.08);
    background: rgba(8, 10, 24, 0.45);
    position: relative; z-index: 2;
  }
  .landing-ticker-label {
    display: flex; align-items: center; gap: 8px;
    padding: 0 20px 12px;
    font-size: 11px; letter-spacing: 3px; text-transform: uppercase;
    color: rgba(255,255,255,.65);
    font-weight: 600;
  }
  .landing-ticker-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #f46658;
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
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 999px;
    font-size: 13px;
    white-space: nowrap;
    color: rgba(255,255,255,.88);
  }
  .landing-ticker-rarity { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .landing-ticker-rarity.rar-common    { background: #9a958c; }
  .landing-ticker-rarity.rar-rare      { background: #6db4e8; box-shadow: 0 0 8px #6db4e8aa; }
  .landing-ticker-rarity.rar-legendary { background: #f4d04a; box-shadow: 0 0 10px #f4d04acc; }
  .landing-ticker-who { color: #f4d04a; font-weight: 600; }
  .landing-ticker-what { color: rgba(255,255,255,.78); }

  /* Auth panel -------------------------------------------------------- */
  .landing-auth {
    padding: 36px 20px 24px;
    display: flex; justify-content: center;
    position: relative; z-index: 2;
  }
  .landing-auth-card {
    width: min(440px, 100%);
    background: rgba(8, 10, 24, 0.82);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1px solid rgba(244,208,74,.22);
    border-radius: 22px;
    padding: 26px 22px 22px;
    box-shadow: 0 30px 80px rgba(0,0,0,.55), 0 0 60px rgba(244,208,74,.12) inset;
  }
  .landing-auth-brand { text-align: center; margin-bottom: 18px; }
  .landing-auth-title {
    margin: 8px 0 4px;
    font-family: Fredoka, system-ui, sans-serif;
    font-size: 24px; font-weight: 700;
    background: linear-gradient(135deg, #f4d04a 0%, #f49a4a 60%, #d96658 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: .4px;
  }
  .landing-auth-sub {
    font-size: 12px; letter-spacing: 2px; color: rgba(255,255,255,.55);
    text-transform: uppercase;
  }
  .landing-auth-form { display: flex; flex-direction: column; gap: 10px; }
  .landing-field { display: flex; flex-direction: column; gap: 4px; }
  .landing-field-label {
    font-size: 11px; letter-spacing: 1.5px;
    color: rgba(255,255,255,.55); text-transform: uppercase;
  }
  .landing-field-input {
    padding: 11px 12px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.04);
    color: #fff; font-size: 14px; outline: none;
  }
  .landing-field-input:focus { border-color: rgba(244,208,74,.55); }
  .landing-auth-err {
    font-size: 12px; color: #ffb4a8;
    background: rgba(217,102,88,.18);
    border: 1px solid rgba(217,102,88,.4);
    border-radius: 10px; padding: 8px 10px;
  }
  .landing-auth-submit {
    margin-top: 6px; padding: 12px 16px; border-radius: 12px; border: none;
    cursor: pointer;
    background: linear-gradient(135deg, #f4d04a 0%, #f49a4a 100%);
    color: #2a1a06; font-weight: 700; font-size: 15px; letter-spacing: .5px;
    box-shadow: 0 8px 24px rgba(244,154,74,.4);
  }
  .landing-auth-submit:disabled { opacity: .6; cursor: wait; }
  .landing-auth-or {
    display: flex; align-items: center; gap: 8px; margin: 4px 0;
    color: rgba(255,255,255,.4); font-size: 11px;
  }
  .landing-auth-or span { flex: 1; height: 1px; background: rgba(255,255,255,.12); }
  .landing-auth-google {
    padding: 10px 14px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,.18);
    background: rgba(255,255,255,.06); color: #fff;
    font-weight: 600; font-size: 14px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
  }
  .landing-auth-google:disabled { opacity: .6; cursor: wait; }
  .landing-auth-switch {
    margin-top: 8px; padding: 6px; background: none; border: none;
    color: rgba(255,255,255,.7); font-size: 13px; cursor: pointer;
  }
  .landing-auth-hint {
    margin-top: 14px; font-size: 11px; line-height: 1.5;
    color: rgba(255,255,255,.55); text-align: center;
    border-top: 1px solid rgba(255,255,255,.08); padding-top: 12px;
  }
  .landing-auth-hint code { color: #f4d04a; }

  .landing-footer {
    text-align: center;
    padding: 20px;
    font-size: 12px; letter-spacing: 2px; text-transform: uppercase;
    color: rgba(255,255,255,.35);
  }
`;
