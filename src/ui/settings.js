// Player settings persisted in localStorage. Storage can be unavailable
// (private mode), so every access is guarded and defaults always work.
const KEY = 'babycat-settings';
const DEFAULTS = { music: 0.8, sfx: 0.8, quality: 'auto', vibration: true };

const QUALITIES = new Set(['auto', 'high', 'medium', 'low']);
const clamp01 = (v, fallback) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

/** Parses stored settings, repairing any value outside its domain. */
export function parseSettings(raw) {
  let stored = {};
  try {
    stored = JSON.parse(raw ?? '{}') ?? {};
  } catch {
    stored = {};
  }
  return {
    music: clamp01(stored.music, DEFAULTS.music),
    sfx: clamp01(stored.sfx, DEFAULTS.sfx),
    quality: QUALITIES.has(stored.quality) ? stored.quality : DEFAULTS.quality,
    vibration: typeof stored.vibration === 'boolean' ? stored.vibration : DEFAULTS.vibration,
  };
}

function load() {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage blocked: settings still apply for this session
  }
}

export function vibrate(pattern) {
  if (settings.vibration && 'vibrate' in navigator) navigator.vibrate(pattern);
}
