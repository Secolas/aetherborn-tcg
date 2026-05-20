import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './config';
import type { CollectionCard } from '../game/types';

/**
 * Firebase Storage helpers for player-captured card photos.
 *
 * Photos live at `users/{uid}/photos/{cardUid}.jpg`. Each card's
 * `photo` field in the save document holds a download URL pointing
 * at one of these objects instead of an inline data URI.
 *
 * Two reasons we moved off inline data URIs:
 *   - Firestore caps a single document at 1 MB. A full collection of
 *     ~30 photo'd cards would blow past that.
 *   - The PVP room doc serialized both decks (24 cards × ~150 KB) into
 *     a single doc which couldn't even be created. Photos as URLs are
 *     ~150 bytes each, so the same doc drops to a few KB.
 */

/** Convert a base64 data URI (image/jpeg, image/png, image/webp) into
 *  a Blob suitable for uploadBytes. Throws on malformed input. */
function dataUriToBlob(dataUri: string): Blob {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUri);
  if (!match) throw new Error('Not a base64 data URI');
  const mime = match[1];
  const bin = atob(match[2]);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Downscale a data-URI image so the upload payload stays small.
 *
 *  Phone cameras hand us 3-12 MP JPEGs that are routinely 2-4 MB each.
 *  At the sizes Memoria actually renders cards + avatars, anything
 *  past ~800px on the longest side is wasted bytes — they only slow
 *  down the upload, eat the player's bandwidth, and bloat Storage.
 *
 *  The helper draws the source through a canvas at the requested
 *  longest-side cap, then re-encodes as JPEG at `quality`. JPEG is
 *  picked unconditionally even for PNG inputs because card photos and
 *  avatars are photographic content where JPEG compresses better than
 *  PNG for ~1/10 the bytes.
 *
 *  Returns the original data URI unchanged if anything goes wrong —
 *  the upload still works, it's just larger than ideal. */
async function downscaleDataUri(
  dataUri: string,
  maxEdge: number,
  quality = 0.85,
): Promise<string> {
  if (!isDataUriPhoto(dataUri)) return dataUri;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image load failed'));
      el.src = dataUri;
    });
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    // Source already small enough? Skip the round-trip through canvas
    // so we don't re-encode (and lose quality) for no reason.
    if (longest <= maxEdge) return dataUri;
    const scale = maxEdge / longest;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUri;
    // Higher-quality downscale than the browser default — important
    // because the source is often 6-12x larger than the target.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUri;
  }
}

/** True for any string that looks like a base64 data URI — used by
 *  the migration to decide whether a saved photo still needs to be
 *  pushed up to Storage. */
export function isDataUriPhoto(photo: string | null | undefined): boolean {
  return !!photo && photo.startsWith('data:');
}

/** Upload a captured photo (data URI) to Storage under the caller's
 *  user folder and return the public download URL. The URL is what
 *  gets persisted into `save.collection[].photo`.
 *
 *  Always overwrites any existing object at the same path — retaking a
 *  photo for a card simply replaces the previous bytes. */
export async function uploadCardPhoto(
  uid: string,
  cardUid: string,
  dataUri: string,
): Promise<string> {
  if (!storage) throw new Error('Firebase Storage not configured');
  if (!isDataUriPhoto(dataUri)) {
    // Already a URL (or null) — caller can use it as-is.
    return dataUri;
  }
  // Cards render at most ~480px wide on a desktop preview and far
  // smaller on the field, so 800px on the longest edge keeps room
  // for retina without paying for full-camera resolution.
  const compressed = await downscaleDataUri(dataUri, 800, 0.85);
  const blob = dataUriToBlob(compressed);
  const objectRef = ref(storage, `users/${uid}/photos/${cardUid}.jpg`);
  await uploadBytes(objectRef, blob, {
    contentType: blob.type || 'image/jpeg',
    // Cache aggressively at the CDN — photos for a given cardUid are
    // immutable until the player retakes (which uploads a fresh blob
    // and triggers a fresh download URL anyway).
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return await getDownloadURL(objectRef);
}

/** Upload the player's avatar (data URI) to Storage and return the
 *  download URL. Lives at `users/{uid}/avatar.jpg`; always overwritten
 *  so picking a new avatar replaces the bytes.
 *
 *  This is what keeps PVP room docs under Firestore's 1 MB per-field
 *  cap — a raw avatar data URI easily blows past that, but the
 *  resulting download URL is ~200 bytes. Pass-through if the input is
 *  already a URL. */
export async function uploadPlayerAvatar(
  uid: string,
  dataUri: string,
): Promise<string> {
  if (!storage) throw new Error('Firebase Storage not configured');
  if (!isDataUriPhoto(dataUri)) return dataUri;
  // Avatars render as a 40x40 circle on Home and 64x64 on the
  // match portrait, so 256px on the longest edge covers every
  // surface even on a 3x retina display. A 3MB camera JPEG drops
  // to ~25-40 KB here.
  const compressed = await downscaleDataUri(dataUri, 256, 0.88);
  const blob = dataUriToBlob(compressed);
  const objectRef = ref(storage, `users/${uid}/avatar.jpg`);
  await uploadBytes(objectRef, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return await getDownloadURL(objectRef);
}

/** Best-effort cleanup when the player clears a card's photo (retake
 *  flow). Failures are swallowed — the next overwrite handles the
 *  bytes regardless, and orphaned objects only cost a few cents per
 *  year if any sneak through. */
export async function deleteCardPhoto(uid: string, cardUid: string): Promise<void> {
  if (!storage) return;
  try {
    await deleteObject(ref(storage, `users/${uid}/photos/${cardUid}.jpg`));
  } catch {
    /* object missing or permission edge — fine */
  }
}

/** One-time migration: walks a collection, uploads every data-URI
 *  photo to Storage, and returns the rewritten collection with URLs
 *  in place of data URIs. Idempotent — re-running with an already-
 *  migrated collection is a no-op (no uploads, no rewrites).
 *
 *  Caller persists the returned collection back to the save. Failures
 *  on individual uploads leave the original data URI in place so the
 *  card stays functional offline; the migration will retry next boot. */
export async function migrateCollectionPhotos(
  uid: string,
  collection: CollectionCard[],
): Promise<{ collection: CollectionCard[]; migrated: number }> {
  let migrated = 0;
  const next = await Promise.all(collection.map(async (c) => {
    if (!isDataUriPhoto(c.photo)) return c;
    try {
      const url = await uploadCardPhoto(uid, c.uid, c.photo!);
      migrated++;
      return { ...c, photo: url };
    } catch {
      // Keep the data URI on failure — local rendering still works,
      // we just retry on next boot.
      return c;
    }
  }));
  return { collection: next, migrated };
}
