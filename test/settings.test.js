import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSettings } from '../src/ui/settings.js';
import { QualityGovernor } from '../src/render/governor.js';

// The original four settings, unchanged by the language and voice additions.
const legacy = ({ lang, voice, ...rest }) => rest;

test('stored settings are validated and fall back to defaults', () => {
  assert.deepEqual(legacy(parseSettings(null)), { music: 0.8, sfx: 0.8, quality: 'auto', vibration: true });
  assert.deepEqual(legacy(parseSettings('not json')), { music: 0.8, sfx: 0.8, quality: 'auto', vibration: true });
  const s = parseSettings(JSON.stringify({ music: 3, sfx: -1, quality: 'ultra', vibration: 'yes' }));
  assert.deepEqual(legacy(s), { music: 1, sfx: 0, quality: 'auto', vibration: true });
  assert.equal(parseSettings(JSON.stringify({ quality: 'low' })).quality, 'low');
});

test('language defaults to the device language passed in, and is validated', () => {
  assert.equal(parseSettings(null).lang, 'en');
  assert.equal(parseSettings(null, { lang: 'es' }).lang, 'es');
  assert.equal(parseSettings(null, { lang: 'fr' }).lang, 'en');
  assert.equal(parseSettings(JSON.stringify({ lang: 'en' }), { lang: 'es' }).lang, 'en', 'a stored choice wins');
  assert.equal(parseSettings(JSON.stringify({ lang: 'es' }), { lang: 'en' }).lang, 'es');
  assert.equal(parseSettings(JSON.stringify({ lang: 'klingon' }), { lang: 'es' }).lang, 'es');
  assert.equal(parseSettings('not json', { lang: 'es' }).lang, 'es');
});

test('voice mode defaults to spoken and only accepts spoken, chirps or off', () => {
  assert.equal(parseSettings(null).voice, 'spoken');
  for (const voice of ['spoken', 'chirps', 'off']) assert.equal(parseSettings(JSON.stringify({ voice })).voice, voice);
  assert.equal(parseSettings(JSON.stringify({ voice: 'loud' })).voice, 'spoken');
  assert.equal(parseSettings(JSON.stringify({ voice: 3 })).voice, 'spoken');
});

test('deviceLang maps es* to es and anything else to en', async () => {
  const { deviceLang } = await import('../src/ui/settings.js');
  assert.equal(deviceLang('es-MX'), 'es');
  assert.equal(deviceLang('ES'), 'es');
  assert.equal(deviceLang('en-US'), 'en');
  assert.equal(deviceLang('pt-BR'), 'en');
  assert.equal(deviceLang(undefined), 'en');
});

const run = (gov, fps, seconds) => {
  for (let t = 0; t < seconds; t += 1 / fps) gov.sample(1 / fps);
};

test('auto quality keeps phones capped at 30 Hz on their level', () => {
  const changes = [];
  const gov = new QualityGovernor((lvl) => changes.push(lvl));
  gov.reset('medium');
  run(gov, 30, 20);
  assert.deepEqual(changes, []);
});

test('auto quality steps down when the frame rate really drops, never below low', () => {
  const changes = [];
  const gov = new QualityGovernor((lvl) => changes.push(lvl));
  gov.reset('high');
  run(gov, 15, 30);
  assert.deepEqual(changes, ['medium', 'low']);
});
