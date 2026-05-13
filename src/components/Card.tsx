import { Sparkles } from 'lucide-react';
import { ELEMENTS, RARITY_COLOR, TYPE_PALETTE } from '../data/elements';
import type { CardTemplate, CollectionCard, BattleCard } from '../game/types';
import { ElementGlyph } from './ElementGlyph';
import { PhotoFrame } from './PhotoFrame';
import { getFrame } from '../data/frames';
import { useCosmetics } from '../state/cosmeticsContext';

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
  /** When false, skip player-only cosmetics (frame) so the card renders
   *  in its baseline visual. Defaults to true — most callsites are
   *  rendering the player's own cards (Collection, DeckBuilder, packs,
   *  hand, previews of player plays). MatchBoard sets this to false on
   *  opponent reveals and the inspect modal for opponent cards so the
   *  player's equipped frame doesn't "skin" the boss's cards. */
  owned?: boolean;
}

function isCollectionCard(c: CardTemplate | CollectionCard): c is CollectionCard {
  return 'photo' in c;
}

export function Card({ card, scale = 1, hovered = false, displayName, displayAtk, displayHp, unaffordable = false, owned = true }: Props) {
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

  // Equipped frame cosmetic (read from app-wide context). Only applied
  // when this card is the player's own — opponent renders pass owned=
  // false so the boss's cards stay in their baseline chrome. Classic
  // returns an empty outer/inner so the default styling shows through.
  const cosm = useCosmetics();
  const frame = owned ? getFrame(cosm.frame) : getFrame('classic');
  const frameOuterShadow = frame.outer?.boxShadow as string | undefined;
  const frameInnerShadow = frame.inner?.boxShadow as string | undefined;
  // Hovered cards still get the warm yellow ring (selection affordance);
  // when a frame is equipped we add the frame's outer glow as an extra
  // layer on top of that. Otherwise the base shadows below take over.
  const baseShadow = hovered
    ? '0 18px 40px rgba(0,0,0,.45), 0 0 0 3px #f4d04a, inset 0 0 0 2px rgba(255,255,255,.2)'
    : '0 6px 16px rgba(0,0,0,.35), inset 0 0 0 2px rgba(255,255,255,.15)';
  const composedShadow = frameOuterShadow
    ? `${frameOuterShadow}, ${baseShadow}`
    : baseShadow;

  return (
    <div style={{
      width: 220 * scale, height: 320 * scale,
      borderRadius: 18 * scale,
      background: cardBg,
      padding: 8 * scale,
      boxShadow: composedShadow,
      transform: hovered ? 'translateY(-6px) scale(1.02)' : 'none',
      transition: 'transform .2s, box-shadow .2s',
      fontFamily: '"Fredoka", "Quicksand", system-ui, sans-serif',
      color: '#fff',
      position: 'relative',
      display: 'flex', flexDirection: 'column', gap: 6 * scale,
      filter: dormant ? 'saturate(0.75)' : 'none',
    }}>
      {frameInnerShadow && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            borderRadius: 'inherit',
            boxShadow: frameInnerShadow,
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />
      )}
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
        <PhotoFrame
          photo={photo}
          el={card.el}
          scale={scale}
          fallbackSeed={card.id}
          filterId={isCollectionCard(card) ? card.filterId : undefined}
        />
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
        {/* Rarity chip — small text label. Replaces the previous 8px colored
            dot that was easy to miss / misread. The background still uses the
            rarity color so a quick glance reads even before the text. */}
        <span style={{
          background: RARITY_COLOR[card.rarity],
          color: card.rarity === 'common' ? '#2a1f12' : '#fff',
          padding: `${1.5 * scale}px ${5 * scale}px`,
          borderRadius: 4 * scale,
          fontSize: 7.5 * scale, fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          boxShadow: `0 0 4px ${RARITY_COLOR[card.rarity]}88`,
          lineHeight: 1.2,
        }}>{card.rarity}</span>
      </div>

      <div style={{
        background: 'rgba(255,255,255,.96)',
        color: '#2a1f12',
        borderRadius: 10 * scale,
        padding: `${7 * scale}px ${9 * scale}px`,
        fontSize: 10 * scale, lineHeight: 1.3,
        minHeight: 44 * scale,
        // Bottom margin keeps the panel above the protruding ATK/HP orbs so
        // text never sits underneath them.
        marginBottom: 22 * scale,
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

