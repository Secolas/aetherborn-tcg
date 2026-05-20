import { useMemo, useState } from 'react';
import { useAuth } from '../firebase/auth';
import { ELEMENTS } from '../data/elements';
import { ElementGlyph } from '../components/ElementGlyph';
import type { ElementId } from '../game/types';

/** Animated TCG card showcase login screen. Floating sample cards drift
 *  behind a centered auth form. The cards aren't real game state —
 *  they're decoration sized + colored from the existing element palette
 *  so the screen feels native to the rest of the app. */
interface LoginProps {
  /** Which form the screen mounts in. Landing-page CTAs pre-select
   *  'signup' (for "Begin your album") or 'signin' (for the "Sign in"
   *  button). Defaults to 'signin' for the cold-load "returning user"
   *  flow. */
  initialMode?: 'signin' | 'signup';
  /** When set, renders a small "← Back" chip in the top-left that
   *  takes the user back to the marketing landing page. Omitted when
   *  Login is the cold-load entry (no landing to go back to). */
  onBackToLanding?: () => void;
}

export function Login({ initialMode = 'signin', onBackToLanding }: LoginProps = {}) {
  const { signUp, signIn, signInWithGoogle, unconfigured } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unconfigured) {
      setErr('Firebase not configured — see .env.example');
      return;
    }
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
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-root" style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      // Match the in-app palette — same cream paper (#fef8f0) the
      // HomeMenu and the landing page sit on. The dark floating TCG
      // cards stay dark by design (they're TCG cards) and now pop
      // against the cream instead of competing on a dark backdrop.
      background: 'radial-gradient(ellipse at 80% 0%, #ffe8d6 0%, #fef8f0 55%, #fef8f0 100%)',
      color: '#3a2e2a',
    }}>
      <style>{`
        @keyframes float-card {
          0%   { transform: translate(0,0) rotate(var(--rot)); }
          50%  { transform: translate(var(--dx), var(--dy)) rotate(calc(var(--rot) + var(--spin))); }
          100% { transform: translate(0,0) rotate(var(--rot)); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%      { opacity: 0.75; transform: scale(1.08); }
        }
        @keyframes drift-bg {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
        @keyframes title-shimmer {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 12px rgba(255, 159, 28, .35)); }
          50%      { filter: brightness(1.08) drop-shadow(0 0 22px rgba(238, 90, 82, .55)); }
        }
        @keyframes login-card-in {
          0%   { opacity: 0; transform: translate(0,0) rotate(var(--rot)) scale(.9); }
          100% { opacity: .85; transform: translate(0,0) rotate(var(--rot)) scale(1); }
        }
        /* Prismatic rainbow flow — same animation the landing's
           floating showcase cards carry. The two stacked
           repeating-linear-gradients shift their background-position
           on an infinite loop, producing the iridescent "shifts as it
           moves" foil look. mix-blend-mode: color-dodge bakes it into
           the themed gradient underneath. */
        @keyframes prism-flow {
          0%   { background-position: 0% 0%, 100% 100%; }
          100% { background-position: 100% 100%, 0% 0%; }
        }
        .login-floating-prism {
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
        /* Two animations layered:
           - login-card-in: a one-shot fade+scale so the cards don't pop
             from rotation:0 to their tilted base when the delay expires
           - float-card: the gentle bob/spin loop after the intro
           animation-fill-mode: both ensures the cards sit at keyframe-0
           during the delay window AND retain the final state, so there's
           no snap-rotation between the two phases.
           will-change: transform hints the compositor to GPU-layer them
           so the animation runs smoothly on mobile. */
        .login-card {
          opacity: 0;
          will-change: transform, opacity;
          transform: rotate(var(--rot));
          animation:
            login-card-in 600ms ease-out both,
            float-card 8s ease-in-out infinite;
          animation-delay: 0s, var(--card-delay, 0s);
        }
        .login-glow { animation: pulse-glow 6s ease-in-out infinite; }

        /* The login screen scrolls instead of overflowing so the iOS
           keyboard never clips the form. We use the inner scroll
           container for flex-centering; on tall phones the form sits
           centered, on short ones (keyboard open) it scrolls. */
        .login-scroll {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          padding: 24px 18px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* The floating sample cards are decorative — on narrow screens
           they crash into the auth form and only add visual noise.
           Hide them below 600px and let the starfield + form carry the
           atmosphere instead. */
        @media (max-width: 600px) {
          .login-floating-card { display: none !important; }
        }

        /* Logo + title scale down on small phones so the form stays
           one tap away from the password field. */
        @media (max-width: 480px) {
          .login-brand img { width: 96px !important; }
          .login-brand h1 { font-size: 26px !important; }
        }
      `}</style>

      {/* Drifting warm-dot decor — same warm-coral / warm-orange dot
          drift the landing's WarmDecor uses. The starfield is gone
          since white dots on cream wouldn't read; these soft brand
          dots give the page motion without breaking the paper
          aesthetic. */}
      <div style={{
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

      {/* Floating sample cards — hidden on narrow screens via the
          .login-floating-card media query above. */}
      <FloatingCard el="family"   top="12%" left="8%"   rot={-12} delay={0}   />
      <FloatingCard el="animals"  top="22%" left="78%"  rot={14}  delay={1.2} />
      <FloatingCard el="work"     top="68%" left="12%"  rot={8}   delay={2.4} />
      <FloatingCard el="travel"   top="72%" left="74%"  rot={-10} delay={0.8} />
      <FloatingCard el="food"     top="42%" left="86%"  rot={-6}  delay={3.0} small />
      <FloatingCard el="education" top="48%" left="4%"  rot={4}   delay={1.7} small />

      {/* Back-to-landing chip — only rendered when this Login screen
          was opened from the marketing landing page. Lets the user
          retreat to the marketing copy if they got here by mistake
          or want to re-read the pitch before signing up. */}
      {onBackToLanding && (
        <button
          type="button"
          onClick={onBackToLanding}
          aria-label="Back to landing page"
          style={{
            position: 'absolute', top: 14, left: 14, zIndex: 5,
            padding: '7px 13px', borderRadius: 999,
            background: '#fff',
            border: '1.5px solid rgba(238, 90, 82, .3)',
            color: '#ee5a52',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(238, 90, 82, .12)',
          }}
        >
          ← Back
        </button>
      )}

      {/* Scroll wrapper — lets the form move with the iOS keyboard
          instead of getting clipped behind it. */}
      <div className="login-scroll">

      {/* Center auth panel — white paper card matching the in-game
          surface (HomeMenu, Cosmetics, etc.). Warm shadow gives it
          a soft lift off the cream backdrop. */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: 'min(420px, 100%)',
        background: '#ffffff',
        border: '1.5px solid rgba(58, 46, 42, .08)',
        borderRadius: 22,
        padding: '24px 22px 22px',
        boxShadow: '0 18px 48px rgba(58, 46, 42, .12)',
      }}>
        <div className="login-brand" style={{ textAlign: 'center', marginBottom: 18 }}>
          {/* App brand mark — transparent PNG of the ornate "M in a
              starlit spellbook" logo. Coral halo replaces the gold
              now that the surface is white paper, matching the
              landing page's logo treatment. */}
          <img
            src="/logo.png"
            alt="Memoria"
            style={{
              display: 'block', margin: '0 auto 6px',
              width: 130, height: 'auto',
              filter: 'drop-shadow(0 0 18px rgba(255, 159, 28, .45)) drop-shadow(0 8px 18px rgba(58, 46, 42, .25))',
              animation: 'title-shimmer 4s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
          <h1 style={{
            margin: 0,
            fontFamily: 'Fredoka, system-ui, sans-serif',
            fontSize: 30, fontWeight: 700,
            background: 'linear-gradient(135deg, #ff9f1c 0%, #ff7e5f 60%, #ee5a52 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: 0.5,
            animation: 'title-shimmer 4s ease-in-out infinite',
          }}>
            MEMORIA
          </h1>
          <div style={{ marginTop: 4, fontSize: 12, letterSpacing: 4, color: '#a89580', fontWeight: 600 }}>
            TCG · {mode === 'signin' ? 'WELCOME BACK' : 'BEGIN YOUR ALBUM'}
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'signup' && (
            <Field
              label="Player Name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="The legend they will remember"
              autoComplete="nickname"
            />
          )}
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="6+ characters"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
          />

          {err && (
            <div style={{
              fontSize: 12, color: '#c8362e',
              background: 'rgba(238, 90, 82, .08)',
              border: '1px solid rgba(238, 90, 82, .3)',
              borderRadius: 10, padding: '8px 10px',
            }}>{err}</div>
          )}

          {/* Mirrors the in-game btnPrimary — same coral gradient +
              shadow stack the rest of the app's CTAs use. */}
          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 6,
              padding: '14px 16px',
              borderRadius: 22,
              border: 'none',
              cursor: busy ? 'wait' : 'pointer',
              background: 'linear-gradient(180deg, #ffa07a 0%, #ff7e5f 60%, #ee5a52 100%)',
              color: '#fff',
              fontFamily: '"Fredoka", system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: 0.5,
              boxShadow: '0 6px 18px rgba(255, 94, 60, .35), inset 0 1px 0 rgba(255,255,255,.4)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Summoning...' : (mode === 'signin' ? 'Enter the Arena' : 'Create Account')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', color: '#a89580', fontSize: 11 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(58, 46, 42, .12)' }} />
            OR
            <div style={{ flex: 1, height: 1, background: 'rgba(58, 46, 42, .12)' }} />
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            style={{
              padding: '11px 14px',
              borderRadius: 22,
              border: '1.5px solid rgba(58, 46, 42, .14)',
              background: '#fff',
              color: '#3a2e2a', fontWeight: 600, fontSize: 14,
              cursor: busy ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => { setErr(null); setMode(mode === 'signin' ? 'signup' : 'signin'); }}
            style={{
              marginTop: 8, padding: 6, background: 'none', border: 'none',
              color: '#ee5a52', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {mode === 'signin'
              ? "New here? Create an account →"
              : "Already have a deck? Sign in →"}
          </button>
        </form>

        {unconfigured && (
          <div style={{
            marginTop: 14, fontSize: 11, lineHeight: 1.5,
            color: '#7a5a52',
            textAlign: 'center',
            borderTop: '1px solid rgba(58, 46, 42, .08)', paddingTop: 12,
          }}>
            Firebase keys missing. Copy <code style={{ color: '#ee5a52', background: '#ffe8d6', padding: '1px 4px', borderRadius: 4 }}>.env.example</code> to <code style={{ color: '#ee5a52', background: '#ffe8d6', padding: '1px 4px', borderRadius: 4 }}>.env.local</code> and fill in your Firebase web app config.
          </div>
        )}
      </div>
      </div>{/* /login-scroll */}
    </div>
  );
}

function Field(props: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoComplete?: string; required?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, letterSpacing: 1.5, color: '#7a5a52', textTransform: 'uppercase', fontWeight: 600 }}>
        {props.label}
      </span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        required={props.required}
        style={{
          padding: '11px 12px',
          borderRadius: 10,
          border: '1.5px solid rgba(58, 46, 42, .12)',
          background: '#fef8f0',
          color: '#3a2e2a',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color .15s ease, box-shadow .15s ease, background .15s ease',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#ee5a52';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(238, 90, 82, .12)';
          e.currentTarget.style.background = '#fff';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(58, 46, 42, .12)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.background = '#fef8f0';
        }}
      />
    </label>
  );
}

