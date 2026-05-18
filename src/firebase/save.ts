import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';
import type { SaveData } from '../game/types';

/** Per-user save document path. One doc per UID; merged on write so
 *  partial updates don't clobber unrelated fields. */
function saveDocRef(uid: string) {
  if (!db) throw new Error('Firestore not configured');
  return doc(db, 'users', uid, 'state', 'save');
}

export async function loadSave(uid: string): Promise<SaveData | null> {
  if (!db) return null;
  const snap = await getDoc(saveDocRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as SaveData;
}

export async function writeSave(uid: string, save: SaveData): Promise<void> {
  if (!db) return;
  await setDoc(saveDocRef(uid), save, { merge: false });
}
