import { useRef, useState } from 'react';
import { Camera, Check, ChevronRight, Sparkles, SkipForward, Upload, X, Image as ImageIcon } from 'lucide-react';
import { ELEMENTS } from '../data/elements';
import { PALETTE } from '../components/styles';
import { Card } from '../components/Card';
import { TiltCard } from '../components/TiltCard';
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
  // Three phases:
  //   reveal — Pokémon-style one-at-a-time. Default landing phase.
  //   review — full 4×3 grid of every starter card so the player can
  //            re-check what they got + see which ones are still
  //            dormant. Reached automatically after the last reveal,
  //            or via a Skip path from any reveal step. The player
  //            can tap any card to inspect it (holo + tilt + rarity
  //            halo) before committing.
  const [phase, setPhase] = useState<'reveal' | 'review'>('reveal');
  const [idx, setIdx] = useState(0);
  const [inspectIdx, setInspectIdx] = useState<number | null>(null);
  // Two inputs — one with capture="environment" so the camera
  // launches directly, one without so the OS picker opens the
  // gallery. The player picks the source explicitly via two CTAs.
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  // Camera input bound to the inspect modal — lets the player fill
  // in a missing photo from the review grid without having to walk
  // back through every preceding card.
  const inspectCameraRef = useRef<HTMLInputElement>(null);
  const inspectUploadRef = useRef<HTMLInputElement>(null);
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
    // After the last card the player drops into the review grid
    // instead of finishing immediately. Gives them a chance to see
    // every card together and fix up any skipped photos.
    if (idx >= total - 1) setPhase('review');
    else setIdx(i => i + 1);
  };

  const goToReview = () => setPhase('review');

  const readFileFor = (uid: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') onSetPhoto(uid, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!current) return;
    readFileFor(current.uid)(e);
  };

  // ─── REVIEW PHASE ─────────────────────────────────────────────
  if (phase === 'review') {
    const inspectCard = inspectIdx != null ? cards[inspectIdx] : null;
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
          <div className="po-title">Your starter deck</div>
          <div className="po-sub">
            Tap any card to preview it. Cards without a photo stay
            dormant — you can add their photos any time from
            Collection later.
          </div>
        </div>

        <ReviewGrid
          cards={cards}
          onInspect={(i) => setInspectIdx(i)}
        />

        <div className="po-actions">
          <button className="po-cta" onClick={onDone}>
            <span>Finish — Start Campaign</span>
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        </div>

        {inspectCard && (
          <>
            <input
              ref={inspectCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={readFileFor(inspectCard.uid)}
              style={{ display: 'none' }}
            />
            <input
              ref={inspectUploadRef}
              type="file"
              accept="image/*"
              onChange={readFileFor(inspectCard.uid)}
              style={{ display: 'none' }}
            />
            <InspectModal
              card={inspectCard}
              themeGlow={themeGlow}
              onClose={() => setInspectIdx(null)}
              onTakePhoto={() => inspectCameraRef.current?.click()}
              onUploadPhoto={() => inspectUploadRef.current?.click()}
            />
          </>
        )}
      </div>
    );
  }

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
          {/* Rarity-name label removed for consistency with the
              inspect modal — the card chrome carries the colour and
              the halo / sheen do the rest. */}
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
            <span>{idx >= total - 1 ? 'See all 12 cards' : 'Next'}</span>
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {idx >= total - 1 && !photoSet && (
        <div className="po-finish-row">
          <button className="po-finish" onClick={goToReview}>
            <span>See all 12 cards — I'll add photos later</span>
            <ChevronRight size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}

// =================================================================
// REVIEW GRID — final phase. 4×3 grid of every starter card. Tapping
// a card opens the InspectModal so the player can preview it large.
// =================================================================
function ReviewGrid({
  cards,
  onInspect,
}: {
  cards: CollectionCard[];
  onInspect: (idx: number) => void;
}) {
  return (
    <div className="po-grid">
      {cards.map((c, i) => {
        const dormant = !c.photo;
        return (
          <button
            key={c.uid}
            className="po-grid-cell"
            onClick={() => onInspect(i)}
            aria-label={`Preview ${c.name}`}
            data-rarity={c.rarity}
          >
            <Card card={c} scale={0.34} />
            {dormant && (
              <div className="po-grid-dormant" aria-hidden>
                <ImageIcon size={12} strokeWidth={2.4} />
                <span>dormant</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// =================================================================
// INSPECT MODAL — full-size card preview with the holo/tilt
// treatment from the landing page (TiltCard + shine) plus the same
// rarityHalo / cardHoloSheen layered effects the reveal step uses.
// =================================================================
function InspectModal({
  card, themeGlow, onClose, onTakePhoto, onUploadPhoto,
}: {
  card: CollectionCard;
  themeGlow: string;
  onClose: () => void;
  onTakePhoto: () => void;
  onUploadPhoto: () => void;
}) {
  const showHalo = card.rarity === 'epic' || card.rarity === 'legendary';
  const showSheen = card.rarity !== 'common';
  const haloColor = card.rarity === 'legendary' ? '#ffd166' : themeGlow;
  const dormant = !card.photo;
  return (
    <div
      className="po-modal-scrim"
      role="dialog"
      aria-label={`${card.name} preview`}
      onClick={onClose}
    >
      <button
        className="po-modal-close"
        onClick={onClose}
        aria-label="Close preview"
        title="Close"
      >
        <X size={18} strokeWidth={2.4} />
      </button>
      <div
        className="po-modal-stage"
        onClick={(e) => e.stopPropagation()}
      >
        {showHalo && (
          <div
            aria-hidden
            className="po-modal-halo"
            style={{
              background: `radial-gradient(circle, ${haloColor} 0%, transparent 60%)`,
            }}
          />
        )}
        <div className="po-modal-card">
          <TiltCard maxTilt={14} hoverScale={1.04} shine={showSheen}>
            <Card card={card} hovered />
            {showSheen && (
              <div aria-hidden className="po-modal-sheen">
                <div className="po-modal-sheen-bar" />
              </div>
            )}
          </TiltCard>
        </div>
        {/* Rarity-name label removed — the card chrome already shows
            the rarity colour on the card itself, and the gold halo +
            holo sheen carry the epic / legendary signal. The all-caps
            "COMMON" tag at the bottom read as noise. */}
        {dormant && (
          <div className="po-modal-actions">
            <button className="po-cta po-cta-camera" onClick={onTakePhoto}>
              <Camera size={18} strokeWidth={2.4} />
              <span>Take Photo</span>
            </button>
            <button className="po-cta po-cta-upload" onClick={onUploadPhoto}>
              <Upload size={18} strokeWidth={2.4} />
              <span>Upload</span>
            </button>
          </div>
        )}
      </div>
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

      /* ── REVIEW PHASE ─────────────────────────────────────── */
      .po-title {
        font-size: 22px; font-weight: 800;
        letter-spacing: -0.01em;
        margin-bottom: 4px;
      }
      .po-sub {
        font-size: 12px;
        color: ${PALETTE.textMid};
        line-height: 1.4;
        max-width: 360px;
        margin: 0 auto 8px;
      }
      .po-grid {
        flex: 1; min-height: 0;
        margin-top: 12px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
        gap: 8px;
        align-content: start;
        justify-items: center;
        overflow-y: auto;
        padding: 4px 2px 16px;
      }
      @media (min-width: 720px) {
        .po-grid {
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 14px;
          max-width: 720px;
          margin-left: auto; margin-right: auto;
        }
      }
      .po-grid-cell {
        position: relative;
        display: grid; place-items: center;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
        font-family: inherit;
        transition: transform .12s;
        animation: poGridIn .35s cubic-bezier(.2,.85,.3,1) both;
      }
      .po-grid-cell:hover { transform: translateY(-2px) scale(1.03); }
      .po-grid-cell:active { transform: scale(.98); }
      .po-grid-dormant {
        position: absolute;
        bottom: 4px;
        left: 50%;
        transform: translateX(-50%);
        display: inline-flex; align-items: center; gap: 3px;
        padding: 2px 7px;
        background: rgba(58,46,42,.78);
        color: #fff;
        border-radius: 999px;
        font-size: 9px; font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        pointer-events: none;
      }
      @keyframes poGridIn {
        from { opacity: 0; transform: translateY(8px) scale(.92); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* ── INSPECT MODAL ────────────────────────────────────── */
      .po-modal-scrim {
        position: absolute; inset: 0;
        background: rgba(8,4,12,.74);
        display: grid; place-items: center;
        z-index: 220;
        padding: 16px;
        animation: poModalFade .2s ease-out both;
        overflow-y: auto;
      }
      @keyframes poModalFade {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .po-modal-close {
        position: absolute;
        top: max(16px, env(safe-area-inset-top, 16px));
        right: 16px;
        z-index: 2;
        width: 36px; height: 36px;
        display: grid; place-items: center;
        border-radius: 50%;
        background: rgba(255,255,255,.92);
        border: 1.5px solid rgba(58,46,42,.18);
        color: ${PALETTE.text};
        cursor: pointer;
        font-family: inherit;
        box-shadow: 0 2px 8px rgba(0,0,0,.32);
        transition: transform .12s, background .15s;
      }
      .po-modal-close:hover { background: #fff; transform: scale(1.05); }
      .po-modal-close:active { transform: scale(.96); }
      .po-modal-stage {
        position: relative;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        animation: poModalIn .3s cubic-bezier(.2,.8,.3,1) both;
      }
      @keyframes poModalIn {
        from { opacity: 0; transform: translateY(12px) scale(.94); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      .po-modal-halo {
        position: absolute;
        left: 50%; top: 50%;
        width: 420px; height: 420px;
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(0.3);
        animation: rarityHalo 1.4s ease-out both;
        pointer-events: none;
        mix-blend-mode: screen;
        z-index: 0;
      }
      .po-modal-card {
        position: relative;
        z-index: 1;
      }
      .po-modal-sheen {
        position: absolute;
        inset: 0;
        overflow: hidden;
        border-radius: 18px;
        pointer-events: none;
        mix-blend-mode: screen;
      }
      .po-modal-sheen-bar {
        position: absolute; inset: 0;
        background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.85) 50%, transparent 70%);
        animation: cardHoloSheen 1.1s ease-out 0.25s both;
      }
      .po-modal-rarity {
        font-size: 12px;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        font-weight: 800;
        position: relative;
        z-index: 2;
      }
      .po-modal-actions {
        display: flex; gap: 8px;
        width: 100%;
        max-width: 320px;
      }
      .po-modal-actions .po-cta {
        flex: 1;
        padding: 12px 14px;
        font-size: 13px;
      }
    `}</style>
  );
}
