import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../src/story/script.js';
import { CHARACTERS } from '../src/story/characters.js';

const REQUIRED = [
  'w1_intro', 'w1_enemy', 'w1_switch', 'w1_outro',
  'w2_intro', 'w2_gust_first', 'w2_bruno_join', 'w2_key', 'w2_outro',
  'w3_intro', 'w3_luna_join', 'w3_wisp_first', 'w3_fireflies', 'w3_outro',
  'w4_intro', 'w4_pom_join', 'w4_blizzard_first', 'w4_outro',
];

test('both languages have identical scene keys, including every scene the game plays', () => {
  assert.deepEqual(Object.keys(SCENES).sort(), ['en', 'es']);
  assert.deepEqual(Object.keys(SCENES.es).sort(), Object.keys(SCENES.en).sort());
  for (const key of REQUIRED) assert.ok(SCENES.en[key], `missing scene ${key}`);
});

test('translations line up: same number of lines and the same speaker per line', () => {
  for (const key of Object.keys(SCENES.en)) {
    assert.equal(SCENES.es[key].length, SCENES.en[key].length, `${key} has a different number of lines`);
    SCENES.en[key].forEach((line, i) => assert.equal(SCENES.es[key][i].speaker, line.speaker, `${key}[${i}] speaker`));
  }
});

test('every speaker exists, no text is empty and every line is at most 140 chars', () => {
  for (const [lang, scenes] of Object.entries(SCENES)) {
    for (const [key, lines] of Object.entries(scenes)) {
      assert.ok(lines.length > 0, `${lang}:${key} is empty`);
      lines.forEach(({ speaker, text }, i) => {
        assert.ok(CHARACTERS[speaker], `${lang}:${key}[${i}] unknown speaker ${speaker}`);
        assert.ok(typeof text === 'string' && text.trim(), `${lang}:${key}[${i}] has no text`);
        assert.ok(text.length <= 140, `${lang}:${key}[${i}] is ${text.length} chars`);
      });
    }
  }
});

test('the characters talk to each other: every world has at least three speakers', () => {
  for (const w of [1, 2, 3, 4]) {
    const speakers = new Set(
      Object.entries(SCENES.en)
        .filter(([key]) => key.startsWith(`w${w}_`))
        .flatMap(([, lines]) => lines.map((l) => l.speaker)),
    );
    assert.ok(speakers.size >= 3, `world ${w} only has ${[...speakers]}`);
    assert.ok(speakers.has('mochi'), `Mochi never talks in world ${w}`);
  }
});
