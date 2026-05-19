import { PALETTE } from './styles';

/**
 * Branded loading indicator — the Memoria book crest with a warm
 * pulsing halo behind it. Used everywhere the app is hydrating
 * (auth handshake, Firestore save fetch, PVP room subscribe, etc.)
 * so loading screens feel like the same product instead of bare
 * "Loading…" text.
 *
 * Pass a `tone` to match the surrounding chrome:
 *   - 'dark'  — for the deep gradient screens (auth, pre-save)
 *   - 'light' — for the warm peach screens (PVP intermediate states,
 *               anywhere already on the brand background)
 *
 * The logo file is the same `/logo.png` rendered on Home and Login,
 * so swapping the asset propagates everywhere.
 */
export function LogoLoader({
  caption,
  tone = 'dark',
  size = 140,
}: {
  caption?: string;
  tone?: 'dark' | 'light';
  size?: number;
}) {
  const captionColor = tone === 'dark'
    ? 'rgba(255,255,255,.78)'
    : PALETTE.textMid;
  const captionShadow = tone === 'dark'
    ? '0 1px 4px rgba(0,0,0,.5)'
    : 'none';
  // Coral on light, gold on dark — both read against their surfaces.
  const haloColor = tone === 'dark'
    ? 'rgba(255,209,102,.45)'
    : 'rgba(255,126,95,.45)';

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* Halo — radial glow that breathes up and down behind the crest. */}
        <div style={{
          position: 'absolute', inset: -Math.round(size * 0.25),
          background: `radial-gradient(circle, ${haloColor} 0%, transparent 65%)`,
          animation: 'logoLoaderGlow 2.4s ease-in-out infinite',
          pointerEvents: 'none',
          borderRadius: '50%',
        }} />
        {/* Crest — gentle bob layered on top of the halo. */}
        <img
          src="/logo.png"
          alt="Memoria"
          draggable={false}
          style={{
            position: 'relative',
            width: '100%', height: '100%',
            objectFit: 'contain',
            filter: tone === 'dark'
              ? 'drop-shadow(0 6px 18px rgba(0,0,0,.55))'
              : 'drop-shadow(0 6px 14px rgba(58,46,42,.18))',
            animation: 'logoLoaderFloat 2.4s ease-in-out infinite',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
      {caption && (
        <div style={{
          fontSize: 13, fontWeight: 600,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: captionColor,
          textShadow: captionShadow,
          animation: 'logoLoaderCaption 2.4s ease-in-out infinite',
        }}>{caption}</div>
      )}
      <style>{`
        @keyframes logoLoaderGlow {
          0%, 100% { opacity: .35; transform: scale(.92); }
          50%      { opacity: 1;   transform: scale(1.15); }
        }
        @keyframes logoLoaderFloat {
          0%, 100% { transform: translateY(0)   scale(1); }
          50%      { transform: translateY(-5px) scale(1.025); }
        }
        @keyframes logoLoaderCaption {
          0%, 100% { opacity: .65; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          img[alt="Memoria"], img[alt="Memoria"] ~ div { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
