import { useState } from 'react';
import { ArrowLeft, Coins, Lock, Check, Sparkles, Layers, Image, Frame, MessageSquareHeart, Square } from 'lucide-react';
import { PALETTE } from '../components/styles';
import { FRAMES, FRAME_ORDER, type FrameId } from '../data/frames';
import { BOARD_SKINS, BOARD_SKIN_ORDER, type BoardSkinId } from '../data/boardSkins';
import { EMOTES, EMOTE_ORDER, type EmoteId } from '../data/victoryEmotes';
import { FILTERS, FILTER_ORDER, type FilterId } from '../data/filters';
import { CARD_BACKS, CARD_BACK_ORDER, type CardBackId } from '../data/cardBacks';
import { SmartImage } from '../components/SmartImage';
import { aiPhoto } from '../data/samplePhotos';

/**
 * Cosmetics locker — single screen that browses + equips every
 * cosmetic in the game. Same design language as the Boss Picker and
 * the Pack Shop revamp: warm paper surfaces, eyebrow-numbered section
 * headers, coral CTAs, and a container-query responsive layout that
 * collapses cleanly from desktop (max-width 1100px) to mobile.
 *
 * Five categories live behind a horizontal tab strip up top. A
 * "Your loadout" hero card mirrors what's currently equipped so the
 * player can see their style at a glance before browsing more.
 */

type Tab = 'frames' | 'backs' | 'filters' | 'boards' | 'emotes';

interface Props {
  coins: number;
  unlockedFrames: FrameId[];
  unlockedFilters: FilterId[];
  unlockedBoardSkins: BoardSkinId[];
  unlockedEmotes: EmoteId[];
  unlockedCardBacks: CardBackId[];
  equippedFrame: FrameId;
  equippedBoardSkin: BoardSkinId;
  equippedEmote: EmoteId;
  equippedCardBack: CardBackId;
  onBuyFrame: (id: FrameId, cost: number) => void;
  onBuyFilter: (id: FilterId, cost: number) => void;
  onBuyBoardSkin: (id: BoardSkinId, cost: number) => void;
  onBuyEmote: (id: EmoteId, cost: number) => void;
  onBuyCardBack: (id: CardBackId, cost: number) => void;
  onEquipFrame: (id: FrameId) => void;
  onEquipBoardSkin: (id: BoardSkinId) => void;
  onEquipEmote: (id: EmoteId) => void;
  onEquipCardBack: (id: CardBackId) => void;
  onBack: () => void;
}

interface TabDef {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  count: number;
  unlocked: number;
}

