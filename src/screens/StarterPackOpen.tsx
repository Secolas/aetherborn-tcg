import { useRef, useState } from 'react';
import { Camera, Check, ChevronRight, Sparkles, SkipForward } from 'lucide-react';
import { ELEMENTS } from '../data/elements';
import { PALETTE } from '../components/styles';
import { Card } from '../components/Card';
import type { CollectionCard } from '../game/types';
import type { StarterTheme } from '../data/starterDecks';

interface Props {
  theme: StarterTheme;
  /** The 12 newly-granted starter cards, in deck order. */
  cards: CollectionCard[];
  /** Persists a photo against the given card's uid. */
  onSetPhoto: (uid: string, dataUrl: string) => void;
  /** Player finished the flow (every card revealed, or "Skip Photos"). */
  onDone: () => void;
}

/**
 * StarterPackOpen — Pokémon-style one-card-at-a-time reveal flow.
 *
 * The 12 starter cards are revealed one by one. For each card the
 * player can either:
 *   - Tap "Take Photo" and pick an image from their device. The card
 *     animates in with the photo, then Next becomes the CTA.
 *   - Tap "Skip" to leave the card with no photo (it becomes a dormant
 *     placeholder; player can come back to it from the Collection).
 *
 * After the last card, "Done" routes the player to Campaign so the
 * first tutorial battle (the Family Pet mini-boss) becomes the first
 * action they take with their fresh deck.
 *
 * The reveal flow does NOT block on photo capture — Skip is a fully
 * supported path so a player who'd rather get into the game first can
 * fill photos in later. The point is to expose them to the photo flow
 * as part of onboarding, not force it.
 */
export function StarterPackOpen({ theme, cards, onSetPhoto, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = cards[idx];
  const total = cards.length;
  const themeColor = ELEMENTS[theme.id].color;
  const themeDeep = ELEMENTS[theme.id].deep;
  const photoSet = !!current?.photo;

  const next = () => {
    if (idx >= total - 1) onDone();
    else setIdx(i => i + 1);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !current) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') onSetPhoto(current.uid, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!current) return null;

  return (
    <div className="po-root" style={{
      '--theme-color': themeColor,
      '--theme-deep': themeDeep,
    } as React.CSSProperties}>
      <StarterPackOpenStyles />

      <div className="po-head">
        <div className="po-eyebrow">
          <Sparkles size={12} strokeWidth={2.4} />
          <span>{theme.name.toUpperCase()} STARTER</span>
        </div>
        <div className="po-counter">
          Card <strong>{idx + 1}</strong> of <strong>{total}</strong>
        </div>
        <div className="po-progress" aria-label={`${idx + 1} of ${total}`}>
          {cards.map((_, i) => (
            <span key={i} className="po-pip" data-filled={i <= idx} data-current={i === idx} />
          ))}
        </div>
      </div>

      <div className="po-stage">
        <div className="po-card-wrap" key={current.uid}>
          <Card card={current} scale={0.95} />
        </div>
        {!photoSet && (
          <div className="po-hint">
            Snap a photo of <em>{current.suggested ?? current.name.toLowerCase()}</em>.
          </div>
        )}
        {photoSet && (
          <div className="po-hint po-hint-done">
            <Check size={14} strokeWidth={3} /> <span>Photo set!</span>
          </div>
        )}
      </div>

      <div className="po-actions">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        {!photoSet ? (
          <>
            <button className="po-cta" onClick={() => fileRef.current?.click()}>
              <Camera size={18} strokeWidth={2.4} />
              <span>Take Photo</span>
            </button>
            <button className="po-skip" onClick={next}>
              <SkipForward size={14} strokeWidth={2.4} />
              <span>Skip for now</span>
            </button>
          </>
        ) : (
          <button className="po-cta" onClick={next}>
            <span>{idx >= total - 1 ? 'Done — Start Campaign' : 'Next'}</span>
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {idx >= total - 1 && !photoSet && (
        <div className="po-finish-row">
          <button className="po-finish" onClick={onDone}>
            <span>Finish — I'll add photos later</span>
            <ChevronRight size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}

function StarterPackOpenStyles() {
  return (
    <style>{`
      .po-root {
        position: absolute; inset: 0;
        background:
          radial-gradient(ellipse 280px 200px at 50% 20%, color-mix(in srgb, var(--theme-color) 22%, transparent), transparent 70%),
          ${PALETTE.bg};
        color: ${PALETTE.text};
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        display: flex; flex-direction: column;
        padding: max(20px, env(safe-area-inset-top, 20px)) 18px 24px 18px;
      }

      .po-head { text-align: center; }
      .po-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 11px; font-weight: 800;
        letter-spacing: 0.18em;
        color: var(--theme-color);
        margin-bottom: 4px;
      }
      .po-counter {
        font-size: 14px; color: ${PALETTE.textMid};
        margin-bottom: 8px;
      }
      .po-counter strong { color: ${PALETTE.text}; font-weight: 800; }
      .po-progress {
        display: flex; gap: 4px; justify-content: center;
        margin-bottom: 10px;
      }
      .po-pip {
        flex: 1; max-width: 22px;
        height: 4px; border-radius: 999px;
        background: ${PALETTE.border};
      }
      .po-pip[data-filled="true"] { background: var(--theme-color); }
      .po-pip[data-current="true"] {
        background: var(--theme-color);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-color) 30%, transparent);
      }

      .po-stage {
        flex: 1; min-height: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 14px;
      }
      .po-card-wrap {
        animation: poEnter .35s cubic-bezier(.2,.85,.3,1);
        filter: drop-shadow(0 10px 24px color-mix(in srgb, var(--theme-deep) 40%, transparent));
      }
      @keyframes poEnter {
        from { transform: translateY(20px) scale(.92) rotate(-2deg); opacity: 0; }
        to   { transform: translateY(0) scale(1) rotate(0); opacity: 1; }
      }
      .po-hint {
        font-size: 13px; color: ${PALETTE.textMid};
        text-align: center;
        line-height: 1.45;
        max-width: 280px;
      }
      .po-hint em {
        font-style: normal; font-weight: 700;
        color: ${PALETTE.text};
      }
      .po-hint-done {
        color: ${ELEMENTS.animals.color};
        font-weight: 700;
        display: inline-flex; align-items: center; gap: 6px;
      }

      .po-actions {
        display: flex; flex-direction: column; gap: 10px;
        margin-top: 12px;
      }
      .po-cta {
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
      .po-cta:hover { transform: translateY(-1px); }
      .po-skip {
        background: transparent;
        border: 1.5px dashed ${PALETTE.border};
        color: ${PALETTE.textMid};
        padding: 10px 16px;
        border-radius: 14px;
        font-family: inherit;
        font-size: 13px; font-weight: 700;
        cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      }
      .po-finish-row {
        margin-top: 8px;
        text-align: center;
      }
      .po-finish {
        background: transparent;
        border: 0;
        color: ${PALETTE.textMid};
        font-family: inherit;
        font-size: 12px; font-weight: 700;
        cursor: pointer;
        display: inline-flex; align-items: center; gap: 4px;
        text-decoration: underline;
      }
    `}</style>
  );
}
