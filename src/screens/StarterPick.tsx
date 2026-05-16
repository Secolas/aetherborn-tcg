import { useState } from 'react';
import { Coins, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
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
 * StarterPick — first-boot theme selector, carousel edition.
 *
 * One pack visible at a time, full-width on phones. Player swipes
 * or taps the side arrows to flip between Family / Animals / Food,
 * then taps the bottom CTA to commit. The previous side-by-side
 * 3-up grid was unreadable at phone width (sigil clipped over the
 * pitch, name truncated, FREE chip cut off).
 *
 * Visual language for the pack itself stays identical to
 * PackOpening's booster shop (.bp class) — tear strip, sigil disc,
 * wordmark, frosted bottom band.
 */
export function StarterPick({ themes, onPick }: Props) {
  const [idx, setIdx] = useState(0);
  const current = themes[idx];
  const total = themes.length;
  const el = current ? ELEMENTS[current.id] : null;

  const goPrev = () => setIdx((i) => (i - 1 + total) % total);
  const goNext = () => setIdx((i) => (i + 1) % total);

  if (!current || !el) return null;

  return (
    <div className="sp-root">
      <StarterPickStyles />
      <div className="sp-head">
        <div className="sp-eyebrow">
          <Sparkles size={12} strokeWidth={2.4} color={PALETTE.accent} />
          <span>FIRST DAY</span>
        </div>
        <div className="sp-title">Select your starter deck</div>
        <div className="sp-sub">Twelve cards. You'll photograph each one. The other themes you can earn later.</div>
      </div>

      <div className="sp-carousel">
        <button
          className="sp-arrow sp-arrow-l"
          onClick={goPrev}
          aria-label="Previous deck"
        >
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>

        <div className="sp-card-wrap" key={current.id}>
          <div
            className="bp sp-bp"
            style={{
              background: `linear-gradient(165deg, ${el.color} 0%, ${el.deep} 100%)`,
            }}
            role="img"
            aria-label={`${el.name} starter deck — 12 cards`}
          >
            <div className="bp-tear" aria-hidden>
              <div className="bp-tear-pattern" />
              <div className="bp-tear-label">PULL</div>
            </div>
            <div className="bp-foil" aria-hidden />
            <div className="bp-sigil" aria-hidden>
              <ElementGlyph el={current.id} size={56} />
            </div>
            <div className="bp-wordmark">
              <div className="bp-eyebrow">Starter pack</div>
              <div className="bp-name">{current.name}</div>
              <div className="bp-pitch">{current.pitch}</div>
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
          </div>
          <div className="sp-desc">{current.description}</div>
        </div>

        <button
          className="sp-arrow sp-arrow-r"
          onClick={goNext}
          aria-label="Next deck"
        >
          <ChevronRight size={22} strokeWidth={2.6} />
        </button>
      </div>

      <div className="sp-dots" role="tablist" aria-label="Starter decks">
        {themes.map((t, i) => (
          <button
            key={t.id}
            className="sp-dot"
            data-active={i === idx}
            onClick={() => setIdx(i)}
            role="tab"
            aria-selected={i === idx}
            aria-label={`Show ${ELEMENTS[t.id].name} deck`}
          />
        ))}
      </div>

      <button
        className="sp-confirm"
        onClick={() => onPick(current.id)}
        style={{
          '--theme-color': el.color,
          '--theme-deep': el.deep,
        } as React.CSSProperties}
      >
        <span>Take the {current.name} deck</span>
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

      /* Carousel — chevrons flank a single full-width pack. The
         pack reanimates when idx changes via the React key on
         .sp-card-wrap, so flipping feels like a real swap, not a
         silent color change. */
      .sp-carousel {
        flex: 1;
        display: grid;
        grid-template-columns: 36px 1fr 36px;
        align-items: center;
        gap: 6px;
        min-height: 0;
      }
      .sp-card-wrap {
        display: flex; flex-direction: column;
        align-items: center;
        gap: 12px;
        animation: spCarouselIn .22s cubic-bezier(.2,.85,.3,1);
      }
      @keyframes spCarouselIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .sp-bp {
        position: relative;
        aspect-ratio: 0.72;
        width: 100%;
        max-width: 260px;
        border-radius: 16px;
        border: 0; padding: 0;
        color: #fff;
        overflow: hidden;
        box-shadow:
          0 8px 0 rgba(28,24,20,.10),
          0 18px 36px -10px rgba(28,24,20,.28),
          inset 0 -3px 0 rgba(0,0,0,.22),
          inset 0 1.5px 0 rgba(255,255,255,.18);
      }
      .sp-desc {
        font-size: 12px;
        color: ${PALETTE.textMid};
        line-height: 1.4;
        text-align: center;
        max-width: 280px;
      }
      .sp-arrow {
        width: 36px; height: 36px;
        display: grid; place-items: center;
        background: ${PALETTE.paper};
        color: ${PALETTE.text};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(28,24,20,.12);
        transition: transform .12s;
      }
      .sp-arrow:hover { transform: scale(1.05); }
      .sp-arrow:active { transform: scale(0.96); }

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
        width: 82px; height: 82px;
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

      /* Pagination dots */
      .sp-dots {
        display: flex; gap: 8px; justify-content: center;
      }
      .sp-dot {
        width: 8px; height: 8px;
        background: ${PALETTE.border};
        border: 0;
        border-radius: 50%;
        cursor: pointer;
        transition: width .15s, background .15s;
      }
      .sp-dot[data-active="true"] {
        width: 22px;
        background: ${PALETTE.accent};
        border-radius: 999px;
      }

      /* Bottom confirm — restored at user request so the pick is
         intentional ("Take the X deck") instead of triggered by
         every accidental carousel tap. */
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
        transition: transform .12s;
      }
      .sp-confirm:hover { transform: translateY(-1px); }
    `}</style>
  );
}
