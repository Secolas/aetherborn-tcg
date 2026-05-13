import { useEffect, useRef, useState } from 'react';
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
import { Daily } from './screens/Daily';
import { QuestToast } from './components/QuestToast';
import {
  advanceDaily, claimQuest, claimStreak, initialDaily, recordEvent,
  type DailyState, type Quest, type QuestEvent,
} from './game/quests';
import { usePersistedState } from './hooks/usePersistedState';
import { starterPack, MATCH_WIN_REWARD, MATCH_LOSS_REWARD, MATCH_DRAW_REWARD, STARTER_REWARD } from './game/pack';
import { STARTER_FILTERS, type FilterId } from './data/filters';
import { getMemoryPack } from './data/memoryPacks';
import { aiPhoto } from './data/samplePhotos';
import { getTemplateById, templatesByTheme } from './data/templates';
import type { BossDef } from './data/bosses';
import type { CollectionCard, SaveData, Difficulty, DeckSlot, ElementId } from './game/types';

const MAX_DECKS = 5;
let _deckIdCounter = 0;
function newDeckId(): string {
  _deckIdCounter++;
  return `deck-${Date.now().toString(36)}-${_deckIdCounter}`;
}
import { difficultyProfile } from './game/match';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from './state/settings';
import { unlockAudio, setMusicVolume, playSfx } from './audio/sfx';

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
    unlockedFilters: [...STARTER_FILTERS],
    openedMemoryPacks: [],
  };
}

type Screen = 'home' | 'collection' | 'capture' | 'deck' | 'pack' | 'match' | 'boss-picker' | 'album' | 'settings' | 'daily';

