import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, Hand, Swords, Clock, Trophy, Wand2, HeartPulse, LinkIcon as Link2 } from 'lucide-react';
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
  onComplete: () => void;
  onAbandon: () => void;
}

const TUTORIAL_BOSS_ID = 'tutorial-dummy';

/**
 * Scripted tutorial deck — built around the Breakfast Combo bond
 * (fd-01 Coffee Mug + fd-04 Breakfast Plate) so the tutorial can
 * walk a brand-new player through summon, attack, spell, heal and
 * bond in a single match.
 *
 *   4 x fd-01 Coffee Mug     (1c 1/2 — turn 1 summon)
 *   4 x fd-04 Breakfast Plate (2c 1/3 — turn 2, triggers the bond)
 *   2 x ani-16 Good Boy      (1c spell, +0/+2 buff — spell step)
 *   2 x fam-14 Hug           (1c spell, heal a creature — heal step)
 *
 * Practice Dummy boots at 6 HP (see BossDef.startingHp on tutorial-
 * dummy in src/data/bosses.ts), so 3-4 attacks finish the match
 * once the player has worked through the script.
 */
const TUTORIAL_DECK_IDS: string[] = [
  'fd-01','fd-01','fd-01','fd-01',
  'fd-04','fd-04','fd-04','fd-04',
  'ani-16','ani-16',
  'fam-14','fam-14',
];

// ─── Step machine ───────────────────────────────────────────────────

/**
 * A scripted tutorial step. The Tutorial component spotlights one
 * (or a set of) DOM elements via data-tut-* attributes; when the
 * player completes the gated action, the next step queues up.
 *
 * - title: short label in the hint card eyebrow.
 * - icon:  Lucide icon for the hint card.
 * - text:  the full hint copy.
 * - spotlight: which data-tut-* selector(s) to highlight. When the
 *   match phase begins, an overlay finds these elements and draws a
 *   pulsing ring + dims the rest of the screen. Empty list = no
 *   overlay (used for the "watch what happens" beats).
 * - advanceOn: which match event advances past this step. The right
 *   event firing during this step moves to the next; other events
 *   are no-ops (so accidental clicks elsewhere don't break the flow).
 * - requireSpellId: when advanceOn is 'spell-cast', only this
 *   template id counts (lets us distinguish "now cast Good Boy" from
 *   "now cast Hug").
 */
interface TutorialStep {
  title: string;
  icon: 'hand' | 'clock' | 'swords' | 'wand' | 'heart' | 'bond' | 'trophy';
  text: string;
  spotlight: string[];
  advanceOn: 'card-played' | 'turn-end' | 'attack' | 'spell-cast' | 'auto' | null;
  /** When set, advanceOn 'card-played' / 'spell-cast' only counts
   *  if the played card's template id matches. Lets us gate "summon
   *  Coffee Mug" vs "summon Breakfast Plate" without sharing steps. */
  requireCardId?: string;
  /** When set, advanceOn 'attack' only counts when the player swings
   *  at this kind of target. Lets us split "attack a creature" and
   *  "attack the opponent's face" into distinct teaching beats. */
  requireAttackTarget?: 'face' | 'creature';
  /** When set, the script auto-advances this many ms after entry —
   *  used for the "watch what just happened" beats (bond trigger,
   *  heal flash) that don't tie to a player action. */
  autoMs?: number;
}

