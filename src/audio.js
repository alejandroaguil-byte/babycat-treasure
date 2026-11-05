// Procedural audio: every sound effect and the background music are
// synthesized with the Web Audio API, so the game ships with no audio files.

const midi = (m) => 440 * 2 ** ((m - 69) / 12);

const _ = null;
// Each song: 8 bars of eighth notes (null = rest), 4 chords (one per bar, repeated).
const SONGS = {
  meadow: {
    tempo: 116, lead: 'square', drums: 'full',
    melody: [
      76, _, 79, _, 81, 79, 76, _, 72, _, 76, _, 74, 72, 69, _,
      69, _, 72, _, 74, 72, 69, _, 67, _, 71, _, 74, _, _, _,
      76, 76, 79, _, 84, _, 79, _, 81, _, 79, _, 76, _, 72, _,
      74, _, 77, _, 76, 74, 72, _, 74, _, 71, _, 72, _, _, _,
    ],
    chords: [[48, [60, 64, 67]], [45, [57, 60, 64]], [41, [53, 57, 60]], [43, [55, 59, 62]]],
  },
  autumn: {
    tempo: 104, lead: 'triangle', drums: 'soft',
    melody: [
      69, _, 72, _, 76, _, 74, 72, 72, _, 69, _, 65, _, _, _,
      67, _, 72, _, 76, _, 79, _, 74, _, 71, _, 67, _, _, _,
      76, _, 74, _, 72, _, 69, _, 77, _, 76, _, 72, _, 69, _,
      72, _, 74, _, 76, _, 79, _, 76, 74, 71, _, 69, _, _, _,
    ],
    chords: [[45, [57, 60, 64]], [41, [53, 57, 60]], [48, [60, 64, 67]], [43, [55, 59, 62]]],
  },
  storm: {
    tempo: 92, lead: 'sine', drums: 'heartbeat',
    melody: [
      62, _, _, 65, _, _, 69, _, 70, _, _, 69, _, _, 65, _,
      67, _, _, 70, _, _, 74, _, 73, _, _, _, 69, _, _, _,
      74, _, 72, _, 70, _, 69, _, 70, _, 69, _, 67, _, 65, _,
      67, _, 65, _, 64, _, 62, _, 61, _, _, _, 64, _, _, _,
    ],
    chords: [[38, [62, 65, 69]], [34, [58, 62, 65]], [43, [55, 58, 62]], [45, [57, 61, 64]]],
  },
  snow: {
    tempo: 124, lead: 'bell', drums: 'light',
    melody: [
      84, _, 79, _, 76, _, 79, _, 83, _, 79, _, 74, _, 79, _,
      81, _, 76, _, 72, _, 76, _, 77, _, 81, _, 84, _, _, _,
      84, 86, 88, _, 86, _, 84, _, 83, _, 86, _, 79, _, _, _,
      81, _, 84, _, 88, _, 86, _, 84, _, _, _, 77, _, _, _,
    ],
    chords: [[48, [60, 64, 67]], [43, [55, 59, 62]], [45, [57, 60, 64]], [41, [53, 57, 60]]],
  },
};
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
  startMusic(theme = 'meadow') {
    if (!this.ctx) return;
    this.stopMusic();
    this.song = SONGS[theme] ?? SONGS.meadow;
    const stepDur = 60 / this.song.tempo / 2;
    let step = 0;
    let nextTime = this.ctx.currentTime + 0.1;
    const schedule = () => {
      while (nextTime < this.ctx.currentTime + 0.15) {
        this.playStep(step, nextTime - this.ctx.currentTime, stepDur);
        step = (step + 1) % this.song.melody.length;
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
    const song = this.song;
    const inBar = step % 8;
    const [root, tones] = song.chords[Math.floor(step / 8) % 4];
    const note = song.melody[step];
    if (note) {
      if (song.lead === 'bell') {
        this.tone({ freq: midi(note), type: 'triangle', dur: stepDur * 2.5, vol: 0.09, when, dest });
        this.tone({ freq: midi(note + 12), type: 'sine', dur: stepDur * 2, vol: 0.04, when, dest });
      } else if (song.lead === 'sine') {
        this.tone({ freq: midi(note), type: 'sine', dur: stepDur * 3, vol: 0.12, when, dest, attack: 0.04 });
        this.tone({ freq: midi(note), type: 'triangle', dur: stepDur * 3, vol: 0.04, when, dest, detune: 10 });
      } else {
        const square = song.lead === 'square';
        this.tone({ freq: midi(note), type: 'square', dur: stepDur * 1.6, vol: square ? 0.085 : 0.04, when, dest, filter: { type: 'lowpass', freq: square ? 2200 : 1400 } });
        this.tone({ freq: midi(note), type: 'triangle', dur: stepDur * 1.6, vol: square ? 0.06 : 0.11, when, dest, detune: 8 });
      }
    }
    if (inBar % 2 === 0) {
      const bass = root + (inBar % 4 === 0 ? 0 : 12);
      this.tone({ freq: midi(bass), type: 'triangle', dur: stepDur * 1.8, vol: 0.22, when, dest });
    } else {
      this.tone({ freq: midi(tones[(inBar >> 1) % 3]), type: 'sine', dur: stepDur * 1.2, vol: 0.06, when, dest });
    }
    const d = song.drums;
    if (d === 'heartbeat') {
      if (inBar === 0 || inBar === 1) this.tone({ freq: 90, to: 40, type: 'sine', dur: 0.2, vol: 0.3, when, dest });
      return;
    }
    if (inBar === 0 || inBar === 4) this.tone({ freq: 150, to: 45, type: 'sine', dur: 0.18, vol: d === 'full' ? 0.35 : 0.2, when, dest });
    if (d !== 'light' && (inBar === 2 || inBar === 6)) this.noise({ dur: 0.12, vol: d === 'full' ? 0.08 : 0.04, type: 'bandpass', freq: 1800, when, dest });
    if (inBar % 2 === 1) this.noise({ dur: 0.03, vol: d === 'light' ? 0.05 : 0.035, type: 'highpass', freq: 7000, when, dest });
  }

  // ---------- ambience ----------
  startAmbience(kind) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'rain' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'rain' ? 1800 : 500;
    f.Q.value = kind === 'rain' ? 0.5 : 0.8;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(kind === 'rain' ? 0.09 : 0.05, ctx.currentTime + 1.5);
    src.connect(f).connect(g).connect(this.sfx);
    src.start();
    (this.ambience ??= []).push({ src, g });
  }

  stopAmbience() {
    for (const { src, g } of this.ambience ?? []) {
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      src.stop(this.ctx.currentTime + 1);
    }
    this.ambience = [];
  }

  // ---------- weather + new items ----------
  windRise(dur) {
    this.noise({ dur: dur + 0.3, vol: 0.12, type: 'bandpass', freq: 250, to: 900, q: 2, attack: dur * 0.8 });
  }
  gust(dur) {
    this.noise({ dur, vol: 0.28, type: 'bandpass', freq: 700, to: 300, q: 0.8, attack: 0.1 });
    this.noise({ dur: dur * 0.8, vol: 0.1, type: 'highpass', freq: 3000, attack: 0.2 });
  }
  thunder(delay = 0.4) {
    this.noise({ dur: 0.15, vol: 0.4, type: 'highpass', freq: 1500 });
    this.noise({ dur: 2.2, vol: 0.55, type: 'lowpass', freq: 220, to: 60, when: delay, attack: 0.05 });
  }
  key() {
    [79, 84, 88, 91].forEach((n, i) => this.tone({ freq: midi(n), type: 'square', dur: 0.15, vol: 0.08, when: i * 0.07, filter: { type: 'lowpass', freq: 3000 } }));
  }
  gateOpen() {
    this.tone({ freq: 90, to: 60, type: 'sawtooth', dur: 0.5, vol: 0.12, filter: { type: 'lowpass', freq: 600 } });
    this.tone({ freq: midi(72), type: 'triangle', dur: 0.3, vol: 0.12, when: 0.4 });
    this.tone({ freq: midi(79), type: 'triangle', dur: 0.4, vol: 0.12, when: 0.5 });
  }
  locked() {
    this.tone({ freq: 140, type: 'square', dur: 0.08, vol: 0.08 });
    this.noise({ dur: 0.08, vol: 0.1, type: 'bandpass', freq: 2500, when: 0.05 });
  }
  heal() {
    [72, 76, 79, 84].forEach((n, i) => this.tone({ freq: midi(n), type: 'sine', dur: 0.3, vol: 0.14, when: i * 0.08 }));
    this.meow({ pitch: 1.25, dur: 0.3, when: 0.2, vol: 0.12 });
  }
  firefly(n = 0) {
    this.tone({ freq: midi(84 + n * 2), type: 'sine', dur: 0.4, vol: 0.14 });
    this.tone({ freq: midi(91 + n * 2), type: 'sine', dur: 0.5, vol: 0.08, when: 0.08 });
  }
  cocoa() {
    for (let i = 0; i < 3; i++) this.noise({ dur: 0.12, vol: 0.12, type: 'bandpass', freq: 600 + i * 200, when: i * 0.12 });
    this.tone({ freq: midi(76), type: 'triangle', dur: 0.3, vol: 0.12, when: 0.35 });
    this.tone({ freq: midi(84), type: 'triangle', dur: 0.4, vol: 0.12, when: 0.45 });
  }
  shiver() {
    for (let i = 0; i < 4; i++) this.tone({ freq: 200 + (i % 2) * 40, type: 'square', dur: 0.05, vol: 0.05, when: i * 0.06 });
  }
  fall() {
    this.tone({ freq: 900, to: 120, type: 'sine', dur: 0.9, vol: 0.2 });
    this.meow({ sad: true, pitch: 1.3, dur: 0.6, when: 0.1 });
  }
  stun() {
    this.tone({ freq: 600, to: 1200, type: 'square', dur: 0.15, vol: 0.08 });
    [0, 0.12, 0.24].forEach((w) => this.tone({ freq: 1400, type: 'sine', dur: 0.1, vol: 0.06, when: w + 0.15 }));
  }
  snowThrow() {
    this.noise({ dur: 0.15, vol: 0.07, type: 'lowpass', freq: 800 });
  }
  slide() {
    this.noise({ dur: 0.25, vol: 0.06, type: 'highpass', freq: 4000, to: 2000 });
  }
}
