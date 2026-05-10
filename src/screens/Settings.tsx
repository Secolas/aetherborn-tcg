import { ArrowLeft, Volume2, VolumeX, Music, Zap, Sparkles } from 'lucide-react';
import { iconBtn, PALETTE } from '../components/styles';
import { playSfx } from '../audio/sfx';
import type { Settings } from '../state/settings';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, onChange, onBack }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

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
        <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Settings</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2 }}>
            Audio &amp; motion preferences
          </div>
        </div>
      </div>

      <div style={{
        flex: 1, padding: '8px 16px 24px',
        display: 'flex', flexDirection: 'column', gap: 12,
        overflowY: 'auto',
      }} className="no-scrollbar">

        <Section title="Audio">
          <SliderRow
            icon={settings.sfxVolume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
            label="Sound effects"
            value={settings.sfxVolume}
            onChange={(v) => {
              set('sfxVolume', v);
              if (v > 0) playSfx('tap', v);
            }}
          />
          <SliderRow
            icon={<Music size={18} />}
            label="Music"
            value={settings.bgmVolume}
            onChange={(v) => set('bgmVolume', v)}
            hint="Reserved for future updates"
          />
        </Section>

        <Section title="Motion">
          <ToggleRow
            icon={<Sparkles size={18} />}
            label="Reduced motion"
            hint="Replaces flashy animations with gentle fades"
            value={settings.reducedMotion}
            onChange={(v) => set('reducedMotion', v)}
          />
          <div style={{ fontSize: 11, color: PALETTE.textMid, padding: '4px 4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={12} /> Match speed
          </div>
          <SegmentRow
            options={[
              { v: 1, label: 'Normal' },
              { v: 1.5, label: 'Fast' },
              { v: 2, label: 'Very fast' },
            ]}
            value={settings.animSpeed}
            onChange={(v) => set('animSpeed', v as 1 | 1.5 | 2)}
          />
          <div style={{ fontSize: 10, color: PALETTE.textLight, padding: '0 4px' }}>
            Combat, AI thinking, and turn banners scale down by this factor.
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 18,
      padding: '14px 14px 16px',
      boxShadow: '0 4px 14px rgba(58,46,42,.08)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: PALETTE.textMid, fontWeight: 600, paddingLeft: 4 }}>{title}</div>
      {children}
    </div>
  );
}

function SliderRow({ icon, label, value, onChange, hint }: {
  icon: React.ReactNode; label: string; value: number;
  onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ color: PALETTE.textMid }}>{icon}</div>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: PALETTE.textMid, fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>
          {Math.round(value * 100)}%
        </div>
      </div>
      <input
        type="range" min={0} max={1} step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: PALETTE.accent }}
      />
      {hint && <div style={{ fontSize: 10, color: PALETTE.textLight, paddingLeft: 28 }}>{hint}</div>}
    </div>
  );
}

function ToggleRow({ icon, label, hint, value, onChange }: {
  icon: React.ReactNode; label: string; hint?: string;
  value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: 6,
        background: 'transparent', border: 'none',
        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: PALETTE.text,
      }}
    >
      <div style={{ color: PALETTE.textMid }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: PALETTE.textLight, marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{
        width: 42, height: 24, borderRadius: 12,
        background: value ? PALETTE.accent : '#ddd1c5',
        position: 'relative', transition: 'background .15s',
        flex: '0 0 auto',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 20 : 2,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1.5px 4px rgba(0,0,0,.2)',
          transition: 'left .15s',
        }} />
      </div>
    </button>
  );
}

function SegmentRow<T extends number>({ options, value, onChange }: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4,
      background: '#f5ede2', borderRadius: 12,
    }}>
      {options.map(o => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              flex: 1,
              padding: '8px 0',
              background: active ? '#fff' : 'transparent',
              color: active ? PALETTE.text : PALETTE.textMid,
              border: 'none', borderRadius: 10,
              fontFamily: 'inherit', fontWeight: 600, fontSize: 12,
              cursor: 'pointer',
              boxShadow: active ? '0 2px 6px rgba(58,46,42,.10)' : 'none',
              transition: 'background .15s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
