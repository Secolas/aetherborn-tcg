import { useState } from 'react';
import { Coins, Sparkles, ChevronRight, Camera } from 'lucide-react';
import { ELEMENTS } from '../data/elements';
import { ElementGlyph } from '../components/ElementGlyph';
import { PALETTE } from '../components/styles';
import type { StarterTheme } from '../data/starterDecks';
import type { ElementId } from '../game/types';

interface Props {
  themes: StarterTheme[];
  onPick: (themeId: ElementId) => void;
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
export function StarterPick({ themes, onPick }: Props) {
  // Default focus = middle of the array so the player can clearly
  // see there ARE side options (the previous carousel landed on
  // Family first and read as "only one choice").
  const [focusIdx, setFocusIdx] = useState(Math.floor(themes.length / 2));
  const focused = themes[focusIdx];
  if (!focused) return null;
  const focusedEl = ELEMENTS[focused.id];

  return (
    <div className="sp-root">
      <StarterPickStyles />
      <div className="sp-head">
        <div className="sp-eyebrow">
          <Sparkles size={12} strokeWidth={2.4} color={PALETTE.accent} />
          <span>FIRST DAY</span>
        </div>
        <div className="sp-title">Select your starter deck</div>
        <div className="sp-sub">Three decks. Tap one to bring it forward, then commit at the bottom. Pick carefully — your deck is built from your own photos.</div>
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
          return (
            <button
              key={theme.id}
              className="bp sp-bp"
              data-focused={isFocused}
              data-offset={offset}
              onClick={() => setFocusIdx(i)}
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
          );
        })}
      </div>

      <div className="sp-desc">{focused.description}</div>

      <button
        className="sp-confirm"
        onClick={() => onPick(focused.id)}
        style={{
          '--theme-color': focusedEl.color,
          '--theme-deep': focusedEl.deep,
        } as React.CSSProperties}
      >
        <span>Take the {focused.name} deck</span>
        <ChevronRight size={18} strokeWidth={2.4} />
      </button>
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
         screen and don't crash into the screen edges. */
      @media (max-width: 480px) {
        .sp-bp { width: 200px; }
        .sp-bp[data-focused="false"] {
          transform:
            translateX(calc(var(--offset) * 58px))
            rotate(calc(var(--offset) * 12deg))
            translateY(18px)
            scale(.86);
        }
        .sp-bp[data-focused="false"]:hover {
          transform:
            translateX(calc(var(--offset) * 58px))
            rotate(calc(var(--offset) * 12deg))
            translateY(12px)
            scale(.90);
        }
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

      .sp-desc {
        font-size: 13px;
        color: ${PALETTE.textMid};
        line-height: 1.45;
        text-align: center;
        max-width: 320px;
        margin: 0 auto;
      }

      .sp-confirm {
        width: 100%;
        display: inline-flex; align-items: center; justify-content: center; gap: 10px;
        padding: 14px 22px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--theme-color) 88%, #fff) 0%, var(--theme-color) 60%, var(--theme-deep) 100%);
        color: #fff;
        border: 0;
        border-radius: 999px;
        font-family: inherit;
        font-size: 15px; font-weight: 800;
        letter-spacing: 0.02em;
        cursor: pointer;
        box-shadow: 0 8px 20px color-mix(in srgb, var(--theme-color) 36%, transparent);
        transition: transform .12s, background .25s;
      }
      .sp-confirm:hover { transform: translateY(-1px); }
    `}</style>
  );
}
