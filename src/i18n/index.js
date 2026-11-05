// Tiny i18n layer: flat key maps per language, {name} interpolation and an English fallback.
// Importing this module never touches the DOM, so it also runs under node:test.
import en from './en.js';
import es from './es.js';

export const DICTS = { en, es };
export const LANGS = Object.keys(DICTS);
const FALLBACK = 'en';

let current = FALLBACK;
const listeners = new Set();

/** Looks a key up in `lang`, then in English, then returns the key itself. PURE. */
export function translate(dicts, lang, key, params) {
  const text = dicts[lang]?.[key] ?? dicts[FALLBACK]?.[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? match : String(params[name])));
}

/** Translates `key` into the current language, filling `{name}` placeholders from `params`. */
export function t(key, params) {
  return translate(DICTS, current, key, params);
}

export function getLang() {
  return current;
}

/** Switches the language (unknown codes fall back to English) and notifies listeners. */
export function setLang(lang) {
  const next = DICTS[lang] ? lang : FALLBACK;
  const changed = next !== current;
  current = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  if (changed) listeners.forEach((fn) => fn(next));
  return next;
}

/** Calls `fn(lang)` after every language change; returns an unsubscribe function. */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Fills static markup: [data-i18n] text, [data-i18n-html] markup (only for our own
 * dictionary strings with <kbd>/<b>), and [data-i18n-title] / [data-i18n-aria] attributes.
 */
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
}
