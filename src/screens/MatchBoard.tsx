import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Heart, Coins, Skull, Snowflake, Moon, Target, ShieldHalf, Zap, Ban, Link2, ScrollText, Swords, ChevronsRight, Layers, Hand } from 'lucide-react';
import type { BondDef } from '../data/bonds';
import { Card } from '../components/Card';
import { BattlefieldCard } from '../components/BattlefieldCard';
import { CardBack } from '../components/CardBack';
import { CoinFlip } from '../components/CoinFlip';
import { GraveyardModal } from '../components/GraveyardModal';
import { iconBtn, btnPrimary, PALETTE } from '../components/styles';
import { aiStep, type AiCombat } from '../game/ai';
import {
  attack, createMatch, endTurn, playCard, TURN_LIMIT, STARTING_HAND, STARTING_HP,
  effectiveCost, activeBonds, difficultyProfile,
  type SpellTarget,
} from '../game/match';
import { MATCH_WIN_REWARD, MATCH_LOSS_REWARD, MATCH_DRAW_REWARD } from '../game/pack';
import { ELEMENTS } from '../data/elements';
import { BONDS } from '../data/bonds';
import { TEMPLATES } from '../data/templates';
import type { BossDef } from '../data/bosses';
import type { BattleCard, CollectionCard, MatchState, Owner, PlayerState, Difficulty } from '../game/types';
import { playSfx } from '../audio/sfx';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';
import { useCosmetics } from '../state/cosmeticsContext';
import { CosmeticsProvider } from '../state/cosmetics';
import { getBoardSkin } from '../data/boardSkins';
import { getEmote } from '../data/victoryEmotes';

interface Props {
  deck: CollectionCard[];
  boss: BossDef;
  /** Difficulty tier the player chose on the boss picker. Drives the
   *  boss's starting HP / hand / mana inside createMatch. Defaults to
   *  Normal so existing callsites without an explicit pick still work. */
  difficulty?: Difficulty;
  /** Optional uploaded player photo (data URL). When set, the player
      portrait shows this image; otherwise it falls back to the "Y" letter. */
  playerAvatar?: string;
  /** Audio preferences. SFX volume gates every cue. */
  settings?: Settings;
  /** Called when a bond first activates this match. Used to mark it as
   *  "discovered" in the player's save. */
  onBondDiscovered?: (bondId: string) => void;
  /** Called once per player creature successfully summoned. Quest tracker. */
  onCreaturePlayed?: () => void;
  /** Called once per new bond that activates on the player's side. Quest tracker.
   *  Distinct from `onBondDiscovered` (which only fires for first-ever bonds). */
  onBondTriggered?: () => void;
  /** True when the player has already defeated this boss before, so the
   *  match-end screen knows not to advertise the first-time bonus. App
   *  computes this from `save.bossesDefeated`. */
  alreadyBeaten?: boolean;
  onExit: (outcome: 'win' | 'loss' | 'draw' | 'quit') => void;
}

/**
 * Drag state for the hand → field interaction. Framer Motion owns the
 * visual position of the dragged card (via motion.div transforms), so we
 * only track what the drop logic needs: which card is being dragged, its
 * type (creature vs spell — gates drop targeting), and whether it's
 * currently hovering over the field / a specific slot for highlighting.
 */
interface DragState {
  battleId: string;
  cardType: 'Creature' | 'Spell';
  overField: boolean;
  /** Specific field slot (0-2) the drag is hovering over, or null. */
  overSlot: number | null;
}

interface CombatFx {
  attackerId: string;
  attackerOwner: Owner;
  defenderId: string | 'face';
  defenderOwner: Owner;
  damageToDef: number;
  damageToAtk: number;
}

type DamageMap = Record<string, number>;
const FACE_PLAYER = '__face_player__';
const FACE_OPP = '__face_opp__';
/** Synthetic ids used in the cardEls + rect maps so the death-fly
 *  animation can resolve "where is the graveyard?" per side without
 *  needing extra ref plumbing. */
const GRAVE_PLAYER = '__grave_player__';
const GRAVE_OPP = '__grave_opp__';

