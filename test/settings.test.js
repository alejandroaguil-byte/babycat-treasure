import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSettings } from '../src/ui/settings.js';
import { QualityGovernor } from '../src/render/governor.js';

test('stored settings are validated and fall back to defaults', () => {
  assert.deepEqual(parseSettings(null), { music: 0.8, sfx: 0.8, quality: 'auto', vibration: true });
  assert.deepEqual(parseSettings('not json'), { music: 0.8, sfx: 0.8, quality: 'auto', vibration: true });
  const s = parseSettings(JSON.stringify({ music: 3, sfx: -1, quality: 'ultra', vibration: 'yes' }));
  assert.deepEqual(s, { music: 1, sfx: 0, quality: 'auto', vibration: true });
  assert.equal(parseSettings(JSON.stringify({ quality: 'low' })).quality, 'low');
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
