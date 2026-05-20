import { useEffect, useRef, useState } from 'react';
import { PhoneShell } from './components/PhoneShell';
import { LogoLoader } from './components/LogoLoader';
import { HomeMenu } from './screens/HomeMenu';
import { AuthProvider, useAuth } from './firebase/auth';
import { useFirestoreSave } from './hooks/useFirestoreSave';
import { uploadCardPhoto, uploadPlayerAvatar, deleteCardPhoto, migrateCollectionPhotos, isDataUriPhoto } from './firebase/photos';
import { LandingPage } from './screens/LandingPage';
import { Login } from './screens/Login';
import { PvpLobby } from './screens/PvpLobby';
import { PvpRoom } from './screens/PvpRoom';
import { Capture } from './screens/Capture';
import { PackOpening } from './screens/PackOpening';
import { MatchBoard } from './screens/MatchBoard';
import { BossPicker } from './screens/BossPicker';
import { Cards, type CardsTab } from './screens/Cards';
import { Battle } from './screens/Battle';
import { SettingsScreen } from './screens/Settings';
import { Daily } from './screens/Daily';
import { QuestToast } from './components/QuestToast';
import {
  advanceDaily, claimQuest, claimStreak, initialDaily, recordEvent,
  type DailyState, type Quest, type QuestEvent,
} from './game/quests';
import { usePersistedState } from './hooks/usePersistedState';
import { MATCH_WIN_REWARD, MATCH_LOSS_REWARD, MATCH_DRAW_REWARD, STARTER_REWARD } from './game/pack';
import { STARTER_THEMES, PICKABLE_STARTER_THEMES, getStarterTheme } from './data/starterDecks';
import { StarterPick } from './screens/StarterPick';
import { StarterPackOpen } from './screens/StarterPackOpen';
import { Tutorial } from './screens/Tutorial';
import { STARTER_FILTERS, type FilterId } from './data/filters';
import { STARTER_FRAMES, type FrameId } from './data/frames';
import { STARTER_BOARD_SKINS, type BoardSkinId } from './data/boardSkins';
import { STARTER_EMOTES, type EmoteId } from './data/victoryEmotes';
import { STARTER_CARD_BACKS, DEFAULT_CARD_BACK, type CardBackId } from './data/cardBacks';
import { CosmeticsProvider } from './state/cosmetics';
import { Cosmetics } from './screens/Cosmetics';
import { aiPhoto } from './data/samplePhotos';
import { getTemplateById, templatesByTheme } from './data/templates';
import type { BossDef } from './data/bosses';
import { getBoss } from './data/bosses';
import { getCampaign } from './data/campaign';
import { Campaign } from './screens/Campaign';
import type { CollectionCard, SaveData, Difficulty, DeckSlot, ElementId } from './game/types';

const MAX_DECKS = 5;
/** Cap the per-save PVP history so an active player doesn't grow the
 *  array unboundedly. ~50 entries comfortably covers a "recent matches"
 *  list while keeping the save payload small. */
const PVP_HISTORY_MAX = 50;
let _deckIdCounter = 0;
function newDeckId(): string {
  _deckIdCounter++;
  return `deck-${Date.now().toString(36)}-${_deckIdCounter}`;
}
import { difficultyProfile } from './game/match';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from './state/settings';
import { unlockAudio, setMusicVolume, playSfx } from './audio/sfx';

const SAVE_KEY = 'lifedeck-save-v1';
const LOCAL_WIPE_FLAG = 'aetherborn-local-wiped-v1';

/** One-time wipe of the legacy localStorage save. As of the Firebase
 *  rollout, the source of truth is per-user Firestore — anything still
 *  in localStorage is stale, and we don't want a left-over save bleeding
 *  back into a fresh account. Runs once per browser (flag persists). */
function wipeLegacyLocalSave() {
  try {
    if (localStorage.getItem(LOCAL_WIPE_FLAG)) return;
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem(LOCAL_WIPE_FLAG, '1');
  } catch { /* private mode / quota — fine */ }
}

/** Brand-new save — empty collection. The player has not yet picked
 *  a starter theme, so SaveData.starterThemeId is undefined and the
 *  onboarding flow (StarterPick -> StarterPackOpen) routes them
 *  through the picker before they see Home. */
