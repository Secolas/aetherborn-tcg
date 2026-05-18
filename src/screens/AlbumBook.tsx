import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ELEMENTS } from '../data/elements';
import type { CollectionCard, ElementId } from '../game/types';

interface Props {
  cards: CollectionCard[];
  onTap: (card: CollectionCard) => void;
}

const CARDS_PER_PAGE = 4;

/**
 * Photo-album book view for the Life Album.
 *
 * Cards are paginated into spreads of 4 (a 2×2 grid per page). The
 * player taps the right or left edge of the page — or the chevron
 * buttons — to flip forward or backward.
 *
 * The flip animation is pure CSS 3D: the page is rotated 180° around
 * the gutter on the Y axis, with the back face hidden via
 * `backface-visibility`. While the page is mid-flip the next/previous
 * page is already laid down underneath, so when the rotation finishes
 * the new page is in place with no jump.
 *
 * Tapping a card opens the same inspect lightbox the grid views use.
 */
export function AlbumBook({ cards, onTap }: Props) {
  const pageCount = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
  const [page, setPage] = useState(0);
  /** Direction of the in-flight flip: 'next' rotates leaving page to the
   *  left, 'prev' to the right. null when no flip is happening. */
  const [flipping, setFlipping] = useState<null | 'next' | 'prev'>(null);

  const goNext = () => {
    if (flipping || page >= pageCount - 1) return;
    setFlipping('next');
    setTimeout(() => {
      setPage(p => p + 1);
      setFlipping(null);
    }, 600);
  };
  const goPrev = () => {
    if (flipping || page <= 0) return;
    setFlipping('prev');
    setTimeout(() => {
      setPage(p => p - 1);
      setFlipping(null);
    }, 600);
  };

  const currentCards = cards.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);
  const nextCards = cards.slice((page + 1) * CARDS_PER_PAGE, (page + 2) * CARDS_PER_PAGE);
  const prevCards = cards.slice(Math.max(0, (page - 1) * CARDS_PER_PAGE), page * CARDS_PER_PAGE);

  return (
    <div style={wrap}>
      <style>{`
        @keyframes book-flip-next {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(-180deg); }
        }
        @keyframes book-flip-prev {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(180deg); }
        }
        .book-stage { perspective: 1800px; }
        .book-page {
          transform-origin: left center;
          transform-style: preserve-3d;
        }
        .book-page.flipping-next {
          animation: book-flip-next 600ms cubic-bezier(.55,.08,.45,.95) forwards;
        }
        .book-page.flipping-prev {
          animation: book-flip-prev 600ms cubic-bezier(.55,.08,.45,.95) forwards;
        }
        .book-face {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .book-face-back {
          transform: rotateY(180deg);
        }
        .book-edge-tap {
          position: absolute; top: 0; bottom: 0; width: 22%;
          cursor: pointer;
          z-index: 5;
          background: transparent;
          border: none;
          -webkit-tap-highlight-color: transparent;
        }
        .book-edge-tap:disabled { cursor: default; }
        .book-shadow-fade { transition: opacity 600ms; }
      `}</style>

      <div className="book-stage" style={stage}>
        {/* Page underneath: when flipping next, this is the upcoming page.
            When flipping prev, this is the page we're returning to.
            Always rendered so the flip reveals it during rotation. */}
        <div style={{ ...page3d, zIndex: 1 }}>
          <PageContent
            cards={flipping === 'next' ? nextCards : flipping === 'prev' ? prevCards : currentCards}
            pageNumber={flipping === 'next' ? page + 2 : flipping === 'prev' ? page : page + 1}
            totalPages={pageCount}
            onTap={onTap}
          />
        </div>

        {/* Top page — the one that animates. Front face = current page;
            back face = whatever will be on top after the flip. */}
        {flipping && (
          <div
            className={`book-page ${flipping === 'next' ? 'flipping-next' : 'flipping-prev'}`}
            style={{ ...page3d, zIndex: 2 }}
          >
            <div className="book-face" style={faceAbs}>
              <PageContent
                cards={flipping === 'next' ? currentCards : prevCards}
                pageNumber={flipping === 'next' ? page + 1 : page}
                totalPages={pageCount}
                onTap={() => {}}
                muted
              />
            </div>
            <div className="book-face book-face-back" style={faceAbs}>
              <PageContent
                cards={flipping === 'next' ? nextCards : currentCards}
                pageNumber={flipping === 'next' ? page + 2 : page + 1}
                totalPages={pageCount}
                onTap={() => {}}
                muted
              />
            </div>
          </div>
        )}

        {/* Static current page when nothing is flipping. */}
        {!flipping && (
          <div style={{ ...page3d, zIndex: 2 }}>
            <PageContent
              cards={currentCards}
              pageNumber={page + 1}
              totalPages={pageCount}
              onTap={onTap}
            />
          </div>
        )}

        {/* Edge tap zones — only active when no flip is in flight. */}
        <button
          className="book-edge-tap"
          style={{ left: 0 }}
          onClick={goPrev}
          disabled={!!flipping || page <= 0}
          aria-label="Previous page"
        />
        <button
          className="book-edge-tap"
          style={{ right: 0 }}
          onClick={goNext}
          disabled={!!flipping || page >= pageCount - 1}
          aria-label="Next page"
        />
      </div>

      {/* Bottom controls — chevrons and page count. */}
      <div style={controls}>
        <button
          onClick={goPrev}
          disabled={!!flipping || page <= 0}
          style={chevronBtn(!!flipping || page <= 0)}
          aria-label="Previous"
        >
          <ChevronLeft size={20} />
        </button>
        <div style={pageLabel}>
          Page {page + 1} of {pageCount}
        </div>
        <button
          onClick={goNext}
          disabled={!!flipping || page >= pageCount - 1}
          style={chevronBtn(!!flipping || page >= pageCount - 1)}
          aria-label="Next"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

/** A single 2×2 page of cards. The `muted` flag dims the page slightly
 *  while it's mid-flip so the in-motion animation reads as a paper
 *  surface rather than an interactive layer. */
function PageContent({
  cards, pageNumber, totalPages, onTap, muted,
}: {
  cards: CollectionCard[];
  pageNumber: number;
  totalPages: number;
  onTap: (card: CollectionCard) => void;
  muted?: boolean;
}) {
  return (
    <div style={{
      ...pageInner,
      filter: muted ? 'brightness(0.92)' : 'none',
    }}>
      <div style={pageGrid}>
        {cards.map(c => (
          <CardTile key={c.uid} card={c} onTap={onTap} />
        ))}
        {/* Empty slots so the 2×2 layout stays stable even on partial pages */}
        {Array.from({ length: Math.max(0, 4 - cards.length) }).map((_, i) => (
          <div key={`empty-${i}`} style={emptySlot} />
        ))}
      </div>
      <div style={pageFooter}>
        <span style={{ opacity: 0.55, fontSize: 10, letterSpacing: 1.5 }}>
          {pageNumber} / {totalPages}
        </span>
      </div>
    </div>
  );
}

function CardTile({ card, onTap }: { card: CollectionCard; onTap: (c: CollectionCard) => void }) {
  const e = ELEMENTS[card.el as ElementId];
  return (
    <button
      onClick={() => onTap(card)}
      style={{
        position: 'relative',
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 4,
      }}
    >
      <div style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fef8ec',
        boxShadow: `0 2px 6px rgba(0,0,0,0.18), 0 0 0 2px #fff, 0 0 0 3px ${e?.color ?? '#999'}55`,
      }}>
        {card.photo && (
          <img
            src={card.photo}
            alt={card.name}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              display: 'block', pointerEvents: 'none',
            }}
          />
        )}
        <div style={{
          position: 'absolute', top: 4, left: 4,
          background: `${e?.deep ?? '#333'}cc`,
          color: '#fff',
          fontSize: 8, fontWeight: 700,
          letterSpacing: 0.5, textTransform: 'uppercase',
          padding: '1px 5px', borderRadius: 4,
        }}>
          {e?.name ?? card.el}
        </div>
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600,
        color: '#3a2e2a',
        textAlign: 'center',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        padding: '0 2px',
      }}>
        {card.name}
      </div>
    </button>
  );
}

