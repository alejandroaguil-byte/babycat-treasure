// Procedural audio: every sound effect and the background music are
// synthesized with the Web Audio API, so the game ships with no audio files.

const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// 8 bars of eighth notes. null = rest.
const MELODY = [
  76, null, 79, null, 81, 79, 76, null,
  72, null, 76, null, 74, 72, 69, null,
  69, null, 72, null, 74, 72, 69, null,
  67, null, 71, null, 74, null, null, null,
  76, 76, 79, null, 84, null, 79, null,
  81, null, 79, null, 76, null, 72, null,
  74, null, 77, null, 76, 74, 72, null,
  74, null, 71, null, 72, null, null, null,
];
const CHORDS = [
  { root: 48, tones: [60, 64, 67] },
  { root: 45, tones: [57, 60, 64] },
  { root: 41, tones: [53, 57, 60] },
  { root: 43, tones: [55, 59, 62] },
];
const TEMPO = 116;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.75;
    this.sfx.connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.3;
    this.music.connect(this.master);
    // Soft echo on the music bus.
    const delay = ctx.createDelay();
    delay.delayTime.value = (60 / TEMPO) * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.music.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(this.master);

    const len = ctx.sampleRate;
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  // ---------- primitives ----------
  tone({ freq, to, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, when = 0, dest, filter, detune = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.freq;
      f.Q.value = filter.q ?? 1;
      node = node.connect(f);
    }
    node.connect(gain).connect(dest ?? this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise({ dur = 0.1, vol = 0.2, type = 'bandpass', freq = 1000, to, q = 1, when = 0, dest, attack = 0.002 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(dest ?? this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  meow({ when = 0, pitch = 1, dur = 0.45, sad = false, vol = 0.18 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const p = 520 * pitch;
    osc.frequency.setValueAtTime(p, t);
    osc.frequency.linearRampToValueAtTime(p * (sad ? 1.15 : 1.55), t + dur * 0.35);
    osc.frequency.linearRampToValueAtTime(p * (sad ? 0.7 : 1.1), t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 12;
    lfo.connect(lfoGain).connect(osc.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1900, t + dur * 0.35);
    f.frequency.linearRampToValueAtTime(1000, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.05);
    gain.gain.setValueAtTime(vol, t + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(gain).connect(this.sfx);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  // ---------- sound effects ----------
  step() {
    this.noise({ dur: 0.06, vol: 0.07, type: 'lowpass', freq: 700 + Math.random() * 400 });
  }
  climb() {
    this.tone({ freq: 340 + Math.random() * 60, type: 'triangle', dur: 0.06, vol: 0.08 });
    this.noise({ dur: 0.04, vol: 0.05, type: 'highpass', freq: 2500 });
  }
  coin() {
    this.tone({ freq: 988, type: 'square', dur: 0.08, vol: 0.09 });
    this.tone({ freq: 1319, type: 'square', dur: 0.3, vol: 0.09, when: 0.07 });
  }
  gem() {
    [84, 88, 91, 96, 100].forEach((n, i) =>
      this.tone({ freq: midi(n), type: 'triangle', dur: 0.35, vol: 0.16, when: i * 0.06 }),
    );
    this.noise({ dur: 0.6, vol: 0.05, type: 'highpass', freq: 6000, when: 0.1 });
  }
  pluck() {
    this.tone({ freq: 320, to: 900, type: 'sine', dur: 0.16, vol: 0.25 });
    this.noise({ dur: 0.08, vol: 0.12, type: 'lowpass', freq: 1200 });
  }
  throw() {
    this.noise({ dur: 0.3, vol: 0.18, type: 'bandpass', freq: 500, to: 2600, q: 2 });
  }
  hit() {
    this.tone({ freq: 260, to: 60, type: 'square', dur: 0.25, vol: 0.15 });
    this.noise({ dur: 0.2, vol: 0.2, type: 'lowpass', freq: 1500 });
  }
  enemyDefeat() {
    this.tone({ freq: 900, to: 120, type: 'square', dur: 0.5, vol: 0.1, filter: { type: 'lowpass', freq: 2500 } });
    this.noise({ dur: 0.35, vol: 0.18, type: 'bandpass', freq: 800, to: 200, when: 0.15 });
  }
  button() {
    this.tone({ freq: 140, to: 60, type: 'sine', dur: 0.2, vol: 0.4 });
    this.tone({ freq: midi(67), type: 'square', dur: 0.1, vol: 0.08, when: 0.05 });
    this.tone({ freq: midi(74), type: 'square', dur: 0.18, vol: 0.08, when: 0.14 });
  }
  bridge() {
    this.noise({ dur: 1.3, vol: 0.25, type: 'lowpass', freq: 240, attack: 0.2 });
    this.tone({ freq: 160, to: 420, type: 'triangle', dur: 1.0, vol: 0.12, attack: 0.2 });
    [72, 76, 79, 84].forEach((n, i) =>
      this.tone({ freq: midi(n), type: 'triangle', dur: 0.3, vol: 0.12, when: 1.0 + i * 0.07 }),
    );
  }
  hurt() {
    this.tone({ freq: 220, to: 110, type: 'square', dur: 0.2, vol: 0.12 });
    this.meow({ sad: true, pitch: 1.1, dur: 0.5, when: 0.05 });
  }
  gulp() {
    this.tone({ freq: 300, to: 110, type: 'sine', dur: 0.13, vol: 0.35 });
    this.noise({ dur: 0.06, vol: 0.05, type: 'lowpass', freq: 500 });
  }
  sparkle() {
    for (let i = 0; i < 6; i++)
      this.tone({ freq: midi(90 + ((i * 5) % 12)), type: 'sine', dur: 0.25, vol: 0.06, when: i * 0.05 });
  }
  denied() {
    this.tone({ freq: 180, type: 'square', dur: 0.08, vol: 0.06 });
    this.tone({ freq: 150, type: 'square', dur: 0.1, vol: 0.06, when: 0.09 });
  }
  uiClick() {
    this.tone({ freq: 880, type: 'sine', dur: 0.06, vol: 0.12 });
  }
  whoosh() {
    this.noise({ dur: 0.6, vol: 0.12, type: 'bandpass', freq: 300, to: 1800, q: 1.5, attack: 0.15 });
  }
  fanfare() {
    const seq = [
      [72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.6], [84, 0.72],
    ];
    seq.forEach(([n, w]) => {
      this.tone({ freq: midi(n), type: 'square', dur: 0.22, vol: 0.1, when: w, filter: { type: 'lowpass', freq: 3000 } });
      this.tone({ freq: midi(n - 12), type: 'triangle', dur: 0.22, vol: 0.12, when: w });
    });
    [72, 76, 79, 84].forEach((n) =>
      this.tone({ freq: midi(n), type: 'square', dur: 1.4, vol: 0.06, when: 0.9, attack: 0.02, filter: { type: 'lowpass', freq: 2500 } }),
    );
    this.tone({ freq: midi(48), type: 'triangle', dur: 1.4, vol: 0.2, when: 0.9 });
  }

  // ---------- music ----------
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const stepDur = 60 / TEMPO / 2;
    let step = 0;
    let nextTime = this.ctx.currentTime + 0.1;
    const schedule = () => {
      while (nextTime < this.ctx.currentTime + 0.15) {
        this.playStep(step, nextTime - this.ctx.currentTime, stepDur);
        step = (step + 1) % MELODY.length;
        nextTime += stepDur;
      }
    };
    this.musicTimer = setInterval(schedule, 25);
    schedule();
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  playStep(step, when, stepDur) {
    const dest = this.music;
    const inBar = step % 8;
    const chord = CHORDS[Math.floor(step / 8) % 4];
    const note = MELODY[step];
    if (note) {
      this.tone({ freq: midi(note), type: 'square', dur: stepDur * 1.6, vol: 0.085, when, dest, filter: { type: 'lowpass', freq: 2200 } });
      this.tone({ freq: midi(note), type: 'triangle', dur: stepDur * 1.6, vol: 0.06, when, dest, detune: 8 });
    }
    if (inBar % 2 === 0) {
      const bass = chord.root + (inBar % 4 === 0 ? 0 : 12);
      this.tone({ freq: midi(bass), type: 'triangle', dur: stepDur * 1.8, vol: 0.22, when, dest });
    } else {
      const tone = chord.tones[(inBar >> 1) % 3];
      this.tone({ freq: midi(tone), type: 'sine', dur: stepDur * 1.2, vol: 0.06, when, dest });
    }
    if (inBar === 0 || inBar === 4) this.tone({ freq: 150, to: 45, type: 'sine', dur: 0.18, vol: 0.35, when, dest });
    if (inBar === 2 || inBar === 6) this.noise({ dur: 0.12, vol: 0.08, type: 'bandpass', freq: 1800, when, dest });
    if (inBar % 2 === 1) this.noise({ dur: 0.03, vol: 0.035, type: 'highpass', freq: 7000, when, dest });
  }
}