export function MatchBoard({ deck, boss, difficulty = 'normal', playerAvatar, settings = DEFAULT_SETTINGS, onBondDiscovered, onCreaturePlayed, onBondTriggered, alreadyBeaten = false, onExit }: Props) {
  // Stash settings in a ref so SFX closures see fresh values without
  // re-creating effects every render.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** Fire an SFX cue at the user's chosen volume — no-op if muted. */
  const sfx = (cue: Parameters<typeof playSfx>[0]) => playSfx(cue, settingsRef.current.sfxVolume);
  /** Cosmetic state — board skin paints the bedrock background, victory
   *  emote shows on the match-end overlay. Card frame is read by the
   *  Card component directly via the same context. */
  const cosmetics = useCosmetics();
  const boardSkin = getBoardSkin(cosmetics.boardSkin);
  const victoryEmote = getEmote(cosmetics.emote);
  const [state, setState] = useState<MatchState>(() => createMatch(deck, boss, difficulty));
  const [drag, setDrag] = useState<DragState | null>(null);
  /** Index of the hand card currently selected for preview/play (click-to-select). */
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null);
  const [selectedAttacker, setSelectedAttacker] = useState<string | null>(null);
  const [pendingSpell, setPendingSpell] = useState<BattleCard | null>(null);
  const [combat, setCombat] = useState<CombatFx | null>(null);
  const [damages, setDamages] = useState<DamageMap>({});
  /** Battle ids of creatures whose slice/death animation is currently playing. */
  const [dyingIds, setDyingIds] = useState<string[]>([]);
  /** Creatures that have just died and are mid-flight to the graveyard.
   *  Keyed by battleId so each dying card stays pinned to its FieldRow
   *  slot while the flyToGrave keyframe runs on the live BattlefieldCard
   *  itself — no overlay ghost, no vanish-then-appear gap. The slot
   *  stays reserved (slotMap retains the entry) for the duration of the
   *  animation, then the entry expires and the slot opens up.
   *
   *  gx / gy are the (board-local) translate offsets from the card's
   *  death slot to the side's graveyard icon, captured at the moment
   *  the death is detected. delayMs staggers multi-deaths so they land
   *  as a clean 1-2-3 sequence instead of overlapping. */
  const [dying, setDying] = useState<Record<string, {
    card: BattleCard;
    side: Owner;
    /** Slot index (0..2) the creature occupied at the moment of death,
     *  captured BEFORE the slot reconcile drops the entry. FieldRow
     *  reads this directly so the dying card stays pinned even if
     *  slotMap no longer has it. */
    slot: number;
    gx: number;
    gy: number;
    delayMs: number;
  }>>({});
  /** Bumps every time a death-ghost is scheduled to arrive at a given
   *  graveyard. The GraveyardButton listens via key to replay the
   *  receive-pulse keyframe. Separate keys per side so player + boss
   *  pulses don't clobber each other. */
  const [gravePulseKey, setGravePulseKey] = useState<{ player: number; opponent: number }>({ player: 0, opponent: 0 });
  /** Stable slot assignments for the field rows. The engine's
   *  `state.field` array is the source of truth for who's alive, but
   *  when a creature dies the array shrinks and the survivors used to
   *  reflow toward center. These maps lock each battleId to a fixed
   *  slot (0..2) so a creature stays in place even when its neighbour
   *  dies — same way Yu-Gi-Oh / Hearthstone keep board positions
   *  stable. Empty slots stay empty until a new creature fills them. */
  const [playerSlots, setPlayerSlots] = useState<Record<string, number>>({});
  const [opponentSlots, setOpponentSlots] = useState<Record<string, number>>({});
  const [inspect, setInspect] = useState<BattleCard | null>(null);
  /** Card that the AI just played, shown as a centered reveal so the player sees it. */
  const [opponentReveal, setOpponentReveal] = useState<BattleCard | null>(null);
  /** Legendary-summon cinematic. Whenever a creature of rarity `legendary`
   *  hits the field on either side, we briefly darken the screen, render
   *  a halo behind the card at full size, and shake the board. Auto-clears
   *  ~1400ms later. Plays in addition to the standard summonHalo + cardSlam
   *  so non-legendary summons still get their normal beat. */
  const [legendarySummon, setLegendarySummon] = useState<{
    card: BattleCard; owner: Owner;
  } | null>(null);
  /** Spell the player just cast, shown as a centered reveal — same beat as opponentReveal. */
  const [playerSpellReveal, setPlayerSpellReveal] = useState<BattleCard | null>(null);
  /** Sliding "YOUR TURN" / "BOSS TURN" banner — drives the keyframe on turn change. */
  const [turnBanner, setTurnBanner] = useState<Owner | null>(null);
  /** Bond ids that newly activated on each side this tick, used to animate
   *  the persistent BondPillStack chips into view (a brief scale-and-glow)
   *  instead of having a separate flying toast. One indicator per fact. */
  const [newPlayerBonds, setNewPlayerBonds] = useState<string[]>([]);
  const [newOppBonds, setNewOppBonds] = useState<string[]>([]);
  /** Brief cinematic when a bond first activates: the two bonded creatures
   *  appear side-by-side at center stage with a glowing link icon, the
   *  bond name above, then fade out. Auto-clears ~1.5s later. Only one at
   *  a time — if multiple bonds fire same tick, the second waits its turn. */
  const [bondCinematic, setBondCinematic] = useState<{
    bond: BondDef; cardA: BattleCard; cardB: BattleCard; side: Owner;
  } | null>(null);
  /** Brief banner that lands when a bond's per-turn EFFECT activates
   *  (Sunday Dinner heals, Breakfast Combo refills creatures, The Long
   *  Way pings the boss, etc.). Distinct from `bondCinematic` (which
   *  fires only the first time the bond LINKS UP) — this one repeats
   *  every turn the effect actually triggers, so the player can see
   *  *why* the heal/damage popup that follows is happening. Single-slot
   *  so multiple bonds fire sequentially through the queue. */
  const [bondFire, setBondFire] = useState<{ bond: BondDef; side: Owner; key: number } | null>(null);
  /** Per-creature ability activation toast. Renders the source card
   *  itself with a one-line explanation of what just fired so the
   *  player can see WHO healed / leveled / graduated — not just a
   *  green popup with no source. Used for:
   *    - level_up & graduate ticks at end of owner turn
   *    - graduate transformation (the +2/+2 + Untargetable moment)
   *    - heal_each_turn at start of owner turn
   *  Sequenced through the same pipeDelay queue as everything else
   *  so animations remain strictly one-at-a-time. */
  const [effectToast, setEffectToast] = useState<{
    card: BattleCard; text: string; side: Owner; key: number;
  } | null>(null);
  /** Phase indicator banners — "END PHASE" / "DRAW PHASE" — that pop
   *  briefly between sections of the turn-flip animation pipeline so
   *  the player can tell "this is my end-of-turn stuff" vs "this is
   *  the boss's start-of-turn stuff." Queued via pipeDelay same as
   *  everything else. Gated on whether that phase actually has any
   *  activity (no point announcing END PHASE if no creature
   *  triggered an end-of-turn ability). */
  const [phaseBanner, setPhaseBanner] = useState<{ text: string; side: Owner; key: number } | null>(null);
  /** Explicit MTG-style player phase. Each player's turn cycles:
   *    Draw Phase (auto, on turn start)
   *    Main Phase  — player plays cards, casts spells. Attacks blocked.
   *    Battle Phase — player attacks. Card plays blocked.
   *    End Phase   — auto, fires end-of-turn hooks then flips to opp.
   *  Player explicitly clicks "Go to Battle" to leave Main, then "End
   *  Turn" to leave Battle. The boss runs the same cycle internally;
   *  banners + AI delays present it as a sequence even though the
   *  engine just calls aiStep iteratively. */
  const [playerPhase, setPlayerPhase] = useState<'main' | 'battle'>('main');
  /** Which graveyard pile (if any) is open in the modal. */
  const [graveyardOpen, setGraveyardOpen] = useState<Owner | null>(null);
  /** Whether the action-log history panel is open. */
  const [logOpen, setLogOpen] = useState(false);
  /** Which side's info panel popover is currently open (hand/deck/grave counts
   *  + quick-link to the action log). Null when neither is open. */
  const [infoSide, setInfoSide] = useState<Owner | null>(null);
  /** Pre-match coin flip is animating. While true, the AI driver is paused
      and the player can't interact — keeps the opening uniform either way. */
  const [flipping, setFlipping] = useState(true);
  /** During the initial deal, hands fly in one card at a time so the start
      of the match feels like a real card-game opening. UI hides cards in
      both hands beyond these counts until the deal finishes. */
  const [playerInitialDealt, setPlayerInitialDealt] = useState(0);

  const [initialDealing, setInitialDealing] = useState(true);
  /** Give-up confirmation modal. We never quit on the first tap — too easy
      to lose 20 minutes of progress to a misclick. */
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  /** Spell-target burst — coordinates are within the boardRef. Cleared after
      the keyframe finishes. The kind drives the burst color. */
  const [spellFx, setSpellFx] = useState<
    { x: number; y: number; kind: 'damage' | 'freeze' | 'buff' | 'silence' | 'face' } | null
  >(null);
  /** Active card-back flights from deck → hand. Array-based so multiple
   *  draws on the same side can be airborne at the same time — a
   *  draw-on-play of 2 (Suitcase) shows two distinct card-backs trailing
   *  each other, the same way the opening deal feels. Each entry
   *  auto-removes after the flight animation completes. */
  const [drawFlights, setDrawFlights] = useState<{ id: number; side: Owner }[]>([]);
  /** Timestamp (ms via Date.now()) at which the currently-queued
   *  animations finish. Used as a serializer: the AI driver waits until
   *  Date.now() >= this value before taking its next action, so a
   *  death-fly + draw-flight + damage-popup chain finishes BEFORE the
   *  boss summons its next card. Updated by `holdAnim(ms)` from
   *  anywhere that schedules a visual. */
  const animBusyUntilRef = useRef<number>(0);
  const holdAnim = (ms: number) => {
    const target = Date.now() + ms;
    if (target > animBusyUntilRef.current) animBusyUntilRef.current = target;
  };
  /** Bumps any time a hold is extended, so the AI driver re-runs and
   *  re-schedules its tick against the latest deadline. */
  const [animTick, setAnimTick] = useState(0);

  /** Trigger the legendary-summon cinematic if the just-played card is
   *  legendary. Holds the animation pipeline for ~1400ms so subsequent
   *  AI actions don't tick over it; sfx 'summon' is already fired by
   *  the caller so this only adds the visual layer. */
  const LEGENDARY_FX_MS = 1400;
  const fireLegendarySummon = (card: BattleCard, owner: Owner) => {
    if (card.rarity !== 'legendary' || card.type !== 'Creature') return;
    setLegendarySummon({ card, owner });
    holdAnim(LEGENDARY_FX_MS);
    setTimeout(() => setLegendarySummon(s => (s && s.card.battleId === card.battleId ? null : s)), LEGENDARY_FX_MS);
  };
  const drawIdRef = useRef(0);
  /** Fire a single card-back flight for `side` after `delay` ms. The
   *  flight ID is unique per call so React keys the animation
   *  independently and we never overwrite a flight in progress. */
  const fireDraw = (side: Owner, delay: number) => {
    setTimeout(() => {
      drawIdRef.current += 1;
      const id = drawIdRef.current;
      setDrawFlights(f => [...f, { id, side }]);
      // Match the keyframe duration (1.1s) plus a tiny tail.
      setTimeout(() => setDrawFlights(f => f.filter(x => x.id !== id)), 1200);
    }, delay);
  };
  /** Player card battleIds whose draw-flight animation is still airborne.
   *  Cards in this set are hidden from the fan until the flight lands so
   *  the reveal happens after the animation, not before it. */
  const [pendingDrawIds, setPendingDrawIds] = useState<Set<string>>(new Set());
  /** Bumps every time the active player's mana ramps so the chip can pulse. */
  const [manaPulse, setManaPulse] = useState(0);
  /** Per-creature buff popup: shows "+atk/+hp" in green over the creature
      slot when a spell_buff resolves on it. Cleared after the keyframe. */
  const [buffs, setBuffs] = useState<Record<string, { atk: number; hp: number }>>({});
  /** Per-creature silence flash trigger — bumping the entry replays the
      gray flash + "SILENCED" text on that creature. */
  const [silencedAt, setSilencedAt] = useState<Record<string, number>>({});
  /** Legacy per-creature on-play trigger labels. Kept as a read-only
      state so the BattlefieldCard `trigger` prop still wires up — but
      we no longer populate it. Real effects (damage popups, card-back
      flights) carry the message instead. */
  const [triggers] = useState<Record<string, string>>({});
  /** Active fatigue popup — a skull-themed callout when a side took damage
      from drawing an empty deck. Carries the side and the damage amount. */
  const [fatigueFx, setFatigueFx] = useState<{ side: Owner; dmg: number; tick: number } | null>(null);
  /** True while a tapped-Summon is mid-flight to the field. The preview
      replays a deploy keyframe and we delay the actual play so the card
      visibly travels from the preview position into the field slot. */
  const [deploying, setDeploying] = useState(false);
  const [msg, setMsg] = useState<string>('Your turn');
  const fieldRef = useRef<HTMLDivElement | null>(null);
  /** Player creature row — also a valid drop target so the player can drag a
      card straight onto the field instead of having to aim at the divider. */
  const playerFieldRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const oppHeaderRef = useRef<HTMLDivElement | null>(null);
  const bondPillEls = useRef<Map<string, HTMLDivElement>>(new Map());
  /** DOM nodes of every creature on the field + the two faces, keyed by battleId
      (or FACE_PLAYER / FACE_OPP). Used to draw the attack arrow during combat. */
  const cardEls = useRef<Map<string, HTMLElement>>(new Map());
  /** Last-known board-local rect for every creature, refreshed on every
   *  render via a useLayoutEffect. */
  const lastRectsRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  /** PREVIOUS render's rects, preserved so we can look up the slot a
   *  creature was in when it died. By the time the diff useEffect runs,
   *  the creature's DOM node has already unmounted and `lastRectsRef`
   *  no longer has its rect — so we keep a one-render-old copy here. */
  const prevRectsRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  const registerEl = (id: string, el: HTMLElement | null) => {
    if (el) cardEls.current.set(id, el);
    else cardEls.current.delete(id);
  };
  const [arrow, setArrow] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Maintain stable slot positions. Every time a side's field changes,
  // (a) drop entries for battleIds no longer present, (b) assign any new
  // battleId to the lowest currently-free slot. This makes a death at
  // slot 1 leave slot 1 empty rather than reflowing slots 2/0 to fill
  // it — surviving creatures stay where the player summoned them.
  useEffect(() => {
    const reconcile = (
      cur: Record<string, number>,
      field: BattleCard[],
      side: Owner,
      maxSlots = 3,
    ): Record<string, number> => {
      const next: Record<string, number> = {};
      const used = new Set<number>();
      // Keep entries whose battleId is still on the field.
      for (const c of field) {
        if (cur[c.battleId] != null) {
          next[c.battleId] = cur[c.battleId];
          used.add(cur[c.battleId]);
        }
      }
      // Block slots currently occupied by creatures mid-flight to the
      // graveyard. Their stored `slot` is authoritative — even if the
      // previous reconcile dropped the slotMap entry, the dying card is
      // still rendered there by FieldRow, so no freshly-summoned
      // creature can claim that slot until the flight finishes.
      for (const id of Object.keys(dying)) {
        if (dying[id].side !== side) continue;
        used.add(dying[id].slot);
      }
      // Assign new battleIds center-first so a lone creature always
      // appears in the middle slot rather than the leftmost.
      const slotOrder = [1, 0, 2].slice(0, maxSlots);
      for (const c of field) {
        if (next[c.battleId] != null) continue;
        for (const i of slotOrder) {
          if (!used.has(i)) {
            next[c.battleId] = i;
            used.add(i);
            break;
          }
        }
      }
      return next;
    };
    setPlayerSlots(s => reconcile(s, state.player.field, 'player'));
    setOpponentSlots(s => reconcile(s, state.opponent.field, 'opponent'));
  }, [state.player.field, state.opponent.field, dying]);

  // ============== AI driver ==============
  useEffect(() => {
    if (flipping) return; // wait until the opening coin flip finishes
    if (initialDealing) return; // wait for the opening deal animation
    if (state.outcome !== 'ongoing') return;
    if (state.turn !== 'opponent') return;
    // Pause for the bond cinematic so it doesn't overlap with the next
    // AI action. Cleared after ~3.4s; the bondCinematic dep retriggers
    // this effect, which then schedules the next tick.
    if (bondCinematic) return;

    let cancelled = false;
    let busyTimer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (cancelled) return;
      // Serializer: hold the AI's next action until the visual pipeline
      // (damage popups, death flights, draws, ability toasts, bond
      // toasts) finishes. We re-check at TICK time — not at useEffect
      // time — because the sibling state-diff useEffect runs after
      // this one in declaration order. Checking inside tick (which is
      // deferred via setTimeout) guarantees state-diff has updated
      // animBusyUntilRef with whatever it queued. Without that, the AI
      // would race the toast queue and start its next attack on top of
      // a still-playing level_up / heal toast.
      const now = Date.now();
      if (now < animBusyUntilRef.current) {
        const wait = animBusyUntilRef.current - now + 30;
        busyTimer = setTimeout(tick, wait);
        return;
      }
      const step = aiStep(state);
      if (step) {
        // ai.ts uses a generic "The Boss" prefix in its log strings; we
        // substitute the actual boss name at display time so the message
        // reads "Mom summons Dad" / "The Drifter casts Layover" / etc.
        // Only the leading "The Boss" gets swapped — the wrk-12 card is
        // also named "The Boss" and shouldn't be renamed mid-string.
        showMsg(step.action.replace(/^The Boss\b /, ''));
        if (step.combat) {
          playAttackAnimation(step.combat, () => { if (!cancelled) setState(step.next); });
        } else if (step.played) {
          // Show the played card front-and-center so the player can see what
          // was just played — especially important for spells, which would
          // otherwise resolve invisibly. Spells get a longer hold than
          // creatures so the player has time to actually read the ability.
          setOpponentReveal(step.played);
          sfx(step.played.type === 'Spell' ? 'cardPlay' : 'summon');
          // Hold the centered card-reveal longer when it's about to do
          // something on the board (spell, draw, AOE) so the player has
          // time to read the card BEFORE the actual effect fires after
          // state advance. Plain bodies get the short hold.
          const isImpactful =
            step.played.type === 'Spell' ||
            step.played.abilityKind === 'aoe_on_play' ||
            step.played.abilityKind === 'draw_on_play';
          // Match-pacing pass — original holds (2700/2300/1900ms) made every
          // boss play feel sluggish. The card is still readable at these
          // shorter durations while keeping turns under ~5s on average,
          // which puts a full match in the 3-min sweet spot.
          const holdMs = step.played.type === 'Spell' ? 2000
            : isImpactful ? 1500
            : 1200;
          // Reserve the busy clock for the full reveal hold so the
          // AI driver doesn't tick another action mid-reveal. The
          // post-reveal setState fires its own state-diff which
          // extends the clock further for any on-play effects.
          holdAnim(holdMs + 100);
          // Fire the target burst near the end of the reveal so it lands as
          // the spell finishes resolving.
          if (step.played.type === 'Spell' && step.spellTarget) {
            const playedCard = step.played;
            const playedTarget = step.spellTarget;
            setTimeout(() => {
              if (cancelled) return;
              fireSpellFx(playedTarget, playedCard.abilityKind);
            }, holdMs - 600);
          }
          setTimeout(() => {
            if (cancelled) return;
            setOpponentReveal(null);
            setState(step.next);
            // Fire the legendary cinematic after state advances so the
            // creature is already on the field — the overlay reads as
            // "this big card just landed on the board", not floating in
            // a vacuum. Skipped for spells; rarity check inside.
            if (step.played) fireLegendarySummon(step.played, 'opponent');
          }, holdMs);
        } else {
          // Plain non-animated action — short "thinking" beat between
          // moves. Trimmed from 1700ms → 950ms so back-to-back actions
          // feel decisive rather than sluggish.
          setTimeout(() => { if (!cancelled) setState(step.next); }, 950);
        }
      } else {
        // No more steps — pass the turn back. Use endTurn (not
        // beginTurn directly) so the boss actually runs its
        // end-of-turn hooks: level_up ticks, bonds, freeze/silence
        // wear-offs. endTurn calls beginTurn(player) internally so
        // the turn still flips.
        setTimeout(() => {
          if (cancelled) return;
          showMsg('Your turn');
          setState(s => endTurn(s));
        }, 950);
      }
    };
    // Initial boss "thinking" beat — trimmed from 1800ms → 1000ms. Still
    // long enough to let the turn banner land and any queued popups
    // finish, short enough to keep total match time in the 3-min range.
    const t = setTimeout(tick, 1000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (busyTimer) clearTimeout(busyTimer);
    };
  }, [state, flipping, initialDealing, bondCinematic, animTick]);

  // Show a sliding "YOUR TURN" / "BOSS TURN" banner whenever the active player
  // changes. Skips the very first render so the banner only fires on actual swaps.
  //
  // We defer the banner until animBusyUntilRef clears so it lands AFTER
  // all turn-flip animations (ability reveals, buff popups, bond toasts,
  // turn-start draw) have played out. Otherwise the banner flashed in
  // simultaneously with the first ability reveal and the player got
  // hit with three things at once.
  const firstTurnRef = useRef(true);
  useEffect(() => {
    // Reset the player's phase to Main any time the active side
    // becomes the player. (Boss's "phase" is implicit — handled by
    // the AI driver's banner sequence; we don't need to track it as
    // state since the boss can't be in the middle of human phase
    // navigation.)
    if (state.turn === 'player') setPlayerPhase('main');
    if (firstTurnRef.current) { firstTurnRef.current = false; return; }
    if (state.outcome !== 'ongoing') return;
    const targetTurn = state.turn;
    let scheduleTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const tryShow = () => {
      const remaining = Math.max(0, animBusyUntilRef.current - Date.now());
      if (remaining > 50) {
        scheduleTimer = setTimeout(tryShow, remaining + 50);
      } else {
        setTurnBanner(targetTurn);
        sfx('turn');
        hideTimer = setTimeout(() => setTurnBanner(null), 1400);
      }
    };
    // Delay 50ms so all sibling useEffects (including state-diff) have run
    // and animBusyUntilRef reflects the full animation pipeline length.
    scheduleTimer = setTimeout(tryShow, 50);
    return () => {
      if (scheduleTimer) clearTimeout(scheduleTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [state.turn, state.outcome]);

  // Win/lose stinger fires once when the match resolves.
  const outcomePlayedRef = useRef(false);
  useEffect(() => {
    if (state.outcome === 'ongoing' || outcomePlayedRef.current) return;
    outcomePlayedRef.current = true;
    sfx(state.outcome === 'win' ? 'win' : state.outcome === 'draw' ? 'turn' : 'lose');
  }, [state.outcome]);

  // Bond activation diff — flag any newly-active bonds on each side so the
  // persistent BondPillStack chips can animate themselves in. No separate
  // toast: the persistent pill IS the indicator, briefly highlighted when
  // it first appears so the player can't miss it. Same gold/dark color
  // language for "your bond / boss bond" everywhere it's shown.
  const prevPlayerBondsRef = useRef<Set<string>>(new Set());
  const prevOppBondsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const diff = (cur: Set<string>, prev: React.MutableRefObject<Set<string>>) => {
      const newly = [...cur].filter(id => !prev.current.has(id));
      prev.current = cur;
      return newly;
    };
    const playerCur = new Set(activeBonds(state.player).map(b => b.id));
    const oppCur = new Set(activeBonds(state.opponent).map(b => b.id));
    const newPlayer = diff(playerCur, prevPlayerBondsRef);
    const newOpp = diff(oppCur, prevOppBondsRef);
    if (newPlayer.length === 0 && newOpp.length === 0) return;

    if (newPlayer.length) setNewPlayerBonds(newPlayer);
    if (newOpp.length) setNewOppBonds(newOpp);
    sfx('summon');
    for (const id of newPlayer) onBondDiscovered?.(id);
    // Every newly-active player bond counts toward quest progress, whether
    // or not it's the player's first encounter with that bond.
    for (let i = 0; i < newPlayer.length; i++) onBondTriggered?.();

    // Cinematic — the first newly-active bond on either side opens a brief
    // center-stage "link up" preview so the activation lands as A Moment,
    // not just a quiet HUD update. Player bonds win priority over boss
    // bonds (one tick can only feature one cinematic).
    const cinematicSide: Owner | null = newPlayer.length ? 'player' : (newOpp.length ? 'opponent' : null);
    if (cinematicSide) {
      const newId = (cinematicSide === 'player' ? newPlayer : newOpp)[0];
      const me = cinematicSide === 'player' ? state.player : state.opponent;
      const bond = activeBonds(me).find(b => b.id === newId);
      const cardA = bond ? me.field.find(c => c.id === bond.cardA) : null;
      const cardB = bond ? me.field.find(c => c.id === bond.cardB) : null;
      if (bond && cardA && cardB) {
        setBondCinematic({ bond, cardA, cardB, side: cinematicSide });
      }
    }

    // NOTE: the auto-clear timers for the cinematic + new-bond flags
    // live in dedicated effects below (keyed on bondCinematic /
    // newPlayerBonds / newOppBonds respectively). Earlier they were
    // scheduled inside THIS effect, but state changes on the field
    // re-ran this effect every tick and the cleanup cancelled the
    // pending timers — so once a state change happened mid-cinematic,
    // the cinematic stayed up forever and froze the AI driver.
  }, [state.player.field, state.opponent.field]);

  // Auto-clear the cinematic after its full ~3.4s run completes.
  // Tied to bondCinematic alone so it survives unrelated state changes
  // (opp playing another card, attacks landing, etc.) — the timer only
  // resets if a NEW cinematic replaces this one.
  useEffect(() => {
    if (!bondCinematic) return;
    const t = setTimeout(() => setBondCinematic(null), 3400);
    return () => clearTimeout(t);
  }, [bondCinematic]);

  // Auto-clear the newly-active bond flags after the chip pop completes.
  // Same isolation — survives field changes during the highlight.
  useEffect(() => {
    if (newPlayerBonds.length === 0) return;
    const t = setTimeout(() => setNewPlayerBonds([]), 1800);
    return () => clearTimeout(t);
  }, [newPlayerBonds]);
  useEffect(() => {
    if (newOppBonds.length === 0) return;
    const t = setTimeout(() => setNewOppBonds([]), 1800);
    return () => clearTimeout(t);
  }, [newOppBonds]);

  // Surface silent state changes — non-combat HP loss (Lion's AOE),
  // creature buffs (Coffee / Family Photo / Promotion / etc.), silence
  // hits, and hand-size increases from on-play draws (Tio, IT Support,
  // Owl, Train Conductor, Suitcase) and spell draws — so the player
  // sees what changed instead of guessing.
  interface CreatureSnap { atk: number; hp: number; ability: string }
  /** Parallel ref of full BattleCards keyed by battleId per side. Lets
   *  the state-diff effect resurrect a "ghost" of a creature that just
   *  left the field (AOE kill, spell kill, etc.) so we can render the
   *  slice animation on its corpse. The CreatureSnap map above is for
   *  cheap atk/hp/ability comparisons; this one keeps the full data. */
  const prevFieldRef = useRef<{ player: Map<string, BattleCard>; opponent: Map<string, BattleCard> }>({
    player: new Map(), opponent: new Map(),
  });
  const prevSnapRef = useRef<{
    player: Map<string, CreatureSnap>;
    opponent: Map<string, CreatureSnap>;
    handSize: { player: number; opponent: number };
    /** Hand contents as a Set<battleId> per side. Lets us detect the
     *  exact number of NEW cards added each tick by set-diffing — net
     *  hand-size change miscounts when a spell that draws cards also
     *  removes itself from hand (Suitcase: draw 2 ⇒ net +1, but two
     *  cards were genuinely drawn). */
    handIds: { player: Set<string>; opponent: Set<string> };
    fatigue: { player: number; opponent: number };
    /** Snapshot of each side's face HP. Used to attribute non-combat HP
     *  changes to the bond that caused them (heal_face_per_turn at start
     *  of a turn, damage_at_end_turn at end). */
    hp: { player: number; opponent: number };
    turnNumber: number;
  }>({
    player: new Map(), opponent: new Map(),
    handSize: { player: 0, opponent: 0 },
    handIds: { player: new Set(), opponent: new Set() },
    fatigue: { player: 0, opponent: 0 },
    hp: { player: STARTING_HP, opponent: STARTING_HP },
    turnNumber: state.turnNumber,
  });
  useEffect(() => {
    const snapshot = (cs: BattleCard[]) => new Map(cs.map(c => [c.battleId, {
      atk: c.currentAtk, hp: c.currentHp, ability: c.abilityKind,
    } as CreatureSnap]));
    const prev = prevSnapRef.current;
    const fresh = {
      player: snapshot(state.player.field),
      opponent: snapshot(state.opponent.field),
      handSize: { player: state.player.hand.length, opponent: state.opponent.hand.length },
      handIds: {
        player: new Set(state.player.hand.map(c => c.battleId)),
        opponent: new Set(state.opponent.hand.map(c => c.battleId)),
      },
      fatigue: { player: state.player.fatigueCount, opponent: state.opponent.fatigueCount },
      hp: { player: state.player.hp, opponent: state.opponent.hp },
      turnNumber: state.turnNumber,
    };

    // Skip diff-driven popups while the coin flip / opening deal is still
    // running — prev maps are still empty so we'd fire 4 phantom draw
    // flights and a wave of "+0" buff popups for every initial creature.
    if (!combat && !flipping && !initialDealing) {
      const damagePops: Record<string, number> = {};
      const buffPops: Record<string, { atk: number; hp: number }> = {};
      const silenced: Record<string, number> = {};
      const checkSide = (side: Map<string, CreatureSnap>, prevSide: Map<string, CreatureSnap>) => {
        for (const [id, cur] of side) {
          const before = prevSide.get(id);
          if (!before) continue;
          // HP drop → damage popup (covers Lion's AOE etc.)
          if (cur.hp < before.hp) damagePops[id] = before.hp - cur.hp;
          // ATK or max-HP rose → buff popup (spell_buff resolves)
          const atkUp = cur.atk - before.atk;
          const hpUp = cur.hp - before.hp;
          if (atkUp > 0 || hpUp > 0) buffPops[id] = { atk: Math.max(0, atkUp), hp: Math.max(0, hpUp) };
          // Ability stripped → silence flash
          if (before.ability !== 'none' && cur.ability === 'none') silenced[id] = Date.now();
        }
      };
      checkSide(fresh.player, prev.player);
      checkSide(fresh.opponent, prev.opponent);

      // Death detection — any creature in the prev field that's no
      // longer in the fresh field died. Same path for combat and
      // non-combat deaths: we hand each dead battleId to the `dying`
      // map with a (gx, gy) translate vector pointing from its slot
      // rect to the side's graveyard icon. FieldRow keeps rendering
      // the card in its slot and applies flyToGrave, so the LIVE
      // BattlefieldCard arcs into the graveyard — no overlay ghost,
      // no vanish-then-appear gap.
      const detectDeaths = (
        prevCards: Map<string, BattleCard>,
        freshIds: Set<string>,
        side: Owner,
        slotsForSide: Record<string, number>,
      ): { id: string; card: BattleCard; side: Owner; slot: number; gx: number; gy: number }[] => {
        const out: { id: string; card: BattleCard; side: Owner; slot: number; gx: number; gy: number }[] = [];
        const graveKey = side === 'player' ? GRAVE_PLAYER : GRAVE_OPP;
        const graveRect = lastRectsRef.current.get(graveKey) ?? prevRectsRef.current.get(graveKey);
        for (const [id, card] of prevCards) {
          if (freshIds.has(id)) continue;
          const rect = prevRectsRef.current.get(id);
          if (!rect) continue;
          const slot = slotsForSide[id];
          if (slot == null) continue;
          const gx = graveRect ? (graveRect.x + graveRect.w / 2) - (rect.x + rect.w / 2) : 0;
          const gy = graveRect ? (graveRect.y + graveRect.h / 2) - (rect.y + rect.h / 2) : 0;
          out.push({ id, card, side, slot, gx, gy });
        }
        return out;
      };
      const freshPlayerIds = new Set(state.player.field.map(c => c.battleId));
      const freshOppIds = new Set(state.opponent.field.map(c => c.battleId));
      const newDeathsRaw = [
        ...detectDeaths(prevFieldRef.current.player, freshPlayerIds, 'player', playerSlots),
        ...detectDeaths(prevFieldRef.current.opponent, freshOppIds, 'opponent', opponentSlots),
      ];
      // Sequential animation queue for everything the diff effect
      // schedules — damage popups → deaths flying to graveyard → draws
      // landing in hand → buff / silence popups. Each phase fires after
      // the previous one finishes so the player sees one beat at a
      // time (Hearthstone / MTG Arena style). `pipeDelay` accumulates,
      // and the largest scheduled time is forwarded to the AI driver
      // via `holdAnim` so the boss waits its turn.
      let pipeDelay = 250; // small buffer after state advance so the
                           // landing creature's slam settles first

      if (Object.keys(damagePops).length) {
        const at = pipeDelay;
        setTimeout(() => setDamages(d => ({ ...d, ...damagePops })), at);
        setTimeout(() => setDamages(d => {
          const next = { ...d };
          for (const id of Object.keys(damagePops)) delete next[id];
          return next;
        }), at + 1800);
        pipeDelay += 1800;
      }

      if (newDeathsRaw.length) {
        const STAGGER = 180;
        const at = pipeDelay;
        // Pin the dying card to its old slot RIGHT NOW (same commit as
        // the state change) so the slot reconcile can't reuse the slot
        // for a freshly-summoned creature. The CSS animationDelay (= the
        // queue position) defers when flyToGrave starts visually — until
        // then the card sits in its slot, eats its damage popup, and
        // waits its turn in the queue.
        const newDying: Record<string, { card: BattleCard; side: Owner; slot: number; gx: number; gy: number; delayMs: number }> = {};
        newDeathsRaw.forEach((d, i) => {
          newDying[d.id] = {
            card: d.card,
            side: d.side,
            slot: d.slot,
            gx: d.gx,
            gy: d.gy,
            delayMs: at + i * STAGGER,
          };
        });
        setDying(prev => ({ ...prev, ...newDying }));
        newDeathsRaw.forEach((d, i) => {
          const start = at + i * STAGGER;
          // Pulse the graveyard icon as the card lands (~92% of the
          // 1.1s flyToGrave keyframe).
          setTimeout(() => {
            setGravePulseKey(p => ({ ...p, [d.side]: p[d.side] + 1 }));
          }, start + 1000);
          // Free the slot once the flight is done.
          setTimeout(() => {
            setDying(prev => {
              if (!prev[d.id]) return prev;
              const next = { ...prev };
              delete next[d.id];
              return next;
            });
          }, start + 1150);
        });
        // All deaths finished = last stagger + flight duration.
        const lastDeathEnds = (newDeathsRaw.length - 1) * STAGGER + 1100;
        pipeDelay += lastDeathEnds;
      }

      const turnFlipped = fresh.turnNumber > prev.turnNumber;

      // MID-TURN draws (Suitcase draws 2, Tio's draw_on_play, etc.)
      // fire here — they're a direct consequence of the just-played
      // card and should land in the same beat. TURN-START draws on a
      // turn flip are queued LATER inside the Draw Phase section
      // (after End Phase banner + level_up reveals + buff popups)
      // so they read as the start-of-turn beat, not as something
      // that happened during the previous player's End Phase.
      const newPlayerIds = [...fresh.handIds.player].filter(id => !prev.handIds.player.has(id));
      const newOppIds    = [...fresh.handIds.opponent].filter(id => !prev.handIds.opponent.has(id));
      const newPlayerCards = newPlayerIds.length;
      const newOppCards    = newOppIds.length;
      const totalDraws = newPlayerCards + newOppCards;
      if (totalDraws > 0 && !turnFlipped) {
        const drawStep = 420;
        const at = pipeDelay;
        // Hide newly-drawn cards in the fan until each card's flight lands.
        if (newPlayerIds.length) {
          setPendingDrawIds(s => new Set([...s, ...newPlayerIds]));
          newPlayerIds.forEach((id, i) => {
            setTimeout(() => setPendingDrawIds(s => { const n = new Set(s); n.delete(id); return n; }), at + i * drawStep + 1200);
          });
        }
        for (let i = 0; i < newPlayerCards; i++) fireDraw('player', at + i * drawStep);
        for (let i = 0; i < newOppCards; i++) fireDraw('opponent', at + i * drawStep);
        pipeDelay += totalDraws * drawStep + 700;
      }

      // (Buff popups for level_up / spell_buff resolves moved to AFTER
      // the effect-toast block below — the ability reveal plays first,
      // THEN the +1/+1 popup lands. See `queueBuffPops()` after the
      // effect-toast queue.)
      if (Object.keys(silenced).length) {
        setSilencedAt(s => ({ ...s, ...silenced }));
        setTimeout(() => setSilencedAt(s => {
          const next = { ...s };
          for (const id of Object.keys(silenced)) delete next[id];
          return next;
        }), 900);
      }

      // Settle beat — when a turn flipped, add an extra ~600ms after
      // all queued animations so the player perceives a clear gap
      // between "my abilities finished firing" and "the boss starts
      // acting." Without this the Senior Year graduation reveal +
      // buff popup ran right into the boss's first attack, reading
      // as overlap. The buffer also gives the YOUR TURN / BOSS TURN
      // banner room to land cleanly.
      const turnSettle = (fresh.turnNumber > prev.turnNumber) ? 600 : 0;
      // Tell the AI driver to wait until the pipeline finishes.
      if (pipeDelay > 250 || turnSettle > 0) {
        holdAnim(pipeDelay + turnSettle);
        setAnimTick(t => t + 1);
      }

      // Fatigue spike — when a side's fatigueCount went up, that's "drew
      // from an empty deck and took escalating damage". Surface it with a
      // skull-themed callout so the player understands the cause and the
      // damage amount, instead of just seeing a small unexplained -N popup
      // after each turn end. The diff already added a regular damage popup
      // for the HP loss; we override that for the fatigued side so the
      // message lands as fatigue, not generic damage.
      const playerFatigueGain = fresh.fatigue.player - prev.fatigue.player;
      const oppFatigueGain = fresh.fatigue.opponent - prev.fatigue.opponent;
      if (playerFatigueGain > 0) {
        const dmg = fresh.fatigue.player; // total fatigue draw is the damage that fired
        setFatigueFx({ side: 'player', dmg, tick: Date.now() });
        setTimeout(() => setFatigueFx(f => (f && f.side === 'player' ? null : f)), 1600);
      } else if (oppFatigueGain > 0) {
        const dmg = fresh.fatigue.opponent;
        setFatigueFx({ side: 'opponent', dmg, tick: Date.now() });
        setTimeout(() => setFatigueFx(f => (f && f.side === 'opponent' ? null : f)), 1600);
      }

      // We deliberately DON'T surface "DRAW +N" / "AOE -N" text chips
      // anymore. The actual effects already have their own animations:
      //  - draw_on_play  → the card-back flight from deck → hand fires
      //                    via the handSize diff a few lines down.
      //  - aoe_on_play   → damage popups land on each affected enemy
      //                    via the damagePops diff above.
      // Doubling up with a label chip was redundant and felt rushed
      // since both effects fired the same instant. Letting the damage
      // popups and draw flights speak for themselves keeps the game
      // family-friendly readable.

      // Bond face popups — when a turn flips, attribute non-combat face HP
      // changes to the bond that caused them. heal_face_per_turn fires at
      // the START of the active player's turn (so when turn went up + the
      // new active side gained HP, the heal popup goes over their face).
      // damage_at_end_turn fires at the END (so when turn flipped TO the
      // opponent and they LOST HP without any combat happening, we credit
      // the player's bond). The pop uses the same green/red damage popup
      // language already used elsewhere.
      // Phase-separated ability activations. End-phase fires
      // (level_up / graduate ticks on the just-ended turn's owner)
      // and Draw-phase fires (heal_each_turn on the just-begun
      // turn's owner) are queued AS SEPARATE sections of the
      // pipeline, each prefaced by a brief phase banner so the
      // player can read the turn as a sequence of phases:
      //   END PHASE (yours)  →  level-up reveals  →
      //   DRAW PHASE (theirs) →  heal reveals + draw flight →
      //   MAIN PHASE (theirs) →  YOUR TURN banner → boss acts
      // Matches TCG convention and removes the "everything happened
      // at once, I don't know what's going on" feeling.
      const endPhaseFires: { card: BattleCard; text: string; side: Owner }[] = [];
      const drawPhaseFires: { card: BattleCard; text: string; side: Owner }[] = [];
      let justEndedSide: Owner = 'player';
      let newActiveSide: Owner = 'player';
      if (turnFlipped) {
        justEndedSide = state.turn === 'player' ? 'opponent' : 'player';
        newActiveSide = state.turn;
        // End-phase: level-up / graduate ticks fired at end of the
        // JUST-ENDED turn for that side. Detect by comparing the
        // creature's pre-tick atk/hp snapshot with its post-tick
        // state.
        const justEndedField = justEndedSide === 'player' ? state.player.field : state.opponent.field;
        const justEndedPrev = justEndedSide === 'player' ? prev.player : prev.opponent;
        for (const c of justEndedField) {
          const ps = justEndedPrev.get(c.battleId);
          if (!ps) continue;
          const dAtk = c.currentAtk - ps.atk;
          const dHp = c.currentHp - ps.hp;
          const stillLeveling = c.abilityKind === 'level_up' || c.abilityKind === 'graduate';
          if (stillLeveling && (dAtk > 0 || dHp > 0)) {
            endPhaseFires.push({
              card: c,
              text: `Level up +${dAtk}/+${dHp}`,
              side: justEndedSide,
            });
          }
          if (ps.ability === 'graduate' && c.graduated && c.abilityKind === 'untargetable') {
            endPhaseFires.push({
              card: c,
              text: 'Graduated — +2/+2 and Untargetable',
              side: justEndedSide,
            });
          }
        }
        // Draw-phase: heal_each_turn on the new active side.
        const newActiveBefore = newActiveSide === 'player' ? prev.hp.player : prev.hp.opponent;
        const newActiveAfter = newActiveSide === 'player' ? fresh.hp.player : fresh.hp.opponent;
        const newActiveField = newActiveSide === 'player' ? state.player.field : state.opponent.field;
        if (newActiveAfter > newActiveBefore) {
          for (const c of newActiveField) {
            if (c.abilityKind === 'heal_each_turn' && c.abilityValue) {
              const who = newActiveSide === 'player' ? 'You heal' : `${boss.name} heals`;
              drawPhaseFires.push({
                card: c,
                text: `${who} +${c.abilityValue} HP`,
                side: newActiveSide,
              });
            }
          }
        }
        // Draw-phase: mana_prep bonus (Slow Cooker etc.) fires when the
        // active side's mana exceeds their maxMana at turn start.
        const newActiveMana = newActiveSide === 'player' ? state.player.mana : state.opponent.mana;
        const newActiveMaxMana = newActiveSide === 'player' ? state.player.maxMana : state.opponent.maxMana;
        if (newActiveMana > newActiveMaxMana) {
          for (const c of newActiveField) {
            if (c.abilityKind === 'mana_prep' && c.abilityValue) {
              const who = newActiveSide === 'player' ? 'You gain' : `${boss.name} gains`;
              drawPhaseFires.push({
                card: c,
                text: `${who} +${c.abilityValue} mana this turn`,
                side: newActiveSide,
              });
            }
          }
        }
      }
      // Helper to schedule a phase banner at the current pipeDelay
      // and advance pipeDelay by its on-screen duration.
      const queuePhaseBanner = (text: string, side: Owner) => {
        const BANNER_MS = 950;
        const at = pipeDelay;
        const key = Date.now() + 700 + Math.floor(Math.random() * 100);
        setTimeout(() => setPhaseBanner({ text, side, key }), at);
        setTimeout(() => setPhaseBanner(cur => (cur && cur.key === key ? null : cur)), at + BANNER_MS + 50);
        pipeDelay += BANNER_MS + 50;
      };
      const queueEffectFires = (fires: typeof endPhaseFires) => {
        if (!fires.length) return;
        const EFFECT_MS = 2400;
        const at = pipeDelay;
        fires.forEach((f, i) => {
          const showAt = at + i * EFFECT_MS;
          const key = Date.now() + 300 + i + Math.floor(Math.random() * 1000);
          setTimeout(() => setEffectToast({ ...f, key }), showAt);
          setTimeout(() => setEffectToast(cur => (cur && cur.key === key ? null : cur)), showAt + EFFECT_MS + 50);
        });
        pipeDelay += fires.length * EFFECT_MS + 50;
      };
      // END PHASE — level_up / graduate reveals, then the matching
      // +1/+1 buff popups land on the actual creatures. The player's
      // End Phase banner is shown immediately by onEndTurn so we only
      // queue one here for the boss's turn end.
      if (endPhaseFires.length) {
        if (justEndedSide === 'opponent') queuePhaseBanner('End Phase', justEndedSide);
        queueEffectFires(endPhaseFires);
      }

      // Buff popups (level_up +1/+1, spell_buff resolves, etc.) fire
      // AFTER the effect toast — so the player reads "Math Teacher
      // levels up" from the centered card reveal, THEN sees the
      // +1/+1 pop on the actual creature. This matches the requested
      // sequence: ability animation first, stat change second.
      if (Object.keys(buffPops).length) {
        const at = pipeDelay;
        setTimeout(() => setBuffs(b => ({ ...b, ...buffPops })), at);
        setTimeout(() => setBuffs(b => {
          const next = { ...b };
          for (const id of Object.keys(buffPops)) delete next[id];
          return next;
        }), at + 1200);
        pipeDelay = at + 1200;
      }

      // DRAW PHASE — banner + heal_each_turn reveals + turn-start
      // draw flight + mana pulse. All in one beat: "okay, this side
      // is starting their turn now." Mid-turn draws are NOT here;
      // they fire earlier as a same-tick consequence of their cause.
      if (turnFlipped) {
        if (drawPhaseFires.length || totalDraws > 0) {
          queuePhaseBanner('Draw Phase', newActiveSide);
        }
        if (totalDraws > 0) {
          const drawStep = 420;
          const at = pipeDelay;
          // Hide newly-drawn cards in the fan until each card's flight lands.
          if (newPlayerIds.length) {
            setPendingDrawIds(s => new Set([...s, ...newPlayerIds]));
            newPlayerIds.forEach((id, i) => {
              setTimeout(() => setPendingDrawIds(s => { const n = new Set(s); n.delete(id); return n; }), at + i * drawStep + 1200);
            });
          }
          for (let i = 0; i < newPlayerCards; i++) fireDraw('player', at + i * drawStep);
          for (let i = 0; i < newOppCards; i++) fireDraw('opponent', at + i * drawStep);
          setTimeout(() => setManaPulse(p => p + 1), at);
          pipeDelay += totalDraws * drawStep + 700;
        }
        // Start-of-turn abilities fire AFTER the draw so the player sees
        // their new card land before the ability toasts appear.
        queueEffectFires(drawPhaseFires);
        // MAIN PHASE banner — closes the turn-flip with the
        // "now you can play" beat. Fires for whichever side is now
        // active. The player can then play cards; the boss starts
        // its AI actions after the pipeline clears.
        queuePhaseBanner('Main Phase', newActiveSide);
      }

      if (turnFlipped) {
        const bondPops: Record<string, number> = {};
        // Heal at start of active side's turn
        const activeSide: Owner = state.turn;
        const activeBefore = activeSide === 'player' ? prev.hp.player : prev.hp.opponent;
        const activeAfter = activeSide === 'player' ? fresh.hp.player : fresh.hp.opponent;
        const activeBondsList = activeBonds(activeSide === 'player' ? state.player : state.opponent);
        // Any non-combat face HP gain at turn flip = a heal popup, no
        // matter what caused it. Covers heal_face_per_turn bonds AND
        // heal_each_turn creatures (Library, Grandma's Pie) so the
        // player ALWAYS sees a green +N float up when their face HP
        // ticks up, not just a silent bar change.
        if (activeAfter > activeBefore) {
          const key = activeSide === 'player' ? FACE_PLAYER : FACE_OPP;
          bondPops[key] = -(activeAfter - activeBefore); // negative = heal popup (green)
        }
        // Damage at end of just-finished side's turn → opposite side took the dmg
        const endedSide: Owner = activeSide === 'player' ? 'opponent' : 'player';
        const endedBondsList = activeBonds(endedSide === 'player' ? state.player : state.opponent);
        if (endedBondsList.some(b => b.effect.kind === 'damage_at_end_turn')) {
          const victim = activeSide; // damage hits the player whose turn just began
          const before = victim === 'player' ? prev.hp.player : prev.hp.opponent;
          const after = victim === 'player' ? fresh.hp.player : fresh.hp.opponent;
          if (after < before) {
            const key = victim === 'player' ? FACE_PLAYER : FACE_OPP;
            // If a heal popup landed at the same key (rare — both sides could fire)
            // sum into a net swing so the player sees one number, not two stacked.
            bondPops[key] = (bondPops[key] ?? 0) + (before - after);
          }
        }
        // Per-turn bond ANNOUNCEMENTS. Distinct from `bondCinematic` (which
        // only fires once when a bond first links up). For bonds whose
        // effect repeats every turn, we surface a small "BOND: <name>"
        // toast right before the engine effect plays so the player
        // understands *why* the next heal / damage / draw is happening.
        // Fires are queued sequentially via pipeDelay so two bonds don't
        // stack on top of each other.
        const fires: { bond: BondDef; side: Owner }[] = [];
        for (const b of activeBondsList) {
          if (b.effect.kind === 'heal_face_per_turn' && activeAfter > activeBefore) {
            fires.push({ bond: b, side: activeSide });
          }
          if (b.effect.kind === 'heal_creatures_per_turn') {
            // Engine logs to state.log when the bond actually healed —
            // we can also just always announce if the bond is up, since
            // the toast doesn't claim a specific amount. Keeping it
            // simple: announce whenever the bond is active at turn
            // start, even if nothing was injured (low cost; reads as
            // "bond is working").
            fires.push({ bond: b, side: activeSide });
          }
        }
        // Study Group fires at the END of the just-ended turn for
        // its owner. We attach it to the endedBondsList scan below
        // so the toast pops alongside the level-up effect toasts.
        for (const b of endedBondsList) {
          if (b.effect.kind === 'damage_at_end_turn') {
            fires.push({ bond: b, side: endedSide });
          }
          // Study Group — level_up_doubled. Announce only when the
          // owner actually has a leveling creature on the field
          // (otherwise the bond exists but had nothing to amplify
          // and announcing it would feel like a false alarm).
          if (b.effect.kind === 'level_up_doubled') {
            const endedField = endedSide === 'player' ? state.player.field : state.opponent.field;
            const hasLeveler = endedField.some(x =>
              x.abilityKind === 'level_up' || x.abilityKind === 'graduate'
            );
            if (hasLeveler) fires.push({ bond: b, side: endedSide });
          }
          if (b.effect.kind === 'draw_at_end_if_low_hand') {
            // The Kids fires only when the hand was actually under 3 AT
            // end-of-turn. We can't observe that perfectly here, but the
            // bondFlags get set by the engine — read the latest hand
            // size: if the ENDED side has fewer than 4 cards and drew at
            // end-of-turn, the bond fired. Simpler heuristic: hand grew
            // by 1 at end-of-turn while hand was low.
            const endedHandSize = endedSide === 'player' ? state.player.hand.length : state.opponent.hand.length;
            if (endedHandSize <= 3) fires.push({ bond: b, side: endedSide });
          }
        }
        if (fires.length) {
          const TOAST_MS = 900;
          const at = pipeDelay;
          fires.forEach((f, i) => {
            const showAt = at + i * TOAST_MS;
            const key = Date.now() + i;
            setTimeout(() => setBondFire({ ...f, key }), showAt);
            setTimeout(() => setBondFire(cur => (cur && cur.key === key ? null : cur)), showAt + TOAST_MS + 50);
          });
          pipeDelay += fires.length * TOAST_MS + 50;
        }
        if (Object.keys(bondPops).length) {
          // Fire the heal/damage popups AFTER the bond toasts so the
          // reading order is "bond name → effect lands."
          const popAt = pipeDelay;
          setTimeout(() => setDamages(d => ({ ...d, ...bondPops })), popAt);
          setTimeout(() => setDamages(d => {
            const next = { ...d };
            for (const id of Object.keys(bondPops)) delete next[id];
            return next;
          }), popAt + 1100);
          pipeDelay += 1100;
        }
        // Re-lock the AI driver with the final pipeDelay. The early
        // holdAnim call above only had the partial value (before
        // endPhaseFires, drawPhaseFires, bond toasts grew pipeDelay),
        // so we update the ref here once everything is queued.
        holdAnim(pipeDelay + turnSettle);
      }

    }
    // Freeze the prev snapshots while combat is animating. `setState` for
    // the post-combat field fires BEFORE `setCombat(null)`, so if we let
    // these refs advance during the combat-gated tick, the follow-up tick
    // (after combat clears) would compare same-to-same and miss the
    // creature that died in combat — the ghost would never fire and the
    // card would just disappear flat. Keeping refs frozen until combat
    // ends means the death-detection sees the pre-combat field and
    // launches a flyToGrave ghost for every combat kill, matching how
    // spell / AOE kills already work.
    if (!combat) {
      prevSnapRef.current = fresh;
      prevFieldRef.current = {
        player: new Map(state.player.field.map(c => [c.battleId, c])),
        opponent: new Map(state.opponent.field.map(c => [c.battleId, c])),
      };
    }
  }, [state, combat, flipping, initialDealing]);

  // Dying entries are self-cleaning — each insertion in the state-diff
  // effect schedules its own removal once the flyToGrave keyframe ends.
  // No bulk sweeper needed here.

  // Initial deal — once the coin flip finishes, animate the opening hand
  // arriving one card at a time on alternating sides. Hands look empty
  // until the first card flies in, so the match opens like a real game
  // ("ok, here come our cards"). After STARTING_HAND × 2 deals, AI driver
  // unlocks and the first turn starts.
  useEffect(() => {
    if (flipping) return;
    if (state.outcome !== 'ongoing') return;
    if (!initialDealing) return;
    let cancelled = false;
    let i = 0;
    const totalDeals = STARTING_HAND * 2;
    const tick = () => {
      if (cancelled) return;
      if (i >= totalDeals) {
        setInitialDealing(false);
        return;
      }
      const side: Owner = i % 2 === 0 ? 'player' : 'opponent';
      fireDraw(side, 0);
      if (side === 'player') setPlayerInitialDealt(d => d + 1);
      i++;
      setTimeout(tick, 380);
    };
    const start = setTimeout(tick, 250);
    return () => { cancelled = true; clearTimeout(start); };
  }, [flipping, initialDealing, state.outcome]);

  // (Turn-start draw flight + mana pulse moved into the state-diff
  // pipeline above. Routing them through pipeDelay means they fire
  // strictly AFTER the ability reveals / buff popups / bond toasts
  // from the same turn flip, instead of racing them.)

  // Recompute the attack-arrow endpoints whenever combat starts. We read the
  // Cache last-known board-local rect for every creature element after
  // every render. Runs synchronously in layout phase so we catch the
  // positions BEFORE any unmount in the next tick. The diff effect uses
  // these to render death ghosts at the exact slot the creature died in
  // (which is gone from the DOM by the time the diff runs).
  useLayoutEffect(() => {
    if (!boardRef.current) return;
    // Freeze BOTH refs while combat is animating. The state swap that
    // removes a combat-killed creature fires before `setCombat(null)`,
    // so its DOM unmounts mid-combat. If we let `lastRectsRef` rebuild
    // from the post-combat DOM during the combat-gated tick, the next
    // tick (combat null) would shift that already-empty map into
    // `prevRectsRef` and the death ghost would have no source rect to
    // fly from — leaving combat-killed cards to vanish flat.
    //
    // Cards don't physically move during combat (they stay in their
    // slots), so freezing both refs costs nothing and guarantees the
    // post-combat tick sees pre-combat positions for the death ghost.
    if (combat) return;
    const board = boardRef.current.getBoundingClientRect();
    // Step 1: shift the CURRENT lastRectsRef into prevRectsRef before
    // overwriting. This lets the diff useEffect (which runs after this)
    // find the rect a creature occupied in the PREVIOUS render — exactly
    // what we need for death ghosts, since the dead creature's DOM is
    // already gone by then.
    prevRectsRef.current = lastRectsRef.current;
    const next = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const [id, el] of cardEls.current) {
      const r = el.getBoundingClientRect();
      next.set(id, {
        x: r.left - board.left,
        y: r.top - board.top,
        w: r.width,
        h: r.height,
      });
    }
    lastRectsRef.current = next;
  });

  // Bond line measurement effect removed along with the SVG overlay
  // below. The bond pill (per side, above/below cards) plus the
  // per-card link badge cover the same information without the visual
  // noise of an extra SVG layer.

  // DOM positions of the attacker and defender (or the face portrait) and
  // hand them to the SVG overlay below.
  useLayoutEffect(() => {
    if (!combat || !boardRef.current) { setArrow(null); return; }
    const attackerEl = cardEls.current.get(combat.attackerId);
    const defenderKey = combat.defenderId === 'face'
      ? (combat.defenderOwner === 'player' ? FACE_PLAYER : FACE_OPP)
      : combat.defenderId;
    const defenderEl = cardEls.current.get(defenderKey);
    if (!attackerEl || !defenderEl) { setArrow(null); return; }
    const board = boardRef.current.getBoundingClientRect();
    const a = attackerEl.getBoundingClientRect();
    const d = defenderEl.getBoundingClientRect();
    setArrow({
      x1: a.left + a.width / 2 - board.left,
      y1: a.top + a.height / 2 - board.top,
      x2: d.left + d.width / 2 - board.left,
      y2: d.top + d.height / 2 - board.top,
    });
  }, [combat]);

  const showMsg = (m: string) => setMsg(m);

  const flashMsg = (m: string) => {
    showMsg(m);
    setTimeout(() => showMsg(state.turn === 'player' ? 'Your turn' : `${boss.name}'s turn`), 1200);
  };

  // ============== Combat animation orchestration ==============
  // Plays the lunge + damage popups, then calls done() to apply the actual state change.
  // If anything dies in the trade, holds the slice animation an extra ~400ms before
  // letting state update so the kill is visible.
  const playAttackAnimation = (info: AiCombat | CombatFx, done: () => void) => {
    const defenderKind = 'defenderKind' in info
      ? info.defenderKind
      : (info.defenderId === 'face' ? 'face' : 'creature');
    const defenderId = 'defenderKind' in info
      ? (info.defenderKind === 'face' ? 'face' : info.defenderId!)
      : info.defenderId;

    setCombat({
      attackerId: info.attackerId,
      attackerOwner: info.attackerOwner,
      defenderId,
      defenderOwner: info.defenderOwner,
      damageToDef: info.damageToDef,
      damageToAtk: info.damageToAtk,
    });
    sfx('attack');

    // Detect lethals so we can play the slice animation and hold state.
    const defenderField = info.defenderOwner === 'player' ? state.player.field : state.opponent.field;
    const attackerField = info.attackerOwner === 'player' ? state.player.field : state.opponent.field;
    const defenderCard = defenderKind === 'creature'
      ? defenderField.find(c => c.battleId === defenderId) ?? null
      : null;
    const attackerCard = attackerField.find(c => c.battleId === info.attackerId) ?? null;
    const defenderDying = !!defenderCard && info.damageToDef >= defenderCard.currentHp;
    const attackerDying = !!attackerCard && info.damageToAtk >= attackerCard.currentHp;
    const anyDying = defenderDying || attackerDying;

    // Reserve the busy clock for the entire combat sequence including
    // the post-state-swap settle. Without this, the AI driver could
    // re-tick on the state change at stateDelay and start another
    // animation while the slash/impact callouts were still on screen.
    // Death ghosts add their own flyToGrave hold on top via the
    // state-diff effect, so we only need to cover the combat overlay
    // here.
    {
      const isTradeNow = defenderKind === 'creature';
      const totalCombatMs = isTradeNow
        ? (anyDying ? 3900 : 3400)
        : (anyDying ? 1700 : 1100);
      holdAnim(totalCombatMs + 200);
    }

    // Yu-Gi-Oh Duel Links pacing — combat plays out across ~3400ms
    // (3900 if anyone dies) so the BATTLE banner, ATK/HP callouts,
    // strike → counter, and settle each have visible time. Face attacks
    // stay snappier (~900ms) since there's no full callout sequence.
    const isTrade = defenderKind === 'creature';
    const popDelay = isTrade ? 1300 : 450;

    // Damage pops at the strike phase.
    setTimeout(() => {
      const defKey = defenderKind === 'face'
        ? (info.defenderOwner === 'player' ? FACE_PLAYER : FACE_OPP)
        : (defenderId as string);
      setDamages(d => ({ ...d, [defKey]: info.damageToDef }));
      if (info.damageToDef > 0) sfx('damage');
      // Counter-strike pops noticeably later for trades so the two hits read
      // as separate beats, not one combined flash.
      if (info.damageToAtk > 0) {
        const counterOffset = isTrade ? 700 : 0;
        setTimeout(() => {
          setDamages(d => ({ ...d, [info.attackerId]: info.damageToAtk }));
        }, counterOffset);
      }
      // Track who's dying. For trades, the VS overlay reads dyingIds and
      // plays the slice on the big preview cards. For face attacks (no
      // big preview), the small battlefield card plays its own slice via
      // the same state — see FieldRow's `inTrade` guard.
      const dying: string[] = [];
      if (defenderDying && isTrade) dying.push(defenderId as string);
      if (attackerDying) dying.push(info.attackerId);
      if (dying.length) setDyingIds(dying);
      setTimeout(() => setDamages({}), 1100);
    }, popDelay);

    // State swap timing — extended for trades so the slice / settle finishes
    // before the cards disappear from state.
    const stateDelay = isTrade
      ? (anyDying ? 3400 : 2900)
      : (anyDying ? 1500 : 900);
    const clearDelay = isTrade
      ? (anyDying ? 3900 : 3400)
      : (anyDying ? 1700 : 1100);
    // When a creature dies in combat, clear `combat` at the SAME instant
    // state advances. The state-diff effect is gated on `!combat`, so any
    // gap between state-swap and combat-clear leaves the dead creature's
    // slot empty (live card unmounted, ghost not yet launched) — the
    // player sees a vanish → reappear → fly sequence. Firing both
    // together lets the diff effect run on the very same tick, spawning
    // the flyToGrave ghost at the moment the live card unmounts.
    //
    // When NO one dies we keep the original 500ms gap so the combat
    // callouts (ATK/HP numbers, charge halo) have a moment to fade after
    // state advances — there's no ghost in flight, so the gap is purely
    // visual polish.
    setTimeout(() => {
      done();
      if (anyDying) {
        setCombat(null);
        setDyingIds([]);
      }
    }, stateDelay);
    if (!anyDying) {
      setTimeout(() => {
        setCombat(null);
        setDyingIds([]);
      }, clearDelay);
    }
  };

  // Fire a colored burst FX over a spell's target. Reads the target's DOM
  // rect from the cardEls map (or the face portrait), translates it into
  // boardRef-local coordinates, and stashes a spellFx so the overlay
  // renders. Self-clears after 700ms (matches the keyframe).
  const fireSpellFx = (
    target: SpellTarget | undefined,
    kind: 'spell_damage' | 'spell_freeze' | 'spell_buff' | 'spell_heal' | 'draw_on_play' | string | undefined,
  ) => {
    if (!target || !boardRef.current) return;
    // Draw spells resolve without a face hit — the card-back flight is the feedback.
    if (kind === 'draw_on_play' || kind === 'spell_both_draw') return;
    const key = target.kind === 'face'
      ? (target.owner === 'player' ? FACE_PLAYER : FACE_OPP)
      : target.battleId;
    const el = cardEls.current.get(key);
    if (!el) return;
    const board = boardRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const fxKind: 'damage' | 'freeze' | 'buff' | 'silence' | 'face' =
      kind === 'spell_freeze' ? 'freeze' :
      kind === 'spell_buff'   ? 'buff' :
      kind === 'silence'      ? 'silence' :
      target.kind === 'face'  ? 'face' : 'damage';
    setSpellFx({
      x: r.left + r.width / 2 - board.left,
      y: r.top + r.height / 2 - board.top,
      kind: fxKind,
    });
    setTimeout(() => setSpellFx(null), 700);
  };

  // ============== Spell cast (player) ==============
  // Spells resolve invisibly without this — the card moves from hand to discard
  // and effects apply silently. We instead show the card center-screen for ~900ms
  // (mirroring the AI's reveal) so the player feels what they cast.
  const castSpell = (card: BattleCard, target: SpellTarget): boolean => {
    const r = playCard(state, 'player', card.battleId, target);
    if (!r.ok) {
      flashMsg(r.reason ?? 'Cannot cast');
      return false;
    }
    const beforeHp = state.player.hp;
    const beforeHand = state.player.hand.length;

    setPlayerSpellReveal(card);
    setSelectedHandIdx(null);
    setPendingSpell(null);
    sfx('cardPlay');
    // Player spell reveal is 900ms (matches the playerSpellReveal
    // keyframe). Reserve the busy clock for it + the burst so no
    // other animation overlaps the cast. State-diff after r.state
    // commits will extend the clock for any resolved effects.
    holdAnim(1000);

    // Burst the target ~600ms in (right before state applies) so the spell
    // visibly "lands" on whatever it was aimed at.
    setTimeout(() => fireSpellFx(target, card.abilityKind), 600);

    setTimeout(() => {
      setState(r.state);
      setPlayerSpellReveal(null);
      const healed = r.state.player.hp - beforeHp;
      if (healed > 0) {
        setDamages(d => ({ ...d, [FACE_PLAYER]: -healed }));
        setTimeout(() => setDamages(d => {
          const next = { ...d }; delete next[FACE_PLAYER]; return next;
        }), 900);
      }
      // Damage popup for spells that hit the opponent's face directly
      // (spell_damage at face, exam_pass when condition is met, etc.).
      // Without this the face HP ticked down silently and the cast
      // looked like it did nothing.
      const oppDamage = state.opponent.hp - r.state.opponent.hp;
      if (oppDamage > 0) {
        setDamages(d => ({ ...d, [FACE_OPP]: oppDamage }));
        setTimeout(() => setDamages(d => {
          const next = { ...d }; delete next[FACE_OPP]; return next;
        }), 900);
      }
      const drewCards = r.state.player.hand.length - (beforeHand - 1);
      if (drewCards > 0) flashMsg(`Drew ${drewCards} card${drewCards === 1 ? '' : 's'}`);
    }, 900);
    return true;
  };

  // ============== Drag from hand (Framer Motion) ==============
  // Each hand card is a motion.div with `drag` enabled. Framer handles
  // the visual translation + spring-back on release; we only track which
  // card is being dragged and what it's currently hovering over so the
  // drop zones can highlight + so the drop handler can route to the
  // right effect. Tap-vs-drag is split: Framer fires onTap below ~5px
  // movement and onDragEnd only after an actual drag — no manual
  // distance threshold needed.

  /** Set to true as soon as a drag actually starts, and reset shortly
   *  after the drag ends. Used in onTap below to skip the tap path
   *  when Framer fires onTap on the same gesture release as a drag.
   *  Without this guard, a successful drag-summon would also fire onTap
   *  with a stale closure (hand state pre-summon), which would call
   *  setSelectedHandIdx with the soon-to-be-shifted index — and on the
   *  next render that index points to a DIFFERENT card, surfacing a
   *  surprise preview after every play. Ref instead of state because
   *  the flag is purely transient and we don't want a re-render on
   *  every drag start. */
  const dragOccurredRef = useRef(false);

  /** Called by Framer when the user actually starts dragging a card
   *  (past the drag threshold). We snapshot the dragged card so other
   *  UI (drop zones, hand opacity) can react. */
  const handleDragStart = (card: BattleCard) => {
    if (state.turn !== 'player' || state.outcome !== 'ongoing') return;
    if (pendingDrawIds.size > 0) return;
    dragOccurredRef.current = true;
    setDrag({
      battleId: card.battleId,
      cardType: card.type,
      overField: false,
      overSlot: null,
    });
  };

  /** Called by Framer on every drag frame with the current pointer
   *  position (viewport coords). Hit-test against the field rects +
   *  per-slot data-attribute so the drop zones can highlight and the
   *  drop handler knows where to route the card on release. */
  const handleDrag = (clientX: number, clientY: number) => {
    const inside = (rect: DOMRect | undefined) =>
      !!rect &&
      clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom;
    const overField = inside(fieldRef.current?.getBoundingClientRect())
      || inside(playerFieldRef.current?.getBoundingClientRect());
    let overSlot: number | null = null;
    if (overField && drag?.cardType === 'Creature') {
      // Use elementsFromPoint (plural) so we see THROUGH the dragged
      // card. The dragged motion.div sits right under the finger with
      // pointerEvents:auto, so the single-point lookup returned the
      // card itself instead of the slot below — and the slot
      // highlight + slot-targeted drop never engaged. Walk the stack
      // and pick the first ancestor that has a data-slot attribute.
      const stack = document.elementsFromPoint(clientX, clientY) as HTMLElement[];
      for (const el of stack) {
        const slotEl = el.closest('[data-slot]') as HTMLElement | null;
        if (slotEl?.dataset.slot != null) {
          const idx = parseInt(slotEl.dataset.slot);
          if (!isNaN(idx)) { overSlot = idx; break; }
        }
      }
    }
    setDrag(d => d ? { ...d, overField, overSlot } : d);
  };

  /** Called by Framer when the drag ends. If the card was over the field
   *  on release, run the drop logic. Otherwise Framer's dragSnapToOrigin
   *  springs the card back to its hand position automatically — we just
   *  clear our state. */
  const handleDragEnd = (card: BattleCard) => {
    if (!drag) return;
    // Card plays / spell casts are a MAIN-PHASE action. Gate the
    // whole drop here so we don't accidentally summon during Battle.
    if (playerPhase !== 'main') {
      if (drag.overField) flashMsg('Main Phase only');
      setDrag(null);
      return;
    }
    if (card.type === 'Creature') {
      if (drag.overField) {
        const r = playCard(state, 'player', card.battleId);
        if (r.ok) {
          // If the player dropped on a specific free slot, pre-assign it
          // before reconcile runs so the card lands exactly where released.
          if (drag.overSlot != null) {
            const usedSlots = new Set<number>();
            for (const [id, s] of Object.entries(playerSlots)) {
              if (state.player.field.some(c => c.battleId === id)) usedSlots.add(s);
            }
            for (const d of Object.values(dying)) {
              if (d.side === 'player') usedSlots.add(d.slot);
            }
            if (!usedSlots.has(drag.overSlot)) {
              const targetSlot = drag.overSlot;
              setPlayerSlots(s => ({ ...s, [card.battleId]: targetSlot }));
            }
          }
          setState(r.state);
          sfx('summon');
          fireLegendarySummon(card, 'player');
          onCreaturePlayed?.();
        } else {
          flashMsg(r.reason ?? 'Cannot play');
        }
      }
    } else {
      if (isNoTargetSpell(card)) {
        if (drag.overField) castSpell(card, { kind: 'face', owner: 'player' });
      } else if (drag.overField) {
        setPendingSpell(card);
        flashMsg('Select a target');
      }
    }
    setDrag(null);
    // Clear the drag flag on the next tick so an onTap fired on the
    // same gesture release skips. setTimeout 0 is enough — onTap fires
    // synchronously after onDragEnd in Framer's pointer handler chain.
    setTimeout(() => { dragOccurredRef.current = false; }, 0);
  };

  /** Tap a hand card: toggle selection. The card lifts up as a preview. */
  const handleHandTap = (_card: BattleCard, idx: number) => {
    if (state.turn !== 'player' || state.outcome !== 'ongoing') return;
    if (pendingDrawIds.size > 0) return;
    // Selection is allowed even if mana is short — the player can still preview
    // a card. The mana check fires when they actually try to play.
    setSelectedHandIdx(prev => prev === idx ? null : idx);
    setSelectedAttacker(null);
    setPendingSpell(null);
  };

  /** Tap somewhere on the player's field area while a card is selected → play it. */
  const playSelectedToField = () => {
    if (selectedHandIdx === null) return;
    const card = state.player.hand[selectedHandIdx];
    if (!card) { setSelectedHandIdx(null); return; }
    if (playerPhase !== 'main') {
      flashMsg('Main Phase only');
      return;
    }

    if (card.type === 'Creature') {
      const r = playCard(state, 'player', card.battleId);
      if (r.ok) {
        setState(r.state);
        setSelectedHandIdx(null);
        sfx('summon');
        fireLegendarySummon(card, 'player');
        onCreaturePlayed?.();
      } else {
        flashMsg(r.reason ?? 'Cannot play');
      }
    } else {
      if (isNoTargetSpell(card)) {
        castSpell(card, { kind: 'face', owner: 'player' });
      } else {
        // Spell needs a target — graduate from "selected hand card" to "pending spell"
        setPendingSpell(card);
        setSelectedHandIdx(null);
        flashMsg('Tap a target');
      }
    }
  };

  // ============== Player attack ==============
  const playerAttack = (target: 'face' | { battleId: string }) => {
    if (!selectedAttacker) return;
    const attacker = state.player.field.find(c => c.battleId === selectedAttacker);
    if (!attacker) return;
    const result = attack(state, 'player', selectedAttacker,
      target === 'face' ? { kind: 'face' } : { kind: 'creature', battleId: target.battleId });
    if (!result.ok) {
      flashMsg(result.reason ?? 'Cannot attack');
      return;
    }
    let defender: BattleCard | null = null;
    if (target !== 'face') {
      defender = state.opponent.field.find(c => c.battleId === target.battleId) ?? null;
    }
    playAttackAnimation({
      attackerId: attacker.battleId,
      attackerOwner: 'player',
      defenderId: target === 'face' ? 'face' : target.battleId,
      defenderOwner: 'opponent',
      damageToDef: attacker.currentAtk,
      damageToAtk: defender ? defender.currentAtk : 0,
    }, () => {
      setState(result.state);
      setSelectedAttacker(null);
    });
  };

  const handleGoBattle = () => {
    setPlayerPhase('battle');
    setPendingSpell(null);
    setSelectedHandIdx(null);
    const key = Date.now() + 3333;
    setPhaseBanner({ text: 'Battle Phase', side: 'player', key });
    setTimeout(() => setPhaseBanner(cur => (cur && cur.key === key ? null : cur)), 1000);
  };

  const onMyCreatureClick = (c: BattleCard) => {
    if (pendingSpell) return;
    if (state.turn !== 'player' || state.outcome !== 'ongoing') return;
    // Attacks are a Battle-Phase action. In Main Phase, tapping your
    // own creature shouldn't select an attacker — guide the player
    // to the Go-to-Battle button instead.
    if (playerPhase !== 'battle') {
      flashMsg('Tap "Go to Battle" first');
      return;
    }
    if (c.tapped || c.justPlayed) { flashMsg('Cannot attack yet'); return; }
    setSelectedAttacker(prev => prev === c.battleId ? null : c.battleId);
  };

  const onOppCreatureClick = (c: BattleCard) => {
    if (pendingSpell) {
      castPendingAt({ kind: 'creature', owner: 'opponent', battleId: c.battleId });
      return;
    }
    if (selectedAttacker) { playerAttack({ battleId: c.battleId }); return; }
    // No attack/spell context — surface the card details so desktop users can
    // read what an enemy creature does without a long-press.
    setInspect(c);
  };

  const onOppFaceClick = () => {
    if (pendingSpell) {
      castPendingAt({ kind: 'face', owner: 'opponent' });
      return;
    }
    if (selectedAttacker) {
      playerAttack('face');
      return;
    }
    setInfoSide('opponent');
  };

  const onMyFaceClick = () => {
    if (pendingSpell) {
      castPendingAt({ kind: 'face', owner: 'player' });
      return;
    }
    setInfoSide('player');
  };

  const castPendingAt = (target: SpellTarget) => {
    if (!pendingSpell) return;
    castSpell(pendingSpell, target);
  };

  const cancelPending = () => setPendingSpell(null);

  const onEndTurn = () => {
    if (state.turn !== 'player' || state.outcome !== 'ongoing') return;
    setSelectedAttacker(null);
    setPendingSpell(null);
    showMsg(`${boss.name}'s turn`);
    const key = Date.now() + 5555;
    setPhaseBanner({ text: 'End Phase', side: 'player', key });
    setTimeout(() => setPhaseBanner(cur => (cur && cur.key === key ? null : cur)), 1800);
    holdAnim(1900);
    setState(s => endTurn(s));
  };

  // ============== Game over ==============
  if (state.outcome !== 'ongoing') {
    return (
      <MatchEnd
        outcome={state.outcome}
        boss={boss}
        difficulty={difficulty}
        alreadyBeaten={alreadyBeaten}
        playerHp={state.player.hp}
        opponentHp={state.opponent.hp}
        turnLimitReached={state.turnNumber > TURN_LIMIT}
        victoryEmote={victoryEmote}
        onExit={onExit}
      />
    );
  }

  const bossElement = ELEMENTS[boss.themeId];

  // Per-side bond lookups for the link badge on each card. With first-
  // bond-wins, a card is 'active' if and only if it appears in one of
  // the side's CLAIMED bonds (engine-side `claimedBonds`). Otherwise the
  // card is 'waiting' if it has any potential bond at all — partner not
  // yet present, or partner is locked into another bond. The visual is
  // exclusive: each card shows exactly one bond state, mirroring the
  // engine's exclusive claims.
  const bondLookupFor = (p: PlayerState): Record<string, 'active' | 'waiting'> => {
    const out: Record<string, 'active' | 'waiting'> = {};
    const lockedCards = new Set<string>();
    for (const b of activeBonds(p)) {
      lockedCards.add(b.cardA);
      lockedCards.add(b.cardB);
    }
    for (const c of p.field) {
      const myBonds = BONDS.filter(b => b.cardA === c.id || b.cardB === c.id);
      if (myBonds.length === 0) continue;
      out[c.id] = lockedCards.has(c.id) ? 'active' : 'waiting';
    }
    return out;
  };
  const playerBondLookup = bondLookupFor(state.player);
  const opponentBondLookup = bondLookupFor(state.opponent);
  const playerActiveBonds = activeBonds(state.player);
  const opponentActiveBonds = activeBonds(state.opponent);

  return (
    // Wrap the match render with a nested CosmeticsProvider that flips
    // inMatch on. Card's frame logic gates on (owned && inMatch), so
    // this is where the equipped frame "activates" — every Card
    // outside the match (Collection, DeckBuilder, Capture, Cosmetics
    // locker) stays in its baseline chrome.
    <CosmeticsProvider
      frame={cosmetics.frame}
      boardSkin={cosmetics.boardSkin}
      emote={cosmetics.emote}
      inMatch
    >
    <div
      ref={boardRef}
      // Drag handlers moved off the board root — each motion.div in the
      // hand owns its own drag lifecycle via Framer Motion now.
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        width: '100%', height: '100%',
        // Two layers: the player's equipped board skin paints the bedrock
        // gradient, and the boss's element tint sits on top to keep each
        // fight ambient-coloured. Order matters — boss tint must follow so
        // semi-transparent stops layer on top of the chosen skin.
        background: `
          radial-gradient(ellipse at 50% 50%, transparent 0%, ${bossElement.color}26 60%, ${bossElement.deep}33 100%),
          ${boardSkin.background}
        `,
        position: 'relative', overflow: 'hidden',
        fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
        color: PALETTE.text,
        userSelect: 'none', touchAction: 'none',
        // Switched from absolute pixel positioning to flex column so the
        // playfield adapts to any viewport height. On mobile the player's
        // own field used to fall outside the visible area; this layout
        // anchors the hand to the bottom and grows / shrinks the spacers
        // around the field rows automatically.
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Themed boss backdrop removed — the blurred photo behind the
          field competed with the player's own card photos and made the
          board feel busy. The equipped board skin + the boss element
          tint above it carry enough atmosphere on their own. */}

      {/* Stage texture — a faint repeating grid + radial vignette suggesting
          a duel mat under the field. Pure CSS, no image asset, very low
          contrast so it never competes with cards. Sits above the backdrop
          but below all gameplay content. */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(58,46,42,.10) 100%),
          repeating-linear-gradient(0deg, rgba(58,46,42,.035) 0 1px, transparent 1px 8px),
          repeating-linear-gradient(90deg, rgba(58,46,42,.025) 0 1px, transparent 1px 16px)
        `,
        zIndex: 0,
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
      }} />

      {/* Pre-match coin flip — runs once at mount, then unblocks the rest of
          the game. The actual first-turn decision lives in createMatch; this
          is just the cosmetic reveal. */}
      {flipping && (
        <CoinFlip
          result={state.turn}
          bossAvatar={boss.avatar}
          bossName={boss.name}
          onDone={() => setFlipping(false)}
        />
      )}

      {/* Faint hex pattern under everything — gives the playmat texture. */}
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }} width="100%" height="100%">
        <defs>
          <pattern id="hex" width="30" height="26" patternUnits="userSpaceOnUse">
            <polygon points="15,1 28,8 28,22 15,29 2,22 2,8" fill="none" stroke={PALETTE.accent} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)" />
      </svg>

      {/* Opponent header strip — mirrors the player stats row at the bottom:
          portrait + mana on the left, deck + graveyard on the right. The
          give-up flag moved to the divider band so it sits next to End Turn. */}
      <div ref={oppHeaderRef} style={{ flex: '0 0 auto', height: 64, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5, gap: 6, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <OpponentPortrait
            boss={boss}
            themeColor={bossElement.color}
            themeDeep={bossElement.deep}
            hp={state.opponent.hp}
            highlight={pendingSpell ? 'spell' : selectedAttacker ? 'attack' : null}
            onClick={onOppFaceClick}
            damage={damages[FACE_OPP] ?? null}
            elRef={(el) => registerEl(FACE_OPP, el)}
          />
          <ManaCrystals mana={state.opponent.mana} maxMana={state.opponent.maxMana} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GraveyardButton
            count={state.opponent.discard.length}
            onClick={() => setGraveyardOpen('opponent')}
            elRef={(el) => registerEl(GRAVE_OPP, el)}
            pulseKey={gravePulseKey.opponent}
          />
        </div>
      </div>

      {/* Top spacer — empty flex space that keeps the opponent field row
          vertically balanced with the player field. The hand fan is hidden
          to keep the battlefield clean; draws still show the fly animation. */}
      <div style={{ flex: '1 1 auto', minHeight: 8 }} />

      {/* Opponent's creature row. Stacked above the divider (zIndex 4) so
          damage/buff popups that overshoot upward off the card render on top
          of the divider strip and its End Turn / Give Up buttons. */}
      <div style={{
        flex: '0 0 auto', minHeight: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
        zIndex: 6,
        position: 'relative',
        paddingBottom: 4,
      }}>
        {/* Opponent bond pills sit ABOVE the cards (closer to the top
            of the screen) so the boss's bonds read as "their" bonds,
            mirroring the player's pills which sit below the player's
            cards. Bond arcs below extend on the OUTSIDE edge of each
            field accordingly. */}
        <BondPillStack bonds={opponentActiveBonds} newlyActiveIds={newOppBonds} side="opponent" onPillRef={(id, el) => { if (el) bondPillEls.current.set(id, el); else bondPillEls.current.delete(id); }} />
        <FieldRow
          side="opponent"
          cards={state.opponent.field}
          dying={dying}
          turn={state.turn}
          combat={combat}
          damages={damages}
          buffs={buffs}
          silencedAt={silencedAt}
          triggers={triggers}
          selectedAttacker={selectedAttacker}
          pendingSpell={pendingSpell}
          bondLookup={opponentBondLookup}
          slotMap={opponentSlots}
          registerEl={registerEl}
          onCardClick={(c) => onOppCreatureClick(c)}
          onCardLongPress={(c) => setInspect(c)}
        />
      </div>

      {/* Center divider band — the drop zone for drag-to-summon. Dashed top
          + bottom borders intensify when a card is dragged into it. End Turn
          button (or "Release to summon" hint during drag) lives here. The
          phase label floats inside this band as an absolute child with
          pointer-events off so it never fights the button for clicks. */}
      {/* Center divider band — 3-column flex: [left cluster] [center text] [right button].
          Phase/turn banners are overlaid inside this band so they appear exactly
          at the divider's position, not floating over the field. */}
      {(() => {
        const isPlayer = state.turn === 'player';
        const inBattle = isPlayer && playerPhase === 'battle';
        const handleClick = inBattle ? onEndTurn : handleGoBattle;
        const centerText = drag?.overField
          ? (drag.cardType === 'Creature' ? '↓ Summon ↓' : '↓ Choose target ↓')
          : pendingSpell
            ? spellTargetHint(pendingSpell)
            : (msg !== 'Your turn' && msg !== `${boss.name}'s turn` ? msg : '');
        const activeBanner = phaseBanner
          ? { key: phaseBanner.key, owner: phaseBanner.side === 'player' ? 'YOUR' : `${boss.name.toUpperCase()}'S`, text: phaseBanner.text }
          : turnBanner
            ? { key: turnBanner, owner: turnBanner === 'player' ? 'YOUR' : `${boss.name.toUpperCase()}'S`, text: 'TURN' }
            : null;
        return (
          <div ref={fieldRef} style={{
            flex: '0 0 56px',
            display: 'flex', alignItems: 'center',
            padding: '0 12px',
            gap: 8,
            borderTop: drag?.overField ? '2px dashed #f4d04a' : '1px dashed rgba(58,46,42,.20)',
            borderBottom: drag?.overField ? '2px dashed #f4d04a' : '1px dashed rgba(58,46,42,.20)',
            background: drag?.overField ? 'rgba(244,208,74,.12)' : 'rgba(255,255,255,.30)',
            transition: 'background .15s, border-color .15s',
            zIndex: 4, position: 'relative',
          }}>
            {/* Left: turn counter + give-up */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <TurnChip turnNumber={state.turnNumber} limit={TURN_LIMIT} />
              <button onClick={() => setConfirmGiveUp(true)} aria-label="Give up" style={iconBtn}>
                <Flag size={16} strokeWidth={2.4} />
              </button>
            </div>

            {/* Center: static context text — always in flow, never
                absolute. Color flips to a light palette on dark board
                skins (Twilight, Inkwell) so the message stays readable;
                light skins keep the warm brown so the chip blends with
                the daylight backdrop. */}
            <div style={{
              flex: 1, textAlign: 'center', pointerEvents: 'none',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: boardSkin.isDark ? 'rgba(255,255,255,.85)' : PALETTE.textMid,
              textShadow: boardSkin.isDark ? '0 1px 2px rgba(0,0,0,.45)' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {centerText}
            </div>

            {/* Right: cancel (while casting) or phase action button */}
            {pendingSpell ? (
              <button onClick={cancelPending} aria-label="Cancel" style={{
                flexShrink: 0,
                background: '#fff', color: PALETTE.text,
                border: `1.5px solid ${PALETTE.border}`,
                borderRadius: '50%', width: 28, height: 28, fontSize: 14,
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 2px 6px rgba(58,46,42,.08)',
                display: 'grid', placeItems: 'center',
              }}>×</button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); if (isPlayer && !combat) handleClick(); }}
                // Lock End Turn / Go to Battle while a combat animation
                // is playing. The player could otherwise queue an attack
                // and immediately tap End Turn, which races the state
                // machine — the attack's deferred setState would land
                // after endTurn flipped the turn, crashing the boss AI
                // pipeline.
                disabled={!isPlayer || !!combat}
                aria-label={inBattle ? 'End Turn' : 'Go to Battle'}
                style={{
                  ...iconBtn, flexShrink: 0,
                  opacity: !isPlayer || combat ? 0.4 : 1,
                  cursor: !isPlayer || combat ? 'not-allowed' : 'pointer',
                  color: !isPlayer || combat ? PALETTE.textMid : PALETTE.text,
                }}
              >
                {inBattle ? <ChevronsRight size={18} strokeWidth={2.4} /> : <Swords size={18} strokeWidth={2.2} />}
              </button>
            )}

            {/* Phase / turn banner — overlaid inside the divider strip so it
                lands exactly at the divider's position. Same dark/gold style
                for every phase (Main, Battle, End, Turn). */}
            {activeBanner && (
              <div
                key={String(activeBanner.key)}
                style={{
                  position: 'absolute', inset: 0,
                  zIndex: 8, pointerEvents: 'none',
                  animation: 'ygoPhaseEnter 950ms cubic-bezier(.25,.8,.3,1) both',
                  background: 'linear-gradient(90deg, #1a1008 0%, #3a2810 20%, #2a1e0c 50%, #3a2810 80%, #1a1008 100%)',
                  borderTop: '1.5px solid rgba(244,208,74,.35)',
                  borderBottom: '1.5px solid rgba(244,208,74,.35)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 1,
                }}
              >
                <div style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.28em',
                  textTransform: 'uppercase', color: 'rgba(244,208,74,.65)',
                  animation: 'ygoPhaseLabel 950ms ease both',
                  fontFamily: '"Inter", system-ui',
                }}>{activeBanner.owner}</div>
                <div style={{
                  fontSize: 17, fontWeight: 900, letterSpacing: '0.16em',
                  textTransform: 'uppercase', color: '#f4d04a',
                  textShadow: '0 2px 8px rgba(0,0,0,.7), 0 0 14px rgba(244,208,74,.4)',
                  fontFamily: '"Fredoka", system-ui',
                  animation: 'ygoPhaseLabel 950ms ease both',
                }}>{activeBanner.text}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Player's creature row — drop zone for drag-to-summon. Tapping it
          alone no longer summons (use the Summon button on the centered
          preview instead) — that prevents accidental plays. */}
      <div
        ref={playerFieldRef}
        style={{
          flex: '0 0 auto', minHeight: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 4,
          zIndex: 6,
          background: drag?.overField ? 'rgba(244,208,74,.10)' : 'transparent',
          transition: 'background .15s',
          position: 'relative',
          paddingTop: 4,
        }}
      >
        <FieldRow
          side="player"
          cards={state.player.field}
          dying={dying}
          turn={state.turn}
          battlePhaseActive={playerPhase === 'battle'}
          combat={combat}
          damages={damages}
          buffs={buffs}
          silencedAt={silencedAt}
          triggers={triggers}
          selectedAttacker={selectedAttacker}
          pendingSpell={pendingSpell}
          bondLookup={playerBondLookup}
          slotMap={playerSlots}
          registerEl={registerEl}
          onCardClick={(c) => {
            const ak = pendingSpell?.abilityKind;
            if (ak === 'spell_buff' || ak === 'spell_nourish' || ak === 'spell_heal_friend') {
              castPendingAt({ kind: 'creature', owner: 'player', battleId: c.battleId });
            } else {
              onMyCreatureClick(c);
            }
          }}
          onCardLongPress={(c) => setInspect(c)}
        />
        <BondPillStack bonds={playerActiveBonds} newlyActiveIds={newPlayerBonds} side="player" onPillRef={(id, el) => { if (el) bondPillEls.current.set(id, el); else bondPillEls.current.delete(id); }} />
      </div>

      {/* Bottom spacer */}
      <div style={{ flex: '1 1 auto', minHeight: 4 }} />

      {/* Player stats — HP + mana on the left, deck + graveyard on the right. */}
      <div style={{ flex: '0 0 auto', height: 56, padding: '0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, zIndex: 6, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlayerPortrait
            hp={state.player.hp}
            avatar={playerAvatar}
            highlight={pendingSpell?.abilityKind === 'spell_heal' ? 'heal' : null}
            onClick={onMyFaceClick}
            damage={damages[FACE_PLAYER] ?? null}
            elRef={(el) => registerEl(FACE_PLAYER, el)}
          />
          <ManaCrystals mana={state.player.mana} maxMana={state.player.maxMana} pulseKey={manaPulse} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GraveyardButton
            count={state.player.discard.length}
            onClick={() => setGraveyardOpen('player')}
            elRef={(el) => registerEl(GRAVE_PLAYER, el)}
            pulseKey={gravePulseKey.player}
          />
        </div>
      </div>

      {/* Hand — flat row anchored to the bottom. Tapping a card lifts the
          centered preview above; the hand cards themselves stay put so the
          leftmost card never gets clipped on narrow viewports. */}
      <div style={{
        flex: '0 0 220px',
        position: 'relative',
        pointerEvents: 'none',
      }}>
        {(initialDealing ? state.player.hand.slice(0, playerInitialDealt) : state.player.hand)
          .filter(card => !pendingDrawIds.has(card.battleId))
          .map((card, i, visibleHand) => {
          // Spells in mid-cast use a centered reveal animation —
          // hide the hand card while that plays so the player only
          // sees one copy. The dragged card, in contrast, STAYS
          // mounted: Framer Motion translates it in place, so we
          // never want a duplicate ghost.
          const isCasting = playerSpellReveal?.battleId === card.battleId;
          if (isCasting) return null;
          const cardCount = visibleHand.length;
          const offset = i - (cardCount - 1) / 2;
          const isSelected = selectedHandIdx === i && !drag;
          // Unaffordable = not enough mana. Bond discounts (Reporting Line)
          // are baked into effectiveCost so a discounted spell shows as
          // playable even at its on-card cost. We don't tint cards red just
          // because it's the boss's turn — that'd flash every card every turn.
          const playableNow = effectiveCost(state.player, card) <= state.player.mana;
          const baseScale = 0.56;
          const cardW = 220 * baseScale;
          // Tighter stride + per-card rotation = a real fan instead of a
          // flat row, mirroring the opponent's face-down fan at the top.
          const stride = cardCount <= 3 ? 80
                       : cardCount <= 4 ? 60
                       : cardCount <= 5 ? 48
                       : cardCount <= 6 ? 38
                       : 32;
          const xOff = offset * stride;
          const rot = cardCount === 1 ? 0 : offset * 6;            // edges fan outward
          const yArc = Math.abs(offset) * 3;                       // edges sink slightly
          // Drag is enabled only when the player can actually act. We
          // skip the drag wrapper entirely otherwise so a non-active
          // hand card can still be tapped (tap = preview) without
          // accidentally engaging Framer's drag threshold.
          const canDrag = state.turn === 'player' && state.outcome === 'ongoing' && pendingDrawIds.size === 0;
          const isDraggingThis = drag?.battleId === card.battleId;
          // Pose only changes when the card is SELECTED for preview
          // (lifted + straightened at center). While DRAGGING we keep
          // the fan pose untouched — animating rotate/y during drag
          // start caused the card to "jump" out from under the
          // finger as those values transitioned, which read as the
          // sluggish/weird touch behavior. With the fan pose held,
          // Framer's drag handler is the only thing moving the card,
          // and `whileDrag` adds a clean scale + shadow lift cue
          // without competing with the drag translation.
          //
          // We still push rotation + offset through motion's `rotate`
          // and `y` so the motion.div itself is rotated — that way
          // browser hit-testing uses the rotated bounds, not the
          // axis-aligned rect (adjacent fanned cards would otherwise
          // overlap and a click on one would land on a neighbour).
          const poseRot = isSelected ? 0 : rot;
          const poseY = isSelected ? -12 : yArc;
          return (
            <motion.div
              key={card.battleId}
              // `layout` springs the card to its new position whenever
              // the fan reflows (e.g. a card leaves). Framer measures
              // the bounding box before/after and animates the
              // transition via transform — totally separate from
              // Framer's drag, which owns its own x motion value.
              layout
              drag={canDrag}
              dragSnapToOrigin
              dragMomentum={false}
              // dragElastic only matters when constraints are set; we
              // leave drag unconstrained so the card follows the
              // finger 1:1. Spring on release returns to the fan slot
              // — stiffness/damping picked so the snap-back is fast
              // enough to feel responsive (~250 ms) without
              // overshooting noticeably.
              dragElastic={1}
              dragTransition={{ bounceStiffness: 700, bounceDamping: 36 }}
              initial={false}
              // Pose only — rotation and y-lift for selected/dragged
              // states. x is NOT in animate; the card's horizontal slot
              // is set via the static `left` style below and gets
              // re-animated by `layout` on changes. This separation
              // prevents the mobile race we had where animate.x kept
              // re-asserting xOff against Framer's drag write during
              // the gesture, leaving cards in the wrong slot on release.
              animate={{ rotate: poseRot, y: poseY }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onDragStart={() => handleDragStart(card)}
              onDrag={(_, info) => handleDrag(info.point.x, info.point.y)}
              onDragEnd={() => handleDragEnd(card)}
              onTap={() => {
                if (!canDrag) return;
                // Bail if a drag just ended on this same gesture —
                // Framer can fire onTap synchronously after onDragEnd
                // and the stale closure would select a shifted index.
                if (dragOccurredRef.current) return;
                const idx = state.player.hand.findIndex(c => c.battleId === card.battleId);
                if (idx >= 0) handleHandTap(card, idx);
              }}
              // While dragging, scale up slightly and add a strong
              // shadow so the card visibly "lifts off" the hand under
              // the finger. Bigger scale + shadow than the previous
              // 1.08 / soft shadow because on touch you want a clear
              // "I'm holding this" signal — the card needs to read as
              // distinctly elevated above its neighbours.
              whileDrag={{
                cursor: 'grabbing',
                scale: 1.15,
                filter: 'drop-shadow(0 16px 28px rgba(0,0,0,.55))',
              }}
              style={{
                position: 'absolute',
                bottom: 0,
                // Horizontal slot lives in static CSS so drag's x
                // motion value never has to fight it. `layout` above
                // springs to the new `left` whenever the fan reshapes.
                left: `calc(50% + ${xOff}px)`,
                marginLeft: -cardW / 2,
                width: cardW,
                height: 320 * baseScale,
                transformOrigin: 'bottom center',
                zIndex: isDraggingThis ? 200 : isSelected ? 60 : 10 + i,
                cursor: canDrag ? 'grab' : 'pointer',
                touchAction: 'none',
                // The hand container is pointerEvents:none so the empty
                // space between cards doesn't catch clicks. Each card
                // must opt back in or taps/drags won't register.
                pointerEvents: 'auto',
                // The selected card hides (the centered preview takes
                // its place); every OTHER hand card stays at full
                // opacity so the player can still see what's in hand
                // while reading the preview.
                opacity: isSelected ? 0 : 1,
                transition: 'opacity .15s',
                willChange: 'transform',
                // Visual flourishes that don't conflict with the
                // transform pipeline above.
                filter: isSelected ? 'drop-shadow(0 0 14px rgba(244,208,74,.7))' : 'none',
                animation: playableNow && state.turn === 'player' && !isSelected && !isDraggingThis && playerPhase === 'main'
                  ? 'playablePulse 2.4s ease-in-out infinite'
                  : undefined,
              }}
            >
              <Card card={card} scale={baseScale} hovered={isSelected || isDraggingThis} unaffordable={!playableNow} />
            </motion.div>
          );
        })}
      </div>

      {/* Backdrop — when a hand card is being previewed, dim the rest of the
          screen and block clicks to anything BUT the hand and the preview
          itself. Tapping the dim area dismisses. Without this you could
          accidentally hit the End Turn button while reading a card. */}
      {selectedHandIdx !== null && !drag && (
        <div
          onClick={() => setSelectedHandIdx(null)}
          style={{
            // Transparent click-catcher that captures taps outside the
            // centered preview to dismiss. No background tint — the
            // earlier dim layer read as "a dark box appeared behind my
            // card" rather than helpful focus.
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 220,
            background: 'transparent',
            zIndex: 88,
            cursor: 'pointer',
          }}
          aria-label="Cancel preview"
        />
      )}

      {/* Centered hand-card preview — rendered above the hand when a card is
          tapped. Has an explicit Summon / Cast button so accidentally tapping
          the field doesn't auto-play the card. */}
      {selectedHandIdx !== null && state.player.hand[selectedHandIdx] && !drag && (() => {
        const card = state.player.hand[selectedHandIdx];
        const playableNow = effectiveCost(state.player, card) <= state.player.mana && state.turn === 'player';
        const isSpell = card.type === 'Spell';
        const needsTarget = isSpell && !isNoTargetSpell(card);
        const actionLabel = !playableNow
          ? (state.turn !== 'player' ? "Wait — it's their turn" : 'Not enough mana')
          : isSpell
            ? (needsTarget ? 'Cast Spell →' : 'Cast')
            : 'Summon';
        return (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 200,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              zIndex: 90,
              pointerEvents: 'none',
              animation: 'fadeIn 0.15s',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                // While deploying, replace the entry keyframe with the
                // deploy keyframe so the preview card visibly flies up
                // toward the field before vanishing into the slot.
                animation: deploying
                  ? 'deployToField .5s cubic-bezier(.4,.6,.3,1) forwards'
                  : 'cardSummon 0.28s cubic-bezier(.2,.8,.3,1)',
                filter: 'drop-shadow(0 12px 28px rgba(0,0,0,.35))',
                // Card image catches its own clicks so tapping the preview
                // doesn't fall through to the backdrop and dismiss. Action
                // happens via Cancel / Summon below.
                pointerEvents: 'auto',
              }}
            >
              <Card card={card} scale={0.95} hovered unaffordable={!playableNow} />
            </div>
            <div style={{ display: 'flex', gap: 10, pointerEvents: 'auto', opacity: deploying ? 0 : 1, transition: 'opacity .15s' }}>
              <button
                onClick={() => setSelectedHandIdx(null)}
                disabled={deploying}
                style={{
                  background: '#fff', color: PALETTE.text,
                  border: `1.5px solid ${PALETTE.border}`,
                  borderRadius: 18, padding: '10px 18px',
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 10px rgba(58,46,42,.15)',
                }}
              >Close</button>
              {playerPhase !== 'battle' && <button
                onClick={() => {
                  if (!playableNow || deploying) return;
                  if (card.type === 'Creature') {
                    // Hold the state update until the deploy animation lands
                    // so the player visibly sees the card travel to the field.
                    setDeploying(true);
                    setTimeout(() => {
                      playSelectedToField();
                      setDeploying(false);
                    }, 480);
                  } else {
                    // Spells already have their centered reveal; no deploy.
                    playSelectedToField();
                  }
                }}
                disabled={!playableNow || deploying}
                style={{
                  background: playableNow
                    ? 'linear-gradient(180deg, #ffa07a, #ff7e5f)'
                    : '#e8d8c8',
                  color: playableNow ? '#fff' : '#9a8678',
                  border: 'none',
                  borderRadius: 18, padding: '10px 22px',
                  fontSize: 13, fontWeight: 800,
                  letterSpacing: '0.04em',
                  cursor: playableNow ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  boxShadow: playableNow ? '0 4px 14px rgba(255,94,60,.4)' : 'none',
                }}
              >{actionLabel}</button>}
            </div>
          </div>
        );
      })()}

      {/* Legacy fixed-position drag ghost removed — the hand card now
          moves in place via Framer Motion's drag, so a separate ghost
          would render a duplicate copy. */}

      {/* Card draw flights — one DOM node per in-flight card-back so that
          a multi-draw (Suitcase = 2, Reflecting Pool = 2) shows TWO
          distinct cards trailing each other, the same way the opening
          deal felt. Each entry's React key is the unique flight id so
          its animation never gets overwritten by a sibling. */}
      {drawFlights.map(f => f.side === 'player' ? (
        <div
          key={`draw-p-${f.id}`}
          style={{
            position: 'absolute', bottom: 70, right: 30,
            animation: 'drawFlyPlayer 1.1s cubic-bezier(.3,.7,.4,1) forwards',
            pointerEvents: 'none',
            zIndex: 95,
            filter: 'drop-shadow(0 8px 18px rgba(58,46,42,.5))',
          }}
        >
          <CardBack scale={0.5} />
        </div>
      ) : (
        <div
          key={`draw-o-${f.id}`}
          style={{
            position: 'absolute', top: 30, right: 30,
            animation: 'drawFlyOpp 1.1s cubic-bezier(.3,.7,.4,1) forwards',
            pointerEvents: 'none',
            zIndex: 95,
            filter: 'drop-shadow(0 8px 18px rgba(58,46,42,.5))',
          }}
        >
          <CardBack scale={0.5} />
        </div>
      ))}

      {/* Spell-target burst — colored ring + glow that lands on whichever
          creature (or face) a spell was aimed at, just as the spell resolves. */}
      {spellFx && (() => {
        const palette = spellFx.kind === 'damage' ? { core: '#ff5a5a', glow: '#ff7e5f', ring: '#c8362e' }
          : spellFx.kind === 'freeze' ? { core: '#9ed6f7', glow: '#3a8fc4', ring: '#1c5478' }
          : spellFx.kind === 'buff'   ? { core: '#7be8a4', glow: '#06d6a0', ring: '#0a8060' }
          : spellFx.kind === 'silence' ? { core: '#dad0c4', glow: '#7a6e62', ring: '#3a2e2a' }
          :                              { core: '#ffe9a8', glow: '#f4d04a', ring: '#c8901a' };
        return (
          <>
            <div style={{
              position: 'absolute', left: spellFx.x, top: spellFx.y,
              width: 110, height: 110, borderRadius: '50%',
              background: `radial-gradient(circle, ${palette.core} 0%, ${palette.glow}cc 40%, transparent 75%)`,
              boxShadow: `0 0 28px ${palette.glow}, 0 0 60px ${palette.glow}88`,
              animation: 'spellTargetBurst 700ms ease-out forwards',
              pointerEvents: 'none',
              zIndex: 175,
            }} />
            <div style={{
              position: 'absolute', left: spellFx.x, top: spellFx.y,
              width: 90, height: 90, borderRadius: '50%',
              border: `4px solid ${palette.ring}`,
              animation: 'spellTargetRing 700ms ease-out forwards',
              pointerEvents: 'none',
              zIndex: 176,
            }} />
          </>
        );
      })()}

      {/* Attack FX — a glowing projectile arcs from attacker to defender,
          a guide line traces behind it, a shockwave bursts on impact, and
          if the defender is the player's face we flash a red vignette
          around the screen edge so taking damage feels like *taking
          damage* and not just a number changing. */}
      {arrow && (() => {
        const len = Math.hypot(arrow.x2 - arrow.x1, arrow.y2 - arrow.y1);
        const isFaceTarget = combat?.defenderId === 'face';
        const isPlayerFaceHit = isFaceTarget && combat?.defenderOwner === 'player';
        const lineStyle: React.CSSProperties & Record<string, string | number> = {
          strokeDasharray: len,
          animation: 'arrowDraw 0.7s ease-out forwards',
          ['--len' as string]: `${len}px`,
          filter: 'drop-shadow(0 0 6px rgba(238,90,82,.8))',
        };
        // Projectile lives in stage-local CSS pixels via inline vars.
        const projectileStyle: React.CSSProperties & Record<string, string | number> = {
          position: 'absolute', top: 0, left: 0,
          width: 26, height: 26, borderRadius: '50%',
          background: 'radial-gradient(circle, #fff 0%, #ffd166 35%, #ee5a52 70%, transparent 100%)',
          boxShadow: '0 0 18px rgba(238,90,82,.95), 0 0 36px rgba(238,90,82,.7)',
          animation: 'attackProjectile .7s cubic-bezier(.3,.7,.4,1) forwards',
          pointerEvents: 'none',
          zIndex: 152,
          ['--x0' as string]: `${arrow.x1 - 13}px`,
          ['--y0' as string]: `${arrow.y1 - 13}px`,
          ['--x1' as string]: `${arrow.x2 - 13}px`,
          ['--y1' as string]: `${arrow.y2 - 13}px`,
        };
        return (
          <>
            <svg style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: 'none', zIndex: 150,
            }}>
              <line
                x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2}
                stroke="#ee5a52" strokeWidth={5} strokeLinecap="round"
                style={lineStyle}
              />
            </svg>

            {/* Glowing projectile orb travelling along the line */}
            <div style={projectileStyle} />

            {/* Big shockwave at the impact point on arrival */}
            <div style={{
              position: 'absolute',
              left: arrow.x2, top: arrow.y2,
              width: 110, height: 110, borderRadius: '50%',
              border: '4px solid rgba(255,209,102,.9)',
              boxShadow: '0 0 30px rgba(255,158,90,.7), inset 0 0 20px rgba(238,90,82,.5)',
              animation: 'attackShockwave .55s ease-out .35s forwards',
              opacity: 0,
              pointerEvents: 'none',
              zIndex: 151,
            }} />

            {/* Red vignette around the screen when the player's face is hit */}
            {isPlayerFaceHit && (
              <div style={{
                position: 'absolute', inset: 0,
                pointerEvents: 'none',
                zIndex: 200,
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(238,90,82,0) 55%, rgba(238,90,82,.55) 100%)',
                animation: 'faceHitVignette .7s ease-out .35s forwards',
                opacity: 0,
              }} />
            )}
          </>
        );
      })()}

      {/* Fatigue callout — fires when either side took damage from drawing
          from an empty deck. Anchors over the affected portrait via the
          cardEls map (FACE_PLAYER / FACE_OPP) so it pops up exactly where
          the damage came from. Includes a dark vignette around the screen
          edge for the player's own fatigue so it's unmissable. */}
      {fatigueFx && (() => {
        const key = fatigueFx.side === 'player' ? FACE_PLAYER : FACE_OPP;
        const el = cardEls.current.get(key);
        if (!el || !boardRef.current) return null;
        const board = boardRef.current.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2 - board.left;
        const y = r.top - board.top;
        const isPlayer = fatigueFx.side === 'player';
        return (
          <>
            <div
              key={`fatigue-${fatigueFx.tick}`}
              style={{
                position: 'absolute', left: x, top: y - 4,
                pointerEvents: 'none',
                zIndex: 210,
                animation: 'fatiguePopup 1.6s ease-out forwards',
                fontFamily: '"Fredoka", system-ui',
                color: '#fff',
                background: 'linear-gradient(180deg, #6e3a32, #3a1410)',
                padding: '6px 12px',
                borderRadius: 14,
                boxShadow: '0 0 0 2px rgba(255,255,255,.85), 0 0 18px rgba(140,40,40,.85), 0 4px 10px rgba(0,0,0,.45)',
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6,
                fontWeight: 800,
              }}
            >
              <Skull size={16} strokeWidth={2.6} />
              <span style={{ fontSize: 11, letterSpacing: '0.18em' }}>FATIGUE</span>
              <span style={{ fontSize: 16 }}>−{fatigueFx.dmg}</span>
            </div>
            {isPlayer && (
              <div
                key={`fatigue-vignette-${fatigueFx.tick}`}
                style={{
                  position: 'absolute', inset: 0,
                  pointerEvents: 'none',
                  zIndex: 199,
                  background: 'radial-gradient(ellipse at center, transparent 35%, rgba(58,20,16,0) 55%, rgba(58,20,16,.65) 100%)',
                  animation: 'fatigueVignette 1.4s ease-out forwards',
                  opacity: 0,
                }}
              />
            )}
          </>
        );
      })()}

      {/* Bond activation cinematic — staged across ~3.4s so each beat is
          readable: cards slide in from the sides → link icon spawns in the
          middle → gold beam draws between them → "BOND ACTIVATED" tag and
          name drop in → description fades in below. Card scale is small
          enough (0.55) to fit on phone widths without clipping; the
          container is clamped at 95vw with reduced gap on narrow screens. */}
      {bondCinematic && (() => {
        const isPlayer = bondCinematic.side === 'player';
        // Total duration of the cinematic. Auto-dismiss timer in the diff
        // effect uses ~3.4s; keep these in sync.
        return (
          <div
            key={`bond-cine-${bondCinematic.bond.id}-${bondCinematic.side}`}
            style={{
              position: 'absolute', inset: 0,
              display: 'grid', placeItems: 'center',
              zIndex: 230,
              pointerEvents: 'none',
              background: 'rgba(0,0,0,.45)',
              animation: 'fadeIn .35s ease-out, bondCineFadeOut .4s ease-in 3s forwards',
              padding: '8px 12px',
            }}
          >
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 10,
              maxWidth: '95vw',
            }}>
              {/* "BOND ACTIVATED" tag — drops in after the cards + beam settle. */}
              <div style={{
                background: 'linear-gradient(180deg, #ffe89a 0%, #f4d04a 100%)',
                color: '#3a2406',
                padding: '6px 14px', borderRadius: 14,
                fontFamily: '"Fredoka", system-ui',
                fontSize: 11, letterSpacing: '0.25em', fontWeight: 800,
                boxShadow: '0 8px 22px rgba(244,208,74,.45), 0 0 0 2px rgba(255,255,255,.6)',
                animation: 'bondTextDrop .5s cubic-bezier(.2,.8,.3,1.2) 1.5s both',
              }}>
                {isPlayer ? 'BOND ACTIVATED' : `${boss.name.toUpperCase()}'S BOND`}
              </div>
              {/* Bond name — bigger drop-in just after the tag. */}
              <div style={{
                fontSize: 26, fontWeight: 800,
                background: 'linear-gradient(180deg, #ff9f1c, #ee5a52)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontFamily: '"Fredoka", system-ui',
                textShadow: '0 2px 0 rgba(255,255,255,.4)',
                lineHeight: 1,
                textAlign: 'center',
                animation: 'bondTextDrop .5s cubic-bezier(.2,.8,.3,1.2) 1.7s both',
              }}>
                {bondCinematic.bond.name}
              </div>
              {/* Cards row — small enough (scale 0.55) to fit two-up on a
                  phone. The connecting beam is positioned absolutely behind
                  the link icon so it visually grows from the icon outward. */}
              <div style={{
                display: 'flex', alignItems: 'center',
                gap: 10,
                marginTop: 2,
                position: 'relative',
              }}>
                <div style={{ animation: 'bondCardFromLeft .8s cubic-bezier(.2,.8,.3,1.05) both' }}>
                  <Card card={bondCinematic.cardA} hovered scale={0.55} owned={bondCinematic.side === 'player'} />
                </div>
                <div style={{
                  position: 'relative',
                  width: 48, height: 48,
                  flex: '0 0 auto',
                }}>
                  {/* Beam line — extends LEFT and RIGHT from the icon to
                      the cards on either side. Two pseudo-divs so the beam
                      sweeps outward from center. */}
                  <div style={{
                    position: 'absolute',
                    top: '50%', right: '100%',
                    width: 56, height: 4,
                    background: 'linear-gradient(90deg, rgba(244,208,74,0) 0%, #ffd166 100%)',
                    transformOrigin: 'right center',
                    boxShadow: '0 0 10px rgba(244,208,74,.7)',
                    animation: 'bondBeamSweep .55s ease-out 1s both',
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '100%',
                    width: 56, height: 4,
                    background: 'linear-gradient(90deg, #ffd166 0%, rgba(244,208,74,0) 100%)',
                    transformOrigin: 'left center',
                    boxShadow: '0 0 10px rgba(244,208,74,.7)',
                    animation: 'bondBeamSweep .55s ease-out 1s both',
                  }} />
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'radial-gradient(circle at 50% 40%, #fff8d8 0%, #ffd166 50%, #e8a93a 100%)',
                    boxShadow: '0 0 22px rgba(244,208,74,.85), 0 0 0 3px #fff',
                    display: 'grid', placeItems: 'center',
                    color: '#a8530a',
                    animation: 'bondLinkSpawn .6s cubic-bezier(.2,.8,.3,1.4) .85s both',
                  }}>
                    <Link2 size={24} strokeWidth={3} />
                  </div>
                </div>
                <div style={{ animation: 'bondCardFromRight .8s cubic-bezier(.2,.8,.3,1.05) both' }}>
                  <Card card={bondCinematic.cardB} hovered scale={0.55} owned={bondCinematic.side === 'player'} />
                </div>
              </div>
              <div style={{
                fontSize: 12, color: '#fff',
                fontFamily: '"Fredoka", system-ui',
                background: 'rgba(0,0,0,.55)',
                padding: '6px 14px', borderRadius: 12,
                marginTop: 6,
                textAlign: 'center',
                maxWidth: 320,
                animation: 'bondTextDrop .5s ease-out 2.0s both',
              }}>
                {bondCinematic.bond.description}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Death animation runs INLINE in the FieldRow — see the `dying`
          prop and the wrapper styles inside FieldRow. No overlay ghost. */}

      {/* Bond-fire toast — "BOND: Sunday Dinner" lands a beat before the
          per-turn heal/damage popup that the bond produced, so the player
          can connect cause to effect. Side coloring: player bonds gold,
          boss bonds dark steel. */}
      {/* Phase banner — YGO Duel Links style bar that sweeps in from the
          left, announces the phase, then exits right. Now rendered inside
          the divider band — see the activeBanner overlay in the divider above. */}

      {bondFire && (() => {
        return (
          <div
            key={bondFire.key}
            style={{
              position: 'absolute', top: '32%', left: 0, right: 0,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              zIndex: 215,
              pointerEvents: 'none',
              animation: 'bondFireToast 950ms cubic-bezier(.2,.8,.3,1) both',
            }}
          >
            <div style={{
              padding: '9px 18px 9px 14px',
              background: 'linear-gradient(135deg, #e0a93a 0%, #c4781a 100%)',
              color: '#fff',
              borderRadius: 12,
              boxShadow: '0 6px 22px rgba(196,120,26,.45), 0 0 0 1.5px rgba(255,224,160,.4) inset',
              fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 800,
                letterSpacing: '0.22em',
                opacity: 0.75,
                padding: '2px 6px',
                background: 'rgba(0,0,0,.18)',
                borderRadius: 6,
              }}>BOND</span>
              <span>{bondFire.bond.name}</span>
            </div>
          </div>
        );
      })()}

      {/* Per-creature ability reveal — uses the SAME shape as a spell
          cast reveal (playerSpellReveal / opponentPlayReveal) so the
          game has ONE animation vocabulary for "something is
          happening on screen, look at this card." The header text
          changes (`Your X levels up` vs `Boss's X heals` vs `You
          cast` vs `Boss plays`) but the dim backdrop, scale, and
          keyframe are identical. Hold ~2.2s, matching boss spell
          reveal pacing. */}
      {effectToast && (() => {
        const isPlayer = effectToast.side === 'player';
        const owner = isPlayer ? 'Your' : `${boss.name}'s`;
        return (
          <div
            key={effectToast.key}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,.45)',
              display: 'grid', placeItems: 'center',
              zIndex: 180,
              pointerEvents: 'none',
              animation: 'fadeIn .15s',
            }}
          >
            <div style={{
              position: 'relative',
              animation: 'opponentPlayReveal 1.5s ease-out forwards',
            }}>
              <div style={{
                position: 'absolute', top: -32, left: 0, right: 0,
                textAlign: 'center',
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.6)',
                fontFamily: '"Fredoka", system-ui',
              }}>
                {owner} {effectToast.card.nickname || effectToast.card.name}
              </div>
              <Card card={effectToast.card} hovered scale={0.95} owned={effectToast.side === 'player'} />
              <div style={{
                position: 'absolute', bottom: -36, left: 0, right: 0,
                textAlign: 'center',
                fontSize: 13, fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.7)',
                fontFamily: '"Fredoka", system-ui',
              }}>
                {effectToast.text}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Turn-change banner — now rendered inside the divider band via activeBanner. */}

      {/* Yu-Gi-Oh-Duel-Links-style combat callouts — cards stay in their
          field slots; we overlay big stat numbers next to each combatant
          (gold ATK over the attacker, red HP/face over the defender), a
          charge halo on the attacker before they fire, a defender white-
          flash on impact, and a "BATTLE!" plate behind the action. The
          existing projectile + lunge handle the strike itself. */}
      {combat && (() => {
        const attackerCard = (combat.attackerOwner === 'player' ? state.player.field : state.opponent.field)
          .find(c => c.battleId === combat.attackerId);
        if (!attackerCard || !boardRef.current) return null;
        const attackerEl = cardEls.current.get(combat.attackerId);
        const isFace = combat.defenderId === 'face';
        const defenderKey = isFace
          ? (combat.defenderOwner === 'player' ? FACE_PLAYER : FACE_OPP)
          : combat.defenderId;
        const defenderEl = cardEls.current.get(defenderKey);
        if (!attackerEl || !defenderEl) return null;

        const board = boardRef.current.getBoundingClientRect();
        const aRect = attackerEl.getBoundingClientRect();
        const dRect = defenderEl.getBoundingClientRect();
        const aCx = aRect.left + aRect.width / 2 - board.left;
        const aCy = aRect.top + aRect.height / 2 - board.top;
        const dCx = dRect.left + dRect.width / 2 - board.left;
        const dCy = dRect.top + dRect.height / 2 - board.top;

        const attackerDying = dyingIds.includes(combat.attackerId);
        const defenderDying = dyingIds.includes(combat.defenderId);
        const anyDying = attackerDying || defenderDying;
        const heldMs = anyDying ? 3900 : 3400;

        // Place ATK / HP callouts off to the side of each card so they don't
        // overlap with the small stat orbs already on the cards themselves.
        // Stat-callout label positions removed when the ATK/HP popups were
        // dropped — the BATTLE plate, white-flash, slash, and damage popup
        // do the talking now.

        return (
          <>
            {/* Charge halo on attacker — pulses outward right before the strike. */}
            <div style={{
              position: 'absolute', left: aCx, top: aCy,
              width: 80, height: 80, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,209,102,.7) 0%, transparent 70%)',
              boxShadow: '0 0 30px rgba(244,208,74,.85), 0 0 60px rgba(255,158,90,.6)',
              animation: `ygoCharge ${heldMs * 0.45}ms ease-out forwards`,
              pointerEvents: 'none',
              zIndex: 152,
              opacity: 0,
            }} />

            {/* Attacker ATK / Defender HP callouts removed — they collided
                with the BATTLE plate, and the existing damage popup over
                the defender ("−N") + life-total hit on the portrait already
                tells the player what's happening. */}

            {/* Defender white-flash on impact */}
            <div style={{
              position: 'absolute',
              left: dRect.left - board.left,
              top: dRect.top - board.top,
              width: dRect.width, height: dRect.height,
              borderRadius: isFace ? 30 : 8,
              background: '#fff',
              animation: `ygoDefenderFlash ${heldMs}ms ease-out forwards`,
              opacity: 0,
              pointerEvents: 'none',
              mixBlendMode: 'screen',
              zIndex: 153,
            }} />

            {/* Death slash on dying creature — fires in-place on the small
                field card now (no centered overlay anymore). */}
            {!isFace && defenderDying && (
              <div style={{
                position: 'absolute',
                left: dCx, top: dCy,
                width: 110, height: 6,
                background: 'linear-gradient(90deg, transparent 0%, #fff 25%, #fffbd0 50%, #fff 75%, transparent 100%)',
                boxShadow: '0 0 12px #fff, 0 0 24px #f4d04a, 0 0 36px #ff7e5f',
                animation: `vsCardSlice ${heldMs}ms ease-out forwards`,
                pointerEvents: 'none',
                zIndex: 154,
                transform: 'translate(-50%, -50%)',
              }} />
            )}
            {attackerDying && (
              <div style={{
                position: 'absolute',
                left: aCx, top: aCy,
                width: 110, height: 6,
                background: 'linear-gradient(90deg, transparent 0%, #fff 25%, #fffbd0 50%, #fff 75%, transparent 100%)',
                boxShadow: '0 0 12px #fff, 0 0 24px #f4d04a, 0 0 36px #ff7e5f',
                animation: `vsCardSlice ${heldMs}ms ease-out forwards`,
                pointerEvents: 'none',
                zIndex: 154,
                transform: 'translate(-50%, -50%)',
              }} />
            )}
          </>
        );
      })()}

      {/* Legendary-summon cinematic — full-screen darkening overlay with
          a large halo + rotating golden rays + a hero-sized card that
          scales in, holds for a beat, and fades. Plays additively over
          the standard summon FX. Triggered for either side. */}
      {legendarySummon && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            zIndex: 80, pointerEvents: 'none',
            display: 'grid', placeItems: 'center',
            background: 'rgba(0,0,0,.55)',
            animation: 'legendaryOverlayFade 1.4s ease-out both',
            willChange: 'opacity',
          }}
        >
          {/* Rotating ray fan — sits behind the card. */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 480, height: 480,
            background: `conic-gradient(
              from 0deg,
              transparent 0deg,
              rgba(255,209,102,.65) 12deg,
              transparent 28deg,
              rgba(255,209,102,.55) 60deg,
              transparent 80deg,
              rgba(255,209,102,.6) 130deg,
              transparent 156deg,
              rgba(255,209,102,.5) 200deg,
              transparent 224deg,
              rgba(255,209,102,.6) 280deg,
              transparent 304deg,
              rgba(255,209,102,.5) 340deg,
              transparent 360deg
            )`,
            transformOrigin: 'center',
            animation: 'legendaryRayRotate 1.4s ease-out both',
            mixBlendMode: 'screen',
            filter: 'blur(2px)',
            willChange: 'transform, opacity',
          }} />
          {/* Soft halo glow behind the card. */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 360, height: 360, borderRadius: '50%',
            background: 'radial-gradient(circle, #ffd166 0%, rgba(255,209,102,.4) 35%, transparent 70%)',
            transformOrigin: 'center',
            animation: 'legendaryHalo 1.4s ease-out both',
            mixBlendMode: 'screen',
            willChange: 'transform, opacity',
          }} />
          {/* Hero-sized card itself. */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            animation: 'legendaryHero 1.4s cubic-bezier(.18,.85,.3,1.1) both',
            willChange: 'transform, opacity, filter',
          }}>
            <Card card={legendarySummon.card} hovered scale={1.15} owned={legendarySummon.owner === 'player'} />
          </div>
          {/* Title strip. */}
          <div style={{
            position: 'absolute', left: '50%', top: 'calc(50% + 230px)',
            transform: 'translateX(-50%)',
            color: '#ffd166', fontFamily: '"Cinzel", Georgia, serif',
            fontSize: 14, letterSpacing: '0.4em', fontWeight: 700,
            textTransform: 'uppercase',
            textShadow: '0 0 12px rgba(255,209,102,.85), 0 2px 4px #000',
            animation: 'fadeIn 0.35s ease-out 0.25s both',
          }}>
            Legendary {legendarySummon.owner === 'player' ? 'Summon' : 'Foe'}
          </div>
        </div>
      )}

      {/* Player spell reveal — the spell card sits center-screen for ~900ms so
          casting feels like an event, not a silent state mutation. */}
      {playerSpellReveal && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,.35)',
            display: 'grid', placeItems: 'center',
            zIndex: 180,
            pointerEvents: 'none',
            animation: 'fadeIn .15s',
          }}
        >
          <div style={{ position: 'relative', animation: 'playerSpellReveal 0.9s ease-out forwards' }}>
            <div style={{
              position: 'absolute', top: -28, left: 0, right: 0, textAlign: 'center',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.6)',
              fontFamily: '"Fredoka", system-ui',
            }}>
              You cast
            </div>
            <Card card={playerSpellReveal} hovered scale={0.95} />
          </div>
        </div>
      )}

      {/* Opponent's played card reveal */}
      {opponentReveal && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,.45)',
            display: 'grid', placeItems: 'center',
            zIndex: 180,
            pointerEvents: 'none',
            animation: 'fadeIn .15s',
          }}
        >
          <div style={{ position: 'relative', animation: 'opponentPlayReveal 1.5s ease-out forwards' }}>
            <Card card={opponentReveal} hovered scale={0.95} owned={false} />
          </div>
        </div>
      )}

      {/* Long-press inspect modal — dark dim so the card pops as the
          only thing on screen. Same dark language as the summon-preview
          dim layer; both are about "focus on this one card." */}
      {inspect && (
        <div
          onClick={() => setInspect(null)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(8, 4, 12, 0.72)',
            display: 'grid', placeItems: 'center',
            zIndex: 200,
            animation: 'fadeIn .2s',
          }}
        >
          <div style={{ animation: 'cardSummon 0.4s cubic-bezier(.2,.8,.3,1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Card
              card={inspect}
              hovered scale={1.1}
              // Inspect can target either side's creature. Find the
              // card on the player's field — if it's not there, it
              // belongs to the opponent and shouldn't wear the
              // player's frame.
              owned={state.player.field.some(c => c.battleId === inspect.battleId) || state.player.hand.some(c => c.battleId === inspect.battleId)}
            />
            {/* Status labels — long-press surfaces what every icon on the
                creature actually means, since the small status pills aren't
                self-documenting. Bond info too, with the partner's name. */}
            <StatusLabels
              card={inspect}
              bondInfos={(() => {
                // Surface every bond this card participates in. With first-
                // bond-wins, exactly one of these can be 'active'; the rest
                // are either 'waiting' (partner not on field) or 'blocked'
                // (partner is on field but locked into another bond).
                const myBonds = BONDS.filter(b => b.cardA === inspect.id || b.cardB === inspect.id);
                if (myBonds.length === 0) return [];
                const onPlayer = state.player.field.some(c => c.battleId === inspect.battleId);
                const ownerSide = onPlayer ? state.player : state.opponent;
                const fieldIds = new Set(ownerSide.field.map(c => c.id));
                const claimedBondIds = new Set(ownerSide.claimedBonds ?? []);
                return myBonds.map(b => {
                  const partnerId = b.cardA === inspect.id ? b.cardB : b.cardA;
                  const tpl = TEMPLATES.find(t => t.id === partnerId);
                  let status: 'active' | 'waiting' | 'blocked' = 'waiting';
                  if (claimedBondIds.has(b.id)) status = 'active';
                  else if (fieldIds.has(partnerId)) status = 'blocked';
                  return {
                    name: b.name,
                    description: b.description,
                    partnerName: tpl?.name ?? partnerId,
                    status,
                  };
                });
              })()}
            />
          </div>
          <div style={{
            position: 'absolute', bottom: 50, left: 0, right: 0,
            textAlign: 'center', fontSize: 10, opacity: 0.6,
            letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>tap anywhere to close</div>
        </div>
      )}

      {/* Graveyard modal — opened from either side's skull button. Lists every
          spell that's resolved + every creature that's died. */}
      {graveyardOpen && (
        <GraveyardModal
          cards={graveyardOpen === 'player' ? state.player.discard : state.opponent.discard}
          title={graveyardOpen === 'player' ? 'You' : boss.name}
          owner={graveyardOpen}
          onClose={() => setGraveyardOpen(null)}
        />
      )}

      {/* Bond connection lines removed — the bond pill above/below each
          side's field is the canonical "this bond is active" indicator.
          Per-card link badges already show which creatures are bonded;
          drawing additional arcs added visual noise without information. */}

      {/* Action-log history panel — slide-up drawer listing every engine
          log entry in reverse-chronological order so the most recent
          action is always at the top. Dismissed by tapping the backdrop
          or the same icon button again. */}
      {/* Stats popover — anchored next to the side's avatar portrait so
          it reads as an extension of that profile, not a generic
          floating sheet. Position is computed from the avatar's
          bounding rect (registered as FACE_PLAYER / FACE_OPP), and the
          panel animates in with a scale-from-avatar Framer entrance so
          the eye tracks back to the source. */}
      {infoSide && (() => {
        const me = infoSide === 'player' ? state.player : state.opponent;
        const label = infoSide === 'player' ? 'You' : boss.name;
        const board = boardRef.current?.getBoundingClientRect();
        const avatar = cardEls.current.get(infoSide === 'player' ? FACE_PLAYER : FACE_OPP)?.getBoundingClientRect();
        const PANEL_W = 240;
        // Default to the historical corner if measurement isn't ready
        // yet — the next render will reposition once the rects are in.
        let pos: { top?: number; bottom?: number; left: number; originY: 'top' | 'bottom' } = {
          ...(infoSide === 'player' ? { bottom: 88 } : { top: 88 }),
          left: 16,
          originY: infoSide === 'player' ? 'bottom' : 'top',
        };
        if (board && avatar) {
          // Horizontal: start just to the right of the avatar; clamp so
          // the panel stays inside the board (12 px margin off the right
          // edge). On narrow phones this means it shifts back left into
          // the safe area.
          const desiredLeft = avatar.right - board.left + 8;
          const maxLeft = board.width - PANEL_W - 12;
          const left = Math.max(12, Math.min(desiredLeft, maxLeft));
          if (infoSide === 'player') {
            // Player avatar sits at the bottom of the board; panel
            // hangs upward from the avatar's top edge.
            const bottom = board.bottom - avatar.bottom - board.top + (avatar.height * 0.2);
            pos = { bottom, left, originY: 'bottom' };
          } else {
            // Opponent avatar sits at the top; panel drops downward
            // from the avatar's bottom edge.
            const top = avatar.top - board.top + (avatar.height * 0.2);
            pos = { top, left, originY: 'top' };
          }
        }
        return (
          <div
            onClick={() => setInfoSide(null)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(8,4,12,.5)',
              zIndex: 270,
              animation: 'fadeIn .12s',
            }}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.7, x: -14 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 460, damping: 28 }}
              style={{
                position: 'absolute',
                ...(pos.top != null ? { top: pos.top } : {}),
                ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
                left: pos.left,
                width: PANEL_W,
                // Origin anchors near the avatar so the scale-in reads
                // as "growing out of the profile chip" rather than a
                // generic pop. Horizontal origin is the left edge
                // (closest to the avatar); vertical origin matches the
                // panel's anchor (bottom-up on the player, top-down on
                // the opponent).
                transformOrigin: `left ${pos.originY}`,
                background: '#fff',
                borderRadius: 18,
                boxShadow: '0 12px 32px rgba(58,46,42,.25), 0 0 0 1.5px rgba(58,46,42,.06)',
                padding: 10,
                fontFamily: '"Fredoka", system-ui',
                overflow: 'hidden',
              }}
            >
              {/* Header — gradient bar with avatar + label so the panel
                  reads as that side's HUD, not a generic popup. */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: infoSide === 'player'
                  ? 'linear-gradient(135deg, #ff9f1c 0%, #ee5a52 100%)'
                  : 'linear-gradient(135deg, #6e3a32 0%, #3a2018 100%)',
                color: '#fff',
                marginBottom: 8,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: infoSide === 'player'
                    ? (playerAvatar ? `url(${playerAvatar}) center/cover` : 'linear-gradient(135deg, #ffd166, #ff7e5f)')
                    : (boss.avatarPhoto ? `url(${boss.avatarPhoto}) center/cover` : 'linear-gradient(135deg, #b88a78, #6e3a32)'),
                  border: '2px solid rgba(255,255,255,.7)',
                  flex: '0 0 auto',
                  display: 'grid', placeItems: 'center',
                  fontWeight: 800, color: '#fff', fontSize: 14,
                }}>{infoSide === 'opponent' && !boss.avatarPhoto ? boss.avatar : ''}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.85, fontWeight: 600 }}>
                    {infoSide === 'player' ? 'Your stats' : 'Boss stats'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                </div>
              </div>
              <InfoRow icon={<Heart size={14} fill="#ee5a52" color="#ee5a52" />}      label="HP"        value={me.hp}            tint="#ee5a52" />
              <InfoRow icon={<Hand size={14} strokeWidth={2.4} />}                    label="Hand"      value={me.hand.length}   tint="#ff9f1c" />
              <InfoRow icon={<Layers size={14} strokeWidth={2.4} />}                  label="Deck"      value={me.deck.length}   tint="#a47bff" />
              <InfoRow icon={<Skull size={14} strokeWidth={2.4} />}                   label="Graveyard" value={me.discard.length} tint="#7a5a52" last />
              {infoSide === 'player' && (
                <button
                  onClick={() => { setInfoSide(null); setLogOpen(true); }}
                  style={{
                    marginTop: 10, width: '100%',
                    background: 'linear-gradient(180deg, #ffa07a 0%, #ee5a52 100%)',
                    color: '#fff',
                    border: 'none', borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 12, fontWeight: 800,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit',
                    boxShadow: '0 4px 12px rgba(238,90,82,.35)',
                  }}
                >
                  <ScrollText size={13} strokeWidth={2.4} />
                  View Action Log
                </button>
              )}
            </motion.div>
          </div>
        );
      })()}

      {logOpen && (
        <div
          onClick={() => setLogOpen(false)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(8,4,12,.65)',
            zIndex: 280,
            animation: 'fadeIn .15s',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              maxHeight: '60%',
              background: 'linear-gradient(180deg, #fef8f0 0%, #f4e8d8 100%)',
              borderRadius: '18px 18px 0 0',
              boxShadow: '0 -6px 28px rgba(0,0,0,.28)',
              display: 'flex', flexDirection: 'column',
              animation: 'slideUp .2s cubic-bezier(.2,.8,.3,1)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px 10px',
              borderBottom: '1px solid rgba(58,46,42,.12)',
              flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#3a2e2a',
                fontFamily: '"Fredoka", system-ui',
              }}>
                <ScrollText size={15} strokeWidth={2.4} />
                Action Log
              </div>
              <button
                onClick={() => setLogOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9a8678', fontSize: 18, lineHeight: 1, padding: 4,
                }}
              >✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '10px 18px 20px' }}>
              {[...state.log].reverse().map((entry, i) => (
                <div key={i} style={{
                  padding: '7px 0',
                  borderBottom: i < state.log.length - 1 ? '1px solid rgba(58,46,42,.08)' : 'none',
                  fontSize: 13, color: '#3a2e2a',
                  fontFamily: '"Fredoka", system-ui',
                  lineHeight: 1.4,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#9a8678',
                    marginRight: 8,
                  }}>#{state.log.length - i}</span>
                  {entry}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Give-up confirmation — quitting a match should never be one tap. */}
      {confirmGiveUp && (
        <div
          onClick={() => setConfirmGiveUp(false)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(8,4,12,.75)',
            display: 'grid', placeItems: 'center',
            zIndex: 280,
            animation: 'fadeIn .2s',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fef8f0',
              borderRadius: 22,
              padding: '26px 28px 22px',
              maxWidth: 320, width: '88%',
              boxShadow: '0 18px 48px rgba(0,0,0,.4)',
              fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(160deg, #ffa07a, #ee5a52)',
              display: 'grid', placeItems: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 8px 18px rgba(238,90,82,.35)',
              color: '#fff',
            }}>
              <Flag size={26} strokeWidth={2.4} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: PALETTE.text, marginBottom: 6 }}>
              Give up this match?
            </div>
            <div style={{ fontSize: 13, color: PALETTE.textMid, marginBottom: 22, lineHeight: 1.4 }}>
              You'll lose to {boss.name} and forfeit the round.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmGiveUp(false)} style={{
                flex: 1,
                background: '#fff',
                color: PALETTE.text,
                border: `1.5px solid ${PALETTE.border}`,
                borderRadius: 18, padding: '11px 16px',
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>Keep playing</button>
              <button onClick={() => onExit('quit')} style={{
                flex: 1,
                background: 'linear-gradient(180deg, #ee5a52, #c8362e)',
                color: '#fff',
                border: 'none',
                borderRadius: 18, padding: '11px 16px',
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 12px rgba(200,54,46,.35)',
              }}>Give up</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CosmeticsProvider>
  );
}

