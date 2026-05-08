import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, Coins, Layers, Skull } from 'lucide-react';
import { Card } from '../components/Card';
import { BattlefieldCard } from '../components/BattlefieldCard';
import { CardBack } from '../components/CardBack';
import { CoinFlip } from '../components/CoinFlip';
import { GraveyardModal } from '../components/GraveyardModal';
import { iconBtn, btnPrimary, PALETTE } from '../components/styles';
import { aiStep, type AiCombat } from '../game/ai';
import {
  attack, beginTurn, createMatch, endTurn, playCard,
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
  const [msg, setMsg] = useState<string>('Your turn');
  const fieldRef = useRef<HTMLDivElement | null>(null);
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

    // Damage pops at impact (~250ms in)
    setTimeout(() => {
      const defKey = defenderKind === 'face'
        ? (info.defenderOwner === 'player' ? FACE_PLAYER : FACE_OPP)
        : (defenderId as string);
      setDamages(d => ({ ...d, [defKey]: info.damageToDef }));
      if (info.damageToAtk > 0) {
        setDamages(d => ({ ...d, [info.attackerId]: info.damageToAtk }));
      }
      // Trigger slice on whichever creatures are about to die.
      const dying: string[] = [];
      if (defenderDying && defenderKind === 'creature') dying.push(defenderId as string);
      if (attackerDying) dying.push(info.attackerId);
      if (dying.length) setDyingIds(dying);

      setTimeout(() => setDamages({}), 900);
    }, 250);

    // Hold state update until after the slice animation when something dies.
    const stateDelay = anyDying ? 950 : 500;
    const clearDelay = anyDying ? 1100 : 700;
    setTimeout(() => done(), stateDelay);
    setTimeout(() => {
      setCombat(null);
      setDyingIds([]);
    }, clearDelay);
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
    const fr = fieldRef.current?.getBoundingClientRect();
    const overField = !!fr &&
      ev.clientX >= fr.left && ev.clientX <= fr.right &&
      ev.clientY >= fr.top  && ev.clientY <= fr.bottom;
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
      style={{
        width: '100%', height: '100%',
        background: `
          radial-gradient(ellipse at 50% 50%, #fef3e0 0%, #ffe0bf 50%, #f8c89c 100%)
        `,
        position: 'relative', overflow: 'hidden',
        fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
        color: PALETTE.text,
        userSelect: 'none', touchAction: 'none',
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

      {/* Opponent's face-down hand floats at the very top, centered. */}
      <OpponentHand size={state.opponent.hand.length} />

      {/* Opponent header strip — back button on the left, opp portrait + HP on
          the right. Top: 16, height ~64 per the layout spec. */}
      <div style={{ position: 'absolute', top: 16, left: 12, right: 12, height: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5, gap: 8 }}>
        <button onClick={() => onExit('quit')} style={iconBtn}><ArrowLeft size={18} /></button>
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
          <div style={{
            background: '#fff',
            padding: '4px 10px', borderRadius: 12,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            color: PALETTE.textMid,
            boxShadow: '0 2px 6px rgba(58,46,42,.08)',
          }}>
            T{state.turnNumber}
          </div>
        </div>
      </div>

      {/* Opponent's creature row — top: 230, height ~110. flex-center so a
          single creature sits dead-center, two flank center, etc. */}
      <div style={{
        position: 'absolute', top: 230, left: 0, right: 0, height: 110,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
        zIndex: 3,
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

      {/* Center divider band — the drop zone. Top: 350, height: 56. Dashed top
          + bottom borders that intensify when a card is dragged into it. The
          End Turn button (or "Release to summon" hint during drag) lives here.
          The phase label floats ABOVE this band, not inside it, so it never
          fights the button for the click. */}
      <div ref={fieldRef} style={{
        position: 'absolute', top: 350, left: 0, right: 0, height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
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
      }}
        onClick={() => { if (selectedHandIdx !== null) playSelectedToField(); }}
      >
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
      </div>

      {/* Floating turn-status label — sits above the divider line at top:364
          with pointer-events:none so it never intercepts clicks meant for the
          End Turn button or the drop zone. Doubles as the transient action
          message slot ("Drew 2 cards", error reasons, etc.). */}
      <div style={{
        position: 'absolute', top: 364, left: 0, right: 0,
        textAlign: 'center', pointerEvents: 'none',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: PALETTE.textMid,
        zIndex: 5,
      }}>
        {msg !== 'Your turn' && msg !== `${boss.name}'s turn`
          ? msg
          : (state.turn === 'player' ? 'Your Turn' : "Opponent's Turn")}
      </div>

      {/* Player's creature row — top: 416, mirror of the opponent row. */}
      <div
        onClick={() => { if (selectedHandIdx !== null) playSelectedToField(); }}
        style={{
          position: 'absolute', top: 416, left: 0, right: 0, height: 110,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
          zIndex: 3,
          cursor: selectedHandIdx !== null ? 'pointer' : 'default',
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

      {/* Player stats — HP + mana left, deck + graveyard right. Top: 540. */}
      <div style={{ position: 'absolute', top: 540, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, zIndex: 6 }}>
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

      {/* Hand — flat row. Tapping a card no longer lifts it in place (which
          would clip off the left edge of the screen for the leftmost card);
          instead we render a centered preview overlay above the hand. */}
      <div style={{
        position: 'absolute', bottom: 30, left: 0, right: 0, height: 220,
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
          const stride = cardCount <= 4 ? 80
                       : cardCount <= 5 ? 70
                       : cardCount <= 6 ? 56
                       : 48;
          const xOff = offset * stride;
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
                transform: `translateX(-50%) translateY(${isSelected ? -10 : 0}px)`,
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
          tapped. Replaces the in-place lift so the preview never gets cut off
          on screens narrower than 1.35× the card width. */}
      {selectedHandIdx !== null && state.player.hand[selectedHandIdx] && !drag && (() => {
        const card = state.player.hand[selectedHandIdx];
        const playableNow = card.cost <= state.player.mana;
        return (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 200,
              display: 'flex', justifyContent: 'center',
              zIndex: 90,
              pointerEvents: 'none',
              animation: 'fadeIn 0.15s',
            }}
          >
            <div
              onClick={() => playSelectedToField()}
              style={{
                animation: 'cardSummon 0.28s cubic-bezier(.2,.8,.3,1)',
                filter: 'drop-shadow(0 12px 28px rgba(0,0,0,.35))',
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
            >
              <Card card={card} scale={0.95} hovered unaffordable={!playableNow} />
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
          field. Hidden for face attacks (the small-card lunge is enough). */}
      {combat && combat.defenderId !== 'face' && (() => {
        const attackerCard = (combat.attackerOwner === 'player' ? state.player.field : state.opponent.field)
          .find(c => c.battleId === combat.attackerId);
        const defenderCard = (combat.defenderOwner === 'player' ? state.player.field : state.opponent.field)
          .find(c => c.battleId === combat.defenderId);
        if (!attackerCard || !defenderCard) return null;
        const attackerDying = dyingIds.includes(combat.attackerId);
        const defenderDying = dyingIds.includes(combat.defenderId);
        const heldMs = (attackerDying || defenderDying) ? 1100 : 700;
        return (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 18,
            zIndex: 170,
            pointerEvents: 'none',
            background: 'rgba(0,0,0,.4)',
            animation: `vsReveal ${heldMs}ms ease-out forwards`,
          }}>
            <div style={{ animation: `vsRevealLeft ${heldMs}ms ease-out forwards` }}>
              <Card card={attackerCard} scale={0.62} hovered />
            </div>
            <div style={{
              fontSize: 36, fontWeight: 900, letterSpacing: '0.05em',
              color: '#fff',
              textShadow: '0 3px 0 #c8362e, 0 0 18px rgba(238,90,82,.6)',
              fontFamily: '"Fredoka", system-ui',
              transform: 'rotate(-6deg)',
            }}>VS</div>
            <div style={{ animation: `vsRevealRight ${heldMs}ms ease-out forwards` }}>
              <Card card={defenderCard} scale={0.62} hovered />
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
    </div>
  );
}

function FieldRow({
  side, cards, combat, damages, dyingIds, selectedAttacker, pendingSpell,
  registerEl, onCardClick, onCardLongPress,
}: {
  side: 'player' | 'opponent';
  cards: BattleCard[];
  combat: CombatFx | null;
  damages: DamageMap;
  dyingIds: string[];
  selectedAttacker: string | null;
  pendingSpell: BattleCard | null;
  /** Reserved for future use — empty slots are no longer rendered. */
  highlightEmpty: boolean;
  registerEl: (id: string, el: HTMLElement | null) => void;
  onCardClick: (c: BattleCard) => void;
  onCardLongPress: (c: BattleCard) => void;
}) {
  // Empty slots are no longer rendered — a single creature should sit dead
  // center, two should flank the center, etc. The drop zone for playing new
  // creatures is the divider band, not a row of slot outlines.
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
      {cards.map((c) => {
        const targetable = isTargetableForSpell(c, pendingSpell, side);
        const isCombatAttacker = combat?.attackerId === c.battleId && combat.attackerOwner === side;
        const isCombatDefender = combat?.defenderId === c.battleId && combat.defenderOwner === side;
        const friendlySpell = side === 'player' && pendingSpell?.abilityKind === 'spell_buff';
        const isDying = dyingIds.includes(c.battleId);
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
  // Sits in the breathing zone between the opp header (ends ~80) and the
  // opp creature row (starts at 230) — high enough to feel "above the field"
  // but not colliding with the centered portrait in the header.
  return (
    <div style={{
      position: 'absolute', top: 130, left: 0, right: 0, height: 70,
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
    default:             return 'Tap a target';
  }
}

function isTargetableForSpell(c: BattleCard, spell: BattleCard | null, owner: 'player' | 'opponent'): boolean {
  if (!spell) return false;
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
  return (
    <div ref={elRef} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, position: 'relative',
      cursor: highlight ? 'pointer' : 'default',
      padding: 4, borderRadius: 30,
      background: '#fff',
      boxShadow: ring
        ? `0 0 0 2px ${ring}, 0 0 14px ${ring}, 0 4px 10px rgba(58,46,42,.12)`
        : '0 4px 10px rgba(58,46,42,.12)',
      animation: damage ? 'hpFlash 0.5s' : undefined,
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
  return (
    <div ref={elRef} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, position: 'relative',
      cursor: highlight ? 'pointer' : 'default',
      padding: 4, borderRadius: 30,
      background: '#fff',
      boxShadow: ring
        ? `0 0 0 2px ${ring}, 0 0 14px ${ring}, 0 4px 10px rgba(58,46,42,.12)`
        : '0 4px 10px rgba(58,46,42,.12)',
      animation: damage ? 'hpFlash 0.5s' : undefined,
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
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      background: '#fff',
      padding: '6px 10px', borderRadius: 14,
      boxShadow: '0 4px 10px rgba(58,46,42,.12)',
    }}>
      {Array.from({ length: maxMana }).map((_, i) => (
        <div key={i} style={{
          width: 12, height: 16,
          clipPath: 'polygon(50% 0, 100% 30%, 80% 100%, 20% 100%, 0 30%)',
          background: i < mana ? 'linear-gradient(180deg, #9ed6f7, #3a8fc4)' : 'rgba(58,46,42,.1)',
          boxShadow: i < mana ? '0 0 4px #3a8fc488' : 'none',
          transition: 'all .2s',
        }} />
      ))}
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
  const e = ELEMENTS[boss.themeId];
  const dialogue = BOSS_DIALOGUE[boss.id]?.[outcome] ?? {
    title: isWin ? 'You won' : 'You lost',
    line: isWin ? 'Well played.' : 'Better luck next time.',
  };
  const reward = isWin ? 75 : 20;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: isWin
        ? `radial-gradient(ellipse at 50% 30%, #fff8e8 0%, ${e.color}55 50%, ${e.deep}88 100%)`
        : `radial-gradient(ellipse at 50% 30%, #fef3eb 0%, #f0c9b9 50%, #b88a78 100%)`,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 30px', textAlign: 'center',
      animation: 'fadeIn 0.5s',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative confetti for wins, soft droplets for losses */}
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

      {/* Boss avatar */}
      <div style={{
        position: 'relative', zIndex: 2,
        animation: isWin ? 'cardSummon .6s cubic-bezier(.2,.8,.3,1)' : 'fadeIn .5s',
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: `linear-gradient(160deg, ${e.deep}, ${e.color})`,
          display: 'grid', placeItems: 'center',
          fontSize: 48, fontWeight: 700, color: '#fff',
          boxShadow: `0 12px 30px rgba(0,0,0,.25), 0 0 0 5px #fff, 0 0 0 7px ${e.color}55`,
          fontFamily: '"Fredoka", system-ui',
          filter: isWin ? 'none' : 'grayscale(0.3)',
          transform: isWin ? 'rotate(-4deg)' : 'rotate(2deg)',
        }}>{boss.avatar}</div>
        <div style={{
          marginTop: 14, fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: PALETTE.textMid, fontWeight: 600,
        }}>
          {boss.name} · {boss.subtitle}
        </div>
      </div>

      <div style={{
        fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
        color: PALETTE.textMid, marginTop: 30, marginBottom: 4, fontWeight: 600,
      }}>
        {isWin ? 'Victory' : 'Defeat'}
      </div>
      <div style={{
        fontSize: 44, fontWeight: 700, lineHeight: 1.05,
        background: isWin
          ? 'linear-gradient(180deg, #ff9f1c, #ee5a52)'
          : 'linear-gradient(180deg, #6e3a32, #3a2018)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: 12,
      }}>{dialogue.title}</div>
      <div style={{
        fontSize: 14, color: PALETTE.text, fontStyle: 'italic',
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
        <span style={{ fontSize: 17, fontWeight: 700, color: PALETTE.text }}>+{reward}</span>
        <span style={{ fontSize: 11, color: PALETTE.textMid, fontWeight: 500 }}>coins</span>
      </div>

      <button onClick={() => onExit(outcome)} style={{ ...btnPrimary, minWidth: 220 }}>
        Continue
      </button>
    </div>
  );
}
