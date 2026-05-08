import { useEffect, useRef, useState } from 'react';
import { Card } from '../components/Card';
import { BattlefieldCard } from '../components/BattlefieldCard';
import { iconBtn, btnPrimary } from '../components/styles';
import { aiStep, type AiCombat } from '../game/ai';
import {
  attack, beginTurn, createMatch, endTurn, playCard,
  type SpellTarget,
} from '../game/match';
import type { BattleCard, CollectionCard, MatchState, Owner } from '../game/types';

interface Props {
  deck: CollectionCard[];
  onExit: (outcome: 'win' | 'loss' | 'quit') => void;
}

interface DragState {
  battleId: string;
  cardType: 'Creature' | 'Spell';
  x: number; y: number;     // current finger position (viewport coords)
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

export function MatchBoard({ deck, onExit }: Props) {
  const [state, setState] = useState<MatchState>(() => createMatch(deck));
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedAttacker, setSelectedAttacker] = useState<string | null>(null);
  const [pendingSpell, setPendingSpell] = useState<BattleCard | null>(null);
  const [combat, setCombat] = useState<CombatFx | null>(null);
  const [damages, setDamages] = useState<DamageMap>({});
  const [inspect, setInspect] = useState<BattleCard | null>(null);
  const [msg, setMsg] = useState<string>('Your turn');
  const fieldRef = useRef<HTMLDivElement | null>(null);

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

  const showMsg = (m: string) => setMsg(m);

  const flashMsg = (m: string) => {
    showMsg(m);
    setTimeout(() => showMsg(state.turn === 'player' ? 'Your turn' : "Vex's turn"), 1200);
  };

  // ============== Combat animation orchestration ==============
  // Plays the lunge + damage popups, then calls done() to apply the actual state change.
  const playAttackAnimation = (info: AiCombat | CombatFx, done: () => void) => {
    setCombat({
      attackerId: info.attackerId,
      attackerOwner: info.attackerOwner,
      defenderId: 'defenderKind' in info
        ? (info.defenderKind === 'face' ? 'face' : info.defenderId!)
        : info.defenderId,
      defenderOwner: info.defenderOwner,
      damageToDef: info.damageToDef,
      damageToAtk: info.damageToAtk,
    });

    // Damage pops at impact (~250ms in)
    setTimeout(() => {
      const defKey = (('defenderKind' in info ? info.defenderKind : (info.defenderId === 'face' ? 'face' : 'creature')) === 'face')
        ? (info.defenderOwner === 'player' ? FACE_PLAYER : FACE_OPP)
        : ('defenderKind' in info ? info.defenderId! : info.defenderId);
      setDamages(d => ({ ...d, [defKey as string]: info.damageToDef }));
      // Counter-damage on attacker (creature trade)
      if (info.damageToAtk > 0) {
        setDamages(d => ({ ...d, [info.attackerId]: info.damageToAtk }));
      }
      // Clear damages after their popup animation finishes
      setTimeout(() => {
        setDamages({});
      }, 900);
    }, 250);

    // Apply real state at peak of lunge
    setTimeout(() => done(), 500);

    // Clear combat state when animation finishes
    setTimeout(() => setCombat(null), 700);
  };

  // ============== Drag from hand ==============
  const onCardPointerDown = (ev: React.PointerEvent, card: BattleCard) => {
    if (state.turn !== 'player' || state.outcome !== 'ongoing') return;
    if (card.cost > state.player.mana) {
      flashMsg('Not enough mana');
      return;
    }
    const rect = ev.currentTarget.getBoundingClientRect();
    setDrag({
      battleId: card.battleId,
      cardType: card.type,
      x: ev.clientX, y: ev.clientY,
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
        if (drag.overField) {
          const r = playCard(state, 'player', card.battleId, { kind: 'face', owner: 'player' });
          if (r.ok) setState(r.state);
          else flashMsg(r.reason ?? 'Cannot cast');
        }
      } else if (drag.overField) {
        setPendingSpell(card);
        flashMsg('Select a target');
      }
    }
    setDrag(null);
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
    const r = playCard(state, 'player', pendingSpell.battleId, target);
    if (r.ok) {
      setState(r.state);
      setPendingSpell(null);
    } else {
      flashMsg(r.reason ?? 'Invalid target');
    }
  };

  const cancelPending = () => setPendingSpell(null);

