import { test } from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/i18n/en.js';
import es from '../src/i18n/es.js';
import { t, translate, setLang, getLang } from '../src/i18n/index.js';
import { LEVELS } from '../src/game/levels/index.js';

test('en and es have exactly the same keys and no empty values', () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  for (const [lang, dict] of Object.entries({ en, es })) {
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, 'string', `${lang}:${key} is not a string`);
      assert.ok(value.trim().length > 0, `${lang}:${key} is empty`);
    }
  }
});

test('t interpolates {name} params', () => {
  const dicts = { en: { hi: 'Hi {name}, {n}/{total}!' }, es: { hi: '¡Hola {name}, {n}/{total}!' } };
  assert.equal(translate(dicts, 'en', 'hi', { name: 'Mochi', n: 1, total: 3 }), 'Hi Mochi, 1/3!');
  assert.equal(translate(dicts, 'es', 'hi', { name: 'Mochi', n: 0, total: 3 }), '¡Hola Mochi, 0/3!');
  // unknown params stay visible instead of becoming "undefined"
  assert.equal(translate(dicts, 'en', 'hi', { name: 'Pip' }), 'Hi Pip, {n}/{total}!');
});

test('t falls back to English, then to the key', () => {
  const dicts = { en: { only: 'English only' }, es: {} };
  assert.equal(translate(dicts, 'es', 'only'), 'English only');
  assert.equal(translate(dicts, 'es', 'missing.key'), 'missing.key');
  assert.equal(translate(dicts, 'fr', 'only'), 'English only');
});

test('t uses the current language from setLang', () => {
  const before = getLang();
  try {
    setLang('es');
    assert.equal(getLang(), 'es');
    assert.equal(t('settings.done'), es['settings.done']);
    setLang('en');
    assert.equal(t('settings.done'), en['settings.done']);
    setLang('xx');
    assert.equal(getLang(), 'en', 'unknown languages fall back to English');
  } finally {
    setLang(before);
  }
});

test('every level id has title, episode and mission keys in both languages', () => {
  for (const def of LEVELS) {
    for (const field of ['title', 'episode', 'mission']) {
      const key = `level.${def.id}.${field}`;
      assert.ok(en[key], `en is missing ${key}`);
      assert.ok(es[key], `es is missing ${key}`);
    }
    assert.equal(def.title, undefined, `level ${def.id} still has an English title literal`);
  }
});
