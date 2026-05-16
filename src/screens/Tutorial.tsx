import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, Hand, Swords, Clock, Trophy, Wand2, HeartPulse, LinkIcon as Link2, BookOpen, ChevronRight, Heart, Flag, Layers, Skull } from 'lucide-react';
import { MatchBoard } from './MatchBoard';
import { Card } from '../components/Card';
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
 * Scripted tutorial deck — DETERMINISTIC, in draw order.
 *
 * The tutorial boss (`tutorial-dummy` in src/data/bosses.ts) sets
 * skipShuffle: true, so the engine deals both decks in their input
 * array order. That means every hint in this file can reference a
 * specific card guaranteed to be in the player's hand at the moment
 * the step is on screen — no "draw the right card" dance.
 *
 * Opening hand (STARTING_HAND = 4) is indices 0-3:
 *   0  Coffee Mug     (1c 1/2)            -> turn 1 summon
 *   1  Coffee Mug     (1c 1/2)            -> spare for later
 *   2  Breakfast Plate (2c 1/3, draw-on-play) -> turn 2 BOND piece
 *   3  Good Boy       (1c spell +0/+2)    -> buff demo
 *
 * Draws thereafter:
 *   4  Hug            (1c spell heal +3)  -> heal demo
 *   5  Snake Bite     (2c spell, 3 dmg)   -> damage demo
 *   6  Coffee Mug     (filler)
 *   7-11  more filler so the player can finish the match without
 *         running into fatigue.
 */
const TUTORIAL_DECK_IDS: string[] = [
  'fd-01',  // 0 — opening hand
  'fd-01',  // 1 — opening hand
  'fd-04',  // 2 — opening hand
  'ani-16', // 3 — opening hand
  'fam-14', // 4 — turn 2 draw
  'ani-02', // 5 — turn 3 draw (or pulled by Plate's draw-on-play)
  'fd-01',  // 6
  'fd-04',  // 7
  'ani-16', // 8
  'fam-14', // 9
  'ani-02', // 10
  'fd-01',  // 11
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
  icon: 'hand' | 'clock' | 'swords' | 'wand' | 'heart' | 'bond' | 'trophy' | 'book';
  text: string;
  spotlight: string[];
  advanceOn: 'card-played' | 'turn-end' | 'attack' | 'spell-cast' | 'auto' | 'tap' | null;
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
  /** When set, the step renders a card anatomy diagram instead of a
   *  board spotlight. The label set differs by card type so we can
   *  teach Creature (mana, atk, hp, type, ability) and Spell (mana,
   *  type, ability) separately. Advances on tap of the Got it CTA. */
  anatomy?: { cardId: string; kind: 'creature' | 'spell' | 'field' };
}

// End-turn step factory. After every teaching step the player must
// pass the turn before the next teaching step is offered — keeps
// the script paced one beat at a time and matches the engine's
// turn-by-turn rhythm.
const endTurnStep = (text: string): TutorialStep => ({
  title: 'END TURN',
  icon: 'clock',
  text,
  spotlight: ['[data-tut="end-turn"]', '[data-tut="go-battle"]'],
  advanceOn: 'turn-end',
});