  const onEndTurn = () => {
    if (state.turn !== 'player' || state.outcome !== 'ongoing') return;
    setSelectedAttacker(null);
    setPendingSpell(null);
    showMsg("Vex's turn");
    setState(s => endTurn(s));
  };

  // ============== Game over ==============
  if (state.outcome !== 'ongoing') {
    return <MatchEnd outcome={state.outcome} onExit={onExit} />;
  }

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        width: '100%', height: '100%',
        background: 'radial-gradient(ellipse at 50% 50%, #2a3a5e 0%, #0e1428 70%, #050816 100%)',
        position: 'relative', overflow: 'hidden',
        fontFamily: '"Inter", system-ui, sans-serif',
        color: '#fff',
        userSelect: 'none', touchAction: 'none',
      }}
    >
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.06 }} width="100%" height="100%">
        <defs>
          <pattern id="hex" width="30" height="26" patternUnits="userSpaceOnUse">
            <polygon points="15,1 28,8 28,22 15,29 2,22 2,8" fill="none" stroke="#fff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)" />
      </svg>

      <div style={{ position: 'absolute', top: 16, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 }}>
        <button onClick={() => onExit('quit')} style={iconBtn}>←</button>
        <OpponentPortrait
          hp={state.opponent.hp}
          highlight={pendingSpell ? 'spell' : selectedAttacker ? 'attack' : null}
          onClick={onOppFaceClick}
          damage={damages[FACE_OPP] ?? null}
        />
        <div style={{ width: 32 }} />
      </div>

      {/* Opponent field */}
      <div style={{
        position: 'absolute', top: 90, left: 12, right: 12,
        display: 'flex', justifyContent: 'center', gap: 6,
        minHeight: 98,
      }}>
        {state.opponent.field.map(c => {
          const targetable = isTargetableForSpell(c, pendingSpell, 'opponent');
          const isCombatAttacker = combat?.attackerId === c.battleId && combat.attackerOwner === 'opponent';
          const isCombatDefender = combat?.defenderId === c.battleId && combat.defenderOwner === 'opponent';
          return (
            <BattlefieldCard
              key={c.battleId}
              card={c}
              shaking={isCombatDefender}
              attackable={!!selectedAttacker}
              highlight={pendingSpell && targetable ? 'spell' : (selectedAttacker ? 'attack' : null)}
              lunging={isCombatAttacker ? 'down' : null}
              impact={isCombatDefender}
              damage={damages[c.battleId] ?? null}
              onClick={() => onOppCreatureClick(c)}
              onLongPress={() => setInspect(c)}
            />
          );
        })}
      </div>

      {/* Center divider */}
      <div ref={fieldRef} style={{
        position: 'absolute', top: 200, left: 0, right: 0, height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderTop: drag?.overField ? '2px dashed #f4d04a' : '1px solid rgba(255,255,255,.08)',
        borderBottom: drag?.overField ? '2px dashed #f4d04a' : '1px solid rgba(255,255,255,.08)',
        background: drag?.overField ? 'rgba(244,208,74,.12)' : 'rgba(255,255,255,.02)',
        transition: 'background .15s, border-color .15s',
      }}>
        {drag?.overField ? (
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f4d04a' }}>
            {drag.cardType === 'Creature' ? '↓ Release to summon ↓' : '↓ Release to choose target ↓'}
          </div>
        ) : pendingSpell ? (
          <button onClick={cancelPending} style={{
            background: 'rgba(255,255,255,.1)',
            color: '#fff', border: '1px solid rgba(255,255,255,.2)',
            borderRadius: 24, padding: '6px 18px', fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
          }}>Cancel target</button>
        ) : (
          <button onClick={onEndTurn} disabled={state.turn !== 'player'} style={{
            background: state.turn === 'player' ? 'linear-gradient(180deg, #f4d04a, #c4801a)' : '#3a3a4a',
            color: state.turn === 'player' ? '#3a2a0e' : '#888',
            border: 'none', borderRadius: 24, padding: '8px 22px',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: state.turn === 'player' ? 'pointer' : 'default',
            boxShadow: state.turn === 'player' ? '0 4px 12px rgba(244,208,74,.4)' : 'none',
          }}>End Turn →</button>
        )}
      </div>

      {/* My field */}
      <div style={{
        position: 'absolute', top: 268, left: 12, right: 12,
        display: 'flex', justifyContent: 'center', gap: 6,
        minHeight: 98,
      }}>
        {state.player.field.map(c => {
          const friendlySpell = pendingSpell?.abilityKind === 'spell_buff';
          const isCombatAttacker = combat?.attackerId === c.battleId && combat.attackerOwner === 'player';
          const isCombatDefender = combat?.defenderId === c.battleId && combat.defenderOwner === 'player';
          return (
            <BattlefieldCard
              key={c.battleId}
              card={c}
              shaking={isCombatDefender}
              selected={selectedAttacker === c.battleId}
              attackable={!c.tapped && !c.justPlayed}
              highlight={friendlySpell ? 'spell' : null}
              lunging={isCombatAttacker ? 'up' : null}
              impact={isCombatDefender}
              damage={damages[c.battleId] ?? null}
              onClick={() => {
                if (pendingSpell?.abilityKind === 'spell_buff') {
                  castPendingAt({ kind: 'creature', owner: 'player', battleId: c.battleId });
                } else {
                  onMyCreatureClick(c);
                }
              }}
              onLongPress={() => setInspect(c)}
            />
          );
        })}
      </div>

      {/* Status message */}
      <div style={{ position: 'absolute', top: 380, left: 0, right: 0, textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9ed6f7', opacity: 0.9 }}>
        {msg}
      </div>

      {/* My stats */}
      <div style={{ position: 'absolute', top: 410, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={onMyFaceClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, position: 'relative',
            cursor: pendingSpell ? 'pointer' : 'default',
            padding: 4, borderRadius: 8,
            boxShadow: pendingSpell?.abilityKind === 'spell_heal' ? '0 0 0 2px #9ed6f7' : 'none',
            animation: damages[FACE_PLAYER] ? 'hpFlash 0.5s' : undefined,
          }}>
          <svg width="22" height="22" viewBox="0 0 18 18">
            <path d="M9 16 L2 9 A4 4 0 0 1 9 4 A4 4 0 0 1 16 9 Z" fill="#e85a5a" stroke="#fff" strokeWidth="1.5" />
          </svg>
          <span style={{ fontSize: 26, fontWeight: 700 }}>{state.player.hp}</span>
          {damages[FACE_PLAYER] != null && (
            <div style={{
              position: 'absolute', top: -8, left: '50%',
              fontSize: 22, fontWeight: 900, color: '#ff5a5a',
              textShadow: '0 2px 0 #1a0408',
              animation: 'damagePopup .9s ease-out forwards',
              pointerEvents: 'none',
              fontFamily: '"Fredoka", system-ui',
              whiteSpace: 'nowrap',
            }}>−{damages[FACE_PLAYER]}</div>
          )}
        </div>
        <ManaCrystals mana={state.player.mana} maxMana={state.player.maxMana} />
      </div>

      {/* Hand — non-dragging cards */}
      <div style={{
        position: 'absolute', bottom: 20, left: 0, right: 0, height: 200,
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        pointerEvents: 'none',
      }}>
        {state.player.hand.map((card, i) => {
          const isDragging = drag?.battleId === card.battleId;
          if (isDragging) return null; // rendered separately at fixed position
          const cardCount = state.player.hand.length;
          const offset = (i - (cardCount - 1) / 2);
          const rot = offset * 5;
          const yOff = Math.abs(offset) * 6;
          const xOff = offset * 36;
          const isHovered = hoverIdx === i && !drag;
          const playableNow = card.cost <= state.player.mana && state.turn === 'player';
          return (
            <div
              key={card.battleId}
              onPointerDown={(e) => onCardPointerDown(e, card)}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{
                position: 'absolute', left: '50%', bottom: 0,
                transform: `translateX(calc(-50% + ${xOff}px)) translateY(${isHovered ? -90 : yOff}px) rotate(${isHovered ? 0 : rot}deg) scale(${isHovered ? 1.05 : 0.85})`,
                transformOrigin: 'bottom center',
                transition: 'transform .25s cubic-bezier(.2,.8,.3,1)',
                zIndex: isHovered ? 50 : 10 + i,
                cursor: playableNow ? 'grab' : 'not-allowed',
                opacity: playableNow ? 1 : 0.6,
                filter: playableNow ? 'none' : 'grayscale(0.4)',
                touchAction: 'none',
                pointerEvents: 'auto',
              }}
            >
              <Card card={card} scale={0.85} hovered={isHovered} />
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

function isTargetableForSpell(c: BattleCard, spell: BattleCard | null, owner: 'player' | 'opponent'): boolean {
  if (!spell) return false;
  if (c.abilityKind === 'untargetable' && spell.abilityKind !== 'spell_buff') return false;
  if (spell.abilityKind === 'spell_buff') return owner === 'player';
  if (spell.abilityKind === 'spell_freeze') return owner === 'opponent';
  if (spell.abilityKind === 'spell_damage') return true;
  return false;
}

function OpponentPortrait({ hp, highlight, onClick, damage }: {
  hp: number;
  highlight: 'attack' | 'spell' | null;
  onClick: () => void;
  damage: number | null;
}) {
  const ring = highlight === 'attack' ? '#f4d04a' : highlight === 'spell' ? '#9ed6f7' : null;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, position: 'relative',
      cursor: highlight ? 'pointer' : 'default',
      padding: 4, borderRadius: 30,
      boxShadow: ring ? `0 0 0 2px ${ring}, 0 0 12px ${ring}` : 'none',
      animation: damage ? 'hpFlash 0.5s' : undefined,
      transition: 'box-shadow .15s',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'conic-gradient(from 90deg, #7a4ea8, #c9a8e8, #7a4ea8)',
        padding: 2, position: 'relative',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: 'linear-gradient(160deg, #2a163f, #7a4ea8)',
          display: 'grid', placeItems: 'center',
          fontSize: 20, fontWeight: 700, color: '#fff',
          fontFamily: '"Cinzel", Georgia, serif',
        }}>V</div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7 }}>Vex, Voidcaller</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <svg width="16" height="16" viewBox="0 0 18 18">
            <path d="M9 16 L2 9 A4 4 0 0 1 9 4 A4 4 0 0 1 16 9 Z" fill="#e85a5a" stroke="#fff" strokeWidth="1.5" />
          </svg>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{hp}</span>
        </div>
      </div>
      {damage != null && damage !== 0 && (
        <div style={{
          position: 'absolute', top: -10, left: '50%',
          fontSize: 22, fontWeight: 900, color: '#ff5a5a',
          textShadow: '0 2px 0 #1a0408',
          animation: 'damagePopup .9s ease-out forwards',
          pointerEvents: 'none',
          fontFamily: '"Fredoka", system-ui',
          whiteSpace: 'nowrap',
        }}>−{damage}</div>
      )}
    </div>
  );
}

function ManaCrystals({ mana, maxMana }: { mana: number; maxMana: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {Array.from({ length: maxMana }).map((_, i) => (
        <div key={i} style={{
          width: 14, height: 18,
          clipPath: 'polygon(50% 0, 100% 30%, 80% 100%, 20% 100%, 0 30%)',
          background: i < mana ? 'linear-gradient(180deg, #9ed6f7, #3a8fc4)' : 'rgba(255,255,255,.1)',
          boxShadow: i < mana ? '0 0 6px #3a8fc488' : 'none',
          transition: 'all .2s',
        }} />
      ))}
    </div>
  );
}

function MatchEnd({ outcome, onExit }: { outcome: 'win' | 'loss'; onExit: (o: 'win' | 'loss' | 'quit') => void }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: outcome === 'win'
        ? 'radial-gradient(ellipse at 50% 40%, #f4d04a 0%, #2a1a08 60%, #050816 100%)'
        : 'radial-gradient(ellipse at 50% 40%, #5a1414 0%, #1a0608 60%, #050816 100%)',
      color: '#fff', fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 30, textAlign: 'center',
      animation: 'fadeIn 0.5s',
    }}>
      <div style={{ fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
        {outcome === 'win' ? 'Victory' : 'Defeat'}
      </div>
      <div style={{
        fontSize: 56, fontWeight: 700, fontFamily: '"Cinzel", Georgia, serif',
        background: outcome === 'win'
          ? 'linear-gradient(180deg, #fff8dc, #f4d04a)'
          : 'linear-gradient(180deg, #ffd4d4, #e85a5a)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: 28,
      }}>
        {outcome === 'win' ? 'You won' : 'You lost'}
      </div>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 32, fontStyle: 'italic' }}>
        {outcome === 'win'
          ? '+75 coins earned. Open more packs and grow your collection.'
          : '+20 coins for the attempt. Refine your deck and try again.'}
      </div>
      <button onClick={() => onExit(outcome)} style={{ ...btnPrimary, minWidth: 220 }}>
        Continue
      </button>
    </div>
  );
}
