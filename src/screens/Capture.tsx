import { useEffect, useRef, useState } from 'react';
import { Card } from '../components/Card';
import { ElementGlyph } from '../components/ElementGlyph';
import { ELEMENTS } from '../data/elements';
import { btnPrimary, btnSecondary, iconBtn } from '../components/styles';
import type { CollectionCard } from '../game/types';

type Stage = 'starting' | 'framing' | 'flashing' | 'revealed' | 'denied';

interface Props {
  template: CollectionCard | null;
  onComplete: (updated: CollectionCard) => void;
  onBack: () => void;
}

const PHOTO_SIZE = 720;

export function Capture({ template, onComplete, onBack }: Props) {
  const [stage, setStage] = useState<Stage>('starting');
  const [photo, setPhoto] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [needsTap, setNeedsTap] = useState(false);

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
          <button onClick={onBack} style={{ ...btnSecondary, width: 180, marginTop: 24 }}>← Back</button>
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
    onComplete({ ...template, photo, nickname: nickname.trim() || template.name });
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#000',
      color: '#fff', fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: stage === 'revealed'
          ? `radial-gradient(ellipse at 50% 30%, ${e.color}33, ${e.deep}88, #000 80%)`
          : 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #000 80%)',
        transition: 'background 0.6s',
      }} />

      {stage === 'flashing' && (
        <div style={{
          position: 'absolute', inset: 0, background: '#fff',
          animation: 'flash 0.4s ease-out',
          zIndex: 100,
        }} />
      )}

      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 2 }}>
        <button onClick={onBack} style={iconBtn}>←</button>
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
          textAlign: 'center', fontSize: 12, opacity: 0.7,
          padding: '0 30px', fontStyle: 'italic',
          position: 'relative', zIndex: 2,
        }}>
          Frame {template.suggested} to bring this card to life
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
          <div style={{ animation: 'cardSummon 0.6s cubic-bezier(.2,.8,.3,1)' }}>
            <Card
              card={{ ...template, photo, nickname: nickname || template.name }}
              displayName={nickname || template.name}
              hovered
              scale={1.05}
            />
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px 40px', position: 'relative', zIndex: 2 }}>
        {stage === 'framing' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
              <button onClick={() => fileInputRef.current?.click()} style={{
                background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.2)',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: 22,
                fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}>📁 File</button>
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
            <input
              value={nickname}
              onChange={ev => setNickname(ev.target.value)}
              placeholder={`Name your ${template.suggested.replace(/^(a |an )/, '')}…`}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.2)',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: 24,
                fontSize: 14, textAlign: 'center',
                marginBottom: 12,
                outline: 'none',
              }}
            />
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
        capture="environment"
        style={{ display: 'none' }}
        onChange={ev => {
          const file = ev.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
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