function FloatingCard(props: {
  el: ElementId; top: string; left: string; rot: number; delay: number; small?: boolean;
}) {
  const def = ELEMENTS[props.el];
  const w = props.small ? 90 : 120;
  const h = props.small ? 130 : 170;
  // Per-card jitter is randomized once at mount so the float animation
  // doesn't reset to a new path on every render.
  const { dx, dy, spin } = useMemo(() => ({
    dx: (Math.random() * 30 - 15).toFixed(1) + 'px',
    dy: (Math.random() * 30 - 15).toFixed(1) + 'px',
    spin: (Math.random() * 6 - 3).toFixed(1) + 'deg',
  }), []);
  return (
    <div
      className="login-card login-floating-card"
      style={{
        position: 'absolute', top: props.top, left: props.left,
        width: w, height: h,
        ['--rot' as string]: `${props.rot}deg`,
        ['--dx' as string]: dx,
        ['--dy' as string]: dy,
        ['--spin' as string]: spin,
        // --card-delay only delays the float-card loop. The fade-in
        // animation runs immediately so the cards don't pop into
        // visibility at staggered times.
        ['--card-delay' as string]: `${props.delay}s`,
        borderRadius: 14,
        background: `linear-gradient(160deg, ${def.color} 0%, ${def.deep} 100%)`,
        border: `1.5px solid ${def.glow}`,
        // Warm-tinted drop shadow on cream — saturated black would
        // leave a harsh silhouette on the paper backdrop.
        boxShadow: `0 14px 28px rgba(58, 46, 42, .22), 0 0 22px ${def.glow}44`,
        padding: 8,
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'none',
        overflow: 'hidden',
      } as React.CSSProperties}
    >
      <div style={{ fontSize: props.small ? 10 : 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
        {def.name}
      </div>
      {/* Themed art window. The radial glow stays from the original
          design but the in-game ElementGlyph icon (paw / heart /
          briefcase / etc.) sits on top so the card reads as its
          theme at a glance — same icons the BattlefieldCard and the
          landing's floating showcase cards use. */}
      <div
        className="login-glow"
        style={{
          flex: 1, margin: '6px 0', borderRadius: 8,
          background: `radial-gradient(ellipse at center, ${def.glow}cc 0%, transparent 70%)`,
          display: 'grid', placeItems: 'center',
          color: '#fff',
        }}
      >
        <ElementGlyph el={props.el} size={props.small ? 32 : 44} bare />
      </div>
      <div style={{ fontSize: props.small ? 8 : 9, color: 'rgba(255,255,255,0.78)', fontStyle: 'italic' }}>
        {def.blurb}
      </div>
      {/* Prismatic foil overlay — the same iridescent flow the
          landing showcase cards carry. Painted absolutely on top of
          the gradient with mix-blend-mode: color-dodge so the
          rainbow tints the underlying theme color instead of
          flattening it. */}
      <div className="login-floating-prism" aria-hidden />
    </div>
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
