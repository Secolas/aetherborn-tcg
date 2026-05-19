import { useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Hash, Lock, Plus, History as HistoryIcon, Trophy } from 'lucide-react';
import { createRoom, joinRoomByCode } from '../firebase/pvp';
import { isDataUriPhoto, uploadPlayerAvatar } from '../firebase/photos';
import type { CollectionCard, PvpHistoryEntry } from '../game/types';
import { useAuth } from '../firebase/auth';
import { iconBtn, PALETTE, btnPrimary as btnPrimaryStyle } from '../components/styles';
import {
  BRAND, BRAND_LIGHT, BRAND_DEEP, DAMAGE, OWNED, PREMIUM, SELECTION,
  BG_WARM, TEXT_MID,
} from '../design/tokens';

interface Props {
  collection: CollectionCard[];
  /** Optional avatar URL (or legacy data URI) for the player. Passed
   *  along so the opponent's match view can show this player's portrait.
   *  If a data URI sneaks in, the lobby uploads it to Storage before
   *  writing the room doc — Firestore caps a single field at 1 MB and a
   *  raw avatar data URI easily exceeds that. */
  playerAvatar?: string;
  /** Most-recent-first PVP match history from save. Drives the
   *  "Recent matches" panel on the choice view + the W-L summary chip
   *  at the top. */
  history?: PvpHistoryEntry[];
  onEnterRoom: (roomId: string) => void;
  onBack: () => void;
  /** Called when the lobby migrates a legacy data-URI avatar up to
   *  Storage, so the parent can persist the resulting URL in save and
   *  future joins skip the upload. */
  onAvatarMigrated?: (url: string) => void;
}

type View = 'choice' | 'join';

