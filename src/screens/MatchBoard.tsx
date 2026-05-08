import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, Coins, Layers } from 'lucide-react';
import { Card } from '../components/Card';
import { BattlefieldCard } from '../components/BattlefieldCard';
import { CardBack } from '../components/CardBack';
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
          // otherwise resolve invisibly.
          setOpponentReveal(step.played);
          setTimeout(() => {
            if (cancelled) return;
            setOpponentReveal(null);
            setState(step.next);
          }, 1500);
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
  }, [state]);

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
    if (selectedAttacker) playerAttack({ battleId: c.battleId });
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
      {/* Opponent's hand — face-down cards fanned at the very top so the player
          can see how many cards the boss is holding (Pokemon-style). */}
      <OpponentHand size={state.opponent.hand.length} />

      {/* The battlefield "table" — gives the combat area visual weight and
          frames the two field rows + center line. */}
      <div style={{
        position: 'absolute', top: 96, left: 8, right: 8, height: 248,
        borderRadius: 22,
        background: `
          radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,.5) 0%, transparent 60%),
          linear-gradient(180deg, rgba(255,236,210,.6) 0%, rgba(248,200,156,.5) 100%)
        `,
        border: '1.5px solid rgba(255,126,95,.18)',
        boxShadow: '0 12px 32px rgba(120,60,30,.12), inset 0 0 30px rgba(255,200,160,.3)',
        pointerEvents: 'none',
      }} />

      <svg style={{ position: 'absolute', inset: 0, opacity: 0.08 }} width="100%" height="100%">
        <defs>
          <pattern id="hex" width="30" height="26" patternUnits="userSpaceOnUse">
            <polygon points="15,1 28,8 28,22 15,29 2,22 2,8" fill="none" stroke={PALETTE.accent} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)" />
      </svg>

      {/* Top header — single inline row: portrait + deck chip on the left,
          turn counter + exit on the right. Sits below the face-down hand. */}
      <div style={{ position: 'absolute', top: 56, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <DeckChip count={state.opponent.deck.length} handSize={state.opponent.hand.length} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            background: '#fff',
            padding: '4px 10px', borderRadius: 12,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            color: PALETTE.textMid,
            boxShadow: '0 2px 6px rgba(58,46,42,.08)',
          }}>
            Turn {state.turnNumber}
          </div>
          <button onClick={() => onExit('quit')} style={iconBtn}><ArrowLeft size={18} /></button>
        </div>
      </div>

      {/* Opponent field */}
      <div style={{
        position: 'absolute', top: 108, left: 12, right: 12,
        display: 'flex', justifyContent: 'center', gap: 4,
        minHeight: 90,
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

      {/* Center divider — slim battle line with phase indicator + end-turn button */}
      <div ref={fieldRef} style={{
        position: 'absolute', top: 204, left: 0, right: 0, height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        borderTop: drag?.overField ? `2px dashed ${PALETTE.accent}` : `1px solid rgba(58,46,42,.10)`,
        borderBottom: drag?.overField ? `2px dashed ${PALETTE.accent}` : `1px solid rgba(58,46,42,.10)`,
        background: drag?.overField ? 'rgba(255,126,95,.12)' : 'rgba(255,255,255,.25)',
        transition: 'background .15s, border-color .15s',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
          color: state.turn === 'player' ? PALETTE.accentDeep : PALETTE.textMid,
          textTransform: 'uppercase',
        }}>
          {state.turn === 'player' ? 'Your Turn' : `${boss.name}'s Turn`}
        </div>

        {drag?.overField ? (
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: PALETTE.accentDeep }}>
            {drag.cardType === 'Creature' ? '↓ Release to summon ↓' : '↓ Release to choose target ↓'}
          </div>
        ) : selectedHandIdx !== null ? (
          <div style={{ fontSize: 11, fontWeight: 700, color: PALETTE.accentDeep, letterSpacing: '0.05em' }}>
            Tap your field to play
          </div>
        ) : pendingSpell ? (
          // Persistent target instruction so the player isn't lost mid-cast.
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: PALETTE.accentDeep, textTransform: 'uppercase' }}>
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
          <button onClick={onEndTurn} disabled={state.turn !== 'player'} style={{
            background: state.turn === 'player'
              ? 'linear-gradient(180deg, #ffa07a 0%, #ff7e5f 100%)'
              : '#e8d8c8',
            color: state.turn === 'player' ? '#fff' : '#9a8678',
            border: 'none', borderRadius: 22, padding: '9px 20px',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.03em',
            cursor: state.turn === 'player' ? 'pointer' : 'default',
            boxShadow: state.turn === 'player' ? '0 4px 12px rgba(255,94,60,.35)' : 'none',
            fontFamily: '"Fredoka", system-ui',
          }}>End Turn →</button>
        )}
      </div>

      {/* My field — slot outlines visible. Click an empty slot to play a selected hand card. */}
      <div
        onClick={() => { if (selectedHandIdx !== null) playSelectedToField(); }}
        style={{
          position: 'absolute', top: 246, left: 12, right: 12,
          display: 'flex', justifyContent: 'center', gap: 4,
          minHeight: 90,
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

      {/* Brief flash messages (errors, action confirmations) appear here.
          Whose turn it is is shown in the center bar — no duplicate. */}
      <div style={{ position: 'absolute', top: 344, left: 0, right: 0, textAlign: 'center', fontSize: 11, fontWeight: 600, color: PALETTE.textMid, height: 16, transition: 'opacity .2s' }}>
        {msg !== 'Your turn' && msg !== `${boss.name}'s turn` ? msg : ''}
      </div>

      {/* My stats row: mana, deck count, player portrait */}
      <div style={{ position: 'absolute', top: 366, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 }}>
        <ManaCrystals mana={state.player.mana} maxMana={state.player.maxMana} />
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <DeckChip count={state.player.deck.length} handSize={state.player.hand.length} />
        </div>
        <PlayerPortrait
          hp={state.player.hp}
          highlight={pendingSpell?.abilityKind === 'spell_heal' ? 'heal' : null}
          onClick={onMyFaceClick}
          damage={damages[FACE_PLAYER] ?? null}
          elRef={(el) => registerEl(FACE_PLAYER, el)}
        />
      </div>

      {/* Hand — flat Yu-Gi-Oh-style row. Tap a card to lift it for preview,
          tap your field to play. Cards are always visible regardless of mana
          (cost just shows in red when you can't afford it). */}
      <div style={{
        position: 'absolute', bottom: 8, left: 0, right: 0, height: 240,
        pointerEvents: 'none',
      }}>
        {state.player.hand.map((card, i) => {
          const isDragging = drag?.battleId === card.battleId;
          const isCasting = playerSpellReveal?.battleId === card.battleId;
          if (isDragging || isCasting) return null;
          const cardCount = state.player.hand.length;
          const offset = i - (cardCount - 1) / 2;
          const isSelected = selectedHandIdx === i && !drag;
          const playableNow = card.cost <= state.player.mana && state.turn === 'player';
          const baseScale = 0.66;
          const cardW = 220 * baseScale; // 145
          // Stride scales with hand size so cards always fit the screen
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
                height: 320 * baseScale + 80,
                zIndex: isSelected ? 100 : 10 + i,
                cursor: 'pointer',
                touchAction: 'none',
                pointerEvents: 'auto',
              }}
            >
              <div style={{
                position: 'absolute', bottom: 0, left: '50%',
                transform: `translateX(-50%) translateY(${isSelected ? -80 : 0}px) scale(${isSelected ? 1.35 : 1})`,
                transformOrigin: 'bottom center',
                transition: 'transform .22s cubic-bezier(.2,.8,.3,1)',
                pointerEvents: 'none',
                willChange: 'transform',
              }}>
                <Card card={card} scale={baseScale} hovered={isSelected} />
                {!playableNow && (
                  <div style={{
                    position: 'absolute', top: 6 * baseScale, left: 6 * baseScale,
                    width: 36 * baseScale, height: 36 * baseScale, borderRadius: '50%',
                    background: '#ee5a52',
                    boxShadow: '0 0 0 2px #fff, 0 0 0 3px #ee5a52',
                    display: 'grid', placeItems: 'center',
                    fontSize: 22 * baseScale, fontWeight: 800,
                    color: '#fff',
                    fontFamily: '"Fredoka", system-ui',
                    pointerEvents: 'none',
                  }}>{card.cost}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}

const SLOTS_PER_ROW = 6;

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
  highlightEmpty: boolean;
  registerEl: (id: string, el: HTMLElement | null) => void;
  onCardClick: (c: BattleCard) => void;
  onCardLongPress: (c: BattleCard) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: SLOTS_PER_ROW }).map((_, i) => {
        const c = cards[i];
        if (!c) {
          return (
            <div key={`empty-${i}`} style={{
              width: 64, height: 90,
              borderRadius: 9,
              border: highlightEmpty
                ? '2px dashed rgba(255,126,95,.6)'
                : '1.5px dashed rgba(58,46,42,.18)',
              background: highlightEmpty
                ? 'rgba(255,126,95,.08)'
                : 'rgba(255,255,255,.18)',
              transition: 'border-color .2s, background .2s',
            }} />
          );
        }
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

/** Face-down hand at the top — visualizes how many cards the boss is holding. */
function OpponentHand({ size }: { size: number }) {
  if (size <= 0) return null;
  // Negative margin compresses the cards into a fan. Tighter for big hands.
  const overlap = size <= 4 ? -28 : size <= 6 ? -38 : -46;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 50,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      paddingTop: 4,
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
          fontSize: 22, fontWeight: 900, color: '#ee5a52',
          textShadow: '0 2px 0 #fff, 0 0 8px rgba(0,0,0,.3)',
          animation: 'damagePopup .9s ease-out forwards',
          pointerEvents: 'none',
          fontFamily: '"Fredoka", system-ui',
          whiteSpace: 'nowrap',
        }}>−{damage}</div>
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
          fontSize: 22, fontWeight: 900, color: '#ee5a52',
          textShadow: '0 2px 0 #fff, 0 0 8px rgba(0,0,0,.3)',
          animation: 'damagePopup .9s ease-out forwards',
          pointerEvents: 'none',
          fontFamily: '"Fredoka", system-ui',
          whiteSpace: 'nowrap',
        }}>−{damage}</div>
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
