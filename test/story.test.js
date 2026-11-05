import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/story/characters.js';
import { pickVoices, VoiceEngine } from '../src/story/voice.js';

const VOICES = [
  { name: 'Google español', lang: 'es-ES', default: true },
  { name: 'Microsoft Jorge - Spanish (Mexico)', lang: 'es-MX' },
  { name: 'Microsoft Sabina - Spanish (Mexico)', lang: 'es-MX' },
  { name: 'Samantha', lang: 'en-US' },
  { name: 'Daniel', lang: 'en-GB' },
  { name: 'Alice', lang: 'it-IT' },
];

test('pickVoices only returns voices of the requested language', () => {
  for (const lang of ['es', 'en']) {
    const picked = pickVoices(VOICES, lang, CHARACTERS);
    assert.deepEqual([...picked.keys()].sort(), Object.keys(CHARACTERS).sort());
    for (const v of picked.values()) {
      assert.ok(v, 'every character gets a voice when one matches');
      assert.ok(v.lang.toLowerCase().startsWith(lang), `${v.name} is not ${lang}`);
    }
  }
});

test('pickVoices gives characters of different genders different voices', () => {
  for (const lang of ['es', 'en']) {
    const picked = pickVoices(VOICES, lang, CHARACTERS);
    assert.notEqual(picked.get('bruno'), picked.get('pip'));
    assert.notEqual(picked.get('fluff'), picked.get('mochi'));
  }
  const picked = pickVoices(VOICES, 'en', CHARACTERS);
  assert.equal(picked.get('bruno').name, 'Daniel');
  assert.equal(picked.get('mochi').name, 'Samantha');
});

test('pickVoices is deterministic', () => {
  const a = pickVoices(VOICES, 'es', CHARACTERS);
  const b = pickVoices(VOICES.map((v) => ({ ...v })), 'es', CHARACTERS);
  for (const id of Object.keys(CHARACTERS)) assert.equal(a.get(id).name, b.get(id).name);
});

test('pickVoices returns null for every character when no voice matches', () => {
  const picked = pickVoices(VOICES, 'fr', CHARACTERS);
  assert.equal(picked.size, Object.keys(CHARACTERS).length);
  for (const v of picked.values()) assert.equal(v, null);
  for (const v of pickVoices([], 'es', CHARACTERS).values()) assert.equal(v, null);
});

test('CHARACTERS has every id with a complete, distinct voice profile', () => {
  const ids = ['mochi', 'pip', 'bruno', 'luna', 'pom', 'hazel', 'fluff'];
  assert.deepEqual(Object.keys(CHARACTERS).sort(), [...ids].sort());
  const triples = new Set();
  for (const id of ids) {
    const c = CHARACTERS[id];
    assert.equal(typeof c.name, 'string');
    assert.ok(c.name.length > 0);
    assert.ok(c.emoji.length > 0);
    assert.match(c.color, /^#[0-9a-f]{6}$/i);
    const { pitch, rate, gender, blip } = c.voice;
    assert.ok(pitch > 0 && pitch <= 2, `${id} pitch in Web Speech range`);
    assert.ok(rate > 0 && rate <= 10, `${id} rate in Web Speech range`);
    assert.ok(['female', 'male'].includes(gender));
    assert.ok(blip.base > 0);
    assert.ok(['sine', 'square', 'sawtooth', 'triangle'].includes(blip.wave));
    assert.ok(blip.spread >= 0 && blip.spread < 1);
    triples.add(`${pitch}|${rate}|${blip.base}`);
  }
  assert.equal(triples.size, ids.length);
});

test('VoiceEngine degrades gracefully without speechSynthesis or an audio context', async () => {
  assert.equal(typeof globalThis.speechSynthesis, 'undefined');
  const tones = [];
  const audio = { ctx: null, tone: (o) => tones.push(o) };
  const engine = new VoiceEngine({ audio });
  assert.equal(engine.hasSpeech('es'), false);
  assert.doesNotThrow(() => engine.chirp('pip', { volume: 1 }));
  assert.equal(tones.length, 0);
  assert.doesNotThrow(() => engine.cancel());
  const result = await Promise.race([
    engine.speak('Hola Mochi', 'pip', { lang: 'es', volume: 1 }).then(() => 'resolved'),
    new Promise((r) => setTimeout(() => r('hung'), 1000)),
  ]);
  assert.equal(result, 'resolved');
});

test('VoiceEngine chirps through audio.tone in the character timbre', () => {
  const tones = [];
  const audio = { ctx: {}, tone: (o) => tones.push(o) };
  const engine = new VoiceEngine({ audio });
  engine.chirp('bruno', { volume: 0.5 });
  engine.chirp('nobody', { volume: 0.5 });
  assert.ok(tones.length >= 1);
  const { base, wave, spread } = CHARACTERS.bruno.voice.blip;
  for (const t of tones) {
    assert.equal(t.type, wave);
    assert.ok(t.freq >= base * (1 - spread) - 1e-9 && t.freq <= base * (1 + spread) + 1e-9);
  }
  const quiet = [];
  new VoiceEngine({ audio: { ctx: {}, tone: (o) => quiet.push(o) } }).chirp('pip', { volume: 0 });
  assert.equal(quiet.length, 0);
});