export function PvpLobby({ collection, playerAvatar, history = [], onEnterRoom, onBack, onAvatarMigrated }: Props) {
  const { user } = useAuth();
  const [view, setView] = useState<View>('choice');
  const [code, setCode] = useState<string[]>(['', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const playable = collection.filter(c => !!c.photo);
  const ready = playable.length >= 6;
  const name = user?.displayName || user?.email?.split('@')[0] || 'Player';

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
      const { id } = await createRoom(user.uid, name, collection, avatarUrl);
      onEnterRoom(id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    if (!user) return;
    const joined = code.join('');
    if (joined.length < 5) { setErr('Enter the full 5-letter code.'); return; }
    setBusy(true); setErr(null);
    try {
      const avatarUrl = await resolveAvatarUrl();
      const id = await joinRoomByCode(joined, user.uid, name, collection, avatarUrl);
      onEnterRoom(id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const cleaned = (v || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
    setCode(c => { const n = [...c]; n[i] = cleaned; return n; });
    if (cleaned && inputRefs.current[i + 1]) inputRefs.current[i + 1]?.focus();
  };
  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && inputRefs.current[i - 1]) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const codeReady = code.every(c => !!c) && ready;
  const headerTitle = view === 'join' ? 'Join Room' : 'Play Online';
  const headerSub = view === 'join'
    ? 'Enter the code your friend sent you'
    : 'Battle a friend over the internet';
  const handleHeaderBack = () => {
    if (view === 'choice') onBack();
    else { setView('choice'); setErr(null); }
  };

  return (
    <div style={screenWrap}>
      <div style={headerWrap}>
        <button onClick={handleHeaderBack} style={iconBtn} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{headerTitle}</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>{headerSub}</div>
        </div>
      </div>

      <div style={bodyWrap}>
        {!ready && <GateBanner playable={playable.length} />}

        {view === 'choice' && (
          <>
            {history.length > 0 && <RecordSummary history={history} />}
            <RowCard
              label="Create Room"
              description="Generate a 5-letter code and share it with a friend"
              icon={<Plus size={26} strokeWidth={2.2} />}
              hue="coral"
              locked={!ready}
              busy={busy}
              onClick={onCreate}
            />
            <RowCard
              label="Join Room"
              description="Enter the code your friend just sent you"
              icon={<Hash size={26} strokeWidth={2.2} />}
              hue="gold"
              locked={!ready}
              onClick={() => { setErr(null); setView('join'); }}
            />
            {err && <ErrorChip message={err} />}
            {history.length > 0 && <HistoryList entries={history} />}
          </>
        )}

        {view === 'join' && (
          <div style={joinCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <IconTile hue="gold"><Hash size={24} strokeWidth={2.2} /></IconTile>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Enter Code</div>
                <div style={{ fontSize: 12, color: PALETTE.textMid, marginTop: 2 }}>
                  Five letters, all caps
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 14 }}>
              {code.map((c, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  value={c}
                  onChange={e => setDigit(i, e.target.value)}
                  onKeyDown={e => onKeyDown(i, e)}
                  maxLength={1}
                  disabled={!ready || busy}
                  inputMode="text"
                  autoCapitalize="characters"
                  aria-label={`Code letter ${i + 1}`}
                  style={{
                    flex: 1, aspectRatio: '1 / 1', minWidth: 0,
                    background: BG_WARM,
                    border: `1.5px solid ${c ? BRAND_LIGHT : PALETTE.border}`,
                    borderRadius: 12, textAlign: 'center',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 26,
                    color: PALETTE.text, outline: 'none', padding: 0,
                    transition: 'border-color .15s, background .15s',
                  }}
                />
              ))}
            </div>

            <button
              onClick={onJoin}
              disabled={!codeReady || busy}
              style={fullPrimary(!codeReady || busy)}
            >
              {busy ? 'Joining…' : 'Join Match'}
            </button>

            {err && <div style={{ marginTop: 12 }}><ErrorChip message={err} /></div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Sub-components -------------------- */

function GateBanner({ playable }: { playable: number }) {
  const remaining = Math.max(0, 6 - playable);
  return (
    <div style={{
      background: '#fff3ec',
      border: `1.5px solid ${BRAND_LIGHT}66`,
      borderRadius: 16,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: BRAND_LIGHT, color: '#fff',
        display: 'grid', placeItems: 'center', flex: '0 0 auto',
      }}>
        <Lock size={16} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.4, color: PALETTE.text }}>
        Photograph <b style={{ color: BRAND_DEEP }}>
          {remaining} more card{remaining === 1 ? '' : 's'}
        </b> to unlock online play.{' '}
        <span style={{ color: TEXT_MID }}>You have {playable} of 6.</span>
      </div>
    </div>
  );
}

function IconTile({ children, hue }: { children: React.ReactNode; hue: 'coral' | 'gold' | 'mint' }) {
  const grad =
    hue === 'coral' ? `linear-gradient(135deg, #ffa07a, ${BRAND_LIGHT})` :
    hue === 'gold'  ? `linear-gradient(135deg, ${PREMIUM}, ${SELECTION})` :
                      `linear-gradient(135deg, #5be3b3, #06d6a0)`;
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 14,
      display: 'grid', placeItems: 'center',
      background: grad, color: '#fff',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
      flex: '0 0 auto',
    }}>{children}</div>
  );
}

function RowCard({
  label, description, icon, hue, locked, busy, onClick,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  hue: 'coral' | 'gold';
  locked: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  const disabled = locked || !!busy;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '18px 18px',
        background: '#fff',
        border: `1.5px solid ${PALETTE.border}`,
        borderRadius: 18,
        boxShadow: disabled ? 'none' : '0 4px 12px rgba(58,46,42,.08)',
        color: PALETTE.text,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.55 : 1,
        transition: 'transform .12s, box-shadow .15s',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(58,46,42,.12)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(58,46,42,.08)';
      }}
    >
      <IconTile hue={hue}>{icon}</IconTile>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: 12, color: PALETTE.textMid, marginTop: 2 }}>{description}</div>
      </div>
      {locked
        ? <Lock size={18} strokeWidth={2.4} color={PALETTE.textMid} />
        : <ChevronRight size={20} strokeWidth={2.4} color={PALETTE.textMid} />}
    </button>
  );
}

function RecordSummary({ history }: { history: PvpHistoryEntry[] }) {
  const wins = history.filter(h => h.outcome === 'win').length;
  const losses = history.filter(h => h.outcome === 'loss').length;
  const draws = history.filter(h => h.outcome === 'draw').length;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: '#fff',
      border: `1.5px solid ${PALETTE.border}`,
      borderRadius: 16,
      padding: '12px 14px',
      boxShadow: '0 2px 6px rgba(58,46,42,.06)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        background: `linear-gradient(135deg, ${PREMIUM}, ${SELECTION})`,
        color: '#fff',
        display: 'grid', placeItems: 'center', flex: '0 0 auto',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
      }}>
        <Trophy size={18} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: TEXT_MID }}>
          Your record
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <RecordBadge n={wins} label="W" color={OWNED} />
        <RecordBadge n={losses} label="L" color={DAMAGE} />
        {draws > 0 && <RecordBadge n={draws} label="D" color={TEXT_MID} />}
      </div>
    </div>
  );
}

