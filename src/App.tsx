import { useState } from 'react';
import { PhoneShell } from './components/PhoneShell';
import { HomeMenu } from './screens/HomeMenu';
import { Collection } from './screens/Collection';
import { Capture } from './screens/Capture';
import { DeckBuilder } from './screens/DeckBuilder';
import { PackOpening } from './screens/PackOpening';
import { MatchBoard } from './screens/MatchBoard';
import { usePersistedState } from './hooks/usePersistedState';
import { starterPack, MATCH_WIN_REWARD, MATCH_LOSS_REWARD, STARTER_REWARD } from './game/pack';
import type { CollectionCard, SaveData } from './game/types';

const SAVE_KEY = 'aetherborn-save-v1';

function makeInitialSave(): SaveData {
  const starter = starterPack();
  return {
    version: 1,
    collection: starter,
    deckUids: [],
    coins: STARTER_REWARD,
    packsOpened: 0,
    matchesWon: 0,
    matchesLost: 0,
  };
}

type Screen = 'home' | 'collection' | 'capture' | 'deck' | 'pack' | 'match';

export default function App() {
  const [save, setSave] = usePersistedState<SaveData>(SAVE_KEY, makeInitialSave());
  const [screen, setScreen] = useState<Screen>('home');
  const [capturing, setCapturing] = useState<CollectionCard | null>(null);

  const goCapture = (card: CollectionCard) => {
    setCapturing(card);
    setScreen('capture');
  };

  const onCaptureComplete = (updated: CollectionCard) => {
    setSave(s => ({
      ...s,
      collection: s.collection.map(c => c.uid === updated.uid ? updated : c),
    }));
    setCapturing(null);
    setScreen('collection');
  };

  const onPackOpened = (cards: CollectionCard[], coinsSpent: number) => {
    setSave(s => ({
      ...s,
      coins: s.coins - coinsSpent,
      collection: [...s.collection, ...cards],
      packsOpened: s.packsOpened + 1,
    }));
  };

  const onDeckChange = (uids: string[]) => {
    setSave(s => ({ ...s, deckUids: uids }));
  };

  const onMatchExit = (outcome: 'win' | 'loss' | 'quit') => {
    if (outcome === 'win') {
      setSave(s => ({ ...s, coins: s.coins + MATCH_WIN_REWARD, matchesWon: s.matchesWon + 1 }));
    } else if (outcome === 'loss') {
      setSave(s => ({ ...s, coins: s.coins + MATCH_LOSS_REWARD, matchesLost: s.matchesLost + 1 }));
    }
    setScreen('home');
  };

  // Build the player's actual deck from uids → CollectionCard
  const matchDeck = save.deckUids
    .map(uid => save.collection.find(c => c.uid === uid))
    .filter((c): c is CollectionCard => !!c && !!c.photo);

  return (
    <PhoneShell>
      {screen === 'home' && (
        <HomeMenu save={save} onNav={(s) => setScreen(s)} />
      )}
      {screen === 'collection' && (
        <Collection
          collection={save.collection}
          onCapture={goCapture}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'capture' && (
        <Capture
          template={capturing}
          onComplete={onCaptureComplete}
          onBack={() => { setCapturing(null); setScreen('collection'); }}
        />
      )}
      {screen === 'deck' && (
        <DeckBuilder
          collection={save.collection}
          deckUids={save.deckUids}
          onChange={onDeckChange}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'pack' && (
        <PackOpening
          coins={save.coins}
          onPackOpened={onPackOpened}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'match' && (
        <MatchBoard
          deck={matchDeck}
          onExit={onMatchExit}
        />
      )}
    </PhoneShell>
  );
}
