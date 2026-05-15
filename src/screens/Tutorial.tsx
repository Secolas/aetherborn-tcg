import { useMemo, useState } from 'react';
import { Sparkles, X, Hand, Swords, Clock } from 'lucide-react';
import { MatchBoard } from './MatchBoard';
import { getBoss } from '../data/bosses';
import { templatesByTheme } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { PALETTE } from '../components/styles';
import type { CollectionCard, ElementId, SaveData } from '../game/types';
import type { Settings } from '../state/settings';

interface Props {
  /** The starter theme the player picked — used to synthesise a
   *  thematically-matching tutorial deck so the visuals don't feel
   *  random. Falls back to family if undefined (legacy saves
   *  shouldn't normally hit this screen). */
  starterThemeId: SaveData['starterThemeId'];
  playerAvatar?: string;
  settings: Settings;
  /** Match won — the tutorial is officially complete. */
  onComplete: () => void;
  /** Player tried to bail. Routed back to App in case the App wants
   *  to ignore it (strict onboarding) or honour it (legacy / debug).
   *  Today the App routes here on first boot regardless, so abandon
   *  is best-effort — Tutorial itself auto-restarts on non-win exits. */
  onAbandon: () => void;
}

const TUTORIAL_BOSS_ID = 'tutorial-dummy';
/** Total cards in the synthesised tutorial deck. Matches the engine's
 *  preferred deck size (12) so the assembleMatch deck-trim logic
 *  doesn't truncate the opponent. */
const TUTORIAL_DECK_SIZE = 12;

/**
 * Tutorial — scripted first-match flow.
 *
 * Wraps MatchBoard with three additions:
 *   1. An intro modal that explains the three player actions
 *      (drag-to-play, drag-to-attack, end turn) before the match
 *      begins. Player must dismiss to start.
 *   2. A small floating hint card during the match that starts at
 *      "Drag a card to the field" and shifts to "Drag your creature
 *      onto the opponent to attack" after the first creature is
 *      played (via MatchBoard's existing onCreaturePlayed callback).
 *   3. A synthesised 12-card player deck (placeholder photos, same
 *      isPlaceholder pattern as the existing test-theme flow) so the
 *      player can play the tutorial even if they skipped every photo
 *      during the starter pack open.
 *
 * The opponent (Practice Dummy) plays a deck of pure 1/1 1-cost
 * creatures, so even mediocre play wins comfortably.
 */
export function Tutorial({
  starterThemeId, playerAvatar, settings, onComplete, onAbandon,
}: Props) {
  const [introOpen, setIntroOpen] = useState(true);
  const [hintStep, setHintStep] = useState<0 | 1 | 2>(0);
  // Bumped on every non-win match exit so MatchBoard remounts with
  // a fresh engine state. Inside the match, the tutorial is strict —
  // losing / quitting auto-restarts. Outside the match (i.e. the
  // intro modal), the X button cleanly backs out to Home via
  // onAbandon, so the player can come back via the Home CTA later.
  const [attempt, setAttempt] = useState(0);

  const boss = getBoss(TUTORIAL_BOSS_ID);

  // Synthesise the player's tutorial deck from their starter theme —
  // pick the strongest cheap creatures so the curve is forgiving and
  // the player has playable threats from turn 1.
  const themeForDeck: ElementId =
    !starterThemeId || starterThemeId === 'legacy' ? 'family' : starterThemeId;
  const deck: CollectionCard[] = useMemo(() => {
    const pool = templatesByTheme(themeForDeck)
      .filter(t => t.type === 'Creature' && t.cost <= 3)
      .sort((a, b) => (b.atk * 2 + b.hp) - (a.atk * 2 + a.hp));
    // Cycle through the top creatures up to TUTORIAL_DECK_SIZE so the
    // deck is full even if the theme has fewer than 12 qualifying
    // creatures (Family has ~5 cheap creatures; the cycle covers the
    // rest with duplicates).
    const result: CollectionCard[] = [];
    for (let i = 0; i < TUTORIAL_DECK_SIZE; i++) {
      const tpl = pool[i % Math.max(1, pool.length)];
      if (!tpl) break;
      result.push({
        ...tpl,
        uid: `tut_${themeForDeck}_${i}_${tpl.id}`,
        photo: aiPhoto(tpl.id),
        isPlaceholder: true,
      });
    }
    return result;
  }, [themeForDeck]);

  if (!boss) return null;

  return (
    <div className="tu-root">
      <TutorialStyles />

      {/* Intro modal — blocks the board until the player taps Begin. */}
      {introOpen && (
        <div className="tu-intro-backdrop" onClick={() => setIntroOpen(false)}>
          <div className="tu-intro" onClick={(e) => e.stopPropagation()}>
            <button
              className="tu-intro-close"
              onClick={onAbandon}
              aria-label="Back to Home"
            >
              <X size={16} strokeWidth={2.4} />
            </button>
            <div className="tu-intro-eyebrow">
              <Sparkles size={12} strokeWidth={2.4} color={PALETTE.accent} />
              <span>FIRST STEPS</span>
            </div>
            <div className="tu-intro-title">How to play</div>
            <div className="tu-intro-rules">
              <div className="tu-rule">
                <div className="tu-rule-icon"><Hand size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Drag a card to the field</div>
                  <div className="tu-rule-p">Each card costs mana. You start with 1 and gain 1 every turn.</div>
                </div>
              </div>
              <div className="tu-rule">
                <div className="tu-rule-icon"><Swords size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Drag a creature onto the opponent</div>
                  <div className="tu-rule-p">That's an attack. The opponent loses HP. Reduce it to 0 to win.</div>
                </div>
              </div>
              <div className="tu-rule">
                <div className="tu-rule-icon"><Clock size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">End your turn when you're done</div>
                  <div className="tu-rule-p">The opponent plays. Then you draw a card and gain mana.</div>
                </div>
              </div>
            </div>
            <button className="tu-intro-cta" onClick={() => setIntroOpen(false)}>
              Begin
            </button>
          </div>
        </div>
      )}

      {/* Floating hint card — only when the intro is dismissed. The hint
          text advances on onCreaturePlayed (player's first summon). */}
      {!introOpen && hintStep < 2 && (
        <div className="tu-hint" aria-live="polite">
          {hintStep === 0 && (
            <>
              <Hand size={14} strokeWidth={2.4} />
              <span>Drag a card from your hand onto the field.</span>
            </>
          )}
          {hintStep === 1 && (
            <>
              <Swords size={14} strokeWidth={2.4} />
              <span>Now drag your creature onto the opponent to attack.</span>
            </>
          )}
          <button
            className="tu-hint-dismiss"
            onClick={() => setHintStep((s) => (s === 0 ? 1 : 2))}
            aria-label="Dismiss hint"
          >
            <X size={12} strokeWidth={2.4} />
          </button>
        </div>
      )}

      <MatchBoard
        key={attempt}
        deck={deck}
        boss={boss}
        difficulty="normal"
        playerAvatar={playerAvatar}
        settings={settings}
        alreadyBeaten={false}
        onCreaturePlayed={() => {
          // First summon -> advance to the attack hint. Subsequent
          // summons don't push past step 2 (the hint disappears).
          setHintStep((s) => (s === 0 ? 1 : s));
        }}
        onExit={(outcome) => {
          if (outcome === 'win') {
            onComplete();
            return;
          }
          // Strict tutorial — losing / quitting resets the match
          // (MatchBoard remounts via the `key` change) and re-shows
          // the intro modal. The player has to win to escape.
          setAttempt((a) => a + 1);
          setHintStep(0);
          setIntroOpen(true);
        }}
      />
    </div>
  );
}