export function Cosmetics(props: Props) {
  const [tab, setTab] = useState<Tab>('frames');

  const tabs: TabDef[] = [
    { id: 'frames',  label: 'Frames',  icon: <Frame size={12} strokeWidth={2.2} />,             count: FRAME_ORDER.length,     unlocked: props.unlockedFrames.length },
    { id: 'backs',   label: 'Backs',   icon: <Layers size={12} strokeWidth={2.2} />,            count: CARD_BACK_ORDER.length, unlocked: props.unlockedCardBacks.length },
    { id: 'filters', label: 'Filters', icon: <Image size={12} strokeWidth={2.2} />,             count: FILTER_ORDER.length,    unlocked: props.unlockedFilters.length },
    { id: 'boards',  label: 'Boards',  icon: <Square size={12} strokeWidth={2.2} />,            count: BOARD_SKIN_ORDER.length,unlocked: props.unlockedBoardSkins.length },
    { id: 'emotes',  label: 'Emotes',  icon: <MessageSquareHeart size={12} strokeWidth={2.2} />, count: EMOTE_ORDER.length,     unlocked: props.unlockedEmotes.length },
  ];

  const tabBlurb: Record<Tab, string> = {
    frames:  'Frames sit on the chrome of every card you own. Equipped during matches only — your collection stays clean.',
    backs:   'The face-down design on your draws and deck pile. Future packs will ship new templates.',
    filters: 'Per-card cosmetic filters applied at the moment you summon a card. Apply them on the camera screen.',
    boards:  'In-match background skins. Different boards set a different mood.',
    emotes:  'Headline you flash on the victory screen when you win a match.',
  };

  return (
    <div className="cosm-container">
      <CosmeticsStyles />
      <div className="cosm">
        {/* Topbar */}
        <div className="cosm-topbar">
          <div className="left-tools">
            <button className="icon-btn" aria-label="Back" onClick={props.onBack}>
              <ArrowLeft size={16} strokeWidth={2.2} />
            </button>
            <span className="coin-chip" aria-label={`${props.coins} coins`}>
              <Coins size={13} color="#c08620" fill="#ffd166" strokeWidth={2} />
              <strong>{props.coins.toLocaleString()}</strong> coins
            </span>
          </div>
          <div className="crest">
            <div className="vol">Locker</div>
            <div className="title">Cosmetics</div>
          </div>
          <div className="right-tools">
            <span className="coin-chip">
              <strong>{tabs.reduce((n, t) => n + t.unlocked, 0)}/{tabs.reduce((n, t) => n + t.count, 0)}</strong> unlocked
            </span>
          </div>
        </div>

        {/* Loadout hero — preview of currently equipped items. */}
        <LoadoutHero
          frame={props.equippedFrame}
          back={props.equippedCardBack}
          board={props.equippedBoardSkin}
          emote={props.equippedEmote}
        />

        {/* Tab pills */}
        <div className="cosm-tabs no-scrollbar" role="tablist" aria-label="Cosmetic categories">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className="cosm-tab"
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              <span className="ico">{t.icon}</span>
              <span className="lbl">{t.label}</span>
              <span className="count">{t.unlocked}/{t.count}</span>
            </button>
          ))}
        </div>

        {/* Blurb under tabs */}
        <div className="cosm-blurb">{tabBlurb[tab]}</div>

        {/* Section header */}
        <header className="cosm-sec">
          <div className="cosm-sec-l">
            <div className="cosm-sec-eyebrow">
              {String(tabs.findIndex(t => t.id === tab) + 1).padStart(2, '0')} · {tab}
            </div>
            <div className="cosm-sec-title">{tabs.find(t => t.id === tab)?.label}</div>
          </div>
          <div className="cosm-sec-r">
            {tabs.find(t => t.id === tab)?.unlocked ?? 0} owned · {tabs.find(t => t.id === tab)?.count ?? 0} total
          </div>
        </header>

        {/* Grid */}
        <div className="cosm-grid">
          {tab === 'frames' && FRAME_ORDER.map(id => (
            <FrameTile
              key={id}
              id={id}
              unlocked={props.unlockedFrames.includes(id)}
              equipped={props.equippedFrame === id}
              coins={props.coins}
              onBuy={() => props.onBuyFrame(id, FRAMES[id].cost)}
              onEquip={() => props.onEquipFrame(id)}
            />
          ))}
          {tab === 'backs' && CARD_BACK_ORDER.map(id => (
            <BackTile
              key={id}
              id={id}
              unlocked={props.unlockedCardBacks.includes(id)}
              equipped={props.equippedCardBack === id}
              coins={props.coins}
              onBuy={() => props.onBuyCardBack(id, CARD_BACKS[id].cost)}
              onEquip={() => props.onEquipCardBack(id)}
            />
          ))}
          {tab === 'filters' && FILTER_ORDER.map(id => (
            <FilterTile
              key={id}
              id={id}
              unlocked={props.unlockedFilters.includes(id)}
              coins={props.coins}
              onBuy={() => props.onBuyFilter(id, FILTERS[id].cost)}
            />
          ))}
          {tab === 'boards' && BOARD_SKIN_ORDER.map(id => (
            <BoardTile
              key={id}
              id={id}
              unlocked={props.unlockedBoardSkins.includes(id)}
              equipped={props.equippedBoardSkin === id}
              coins={props.coins}
              onBuy={() => props.onBuyBoardSkin(id, BOARD_SKINS[id].cost)}
              onEquip={() => props.onEquipBoardSkin(id)}
            />
          ))}
          {tab === 'emotes' && EMOTE_ORDER.map(id => (
            <EmoteTile
              key={id}
              id={id}
              unlocked={props.unlockedEmotes.includes(id)}
              equipped={props.equippedEmote === id}
              coins={props.coins}
              onBuy={() => props.onBuyEmote(id, EMOTES[id].cost)}
              onEquip={() => props.onEquipEmote(id)}
            />
          ))}
        </div>

        {/* Filters footnote — they work differently from the rest. */}
        {tab === 'filters' && (
          <div className="cosm-footnote">
            <div className="ttl">How filters work</div>
            <div>
              Unlike frames and boards, filters are <strong>per-card</strong>: apply one
              to a single photo when you summon that card on the Capture screen.
              Buying a filter here unlocks it for use everywhere; it doesn't get
              equipped globally.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loadout hero ───────────────────────────────────────────────────

/**
 * Hero card mirroring the player's currently-equipped loadout: frame
 * mini, card-back mini, board swatch, and emote preview. Same accent
 * dot + "your style" copy as the Pack Shop hero so the locker reads as
 * part of the same family.
 */
function LoadoutHero({
  frame, back, board, emote,
}: {
  frame: FrameId;
  back: CardBackId;
  board: BoardSkinId;
  emote: EmoteId;
}) {
  const frameDef = FRAMES[frame];
  const backDef  = CARD_BACKS[back];
  const boardDef = BOARD_SKINS[board];
  const emoteDef = EMOTES[emote];
  return (
    <section className="cosm-hero">
      <div className="cosm-hero-eyebrow">
        <Sparkles size={12} strokeWidth={2.2} />
        <span>Your loadout · currently equipped</span>
      </div>
      <div className="cosm-hero-body">
        <div className="cosm-hero-copy">
          <div className="cosm-hero-h">
            Make it yours<span className="dot">.</span>
          </div>
          <p className="cosm-hero-p">
            Frames, backs, boards, and emotes are equipped globally. Filters
            are per-card. Tap any item below to swap.
          </p>
        </div>
        <div className="cosm-hero-slots">
          <div className="cosm-slot">
            <div className="cosm-slot-art cosm-slot-frame">
              <div
                className="mini-card"
                style={{
                  boxShadow: (frameDef.outer?.boxShadow as string | undefined)
                    ?? '0 4px 10px rgba(0,0,0,.25), inset 0 0 0 1.5px rgba(255,255,255,.2)',
                }}
              >
                <div
                  style={{
                    position: 'absolute', inset: 4, borderRadius: 5,
                    background: 'linear-gradient(135deg, rgba(255,255,255,.18), rgba(0,0,0,.18))',
                    boxShadow: frameDef.inner?.boxShadow as string | undefined,
                  }}
                />
              </div>
            </div>
            <div className="cosm-slot-lbl">Frame</div>
            <div className="cosm-slot-name">{frameDef.name}</div>
          </div>
          <div className="cosm-slot">
            <div className="cosm-slot-art">{backDef.render({ scale: 0.22, rotate: 0 })}</div>
            <div className="cosm-slot-lbl">Back</div>
            <div className="cosm-slot-name">{backDef.name}</div>
          </div>
          <div className="cosm-slot">
            <div className="cosm-slot-art cosm-slot-board" style={{ background: boardDef.background }} />
            <div className="cosm-slot-lbl">Board</div>
            <div className="cosm-slot-name">{boardDef.name}</div>
          </div>
          <div className="cosm-slot">
            <div className="cosm-slot-art cosm-slot-emote">
              <div className="emote-headline" style={{
                background: `linear-gradient(180deg, ${emoteDef.glow ?? '#ff9f1c'}, #ee5a52)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {emoteDef.headline}
              </div>
            </div>
            <div className="cosm-slot-lbl">Emote</div>
            <div className="cosm-slot-name">{emoteDef.name}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Cosmetic tile shell ────────────────────────────────────────────

/** Shared tile used by every cosmetic category. Booster-pack-ish
 *  silhouette: warm paper, gentle outer shadow, equipped highlight on
 *  the left-stripe, optional lock veil, primary action at the bottom. */
function CosmeticTile({
  name, description,
  equipped, unlocked,
  cost, canAfford,
  onBuy, onEquip,
  preview,
  previewBg,
}: {
  name: string;
  description: string;
  equipped: boolean;
  unlocked: boolean;
  cost: number;
  canAfford: boolean;
  onBuy?: () => void;
  onEquip?: () => void;
  preview: React.ReactNode;
  /** Background behind the preview area. Defaults to a neutral warm
   *  paper — frames + backs need a dark backdrop to read, filters use
   *  the photo itself, boards fill themselves. */
  previewBg?: string;
}) {
  return (
    <div className="cosm-tile" data-equipped={equipped} data-locked={!unlocked}>
      <div className="cosm-tile-preview" style={previewBg ? { background: previewBg } : undefined}>
        {preview}
        {!unlocked && (
          <div className="cosm-tile-lockveil">
            <Lock size={20} color="#fff" strokeWidth={2.2} />
          </div>
        )}
      </div>
      <div className="cosm-tile-body">
        <div className="cosm-tile-name">{name}</div>
        <div className="cosm-tile-desc">{description}</div>
        <div className="cosm-tile-cta">
          {unlocked
            ? equipped
              ? (
                <div className="cosm-tile-equipped">
                  <Check size={12} strokeWidth={3} />
                  Equipped
                </div>
              )
              : onEquip
                ? (
                  <button className="cosm-equip" onClick={onEquip}>Equip</button>
                )
                : (
                  <div className="cosm-tile-equipped" style={{ color: PALETTE.textMid, background: 'rgba(58,46,42,.06)' }}>
                    <Check size={12} strokeWidth={3} />
                    Owned
                  </div>
                )
            : (
              <button
                className="cosm-buy"
                disabled={!canAfford}
                onClick={canAfford ? onBuy : undefined}
              >
                <Coins size={12} fill="#ffd166" color="#c08620" strokeWidth={2.2} />
                {cost}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

// ─── Tiles per category ─────────────────────────────────────────────

function FrameTile({
  id, unlocked, equipped, coins, onBuy, onEquip,
}: { id: FrameId; unlocked: boolean; equipped: boolean; coins: number; onBuy: () => void; onEquip: () => void }) {
  const def = FRAMES[id];
  const outerShadow = def.outer?.boxShadow as string | undefined;
  return (
    <CosmeticTile
      name={def.name}
      description={def.description}
      equipped={equipped}
      unlocked={unlocked}
      cost={def.cost}
      canAfford={coins >= def.cost}
      onBuy={onBuy}
      onEquip={onEquip}
      previewBg="#1c1814"
      preview={
        <div className="frame-mini" style={{
          boxShadow: outerShadow ?? '0 4px 12px rgba(0,0,0,.35), inset 0 0 0 1.5px rgba(255,255,255,.2)',
        }}>
          <div className="frame-mini-inner" style={{
            boxShadow: def.inner?.boxShadow as string | undefined,
          }} />
        </div>
      }
    />
  );
}

function BackTile({
  id, unlocked, equipped, coins, onBuy, onEquip,
}: { id: CardBackId; unlocked: boolean; equipped: boolean; coins: number; onBuy: () => void; onEquip: () => void }) {
  const def = CARD_BACKS[id];
  return (
    <CosmeticTile
      name={def.name}
      description={def.description}
      equipped={equipped}
      unlocked={unlocked}
      cost={def.cost}
      canAfford={coins >= def.cost}
      onBuy={onBuy}
      onEquip={onEquip}
      previewBg="linear-gradient(180deg, #fef3e8, #ffe5cc)"
      preview={
        <div className="back-mini-wrap">
          {def.render({ scale: 0.3, rotate: 0 })}
        </div>
      }
    />
  );
}

function FilterTile({
  id, unlocked, coins, onBuy,
}: { id: FilterId; unlocked: boolean; coins: number; onBuy: () => void }) {
  const def = FILTERS[id];
  const samplePhoto = aiPhoto('fam-05');
  return (
    <CosmeticTile
      name={def.name}
      description={def.description}
      equipped={false}
      unlocked={unlocked}
      cost={def.cost}
      canAfford={coins >= def.cost}
      onBuy={onBuy}
      previewBg="#0a0a14"
      preview={
        <>
          <SmartImage
            src={samplePhoto}
            alt=""
            fallbackSeed={id}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: def.cssFilter === 'none' ? undefined : def.cssFilter,
            }}
          />
          {def.overlay && (
            <div style={{
              position: 'absolute', inset: 0,
              background: def.overlay.background,
              mixBlendMode: def.overlay.mixBlendMode,
              pointerEvents: 'none',
            }} />
          )}
        </>
      }
    />
  );
}

function BoardTile({
  id, unlocked, equipped, coins, onBuy, onEquip,
}: { id: BoardSkinId; unlocked: boolean; equipped: boolean; coins: number; onBuy: () => void; onEquip: () => void }) {
  const def = BOARD_SKINS[id];
  return (
    <CosmeticTile
      name={def.name}
      description={def.description}
      equipped={equipped}
      unlocked={unlocked}
      cost={def.cost}
      canAfford={coins >= def.cost}
      onBuy={onBuy}
      onEquip={onEquip}
      previewBg={def.background}
      preview={null}
    />
  );
}

function EmoteTile({
  id, unlocked, equipped, coins, onBuy, onEquip,
}: { id: EmoteId; unlocked: boolean; equipped: boolean; coins: number; onBuy: () => void; onEquip: () => void }) {
  const def = EMOTES[id];
  return (
    <CosmeticTile
      name={def.name}
      description={def.description}
      equipped={equipped}
      unlocked={unlocked}
      cost={def.cost}
      canAfford={coins >= def.cost}
      onBuy={onBuy}
      onEquip={onEquip}
      previewBg="radial-gradient(ellipse at 50% 50%, #fff8e8 0%, #ffe0bf 100%)"
      preview={
        <div className="emote-preview">
          <div className="emote-headline" style={{
            background: `linear-gradient(180deg, ${def.glow ?? '#ff9f1c'}, #ee5a52)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {def.headline}
          </div>
          {def.sub && <div className="emote-sub">{def.sub}</div>}
          <Sparkles size={11} color={def.glow ?? '#ff9f1c'} style={{ marginTop: 3 }} />
        </div>
      }
    />
  );
}

// ─── Scoped stylesheet ──────────────────────────────────────────────

function CosmeticsStyles() {
  return (
    <style>{`
      .cosm-container {
        container-type: inline-size;
        width: 100%; height: 100%;
        overflow-y: auto;
        background:
          radial-gradient(ellipse 90% 60% at 50% -10%, #ffd1b3, transparent 60%),
          radial-gradient(ellipse 80% 60% at 0% 110%, #fff0d6, transparent 60%),
          #fef8f0;
        color: #3a2e2a;
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
      }
      .cosm {
        padding: 56px 16px 32px;
        display: flex; flex-direction: column;
        gap: 18px;
      }
      @container (min-width: 1024px) {
        .cosm { max-width: 1100px; margin: 0 auto; padding: 28px 32px 40px; gap: 24px; }
      }

      /* Topbar */
      .cosm .cosm-topbar {
        display: grid; grid-template-columns: 1fr auto 1fr;
        align-items: center; gap: 12px;
      }
      .cosm .left-tools, .cosm .right-tools {
        display: flex; align-items: center; gap: 8px;
      }
      .cosm .left-tools  { justify-self: start; }
      .cosm .right-tools { justify-self: end; }
      .cosm .icon-btn {
        width: 38px; height: 38px; border-radius: 50%;
        background: #fff; border: 1.5px solid ${PALETTE.border};
        box-shadow: 0 2px 6px rgba(58,46,42,.08);
        cursor: pointer; padding: 0;
        display: grid; place-items: center;
        color: ${PALETTE.text};
        transition: transform .12s;
      }
      .cosm .icon-btn:hover { transform: translateY(-1px); }
      .cosm .crest { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .cosm .crest .vol {
        font-size: 9px; font-weight: 800; letter-spacing: 0.22em;
        color: ${PALETTE.textLight}; text-transform: uppercase;
      }
      .cosm .crest .title {
        font-size: 20px; font-weight: 700; line-height: 1;
      }
      .cosm .coin-chip { display: none; }
      @container (min-width: 1024px) {
        .cosm .coin-chip {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 14px;
          background: #fff7e6;
          border: 1px solid ${PALETTE.border};
          border-radius: 999px;
          box-shadow: 0 2px 6px rgba(58,46,42,.08);
          font-family: inherit; font-weight: 600; font-size: 13px;
          color: ${PALETTE.text}; white-space: nowrap;
        }
        .cosm .coin-chip strong { font-weight: 800; font-size: 14px; }
        .cosm .crest .title { font-size: 24px; }
        .cosm .icon-btn { width: 42px; height: 42px; }
      }

      /* Loadout hero */
      .cosm .cosm-hero {
        position: relative;
        background: #fff;
        border: 1px solid ${PALETTE.border};
        border-radius: 22px;
        padding: 18px 20px;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        overflow: hidden;
      }
      .cosm .cosm-hero::before {
        content: ""; position: absolute; inset: 0;
        background: radial-gradient(ellipse 100% 80% at 100% 0%, ${PALETTE.accent}22, transparent 60%);
        pointer-events: none;
      }
      .cosm .cosm-hero-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 10px; font-weight: 800; letter-spacing: 0.22em;
        text-transform: uppercase; color: ${PALETTE.accent};
        margin-bottom: 12px;
      }
      .cosm .cosm-hero-body {
        display: grid; grid-template-columns: 1fr;
        gap: 18px; align-items: center; position: relative;
      }
      @container (min-width: 720px) {
        .cosm .cosm-hero-body { grid-template-columns: 1fr auto; gap: 26px; }
      }
      .cosm .cosm-hero-h {
        font-weight: 800; font-size: 24px;
        line-height: 1.05; letter-spacing: -0.01em;
      }
      .cosm .cosm-hero-h .dot { color: ${PALETTE.accent}; }
      @container (min-width: 720px) {
        .cosm .cosm-hero-h { font-size: 30px; }
      }
      .cosm .cosm-hero-p {
        margin: 6px 0 0;
        font-size: 13px; line-height: 1.5;
        color: ${PALETTE.textMid};
        max-width: 52ch;
      }
      .cosm .cosm-hero-slots {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        align-items: start;
        min-width: 280px;
      }
      .cosm .cosm-slot {
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        text-align: center; min-width: 0;
      }
      .cosm .cosm-slot-art {
        width: 56px; height: 78px; border-radius: 8px;
        display: grid; place-items: center;
        background: #fff7e6;
        border: 1px solid ${PALETTE.border};
        overflow: hidden;
      }
      .cosm .cosm-slot-art.cosm-slot-frame { background: #1c1814; }
      .cosm .cosm-slot-art.cosm-slot-board {
        background-size: cover; background-position: center;
      }
      .cosm .cosm-slot-art.cosm-slot-emote {
        padding: 6px;
        background: radial-gradient(ellipse at 50% 50%, #fff8e8 0%, #ffe0bf 100%);
      }
      .cosm .cosm-slot-art .mini-card {
        width: 38px; height: 56px; border-radius: 5px;
        position: relative;
        background: linear-gradient(180deg, #3d8e57 0%, #205838 100%);
      }
      .cosm .cosm-slot-art .emote-headline {
        font-family: inherit; font-weight: 800;
        font-size: 11px; line-height: 1;
      }
      .cosm .cosm-slot-lbl {
        font-size: 9px; font-weight: 800; letter-spacing: 0.18em;
        text-transform: uppercase; color: ${PALETTE.textLight};
      }
      .cosm .cosm-slot-name {
        font-size: 11px; font-weight: 700;
        color: ${PALETTE.text};
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        max-width: 70px;
      }

      /* Tabs */
      .cosm .cosm-tabs {
        display: flex; gap: 8px;
        margin: 0 -16px; padding: 0 16px;
        overflow-x: auto; scrollbar-width: none;
      }
      .cosm .cosm-tabs::-webkit-scrollbar { display: none; }
      @container (min-width: 720px) {
        .cosm .cosm-tabs { margin: 0; padding: 0; }
      }
      .cosm .cosm-tab {
        flex-shrink: 0;
        display: inline-flex; align-items: center; gap: 8px;
        padding: 10px 14px;
        background: #fff;
        border: 1px solid ${PALETTE.border};
        border-radius: 999px;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        font-family: inherit; cursor: pointer;
        font-weight: 700; font-size: 13px;
        color: ${PALETTE.text};
        transition: transform .12s, background .15s, box-shadow .15s;
      }
      .cosm .cosm-tab:hover { transform: translateY(-1px); }
      .cosm .cosm-tab[data-active="true"] {
        background: ${PALETTE.text}; color: #fff; border-color: ${PALETTE.text};
        box-shadow: 0 4px 12px rgba(58,46,42,.20);
      }
      .cosm .cosm-tab .count {
        font-weight: 800; font-size: 10px;
        padding: 2px 7px; border-radius: 999px;
        background: #fff7e6; color: ${PALETTE.textMid};
        border: 1px solid ${PALETTE.border};
        letter-spacing: 0.04em;
      }
      .cosm .cosm-tab[data-active="true"] .count {
        background: rgba(255,255,255,.18); color: #fff; border-color: transparent;
      }

      /* Blurb */
      .cosm .cosm-blurb {
        padding: 12px 16px;
        background: #fff7e6;
        border: 1px solid ${PALETTE.border};
        border-left: 3px solid ${PALETTE.accent};
        border-radius: 12px;
        font-size: 13px; line-height: 1.5;
        font-style: italic; color: ${PALETTE.textMid};
      }

      /* Section header */
      .cosm .cosm-sec {
        display: flex; justify-content: space-between; align-items: flex-end;
        gap: 12px; padding-bottom: 10px;
        border-bottom: 1px solid rgba(58,46,42,.22);
        flex-wrap: wrap;
      }
      .cosm .cosm-sec-eyebrow {
        font-size: 10px; font-weight: 800; letter-spacing: 0.22em;
        text-transform: uppercase; color: ${PALETTE.textLight};
      }
      .cosm .cosm-sec-title {
        font-size: 22px; font-weight: 800; letter-spacing: -0.01em;
        margin-top: 2px; text-transform: capitalize;
      }
      @container (min-width: 720px) {
        .cosm .cosm-sec-title { font-size: 26px; }
      }
      .cosm .cosm-sec-r {
        font-size: 12px; color: ${PALETTE.textMid};
        font-weight: 600;
      }

      /* Grid */
      .cosm .cosm-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      @container (min-width: 560px) {
        .cosm .cosm-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; }
      }
      @container (min-width: 1024px) {
        .cosm .cosm-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; }
      }

      /* Tile */
      .cosm .cosm-tile {
        background: #fff;
        border: 1.5px solid ${PALETTE.border};
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        display: flex; flex-direction: column;
        transition: transform .15s, box-shadow .2s, border-color .2s;
        position: relative;
      }
      .cosm .cosm-tile:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(58,46,42,.12); }
      .cosm .cosm-tile[data-equipped="true"] {
        border-color: ${PALETTE.accent};
        box-shadow:
          0 4px 12px rgba(238,90,82,.22),
          inset 4px 0 0 0 ${PALETTE.accent};
      }
      .cosm .cosm-tile[data-locked="true"] { opacity: 0.92; }

      .cosm .cosm-tile-preview {
        position: relative;
        height: 92px;
        display: grid; place-items: center;
        overflow: hidden;
      }
      @container (min-width: 720px) {
        .cosm .cosm-tile-preview { height: 108px; }
      }
      .cosm .cosm-tile-lockveil {
        position: absolute; inset: 0;
        background: rgba(28,24,20,.45);
        display: grid; place-items: center;
      }
      .cosm .cosm-tile-body {
        padding: 10px 12px 12px;
        display: flex; flex-direction: column; gap: 4px;
        flex: 1; min-height: 0;
      }
      .cosm .cosm-tile-name {
        font-weight: 800; font-size: 13px;
        color: ${PALETTE.text};
        line-height: 1.2;
      }
      .cosm .cosm-tile-desc {
        font-size: 10.5px; line-height: 1.35;
        color: ${PALETTE.textMid};
        min-height: 28px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }
      .cosm .cosm-tile-cta { margin-top: 6px; }

      .cosm .cosm-tile-equipped {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 5px 10px;
        background: ${PALETTE.accent}1A;
        color: ${PALETTE.accent};
        border-radius: 999px;
        font-family: inherit; font-weight: 800;
        font-size: 10px; letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .cosm .cosm-equip {
        width: 100%; padding: 7px 10px;
        background: ${PALETTE.text}; color: #fff;
        border: 0; border-radius: 10px;
        font-family: inherit; font-weight: 800;
        font-size: 12px; letter-spacing: 0.04em;
        cursor: pointer;
        box-shadow: 0 2px 0 rgba(0,0,0,.25);
        transition: transform .12s, box-shadow .12s;
      }
      .cosm .cosm-equip:hover { transform: translateY(-1px); }
      .cosm .cosm-equip:active { transform: translateY(1px); box-shadow: 0 1px 0 rgba(0,0,0,.25); }
      .cosm .cosm-buy {
        width: 100%; padding: 7px 10px;
        background: linear-gradient(180deg, #ffa07a, ${PALETTE.accent});
        color: #fff; border: 0; border-radius: 999px;
        font-family: inherit; font-weight: 800;
        font-size: 12px;
        cursor: pointer;
        box-shadow: 0 5px 12px rgba(238,90,82,.28);
        display: flex; align-items: center; justify-content: center; gap: 5px;
        transition: transform .12s, box-shadow .12s, filter .12s;
      }
      .cosm .cosm-buy:hover { transform: translateY(-1px); filter: brightness(1.04); }
      .cosm .cosm-buy:active { transform: translateY(1px); box-shadow: 0 2px 8px rgba(238,90,82,.28); }
      .cosm .cosm-buy[disabled] {
        background: #f3ece4;
        color: ${PALETTE.textMid};
        box-shadow: none;
        cursor: not-allowed;
        filter: none;
      }

      /* Per-tile previews */
      .cosm .frame-mini {
        width: 64px; height: 90px; border-radius: 8px;
        background: linear-gradient(180deg, #3d8e57 0%, #205838 100%);
        position: relative;
      }
      .cosm .frame-mini-inner {
        position: absolute; inset: 4px;
        border-radius: 5px;
        background: linear-gradient(135deg, rgba(255,255,255,.18), rgba(0,0,0,.18));
      }
      .cosm .back-mini-wrap { display: grid; place-items: center; }
      .cosm .emote-preview {
        text-align: center;
        padding: 4px;
      }
      .cosm .emote-preview .emote-headline {
        font-family: inherit; font-weight: 800;
        font-size: 16px; line-height: 1.05;
      }
      .cosm .emote-preview .emote-sub {
        font-size: 9px; color: ${PALETTE.textMid};
        font-style: italic; margin-top: 2px;
      }

      /* Filters footnote */
      .cosm .cosm-footnote {
        padding: 12px 14px;
        background: #fff;
        border: 1px solid ${PALETTE.border};
        border-radius: 12px;
        font-size: 12px; color: ${PALETTE.text};
        line-height: 1.5;
      }
      .cosm .cosm-footnote .ttl {
        font-size: 9px; font-weight: 800; letter-spacing: 0.22em;
        text-transform: uppercase; color: ${PALETTE.textLight};
        margin-bottom: 6px;
      }

      @media (prefers-reduced-motion: reduce) {
        .cosm-container, .cosm-container * {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  );
}
