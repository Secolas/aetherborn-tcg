import { useRef } from 'react';
import { ELEMENTS } from '../data/elements';
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
  highlight?: 'attack' | 'spell' | null;
  onClick?: () => void;
  onLongPress?: () => void;
}

const LONG_PRESS_MS = 450;

export function BattlefieldCard({
  card, selected, attackable, shaking, lunging, damage, impact, highlight,
  onClick, onLongPress,
}: Props) {
  const e = ELEMENTS[card.el];
  const tapped = card.tapped || card.justPlayed;
  const ringColor = selected ? '#f4d04a'
    : highlight === 'attack' ? '#e85a5a'
    : highlight === 'spell'  ? '#9ed6f7'
    : attackable             ? '#f4d04a'
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
    // Cancel long-press if finger moves significantly
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

  // Combine animations: lunge + shake (lunge wins; shake during defender)
  const animation = lunging === 'up' ? 'lungeUp .55s cubic-bezier(.4,.6,.5,1.4)'
    : lunging === 'down' ? 'lungeDown .55s cubic-bezier(.4,.6,.5,1.4)'
    : shaking ? 'shake .4s'
    : (card.justPlayed ? 'cardSlam .5s' : 'none');

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; } }}
      style={{
        width: 64, height: 88,
        borderRadius: 8,
        background: card.photo
          ? `linear-gradient(180deg, ${e.color}88, ${e.deep}cc), url(${card.photo}) center/cover`
          : `linear-gradient(180deg, ${e.color}, ${e.deep})`,
        backgroundBlendMode: card.photo ? 'multiply' : 'normal',
        boxShadow: ringColor
          ? `0 0 0 2px ${ringColor}, 0 0 12px ${ringColor}`
          : `0 4px 8px rgba(0,0,0,.4), inset 0 0 0 1.5px rgba(255,255,255,.2)`,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        opacity: tapped ? 0.55 : 1,
        animation,
        transition: 'opacity .2s, box-shadow .2s',
        flex: '0 0 auto',
        overflow: 'visible', // allow damage popup to escape
        touchAction: 'manipulation',
      }}
    >
      {/* The actual card "background" needs overflow:hidden so the photo doesn't bleed,
          but the damage popup needs to escape — solved by an inner clipped layer. */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit',
        overflow: 'hidden', pointerEvents: 'none',
      }}>
        {/* Cost */}
        <div style={{
          position: 'absolute', top: 4, left: 4,
          width: 14, height: 14, borderRadius: '50%',
          background: '#fef4d8', color: e.deep,
          fontSize: 9, fontWeight: 700,
          display: 'grid', placeItems: 'center',
        }}>{card.cost}</div>

        {card.frozen && (
          <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 12 }}>❄</div>
        )}

        {card.abilityKind === 'taunt' && !card.frozen && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            width: 12, height: 12, borderRadius: 2,
            background: '#5ea863', boxShadow: '0 0 4px #5ea863',
          }} title="Taunt" />
        )}

        <div style={{
          position: 'absolute', bottom: 22, left: 0, right: 0,
          textAlign: 'center', fontSize: 8, fontWeight: 700,
          color: '#fff', textShadow: '0 1px 2px #000',
          padding: '0 4px', lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{card.nickname || card.name}</div>

        {card.type === 'Creature' && (
          <>
            <div style={{
              position: 'absolute', bottom: 2, left: 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#f4d04a', color: '#5a3a0e',
              fontSize: 10, fontWeight: 800,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 0 0 1px #8a5a14',
            }}>{card.currentAtk}</div>
            <div style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#e85a5a', color: '#5a1414',
              fontSize: 10, fontWeight: 800,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 0 0 1px #8a1414',
            }}>{card.currentHp}</div>
          </>
        )}
      </div>

      {/* Impact burst — escapes the clipped layer */}
      {impact && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 50, height: 50, borderRadius: '50%',
          background: 'radial-gradient(circle, #f4d04a 0%, transparent 70%)',
          animation: 'impactBurst .5s ease-out forwards',
          pointerEvents: 'none',
          zIndex: 40,
        }} />
      )}

      {/* Damage popup — escapes the clipped layer */}
      {damage != null && damage !== 0 && (
        <div style={{
          position: 'absolute', top: -6, left: '50%',
          fontSize: 22, fontWeight: 900,
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
    </div>
  );
}
