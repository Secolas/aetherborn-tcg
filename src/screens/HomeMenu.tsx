import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Coins, Package, Images, Layers, Swords, ScrollText, Sparkles,
  Settings as SettingsIcon, Flame, Palette, UserRound, Camera,
} from 'lucide-react';
import { Card } from '../components/Card';
import { PALETTE } from '../components/styles';
import { TEMPLATES } from '../data/templates';
import type { CardTemplate, CollectionCard, SaveData } from '../game/types';

interface Props {
  save: SaveData;
  /** Total claimable items in Daily (completed quests + unclaimed streak).
   *  Drives the badge on the Daily nav chip. */
  dailyReadyCount?: number;
  onNav: (screen: 'collection' | 'pack' | 'deck' | 'play' | 'album' | 'settings' | 'daily' | 'cosmetics') => void;
  onQuickFill: () => void;
  onSetAvatar: (dataUrl: string | undefined) => void;
}

/**
 * Home screen. Keeps the hand-of-cards fan-out cycle the user loves as
 * the centerpiece and re-skins everything around it in the same design
 * language as the Boss Picker / Pack Shop / Cosmetics: scoped inline
 * stylesheet, container queries, warm paper chrome, coral CTAs.
 *
 * Bonus tie-in to the Memory feature: when the cycle lands on a card
 * the player has written a memory for, the memory fades in under the
 * fan and rides out with that cycle's heartbeat.
 */
