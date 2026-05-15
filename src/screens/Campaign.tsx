import { useMemo, useState } from 'react';
import { ArrowLeft, Lock, Star, ChevronRight, Crown, Check, X, Coins } from 'lucide-react';
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
 * Campaign — "Memory Lane" winding-path arc selector.
 *
 * Each of the seven arcs is a stop on a winding bezier path across the
 * stage. The currently-selected arc shows in the floating bottom panel
 * with a "Walk This Path" CTA that opens the existing four-stop sheet
 * (and from there, the dialogue card → battle).
 *
 * Layout follows the Memory Lane design handoff: warm radial backdrop,
 * decorative hills + trees, three-pass dashed path (shadow / cream
 * footstep dashes / accent dashes), and per-arc circular markers with
 * a "you are here" walker pip at the first un-beaten arc.
 *
 * Data layer is unchanged — the seven CAMPAIGNS arcs (starting with
 * Mom / arc-family) and their four stops each are rendered as before;
 * only the arc-selection surface is redesigned.
 */

// Hand-mapped per-arc "region" labels for the map tags. Theme-pure,
// short, and slightly playful — chosen to match each arc's finale
// rather than its mini bosses.
const ARC_REGIONS: Record<string, string> = {
  'arc-family':    'Home',
  'arc-animals':   'The Wild',
  'arc-work':      'The Office',
  'arc-food':      'The Kitchen',
  'arc-education': 'Schoolhouse',
  'arc-travel':    'Departure',
  'arc-couple':    'Date Night',
};

// Desktop / wide layout — horizontal zigzag across a 980x660 stage.
const DESKTOP_STOPS: { arcId: string; x: number; y: number }[] = [
  { arcId: 'arc-family',    x: 0.08, y: 0.65 },
  { arcId: 'arc-animals',   x: 0.24, y: 0.32 },
  { arcId: 'arc-work',      x: 0.40, y: 0.72 },
  { arcId: 'arc-food',      x: 0.55, y: 0.30 },
  { arcId: 'arc-education', x: 0.71, y: 0.66 },
  { arcId: 'arc-travel',    x: 0.85, y: 0.32 },
  { arcId: 'arc-couple',    x: 0.95, y: 0.72 },
];

// Mobile / portrait — vertical zigzag down a 390x920 stage. Final arc
// sits at center-bottom for emphasis (same as the design's "Future You").
const MOBILE_STOPS: { arcId: string; x: number; y: number }[] = [
  { arcId: 'arc-family',    x: 0.22, y: 0.16 },
  { arcId: 'arc-animals',   x: 0.74, y: 0.27 },
  { arcId: 'arc-work',      x: 0.26, y: 0.39 },
  { arcId: 'arc-food',      x: 0.72, y: 0.51 },
  { arcId: 'arc-education', x: 0.28, y: 0.63 },
  { arcId: 'arc-travel',    x: 0.72, y: 0.75 },
  { arcId: 'arc-couple',    x: 0.50, y: 0.87 },
];

