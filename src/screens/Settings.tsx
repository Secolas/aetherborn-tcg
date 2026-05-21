import { useState } from 'react';
import { ArrowLeft, Volume2, VolumeX, Music, Smile, RotateCcw, AlertTriangle, ChevronDown, BookOpen, Hand, Wand2, LinkIcon as Link2, Swords, Clock, Sparkles, Layers, GraduationCap } from 'lucide-react';
import { PALETTE } from '../components/styles';
import { DAMAGE } from '../design/tokens';
import { playSfx } from '../audio/sfx';
import { CardAnatomyDiagram, FieldAnatomyDiagram } from '../components/Anatomy';
import type { Settings } from '../state/settings';
import type { ReactNode } from 'react';

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
  /** Wipes the player's save and routes them back through the
   *  starter-pick flow. Skips the tutorial since they've already
   *  done it. Called from the Danger zone confirmation dialog. */
  onResetAccount?: () => void;
  /** Re-launches the scripted tutorial so a returning player can
   *  walk through the rules again without resetting their save. */
  onReplayTutorial?: () => void;
}

export function SettingsScreen({ settings, onChange, onBack, onResetAccount, onReplayTutorial }: Props) {
  const [resetOpen, setResetOpen] = useState(false);
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

        {/* Online section */}
        <header className="settings-sec">
          <div className="settings-sec-l">
            <div className="settings-sec-eyebrow">02 · Online</div>
            <div className="settings-sec-title">PVP preferences</div>
          </div>
          <div className="settings-sec-r">
            Controls behavior in real-time matches against other players.
          </div>
        </header>

        <div className="settings-card">
          <ToggleRow
            icon={<Smile size={18} strokeWidth={2.2} />}
            label="Hide opponent emotes"
            hint="Your own emotes still send normally."
            value={settings.hideOpponentEmotes}
            onChange={(v) => set('hideOpponentEmotes', v)}
          />
        </div>

        {/* Help — rules of the game, reusing the same numbered card
            and battlefield diagrams the tutorial uses, so a returning
            player has one place to re-check anything they forgot. */}
        <header className="settings-sec">
          <div className="settings-sec-l">
            <div className="settings-sec-eyebrow">03 · Help</div>
            <div className="settings-sec-title">How to play</div>
          </div>
          <div className="settings-sec-r">
            Rules, card anatomy and the match layout — same diagrams from the tutorial.
          </div>
        </header>

        <div className="settings-card help-card">
          {onReplayTutorial && (
            <>
              <button
                type="button"
                className="replay-btn"
                onClick={onReplayTutorial}
              >
                <span className="replay-ico"><GraduationCap size={16} strokeWidth={2.4} /></span>
                <span className="replay-lbl">Replay tutorial</span>
                <span className="replay-hint">Walk through the scripted match again.</span>
              </button>
              <div className="settings-divider" />
            </>
          )}
          <HelpRow
            icon={<Clock size={18} strokeWidth={2.2} />}
            title="Goal & turns"
            body={
              <>
                <p>Both players start with <strong>18 HP</strong>. Drop the opponent's HP to 0 within <strong>12 turns</strong>, or have more HP than them when the turn limit hits (ties count as a loss).</p>
                <p>Each turn flows: <strong>Draw</strong> (gain +1 max mana, draw 1) → <strong>Main Phase</strong> (summon creatures, cast spells) → <strong>Battle Phase</strong> (attack) → <strong>End Turn</strong>.</p>
                <p>You can only cast spells and summon creatures in the Main Phase, before you tap the swords icon to enter Battle.</p>
                <p>Mana starts at <strong>1</strong> and rises by +1 each turn up to a cap of <strong>7</strong>. Unused mana doesn't carry over.</p>
              </>
            }
          />
          <div className="settings-divider" />
          <HelpRow
            icon={<Layers size={18} strokeWidth={2.2} />}
            title="Hand & drawing"
            body={
              <>
                <p>You start with <strong>4 cards</strong> in hand and draw <strong>1 every turn</strong> (some abilities and Bonds draw extra).</p>
                <p>Hand size is capped at <strong>7</strong>. If your hand is full when you'd draw, the drawn card is skipped.</p>
                <p><strong>Fatigue</strong> — once your deck is empty, every draw deals damage to <em>you</em> instead: 1 the first time, 2 the next, 3 after that, and so on. Long games where neither side closes out tend to end on fatigue.</p>
                <p>Tap your portrait during a match to peek at your remaining deck and cemetery.</p>
              </>
            }
          />
          <div className="settings-divider" />
          <HelpRow
            icon={<Hand size={18} strokeWidth={2.2} />}
            title="Summoning creatures"
            body={
              <>
                <p>Drag a creature card onto an empty field slot and pay its mana cost. You have <strong>3 field slots</strong> — when they're full you can't summon more until one dies.</p>
                <p>A new creature <strong>sleeps</strong> the turn you summon it — it can't attack until next turn. Cards with <strong>Rush</strong> ignore this and swing the same turn.</p>
                <p>Creatures with <strong>Taunt</strong> force the opponent to attack them before your portrait.</p>
              </>
            }
          />
          <div className="settings-divider" />
          <HelpRow
            icon={<Wand2 size={18} strokeWidth={2.2} />}
            title="Casting spells"
            body={
              <>
                <p>Spells aren't creatures — drag them onto a target. They damage, heal, or buff once, then they're gone.</p>
                <p>Spells must be cast in <strong>Main Phase</strong>, before you tap Battle. Damage spells can target creatures or the opponent's portrait. Heals and buffs target friendlies.</p>
              </>
            }
          />
          <div className="settings-divider" />
          <HelpRow
            icon={<Link2 size={18} strokeWidth={2.2} />}
            title="Abilities & Bonds"
            body={
              <>
                <p>Read every card — many have <strong>on-play abilities</strong> (extra draw, damage, heal) that trigger as you summon them.</p>
                <p>Specific pairs of cards share a <strong>Bond</strong>: while both are on your field at the same time, an extra effect fires every turn (e.g. heal +2, +1 attack to friends).</p>
                <p>Tap any card in hand or on the field to read its full ability and Bond info.</p>
              </>
            }
          />
          <div className="settings-divider" />
          <HelpRow
            icon={<Swords size={18} strokeWidth={2.2} />}
            title="Attacking"
            body={
              <>
                <p>Tap the <strong>swords icon</strong> to enter Battle Phase. Drag any awake creature onto an opponent target.</p>
                <p>Attacking the opponent's portrait deals damage to their HP. Attacking a creature trades damage both ways — both take damage equal to the other's attack value.</p>
                <p>At 0 HP a creature dies and goes to the cemetery.</p>
              </>
            }
          />
          <div className="settings-divider" />
          <HelpRow
            icon={<Sparkles size={18} strokeWidth={2.2} />}
            title="Card rarity"
            body={
              <>
                <p>Every card belongs to one of four rarities, shown by the coloured chip on the card:</p>
                <p>
                  <strong style={{ color: '#9a958c' }}>Common</strong> — ~60% of pack pulls. The everyday backbone of a deck.<br />
                  <strong style={{ color: '#5a8fc4' }}>Rare</strong> — ~28%. Stronger stats or a useful keyword.<br />
                  <strong style={{ color: '#a45ec8' }}>Epic</strong> — ~10%. Heavier on-play abilities or board swings.<br />
                  <strong style={{ color: '#e0a93a' }}>Legendary</strong> — ~2%. Match-defining effects, often Bond pieces.
                </p>
                <p>Every pack guarantees at least one <strong>Rare or higher</strong>.</p>
              </>
            }
          />
          <div className="settings-divider" />
          <HelpRow
            icon={<BookOpen size={18} strokeWidth={2.2} />}
            title="Card anatomy · Creature"
            body={
              <div className="help-anatomy-wrap">
                <CardAnatomyDiagram cardId="fd-01" kind="creature" theme="light" />
              </div>
            }
          />
          <div className="settings-divider" />
          <HelpRow
            icon={<BookOpen size={18} strokeWidth={2.2} />}
            title="Card anatomy · Spell"
            body={
              <div className="help-anatomy-wrap">
                <CardAnatomyDiagram cardId="ani-16" kind="spell" theme="light" />
              </div>
            }
          />
          <div className="settings-divider" />
          <HelpRow
            icon={<BookOpen size={18} strokeWidth={2.2} />}
            title="Battle layout"
            body={
              <div className="help-anatomy-wrap">
                <FieldAnatomyDiagram theme="light" />
              </div>
            }
          />
        </div>

        {/* Danger zone — only mounted when the parent supplies a
            reset handler, so screens that embed Settings without
            owning the save (none today, but easy to add) don't
            expose the button by accident. */}
        {onResetAccount && (
          <>
            <header className="settings-sec">
              <div className="settings-sec-l">
                <div className="settings-sec-eyebrow">04 · Danger zone</div>
                <div className="settings-sec-title">Reset account</div>
              </div>
              <div className="settings-sec-r">
                Wipes your collection, decks, cosmetics, and PVP history. Tutorial stays done.
              </div>
            </header>

            <div className="settings-card">
              <button
                type="button"
                className="danger-btn"
                onClick={() => setResetOpen(true)}
              >
                <span className="danger-ico"><RotateCcw size={16} strokeWidth={2.4} /></span>
                <span className="danger-lbl">Reset my account</span>
              </button>
            </div>
          </>
        )}
      </div>

      {resetOpen && onResetAccount && (
        <ResetConfirmDialog
          onCancel={() => setResetOpen(false)}
          onConfirm={() => { setResetOpen(false); onResetAccount(); }}
        />
      )}
    </div>
  );
}

function ResetConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="reset-overlay" onClick={onCancel}>
      <div className="reset-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="reset-icon"><AlertTriangle size={26} strokeWidth={2.4} /></div>
        <div className="reset-title">Reset your account?</div>
        <div className="reset-body">
          This permanently deletes your collection, decks, coins, unlocked cosmetics, and PVP history.
          You'll be sent back to pick a fresh starter pack. This can't be undone.
        </div>
        <div className="reset-actions">
          <button type="button" className="reset-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="reset-confirm" onClick={onConfirm}>Reset everything</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsible row for the Help section. Header is always visible
 * (icon + title + chevron); the body — paragraphs, anatomy diagrams —
 * mounts only when open so the diagrams don't pay layout cost when
 * the player isn't looking at them.
 */
function HelpRow({ icon, title, body }: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="help-row" data-open={open}>
      <button
        type="button"
        className="help-head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="slider-ico">{icon}</span>
        <span className="slider-lbl">{title}</span>
        <ChevronDown
          className="help-chev"
          size={18}
          strokeWidth={2.4}
          aria-hidden="true"
        />
      </button>
      {open && <div className="help-body">{body}</div>}
    </div>
  );
}

function ToggleRow({ icon, label, hint, value, onChange }: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="slider-row">
      <div className="slider-head">
        <span className="slider-ico">{icon}</span>
        <span className="slider-lbl">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          onClick={() => onChange(!value)}
          className={`toggle ${value ? 'toggle-on' : ''}`}
          aria-label={label}
        >
          <span className="toggle-knob" />
        </button>
      </div>
      {hint && <div className="slider-hint">{hint}</div>}
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
        text-align: left;
        flex: 1 1 200px;
        min-width: 0;
      }
      /* Desktop / tablet — right-align as before once there's room. */
      @container (min-width: 720px) {
        .settings .settings-sec-r {
          flex: 0 1 auto;
          max-width: 28ch;
          text-align: right;
        }
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

      /* Toggle switch */
      .settings .toggle {
        width: 44px; height: 26px;
        border-radius: 999px;
        background: #e5d6c9;
        border: 1.5px solid ${PALETTE.border};
        cursor: pointer; padding: 0;
        position: relative;
        flex: 0 0 auto;
        transition: background .15s;
      }
      .settings .toggle.toggle-on {
        background: ${PALETTE.accent};
        border-color: ${PALETTE.accentDeep};
      }
      .settings .toggle-knob {
        position: absolute;
        top: 2px; left: 2px;
        width: 18px; height: 18px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(58,46,42,.18);
        transition: transform .18s cubic-bezier(.4,.6,.3,1.1);
      }
      .settings .toggle.toggle-on .toggle-knob {
        transform: translateX(18px);
      }

      /* Help — collapsible rule rows. Header uses the same .slider-ico
         + .slider-lbl tokens as the Audio rows so the visual language
         stays consistent; body opens below with paragraph text or an
         anatomy diagram. */
      .settings .help-card { padding: 6px 8px; gap: 0; }
      .settings .help-row { display: flex; flex-direction: column; }
      .settings .help-head {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 8px;
        background: transparent;
        border: 0;
        cursor: pointer;
        font-family: inherit;
        color: ${PALETTE.text};
        text-align: left;
      }
      .settings .help-head .slider-lbl { font-size: 14px; }
      .settings .help-chev {
        color: ${PALETTE.textMid};
        flex: 0 0 auto;
        transition: transform .18s;
      }
      .settings .help-row[data-open="true"] .help-chev { transform: rotate(180deg); }
      .settings .help-body {
        padding: 2px 8px 14px 54px;
        font-size: 13px;
        line-height: 1.5;
        color: ${PALETTE.textMid};
        animation: helpBodyIn .18s ease-out;
      }
      .settings .help-body p {
        margin: 0 0 8px 0;
      }
      .settings .help-body p:last-child { margin-bottom: 0; }
      .settings .help-body strong { color: ${PALETTE.text}; font-weight: 800; }
      /* On narrow viewports drop the indent — 54px of left padding
         eats too much room on a phone, and the diagrams want the
         full width. */
      @container (max-width: 480px) {
        .settings .help-body { padding-left: 8px; }
      }
      .settings .help-anatomy-wrap {
        display: flex; justify-content: center;
        padding: 6px 0 2px;
      }
      @keyframes helpBodyIn {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Replay tutorial button — sits at the top of the Help card.
         Same row geometry as the danger-btn so the two read as a
         matched pair, but the colours pull from the accent palette
         since this is a constructive action. */
      .settings .replay-btn {
        width: 100%;
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px;
        background: ${PALETTE.accent}12;
        border: 1.5px solid ${PALETTE.accent}55;
        border-radius: 14px;
        color: ${PALETTE.text};
        font-family: inherit;
        font-size: 14px; font-weight: 700;
        cursor: pointer;
        transition: background .12s, transform .1s;
        text-align: left;
      }
      .settings .replay-btn:hover { background: ${PALETTE.accent}1f; transform: translateY(-1px); }
      .settings .replay-ico {
        width: 32px; height: 32px; border-radius: 10px;
        background: ${PALETTE.accent}; color: #fff;
        display: grid; place-items: center;
        flex: 0 0 auto;
      }
      .settings .replay-lbl {
        font-weight: 800;
        letter-spacing: 0.02em;
        flex: 0 0 auto;
      }
      .settings .replay-hint {
        flex: 1;
        font-size: 11px;
        font-weight: 600;
        color: ${PALETTE.textMid};
        text-align: right;
      }
      @media (max-width: 360px) {
        .settings .replay-hint { display: none; }
      }

      /* Danger button + reset confirm dialog */
      .settings .danger-btn {
        width: 100%;
        display: flex; align-items: center; gap: 10px;
        padding: 12px 14px;
        background: ${DAMAGE}10;
        border: 1.5px solid ${DAMAGE}55;
        border-radius: 14px;
        color: ${DAMAGE};
        font-family: inherit;
        font-size: 14px; font-weight: 700;
        cursor: pointer;
        transition: background .12s, transform .1s;
      }
      .settings .danger-btn:hover { background: ${DAMAGE}1a; transform: translateY(-1px); }
      .settings .danger-ico {
        width: 32px; height: 32px; border-radius: 10px;
        background: ${DAMAGE}; color: #fff;
        display: grid; place-items: center;
        flex: 0 0 auto;
      }
      .settings .danger-lbl { flex: 1; text-align: left; letter-spacing: 0.02em; }

      .reset-overlay {
        position: fixed; inset: 0;
        background: rgba(20, 12, 8, .55);
        backdrop-filter: blur(2px);
        z-index: 100;
        display: grid; place-items: center;
        padding: 24px;
        animation: resetOverlayIn .15s ease-out;
      }
      .reset-dialog {
        background: #fff;
        border: 1.5px solid ${PALETTE.border};
        border-radius: 22px;
        padding: 22px 22px 18px;
        max-width: 380px; width: 100%;
        text-align: center;
        box-shadow: 0 24px 48px rgba(20,10,4,.35);
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        color: ${PALETTE.text};
        animation: resetDialogIn .2s ease-out;
      }
      .reset-icon {
        width: 56px; height: 56px; border-radius: 18px;
        margin: 0 auto 12px;
        background: ${DAMAGE}1a;
        color: ${DAMAGE};
        display: grid; place-items: center;
      }
      .reset-title { font-size: 18px; font-weight: 800; }
      .reset-body {
        font-size: 13px; color: ${PALETTE.textMid};
        line-height: 1.5; margin-top: 8px;
      }
      .reset-actions {
        display: flex; gap: 10px; margin-top: 18px;
      }
      .reset-cancel, .reset-confirm {
        flex: 1; padding: 12px 16px;
        border-radius: 14px;
        font-family: inherit; font-weight: 700; font-size: 13px;
        cursor: pointer;
        transition: transform .1s, box-shadow .12s;
      }
      .reset-cancel {
        background: #fff;
        color: ${PALETTE.text};
        border: 1.5px solid ${PALETTE.border};
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
      }
      .reset-confirm {
        background: linear-gradient(180deg, #e57672 0%, ${DAMAGE} 60%, #a8261f 100%);
        color: #fff;
        border: none;
        box-shadow: 0 6px 14px -4px ${DAMAGE}66, inset 0 1px 0 rgba(255,255,255,.3);
      }
      .reset-cancel:hover, .reset-confirm:hover { transform: translateY(-1px); }

      @keyframes resetOverlayIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes resetDialogIn {
        from { opacity: 0; transform: translateY(6px) scale(.96); }
        to   { opacity: 1; transform: translateY(0)   scale(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .settings-container, .settings-container * {
          transition: none !important;
        }
      }
    `}</style>
  );
}
