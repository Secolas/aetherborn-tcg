/**
 * Lightweight Web Audio synth so we can ship sound without bundling files.
 * Every cue is a few oscillator + envelope nodes wired into a shared master
 * gain. The AudioContext is lazily created on first user interaction
 * (browsers require a gesture). All cues respect the global SFX/BGM volume —
 * pass it in, no hidden state.
 *
 * The music loop is a small autonomous sub-engine: it owns its own gain
 * node, schedules a 4-bar chord progression with a soft arpeggio on top,
 * and can be started/stopped/volume-changed at any time. Two voices total
 * keep the CPU cost near zero on phones.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
// --- Music engine state ---
let musicGain: GainNode | null = null;
let musicNoteIntervalId: number | null = null;
let musicVolume = 0;

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
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(masterGain);
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

type Cue =
  | 'cardPlay' | 'attack' | 'damage' | 'summon' | 'win' | 'lose' | 'tap' | 'turn'
  // Pack-cinematic family — distinct from gameplay cues so the volume profile
  // can be tuned independently if needed.
  | 'packRip'        // initial tear: harsher noise sweep
  | 'packBurst'      // explosion peak: white-noise pop + bright stinger
  | 'rarityCommon'   // soft reveal chime
  | 'rarityRare'     // 2-note up
  | 'rarityEpic'     // 3-note arpeggio with shimmer
  | 'rarityLegendary'// full triumphant 4-note + bell
  | 'questClaim'     // sparkly upward sweep when claiming a reward
  | 'coinDrop';      // small "ker-ching" for currency gain

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

function tone(c: AudioContext, master: AudioNode, masterVol: number, opts: ToneOpts) {
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

/** Short noise burst — useful for paper rips, impacts. We synthesize the
 *  noise once into an AudioBuffer (lazily) so each cue is just a fresh
 *  source node + envelope. */
