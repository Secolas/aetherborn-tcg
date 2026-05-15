import { useMemo, useState } from 'react';
import { ArrowLeft, Lock, Flag, ChevronRight, Crown, Check, X, ScrollText, Coins } from 'lucide-react';
import { CAMPAIGNS, isArcUnlocked, isStopUnlocked, isArcComplete, type CampaignDef, type CampaignStop } from '../data/campaign';
import { getBoss } from '../data/bosses';
import { ELEMENTS } from '../data/elements';
import { PALETTE } from '../components/styles';
import type { CollectionCard, DeckSlot } from '../game/types';

const MIN_PLAYABLE_DECK = 8;

interface Props {
  progress: Record<string, number>;
  collection: CollectionCard[];
  decks: DeckSlot[];
  activeDeckId: string | undefined;
  onSetActiveDeck: (deckId: string) => void;
  onPickStop: (arcId: string, stopIndex: number) => void;
  onOpenDeckBuilder: () => void;
  onBack: () => void;
}

/**
 * Campaign — linear arc-by-arc journey screen.
 *
 * Top-level list of seven arcs. Each arc tile shows a theme-tinted
 * header band, four progress dots (one per stop), and a state badge
 * (Locked / In Progress / Complete). Tapping an unlocked arc opens
 * a slide-up sheet with the four stops; tapping a stop opens a
 * dialogue card with the boss's intro line and a Battle CTA.
 *
 * Match launches via onPickStop(arcId, stopIndex) — App resolves the
 * stop's bossId, sets activeCampaign, and routes to MatchBoard. After
 * the match, App returns the player here (not Home) so they see the
 * next stop unlock immediately.
 */
export function Campaign({
  progress, collection, decks, activeDeckId,
  onSetActiveDeck, onPickStop, onOpenDeckBuilder, onBack,
}: Props) {
  const [openArc, setOpenArc] = useState<string | null>(null);
  const [openStop, setOpenStop] = useState<{ arcId: string; stopIndex: number } | null>(null);

  // Resolve playable cards for the deck-ready chip.
  const activeDeck = useMemo(
    () => decks.find(d => d.id === activeDeckId) ?? decks[0] ?? null,
    [decks, activeDeckId],
  );
  const activePlayable = useMemo(() => {
    if (!activeDeck) return 0;
    const have = new Set(collection.filter(c => !!c.photo).map(c => c.uid));
    return activeDeck.uids.reduce((n, uid) => n + (have.has(uid) ? 1 : 0), 0);
  }, [activeDeck, collection]);
  const deckReady = activePlayable >= MIN_PLAYABLE_DECK;

  // Aggregate progress chip in the header.
  const arcsComplete = CAMPAIGNS.filter(a => isArcComplete(a.id, progress)).length;

  const dialogueArc = openStop ? CAMPAIGNS.find(c => c.id === openStop.arcId) ?? null : null;
  const dialogueStop: CampaignStop | null =
    dialogueArc && openStop ? dialogueArc.stops[openStop.stopIndex] : null;

  return (
    <div className="campaign-root">
      <CampaignStyles />

      {/* ─── Top bar ─── */}
      <div className="cm-topbar">
        <button className="cm-back" onClick={onBack} aria-label="Back to Home">
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
        <div className="cm-title">
          <Flag size={16} strokeWidth={2.4} color={PALETTE.accent} />
          <span>Campaign</span>
        </div>
        <span className="cm-progress-chip" aria-label={`${arcsComplete} of ${CAMPAIGNS.length} arcs complete`}>
          <strong>{arcsComplete}/{CAMPAIGNS.length}</strong> arcs
        </span>
      </div>

      {/* ─── Arc list ─── */}
      <div className="cm-body">
        <div className="cm-blurb">
          A linear journey. Beat every stop in an arc to unlock the next arc — and the boss in your picker.
        </div>
        <div className="cm-arc-list">
          {CAMPAIGNS.map((arc, i) => (
            <ArcTile
              key={arc.id}
              index={i}
              arc={arc}
              unlocked={isArcUnlocked(arc.id, progress)}
              complete={isArcComplete(arc.id, progress)}
              progress={progress[arc.id] ?? -1}
              onOpen={() => setOpenArc(arc.id)}
            />
          ))}
        </div>
      </div>

      {/* ─── Stop sheet (slide-up) ─── */}
      {openArc && (
        <ArcStopsSheet
          arc={CAMPAIGNS.find(c => c.id === openArc)!}
          progress={progress}
          onPickStop={(stopIndex) => setOpenStop({ arcId: openArc, stopIndex })}
          onClose={() => setOpenArc(null)}
        />
      )}

      {/* ─── Dialogue card (slide-up over stops) ─── */}
      {openStop && dialogueArc && dialogueStop && (
        <DialogueSheet
          arc={dialogueArc}
          stop={dialogueStop}
          stopIndex={openStop.stopIndex}
          deckReady={deckReady}
          activePlayable={activePlayable}
          activeDeck={activeDeck}
          decks={decks}
          onSetActiveDeck={onSetActiveDeck}
          onOpenDeckBuilder={onOpenDeckBuilder}
          onBattle={() => {
            onPickStop(openStop.arcId, openStop.stopIndex);
            setOpenStop(null);
            setOpenArc(null);
          }}
          onClose={() => setOpenStop(null)}
        />
      )}
    </div>
  );
}