export function Campaign({
  progress, collection, decks, activeDeckId,
  onSetActiveDeck, onPickStop, onOpenDeckBuilder, onBack,
}: Props) {
  // Default-select the first un-completed arc — what the walker pip
  // also lands on. Players see "where they are" the moment they open
  // the screen.
  const firstUnfinishedArc = CAMPAIGNS.find(c => !isArcComplete(c.id, progress))?.id ?? CAMPAIGNS[0].id;
  const [selectedArcId, setSelectedArcId] = useState<string>(firstUnfinishedArc);
  const [stopsSheetArc, setStopsSheetArc] = useState<string | null>(null);
  const [dialogueStop, setDialogueStop] = useState<{ arcId: string; stopIndex: number } | null>(null);

  // Deck-readiness — surfaced in the dialogue sheet so the player knows
  // whether the Battle CTA will fire or punt to the deck builder.
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

  const selectedArc = CAMPAIGNS.find(c => c.id === selectedArcId) ?? CAMPAIGNS[0];
  const selectedUnlocked = isArcUnlocked(selectedArc.id, progress);

  const dialogueArc = dialogueStop ? CAMPAIGNS.find(c => c.id === dialogueStop.arcId) ?? null : null;
  const dialogueStopData: CampaignStop | null =
    dialogueArc && dialogueStop ? dialogueArc.stops[dialogueStop.stopIndex] : null;

  return (
    <div className="cm-root">
      <CampaignStyles />

      {/* Back button — floats over the top-right of the map so it
          doesn't clip the rotated title block. */}
      <button className="cm-back" onClick={onBack} aria-label="Back to Home">
        <ArrowLeft size={18} strokeWidth={2.4} />
      </button>

      {/* Stage — the Memory Lane scene. */}
      <div className="cm-stage" data-stage>
        <MemoryLane
          layout="mobile"
          progress={progress}
          selectedArcId={selectedArcId}
          onSelectArc={setSelectedArcId}
        />
        <MemoryLane
          layout="desktop"
          progress={progress}
          selectedArcId={selectedArcId}
          onSelectArc={setSelectedArcId}
        />
      </div>

      {/* Floating bottom panel — "vs. The Selected Arc" with Walk CTA. */}
      <SelectedArcPanel
        arc={selectedArc}
        unlocked={selectedUnlocked}
        progress={progress[selectedArc.id] ?? -1}
        onWalk={() => setStopsSheetArc(selectedArc.id)}
      />

      {/* Stops sheet — slides up from selecting "Walk This Path". */}
      {stopsSheetArc && (
        <ArcStopsSheet
          arc={CAMPAIGNS.find(c => c.id === stopsSheetArc)!}
          progress={progress}
          onPickStop={(stopIndex) => setDialogueStop({ arcId: stopsSheetArc, stopIndex })}
          onClose={() => setStopsSheetArc(null)}
        />
      )}

      {/* Dialogue sheet — slides up over the stops sheet. */}
      {dialogueStop && dialogueArc && dialogueStopData && (
        <DialogueSheet
          arc={dialogueArc}
          stop={dialogueStopData}
          stopIndex={dialogueStop.stopIndex}
          deckReady={deckReady}
          activePlayable={activePlayable}
          activeDeck={activeDeck}
          decks={decks}
          onSetActiveDeck={onSetActiveDeck}
          onOpenDeckBuilder={onOpenDeckBuilder}
          onBattle={() => {
            onPickStop(dialogueStop.arcId, dialogueStop.stopIndex);
            setDialogueStop(null);
            setStopsSheetArc(null);
          }}
          onClose={() => setDialogueStop(null)}
        />
      )}
    </div>
  );
}

// ─── Memory Lane stage ──────────────────────────────────────────────

interface MemoryLaneProps {
  layout: 'mobile' | 'desktop';
  progress: Record<string, number>;
  selectedArcId: string;
  onSelectArc: (arcId: string) => void;
}

/**
 * One layout of the winding path. Two are rendered per Campaign mount;
 * a container query in the stylesheet hides whichever one doesn't fit
 * the current breakpoint. Keeps both layouts statically composed so
 * neither needs JS resize listening.
 */
