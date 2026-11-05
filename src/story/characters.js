// Story cast: display data and voice profile for every character that speaks.
// `voice.pitch` / `voice.rate` drive Web Speech; `voice.blip` drives the procedural chirp voice.
// Names are proper names and stay identical in every language.

export const CHARACTERS = {
  mochi: {
    name: 'Mochi',
    emoji: '🐱',
    color: '#f6a04d',
    voice: { pitch: 1.7, rate: 1.1, gender: 'female', blip: { base: 640, wave: 'triangle', spread: 0.25 } },
  },
  pip: {
    name: 'Pip',
    emoji: '🐦',
    color: '#4aa3ff',
    voice: { pitch: 2.0, rate: 1.3, gender: 'female', blip: { base: 1150, wave: 'sine', spread: 0.35 } },
  },
  bruno: {
    name: 'Bruno',
    emoji: '🐢',
    color: '#5f9e4f',
    voice: { pitch: 0.45, rate: 0.8, gender: 'male', blip: { base: 130, wave: 'sawtooth', spread: 0.1 } },
  },
  luna: {
    name: 'Luna',
    emoji: '🦋',
    color: '#b28dff',
    voice: { pitch: 1.35, rate: 0.9, gender: 'female', blip: { base: 520, wave: 'sine', spread: 0.15, vibrato: true } },
  },
  pom: {
    name: 'Pom',
    emoji: '🐧',
    color: '#3d4a66',
    voice: { pitch: 1.15, rate: 1.25, gender: 'male', blip: { base: 330, wave: 'square', spread: 0.3 } },
  },
  hazel: {
    name: 'Hazel',
    emoji: '🦉',
    color: '#a0703c',
    voice: { pitch: 0.85, rate: 0.85, gender: 'female', blip: { base: 260, wave: 'triangle', spread: 0.12 } },
  },
  fluff: {
    name: 'Lord Fluff',
    emoji: '👑',
    color: '#7b6a9b',
    voice: { pitch: 0.6, rate: 1.0, gender: 'male', blip: { base: 170, wave: 'sawtooth', spread: 0.45 } },
  },
};
