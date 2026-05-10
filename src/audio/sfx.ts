/**
 * Lightweight Web Audio synth so we can ship sound without bundling files.
 * Every cue is a few oscillator + envelope nodes. The AudioContext is lazily
 * created on first user interaction (browsers require a gesture). All cues
 * respect the global SFX volume — pass it in, no hidden state.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
  } catch {
    return null;
  }
  return ctx;
}

/** Resume the context after a user gesture. Call from any tap/click handler. */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

type Cue = 'cardPlay' | 'attack' | 'damage' | 'summon' | 'win' | 'lose' | 'tap' | 'turn';

interface ToneOpts {
  type: OscillatorType;
  freq: number;
  /** Optional frequency target — sweeps from `freq` to this value over `dur`. */
  freqTo?: number;
  /** Seconds. */
  dur: number;
  /** Peak gain (0..1). */
  gain: number;
  /** Seconds — when the note starts relative to "now". */
  delay?: number;
  /** Attack/release shaping. Defaults give a soft pluck. */
  attack?: number;
  release?: number;
}

function tone(c: AudioContext, master: GainNode, masterVol: number, opts: ToneOpts) {
  const start = c.currentTime + (opts.delay ?? 0);
  const end = start + opts.dur;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.freqTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(0.001, opts.freqTo), end);
  }
  const peak = opts.gain * masterVol;
  const a = opts.attack ?? 0.005;
  const r = opts.release ?? 0.04;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + a);
  g.gain.linearRampToValueAtTime(peak * 0.6, end - r);
  g.gain.linearRampToValueAtTime(0, end);
  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(end + 0.02);
}

/** Play a named SFX cue at the given volume (0..1). No-op if vol<=0 or
 *  if Web Audio is unavailable. */
export function playSfx(cue: Cue, vol: number): void {
  if (vol <= 0) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  if (c.state === 'suspended') void c.resume();
  const master = masterGain;

  switch (cue) {
    case 'cardPlay':
      // soft thump — woody downward sine
      tone(c, master, vol, { type: 'sine', freq: 320, freqTo: 140, dur: 0.18, gain: 0.32 });
      tone(c, master, vol, { type: 'triangle', freq: 220, freqTo: 110, dur: 0.16, gain: 0.18, delay: 0.005 });
      break;
    case 'tap':
      // very short click — for UI taps
      tone(c, master, vol, { type: 'square', freq: 880, freqTo: 660, dur: 0.05, gain: 0.12 });
      break;
    case 'attack':
      // sharp thwack — saw sweep down
      tone(c, master, vol, { type: 'sawtooth', freq: 760, freqTo: 180, dur: 0.13, gain: 0.30 });
      tone(c, master, vol, { type: 'square', freq: 220, freqTo: 90, dur: 0.10, gain: 0.18, delay: 0.02 });
      break;
    case 'damage':
      // dull thud + short noise-ish square
      tone(c, master, vol, { type: 'sawtooth', freq: 160, freqTo: 60, dur: 0.18, gain: 0.34 });
      tone(c, master, vol, { type: 'square', freq: 80, freqTo: 40, dur: 0.16, gain: 0.20, delay: 0.01 });
      break;
    case 'summon':
      // bright shimmer — 3-note arpeggio up
      tone(c, master, vol, { type: 'triangle', freq: 523, dur: 0.08, gain: 0.22, delay: 0.00 });   // C5
      tone(c, master, vol, { type: 'triangle', freq: 659, dur: 0.08, gain: 0.22, delay: 0.06 });   // E5
      tone(c, master, vol, { type: 'triangle', freq: 880, dur: 0.20, gain: 0.26, delay: 0.12 });   // A5
      tone(c, master, vol, { type: 'sine',     freq: 1320, dur: 0.18, gain: 0.10, delay: 0.14 });  // sparkle
      break;
    case 'win':
      // ascending major triad fanfare
      tone(c, master, vol, { type: 'triangle', freq: 523, dur: 0.18, gain: 0.30, delay: 0.00 });   // C5
      tone(c, master, vol, { type: 'triangle', freq: 659, dur: 0.18, gain: 0.30, delay: 0.14 });   // E5
      tone(c, master, vol, { type: 'triangle', freq: 784, dur: 0.36, gain: 0.32, delay: 0.28 });   // G5
      tone(c, master, vol, { type: 'sine',     freq: 1047, dur: 0.36, gain: 0.18, delay: 0.32 }); // C6 sparkle
      break;
    case 'lose':
      // descending minor — sad horn-ish
      tone(c, master, vol, { type: 'sawtooth', freq: 392, dur: 0.22, gain: 0.26, delay: 0.00 });   // G4
      tone(c, master, vol, { type: 'sawtooth', freq: 311, dur: 0.22, gain: 0.26, delay: 0.18 });   // Eb4
      tone(c, master, vol, { type: 'sawtooth', freq: 233, dur: 0.50, gain: 0.30, delay: 0.36 });  // Bb3
      break;
    case 'turn':
      // soft "ding" for turn change
      tone(c, master, vol, { type: 'sine', freq: 660, freqTo: 880, dur: 0.18, gain: 0.18 });
      tone(c, master, vol, { type: 'sine', freq: 1320, dur: 0.16, gain: 0.10, delay: 0.02 });
      break;
  }
}