function TutorialStyles() {
  return (
    <style>{`
      .tu-root {
        position: absolute; inset: 0;
      }

      /* Intro modal — sits over the entire board so the player can't
         accidentally start dragging cards before they've read the rules. */
      .tu-intro-backdrop {
        position: absolute; inset: 0;
        background: rgba(28,24,20,.6);
        z-index: 500;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        animation: tuFade .2s ease-out;
      }
      @keyframes tuFade { from { opacity: 0; } to { opacity: 1; } }
      .tu-intro {
        position: relative;
        width: 100%; max-width: 360px;
        background: ${PALETTE.paper};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 18px;
        padding: 22px 20px;
        box-shadow: 0 30px 60px rgba(28,24,20,.4);
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        color: ${PALETTE.text};
        animation: tuSlideUp .25s cubic-bezier(.2,.85,.3,1);
      }
      @keyframes tuSlideUp {
        from { transform: translateY(20px); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }
      .tu-intro-close {
        position: absolute; top: 10px; right: 10px;
        width: 28px; height: 28px;
        display: grid; place-items: center;
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 8px;
        cursor: pointer;
        color: ${PALETTE.textMid};
      }
      .tu-intro-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.18em;
        color: ${PALETTE.accent};
        margin-bottom: 4px;
      }
      .tu-intro-title {
        font-size: 22px; font-weight: 700;
        letter-spacing: -0.01em;
        margin-bottom: 14px;
      }
      .tu-intro-rules {
        display: flex; flex-direction: column; gap: 14px;
        margin-bottom: 18px;
      }
      .tu-rule {
        display: flex; align-items: flex-start; gap: 12px;
      }
      .tu-rule-icon {
        flex-shrink: 0;
        width: 36px; height: 36px;
        border-radius: 10px;
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        display: grid; place-items: center;
        color: ${PALETTE.accent};
      }
      .tu-rule-h {
        font-size: 14px; font-weight: 700;
        letter-spacing: -0.01em;
      }
      .tu-rule-p {
        font-size: 12px; color: ${PALETTE.textMid};
        line-height: 1.4;
        margin-top: 2px;
      }
      .tu-intro-cta {
        width: 100%;
        background: linear-gradient(180deg, #ffa07a 0%, ${PALETTE.accent} 60%, ${PALETTE.accentDeep} 100%);
        color: #fff;
        border: 0;
        border-radius: 999px;
        padding: 14px 22px;
        font-family: inherit;
        font-size: 15px; font-weight: 800;
        letter-spacing: 0.04em;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(238,90,82,.32);
      }

      /* Floating hint card during the match. Pinned near the top so it
         doesn't cover the hand or field. Auto-dismisses on tap. */
      .tu-hint {
        position: absolute;
        top: max(76px, env(safe-area-inset-top, 76px));
        left: 50%;
        transform: translateX(-50%);
        z-index: 400;
        display: inline-flex; align-items: center; gap: 8px;
        padding: 8px 14px 8px 14px;
        background: ${PALETTE.text};
        color: #fff;
        border-radius: 999px;
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        font-size: 12px; font-weight: 700;
        box-shadow: 0 10px 24px rgba(28,24,20,.30);
        animation: tuHintIn .35s cubic-bezier(.2,.85,.3,1);
        max-width: calc(100% - 32px);
      }
      .tu-hint-dismiss {
        margin-left: 4px;
        width: 20px; height: 20px;
        display: grid; place-items: center;
        background: rgba(255,255,255,.18);
        color: #fff;
        border: 0;
        border-radius: 50%;
        cursor: pointer;
      }
      @keyframes tuHintIn {
        from { transform: translate(-50%, -8px); opacity: 0; }
        to   { transform: translate(-50%, 0); opacity: 1; }
      }
    `}</style>
  );
}
