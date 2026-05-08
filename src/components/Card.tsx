import { ELEMENTS, RARITY_COLOR } from '../data/elements';
import type { CardTemplate, CollectionCard, BattleCard } from '../game/types';
import { ElementGlyph } from './ElementGlyph';
import { PhotoFrame } from './PhotoFrame';

interface Props {
  card: CardTemplate | CollectionCard | BattleCard;
  scale?: number;
  hovered?: boolean;
  /** Override displayed name (e.g. nickname); defaults to card.name */
  displayName?: string;
  /** Override displayed atk/hp for battle */
  displayAtk?: number;
  displayHp?: number;
}

function isCollectionCard(c: CardTemplate | CollectionCard): c is CollectionCard {
  return 'photo' in c;
}

export function Card({ card, scale = 1, hovered = false, displayName, displayAtk, displayHp }: Props) {
  const e = ELEMENTS[card.el];
  const photo = isCollectionCard(card) ? card.photo : null;
  const dormant = !photo;
  const name = displayName ?? (isCollectionCard(card) && card.nickname ? card.nickname : card.name);
  const atk = displayAtk ?? card.atk;
  const hp = displayHp ?? card.hp;

  return (
    <div style={{
      width: 220 * scale, height: 320 * scale,
      borderRadius: 18 * scale,
      background: dormant
        ? `linear-gradient(180deg, ${e.color}aa 0%, ${e.deep}cc 100%)`
        : `linear-gradient(180deg, ${e.color} 0%, ${e.deep} 100%)`,
      padding: 8 * scale,
      boxShadow: hovered
        ? `0 18px 40px rgba(0,0,0,.45), 0 0 0 3px ${e.glow}, inset 0 0 0 2px rgba(255,255,255,.2)`
        : `0 6px 16px rgba(0,0,0,.35), inset 0 0 0 2px rgba(255,255,255,.15)`,
      transform: hovered ? 'translateY(-6px) scale(1.02)' : 'none',
      transition: 'transform .2s, box-shadow .2s',
      fontFamily: '"Fredoka", "Quicksand", system-ui, sans-serif',
      color: '#fff',
      position: 'relative',
      display: 'flex', flexDirection: 'column', gap: 6 * scale,
      filter: dormant ? 'saturate(0.75)' : 'none',
    }}>
      {dormant && (
        <div style={{
          position: 'absolute', top: 14 * scale, right: -22 * scale,
          background: '#0a0612', color: '#f4d04a',
          padding: `${3 * scale}px ${24 * scale}px`,
          fontSize: 9 * scale, fontWeight: 700, letterSpacing: '0.2em',
          transform: 'rotate(35deg)',
          fontFamily: '"Inter", system-ui, sans-serif',
          zIndex: 5,
          boxShadow: '0 2px 6px rgba(0,0,0,.3)',
        }}>DORMANT</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale, padding: `0 ${4 * scale}px` }}>
        <div style={{
          width: 36 * scale, height: 36 * scale, borderRadius: '50%',
          background: '#fef4d8', color: e.deep,
          fontSize: 22 * scale, fontWeight: 800,
          display: 'grid', placeItems: 'center',
          boxShadow: `0 2px 0 ${e.deep}, 0 0 0 3px ${e.deep}`,
          flex: '0 0 auto',
        }}>{card.cost}</div>
        <div style={{
          flex: 1, fontSize: 14 * scale, fontWeight: 700, lineHeight: 1.1,
          textShadow: `0 1px 0 ${e.deep}`,
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{name}</div>
        <ElementGlyph el={card.el} size={20 * scale} />
      </div>

      <div style={{
        flex: 1,
        borderRadius: 12 * scale,
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.25), inset 0 4px 12px rgba(0,0,0,.3)',
        position: 'relative',
      }}>
        <PhotoFrame photo={photo} el={card.el} scale={scale} fallbackSeed={card.id} />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 9 * scale, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
        opacity: 0.85, padding: `0 ${4 * scale}px`,
        fontFamily: '"Inter", system-ui, sans-serif',
      }}>
        <span>{card.type} · {ELEMENTS[card.el].name}</span>
        <span style={{
          width: 8 * scale, height: 8 * scale, borderRadius: '50%',
          background: RARITY_COLOR[card.rarity], boxShadow: `0 0 6px ${RARITY_COLOR[card.rarity]}`,
        }}></span>
      </div>

      <div style={{
        background: 'rgba(255,255,255,.95)',
        color: '#2a1f12',
        borderRadius: 10 * scale,
        padding: `${6 * scale}px ${8 * scale}px`,
        fontSize: 10 * scale, lineHeight: 1.3,
        minHeight: 42 * scale,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,.1)',
        fontFamily: '"Inter", system-ui, sans-serif',
        display: 'flex', flexDirection: 'column',
        gap: 2 * scale,
      }}>
        {card.ability && (
          <div style={{
            fontWeight: 700,
            color: e.deep,
            fontSize: 10 * scale,
            lineHeight: 1.25,
          }}>{card.ability}</div>
        )}
        {card.flavor && (
          <div style={{
            fontStyle: 'italic',
            color: '#7a5a52',
            fontSize: 9 * scale,
            lineHeight: 1.25,
          }}>{card.flavor}</div>
        )}
      </div>

      {card.type === 'Creature' && (
        <>
          <div style={{
            position: 'absolute', bottom: -6 * scale, left: 8 * scale,
            width: 36 * scale, height: 36 * scale, borderRadius: '50%',
            background: '#f4d04a', color: '#5a3a0e',
            display: 'grid', placeItems: 'center',
            fontSize: 20 * scale, fontWeight: 800,
            boxShadow: '0 3px 0 #8a5a14, 0 0 0 3px #8a5a14',
          }}>{atk}</div>
          <div style={{
            position: 'absolute', bottom: -6 * scale, right: 8 * scale,
            width: 36 * scale, height: 36 * scale, borderRadius: '50%',
            background: '#e85a5a', color: '#5a1414',
            display: 'grid', placeItems: 'center',
            fontSize: 20 * scale, fontWeight: 800,
            boxShadow: '0 3px 0 #8a1414, 0 0 0 3px #8a1414',
          }}>{hp}</div>
        </>
      )}
    </div>
  );
}
