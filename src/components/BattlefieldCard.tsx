import { ELEMENTS } from '../data/elements';
import type { BattleCard } from '../game/types';

interface Props {
  card: BattleCard;
  selected?: boolean;
  attackable?: boolean;
  shaking?: boolean;
  highlight?: 'attack' | 'spell' | null;
  onClick?: () => void;
}

export function BattlefieldCard({ card, selected, attackable, shaking, highlight, onClick }: Props) {
  const e = ELEMENTS[card.el];
  const tapped = card.tapped || card.justPlayed;
  const ringColor = selected ? '#f4d04a'
    : highlight === 'attack' ? '#e85a5a'
    : highlight === 'spell'  ? '#9ed6f7'
    : attackable             ? '#f4d04a'
    : null;

  return (
    <div
      onClick={onClick}
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
        animation: shaking ? 'shake .4s' : (card.justPlayed ? 'cardSlam .5s' : 'none'),
        transition: 'opacity .2s, box-shadow .2s',
        flex: '0 0 auto',
        overflow: 'hidden',
      }}
    >
      {/* Cost */}
      <div style={{
        position: 'absolute', top: 4, left: 4,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fef4d8', color: e.deep,
        fontSize: 9, fontWeight: 700,
        display: 'grid', placeItems: 'center',
        zIndex: 2,
      }}>{card.cost}</div>

      {/* Frozen marker */}
      {card.frozen && (
        <div style={{
          position: 'absolute', top: 4, right: 4, fontSize: 12, zIndex: 2,
        }}>❄</div>
      )}

      {/* Taunt marker */}
      {card.abilityKind === 'taunt' && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 12, height: 12, borderRadius: 2,
          background: '#5ea863', boxShadow: '0 0 4px #5ea863',
          zIndex: 2,
        }} title="Taunt" />
      )}

      <div style={{
        position: 'absolute', bottom: 22, left: 0, right: 0,
        textAlign: 'center', fontSize: 8, fontWeight: 700,
        color: '#fff', textShadow: '0 1px 2px #000',
        padding: '0 4px', lineHeight: 1.1,
        zIndex: 2,
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
            zIndex: 2,
          }}>{card.currentAtk}</div>
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 16, height: 16, borderRadius: '50%',
            background: '#e85a5a', color: '#5a1414',
            fontSize: 10, fontWeight: 800,
            display: 'grid', placeItems: 'center',
            boxShadow: '0 0 0 1px #8a1414',
            zIndex: 2,
          }}>{card.currentHp}</div>
        </>
      )}
    </div>
  );
}
