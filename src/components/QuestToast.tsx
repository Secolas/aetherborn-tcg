import { Check, Coins } from 'lucide-react';
import type { Quest } from '../game/quests';

/**
 * Small "quest complete" pill that drops from the top of the screen and
 * fades out. Animation is a single `toastDrop` keyframe in index.css —
 * 2.6s lifecycle, after which App.tsx removes it from state.
 */
export function QuestToast({ quest }: { quest: Quest }) {
  return (
    <div style={{
      position: 'relative', left: '50%',
      animation: 'toastDrop 2.6s ease-out both',
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '10px 16px 10px 12px',
      borderRadius: 999,
      background: 'linear-gradient(135deg, #ffd166 0%, #ff9f1c 100%)',
      color: '#3a2e2a',
      boxShadow: '0 8px 22px rgba(238, 90, 82, .35)',
      border: '2px solid rgba(255,255,255,.65)',
      pointerEvents: 'none',
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: '#fff', color: '#06d6a0',
        display: 'grid', placeItems: 'center',
      }}>
        <Check size={16} strokeWidth={3} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
          Quest Complete
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>{quest.title}</div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 12, fontWeight: 700, marginLeft: 4,
      }}>
        <Coins size={13} fill="#fff" color="#3a2e2a" strokeWidth={2.2} />
        +{quest.rewardCoins}
      </div>
    </div>
  );
}
