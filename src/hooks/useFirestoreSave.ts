import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { loadSave, writeSave } from '../firebase/save';
import type { SaveData } from '../game/types';

/** Per-user Firestore-backed save state.
 *
 *  - Loads the user's `users/{uid}/state/save` document on mount.
 *  - Falls back to `initial` if no doc exists yet (fresh account).
 *  - Persists changes back to Firestore with a small debounce so
 *    rapid setState batches don't fan out into many network writes.
 *  - When `user` is null, returns the initial state and persists
 *    nothing — let the caller gate the UI on auth.
 */
export function useFirestoreSave(
  user: User | null,
  initial: SaveData,
): {
  save: SaveData;
  setSave: (next: SaveData | ((prev: SaveData) => SaveData)) => void;
  loading: boolean;
} {
  const [save, setSaveState] = useState<SaveData>(initial);
  const [loading, setLoading] = useState<boolean>(!!user);
  // Hold the latest save in a ref so the debounced writer always sees the
  // freshest snapshot without re-creating its timeout on every keystroke.
  const latest = useRef<SaveData>(save);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writingUid = useRef<string | null>(null);
  // Flips true once the per-user Firestore load has resolved. Writes are
  // gated on this: legacy-save migrations in App.tsx run synchronously
  // on mount and fire setSave against the fresh `initial` state — if we
  // let those persist they race the in-flight loadSave and (when the
  // 600ms debounce fires before the network round-trip completes) full-
  // replace the user's real save with an empty one. The visible symptom
  // is the tutorial restarting after sign-out / sign-in: the corrupted
  // doc no longer carries tutorialCompleted on the next load.
  const loaded = useRef<boolean>(false);

  // Load on auth change.
  useEffect(() => {
    if (!user) {
      setSaveState(initial);
      latest.current = initial;
      writingUid.current = null;
      loaded.current = true;
      setLoading(false);
      return;
    }
    let cancelled = false;
    loaded.current = false;
    setLoading(true);
    writingUid.current = user.uid;
    (async () => {
      try {
        const remote = await loadSave(user.uid);
        if (cancelled) return;
        const next = remote ? { ...initial, ...remote } : initial;
        setSaveState(next);
        latest.current = next;
      } catch {
        if (!cancelled) {
          setSaveState(initial);
          latest.current = initial;
        }
      } finally {
        if (!cancelled) {
          loaded.current = true;
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const setSave = (next: SaveData | ((prev: SaveData) => SaveData)) => {
    setSaveState((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: SaveData) => SaveData)(prev) : next;
      latest.current = resolved;
      // Persist only after the initial load has resolved. Before that,
      // `prev` is still the fresh `initial` (the user's real save hasn't
      // arrived yet), so any write here would clobber Firestore.
      if (writingUid.current && loaded.current) {
        if (writeTimer.current) clearTimeout(writeTimer.current);
        const uid = writingUid.current;
        writeTimer.current = setTimeout(() => {
          writeTimer.current = null;
          writeSave(uid, latest.current).catch(() => { /* swallow — retry on next change */ });
        }, 600);
      }
      return resolved;
    });
  };

  // Flush any pending debounced write when the tab is about to close
  // or refresh. Without this, anything saved in the last 600ms (avatar
  // upload, last move, coin claim) silently dies with the page — the
  // setTimeout never fires, the writeSave never goes out.
  //
  // beforeunload (desktop refresh / tab close) + pagehide (mobile +
  // bfcache) covers every unload path browsers expose. The Firestore
  // SDK's pending REST write usually completes during unload because
  // browsers keep small in-flight requests alive past the handler.
  useEffect(() => {
    const flush = () => {
      if (!writeTimer.current) return;
      clearTimeout(writeTimer.current);
      writeTimer.current = null;
      const uid = writingUid.current;
      if (!uid || !loaded.current) return;
      writeSave(uid, latest.current).catch(() => { /* unload — best effort */ });
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  return { save, setSave, loading };
}