const STEPS: TutorialStep[] = [
  {
    title: 'SUMMON',
    icon: 'hand',
    text: "Drag the highlighted Coffee Mug onto the field. It costs 1 mana.",
    spotlight: ['[data-tut-hand-card="fd-01"]'],
    advanceOn: 'card-played',
    requireCardId: 'fd-01',
  },
  {
    title: 'END TURN',
    icon: 'clock',
    text: "Creatures can't attack the turn you summon them. Tap End Turn — your opponent will play, then it's your turn again.",
    spotlight: ['[data-tut="end-turn"]', '[data-tut="go-battle"]'],
    advanceOn: 'turn-end',
  },
  {
    title: 'BOND PIECE',
    icon: 'bond',
    text: "Drag a Breakfast Plate onto the field. (Its own ability draws you a card — that's the card text, not the bond.)",
    spotlight: ['[data-tut-hand-card="fd-04"]'],
    advanceOn: 'card-played',
    requireCardId: 'fd-04',
  },
  {
    title: 'BOND ACTIVE',
    icon: 'bond',
    text: "Coffee Mug + Breakfast Plate together form Bond: Breakfast Combo — your creatures will heal +2 HP at the start of every turn from now on.",
    spotlight: [],
    advanceOn: 'auto',
    autoMs: 3200,
  },
  {
    title: 'ATTACK A CREATURE',
    icon: 'swords',
    text: "Creatures can attack each other. Drag your Coffee Mug onto an opponent creature to fight it.",
    spotlight: ['[data-tut-field-card="fd-01"][data-tut-side="player"]', '[data-tut-field-card][data-tut-side="opponent"]'],
    advanceOn: 'attack',
    requireAttackTarget: 'creature',
  },
  {
    title: 'ATTACK THE OPPONENT',
    icon: 'swords',
    text: "Or attack their portrait directly. That's how you drop their HP and win.",
    spotlight: ['[data-tut-field-card][data-tut-side="player"]', '[data-tut="opp-face"]'],
    advanceOn: 'attack',
    requireAttackTarget: 'face',
  },
  {
    title: 'SPELL',
    icon: 'wand',
    text: "Spells aren't creatures — drag Good Boy onto one of your creatures to buff it (+2 HP).",
    spotlight: ['[data-tut-hand-card="ani-16"]'],
    advanceOn: 'spell-cast',
    requireCardId: 'ani-16',
  },
  {
    title: 'HEAL',
    icon: 'heart',
    text: "Hug restores HP. Drag it onto a creature that took damage.",
    spotlight: ['[data-tut-hand-card="fam-14"]'],
    advanceOn: 'spell-cast',
    requireCardId: 'fam-14',
  },
  {
    title: 'FINISH',
    icon: 'trophy',
    text: "You know all the basics now. Keep ending turns and attacking until the opponent's HP hits 0.",
    spotlight: ['[data-tut="end-turn"]', '[data-tut="go-battle"]', '[data-tut="opp-face"]'],
    advanceOn: null,
  },
];

// ─── Component ──────────────────────────────────────────────────────

