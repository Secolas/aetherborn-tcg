import { useState } from 'react';
import { ArrowLeft, Camera, Sparkles, LayoutGrid, Rows3, Link2, Lock, BookHeart, X } from 'lucide-react';
import { ELEMENTS } from '../data/elements';
import { BONDS, type BondDef } from '../data/bonds';
import { TEMPLATES } from '../data/templates';
import { iconBtn, PALETTE } from '../components/styles';
import type { CollectionCard, ElementId } from '../game/types';

interface Props {
  collection: CollectionCard[];
  /** Bond ids the player has triggered at least once. Drives lock/unlock
   *  state on the Bonds tab — until you've actually had both cards on the
   *  field together, the bond shows as a locked silhouette with hint text. */
  discoveredBonds: string[];
  onBack: () => void;
}

type Tab = 'cards' | 'bonds';

/**
 * "Life Album" — every card you've summoned with a photo, displayed like
 * a scrapbook of your own life. Now also includes a Bonds tab showing the
 * curated card-pair synergies and which ones the player has discovered
 * through play.
 */
export function Album({ collection, discoveredBonds, onBack }: Props) {
  const summoned = collection.filter(c => c.photo);
  const [inspect, setInspect] = useState<CollectionCard | null>(null);
  const [layout, setLayout] = useState<'big' | 'compact'>('compact');
  const [tab, setTab] = useState<Tab>('cards');

  const byTheme = (themeId: ElementId) =>
    summoned.filter(c => c.el === themeId);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
        linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)
      `,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '52px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Life Album</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            {tab === 'cards'
              ? (summoned.length === 0
                ? 'You haven’t summoned anything yet'
                : `${summoned.length} memor${summoned.length === 1 ? 'y' : 'ies'} captured`)
              : `${discoveredBonds.length} of ${BONDS.length} bonds discovered`}
          </div>
        </div>
        {tab === 'cards' && (
          <button
            onClick={() => setLayout(l => l === 'big' ? 'compact' : 'big')}
            style={{ ...iconBtn, display: 'grid', placeItems: 'center' }}
            aria-label={layout === 'big' ? 'Compact view' : 'Big view'}
            title={layout === 'big' ? 'Compact view' : 'Big view'}
          >
            {layout === 'big' ? <LayoutGrid size={17} /> : <Rows3 size={17} />}
          </button>
        )}
      </div>

      {/* Tab bar — Cards | Bonds. Same segmented-control idiom used on the
          Settings screen so the visual language stays consistent across
          the app. */}
      <div style={{
        display: 'flex', gap: 4, padding: 4,
        margin: '4px 16px 8px',
        background: '#f5ede2', borderRadius: 12,
      }}>
        {([
          { v: 'cards', label: 'Cards' },
          { v: 'bonds', label: 'Bonds' },
        ] as { v: Tab; label: string }[]).map(o => {
          const active = tab === o.v;
          return (
            <button
              key={o.v}
              onClick={() => setTab(o.v)}
              style={{
                flex: 1,
                padding: '8px 0',
                background: active ? '#fff' : 'transparent',
                color: active ? PALETTE.text : PALETTE.textMid,
                border: 'none', borderRadius: 10,
                fontFamily: 'inherit', fontWeight: 600, fontSize: 12,
                cursor: 'pointer',
                boxShadow: active ? '0 2px 6px rgba(58,46,42,.10)' : 'none',
                transition: 'background .15s',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div style={{
        flex: 1, padding: '4px 16px 24px',
        overflowY: 'auto',
      }} className="no-scrollbar">
        {tab === 'cards' ? (
          summoned.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <ThemeSection title="Family"    cards={byTheme('family')}    layout={layout} onTap={setInspect} />
              <ThemeSection title="Work"      cards={byTheme('work')}      layout={layout} onTap={setInspect} />
              <ThemeSection title="Animals"   cards={byTheme('animals')}   layout={layout} onTap={setInspect} />
              <ThemeSection title="Travel"    cards={byTheme('travel')}    layout={layout} onTap={setInspect} />
              <ThemeSection title="Food"      cards={byTheme('food')}      layout={layout} onTap={setInspect} />
              <ThemeSection title="Education" cards={byTheme('education')} layout={layout} onTap={setInspect} />
            </>
          )
        ) : (
          <BondsTab collection={collection} discoveredBonds={discoveredBonds} />
        )}
      </div>

      {inspect && (
        <AlbumLightbox card={inspect} onClose={() => setInspect(null)} />
      )}
    </div>
  );
}

/**
 * Album-style lightbox — the user explicitly didn't want to "open the
 * card" to see the card here; the album is meant to feel like a photo
 * scrapbook, not a card inspector. So we render just the photo at large
 * size, the card's name + element chip, and the player-written memory
 * (when present). No stats, no ability text, no card chrome.
 */
function AlbumLightbox({ card, onClose }: { card: CollectionCard; onClose: () => void }) {
  const e = ELEMENTS[card.el];
  const hasMemory = !!card.memory && card.memory.trim().length > 0;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(8, 4, 12, 0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
        padding: 24,
        animation: 'fadeIn .2s',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460,
          background: '#fff',
          borderRadius: 22,
          padding: 16,
          boxShadow: '0 18px 40px rgba(0,0,0,.35)',
          animation: 'cardSummon 0.35s cubic-bezier(.2,.8,.3,1)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        {/* Close pinned top-right */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            alignSelf: 'flex-end',
            width: 32, height: 32, borderRadius: '50%',
            background: 'transparent', border: `1.5px solid ${PALETTE.border}`,
            display: 'grid', placeItems: 'center',
            cursor: 'pointer', color: PALETTE.text,
            marginTop: -4, marginRight: -4,
          }}
        >
          <X size={14} strokeWidth={2.4} />
        </button>

        {/* The photo, big. Aspect ratio 1:1 matches the polaroid frame. */}
        <div style={{
          width: '100%', aspectRatio: '1 / 1',
          borderRadius: 14, overflow: 'hidden',
          background: e.deep,
          position: 'relative',
          boxShadow: 'inset 0 0 0 1px rgba(58,46,42,.08)',
        }}>
          {card.photo && (
            <img
              src={card.photo}
              alt={card.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>

        {/* Header — name + theme chip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10,
        }}>
          <div style={{
            fontSize: 22, fontWeight: 800, color: PALETTE.text,
            letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            minWidth: 0,
          }}>
            {card.name}
          </div>
          <span style={{
            background: e.color, color: '#fff',
            padding: '4px 9px', borderRadius: 999,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase',
            flex: '0 0 auto',
          }}>
            {e.name}
          </span>
        </div>

        {/* Memory — the whole point of the album. */}
        {hasMemory ? (
          <div style={{
            background: '#fff7e6',
            border: `1px solid ${PALETTE.border}`,
            borderLeft: `3px solid ${PALETTE.accent}`,
            borderRadius: 12,
            padding: '12px 14px',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
              textTransform: 'uppercase', color: PALETTE.accent,
              marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <BookHeart size={11} strokeWidth={2.4} />
              Memory
            </div>
            <div style={{
              fontSize: 13, color: PALETTE.text,
              lineHeight: 1.45, whiteSpace: 'pre-wrap',
              fontFamily: '"Inter", system-ui, sans-serif',
            }}>
              {card.memory}
            </div>
          </div>
        ) : (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(58,46,42,.04)',
            border: `1px dashed ${PALETTE.border}`,
            borderRadius: 12,
            fontSize: 12, color: PALETTE.textMid,
            fontStyle: 'italic', textAlign: 'center',
          }}>
            No memory written for this photo yet. Add one from the Collection screen.
          </div>
        )}
      </div>
    </div>
  );
}

function ThemeSection({
  title, cards, layout, onTap,
}: {
  title: string;
  cards: CollectionCard[];
  layout: 'big' | 'compact';
  onTap: (c: CollectionCard) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: PALETTE.textMid,
        letterSpacing: '0.15em', textTransform: 'uppercase',
        marginBottom: 10, paddingLeft: 4,
      }}>
        {title} · {cards.length}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: layout === 'compact'
          ? 'repeat(auto-fill, minmax(80px, 1fr))'
          : 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: layout === 'compact' ? 6 : 12,
        justifyItems: 'stretch',
      }}>
        {cards.map((c, i) => (
          <PolaroidEntry key={c.uid} card={c} idx={i} compact={layout === 'compact'} onClick={() => onTap(c)} />
        ))}
      </div>
    </div>
  );
}

function PolaroidEntry({
  card, idx, compact, onClick,
}: {
  card: CollectionCard;
  idx: number;
  compact: boolean;
  onClick: () => void;
}) {
  const e = ELEMENTS[card.el];
  const tilt = compact ? 0 : (idx % 2 === 0 ? -1.2 : 1.2);
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff',
        border: 'none',
        borderRadius: compact ? 4 : 6,
        padding: compact ? '4px 4px 6px' : '8px 8px 12px',
        boxShadow: '0 6px 14px rgba(58, 46, 42, .15), 0 1px 0 rgba(58, 46, 42, .06)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transform: `rotate(${tilt}deg)`,
        transition: 'transform .15s',
      }}
      onPointerDown={(ev) => { (ev.currentTarget as HTMLElement).style.transform = `rotate(${tilt}deg) scale(0.97)`; }}
      onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = `rotate(${tilt}deg) scale(1)`; }}
      onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = `rotate(${tilt}deg) scale(1)`; }}
    >
      <div style={{
        width: '100%', aspectRatio: '1 / 1',
        borderRadius: 3, overflow: 'hidden',
        background: e.deep,
        position: 'relative',
      }}>
        {card.photo && (
          <img src={card.photo} alt={card.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        {!compact && <div style={{
          position: 'absolute', top: 6, left: 6,
          background: e.color, color: '#fff',
          fontSize: 9, fontWeight: 700,
          padding: '2px 6px', borderRadius: 8,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{e.name}</div>}
        {card.isPlaceholder && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: 'rgba(58,46,42,.85)', color: '#fff',
            fontSize: 9, fontWeight: 700,
            padding: '3px 6px', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Sparkles size={9} strokeWidth={2.5} />
            placeholder
          </div>
        )}
      </div>
      <div style={{
        marginTop: compact ? 4 : 8, paddingLeft: 2,
        fontSize: compact ? 10 : 13, fontWeight: 600, color: PALETTE.text,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {card.name}
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{
      marginTop: 60, textAlign: 'center', padding: '40px 30px',
      background: '#fff', borderRadius: 18,
      boxShadow: '0 6px 14px rgba(58, 46, 42, .08)',
    }}>
      <div style={{
        margin: '0 auto 14px',
        width: 64, height: 64, borderRadius: '50%',
        background: 'linear-gradient(135deg, #ffd6c2, #ffa07a)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 6px 14px rgba(255,126,95,.3)',
      }}>
        <Camera size={28} color="#fff" strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, marginBottom: 6 }}>
        Your album is empty
      </div>
      <div style={{ fontSize: 12, color: PALETTE.textMid, lineHeight: 1.5 }}>
        Open a pack, then summon your dormant cards by taking photos. Each photo becomes a piece of your album.
      </div>
    </div>
  );
}

// ===========================================================================
// Bonds tab — list every curated bond, locked silhouette until discovered
// through play (both cards alive on the field at the same time).
// ===========================================================================

function BondsTab({
  collection, discoveredBonds,
}: {
  collection: CollectionCard[];
  discoveredBonds: string[];
}) {
  const themes: { id: ElementId; label: string }[] = [
    { id: 'family',    label: 'Family'    },
    { id: 'work',      label: 'Work'      },
    { id: 'animals',   label: 'Animals'   },
    { id: 'travel',    label: 'Travel'    },
    { id: 'food',      label: 'Food'      },
    { id: 'education', label: 'Education' },
  ];
  return (
    <div>
      {themes.map(t => {
        const bonds = BONDS.filter(b => b.themeId === t.id);
        if (bonds.length === 0) return null;
        const discoveredHere = bonds.filter(b => discoveredBonds.includes(b.id)).length;
        return (
          <div key={t.id} style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: PALETTE.textMid,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              marginBottom: 10, paddingLeft: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>{t.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: PALETTE.textLight, letterSpacing: '0.1em' }}>
                {discoveredHere} / {bonds.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bonds.map(b => (
                <BondEntry
                  key={b.id}
                  bond={b}
                  discovered={discoveredBonds.includes(b.id)}
                  collection={collection}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BondEntry({
  bond, discovered, collection,
}: {
  bond: BondDef;
  discovered: boolean;
  collection: CollectionCard[];
}) {
  const e = ELEMENTS[bond.themeId];
  // Resolve the actual photos the player has captured for these template
  // ids — the bond entry shows YOUR photos when available, falling back to
  // the template name as a label otherwise. Either way they're hidden
  // (silhouette) when the bond is locked.
  const cardA = collection.find(c => c.id === bond.cardA && c.photo) ?? null;
  const cardB = collection.find(c => c.id === bond.cardB && c.photo) ?? null;
  const tplA = TEMPLATES.find(t => t.id === bond.cardA);
  const tplB = TEMPLATES.find(t => t.id === bond.cardB);
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${discovered ? 'rgba(244,208,74,.45)' : 'rgba(58,46,42,.08)'}`,
        borderRadius: 14,
        padding: '12px 14px',
        boxShadow: discovered
          ? '0 4px 14px rgba(244,208,74,.18), 0 1px 3px rgba(0,0,0,.06)'
          : '0 4px 12px rgba(58,46,42,.06)',
        opacity: discovered ? 1 : 0.85,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BondPortrait card={cardA} fallback={tplA?.name ?? '?'} themeColor={e.color} locked={!discovered} />
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: discovered
            ? 'radial-gradient(circle at 50% 40%, #fff8d8 0%, #ffd166 50%, #e8a93a 100%)'
            : 'linear-gradient(180deg, #d8cdbf, #b9aa97)',
          display: 'grid', placeItems: 'center',
          color: discovered ? '#a8530a' : '#fff',
          flex: '0 0 auto',
          boxShadow: discovered
            ? '0 0 16px rgba(244,208,74,.6), 0 0 0 2px #fff'
            : '0 0 0 2px #fff, 0 1.5px 3px rgba(0,0,0,.15)',
        }}>
          {discovered ? <Link2 size={18} strokeWidth={3} /> : <Lock size={14} strokeWidth={2.6} />}
        </div>
        <BondPortrait card={cardB} fallback={tplB?.name ?? '?'} themeColor={e.color} locked={!discovered} />
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{
          fontSize: 14, fontWeight: 800,
          color: discovered ? PALETTE.text : PALETTE.textMid,
          letterSpacing: '0.02em',
        }}>
          {discovered ? bond.name : '???'}
        </div>
        <div style={{
          fontSize: 11, color: PALETTE.textMid, marginTop: 4, lineHeight: 1.4,
        }}>
          {discovered
            ? bond.description
            : `Discover by playing ${tplA?.name ?? '???'} and ${tplB?.name ?? '???'} on the field at the same time.`}
        </div>
        {discovered && (
          <div style={{
            fontSize: 11, color: PALETTE.textLight, marginTop: 4,
            fontStyle: 'italic',
          }}>
            “{bond.flavor}”
          </div>
        )}
      </div>
    </div>
  );
}

function BondPortrait({
  card, fallback, themeColor, locked,
}: {
  card: CollectionCard | null;
  fallback: string;
  themeColor: string;
  locked: boolean;
}) {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 10,
      background: locked
        ? 'linear-gradient(160deg, #d8cdbf, #b9aa97)'
        : (card?.photo ? `url(${card.photo}) center/cover` : `linear-gradient(160deg, ${themeColor}, ${themeColor}cc)`),
      display: 'grid', placeItems: 'center',
      flex: '0 0 auto',
      color: '#fff',
      fontSize: 11, fontWeight: 700,
      letterSpacing: '0.04em',
      textAlign: 'center', padding: 4,
      boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.4), 0 2px 6px rgba(0,0,0,.18)',
      filter: locked ? 'blur(1.5px) grayscale(.6)' : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Show the card name as fallback ONLY when it's discovered AND we
          have no photo. While locked, leave it blank so the silhouette
          actually feels like a mystery to be uncovered. */}
      {!locked && !card?.photo && (
        <span style={{ textShadow: '0 1px 1px rgba(0,0,0,.4)' }}>{fallback}</span>
      )}
    </div>
  );
}