const wrap: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '4px 8px 0',
  overflow: 'hidden',
};

const stage: React.CSSProperties = {
  position: 'relative',
  width: 'min(420px, 100%)',
  aspectRatio: '3 / 4',
  margin: '4px auto',
};

const page3d: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 14,
};

const faceAbs: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 14,
  overflow: 'hidden',
};

const pageInner: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: `
    repeating-linear-gradient(180deg, #fff8e8 0, #fff8e8 1px, #fef0d8 2px, #fef0d8 3px),
    linear-gradient(135deg, #fff6e0 0%, #fde9c8 100%)
  `,
  backgroundBlendMode: 'multiply',
  borderRadius: 14,
  boxShadow: '0 14px 30px rgba(0,0,0,0.18), inset 4px 0 8px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(255,255,255,0.5)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
};

const pageGrid: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gridTemplateRows: '1fr 1fr',
  gap: 12,
};

const emptySlot: React.CSSProperties = {
  borderRadius: 8,
  border: '1.5px dashed rgba(122, 86, 50, 0.18)',
  background: 'rgba(255, 248, 232, 0.4)',
};

const pageFooter: React.CSSProperties = {
  marginTop: 6,
  display: 'flex', justifyContent: 'center',
  color: '#7a5632',
};

const controls: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
  padding: '8px 16px 14px',
};

function chevronBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 38, height: 38,
    borderRadius: 999,
    background: disabled ? 'rgba(122,86,50,0.12)' : '#fff',
    color: '#7a5632',
    border: '1px solid rgba(122,86,50,0.25)',
    display: 'grid', placeItems: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    boxShadow: disabled ? 'none' : '0 2px 6px rgba(0,0,0,0.12)',
  };
}

const pageLabel: React.CSSProperties = {
  fontSize: 12, letterSpacing: 1, color: '#7a5632', fontWeight: 600,
  minWidth: 96, textAlign: 'center',
};
