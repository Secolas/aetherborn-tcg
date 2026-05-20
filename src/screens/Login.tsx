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
      background: 'radial-gradient(ellipse at 30% 20%, #2a1b4a 0%, #0a0c1c 60%, #050816 100%)',
      color: '#fff',
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
          0%, 100% { filter: brightness(1) drop-shadow(0 0 12px rgba(244,208,74,.4)); }
          50%      { filter: brightness(1.15) drop-shadow(0 0 24px rgba(244,208,74,.85)); }
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

      {/* Drifting starfield */}
      <div style={{
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
            padding: '6px 12px', borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: 'rgba(255,255,255,0.78)',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          ← Back
        </button>
      )}

      {/* Scroll wrapper — lets the form move with the iOS keyboard
          instead of getting clipped behind it. */}
      <div className="login-scroll">

      {/* Center auth panel */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: 'min(420px, 100%)',
        background: 'rgba(8, 10, 24, 0.78)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(244, 208, 74, 0.22)',
        borderRadius: 22,
        padding: '24px 22px 22px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(244, 208, 74, 0.12) inset',
      }}>
        <div className="login-brand" style={{ textAlign: 'center', marginBottom: 18 }}>
          {/* App brand mark — transparent PNG of the ornate "M in a
              starlit spellbook" logo. Sits free on the dark backdrop
              with a warm golden halo behind it for depth. The pulse
              animation matches the title shimmer below. */}
          <img
            src="/logo.png"
            alt="Memoria"
            style={{
              display: 'block', margin: '0 auto 6px',
              width: 130, height: 'auto',
              filter: 'drop-shadow(0 0 18px rgba(244, 208, 74, 0.45)) drop-shadow(0 8px 18px rgba(0,0,0,0.55))',
              animation: 'title-shimmer 4s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
          <h1 style={{
            margin: 0,
            fontFamily: 'Fredoka, system-ui, sans-serif',
            fontSize: 30, fontWeight: 700,
            background: 'linear-gradient(135deg, #f4d04a 0%, #f49a4a 60%, #d96658 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: 0.5,
            animation: 'title-shimmer 4s ease-in-out infinite',
          }}>
            MEMORIA
          </h1>
          <div style={{ marginTop: 4, fontSize: 12, letterSpacing: 4, color: 'rgba(255,255,255,0.55)' }}>
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
              fontSize: 12, color: '#ffb4a8',
              background: 'rgba(217, 102, 88, 0.18)',
              border: '1px solid rgba(217, 102, 88, 0.4)',
              borderRadius: 10, padding: '8px 10px',
            }}>{err}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 6,
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              cursor: busy ? 'wait' : 'pointer',
              background: 'linear-gradient(135deg, #f4d04a 0%, #f49a4a 100%)',
              color: '#2a1a06',
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: 0.5,
              boxShadow: '0 8px 24px rgba(244, 154, 74, 0.4)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Summoning...' : (mode === 'signin' ? 'Enter the Arena' : 'Create Account')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            OR
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff', fontWeight: 600, fontSize: 14,
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
              color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer',
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
            color: 'rgba(255,255,255,0.55)',
            textAlign: 'center',
            borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12,
          }}>
            Firebase keys missing. Copy <code style={{ color: '#f4d04a' }}>.env.example</code> to <code style={{ color: '#f4d04a' }}>.env.local</code> and fill in your Firebase web app config.
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
      <span style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>
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
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(255,255,255,0.04)',
          color: '#fff',
          fontSize: 14,
          outline: 'none',
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(244, 208, 74, 0.55)'}
        onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'}
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
        boxShadow: `0 16px 40px rgba(0,0,0,0.55), 0 0 30px ${def.glow}40`,
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
