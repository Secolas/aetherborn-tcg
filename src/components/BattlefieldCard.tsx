import { useEffect, useRef, useState } from 'react';
import { Snowflake, ShieldHalf, Target, Moon, Swords, Ban } from 'lucide-react';
import { TYPE_PALETTE } from '../data/elements';
import { SmartImage } from './SmartImage';
import type { BattleCard } from '../game/types';

interface Props {
  card: BattleCard;
  selected?: boolean;
  attackable?: boolean;
  shaking?: boolean;
  /** 'up' for player creatures attacking opponent above; 'down' for opponent attacking player. */
  lunging?: 'up' | 'down' | null;
  /** Show a damage popup over this card. */
  damage?: number | null;
  /** Show a brief impact burst at the center. */
  impact?: boolean;
  /** Card is being destroyed — play the slice + split-apart animation. */
  dying?: boolean;
  /** Dim the card when it's tapped/exhausted. Only meaningful for the
      player's own creatures (so they can see who can still attack);
      opponent creatures stay full opacity since their tapped state isn't
      actionable for the player and was being read as "greyed out / dead". */
  dimWhenExhausted?: boolean;
  /** Buff popup — surfaces "+atk/+hp" in green when a buff spell lands. */
  buff?: { atk: number; hp: number } | null;
  /** Silence trigger timestamp — when present, plays a gray flash + label
      to make the ability strip readable. */
  silencedAt?: number | null;
  /** On-play trigger label (e.g. "DRAW +1", "AOE −2") — pops above the
      creature for ~1.4s the moment it lands so the cause-of-effect is
      visible, not just the effect. */
  trigger?: string | null;
  highlight?: 'attack' | 'spell' | null;
  onClick?: () => void;
  onLongPress?: () => void;
}

const LONG_PRESS_MS = 450;

