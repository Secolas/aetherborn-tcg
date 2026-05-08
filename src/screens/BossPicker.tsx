import { BOSSES, type BossDef } from '../data/bosses';
import { ELEMENTS } from '../data/elements';
import { ElementGlyph } from '../components/ElementGlyph';
import { iconBtn, PALETTE } from '../components/styles';

interface Props {
  defeatedIds: string[];
  onPick: (boss: BossDef) => void;
  onBack: () => void;
}

export function BossPicker({ defeatedIds, onPick, onBack }: Props) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
        linear-gradient(180deg, #ffe8d6 0%, #ffd4b3 60%, #ffbe9c 100%)
      `,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '52px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Pick a fight</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            {defeatedIds.length} of {BOSSES.length} defeated
          </div>
        </div>
      </div>

      <div style={{
        flex: 1, padding: '8px 16px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }} className="no-scrollbar">
        {BOSSES.map(boss => (
          <BossCard
            key={boss.id}
            boss={boss}
            defeated={defeatedIds.includes(boss.id)}
            onClick={() => onPick(boss)}
          />
        ))}
      </div>
    </div>
  );
}

function BossCard({ boss, defeated, onClick }: { boss: BossDef; defeated: boolean; onClick: () => void }) {
  const e = ELEMENTS[boss.themeId];
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: '#fff',
        border: 'none',
        borderRadius: 18,
        padding: 0,
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(58, 46, 42, .12), 0 1.5px 0 rgba(58, 46, 42, .06)',
        overflow: 'hidden',
        textAlign: 'left',
        fontFamily: 'inherit',
        position: 'relative',
        transition: 'transform .12s, box-shadow .12s',
      }}
      onPointerDown={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(2px) scale(0.99)'; }}
      onPointerUp={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
      onPointerLeave={(ev) => { (ev.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
    >
      {/* Banner — themed gradient with avatar */}
      <div style={{
        height: 90,
        background: `linear-gradient(135deg, ${e.deep} 0%, ${e.color} 100%)`,
        position: 'relative',
        display: 'flex', alignItems: 'center', padding: '0 18px',
        gap: 14,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: '#fff',
          padding: 3,
          display: 'grid', placeItems: 'center',
          flex: '0 0 auto',
          boxShadow: '0 4px 12px rgba(0,0,0,.18)',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: `linear-gradient(160deg, ${e.deep} 0%, ${e.color} 100%)`,
            display: 'grid', placeItems: 'center',
            fontSize: 26, fontWeight: 700,
            color: '#fff',
            fontFamily: '"Fredoka", system-ui',
          }}>{boss.avatar}</div>
        </div>
        <div style={{ flex: 1, color: '#fff' }}>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.05 }}>{boss.name}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2, fontStyle: 'italic' }}>
            {boss.subtitle}
          </div>
        </div>
        <ElementGlyph el={boss.themeId} size={32} />
        {defeated && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: '#ffd166', color: '#5a3a0e',
            padding: '2px 8px', borderRadius: 10,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>✓ defeated</div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px 16px' }}>
        <div style={{ fontSize: 13, color: PALETTE.text, fontStyle: 'italic', marginBottom: 8 }}>
          “{boss.intro}”
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: PALETTE.textMid }}>
            Plays a <strong style={{ color: e.color }}>{e.name}</strong> deck
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: defeated ? PALETTE.textLight : '#e85d3c',
          }}>
            {defeated ? `+${75} coins` : `+${boss.rewardCoins} bonus`}
          </div>
        </div>
      </div>
    </button>
  );
}
