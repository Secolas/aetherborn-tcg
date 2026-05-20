import { useEffect, useRef, useState } from 'react';
import { Coins, Sparkles, ChevronRight, Camera, X } from 'lucide-react';
import { ELEMENTS } from '../data/elements';
import { ElementGlyph } from '../components/ElementGlyph';
import { PALETTE } from '../components/styles';
import type { StarterTheme } from '../data/starterDecks';
import type { ElementId } from '../game/types';

interface Props {
  themes: StarterTheme[];
  onPick: (themeId: ElementId) => void;
  /** Optional close handler. Renders an X in the top-right that takes
   *  the player back to wherever they came from (typically Home). The
   *  starter-pick screen is one of the few places a brand-new player
   *  can be without having picked a deck yet — when nav routes here
   *  from a Home CTA, this lets them back out instead of being trapped. */
  onCancel?: () => void;
}

/**
 * StarterPick — first-boot theme selector, fan-of-three edition.
 *
 * All three starter packs fan out across the screen like a hand of
 * cards: the focused pack sits dead-centre at full size, the two
 * others rotate and shrink to either side. Tapping a side pack
 * brings it to the centre; the bottom CTA commits the centred
 * pack.
 *
 * Visual language for each pack stays identical to PackOpening's
 * booster shop (.bp class) — tear strip, sigil disc, wordmark,
 * frosted bottom band.
 */
