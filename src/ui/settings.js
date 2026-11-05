// Player settings persisted in localStorage. Storage can be unavailable
// (private mode), so every access is guarded and defaults always work.
const KEY = 'babycat-settings';
const DEFAULTS = { music: 0.8, sfx: 0.8, quality: 'auto', vibration: true };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
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
