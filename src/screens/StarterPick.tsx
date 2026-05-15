import { useState } from 'react';
import { Coins, ChevronRight, Sparkles } from 'lucide-react';
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
 * StarterPick — first-boot theme selector.
 *
 * Visual language mirrors the existing Booster shop (.bp class in
 * src/screens/PackOpening.tsx): three large vertical "pack" tiles
 * with a "PULL" tear strip at top, an element sigil disc in the
 * middle, "STARTER PACK" eyebrow + theme name in the lower-left,
 * and a frosted bottom band with the deck size + a "FREE" coin chip
 * (since this is the player's complimentary starter, not a paid pack).
 *
 * Picking a tile selects it (highlight ring). A floating Confirm CTA
 * at the bottom of the screen reads "Take the {Theme} deck" — same
 * pattern as DialogueSheet's Battle CTA. Player can flip between
 * tiles before committing.
 */
export function StarterPick({ themes, onPick }: Props) {
  const [activeId, setActiveId] = useState<ElementId | null>(themes[0]?.id ?? null);
  const active = themes.find(t => t.id === activeId);

  return (
    <div className="sp-root">
      <StarterPickStyles />
      <div className="sp-head">
        <div className="sp-eyebrow">
          <Sparkles size={12} strokeWidth={2.4} color={PALETTE.accent} />
          <span>FIRST DAY</span>
        </div>
        <div className="sp-title">Pick your starter</div>
        <div className="sp-sub">Twelve cards. You'll photograph each one. The other themes you can earn later.</div>
      </div>

      <div className="sp-grid">
        {themes.map((theme) => {
          const el = ELEMENTS[theme.id];
          const isActive = activeId === theme.id;
          return (
            <button
              key={theme.id}
              className="bp sp-bp"
              data-active={isActive}
              onClick={() => setActiveId(theme.id)}
              aria-label={`Pick the ${el.name} starter deck — 12 cards`}
              style={{
                background: `linear-gradient(165deg, ${el.color} 0%, ${el.deep} 100%)`,
              }}
            >
              <div className="bp-tear" aria-hidden>
                <div className="bp-tear-pattern" />
                <div className="bp-tear-label">PULL</div>
              </div>
              <div className="bp-foil" aria-hidden />
              <div className="bp-sigil" aria-hidden>
                <ElementGlyph el={theme.id} size={48} />
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

      {active && (
        <div className="sp-foot">
          <div className="sp-desc">{active.description}</div>
          <button
            className="sp-confirm"
            onClick={() => onPick(active.id)}
            style={{
              '--theme-color': ELEMENTS[active.id].color,
              '--theme-deep': ELEMENTS[active.id].deep,
            } as React.CSSProperties}
          >
            <span>Take the {active.name} deck</span>
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        </div>
      )}
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
        overflow-y: auto;
        padding: max(24px, env(safe-area-inset-top, 24px)) 16px 16px 16px;
      }

      .sp-head { text-align: center; margin-bottom: 16px; }
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

      /* Three-up grid; collapses to a single column on narrow phones. */
      .sp-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 14px;
      }
      @media (max-width: 480px) {
        .sp-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
      }
      @media (max-width: 360px) {
        .sp-grid { grid-template-columns: 1fr; }
      }

      /* Inherit the booster shop's .bp visual — colors / shadows /
         tear strip / foil / sigil / band — and only override what
         differs for the starter picker (active ring, eyebrow text
         size, no-disabled state). */
      .sp-bp {
        position: relative;
        aspect-ratio: 0.72;
        border-radius: 16px;
        border: 0; padding: 0;
        cursor: pointer; color: #fff;
        font-family: inherit;
        overflow: hidden;
        box-shadow:
          0 4px 0 rgba(28,24,20,.08),
          0 14px 28px -10px rgba(28,24,20,.18),
          inset 0 -3px 0 rgba(0,0,0,.22),
          inset 0 1.5px 0 rgba(255,255,255,.18);
        transition: transform .18s cubic-bezier(.2,.7,.2,1), box-shadow .2s;
      }
      .sp-bp:hover { transform: translateY(-4px) rotate(-0.4deg); }
      .sp-bp:active { transform: translateY(-1px); }
      .sp-bp[data-active="true"] {
        transform: translateY(-4px) rotate(-0.6deg);
        box-shadow:
          0 6px 0 rgba(28,24,20,.10),
          0 18px 36px -10px rgba(28,24,20,.30),
          inset 0 -3px 0 rgba(0,0,0,.22),
          inset 0 0 0 3px rgba(255,255,255,.45),
          inset 0 1.5px 0 rgba(255,255,255,.18);
      }

      /* Foil sheen overlay (mirrors .bp-foil). */
      .sp-bp .bp-foil {
        position: absolute; inset: 22px 0 0 0;
        background:
          radial-gradient(ellipse 60% 40% at 10% 0%, rgba(255,255,255,.32), transparent 60%),
          radial-gradient(ellipse 60% 60% at 90% 100%, rgba(0,0,0,.22), transparent 60%);
        mix-blend-mode: overlay;
        opacity: 0.85;
        pointer-events: none;
      }

      /* Sigil disc. */
      .sp-bp .bp-sigil {
        position: absolute; top: 22%; left: 50%;
        width: 72px; height: 72px;
        transform: translate(-50%, 0);
        border-radius: 50%;
        background: rgba(255,255,255,.10);
        border: 1.5px solid rgba(255,255,255,.22);
        box-shadow: inset 0 0 0 6px rgba(255,255,255,.05);
        display: grid; place-items: center;
        color: #fff;
      }
      @media (min-width: 480px) {
        .sp-bp .bp-sigil { width: 84px; height: 84px; }
      }

      /* Wordmark — extended with a per-tile pitch line. */
      .sp-bp .bp-wordmark {
        position: absolute;
        left: 12px; right: 12px; bottom: 52px;
        text-align: left;
      }
      .sp-bp .bp-eyebrow {
        font-family: inherit; font-weight: 800;
        font-size: 9px; letter-spacing: 0.22em;
        text-transform: uppercase; opacity: 0.75;
      }
      .sp-bp .bp-name {
        font-family: inherit; font-weight: 800;
        font-size: 20px; letter-spacing: -0.005em;
        margin-top: 2px;
        text-shadow: 0 1px 0 rgba(0,0,0,.18);
        line-height: 1.05;
      }
      .sp-bp .bp-pitch {
        margin-top: 6px;
        font-size: 10px; font-weight: 600;
        opacity: 0.82;
        letter-spacing: 0.01em;
        line-height: 1.3;
      }
      @media (min-width: 720px) { .sp-bp .bp-name { font-size: 22px; } }

      /* Tear strip. */
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
        font-family: inherit; font-weight: 800;
        font-size: 8px; letter-spacing: 0.35em;
        color: rgba(255,255,255,.65);
      }

      /* Bottom band — info chip. */
      .sp-bp .bp-band {
        position: absolute; left: 10px; right: 10px; bottom: 10px;
        padding: 7px 10px;
        background: rgba(0,0,0,.32);
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 10px;
        display: flex; justify-content: space-between; align-items: center;
        gap: 8px;
        font-family: inherit; font-weight: 700;
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

      /* Footer — long description + confirm CTA. */
      .sp-foot {
        margin-top: auto;
        padding-top: 12px;
        display: flex; flex-direction: column; gap: 10px;
      }
      .sp-desc {
        font-size: 13px;
        color: ${PALETTE.textMid};
        line-height: 1.45;
        text-align: center;
        padding: 0 8px;
      }
      .sp-confirm {
        width: 100%;
        display: inline-flex; align-items: center; justify-content: center; gap: 10px;
        padding: 16px 22px;
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