const STEPS: TutorialStep[] = [
  {
    title: 'CARD · CREATURE',
    icon: 'book',
    text: "Creatures stay on the field and attack. Read every part: mana cost (top-left), attack and HP (bottom corners), type chip, ability line, and rarity. Tap Got it when ready.",
    spotlight: [],
    advanceOn: 'tap',
    anatomy: { cardId: 'fd-01', kind: 'creature' },
  },
  {
    title: 'CARD · SPELL',
    icon: 'book',
    text: "Spells aren't creatures — they fire once on a target, then disappear. They have a mana cost and an ability, no attack or HP. Cast them during your Main Phase, before you swing in Battle.",
    spotlight: [],
    advanceOn: 'tap',
    anatomy: { cardId: 'ani-16', kind: 'spell' },
  },
  {
    title: 'FIELD · LAYOUT',
    icon: 'book',
    text: "Quick tour of the match board so you know where everything sits. Tap any chip on the diagram to read what it does.",
    spotlight: [],
    advanceOn: 'tap',
    anatomy: { cardId: 'fd-01', kind: 'field' },
  },
  {
    title: 'MAIN PHASE · SUMMON',
    icon: 'hand',
    text: "Your turn opens in the Main Phase. Drag the Coffee Mug onto the field — it costs 1 mana (top of screen).",
    spotlight: ['[data-tut-hand-card="fd-01"]'],
    advanceOn: 'card-played',
    requireCardId: 'fd-01',
  },
  endTurnStep("Creatures sleep the turn they're summoned. Tap End Turn — Battle Phase and your opponent's turn will pass automatically."),

  {
    title: 'BOND PIECE',
    icon: 'bond',
    text: "New turn — you drew a card and gained +1 mana. Drag the Breakfast Plate onto the field. (Its own card text draws you a card on play — that's the card's ability, not the bond yet.)",
    spotlight: ['[data-tut-hand-card="fd-04"]'],
    advanceOn: 'card-played',
    requireCardId: 'fd-04',
  },
  {
    title: 'BOND ACTIVE',
    icon: 'bond',
    text: "Coffee Mug + Breakfast Plate together form Bond: Breakfast Combo. From now on, your creatures heal +2 HP at the start of every turn — extra effects when specific cards share the field.",
    spotlight: [],
    advanceOn: 'auto',
    autoMs: 3600,
  },
  endTurnStep("Tap End Turn so your creatures wake up next turn."),

  {
    title: 'BATTLE · CREATURE FIGHT',
    icon: 'swords',
    text: "Your Coffee Mug woke up — it can attack now. Drag it onto an opponent creature; both deal their attack to each other. Smaller creatures die.",
    spotlight: ['[data-tut-field-card="fd-01"][data-tut-side="player"]', '[data-tut-field-card][data-tut-side="opponent"]'],
    advanceOn: 'attack',
    requireAttackTarget: 'creature',
  },
  endTurnStep("Nice trade. End your turn."),

  {
    title: 'BATTLE · ATTACK FACE',
    icon: 'swords',
    text: "Creatures can also attack the opponent directly. Drag one of your creatures onto their portrait. That drains their HP — drop it to 0 to win.",
    spotlight: ['[data-tut-field-card][data-tut-side="player"]', '[data-tut="opp-face"]'],
    advanceOn: 'attack',
    requireAttackTarget: 'face',
  },
  endTurnStep("End turn."),

  {
    title: 'SPELL · BUFF',
    icon: 'wand',
    text: "Good Boy is a Buff spell — drag it onto one of your creatures for +0 attack / +2 HP, permanently.",
    spotlight: ['[data-tut-hand-card="ani-16"]'],
    advanceOn: 'spell-cast',
    requireCardId: 'ani-16',
  },
  endTurnStep("End turn."),

  {
    title: 'SPELL · DAMAGE',
    icon: 'wand',
    text: "Snake Bite is a Damage spell — drop 3 damage on any target. Use it to remove an opponent creature, or to finish their HP.",
    spotlight: ['[data-tut-hand-card="ani-02"]'],
    advanceOn: 'spell-cast',
    requireCardId: 'ani-02',
  },
  endTurnStep("End turn."),

  {
    title: 'SPELL · HEAL',
    icon: 'heart',
    text: "Hug is a Heal spell — drop +3 HP on a friendly creature that took damage.",
    spotlight: ['[data-tut-hand-card="fam-14"]'],
    advanceOn: 'spell-cast',
    requireCardId: 'fam-14',
  },
  endTurnStep("End turn — one more lap to seal it."),

  {
    title: 'FINISH',
    icon: 'trophy',
    text: "That's everything. Matches run 12 turns max — whoever lands the killing blow wins. Keep attacking until the opponent hits 0 HP.",
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
            <div className="tu-intro-lede">
              Drop the opponent's HP to 0 within 12 turns. You'll always go first in this tutorial.
            </div>
            <div className="tu-intro-rules">
              <div className="tu-rule">
                <div className="tu-rule-icon"><Clock size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Each turn has phases</div>
                  <div className="tu-rule-p">Draw a card &amp; gain +1 max mana → Main Phase (play creatures &amp; spells) → Battle Phase (attack) → End Turn.</div>
                </div>
              </div>
              <div className="tu-rule">
                <div className="tu-rule-icon"><Hand size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Summon creatures</div>
                  <div className="tu-rule-p">Drag a creature card to the field. Pay its mana cost. The creature sleeps the turn you summon it — wakes up and attacks from the next turn on.</div>
                </div>
              </div>
              <div className="tu-rule">
                <div className="tu-rule-icon"><Wand2 size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Cast spells</div>
                  <div className="tu-rule-p">Spells aren't creatures — drag them onto a target. They buff, damage, or heal, then they're gone.</div>
                </div>
              </div>
              <div className="tu-rule">
                <div className="tu-rule-icon"><Link2 size={18} strokeWidth={2.4} /></div>
                <div>
                  <div className="tu-rule-h">Card abilities &amp; bonds</div>
                  <div className="tu-rule-p">Read each card — some have on-play abilities. Specific pairs share Bonds: extra effects whenever both are on the field.</div>
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
  // MatchBoard is intentionally NOT mounted while an anatomy step is
  // showing — the player asked for the dealing animation to wait
  // until they've read through the card-anatomy lessons. The board
  // mounts the first time the script reaches a non-anatomy step.
  const inAnatomy = !!step.anatomy;
  return (
    <div className="tu-root">
      <TutorialStyles />
      {inAnatomy
        ? (
          <TutorialAnatomy
            step={step}
            onAdvance={() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))}
          />
        )
        : (
          <TutorialSpotlight step={step} key={`${attempt}-${stepIdx}`} />
        )
      }

      {!inAnatomy && (
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
        tutorialAllow={(action) => {
          // Strict step enforcement — every player input is gated
          // by the current step's advanceOn / requireCardId /
          // requireAttackTarget. The free-play FINISH step (advanceOn
          // === null) opens everything up so the player can close
          // the match without hand-holding.
          if (step.advanceOn === null) return true;
          if (action.kind === 'play-creature') {
            return step.advanceOn === 'card-played'
              && (!step.requireCardId || step.requireCardId === action.cardId);
          }
          if (action.kind === 'play-spell') {
            return step.advanceOn === 'spell-cast'
              && (!step.requireCardId || step.requireCardId === action.cardId);
          }
          if (action.kind === 'attack') {
            return step.advanceOn === 'attack'
              && (!step.requireAttackTarget || step.requireAttackTarget === action.target);
          }
          if (action.kind === 'end-turn') {
            return step.advanceOn === 'turn-end';
          }
          return true;
        }}
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
      )}
    </div>
  );
}

