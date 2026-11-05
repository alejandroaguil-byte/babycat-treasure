// Character voices: Web Speech TTS with a per-character voice, pitch and rate, plus a
// procedural "chirp" voice (one synthesized syllable per call) that works offline.

import { CHARACTERS } from './characters.js';

const FEMALE_HINT =
  /female|woman|mujer|paulina|monica|mónica|helena|laura|sabina|samantha|zira|susan|victoria|karen|moira|tessa|google español|google us english/i;
const MALE_HINT = /\bmale\b|\bman\b|hombre|jorge|diego|pablo|juan|carlos|david|daniel|alex|fred|mark|george/i;

/** Classifies a voice by name hints: 'female', 'male' or null when unknown. */
function voiceGender(voice) {
  const name = voice?.name ?? '';
  // Female first: "female" also contains "male".
  if (FEMALE_HINT.test(name)) return 'female';
  if (MALE_HINT.test(name)) return 'male';
  return null;
}

/** Normalized 2-letter language code of a voice ('es-MX' / 'es_MX' -> 'es'). */
const langCode = (voice) => String(voice?.lang ?? '').toLowerCase().slice(0, 2);

/**
 * Picks one voice per character for a language. Pure and deterministic: characters are
 * visited in registry order and each takes the least-used candidate, preferring voices whose
 * name hints match the character's gender, then unknown-gender voices, then any voice.
 * Returns Map(characterId -> voice|null).
 */
export function pickVoices(voices, lang, characters) {
  const code = String(lang ?? '').toLowerCase().slice(0, 2);
  const pool = (Array.isArray(voices) ? voices : []).filter((v) => v && langCode(v) === code);
  const genders = pool.map(voiceGender);
  const uses = pool.map(() => 0);
  const picked = new Map();
  for (const [id, character] of Object.entries(characters)) {
    if (!pool.length) {
      picked.set(id, null);
      continue;
    }
    const want = character?.voice?.gender;
    const matching = pool.map((_, i) => i).filter((i) => genders[i] === want);
    const unknown = pool.map((_, i) => i).filter((i) => genders[i] === null);
    let candidates = [...matching, ...unknown];
    if (!candidates.length) candidates = pool.map((_, i) => i);
    // Least used wins; ties keep the order above (gender match first, then input order).
    let best = candidates[0];
    for (const i of candidates) if (uses[i] < uses[best]) best = i;
    uses[best]++;
    picked.set(id, pool[best]);
  }
  return picked;
}

/** The browser speech synthesizer, or null (Node, old browsers, blocked APIs). */
function getSynth() {
  try {
    const synth = globalThis.speechSynthesis;
    return synth && typeof synth.speak === 'function' ? synth : null;
  } catch {
    return null;
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const FALLBACK_LANG = { es: 'es-ES', en: 'en-US' };

/** Speaks or chirps lines in each character's own voice. */
export class VoiceEngine {
  constructor({ audio }) {
    this.audio = audio;
    this.synth = getSynth();
    this.picked = null;
    this.pickedLang = null;
    this.pending = null;
    this.utterance = null;
    if (!this.synth) return;
    // Voices often load asynchronously; re-pick on the next lookup when they arrive.
    const refresh = () => {
      this.picked = null;
    };
    try {
      if (typeof this.synth.addEventListener === 'function') this.synth.addEventListener('voiceschanged', refresh);
      else this.synth.onvoiceschanged = refresh;
      this.synth.getVoices();
    } catch {
      // Ignore: lookups below are guarded too.
    }
  }

  /** All installed voices, never throwing. */
  voices() {
    try {
      return this.synth?.getVoices?.() ?? [];
    } catch {
      return [];
    }
  }

  /** True if speech synthesis exists and at least one voice matches lang. */
  hasSpeech(lang) {
    if (!this.synth || typeof globalThis.SpeechSynthesisUtterance !== 'function') return false;
    const code = String(lang ?? '').toLowerCase().slice(0, 2);
    return this.voices().some((v) => langCode(v) === code);
  }

  /** The voice picked for a character in a language (null when none matches). */
  voiceFor(characterId, lang) {
    if (!this.picked || this.pickedLang !== lang) {
      this.picked = pickVoices(this.voices(), lang, CHARACTERS);
      this.pickedLang = lang;
    }
    return this.picked.get(characterId) ?? null;
  }

  /** Speaks text in the character's voice; resolves when it ends, fails or times out. */
  speak(text, characterId, { lang = 'en', volume = 1 } = {}) {
    this.cancel();
    const profile = CHARACTERS[characterId]?.voice ?? { pitch: 1, rate: 1 };
    const Utterance = globalThis.SpeechSynthesisUtterance;
    if (!this.synth || typeof Utterance !== 'function' || !text || volume <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      let timer = null;
      const finish = () => {
        if (this.pending !== finish) return;
        this.pending = null;
        this.utterance = null;
        clearTimeout(timer);
        resolve();
      };
      this.pending = finish;
      try {
        const u = new Utterance(text);
        const voice = this.voiceFor(characterId, lang);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? FALLBACK_LANG[lang] ?? lang;
        u.pitch = clamp(profile.pitch, 0, 2);
        u.rate = clamp(profile.rate, 0.1, 10);
        u.volume = clamp(volume, 0, 1);
        u.onend = finish;
        u.onerror = finish;
        // Keep a reference: some engines drop events of garbage-collected utterances.
        this.utterance = u;
        // Android Chrome sometimes never fires onend.
        timer = setTimeout(finish, (text.length * 75) / u.rate + 1500);
        this.synth.speak(u);
      } catch {
        finish();
      }
    });
  }

  /** One short procedural syllable in the character's timbre; no-op without an audio context. */
  chirp(characterId, { volume = 1 } = {}) {
    const blip = CHARACTERS[characterId]?.voice?.blip;
    const audio = this.audio;
    if (!blip || !audio?.ctx || !(volume > 0)) return;
    const rate = CHARACTERS[characterId].voice.rate || 1;
    const freq = blip.base * (1 + (Math.random() * 2 - 1) * blip.spread);
    const dur = 0.075 / rate;
    // Harsh waves are perceptually louder: soften them with a lowpass and lower gain.
    const harsh = blip.wave === 'square' || blip.wave === 'sawtooth';
    const vol = clamp(volume, 0, 1) * (harsh ? 0.07 : 0.14);
    const filter = harsh ? { type: 'lowpass', freq: Math.max(900, blip.base * 5) } : undefined;
    const glide = freq * (Math.random() < 0.5 ? 0.92 : 1.08);
    audio.tone({ freq, to: glide, type: blip.wave, dur, vol, attack: 0.008, filter });
    // Vibrato: a slightly detuned twin beats against the first tone for a warbling voice.
    if (blip.vibrato) audio.tone({ freq, to: glide, type: blip.wave, dur, vol: vol * 0.8, attack: 0.008, detune: 40 });
  }

  /** Stops any speech and settles the pending speak() promise. */
  cancel() {
    const pending = this.pending;
    try {
      if (this.synth && (this.synth.speaking || this.synth.pending)) this.synth.cancel();
    } catch {
      // Ignore: nothing to stop.
    }
    pending?.();
  }
}
