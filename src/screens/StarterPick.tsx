import { useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { ELEMENTS } from '../data/elements';
import { PALETTE } from '../components/styles';
import { getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { Card } from '../components/Card';
import type { StarterTheme } from '../data/starterDecks';
import type { ElementId } from '../game/types';

interface Props {
  themes: StarterTheme[];
  onPick: (themeId: ElementId) => void;
}

/**
 * StarterPick — the first-boot screen. Shows three theme tiles
 * (Family / Animals / Food). Picking one grants its 12-card starter
 * deck and routes to StarterPackOpen.
 *
 * Layout: a soft warm backdrop (matches PhoneShell), a short headline,
 * three stacked theme tiles each with the iconic card preview and a
 * Choose CTA. Tapping a tile expands it and reveals a Confirm button
 * (so the player can change their mind before committing).
 */
export function StarterPick({ themes, onPick }: Props) {
  const [activeId, setActiveId] = useState<ElementId | null>(themes[0]?.id ?? null);
  const active = themes.find(t => t.id === activeId);

  return (
    <div className="sp-root">
      <StarterPickStyles />
      <div className="sp-head">
        <div className="sp-eyebrow">
          <Sparkles size={14} strokeWidth={2.4} color={PALETTE.accent} />
          <span>FIRST DAY</span>
        </div>
        <div className="sp-title">Pick your starter</div>
        <div className="sp-sub">Twelve cards. Your call. You can collect every other theme later.</div>
      </div>

      <div className="sp-list">
        {themes.map((theme) => {
          const color = ELEMENTS[theme.id].color;
          const deep = ELEMENTS[theme.id].deep;
          const isActive = activeId === theme.id;
          const iconTpl = getTemplateById(theme.iconCardId);
          return (
            <button
              key={theme.id}
              className="sp-tile"
              data-active={isActive}
              onClick={() => setActiveId(theme.id)}
              style={{
                '--theme-color': color,
                '--theme-deep': deep,
              } as React.CSSProperties}
            >
              <div className="sp-band" />
              <div className="sp-row">
                <div className="sp-icon">
                  {iconTpl && (
                    <Card
                      card={{ ...iconTpl, uid: `sp_${iconTpl.id}`, photo: aiPhoto(iconTpl.id) }}
                      scale={0.5}
                    />
                  )}
                </div>
                <div className="sp-info">
                  <div className="sp-name">{theme.name}</div>
                  <div className="sp-pitch">{theme.pitch}</div>
                  <div className="sp-desc">{theme.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="sp-confirm-row">
        {active && (
          <button
            className="sp-confirm"
            onClick={() => onPick(active.id)}
            style={{
              '--theme-color': ELEMENTS[active.id].color,
            } as React.CSSProperties}
          >
            <span>Take the {active.name} deck</span>
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        )}
      </div>
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
          radial-gradient(ellipse 260px 180px at 78% 82%, rgba(90,168,99,0.12), transparent 70%),
          ${PALETTE.bg};
        color: ${PALETTE.text};
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        display: flex; flex-direction: column;
        overflow-y: auto;
        padding: max(28px, env(safe-area-inset-top, 28px)) 18px 24px 18px;
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
        font-size: 28px; font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.05;
      }
      .sp-sub {
        font-size: 13px;
        color: ${PALETTE.textMid};
        margin-top: 6px;
        line-height: 1.4;
      }

      .sp-list {
        display: flex; flex-direction: column; gap: 12px;
        margin-bottom: 16px;
      }
      .sp-tile {
        position: relative;
        text-align: left;
        background: ${PALETTE.paper};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 18px;
        padding: 0;
        cursor: pointer;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        font-family: inherit;
        color: ${PALETTE.text};
        transition: transform .15s, box-shadow .15s, border-color .15s;
      }
      .sp-tile:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 18px rgba(58,46,42,.10);
      }
      .sp-tile[data-active="true"] {
        border-color: var(--theme-color);
        box-shadow: 0 8px 22px color-mix(in srgb, var(--theme-color) 26%, transparent);
      }
      .sp-band {
        height: 6px;
        background: linear-gradient(90deg, var(--theme-color), color-mix(in srgb, var(--theme-color) 60%, #fff));
      }
      .sp-row {
        display: flex; align-items: center; gap: 14px;
        padding: 14px 16px;
      }
      .sp-icon {
        flex-shrink: 0;
        width: 72px; height: 100px;
        display: grid; place-items: center;
        background: linear-gradient(160deg, var(--theme-deep) 0%, var(--theme-color) 100%);
        border-radius: 12px;
        padding: 6px;
        overflow: hidden;
      }
      .sp-icon > * { pointer-events: none; }
      .sp-info { flex: 1; min-width: 0; }
      .sp-name {
        font-size: 18px; font-weight: 700;
        letter-spacing: -0.01em;
        margin-bottom: 2px;
      }
      .sp-pitch {
        font-size: 13px; font-weight: 600;
        color: var(--theme-color);
        margin-bottom: 6px;
        letter-spacing: -0.01em;
      }
      .sp-desc {
        font-size: 12px; color: ${PALETTE.textMid};
        line-height: 1.4;
      }

      .sp-confirm-row {
        position: sticky; bottom: 0;
        padding-top: 8px;
        background: linear-gradient(180deg, transparent 0%, ${PALETTE.bg} 50%);
      }
      .sp-confirm {
        width: 100%;
        display: inline-flex; align-items: center; justify-content: center; gap: 10px;
        padding: 16px 22px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--theme-color) 88%, #fff) 0%, var(--theme-color) 100%);
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
