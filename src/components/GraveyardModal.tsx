import { useState } from 'react';
import { X } from 'lucide-react';
import { Card } from './Card';
import type { BattleCard } from '../game/types';

interface Props {
  /** Cards in the graveyard, oldest first; we render them newest first. */
  cards: BattleCard[];
  /** Display label for the pile owner ("Your graveyard" / "The Manager's graveyard"). */
  title: string;
  onClose: () => void;
}

/**
 * Scrollable modal listing every card in a graveyard pile. Cards are shown
 * newest-first so the most recently used spell / killed creature is up top —
 * that's almost always the one the player wanted to look up. Tapping a card
 * opens a centered preview at full readable scale so the player can re-read
 * the ability text — graveyard tiles themselves are too small for that.
 */
export function GraveyardModal({ cards, title, onClose }: Props) {
  const reversed = [...cards].reverse();
  const [preview, setPreview] = useState<BattleCard | null>(null);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(8, 4, 12, 0.75)',
        zIndex: 250,
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn .2s',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fef8f0',
          margin: '40px 16px',
          flex: 1,
          borderRadius: 18,
          boxShadow: '0 18px 48px rgba(0,0,0,.4)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(58,46,42,.12)',
        }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a7a6a', fontWeight: 600 }}>
              Graveyard
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#3a2e2a', marginTop: 2 }}>
              {title}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: '#fff',
            border: '1.5px solid rgba(58,46,42,.15)',
            borderRadius: '50%', width: 36, height: 36,
            cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            color: '#3a2e2a',
          }}>
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        {reversed.length === 0 ? (
          <div style={{
            flex: 1, display: 'grid', placeItems: 'center',
            color: '#9a7a6a', fontSize: 14, fontStyle: 'italic',
            padding: 30, textAlign: 'center',
          }}>
            Nothing here yet — spells and killed creatures will land here.
          </div>
        ) : (
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '14px 12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
            gap: 8,
            justifyItems: 'center',
          }}>
            {reversed.map((c) => (
              <button
                key={c.battleId}
                onClick={() => setPreview(c)}
                aria-label={`Preview ${c.nickname || c.name}`}
                style={{
                  background: 'transparent', border: 'none',
                  padding: 0, cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'block',
                }}
              >
                <Card card={c} scale={0.34} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview overlay — centered card at readable scale. Tap anywhere
          (including the dimmed backdrop) to dismiss. We stop propagation
          on the card itself so a tap on the preview doesn't double-fire
          the outer onClose. */}
      {preview && (
        <div
          onClick={(e) => { e.stopPropagation(); setPreview(null); }}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(8, 4, 12, 0.78)',
            zIndex: 260,
            display: 'grid', placeItems: 'center',
            animation: 'fadeIn .15s',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'cardSummon 0.35s cubic-bezier(.2,.8,.3,1)' }}
          >
            <Card card={preview} hovered scale={1.05} />
          </div>
        </div>
      )}
    </div>
  );
}