export function StarterPick({ themes, onPick, onCancel }: Props) {
  // Default focus = middle of the array so the player can clearly
  // see there ARE side options (the previous carousel landed on
  // Family first and read as "only one choice").
  const [focusIdx, setFocusIdx] = useState(Math.floor(themes.length / 2));
  // Token that increments every time a pack is tapped. Used as the
  // `key` on the focused pack's animation wrapper so React remounts
  // it and the entrance keyframe (`spFanIn`, mirroring the Home hero
  // fan-in) replays on every selection.
  const [focusKey, setFocusKey] = useState(0);
  // Confirm cinematic — when the player commits, the focused pack
  // plays the full PackOpening lift → tension → burst sequence
  // before we hand off to onPick. Same easing/durations as the shop's
  // PackOpening so the StarterPick → StarterPackOpen transition reads
  // as one continuous shake → burst → reveal.
  //
  // Phases:
  //   shake  — lift (600ms) + tension shake (320ms). Pack rattles.
  //   burst  — pack explodes outward + screen-wide flash overlay.
  //            Handoff to onPick lands at the peak of the white flash
  //            so StarterPackOpen takes over visually unbroken.
  const [confirmPhase, setConfirmPhase] = useState<'idle' | 'shake' | 'burst'>('idle');
  const confirming = confirmPhase !== 'idle';
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (burstTimer.current) clearTimeout(burstTimer.current);
    if (pickTimer.current) clearTimeout(pickTimer.current);
  }, []);

  const focused = themes[focusIdx];
  if (!focused) return null;
  const focusedEl = ELEMENTS[focused.id];

  const pickFocus = (i: number) => {
    if (confirming) return;
    if (i === focusIdx) {
      // Re-tapping the focused pack just replays its entrance —
      // gives the same satisfying "spring forward" feel users get
      // from tapping a side pack to bring it forward.
      setFocusKey(k => k + 1);
      return;
    }
    setFocusIdx(i);
    setFocusKey(k => k + 1);
  };

  const onConfirm = () => {
    if (confirming) return;
    setConfirmPhase('shake');
    // Shake lasts 920ms (600 lift + 320 tension); then we kick over
    // to 'burst' which both plays packExplode on the pack itself and
    // renders the full-screen flash/shockring overlay. Handoff to
    // onPick at 1180ms — that's the peak of the screen-white flash,
    // so the new screen is masked by white at the moment of swap.
    burstTimer.current = setTimeout(() => setConfirmPhase('burst'), 920);
    pickTimer.current = setTimeout(() => onPick(focused.id), 1180);
  };

  return (
    <div className="sp-root" data-confirming={confirming} data-phase={confirmPhase}>
      <StarterPickStyles />
      {confirmPhase === 'burst' && (
        <BurstOverlay glow={focusedEl.glow} />
      )}
      {onCancel && !confirming && (
        <button
          className="sp-close"
          onClick={onCancel}
          aria-label="Close starter pick"
          title="Close"
        >
          <X size={18} strokeWidth={2.4} />
        </button>
      )}
      <div className="sp-head">
        <div className="sp-eyebrow">
          <Sparkles size={12} strokeWidth={2.4} color={PALETTE.accent} />
          <span>FIRST DAY</span>
        </div>
        <div className="sp-title">What memories do you want to build?</div>
        <div className="sp-sub">Pick a starter deck. Tap one to bring it forward, then commit at the bottom — your deck becomes 12 cards built from your own photos.</div>
        <div className="sp-photo-notice" role="note">
          <Camera size={13} strokeWidth={2.4} />
          <span>You'll take or upload <strong>12 photos</strong> after picking, one per card.</span>
        </div>
      </div>

      <div className="sp-fan">
        {themes.map((theme, i) => {
          const el = ELEMENTS[theme.id];
          // Position relative to the focused pack. Centre = 0,
          // left side packs negative offset, right side positive.
          // The transform stack (translate + rotate + scale) sells
          // the "hand of cards" feel; layered z-index keeps the
          // focused pack rendered on top of its neighbours.
          const offset = i - focusIdx;
          const isFocused = offset === 0;
          // Each focus selection bumps focusKey, which re-mounts the
          // focused pack's animation wrapper so the entrance keyframe
          // replays — same trick as the Home hero fan.
          const animKey = isFocused ? `${theme.id}-${focusKey}` : theme.id;
          return (
            <div
              key={animKey}
              className="sp-anim"
              data-focused={isFocused}
              data-confirming={isFocused && confirming}
              data-phase={isFocused ? confirmPhase : 'idle'}
            >
              <button
                className="bp sp-bp"
                data-focused={isFocused}
                data-offset={offset}
                disabled={confirming}
                onClick={() => pickFocus(i)}
                aria-label={`${el.name} starter deck${isFocused ? ' — focused' : ''}`}
                style={{
                  background: `linear-gradient(165deg, ${el.color} 0%, ${el.deep} 100%)`,
                  '--offset': offset,
                } as React.CSSProperties}
              >
                <div className="bp-tear" aria-hidden>
                  <div className="bp-tear-pattern" />
                  <div className="bp-tear-label">PULL</div>
                </div>
                <div className="bp-foil" aria-hidden />
                <div className="bp-sigil" aria-hidden>
                  <ElementGlyph el={theme.id} size={56} />
                </div>
                <div className="bp-wordmark">
                  <div className="bp-eyebrow">Starter pack</div>
                  <div className="bp-name">{theme.name}</div>
                  <div className="bp-pitch">{theme.pitch}</div>
                </div>
                <div className="bp-band">
                  <div className="bp-band-l">
                    <span>12 cards</span>
                    <span className="bp-band-dot">·</span>
                    <span className="bp-band-rare">Beginner</span>
                  </div>
                  <span className="bp-coin">
                    <Coins size={11} fill="#ffd166" color="#c08620" strokeWidth={2.2} />
                    FREE
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <button
        className="sp-confirm"
        onClick={onConfirm}
        disabled={confirming}
        style={{
          '--theme-color': focusedEl.color,
          '--theme-deep': focusedEl.deep,
        } as React.CSSProperties}
      >
        <span>{confirming ? `Opening ${focused.name}…` : 'Select Starter Deck'}</span>
        <ChevronRight size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}

/**
 * Full-screen burst overlay rendered during confirmPhase === 'burst'.
 * Mirrors the shop PackOpening's burst stage — radial shockring +
 * 8 light streaks fanning out from the pack centre + screen-wide
 * white flash. Pulls colour from the focused theme's `glow` so the
 * Family burst feels warm, the Work burst feels blue, etc.
 *
 * Reuses keyframes already defined in src/index.css for the shop:
 *   packShockRing, packLightStreak, screenWhiteFlash, packBurst.
 */
function BurstOverlay({ glow }: { glow: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        display: 'grid', placeItems: 'center',
      }}
    >
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 260, height: 260, borderRadius: '50%',
        border: `4px solid ${glow}`,
        animation: 'packShockRing 0.7s ease-out both',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 200, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, #fff 0%, ${glow} 35%, transparent 75%)`,
        transform: 'translate(-50%,-50%) scale(0.5)',
        animation: 'packBurst 0.7s ease-out both',
        mixBlendMode: 'screen',
      }} />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 360 / 8) + 12;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 6, height: 100,
            background: `linear-gradient(180deg, ${glow}, transparent)`,
            borderRadius: 3,
            transformOrigin: 'center bottom',
            ['--r' as string]: `${angle}deg`,
            animation: 'packLightStreak 0.7s ease-out both',
            mixBlendMode: 'screen',
          }} />
        );
      })}
      <div style={{
        position: 'fixed', inset: 0,
        background: '#fff',
        animation: 'screenWhiteFlash 0.55s ease-out both',
        mixBlendMode: 'screen',
      }} />
    </div>
  );
}