// ─── Anatomy overlay ────────────────────────────────────────────────

/**
 * Full-screen card anatomy diagram. Renders the sample card center-
 * screen with labelled callouts at the corners pointing at every
 * part the player needs to learn: mana cost, name, attack, HP, type
 * chip and ability text. Creature and Spell variants share the same
 * frame but show different labels (spells have no atk/hp).
 *
 * Lives behind the same dark dim as the spotlight overlay so it
 * reads as a "tutorial moment", not a separate screen. Bottom CTA
 * advances the script.
 */
function TutorialAnatomy({ step, onAdvance }: { step: TutorialStep; onAdvance: () => void }) {
  const kind = step.anatomy?.kind;
  return (
    <div className="tu-overlay">
      <div className="tu-dim" style={{ background: 'rgba(28,24,20,0.86)' }} />
      <div className="tu-anatomy">
        <div className="tu-anatomy-eyebrow">
          <BookOpen size={12} strokeWidth={2.4} />
          <span>STEP {STEPS.indexOf(step) + 1} / {STEPS.length} · {step.title}</span>
        </div>
        <div className="tu-anatomy-blurb">{step.text}</div>

        {kind === 'field'
          ? <FieldAnatomyDiagram />
          : <CardAnatomyDiagram step={step} />
        }

        <button className="tu-anatomy-cta" onClick={onAdvance}>
          <span>Got it</span>
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

/** Card anatomy — numbered chips overlaid on the card, paired with a
 *  legend below. Matches the field-anatomy pattern so the player
 *  learns one system that works for both diagrams. Creature gets 7
 *  callouts (Mana / Name / Type / Rarity / Ability / Attack / HP),
 *  Spell gets 5 (no atk/hp). */
function CardAnatomyDiagram({ step }: { step: TutorialStep }) {
  const tpl = step.anatomy ? getTemplateById(step.anatomy.cardId) : null;
  if (!tpl) return null;
  const card: CollectionCard = {
    ...tpl,
    uid: `tut_anatomy_${tpl.id}`,
    photo: aiPhoto(tpl.id),
    isPlaceholder: true,
  };
  const isCreature = step.anatomy?.kind === 'creature';
  type Row = { n: number; pos: string; title: string; body: string };
  const rows: Row[] = [
    { n: 1, pos: 'cost',    title: 'Mana cost',                              body: 'What you pay to play it' },
    { n: 2, pos: 'name',    title: 'Card name',                              body: 'And its art below' },
    { n: 3, pos: 'type',    title: isCreature ? 'Type · Creature' : 'Type · Spell',
                            body: isCreature ? 'Stays on the field, attacks each turn' : 'Fires before Battle, then is gone' },
    { n: 4, pos: 'rarity',  title: 'Rarity',                                 body: 'Common · Rare · Epic · Legendary — bumps in packs' },
    { n: 5, pos: 'ability', title: 'Ability',                                body: 'e.g. Rush · Taunt · Heal · Buff' },
  ];
  if (isCreature) {
    rows.push({ n: 6, pos: 'atk', title: 'Attack', body: 'Damage when it swings' });
    rows.push({ n: 7, pos: 'hp',  title: 'HP',     body: 'The creature dies at 0' });
  }
  return (
    <div className="tu-field-stage">
      {/* Card sits in a positioning anchor; numbered chips overlay at
          the section coordinates. Numbers are deliberately positioned
          just OUTSIDE the cost/atk/hp orbs (not on top of them) so
          they don't overlap the card's own numeric badges. */}
      <div className="tu-card-anchor">
        <Card card={card} scale={1.0} />
        {rows.map(r => (
          <span key={r.n} className="tu-card-num" data-pos={r.pos}>{r.n}</span>
        ))}
      </div>

      {/* Legend — same numbered-row layout as the field anatomy. */}
      <div className="tu-field-legend">
        {rows.map(r => (
          <div key={r.n} className="tu-field-legend-row">
            <span className="tu-field-num">{r.n}</span>
            <div><strong>{r.title}</strong><em>{r.body}</em></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Field anatomy — mocked match-board mini-diagram with callouts at
 *  the corners pointing at every region the player will see in a
 *  real match: turn counter, phases button, HP/mana, hand, deck,
 *  cemetery, give up, field zones. Doesn't mount MatchBoard — this
 *  is a static teaching diagram. */
function FieldAnatomyDiagram() {
  return (
    <div className="tu-field-stage">
      {/* Mock board mirrors the real match layout at a fixed small
          scale so the player gets a spatial sense. Each region is
          numbered (1-7); the legend below repeats those numbers
          with a one-line explanation. Replaces the earlier
          callout-around-the-mock approach where labels overlapped
          the board and clipped on narrow phones. */}
      <div className="tu-field-mock">
        {/* Opponent header — avatar circle + heart HP + mana orbs on
            the left, deck + cemetery icons on the right. Mirrors the
            actual MatchBoard top bar. */}
        <div className="tu-field-row">
          <span className="tu-field-num">1</span>
          <div className="tu-field-avatar" data-side="opp" />
          <div className="tu-field-hp"><Heart size={9} fill="#ef5a5a" color="#ef5a5a" strokeWidth={2} /> 6</div>
          <div className="tu-field-mana"><span data-on /></div>
          <div className="tu-field-spacer" />
          <span className="tu-field-num">2</span>
          <div className="tu-field-icon-btn"><Layers size={11} strokeWidth={2.2} /></div>
          <div className="tu-field-icon-btn"><Skull size={11} strokeWidth={2.2} /></div>
        </div>

        <div className="tu-field-zone">
          <span>SLOT</span><span>SLOT</span><span>SLOT</span>
        </div>

        {/* Divider — turn counter, give up, phase button. Matches the
            actual MatchBoard divider strip. */}
        <div className="tu-field-divider">
          <span className="tu-field-pill"><span className="tu-field-num">3</span> 1 / 12</span>
          <div className="tu-field-icon-btn"><Flag size={11} strokeWidth={2.2} /></div>
          <span className="tu-field-num">5</span>
          <div className="tu-field-spacer" />
          <span className="tu-field-num">4</span>
          <div className="tu-field-icon-btn tu-field-icon-btn-phase"><Swords size={11} strokeWidth={2.2} /></div>
        </div>

        <div className="tu-field-zone">
          <span>SLOT</span><span>SLOT</span><span>SLOT</span>
        </div>

        {/* Player header — same layout as opp, mirrored. */}
        <div className="tu-field-row">
          <span className="tu-field-num">6</span>
          <div className="tu-field-avatar" data-side="player" />
          <div className="tu-field-hp"><Heart size={9} fill="#ef5a5a" color="#ef5a5a" strokeWidth={2} /> 20</div>
          <div className="tu-field-mana"><span data-on /></div>
          <div className="tu-field-spacer" />
          <div className="tu-field-icon-btn"><Layers size={11} strokeWidth={2.2} /></div>
          <div className="tu-field-icon-btn"><Skull size={11} strokeWidth={2.2} /></div>
        </div>

        {/* Hand — three placeholder cards. */}
        <div className="tu-field-hand">
          <span className="tu-field-num tu-field-num-hand">7</span>
          <div className="tu-field-card" /><div className="tu-field-card" /><div className="tu-field-card" />
        </div>
      </div>

      {/* Legend — numbered rows pair with the small chips above. */}
      <div className="tu-field-legend">
        <div className="tu-field-legend-row">
          <span className="tu-field-num">1</span>
          <div><strong>Opponent</strong><em>Their HP and mana</em></div>
        </div>
        <div className="tu-field-legend-row">
          <span className="tu-field-num">2</span>
          <div><strong>Their deck · cemetery</strong><em>Tap to peek</em></div>
        </div>
        <div className="tu-field-legend-row">
          <span className="tu-field-num">3</span>
          <div><strong>Turn counter</strong><em>Match ends at turn 12</em></div>
        </div>
        <div className="tu-field-legend-row">
          <span className="tu-field-num">4</span>
          <div><strong>Phase button</strong><em>Main → Battle → End</em></div>
        </div>
        <div className="tu-field-legend-row">
          <span className="tu-field-num">5</span>
          <div><strong>Give up</strong><em>Concede the match</em></div>
        </div>
        <div className="tu-field-legend-row">
          <span className="tu-field-num">6</span>
          <div><strong>Your HP &amp; mana</strong><em>0 = you lose</em></div>
        </div>
        <div className="tu-field-legend-row">
          <span className="tu-field-num">7</span>
          <div><strong>Your hand</strong><em>Drag cards to summon or cast</em></div>
        </div>
      </div>
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
  // Hint card can be collapsed to a small chip so the player can see
  // the field clearly. Resets to expanded each time the step changes
  // (the new step deserves the full explanation; player can re-
  // collapse if they don't need it).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { setCollapsed(false); }, [step]);
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
      case 'book':   return BookOpen;
      default:       return Sparkles;
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

      {/* Hint card — collapsible so the player can see the field
          when the full hint would otherwise cover important cards.
          Tap anywhere on the card to toggle. Auto-resets to
          expanded each time the step changes. */}
      <button
        type="button"
        className="tu-hint"
        data-collapsed={collapsed}
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Show hint' : 'Hide hint'}
      >
        <div className="tu-hint-eyebrow">
          <Icon size={12} strokeWidth={2.4} />
          <span>STEP {STEPS.indexOf(step) + 1} / {STEPS.length} · {step.title}</span>
          <span className="tu-hint-toggle" aria-hidden="true">
            {collapsed ? '+' : '–'}
          </span>
        </div>
        {!collapsed && <div className="tu-hint-body">{step.text}</div>}
      </button>
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
        margin-bottom: 6px;
      }
      .tu-intro-lede {
        font-size: 13px;
        color: ${PALETTE.textMid};
        line-height: 1.45;
        margin-bottom: 14px;
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
         pointer-events: none.
         z-index is intentionally low (50) so MatchBoard modals — the
         opponent summon reveal, inspect preview, legendary summon —
         all sit ABOVE the spotlight ring. The ring is for board
         navigation, not for covering deliberate UI flashes; if
         the engine is showing the player something, that thing
         should win. */
      .tu-overlay {
        position: absolute; inset: 0;
        z-index: 50;
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

      /* Hint card — fixed near the top of the match. Tap to collapse
         so it stops covering the field; tap again to expand. */
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
        text-align: left;
        cursor: pointer;
        border: 0;
        z-index: 1;
        pointer-events: auto;
        transition: padding .15s, max-width .15s;
      }
      .tu-hint[data-collapsed="true"] {
        padding: 6px 12px;
        max-width: 280px;
      }
      .tu-hint-eyebrow {
        display: flex; align-items: center; gap: 6px;
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.14em;
        opacity: 0.75;
        margin-bottom: 4px;
      }
      .tu-hint[data-collapsed="true"] .tu-hint-eyebrow {
        margin-bottom: 0;
      }
      .tu-hint-eyebrow > span:nth-child(2) { flex: 1; min-width: 0; }
      .tu-hint-toggle {
        flex-shrink: 0;
        width: 18px; height: 18px;
        display: inline-grid; place-items: center;
        background: rgba(255,255,255,.16);
        border-radius: 50%;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0;
        opacity: 0.9;
      }
      .tu-hint-body {
        font-size: 13px; font-weight: 600;
        line-height: 1.35;
      }
      @keyframes tuHintIn {
        from { transform: translate(-50%, -8px); opacity: 0; }
        to   { transform: translate(-50%, 0); opacity: 1; }
      }

      /* Anatomy diagram — fills the overlay with a single labelled
         card. Labels float at the four corners with arrows pointing
         inward at the matching card region. */
      .tu-anatomy {
        position: absolute; inset: 0;
        z-index: 1;
        display: flex; flex-direction: column;
        align-items: center; justify-content: space-between;
        padding: max(20px, env(safe-area-inset-top, 20px)) 14px max(20px, env(safe-area-inset-bottom, 20px)) 14px;
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        color: #fff;
        pointer-events: auto;
      }
      .tu-anatomy-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.14em;
        opacity: 0.8;
      }
      .tu-anatomy-blurb {
        text-align: center;
        max-width: 320px;
        font-size: 13px;
        line-height: 1.4;
        margin: 6px auto 0;
        color: rgba(255,255,255,.88);
      }
      /* Card anatomy now uses the same numbered-chip pattern as the
         field anatomy below. The card sits centred with little coral
         numbered chips at the seven regions; the numbered legend
         below explains each one. */
      .tu-card-anchor {
        position: relative;
        display: inline-block;
        margin: 8px auto;
      }
      .tu-card-num {
        position: absolute;
        z-index: 4;
        width: 22px; height: 22px;
        border-radius: 50%;
        background: ${PALETTE.accent};
        color: #fff;
        border: 2px solid ${PALETTE.paper};
        display: grid; place-items: center;
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        font-weight: 800;
        font-size: 11px;
        box-shadow: 0 4px 10px rgba(28,24,20,.45);
      }
      /* Chip positions on the card. Tuned to sit just OUTSIDE the
         card's own numeric badges (cost orb top-left, atk/hp orbs
         bottom corners) so they don't visually collide with the
         numbers ALREADY on the card. */
      .tu-card-num[data-pos="cost"]    { top: -10px;  left: -10px; }
      .tu-card-num[data-pos="name"]    { top: -10px;  right: 38%; }
      .tu-card-num[data-pos="type"]    { top: 60%;    left: 18%; }
      .tu-card-num[data-pos="rarity"]  { top: 60%;    right: 4%; }
      .tu-card-num[data-pos="ability"] { top: 78%;    left: 4%; }
      .tu-card-num[data-pos="atk"]     { bottom: -10px; left: -10px; }
      .tu-card-num[data-pos="hp"]      { bottom: -10px; right: -10px; }

      /* Legacy stage container — left in for the field anatomy
         which still uses .tu-anatomy-stage / .tu-anatomy-cardbox. */
      .tu-anatomy-stage {
        position: relative;
        flex: 1;
        width: 100%;
        display: grid;
        place-items: center;
        margin: 8px 0;
        min-height: 0;
      }
      /* Card-sized wrapper. Labels are positioned absolutely within
         this box, so a label at top: 5% sits at the top of the CARD
         (not the stage). Negative left/right offsets push each label
         outside the card edge. */
      .tu-anatomy-cardbox {
        position: relative;
        width: 200px;
        aspect-ratio: 0.72;
      }
      .tu-anatomy-card {
        position: absolute; inset: 0;
        z-index: 2;
        display: grid; place-items: center;
        animation: tuPop .3s cubic-bezier(.2,.85,.3,1);
      }
      .tu-anatomy-label {
        position: absolute;
        display: flex; align-items: center; gap: 6px;
        background: rgba(255,255,255,.96);
        color: ${PALETTE.text};
        border-radius: 10px;
        padding: 6px 9px;
        font-size: 11px;
        box-shadow: 0 6px 14px rgba(28,24,20,.45);
        max-width: 130px;
        line-height: 1.2;
        z-index: 3;
      }
      .tu-anatomy-label strong {
        font-weight: 800;
        font-size: 11px;
        display: block;
        margin-bottom: 1px;
      }
      .tu-anatomy-label em {
        font-style: normal;
        color: ${PALETTE.textMid};
        font-size: 10px;
        line-height: 1.2;
      }
      .tu-anatomy-arrow {
        font-weight: 800;
        font-size: 14px;
        color: ${PALETTE.accent};
        line-height: 1;
        flex-shrink: 0;
      }
      /* Label positions — % is now relative to the cardbox (which is
         sized to the card itself), so percentages line up with the
         real card sections. Negative offsets push the labels outside
         the card's edges. Each label vertically aligns with its
         target so the triangle tail (::after) extends straight
         toward the named section. */
      .tu-anatomy-label[data-pos="cost"]    { top:   5%;  left:   -110px; transform: translateY(-50%); }
      .tu-anatomy-label[data-pos="type"]    { top:  64%;  left:   -120px; transform: translateY(-50%); }
      .tu-anatomy-label[data-pos="rarity"]  { top:  64%;  right:  -120px; transform: translateY(-50%); }
      .tu-anatomy-label[data-pos="ability"] { top:  75%;  left:    50%;   transform: translate(-50%, 115%); }
      .tu-anatomy-label[data-pos="atk"]     { bottom: 5%; left:   -110px; transform: translateY(50%); }
      .tu-anatomy-label[data-pos="hp"]      { bottom: 5%; right:  -110px; transform: translateY(50%); }

      /* Triangle tail extending from each label edge toward the
         card region it names. Direction matches the label's
         position. */
      .tu-anatomy-label::after {
        content: "";
        position: absolute;
        width: 0; height: 0;
        pointer-events: none;
      }
      /* Left-side labels (cost, type, atk) — tail on the right edge
         pointing right toward the card. */
      .tu-anatomy-label[data-pos="cost"]::after,
      .tu-anatomy-label[data-pos="type"]::after,
      .tu-anatomy-label[data-pos="atk"]::after {
        right: -8px;
        top: 50%;
        transform: translateY(-50%);
        border-style: solid;
        border-width: 6px 0 6px 8px;
        border-color: transparent transparent transparent rgba(255,255,255,.96);
      }
      /* Right-side labels (rarity, hp) — tail on the left edge
         pointing left toward the card. */
      .tu-anatomy-label[data-pos="rarity"]::after,
      .tu-anatomy-label[data-pos="hp"]::after {
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        border-style: solid;
        border-width: 6px 8px 6px 0;
        border-color: transparent rgba(255,255,255,.96) transparent transparent;
      }
      /* Below-card label (ability) — tail on the top edge pointing
         up toward the ability text on the card. */
      .tu-anatomy-label[data-pos="ability"]::after {
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        border-style: solid;
        border-width: 0 6px 8px 6px;
        border-color: transparent transparent rgba(255,255,255,.96) transparent;
      }
      /* Narrow phones — tighten label offsets so the diagram still
         fits in the viewport. The card itself shrinks too. */
      @media (max-width: 420px) {
        .tu-anatomy-cardbox { width: 168px; }
        .tu-anatomy-label { max-width: 96px; font-size: 10px; padding: 5px 7px; }
        .tu-anatomy-label strong { font-size: 10px; }
        .tu-anatomy-label em { font-size: 9px; }
        .tu-anatomy-label[data-pos="cost"]    { left:  -88px; }
        .tu-anatomy-label[data-pos="name"]    { right: -88px; }
        .tu-anatomy-label[data-pos="type"]    { left:  -96px; }
        .tu-anatomy-label[data-pos="rarity"]  { right: -96px; }
        .tu-anatomy-label[data-pos="atk"]     { left:  -88px; }
        .tu-anatomy-label[data-pos="hp"]      { right: -88px; }
      }
      /* Field anatomy — mock board on top, numbered legend below.
         Replaced the corner-callouts version which collided with the
         mock at phone widths; this layout is two clean rows that
         scale well on any viewport. */
      .tu-field-stage {
        flex: 1;
        width: 100%;
        max-width: 380px;
        margin: 8px auto;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
        align-items: center;
        padding: 0 4px;
      }
      .tu-field-mock {
        width: 100%;
        max-width: 280px;
        background: rgba(255, 240, 220, 0.94);
        border: 1.5px solid rgba(255,255,255,.2);
        border-radius: 14px;
        padding: 10px 10px;
        display: flex; flex-direction: column;
        gap: 6px;
        box-shadow: 0 10px 24px rgba(28,24,20,.35);
        color: ${PALETTE.text};
        font-size: 10px; font-weight: 700;
        flex-shrink: 0;
      }
      .tu-field-row {
        display: flex; align-items: center;
        gap: 4px;
        flex-wrap: nowrap;
      }
      .tu-field-spacer { flex: 1; }
      .tu-field-avatar {
        width: 16px; height: 16px;
        border-radius: 50%;
        background: linear-gradient(160deg, #5a3a2a, #3a2418);
        border: 1.5px solid ${PALETTE.paper};
        flex-shrink: 0;
      }
      .tu-field-avatar[data-side="opp"] {
        background: linear-gradient(160deg, ${PALETTE.accent}, ${PALETTE.accentDeep});
      }
      .tu-field-hp {
        background: ${PALETTE.bg};
        border: 1px solid ${PALETTE.border};
        border-radius: 999px;
        padding: 2px 6px;
        font-size: 9px;
        font-weight: 800;
        display: inline-flex; align-items: center; gap: 3px;
        white-space: nowrap;
      }
      .tu-field-mana {
        display: inline-flex; gap: 2px; align-items: center;
      }
      .tu-field-mana > span {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: ${PALETTE.border};
      }
      .tu-field-mana > span[data-on] {
        background: linear-gradient(160deg, #5fa9ff, #2a73d5);
        box-shadow: 0 0 4px rgba(95,169,255,.6);
      }
      .tu-field-icon-btn {
        width: 18px; height: 18px;
        border-radius: 6px;
        background: ${PALETTE.bg};
        border: 1px solid ${PALETTE.border};
        display: grid; place-items: center;
        color: ${PALETTE.text};
        flex-shrink: 0;
      }
      .tu-field-icon-btn-phase {
        background: ${PALETTE.text};
        color: #fff;
        border-color: ${PALETTE.text};
      }
      .tu-field-chip {
        background: ${PALETTE.bg};
        border: 1px solid ${PALETTE.border};
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 9px;
        white-space: nowrap;
        display: inline-flex; align-items: center; gap: 4px;
      }
      .tu-field-side-icons {
        display: flex; gap: 4px;
        font-size: 13px;
        align-items: center;
      }
      .tu-field-zone {
        display: flex; gap: 4px; justify-content: center;
      }
      .tu-field-zone > span {
        flex: 1;
        height: 28px;
        background: rgba(255,255,255,.55);
        border: 1px dashed ${PALETTE.border};
        border-radius: 4px;
        display: grid; place-items: center;
        font-size: 8px;
        color: ${PALETTE.textMid};
        letter-spacing: 0.1em;
      }
      .tu-field-divider {
        display: flex; gap: 6px; justify-content: center; align-items: center;
        padding: 4px 0;
        border-top: 1px dashed ${PALETTE.border};
        border-bottom: 1px dashed ${PALETTE.border};
      }
      .tu-field-pill {
        background: ${PALETTE.paper};
        border: 1px solid ${PALETTE.border};
        border-radius: 999px;
        padding: 2px 6px;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.04em;
        display: inline-flex; align-items: center; gap: 4px;
      }
      .tu-field-hand {
        display: flex; gap: 4px; justify-content: center; align-items: center;
        margin-top: 4px;
      }
      .tu-field-card {
        width: 26px; height: 36px;
        background: linear-gradient(180deg, #6b9a91, #2f5a52);
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,.30);
      }
      /* Numbered chip — coral badge anchored on each labelled region
         and repeated in the legend below. Gives the player a single
         number to mentally pair the spot on the mock with its
         explanation. */
      .tu-field-num {
        display: inline-grid; place-items: center;
        width: 16px; height: 16px;
        border-radius: 50%;
        background: ${PALETTE.accent};
        color: #fff;
        font-size: 9px; font-weight: 800;
        flex-shrink: 0;
      }
      .tu-field-num-hand { margin-right: 4px; }

      /* Numbered legend rows. */
      .tu-field-legend {
        width: 100%;
        max-width: 320px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 10px;
        align-content: start;
      }
      .tu-field-legend-row {
        display: flex; align-items: center; gap: 8px;
        background: rgba(255,255,255,.94);
        color: ${PALETTE.text};
        border-radius: 8px;
        padding: 5px 8px;
        font-size: 10px;
        line-height: 1.2;
      }
      .tu-field-legend-row strong {
        font-weight: 800;
        font-size: 10px;
        display: block;
      }
      .tu-field-legend-row em {
        font-style: normal;
        color: ${PALETTE.textMid};
        font-size: 9px;
      }
      @media (max-width: 420px) {
        .tu-field-legend { grid-template-columns: 1fr; }
      }

      .tu-anatomy-cta {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 12px 22px;
        background: linear-gradient(180deg, #ffa07a 0%, ${PALETTE.accent} 60%, ${PALETTE.accentDeep} 100%);
        color: #fff;
        border: 0;
        border-radius: 999px;
        font-family: inherit;
        font-size: 14px; font-weight: 800;
        letter-spacing: 0.04em;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(238,90,82,.32);
      }
    `}</style>
  );
}
