import { Heart, Flag, Skull, Swords } from 'lucide-react';
import { Card } from './Card';
import { getTemplateById } from '../data/templates';
import { aiPhoto } from '../data/samplePhotos';
import { PALETTE } from './styles';
import type { CollectionCard } from '../game/types';

/**
 * Card and battlefield anatomy diagrams shared by the in-match tutorial
 * (dark overlay) and the Settings → Help section (light page). Each
 * diagram pairs a numbered visual with a numbered legend so the player
 * can match a spot on the picture with a one-line explanation.
 *
 * The `theme` prop only switches colors — the layout, numbering and
 * copy are identical across surfaces so a player who learned the
 * diagram in the tutorial can re-read the same thing in Settings.
 */
type Theme = 'dark' | 'light';

interface CardAnatomyProps {
  cardId: string;
  kind: 'creature' | 'spell';
  theme?: Theme;
}

export function CardAnatomyDiagram({ cardId, kind, theme = 'dark' }: CardAnatomyProps) {
  const tpl = getTemplateById(cardId);
  if (!tpl) return null;
  const card: CollectionCard = {
    ...tpl,
    uid: `anatomy_${tpl.id}`,
    photo: aiPhoto(tpl.id),
    isPlaceholder: true,
  };
  const isCreature = kind === 'creature';
  type Row = { n: number; pos: string; title: string; body: string };
  const rows: Row[] = [
    { n: 1, pos: 'cost',    title: 'Mana cost',                              body: 'What you pay to play it' },
    { n: 2, pos: 'name',    title: 'Card name',                              body: 'And its art below' },
    { n: 3, pos: 'type',    title: isCreature ? 'Type · Creature' : 'Type · Spell',
                            body: isCreature ? 'Stays on the field, attacks each turn' : 'Fires before Battle, then is gone' },
    { n: 4, pos: 'rarity',  title: 'Rarity',                                 body: 'Common · Rare · Epic · Legendary — bumps in packs' },
    { n: 5, pos: 'ability', title: 'Ability',                                body: 'e.g. Rush · Taunt · Heal · Buff' },
  ];
  if (isCreature) {
    rows.push({ n: 6, pos: 'atk', title: 'Attack', body: 'Damage when it swings' });
    rows.push({ n: 7, pos: 'hp',  title: 'HP',     body: 'The creature dies at 0' });
  }
  return (
    <div className="anat-stage" data-theme={theme}>
      <AnatomyStyles />
      <div className="anat-card-anchor">
        <Card card={card} scale={1.0} />
        {rows.map(r => (
          <span key={r.n} className="anat-card-num" data-pos={r.pos}>{r.n}</span>
        ))}
      </div>
      <div className="anat-legend">
        {rows.map(r => (
          <div key={r.n} className="anat-legend-row">
            <span className="anat-num">{r.n}</span>
            <div><strong>{r.title}</strong><em>{r.body}</em></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FieldAnatomyDiagram({ theme = 'dark' }: { theme?: Theme }) {
  return (
    <div className="anat-stage" data-theme={theme}>
      <AnatomyStyles />
      <div className="anat-field-mock">
        <div className="anat-field-row">
          <span className="anat-num">1</span>
          <div className="anat-field-avatar" data-side="opp" />
          <div className="anat-field-hp"><Heart size={9} fill="#ef5a5a" color="#ef5a5a" strokeWidth={2} /> 6</div>
          <div className="anat-field-mana-pill"><span className="anat-field-mana-dot" /> 1/1</div>
          <div className="anat-field-spacer" />
          <span className="anat-num">2</span>
          <div className="anat-field-icon-btn"><Skull size={11} strokeWidth={2.2} /></div>
        </div>

        <div className="anat-field-zone">
          <span>SLOT</span><span>SLOT</span><span>SLOT</span>
        </div>

        <div className="anat-field-divider">
          <span className="anat-field-pill"><span className="anat-num">3</span> 1 / 12</span>
          <div className="anat-field-icon-btn"><Flag size={11} strokeWidth={2.2} /></div>
          <span className="anat-num">5</span>
          <div className="anat-field-spacer" />
          <span className="anat-num">4</span>
          <div className="anat-field-icon-btn anat-field-icon-btn-phase"><Swords size={11} strokeWidth={2.2} /></div>
        </div>

        <div className="anat-field-zone anat-field-zone-player">
          <span><span className="anat-num anat-num-slot">8</span>SLOT</span><span>SLOT</span><span>SLOT</span>
        </div>

        <div className="anat-field-row">
          <span className="anat-num">6</span>
          <div className="anat-field-avatar" data-side="player" />
          <div className="anat-field-hp"><Heart size={9} fill="#ef5a5a" color="#ef5a5a" strokeWidth={2} /> 20</div>
          <div className="anat-field-mana-pill"><span className="anat-field-mana-dot" /> 1/1</div>
          <div className="anat-field-spacer" />
          <div className="anat-field-icon-btn"><Skull size={11} strokeWidth={2.2} /></div>
        </div>

        <div className="anat-field-hand">
          <span className="anat-num anat-num-hand">7</span>
          <div className="anat-field-card" /><div className="anat-field-card" /><div className="anat-field-card" />
        </div>
      </div>

      <div className="anat-legend">
        <LegendRow n={1} title="Opponent"        body="Their HP and mana" />
        <LegendRow n={2} title="Cemetery"        body="Tap to peek at their dead" />
        <LegendRow n={3} title="Turn counter"    body="Match ends at turn 12" />
        <LegendRow n={4} title="Phase button"    body="Main → Battle → End" />
        <LegendRow n={5} title="Give up"         body="Concede the match" />
        <LegendRow n={6} title="Your HP & mana"  body="0 = you lose" />
        <LegendRow n={7} title="Your hand"       body="Drag cards to summon or cast" />
        <LegendRow n={8} title="Summon zone"     body="Three slots — drag creatures here" />
      </div>
      <div className="anat-field-tip">
        Tap any avatar mid-match for hand size, deck count and cemetery details.
      </div>
    </div>
  );
}

function LegendRow({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="anat-legend-row">
      <span className="anat-num">{n}</span>
      <div><strong>{title}</strong><em>{body}</em></div>
    </div>
  );
}

function AnatomyStyles() {
  return (
    <style>{`
      /* Theme switch: dark = sits on the in-match tutorial overlay,
         light = sits on a regular paper page (Settings → Help). */
      .anat-stage[data-theme="dark"]  { --anat-legend-bg: rgba(255,255,255,.94); --anat-legend-fg: ${PALETTE.text}; --anat-legend-mid: ${PALETTE.textMid}; --anat-mock-bg: rgba(255,240,220,0.94); --anat-tip: rgba(255,255,255,.78); }
      .anat-stage[data-theme="light"] { --anat-legend-bg: #fff;                  --anat-legend-fg: ${PALETTE.text}; --anat-legend-mid: ${PALETTE.textMid}; --anat-mock-bg: ${PALETTE.bg};          --anat-tip: ${PALETTE.textMid}; }

      .anat-stage {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 14px;
        align-items: center;
        padding: 4px;
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
      }

      .anat-card-anchor {
        position: relative;
        display: inline-block;
        margin: 8px auto;
      }
      .anat-card-num {
        position: absolute;
        z-index: 4;
        width: 22px; height: 22px;
        border-radius: 50%;
        background: ${PALETTE.accent};
        color: #fff;
        border: 2px solid ${PALETTE.paper};
        display: grid; place-items: center;
        font-weight: 800;
        font-size: 11px;
        box-shadow: 0 4px 10px rgba(28,24,20,.45);
      }
      .anat-card-num[data-pos="cost"]    { top: -10px;  left: -10px; }
      .anat-card-num[data-pos="name"]    { top: -10px;  right: 38%; }
      .anat-card-num[data-pos="type"]    { top: 60%;    left: 18%; }
      .anat-card-num[data-pos="rarity"]  { top: 60%;    right: 4%; }
      .anat-card-num[data-pos="ability"] { top: 78%;    left: 4%; }
      .anat-card-num[data-pos="atk"]     { bottom: -10px; left: -10px; }
      .anat-card-num[data-pos="hp"]      { bottom: -10px; right: -10px; }

      .anat-field-mock {
        width: 100%;
        max-width: 280px;
        background: var(--anat-mock-bg);
        border: 1.5px solid ${PALETTE.border};
        border-radius: 14px;
        padding: 10px 10px;
        display: flex; flex-direction: column;
        gap: 6px;
        box-shadow: 0 6px 14px rgba(28,24,20,.18);
        color: ${PALETTE.text};
        font-size: 10px; font-weight: 700;
        flex-shrink: 0;
      }
      .anat-field-row {
        display: flex; align-items: center;
        gap: 4px;
        flex-wrap: nowrap;
      }
      .anat-field-spacer { flex: 1; }
      .anat-field-avatar {
        width: 16px; height: 16px;
        border-radius: 50%;
        background: linear-gradient(160deg, #5a3a2a, #3a2418);
        border: 1.5px solid ${PALETTE.paper};
        flex-shrink: 0;
      }
      .anat-field-avatar[data-side="opp"] {
        background: linear-gradient(160deg, ${PALETTE.accent}, ${PALETTE.accentDeep});
      }
      .anat-field-hp {
        background: ${PALETTE.bg};
        border: 1px solid ${PALETTE.border};
        border-radius: 999px;
        padding: 2px 6px;
        font-size: 9px;
        font-weight: 800;
        display: inline-flex; align-items: center; gap: 3px;
        white-space: nowrap;
      }
      .anat-field-mana-pill {
        background: ${PALETTE.bg};
        border: 1px solid ${PALETTE.border};
        border-radius: 999px;
        padding: 2px 6px 2px 3px;
        font-size: 9px;
        font-weight: 800;
        display: inline-flex; align-items: center; gap: 4px;
        white-space: nowrap;
      }
      .anat-field-mana-dot {
        width: 10px; height: 10px;
        border-radius: 50%;
        background: linear-gradient(160deg, #5fa9ff, #2a73d5);
        box-shadow: 0 0 4px rgba(95,169,255,.6);
      }
      .anat-field-icon-btn {
        width: 18px; height: 18px;
        border-radius: 6px;
        background: ${PALETTE.bg};
        border: 1px solid ${PALETTE.border};
        display: grid; place-items: center;
        color: ${PALETTE.text};
        flex-shrink: 0;
      }
      .anat-field-icon-btn-phase {
        background: ${PALETTE.text};
        color: #fff;
        border-color: ${PALETTE.text};
      }
      .anat-field-zone {
        display: flex; gap: 4px; justify-content: center;
      }
      .anat-field-zone > span {
        flex: 1;
        height: 28px;
        background: rgba(255,255,255,.55);
        border: 1px dashed ${PALETTE.border};
        border-radius: 4px;
        display: grid; place-items: center;
        font-size: 8px;
        color: ${PALETTE.textMid};
        letter-spacing: 0.1em;
      }
      .anat-field-zone-player > span:first-child {
        background: rgba(255,235,200,.85);
        border-color: ${PALETTE.accent};
        color: ${PALETTE.text};
      }
      .anat-field-divider {
        display: flex; gap: 6px; justify-content: center; align-items: center;
        padding: 4px 0;
        border-top: 1px dashed ${PALETTE.border};
        border-bottom: 1px dashed ${PALETTE.border};
      }
      .anat-field-pill {
        background: ${PALETTE.paper};
        border: 1px solid ${PALETTE.border};
        border-radius: 999px;
        padding: 2px 6px;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.04em;
        display: inline-flex; align-items: center; gap: 4px;
      }
      .anat-field-hand {
        display: flex; gap: 4px; justify-content: center; align-items: center;
        margin-top: 4px;
      }
      .anat-field-card {
        width: 26px; height: 36px;
        background: linear-gradient(180deg, #6b9a91, #2f5a52);
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,.30);
      }

      .anat-num {
        display: inline-grid; place-items: center;
        width: 16px; height: 16px;
        border-radius: 50%;
        background: ${PALETTE.accent};
        color: #fff;
        font-size: 9px; font-weight: 800;
        flex-shrink: 0;
      }
      .anat-num-hand { margin-right: 4px; }
      .anat-num-slot {
        width: 14px; height: 14px;
        font-size: 9px;
        margin-right: 3px;
        vertical-align: middle;
      }

      .anat-legend {
        width: 100%;
        max-width: 320px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 10px;
        align-content: start;
      }
      .anat-legend-row {
        display: flex; align-items: center; gap: 8px;
        background: var(--anat-legend-bg);
        color: var(--anat-legend-fg);
        border: 1px solid ${PALETTE.border};
        border-radius: 8px;
        padding: 5px 8px;
        font-size: 10px;
        line-height: 1.2;
      }
      .anat-stage[data-theme="dark"] .anat-legend-row { border-color: transparent; }
      .anat-legend-row strong {
        font-weight: 800;
        font-size: 10px;
        display: block;
      }
      .anat-legend-row em {
        font-style: normal;
        color: var(--anat-legend-mid);
        font-size: 9px;
      }
      @media (max-width: 420px) {
        .anat-legend { grid-template-columns: 1fr; }
      }
      .anat-field-tip {
        max-width: 320px;
        margin: 4px auto 0;
        text-align: center;
        font-size: 10px;
        color: var(--anat-tip);
        font-style: italic;
        line-height: 1.35;
      }
    `}</style>
  );
}