export function Tutorial({
  playerAvatar, settings, onComplete, onAbandon,
}: Props) {
  const [phase, setPhase] = useState<'intro' | 'match'>('intro');
  const [stepIdx, setStepIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const boss = getBoss(TUTORIAL_BOSS_ID);
  const step = STEPS[Math.min(stepIdx, STEPS.length - 1)];

  // Build a placeholder-photo deck from the scripted ID list.
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

  const advance = (
    kind: TutorialStep['advanceOn'],
    payload?: { cardId?: string; attackTarget?: 'face' | 'creature' },
  ) => {
    if (step.advanceOn !== kind) return;
    if ((kind === 'spell-cast' || kind === 'card-played')
        && step.requireCardId
        && payload?.cardId !== step.requireCardId) {
      return;
    }
    if (kind === 'attack'
        && step.requireAttackTarget
        && payload?.attackTarget !== step.requireAttackTarget) {
      return;
    }
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  };

  // Auto-advance for steps that don't gate on a player action (the
  // "watch the bond fire" / "watch the heal" beats).
  useEffect(() => {
    if (phase !== 'match') return;
    if (step.advanceOn !== 'auto' || !step.autoMs) return;
    const t = setTimeout(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), step.autoMs);
    return () => clearTimeout(t);
  }, [phase, step]);

  if (!boss) return null;

  // ─── Intro phase ──────────────────────────────────────────────
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
                  <div className="tu-rule-h">Summon, then wait, then attack</div>
                  <div className="tu-rule-p">Drag a card to play it. Creatures can't attack the turn they were summoned — end your turn first.</div>
                </div>
              </div>
              <div className="tu-rule">
                <div className="tu-rule-icon"><Wand2 size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Spells &amp; heals</div>
                  <div className="tu-rule-p">Some cards aren't creatures — drag them on the right target to buff, damage, or heal.</div>
                </div>
              </div>
              <div className="tu-rule">
                <div className="tu-rule-icon"><Link2 size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Bonds</div>
                  <div className="tu-rule-p">Two specific cards together unlock a Bond — extra effects every turn.</div>
                </div>
              </div>
            </div>
            <button
              className="tu-intro-cta"
              onClick={() => {
                setStepIdx(0);
                setPhase('match');
              }}
            >
              <Trophy size={18} strokeWidth={2.4} />
              <span>Begin Tutorial</span>
            </button>
            <div className="tu-intro-foot">I'll spotlight what to tap at every step.</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Match phase ──────────────────────────────────────────────
  return (
    <div className="tu-root">
      <TutorialStyles />
      <TutorialSpotlight step={step} key={`${attempt}-${stepIdx}`} />

      <MatchBoard
        key={attempt}
        deck={deck}
        boss={boss}
        difficulty="normal"
        playerAvatar={playerAvatar}
        settings={settings}
        alreadyBeaten={false}
        onCreaturePlayed={(id) => advance('card-played', { cardId: id })}
        onPlayerTurnEnd={() => advance('turn-end')}
        onPlayerAttacked={(target) => advance('attack', { attackTarget: target })}
        onPlayerSpellCast={(id) => advance('spell-cast', { cardId: id })}
        onExit={(outcome) => {
          if (outcome === 'win') {
            onComplete();
            return;
          }
          setAttempt((a) => a + 1);
          setStepIdx(0);
          setPhase('intro');
        }}
      />
    </div>
  );
}

// ─── Spotlight overlay ──────────────────────────────────────────────

/**
 * Sits on top of MatchBoard. Looks up the current step's spotlight
 * selectors on every animation frame (no MutationObserver — cards
 * move via Framer Motion transforms which don't trigger DOM mutation
 * events), draws a pulsing ring around each matched element, and
 * renders the hint card pinned to the first match.
 *
 * Click-blocking is *soft*: a partial-opacity dim covers the rest
 * of the screen via pointer-events: none so the player can still
 * interact with the board freely, but every other element reads as
 * "not the right thing right now." Strict click-gating would need
 * deeper hooks into MatchBoard's drag system; the visual emphasis +
 * step-only-advances-on-correct-action combo gets ~95% of the way
 * there without that surgery.
 */
