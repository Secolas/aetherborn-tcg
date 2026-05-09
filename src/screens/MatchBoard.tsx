import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Flag, Heart, Coins, Layers, Skull } from 'lucide-react';
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

export function MatchBoard({ deck, boss, onExit }: Props) {
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
        showMsg(step.action);
        if (step.combat) {
          playAttackAnimation(step.combat, () => { if (!cancelled) setState(step.next); });
        } else if (step.played) {
          // Show the played card front-and-center so the player can see what
          // was just played — especially important for spells, which would
          // otherwise resolve invisibly. Spells get a longer hold than
          // creatures so the player has time to actually read the ability.
          setOpponentReveal(step.played);
          const holdMs = step.played.type === 'Spell' ? 2200 : 1500;
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
          setTimeout(() => { if (!cancelled) setState(step.next); }, 700);
        }
      } else {
        setTimeout(() => {
          if (cancelled) return;
          showMsg('Your turn');
          setState(s => beginTurn(s, 'player'));
        }, 800);
      }
    };
    const t = setTimeout(tick, 600);
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

    // Creature trades show the big card-vs-card preview. The trade plays out
    // across ~1700ms (slide-in → strike → counter → settle / slice) so the
    // player can actually see who hit who. Face attacks keep the snappy
    // ~500ms timing — there's no preview overlay to wait for.
    const isTrade = defenderKind === 'creature';
    const popDelay = isTrade ? 700 : 250;

    // Damage pops at the strike phase.
    setTimeout(() => {
      const defKey = defenderKind === 'face'
        ? (info.defenderOwner === 'player' ? FACE_PLAYER : FACE_OPP)
        : (defenderId as string);
      setDamages(d => ({ ...d, [defKey]: info.damageToDef }));
      // Counter-strike pops slightly later for trades so the two hits read
      // as separate beats, not one combined flash.
      if (info.damageToAtk > 0) {
        const counterOffset = isTrade ? 300 : 0;
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
      setTimeout(() => setDamages({}), 900);
    }, popDelay);

    // State swap timing — extended for trades so the slice / settle finishes
    // before the cards disappear from state.
    const stateDelay = isTrade
      ? (anyDying ? 1700 : 1400)
      : (anyDying ? 950 : 500);
    const clearDelay = isTrade
      ? (anyDying ? 1900 : 1600)
      : (anyDying ? 1100 : 700);
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

      {/* Opponent header strip — back / give-up button on the left, opp portrait
          + HP in the center, deck / graveyard / turn counter on the right. */}
      <div style={{ flex: '0 0 auto', height: 64, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5, gap: 8, position: 'relative' }}>
        <button onClick={() => setConfirmGiveUp(true)} aria-label="Give up" style={iconBtn}>
          <Flag size={18} strokeWidth={2.4} />
        </button>
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
        {/* Turn counter — pinned to the left of the divider so it's always
            on screen, even when the top header is crowded. */}
        <TurnChip turnNumber={state.turnNumber} limit={TURN_LIMIT} />
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
            highlight={pendingSpell?.abilityKind === 'spell_heal' ? 'heal' : null}
            onClick={onMyFaceClick}
            damage={damages[FACE_PLAYER] ?? null}
            elRef={(el) => registerEl(FACE_PLAYER, el)}
          />
          <ManaCrystals mana={state.player.mana} maxMana={state.player.maxMana} />
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
                willChange: 'transform',
                filter: isSelected ? 'drop-shadow(0 0 14px rgba(244,208,74,.7))' : 'none',
              }}>
                <Card card={card} scale={baseScale} hovered={isSelected} unaffordable={!playableNow} />
              </div>
            </div>
          );
        })}
      </div>

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
            <div style={{
              animation: 'cardSummon 0.28s cubic-bezier(.2,.8,.3,1)',
              filter: 'drop-shadow(0 12px 28px rgba(0,0,0,.35))',
              pointerEvents: 'none',
            }}>
              <Card card={card} scale={0.95} hovered unaffordable={!playableNow} />
            </div>
            <div style={{ display: 'flex', gap: 10, pointerEvents: 'auto' }}>
              <button
                onClick={() => setSelectedHandIdx(null)}
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
                onClick={() => { if (playableNow) playSelectedToField(); }}
                disabled={!playableNow}
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

      {/* Attack arrow — drawn from attacker center to defender center for the
          length of the strike animation. Makes "who is hitting what" obvious. */}
      {arrow && (() => {
        const len = Math.hypot(arrow.x2 - arrow.x1, arrow.y2 - arrow.y1);
        const lineStyle: React.CSSProperties & Record<string, string | number> = {
          strokeDasharray: len,
          animation: 'arrowDraw 0.7s ease-out forwards',
          ['--len' as string]: `${len}px`,
        };
        return (
          <svg style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 150,
          }}>
            <defs>
              <marker id="atkArrowhead" viewBox="0 0 10 10" refX="9" refY="5"
                      markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ee5a52" />
              </marker>
            </defs>
            <line
              x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2}
              stroke="#ee5a52" strokeWidth={4} strokeLinecap="round"
              markerEnd="url(#atkArrowhead)"
              style={lineStyle}
            />
          </svg>
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

      {/* Big card-vs-card preview — shown for the duration of every creature
          trade so the player sees the matchup, not just two tiny cards on the
          field. Hidden for face attacks (the small-card lunge is enough).
          The trade plays out across ~1700ms with a lunge → counter → settle
          rhythm, and the dying side ends with a brightness flare + slash
          rather than just disappearing from the field. */}
      {combat && combat.defenderId !== 'face' && (() => {
        const attackerCard = (combat.attackerOwner === 'player' ? state.player.field : state.opponent.field)
          .find(c => c.battleId === combat.attackerId);
        const defenderCard = (combat.defenderOwner === 'player' ? state.player.field : state.opponent.field)
          .find(c => c.battleId === combat.defenderId);
        if (!attackerCard || !defenderCard) return null;
        const attackerDying = dyingIds.includes(combat.attackerId);
        const defenderDying = dyingIds.includes(combat.defenderId);
        const anyDying = attackerDying || defenderDying;
        const heldMs = anyDying ? 1900 : 1600;
        const leftAnim = attackerDying ? 'vsLeftDying' : 'vsLeftLunge';
        const rightAnim = defenderDying ? 'vsRightDying' : 'vsRightLunge';
        return (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 18,
            zIndex: 170,
            pointerEvents: 'none',
            background: 'rgba(0,0,0,.45)',
            animation: `vsReveal ${heldMs}ms ease-out forwards`,
          }}>
            <div style={{ position: 'relative', animation: `${leftAnim} ${heldMs}ms ease-out forwards` }}>
              <Card card={attackerCard} scale={0.62} hovered />
              {attackerDying && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: 220, height: 7,
                  background: 'linear-gradient(90deg, transparent 0%, #fff 25%, #fffbd0 50%, #fff 75%, transparent 100%)',
                  boxShadow: '0 0 12px #fff, 0 0 24px #f4d04a, 0 0 36px #ff7e5f',
                  animation: `vsCardSlice ${heldMs}ms ease-out forwards`,
                  pointerEvents: 'none',
                  zIndex: 5,
                }} />
              )}
            </div>
            <div style={{
              fontSize: 36, fontWeight: 900, letterSpacing: '0.05em',
              color: '#fff',
              textShadow: '0 3px 0 #c8362e, 0 0 18px rgba(238,90,82,.6)',
              fontFamily: '"Fredoka", system-ui',
              transform: 'rotate(-6deg)',
            }}>VS</div>
            <div style={{ position: 'relative', animation: `${rightAnim} ${heldMs}ms ease-out forwards` }}>
              <Card card={defenderCard} scale={0.62} hovered />
              {defenderDying && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: 220, height: 7,
                  background: 'linear-gradient(90deg, transparent 0%, #fff 25%, #fffbd0 50%, #fff 75%, transparent 100%)',
                  boxShadow: '0 0 12px #fff, 0 0 24px #f4d04a, 0 0 36px #ff7e5f',
                  animation: `vsCardSlice ${heldMs}ms ease-out forwards`,
                  pointerEvents: 'none',
                  zIndex: 5,
                }} />
              )}
            </div>
          </div>
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
          <div style={{ animation: 'cardSummon 0.4s cubic-bezier(.2,.8,.3,1)' }}>
            <Card card={inspect} hovered scale={1.1} />
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
  side, cards, combat, damages, dyingIds, selectedAttacker, pendingSpell,
  highlightEmpty, registerEl, onCardClick, onCardLongPress,
}: {
  side: 'player' | 'opponent';
  cards: BattleCard[];
  combat: CombatFx | null;
  damages: DamageMap;
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
  // Shake when actually hit (damage > 0). Heals don't shake.
  const hit = damage != null && damage > 0;
  return (
    <div ref={elRef} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, position: 'relative',
      cursor: highlight ? 'pointer' : 'default',
      padding: 4, borderRadius: 30,
      background: '#fff',
      boxShadow: ring
        ? `0 0 0 2px ${ring}, 0 0 14px ${ring}, 0 4px 10px rgba(58,46,42,.12)`
        : hit
          ? '0 0 0 2px #ee5a52, 0 0 16px rgba(238,90,82,.6), 0 4px 10px rgba(58,46,42,.12)'
          : '0 4px 10px rgba(58,46,42,.12)',
      animation: hit
        ? 'shake 0.4s, hpFlash 0.5s'
        : damage ? 'hpFlash 0.5s' : undefined,
      transition: 'box-shadow .15s',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: `conic-gradient(from 90deg, ${themeDeep}, ${themeColor}, ${themeDeep})`,
        padding: 2, position: 'relative',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: `linear-gradient(160deg, ${themeDeep}, ${themeColor})`,
          display: 'grid', placeItems: 'center',
          fontSize: 18, fontWeight: 700, color: '#fff',
          fontFamily: '"Fredoka", system-ui',
        }}>{boss.avatar}</div>
      </div>
      <div style={{ paddingRight: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.text, lineHeight: 1.05 }}>{boss.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <Heart size={15} fill="#ee5a52" color="#ee5a52" strokeWidth={2} />
          <span style={{ fontSize: 18, fontWeight: 700, color: PALETTE.text }}>{hp}</span>
        </div>
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

function PlayerPortrait({ hp, highlight, onClick, damage, elRef }: {
  hp: number;
  highlight: 'heal' | null;
  onClick: () => void;
  damage: number | null;
  elRef?: (el: HTMLElement | null) => void;
}) {
  const ring = highlight === 'heal' ? '#06d6a0' : null;
  const hit = damage != null && damage > 0;
  return (
    <div ref={elRef} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, position: 'relative',
      cursor: highlight ? 'pointer' : 'default',
      padding: 4, borderRadius: 30,
      background: '#fff',
      boxShadow: ring
        ? `0 0 0 2px ${ring}, 0 0 14px ${ring}, 0 4px 10px rgba(58,46,42,.12)`
        : hit
          ? '0 0 0 2px #ee5a52, 0 0 16px rgba(238,90,82,.6), 0 4px 10px rgba(58,46,42,.12)'
          : '0 4px 10px rgba(58,46,42,.12)',
      animation: hit
        ? 'shake 0.4s, hpFlash 0.5s'
        : damage ? 'hpFlash 0.5s' : undefined,
      transition: 'box-shadow .15s',
    }}>
      <div style={{ paddingLeft: 8, textAlign: 'right' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: PALETTE.textMid, letterSpacing: '0.05em' }}>You</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1, justifyContent: 'flex-end' }}>
          <Heart size={15} fill="#ee5a52" color="#ee5a52" strokeWidth={2} />
          <span style={{ fontSize: 18, fontWeight: 700, color: PALETTE.text }}>{hp}</span>
        </div>
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'conic-gradient(from 90deg, #6e1f1a, #d96658, #6e1f1a)',
        padding: 2, position: 'relative',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: 'linear-gradient(160deg, #6e1f1a, #d96658)',
          display: 'grid', placeItems: 'center',
          fontSize: 18, fontWeight: 700, color: '#fff',
          fontFamily: '"Fredoka", system-ui',
        }}>Y</div>
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
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: '#fff',
      padding: '5px 11px', borderRadius: 14,
      boxShadow: '0 3px 8px rgba(58,46,42,.10)',
      fontSize: 12, fontWeight: 600, color: PALETTE.textMid,
    }}>
      <Layers size={14} color={PALETTE.accentDeep} strokeWidth={2.4} />
      <span style={{ color: PALETTE.text, fontWeight: 700 }}>{count}</span>
      <span style={{ opacity: 0.7 }}>deck</span>
      <span style={{ width: 1, height: 14, background: 'rgba(58,46,42,.12)' }} />
      <span style={{ color: PALETTE.text, fontWeight: 700 }}>{handSize}</span>
      <span style={{ opacity: 0.7 }}>hand</span>
    </div>
  );
}

function ManaCrystals({ mana, maxMana }: { mana: number; maxMana: number }) {
  // Compact "5 / 7" pill plus a single decorative crystal so the chip stays
  // a fixed width regardless of how much mana the player has. The old fan
  // of crystals grew with maxMana and started pushing the deck/graveyard
  // chips off the right edge of the screen at high mana counts.
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: '#fff',
      padding: '5px 10px', borderRadius: 14,
      boxShadow: '0 4px 10px rgba(58,46,42,.12)',
      fontFamily: '"Fredoka", "Inter", system-ui',
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