function MemoryLane({ layout, progress, selectedArcId, onSelectArc }: MemoryLaneProps) {
  const isMobile = layout === 'mobile';
  const W = isMobile ? 390 : 980;
  const H = isMobile ? 920 : 660;
  const stops = isMobile ? MOBILE_STOPS : DESKTOP_STOPS;

  // Path math — exact transcription of the design handoff. Mobile bows
  // the curve out horizontally (midpoint Y as control point); desktop
  // bows it out vertically (midpoint X as control point).
  const pathD = useMemo(() => {
    return stops.reduce((d, s, i) => {
      const x = s.x * W;
      const y = s.y * H + (isMobile ? 20 : 40);
      if (i === 0) return `M ${x} ${y}`;
      const prev = stops[i - 1];
      const px = prev.x * W;
      const py = prev.y * H + (isMobile ? 20 : 40);
      if (isMobile) {
        const my = (py + y) / 2;
        return `${d} C ${px} ${my}, ${x} ${my}, ${x} ${y}`;
      }
      const mx = (px + x) / 2;
      return `${d} C ${mx} ${py}, ${mx} ${y}, ${x} ${y}`;
    }, '');
  }, [stops, W, H, isMobile]);

  // Walker pip — sits at the first un-completed arc. If every arc is
  // beaten, it lingers at the final arc instead of snapping to index 0.
  const walkerIdx = useMemo(() => {
    const firstOpen = stops.findIndex(s => !isArcComplete(s.arcId, progress));
    return firstOpen === -1 ? stops.length - 1 : firstOpen;
  }, [stops, progress]);
  const walkerStop = stops[walkerIdx];

  const markerSize = isMobile ? 76 : 96;
  const badgeSize = isMobile ? 22 : 26;
  const walkerSize = isMobile ? 32 : 36;
  const labelSize = isMobile ? 15 : 17;
  const subSize = isMobile ? 9 : 10;
  const pathShadowW = isMobile ? 12 : 14;
  const pathDotsW = isMobile ? 5 : 6;
  const pathAccentW = isMobile ? 2.5 : 3;
  const pathDotsDash = isMobile ? '0 12' : '0 14';
  const pathAccentDash = isMobile ? '10 8' : '12 10';

  return (
    <div className="cm-lane" data-layout={layout} style={{ aspectRatio: `${W} / ${H}` }}>
      {/* Cream/wheat radial backdrop with soft colored blooms. */}
      <div className="cm-lane-bg" />

      {/* Decorative SVG layer — hills + trees + path. */}
      <svg className="cm-lane-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`cm-hill1-${layout}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a3c08a" stopOpacity={isMobile ? '0.45' : '0.5'} />
            <stop offset="100%" stopColor="#7b9f6e" stopOpacity={isMobile ? '0.25' : '0.3'} />
          </linearGradient>
          <linearGradient id={`cm-hill2-${layout}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#d4a86a" stopOpacity={isMobile ? '0.45' : '0.5'} />
            <stop offset="100%" stopColor="#a87a4a" stopOpacity={isMobile ? '0.22' : '0.25'} />
          </linearGradient>
        </defs>
        {isMobile ? (
          <>
            <path d={`M 0 ${H * 0.90} C ${W * 0.3} ${H * 0.85}, ${W * 0.6} ${H * 0.95}, ${W} ${H * 0.88} L ${W} ${H} L 0 ${H} Z`} fill={`url(#cm-hill1-${layout})`} />
            <path d={`M 0 ${H * 0.96} C ${W * 0.4} ${H * 0.92}, ${W * 0.7} ${H * 0.98}, ${W} ${H * 0.94} L ${W} ${H} L 0 ${H} Z`} fill={`url(#cm-hill2-${layout})`} />
            {[[0.08, 0.16], [0.92, 0.32], [0.06, 0.55], [0.95, 0.72]].map(([tx, ty], i) => (
              <g key={i} transform={`translate(${tx * W}, ${ty * H})`}>
                <rect x="-2" y="0" width="3" height="10" fill="#6b3a1a" opacity="0.4" />
                <circle cx="0" cy="-3" r="9" fill="#5e7f4e" opacity="0.45" />
              </g>
            ))}
          </>
        ) : (
          <>
            <path d={`M 0 ${H * 0.85} C ${W * 0.2} ${H * 0.7}, ${W * 0.35} ${H * 0.92}, ${W * 0.55} ${H * 0.82} S ${W * 0.85} ${H * 0.7}, ${W} ${H * 0.82} L ${W} ${H} L 0 ${H} Z`} fill={`url(#cm-hill1-${layout})`} />
            <path d={`M 0 ${H * 0.92} C ${W * 0.25} ${H * 0.85}, ${W * 0.5} ${H * 1.0}, ${W * 0.75} ${H * 0.88} S ${W * 0.95} ${H * 0.95}, ${W} ${H * 0.94} L ${W} ${H} L 0 ${H} Z`} fill={`url(#cm-hill2-${layout})`} />
            {[[0.04, 0.85], [0.34, 0.55], [0.64, 0.88], [0.92, 0.55]].map(([tx, ty], i) => (
              <g key={i} transform={`translate(${tx * W}, ${ty * H})`}>
                <rect x="-2" y="0" width="4" height="14" fill="#6b3a1a" opacity="0.5" />
                <circle cx="0" cy="-4" r="14" fill="#5e7f4e" opacity="0.5" />
              </g>
            ))}
          </>
        )}
        {/* Three-pass dashed path — shadow, cream footstep dots, accent dashes. */}
        <path d={pathD} stroke="rgba(28,24,20,0.18)" strokeWidth={pathShadowW} fill="none" strokeLinecap="round" />
        <path d={pathD} stroke="#fff8ec" strokeWidth={pathDotsW} fill="none" strokeDasharray={pathDotsDash} strokeLinecap="round" />
        <path d={pathD} stroke="#c44e44" strokeWidth={pathAccentW} fill="none" strokeDasharray={pathAccentDash} strokeLinecap="round" />
      </svg>

      {/* Region labels — handwritten, slightly rotated. */}
      {stops.map((s, i) => {
        const rotation = i % 2 === 0 ? -3 : 2;
        const left = isMobile
          ? (s.x > 0.5 ? `${s.x * 100}%` : `${s.x * 100}%`)
          : `${s.x * 100}%`;
        const offsetLeft = isMobile ? (s.x > 0.5 ? -90 : 50) : 50;
        const top = isMobile
          ? `calc(${s.y * 100}% - 4px)`
          : `calc(${s.y * 100}% + 100px + ${i % 2 === 0 ? 8 : -28}px)`;
        return (
          <div
            key={`r-${s.arcId}`}
            className="cm-region"
            style={{
              left,
              top,
              marginLeft: offsetLeft,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {ARC_REGIONS[s.arcId] ?? ''}
          </div>
        );
      })}

      {/* Stops — 7 circular arc markers. */}
      {stops.map((s) => {
        const arc = CAMPAIGNS.find(c => c.id === s.arcId);
        if (!arc) return null;
        const unlocked = isArcUnlocked(s.arcId, progress);
        const complete = isArcComplete(s.arcId, progress);
        const selected = s.arcId === selectedArcId;
        const themeColor = ELEMENTS[arc.themeId].color;
        // Use the finale boss's avatar photo as the marker's inner image.
        const finaleBoss = getBoss(arc.stops[arc.stops.length - 1].bossId);
        const innerPhoto = finaleBoss?.avatarPhoto;
        return (
          <button
            key={s.arcId}
            className="cm-stop"
            data-selected={selected}
            data-locked={!unlocked}
            data-complete={complete}
            onClick={() => onSelectArc(s.arcId)}
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
            }}
            aria-label={`${arc.title} — ${complete ? 'Complete' : unlocked ? 'In Progress' : 'Locked'}`}
          >
            <div
              className="cm-marker"
              style={{
                width: markerSize,
                height: markerSize,
                borderColor: selected ? themeColor : unlocked ? '#b8703a' : '#8a6b4a',
                boxShadow: selected
                  ? `0 0 0 ${isMobile ? 3 : 4}px ${themeColor}44, 0 ${isMobile ? 10 : 14}px ${isMobile ? 18 : 24}px -${isMobile ? 6 : 8}px rgba(0,0,0,0.35)`
                  : `0 10px 0 rgba(0,0,0,0.08), 0 ${isMobile ? 10 : 14}px ${isMobile ? 18 : 24}px -${isMobile ? 6 : 8}px rgba(0,0,0,0.35)`,
              }}
            >
              <div
                className="cm-marker-photo"
                style={{
                  width: innerPhoto ? `${markerSize - 16}px` : `${markerSize - 16}px`,
                  height: markerSize - 16,
                  backgroundImage: innerPhoto ? `url(${innerPhoto})` : undefined,
                  background: innerPhoto
                    ? `url(${innerPhoto}) center/cover`
                    : `linear-gradient(160deg, ${ELEMENTS[arc.themeId].deep} 0%, ${themeColor} 100%)`,
                }}
              />
              {complete && (
                <span
                  className="cm-stop-beaten"
                  style={{ width: badgeSize, height: badgeSize }}
                  aria-label="Complete"
                >
                  <Star size={isMobile ? 11 : 14} strokeWidth={2.4} color="#fff" fill="#fff" />
                </span>
              )}
              {!unlocked && (
                <span className="cm-stop-veil" aria-hidden="true">
                  <Lock size={isMobile ? 18 : 22} color="#fff" strokeWidth={2.4} />
                </span>
              )}
            </div>
            <div className="cm-stop-label" style={{ fontSize: labelSize }}>{arc.title}</div>
            <div className="cm-stop-sub" style={{ fontSize: subSize }}>{ARC_REGIONS[s.arcId]}</div>
          </button>
        );
      })}

      {/* Walker pip — "you are here". */}
      {walkerStop && (
        <div
          className="cm-walker"
          style={{
            left: `${walkerStop.x * 100}%`,
            top: `${walkerStop.y * 100}%`,
            width: walkerSize,
            height: walkerSize,
            marginLeft: isMobile ? (walkerStop.x > 0.5 ? 16 : -56) : -60,
            marginTop: isMobile ? -38 : -50,
          }}
          aria-label="You are here"
        >
          {/* Walking-figure icon — inline SVG so we don't pull a new lucide piece. */}
          <svg width={isMobile ? 16 : 20} height={isMobile ? 16 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-3 4 3 4-2 4 3 6M9 14l-3 4" />
          </svg>
        </div>
      )}

      {/* Title block — handwritten, rotated. */}
      <div className="cm-title" data-layout={layout}>
        <div className="cm-title-eyebrow">YOUR MAP</div>
        <div className="cm-title-h1">Memory Lane</div>
        <div className="cm-title-tagline">walk it. fight what you find.</div>
      </div>
    </div>
  );
}

// ─── Selected arc panel ────────────────────────────────────────────

interface SelectedArcPanelProps {
  arc: CampaignDef;
  unlocked: boolean;
  progress: number;
  onWalk: () => void;
}

function SelectedArcPanel({ arc, unlocked, progress, onWalk }: SelectedArcPanelProps) {
  const themeColor = ELEMENTS[arc.themeId].color;
  const beaten = Math.max(0, progress + 1);
  const total = arc.stops.length;
  const complete = progress >= total - 1;
  return (
    <div
      className="cm-panel"
      style={{ borderLeft: `4px solid ${themeColor}` }}
    >
      <div className="cm-panel-info">
        <div className="cm-panel-eyebrow" style={{ color: themeColor }}>
          {ARC_REGIONS[arc.id] ?? 'Arc'}
        </div>
        <div className="cm-panel-name">{arc.title}</div>
        <div className="cm-panel-blurb">"{arc.blurb}"</div>
        <div className="cm-panel-stats">
          <span className="cm-panel-pips" aria-label={`${beaten} of ${total} beaten`}>
            {arc.stops.map((_, i) => (
              <span
                key={i}
                className="cm-panel-pip"
                data-filled={i <= progress}
                style={{ background: i <= progress ? themeColor : 'rgba(28,24,20,0.18)' }}
              />
            ))}
          </span>
          <span>·</span>
          <span>{beaten}/{total} STOPS</span>
        </div>
      </div>
      <button
        className="cm-panel-cta"
        data-locked={!unlocked}
        disabled={!unlocked}
        onClick={() => unlocked && onWalk()}
      >
        {!unlocked ? (
          <>
            <Lock size={14} strokeWidth={2.4} />
            <span>Locked</span>
          </>
        ) : complete ? (
          <>
            <Check size={14} strokeWidth={2.8} />
            <span>Revisit</span>
          </>
        ) : (
          <>
            <ChevronRight size={14} strokeWidth={2.4} />
            <span>Walk</span>
          </>
        )}
      </button>
    </div>
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
            <div className="cm-sheet-eyebrow">{(ARC_REGIONS[arc.id] ?? 'ARC').toUpperCase()}</div>
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
                className="cm-srow"
                data-locked={!unlocked}
                data-beaten={beaten}
                data-final={stop.isFinal}
                disabled={!unlocked}
                onClick={() => unlocked && onPickStop(i)}
              >
                <div className="cm-srow-photo" style={{
                  backgroundImage: boss?.avatarPhoto ? `url(${boss.avatarPhoto})` : undefined,
                  background: boss?.avatarPhoto
                    ? `url(${boss.avatarPhoto}) center/cover`
                    : `linear-gradient(160deg, ${ELEMENTS[arc.themeId].deep} 0%, ${themeColor} 100%)`,
                }}>
                  {!boss?.avatarPhoto && <span>{boss?.avatar ?? '?'}</span>}
                  {stop.isFinal && (
                    <span className="cm-srow-crown" aria-label="Final boss">
                      <Crown size={12} strokeWidth={2.4} />
                    </span>
                  )}
                </div>
                <div className="cm-srow-info">
                  <div className="cm-srow-name">{boss?.name ?? stop.bossId}</div>
                  <div className="cm-srow-sub">{boss?.subtitle ?? ''}</div>
                </div>
                <div className="cm-srow-state">
                  {!unlocked && <Lock size={16} strokeWidth={2.4} />}
                  {unlocked && beaten && <Check size={16} strokeWidth={3} color={ELEMENTS.animals.color} />}
                  {unlocked && !beaten && <ChevronRight size={16} strokeWidth={2.4} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
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
            STOP {stopIndex + 1} OF {arc.stops.length} · {(ARC_REGIONS[arc.id] ?? arc.title).toUpperCase()}
          </div>
          <div className="cm-dlg-name">{boss.name}</div>
          <div className="cm-dlg-sub">{boss.subtitle}</div>
          <div className="cm-dlg-quote">"{stop.preDialogue}"</div>
          <div className="cm-dlg-playstyle">{boss.playstyle}</div>
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
          <button
            className="cm-dlg-cta"
            onClick={deckReady ? onBattle : onOpenDeckBuilder}
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
      @import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Fraunces:wght@800&display=swap');

      .cm-root {
        --c-family:    ${ELEMENTS.family.color};
        --c-work:      ${ELEMENTS.work.color};
        --c-animals:   ${ELEMENTS.animals.color};
        --c-travel:    ${ELEMENTS.travel.color};
        --c-food:      ${ELEMENTS.food.color};
        --c-education: ${ELEMENTS.education.color};

        --ink:       #1c1814;
        --ink-soft:  #4a3f33;
        --ink-mute:  #8a7a68;
        --paper:     #fff8ec;
        --rule:      rgba(28,24,20,0.10);

        --font-display: "Fraunces", Georgia, serif;
        --font-sans:    "Fredoka", "Inter", system-ui, sans-serif;
        --font-marker:  "Patrick Hand", "Fredoka", cursive;

        position: absolute; inset: 0;
        background: ${PALETTE.bg};
        color: var(--ink);
        font-family: var(--font-sans);
        display: flex; flex-direction: column;
        overflow: hidden;
        container-type: inline-size;
      }

      .cm-back {
        position: absolute;
        top: max(14px, env(safe-area-inset-top, 14px));
        right: 14px;
        z-index: 10;
        width: 36px; height: 36px;
        display: grid; place-items: center;
        background: var(--paper);
        border: 1.5px solid var(--rule);
        border-radius: 10px;
        color: var(--ink);
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(28,24,20,.10);
      }

      .cm-stage {
        flex: 1; min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        position: relative;
        padding: 0;
      }

      /* Container-query swap between mobile (vertical) and desktop
         (horizontal) layouts. Both are present in the DOM; the wrong
         one is display:none for the current breakpoint. */
      .cm-lane[data-layout="desktop"] { display: none; }
      @container (min-width: 720px) {
        .cm-lane[data-layout="desktop"] { display: block; }
        .cm-lane[data-layout="mobile"]  { display: none; }
      }

      /* Stage backdrop */
      .cm-lane {
        position: relative;
        width: 100%;
        max-width: 980px;
        margin: 0 auto;
      }
      .cm-lane-bg {
        position: absolute; inset: 0;
        background:
          radial-gradient(ellipse 220px 160px at 18% 78%, rgba(63, 116, 72, 0.18), transparent 70%),
          radial-gradient(ellipse 260px 180px at 82% 22%, rgba(107, 63, 142, 0.14), transparent 70%),
          radial-gradient(ellipse 240px 160px at 50% 86%, rgba(180, 92, 70, 0.16), transparent 70%),
          radial-gradient(ellipse at 50% 30%, #fff5dd, #f1dba4 60%, #e7c277 100%);
      }
      .cm-lane-svg {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        pointer-events: none;
      }

      /* Region labels — handwritten tags. */
      .cm-region {
        position: absolute;
        pointer-events: none;
        font-family: var(--font-marker);
        color: var(--ink-soft);
        font-size: 14px;
        white-space: nowrap;
        z-index: 1;
      }
      .cm-region::after {
        content: "";
        display: block;
        width: 36px; height: 2px;
        margin-top: 2px;
        background: var(--ink-soft);
        opacity: 0.5;
      }
      @container (min-width: 720px) {
        .cm-region { font-size: 18px; }
        .cm-region::after { width: 40px; }
      }

      /* Stop button — circular marker + label + sub. */
      .cm-stop {
        position: absolute;
        transform: translate(-50%, -50%);
        background: transparent;
        border: 0; padding: 0;
        cursor: pointer;
        text-align: center;
        font-family: inherit;
        color: var(--ink);
        display: flex; flex-direction: column; align-items: center;
        z-index: 2;
        transition: transform .2s;
      }
      .cm-stop:not([data-locked="true"]):hover { transform: translate(-50%, calc(-50% - 4px)) scale(1.05); }
      .cm-stop[data-locked="true"] { cursor: not-allowed; }
      .cm-stop[data-locked="true"] .cm-stop-label { color: var(--ink-mute); }

      .cm-marker {
        position: relative;
        border-radius: 50%;
        border-width: 4px;
        border-style: solid;
        background: white;
        display: grid; place-items: center;
      }
      .cm-marker-photo {
        border-radius: 50%;
        background-size: cover; background-position: center;
      }
      .cm-stop-beaten {
        position: absolute;
        top: -8px; right: -8px;
        border-radius: 50%;
        background: #3f7448;
        color: #fff;
        display: grid; place-items: center;
        border: 2px solid #fff;
      }
      .cm-stop-veil {
        position: absolute; inset: 0;
        border-radius: 50%;
        background: rgba(0,0,0,0.55);
        display: grid; place-items: center;
        color: #fff;
      }
      .cm-stop-label {
        font-family: var(--font-marker);
        font-weight: 700;
        margin-top: 8px;
        color: var(--ink);
        text-shadow: 0 1px 0 rgba(255,255,255,.6);
        white-space: nowrap;
      }
      .cm-stop-sub {
        font-family: var(--font-sans);
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-mute);
        margin-top: 2px;
      }

      .cm-walker {
        position: absolute;
        z-index: 3;
        border-radius: 50%;
        background: var(--c-family);
        color: #fff;
        display: grid; place-items: center;
        box-shadow: 0 8px 16px -4px rgba(196,78,68,0.6);
        pointer-events: none;
      }

      /* Title block — handwritten, rotated. */
      .cm-title {
        position: absolute;
        top: 14px; left: 18px;
        display: flex; flex-direction: column;
        z-index: 4;
        transform: rotate(-2deg);
        transform-origin: top left;
        max-width: calc(100% - 70px);
        pointer-events: none;
      }
      .cm-title[data-layout="desktop"] {
        top: 24px; left: 28px;
        transform: rotate(-3deg);
      }
      .cm-title-eyebrow {
        font-family: var(--font-sans);
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--ink-soft);
      }
      .cm-title-h1 {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 26px;
        color: var(--ink);
        letter-spacing: -0.02em;
        line-height: 1;
        white-space: nowrap;
      }
      .cm-title-tagline {
        font-family: var(--font-marker);
        font-size: 13px;
        color: var(--ink-soft);
        margin-top: 2px;
        white-space: nowrap;
      }
      @container (min-width: 720px) {
        .cm-title-eyebrow { font-size: 14px; }
        .cm-title-h1     { font-size: 32px; }
        .cm-title-tagline { font-size: 16px; }
      }

      /* Selected arc panel — fixed bottom, mirrors the design's
         .selected-panel exactly. */
      .cm-panel {
        position: absolute;
        bottom: max(16px, env(safe-area-inset-bottom, 16px));
        left: 16px; right: 16px;
        background: var(--paper);
        border-radius: 14px;
        padding: 14px 16px;
        box-shadow: 0 18px 36px -10px rgba(0,0,0,0.35);
        display: flex; gap: 14px; align-items: center;
        z-index: 50;
      }
      .cm-panel-info { flex: 1; min-width: 0; }
      .cm-panel-eyebrow {
        font-family: var(--font-sans);
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .cm-panel-name {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 20px;
        line-height: 1;
        color: var(--ink);
      }
      .cm-panel-blurb {
        font-family: var(--font-display);
        font-style: italic;
        font-size: 13px;
        color: var(--ink-soft);
        margin-top: 4px;
        line-height: 1.35;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .cm-panel-stats {
        display: flex; gap: 8px; align-items: center;
        margin-top: 6px;
        font-family: var(--font-sans);
        font-size: 11px; font-weight: 700;
        color: var(--ink-mute);
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }
      .cm-panel-pips { display: inline-flex; gap: 4px; }
      .cm-panel-pip {
        width: 9px; height: 9px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.5);
      }
      .cm-panel-cta {
        background: var(--ink);
        color: #fff;
        border: 0;
        border-radius: 999px;
        padding: 12px 22px;
        font-family: var(--font-sans);
        font-size: 14px; font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        display: inline-flex; align-items: center; gap: 8px;
        margin-left: auto;
        flex-shrink: 0;
        transition: transform .15s;
      }
      .cm-panel-cta:not([data-locked="true"]):hover { transform: translateY(-2px); }
      .cm-panel-cta[data-locked="true"], .cm-panel-cta:disabled {
        background: var(--ink-mute);
        cursor: not-allowed;
      }
      @container (min-width: 720px) {
        .cm-panel { max-width: 980px; left: 50%; transform: translateX(-50%); }
      }

      /* ─── Slide-up sheets (stops + dialogue) ─── */
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
        background: var(--paper);
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
        to   { transform: translateY(0); opacity: 1; }
      }

      .cm-sheet-head {
        flex-shrink: 0;
        padding: 18px 18px 12px 18px;
        display: flex; align-items: flex-start; gap: 12px;
        border-bottom: 1px solid var(--rule);
      }
      .cm-sheet-head > div:first-child { flex: 1; min-width: 0; }
      .cm-sheet-eyebrow {
        font-family: var(--font-sans);
        font-size: 10px; font-weight: 800; letter-spacing: 0.16em;
        color: var(--arc-color);
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .cm-sheet-title {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 22px;
        line-height: 1;
        letter-spacing: -0.01em;
      }
      .cm-sheet-close {
        width: 32px; height: 32px;
        display: grid; place-items: center;
        background: ${PALETTE.bg};
        border: 1.5px solid var(--rule);
        border-radius: 8px;
        cursor: pointer;
        color: var(--ink);
        flex-shrink: 0;
      }

      .cm-stop-list {
        flex: 1; min-height: 0;
        overflow-y: auto;
        padding: 12px;
        display: flex; flex-direction: column; gap: 8px;
      }
      .cm-srow {
        position: relative;
        display: flex; align-items: center; gap: 12px;
        padding: 10px 14px 10px 10px;
        background: ${PALETTE.bg};
        border: 1.5px solid var(--rule);
        border-radius: 14px;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        color: var(--ink);
        transition: transform .12s, background .15s;
      }
      .cm-srow:not([data-locked="true"]):hover {
        transform: translateX(2px);
        background: var(--paper);
      }
      .cm-srow[data-locked="true"] { opacity: 0.5; cursor: not-allowed; }
      .cm-srow[data-final="true"] {
        background: linear-gradient(180deg, var(--paper), color-mix(in srgb, var(--arc-color) 8%, ${PALETTE.bg}));
        border-color: color-mix(in srgb, var(--arc-color) 40%, var(--rule));
      }
      .cm-srow-photo {
        position: relative;
        width: 46px; height: 46px; border-radius: 50%;
        flex-shrink: 0;
        display: grid; place-items: center;
        color: #fff; font-weight: 800; font-size: 18px;
        box-shadow: inset 0 0 0 2px var(--paper), inset 0 0 0 3px rgba(58,46,42,.18);
      }
      .cm-srow-crown {
        position: absolute; top: -4px; right: -4px;
        width: 20px; height: 20px; border-radius: 50%;
        background: ${PALETTE.yellow};
        color: var(--ink);
        display: grid; place-items: center;
        box-shadow: 0 0 0 2px var(--paper);
      }
      .cm-srow-info { flex: 1; min-width: 0; }
      .cm-srow-name {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 15px;
        letter-spacing: -0.01em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cm-srow-sub {
        font-size: 11px; color: var(--ink-mute);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cm-srow-state {
        flex-shrink: 0; color: var(--ink-mute);
        display: grid; place-items: center;
      }

      /* Dialogue sheet — boss intro card. */
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
        box-shadow: 0 0 0 4px var(--paper), 0 6px 14px rgba(28,24,20,.30);
        transform: translateY(28px);
      }
      .cm-dlg-crown {
        position: absolute; top: -6px; right: -6px;
        width: 28px; height: 28px; border-radius: 50%;
        background: ${PALETTE.yellow};
        color: var(--ink);
        display: grid; place-items: center;
        box-shadow: 0 0 0 3px var(--paper), 0 2px 6px rgba(28,24,20,.20);
      }
      .cm-dlg-body {
        padding: 40px 22px 22px 22px;
        display: flex; flex-direction: column;
        text-align: center;
        gap: 6px;
      }
      .cm-dlg-eyebrow {
        font-family: var(--font-sans);
        font-size: 10px; font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--arc-color);
      }
      .cm-dlg-name {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 24px;
        letter-spacing: -0.01em;
        line-height: 1;
      }
      .cm-dlg-sub {
        font-size: 12px; color: var(--ink-mute);
        font-style: italic;
        margin-bottom: 10px;
      }
      .cm-dlg-quote {
        font-family: var(--font-display);
        font-size: 16px;
        font-style: italic;
        color: var(--ink);
        line-height: 1.4;
        padding: 14px 16px;
        background: ${PALETTE.bg};
        border: 1.5px solid var(--rule);
        border-radius: 14px;
        margin: 6px 0 10px 0;
      }
      .cm-dlg-playstyle {
        font-size: 12px; color: var(--ink-mute);
        line-height: 1.45;
        margin-bottom: 14px;
      }
      .cm-dlg-decks {
        display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
        margin-bottom: 12px;
      }
      .cm-dlg-deck {
        background: ${PALETTE.bg};
        border: 1.5px solid var(--rule);
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 11px; font-weight: 600;
        color: var(--ink-mute);
        cursor: pointer;
        font-family: inherit;
      }
      .cm-dlg-deck[data-active="true"] {
        background: var(--ink);
        color: var(--paper);
        border-color: var(--ink);
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
      .cm-dlg-reward {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 12px; font-weight: 700;
        background: rgba(0,0,0,.16);
        border-radius: 999px;
        padding: 4px 10px;
      }
    `}</style>
  );
}