let _noiseBuf: AudioBuffer | null = null;
function getNoiseBuf(c: AudioContext): AudioBuffer {
  if (_noiseBuf) return _noiseBuf;
  const len = Math.floor(c.sampleRate * 0.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  _noiseBuf = buf;
  return buf;
}
function noise(c: AudioContext, master: AudioNode, masterVol: number,
               opts: { dur: number; gain: number; delay?: number; filterFreq?: number; filterQ?: number; sweepTo?: number }) {
  const start = c.currentTime + (opts.delay ?? 0);
  const end = start + opts.dur;
  const src = c.createBufferSource();
  src.buffer = getNoiseBuf(c);
  src.loop = true;
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(opts.filterFreq ?? 1200, start);
  filter.Q.value = opts.filterQ ?? 1.2;
  if (opts.sweepTo != null) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweepTo), end);
  }
  const peak = opts.gain * masterVol;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.01);
  g.gain.linearRampToValueAtTime(0, end);
  src.connect(filter).connect(g).connect(master);
  src.start(start);
  src.stop(end + 0.02);
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
      tone(c, master, vol, { type: 'square', freq: 880, freqTo: 660, dur: 0.05, gain: 0.12 });
      break;
    case 'attack':
      tone(c, master, vol, { type: 'sawtooth', freq: 760, freqTo: 180, dur: 0.13, gain: 0.30 });
      tone(c, master, vol, { type: 'square', freq: 220, freqTo: 90, dur: 0.10, gain: 0.18, delay: 0.02 });
      break;
    case 'damage':
      tone(c, master, vol, { type: 'sawtooth', freq: 160, freqTo: 60, dur: 0.18, gain: 0.34 });
      tone(c, master, vol, { type: 'square', freq: 80, freqTo: 40, dur: 0.16, gain: 0.20, delay: 0.01 });
      break;
    case 'summon':
      tone(c, master, vol, { type: 'triangle', freq: 523, dur: 0.08, gain: 0.22, delay: 0.00 });
      tone(c, master, vol, { type: 'triangle', freq: 659, dur: 0.08, gain: 0.22, delay: 0.06 });
      tone(c, master, vol, { type: 'triangle', freq: 880, dur: 0.20, gain: 0.26, delay: 0.12 });
      tone(c, master, vol, { type: 'sine',     freq: 1320, dur: 0.18, gain: 0.10, delay: 0.14 });
      break;
    case 'win':
      tone(c, master, vol, { type: 'triangle', freq: 523, dur: 0.18, gain: 0.30, delay: 0.00 });
      tone(c, master, vol, { type: 'triangle', freq: 659, dur: 0.18, gain: 0.30, delay: 0.14 });
      tone(c, master, vol, { type: 'triangle', freq: 784, dur: 0.36, gain: 0.32, delay: 0.28 });
      tone(c, master, vol, { type: 'sine',     freq: 1047, dur: 0.36, gain: 0.18, delay: 0.32 });
      break;
    case 'lose':
      tone(c, master, vol, { type: 'sawtooth', freq: 392, dur: 0.22, gain: 0.26, delay: 0.00 });
      tone(c, master, vol, { type: 'sawtooth', freq: 311, dur: 0.22, gain: 0.26, delay: 0.18 });
      tone(c, master, vol, { type: 'sawtooth', freq: 233, dur: 0.50, gain: 0.30, delay: 0.36 });
      break;
    case 'turn':
      tone(c, master, vol, { type: 'sine', freq: 660, freqTo: 880, dur: 0.18, gain: 0.18 });
      tone(c, master, vol, { type: 'sine', freq: 1320, dur: 0.16, gain: 0.10, delay: 0.02 });
      break;

    case 'packRip':
      // paper-tear flavor — filtered noise that sweeps up then crackles
      noise(c, master, vol, { dur: 0.30, gain: 0.55, filterFreq: 1800, filterQ: 2.5, sweepTo: 4400 });
      noise(c, master, vol, { dur: 0.22, gain: 0.35, delay: 0.10, filterFreq: 3600, filterQ: 3 });
      tone(c, master, vol, { type: 'sawtooth', freq: 220, freqTo: 880, dur: 0.18, gain: 0.10, delay: 0.05 });
      break;
    case 'packBurst':
      // big boom + bright stinger
      noise(c, master, vol, { dur: 0.42, gain: 0.80, filterFreq: 600, filterQ: 0.6, sweepTo: 180 });
      tone(c, master, vol, { type: 'triangle', freq: 740, freqTo: 196, dur: 0.36, gain: 0.32 });
      tone(c, master, vol, { type: 'sawtooth', freq: 1320, freqTo: 330, dur: 0.30, gain: 0.18, delay: 0.02 });
      // Stinger 100ms later — bright triumph
      tone(c, master, vol, { type: 'triangle', freq: 880, dur: 0.18, gain: 0.22, delay: 0.18 });
      tone(c, master, vol, { type: 'sine',     freq: 1760, dur: 0.22, gain: 0.16, delay: 0.18 });
      break;
    case 'rarityCommon':
      // single soft chime
      tone(c, master, vol, { type: 'triangle', freq: 880, dur: 0.20, gain: 0.18 });
      tone(c, master, vol, { type: 'sine',     freq: 1320, dur: 0.18, gain: 0.10, delay: 0.02 });
      break;
    case 'rarityRare':
      // two-note up
      tone(c, master, vol, { type: 'triangle', freq: 659, dur: 0.12, gain: 0.22 });
      tone(c, master, vol, { type: 'triangle', freq: 880, dur: 0.24, gain: 0.26, delay: 0.10 });
      tone(c, master, vol, { type: 'sine',     freq: 1320, dur: 0.22, gain: 0.12, delay: 0.12 });
      break;
    case 'rarityEpic':
      // three-note arpeggio + shimmer
      tone(c, master, vol, { type: 'triangle', freq: 587, dur: 0.10, gain: 0.22 });
      tone(c, master, vol, { type: 'triangle', freq: 740, dur: 0.10, gain: 0.24, delay: 0.08 });
      tone(c, master, vol, { type: 'triangle', freq: 988, dur: 0.30, gain: 0.28, delay: 0.16 });
      tone(c, master, vol, { type: 'sine',     freq: 1760, dur: 0.28, gain: 0.14, delay: 0.18 });
      tone(c, master, vol, { type: 'sine',     freq: 2200, dur: 0.24, gain: 0.10, delay: 0.22 });
      break;
    case 'rarityLegendary':
      // royal fanfare — major triad + octave bell, slower
      tone(c, master, vol, { type: 'triangle', freq: 523, dur: 0.18, gain: 0.28 });
      tone(c, master, vol, { type: 'triangle', freq: 659, dur: 0.18, gain: 0.28, delay: 0.12 });
      tone(c, master, vol, { type: 'triangle', freq: 784, dur: 0.22, gain: 0.30, delay: 0.24 });
      tone(c, master, vol, { type: 'triangle', freq: 1047, dur: 0.50, gain: 0.34, delay: 0.36 });
      tone(c, master, vol, { type: 'sine',     freq: 2093, dur: 0.50, gain: 0.18, delay: 0.40 });
      // Sub-bass thump under the chord
      tone(c, master, vol, { type: 'sine',     freq: 110, dur: 0.50, gain: 0.20, delay: 0.36 });
      break;
    case 'questClaim':
      // sparkly upward sweep + small reward "ping"
      tone(c, master, vol, { type: 'triangle', freq: 660, freqTo: 1320, dur: 0.18, gain: 0.22 });
      tone(c, master, vol, { type: 'sine',     freq: 1760, dur: 0.22, gain: 0.16, delay: 0.10 });
      tone(c, master, vol, { type: 'sine',     freq: 2640, dur: 0.18, gain: 0.10, delay: 0.18 });
      break;
    case 'coinDrop':
      // metallic "tink-tink"
      tone(c, master, vol, { type: 'square', freq: 1320, dur: 0.06, gain: 0.18 });
      tone(c, master, vol, { type: 'square', freq: 1760, dur: 0.10, gain: 0.16, delay: 0.05 });
      tone(c, master, vol, { type: 'sine',   freq: 2640, dur: 0.12, gain: 0.10, delay: 0.07 });
      break;
  }
}