// ─── Arc tile ───────────────────────────────────────────────────────

interface ArcTileProps {
  index: number;
  arc: CampaignDef;
  unlocked: boolean;
  complete: boolean;
  /** Highest stop beaten, or -1. */
  progress: number;
  onOpen: () => void;
}

function ArcTile({ index, arc, unlocked, complete, progress, onOpen }: ArcTileProps) {
  const themeColor = ELEMENTS[arc.themeId].color;
  const stopsBeaten = Math.max(0, progress + 1);
  const stopsTotal = arc.stops.length;
  const status =
    complete ? 'Complete'
    : !unlocked ? 'Locked'
    : stopsBeaten > 0 ? 'In Progress'
    : 'New';

  return (
    <button
      className="cm-arc-tile"
      data-locked={!unlocked}
      data-complete={complete}
      disabled={!unlocked}
      onClick={() => unlocked && onOpen()}
      style={{ '--arc-color': themeColor } as React.CSSProperties}
    >
      <div className="cm-arc-band" />
      <div className="cm-arc-row">
        <div className="cm-arc-number">
          {complete ? <Check size={18} strokeWidth={3} color="#fff" /> : index + 1}
        </div>
        <div className="cm-arc-info">
          <div className="cm-arc-title">{arc.title}</div>
          <div className="cm-arc-blurb">{arc.blurb}</div>
          <div className="cm-arc-dots" aria-label={`${stopsBeaten} of ${stopsTotal} stops beaten`}>
            {arc.stops.map((s, i) => (
              <span
                key={i}
                className="cm-arc-dot"
                data-filled={i <= progress}
                data-final={s.isFinal}
              />
            ))}
            <span className="cm-arc-dot-meta">{stopsBeaten}/{stopsTotal}</span>
          </div>
        </div>
        <div className="cm-arc-status">
          <span className="cm-arc-status-label" data-complete={complete}>{status}</span>
          {unlocked && !complete && <ChevronRight size={18} strokeWidth={2.4} />}
        </div>
      </div>
      {!unlocked && (
        <div className="cm-arc-veil" aria-hidden="true">
          <Lock size={22} color="#fff" strokeWidth={2.4} />
        </div>
      )}
    </button>
  );
}

// ─── Arc stops sheet ────────────────────────────────────────────────

interface ArcStopsSheetProps {
  arc: CampaignDef;
  progress: Record<string, number>;
  onPickStop: (stopIndex: number) => void;
  onClose: () => void;
}

