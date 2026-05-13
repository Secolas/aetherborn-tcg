import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * 3D parallax wrapper that tilts its child toward the cursor / finger. Uses
 * only `transform` (GPU-composited) so the tilt is cheap even on mid-tier
 * phones. The motion is driven by raw pointer events — no per-frame
 * requestAnimationFrame loop because the browser already throttles
 * pointer moves to roughly the display refresh rate.
 *
 * For rare+ cards an additional radial sheen follows the pointer, giving
 * the "holo" feel you see on Pokémon TCG Pocket without bundling a shader
 * asset. The sheen is layered above the child via a sibling absolute
 * element that inherits the child's clip (the child is expected to be
 * something that paints in a rounded rect — e.g. our Card component).
 *
 * Pass `shine` to control whether the pointer-tracking gloss renders.
 * Default `false` since most contexts (deck builder thumbnails, log
 * popups) don't want the extra visual cost or noise.
 */
interface Props {
  children: ReactNode;
  /** Maximum tilt at the corners, in degrees. Higher = more dramatic. */
  maxTilt?: number;
  /** Outer scale on hover (lift effect). Set 1 to disable the lift. */
  hoverScale?: number;
  /** Whether to render the pointer-tracking gloss layer. */
  shine?: boolean;
  /** Extra style merged on the wrapper. */
  style?: CSSProperties;
  /** Fired on click — convenient so a Tilt wrapping a Card row can
   *  remain a single touch target. */
  onClick?: () => void;
}

export function TiltCard({
  children,
  maxTilt = 10,
  hoverScale = 1.04,
  shine = false,
  style,
  onClick,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>('perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)');
  const [shineStyle, setShineStyle] = useState<CSSProperties>({ opacity: 0 });
  const [hovered, setHovered] = useState(false);

  // Convert a pointer position to a per-axis tilt. Tilt is bound to the
  // half-extent of the card so corners produce ±maxTilt, edges roughly
  // ±maxTilt/2, dead center 0. RotateY follows X (horizontal travel) and
  // RotateX is inverted vertical (top-of-card tilts back when finger is
  // at the top, which is what people expect from a 3D card).
  const update = (clientX: number, clientY: number) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (clientX - cx) / (rect.width / 2);
    const dy = (clientY - cy) / (rect.height / 2);
    const rx = Math.max(-1, Math.min(1, -dy)) * maxTilt;
    const ry = Math.max(-1, Math.min(1, dx)) * maxTilt;
    setTransform(`perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${hoverScale})`);
    if (shine) {
      // Track the pointer with a radial highlight that sits above the
      // child. The sheen is a soft white spotlight; mix-blend-mode:
      // screen lets it pop without washing out the underlying art.
      const px = ((clientX - rect.left) / rect.width) * 100;
      const py = ((clientY - rect.top) / rect.height) * 100;
      setShineStyle({
        opacity: 1,
        background: `radial-gradient(circle at ${px.toFixed(0)}% ${py.toFixed(0)}%,
          rgba(255,255,255,.55) 0%,
          rgba(255,255,255,.18) 25%,
          transparent 55%)`,
      });
    }
  };

  const reset = () => {
    setTransform('perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)');
    setShineStyle({ opacity: 0 });
    setHovered(false);
  };

  return (
    <div
      ref={ref}
      onPointerEnter={() => setHovered(true)}
      onPointerMove={ev => update(ev.clientX, ev.clientY)}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onClick={onClick}
      style={{
        display: 'inline-block',
        transform,
        transformStyle: 'preserve-3d',
        // The transition only kicks in when the pointer leaves — during
        // active tracking we want zero lag, which we get by setting
        // transition: none whenever the pointer is over the element.
        transition: hovered ? 'none' : 'transform 0.35s cubic-bezier(.18,.85,.3,1.1)',
        willChange: 'transform',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        ...style,
      }}
    >
      {children}
      {shine && (
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          borderRadius: 18,
          mixBlendMode: 'screen',
          transition: 'opacity 0.25s ease-out, background 0.05s linear',
          ...shineStyle,
        }} />
      )}
    </div>
  );
}
