import { useMemo, useState } from 'react';
import { useAuth } from '../firebase/auth';
import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../game/types';

/** Animated TCG card showcase login screen. Floating sample cards drift
 *  behind a centered auth form. The cards aren't real game state —
 *  they're decoration sized + colored from the existing element palette
 *  so the screen feels native to the rest of the app. */
export function Login() {
  const { signUp, signIn, signInWithGoogle, unconfigured } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
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
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
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
        .login-card { animation: float-card 8s ease-in-out infinite; }
        .login-glow { animation: pulse-glow 6s ease-in-out infinite; }
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

      {/* Floating sample cards */}
      <FloatingCard el="family"   top="12%" left="8%"   rot={-12} delay={0}   />
      <FloatingCard el="animals"  top="22%" left="78%"  rot={14}  delay={1.2} />
      <FloatingCard el="work"     top="68%" left="12%"  rot={8}   delay={2.4} />
      <FloatingCard el="travel"   top="72%" left="74%"  rot={-10} delay={0.8} />
      <FloatingCard el="food"     top="42%" left="86%"  rot={-6}  delay={3.0} small />
      <FloatingCard el="education" top="48%" left="4%"  rot={4}   delay={1.7} small />

      {/* Center auth panel */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: 'min(420px, 86%)',
        background: 'rgba(8, 10, 24, 0.78)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(244, 208, 74, 0.22)',
        borderRadius: 22,
        padding: '28px 26px 24px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(244, 208, 74, 0.12) inset',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h1 style={{
            margin: 0,
            fontFamily: 'Fredoka, system-ui, sans-serif',
            fontSize: 38, fontWeight: 700,
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
            placeholder="you@aether.example"
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
      className="login-card"
      style={{
        position: 'absolute', top: props.top, left: props.left,
        width: w, height: h,
        ['--rot' as string]: `${props.rot}deg`,
        ['--dx' as string]: dx,
        ['--dy' as string]: dy,
        ['--spin' as string]: spin,
        animationDelay: `${props.delay}s`,
        borderRadius: 14,
        background: `linear-gradient(160deg, ${def.color} 0%, ${def.deep} 100%)`,
        border: `1.5px solid ${def.glow}`,
        boxShadow: `0 16px 40px rgba(0,0,0,0.55), 0 0 30px ${def.glow}40`,
        padding: 8,
        display: 'flex', flexDirection: 'column',
        opacity: 0.85, pointerEvents: 'none',
      } as React.CSSProperties}
    >
      <div style={{ fontSize: props.small ? 10 : 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
        {def.name}
      </div>
      <div
        className="login-glow"
        style={{
          flex: 1, margin: '6px 0', borderRadius: 8,
          background: `radial-gradient(ellipse at center, ${def.glow}cc 0%, transparent 70%)`,
        }}
      />
      <div style={{ fontSize: props.small ? 8 : 9, color: 'rgba(255,255,255,0.78)', fontStyle: 'italic' }}>
        {def.blurb}
      </div>
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