// Mirrors MAX_FIELD in the engine so the empty-slot placeholders match the
// engine's actual cap. Three keeps games short and tactical.
const SLOTS_PER_ROW = 3;

/**
 * Persistent on-board indicator listing every active bond on a side.
 *
 * One indicator per fact: there is no separate flying toast — when a bond
 * first activates, its chip animates in (cardSummon: scale-up + bounce)
 * and the rest of the chips that were already shown stay calm. This keeps
 * the UI to a single visual language for "bond active": gold gradient for
 * the player, dark plate for the boss, anchored to that side's field zone.
 */
function BondPillStack({
  bonds, newlyActiveIds, onPillRef,
}: {
  bonds: BondDef[];
  newlyActiveIds: string[];
  side: 'player' | 'opponent';
  onPillRef?: (bondId: string, el: HTMLDivElement | null) => void;
}) {
  if (bonds.length === 0) return null;
  return (
    <div style={{
      display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
      gap: 4, justifyContent: 'center', alignItems: 'center',
      pointerEvents: 'none',
    }}>
      {bonds.map(b => {
        const isNewly = newlyActiveIds.includes(b.id);
        return (
          <div
            key={`${b.id}-${isNewly ? 'new' : 'steady'}`}
            ref={(el) => onPillRef?.(b.id, el as HTMLDivElement | null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px 3px 6px',
              borderRadius: 10,
              background: 'linear-gradient(180deg, #ffe89a 0%, #f4d04a 100%)',
              color: '#3a2406',
              fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
              boxShadow: '0 2px 6px rgba(244,208,74,.45), 0 0 0 1.5px rgba(255,255,255,.6)',
              fontFamily: '"Fredoka", system-ui',
              animation: isNewly ? 'cardSummon 0.45s cubic-bezier(.2,.8,.3,1.3)' : undefined,
            }}
          >
            <Link2 size={10} strokeWidth={3} />
            <span>{b.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function FieldRow({
  side, cards, dying, turn, battlePhaseActive, combat, damages, buffs, silencedAt, triggers, selectedAttacker, pendingSpell,
  bondLookup, slotMap,
  registerEl, onCardClick, onCardLongPress,
}: {
  side: 'player' | 'opponent';
  cards: BattleCard[];
  dying: Record<string, { card: BattleCard; side: Owner; slot: number; gx: number; gy: number; delayMs: number }>;
  turn: Owner;
  battlePhaseActive?: boolean;
  combat: CombatFx | null;
  damages: DamageMap;
  buffs: Record<string, { atk: number; hp: number }>;
  silencedAt: Record<string, number>;
  triggers: Record<string, string>;
  selectedAttacker: string | null;
  pendingSpell: BattleCard | null;
  bondLookup: Record<string, 'active' | 'waiting'>;
  slotMap: Record<string, number>;
  registerEl: (id: string, el: HTMLElement | null) => void;
  onCardClick: (c: BattleCard) => void;
  onCardLongPress: (c: BattleCard) => void;
}) {
  // Build a fixed 3-slot row. slots[i] holds the card whose slotMap
  // entry === i, or null if the slot is empty. This keeps positions
  // stable: a creature stays where it was summoned even when others
  // around it die. Cards mid-flight to the graveyard are still
  // rendered in their original slot until their animation ends — see
  // the wrapper styles below.
  const slots: (BattleCard | null)[] = [null, null, null];
  for (const c of cards) {
    const idx = slotMap[c.battleId];
    if (idx != null && idx >= 0 && idx < SLOTS_PER_ROW) slots[idx] = c;
  }
  // Layer in dying cards on this side. The dying entry stores its own
  // slot index — slotMap may have already dropped the battleId (the
  // reconcile runs before the dying entry lands), so this is the
  // authoritative source. A freshly-summoned creature can't land in
  // the same slot because the reconcile blocks any slot reserved by
  // `dying` (see MatchBoard).
  for (const id of Object.keys(dying)) {
    const entry = dying[id];
    if (entry.side !== side) continue;
    if (entry.slot < 0 || entry.slot >= SLOTS_PER_ROW) continue;
    if (slots[entry.slot]) continue;
    slots[entry.slot] = entry.card;
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
      {slots.map((c, i) => {
        const targetable = c ? isTargetableForSpell(c, pendingSpell, side) : false;
        const isCombatAttacker = c ? combat?.attackerId === c.battleId && combat.attackerOwner === side : false;
        const isCombatDefender = c ? combat?.defenderId === c.battleId && combat.defenderOwner === side : false;
        const friendlySpell = side === 'player' && (
          pendingSpell?.abilityKind === 'spell_buff' ||
          pendingSpell?.abilityKind === 'spell_nourish' ||
          pendingSpell?.abilityKind === 'spell_heal_friend'
        );
        const dyingEntry = c ? dying[c.battleId] : null;

        // Single stable wrapper per slot — always present in the DOM
        // AND always visually rendered. The dashed border + faint
        // white tint are permanent scaffolding for the 3-card field
        // (constant whether the slot is empty, occupied, or hosting a
        // dying-card animation that's about to fly to the graveyard).
        // Cards render on top and cover the tint while present; once
        // they leave, the tint is revealed without a pop.
        return (
          <div
            key={`slot-${i}`}
            data-slot={i}
            ref={c ? (el) => registerEl(c.battleId, el) : undefined}
            style={{
              // Slot zones are a constant of the field. Border,
              // background, transform, and shadow are identical in
              // every state — empty, occupied, drag-over, blocked,
              // dying. Drop feedback is handled by other layers
              // (the dragged card itself, the center divider
              // "Summon" hint), never by mutating the zone. Cards
              // and dying-animation ghosts sit on top of the
              // unchanged scaffolding.
              width: 64, height: 88,
              borderRadius: 8,
              flex: '0 0 auto',
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px dashed rgba(58,46,42,.14)',
              background: 'rgba(255,255,255,.18)',
            }}
          >
          {c && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...(dyingEntry ? {
                animation: 'flyToGrave 1.1s cubic-bezier(.4,.1,.7,.4) both',
                animationDelay: `${dyingEntry.delayMs}ms`,
                pointerEvents: 'none',
                zIndex: 8,
                ['--gx' as string]: `${dyingEntry.gx}px`,
                ['--gy' as string]: `${dyingEntry.gy}px`,
              } : {}),
            }}>
            <BattlefieldCard
              card={c}
              owned={side === 'player'}
              shaking={isCombatDefender}
              dying={false}
              dimWhenExhausted={side === 'player'}
              selected={side === 'player' && selectedAttacker === c.battleId}
              attackable={
                side === 'player'
                  ? turn === 'player' && !!battlePhaseActive && !c.tapped && !c.justPlayed
                  : !!selectedAttacker
              }
              highlight={
                side === 'player'
                  ? (friendlySpell ? 'spell' : null)
                  : (pendingSpell && targetable ? 'spell' : (selectedAttacker ? 'attack' : null))
              }
              lunging={isCombatAttacker ? (side === 'player' ? 'up' : 'down') : null}
              impact={isCombatDefender}
              damage={damages[c.battleId] ?? null}
              buff={buffs[c.battleId] ?? null}
              silencedAt={silencedAt[c.battleId] ?? null}
              trigger={triggers[c.battleId] ?? null}
              bondState={bondLookup[c.id]}
              onClick={() => onCardClick(c)}
              onLongPress={() => onCardLongPress(c)}
            />
            </div>
          )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Inspect-modal helper — explains every icon active on the creature so the
 * player can learn what frozen / sleeping / untargetable / taunt / rush mean
 * by long-pressing the card. Each row shows the icon, its name, and a
 * one-line description.
 */
function StatusLabels({
  card,
  bondInfos = [],
}: {
  card: BattleCard;
  /** Every bond this card participates in. With first-bond-wins, a card
   *  can be in at most ONE active bond at a time; other bonds it would
   *  otherwise complete read as 'blocked' (partner present but locked) or
   *  'waiting' (partner not on field). */
  bondInfos?: {
    name: string;
    description: string;
    partnerName: string;
    status: 'active' | 'blocked' | 'waiting';
  }[];
}) {
  const items: { icon: React.ReactNode; label: string; hint: string; color: string }[] = [];
  if (card.frozen) {
    items.push({ icon: <Snowflake size={14} fill="#fff" strokeWidth={2.4} />, color: '#3a8fc4',
      label: 'Frozen', hint: 'Skips its next turn.' });
  }
  if (card.justPlayed && card.abilityKind !== 'rush') {
    items.push({ icon: <Moon size={14} fill="#fff" strokeWidth={2.4} />, color: '#5a4a2a',
      label: 'Sleeping', hint: 'Just summoned — can’t attack until next turn.' });
  }
  if (card.abilityKind === 'untargetable') {
    items.push({ icon: <ShieldHalf size={14} strokeWidth={2.6} />, color: '#7a4ea8',
      label: 'Untargetable', hint: 'Spells can’t target this creature.' });
  }
  if (card.abilityKind === 'taunt') {
    items.push({ icon: <Target size={14} strokeWidth={2.6} />, color: '#3d8e57',
      label: 'Taunt', hint: 'Enemies must hit this before anything else.' });
  }
  if (card.abilityKind === 'rush') {
    items.push({ icon: <Zap size={14} fill="#fff" strokeWidth={2.4} />, color: '#e8a93a',
      label: 'Rush', hint: 'Can attack the turn it’s played.' });
  }
  if (card.silenced) {
    items.push({ icon: <Ban size={14} strokeWidth={2.6} />, color: '#7a6e62',
      label: 'Silenced', hint: 'Ability stripped for one turn — restored at end of owner’s turn.' });
  }
  // Education theme — surface the level counter so the player can see
  // how close the leveling creature is to its cap, and what the cap
  // is. Mirrors the small blue "Lv X/3" badge shown on the field card.
  if (card.abilityKind === 'level_up') {
    const t = card.turnsAlive ?? 0;
    items.push({
      icon: <Zap size={14} fill="#fff" strokeWidth={2.4} />,
      color: '#5a5fd9',
      label: `Lv ${t}/3`,
      hint: t >= 3
        ? 'Level cap reached — no more +1/+1 ticks.'
        : `+1/+1 at end of your turn (${3 - t} more level${3 - t === 1 ? '' : 's'} until cap).`,
    });
  }
  if (card.abilityKind === 'graduate') {
    const t = card.turnsAlive ?? 0;
    const threshold = card.abilityValue ?? 3;
    items.push({
      icon: <Zap size={14} fill="#fff" strokeWidth={2.4} />,
      color: '#5a5fd9',
      label: `Lv ${t}/${threshold}`,
      hint: t >= threshold
        ? 'Already graduated.'
        : `+1/+1 at end of your turn. After ${threshold - t} more turn${threshold - t === 1 ? '' : 's'}, also gain +2/+2 and Untargetable.`,
    });
  }
  for (const b of bondInfos) {
    // Three states under first-bond-wins:
    //   active  — bond is claimed; gold link icon, full description.
    //   blocked — partner is on the field but is already locked into a
    //             different bond. Orange color so the player understands
    //             "the partner is busy" rather than missing.
    //   waiting — partner not on the field yet; muted grey.
    const color =
      b.status === 'active'  ? '#e8a93a' :
      b.status === 'blocked' ? '#c8702a' :
                               '#a89580';
    const hint =
      b.status === 'active'
        ? `Active with ${b.partnerName} — ${b.description}`
        : b.status === 'blocked'
          ? `Blocked — ${b.partnerName} is already locked into another bond. Will form when that bond ends.`
          : `Pairs with ${b.partnerName} — bond will activate when both are on the field.`;
    items.push({
      icon: <Link2 size={14} strokeWidth={2.6} />,
      color,
      label: `Bond: ${b.name}`,
      hint,
    });
  }
  if (items.length === 0) return null;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      background: 'rgba(255,255,255,.96)',
      padding: '10px 14px', borderRadius: 12,
      boxShadow: '0 6px 16px rgba(0,0,0,.25)',
      maxWidth: 260,
      fontFamily: '"Inter", system-ui',
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: it.color, color: '#fff',
            display: 'grid', placeItems: 'center',
            flex: '0 0 auto',
            boxShadow: '0 1px 3px rgba(0,0,0,.3)',
          }}>{it.icon}</div>
          <div style={{ flex: 1, lineHeight: 1.25 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#3a2e2a', letterSpacing: '0.05em' }}>
              {it.label}
            </div>
            <div style={{ fontSize: 11, color: '#6e5a52' }}>
              {it.hint}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skull-icon pill that opens the graveyard modal for one player's pile. */
function GraveyardButton({ count, onClick, elRef, pulseKey }: {
  count: number;
  onClick: () => void;
  /** Forwarded so MatchBoard can capture this button's position into
   *  the cardEls map and use it as the destination for the death-fly
   *  animation. */
  elRef?: (el: HTMLButtonElement | null) => void;
  /** Bumps every time a death-ghost is scheduled to arrive at this
   *  graveyard. The button re-keys on this so the `gravePulse`
   *  keyframe replays — a quick scale-up + warm glow ring confirms
   *  "card landed here" without the player having to look away. */
  pulseKey?: number;
}) {
  return (
    <button
      key={pulseKey}
      ref={elRef}
      onClick={onClick}
      aria-label="Graveyard"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: '#fff',
        padding: '5px 9px', borderRadius: 14,
        boxShadow: '0 3px 8px rgba(58,46,42,.10)',
        border: 'none',
        fontSize: 12, fontWeight: 700, color: PALETTE.text,
        cursor: 'pointer',
        fontFamily: '"Fredoka", "Inter", system-ui',
        animation: pulseKey ? 'gravePulse .6s ease-out' : undefined,
      }}
    >
      <Skull size={14} color={PALETTE.accentDeep} strokeWidth={2.4} />
      <span>{count}</span>
    </button>
  );
}

/** Face-down hand at the top — visualizes how many cards the boss is holding. */

/** Plain-English hint telling the player what kind of target a pending spell needs. */
function spellTargetHint(card: BattleCard): string {
  switch (card.abilityKind) {
    case 'spell_damage': return 'Select enemy';
    case 'spell_freeze': return 'Select enemy';
    case 'spell_buff':   return 'Select ally';
    case 'spell_nourish':return 'Select ally';
    case 'spell_heal_friend': return 'Select ally';
    case 'silence':      return 'Select enemy';
    default:             return 'Select target';
  }
}

/** Spells that don't need a target — they self-resolve when cast.
 *  Centralised so every entry point (drag, tap-to-play, needsTarget
 *  UI hint) agrees on the same list. Missing entries here cause the
 *  "Tap a target" UI flow to wait forever for a tap that does nothing
 *  (Group Project / Pop Quiz / Final Exam / etc. all had this bug). */
function isNoTargetSpell(card: BattleCard): boolean {
  switch (card.abilityKind) {
    case 'spell_heal':
    case 'spell_share_meal':
    case 'spell_feast':
    case 'spell_both_draw':
    case 'spell_buff_all':
    case 'exam_pass':
    case 'pop_quiz':
    case 'draw_on_play':
      return true;
    default:
      return card.id === 'ti-05';
  }
}

function isTargetableForSpell(c: BattleCard, spell: BattleCard | null, owner: 'player' | 'opponent'): boolean {
  if (!spell) return false;
  // Silence ignores 'untargetable' on purpose — that's its job.
  if (spell.abilityKind === 'silence') return owner === 'opponent';
  // Friendly buffs / heals (spell_buff, spell_nourish, spell_heal_friend)
  // ignore untargetable since the friendly creature isn't being attacked.
  const isFriendly = spell.abilityKind === 'spell_buff'
    || spell.abilityKind === 'spell_nourish'
    || spell.abilityKind === 'spell_heal_friend';
  if (c.abilityKind === 'untargetable' && !isFriendly) return false;
  if (isFriendly) {
    if (owner !== 'player') return false;
    // Theme restriction: common/rare buffs and heals only work on same-theme
    // creatures. Legendary and epic spells bypass the restriction.
    const unrestricted = spell.rarity === 'legendary' || spell.rarity === 'epic';
    return unrestricted || c.el === spell.el;
  }
  if (spell.abilityKind === 'spell_freeze') return owner === 'opponent';
  if (spell.abilityKind === 'spell_damage') return true;
  return false;
}

function OpponentPortrait({ boss, themeColor, themeDeep, hp, highlight, onClick, damage, elRef }: {
  boss: BossDef;
  themeColor: string;
  themeDeep: string;
  hp: number;
  highlight: 'attack' | 'spell' | null;
  onClick: () => void;
  damage: number | null;
  elRef?: (el: HTMLElement | null) => void;
}) {
  const ring = highlight === 'attack' ? '#ee5a52' : highlight === 'spell' ? '#3a8fc4' : null;
  const hit = damage != null && damage > 0;
  return (
    <Portrait
      avatar={boss.avatarPhoto ? '' : boss.avatar}
      avatarPhoto={boss.avatarPhoto}
      avatarBg={`linear-gradient(160deg, ${themeDeep}, ${themeColor})`}
      avatarRing={`conic-gradient(from 90deg, ${themeDeep}, ${themeColor}, ${themeDeep})`}
      hp={hp}
      ring={ring}
      hit={hit}
      damage={damage}
      onClick={onClick}
      elRef={elRef}
    />
  );
}

function PlayerPortrait({ hp, avatar, highlight, onClick, damage, elRef }: {
  hp: number;
  avatar?: string;
  highlight: 'heal' | null;
  onClick: () => void;
  damage: number | null;
  elRef?: (el: HTMLElement | null) => void;
}) {
  const ring = highlight === 'heal' ? '#06d6a0' : null;
  const hit = damage != null && damage > 0;
  return (
    <Portrait
      avatar={avatar ? '' : 'Y'}
      avatarPhoto={avatar}
      avatarBg="linear-gradient(160deg, #6e1f1a, #d96658)"
      avatarRing="conic-gradient(from 90deg, #6e1f1a, #d96658, #6e1f1a)"
      hp={hp}
      ring={ring}
      hit={hit}
      damage={damage}
      onClick={onClick}
      elRef={elRef}
    />
  );
}

/**
 * Shared portrait pill — avatar circle + heart icon + HP. Both the player
 * and the boss render through this so the two sides have identical chrome:
 * same widths, same internal padding, same alignment relative to the
 * portrait dot. No per-side name labels (avatar conveys identity well
 * enough and dropping the names removes the layout asymmetry that the
 * names were creating).
 */
function Portrait({ avatar, avatarPhoto, avatarBg, avatarRing, hp, ring, hit, damage, onClick, elRef }: {
  avatar: string;
  /** Optional uploaded photo (data URL). Renders inside the avatar circle
      instead of the letter when present. */
  avatarPhoto?: string;
  avatarBg: string;
  avatarRing: string;
  hp: number;
  ring: string | null;
  hit: boolean;
  damage: number | null;
  onClick: () => void;
  elRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <div ref={elRef} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, position: 'relative',
      cursor: 'pointer',
      padding: 4, borderRadius: 30,
      background: '#fff',
      boxShadow: ring
        ? `0 0 0 2px ${ring}, 0 0 14px ${ring}, 0 4px 10px rgba(58,46,42,.12)`
        : hit
          ? '0 0 0 2px #ee5a52, 0 0 16px rgba(238,90,82,.6), 0 4px 10px rgba(58,46,42,.12)'
          : '0 4px 10px rgba(58,46,42,.12)',
      animation: hit ? 'shake 0.4s, hpFlash 0.5s' : damage ? 'hpFlash 0.5s' : undefined,
      transition: 'box-shadow .15s',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: avatarRing,
        padding: 2, flex: '0 0 auto',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: avatarPhoto ? `url(${avatarPhoto}) center/cover` : avatarBg,
          display: 'grid', placeItems: 'center',
          fontSize: 16, fontWeight: 700, color: '#fff',
          fontFamily: '"Fredoka", system-ui',
        }}>{avatar}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingRight: 10 }}>
        <Heart size={15} fill="#ee5a52" color="#ee5a52" strokeWidth={2} />
        <span style={{ fontSize: 18, fontWeight: 700, color: PALETTE.text }}>{hp}</span>
      </div>
      {damage != null && damage !== 0 && (
        <div style={{
          // Standardised numeric popup — same coral / green / dark-shadow
          // language as the BattlefieldCard popups. White outlines were
          // confusing players ("why are the numbers all different?").
          position: 'absolute', top: -10, left: '50%',
          fontSize: 22, fontWeight: 900,
          color: damage > 0 ? '#e85a52' : '#06d6a0',
          textShadow: '0 2px 4px rgba(0,0,0,.55)',
          animation: 'damagePopup 1.6s ease-out forwards',
          pointerEvents: 'none',
          fontFamily: '"Fredoka", system-ui',
          whiteSpace: 'nowrap',
        }}>{damage > 0 ? `−${damage}` : `+${-damage}`}</div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, tint, last }: {
  icon: React.ReactNode; label: string; value: number; tint: string; last?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 6px',
      borderBottom: last ? 'none' : '1px solid rgba(58,46,42,0.06)',
      fontSize: 13, color: '#3a2e2a',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8,
        background: `${tint}1a`, color: tint,
        display: 'grid', placeItems: 'center',
        flex: '0 0 auto',
      }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
      <span style={{
        minWidth: 28, padding: '2px 10px', borderRadius: 999,
        background: `${tint}22`, color: tint,
        fontWeight: 800, textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  );
}

/**
 * Turn counter chip. Shows the current turn AND how many turns are left
 * before the time-out condition fires (higher HP wins). Color escalates as
 * the cap approaches: white → orange (≤5 left) → red (≤2 left), so the
 * player always knows whether they need to push for the kill or hold HP.
 */
function TurnChip({ turnNumber, limit }: { turnNumber: number; limit: number }) {
  return (
    <div style={{
      background: '#fff',
      color: PALETTE.text,
      padding: '0 10px', height: 36, borderRadius: 12,
      fontWeight: 800, letterSpacing: '0.04em',
      boxShadow: '0 2px 6px rgba(58,46,42,.10)',
      display: 'flex', alignItems: 'center',
      fontFamily: '"Fredoka", "Inter", system-ui',
      fontSize: 13,
      border: `1.5px solid ${PALETTE.border}`,
    }}>
      {turnNumber}<span style={{ opacity: 0.35, fontWeight: 500, margin: '0 1px' }}>/</span>{limit}
    </div>
  );
}

function ManaCrystals({ mana, maxMana, pulseKey }: { mana: number; maxMana: number; pulseKey?: number }) {
  // Circle that fills with liquid from the bottom — same shape as the card
  // cost badge so players immediately read "this number = those circles on cards".
  const fillPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
  return (
    <div
      key={pulseKey}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: '#fff',
        padding: '5px 10px 5px 8px', borderRadius: 14,
        boxShadow: '0 4px 10px rgba(58,46,42,.12)',
        fontFamily: '"Fredoka", "Inter", system-ui',
        animation: pulseKey ? 'manaGain .6s ease-out' : undefined,
      }}
    >
      {/* Circular liquid fill — mirrors the cost-badge circle on cards */}
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff5dc',
        boxShadow: '0 0 0 2px #3a8fc4',
        overflow: 'hidden',
        position: 'relative',
        flex: '0 0 auto',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: `${fillPct * 100}%`,
          background: 'linear-gradient(180deg, #6ec8ff 0%, #3a8fc4 55%, #1c5478 100%)',
          transition: 'height .6s cubic-bezier(.2,.8,.3,1)',
        }} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, color: '#1c5478', letterSpacing: '-0.01em' }}>
        {mana}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#9a8678' }}>/{maxMana}</span>
    </div>
  );
}

/** Boss-specific dialogue. Tries to make the result feel like a moment, not a stat screen. */
const BOSS_DIALOGUE: Record<string, { win: { title: string; line: string }; loss: { title: string; line: string } }> = {
  mom: {
    win:  { title: 'You won', line: "She made you soup anyway." },
    loss: { title: 'You lost', line: "She's proud of you. She'll never tell you, though." },
  },
  manager: {
    win:  { title: 'You won', line: "He's filing a complaint with HR. About himself." },
    loss: { title: 'You lost', line: "He'd like to schedule a 30-minute follow-up." },
  },
  alpha: {
    win:  { title: 'You won', line: "The pack respects you now. Don't lose that." },
    loss: { title: 'You lost', line: "The pack hunts another day. So do you." },
  },
  drifter: {
    win:  { title: 'You won', line: "They left their address on a napkin. It's blank." },
    loss: { title: 'You lost', line: "By morning they're three time zones away." },
  },
};

function MatchEnd({ outcome, boss, difficulty, alreadyBeaten, playerHp, opponentHp, turnLimitReached, victoryEmote, onExit }: {
  outcome: 'win' | 'loss' | 'draw';
  boss: BossDef;
  difficulty: Difficulty;
  /** True when the player has already defeated this boss before — drops
   *  the first-time-bonus from the displayed reward. */
  alreadyBeaten: boolean;
  playerHp: number;
  opponentHp: number;
  /** True when the match ended because we hit TURN_LIMIT, not because
   *  someone hit 0 HP. Drives the "why" sentence under the title. */
  turnLimitReached: boolean;
  /** Equipped victory emote — shown on the win screen only as a big
   *  headline above the title. Loss / draw don't taunt the player. */
  victoryEmote?: import('../data/victoryEmotes').EmoteDef;
  onExit: (o: 'win' | 'loss' | 'draw' | 'quit') => void;
}) {
  const isWin = outcome === 'win';
  const isDraw = outcome === 'draw';
  const bossDlg = BOSS_DIALOGUE[boss.id]?.[isWin ? 'win' : 'loss'];
  const dialogue = {
    title: isDraw ? 'Draw!' : (bossDlg?.title ?? (isWin ? 'You won' : 'You lost')),
    line: isDraw ? 'A hard-fought tie.' : (bossDlg?.line ?? (isWin ? 'Well played.' : 'Better luck next time.')),
  };
  const reward = (() => {
    if (isDraw) return MATCH_DRAW_REWARD;
    if (!isWin) return MATCH_LOSS_REWARD;
    const mult = difficultyProfile(difficulty).rewardMult;
    const win = Math.round(MATCH_WIN_REWARD * mult);
    const bonus = alreadyBeaten ? 0 : Math.round(boss.rewardCoins * mult);
    return win + bonus;
  })();
  const reason = (() => {
    if (turnLimitReached) {
      if (isWin) return `Turn limit reached — you outlasted ${boss.name} (${playerHp} HP vs ${opponentHp}).`;
      if (isDraw) return `Turn limit reached — tied at ${playerHp} HP. Partial reward granted.`;
      return `Turn limit reached — ${boss.name} had more HP (${opponentHp} vs ${playerHp}).`;
    }
    if (isDraw) return 'You both fell on the same turn — it\'s a draw.';
    if (isWin) return `You took ${boss.name} down to 0 HP.`;
    return `${boss.name} took you down to 0 HP.`;
  })();

  // Single contrast-safe palette regardless of which boss we just played —
  // the old version used the boss's theme color for the background, so
  // navy-themed bosses (The Manager) made the dark "VICTORY" letters
  // disappear. Now the screen is the same warm cream every time, with the
  // win/loss accent driven by the orange/grey gradient on the title only.
  return (
    <div style={{
      width: '100%', height: '100%',
      background: isWin
        ? 'radial-gradient(ellipse at 50% 30%, #fff8e8 0%, #ffe0bf 55%, #f4b48a 100%)'
        : isDraw
          ? 'radial-gradient(ellipse at 50% 30%, #f0f4ff 0%, #d0dcf4 55%, #a0b4d8 100%)'
          : 'radial-gradient(ellipse at 50% 30%, #fef3eb 0%, #ead5c4 55%, #b88a78 100%)',
      color: '#3a2e2a',
      fontFamily: '"Fredoka", "Inter", system-ui',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 30px', textAlign: 'center',
      animation: 'fadeIn 0.5s',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.45, pointerEvents: 'none' }} width="100%" height="100%">
        {Array.from({ length: 14 }).map((_, i) => (
          <circle key={i}
            cx={`${(i * 53) % 100}%`}
            cy={`${(i * 37) % 100}%`}
            r={isWin ? (3 + (i % 3)) : 2}
            fill={isWin ? ['#ffd166', '#ff7e5f', '#06d6a0', '#ffa07a'][i % 4] : '#b88a78'}
            opacity={isWin ? 0.6 : 0.35}
          />
        ))}
      </svg>

      <div style={{
        position: 'relative', zIndex: 2,
        animation: isWin ? 'cardSummon .6s cubic-bezier(.2,.8,.3,1)' : 'fadeIn .5s',
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          // Boss avatar photo when available; otherwise the warm gradient
          // + letter fallback.
          background: boss.avatarPhoto
            ? `url(${boss.avatarPhoto}) center/cover`
            : isWin
              ? 'linear-gradient(160deg, #ff9f1c, #ee5a52)'
              : isDraw
                ? 'linear-gradient(160deg, #6888c8, #4466aa)'
                : 'linear-gradient(160deg, #6e3a32, #3a2018)',
          display: 'grid', placeItems: 'center',
          fontSize: 48, fontWeight: 700, color: '#fff',
          boxShadow: '0 12px 30px rgba(0,0,0,.25), 0 0 0 5px #fff, 0 0 0 7px rgba(255,158,90,.4)',
          fontFamily: '"Fredoka", system-ui',
          filter: isWin ? 'none' : isDraw ? 'saturate(0.7)' : 'grayscale(0.3)',
          transform: 'rotate(0deg)',
        }}>{!boss.avatarPhoto && boss.avatar}</div>
        <div style={{
          marginTop: 14, fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: '#6e5a52', fontWeight: 700,
        }}>
          {boss.name}
        </div>
      </div>

      {/* Victory emote — equipped cosmetic that lands as a big headline
          above the standard Victory label. Loss + draw skip this so the
          player isn't taunted by their own emote. The headline drops in
          with a small bounce; the sub-line slides under it. */}
      {isWin && victoryEmote && (
        <div style={{
          position: 'relative', zIndex: 2,
          marginTop: 24, marginBottom: -8,
          animation: 'toastDrop 1.8s ease-out both',
        }}>
          <div style={{
            fontSize: 32, fontWeight: 800, lineHeight: 1.05,
            background: `linear-gradient(180deg, #fff, ${victoryEmote.glow ?? '#ffd166'})`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: `0 0 18px ${(victoryEmote.glow ?? '#ffd166')}88`,
            fontFamily: '"Fredoka", system-ui',
            letterSpacing: '-0.01em',
          }}>{victoryEmote.headline}</div>
          {victoryEmote.sub && (
            <div style={{
              fontSize: 12, color: '#6e5a52', fontStyle: 'italic', marginTop: 2,
            }}>{victoryEmote.sub}</div>
          )}
        </div>
      )}

      <div style={{
        fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
        color: isWin ? '#c8362e' : isDraw ? '#4466aa' : '#6e3a32',
        marginTop: 30, marginBottom: 4, fontWeight: 800,
      }}>
        {isWin ? 'Victory' : isDraw ? 'Draw' : 'Defeat'}
      </div>
      <div style={{
        fontSize: 44, fontWeight: 800, lineHeight: 1.05,
        background: isWin
          ? 'linear-gradient(180deg, #ff9f1c, #ee5a52)'
          : isDraw
            ? 'linear-gradient(180deg, #6888c8, #4466aa)'
            : 'linear-gradient(180deg, #6e3a32, #3a2018)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: 12,
      }}>{dialogue.title}</div>
      <div style={{
        fontSize: 14, color: '#3a2e2a', fontStyle: 'italic',
        marginBottom: 16, maxWidth: 320, lineHeight: 1.45,
      }}>
        “{dialogue.line}”
      </div>

      {/* Reason — the "why" of this outcome. Especially helpful on turn-
          limit endings where neither side hit 0 HP. */}
      <div style={{
        fontSize: 12, color: '#6e5a52', fontWeight: 500,
        marginBottom: 22, maxWidth: 320, lineHeight: 1.4,
        padding: '8px 14px',
        background: 'rgba(255,255,255,.55)',
        borderRadius: 12,
        border: '1px solid rgba(58,46,42,.08)',
      }}>
        {reason}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#fff', padding: '10px 18px', borderRadius: 24,
        boxShadow: '0 6px 14px rgba(58,46,42,.12)',
        marginBottom: 28,
      }}>
        <Coins size={18} color="#e8a93a" fill="#ffd166" strokeWidth={2.2} />
        <span style={{ fontSize: 17, fontWeight: 700, color: '#3a2e2a' }}>+{reward}</span>
        <span style={{ fontSize: 11, color: '#6e5a52', fontWeight: 500 }}>coins</span>
      </div>

      <button onClick={() => onExit(outcome)} style={{ ...btnPrimary, minWidth: 220 }}>
        Continue
      </button>
    </div>
  );
}
