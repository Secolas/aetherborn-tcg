import { useMemo, useState } from 'react';
import { Sparkles, X, Hand, Swords, Clock, Trophy } from 'lucide-react';
import { MatchBoard } from './MatchBoard';
import { getBoss } from '../data/bosses';
import { getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { PALETTE } from '../components/styles';
import type { CollectionCard, SaveData } from '../game/types';
import type { Settings } from '../state/settings';

interface Props {
  starterThemeId: SaveData['starterThemeId'];
  playerAvatar?: string;
  settings: Settings;
  /** Match won — the tutorial is officially complete. */
  onComplete: () => void;
  /** Player tapped the X on the intro screen — back to Home. */
  onAbandon: () => void;
}

const TUTORIAL_BOSS_ID = 'tutorial-dummy';

/**
 * Scripted tutorial deck — twelve 1/2-cost cards with NO Rush so the
 * "summon -> wait -> attack next turn" flow actually plays out. Mixing
 * a 1-cost and a 2-cost creature gives the player something to do on
 * both opening turns; both cards lack the rush keyword, so the wait
 * step is a real beat instead of a hint that lies about the rules.
 *
 *   6 x ani-01 Mouse   (1c 1/1, no ability)
 *   6 x fam-02 Cousin  (2c 2/2, no ability)
 *
 * The Practice Dummy boss starts at 6 HP (see startingHp on the
 * tutorial-dummy entry in src/data/bosses.ts), so a few attacks with
 * these creatures wraps the match up in 3-4 turns.
 */
const TUTORIAL_DECK_IDS: string[] = [
  'ani-01','ani-01','ani-01','ani-01','ani-01','ani-01',
  'fam-02','fam-02','fam-02','fam-02','fam-02','fam-02',
];

/**
 * Tutorial — scripted first-match flow.
 *
 * Two phases:
 *   1. Intro screen. A clean full-screen card explaining the three
 *      player actions (summon / wait / attack) with a single
 *      "Begin Tutorial" CTA. No MatchBoard mounted yet, so the
 *      opening-deal animation only fires when the player commits.
 *   2. Match. MatchBoard mounts with a hand-curated 1-cost deck
 *      against the Practice Dummy. A floating hint card steps
 *      through four scripted prompts as the player advances:
 *        a. "Drag a card to the field"   (advances on onCreaturePlayed)
 *        b. "End your turn"              (advances on onPlayerTurnEnd)
 *        c. "Drag your creature to the opponent" (advances on onPlayerAttacked)
 *        d. "Reduce HP to 0 to win"      (persists until the match ends)
 *
 * Strict — non-win match exits reset the match (MatchBoard
 * remounts via key change) and re-show the intro screen.
 */
export function Tutorial({
  playerAvatar, settings, onComplete, onAbandon,
}: Props) {
  const [phase, setPhase] = useState<'intro' | 'match'>('intro');
  const [hintStep, setHintStep] = useState<0 | 1 | 2 | 3>(0);
  const [attempt, setAttempt] = useState(0);

  const boss = getBoss(TUTORIAL_BOSS_ID);

  // Materialise the scripted deck. Placeholder photos via aiPhoto so
  // every card is playable in the engine regardless of whether the
  // player has photographed anything yet (the tutorial runs before
  // the starter pack flow).
  const deck: CollectionCard[] = useMemo(() => {
    return TUTORIAL_DECK_IDS.map((id, i) => {
      const tpl = getTemplateById(id);
      if (!tpl) return null;
      return {
        ...tpl,
        uid: `tut_${i}_${id}`,
        photo: aiPhoto(tpl.id),
        isPlaceholder: true,
      } as CollectionCard;
    }).filter((c): c is CollectionCard => !!c);
  }, []);

  if (!boss) return null;

  // ─── Intro phase ────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="tu-root">
        <TutorialStyles />
        <div className="tu-intro-page">
          <button
            className="tu-intro-close"
            onClick={onAbandon}
            aria-label="Back to Home"
          >
            <X size={16} strokeWidth={2.4} />
          </button>
          <div className="tu-intro-pad">
            <div className="tu-intro-eyebrow">
              <Sparkles size={12} strokeWidth={2.4} color={PALETTE.accent} />
              <span>FIRST STEPS</span>
            </div>
            <div className="tu-intro-title">How to play</div>
            <div className="tu-intro-rules">
              <div className="tu-rule">
                <div className="tu-rule-icon"><Hand size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Summon</div>
                  <div className="tu-rule-p">Drag a card from your hand to the field. Each costs mana.</div>
                </div>
              </div>
              <div className="tu-rule">
                <div className="tu-rule-icon"><Clock size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Wait</div>
                  <div className="tu-rule-p">Fresh creatures can't attack the turn you summon them. End your turn.</div>
                </div>
              </div>
              <div className="tu-rule">
                <div className="tu-rule-icon"><Swords size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Attack</div>
                  <div className="tu-rule-p">Drag a creature onto the opponent. Reduce their HP to 0 to win.</div>
                </div>
              </div>
            </div>
            <button
              className="tu-intro-cta"
              onClick={() => {
                setHintStep(0);
                setPhase('match');
              }}
            >
              <Trophy size={18} strokeWidth={2.4} />
              <span>Begin Tutorial</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Match phase ────────────────────────────────────────────────
  return (
    <div className="tu-root">
      <TutorialStyles />

      {hintStep < 3 && (
        <div className="tu-hint" aria-live="polite">
          {hintStep === 0 && (
            <>
              <Hand size={14} strokeWidth={2.4} />
              <span>Drag a card from your hand onto the field.</span>
            </>
          )}
          {hintStep === 1 && (
            <>
              <Clock size={14} strokeWidth={2.4} />
              <span>Tap End Turn — your creature can't attack the turn you summon it.</span>
            </>
          )}
          {hintStep === 2 && (
            <>
              <Swords size={14} strokeWidth={2.4} />
              <span>Now drag your creature onto the opponent to attack.</span>
            </>
          )}
        </div>
      )}
      {hintStep === 3 && (
        <div className="tu-hint" aria-live="polite">
          <Trophy size={14} strokeWidth={2.4} />
          <span>Keep attacking. Reduce the opponent's HP to 0 to win.</span>
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
          // First summon -> advance from "drag a card" to "end turn".
          setHintStep((s) => (s === 0 ? 1 : s));
        }}
        onPlayerTurnEnd={() => {
          // First end-turn after summoning -> advance to "now attack".
          setHintStep((s) => (s === 1 ? 2 : s));
        }}
        onPlayerAttacked={() => {
          // First attack -> advance to "keep going" final hint.
          setHintStep((s) => (s === 2 ? 3 : s));
        }}
        onExit={(outcome) => {
          if (outcome === 'win') {
            onComplete();
            return;
          }
          // Strict — reset to intro on any non-win exit. Player
          // re-reads the rules and starts a fresh match.
          setAttempt((a) => a + 1);
          setHintStep(0);
          setPhase('intro');
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

      /* Intro phase — full-screen rules page. MatchBoard does NOT
         mount until the player taps Begin, so the opening-deal
         animation kicks in only on commit (instead of running
         behind a modal). */
      .tu-intro-page {
        position: absolute; inset: 0;
        background:
          radial-gradient(ellipse 280px 200px at 22% 18%, rgba(238,90,82,0.10), transparent 70%),
          radial-gradient(ellipse 260px 180px at 78% 82%, rgba(90,168,99,0.10), transparent 70%),
          ${PALETTE.bg};
        color: ${PALETTE.text};
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        display: flex; align-items: center; justify-content: center;
        padding: max(24px, env(safe-area-inset-top, 24px)) 18px 24px 18px;
      }
      .tu-intro-pad {
        width: 100%; max-width: 380px;
        background: ${PALETTE.paper};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 22px;
        padding: 26px 22px 24px;
        box-shadow: 0 20px 40px rgba(28,24,20,.20);
        animation: tuPop .25s cubic-bezier(.2,.85,.3,1);
      }
      @keyframes tuPop {
        from { transform: scale(.95); opacity: 0; }
        to   { transform: scale(1); opacity: 1; }
      }
      .tu-intro-close {
        position: absolute; top: 14px; right: 14px;
        width: 36px; height: 36px;
        display: grid; place-items: center;
        background: ${PALETTE.paper};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 10px;
        cursor: pointer;
        color: ${PALETTE.textMid};
        box-shadow: 0 2px 6px rgba(28,24,20,.10);
        z-index: 10;
      }
      .tu-intro-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 11px; font-weight: 800;
        letter-spacing: 0.18em;
        color: ${PALETTE.accent};
        margin-bottom: 4px;
      }
      .tu-intro-title {
        font-size: 24px; font-weight: 800;
        letter-spacing: -0.01em;
        line-height: 1.05;
        margin-bottom: 16px;
      }
      .tu-intro-rules {
        display: flex; flex-direction: column; gap: 12px;
        margin-bottom: 22px;
      }
      .tu-rule {
        display: flex; align-items: flex-start; gap: 12px;
      }
      .tu-rule-icon {
        flex-shrink: 0;
        width: 38px; height: 38px;
        border-radius: 12px;
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        display: grid; place-items: center;
        color: ${PALETTE.accent};
      }
      .tu-rule-h {
        font-size: 14px; font-weight: 800;
        letter-spacing: -0.01em;
      }
      .tu-rule-p {
        font-size: 12px; color: ${PALETTE.textMid};
        line-height: 1.4;
        margin-top: 2px;
      }
      .tu-intro-cta {
        width: 100%;
        display: inline-flex; align-items: center; justify-content: center; gap: 10px;
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
        transition: transform .12s;
      }
      .tu-intro-cta:hover { transform: translateY(-1px); }

      /* Match-phase hint card — same as before. */
      .tu-hint {
        position: absolute;
        top: max(76px, env(safe-area-inset-top, 76px));
        left: 50%;
        transform: translateX(-50%);
        z-index: 400;
        display: inline-flex; align-items: center; gap: 8px;
        padding: 8px 14px;
        background: ${PALETTE.text};
        color: #fff;
        border-radius: 999px;
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        font-size: 12px; font-weight: 700;
        box-shadow: 0 10px 24px rgba(28,24,20,.30);
        animation: tuHintIn .35s cubic-bezier(.2,.85,.3,1);
        max-width: calc(100% - 32px);
        text-align: left;
        line-height: 1.3;
      }
      @keyframes tuHintIn {
        from { transform: translate(-50%, -8px); opacity: 0; }
        to   { transform: translate(-50%, 0); opacity: 1; }
      }
    `}</style>
  );
}
