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

  // Load on auth change.
  useEffect(() => {
    if (!user) {
      setSaveState(initial);
      latest.current = initial;
      writingUid.current = null;
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    writingUid.current = user.uid;
    (async () => {
      try {
        const loaded = await loadSave(user.uid);
        if (cancelled) return;
        const next = loaded ? { ...initial, ...loaded } : initial;
        setSaveState(next);
        latest.current = next;
      } catch {
        if (!cancelled) {
          setSaveState(initial);
          latest.current = initial;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const setSave = (next: SaveData | ((prev: SaveData) => SaveData)) => {
    setSaveState((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: SaveData) => SaveData)(prev) : next;
      latest.current = resolved;
      // Schedule a debounced write under the currently-authed uid only.
      if (writingUid.current) {
        if (writeTimer.current) clearTimeout(writeTimer.current);
        const uid = writingUid.current;
        writeTimer.current = setTimeout(() => {
          writeSave(uid, latest.current).catch(() => { /* swallow — retry on next change */ });
        }, 600);
      }
      return resolved;
    });
  };

  return { save, setSave, loading };
}