function makeInitialSave(): SaveData {
  return {
    version: 1,
    collection: [],
    deckUids: [],
    coins: STARTER_REWARD,
    packsOpened: 0,
    matchesWon: 0,
    matchesLost: 0,
    bossesDefeated: [],
    unlockedFilters: [...STARTER_FILTERS],
    unlockedFrames: [...STARTER_FRAMES],
    unlockedBoardSkins: [...STARTER_BOARD_SKINS],
    unlockedEmotes: [...STARTER_EMOTES],
    unlockedCardBacks: [...STARTER_CARD_BACKS],
    equippedFrame: 'classic',
    equippedBoardSkin: 'daylight',
    equippedEmote: 'gg',
    equippedCardBack: DEFAULT_CARD_BACK,
    openedMemoryPacks: [],
  };
}

type Screen = 'home' | 'cards' | 'capture' | 'pack' | 'match' | 'boss-picker' | 'settings' | 'daily' | 'cosmetics' | 'battle' | 'campaign' | 'starter-pick' | 'starter-open' | 'tutorial' | 'pvp-lobby' | 'pvp-room';

export default function App() {
  // One-time wipe of any legacy localStorage save so a freshly-signed-in
  // user can't accidentally inherit it. Idempotent across reloads.
  useEffect(() => { wipeLegacyLocalSave(); }, []);
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

/** localStorage flag — set once the user has scrolled past the
 *  marketing landing on this device. Subsequent unauthenticated
 *  visits land directly on the Login screen instead of replaying the
 *  marketing page. The version suffix lets us bump if the landing
 *  copy changes materially and we want returning users to see it. */
const LANDING_SEEN_KEY = 'memoria-landing-seen-v1';

function hasSeenLanding(): boolean {
  try { return localStorage.getItem(LANDING_SEEN_KEY) === '1'; }
  catch { return false; }
}

function markLandingSeen() {
  try { localStorage.setItem(LANDING_SEEN_KEY, '1'); } catch { /* private mode — fine */ }
}

function AuthGate() {
  const { user, loading } = useAuth();
  // First-time visitor → landing (marketing). Returning user →
  // straight to Login. The split keeps the marketing page clean
  // (no auth form clutter) and gets repeat visitors to the form in
  // one less screen.
  const [view, setView] = useState<'landing' | 'login'>(() =>
    hasSeenLanding() ? 'login' : 'landing'
  );
  // When the landing CTA fires, we also remember whether the user
  // hit "Begin your album" (signup intent) or the topbar "Sign in"
  // (signin intent) so Login mounts in the right mode.
  const [loginInitialMode, setLoginInitialMode] = useState<'signin' | 'signup'>('signin');

  const enterLogin = (mode: 'signin' | 'signup') => {
    markLandingSeen();
    setLoginInitialMode(mode);
    setView('login');
  };

  if (loading) {
    return (
      <PhoneShell>
        <div style={{ width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 80% 0%, #ffe8d6 0%, #fef8f0 55%, #fef8f0 100%)' }}>
          <LogoLoader tone="light" caption="Memoria" />
        </div>
      </PhoneShell>
    );
  }
  if (!user) {
    if (view === 'landing') {
      return (
        <PhoneShell>
          <LandingPage onEnterApp={enterLogin} />
        </PhoneShell>
      );
    }
    // 'login' view. Only show the back-to-landing chip if there's
    // somewhere to go back to — when the user cold-loads on Login
    // (returning user, localStorage flag already set), we omit the
    // chip so the screen isn't promising a tour that's hidden a
    // click away.
    return (
      <PhoneShell>
        <Login
          initialMode={loginInitialMode}
          onBackToLanding={hasSeenLanding() ? undefined : () => setView('landing')}
        />
      </PhoneShell>
    );
  }
  return <Game />;
}

function Game() {
  const { user, signOutUser } = useAuth();
  const { save, setSave, loading: saveLoading } = useFirestoreSave(user, makeInitialSave());
  const [settings, setSettings] = usePersistedState<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const [pvpRoomId, setPvpRoomId] = useState<string | null>(null);
  // Boot always lands on Home. Onboarding (tutorial -> starter pick
  // -> starter pack open) is surfaced as Home's primary CTA so the
  // player can choose when to start each step instead of being
  // dropped straight into the next screen on every app open.
  const [screen, setScreen] = useState<Screen>('home');
  /** Which tab the tabbed Cards screen opens to. Set by callers that
   *  want to land on a specific surface (deck builder from BossPicker,
   *  collection from Capture-return) before routing to 'cards'. */
  const [cardsTab, setCardsTab] = useState<CardsTab>('collection');
  const goCards = (tab: CardsTab) => { setCardsTab(tab); setScreen('cards'); };
  const [capturing, setCapturing] = useState<CollectionCard | null>(null);
  const [activeBoss, setActiveBoss] = useState<BossDef | null>(null);
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty>('normal');
  /** When set, the upcoming match uses a placeholder deck built from
   *  this theme's templates instead of the player's saved deck. Lets
   *  you test boss balance without first capturing 12+ photos. Cleared
   *  on match exit. */
  const [activeTestTheme, setActiveTestTheme] = useState<ElementId | null>(null);
  /** When set, the upcoming match is a campaign stop. After the match
   *  resolves, we return to the Campaign screen (instead of Home) and
   *  on a win we advance the campaign progress for this arc. Cleared
   *  on match exit. */
  const [activeCampaign, setActiveCampaign] = useState<{ arcId: string; stopIndex: number } | null>(null);
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

  /** Legacy-onboarding migration. Saves that predate the starter-pick
   *  flow (created when makeInitialSave() auto-granted a mixed family
   *  starter pack) get marked as already-onboarded so they skip the
   *  picker on next boot. The trigger is "save shows any sign of life"
   *  — has collection cards, has played matches, or has campaign
   *  progress. A genuinely-empty new save passes through to
   *  StarterPick instead. Idempotent: stops mutating once
   *  starterThemeId is set. */
  useEffect(() => {
    setSave(s => {
      if (s.starterThemeId) return s;
      const hasLife =
        (s.collection?.length ?? 0) > 0 ||
        s.matchesWon > 0 ||
        s.matchesLost > 0 ||
        (s.bossesDefeated?.length ?? 0) > 0;
      if (!hasLife) return s; // truly new — leave for the picker
      // Mark every legacy onboarding bit so existing players skip
      // both the starter open and the new tutorial. They've earned it.
      return { ...s, starterThemeId: 'legacy', starterOpened: true, tutorialCompleted: true };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Backfill cosmetic state on legacy saves that predate the various
   *  cosmetic systems. Each field is checked independently so this
   *  migration stays idempotent across schema rollouts. */
  useEffect(() => {
    setSave(s => {
      const needsFilters = !s.unlockedFilters || s.unlockedFilters.length === 0;
      const needsMemory = !s.openedMemoryPacks;
      const needsFrames = !s.unlockedFrames || s.unlockedFrames.length === 0;
      const needsBoards = !s.unlockedBoardSkins || s.unlockedBoardSkins.length === 0;
      const needsEmotes = !s.unlockedEmotes || s.unlockedEmotes.length === 0;
      const needsCardBacks = !s.unlockedCardBacks || s.unlockedCardBacks.length === 0;
      const needsEquipped = !s.equippedFrame || !s.equippedBoardSkin || !s.equippedEmote || !s.equippedCardBack;
      if (!needsFilters && !needsMemory && !needsFrames && !needsBoards && !needsEmotes && !needsCardBacks && !needsEquipped) return s;
      return {
        ...s,
        unlockedFilters: needsFilters ? [...STARTER_FILTERS] : s.unlockedFilters,
        unlockedFrames: needsFrames ? [...STARTER_FRAMES] : s.unlockedFrames,
        unlockedBoardSkins: needsBoards ? [...STARTER_BOARD_SKINS] : s.unlockedBoardSkins,
        unlockedEmotes: needsEmotes ? [...STARTER_EMOTES] : s.unlockedEmotes,
        unlockedCardBacks: needsCardBacks ? [...STARTER_CARD_BACKS] : s.unlockedCardBacks,
        equippedFrame: s.equippedFrame ?? 'classic',
        equippedBoardSkin: s.equippedBoardSkin ?? 'daylight',
        equippedEmote: s.equippedEmote ?? 'gg',
        equippedCardBack: s.equippedCardBack ?? DEFAULT_CARD_BACK,
        openedMemoryPacks: needsMemory ? [] : s.openedMemoryPacks,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** One-time photo-storage migration. Saves from before the Firebase
   *  Storage rollout inlined every card photo as a ~150 KB base64 data
   *  URI directly in the save doc — fine at 5-10 cards but Firestore
   *  caps a single doc at 1 MB so a full collection couldn't even
   *  round-trip. On every boot, scan the collection for any leftover
   *  data URIs, upload each to Storage, and rewrite the save with the
   *  download URLs. Idempotent — once every card's photo is a URL, the
   *  scan finds nothing and exits.
   *
   *  Runs in a separate effect (not bundled with the cosmetic / nickname
   *  migrations above) so the async work doesn't stall those synchronous
   *  patches. Guarded by `user` + `!saveLoading` so we don't fire it
   *  before the save has actually arrived from Firestore. */
  const photoMigrationRanRef = useRef(false);
  useEffect(() => {
    if (!user || saveLoading || photoMigrationRanRef.current) return;
    const hasInlinePhotos = (save.collection ?? []).some(c => isDataUriPhoto(c.photo));
    const hasInlineAvatar = isDataUriPhoto(save.playerAvatar);
    if (!hasInlinePhotos && !hasInlineAvatar) {
      photoMigrationRanRef.current = true;
      return;
    }
    photoMigrationRanRef.current = true;
    (async () => {
      if (hasInlinePhotos) {
        const { collection, migrated } = await migrateCollectionPhotos(user.uid, save.collection);
        if (migrated > 0) {
          setSave(s => ({ ...s, collection }));
        }
      }
      // Legacy data-URI avatars from old builds — push to Storage so
      // the next Firestore write actually persists them.
      if (hasInlineAvatar && save.playerAvatar) {
        try {
          const url = await uploadPlayerAvatar(user.uid, save.playerAvatar);
          setSave(s => ({ ...s, playerAvatar: url }));
        } catch { /* retry on next boot */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, saveLoading]);

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
        // 1b. Nickname → memory migration. Card titles always show the
        //     template name now; any text the player previously typed
        //     into the (now-removed) nickname field is preserved by
        //     moving it into the new `memory` slot — unless a memory
        //     is already set (don't clobber). Then the nickname is
        //     cleared so the rest of the app can stop reading it.
        if (next.nickname !== undefined) {
          const trimmed = next.nickname.trim();
          const isMeaningful = trimmed.length > 0 && trimmed !== next.name;
          if (isMeaningful && !next.memory) {
            next = { ...next, memory: trimmed, nickname: undefined };
          } else if (next.nickname !== undefined) {
            next = { ...next, nickname: undefined };
          }
          dirty = true;
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
              memory: next.memory,
              isPlaceholder: next.isPlaceholder,
              filterId: next.filterId,
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

  /** Player picked a starter theme on first boot. Resolve the theme's
   *  12-card template list, instantiate fresh CollectionCard rows
   *  (photo: null — the open flow fills them in), add them to the
   *  (currently-empty) collection, ALSO create a new deck slot
   *  containing those 12 uids and make it active so the player has a
   *  ready-to-play deck the moment they finish the open flow, and
   *  route to the StarterPackOpen reveal flow. */
  const onStarterPick = (themeId: typeof STARTER_THEMES[number]['id']) => {
    const theme = getStarterTheme(themeId);
    if (!theme) return;
    setSave(s => {
      const newUid = (i: number) => `c_${Date.now().toString(36)}_${i}_${Math.floor(Math.random() * 1e6).toString(36)}`;
      const cards: CollectionCard[] = [];
      theme.deck.forEach((id, i) => {
        const tpl = getTemplateById(id);
        if (!tpl) return;
        cards.push({ ...tpl, uid: newUid(i), photo: null });
      });
      const starterDeckId = newDeckId();
      const starterDeck: DeckSlot = {
        id: starterDeckId,
        name: `${theme.name} Starter`,
        uids: cards.map(c => c.uid),
      };
      return {
        ...s,
        starterThemeId: themeId,
        starterOpened: false,
        collection: [...s.collection, ...cards],
        decks: [...(s.decks ?? []), starterDeck],
        activeDeckId: starterDeckId,
        // Mirror into the legacy single-deck field so the existing
        // playableInDeck check on Home (which reads deckUids) flips
        // to "deck ready" the moment the open flow finishes.
        deckUids: starterDeck.uids,
      };
    });
    setScreen('starter-open');
  };

  /** Player finished the starter pack open. Cards the player skipped
   *  are left photoless (no auto-placeholder) — the home CTA and
   *  the nav-row gating now keep them on Collection until every
   *  starter card has a real photo. Routes back Home so the player
   *  sees the next-step CTA. */
  const onStarterOpenComplete = () => {
    setSave(s => ({ ...s, starterOpened: true }));
    setScreen('home');
  };

  /** Tutorial match won. Mark complete and route back to Home — the
   *  primary CTA there will have rolled forward to "Pick Your Starter",
   *  one tap away. Consistent with the Home-first boot philosophy. */
  const onTutorialComplete = () => {
    setSave(s => ({ ...s, tutorialCompleted: true }));
    setScreen('home');
  };

  const goCapture = (card: CollectionCard) => {
    setCapturing(card);
    setScreen('capture');
  };

  /** Fire-and-forget: ship a captured photo to Firebase Storage and
   *  swap the inline data URI in the save for the resulting download
   *  URL once the upload lands. Save is updated optimistically (the
   *  data URI renders instantly), and the URL-replacement happens
   *  asynchronously so the UI never blocks on the network. If the
   *  upload fails (offline / quota / etc.), the data URI stays put
   *  and the boot-time migration retries on the next session.
   *
   *  Cards in our collection are uniquely keyed by their `uid`, so
   *  using that as the storage filename means a retake naturally
   *  overwrites the previous bytes. */
  const uploadPhotoInBackground = (cardUid: string, dataUri: string) => {
    if (!user || !isDataUriPhoto(dataUri)) return;
    uploadCardPhoto(user.uid, cardUid, dataUri)
      .then((url) => {
        setSave(s => ({
          ...s,
          collection: s.collection.map(c => c.uid === cardUid ? { ...c, photo: url } : c),
        }));
      })
      .catch(() => { /* migration will retry on next boot */ });
  };

  const onCaptureComplete = (updated: CollectionCard) => {
    // Real photo replaces any placeholder
    const real = { ...updated, isPlaceholder: false };
    setSave(s => ({
      ...s,
      collection: s.collection.map(c => c.uid === real.uid ? real : c),
    }));
    if (real.photo) uploadPhotoInBackground(real.uid, real.photo);
    setCapturing(null);
    goCards('collection');
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
  /** Update (or clear) the player-written memory on a card. Empty/whitespace
   *  collapses to undefined so the ⓘ marker disappears. */
  const onUpdateMemory = (uid: string, memory: string) => {
    const trimmed = memory.trim();
    setSave(s => ({
      ...s,
      collection: s.collection.map(c =>
        c.uid === uid
          ? { ...c, memory: trimmed.length > 0 ? trimmed : undefined }
          : c
      ),
    }));
  };

  const onClearPhoto = (uid: string) => {
    // Best-effort Storage cleanup so retakes / discards don't leave
    // orphaned objects piling up under users/{uid}/photos/. Failures
    // are swallowed inside the helper.
    if (user) deleteCardPhoto(user.uid, uid);
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

  const onPackOpened = (cards: CollectionCard[], coinsSpent: number, newPity: number) => {
    setSave(s => ({
      ...s,
      coins: s.coins - coinsSpent,
      collection: [...s.collection, ...cards],
      packsOpened: s.packsOpened + 1,
      legendaryPity: newPity,
    }));
    trackEvent({ kind: 'pack_opened' });
  };

  /** Memory pack open. Debits coins, appends cards, marks the pack as
   *  opened, and on first-open grants the pack's bonus cosmetic filter. */
  const onMemoryPackOpened = (packId: string, cards: CollectionCard[], cost: number) => {
    // Memory packs no longer grant a free cosmetic filter on first
    // open — filters are now only unlockable through the Cosmetics
    // shop. We still track openedMemoryPacks so the shop can decide
    // whether to discount / hide a pack the player has already seen.
    setSave(s => {
      const already = (s.openedMemoryPacks ?? []).includes(packId);
      return {
        ...s,
        coins: s.coins - cost,
        collection: [...s.collection, ...cards],
        packsOpened: s.packsOpened + 1,
        openedMemoryPacks: already
          ? s.openedMemoryPacks
          : [...(s.openedMemoryPacks ?? []), packId],
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

  /** Buy a card frame, board skin, or victory emote. Shared closure
   *  shape so the four buy callbacks below stay one-liners. */
  const buyCosmetic = <K extends 'unlockedFrames' | 'unlockedBoardSkins' | 'unlockedEmotes' | 'unlockedCardBacks'>(
    key: K,
    starter: string[],
    id: string,
    cost: number,
  ) => {
    setSave(s => {
      const unlocked = (s[key] as string[] | undefined) ?? starter;
      if (unlocked.includes(id)) return s;
      if (s.coins < cost) return s;
      playSfx('questClaim', settings.sfxVolume);
      return { ...s, coins: s.coins - cost, [key]: [...unlocked, id] } as SaveData;
    });
  };
  const onBuyFrame = (id: FrameId, cost: number) => buyCosmetic('unlockedFrames', [...STARTER_FRAMES], id, cost);
  const onBuyBoardSkin = (id: BoardSkinId, cost: number) => buyCosmetic('unlockedBoardSkins', [...STARTER_BOARD_SKINS], id, cost);
  const onBuyEmote = (id: EmoteId, cost: number) => buyCosmetic('unlockedEmotes', [...STARTER_EMOTES], id, cost);
  const onBuyCardBack = (id: CardBackId, cost: number) => buyCosmetic('unlockedCardBacks', [...STARTER_CARD_BACKS], id, cost);

  /** Equip handlers — only commit if the cosmetic is actually unlocked,
   *  so accidental URL state or buggy callers can't equip a locked one. */
  const onEquipFrame = (id: FrameId) => setSave(s =>
    (s.unlockedFrames ?? STARTER_FRAMES).includes(id) ? { ...s, equippedFrame: id } : s);
  const onEquipBoardSkin = (id: BoardSkinId) => setSave(s =>
    (s.unlockedBoardSkins ?? STARTER_BOARD_SKINS).includes(id) ? { ...s, equippedBoardSkin: id } : s);
  const onEquipEmote = (id: EmoteId) => setSave(s =>
    (s.unlockedEmotes ?? STARTER_EMOTES).includes(id) ? { ...s, equippedEmote: id } : s);
  const onEquipCardBack = (id: CardBackId) => setSave(s =>
    (s.unlockedCardBacks ?? STARTER_CARD_BACKS).includes(id) ? { ...s, equippedCardBack: id } : s);

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
    setActiveCampaign(null);
    setScreen('match');
  };

  /** Launch a match from a campaign stop. Always Normal difficulty —
   *  the campaign curve comes from arc ordering, not per-boss tiers.
   *  Stores the arc + stop so onMatchExit can advance progress and
   *  return to the Campaign screen instead of Home. */
  const onPickCampaignStop = (arcId: string, stopIndex: number) => {
    const arc = getCampaign(arcId);
    if (!arc) return;
    const stop = arc.stops[stopIndex];
    if (!stop) return;
    const boss = getBoss(stop.bossId);
    if (!boss) return;
    setActiveBoss(boss);
    setActiveDifficulty('normal');
    setActiveTestTheme(null);
    setActiveCampaign({ arcId, stopIndex });
    setScreen('match');
  };

  const onMatchExit = (outcome: 'win' | 'loss' | 'draw' | 'quit') => {
    const boss = activeBoss;
    const difficulty = activeDifficulty;
    const wasTest = activeTestTheme !== null;
    const wasCampaign = activeCampaign;
    setActiveTestTheme(null);
    setActiveCampaign(null);
    // Test-deck matches don't grant coins or count as beating the boss —
    // they're for balance testing, not progression. Otherwise spamming
    // test fights would inflate coins and falsely unlock the "beaten"
    // medal on bosses the player hasn't legitimately defeated.
    if (wasTest) {
      setActiveBoss(null);
      setScreen('home');
      return;
    }
    // Campaign matches advance arc progress on a win. We do this BEFORE
    // the regular reward block so the same setSave can persist both
    // updates atomically. The regular reward path still runs below so
    // coins, bossesDefeated, bossesBeatenAt, etc. all stay consistent
    // with the picker (a campaign win counts the same as a picker win).
    if (wasCampaign && outcome === 'win') {
      setSave(s => {
        const progress = { ...(s.campaignProgress ?? {}) };
        const current = progress[wasCampaign.arcId] ?? -1;
        if (wasCampaign.stopIndex > current) {
          progress[wasCampaign.arcId] = wasCampaign.stopIndex;
        }
        return { ...s, campaignProgress: progress };
      });
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
        const won    = { ...(s.bossesWonAt ?? {}) };
        if (boss) {
          const order: Difficulty[] = ['normal', 'hard', 'mythic'];
          const prev = beaten[boss.id];
          if (!prev || order.indexOf(difficulty) > order.indexOf(prev)) {
            beaten[boss.id] = difficulty;
          }
          won[boss.id] = (won[boss.id] ?? 0) + 1;
        }
        return {
          ...s,
          coins: s.coins + winReward + bonus,
          matchesWon: s.matchesWon + 1,
          bossesDefeated: firstTime ? [...s.bossesDefeated, boss.id] : s.bossesDefeated,
          bossesBeatenAt: beaten,
          bossesWonAt: won,
        };
      });
    } else if (outcome === 'draw') {
      setSave(s => ({ ...s, coins: s.coins + MATCH_DRAW_REWARD }));
    } else if (outcome === 'loss') {
      setSave(s => {
        const lost = { ...(s.bossesLostAt ?? {}) };
        if (boss) lost[boss.id] = (lost[boss.id] ?? 0) + 1;
        return {
          ...s,
          coins: s.coins + MATCH_LOSS_REWARD,
          matchesLost: s.matchesLost + 1,
          bossesLostAt: lost,
        };
      });
    }
    setActiveBoss(null);
    // Return to the Campaign screen if the match was launched from a
    // campaign stop (so the player sees their newly-unlocked next stop
    // immediately). Otherwise back to Home as before.
    setScreen(wasCampaign ? 'campaign' : 'home');
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

  // Starter-photos gate — once the starter open flow ends, any card
  // the player skipped is still photoless (no auto-placeholder), and
  // every screen except Collection is gated until they finish
  // photographing the deck. Legacy saves bypass.
  const starterDeckSlot = (save.decks ?? []).find(d => d.name?.toLowerCase().endsWith('starter'));
  const starterPhotosComplete = !starterDeckSlot
    || !save.starterOpened
    || save.starterThemeId === 'legacy'
    || (starterDeckSlot.uids ?? []).every(uid => {
        const c = save.collection.find(cc => cc.uid === uid);
        return !!c?.photo;
      });
  const fullyUnlocked = !!save.starterThemeId && starterPhotosComplete;

  if (saveLoading) {
    return (
      <PhoneShell>
        <div style={{ width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 50% 30%, #1c2244 0%, #0a0c1c 70%)' }}>
          <LogoLoader tone="dark" caption="Loading your collection" />
        </div>
      </PhoneShell>
    );
  }

  return (
    <CosmeticsProvider
      frame={save.equippedFrame}
      boardSkin={save.equippedBoardSkin}
      emote={save.equippedEmote}
      cardBack={save.equippedCardBack}
    >
    <PhoneShell>
      {screen === 'starter-pick' && (
        <StarterPick
          themes={PICKABLE_STARTER_THEMES}
          onPick={(themeId) => onStarterPick(themeId)}
          onCancel={() => setScreen('home')}
        />
      )}
      {screen === 'starter-open' && save.starterThemeId && save.starterThemeId !== 'legacy' && (
        <StarterPackOpen
          theme={getStarterTheme(save.starterThemeId)!}
          cards={save.collection.slice(-12)}
          onSetPhoto={(uid, dataUrl) => {
            setSave(s => ({
              ...s,
              collection: s.collection.map(c => c.uid === uid ? { ...c, photo: dataUrl, isPlaceholder: false } : c),
            }));
            uploadPhotoInBackground(uid, dataUrl);
          }}
          onDone={onStarterOpenComplete}
        />
      )}
      {screen === 'home' && (
        <HomeMenu
          save={save}
          dailyReadyCount={dailyReadyCount}
          playerName={user?.displayName || user?.email?.split('@')[0]}
          onSignOut={() => { signOutUser(); }}
          onSetAvatar={(dataUrl) => {
            // Optimistic local set so the player sees the avatar
            // immediately — but if it's a raw data URI, kick off a
            // background upload to Firebase Storage and swap the
            // field to the resulting URL once it lands. Without this
            // the data URI either fails the Firestore 1MB per-field
            // cap (camera photos are often 2-3MB) and the avatar
            // vanishes on the next refresh, or it persists in the
            // save doc but eats most of the available document
            // budget.
            setSave(s => ({ ...s, playerAvatar: dataUrl }));
            if (user && dataUrl && isDataUriPhoto(dataUrl)) {
              uploadPlayerAvatar(user.uid, dataUrl)
                .then((url) => setSave(s => ({ ...s, playerAvatar: url })))
                .catch(() => { /* keep the data URI locally; next change retries */ });
            }
          }}
          onNav={(s) => {
            if (s === 'play') setScreen('boss-picker');
            else if (s === 'cards') goCards('collection');
            else setScreen(s);
          }}
        />
      )}
      {screen === 'pvp-lobby' && (
        <PvpLobby
          collection={save.collection}
          playerAvatar={save.playerAvatar}
          history={save.pvpHistory ?? []}
          onEnterRoom={(id) => { setPvpRoomId(id); setScreen('pvp-room'); }}
          onAvatarMigrated={(url) => setSave(s => ({ ...s, playerAvatar: url }))}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'pvp-room' && pvpRoomId && (
        <PvpRoom
          roomId={pvpRoomId}
          playerAvatar={save.playerAvatar}
          settings={settings}
          onLeave={() => { setPvpRoomId(null); setScreen('pvp-lobby'); }}
          onMatchEnded={(entry) => {
            // Prepend the new result + cap to PVP_HISTORY_MAX so the
            // list doesn't grow forever on a heavy PVP player.
            setSave(s => {
              const prev = s.pvpHistory ?? [];
              const next = [{ ...entry, at: Date.now() }, ...prev].slice(0, PVP_HISTORY_MAX);
              return { ...s, pvpHistory: next };
            });
          }}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onChange={setSettings}
          onBack={() => setScreen('home')}
          onResetAccount={() => {
            // Wipe save back to the initial empty state, but keep
            // tutorialCompleted = true so the player lands on the
            // StarterPick CTA rather than re-doing the tutorial they
            // already know how to play. Also seed `daily` immediately:
            // the once-per-mount advanceDaily effect doesn't re-fire on
            // reset, so without this the Daily screen mounts against
            // an undefined value and renders blank.
            setSave(() => ({
              ...makeInitialSave(),
              tutorialCompleted: true,
              daily: advanceDaily(undefined),
            }));
            setActiveBoss(null);
            setActiveCampaign(null);
            setActiveTestTheme(null);
            setPvpRoomId(null);
            setScreen('home');
          }}
        />
      )}
      {screen === 'cards' && (
        <Cards
          initialTab={cardsTab}
          collection={save.collection}
          onUpdateMemory={onUpdateMemory}
          onBack={() => setScreen('home')}
          onCapture={goCapture}
          onClearPhoto={onClearPhoto}
          onQuickFill={onQuickFill}
          decks={save.decks ?? []}
          activeDeckId={save.activeDeckId ?? (save.decks?.[0]?.id ?? '')}
          maxDecks={MAX_DECKS}
          onDeckChange={onDeckChange}
          onSetActiveDeck={onSetActiveDeck}
          onCreateDeck={onCreateDeck}
          onRenameDeck={onRenameDeck}
          onDeleteDeck={onDeleteDeck}
          discoveredBonds={save.discoveredBonds ?? []}
        />
      )}
      {screen === 'battle' && (
        <Battle
          unlocked={fullyUnlocked}
          onPickPeople={() => setScreen('pvp-lobby')}
          onPickCampaign={() => setScreen('campaign')}
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
          onBack={() => { setCapturing(null); goCards('collection'); }}
        />
      )}
      {screen === 'pack' && (
        <PackOpening
          coins={save.coins}
          legendaryPity={save.legendaryPity ?? 0}
          settings={settings}
          openedMemoryPacks={save.openedMemoryPacks ?? []}
          onPackOpened={onPackOpened}
          onMemoryPackOpened={onMemoryPackOpened}
          onBack={() => setScreen('home')}
          unlocked={fullyUnlocked}
          onStartTutorial={() => setScreen('tutorial')}
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
      {screen === 'cosmetics' && (
        <Cosmetics
          coins={save.coins}
          unlockedFrames={save.unlockedFrames ?? [...STARTER_FRAMES]}
          unlockedFilters={save.unlockedFilters ?? [...STARTER_FILTERS]}
          unlockedBoardSkins={save.unlockedBoardSkins ?? [...STARTER_BOARD_SKINS]}
          unlockedEmotes={save.unlockedEmotes ?? [...STARTER_EMOTES]}
          unlockedCardBacks={save.unlockedCardBacks ?? [...STARTER_CARD_BACKS]}
          equippedFrame={save.equippedFrame ?? 'classic'}
          equippedBoardSkin={save.equippedBoardSkin ?? 'daylight'}
          equippedEmote={save.equippedEmote ?? 'gg'}
          equippedCardBack={save.equippedCardBack ?? DEFAULT_CARD_BACK}
          onBuyFrame={onBuyFrame}
          onBuyFilter={onBuyFilter}
          onBuyBoardSkin={onBuyBoardSkin}
          onBuyEmote={onBuyEmote}
          onBuyCardBack={onBuyCardBack}
          onEquipFrame={onEquipFrame}
          onEquipBoardSkin={onEquipBoardSkin}
          onEquipEmote={onEquipEmote}
          onEquipCardBack={onEquipCardBack}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'boss-picker' && (
        <BossPicker
          defeatedIds={save.bossesDefeated}
          beatenAt={save.bossesBeatenAt ?? {}}
          wonAt={save.bossesWonAt ?? {}}
          lostAt={save.bossesLostAt ?? {}}
          campaignProgress={save.campaignProgress ?? {}}
          coins={save.coins}
          decks={save.decks ?? []}
          activeDeckId={save.activeDeckId}
          collection={save.collection}
          onSetActiveDeck={onSetActiveDeck}
          onPick={onPickBoss}
          onBack={() => setScreen('home')}
          onOpenDeckBuilder={() => goCards('deck')}
        />
      )}
      {screen === 'campaign' && (
        <Campaign
          progress={save.campaignProgress ?? {}}
          collection={save.collection}
          decks={save.decks ?? []}
          activeDeckId={save.activeDeckId}
          unlocked={fullyUnlocked}
          onSetActiveDeck={onSetActiveDeck}
          onPickStop={onPickCampaignStop}
          onOpenDeckBuilder={() => goCards('deck')}
          onBack={() => setScreen('home')}
          onStartTutorial={() => setScreen('tutorial')}
        />
      )}
      {screen === 'tutorial' && (
        <Tutorial
          starterThemeId={save.starterThemeId}
          playerAvatar={save.playerAvatar}
          settings={settings}
          onComplete={onTutorialComplete}
          onAbandon={() => setScreen('home')}
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
    </CosmeticsProvider>
  );
}
