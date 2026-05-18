import { ArrowLeft, Users, Flag, ChevronRight, Lock } from 'lucide-react';
import { iconBtn, PALETTE } from '../components/styles';

interface Props {
  /** When false, both options route into the onboarding chain instead
   *  of actually launching. Mirrors the gating used on the home nav so
   *  the player can't jump straight into a battle before finishing the
   *  starter flow. */
  unlocked: boolean;
  onPickPeople: () => void;
  onPickCampaign: () => void;
  onBack: () => void;
}

/**
 * Battle hub. Replaces the two separate "Online PVP" and "Campaign"
 * tiles on the home nav with a single Battle destination that branches
 * into either:
 *
 *   - People   → online PVP (PvpLobby)
 *   - Campaign → solo "Memory Lane" arcs (Campaign)
 *
 * Same warm-paper visual language as the rest of the app.
 */
export function Battle({ unlocked, onPickPeople, onPickCampaign, onBack }: Props) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)',
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '52px 20px 8px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={iconBtn} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Battle</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            Pick your opponent
          </div>
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '8px 20px 24px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <BattleOption
          label="People"
          description="Play head-to-head with a friend over the internet"
          icon={<Users size={26} strokeWidth={2.2} />}
          locked={!unlocked}
          onClick={onPickPeople}
        />
        <BattleOption
          label="Campaign"
          description="Solo your way down Memory Lane, one boss at a time"
          icon={<Flag size={26} strokeWidth={2.2} />}
          locked={!unlocked}
          onClick={onPickCampaign}
        />
      </div>
    </div>
  );
}

function BattleOption({
  label, description, icon, locked, onClick,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '18px 18px',
        background: '#fff',
        border: `1.5px solid ${PALETTE.border}`,
        borderRadius: 18,
        boxShadow: locked ? 'none' : '0 4px 12px rgba(58,46,42,.08)',
        color: PALETTE.text,
        fontFamily: 'inherit',
        cursor: locked ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: locked ? 0.55 : 1,
        transition: 'transform .12s, box-shadow .15s',
      }}
      onMouseEnter={(e) => {
        if (locked) return;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(58,46,42,.12)';
      }}
      onMouseLeave={(e) => {
        if (locked) return;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(58,46,42,.08)';
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        display: 'grid', placeItems: 'center',
        background: `linear-gradient(135deg, #ffa07a, ${PALETTE.accent})`,
        color: '#fff',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
        flex: '0 0 auto',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: 12, color: PALETTE.textMid, marginTop: 2 }}>
          {description}
        </div>
      </div>
      {locked
        ? <Lock size={18} strokeWidth={2.4} color={PALETTE.textMid} />
        : <ChevronRight size={20} strokeWidth={2.4} color={PALETTE.textMid} />}
    </button>
  );
}
