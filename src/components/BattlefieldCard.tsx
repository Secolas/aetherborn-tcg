import { useEffect, useRef, useState } from 'react';
import { Snowflake, ShieldHalf, Target, Moon, Swords, Ban, Link2 } from 'lucide-react';
import { TYPE_PALETTE } from '../data/elements';
import { SmartImage } from './SmartImage';
import type { BattleCard } from '../game/types';

interface Props {
  card: BattleCard;
  /** When present, render the stat orbs at these values INSTEAD of
   *  card.currentAtk/currentHp. Lets MatchBoard hold the displayed
   *  stats at OLD values while the level-up reveal is on screen,
   *  then snap to live values when the +1/+1 buff popup fires. The
   *  sequence reads: card shows 1/3 → ability reveal plays → card
   *  snaps to 2/4 with +1/+1 popup. */
  displayStats?: { atk: number; hp: number } | null;
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
  /** When this card belongs to a bond, this prop says whether the partner
   *  is also on the field right now. Drives the persistent corner heart
   *  icon: gold/glowing when active, dim when waiting for the partner. */
  bondState?: 'active' | 'waiting';
  highlight?: 'attack' | 'spell' | null;
  onClick?: () => void;
  onLongPress?: () => void;
}

const LONG_PRESS_MS = 450;

