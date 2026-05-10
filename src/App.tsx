import { useEffect, useState } from 'react';
import { PhoneShell } from './components/PhoneShell';
import { HomeMenu } from './screens/HomeMenu';
import { Collection } from './screens/Collection';
import { Capture } from './screens/Capture';
import { DeckBuilder } from './screens/DeckBuilder';
import { PackOpening } from './screens/PackOpening';
import { MatchBoard } from './screens/MatchBoard';
import { BossPicker } from './screens/BossPicker';
import { Album } from './screens/Album';
import { SettingsScreen } from './screens/Settings';
import { usePersistedState } from './hooks/usePersistedState';
import { starterPack, MATCH_WIN_REWARD, MATCH_LOSS_REWARD, STARTER_REWARD } from './game/pack';
import { aiPhoto } from './data/samplePhotos';
import type { BossDef } from './data/bosses';
import type { CollectionCard, SaveData } from './game/types';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from './state/settings';
import { unlockAudio } from './audio/sfx';

const SAVE_KEY = 'lifedeck-save-v1';

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
    bossesDefeated: [],
  };
}

type Screen = 'home' | 'collection' | 'capture' | 'deck' | 'pack' | 'match' | 'boss-picker' | 'album' | 'settings';

export default function App() {
  const [save, setSave] = usePersistedState<SaveData>(SAVE_KEY, makeInitialSave());
  const [settings, setSettings] = usePersistedState<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const [screen, setScreen] = useState<Screen>('home');
  const [capturing, setCapturing] = useState<CollectionCard | null>(null);
  const [activeBoss, setActiveBoss] = useState<BossDef | null>(null);

  // Browsers require a user gesture before AudioContext can play. Unlock on
  // the first pointerdown anywhere in the app, then detach.
  useEffect(() => {
    const onFirstTap = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', onFirstTap);
    };
    window.addEventListener('pointerdown', onFirstTap, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstTap);
  }, []);

  // Migrate placeholder photos on load. The samplePhotos table gets curated
  // over time (e.g. fam-08 Abuela's URL was rotated when the original ID
  // 404'd and SmartImage's picsum fallback returned a wolf). Existing saves
  // have the old URL baked into card.photo, so we re-fetch aiPhoto for every
  // placeholder card whenever the app boots. Real captured photos (data URIs)
  // are untouched.
  useEffect(() => {
    setSave(s => {
      let dirty = false;
      const collection = s.collection.map(c => {
        if (!c.isPlaceholder) return c;
        const fresh = aiPhoto(c.id);
        if (fresh === c.photo) return c;
        dirty = true;
        return { ...c, photo: fresh };
      });
      return dirty ? { ...s, collection } : s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goCapture = (card: CollectionCard) => {
    setCapturing(card);
    setScreen('capture');
  };

  const onCaptureComplete = (updated: CollectionCard) => {
    // Real photo replaces any placeholder
    const real = { ...updated, isPlaceholder: false };
    setSave(s => ({
      ...s,
      collection: s.collection.map(c => c.uid === real.uid ? real : c),
    }));
    setCapturing(null);
    setScreen('collection');
  };

  /**
   * Quick Play: fill every dormant card with a thematic placeholder photo
   * and auto-build a starter deck so the player can play immediately
   * without taking real photos. Each placeholder is marked so they can
   * see what to replace later.
   */
  const onQuickFill = () => {
    setSave(s => {
      const filled = s.collection.map(c =>
        c.photo
          ? c
          : { ...c, photo: aiPhoto(c.id), isPlaceholder: true }
      );
      const playable = filled.filter(c => !!c.photo);
      // Auto-fill to a 12-card deck so the player matches the boss decks
      // (also 12). With fewer cards the AI used to draw more cards over the
      // course of a match, which felt unfair.
      let deckUids = s.deckUids.filter(uid => filled.find(c => c.uid === uid && c.photo));
      if (deckUids.length < 12) {
        const sorted = [...playable].sort((a, b) => a.cost - b.cost); // cheap first for a sane curve
        for (const c of sorted) {
          if (deckUids.length >= 12) break;
          if (!deckUids.includes(c.uid)) deckUids.push(c.uid);
        }
      }
      return { ...s, collection: filled, deckUids };
    });
  };

  /**
   * Clear a card's photo so the player can retake it. Also drops it from
   * the active deck since dormant cards can't be played.
   */
  const onClearPhoto = (uid: string) => {
    setSave(s => ({
      ...s,
      collection: s.collection.map(c =>
        c.uid === uid ? { ...c, photo: null, isPlaceholder: false } : c
      ),
      deckUids: s.deckUids.filter(x => x !== uid),
    }));
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

  const onPickBoss = (boss: BossDef) => {
    setActiveBoss(boss);
    setScreen('match');
  };

  const onMatchExit = (outcome: 'win' | 'loss' | 'quit') => {
    const boss = activeBoss;
    if (outcome === 'win') {
      setSave(s => {
        const firstTime = boss && !s.bossesDefeated.includes(boss.id);
        const bonus = firstTime ? boss.rewardCoins : 0;
        return {
          ...s,
          coins: s.coins + MATCH_WIN_REWARD + bonus,
          matchesWon: s.matchesWon + 1,
          bossesDefeated: firstTime ? [...s.bossesDefeated, boss.id] : s.bossesDefeated,
        };
      });
    } else if (outcome === 'loss') {
      setSave(s => ({ ...s, coins: s.coins + MATCH_LOSS_REWARD, matchesLost: s.matchesLost + 1 }));
    }
    setActiveBoss(null);
    setScreen('home');
  };

  const matchDeck = save.deckUids
    .map(uid => save.collection.find(c => c.uid === uid))
    .filter((c): c is CollectionCard => !!c && !!c.photo);

  return (
    <PhoneShell>
      {screen === 'home' && (
        <HomeMenu
          save={save}
          onQuickFill={onQuickFill}
          onSetAvatar={(dataUrl) => setSave(s => ({ ...s, playerAvatar: dataUrl }))}
          onNav={(s) => {
            if (s === 'play') setScreen('boss-picker');
            else if (s === 'settings') setScreen('settings');
            else setScreen(s);
          }}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onChange={setSettings}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'collection' && (
        <Collection
          collection={save.collection}
          onCapture={goCapture}
          onClearPhoto={onClearPhoto}
          onQuickFill={onQuickFill}
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
      {screen === 'album' && (
        <Album
          collection={save.collection}
          discoveredBonds={save.discoveredBonds ?? []}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'boss-picker' && (
        <BossPicker
          defeatedIds={save.bossesDefeated}
          onPick={onPickBoss}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'match' && activeBoss && (
        <MatchBoard
          deck={matchDeck}
          boss={activeBoss}
          playerAvatar={save.playerAvatar}
          settings={settings}
          onBondDiscovered={(id) => setSave(s => {
            const have = s.discoveredBonds ?? [];
            return have.includes(id) ? s : { ...s, discoveredBonds: [...have, id] };
          })}
          onExit={onMatchExit}
        />
      )}
    </PhoneShell>
  );
}
