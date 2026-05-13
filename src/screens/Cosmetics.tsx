import { useState } from 'react';
import { ArrowLeft, Coins, Lock, Check, Sparkles } from 'lucide-react';
import { iconBtn, PALETTE } from '../components/styles';
import { FRAMES, FRAME_ORDER, type FrameId } from '../data/frames';
import { BOARD_SKINS, BOARD_SKIN_ORDER, type BoardSkinId } from '../data/boardSkins';
import { EMOTES, EMOTE_ORDER, type EmoteId } from '../data/victoryEmotes';
import { FILTERS, FILTER_ORDER, type FilterId } from '../data/filters';
import { SmartImage } from '../components/SmartImage';
import { aiPhoto } from '../data/samplePhotos';

/**
 * Cosmetics locker — the single screen where the player browses and
 * equips every cosmetic in the game. Four tabs across the top:
 *   - Frames:  per-card chrome (gold trim, neon, etched)
 *   - Filters: per-photo CSS filters (sepia, holo, etc.)
 *   - Boards:  in-match background skins
 *   - Emotes:  victory-screen headline emotes
 *
 * Each tab renders a grid of preview cards. A card is either equipped
 * (highlight + check), unlocked (tappable to equip), or locked (shows a
 * coin cost; tap to buy if affordable). Filters live in their own pool
 * because they're applied per-card rather than globally — this screen
 * just acts as a browser / unlock shop for them. Tapping a filter
 * doesn't "equip" it; the bottom hint explains that filters are picked
 * at photo-capture time.
 */

type Tab = 'frames' | 'filters' | 'boards' | 'emotes';

interface Props {
  coins: number;
  unlockedFrames: FrameId[];
  unlockedFilters: FilterId[];
  unlockedBoardSkins: BoardSkinId[];
  unlockedEmotes: EmoteId[];
  equippedFrame: FrameId;
  equippedBoardSkin: BoardSkinId;
  equippedEmote: EmoteId;
  onBuyFrame: (id: FrameId, cost: number) => void;
  onBuyFilter: (id: FilterId, cost: number) => void;
  onBuyBoardSkin: (id: BoardSkinId, cost: number) => void;
  onBuyEmote: (id: EmoteId, cost: number) => void;
  onEquipFrame: (id: FrameId) => void;
  onEquipBoardSkin: (id: BoardSkinId) => void;
  onEquipEmote: (id: EmoteId) => void;
  onBack: () => void;
}

export function Cosmetics(props: Props) {
  const [tab, setTab] = useState<Tab>('frames');
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `
        radial-gradient(ellipse 100% 60% at 50% 0%, #fff8e8 0%, transparent 70%),
        linear-gradient(180deg, #fef3e8 0%, #ffe5cc 100%)
      `,
      color: PALETTE.text,
      fontFamily: '"Fredoka", "Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={props.onBack} style={iconBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Cosmetics</div>
          <div style={{ fontSize: 11, color: PALETTE.textMid, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Coins size={12} color="#e8a93a" fill="#ffd166" strokeWidth={2.2} />
            {props.coins} coins
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', gap: 6 }}>
        <TabPill label="Frames" active={tab === 'frames'} onClick={() => setTab('frames')} />
        <TabPill label="Filters" active={tab === 'filters'} onClick={() => setTab('filters')} />
        <TabPill label="Boards" active={tab === 'boards'} onClick={() => setTab('boards')} />
        <TabPill label="Emotes" active={tab === 'emotes'} onClick={() => setTab('emotes')} />
      </div>

      <div className="no-scrollbar" style={{
        flex: 1, overflowY: 'auto', padding: '14px 16px 24px',
      }}>
        {tab === 'frames' && (
          <Grid>
            {FRAME_ORDER.map(id => (
              <FramePreview
                key={id}
                id={id}
                unlocked={props.unlockedFrames.includes(id)}
                equipped={props.equippedFrame === id}
                coins={props.coins}
                onBuy={() => props.onBuyFrame(id, FRAMES[id].cost)}
                onEquip={() => props.onEquipFrame(id)}
              />
            ))}
          </Grid>
        )}

        {tab === 'filters' && (
          <>
            <Grid>
              {FILTER_ORDER.map(id => (
                <FilterPreview
                  key={id}
                  id={id}
                  unlocked={props.unlockedFilters.includes(id)}
                  coins={props.coins}
                  onBuy={() => props.onBuyFilter(id, FILTERS[id].cost)}
                />
              ))}
            </Grid>
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: '#fff', borderRadius: 12,
              border: `1.5px solid ${PALETTE.border}`,
              fontSize: 11, color: PALETTE.text, lineHeight: 1.5,
            }}>
              <div style={{
                fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase',
                color: PALETTE.textMid, fontWeight: 700, marginBottom: 6,
              }}>
                How filters work
              </div>
              <div>
                Filters are <strong>per-card</strong>, not equipped globally
                like frames. To apply one:
              </div>
              <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                <li>Open <strong>Collection</strong> &rarr; tap a dormant card (the camera opens).</li>
                <li>Frame your photo, tap the shutter.</li>
                <li>On the next screen, a strip of filter previews appears under the card.
                  Tap any unlocked filter to apply it. Locked ones can be bought there
                  for coins if you haven&apos;t already.</li>
                <li>Name the card, tap <strong>Add to Collection</strong>.</li>
              </ol>
              <div style={{ marginTop: 6, fontStyle: 'italic', color: PALETTE.textMid }}>
                Each card remembers its own filter — Sepia on your dog, Holo on your dad,
                whatever fits the photo.
              </div>
            </div>
          </>
        )}

        {tab === 'boards' && (
          <Grid>
            {BOARD_SKIN_ORDER.map(id => (
              <BoardPreview
                key={id}
                id={id}
                unlocked={props.unlockedBoardSkins.includes(id)}
                equipped={props.equippedBoardSkin === id}
                coins={props.coins}
                onBuy={() => props.onBuyBoardSkin(id, BOARD_SKINS[id].cost)}
                onEquip={() => props.onEquipBoardSkin(id)}
              />
            ))}
          </Grid>
        )}

        {tab === 'emotes' && (
          <Grid>
            {EMOTE_ORDER.map(id => (
              <EmotePreview
                key={id}
                id={id}
                unlocked={props.unlockedEmotes.includes(id)}
                equipped={props.equippedEmote === id}
                coins={props.coins}
                onBuy={() => props.onBuyEmote(id, EMOTES[id].cost)}
                onEquip={() => props.onEquipEmote(id)}
              />
            ))}
          </Grid>
        )}
      </div>
    </div>
  );
}

function TabPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? 'linear-gradient(180deg, #ffa07a 0%, #ee5a52 100%)' : '#fff',
        color: active ? '#fff' : PALETTE.text,
        border: active ? 'none' : `1.5px solid ${PALETTE.border}`,
        borderRadius: 14,
        padding: '9px 0',
        fontSize: 12, fontWeight: 700,
        letterSpacing: '0.05em',
        cursor: 'pointer',
        boxShadow: active
          ? '0 4px 14px rgba(238, 90, 82, .35)'
          : '0 2px 6px rgba(58,46,42,.06)',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 10,
    }}>
      {children}
    </div>
  );
}

/** Generic "tile" wrapper used by every preview type so they share padding,
 *  border, equipped highlight, lock overlay, and the bottom action row. */
function Tile({
  name, description, equipped, unlocked, cost, canAfford,
  onBuy, onEquip, children,
}: {
  name: string;
  description: string;
  equipped: boolean;
  unlocked: boolean;
  cost: number;
  canAfford: boolean;
  onBuy?: () => void;
  onEquip?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      padding: 10, borderRadius: 14,
      background: '#fff',
      border: equipped ? '2px solid #f4d04a' : `1.5px solid ${PALETTE.border}`,
      boxShadow: equipped
        ? '0 4px 12px rgba(244,208,74,.35)'
        : '0 2px 6px rgba(58,46,42,.06)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {equipped && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          background: '#f4d04a', color: '#3a2e2a',
          width: 22, height: 22, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          zIndex: 2,
        }}>
          <Check size={14} strokeWidth={3} />
        </div>
      )}
      <div style={{
        height: 100, borderRadius: 10, overflow: 'hidden',
        marginBottom: 8, position: 'relative',
        background: '#0a0a14',
      }}>
        {children}
        {!unlocked && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,.45)',
            display: 'grid', placeItems: 'center',
          }}>
            <Lock size={22} color="#fff" />
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{name}</div>
      <div style={{ fontSize: 10, color: PALETTE.textMid, marginTop: 1, lineHeight: 1.3, minHeight: 26 }}>
        {description}
      </div>
      <div style={{ marginTop: 6 }}>
        {unlocked ? (
          equipped ? (
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#c8362e',
              letterSpacing: '0.15em', textTransform: 'uppercase',
              textAlign: 'center', padding: '6px 0',
            }}>Equipped</div>
          ) : onEquip ? (
            <button onClick={onEquip} style={{
              width: '100%', background: '#fef3e8', color: PALETTE.text,
              border: `1.5px solid ${PALETTE.border}`, borderRadius: 10,
              padding: '6px 0', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Equip</button>
          ) : (
            <div style={{
              fontSize: 10, fontWeight: 700, color: PALETTE.textMid,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              textAlign: 'center', padding: '6px 0',
            }}>Unlocked</div>
          )
        ) : (
          <button
            onClick={canAfford ? onBuy : undefined}
            disabled={!canAfford}
            style={{
              width: '100%',
              background: canAfford
                ? 'linear-gradient(180deg, #ffa07a 0%, #ee5a52 100%)'
                : '#f3ece4',
              color: canAfford ? '#fff' : PALETTE.textMid,
              border: 'none', borderRadius: 10,
              padding: '6px 0', fontSize: 11, fontWeight: 700,
              cursor: canAfford ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <Coins size={12} fill="#ffd166" color="#e8a93a" strokeWidth={2.2} />
            {cost}
          </button>
        )}
      </div>
    </div>
  );
}