export function BattlefieldCard({
  card, displayStats, selected, attackable, shaking, lunging, damage, impact, dying, dimWhenExhausted,
  buff, trigger, bondState, highlight,
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
  // Ring colors are kept to four well-defined states so the card chrome
  // stays standardised — anything outside these reads as "default":
  //   selected            : yellow (you tapped this creature)
  //   highlight = attack  : red    (current attacker is looking at it)
  //   highlight = spell   : blue   (legal spell target)
  //   intrinsic Taunt     : green  (force-attack-me indicator)
  // Plain attack-ready creatures intentionally have NO ring — the
  // Swords corner badge already signals "this can attack now" without
  // adding a competing yellow outline to every Rush / untapped creature.
  const ringColor = selected ? '#f4d04a'
    : highlight === 'attack' ? '#e85a5a'
    : highlight === 'spell'  ? '#9ed6f7'
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

  // Attack-ready cards used to also run a pulsing yellow glow halo
  // around the whole card. That halo competed visually with the Rush /
  // Bond / Taunt indicators ("why is this card yellow?") so we dropped
  // it — the dedicated Swords corner badge already signals readiness
  // with a single small icon that doesn't tint the whole sprite.
  const isAttackReady = !!attackable && !selected && !highlight && !lunging && !shaking && !card.frozen && !showSummonFx;
  const animation = lunging === 'up' ? 'lungeUp .75s cubic-bezier(.4,.6,.5,1.4)'
    : lunging === 'down' ? 'lungeDown .75s cubic-bezier(.4,.6,.5,1.4)'
    : shaking ? 'shake .4s'
    : showSummonFx ? 'cardSlam .8s cubic-bezier(.3,.7,.4,1.2)'
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

        {/* Cost — top-left orb */}
        <div style={{
          position: 'absolute', top: 4, left: 4,
          minWidth: 16, height: 16, padding: '0 3px', borderRadius: 8,
          background: '#fef4d8', color: tp.deep,
          fontSize: 10, fontWeight: 800,
          display: 'grid', placeItems: 'center',
          boxShadow: '0 1px 0 rgba(0,0,0,.25)',
          zIndex: 2,
        }}>{card.cost}</div>

        {/* Status badges (top-right stack). Every status — Taunt included —
            renders here as a small circular pill. Standardized so the player
            sees a consistent vocabulary: same shape, same size, same place,
            different icon + color. */}
        <div style={{
          position: 'absolute', top: 4, right: 4,
          display: 'flex', flexDirection: 'column', gap: 2,
          zIndex: 2,
        }}>
          {card.frozen && <StatusPill color="#3a8fc4" icon={<Snowflake size={10} fill="#fff" strokeWidth={2.4} />} />}
          {isTaunt && <StatusPill color="#3d8e57" icon={<Target size={10} strokeWidth={2.8} />} />}
          {card.abilityKind === 'untargetable' && !card.frozen && <StatusPill color="#7a4ea8" icon={<ShieldHalf size={10} strokeWidth={2.6} />} />}
          {sleeping && !card.frozen && <StatusPill color="#5a4a2a" icon={<Moon size={10} fill="#fff" strokeWidth={2.4} />} />}
          {card.silenced && <StatusPill color="#7a6e62" icon={<Ban size={10} strokeWidth={2.6} />} />}
        </div>

        {/* Level counter — pinned to a FIXED corner (top-left, under
            the cost circle) so its position never shifts based on
            which other status icons happen to be present. Player can
            always glance at the same spot to read "Math Teacher Lv
            2/3 — one more turn before it caps." Hidden once a
            Graduate creature transforms (abilityKind becomes
            untargetable, level counter no longer relevant). */}
        {(card.abilityKind === 'level_up' || card.abilityKind === 'graduate') && (
          <div style={{
            position: 'absolute', top: 28, left: 4,
            padding: '2px 6px',
            borderRadius: 8,
            background: '#5a5fd9',
            color: '#fff',
            fontSize: 9, fontWeight: 800,
            letterSpacing: '0.04em',
            boxShadow: '0 0 0 1.5px rgba(255,255,255,.35) inset, 0 1px 3px rgba(0,0,0,.5)',
            fontFamily: '"Fredoka", system-ui',
            zIndex: 3,
          }}>
            Lv {card.turnsAlive ?? 0}/3
          </div>
        )}

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
            }}>{displayStats?.atk ?? card.currentAtk}</div>
            <div style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 18, height: 18, borderRadius: '50%',
              background: '#e85a5a', color: '#5a1414',
              fontSize: 11, fontWeight: 800,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 0 0 1.5px #8a1414, 0 1px 3px rgba(0,0,0,.4)',
            }}>{displayStats?.hp ?? card.currentHp}</div>
          </>
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
            animation: 'sliceFlash 0.85s ease-out forwards',
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
          animation: 'impactBurst .8s ease-out forwards',
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
            animation: 'summonDust 1s ease-out forwards',
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
            animation: 'summonHalo .95s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        </>
      )}

      {/* Damage popup. Uses the standardised numeric-popup style — coral
          for damage, green for heals/buffs, dark single-line drop shadow
          to read on any backdrop, no white outline. Same look as the
          face / bond popups elsewhere. */}
      {damage != null && damage !== 0 && (
        <div style={{
          position: 'absolute', top: -6, left: '50%',
          fontSize: 24, fontWeight: 900,
          color: damage > 0 ? '#e85a52' : '#06d6a0',
          textShadow: '0 2px 4px rgba(0,0,0,.55)',
          fontFamily: '"Fredoka", system-ui',
          animation: 'damagePopup 1.6s ease-out forwards',
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
            // Match the damage popup language — single dark drop shadow,
            // no white halo. Same visual as the face / bond popups.
            textShadow: '0 2px 4px rgba(0,0,0,.55)',
            fontFamily: '"Fredoka", system-ui',
            animation: 'damagePopup 1.8s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 50,
            whiteSpace: 'nowrap',
          }}
        >
          +{buff.atk}/+{buff.hp}
        </div>
      )}

      {/* Silence: visually represented by the persistent Ban pill in the
          top-right status stack (see the StatusPill render above). The
          earlier gray-flash overlay + "SILENCED" label felt heavy and
          competed with damage popups; the on-card pill is enough — when
          a creature gets silenced, the Ban icon just appears in its
          corner and stays until the silence wears off. */}

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

      {/* Bond badge — persistent indicator that this card is part of a
          Bond. Anchored just outside the top-left corner so it doesn't
          collide with the cost orb (top-left inside), the status pills
          (top-right inside), or the floating TAUNT / SILENCED / trigger
          labels (top-center). When the partner is also on the field
          (`bondState === 'active'`) the heart is gold and pulses; while
          waiting for the partner it's a dim grey so the player knows the
          card is bond-eligible but the bond hasn't fired yet. */}
      {bondState && (
        <div
          aria-label={bondState === 'active' ? 'Bond active' : 'Bond waiting'}
          style={{
            position: 'absolute',
            top: -7, left: -7,
            width: 18, height: 18, borderRadius: '50%',
            background: bondState === 'active'
              ? 'linear-gradient(180deg, #ffe89a 0%, #f4d04a 100%)'
              : 'rgba(180,170,160,.85)',
            display: 'grid', placeItems: 'center',
            boxShadow: bondState === 'active'
              ? '0 0 0 2px #fff, 0 0 12px rgba(244,208,74,.85), 0 2px 5px rgba(0,0,0,.3)'
              : '0 0 0 1.5px #fff, 0 1.5px 3px rgba(0,0,0,.25)',
            color: bondState === 'active' ? '#a8530a' : '#fff',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          <Link2 size={11} strokeWidth={3} />
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
