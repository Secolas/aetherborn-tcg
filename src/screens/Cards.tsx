import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Collection } from './Collection';
import { DeckBuilder } from './DeckBuilder';
import { Album } from './Album';
import { iconBtn, PALETTE } from '../components/styles';
import type { CollectionCard, DeckSlot } from '../game/types';

export type CardsTab = 'collection' | 'deck' | 'album';

interface Props {
  initialTab: CardsTab;
  // Shared
  collection: CollectionCard[];
  onUpdateMemory: (uid: string, memory: string) => void;
  onBack: () => void;
  // Collection
  onCapture: (card: CollectionCard) => void;
  onClearPhoto: (uid: string) => void;
  onQuickFill: () => void;
  // DeckBuilder
  decks: DeckSlot[];
  activeDeckId: string;
  maxDecks: number;
  onDeckChange: (deckId: string, uids: string[]) => void;
  onSetActiveDeck: (deckId: string) => void;
  onCreateDeck: () => void;
  onRenameDeck: (deckId: string, name: string) => void;
  onDeleteDeck: (deckId: string) => void;
  // Album
  discoveredBonds: string[];
}

/**
 * Tabbed wrapper that hosts Collection, Deck, and Album under a single
 * home-nav destination. The three child screens are reused as-is via
 * their `embedded` flag — they drop their own back button + title so
 * this shell can own the top chrome.
 */
export function Cards({
  initialTab,
  collection, onUpdateMemory, onBack,
  onCapture, onClearPhoto, onQuickFill,
  decks, activeDeckId, maxDecks,
  onDeckChange, onSetActiveDeck, onCreateDeck, onRenameDeck, onDeleteDeck,
  discoveredBonds,
}: Props) {
  const [tab, setTab] = useState<CardsTab>(initialTab);

  const TABS: { v: CardsTab; label: string }[] = [
    { v: 'collection', label: 'Collection' },
    { v: 'deck',       label: 'Deck' },
    { v: 'album',      label: 'Album' },
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)',
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '52px 16px 4px',
        display: 'flex', alignItems: 'center', gap: 10,
        flex: '0 0 auto',
      }}>
        <button onClick={onBack} style={iconBtn} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div style={{
          flex: 1,
          display: 'flex', gap: 4, padding: 4,
          background: '#f5ede2', borderRadius: 12,
        }}>
          {TABS.map(o => {
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
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
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
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'collection' && (
          <Collection
            embedded
            collection={collection}
            onCapture={onCapture}
            onClearPhoto={onClearPhoto}
            onQuickFill={onQuickFill}
            onUpdateMemory={onUpdateMemory}
            onBack={onBack}
          />
        )}
        {tab === 'deck' && (
          <DeckBuilder
            embedded
            collection={collection}
            decks={decks}
            activeDeckId={activeDeckId}
            maxDecks={maxDecks}
            onChange={onDeckChange}
            onSetActive={onSetActiveDeck}
            onCreate={onCreateDeck}
            onRename={onRenameDeck}
            onDelete={onDeleteDeck}
            onUpdateMemory={onUpdateMemory}
            onBack={onBack}
          />
        )}
        {tab === 'album' && (
          <Album
            embedded
            collection={collection}
            discoveredBonds={discoveredBonds}
            onBack={onBack}
          />
        )}
      </div>
    </div>
  );
}
