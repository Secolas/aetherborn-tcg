import { useRef, useState } from 'react';
import { Camera, Check, ChevronRight, Sparkles, SkipForward, Upload } from 'lucide-react';
import { ELEMENTS, RARITY_COLOR } from '../data/elements';
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
  // Two inputs — one with capture="environment" so the camera
  // launches directly, one without so the OS picker opens the
  // gallery. The player picks the source explicitly via two CTAs.
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const current = cards[idx];
  const total = cards.length;
  const themeColor = ELEMENTS[theme.id].color;
  const themeDeep = ELEMENTS[theme.id].deep;
  const themeGlow = ELEMENTS[theme.id].glow;
  const photoSet = !!current?.photo;
  // Match the shop pack reveal: epic + legendary cards get a radial
  // halo behind the card; rare + above get a holographic sheen sweep.
  // Legendaries get a warm gold halo instead of the theme tint so
  // their reveal feels distinct from epic.
  const showHalo = current?.rarity === 'epic' || current?.rarity === 'legendary';
  const showSheen = current?.rarity !== 'common' && current?.rarity !== undefined;
  const haloColor = current?.rarity === 'legendary' ? '#ffd166' : themeGlow;

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
          {showHalo && (
            <div
              aria-hidden
              className="po-card-halo"
              style={{
                background: `radial-gradient(circle, ${haloColor} 0%, transparent 60%)`,
              }}
            />
          )}
          <div className="po-card-flight">
            <Card card={current} scale={0.95} />
            {showSheen && (
              <div aria-hidden className="po-card-sheen">
                <div className="po-card-sheen-bar" />
              </div>
            )}
          </div>
          <div
            className="po-rarity-label"
            style={{
              color: RARITY_COLOR[current.rarity],
              textShadow: current.rarity === 'legendary'
                ? '0 0 12px rgba(255, 209, 102, .6)'
                : 'none',
            }}
          >
            {current.rarity}
          </div>
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
        {/* Hidden file inputs — one with capture for the camera,
            one without for the gallery picker. The visible CTAs
            forward to whichever the player chose. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        {!photoSet ? (
          <>
            <div className="po-cta-row">
              <button className="po-cta po-cta-camera" onClick={() => cameraRef.current?.click()}>
                <Camera size={18} strokeWidth={2.4} />
                <span>Take Photo</span>
              </button>
              <button className="po-cta po-cta-upload" onClick={() => uploadRef.current?.click()}>
                <Upload size={18} strokeWidth={2.4} />
                <span>Upload Image</span>
              </button>
            </div>
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
      /* Wrapper provides the drop-shadow + stacking context for the
         halo (behind), the card (mid), and the sheen overlay (front).
         The flight animation lives on .po-card-flight so the halo's
         own rarityHalo pulse can fire in parallel without one tampering
         with the other's transform. */
      .po-card-wrap {
        position: relative;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        filter: drop-shadow(0 10px 24px color-mix(in srgb, var(--theme-deep) 40%, transparent));
      }
      /* Epic / legendary halo — radial bloom behind the card. Lifted
         straight from PackOpening's RevealCard. */
      .po-card-halo {
        position: absolute;
        left: 50%; top: 50%;
        width: 360px; height: 360px;
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(0.3);
        animation: rarityHalo 1.4s ease-out both;
        pointer-events: none;
        mix-blend-mode: screen;
        z-index: 0;
      }
      /* Card flight container — same beat as PackOpening's
         cardRevealFlight (drop-in from below, small bounce, settle). */
      .po-card-flight {
        position: relative;
        z-index: 1;
        animation: cardRevealFlight 0.8s cubic-bezier(.18,.85,.3,1.1) both;
        will-change: transform, opacity;
      }
      /* Holo sheen sweep for rare + cards — overlay clipped to the
         card footprint then a 110-deg gradient bar wipes left-to-right. */
      .po-card-sheen {
        position: absolute;
        inset: 0;
        overflow: hidden;
        border-radius: 18px;
        pointer-events: none;
        mix-blend-mode: screen;
      }
      .po-card-sheen-bar {
        position: absolute;
        inset: 0;
        background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.85) 50%, transparent 70%);
        animation: cardHoloSheen 1.1s ease-out 0.45s both;
      }
      .po-rarity-label {
        font-size: 11px;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        font-weight: 800;
        position: relative;
        z-index: 2;
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
        padding: 14px 18px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--theme-color) 88%, #fff) 0%, var(--theme-color) 100%);
        color: #fff;
        border: 0;
        border-radius: 999px;
        font-family: inherit;
        font-size: 14px; font-weight: 800;
        letter-spacing: 0.02em;
        cursor: pointer;
        box-shadow: 0 8px 20px color-mix(in srgb, var(--theme-color) 36%, transparent);
        transition: transform .12s;
      }
      .po-cta:hover { transform: translateY(-1px); }
      /* Two-up CTA row — Take Photo (primary, theme gradient) +
         Upload Image (secondary, neutral). Lets the player pick
         the source explicitly so the gallery isn't gated behind
         "capture" attribute heuristics. */
      .po-cta-row {
        display: flex; gap: 8px; width: 100%;
      }
      .po-cta-row .po-cta { flex: 1; }
      .po-cta.po-cta-upload {
        background: ${PALETTE.paper};
        color: ${PALETTE.text};
        border: 1.5px solid ${PALETTE.border};
        box-shadow: 0 4px 12px rgba(28,24,20,.12);
      }
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