function ArcStopsSheet({ arc, progress, onPickStop, onClose }: ArcStopsSheetProps) {
  const themeColor = ELEMENTS[arc.themeId].color;
  const arcProgress = progress[arc.id] ?? -1;
  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div
        className="cm-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ '--arc-color': themeColor } as React.CSSProperties}
      >
        <div className="cm-sheet-head">
          <div>
            <div className="cm-sheet-eyebrow">ARC · {arc.title.toUpperCase()}</div>
            <div className="cm-sheet-title">{arc.title}</div>
          </div>
          <button className="cm-sheet-close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
        <div className="cm-stop-list">
          {arc.stops.map((stop, i) => {
            const boss = getBoss(stop.bossId);
            const unlocked = isStopUnlocked(arc.id, i, progress);
            const beaten = arcProgress >= i;
            return (
              <button
                key={i}
                className="cm-stop"
                data-locked={!unlocked}
                data-beaten={beaten}
                data-final={stop.isFinal}
                disabled={!unlocked}
                onClick={() => unlocked && onPickStop(i)}
              >
                <div className="cm-stop-photo" style={{
                  backgroundImage: boss?.avatarPhoto ? `url(${boss.avatarPhoto})` : undefined,
                  background: boss?.avatarPhoto
                    ? `url(${boss.avatarPhoto}) center/cover`
                    : `linear-gradient(160deg, ${ELEMENTS[arc.themeId].deep} 0%, ${themeColor} 100%)`,
                }}>
                  {!boss?.avatarPhoto && <span>{boss?.avatar ?? '?'}</span>}
                  {stop.isFinal && (
                    <span className="cm-stop-crown" aria-label="Final boss">
                      <Crown size={12} strokeWidth={2.4} />
                    </span>
                  )}
                </div>
                <div className="cm-stop-info">
                  <div className="cm-stop-name">{boss?.name ?? stop.bossId}</div>
                  <div className="cm-stop-sub">{boss?.subtitle ?? ''}</div>
                </div>
                <div className="cm-stop-state">
                  {!unlocked && <Lock size={16} strokeWidth={2.4} />}
                  {unlocked && beaten && <Check size={16} strokeWidth={3} color={ELEMENTS.animals.color} />}
                  {unlocked && !beaten && <ChevronRight size={16} strokeWidth={2.4} />}
                </div>
              </button>
            );
          })}
        </div>
        {arc.nextArcHint && isArcCompleteAggregate(arc, progress) && (
          <div className="cm-next-hint">
            <ScrollText size={14} strokeWidth={2.4} color={PALETTE.textMid} />
            <em>{arc.nextArcHint}</em>
          </div>
        )}
      </div>
    </div>
  );
}

function isArcCompleteAggregate(arc: CampaignDef, progress: Record<string, number>): boolean {
  return (progress[arc.id] ?? -1) >= arc.stops.length - 1;
}

// ─── Dialogue sheet ─────────────────────────────────────────────────

interface DialogueSheetProps {
  arc: CampaignDef;
  stop: CampaignStop;
  stopIndex: number;
  deckReady: boolean;
  activePlayable: number;
  activeDeck: DeckSlot | null;
  decks: DeckSlot[];
  onSetActiveDeck: (deckId: string) => void;
  onOpenDeckBuilder: () => void;
  onBattle: () => void;
  onClose: () => void;
}

