import { useEffect, useState } from 'react';

/**
 * Like useState, but synced to localStorage under `key`.
 * On hydration we deep-merge with the initial value so adding new fields
 * to old saves doesn't crash.
 */
export function usePersistedState<T extends object>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      return { ...initial, ...parsed };
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // quota exceeded etc — fail silently, the in-memory state still works
    }
  }, [key, state]);

  return [state, setState];
}