export function HomeMenu({ save, dailyReadyCount = 0, onNav, onQuickFill, onSetAvatar }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') onSetAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const dormant = TEMPLATES.find(t => t.id === 'fam-11')!; // Dad — iconic
  const playableInDeck = save.deckUids.filter(uid => {
    const c = save.collection.find(x => x.uid === uid);
    return c && c.photo;
  }).length;
  const canMatch = playableInDeck >= 4;
  const summonedCount = save.collection.filter(c => c.photo).length;
  const dormantCount = save.collection.filter(c => !c.photo).length;
  const showQuickFill = !canMatch && dormantCount > 0;

  // Slideshow source — preserved from the previous version. Every
  // summoned card the player owns, with two safe fallbacks below 2 so
  // the showcase never goes empty.
  const summonedAll: (CollectionCard | CardTemplate)[] = save.collection.filter(c => c.photo);
  const slideshow: (CollectionCard | CardTemplate)[] =
    summonedAll.length >= 2 ? summonedAll
    : summonedAll.length === 1 ? [summonedAll[0], dormant]
    : [dormant, TEMPLATES[0]];

  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    if (slideshow.length <= 2) return;
    const id = window.setInterval(() => {
      setSlideIdx(i => (i + 1) % slideshow.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [slideshow.length]);

  // Memory caption: as the fan rotates, find whichever of the visible
  // six cards has a memory and surface it below the fan. Keyed to the
  // slideIdx so the animation restarts each cycle. Plays the memory of
  // the "center" card preferentially; otherwise any card that has one.
  const featuredMemory = useMemo(() => {
    const N = Math.min(6, Math.max(2, slideshow.length));
    const visible: (CollectionCard | CardTemplate)[] = [];
    for (let i = 0; i < N; i++) visible.push(slideshow[(slideIdx * N + i) % slideshow.length]);
    const center = visible[Math.floor(visible.length / 2)];
    if (isCollection(center) && center.memory) {
      return { name: center.name, memory: center.memory };
    }
    for (const c of visible) {
      if (isCollection(c) && c.memory) return { name: c.name, memory: c.memory };
    }
    return null;
  }, [slideIdx, slideshow]);

  return (
    <div className="home-container">
      <HomeStyles />

      {/* Soft confetti dots — kept from the old screen, just slightly
          dimmer so the new chip language reads clean on top of them. */}
      <svg className="home-confetti" aria-hidden>
        {Array.from({ length: 22 }).map((_, i) => {
          const colors = ['#ffd166', '#ff7e5f', '#06d6a0', '#ffa07a', '#ee5a52'];
          return (
            <circle key={i}
              cx={`${(i * 47) % 100}%`}
              cy={`${(i * 31) % 100}%`}
              r={3 + (i % 3)}
              fill={colors[i % colors.length]}
              opacity={0.4}
            />
          );
        })}
      </svg>

      <div className="home">
        {/* Top bar */}
        <div className="home-topbar">
          <div className="home-id">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
              aria-label="Upload avatar"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="home-avatar"
              style={{
                background: save.playerAvatar
                  ? `url(${save.playerAvatar}) center/cover`
                  : `linear-gradient(135deg, #ff9f1c, ${PALETTE.accent})`,
              }}
              aria-label={save.playerAvatar ? 'Change avatar' : 'Upload avatar'}
              title={save.playerAvatar ? 'Tap to change avatar' : 'Tap to upload your avatar'}
            >
              {!save.playerAvatar && (
                <>
                  <UserRound size={22} strokeWidth={2.2} fill="rgba(255,255,255,.6)" />
                  <span className="home-avatar-cam">
                    <Camera size={9} strokeWidth={2.6} />
                  </span>
                </>
              )}
            </button>
            <div className="home-id-meta">
              <div className="home-id-name">You</div>
              <div className="home-id-stats">
                {save.matchesWon} W · {save.matchesLost} L · {summonedCount} summoned
              </div>
            </div>
          </div>

          <div className="home-tools">
            <button
              className="home-chip home-daily"
              onClick={() => onNav('daily')}
              aria-label="Daily quests"
            >
              <Flame size={14} strokeWidth={2.2} fill="#ffd166" color="#ffd166" />
              {dailyReadyCount > 0 && (
                <span className="home-daily-badge">{dailyReadyCount}</span>
              )}
            </button>
            <span className="home-chip home-coins" aria-label={`${save.coins} coins`}>
              <Coins size={14} color="#c08620" fill="#ffd166" strokeWidth={2.2} />
              <strong>{save.coins.toLocaleString()}</strong>
            </span>
            <button
              className="home-chip home-settings"
              onClick={() => onNav('settings')}
              aria-label="Settings"
            >
              <SettingsIcon size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Title block — quieter than the old huge gradient. */}
        <div className="home-title">
          <div className="home-title-eyebrow">Welcome back</div>
          <div className="home-title-name">Lifedeck</div>
          <div className="home-title-tag">your life. in cards.</div>
        </div>

        {/* Card preview — preserves the hand fan + idle sway transition
            users explicitly asked us to keep. */}
        <div className="home-stage">
          <div className="home-fan">
            {(() => {
              const N = Math.min(6, Math.max(2, slideshow.length));
              return Array.from({ length: N }).map((_, i) => {
                const offset = i - (N - 1) / 2;
                const finalX = offset * 32;
                const finalY = Math.abs(offset) * 8;
                const finalRot = offset * 8;
                const delay = i * 0.11;
                const card = slideshow[(slideIdx * N + i) % slideshow.length];
                const cardStyle: React.CSSProperties & Record<string, string | number> = {
                  position: 'absolute', left: '50%', top: '50%',
                  animation:
                    `homeFanIn 0.85s cubic-bezier(.22,.85,.3,1.15) ${delay}s both, ` +
                    `homeFanIdle 4s ease-in-out ${delay + 0.85}s infinite`,
                  willChange: 'transform, opacity',
                  pointerEvents: 'none',
                  zIndex: 10 + i,
                  filter: 'drop-shadow(0 8px 16px rgba(58, 46, 42, .18))',
                  ['--final-x']: `${finalX}px`,
                  ['--final-y']: `${finalY}px`,
                  ['--final-rot']: `${finalRot}deg`,
                };
                return (
                  <div key={`fan-${slideIdx}-${i}`} style={cardStyle}>
                    <Card card={card} scale={0.6} />
                  </div>
                );
              });
            })()}
          </div>

          {/* Memory caption — fades in for the cycle when a fan card
              has a memory attached. Restarts on every slideIdx tick
              via the key so the animation always reads fresh. */}
          {featuredMemory && (
            <div className="home-memory" key={`mem-${slideIdx}`} aria-live="polite">
              <div className="home-memory-eyebrow">{featuredMemory.name}</div>
              <div className="home-memory-text">“{featuredMemory.memory}”</div>
            </div>
          )}
        </div>

        {/* CTA + nav */}
        <div className="home-actions">
          <button
            className="home-cta"
            onClick={() => canMatch && onNav('play')}
            disabled={!canMatch}
          >
            <span className="home-cta-icon"><Swords size={20} strokeWidth={2.4} /></span>
            <span className="home-cta-label">
              <span className="sub">{canMatch ? 'Tap to battle' : 'Need more cards in your deck'}</span>
              <span>{canMatch ? 'Play Match' : `Need ${4 - playableInDeck} more`}</span>
            </span>
          </button>

          {showQuickFill && (
            <button className="home-quickfill" onClick={onQuickFill}>
              <Sparkles size={14} color={PALETTE.accent} strokeWidth={2.4} />
              <span>Quick Play with placeholder photos</span>
            </button>
          )}

          <div className="home-nav">
            <NavButton label="Packs"      icon={<Package    size={18} strokeWidth={2.2} />} onClick={() => onNav('pack')} />
            <NavButton label="Collection" icon={<Layers     size={18} strokeWidth={2.2} />} onClick={() => onNav('collection')} />
            <NavButton label="Deck"       icon={<ScrollText size={18} strokeWidth={2.2} />} onClick={() => onNav('deck')} />
            <NavButton label="Album"      icon={<Images     size={18} strokeWidth={2.2} />} onClick={() => onNav('album')} />
            <NavButton label="Cosmetics"  icon={<Palette    size={18} strokeWidth={2.2} />} onClick={() => onNav('cosmetics')} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button className="home-nav-btn" onClick={onClick}>
      <span className="ico">{icon}</span>
      <span className="lbl">{label}</span>
    </button>
  );
}

function isCollection(c: CollectionCard | CardTemplate): c is CollectionCard {
  return (c as CollectionCard).uid !== undefined;
}

// ─── Scoped stylesheet ──────────────────────────────────────────────

function HomeStyles() {
  return (
    <style>{`
      .home-container {
        container-type: inline-size;
        width: 100%; height: 100%;
        position: relative; overflow: hidden;
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        color: ${PALETTE.text};
        background:
          radial-gradient(ellipse 120% 80% at 50% 0%, #fff4e6 0%, transparent 70%),
          linear-gradient(180deg, #ffe8d6 0%, #ffd1b3 50%, #ffb89a 100%);
      }
      .home-confetti {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        opacity: 0.45;
        pointer-events: none;
      }
      .home {
        position: relative; z-index: 1;
        width: 100%; height: 100%;
        display: flex; flex-direction: column;
        padding: 0 16px;
      }
      @container (min-width: 720px) {
        .home { max-width: 720px; margin: 0 auto; padding: 0 24px; }
      }

      /* Top bar */
      .home-topbar {
        padding-top: max(56px, env(safe-area-inset-top, 56px));
        padding-bottom: 8px;
        display: flex; justify-content: space-between; align-items: center;
        gap: 12px;
      }
      .home-id { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .home-avatar {
        position: relative;
        width: 40px; height: 40px; border-radius: 50%;
        display: grid; place-items: center;
        color: #fff;
        box-shadow: 0 4px 10px rgba(238,90,82,.35), inset 0 0 0 2px rgba(255,255,255,.5);
        border: 0; cursor: pointer; padding: 0;
        font-family: inherit;
        flex: 0 0 auto;
      }
      .home-avatar-cam {
        position: absolute; bottom: -2px; right: -2px;
        width: 16px; height: 16px; border-radius: 50%;
        background: #fff; color: ${PALETTE.accent};
        display: grid; place-items: center;
        box-shadow: 0 2px 4px rgba(0,0,0,.25);
      }
      .home-id-meta { min-width: 0; }
      .home-id-name { font-size: 14px; font-weight: 700; line-height: 1; }
      .home-id-stats {
        font-size: 10px; letter-spacing: 0.06em;
        color: ${PALETTE.textMid}; margin-top: 3px;
        white-space: nowrap;
      }

      .home-tools { display: flex; align-items: center; gap: 6px; }
      .home-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 12px; min-height: 36px;
        background: #fff;
        border: 1.5px solid ${PALETTE.border};
        border-radius: 999px;
        box-shadow: 0 2px 6px rgba(58,46,42,.08);
        font-family: inherit; font-weight: 700;
        font-size: 13px; color: ${PALETTE.text};
        cursor: pointer;
      }
      .home-chip.home-coins { padding: 7px 14px; }
      .home-chip.home-coins strong { font-weight: 800; font-size: 14px; }
      .home-chip.home-daily, .home-chip.home-settings {
        padding: 0; width: 36px; height: 36px;
        justify-content: center;
      }
      .home-chip.home-daily {
        background: linear-gradient(135deg, #ff9f1c, ${PALETTE.accent});
        color: #fff; border-color: rgba(255,255,255,.6);
        box-shadow: 0 4px 10px rgba(238,90,82,.32);
        position: relative;
      }
      .home-daily-badge {
        position: absolute; top: -3px; right: -3px;
        min-width: 16px; height: 16px;
        padding: 0 4px; border-radius: 999px;
        background: #06d6a0; color: #fff;
        font-size: 9px; font-weight: 800; line-height: 16px;
        border: 2px solid #fff;
        text-align: center;
      }

      /* Title */
      .home-title {
        text-align: center; margin-top: 18px;
      }
      .home-title-eyebrow {
        font-size: 10px; font-weight: 800; letter-spacing: 0.28em;
        text-transform: uppercase; color: ${PALETTE.textMid};
      }
      .home-title-name {
        font-size: 52px; font-weight: 700;
        line-height: 1; letter-spacing: -0.01em;
        background: linear-gradient(180deg, #ff9f1c 0%, ${PALETTE.accent} 100%);
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-top: 4px;
      }
      @container (min-width: 720px) {
        .home-title-name { font-size: 64px; }
      }
      .home-title-tag {
        font-size: 11px; color: ${PALETTE.textMid};
        font-style: italic; margin-top: 6px;
      }

      /* Card-fan stage */
      .home-stage {
        position: relative; flex: 1; min-height: 240px;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        margin-top: 8px;
      }
      .home-fan {
        position: relative;
        flex: 1; width: 100%;
        display: flex; align-items: center; justify-content: center;
      }

      /* Memory caption — surfaces when the fan lands on a card with a
         memory. Fades in with the new cycle and drifts up gently. */
      .home-memory {
        margin: 0 auto 10px;
        max-width: 380px;
        padding: 10px 14px;
        background: rgba(255,255,255,.72);
        border: 1px solid ${PALETTE.border};
        border-left: 3px solid ${PALETTE.accent};
        border-radius: 14px;
        box-shadow: 0 6px 18px rgba(58,46,42,.10);
        text-align: center;
        animation: homeMemoryIn .8s cubic-bezier(.2,.85,.3,1) 0.4s both;
        backdrop-filter: blur(2px);
      }
      .home-memory-eyebrow {
        font-size: 9px; font-weight: 800;
        letter-spacing: 0.22em; text-transform: uppercase;
        color: ${PALETTE.accent};
        margin-bottom: 4px;
      }
      .home-memory-text {
        font-size: 13px; line-height: 1.4;
        font-style: italic;
        color: ${PALETTE.text};
        font-family: "Inter", system-ui, sans-serif;
      }
      @keyframes homeMemoryIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Actions */
      .home-actions {
        padding-bottom: max(28px, env(safe-area-inset-bottom, 28px));
        display: flex; flex-direction: column; gap: 10px;
      }

      .home-cta {
        width: 100%;
        padding: 14px 22px; min-height: 64px;
        background: ${PALETTE.accent}; color: #fff;
        border: 0; border-radius: 20px;
        cursor: pointer;
        font-family: inherit; font-weight: 800;
        display: grid; grid-template-columns: auto 1fr; gap: 14px;
        align-items: center;
        box-shadow:
          0 4px 0 #b03c34,
          0 14px 28px -10px rgba(58,46,42,.28);
        transition: transform .12s, box-shadow .12s;
      }
      .home-cta:hover { transform: translateY(-2px); }
      .home-cta:active:not([disabled]) {
        transform: translateY(2px);
        box-shadow: 0 1px 0 #b03c34;
      }
      .home-cta[disabled] {
        background: ${PALETTE.textLight};
        cursor: not-allowed;
        box-shadow: 0 2px 0 rgba(0,0,0,.15);
      }
      .home-cta-icon {
        width: 38px; height: 38px; border-radius: 12px;
        background: rgba(0,0,0,.22);
        display: grid; place-items: center;
      }
      .home-cta-label { text-align: left; line-height: 1; }
      .home-cta-label .sub {
        display: block;
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.18em; text-transform: uppercase;
        opacity: 0.78;
        margin-bottom: 4px;
      }
      .home-cta-label > span:not(.sub) {
        font-size: 22px; font-weight: 800; letter-spacing: 0.02em;
      }

      .home-quickfill {
        width: 100%;
        padding: 10px 16px; min-height: 40px;
        background: rgba(255,255,255,.85);
        color: ${PALETTE.text};
        border: 1.5px dashed ${PALETTE.accent};
        border-radius: 14px;
        font-family: inherit; font-weight: 700; font-size: 13px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 8px;
      }

      .home-nav {
        display: flex; gap: 6px;
      }
      .home-nav-btn {
        flex: 1;
        display: flex; flex-direction: column; align-items: center;
        gap: 4px; padding: 9px 0; min-height: 56px;
        background: #fff;
        border: 1.5px solid ${PALETTE.border};
        border-radius: 14px;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        font-family: inherit; cursor: pointer;
        color: ${PALETTE.text};
        transition: transform .12s, box-shadow .15s;
      }
      .home-nav-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(58,46,42,.12);
      }
      .home-nav-btn .ico {
        color: ${PALETTE.accent};
        display: grid; place-items: center;
      }
      .home-nav-btn .lbl {
        font-size: 11px; font-weight: 700;
      }

      @media (prefers-reduced-motion: reduce) {
        .home-cta, .home-cta:hover, .home-cta:active,
        .home-nav-btn:hover, .home-memory {
          animation: none !important;
          transition: none !important;
          transform: none !important;
        }
      }
    `}</style>
  );
}