function FramePreview({
  id, unlocked, equipped, coins, onBuy, onEquip,
}: { id: FrameId; unlocked: boolean; equipped: boolean; coins: number; onBuy: () => void; onEquip: () => void }) {
  const def = FRAMES[id];
  const outerShadow = def.outer?.boxShadow as string | undefined;
  return (
    <Tile
      name={def.name}
      description={def.description}
      equipped={equipped}
      unlocked={unlocked}
      cost={def.cost}
      canAfford={coins >= def.cost}
      onBuy={onBuy}
      onEquip={onEquip}
    >
      {/* Miniature card chrome to preview the frame */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 56, height: 78, borderRadius: 8,
        background: 'linear-gradient(180deg, #3d8e57 0%, #205838 100%)',
        boxShadow: outerShadow ?? '0 4px 12px rgba(0,0,0,.35), inset 0 0 0 1.5px rgba(255,255,255,.2)',
      }}>
        <div style={{
          position: 'absolute', inset: 4,
          borderRadius: 5,
          background: 'linear-gradient(135deg, rgba(255,255,255,.18), rgba(0,0,0,.18))',
          boxShadow: def.inner?.boxShadow as string | undefined,
        }} />
      </div>
    </Tile>
  );
}

function FilterPreview({
  id, unlocked, coins, onBuy,
}: { id: FilterId; unlocked: boolean; coins: number; onBuy: () => void }) {
  const def = FILTERS[id];
  const samplePhoto = aiPhoto('fam-05');
  return (
    <Tile
      name={def.name}
      description={def.description}
      equipped={false}
      unlocked={unlocked}
      cost={def.cost}
      canAfford={coins >= def.cost}
      onBuy={onBuy}
    >
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
    </Tile>
  );
}

function BoardPreview({
  id, unlocked, equipped, coins, onBuy, onEquip,
}: { id: BoardSkinId; unlocked: boolean; equipped: boolean; coins: number; onBuy: () => void; onEquip: () => void }) {
  const def = BOARD_SKINS[id];
  return (
    <Tile
      name={def.name}
      description={def.description}
      equipped={equipped}
      unlocked={unlocked}
      cost={def.cost}
      canAfford={coins >= def.cost}
      onBuy={onBuy}
      onEquip={onEquip}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: def.background,
      }} />
    </Tile>
  );
}

function EmotePreview({
  id, unlocked, equipped, coins, onBuy, onEquip,
}: { id: EmoteId; unlocked: boolean; equipped: boolean; coins: number; onBuy: () => void; onEquip: () => void }) {
  const def = EMOTES[id];
  return (
    <Tile
      name={def.name}
      description={def.description}
      equipped={equipped}
      unlocked={unlocked}
      cost={def.cost}
      canAfford={coins >= def.cost}
      onBuy={onBuy}
      onEquip={onEquip}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, #fff8e8 0%, #ffe0bf 100%)',
        display: 'grid', placeItems: 'center',
        padding: 4,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 18, fontWeight: 800, lineHeight: 1.05,
            background: `linear-gradient(180deg, ${def.glow ?? '#ff9f1c'}, #ee5a52)`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: '"Fredoka", system-ui',
          }}>
            {def.headline}
          </div>
          {def.sub && (
            <div style={{ fontSize: 9, color: '#6e5a52', fontStyle: 'italic', marginTop: 2 }}>
              {def.sub}
            </div>
          )}
          <Sparkles size={10} color={def.glow ?? '#ff9f1c'} style={{ marginTop: 2 }} />
        </div>
      </div>
    </Tile>
  );
}
