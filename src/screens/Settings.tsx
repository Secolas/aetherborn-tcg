import { ArrowLeft, Volume2, VolumeX, Music } from 'lucide-react';
import { PALETTE } from '../components/styles';
import { playSfx } from '../audio/sfx';
import type { Settings } from '../state/settings';

/**
 * Settings — minimal screen, same chrome as Home / Daily / Cosmetics.
 * Scoped inline stylesheet under `.settings-container`, container
 * queries for the desktop max-width, Fredoka + app PALETTE, no
 * parallel design tokens.
 */
interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, onChange, onBack }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="settings-container">
      <SettingsStyles />

      <div className="settings">
        {/* Topbar */}
        <div className="settings-topbar">
          <div className="left-tools">
            <button className="icon-btn" aria-label="Back" onClick={onBack}>
              <ArrowLeft size={16} strokeWidth={2.2} />
            </button>
          </div>
          <div className="crest">
            <div className="vol">Preferences</div>
            <div className="title">Settings</div>
          </div>
          <div className="right-tools" />
        </div>

        {/* Audio section */}
        <header className="settings-sec">
          <div className="settings-sec-l">
            <div className="settings-sec-eyebrow">01 · Audio</div>
            <div className="settings-sec-title">Sound &amp; music</div>
          </div>
          <div className="settings-sec-r">
            Heard during matches and menu interactions.
          </div>
        </header>

        <div className="settings-card">
          <SliderRow
            icon={settings.sfxVolume > 0 ? <Volume2 size={18} strokeWidth={2.2} /> : <VolumeX size={18} strokeWidth={2.2} />}
            label="Sound effects"
            value={settings.sfxVolume}
            onChange={(v) => {
              set('sfxVolume', v);
              if (v > 0) playSfx('tap', v);
            }}
          />
          <div className="settings-divider" />
          <SliderRow
            icon={<Music size={18} strokeWidth={2.2} />}
            label="Music"
            value={settings.bgmVolume}
            onChange={(v) => set('bgmVolume', v)}
            hint="Reserved for future updates"
          />
        </div>
      </div>
    </div>
  );
}

function SliderRow({ icon, label, value, onChange, hint }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="slider-row">
      <div className="slider-head">
        <span className="slider-ico">{icon}</span>
        <span className="slider-lbl">{label}</span>
        <span className="slider-val">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range" min={0} max={1} step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} volume`}
        className="slider-input"
      />
      {hint && <div className="slider-hint">{hint}</div>}
    </div>
  );
}

// ─── Scoped stylesheet ──────────────────────────────────────────────

function SettingsStyles() {
  return (
    <style>{`
      .settings-container {
        container-type: inline-size;
        width: 100%; height: 100%;
        overflow-y: auto;
        background:
          radial-gradient(ellipse 90% 60% at 50% -10%, #ffd1b3, transparent 60%),
          radial-gradient(ellipse 80% 60% at 0% 110%, #fff0d6, transparent 60%),
          #fef8f0;
        color: ${PALETTE.text};
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
      }
      .settings {
        padding: 56px 16px 32px;
        display: flex; flex-direction: column;
        gap: 18px;
      }
      @container (min-width: 1024px) {
        .settings { max-width: 720px; margin: 0 auto; padding: 28px 32px 40px; gap: 24px; }
      }

      /* Topbar */
      .settings .settings-topbar {
        display: grid; grid-template-columns: 1fr auto 1fr;
        align-items: center; gap: 12px;
      }
      .settings .left-tools, .settings .right-tools {
        display: flex; align-items: center; gap: 8px;
      }
      .settings .left-tools  { justify-self: start; }
      .settings .right-tools { justify-self: end; }
      .settings .icon-btn {
        width: 38px; height: 38px; border-radius: 50%;
        background: #fff; border: 1.5px solid ${PALETTE.border};
        box-shadow: 0 2px 6px rgba(58,46,42,.08);
        cursor: pointer; padding: 0;
        display: grid; place-items: center;
        color: ${PALETTE.text};
        transition: transform .12s;
      }
      .settings .icon-btn:hover { transform: translateY(-1px); }
      .settings .crest { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .settings .crest .vol {
        font-size: 9px; font-weight: 800; letter-spacing: 0.22em;
        color: ${PALETTE.textLight}; text-transform: uppercase;
      }
      .settings .crest .title {
        font-size: 20px; font-weight: 700; line-height: 1;
      }

      /* Section header */
      .settings .settings-sec {
        display: flex; justify-content: space-between; align-items: flex-end;
        gap: 12px; padding-bottom: 10px;
        border-bottom: 1px solid rgba(58,46,42,.22);
        flex-wrap: wrap;
      }
      .settings .settings-sec-eyebrow {
        font-size: 10px; font-weight: 800; letter-spacing: 0.22em;
        text-transform: uppercase; color: ${PALETTE.textLight};
      }
      .settings .settings-sec-title {
        font-size: 22px; font-weight: 800; letter-spacing: -0.01em;
        margin-top: 2px;
      }
      @container (min-width: 720px) {
        .settings .settings-sec-title { font-size: 26px; }
      }
      .settings .settings-sec-r {
        font-size: 12px; font-style: italic; color: ${PALETTE.textMid};
        max-width: 28ch; text-align: right;
      }

      /* Card */
      .settings .settings-card {
        background: #fff;
        border: 1.5px solid ${PALETTE.border};
        border-radius: 16px;
        padding: 14px 16px;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        display: flex; flex-direction: column; gap: 12px;
      }
      .settings .settings-divider {
        height: 1px; background: ${PALETTE.border};
        margin: 4px -4px;
      }

      /* Slider row */
      .settings .slider-row {
        display: flex; flex-direction: column; gap: 8px;
      }
      .settings .slider-head {
        display: flex; align-items: center; gap: 10px;
      }
      .settings .slider-ico {
        width: 36px; height: 36px; border-radius: 12px;
        background: #fff7e6; color: ${PALETTE.accentDeep};
        display: grid; place-items: center;
        flex: 0 0 auto;
      }
      .settings .slider-lbl {
        flex: 1; font-size: 14px; font-weight: 700;
        color: ${PALETTE.text};
      }
      .settings .slider-val {
        font-family: inherit; font-variant-numeric: tabular-nums;
        font-size: 12px; font-weight: 800;
        color: ${PALETTE.textMid};
        min-width: 36px; text-align: right;
      }
      .settings .slider-input {
        width: 100%; accent-color: ${PALETTE.accent};
        cursor: pointer;
        height: 24px;
      }
      .settings .slider-hint {
        font-size: 11px; color: ${PALETTE.textLight};
        font-style: italic;
        padding-left: 46px;
      }

      @media (prefers-reduced-motion: reduce) {
        .settings-container, .settings-container * {
          transition: none !important;
        }
      }
    `}</style>
  );
}
