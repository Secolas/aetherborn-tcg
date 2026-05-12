import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Flag, Heart, Coins, Layers, Skull, Snowflake, Moon, Target, ShieldHalf, Zap, Ban, Link2 } from 'lucide-react';
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
import { MATCH_WIN_REWARD, MATCH_LOSS_REWARD } from '../game/pack';
import { ELEMENTS } from '../data/elements';
import { BONDS } from '../data/bonds';
import { TEMPLATES } from '../data/templates';
import type { BossDef } from '../data/bosses';
import type { BattleCard, CollectionCard, MatchState, Owner, PlayerState, Difficulty } from '../game/types';
import { playSfx } from '../audio/sfx';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';

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
  /** True when the player has already defeated this boss before, so the
   *  match-end screen knows not to advertise the first-time bonus. App
   *  computes this from `save.bossesDefeated`. */
  alreadyBeaten?: boolean;
  onExit: (outcome: 'win' | 'loss' | 'quit') => void;
}

interface DragState {
  battleId: string;
  cardType: 'Creature' | 'Spell';
  x: number; y: number;     // current finger position (viewport coords)
  startX: number; startY: number; // where the press began — used to detect tap-vs-drag
  ox: number; oy: number;   // finger offset within card at drag start
  overField: boolean;
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

export function MatchBoard({ deck, boss, difficulty = 'normal', playerAvatar, settings = DEFAULT_SETTINGS, onBondDiscovered, alreadyBeaten = false, onExit }: Props) {
  // Stash settings in a ref so SFX closures see fresh values without
  // re-creating effects every render.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** Fire an SFX cue at the user's chosen volume — no-op if muted. */
  const sfx = (cue: Parameters<typeof playSfx>[0]) => playSfx(cue, settingsRef.current.sfxVolume);
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
  /** Which graveyard pile (if any) is open in the modal. */
  const [graveyardOpen, setGraveyardOpen] = useState<Owner | null>(null);
  /** Pre-match coin flip is animating. While true, the AI driver is paused
      and the player can't interact — keeps the opening uniform either way. */
  const [flipping, setFlipping] = useState(true);
  /** During the initial deal, hands fly in one card at a time so the start
      of the match feels like a real card-game opening. UI hides cards in
      both hands beyond these counts until the deal finishes. */
  const [playerInitialDealt, setPlayerInitialDealt] = useState(0);
  const [oppInitialDealt, setOppInitialDealt] = useState(0);
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
      // Assign new battleIds to the lowest free slot.
      for (const c of field) {
        if (next[c.battleId] != null) continue;
        for (let i = 0; i < maxSlots; i++) {
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
        showMsg(step.action.replace(/^The Boss\b/, boss.name));
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
          const holdMs = step.played.type === 'Spell' ? 2700
            : isImpactful ? 2300
            : 1900;
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
          }, holdMs);
        } else {
          // Plain non-animated action (e.g. attack on a creature/face;
          // playAttackAnimation handles its own timing). Bumped from 950 →
          // 1200 so back-to-back actions feel like decisions, not reflexes.
          setTimeout(() => { if (!cancelled) setState(step.next); }, 1200);
        }
      } else {
        // No more steps — pass the turn back. Slightly longer hold so
        // the player can register the boss is done before "Your turn"
        // banner slides in. Use endTurn (not beginTurn directly) so the
        // boss actually runs its end-of-turn hooks: level_up ticks on
        // Math Teacher / Physics Class, damage_at_end_turn bond pings,
        // The Kids draw, freeze/silence wear-offs. endTurn calls
        // beginTurn(player) internally so the turn still flips.
        setTimeout(() => {
          if (cancelled) return;
          showMsg('Your turn');
          setState(s => endTurn(s));
        }, 1300);
      }
    };
    // Initial think delay before any AI action — gives the player a beat
    // to register the turn change before the boss starts moving. Each
    // sub-action (play, attack, end-turn) has its own follow-up delay
    // below, so the boss feels deliberate, not twitchy.
    const t = setTimeout(tick, 1100);
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
    if (firstTurnRef.current) { firstTurnRef.current = false; return; }
    if (state.outcome !== 'ongoing') return;
    const now = Date.now();
    const wait = Math.max(0, animBusyUntilRef.current - now);
    const showT = setTimeout(() => {
      setTurnBanner(state.turn);
      sfx('turn');
    }, wait);
    const hideT = setTimeout(() => setTurnBanner(null), wait + 1400);
    return () => { clearTimeout(showT); clearTimeout(hideT); };
  }, [state.turn, state.outcome]);

  // Win/lose stinger fires once when the match resolves.
  const outcomePlayedRef = useRef(false);
  useEffect(() => {
    if (state.outcome === 'ongoing' || outcomePlayedRef.current) return;
    outcomePlayedRef.current = true;
    sfx(state.outcome === 'win' ? 'win' : 'lose');
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

      // Draws come AFTER deaths so the hand growth is its own beat.
      // Now also handles the turn-start draw (used to be a separate
      // useEffect that fired in parallel with the ability reveals).
      // By going through pipeDelay the draw flight strictly follows
      // whatever ability animations are queued — no more overlap of
      // a card flying into hand while a Library reveal is still up.
      {
        const newPlayerCards = [...fresh.handIds.player].filter(id => !prev.handIds.player.has(id)).length;
        const newOppCards    = [...fresh.handIds.opponent].filter(id => !prev.handIds.opponent.has(id)).length;
        const drawStep = 420;
        const totalDraws = newPlayerCards + newOppCards;
        if (totalDraws > 0) {
          const at = pipeDelay;
          for (let i = 0; i < newPlayerCards; i++) fireDraw('player', at + i * drawStep);
          for (let i = 0; i < newOppCards; i++) fireDraw('opponent', at + i * drawStep);
          // Pulse the mana chip alongside the turn-start draw — it
          // belongs to the same beat (new turn started, here's your
          // card + mana).
          if (fresh.turnNumber > prev.turnNumber) {
            setTimeout(() => setManaPulse(p => p + 1), at);
          }
          // Each flight is ~1.1s; serialize accordingly.
          pipeDelay += totalDraws * drawStep + 700;
        }
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

      // Tell the AI driver to wait until the pipeline finishes.
      if (pipeDelay > 250) {
        holdAnim(pipeDelay);
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
      const turnFlipped = fresh.turnNumber > prev.turnNumber;
      // Per-creature ability activations. These get a toast that
      // shows the SOURCE card + a one-line explanation, so the
      // player can tell which creature healed / leveled / graduated
      // instead of just seeing a number pop with no attribution.
      // Sequenced through pipeDelay so they fire one at a time after
      // damages / deaths / draws settle.
      const effectFires: { card: BattleCard; text: string; side: Owner }[] = [];
      if (turnFlipped) {
        // Level-up / graduate ticks fired at end of the JUST-ENDED
        // turn for that side. Detect by comparing the creature's
        // pre-tick atk/hp snapshot with its post-tick state, and
        // attributing only to cards whose ability is (or was) one
        // of the leveling kinds.
        const justEndedSide: Owner = state.turn === 'player' ? 'opponent' : 'player';
        const justEndedField = justEndedSide === 'player' ? state.player.field : state.opponent.field;
        const justEndedPrev = justEndedSide === 'player' ? prev.player : prev.opponent;
        for (const c of justEndedField) {
          const ps = justEndedPrev.get(c.battleId);
          if (!ps) continue;
          const dAtk = c.currentAtk - ps.atk;
          const dHp = c.currentHp - ps.hp;
          const stillLeveling = c.abilityKind === 'level_up' || c.abilityKind === 'graduate';
          // Plain level-up tick — ability still says level_up / graduate.
          if (stillLeveling && (dAtk > 0 || dHp > 0)) {
            effectFires.push({
              card: c,
              text: `Level up +${dAtk}/+${dHp}`,
              side: justEndedSide,
            });
          }
          // Graduation transition — ability was 'graduate', now
          // 'untargetable', graduated flag set. Different copy so the
          // moment feels meaningful.
          if (ps.ability === 'graduate' && c.graduated && c.abilityKind === 'untargetable') {
            effectFires.push({
              card: c,
              text: 'Graduated — +2/+2 and Untargetable',
              side: justEndedSide,
            });
          }
        }
        // Heal-each-turn fires at start of the JUST-BEGUN turn for
        // its active side. Only announce when face HP ACTUALLY went
        // up — at max HP the engine skips the heal (see beginTurn),
        // so a "Library restores 1 HP" reveal there would be a
        // misleading no-op.
        const newActiveSide: Owner = state.turn;
        const newActiveBefore = newActiveSide === 'player' ? prev.hp.player : prev.hp.opponent;
        const newActiveAfter = newActiveSide === 'player' ? fresh.hp.player : fresh.hp.opponent;
        if (newActiveAfter > newActiveBefore) {
          const newActiveField = newActiveSide === 'player' ? state.player.field : state.opponent.field;
          for (const c of newActiveField) {
            if (c.abilityKind === 'heal_each_turn' && c.abilityValue) {
              effectFires.push({
                card: c,
                text: `Restore ${c.abilityValue} HP`,
                side: newActiveSide,
              });
            }
          }
        }
      }
      if (effectFires.length) {
        // Hold long enough for the full-card reveal to read clearly.
        // The reveal lifts the source card to center-stage with a dim
        // backdrop, so it needs spell-reveal-class time — earlier
        // smaller toast values felt rushed for the bigger visual.
        const EFFECT_MS = 2400;
        const at = pipeDelay;
        effectFires.forEach((f, i) => {
          const showAt = at + i * EFFECT_MS;
          const key = Date.now() + 300 + i;
          setTimeout(() => setEffectToast({ ...f, key }), showAt);
          setTimeout(() => setEffectToast(cur => (cur && cur.key === key ? null : cur)), showAt + EFFECT_MS + 50);
        });
        pipeDelay += effectFires.length * EFFECT_MS + 50;
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
      else setOppInitialDealt(d => d + 1);
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
      const drewCards = r.state.player.hand.length - (beforeHand - 1);
      if (drewCards > 0) flashMsg(`Drew ${drewCards} card${drewCards === 1 ? '' : 's'}`);
    }, 900);
    return true;
  };

  // ============== Drag from hand ==============
  const onCardPointerDown = (ev: React.PointerEvent, card: BattleCard) => {
    if (state.turn !== 'player' || state.outcome !== 'ongoing') return;
    // Note: we no longer block pointer-down on unaffordable cards. Players can
    // still tap them to preview — the mana check happens at PLAY time.
    const rect = ev.currentTarget.getBoundingClientRect();
    setDrag({
      battleId: card.battleId,
      cardType: card.type,
      x: ev.clientX, y: ev.clientY,
      startX: ev.clientX, startY: ev.clientY,
      ox: ev.clientX - rect.left, oy: ev.clientY - rect.top,
      overField: false,
    });
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    if (!drag) return;
    // Drop zone = divider band OR the player creature row. Releasing on
    // either plays the card; aiming at the thin center line was too fiddly.
    const inside = (rect: DOMRect | undefined) =>
      !!rect &&
      ev.clientX >= rect.left && ev.clientX <= rect.right &&
      ev.clientY >= rect.top && ev.clientY <= rect.bottom;
    const overField = inside(fieldRef.current?.getBoundingClientRect())
      || inside(playerFieldRef.current?.getBoundingClientRect());
    setDrag(d => d ? { ...d, x: ev.clientX, y: ev.clientY, overField } : d);
  };

  const onPointerUp = () => {
    if (!drag) return;
    const card = state.player.hand.find(c => c.battleId === drag.battleId);
    if (!card) { setDrag(null); return; }

    // Tap (small movement) → click-to-select. Drag (large movement) → drop-to-play.
    const dx = drag.x - drag.startX;
    const dy = drag.y - drag.startY;
    const wasTap = (dx * dx + dy * dy) < 64; // <8px movement

    if (wasTap) {
      const idx = state.player.hand.findIndex(c => c.battleId === drag.battleId);
      handleHandTap(card, idx);
      setDrag(null);
      return;
    }

    if (card.type === 'Creature') {
      if (drag.overField) {
        const r = playCard(state, 'player', card.battleId);
        if (r.ok) { setState(r.state); sfx('summon'); }
        else flashMsg(r.reason ?? 'Cannot play');
      }
    } else {
      const noTarget = card.abilityKind === 'spell_heal'
        || card.abilityKind === 'draw_on_play'
        || card.id === 'ti-05';
      if (noTarget) {
        if (drag.overField) castSpell(card, { kind: 'face', owner: 'player' });
      } else if (drag.overField) {
        setPendingSpell(card);
        flashMsg('Select a target');
      }
    }
    setDrag(null);
  };

  /** Tap a hand card: toggle selection. The card lifts up as a preview. */
  const handleHandTap = (_card: BattleCard, idx: number) => {
    if (state.turn !== 'player' || state.outcome !== 'ongoing') return;
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

    if (card.type === 'Creature') {
      const r = playCard(state, 'player', card.battleId);
      if (r.ok) {
        setState(r.state);
        setSelectedHandIdx(null);
        sfx('summon');
      } else {
        flashMsg(r.reason ?? 'Cannot play');
      }
    } else {
      const noTarget = card.abilityKind === 'spell_heal'
        || card.abilityKind === 'draw_on_play'
        || card.id === 'ti-05';
      if (noTarget) {
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

  const onMyCreatureClick = (c: BattleCard) => {
    if (pendingSpell) return;
    if (state.turn !== 'player' || state.outcome !== 'ongoing') return;
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
    if (selectedAttacker) playerAttack('face');
  };

  const onMyFaceClick = () => {
    if (pendingSpell) castPendingAt({ kind: 'face', owner: 'player' });
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
    <div
      ref={boardRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        width: '100%', height: '100%',
        // Tinted base gradient by boss element so each fight has a slightly
        // different ambient hue. Specific scene comes from the backdrop
        // image layer below; this gradient is the bedrock.
        background: `
          radial-gradient(ellipse at 50% 50%, #fef3e0 0%, ${bossElement.color}26 60%, ${bossElement.deep}33 100%),
          linear-gradient(180deg, #fef3e0 0%, #ffe0bf 60%, #f8c89c 100%)
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
      {/* Themed boss backdrop — heavily blurred + de-saturated photo of
          where this duel is happening. Sits behind everything else (zIndex
          0) and never catches pointer events. Falls back to nothing when
          the boss has no `backdrop` defined — the base gradient still
          carries the theme tint. */}
      {boss.backdrop && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${boss.backdrop})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(14px) saturate(0.7) brightness(1.05)',
          opacity: 0.32,
          zIndex: 0,
          pointerEvents: 'none',
        }} />
      )}

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
      <div style={{ flex: '0 0 auto', height: 64, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5, gap: 6, position: 'relative' }}>
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
          <DeckChip count={state.opponent.deck.length} handSize={state.opponent.hand.length} />
          <GraveyardButton
            count={state.opponent.discard.length}
            onClick={() => setGraveyardOpen('opponent')}
            elRef={(el) => registerEl(GRAVE_OPP, el)}
            pulseKey={gravePulseKey.opponent}
          />
        </div>
      </div>

      {/* Top spacer — absorbs extra vertical space and hosts the face-down
          opponent hand so it floats between the header and the opp field row. */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', minHeight: 30, paddingBottom: 4 }}>
        <OpponentHand size={initialDealing ? oppInitialDealt : state.opponent.hand.length} />
      </div>

      {/* Opponent's creature row. Stacked above the divider (zIndex 4) so
          damage/buff popups that overshoot upward off the card render on top
          of the divider strip and its End Turn / Give Up buttons. */}
      <div style={{
        flex: '0 0 100px',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
        zIndex: 6,
        position: 'relative',
      }}>
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
          highlightEmpty={false}
          registerEl={registerEl}
          onCardClick={(c) => onOppCreatureClick(c)}
          onCardLongPress={(c) => setInspect(c)}
        />
        <BondPillStack bonds={opponentActiveBonds} newlyActiveIds={newOppBonds} side="opponent" />
      </div>

      {/* Center divider band — the drop zone for drag-to-summon. Dashed top
          + bottom borders intensify when a card is dragged into it. End Turn
          button (or "Release to summon" hint during drag) lives here. The
          phase label floats inside this band as an absolute child with
          pointer-events off so it never fights the button for clicks. */}
      <div ref={fieldRef} style={{
        flex: '0 0 56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px',
        borderTop: drag?.overField
          ? '2px dashed #f4d04a'
          : '1px dashed rgba(58,46,42,.20)',
        borderBottom: drag?.overField
          ? '2px dashed #f4d04a'
          : '1px dashed rgba(58,46,42,.20)',
        background: drag?.overField
          ? 'rgba(244,208,74,.12)'
          : 'rgba(255,255,255,.30)',
        transition: 'background .15s, border-color .15s',
        zIndex: 4,
        position: 'relative',
      }}>
        {/* Left cluster — turn counter + give-up flag, pinned to the divider
            so they're always visible AND give-up sits right next to End Turn
            (not lost in the corner of the opponent header). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TurnChip turnNumber={state.turnNumber} limit={TURN_LIMIT} />
          <button onClick={() => setConfirmGiveUp(true)} aria-label="Give up" style={iconBtn}>
            <Flag size={16} strokeWidth={2.4} />
          </button>
        </div>
        {drag?.overField ? (
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', color: PALETTE.accentDeep }}>
            {drag.cardType === 'Creature' ? '↓ Release to summon ↓' : '↓ Release to choose target ↓'}
          </div>
        ) : pendingSpell ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: PALETTE.accentDeep, textTransform: 'uppercase' }}>
                Casting · {pendingSpell.name}
              </span>
              <span style={{ fontSize: 10, color: PALETTE.textMid, fontStyle: 'italic', marginTop: 1 }}>
                {spellTargetHint(pendingSpell)}
              </span>
            </div>
            <button onClick={cancelPending} aria-label="Cancel" style={{
              background: '#fff',
              color: PALETTE.text, border: `1.5px solid ${PALETTE.border}`,
              borderRadius: '50%', width: 28, height: 28, fontSize: 14,
              fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 6px rgba(58,46,42,.08)',
              display: 'grid', placeItems: 'center',
            }}>×</button>
          </div>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onEndTurn(); }} disabled={state.turn !== 'player'} style={{
            background: state.turn === 'player'
              ? 'linear-gradient(180deg, #ffa07a 0%, #ff7e5f 100%)'
              : '#e8d8c8',
            color: state.turn === 'player' ? '#fff' : '#9a8678',
            border: 'none', borderRadius: 22, padding: '10px 24px',
            fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
            cursor: state.turn === 'player' ? 'pointer' : 'default',
            boxShadow: state.turn === 'player' ? '0 4px 12px rgba(255,94,60,.35)' : 'none',
            fontFamily: '"Fredoka", system-ui',
          }}>End Turn →</button>
        )}

        {/* Floating turn-status label — sits inside the divider band as an
            absolute child with pointer-events:none so it never intercepts
            clicks. Hidden while the band is showing the casting hint or
            drop hint. */}
        {!pendingSpell && !drag?.overField && (
          <div style={{
            position: 'absolute', top: 6, left: 0, right: 0,
            textAlign: 'center', pointerEvents: 'none',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: PALETTE.textMid,
          }}>
            {msg !== 'Your turn' && msg !== `${boss.name}'s turn`
              ? msg
              : (state.turn === 'player' ? 'Your Turn' : "Opponent's Turn")}
          </div>
        )}
      </div>

      {/* Player's creature row — drop zone for drag-to-summon. Tapping it
          alone no longer summons (use the Summon button on the centered
          preview instead) — that prevents accidental plays. */}
      <div
        ref={playerFieldRef}
        style={{
          flex: '0 0 100px',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
          // Above the divider (zIndex 4) so damage/buff popups that extend
          // upward from a card render on top of the divider's icons.
          zIndex: 6,
          background: drag?.overField
            ? 'rgba(244,208,74,.10)'
            : 'transparent',
          transition: 'background .15s',
          position: 'relative',
        }}
      >
        <FieldRow
          side="player"
          cards={state.player.field}
          dying={dying}
          turn={state.turn}
          combat={combat}
          damages={damages}
          buffs={buffs}
          silencedAt={silencedAt}
          triggers={triggers}
          selectedAttacker={selectedAttacker}
          pendingSpell={pendingSpell}
          bondLookup={playerBondLookup}
          slotMap={playerSlots}
          highlightEmpty={selectedHandIdx !== null}
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
        <BondPillStack bonds={playerActiveBonds} newlyActiveIds={newPlayerBonds} side="player" />
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
          <DeckChip count={state.player.deck.length} handSize={state.player.hand.length} />
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
        {(initialDealing ? state.player.hand.slice(0, playerInitialDealt) : state.player.hand).map((card, i) => {
          const isDragging = drag?.battleId === card.battleId;
          const isCasting = playerSpellReveal?.battleId === card.battleId;
          if (isDragging || isCasting) return null;
          const cardCount = state.player.hand.length;
          const offset = i - (cardCount - 1) / 2;
          const isSelected = selectedHandIdx === i && !drag;
          // Unaffordable = not enough mana. Bond discounts (Reporting Line)
          // are baked into effectiveCost so a discounted spell shows as
          // playable even at its on-card cost. We don't tint cards red just
          // because it's the boss's turn — that'd flash every card every turn.
          const playableNow = effectiveCost(state.player, card) <= state.player.mana;
          const baseScale = 0.66;
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
          return (
            <div
              key={card.battleId}
              onPointerDown={(e) => onCardPointerDown(e, card)}
              style={{
                position: 'absolute', bottom: 0, left: '50%',
                transform: `translateX(calc(-50% + ${xOff}px))`,
                width: cardW + 8,
                height: 320 * baseScale + 16,
                zIndex: isSelected ? 60 : 10 + i,
                cursor: 'pointer',
                touchAction: 'none',
                pointerEvents: 'auto',
                opacity: selectedHandIdx !== null && !isSelected ? 0.55 : 1,
                transition: 'opacity .15s',
              }}
            >
              <div style={{
                position: 'absolute', bottom: 0, left: '50%',
                // Selected card rises and straightens out so the player can
                // read it; non-selected stay fanned in their arc.
                transform: isSelected
                  ? `translateX(-50%) translateY(-12px) rotate(0deg)`
                  : `translateX(-50%) translateY(${yArc}px) rotate(${rot}deg)`,
                transformOrigin: 'bottom center',
                transition: 'transform .22s cubic-bezier(.2,.8,.3,1)',
                pointerEvents: 'none',
                willChange: 'transform, filter',
                filter: isSelected ? 'drop-shadow(0 0 14px rgba(244,208,74,.7))' : 'none',
                // Affordable cards on your turn breathe a soft yellow glow
                // so playable cards stand out from unaffordable ones at a
                // glance. The keyframe only animates `filter`, so it
                // doesn't conflict with the static fanned `transform`.
                animation: playableNow && state.turn === 'player' && !isSelected
                  ? 'playablePulse 2.4s ease-in-out infinite'
                  : undefined,
              }}>
                <Card card={card} scale={baseScale} hovered={isSelected} unaffordable={!playableNow} />
              </div>
            </div>
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
        const needsTarget = isSpell && !(
          card.abilityKind === 'spell_heal' ||
          card.abilityKind === 'spell_share_meal' ||
          card.abilityKind === 'spell_feast' ||
          card.abilityKind === 'spell_both_draw' ||
          card.abilityKind === 'spell_buff_all' ||
          card.abilityKind === 'exam_pass' ||
          card.abilityKind === 'pop_quiz' ||
          card.abilityKind === 'draw_on_play' ||
          card.id === 'ti-05'
        );
        const actionLabel = !playableNow
          ? (state.turn !== 'player' ? "Wait — it's their turn" : 'Not enough mana')
          : isSpell
            ? (needsTarget ? 'Pick a target →' : 'Cast')
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
              >Cancel</button>
              <button
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
              >{actionLabel}</button>
            </div>
          </div>
        );
      })()}

      {/* Dragged card — rendered at fixed viewport position so it follows the finger exactly */}
      {drag && (() => {
        const card = state.player.hand.find(c => c.battleId === drag.battleId);
        if (!card) return null;
        return (
          <div
            style={{
              position: 'fixed',
              left: drag.x - drag.ox,
              top: drag.y - drag.oy,
              transform: 'scale(0.85)',
              transformOrigin: 'top left',
              zIndex: 9999,
              pointerEvents: 'none',
              filter: drag.overField ? 'drop-shadow(0 12px 24px rgba(244,208,74,.4))' : 'drop-shadow(0 8px 16px rgba(0,0,0,.4))',
            }}
          >
            <Card card={card} scale={1} hovered />
          </div>
        );
      })()}

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
                background: isPlayer
                  ? 'linear-gradient(180deg, #ffe89a 0%, #f4d04a 100%)'
                  : 'linear-gradient(180deg, #6a4a3a 0%, #3a2018 100%)',
                color: isPlayer ? '#3a2406' : '#ffe89a',
                padding: '6px 14px', borderRadius: 14,
                fontFamily: '"Fredoka", system-ui',
                fontSize: 11, letterSpacing: '0.25em', fontWeight: 800,
                boxShadow: isPlayer
                  ? '0 8px 22px rgba(244,208,74,.45), 0 0 0 2px rgba(255,255,255,.6)'
                  : '0 8px 22px rgba(0,0,0,.45), 0 0 0 2px rgba(244,208,74,.4)',
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
                  <Card card={bondCinematic.cardA} hovered scale={0.55} />
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
                  <Card card={bondCinematic.cardB} hovered scale={0.55} />
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
      {bondFire && (() => {
        const isPlayer = bondFire.side === 'player';
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
              background: isPlayer
                ? 'linear-gradient(135deg, #e0a93a 0%, #c4781a 100%)'
                : 'linear-gradient(135deg, #3a2e2a 0%, #1a1414 100%)',
              color: '#fff',
              borderRadius: 12,
              boxShadow: isPlayer
                ? '0 6px 22px rgba(196,120,26,.45), 0 0 0 1.5px rgba(255,224,160,.4) inset'
                : '0 6px 22px rgba(0,0,0,.55), 0 0 0 1.5px rgba(255,255,255,.08) inset',
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
              <Card card={effectToast.card} hovered scale={0.95} />
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

      {/* Turn-change banner — slides in from the left when the active player
          flips, holds, then slides out the right. Wakes the player up between
          their turn and the boss's. */}
      {turnBanner && (
        <div style={{
          position: 'absolute', top: '38%', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 220,
          pointerEvents: 'none',
          animation: 'turnBanner 1.4s cubic-bezier(.2,.8,.3,1) forwards',
        }}>
          <div style={{
            background: turnBanner === 'player'
              ? 'linear-gradient(180deg, #ffa07a, #ff7e5f)'
              : 'linear-gradient(180deg, #6a4a3a, #3a2018)',
            color: '#fff',
            padding: '14px 38px',
            fontSize: 20, fontWeight: 900, letterSpacing: '0.2em',
            boxShadow: '0 12px 28px rgba(0,0,0,.35)',
            transform: 'skewX(-10deg)',
            fontFamily: '"Fredoka", system-ui',
            textShadow: '0 2px 0 rgba(0,0,0,.25)',
          }}>
            <div style={{ transform: 'skewX(10deg)' }}>
              {turnBanner === 'player' ? 'YOUR TURN' : `${boss.name.toUpperCase()}'S TURN`}
            </div>
          </div>
        </div>
      )}

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
            {/* "BATTLE!" plate — anchored 22% from the top of the stage so
                it sits clearly above the field action and never collides
                with the stat callouts that pop next to the combatants. */}
            <div style={{
              position: 'absolute', top: '22%', left: '50%',
              fontSize: 32, fontWeight: 900, letterSpacing: '0.18em',
              color: '#fff',
              background: 'linear-gradient(180deg, #ee5a52, #c8362e)',
              padding: '5px 22px', borderRadius: 8,
              boxShadow: '0 0 0 3px rgba(255,255,255,.85), 0 8px 24px rgba(0,0,0,.5), 0 0 50px rgba(238,90,82,.55)',
              fontFamily: '"Fredoka", system-ui',
              textShadow: '0 3px 0 #6e1f1a',
              animation: `ygoBattleBanner ${heldMs}ms cubic-bezier(.3,.6,.4,1) forwards`,
              opacity: 0,
              pointerEvents: 'none',
              zIndex: 165,
              whiteSpace: 'nowrap',
            }}>BATTLE!</div>

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
            <div style={{
              position: 'absolute', top: -32, left: 0, right: 0, textAlign: 'center',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.6)',
              fontFamily: '"Fredoka", system-ui',
            }}>
              {boss.name} {opponentReveal.type === 'Spell' ? 'casts' : 'plays'}
            </div>
            <Card card={opponentReveal} hovered scale={0.95} />
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
            <Card card={inspect} hovered scale={1.1} />
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
          onClose={() => setGraveyardOpen(null)}
        />
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
  bonds, newlyActiveIds, side,
}: {
  bonds: BondDef[];
  newlyActiveIds: string[];
  side: 'player' | 'opponent';
}) {
  if (bonds.length === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        right: 8,
        top: side === 'opponent' ? 4 : undefined,
        bottom: side === 'player' ? 4 : undefined,
        display: 'flex', flexDirection: 'column', gap: 4,
        alignItems: 'flex-end',
        zIndex: 7,
        pointerEvents: 'none',
      }}
    >
      {bonds.map(b => {
        const isNewly = newlyActiveIds.includes(b.id);
        return (
          <div
            // Re-keying on the "newly active" flag forces the cardSummon
            // animation to replay the moment the bond activates, so the
            // chip lands with a satisfying pop instead of just appearing.
            key={`${b.id}-${isNewly ? 'new' : 'steady'}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px 3px 6px',
              borderRadius: 10,
              background: side === 'player'
                ? 'linear-gradient(180deg, #ffe89a 0%, #f4d04a 100%)'
                : 'linear-gradient(180deg, #6a4a3a 0%, #3a2018 100%)',
              color: side === 'player' ? '#3a2406' : '#ffe89a',
              fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
              boxShadow: side === 'player'
                ? '0 2px 6px rgba(244,208,74,.45), 0 0 0 1.5px rgba(255,255,255,.6)'
                : '0 2px 6px rgba(0,0,0,.35), 0 0 0 1.5px rgba(244,208,74,.4)',
              fontFamily: '"Fredoka", system-ui',
              animation: isNewly
                ? 'cardSummon 0.45s cubic-bezier(.2,.8,.3,1.3)'
                : undefined,
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
  side, cards, dying, turn, combat, damages, buffs, silencedAt, triggers, selectedAttacker, pendingSpell,
  bondLookup, slotMap,
  highlightEmpty, registerEl, onCardClick, onCardLongPress,
}: {
  side: 'player' | 'opponent';
  cards: BattleCard[];
  /** Creatures currently mid-flight to the graveyard. Keyed by battleId.
   *  We continue rendering them in their old slot and apply flyToGrave
   *  on the live BattlefieldCard so the card itself arcs out — no
   *  overlay ghost. After the flight ends MatchBoard removes them. */
  dying: Record<string, { card: BattleCard; side: Owner; slot: number; gx: number; gy: number; delayMs: number }>;
  /** Whose turn is currently active. Player creatures only get the
   *  attack-ready Swords badge on the player's own turn. */
  turn: Owner;
  combat: CombatFx | null;
  damages: DamageMap;
  /** Per-creature buff popup data — "+atk/+hp" surfaced on the slot. */
  buffs: Record<string, { atk: number; hp: number }>;
  /** Per-creature silence trigger — bumping the value replays the flash. */
  silencedAt: Record<string, number>;
  /** Per-creature on-play trigger label ("DRAW +1") shown briefly. */
  triggers: Record<string, string>;
  selectedAttacker: string | null;
  pendingSpell: BattleCard | null;
  /** Per-card-template bond state. 'active' = partner is on the field too,
   *  'waiting' = bonded card is here but partner isn't yet. */
  bondLookup: Record<string, 'active' | 'waiting'>;
  /** Stable slot assignment: card.battleId → slot index (0..2). Surviving
   *  creatures stay in their assigned slot even when a neighbour dies;
   *  empty slots stay empty instead of being filled by the next card to
   *  the left. */
  slotMap: Record<string, number>;
  /** Brighten empty slot outlines so the player can see where a card will go. */
  highlightEmpty: boolean;
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
        if (!c) {
          return (
            <div key={`empty-${i}`} style={{
              width: 64, height: 88,
              borderRadius: 8,
              border: highlightEmpty
                ? '2px dashed #f4d04a'
                : '1.5px dashed rgba(58,46,42,.18)',
              background: highlightEmpty
                ? 'rgba(244,208,74,.12)'
                : 'rgba(255,255,255,.18)',
              transition: 'border-color .15s, background .15s',
              flex: '0 0 auto',
            }} />
          );
        }
        const targetable = isTargetableForSpell(c, pendingSpell, side);
        const isCombatAttacker = combat?.attackerId === c.battleId && combat.attackerOwner === side;
        const isCombatDefender = combat?.defenderId === c.battleId && combat.defenderOwner === side;
        const friendlySpell = side === 'player' && (
          pendingSpell?.abilityKind === 'spell_buff' ||
          pendingSpell?.abilityKind === 'spell_nourish' ||
          pendingSpell?.abilityKind === 'spell_heal_friend'
        );
        const dyingEntry = dying[c.battleId];
        // The live BattlefieldCard plays NO slice animation. When a
        // creature dies, its slot wrapper plays flyToGrave (translating
        // the live card up and into the graveyard icon via CSS vars).
        // Same path for combat AND non-combat deaths.
        return (
          <div
            key={c.battleId}
            ref={(el) => registerEl(c.battleId, el)}
            style={{
              display: 'flex',
              flex: '0 0 auto',
              ...(dyingEntry ? {
                animation: 'flyToGrave 1.1s cubic-bezier(.4,.1,.7,.4) both',
                animationDelay: `${dyingEntry.delayMs}ms`,
                pointerEvents: 'none',
                zIndex: 8,
                position: 'relative',
                ['--gx' as string]: `${dyingEntry.gx}px`,
                ['--gy' as string]: `${dyingEntry.gy}px`,
              } : null),
            }}
          >
            <BattlefieldCard
              card={c}
              shaking={isCombatDefender}
              dying={false}
              dimWhenExhausted={side === 'player'}
              selected={side === 'player' && selectedAttacker === c.battleId}
              attackable={
                side === 'player'
                  ? turn === 'player' && !c.tapped && !c.justPlayed
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
function OpponentHand({ size }: { size: number }) {
  if (size <= 0) return null;
  // Negative margin compresses the cards into a fan. Tighter for big hands.
  const overlap = size <= 4 ? -28 : size <= 6 ? -38 : -46;
  // Lives inside the top spacer (flex column). No absolute positioning —
  // the spacer sizes itself based on available room.
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      pointerEvents: 'none',
      zIndex: 4,
    }}>
      {Array.from({ length: size }).map((_, i) => {
        const offset = i - (size - 1) / 2;
        const rot = offset * 4;
        return (
          <div key={i} style={{
            marginLeft: i === 0 ? 0 : overlap,
            transform: `translateY(${Math.abs(offset) * 1.5}px)`,
            zIndex: i,
          }}>
            <CardBack scale={0.32} rotate={rot} />
          </div>
        );
      })}
    </div>
  );
}

/** Plain-English hint telling the player what kind of target a pending spell needs. */
function spellTargetHint(card: BattleCard): string {
  switch (card.abilityKind) {
    case 'spell_damage': return `Tap an enemy creature or boss to deal ${card.abilityValue ?? 0}`;
    case 'spell_freeze': return 'Tap an enemy creature to freeze it';
    case 'spell_buff':   return `Tap your creature for +${card.abilityValue ?? 0}/+${card.abilityValue ?? 0}`;
    case 'spell_nourish':return `Tap your creature for +0/+${card.abilityValue ?? 0} HP`;
    case 'spell_heal_friend': return `Tap your creature to restore ${card.abilityValue ?? 0} HP`;
    case 'silence':      return 'Tap an enemy creature to silence it';
    default:             return 'Tap a target';
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
  if (isFriendly) return owner === 'player';
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
      cursor: ring ? 'pointer' : 'default',
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

/**
 * Turn counter chip. Shows the current turn AND how many turns are left
 * before the time-out condition fires (higher HP wins). Color escalates as
 * the cap approaches: white → orange (≤5 left) → red (≤2 left), so the
 * player always knows whether they need to push for the kill or hold HP.
 */
function TurnChip({ turnNumber, limit }: { turnNumber: number; limit: number }) {
  const left = Math.max(0, limit - turnNumber + 1); // includes current turn
  const palette =
    left <= 2 ? { bg: '#ee5a52', fg: '#fff', sub: 'rgba(255,255,255,.85)' }
    : left <= 5 ? { bg: '#ffa07a', fg: '#fff', sub: 'rgba(255,255,255,.9)' }
    : { bg: '#fff', fg: PALETTE.text, sub: PALETTE.textMid };
  return (
    <div style={{
      background: palette.bg,
      color: palette.fg,
      padding: '3px 10px', borderRadius: 12,
      fontWeight: 700, letterSpacing: '0.05em',
      boxShadow: '0 2px 6px rgba(58,46,42,.10)',
      transition: 'background .2s, color .2s',
      textAlign: 'center', lineHeight: 1.1,
      fontFamily: '"Fredoka", "Inter", system-ui',
      minWidth: 56,
    }}>
      <div style={{ fontSize: 9, opacity: 0.85, color: palette.sub }}>
        TURN {turnNumber}/{limit}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, marginTop: 1 }}>
        {left} left
      </div>
    </div>
  );
}

function DeckChip({ count, handSize }: { count: number; handSize: number }) {
  // Tight number-only chip — labels were pushing the right cluster off the
  // screen edge on narrow phones. Layers icon + deck count + thin divider +
  // hand count is enough to read at a glance.
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: '#fff',
      padding: '5px 9px', borderRadius: 14,
      boxShadow: '0 3px 8px rgba(58,46,42,.10)',
      fontSize: 12, fontWeight: 700, color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui',
    }}>
      <Layers size={13} color={PALETTE.accentDeep} strokeWidth={2.4} />
      <span>{count}</span>
      <span style={{ width: 1, height: 12, background: 'rgba(58,46,42,.15)' }} />
      <span style={{ color: PALETTE.textMid }}>{handSize}</span>
    </div>
  );
}

function ManaCrystals({ mana, maxMana, pulseKey }: { mana: number; maxMana: number; pulseKey?: number }) {
  // Compact "5 / 7" pill with a vertical "vial" showing the actual fill
  // level as a rising liquid. A CSS height transition handles the fill
  // animation when mana changes; a wave overlay at the meniscus keeps the
  // surface alive between turns. The chip remounts on every pulseKey
  // change so the manaGain pop replays at the start of the player's turn.
  const fillPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
  return (
    <div
      key={pulseKey}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: '#fff',
        padding: '5px 10px 5px 8px', borderRadius: 14,
        boxShadow: '0 4px 10px rgba(58,46,42,.12)',
        fontFamily: '"Fredoka", "Inter", system-ui',
        animation: pulseKey ? 'manaGain .6s ease-out' : undefined,
      }}
    >
      {/* Liquid vial — diamond shape, transparent shell, fill rises from
          the bottom. The wave is a small radial gradient that wobbles
          horizontally so the surface looks like real liquid. */}
      <div style={{
        position: 'relative',
        width: 16, height: 22,
        clipPath: 'polygon(50% 0, 100% 30%, 82% 100%, 18% 100%, 0 30%)',
        background: 'rgba(58,143,196,.18)',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(28,84,120,.2)',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: `${fillPct * 100}%`,
          background: 'linear-gradient(180deg, #6ec8ff 0%, #3a8fc4 60%, #1c5478 100%)',
          // Smooth height transition fires automatically when mana rises
          // (or drops, after a play). Cubic-bezier matches the manaGain pop.
          transition: 'height .6s cubic-bezier(.2,.8,.3,1)',
          boxShadow: 'inset 0 4px 6px rgba(255,255,255,.35)',
        }}>
          {/* Meniscus highlight + lateral wobble for "alive" feel. */}
          <div style={{
            position: 'absolute', top: -2, left: -3, right: -3, height: 4,
            background: 'radial-gradient(ellipse 50% 100% at 50% 100%, #9ed6f7 0%, transparent 70%)',
            animation: 'manaWave 2.4s ease-in-out infinite',
            opacity: fillPct > 0 ? 1 : 0,
          }} />
        </div>
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

function MatchEnd({ outcome, boss, difficulty, alreadyBeaten, playerHp, opponentHp, turnLimitReached, onExit }: {
  outcome: 'win' | 'loss';
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
  onExit: (o: 'win' | 'loss' | 'quit') => void;
}) {
  const isWin = outcome === 'win';
  const dialogue = BOSS_DIALOGUE[boss.id]?.[outcome] ?? {
    title: isWin ? 'You won' : 'You lost',
    line: isWin ? 'Well played.' : 'Better luck next time.',
  };
  // Reward calculation mirrors App.tsx's onMatchExit so what we DISPLAY
  // matches what the player actually receives. Wins scale with the
  // difficulty multiplier; the first-time-boss bonus is also multiplied
  // (so Mythic first-time pays substantially more than Normal first-time).
  // Losses are flat (MATCH_LOSS_REWARD) since "you lost" isn't a tier.
  const isWin_ = outcome === 'win';
  const reward = (() => {
    if (!isWin_) return MATCH_LOSS_REWARD;
    const mult = difficultyProfile(difficulty).rewardMult;
    const win = Math.round(MATCH_WIN_REWARD * mult);
    const bonus = alreadyBeaten ? 0 : Math.round(boss.rewardCoins * mult);
    return win + bonus;
  })();
  // Build a one-sentence reason so the player understands HOW the match
  // ended — especially important for turn-limit losses where neither side
  // hit 0 HP and the result reads as confusing without context.
  const reason = (() => {
    if (turnLimitReached) {
      if (isWin) return `Turn limit reached — you outlasted ${boss.name} (${playerHp} HP vs ${opponentHp}).`;
      if (playerHp === opponentHp) return `Turn limit reached — tied at ${playerHp} HP. Ties go to the boss.`;
      return `Turn limit reached — ${boss.name} had more HP (${opponentHp} vs ${playerHp}).`;
    }
    if (playerHp <= 0 && opponentHp <= 0) return 'You both fell on the same turn — ties go to the boss.';
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
              : 'linear-gradient(160deg, #6e3a32, #3a2018)',
          display: 'grid', placeItems: 'center',
          fontSize: 48, fontWeight: 700, color: '#fff',
          boxShadow: '0 12px 30px rgba(0,0,0,.25), 0 0 0 5px #fff, 0 0 0 7px rgba(255,158,90,.4)',
          fontFamily: '"Fredoka", system-ui',
          filter: isWin ? 'none' : 'grayscale(0.3)',
          transform: isWin ? 'rotate(-4deg)' : 'rotate(2deg)',
        }}>{!boss.avatarPhoto && boss.avatar}</div>
        <div style={{
          marginTop: 14, fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: '#6e5a52', fontWeight: 700,
        }}>
          {boss.name}
        </div>
      </div>

      <div style={{
        fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
        color: isWin ? '#c8362e' : '#6e3a32',
        marginTop: 30, marginBottom: 4, fontWeight: 800,
      }}>
        {isWin ? 'Victory' : 'Defeat'}
      </div>
      <div style={{
        fontSize: 44, fontWeight: 800, lineHeight: 1.05,
        background: isWin
          ? 'linear-gradient(180deg, #ff9f1c, #ee5a52)'
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
