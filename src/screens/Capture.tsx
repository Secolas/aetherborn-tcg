import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FolderOpen, Lock, Coins, Check, BookHeart } from 'lucide-react';
import { Card } from '../components/Card';
import { TiltCard } from '../components/TiltCard';
import { ElementGlyph } from '../components/ElementGlyph';
import { ELEMENTS } from '../data/elements';
import { btnPrimary, btnSecondary, iconBtn } from '../components/styles';
import { FILTER_ORDER, FILTERS, type FilterId } from '../data/filters';
import { SmartImage } from '../components/SmartImage';
import type { CollectionCard } from '../game/types';

type Stage = 'starting' | 'framing' | 'flashing' | 'revealed' | 'denied';

interface Props {
  template: CollectionCard | null;
  /** Coin balance — needed to gate filter purchases inline. */
  coins?: number;
  /** Filters the player owns. Defaults to a safe starter set. */
  unlockedFilters?: FilterId[];
  /** Called when the player buys a filter from the cosmetic picker. The
   *  parent should debit coins and add the filter to the unlocked list. */
  onBuyFilter?: (filterId: FilterId, cost: number) => void;
  onComplete: (updated: CollectionCard) => void;
  onBack: () => void;
}

const PHOTO_SIZE = 720;

export function Capture({ template, coins = 0, unlockedFilters = ['none', 'sepia'], onBuyFilter, onComplete, onBack }: Props) {
  const [stage, setStage] = useState<Stage>('starting');
  const [photo, setPhoto] = useState<string | null>(null);
  // Free-form story the player attaches to this card. Optional —
  // empty memory is fine, the card just doesn't get the ⓘ marker.
  const [memory, setMemory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  // Cosmetic filter applied to the captured photo. Defaults to 'none' so
  // the player sees their photo unmodified first; tapping a chip swaps
  // it live without re-running capture.
  const [filterId, setFilterId] = useState<FilterId>('none');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Acquire the camera once when we have a template.
  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    let s: MediaStream | null = null;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStage('denied');
        setError('Camera API not available');
        return;
      }
      try {
        // Try environment camera first; fall back to any.
        try {
          s = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
        } catch {
          s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        setStream(s);
        setStage('framing');
      } catch (err) {
        setStage('denied');
        setError(err instanceof Error ? err.message : 'Camera unavailable');
      }
    };

    start();

    return () => {
      cancelled = true;
      s?.getTracks().forEach(t => t.stop());
      setStream(null);
    };
  }, [template]);

  // Attach the stream to the video element after both exist (stage transitions
  // to 'framing' AND the <video> has mounted).
  useEffect(() => {
    if (!stream) return;
    if (stage !== 'framing' && stage !== 'flashing') return;
    const video = videoRef.current;
    if (!video) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const tryPlay = async () => {
      try {
        await video.play();
        setNeedsTap(false);
      } catch {
        // Autoplay blocked — surface a "tap to start" overlay
        setNeedsTap(true);
      }
    };

    const onLoaded = () => { tryPlay(); };
    const onPlaying = () => { setNeedsTap(false); };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('playing', onPlaying);

    if (video.readyState >= 1) onLoaded();
    else tryPlay();

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('playing', onPlaying);
    };
  }, [stream, stage]);

  if (!template) {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: '#0a0c1c', color: '#fff',
        display: 'grid', placeItems: 'center',
        fontFamily: 'Inter', textAlign: 'center', padding: 40,
      }}>
        <div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>Pick a dormant card<br />from your collection<br />to summon.</div>
          <button onClick={onBack} style={{ ...btnSecondary, width: 180, marginTop: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><ArrowLeft size={14} /> Back</button>
        </div>
      </div>
    );
  }

  const e = ELEMENTS[template.el];

  const handleTapToPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.play().then(() => setNeedsTap(false)).catch(() => {});
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext('2d')!;
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - minDim) / 2;
    const sy = (video.videoHeight - minDim) / 2;
    ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    finishWith(dataUrl);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = PHOTO_SIZE;
        canvas.height = PHOTO_SIZE;
        const ctx = canvas.getContext('2d')!;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
        finishWith(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const finishWith = (dataUrl: string) => {
    setPhoto(dataUrl);
    setStage('flashing');
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    window.setTimeout(() => setStage('revealed'), 700);
  };

  const finalize = () => {
    if (!photo) return;
    const trimmed = memory.trim();
    onComplete({
      ...template,
      photo,
      // Always clear the legacy nickname so any stale value is gone.
      nickname: undefined,
      memory: trimmed.length > 0 ? trimmed : undefined,
      filterId: filterId === 'none' ? undefined : filterId,
    });
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#000',
      color: '#fff', fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      // On short viewports (iPad landscape, phones with browser chrome
      // visible) the FilterPicker + memory textarea + "Add to
      // Collection" button stack would push the button below the fold
      // with overflow: hidden — the player was stranded mid-summon.
      // Allow vertical scroll instead so the button is always
      // reachable, even if it means scrolling to it on tight heights.
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      <div style={{
        position: 'fixed', inset: 0,
        background: stage === 'revealed'
          ? `radial-gradient(ellipse at 50% 30%, ${e.color}33, ${e.deep}88, #000 80%)`
          : 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #000 80%)',
        transition: 'background 0.6s',
        pointerEvents: 'none',
      }} />

      {stage === 'flashing' && (
        <div style={{
          position: 'absolute', inset: 0, background: '#fff',
          animation: 'flash 0.4s ease-out',
          zIndex: 100,
        }} />
      )}

      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 2 }}>
        <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', opacity: 0.6 }}>
            {stage === 'revealed' ? 'Summoned!' : 'Summoning'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: '"Cinzel", Georgia, serif', marginTop: 2 }}>
            {template.name}
          </div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      {(stage === 'framing' || stage === 'denied') && (
        <div style={{
          textAlign: 'center', fontSize: 12, opacity: 0.75,
          padding: '0 30px', position: 'relative', zIndex: 2,
        }}>
          <div style={{ fontStyle: 'italic' }}>
            Frame {template.suggested} to bring this card to life
          </div>
          {stage === 'framing' && (
            <div style={{
              fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase',
              marginTop: 6, opacity: 0.7, fontWeight: 600,
            }}>
              Pick a filter on the next screen
            </div>
          )}
        </div>
      )}

      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 2,
      }}>
        {stage === 'starting' && (
          <div style={{ opacity: 0.6, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Starting camera…
          </div>
        )}

        {(stage === 'framing' || stage === 'flashing') && (
          <CardShapedViewfinder template={template}>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              {...{ 'webkit-playsinline': 'true' }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
            />
            {needsTap && (
              <div onClick={handleTapToPlay} style={{
                position: 'absolute', inset: 0,
                display: 'grid', placeItems: 'center',
                background: 'rgba(0,0,0,.6)',
                color: '#f4d04a', fontSize: 11,
                letterSpacing: '0.2em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}>tap to start</div>
            )}
          </CardShapedViewfinder>
        )}

        {stage === 'denied' && (
          <CardShapedViewfinder template={template}>
            <div style={{
              width: '100%', height: '100%',
              display: 'grid', placeItems: 'center',
              background: 'repeating-linear-gradient(45deg, #1a1a2e 0 8px, #14142a 8px 16px)',
              color: '#aaa', fontFamily: 'ui-monospace, monospace',
              fontSize: 9, letterSpacing: '0.2em', textAlign: 'center', padding: 12,
            }}>
              Camera unavailable.<br />Pick a photo instead.
            </div>
          </CardShapedViewfinder>
        )}

        {stage === 'revealed' && photo && (
          <div style={{ animation: 'cardSummon 0.6s cubic-bezier(.2,.8,.3,1)', willChange: 'transform, opacity' }}>
            <TiltCard
              maxTilt={12}
              hoverScale={1.05}
              shine={template.rarity !== 'common'}
              style={{ borderRadius: 19 }}
            >
              <Card
                card={{
                  ...template, photo,
                  memory: memory.trim() ? memory.trim() : undefined,
                  filterId: filterId === 'none' ? undefined : filterId,
                }}
                hovered
                scale={1.05}
              />
            </TiltCard>
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px max(40px, env(safe-area-inset-bottom, 40px))', position: 'relative', zIndex: 2 }}>
        {stage === 'framing' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
              <button onClick={() => fileInputRef.current?.click()} aria-label="Pick from files" style={{
                background: 'rgba(255,255,255,.10)',
                border: '1.5px solid rgba(255,255,255,.25)',
                color: '#fff',
                width: 56, height: 56, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                cursor: 'pointer',
              }}>
                <FolderOpen size={22} />
              </button>
              <button onClick={captureFromVideo} aria-label="Take photo" style={{
                width: 72, height: 72, borderRadius: '50%',
                background: '#fff', border: '4px solid rgba(255,255,255,.4)',
                cursor: 'pointer',
                boxShadow: '0 0 0 2px #fff inset, 0 4px 20px rgba(255,255,255,.3)',
              }} />
              <div style={{ width: 64 }} />
            </div>
            <div style={{
              textAlign: 'center', fontSize: 10, opacity: 0.5,
              marginTop: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>
              Tap shutter
            </div>
          </>
        )}

        {stage === 'denied' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ ...btnPrimary, width: '100%' }}>
              📁 Pick a photo
            </button>
            <div style={{ textAlign: 'center', fontSize: 10, opacity: 0.5 }}>{error}</div>
          </div>
        )}

        {stage === 'revealed' && (
          <>
            <FilterPicker
              photo={photo}
              filterId={filterId}
              unlockedFilters={unlockedFilters}
              coins={coins}
              onPick={setFilterId}
              onBuy={onBuyFilter}
            />
            <div style={{
              marginBottom: 12,
              padding: '12px 14px',
              background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.2)',
              borderRadius: 16,
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,.65)', fontWeight: 700,
                marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <BookHeart size={12} strokeWidth={2.4} />
                <span>Memory · optional</span>
              </div>
              <textarea
                value={memory}
                onChange={ev => setMemory(ev.target.value.slice(0, 280))}
                placeholder={memoryPlaceholder(template.name)}
                rows={3}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  padding: 0,
                  fontSize: 13, lineHeight: 1.4,
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                }}
              />
              <div style={{
                marginTop: 4,
                display: 'flex', justifyContent: 'space-between',
                fontSize: 9.5, color: 'rgba(255,255,255,.45)',
                fontStyle: 'italic',
              }}>
                <span>Write whatever you want to remember about this card.</span>
                <span>{memory.length}/280</span>
              </div>
            </div>
            <button onClick={finalize} style={{ ...btnPrimary, width: '100%' }}>
              Add to Collection
            </button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={ev => {
          const file = ev.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

/**
 * Horizontal strip of small filter previews shown after the photo lands.
 * Each chip uses the actual captured photo as the preview — tapping one
 * swaps the cosmetic on the big card above so the player sees the change
 * live before committing. Locked filters render with a coin badge and a
 * "Buy" tap action; the parent debits coins and unlocks via onBuy.
 */
function FilterPicker({
  photo, filterId, unlockedFilters, coins, onPick, onBuy,
}: {
  photo: string | null;
  filterId: FilterId;
  unlockedFilters: FilterId[];
  coins: number;
  onPick: (id: FilterId) => void;
  onBuy?: (id: FilterId, cost: number) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,.55)', textAlign: 'center', marginBottom: 8,
        fontWeight: 600,
      }}>
        Cosmetic Filter
      </div>
      <div
        className="no-scrollbar"
        style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          padding: '4px 4px 8px',
          scrollSnapType: 'x mandatory',
        }}>
        {FILTER_ORDER.map(id => {
          const f = FILTERS[id];
          const locked = !unlockedFilters.includes(id);
          const selected = filterId === id;
          const canAfford = coins >= f.cost;
          const handleClick = () => {
            if (locked) {
              if (onBuy && canAfford) onBuy(id, f.cost);
              return;
            }
            onPick(id);
          };
          return (
            <button
              key={id}
              onClick={handleClick}
              disabled={locked && (!onBuy || !canAfford)}
              aria-label={`${f.name}${locked ? ' (locked)' : ''}`}
              style={{
                position: 'relative',
                flex: '0 0 auto',
                width: 64, padding: 0,
                borderRadius: 12,
                border: selected ? '2px solid #f4d04a' : '2px solid rgba(255,255,255,.15)',
                background: 'rgba(255,255,255,.06)',
                cursor: locked && (!onBuy || !canAfford) ? 'not-allowed' : 'pointer',
                overflow: 'hidden',
                color: '#fff', fontFamily: 'inherit',
                opacity: locked && !canAfford ? 0.55 : 1,
                scrollSnapAlign: 'start',
              }}
            >
              <div style={{
                position: 'relative', width: '100%', height: 64,
                overflow: 'hidden',
                background: '#0a0a14',
              }}>
                {photo ? (
                  <SmartImage
                    src={photo}
                    alt=""
                    fallbackSeed={id}
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                      filter: f.cssFilter === 'none' ? undefined : f.cssFilter,
                    }}
                  />
                ) : null}
                {f.overlay && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: f.overlay.background,
                    mixBlendMode: f.overlay.mixBlendMode,
                    pointerEvents: 'none',
                  }} />
                )}
                {locked && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,.55)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Lock size={18} color="#fff" />
                  </div>
                )}
                {selected && !locked && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#f4d04a', color: '#3a2e2a',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </div>
              <div style={{
                padding: '4px 2px 5px',
                fontSize: 9.5, fontWeight: 700,
                letterSpacing: '0.05em', textAlign: 'center',
              }}>
                {f.name}
              </div>
              {locked && f.cost > 0 && (
                <div style={{
                  fontSize: 8.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 2, color: canAfford ? '#ffd166' : '#ff7e5f',
                  paddingBottom: 4,
                }}>
                  <Coins size={9} fill="#ffd166" color="#e8a93a" strokeWidth={2.2} />
                  {f.cost}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div style={{
        fontSize: 10, opacity: 0.55, textAlign: 'center', marginTop: 2,
        fontStyle: 'italic',
      }}>
        {FILTERS[filterId].description}
      </div>
    </div>
  );
}

/**
 * Friendly per-template prompt that nudges the player toward a useful
 * memory ("This is Hachi, shiba inu, very independent." for Family Pet,
 * "Where did we go?" for a travel card, etc.). Falls back to a generic
 * line if we don't have a tailored suggestion.
 */
function memoryPlaceholder(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('pet'))        return 'e.g. This is Hachi, our shiba inu — stubborn, smart, very independent.';
  if (lower.includes('mom'))        return 'e.g. The way she always knows when you skipped dinner.';
  if (lower.includes('dad'))        return 'e.g. Quiet hands, loud laugh, taught me to ride a bike.';
  if (lower.includes('sibling'))    return 'e.g. Three years older, stole my hoodies, would still fight anyone for me.';
  if (lower.includes('birthday'))   return 'e.g. The year we forgot the candles and used a lighter.';
  if (lower.includes('cake'))       return 'e.g. Tía always brings tres leches and pretends she didn\'t.';
  if (lower.includes('coffee'))     return 'e.g. The 6am cafecito that gets me through Mondays.';
  if (lower.includes('soup'))       return 'e.g. Abuela\'s — only her recipe tastes like home.';
  return 'e.g. Where you were, who was there, what made it matter.';
}

function CardShapedViewfinder({ template, children }: { template: CollectionCard; children: React.ReactNode }) {
  const e = ELEMENTS[template.el];
  return (
    <div style={{ position: 'relative', width: 240, height: 350 }}>
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: 18,
        border: `2px solid ${e.glow}`,
        boxShadow: `0 0 40px ${e.color}66, inset 0 0 20px ${e.deep}55`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        top: 50, left: 14, right: 14, bottom: 90,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#0a0a14',
      }}>
        {children}
        {[
          { top: 8, left: 8, borderTop: '2px solid #fff', borderLeft: '2px solid #fff' },
          { top: 8, right: 8, borderTop: '2px solid #fff', borderRight: '2px solid #fff' },
          { bottom: 8, left: 8, borderBottom: '2px solid #fff', borderLeft: '2px solid #fff' },
          { bottom: 8, right: 8, borderBottom: '2px solid #fff', borderRight: '2px solid #fff' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: 18, height: 18, ...s, pointerEvents: 'none' }} />
        ))}
      </div>
      <div style={{
        position: 'absolute', top: 14, left: 12, right: 12,
        display: 'flex', alignItems: 'center', gap: 8,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: '#fef4d8', color: e.deep,
          fontSize: 18, fontWeight: 800,
          display: 'grid', placeItems: 'center',
          fontFamily: '"Fredoka", system-ui',
        }}>{template.cost}</div>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: '"Fredoka", system-ui' }}>{template.name}</div>
        <ElementGlyph el={template.el} size={18} />
      </div>
      {template.type === 'Creature' && (
        <>
          <div style={{
            position: 'absolute', bottom: 10, left: 12,
            width: 32, height: 32, borderRadius: '50%',
            background: '#f4d04a', color: '#5a3a0e',
            fontSize: 18, fontWeight: 800,
            display: 'grid', placeItems: 'center',
            fontFamily: '"Fredoka", system-ui',
            pointerEvents: 'none',
          }}>{template.atk}</div>
          <div style={{
            position: 'absolute', bottom: 10, right: 12,
            width: 32, height: 32, borderRadius: '50%',
            background: '#e85a5a', color: '#5a1414',
            fontSize: 18, fontWeight: 800,
            display: 'grid', placeItems: 'center',
            fontFamily: '"Fredoka", system-ui',
            pointerEvents: 'none',
          }}>{template.hp}</div>
        </>
      )}
      <div style={{
        position: 'absolute', bottom: 50, left: 18, right: 18,
        fontSize: 10, color: '#aaa', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.3,
        pointerEvents: 'none',
      }}>{template.ability}</div>
    </div>
  );
}