// ============================================================================
// Music engine — slow ambient pad + lazy arpeggio. Plays a 4-bar chord
// progression in A minor (Am - F - C - G), 2s per chord, looping forever.
// Two voices per chord: a sine pad (root + fifth) and a soft triangle
// arpeggio (root, third, fifth, octave). Total simultaneous voices ~6,
// well within phone budget.
// ============================================================================

const CHORDS: { root: number; third: number; fifth: number }[] = [
  { root: 220.00, third: 261.63, fifth: 329.63 }, // Am  (A3, C4, E4)
  { root: 174.61, third: 220.00, fifth: 261.63 }, // F   (F3, A3, C4)
  { root: 196.00, third: 246.94, fifth: 293.66 }, // C   (G3, B3, D4) — voiced low
  { root: 196.00, third: 246.94, fifth: 293.66 }, // G   (G3, B3, D4)
];
const CHORD_DUR = 2.4; // seconds per chord
let chordIdx = 0;
let musicNextTime = 0;

/** Set music volume (0..1). 0 stops the loop entirely; >0 starts/keeps it
 *  running. Safe to call repeatedly with the same value. */
export function setMusicVolume(vol: number): void {
  musicVolume = Math.max(0, Math.min(1, vol));
  const c = getCtx();
  if (!c || !musicGain) return;
  // Ramp to avoid clicks.
  const now = c.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(musicVolume * 0.45, now + 0.4);
  if (musicVolume > 0) startMusic();
  else stopMusic();
}

function startMusic(): void {
  const c = getCtx();
  if (!c || !musicGain) return;
  if (c.state === 'suspended') void c.resume();
  if (musicNoteIntervalId != null) return;
  musicNextTime = c.currentTime + 0.05;
  chordIdx = 0;
  // We schedule ~1.5s ahead and tick every 500ms to refill — cheap and
  // robust against tab-throttling.
  const tick = () => {
    const lookahead = c.currentTime + 1.5;
    while (musicNextTime < lookahead) {
      scheduleChord(musicNextTime);
      musicNextTime += CHORD_DUR;
    }
  };
  tick();
  musicNoteIntervalId = window.setInterval(tick, 500);
}

function stopMusic(): void {
  if (musicNoteIntervalId != null) {
    window.clearInterval(musicNoteIntervalId);
    musicNoteIntervalId = null;
  }
}

function scheduleChord(startTime: number): void {
  const c = getCtx();
  if (!c || !musicGain) return;
  const chord = CHORDS[chordIdx % CHORDS.length];
  chordIdx++;
  const target = musicGain;

  // Pad — long sine sustains on root + fifth, low gain, soft attack/release.
  const padDur = CHORD_DUR + 0.4;
  for (const f of [chord.root, chord.fifth]) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    const peak = 0.14;
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(peak, startTime + 0.8);
    g.gain.linearRampToValueAtTime(peak, startTime + padDur - 0.6);
    g.gain.linearRampToValueAtTime(0, startTime + padDur);
    osc.connect(g).connect(target);
    osc.start(startTime);
    osc.stop(startTime + padDur + 0.05);
  }

  // Arpeggio — four triangle plucks across the chord on the upbeats.
  const arp = [chord.root * 2, chord.third * 2, chord.fifth * 2, chord.root * 4];
  for (let i = 0; i < arp.length; i++) {
    const ts = startTime + i * (CHORD_DUR / arp.length);
    const dur = (CHORD_DUR / arp.length) * 0.85;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = arp[i];
    const peak = 0.06;
    g.gain.setValueAtTime(0, ts);
    g.gain.linearRampToValueAtTime(peak, ts + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ts + dur);
    osc.connect(g).connect(target);
    osc.start(ts);
    osc.stop(ts + dur + 0.02);
  }
}