function TutorialSpotlight({ step }: { step: TutorialStep }) {
  const [rects, setRects] = useState<DOMRect[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const root = rootRef.current?.parentElement?.parentElement;
      if (!root) {
        requestAnimationFrame(tick);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const found: DOMRect[] = [];
      for (const sel of step.spotlight) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // Translate viewport-rect to root-relative rect so absolute
        // positioning lines up regardless of where the phone shell
        // sits inside the page.
        found.push(new DOMRect(
          r.left - rootRect.left,
          r.top - rootRect.top,
          r.width,
          r.height,
        ));
      }
      setRects(found);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, [step]);

  const Icon = (() => {
    switch (step.icon) {
      case 'hand':   return Hand;
      case 'clock':  return Clock;
      case 'swords': return Swords;
      case 'wand':   return Wand2;
      case 'heart':  return HeartPulse;
      case 'bond':   return Link2;
      case 'trophy': return Trophy;
    }
  })();

  return (
    <div className="tu-overlay" ref={rootRef}>
      {/* Dimmer — sits behind the spotlight rings. pointer-events:none
          so the player can still tap underlying elements. */}
      <div className="tu-dim" />

      {/* Pulsing rings around each spotlighted element. */}
      {rects.map((r, i) => (
        <div
          key={i}
          className="tu-ring"
          style={{
            left: r.left - 6,
            top: r.top - 6,
            width: r.width + 12,
            height: r.height + 12,
          }}
        />
      ))}

      {/* Hint card — fixed near the top so it never overlaps the hand. */}
      <div className="tu-hint">
        <div className="tu-hint-eyebrow">
          <Icon size={12} strokeWidth={2.4} />
          <span>STEP {STEPS.indexOf(step) + 1} OF {STEPS.length} · {step.title}</span>
        </div>
        <div className="tu-hint-body">{step.text}</div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

function TutorialStyles() {
  return (
    <style>{`
      .tu-root { position: absolute; inset: 0; }

      /* Intro phase — full-screen rules page. MatchBoard does NOT
         mount until the player taps Begin. */
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
        padding: 26px 22px 22px;
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
        margin-bottom: 18px;
      }
      .tu-rule { display: flex; align-items: flex-start; gap: 12px; }
      .tu-rule-icon {
        flex-shrink: 0;
        width: 38px; height: 38px;
        border-radius: 12px;
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        display: grid; place-items: center;
        color: ${PALETTE.accent};
      }
      .tu-rule-h { font-size: 14px; font-weight: 800; letter-spacing: -0.01em; }
      .tu-rule-p { font-size: 12px; color: ${PALETTE.textMid}; line-height: 1.4; margin-top: 2px; }
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
      .tu-intro-foot {
        text-align: center;
        margin-top: 10px;
        font-size: 11px; color: ${PALETTE.textMid};
        font-style: italic;
      }

      /* Overlay layer — pointer-events: none on the wrapper so the
         board below stays interactive. The ring + hint divs are also
         pointer-events: none. */
      .tu-overlay {
        position: absolute; inset: 0;
        z-index: 380;
        pointer-events: none;
      }
      .tu-dim {
        position: absolute; inset: 0;
        background: rgba(28,24,20,0.42);
        pointer-events: none;
      }

      /* Pulsing ring around each spotlighted element. */
      .tu-ring {
        position: absolute;
        border-radius: 14px;
        border: 3px solid ${PALETTE.accent};
        box-shadow:
          0 0 0 4px rgba(238,90,82,.30),
          0 0 24px 4px rgba(238,90,82,.45),
          inset 0 0 0 2px rgba(255,255,255,.45);
        animation: tuRingPulse 1.4s ease-in-out infinite;
        pointer-events: none;
      }
      @keyframes tuRingPulse {
        0%, 100% { transform: scale(1);     box-shadow: 0 0 0 4px rgba(238,90,82,.30), 0 0 24px 4px rgba(238,90,82,.45), inset 0 0 0 2px rgba(255,255,255,.45); }
        50%      { transform: scale(1.04);  box-shadow: 0 0 0 8px rgba(238,90,82,.18), 0 0 40px 8px rgba(238,90,82,.55), inset 0 0 0 2px rgba(255,255,255,.55); }
      }

      /* Hint card — fixed near the top of the match. */
      .tu-hint {
        position: absolute;
        top: max(72px, env(safe-area-inset-top, 72px));
        left: 50%;
        transform: translateX(-50%);
        width: calc(100% - 28px);
        max-width: 340px;
        background: ${PALETTE.text};
        color: #fff;
        border-radius: 14px;
        padding: 10px 14px;
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        box-shadow: 0 10px 28px rgba(28,24,20,.30);
        animation: tuHintIn .35s cubic-bezier(.2,.85,.3,1);
        pointer-events: none;
        z-index: 1;
      }
      .tu-hint-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.14em;
        opacity: 0.75;
        margin-bottom: 4px;
      }
      .tu-hint-body {
        font-size: 13px; font-weight: 600;
        line-height: 1.35;
      }
      @keyframes tuHintIn {
        from { transform: translate(-50%, -8px); opacity: 0; }
        to   { transform: translate(-50%, 0); opacity: 1; }
      }
    `}</style>
  );
}