export default function App() {
  const [save, setSave] = usePersistedState<SaveData>(SAVE_KEY, makeInitialSave());
  const [settings, setSettings] = usePersistedState<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const [screen, setScreen] = useState<Screen>('home');
  const [capturing, setCapturing] = useState<CollectionCard | null>(null);
  const [activeBoss, setActiveBoss] = useState<BossDef | null>(null);
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty>('normal');
  /** When set, the upcoming match uses a placeholder deck built from
   *  this theme's templates instead of the player's saved deck. Lets
   *  you test boss balance without first capturing 12+ photos. Cleared
   *  on match exit. */
  const [activeTestTheme, setActiveTestTheme] = useState<ElementId | null>(null);
  /** Toast queue for quest progress + completion. Drains FIFO with a
   *  fixed lifetime per toast; multiple completions stack visibly. */
  const [questToasts, setQuestToasts] = useState<{ id: number; quest: Quest; reason: 'done' | 'streak'; coins?: number }[]>([]);
  const toastIdRef = useRef(0);
  const pushToast = (quest: Quest, reason: 'done' | 'streak' = 'done', coins?: number) => {
    const id = ++toastIdRef.current;
    setQuestToasts(t => [...t, { id, quest, reason, coins }]);
    setTimeout(() => setQuestToasts(t => t.filter(x => x.id !== id)), 2600);
  };

  /** Roll quests + advance the streak on first boot of the day. Wrapped
   *  in a ref-guard so multiple boots in the same calendar day are no-ops. */
  useEffect(() => {
    setSave(s => {
      const next = advanceDaily(s.daily);
      if (s.daily && s.daily.dayKey === next.dayKey && s.daily.streak === next.streak) {
        return s;
      }
      return { ...s, daily: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Backfill cosmetic state on legacy saves that predate filters/memory
   *  packs. Idempotent — if the fields are already populated we leave
   *  them alone so the player doesn't get re-granted starter filters
   *  after later changes. */
  useEffect(() => {
    setSave(s => {
      const needsFilters = !s.unlockedFilters || s.unlockedFilters.length === 0;
      const needsMemory = !s.openedMemoryPacks;
      if (!needsFilters && !needsMemory) return s;
      return {
        ...s,
        unlockedFilters: needsFilters ? [...STARTER_FILTERS] : s.unlockedFilters,
        openedMemoryPacks: needsMemory ? [] : s.openedMemoryPacks,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Apply a quest event to the player's save. Surfaces toasts for any
   *  newly-completed quest so the player gets immediate feedback. */
  const trackEvent = (event: QuestEvent) => {
    setSave(s => {
      const current: DailyState = s.daily ?? initialDaily();
      const { state, newlyCompleted } = recordEvent(current, event);
      newlyCompleted.forEach(q => pushToast(q, 'done'));
      return { ...s, daily: state };
    });
  };

  const onClaimQuest = (questId: string) => {
    setSave(s => {
      if (!s.daily) return s;
      const { state, payout } = claimQuest(s.daily, questId);
      if (payout <= 0) return s;
      claimSfx();
      return { ...s, daily: state, coins: s.coins + payout };
    });
  };

  const onClaimStreak = () => {
    setSave(s => {
      if (!s.daily) return s;
      const { state, payout } = claimStreak(s.daily);
      if (payout <= 0) return s;
      claimSfx();
      return { ...s, daily: state, coins: s.coins + payout };
    });
  };

  // Browsers require a user gesture before AudioContext can play. Unlock on
  // the first pointerdown anywhere in the app, then detach. We also kick
  // off the music engine on first unlock so the ambient pad starts as soon
  // as the player taps anywhere.
  useEffect(() => {
    const onFirstTap = () => {
      unlockAudio();
      setMusicVolume(settings.bgmVolume);
      window.removeEventListener('pointerdown', onFirstTap);
    };
    window.addEventListener('pointerdown', onFirstTap, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstTap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply music volume whenever the setting changes. setMusicVolume
  // ramps for ~400ms so dragging the slider sounds smooth instead of
  // clicky.
  useEffect(() => {
    setMusicVolume(settings.bgmVolume);
  }, [settings.bgmVolume]);

  // Coin chime + sparkle on every claim — fires when the player taps
  // Claim on either the streak card or a completed quest. Routed through
  // the SFX volume so muting respects.
  const claimSfx = () => playSfx('questClaim', settings.sfxVolume);

  // Migrate the legacy single-deck representation (`deckUids`) into the
  // multi-deck `decks` array on first boot of the new schema. Existing
  // players don't lose their built deck — it becomes "My Deck" and stays
  // active. Subsequent boots see `decks` already populated and skip.
  useEffect(() => {
    setSave(s => {
      if (s.decks && s.decks.length > 0) return s;
      const id = newDeckId();
      const slot: DeckSlot = { id, name: 'My Deck', uids: s.deckUids ?? [] };
      return { ...s, decks: [slot], activeDeckId: id };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Migrate placeholder photos on load. The samplePhotos table gets curated
  // over time (e.g. fam-08 Abuela's URL was rotated when the original ID
  // 404'd and SmartImage's picsum fallback returned a wolf). Existing saves
  // have the old URL baked into card.photo, so we re-fetch aiPhoto for every
  // placeholder card whenever the app boots. Real captured photos (data URIs)
  // are untouched.
  //
  // ALSO migrate template fields on load. CollectionCard inlines all of the
  // template's stats / abilities / flavor / rarity at the time the card was
  // saved. When a balance pass updates a template (e.g. Cousin loses Rush,
  // Tio's rarity bumps to rare), the player's saved copy still carries the
  // OLD data unless we re-sync. We merge current template fields onto every
  // saved card on boot, preserving the user-owned bits (uid, photo,
  // nickname, isPlaceholder) so captured photos and names survive.
  useEffect(() => {
    setSave(s => {
      let dirty = false;
      const collection = s.collection.map(c => {
        let next = c;
        // 1. Photo refresh for placeholder cards.
        if (c.isPlaceholder) {
          const fresh = aiPhoto(c.id);
          if (fresh !== c.photo) {
            next = { ...next, photo: fresh };
            dirty = true;
          }
        }
        // 2. Re-sync template fields. If the underlying template no
        //    longer matches the saved card (any of name/cost/atk/hp/
        //    ability/abilityKind/abilityValue/rarity/flavor/type/el
        //    drifted), pull the fresh template in, keeping the user
        //    fields intact.
        const t = getTemplateById(c.id);
        if (t) {
          const drift =
            t.name !== next.name ||
            t.cost !== next.cost ||
            t.atk !== next.atk ||
            t.hp !== next.hp ||
            t.ability !== next.ability ||
            t.abilityKind !== next.abilityKind ||
            t.abilityValue !== next.abilityValue ||
            t.rarity !== next.rarity ||
            t.flavor !== next.flavor ||
            t.type !== next.type ||
            t.el !== next.el;
          if (drift) {
            next = {
              ...t,
              uid: next.uid,
              photo: next.photo,
              nickname: next.nickname,
              isPlaceholder: next.isPlaceholder,
            };
            dirty = true;
          }
        }
        return next;
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
   * see what to replace later. Operates on the currently-active deck.
   */
  const onQuickFill = () => {
    setSave(s => {
      const filled = s.collection.map(c =>
        c.photo
          ? c
          : { ...c, photo: aiPhoto(c.id), isPlaceholder: true }
      );
      const playable = filled.filter(c => !!c.photo);
      // Find the active deck (or first deck) and fill it to 12.
      const decks = (s.decks && s.decks.length > 0)
        ? s.decks
        : [{ id: newDeckId(), name: 'My Deck', uids: s.deckUids ?? [] }];
      const activeId = s.activeDeckId ?? decks[0].id;
      const updatedDecks = decks.map(d => {
        if (d.id !== activeId) return d;
        let uids = d.uids.filter(uid => filled.find(c => c.uid === uid && c.photo));
        if (uids.length < 12) {
          const sorted = [...playable].sort((a, b) => a.cost - b.cost);
          for (const c of sorted) {
            if (uids.length >= 12) break;
            if (!uids.includes(c.uid)) uids.push(c.uid);
          }
        }
        return { ...d, uids };
      });
      const activeUids = updatedDecks.find(d => d.id === activeId)?.uids ?? [];
      return { ...s, collection: filled, decks: updatedDecks, activeDeckId: activeId, deckUids: activeUids };
    });
  };

  /**
   * Clear a card's photo so the player can retake it. Also drops it from
   * EVERY deck since dormant cards can't be played in any of them.
   */
  const onClearPhoto = (uid: string) => {
    setSave(s => {
      const decks = (s.decks ?? []).map(d => ({ ...d, uids: d.uids.filter(x => x !== uid) }));
      const activeUids = decks.find(d => d.id === s.activeDeckId)?.uids
        ?? s.deckUids.filter(x => x !== uid);
      return {
        ...s,
        collection: s.collection.map(c =>
          c.uid === uid ? { ...c, photo: null, isPlaceholder: false } : c
        ),
        decks,
        deckUids: activeUids,
      };
    });
  };

  const onPackOpened = (cards: CollectionCard[], coinsSpent: number) => {
    setSave(s => ({
      ...s,
      coins: s.coins - coinsSpent,
      collection: [...s.collection, ...cards],
      packsOpened: s.packsOpened + 1,
    }));
    trackEvent({ kind: 'pack_opened' });
  };

  /** Memory pack open. Debits coins, appends cards, marks the pack as
   *  opened, and on first-open grants the pack's bonus cosmetic filter. */
  const onMemoryPackOpened = (packId: string, cards: CollectionCard[], cost: number) => {
    const def = getMemoryPack(packId);
    setSave(s => {
      const already = (s.openedMemoryPacks ?? []).includes(packId);
      const unlocked = s.unlockedFilters ?? [...STARTER_FILTERS];
      const bonus = def?.bonusFilter;
      const grantFilter = !already && bonus && !unlocked.includes(bonus);
      return {
        ...s,
        coins: s.coins - cost,
        collection: [...s.collection, ...cards],
        packsOpened: s.packsOpened + 1,
        openedMemoryPacks: already
          ? s.openedMemoryPacks
          : [...(s.openedMemoryPacks ?? []), packId],
        unlockedFilters: grantFilter ? [...unlocked, bonus] : unlocked,
      };
    });
    trackEvent({ kind: 'pack_opened' });
  };

  /** Buy a filter inline from the Capture cosmetic picker. Debits coins
   *  and adds the filter to the unlocked list. No-ops on insufficient
   *  funds or an already-unlocked filter so callers can fire freely. */
  const onBuyFilter = (filterId: FilterId, cost: number) => {
    setSave(s => {
      const unlocked = s.unlockedFilters ?? [...STARTER_FILTERS];
      if (unlocked.includes(filterId)) return s;
      if (s.coins < cost) return s;
      // Cheap UX sparkle — same chime used for quest claim. Cosmetic
      // unlocks deserve the same little payoff moment.
      playSfx('questClaim', settings.sfxVolume);
      return {
        ...s,
        coins: s.coins - cost,
        unlockedFilters: [...unlocked, filterId],
      };
    });
  };

  /** Helper: rewrite a specific deck slot's uids. Mirrors the active
   *  deck's uids back into the legacy `deckUids` field so any code still
   *  reading the old shape stays in sync. */
  const writeDeck = (deckId: string, uids: string[]) => {
    setSave(s => {
      const decks = (s.decks ?? []).map(d => d.id === deckId ? { ...d, uids } : d);
      const activeUids = decks.find(d => d.id === s.activeDeckId)?.uids ?? s.deckUids;
      return { ...s, decks, deckUids: activeUids };
    });
  };

  const onDeckChange = (deckId: string, uids: string[]) => writeDeck(deckId, uids);

  const onCreateDeck = () => {
    setSave(s => {
      const decks = s.decks ?? [];
      if (decks.length >= MAX_DECKS) return s;
      const id = newDeckId();
      const slot: DeckSlot = { id, name: `Deck ${decks.length + 1}`, uids: [] };
      const next = [...decks, slot];
      return { ...s, decks: next, activeDeckId: id, deckUids: [] };
    });
  };

  const onRenameDeck = (deckId: string, name: string) => {
    const trimmed = name.trim().slice(0, 24) || 'Untitled';
    setSave(s => ({
      ...s,
      decks: (s.decks ?? []).map(d => d.id === deckId ? { ...d, name: trimmed } : d),
    }));
  };

  const onDeleteDeck = (deckId: string) => {
    setSave(s => {
      const decks = (s.decks ?? []).filter(d => d.id !== deckId);
      // Always keep at least one deck slot — if the player deleted the
      // last one, recreate an empty default so the rest of the app
      // (matchDeck lookup, DeckBuilder, etc.) has something to render.
      const safe = decks.length > 0 ? decks : [{ id: newDeckId(), name: 'My Deck', uids: [] }];
      // Move active to first remaining deck if we just deleted the
      // currently-active slot.
      const activeId = s.activeDeckId === deckId || !safe.find(d => d.id === s.activeDeckId)
        ? safe[0].id
        : s.activeDeckId;
      const activeUids = safe.find(d => d.id === activeId)?.uids ?? [];
      return { ...s, decks: safe, activeDeckId: activeId, deckUids: activeUids };
    });
  };

  const onSetActiveDeck = (deckId: string) => {
    setSave(s => {
      const decks = s.decks ?? [];
      if (!decks.find(d => d.id === deckId)) return s;
      const activeUids = decks.find(d => d.id === deckId)?.uids ?? [];
      return { ...s, activeDeckId: deckId, deckUids: activeUids };
    });
  };

  const onPickBoss = (boss: BossDef, difficulty: Difficulty, testThemeId: ElementId | null) => {
    setActiveBoss(boss);
    setActiveDifficulty(difficulty);
    setActiveTestTheme(testThemeId);
    setScreen('match');
  };

  const onMatchExit = (outcome: 'win' | 'loss' | 'draw' | 'quit') => {
    const boss = activeBoss;
    const difficulty = activeDifficulty;
    const wasTest = activeTestTheme !== null;
    setActiveTestTheme(null);
    // Test-deck matches don't grant coins or count as beating the boss —
    // they're for balance testing, not progression. Otherwise spamming
    // test fights would inflate coins and falsely unlock the "beaten"
    // medal on bosses the player hasn't legitimately defeated.
    if (wasTest) {
      setActiveBoss(null);
      setScreen('home');
      return;
    }
    // Every non-test match — win, loss, or draw — counts as a played match
    // for quest tracking. Quits don't (the player bailed without a
    // resolution).
    if (outcome !== 'quit') trackEvent({ kind: 'match_played' });
    if (outcome === 'win') trackEvent({ kind: 'match_win', difficulty });
    if (outcome === 'win' && boss) trackEvent({ kind: 'boss_defeated', bossId: boss.id });
    if (outcome === 'win') {
      setSave(s => {
        const firstTime = boss && !s.bossesDefeated.includes(boss.id);
        const mult = difficultyProfile(difficulty).rewardMult;
        // First-time bonus respects the difficulty multiplier — beating
        // Mom on Mythic should pay better than beating her on Normal.
        const bonus = firstTime ? Math.round(boss.rewardCoins * mult) : 0;
        const winReward = Math.round(MATCH_WIN_REWARD * mult);
        // Track highest difficulty cleared per boss so the picker can
        // surface a "beaten on Hard" badge later.
        const beaten = { ...(s.bossesBeatenAt ?? {}) };
        if (boss) {
          const order: Difficulty[] = ['normal', 'hard', 'mythic'];
          const prev = beaten[boss.id];
          if (!prev || order.indexOf(difficulty) > order.indexOf(prev)) {
            beaten[boss.id] = difficulty;
          }
        }
        return {
          ...s,
          coins: s.coins + winReward + bonus,
          matchesWon: s.matchesWon + 1,
          bossesDefeated: firstTime ? [...s.bossesDefeated, boss.id] : s.bossesDefeated,
          bossesBeatenAt: beaten,
        };
      });
    } else if (outcome === 'draw') {
      setSave(s => ({ ...s, coins: s.coins + MATCH_DRAW_REWARD }));
    } else if (outcome === 'loss') {
      setSave(s => ({ ...s, coins: s.coins + MATCH_LOSS_REWARD, matchesLost: s.matchesLost + 1 }));
    }
    setActiveBoss(null);
    setScreen('home');
  };

  // Resolve the active deck for the match. Prefer the multi-deck shape
  // (`decks` + `activeDeckId`); fall back to the legacy `deckUids` for
  // saves loaded before the migration effect has run.
  const activeDeckUids = (save.decks && save.activeDeckId)
    ? (save.decks.find(d => d.id === save.activeDeckId)?.uids ?? save.deckUids)
    : save.deckUids;
  // When a test theme is selected we synthesize a 12-13 card deck from
  // that theme's templates with placeholder aiPhoto images, so the
  // player can quick-fight any boss without first capturing photos /
  // building a deck. This is intentionally ephemeral — nothing in this
  // deck touches save.collection. The match plays normally; only the
  // reward path (onMatchExit) knows whether to credit the win or not.
  const matchDeck: CollectionCard[] = activeTestTheme
    ? templatesByTheme(activeTestTheme).map((t, i) => ({
        ...t,
        uid: `test_${activeTestTheme}_${i}_${t.id}`,
        photo: aiPhoto(t.id),
        isPlaceholder: true,
      }))
    : activeDeckUids
        .map(uid => save.collection.find(c => c.uid === uid))
        .filter((c): c is CollectionCard => !!c && !!c.photo);

  // Surface a small "ready to claim" indicator on the Home menu daily
  // button. Counts unclaimed-but-completed quests + unclaimed streak.
  const dailyReadyCount =
    (save.daily?.streakClaimed ? 0 : 1) +
    (save.daily?.quests.filter(q => q.progress >= q.goal && !q.claimed).length ?? 0);

  return (
    <PhoneShell>
      {screen === 'home' && (
        <HomeMenu
          save={save}
          dailyReadyCount={dailyReadyCount}
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
          coins={save.coins}
          unlockedFilters={save.unlockedFilters ?? [...STARTER_FILTERS]}
          onBuyFilter={onBuyFilter}
          onComplete={onCaptureComplete}
          onBack={() => { setCapturing(null); setScreen('collection'); }}
        />
      )}
      {screen === 'deck' && (
        <DeckBuilder
          collection={save.collection}
          decks={save.decks ?? []}
          activeDeckId={save.activeDeckId ?? (save.decks?.[0]?.id ?? '')}
          maxDecks={MAX_DECKS}
          onChange={onDeckChange}
          onSetActive={onSetActiveDeck}
          onCreate={onCreateDeck}
          onRename={onRenameDeck}
          onDelete={onDeleteDeck}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'pack' && (
        <PackOpening
          coins={save.coins}
          settings={settings}
          openedMemoryPacks={save.openedMemoryPacks ?? []}
          onPackOpened={onPackOpened}
          onMemoryPackOpened={onMemoryPackOpened}
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
      {screen === 'daily' && save.daily && (
        <Daily
          daily={save.daily}
          coins={save.coins}
          onClaimQuest={onClaimQuest}
          onClaimStreak={onClaimStreak}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'boss-picker' && (
        <BossPicker
          defeatedIds={save.bossesDefeated}
          beatenAt={save.bossesBeatenAt ?? {}}
          onPick={onPickBoss}
          onBack={() => setScreen('home')}
        />
      )}
      {/* Quest toast layer — sits above every screen so completion feedback
          plays mid-match without interrupting gameplay. */}
      {questToasts.length > 0 && (
        <div style={{
          position: 'absolute', top: 'max(70px, env(safe-area-inset-top, 70px))', left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          pointerEvents: 'none', zIndex: 1000,
        }}>
          {questToasts.map(t => (
            <QuestToast key={t.id} quest={t.quest} />
          ))}
        </div>
      )}
      {screen === 'match' && activeBoss && (
        <MatchBoard
          deck={matchDeck}
          boss={activeBoss}
          difficulty={activeDifficulty}
          alreadyBeaten={save.bossesDefeated.includes(activeBoss.id)}
          playerAvatar={save.playerAvatar}
          settings={settings}
          onBondDiscovered={(id) => setSave(s => {
            const have = s.discoveredBonds ?? [];
            return have.includes(id) ? s : { ...s, discoveredBonds: [...have, id] };
          })}
          onCreaturePlayed={() => trackEvent({ kind: 'creature_played' })}
          onBondTriggered={() => trackEvent({ kind: 'bond_triggered' })}
          onExit={onMatchExit}
        />
      )}
    </PhoneShell>
  );
}
