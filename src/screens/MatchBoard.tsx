import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Flag, Heart, Coins, Layers, Skull, Snowflake, Moon, Target, ShieldHalf, Zap, VolumeX } from 'lucide-react';
import { Card } from '../components/Card';
import { BattlefieldCard } from '../components/BattlefieldCard';
import { CardBack } from '../components/CardBack';
import { CoinFlip } from '../components/CoinFlip';
import { GraveyardModal } from '../components/GraveyardModal';
import { iconBtn, btnPrimary, PALETTE } from '../components/styles';
import { aiStep, type AiCombat } from '../game/ai';
import {
  attack, beginTurn, createMatch, endTurn, playCard, TURN_LIMIT,
  type SpellTarget,
} from '../game/match';
import { ELEMENTS } from '../data/elements';
import type { BossDef } from '../data/bosses';
import type { BattleCard, CollectionCard, MatchState, Owner } from '../game/types';

interface Props {
  deck: CollectionCard[];
  boss: BossDef;
  /** Optional uploaded player photo (data URL). When set, the player
      portrait shows this image; otherwise it falls back to the "Y" letter. */
  playerAvatar?: string;
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

export function MatchBoard({ deck, boss, playerAvatar, onExit }: Props) {
  const [state, setState] = useState<MatchState>(() => createMatch(deck, boss));
  const [drag, setDrag] = useState<DragState | null>(null);
  /** Index of the hand card currently selected for preview/play (click-to-select). */
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null);
  const [selectedAttacker, setSelectedAttacker] = useState<string | null>(null);
  const [pendingSpell, setPendingSpell] = useState<BattleCard | null>(null);
  const [combat, setCombat] = useState<CombatFx | null>(null);
  const [damages, setDamages] = useState<DamageMap>({});
  /** Battle ids of creatures whose slice/death animation is currently playing. */
  const [dyingIds, setDyingIds] = useState<string[]>([]);
  const [inspect, setInspect] = useState<BattleCard | null>(null);
  /** Card that the AI just played, shown as a centered reveal so the player sees it. */
  const [opponentReveal, setOpponentReveal] = useState<BattleCard | null>(null);
  /** Spell the player just cast, shown as a centered reveal — same beat as opponentReveal. */
  const [playerSpellReveal, setPlayerSpellReveal] = useState<BattleCard | null>(null);
  /** Sliding "YOUR TURN" / "BOSS TURN" banner — drives the keyframe on turn change. */
  const [turnBanner, setTurnBanner] = useState<Owner | null>(null);
  /** Which graveyard pile (if any) is open in the modal. */
  const [graveyardOpen, setGraveyardOpen] = useState<Owner | null>(null);
  /** Pre-match coin flip is animating. While true, the AI driver is paused
      and the player can't interact — keeps the opening uniform either way. */
  const [flipping, setFlipping] = useState(true);
  /** Give-up confirmation modal. We never quit on the first tap — too easy
      to lose 20 minutes of progress to a misclick. */
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  /** Spell-target burst — coordinates are within the boardRef. Cleared after
      the keyframe finishes. The kind drives the burst color. */
  const [spellFx, setSpellFx] = useState<
    { x: number; y: number; kind: 'damage' | 'freeze' | 'buff' | 'silence' | 'face' } | null
  >(null);
  /** Side that just drew a card at the start of their turn — fires the draw
      flight overlay (a card-back animating from the deck chip into the hand). */
  const [drawingFor, setDrawingFor] = useState<Owner | null>(null);
  /** Bumps on every fired draw so the keyframe replays even when the same
      side draws multiple cards back-to-back (e.g. Suitcase draws 2, Tio
      drew 1 on the same turn-start). */
  const [drawTick, setDrawTick] = useState(0);
  /** Bumps every time the active player's mana ramps so the chip can pulse. */
  const [manaPulse, setManaPulse] = useState(0);
  /** Per-creature buff popup: shows "+atk/+hp" in green over the creature
      slot when a spell_buff resolves on it. Cleared after the keyframe. */
  const [buffs, setBuffs] = useState<Record<string, { atk: number; hp: number }>>({});
  /** Per-creature silence flash trigger — bumping the entry replays the
      gray flash + "SILENCED" text on that creature. */
  const [silencedAt, setSilencedAt] = useState<Record<string, number>>({});
  /** Per-creature on-play trigger label ("DRAW +1", "AOE -2"). Pops above
      the freshly summoned creature so its ability isn't silent. */
  const [triggers, setTriggers] = useState<Record<string, string>>({});
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
  const registerEl = (id: string, el: HTMLElement | null) => {
    if (el) cardEls.current.set(id, el);
    else cardEls.current.delete(id);
  };
  const [arrow, setArrow] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // ============== AI driver ==============
  useEffect(() => {
    if (flipping) return; // wait until the opening coin flip finishes
    if (state.outcome !== 'ongoing') return;
    if (state.turn !== 'opponent') return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
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
          const holdMs = step.played.type === 'Spell' ? 2700 : 1900;
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
          setTimeout(() => { if (!cancelled) setState(step.next); }, 950);
        }
      } else {
        setTimeout(() => {
          if (cancelled) return;
          showMsg('Your turn');
          setState(s => beginTurn(s, 'player'));
        }, 1100);
      }
    };
    const t = setTimeout(tick, 850);
    return () => { cancelled = true; clearTimeout(t); };
  }, [state, flipping]);

  // Show a sliding "YOUR TURN" / "BOSS TURN" banner whenever the active player
  // changes. Skips the very first render so the banner only fires on actual swaps.
  const firstTurnRef = useRef(true);
  useEffect(() => {
    if (firstTurnRef.current) { firstTurnRef.current = false; return; }
    if (state.outcome !== 'ongoing') return;
    setTurnBanner(state.turn);
    const t = setTimeout(() => setTurnBanner(null), 1400);
    return () => clearTimeout(t);
  }, [state.turn, state.outcome]);

  // Surface silent state changes — non-combat HP loss (Lion's AOE),
  // creature buffs (Coffee / Family Photo / Promotion / etc.), silence
  // hits, and hand-size increases from on-play draws (Tio, IT Support,
  // Owl, Train Conductor, Suitcase) and spell draws — so the player
  // sees what changed instead of guessing.
  interface CreatureSnap { atk: number; hp: number; ability: string }
  const prevSnapRef = useRef<{
    player: Map<string, CreatureSnap>;
    opponent: Map<string, CreatureSnap>;
    handSize: { player: number; opponent: number };
    fatigue: { player: number; opponent: number };
    turnNumber: number;
  }>({
    player: new Map(), opponent: new Map(),
    handSize: { player: 0, opponent: 0 },
    fatigue: { player: 0, opponent: 0 },
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
      fatigue: { player: state.player.fatigueCount, opponent: state.opponent.fatigueCount },
      turnNumber: state.turnNumber,
    };

    if (!combat) {
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

      if (Object.keys(damagePops).length) {
        setDamages(d => ({ ...d, ...damagePops }));
        setTimeout(() => setDamages(d => {
          const next = { ...d };
          for (const id of Object.keys(damagePops)) delete next[id];
          return next;
        }), 1100);
      }
      if (Object.keys(buffPops).length) {
        setBuffs(b => ({ ...b, ...buffPops }));
        setTimeout(() => setBuffs(b => {
          const next = { ...b };
          for (const id of Object.keys(buffPops)) delete next[id];
          return next;
        }), 1200);
      }
      if (Object.keys(silenced).length) {
        setSilencedAt(s => ({ ...s, ...silenced }));
        setTimeout(() => setSilencedAt(s => {
          const next = { ...s };
          for (const id of Object.keys(silenced)) delete next[id];
          return next;
        }), 900);
      }

      // Draw flight from on-play / mid-turn draws (turnNumber unchanged).
      // Per-turn draws are handled by the dedicated turn-change effect.
      // We use a short ~150ms delay so the flight fires right after the
      // state update (just after the source spell / summon settles) — a
      // longer gap left players wondering where the new cards came from.
      if (fresh.turnNumber === prev.turnNumber) {
        const playerDraws = Math.max(0, fresh.handSize.player - prev.handSize.player);
        const oppDraws = Math.max(0, fresh.handSize.opponent - prev.handSize.opponent);
        const drawDelay = 150;
        for (let i = 0; i < playerDraws; i++) {
          setTimeout(() => {
            setDrawingFor('player');
            setDrawTick(t => t + 1);
            setTimeout(() => setDrawingFor(null), 700);
          }, drawDelay + i * 260);
        }
        for (let i = 0; i < oppDraws; i++) {
          setTimeout(() => {
            setDrawingFor('opponent');
            setDrawTick(t => t + 1);
            setTimeout(() => setDrawingFor(null), 700);
          }, drawDelay + i * 260);
        }
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

      // On-play trigger banners — when a creature with an on-play ability
      // appears on the field, surface "DRAW +N" / "AOE -N" / etc. floating
      // up from the creature itself so the *cause* is unmistakable. Without
      // this, Tio's bonus card felt like it materialized from nowhere.
      const fieldsNow = [...state.player.field, ...state.opponent.field];
      const newTriggers: Record<string, string> = {};
      for (const c of fieldsNow) {
        const wasOnField = prev.player.has(c.battleId) || prev.opponent.has(c.battleId);
        if (wasOnField) continue;
        if (c.abilityKind === 'draw_on_play' && c.abilityValue) {
          newTriggers[c.battleId] = `DRAW +${c.abilityValue}`;
        } else if (c.abilityKind === 'aoe_on_play' && c.abilityValue) {
          newTriggers[c.battleId] = `AOE −${c.abilityValue}`;
        }
      }
      if (Object.keys(newTriggers).length) {
        setTriggers(t => ({ ...t, ...newTriggers }));
        setTimeout(() => setTriggers(t => {
          const next = { ...t };
          for (const id of Object.keys(newTriggers)) delete next[id];
          return next;
        }), 1400);
      }
    }
    prevSnapRef.current = fresh;
  }, [state, combat]);

  // Card draw flight + mana pulse — fire whenever a new player's turn begins
  // (after turn 1, since the initial hand is dealt by createMatch, not by
  // beginTurn). The draw flight is a card-back animating from the active
  // player's deck chip into their hand zone; the mana pulse pops the chip.
  useEffect(() => {
    if (flipping || state.outcome !== 'ongoing') return;
    if (state.turnNumber <= 1) return; // first turn — no draw happened
    setDrawingFor(state.turn);
    setDrawTick(t => t + 1);
    setManaPulse(p => p + 1);
    const t = setTimeout(() => setDrawingFor(null), 700);
    return () => clearTimeout(t);
  }, [state.turn, state.turnNumber, flipping, state.outcome]);

  // Recompute the attack-arrow endpoints whenever combat starts. We read the
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
    setTimeout(() => done(), stateDelay);
    setTimeout(() => {
      setCombat(null);
      setDyingIds([]);
    }, clearDelay);
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
        if (r.ok) setState(r.state);
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
    return <MatchEnd outcome={state.outcome} boss={boss} onExit={onExit} />;
  }

  const bossElement = ELEMENTS[boss.themeId];

  return (
    <div
      ref={boardRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        width: '100%', height: '100%',
        background: `
          radial-gradient(ellipse at 50% 50%, #fef3e0 0%, #ffe0bf 50%, #f8c89c 100%)
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
          <GraveyardButton count={state.opponent.discard.length} onClick={() => setGraveyardOpen('opponent')} />
        </div>
      </div>

      {/* Top spacer — absorbs extra vertical space and hosts the face-down
          opponent hand so it floats between the header and the opp field row. */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', minHeight: 30, paddingBottom: 4 }}>
        <OpponentHand size={state.opponent.hand.length} />
      </div>

      {/* Opponent's creature row */}
      <div style={{
        flex: '0 0 100px',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
        zIndex: 3,
        position: 'relative',
      }}>
        <FieldRow
          side="opponent"
          cards={state.opponent.field}
          combat={combat}
          damages={damages}
          buffs={buffs}
          silencedAt={silencedAt}
          triggers={triggers}
          dyingIds={dyingIds}
          selectedAttacker={selectedAttacker}
          pendingSpell={pendingSpell}
          highlightEmpty={false}
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
          zIndex: 3,
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
          combat={combat}
          damages={damages}
          buffs={buffs}
          silencedAt={silencedAt}
          triggers={triggers}
          dyingIds={dyingIds}
          selectedAttacker={selectedAttacker}
          pendingSpell={pendingSpell}
          highlightEmpty={selectedHandIdx !== null}
          registerEl={registerEl}
          onCardClick={(c) => {
            if (pendingSpell?.abilityKind === 'spell_buff') {
              castPendingAt({ kind: 'creature', owner: 'player', battleId: c.battleId });
            } else {
              onMyCreatureClick(c);
            }
          }}
          onCardLongPress={(c) => setInspect(c)}
        />
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
          <GraveyardButton count={state.player.discard.length} onClick={() => setGraveyardOpen('player')} />
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
        {state.player.hand.map((card, i) => {
          const isDragging = drag?.battleId === card.battleId;
          const isCasting = playerSpellReveal?.battleId === card.battleId;
          if (isDragging || isCasting) return null;
          const cardCount = state.player.hand.length;
          const offset = i - (cardCount - 1) / 2;
          const isSelected = selectedHandIdx === i && !drag;
          // Unaffordable = not enough mana. We don't tint cards red just
          // because it's the boss's turn — that'd flash every card every turn.
          const playableNow = card.cost <= state.player.mana;
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
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 220,
            background: 'rgba(8,4,12,.42)',
            zIndex: 88,
            animation: 'fadeIn .15s',
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
        const playableNow = card.cost <= state.player.mana && state.turn === 'player';
        const isSpell = card.type === 'Spell';
        const needsTarget = isSpell && !(
          card.abilityKind === 'spell_heal' ||
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

      {/* Card draw flight — when a turn starts, animate a card-back flying
          out of the active player's deck chip toward their hand zone. The
          end position is approximated relative to the chip's location. */}
      {drawingFor === 'player' && (
        <div
          key={`draw-p-${drawTick}`}
          style={{
            position: 'absolute', bottom: 70, right: 30,
            animation: 'drawFlyPlayer .7s cubic-bezier(.3,.7,.4,1) forwards',
            pointerEvents: 'none',
            zIndex: 95,
            filter: 'drop-shadow(0 6px 14px rgba(58,46,42,.4))',
          }}
        >
          <CardBack scale={0.32} />
        </div>
      )}
      {drawingFor === 'opponent' && (
        <div
          key={`draw-o-${drawTick}`}
          style={{
            position: 'absolute', top: 30, right: 30,
            animation: 'drawFlyOpp .7s cubic-bezier(.3,.7,.4,1) forwards',
            pointerEvents: 'none',
            zIndex: 95,
            filter: 'drop-shadow(0 6px 14px rgba(58,46,42,.4))',
          }}
        >
          <CardBack scale={0.32} />
        </div>
      )}

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

      {/* Long-press inspect modal */}
      {inspect && (
        <div
          onClick={() => setInspect(null)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,.7)',
            display: 'grid', placeItems: 'center',
            zIndex: 200,
            animation: 'fadeIn .2s',
          }}
        >
          <div style={{ animation: 'cardSummon 0.4s cubic-bezier(.2,.8,.3,1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Card card={inspect} hovered scale={1.1} />
            {/* Status labels — long-press surfaces what every icon on the
                creature actually means, since the small status pills aren't
                self-documenting. */}
            <StatusLabels card={inspect} />
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

function FieldRow({
  side, cards, combat, damages, buffs, silencedAt, triggers, dyingIds, selectedAttacker, pendingSpell,
  highlightEmpty, registerEl, onCardClick, onCardLongPress,
}: {
  side: 'player' | 'opponent';
  cards: BattleCard[];
  combat: CombatFx | null;
  damages: DamageMap;
  /** Per-creature buff popup data — "+atk/+hp" surfaced on the slot. */
  buffs: Record<string, { atk: number; hp: number }>;
  /** Per-creature silence trigger — bumping the value replays the flash. */
  silencedAt: Record<string, number>;
  /** Per-creature on-play trigger label ("DRAW +1") shown briefly. */
  triggers: Record<string, string>;
  dyingIds: string[];
  selectedAttacker: string | null;
  pendingSpell: BattleCard | null;
  /** Brighten empty slot outlines so the player can see where a card will go. */
  highlightEmpty: boolean;
  registerEl: (id: string, el: HTMLElement | null) => void;
  onCardClick: (c: BattleCard) => void;
  onCardLongPress: (c: BattleCard) => void;
}) {
  // Render filled slots first (centered), followed by empty slot outlines so
  // the player can see how many spaces are left and where new creatures will
  // land. Outlines stay subtle by default and brighten on drag/select.
  const emptyCount = Math.max(0, SLOTS_PER_ROW - cards.length);
  // Creature trades render slice + recoil on the big VS preview overlay, not
  // on the tiny battlefield card. We only let the small slice play for face
  // attacks (no preview) and for AI plays that don't go through combat.
  const inTrade = !!combat && combat.defenderId !== 'face';
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
      {cards.map((c) => {
        const targetable = isTargetableForSpell(c, pendingSpell, side);
        const isCombatAttacker = combat?.attackerId === c.battleId && combat.attackerOwner === side;
        const isCombatDefender = combat?.defenderId === c.battleId && combat.defenderOwner === side;
        const friendlySpell = side === 'player' && pendingSpell?.abilityKind === 'spell_buff';
        const isDying = !inTrade && dyingIds.includes(c.battleId);
        return (
          <div
            key={c.battleId}
            ref={(el) => registerEl(c.battleId, el)}
            style={{ display: 'flex', flex: '0 0 auto' }}
          >
            <BattlefieldCard
              card={c}
              shaking={isCombatDefender && !isDying}
              dying={isDying}
              dimWhenExhausted={side === 'player'}
              selected={side === 'player' && selectedAttacker === c.battleId}
              attackable={
                side === 'player'
                  ? !c.tapped && !c.justPlayed
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
              onClick={() => onCardClick(c)}
              onLongPress={() => onCardLongPress(c)}
            />
          </div>
        );
      })}
      {Array.from({ length: emptyCount }).map((_, i) => (
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
      ))}
    </div>
  );
}

/**
 * Inspect-modal helper — explains every icon active on the creature so the
 * player can learn what frozen / sleeping / untargetable / taunt / rush mean
 * by long-pressing the card. Each row shows the icon, its name, and a
 * one-line description.
 */
function StatusLabels({ card }: { card: BattleCard }) {
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
    items.push({ icon: <VolumeX size={14} strokeWidth={2.6} />, color: '#7a6e62',
      label: 'Silenced', hint: 'Ability stripped for one turn — restored at end of owner’s turn.' });
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
function GraveyardButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Graveyard" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: '#fff',
      padding: '5px 9px', borderRadius: 14,
      boxShadow: '0 3px 8px rgba(58,46,42,.10)',
      border: 'none',
      fontSize: 12, fontWeight: 700, color: PALETTE.text,
      cursor: 'pointer',
      fontFamily: '"Fredoka", "Inter", system-ui',
    }}>
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
    case 'silence':      return 'Tap an enemy creature to silence it';
    default:             return 'Tap a target';
  }
}

function isTargetableForSpell(c: BattleCard, spell: BattleCard | null, owner: 'player' | 'opponent'): boolean {
  if (!spell) return false;
  // Silence ignores 'untargetable' on purpose — that's its job.
  if (spell.abilityKind === 'silence') return owner === 'opponent';
  if (c.abilityKind === 'untargetable' && spell.abilityKind !== 'spell_buff') return false;
  if (spell.abilityKind === 'spell_buff') return owner === 'player';
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
      avatar={boss.avatar}
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
          position: 'absolute', top: -10, left: '50%',
          fontSize: 22, fontWeight: 900,
          color: damage > 0 ? '#ee5a52' : '#06d6a0',
          textShadow: '0 2px 0 #fff, 0 0 8px rgba(0,0,0,.3)',
          animation: 'damagePopup .9s ease-out forwards',
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
  // Compact "5 / 7" pill plus a single decorative crystal so the chip stays
  // a fixed width regardless of how much mana the player has. The chip
  // remounts on every pulseKey change, replaying the manaGain keyframe so
  // the player can see the mana ramp at the start of their turn.
  return (
    <div
      key={pulseKey}
      style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: '#fff',
      padding: '5px 10px', borderRadius: 14,
      boxShadow: '0 4px 10px rgba(58,46,42,.12)',
      fontFamily: '"Fredoka", "Inter", system-ui',
      animation: pulseKey ? 'manaGain .6s ease-out' : undefined,
    }}>
      <div style={{
        width: 14, height: 18,
        clipPath: 'polygon(50% 0, 100% 30%, 80% 100%, 20% 100%, 0 30%)',
        background: 'linear-gradient(180deg, #9ed6f7, #3a8fc4)',
        boxShadow: '0 0 6px #3a8fc488',
      }} />
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
  grandpa: {
    win:  { title: 'You won', line: "He tells everyone in town that you used to be his favorite." },
    loss: { title: 'You lost', line: "He's still telling the same story. You're in it now." },
  },
  intern_boss: {
    win:  { title: 'You won', line: "He'll synergize this loss into a learning opportunity." },
    loss: { title: 'You lost', line: "He's already CC'ing leadership about your performance." },
  },
  falconer: {
    win:  { title: 'You won', line: "The bird circles once and lets you walk." },
    loss: { title: 'You lost', line: "The bird is full. The bird is patient." },
  },
  backpacker: {
    win:  { title: 'You won', line: "You took the photo. They were already gone." },
    loss: { title: 'You lost', line: "They're posting from a different country by sunrise." },
  },
};

function MatchEnd({ outcome, boss, onExit }: {
  outcome: 'win' | 'loss';
  boss: BossDef;
  onExit: (o: 'win' | 'loss' | 'quit') => void;
}) {
  const isWin = outcome === 'win';
  const dialogue = BOSS_DIALOGUE[boss.id]?.[outcome] ?? {
    title: isWin ? 'You won' : 'You lost',
    line: isWin ? 'Well played.' : 'Better luck next time.',
  };
  const reward = isWin ? 75 : 20;

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
          // Single warm gradient for the avatar — no more boss-theme colors
          // bleeding into the result palette.
          background: isWin
            ? 'linear-gradient(160deg, #ff9f1c, #ee5a52)'
            : 'linear-gradient(160deg, #6e3a32, #3a2018)',
          display: 'grid', placeItems: 'center',
          fontSize: 48, fontWeight: 700, color: '#fff',
          boxShadow: '0 12px 30px rgba(0,0,0,.25), 0 0 0 5px #fff, 0 0 0 7px rgba(255,158,90,.4)',
          fontFamily: '"Fredoka", system-ui',
          filter: isWin ? 'none' : 'grayscale(0.3)',
          transform: isWin ? 'rotate(-4deg)' : 'rotate(2deg)',
        }}>{boss.avatar}</div>
        <div style={{
          marginTop: 14, fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: '#6e5a52', fontWeight: 700,
        }}>
          {boss.name} · {boss.subtitle}
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
        marginBottom: 24, maxWidth: 320, lineHeight: 1.45,
      }}>
        “{dialogue.line}”
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