function DialogueSheet({
  arc, stop, stopIndex, deckReady, activePlayable, activeDeck, decks,
  onSetActiveDeck, onOpenDeckBuilder, onBattle, onClose,
}: DialogueSheetProps) {
  const boss = getBoss(stop.bossId);
  const themeColor = ELEMENTS[arc.themeId].color;
  if (!boss) return null;
  const reward = boss.rewardCoins;
  return (
    <div className="cm-backdrop cm-backdrop-front" onClick={onClose}>
      <div
        className="cm-dialogue"
        onClick={(e) => e.stopPropagation()}
        style={{ '--arc-color': themeColor } as React.CSSProperties}
      >
        <button className="cm-sheet-close" onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2.4} />
        </button>
        <div className="cm-dlg-stage" style={{
          backgroundImage: boss.backdrop ? `url(${boss.backdrop})` : undefined,
        }}>
          <div className="cm-dlg-stage-veil" />
          <div className="cm-dlg-portrait" style={{
            backgroundImage: boss.avatarPhoto ? `url(${boss.avatarPhoto})` : undefined,
            background: boss.avatarPhoto
              ? `url(${boss.avatarPhoto}) center/cover`
              : `linear-gradient(160deg, ${ELEMENTS[arc.themeId].deep} 0%, ${themeColor} 100%)`,
          }}>
            {!boss.avatarPhoto && <span>{boss.avatar}</span>}
            {stop.isFinal && (
              <span className="cm-dlg-crown" aria-label="Final boss">
                <Crown size={16} strokeWidth={2.4} />
              </span>
            )}
          </div>
        </div>
        <div className="cm-dlg-body">
          <div className="cm-dlg-eyebrow">
            STOP {stopIndex + 1} OF {arc.stops.length} · {arc.title.toUpperCase()}
          </div>
          <div className="cm-dlg-name">{boss.name}</div>
          <div className="cm-dlg-sub">{boss.subtitle}</div>
          <div className="cm-dlg-quote">"{stop.preDialogue}"</div>
          <div className="cm-dlg-playstyle">{boss.playstyle}</div>

          {/* Deck swap row */}
          {decks.length > 1 && (
            <div className="cm-dlg-decks">
              {decks.map(d => (
                <button
                  key={d.id}
                  className="cm-dlg-deck"
                  data-active={activeDeck?.id === d.id}
                  onClick={() => onSetActiveDeck(d.id)}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}

          {/* CTA */}
          <button
            className="cm-dlg-cta"
            onClick={deckReady ? onBattle : onOpenDeckBuilder}
            disabled={false}
          >
            {deckReady ? (
              <>
                <span>Battle</span>
                <span className="cm-dlg-reward">
                  <Coins size={13} color="#fff" strokeWidth={2.2} /> +{reward}
                </span>
              </>
            ) : (
              <>
                <Lock size={16} strokeWidth={2.4} />
                <span>Need {MIN_PLAYABLE_DECK - activePlayable} more in deck</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Scoped stylesheet ──────────────────────────────────────────────

function CampaignStyles() {
  return (
    <style>{`
      .campaign-root {
        position: absolute; inset: 0;
        background: ${PALETTE.bg};
        color: ${PALETTE.text};
        font-family: "Fredoka", "Inter", system-ui, sans-serif;
        display: flex; flex-direction: column;
        overflow: hidden;
      }

      /* Topbar — mirrors BossPicker / Cosmetics. */
      .cm-topbar {
        flex-shrink: 0;
        display: flex; align-items: center; gap: 12px;
        padding: max(14px, env(safe-area-inset-top, 14px)) 16px 12px 16px;
        background: ${PALETTE.paper};
        border-bottom: 1px solid ${PALETTE.border};
      }
      .cm-back {
        width: 36px; height: 36px;
        display: grid; place-items: center;
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 10px;
        color: ${PALETTE.text};
        cursor: pointer;
      }
      .cm-title {
        flex: 1;
        display: flex; align-items: center; gap: 8px;
        font-size: 17px; font-weight: 700;
        letter-spacing: -0.01em;
      }
      .cm-progress-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 6px 12px;
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 999px;
        font-size: 12px; color: ${PALETTE.textMid};
        font-weight: 600;
      }
      .cm-progress-chip strong { color: ${PALETTE.text}; font-weight: 800; }

      /* Body */
      .cm-body {
        flex: 1; min-height: 0;
        overflow-y: auto;
        padding: 16px;
        display: flex; flex-direction: column; gap: 14px;
      }
      .cm-blurb {
        font-size: 13px; color: ${PALETTE.textMid};
        line-height: 1.45;
        padding: 4px 4px 0 4px;
      }
      .cm-arc-list {
        display: flex; flex-direction: column; gap: 12px;
      }

      /* Arc tile */
      .cm-arc-tile {
        position: relative;
        text-align: left;
        background: ${PALETTE.paper};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 18px;
        padding: 0;
        cursor: pointer;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(58,46,42,.06);
        transition: transform .15s, box-shadow .15s;
        font-family: inherit;
      }
      .cm-arc-tile:not([data-locked="true"]):hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 18px rgba(58,46,42,.10);
      }
      .cm-arc-tile[data-locked="true"] {
        opacity: 0.5; cursor: not-allowed;
      }
      .cm-arc-tile[data-complete="true"] .cm-arc-band {
        opacity: 0.6;
      }
      .cm-arc-band {
        height: 6px;
        background: linear-gradient(90deg, var(--arc-color), color-mix(in srgb, var(--arc-color) 60%, #fff));
      }
      .cm-arc-row {
        display: flex; align-items: center; gap: 14px;
        padding: 14px 16px;
      }
      .cm-arc-number {
        width: 38px; height: 38px; flex-shrink: 0;
        display: grid; place-items: center;
        border-radius: 50%;
        background: var(--arc-color);
        color: #fff;
        font-weight: 800; font-size: 16px;
        box-shadow: 0 2px 6px rgba(58,46,42,.18);
      }
      .cm-arc-tile[data-complete="true"] .cm-arc-number {
        background: ${ELEMENTS.animals.color}; /* OWNED green */
      }
      .cm-arc-info { flex: 1; min-width: 0; }
      .cm-arc-title {
        font-size: 15px; font-weight: 700;
        letter-spacing: -0.01em;
        margin-bottom: 2px;
      }
      .cm-arc-blurb {
        font-size: 12px; color: ${PALETTE.textMid};
        line-height: 1.35;
        margin-bottom: 8px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .cm-arc-dots {
        display: flex; align-items: center; gap: 4px;
      }
      .cm-arc-dot {
        width: 9px; height: 9px; border-radius: 50%;
        background: ${PALETTE.bgPeach};
        border: 1.5px solid ${PALETTE.border};
        flex-shrink: 0;
      }
      .cm-arc-dot[data-filled="true"] {
        background: var(--arc-color);
        border-color: var(--arc-color);
      }
      .cm-arc-dot[data-final="true"] {
        width: 11px; height: 11px;
        box-shadow: 0 0 0 1.5px ${PALETTE.paper}, 0 0 0 3px var(--arc-color);
      }
      .cm-arc-dot[data-final="true"][data-filled="true"] {
        background: var(--arc-color);
      }
      .cm-arc-dot-meta {
        margin-left: 6px;
        font-size: 11px; font-weight: 600;
        color: ${PALETTE.textMid};
      }
      .cm-arc-status {
        display: flex; align-items: center; gap: 4px;
        flex-shrink: 0;
        color: ${PALETTE.textMid};
      }
      .cm-arc-status-label {
        font-size: 11px; font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: ${PALETTE.textMid};
      }
      .cm-arc-status-label[data-complete="true"] {
        color: ${ELEMENTS.animals.color};
      }
      .cm-arc-veil {
        position: absolute; inset: 0;
        background: rgba(28,24,20,.32);
        display: grid; place-items: center;
        pointer-events: none;
      }

      /* Sheet backdrop + slide-up */
      .cm-backdrop {
        position: absolute; inset: 0;
        background: rgba(28,24,20,.55);
        z-index: 200;
        display: flex; align-items: flex-end; justify-content: center;
        animation: cmFade .15s ease-out;
      }
      .cm-backdrop-front { z-index: 220; }
      @keyframes cmFade { from { opacity: 0; } to { opacity: 1; } }

      .cm-sheet, .cm-dialogue {
        background: ${PALETTE.paper};
        width: 100%; max-width: 520px;
        max-height: 90vh;
        border-radius: 22px 22px 0 0;
        box-shadow: 0 -10px 30px rgba(28,24,20,.25);
        animation: cmSlideUp .25s cubic-bezier(.2,.85,.3,1);
        display: flex; flex-direction: column;
        overflow: hidden;
        position: relative;
      }
      @keyframes cmSlideUp {
        from { transform: translateY(40px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .cm-sheet-head {
        flex-shrink: 0;
        padding: 18px 18px 12px 18px;
        display: flex; align-items: flex-start; gap: 12px;
        border-bottom: 1px solid ${PALETTE.border};
      }
      .cm-sheet-head > div:first-child { flex: 1; min-width: 0; }
      .cm-sheet-eyebrow {
        font-size: 10px; font-weight: 800; letter-spacing: 0.12em;
        color: var(--arc-color);
        margin-bottom: 2px;
      }
      .cm-sheet-title {
        font-size: 18px; font-weight: 700;
        letter-spacing: -0.01em;
      }
      .cm-sheet-close {
        width: 32px; height: 32px;
        display: grid; place-items: center;
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 8px;
        cursor: pointer;
        color: ${PALETTE.text};
        flex-shrink: 0;
      }

      /* Stop list */
      .cm-stop-list {
        flex: 1; min-height: 0;
        overflow-y: auto;
        padding: 12px;
        display: flex; flex-direction: column; gap: 8px;
      }
      .cm-stop {
        position: relative;
        display: flex; align-items: center; gap: 12px;
        padding: 10px 14px 10px 10px;
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 14px;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        color: ${PALETTE.text};
        transition: transform .12s, background .15s;
      }
      .cm-stop:not([data-locked="true"]):hover {
        transform: translateX(2px);
        background: ${PALETTE.paper};
      }
      .cm-stop[data-locked="true"] {
        opacity: 0.5; cursor: not-allowed;
      }
      .cm-stop[data-final="true"] {
        background: linear-gradient(180deg, ${PALETTE.paper}, color-mix(in srgb, var(--arc-color) 8%, ${PALETTE.bg}));
        border-color: color-mix(in srgb, var(--arc-color) 40%, ${PALETTE.border});
      }
      .cm-stop-photo {
        position: relative;
        width: 46px; height: 46px; border-radius: 50%;
        flex-shrink: 0;
        display: grid; place-items: center;
        color: #fff; font-weight: 800; font-size: 18px;
        box-shadow: inset 0 0 0 2px ${PALETTE.paper}, inset 0 0 0 3px rgba(58,46,42,.18);
      }
      .cm-stop-crown {
        position: absolute; top: -4px; right: -4px;
        width: 20px; height: 20px; border-radius: 50%;
        background: ${PALETTE.yellow};
        color: ${PALETTE.text};
        display: grid; place-items: center;
        box-shadow: 0 0 0 2px ${PALETTE.paper};
      }
      .cm-stop-info { flex: 1; min-width: 0; }
      .cm-stop-name {
        font-size: 14px; font-weight: 700;
        letter-spacing: -0.01em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cm-stop-sub {
        font-size: 11px; color: ${PALETTE.textMid};
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cm-stop-state { flex-shrink: 0; color: ${PALETTE.textMid}; display: grid; place-items: center; }

      .cm-next-hint {
        flex-shrink: 0;
        padding: 12px 18px;
        border-top: 1px solid ${PALETTE.border};
        display: flex; align-items: center; gap: 8px;
        font-size: 12px; color: ${PALETTE.textMid};
        font-style: italic;
      }

      /* Dialogue sheet */
      .cm-dialogue { max-width: 480px; }
      .cm-dialogue .cm-sheet-close {
        position: absolute; top: 12px; right: 12px; z-index: 2;
        background: rgba(255,255,255,.92);
      }
      .cm-dlg-stage {
        position: relative;
        height: 140px;
        background-size: cover; background-position: center;
        background-color: ${PALETTE.bgPeach};
        display: flex; align-items: flex-end; justify-content: center;
        padding-bottom: 24px;
      }
      .cm-dlg-stage-veil {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, rgba(28,24,20,.18) 0%, rgba(28,24,20,.55) 100%);
      }
      .cm-dlg-portrait {
        position: relative; z-index: 1;
        width: 88px; height: 88px;
        border-radius: 50%;
        background-size: cover; background-position: center;
        display: grid; place-items: center;
        color: #fff; font-weight: 800; font-size: 32px;
        box-shadow: 0 0 0 4px ${PALETTE.paper}, 0 6px 14px rgba(28,24,20,.30);
        transform: translateY(28px);
      }
      .cm-dlg-crown {
        position: absolute; top: -6px; right: -6px;
        width: 28px; height: 28px; border-radius: 50%;
        background: ${PALETTE.yellow};
        color: ${PALETTE.text};
        display: grid; place-items: center;
        box-shadow: 0 0 0 3px ${PALETTE.paper}, 0 2px 6px rgba(28,24,20,.20);
      }
      .cm-dlg-body {
        padding: 40px 22px 22px 22px;
        display: flex; flex-direction: column;
        text-align: center;
        gap: 6px;
      }
      .cm-dlg-eyebrow {
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.14em;
        color: var(--arc-color);
      }
      .cm-dlg-name {
        font-size: 22px; font-weight: 700;
        letter-spacing: -0.01em;
      }
      .cm-dlg-sub {
        font-size: 12px; color: ${PALETTE.textMid};
        font-style: italic;
        margin-bottom: 10px;
      }
      .cm-dlg-quote {
        font-size: 16px;
        color: ${PALETTE.text};
        font-weight: 600;
        line-height: 1.4;
        padding: 14px 16px;
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 14px;
        margin: 6px 0 10px 0;
      }
      .cm-dlg-playstyle {
        font-size: 12px; color: ${PALETTE.textMid};
        line-height: 1.45;
        margin-bottom: 14px;
      }
      .cm-dlg-decks {
        display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
        margin-bottom: 12px;
      }
      .cm-dlg-deck {
        background: ${PALETTE.bg};
        border: 1.5px solid ${PALETTE.border};
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 11px; font-weight: 600;
        color: ${PALETTE.textMid};
        cursor: pointer;
        font-family: inherit;
      }
      .cm-dlg-deck[data-active="true"] {
        background: ${PALETTE.text};
        color: ${PALETTE.paper};
        border-color: ${PALETTE.text};
      }
      .cm-dlg-cta {
        display: flex; align-items: center; justify-content: center; gap: 10px;
        background: linear-gradient(180deg, #ffa07a 0%, ${PALETTE.accent} 60%, ${PALETTE.accentDeep} 100%);
        color: #fff;
        border: none;
        border-radius: 999px;
        padding: 16px 22px;
        font-size: 15px; font-weight: 700;
        letter-spacing: 0.02em;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(238,90,82,.32);
        font-family: inherit;
        margin-top: 4px;
      }
      .cm-dlg-cta:disabled, .cm-dlg-cta[disabled] {
        background: ${PALETTE.textLight};
        box-shadow: none;
        cursor: not-allowed;
      }
      .cm-dlg-reward {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 12px; font-weight: 700;
        background: rgba(0,0,0,.16);
        border-radius: 999px;
        padding: 4px 10px;
      }

      /* Desktop tweaks — bring max widths up and pad more. */
      @container (min-width: 1024px) {
        .cm-body { padding: 22px 32px; }
      }
    `}</style>
  );
}
