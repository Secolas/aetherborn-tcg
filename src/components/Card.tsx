import { Sparkles } from 'lucide-react';
import { ELEMENTS, RARITY_COLOR, TYPE_PALETTE } from '../data/elements';
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
  /** Highlight the cost as unaffordable (red) instead of cream. */
  unaffordable?: boolean;
}

function isCollectionCard(c: CardTemplate | CollectionCard): c is CollectionCard {
  return 'photo' in c;
}

export function Card({ card, scale = 1, hovered = false, displayName, displayAtk, displayHp, unaffordable = false }: Props) {
  const photo = isCollectionCard(card) ? card.photo : null;
  const dormant = !photo;
  const isSpell = card.type === 'Spell';
  const name = displayName ?? (isCollectionCard(card) && card.nickname ? card.nickname : card.name);
  const atk = displayAtk ?? card.atk;
  const hp = displayHp ?? card.hp;

  // Card chrome is colored by TYPE only — every creature is green, every
  // spell is violet, regardless of theme. Theme is signaled by the element
  // glyph and the chip text.
  const tp = TYPE_PALETTE[isSpell ? 'Spell' : 'Creature'];
  const cardBg = dormant
    ? `linear-gradient(180deg, ${tp.top}aa 0%, ${tp.deep}cc 100%)`
    : `linear-gradient(180deg, ${tp.top} 0%, ${tp.deep} 100%)`;

  return (
    <div style={{
      width: 220 * scale, height: 320 * scale,
      borderRadius: 18 * scale,
      background: cardBg,
      padding: 8 * scale,
      boxShadow: hovered
        ? `0 18px 40px rgba(0,0,0,.45), 0 0 0 3px #f4d04a, inset 0 0 0 2px rgba(255,255,255,.2)`
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale, padding: `0 ${4 * scale}px` }}>
        <CostBadge cost={card.cost} ringColor={tp.deep} unaffordable={unaffordable} scale={scale} />
        <div style={{
          flex: 1, fontSize: 14 * scale, fontWeight: 700, lineHeight: 1.1,
          textShadow: `0 1px 0 ${tp.deep}`,
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{name}</div>
        <ElementGlyph el={card.el} size={22 * scale} />
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
        gap: 4 * scale, padding: `0 ${4 * scale}px`,
        fontFamily: '"Inter", system-ui, sans-serif',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4 * scale,
          background: isSpell ? '#7a4ea8' : '#3d8e57',
          color: '#fff',
          padding: `${2 * scale}px ${7 * scale}px`,
          borderRadius: 7 * scale,
          fontSize: 9 * scale, fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          boxShadow: '0 1px 2px rgba(0,0,0,.25)',
        }}>
          {isSpell && <Sparkles size={9 * scale} strokeWidth={2.6} />}
          <span>{card.type}</span>
          <span style={{ opacity: 0.6 }}>·</span>
          <span style={{ opacity: 0.95 }}>{ELEMENTS[card.el].name}</span>
        </div>
        <span style={{
          width: 8 * scale, height: 8 * scale, borderRadius: '50%',
          background: RARITY_COLOR[card.rarity], boxShadow: `0 0 6px ${RARITY_COLOR[card.rarity]}`,
        }}></span>
      </div>

      <div style={{
        background: 'rgba(255,255,255,.96)',
        color: '#2a1f12',
        borderRadius: 10 * scale,
        padding: `${7 * scale}px ${9 * scale}px`,
        fontSize: 10 * scale, lineHeight: 1.3,
        minHeight: 44 * scale,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,.1)',
        fontFamily: '"Inter", system-ui, sans-serif',
        display: 'flex', flexDirection: 'column',
        gap: 3 * scale,
      }}>
        {card.ability && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 * scale, flexWrap: 'wrap' }}>
            <span style={{
              background: tp.deep, color: '#fff',
              fontSize: 7.5 * scale, fontWeight: 700, letterSpacing: '0.1em',
              padding: `${1.5 * scale}px ${5 * scale}px`,
              borderRadius: 4 * scale,
              textTransform: 'uppercase',
              flex: '0 0 auto',
              lineHeight: 1.4,
              marginTop: 1 * scale,
            }}>Ability</span>
            <span style={{
              fontWeight: 700,
              color: tp.deep,
              fontSize: 10 * scale,
              lineHeight: 1.25,
              flex: 1,
            }}>{card.ability}</span>
          </div>
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
          <StatOrb value={atk} bg="#ffcb47" border="#8a5a14" textColor="#5a3a0e" position="left" scale={scale} />
          <StatOrb value={hp} bg="#ef5a5a" border="#8a1414" textColor="#5a1414" position="right" scale={scale} />
        </>
      )}
    </div>
  );
}

function CostBadge({ cost, ringColor, unaffordable, scale }: {
  cost: number; ringColor: string; unaffordable: boolean; scale: number;
}) {
  const ring = unaffordable ? '#c8362e' : ringColor;
  return (
    <div style={{
      width: 34 * scale, height: 34 * scale, borderRadius: '50%',
      background: unaffordable ? '#ee5a52' : '#fff5dc',
      color: unaffordable ? '#fff' : ringColor,
      fontSize: 18 * scale, fontWeight: 800,
      display: 'grid', placeItems: 'center',
      boxShadow: `0 0 0 ${2.5 * scale}px ${ring}, 0 ${3 * scale}px ${4 * scale}px rgba(0,0,0,.25)`,
      flex: '0 0 auto',
      letterSpacing: '-0.02em',
      fontFamily: '"Fredoka", system-ui',
      lineHeight: 1,
    }}>{cost}</div>
  );
}

function StatOrb({ value, bg, border, textColor, position, scale }: {
  value: number; bg: string; border: string; textColor: string;
  position: 'left' | 'right'; scale: number;
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: -6 * scale,
      [position]: 8 * scale,
      width: 36 * scale, height: 36 * scale, borderRadius: '50%',
      background: bg,
      color: textColor,
      display: 'grid', placeItems: 'center',
      fontSize: 19 * scale, fontWeight: 800,
      boxShadow: `0 0 0 ${2.5 * scale}px ${border}, 0 ${3 * scale}px ${5 * scale}px rgba(0,0,0,.4)`,
      fontFamily: '"Fredoka", system-ui',
      lineHeight: 1,
    }}>{value}</div>
  );
}