export function BattlefieldCard({
  card, selected, attackable, shaking, lunging, damage, impact, dying, dimWhenExhausted,
  buff, silencedAt, trigger, highlight,
  onClick, onLongPress,
}: Props) {
  const tp = TYPE_PALETTE.Creature;
  const sleeping = card.justPlayed && card.abilityKind !== 'rush';
  const exhausted = card.tapped && !card.justPlayed;
  const isTaunt = card.abilityKind === 'taunt' && !card.frozen;
  // Track first-mount so the cardSlam keyframe + summon dust fire whenever
  // the BattlefieldCard appears on the field — including for Rush creatures
  // (whose `card.justPlayed` is set false in the engine, since they aren't
  // sleeping). Without this Rush summons landed silently.
  const [justMounted, setJustMounted] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setJustMounted(false), 600);
    return () => clearTimeout(t);
  }, []);
  const showSummonFx = card.justPlayed || justMounted;
  // Taunt creatures get a permanent green ring so they're impossible to miss.
  const ringColor = selected ? '#f4d04a'
    : highlight === 'attack' ? '#e85a5a'
    : highlight === 'spell'  ? '#9ed6f7'
    : attackable             ? '#f4d04a'
    : isTaunt                ? '#5ea863'
    : null;

  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (ev: React.PointerEvent) => {
    longFired.current = false;
    downPos.current = { x: ev.clientX, y: ev.clientY };
    if (onLongPress) {
      pressTimer.current = window.setTimeout(() => {
        longFired.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (ev: React.PointerEvent) => {
    if (!downPos.current || !pressTimer.current) return;
    const dx = ev.clientX - downPos.current.x;
    const dy = ev.clientY - downPos.current.y;
    if (dx * dx + dy * dy > 100) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerUp = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (!longFired.current && onClick) onClick();
  };

  // Player's own creatures that can act this turn (untapped, not sleeping,
  // no spell pending) get a pulsing yellow glow that actively invites a tap.
  // Opponent creatures that are spell/attack targets are excluded — they
  // already have their own red/blue highlight ring.
  const isAttackReady = !!attackable && !selected && !highlight && !lunging && !shaking && !card.frozen && !showSummonFx;
  const animation = lunging === 'up' ? 'lungeUp .75s cubic-bezier(.4,.6,.5,1.4)'
    : lunging === 'down' ? 'lungeDown .75s cubic-bezier(.4,.6,.5,1.4)'
    : shaking ? 'shake .4s'
    : showSummonFx ? 'cardSlam .5s'
    : isAttackReady ? 'attackReadyPulse 1.6s ease-in-out infinite'
    : 'none';

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; } }}
      style={{
        width: 64, height: 88,
        borderRadius: 8,
        background: `linear-gradient(180deg, ${tp.top}, ${tp.deep})`,
        boxShadow: ringColor
          ? `0 0 0 2.5px ${ringColor}, 0 0 14px ${ringColor}88, 0 4px 10px rgba(0,0,0,.25)`
          : `0 4px 10px rgba(0,0,0,.25), inset 0 0 0 1.5px rgba(255,255,255,.2)`,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        // Tapped player creatures fade so you can see at a glance who's
        // already attacked. Opponent creatures stay full opacity — their
        // tapped state isn't actionable for the player and the dim was
        // confusing them with "greyed out / dead" cards.
        opacity: card.frozen ? 0.6 : (exhausted && dimWhenExhausted) ? 0.6 : 1,
        animation,
        transition: 'opacity .2s, box-shadow .2s',
        flex: '0 0 auto',
        overflow: 'visible',
        touchAction: 'manipulation',
      }}
    >
      {/* Inner photo + chrome (clipped) */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit',
        overflow: 'hidden', pointerEvents: 'none',
      }}>
        {card.photo && (
          <SmartImage
            src={card.photo}
            alt={card.name}
            fallbackSeed={card.id}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(180deg, ${tp.top}66 0%, transparent 30%, ${tp.deep}cc 100%)`,
        }} />

        {/* Cost — pushed down when the TAUNT label is showing */}
        <div style={{
          position: 'absolute', top: isTaunt ? 14 : 4, left: 4,
          minWidth: 16, height: 16, padding: '0 3px', borderRadius: 8,
          background: '#fef4d8', color: tp.deep,
          fontSize: 10, fontWeight: 800,
          display: 'grid', placeItems: 'center',
          boxShadow: '0 1px 0 rgba(0,0,0,.25)',
          zIndex: 2,
        }}>{card.cost}</div>

        {/* Status badges (top-right stack) — also pushed down when TAUNT shows */}
        <div style={{
          position: 'absolute', top: isTaunt ? 14 : 4, right: 4,
          display: 'flex', flexDirection: 'column', gap: 2,
          zIndex: 2,
        }}>
          {/* Status pills — frozen, untargetable (spell-immune), sleeping. The
              untargetable pill uses ShieldHalf rather than the lightning bolt
              that previously shipped here; lightning read as "fast / electric"
              instead of "spell-immune". */}
          {card.frozen && <StatusPill color="#3a8fc4" icon={<Snowflake size={10} fill="#fff" strokeWidth={2.4} />} />}
          {card.abilityKind === 'untargetable' && !card.frozen && <StatusPill color="#7a4ea8" icon={<ShieldHalf size={10} strokeWidth={2.6} />} />}
          {sleeping && !card.frozen && <StatusPill color="#5a4a2a" icon={<Moon size={10} fill="#fff" strokeWidth={2.4} />} />}
          {/* Silence indicator — muted-speaker icon stays the entire turn
              the creature's ability is stripped. Visually distinct from
              the snowflake so freeze and silence don't blur together. */}
          {card.silenced && <StatusPill color="#7a6e62" icon={<Ban size={10} strokeWidth={2.6} />} />}
        </div>

        {/* Frozen creatures get a blue ice tint. Tapped/exhausted is handled
            via outer opacity now, not a stacked overlay. */}
        {card.frozen && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(158,214,247,.35) 0%, rgba(58,143,196,.45) 100%)',
            backdropFilter: 'saturate(0.6)',
          }} />
        )}

        <div style={{
          position: 'absolute', bottom: 24, left: 0, right: 0,
          textAlign: 'center', fontSize: 9, fontWeight: 700,
          color: '#fff', textShadow: '0 1px 2px #000',
          padding: '0 4px', lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{card.nickname || card.name}</div>

        {card.type === 'Creature' && (
          <>
            <div style={{
              position: 'absolute', bottom: 2, left: 2,
              width: 18, height: 18, borderRadius: '50%',
              background: '#f4d04a', color: '#5a3a0e',
              fontSize: 11, fontWeight: 800,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 0 0 1.5px #8a5a14, 0 1px 3px rgba(0,0,0,.4)',
            }}>{card.currentAtk}</div>
            <div style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 18, height: 18, borderRadius: '50%',
              background: '#e85a5a', color: '#5a1414',
              fontSize: 11, fontWeight: 800,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 0 0 1.5px #8a1414, 0 1px 3px rgba(0,0,0,.4)',
            }}>{card.currentHp}</div>
          </>
        )}

        {/* TAUNT label across the top — impossible to miss */}
        {isTaunt && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            background: 'linear-gradient(180deg, #5ea863, #3d8e57)',
            color: '#fff',
            fontSize: 7.5, fontWeight: 800,
            letterSpacing: '0.18em',
            textAlign: 'center',
            padding: '1.5px 4px',
            textTransform: 'uppercase',
            textShadow: '0 1px 1px rgba(0,0,0,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,.25)',
          }}>
            <Target size={9} strokeWidth={2.6} /> Taunt
          </div>
        )}
      </div>

      {/* Death — red tint + bright diagonal slash. Plays before the card is
          removed from state, so the kill is visually obvious. */}
      {dying && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255, 60, 60, 0.55)',
            borderRadius: 'inherit',
            zIndex: 25,
            pointerEvents: 'none',
            animation: 'fadeIn 0.2s',
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 90, height: 5,
            background: 'linear-gradient(90deg, transparent 0%, #fff 25%, #fffbd0 50%, #fff 75%, transparent 100%)',
            boxShadow: '0 0 8px #fff, 0 0 16px #f4d04a',
            animation: 'sliceFlash 0.55s ease-out forwards',
            zIndex: 45,
            pointerEvents: 'none',
          }} />
        </>
      )}

      {/* Impact burst */}
      {impact && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 60, height: 60, borderRadius: '50%',
          background: 'radial-gradient(circle, #f4d04a 0%, transparent 70%)',
          animation: 'impactBurst .5s ease-out forwards',
          pointerEvents: 'none',
          zIndex: 40,
        }} />
      )}

      {/* Summon dust — one-shot ring of light under the card the moment it
          lands on the field. Plays while the card is in its `justPlayed`
          window (cardSlam handles the card itself; this sells the impact
          on the slot beneath). */}
      {/* Attack-ready badge — small Swords icon floating off the top-left
          corner of any of your own creatures that can attack this turn. The
          pulse around the card already conveys "tappable", but the icon
          tells you what tapping it will *do*. */}
      {isAttackReady && (
        <div style={{
          position: 'absolute', top: -8, left: -8,
          width: 22, height: 22, borderRadius: '50%',
          background: 'linear-gradient(160deg, #ffe89a, #f4d04a)',
          color: '#5a3a0e',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,.35), 0 0 12px rgba(244,208,74,.7)',
          zIndex: 12,
          pointerEvents: 'none',
        }}>
          <Swords size={11} strokeWidth={2.6} />
        </div>
      )}

      {showSummonFx && (
        <>
          {/* Dust ring under the card — settling on the field */}
          <div style={{
            position: 'absolute', bottom: -6, left: '50%',
            width: 110, height: 22, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(244,208,74,.65), rgba(255,158,90,.3) 50%, transparent 80%)',
            filter: 'blur(2px)',
            animation: 'summonDust .7s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 1,
          }} />
          {/* Bright halo ring centered on the slot — fires for every creature
              summon (drag, tap-Summon, AI play, Rush or not) so the "card
              landed on the field" beat is identical regardless of path. */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 80, height: 80, borderRadius: '50%',
            border: '3px solid #ffd166',
            boxShadow: '0 0 18px rgba(255,209,102,.85), inset 0 0 12px rgba(255,209,102,.6)',
            animation: 'summonHalo .65s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        </>
      )}

      {/* Damage popup */}
      {damage != null && damage !== 0 && (
        <div style={{
          position: 'absolute', top: -6, left: '50%',
          fontSize: 24, fontWeight: 900,
          color: damage > 0 ? '#ff5a5a' : '#5ea863',
          textShadow: '0 2px 0 #1a0408, 0 0 8px rgba(0,0,0,.6)',
          fontFamily: '"Fredoka", system-ui',
          animation: 'damagePopup .9s ease-out forwards',
          pointerEvents: 'none',
          zIndex: 50,
          whiteSpace: 'nowrap',
        }}>
          {damage > 0 ? `−${damage}` : `+${-damage}`}
        </div>
      )}

      {/* Buff popup — fires when spell_buff resolves on this creature so the
          stat change is something you SEE instead of just notice in the orbs. */}
      {buff && (buff.atk > 0 || buff.hp > 0) && (
        <div
          key={`buff-${card.battleId}-${buff.atk}-${buff.hp}`}
          style={{
            position: 'absolute', top: -6, left: '50%',
            fontSize: 18, fontWeight: 900,
            color: '#06d6a0',
            textShadow: '0 2px 0 #0a4030, 0 0 10px rgba(6,214,160,.5)',
            fontFamily: '"Fredoka", system-ui',
            animation: 'damagePopup 1.1s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 50,
            whiteSpace: 'nowrap',
          }}
        >
          +{buff.atk}/+{buff.hp}
        </div>
      )}

      {/* Silence flash — gray-flash overlay + "SILENCED" label fired when
          the creature's ability is stripped, so the loss-of-power isn't
          something you only notice retroactively. */}
      {silencedAt != null && (
        <>
          <div
            key={`silence-fx-${silencedAt}`}
            style={{
              position: 'absolute', inset: 0, borderRadius: 'inherit',
              background: 'rgba(120,110,98,.55)',
              animation: 'spellTargetBurst .9s ease-out forwards',
              pointerEvents: 'none',
              zIndex: 30,
            }}
          />
          <div
            key={`silence-text-${silencedAt}`}
            style={{
              position: 'absolute', top: -10, left: '50%',
              fontSize: 11, fontWeight: 900, letterSpacing: '0.2em',
              color: '#fff',
              textShadow: '0 2px 0 #3a2e2a, 0 0 8px rgba(0,0,0,.7)',
              fontFamily: '"Fredoka", system-ui',
              animation: 'damagePopup 1s ease-out forwards',
              pointerEvents: 'none',
              zIndex: 51,
              whiteSpace: 'nowrap',
            }}
          >
            SILENCED
          </div>
        </>
      )}

      {/* On-play trigger banner — yellow chip pops above the creature so
          the cause of "where did this card / damage come from" is obvious
          (e.g. summoning Tio shows DRAW +1 over Tio itself, not just an
          unexplained card flying into the hand). */}
      {trigger && (
        <div
          key={`trigger-${card.battleId}-${trigger}`}
          style={{
            position: 'absolute', top: -22, left: '50%',
            background: 'linear-gradient(180deg, #ffe89a, #f4d04a)',
            color: '#3a2406',
            padding: '3px 8px', borderRadius: 8,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            boxShadow: '0 0 0 2px rgba(255,255,255,.85), 0 0 12px rgba(244,208,74,.7), 0 3px 6px rgba(0,0,0,.3)',
            fontFamily: '"Fredoka", system-ui',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 60,
            animation: 'damagePopup 1.3s ease-out forwards',
          }}
        >
          {trigger}
        </div>
      )}
    </div>
  );
}

function StatusPill({ color, icon }: { color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: '50%',
      background: color,
      boxShadow: `0 0 0 1.5px #fff, 0 1px 2px rgba(0,0,0,.4)`,
      display: 'grid', placeItems: 'center',
      color: '#fff',
    }}>
      {icon}
    </div>
  );
}
