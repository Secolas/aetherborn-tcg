import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Coins, Package, Images, Layers, Swords, ScrollText,
  Settings as SettingsIcon, Flame, Palette, UserRound, Camera, Flag,
  Sparkles, BookOpen,
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
  onNav: (screen: 'collection' | 'pack' | 'deck' | 'play' | 'album' | 'settings' | 'daily' | 'cosmetics' | 'campaign' | 'tutorial' | 'starter-pick' | 'starter-open') => void;
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
export function HomeMenu({ save, dailyReadyCount = 0, onNav, onSetAvatar }: Props) {
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
  const deckReady = playableInDeck >= 4;
  // Play Match is gated behind the Campaign — the player must beat at
  // least one campaign stop before the picker becomes available. Legacy
  // saves with already-defeated bosses keep their access (so existing
  // players aren't suddenly walled out).
  const hasCampaignProgress = Object.values(save.campaignProgress ?? {}).some(v => v >= 0);
  const hasLegacyWins = save.bossesDefeated.length > 0;
  const playUnlocked = hasCampaignProgress || hasLegacyWins;

  // Progressive primary CTA. Walks the player through the onboarding
  // chain step by step (each completed step rolls the CTA forward),
  // then settles into Play Match once everything is set up. Boot
  // always lands on Home — every step is one tap away on the CTA.
  type CtaState =
    | { kind: 'tutorial'; label: string; icon: React.ReactNode; nav: 'tutorial' }
    | { kind: 'starter-pick'; label: string; icon: React.ReactNode; nav: 'starter-pick' }
    | { kind: 'starter-open'; label: string; icon: React.ReactNode; nav: 'starter-open' }
    | { kind: 'campaign'; label: string; icon: React.ReactNode; nav: 'campaign' }
    | { kind: 'need-deck'; label: string; icon: React.ReactNode; nav: null }
    | { kind: 'play'; label: string; icon: React.ReactNode; nav: 'play' };
  const cta: CtaState = !save.tutorialCompleted
    ? { kind: 'tutorial',     label: 'Begin Tutorial',       icon: <Sparkles size={20} strokeWidth={2.4} />, nav: 'tutorial' }
    : !save.starterThemeId
    ? { kind: 'starter-pick', label: 'Pick Your Starter',    icon: <Package  size={20} strokeWidth={2.4} />, nav: 'starter-pick' }
    : (save.starterThemeId !== 'legacy' && !save.starterOpened)
    ? { kind: 'starter-open', label: 'Open Your Starter',    icon: <BookOpen size={20} strokeWidth={2.4} />, nav: 'starter-open' }
    : !playUnlocked
    ? { kind: 'campaign',     label: 'Play Campaign',        icon: <Flag     size={20} strokeWidth={2.4} />, nav: 'campaign' }
    : !deckReady
    ? { kind: 'need-deck',    label: `Need ${4 - playableInDeck} more in deck`, icon: <Swords size={20} strokeWidth={2.4} />, nav: null }
    : { kind: 'play',         label: 'Play Match',           icon: <Swords   size={20} strokeWidth={2.4} />, nav: 'play' };
  const summonedCount = save.collection.filter(c => c.photo).length;
  const dormantCount = save.collection.filter(c => !c.photo).length;
  void dormantCount;

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

      <div className="home">
        {/* Topbar — clean chip language, no avatar+stats clutter. */}
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
              <div className="home-id-eyebrow">Welcome back</div>
              <div className="home-id-name">You</div>
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

        {/* Game wordmark — refined version of the old Lifedeck title.
            Smaller and tighter than the pre-revamp huge gradient so it
            reads as a banner rather than dominating the screen. */}
        <div className="home-brand">
          <div className="home-brand-tag">your life · in cards</div>
          <div className="home-brand-name">Lifedeck</div>
        </div>

        {/* Quick-stats strip — three pill stats in a row. */}
        <div className="home-stats">
          <div className="home-stat">
            <div className="home-stat-n">{save.matchesWon}</div>
            <div className="home-stat-l">wins</div>
          </div>
          <div className="home-stat">
            <div className="home-stat-n">{save.matchesLost}</div>
            <div className="home-stat-l">losses</div>
          </div>
          <div className="home-stat">
            <div className="home-stat-n">{summonedCount}</div>
            <div className="home-stat-l">summoned</div>
          </div>
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
              has a memory attached. Restarts on every slideIdx tick. */}
          {featuredMemory && (
            <div className="home-memory" key={`mem-${slideIdx}`} aria-live="polite">
              <div className="home-memory-eyebrow">{featuredMemory.name}</div>
              <div className="home-memory-text">“{featuredMemory.memory}”</div>
            </div>
          )}
        </div>

        {/* CTA + nav. The primary CTA walks the player through the
            onboarding chain (Begin Tutorial -> Pick Starter -> Open
            Pack -> Play Campaign -> Play Match) — see `cta` above. */}
        <div className="home-actions">
          <button
            className="home-cta"
            onClick={() => { if (cta.nav) onNav(cta.nav); }}
            disabled={cta.nav === null}
            data-cta={cta.kind}
          >
            {cta.icon}
            <span className="home-cta-label">
              {cta.label}
            </span>
          </button>

          <div className="home-nav">
            <NavButton label="Campaign"   icon={<Flag       size={18} strokeWidth={2.2} />} onClick={() => onNav('campaign')} />
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
          radial-gradient(ellipse 90% 60% at 50% -10%, #ffd1b3, transparent 60%),
          radial-gradient(ellipse 80% 60% at 0% 110%, #fff0d6, transparent 60%),
          #fef8f0;
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
      .home-id-eyebrow {
        font-size: 9px; font-weight: 800; letter-spacing: 0.22em;
        text-transform: uppercase; color: ${PALETTE.textLight};
        line-height: 1;
      }
      .home-id-name {
        font-size: 18px; font-weight: 800; line-height: 1;
        margin-top: 3px;
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

      /* Game wordmark — Lifedeck title block. Smaller, tighter, and
         centered above the stats strip. Picks up the coral→amber
         gradient text-fill from the original screen but at a size
         that doesn't dominate. */
      .home-brand {
        margin-top: 14px;
        text-align: center;
      }
      .home-brand-tag {
        font-size: 9px; font-weight: 800;
        letter-spacing: 0.32em; text-transform: uppercase;
        color: ${PALETTE.textLight};
        line-height: 1;
      }
      .home-brand-name {
        font-family: inherit;
        font-weight: 700;
        font-size: 36px; line-height: 1;
        letter-spacing: -0.015em;
        margin-top: 6px;
        background: linear-gradient(180deg, #ff9f1c 0%, ${PALETTE.accent} 100%);
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      @container (min-width: 720px) {
        .home-brand-name { font-size: 44px; }
      }

      /* Stats strip — three pill stats in a row. */
      .home-stats {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
      }
      .home-stat {
        padding: 10px 12px;
        background: #fff;
        border: 1.5px solid ${PALETTE.border};
        border-radius: 14px;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        display: flex; flex-direction: column; align-items: center;
        gap: 2px;
        text-align: center;
      }
      .home-stat-n {
        font-size: 22px; font-weight: 800; line-height: 1;
        color: ${PALETTE.text};
      }
      .home-stat-l {
        font-size: 9px; font-weight: 800; letter-spacing: 0.18em;
        text-transform: uppercase; color: ${PALETTE.textLight};
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

      /* Play Match — clean coral pill. Drops the chunky 4px solid
         bottom shadow in favor of a soft warm drop shadow that lifts
         the button without making it feel "extruded". */
      .home-cta {
        width: 100%;
        padding: 14px 22px; min-height: 56px;
        background: linear-gradient(180deg, #ffa07a 0%, ${PALETTE.accent} 100%);
        color: #fff;
        border: 0; border-radius: 999px;
        cursor: pointer;
        font-family: inherit; font-weight: 800;
        font-size: 16px; letter-spacing: 0.04em;
        display: inline-flex; align-items: center; justify-content: center;
        gap: 10px;
        box-shadow: 0 8px 20px rgba(238,90,82,.32);
        transition: transform .12s, box-shadow .12s, filter .12s;
      }
      .home-cta:hover { transform: translateY(-1px); filter: brightness(1.04); }
      .home-cta:active:not([disabled]) {
        transform: translateY(1px);
        box-shadow: 0 4px 12px rgba(238,90,82,.32);
      }
      .home-cta[disabled] {
        background: ${PALETTE.textLight};
        cursor: not-allowed;
        box-shadow: 0 4px 10px rgba(58,46,42,.18);
        filter: none;
      }
      .home-cta-label { font-family: inherit; }

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