function RecordBadge({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 3,
      fontFamily: 'inherit',
      fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{ fontSize: 18, fontWeight: 800, color }}>{n}</span>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: TEXT_MID }}>{label}</span>
    </span>
  );
}

function HistoryList({ entries }: { entries: PvpHistoryEntry[] }) {
  const display = entries.slice(0, 8);
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${PALETTE.border}`,
      borderRadius: 16,
      padding: 4,
      boxShadow: '0 2px 6px rgba(58,46,42,.06)',
      marginTop: 4,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px 4px',
      }}>
        <HistoryIcon size={14} color={TEXT_MID} strokeWidth={2.4} />
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: TEXT_MID,
        }}>Recent matches</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {display.map((e, i) => (
          <HistoryRow key={`${e.at}-${i}`} entry={e} divider={i < display.length - 1} />
        ))}
      </div>
    </div>
  );
}

function HistoryRow({ entry, divider }: { entry: PvpHistoryEntry; divider: boolean }) {
  const initial = entry.opponentName.slice(0, 1).toUpperCase();
  const isWin = entry.outcome === 'win';
  const isLoss = entry.outcome === 'loss';
  const tag = isWin ? 'WIN' : isLoss ? 'LOSS' : 'DRAW';
  const tagColor = isWin ? OWNED : isLoss ? DAMAGE : TEXT_MID;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      borderBottom: divider ? `1px solid ${PALETTE.border}` : 'none',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        backgroundImage: entry.opponentAvatar
          ? `url(${entry.opponentAvatar})`
          : `linear-gradient(135deg, #ffa07a, ${BRAND_LIGHT})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'grid', placeItems: 'center',
        color: '#fff', fontWeight: 700, fontSize: 16,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
        flex: '0 0 auto',
      }}>
        {entry.opponentAvatar ? '' : initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 800, color: PALETTE.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{entry.opponentName}</div>
        <div style={{ fontSize: 11, color: TEXT_MID, marginTop: 1 }}>
          {formatRelativeTime(entry.at)}
          {entry.byForfeit && <span style={{ marginLeft: 6 }}>· opponent left</span>}
        </div>
      </div>
      <div style={{
        flex: '0 0 auto',
        padding: '3px 8px',
        borderRadius: 8,
        background: `${tagColor}1f`,
        color: tagColor,
        border: `1.5px solid ${tagColor}66`,
        fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
      }}>{tag}</div>
    </div>
  );
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ErrorChip({ message }: { message: string }) {
  return (
    <div style={{
      background: `${DAMAGE}1a`,
      border: `1.5px solid ${DAMAGE}59`,
      borderRadius: 12,
      padding: '10px 12px',
      fontSize: 12.5, color: DAMAGE, fontWeight: 600,
    }}>{message}</div>
  );
}

/* -------------------- Styles -------------------- */

const screenWrap: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column',
  background: 'linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)',
  color: PALETTE.text,
  fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
  overflow: 'hidden',
};

const headerWrap: React.CSSProperties = {
  padding: '52px 20px 8px',
  display: 'flex', alignItems: 'center', gap: 12,
};

const bodyWrap: React.CSSProperties = {
  flex: 1, overflowY: 'auto',
  padding: '8px 20px 24px',
  display: 'flex', flexDirection: 'column', gap: 12,
};

const joinCard: React.CSSProperties = {
  background: '#fff',
  border: `1.5px solid ${PALETTE.border}`,
  borderRadius: 18,
  padding: 16,
  boxShadow: '0 4px 12px rgba(58,46,42,.08)',
};

function fullPrimary(disabled: boolean): React.CSSProperties {
  return {
    ...btnPrimaryStyle,
    background: disabled
      ? '#e5d6c9'
      : `linear-gradient(180deg, #ffa07a 0%, ${BRAND_LIGHT} 60%, ${BRAND} 100%)`,
    boxShadow: disabled
      ? 'none'
      : '0 6px 18px rgba(255, 94, 60, .35), inset 0 1px 0 rgba(255,255,255,.4)',
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: '100%',
  };
}
