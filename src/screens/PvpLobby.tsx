import { useState } from 'react';
import { createRoom, joinRoomByCode } from '../firebase/pvp';
import { isDataUriPhoto, uploadPlayerAvatar } from '../firebase/photos';
import type { CollectionCard } from '../game/types';
import { useAuth } from '../firebase/auth';

interface Props {
  collection: CollectionCard[];
  /** Optional avatar URL (or legacy data URI) for the player. Passed
   *  along so the opponent's match view can show this player's portrait.
   *  If a data URI sneaks in, the lobby uploads it to Storage before
   *  writing the room doc — Firestore caps a single field at 1 MB and a
   *  raw avatar data URI easily exceeds that. */
  playerAvatar?: string;
  onEnterRoom: (roomId: string) => void;
  onBack: () => void;
  /** Called when the lobby migrates a legacy data-URI avatar up to
   *  Storage, so the parent can persist the resulting URL in save and
   *  future joins skip the upload. */
  onAvatarMigrated?: (url: string) => void;
}

export function PvpLobby({ collection, playerAvatar, onEnterRoom, onBack, onAvatarMigrated }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const playable = collection.filter(c => !!c.photo);
  const ready = playable.length >= 6;
  const name = user?.displayName || user?.email?.split('@')[0] || 'Player';

  // Avatars are persisted in save as either a Storage download URL
  // (small) or a legacy base64 data URI (huge — can be >1 MB). Firestore
  // rejects a single field over ~1 MB, so any data URI must be pushed up
  // to Storage and swapped for its URL before we write the room doc.
  const resolveAvatarUrl = async (): Promise<string | undefined> => {
    if (!user || !playerAvatar) return undefined;
    if (!isDataUriPhoto(playerAvatar)) return playerAvatar;
    const url = await uploadPlayerAvatar(user.uid, playerAvatar);
    onAvatarMigrated?.(url);
    return url;
  };

  const onCreate = async () => {
    if (!user) return;
    setBusy(true); setErr(null);
    try {
      const avatarUrl = await resolveAvatarUrl();
      const { id, code } = await createRoom(user.uid, name, collection, avatarUrl);
      setCreatedCode(code);
      onEnterRoom(id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    if (!user) return;
    if (!code.trim()) { setErr('Enter a room code.'); return; }
    setBusy(true); setErr(null);
    try {
      const avatarUrl = await resolveAvatarUrl();
      const id = await joinRoomByCode(code, user.uid, name, collection, avatarUrl);
      onEnterRoom(id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: 'radial-gradient(ellipse at 50% 0%, #1c2244 0%, #0a0c1c 70%)',
      color: '#fff', padding: '24px 22px',
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={btnGhost}>← Back</button>
        <h2 style={{ margin: 0, fontFamily: 'Fredoka, sans-serif', fontSize: 22 }}>Play Online</h2>
      </header>

      <div style={card}>
        <div style={sectionTitle}>Create Room</div>
        <p style={hint}>
          Generate a 5-letter code and share it with a friend. The first
          player to enter the code joins the room and starts the match.
        </p>
        <button onClick={onCreate} disabled={!ready || busy} style={btnPrimary(!ready || busy)}>
          {busy ? 'Creating…' : 'Create Room'}
        </button>
        {createdCode && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#f4d04a' }}>
            Room code: <strong style={{ letterSpacing: 4 }}>{createdCode}</strong>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={sectionTitle}>Join Room</div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ROOM CODE"
          maxLength={5}
          style={{
            width: '100%', padding: '12px 14px', marginTop: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10,
            color: '#fff', fontSize: 22, letterSpacing: 8, textAlign: 'center',
            fontFamily: 'Fredoka, monospace',
          }}
        />
        <button onClick={onJoin} disabled={!ready || busy || !code} style={{ ...btnPrimary(!ready || busy || !code), marginTop: 10 }}>
          {busy ? 'Joining…' : 'Join'}
        </button>
      </div>

      {!ready && (
        <div style={{ ...card, background: 'rgba(217, 102, 88, 0.12)', borderColor: 'rgba(217, 102, 88, 0.35)' }}>
          You need at least 6 photographed cards to play online. You have <strong>{playable.length}</strong>.
        </div>
      )}

      {err && (
        <div style={{ ...card, background: 'rgba(217, 102, 88, 0.18)', borderColor: 'rgba(217, 102, 88, 0.45)' }}>
          {err}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16, padding: 16,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 13, letterSpacing: 2, color: '#f4d04a',
  textTransform: 'uppercase', marginBottom: 6,
};
const hint: React.CSSProperties = {
  margin: '4px 0 12px', color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 1.5,
};
const btnGhost: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 13,
};
function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    padding: '11px 14px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, #f4d04a, #f49a4a)',
    color: '#2a1a06', fontWeight: 700, fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1, width: '100%',
  };
}