function StarterPickStyles() {
  return (
    <style>{`
      .sp-root {
        position: absolute; inset: 0;
        background:
          radial-gradient(ellipse 280px 200px at 22% 18%, rgba(238,90,82,0.10), transparent 70%),
          radial-gradient(ellipse 260px 180px at 78% 82%, rgba(90,168,99,0.10), transparent 70%),
          ${PALETTE.bg};
        color: ${PALETTE.text};
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        display: flex; flex-direction: column;
        padding: max(24px, env(safe-area-inset-top, 24px)) 16px max(20px, env(safe-area-inset-bottom, 20px)) 16px;
        gap: 14px;
      }

      .sp-close {
        position: absolute;
        top: max(16px, env(safe-area-inset-top, 16px));
        right: 16px;
        z-index: 10;
        width: 36px; height: 36px;
        display: grid; place-items: center;
        border-radius: 50%;
        background: rgba(255,255,255,.85);
        border: 1.5px solid rgba(58,46,42,.18);
        color: ${PALETTE.text};
        cursor: pointer;
        font-family: inherit;
        box-shadow: 0 2px 8px rgba(58,46,42,.12);
        transition: transform .12s, background .15s;
      }
      .sp-close:hover { background: #fff; transform: scale(1.05); }
      .sp-close:active { transform: scale(.96); }

      .sp-head { text-align: center; }
      .sp-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 11px; font-weight: 800;
        letter-spacing: 0.18em;
        color: ${PALETTE.accent};
        margin-bottom: 6px;
      }
      .sp-title {
        font-size: 26px; font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.05;
      }
      .sp-sub {
        font-size: 13px;
        color: ${PALETTE.textMid};
        margin-top: 6px;
        line-height: 1.4;
        max-width: 320px;
        margin-left: auto;
        margin-right: auto;
      }
      /* Photo-requirement notice — front-loads the commitment so the
         player doesn't pick a deck whose cards they can't realistically
         photograph. Coral chip language echoes the home CTA so it
         reads as "important next step" rather than a footnote. */
      .sp-photo-notice {
        display: inline-flex; align-items: center; gap: 8px;
        margin-top: 12px;
        padding: 8px 14px;
        background: rgba(238,90,82,0.10);
        border: 1.5px solid rgba(238,90,82,0.30);
        border-radius: 999px;
        color: ${PALETTE.accentDeep};
        font-size: 12px; font-weight: 600;
        line-height: 1.35;
        max-width: 320px;
        margin-left: auto; margin-right: auto;
        text-align: left;
      }
      .sp-photo-notice strong { font-weight: 800; }

      /* Fan stage — three packs absolutely positioned around the
         centre. Transform stack derives from the data-offset
         attribute (-1, 0, 1 for left / centre / right). */
      .sp-fan {
        position: relative;
        flex: 1;
        min-height: 0;
        display: grid;
        place-items: center;
        perspective: 900px;
      }
      /* Per-pack animation wrapper. Holds the spFanIn entrance + the
         spConfirmLift/Tension cinematic. Wrapping rather than putting
         these on .sp-bp directly keeps the existing data-focused
         transforms (rotation / translate / scale) untouched — the
         entrance/exit animations compose on top via a separate
         transform layer. */
      .sp-anim {
        display: contents;
      }
      .sp-anim[data-focused="true"] > .sp-bp {
        animation: spFanIn 0.5s cubic-bezier(.22,.85,.3,1.15) both;
      }
      .sp-anim[data-phase="shake"] > .sp-bp {
        animation:
          spConfirmLift 0.6s cubic-bezier(.18,.85,.3,1.1) both,
          spConfirmTension 0.32s ease-in-out 0.6s 1 both;
      }
      /* Burst stage — lift + tension complete, then packExplode
         scales the pack out + fades it as the shockring/flash
         overlay paints over the screen. */
      .sp-anim[data-phase="burst"] > .sp-bp {
        animation:
          spConfirmLift 0.6s cubic-bezier(.18,.85,.3,1.1) both,
          spConfirmTension 0.32s ease-in-out 0.6s 1 both,
          spConfirmExplode 0.7s cubic-bezier(.4,.1,.6,1) 0.92s both;
      }
      .sp-bp {
        position: absolute;
        width: 220px;
        aspect-ratio: 0.72;
        border-radius: 16px;
        border: 0; padding: 0;
        color: #fff;
        overflow: hidden;
        cursor: pointer;
        box-shadow:
          0 8px 0 rgba(28,24,20,.10),
          0 18px 36px -10px rgba(28,24,20,.28),
          inset 0 -3px 0 rgba(0,0,0,.22),
          inset 0 1.5px 0 rgba(255,255,255,.18);
        transform-origin: 50% 110%;
        transition: transform .35s cubic-bezier(.2,.85,.3,1), filter .25s, box-shadow .25s;
        font-family: inherit;
      }
      .sp-bp:disabled { cursor: default; }

      /* Selection entrance — replays each time a pack becomes the
         focused one. Mirrors the home-page hand fan-in (drops in from
         below with a quick scale-bounce). Lands at scale 1 so it
         layers cleanly under the data-focused="true" final transform. */
      @keyframes spFanIn {
        0%   { opacity: 0; transform: translateY(28px) scale(.7); }
        45%  { opacity: 1; }
        70%  { transform: translateY(-6px) scale(1.06); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Confirm cinematic — copied beat-for-beat from PackOpening's
         packLift + packTension so the StarterPick → StarterPackOpen
         handoff feels like one continuous shake-and-burst rather than
         two separate screens. */
      @keyframes spConfirmLift {
        0%   { transform: translateY(0) scale(1) rotate(0deg); }
        100% { transform: translateY(-14px) scale(1.06) rotate(0deg); }
      }
      @keyframes spConfirmTension {
        0%, 100% { transform: translate(0, -14px) rotate(0) scale(1.06); filter: brightness(1); }
        20%      { transform: translate(-4px, -12px) rotate(-3deg) scale(1.07); filter: brightness(1.06); }
        40%      { transform: translate(5px, -16px) rotate(3deg) scale(1.08); filter: brightness(1.12); }
        60%      { transform: translate(-3px, -12px) rotate(-2deg) scale(1.07); filter: brightness(1.18); }
        80%      { transform: translate(4px, -16px) rotate(2deg) scale(1.09); filter: brightness(1.24); }
      }
      /* Final scale-up + fade as the seal breaks — mirrors
         PackOpening's @keyframes packExplode beat-for-beat. */
      @keyframes spConfirmExplode {
        0%   { transform: translateY(-14px) scale(1.07); opacity: 1; filter: brightness(1.3); }
        35%  { transform: translateY(-32px) scale(1.4); opacity: 1; filter: brightness(2.2) blur(1px); }
        100% { transform: translateY(-60px) scale(2.6); opacity: 0; filter: brightness(2.5) blur(8px); }
      }
      /* Side packs: rotated outward, shrunk, slightly faded — they
         read as "available but not selected". The actual rotation
         angle is driven by the inline --offset variable so adding
         a fourth pack later would extend the fan cleanly. */
      .sp-bp[data-focused="false"] {
        transform:
          translateX(calc(var(--offset) * 78px))
          rotate(calc(var(--offset) * 11deg))
          translateY(20px)
          scale(.88);
        filter: brightness(.72) saturate(.85);
        z-index: 1;
      }
      .sp-bp[data-focused="false"]:hover {
        filter: brightness(.85) saturate(.95);
        transform:
          translateX(calc(var(--offset) * 78px))
          rotate(calc(var(--offset) * 11deg))
          translateY(14px)
          scale(.92);
      }
      .sp-bp[data-focused="true"] {
        transform: translateY(0) scale(1);
        z-index: 3;
        box-shadow:
          0 12px 0 rgba(28,24,20,.10),
          0 22px 48px -10px rgba(28,24,20,.40),
          inset 0 -3px 0 rgba(0,0,0,.22),
          inset 0 0 0 3px rgba(255,255,255,.45),
          inset 0 1.5px 0 rgba(255,255,255,.18);
      }
      /* Phone-sized fan — narrower offset so the side packs stay on
         screen and don't crash into the screen edges. Side packs sit
         very slightly below centre (translateY 6 instead of 18) so
         their bottom corners don't crash into the deck description
         on short screens. */
      @media (max-width: 480px) {
        .sp-bp { width: 200px; }
        .sp-bp[data-focused="false"] {
          transform:
            translateX(calc(var(--offset) * 58px))
            rotate(calc(var(--offset) * 12deg))
            translateY(6px)
            scale(.86);
        }
        .sp-bp[data-focused="false"]:hover {
          transform:
            translateX(calc(var(--offset) * 58px))
            rotate(calc(var(--offset) * 12deg))
            translateY(0)
            scale(.90);
        }
      }

      /* Desktop / wide layout — there's enough horizontal room for
         the three packs to sit side-by-side without overlap. Drop
         the absolute positioning and the rotation, lay them out as
         a flex row, and keep a subtle scale difference so the focused
         pack still reads as "selected". The confirm button gets a
         max-width too so it doesn't sprawl across the full shell. */
      @media (min-width: 720px) {
        .sp-fan {
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          gap: 32px;
          perspective: none;
        }
        /* Bumped from 165px → 200px so the packs read clearly without
           dominating the screen. Focused stays at scale 1.0; side packs
           use brightness/saturation rather than scale to feel "unselected"
           so the three packs are visually balanced. */
        .sp-bp { width: 200px; }
        .sp-bp[data-focused="false"],
        .sp-bp[data-focused="false"]:hover,
        .sp-bp[data-focused="true"] {
          position: relative;
        }
        .sp-bp[data-focused="false"] {
          transform: scale(.9);
          filter: brightness(.82) saturate(.88);
        }
        .sp-bp[data-focused="false"]:hover:not(:disabled) {
          transform: scale(.94) translateY(-4px);
          filter: brightness(.94) saturate(.95);
        }
        .sp-bp[data-focused="true"] {
          transform: scale(1);
        }
        .sp-confirm {
          max-width: 380px;
          margin: 0 auto;
        }
      }
      /* Mid-tablet widths (480-720) — keep the fan look but trim the
         pack width so the focused pack doesn't crowd the header on
         narrow desktops. */
      @media (min-width: 481px) and (max-width: 719px) {
        .sp-bp { width: 195px; }
      }

      /* Booster pack internals — copied from PackOpening.tsx's .bp
         so the look stays consistent. */
      .sp-bp .bp-foil {
        position: absolute; inset: 22px 0 0 0;
        background:
          radial-gradient(ellipse 60% 40% at 10% 0%, rgba(255,255,255,.32), transparent 60%),
          radial-gradient(ellipse 60% 60% at 90% 100%, rgba(0,0,0,.22), transparent 60%);
        mix-blend-mode: overlay;
        opacity: 0.85;
        pointer-events: none;
      }
      .sp-bp .bp-sigil {
        position: absolute; top: 22%; left: 50%;
        width: 78px; height: 78px;
        transform: translate(-50%, 0);
        border-radius: 50%;
        background: rgba(255,255,255,.10);
        border: 1.5px solid rgba(255,255,255,.22);
        box-shadow: inset 0 0 0 6px rgba(255,255,255,.05);
        display: grid; place-items: center;
        color: #fff;
      }
      .sp-bp .bp-wordmark {
        position: absolute;
        left: 12px; right: 12px; bottom: 56px;
        text-align: left;
      }
      .sp-bp .bp-eyebrow {
        font-weight: 800;
        font-size: 9px; letter-spacing: 0.22em;
        text-transform: uppercase; opacity: 0.75;
      }
      .sp-bp .bp-name {
        font-weight: 800;
        font-size: 22px; letter-spacing: -0.005em;
        margin-top: 2px;
        text-shadow: 0 1px 0 rgba(0,0,0,.18);
        line-height: 1.05;
      }
      .sp-bp .bp-pitch {
        margin-top: 6px;
        font-size: 11px; font-weight: 600;
        opacity: 0.85;
        line-height: 1.3;
      }
      .sp-bp .bp-tear {
        position: absolute; top: 0; left: 0; right: 0;
        height: 22px;
        background: rgba(0,0,0,.18);
        border-bottom: 1.5px dashed rgba(255,255,255,.35);
        display: grid; place-items: center;
        overflow: hidden;
      }
      .sp-bp .bp-tear-pattern {
        position: absolute; inset: 0;
        background: repeating-linear-gradient(90deg,
          transparent 0 6px,
          rgba(255,255,255,.10) 6px 8px);
      }
      .sp-bp .bp-tear-label {
        position: relative;
        font-weight: 800;
        font-size: 8px; letter-spacing: 0.35em;
        color: rgba(255,255,255,.65);
      }
      .sp-bp .bp-band {
        position: absolute; left: 10px; right: 10px; bottom: 10px;
        padding: 7px 10px;
        background: rgba(0,0,0,.32);
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 10px;
        display: flex; justify-content: space-between; align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 10px; letter-spacing: 0.04em;
      }
      .sp-bp .bp-band-l {
        display: inline-flex; align-items: center; gap: 5px;
        color: rgba(255,255,255,.92);
      }
      .sp-bp .bp-band-dot { opacity: 0.6; }
      .sp-bp .bp-band-rare { color: #ffd96b; }
      .sp-bp .bp-coin {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 8px;
        background: rgba(0,0,0,.30);
        border-radius: 999px;
        font-weight: 800; font-size: 11px;
        color: #ffd96b;
      }

      .sp-confirm {
        width: 100%;
        display: inline-flex; align-items: center; justify-content: center; gap: 10px;
        padding: 14px 22px;
        /* Brand coral — kept consistent across every theme so the
           primary CTA reads as "this is the game's action", not
           "this matches the focused deck's colour". */
        background: linear-gradient(180deg, #ffa07a 0%, ${PALETTE.accent} 60%, ${PALETTE.accentDeep} 100%);
        color: #fff;
        border: 0;
        border-radius: 999px;
        font-family: inherit;
        font-size: 15px; font-weight: 800;
        letter-spacing: 0.02em;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(255, 94, 60, .35), inset 0 1px 0 rgba(255,255,255,.4);
        transition: transform .12s, filter .2s;
      }
      .sp-confirm:hover:not(:disabled) { transform: translateY(-1px); }
      .sp-confirm:disabled { cursor: default; filter: brightness(.94); }
      /* During the confirm cinematic, dim the rest of the UI slightly
         so the player's eye is pulled to the shaking pack instead of
         the static surrounding chrome. */
      .sp-root[data-confirming="true"] .sp-head,
      .sp-root[data-confirming="true"] .sp-confirm {
        opacity: 0.55;
        transition: opacity .25s ease-out;
      }
      .sp-root[data-confirming="true"] .sp-bp[data-focused="false"] {
        opacity: 0.25;
        transition: opacity .25s ease-out;
      }
    `}</style>
  );
}
