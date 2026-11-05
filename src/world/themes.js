import * as THREE from 'three';

// Visual identity of each environment: palette, sky, lights and fog.
export const THEMES = {
  meadow: {
    sky: 'linear-gradient(180deg, #8fd3ff 0%, #c9ecff 55%, #ffe9c7 100%)',
    grass: ['#86d65f', '#74c552'],
    dirt: { base: '#a06c45', strata: '#8c5b38', light: '#b98260', dark: '#7d5031' },
    tray: '#6b4430',
    rim: '#f2c14e',
    foliage: ['#4caf50'],
    flowers: ['#ff7eb6', '#ffe066', '#ffffff', '#b28dff'],
    hemi: ['#d6eeff', '#8a6a4a', 1.5],
    sun: ['#fff1d6', 2.6],
    fog: null,
    clouds: '#ffffff',
    wet: '#4f8f5a',
    ice: '#bfe6ff',
  },
  autumn: {
    sky: 'linear-gradient(180deg, #ffb38a 0%, #ffd6b0 50%, #fff0d6 100%)',
    grass: ['#d9a441', '#c99033'],
    dirt: { base: '#9b5a3c', strata: '#7f4630', light: '#b5714f', dark: '#6a3925' },
    tray: '#5c3424',
    rim: '#e07a3f',
    foliage: ['#e8662c', '#f2a03d', '#c8412b'],
    flowers: ['#ffd166', '#e8662c', '#ffffff'],
    hemi: ['#ffe2c4', '#7a4a30', 1.4],
    sun: ['#ffd2a1', 2.5],
    fog: { color: '#ffd6b0', near: 30, far: 70 },
    clouds: '#fff3e6',
    wet: '#8a6a3a',
    ice: '#bfe6ff',
  },
  storm: {
    sky: 'linear-gradient(180deg, #070b22 0%, #1b2350 60%, #31305e 100%)',
    grass: ['#3f7f6a', '#356f5c'],
    dirt: { base: '#4e3d4f', strata: '#3d2f40', light: '#5f4d61', dark: '#2c2130' },
    tray: '#241b2b',
    rim: '#7a6cff',
    foliage: ['#2f6b55'],
    flowers: ['#9ff0ff', '#c8a6ff', '#ffffff'],
    hemi: ['#4a5a9a', '#1a1424', 0.55],
    sun: ['#9fb4ff', 0.45],
    fog: { color: '#141a3a', near: 14, far: 34 },
    clouds: '#5b6290',
    wet: '#2f5c6e',
    ice: '#bfe6ff',
  },
  snow: {
    sky: 'linear-gradient(180deg, #a9cdf0 0%, #dbeafa 55%, #ffffff 100%)',
    grass: ['#f4f8ff', '#e3ecf7'],
    dirt: { base: '#7d8794', strata: '#6a7380', light: '#949eab', dark: '#5a626d' },
    tray: '#4c5561',
    rim: '#9fd3ff',
    foliage: ['#2f6b4f'],
    flowers: ['#ffffff'],
    hemi: ['#e8f3ff', '#6a7a90', 1.6],
    sun: ['#ffffff', 2.2],
    fog: { color: '#e6f0fb', near: 26, far: 60 },
    clouds: '#ffffff',
    wet: '#9fb4c8',
    ice: '#a9dcff',
  },
};

/** Vertical gradient texture built from the colors of a theme's CSS sky. */
export function skyTexture(theme) {
  const colors = theme.sky.match(/#[0-9a-f]{6}/gi);
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  colors.forEach((col, i) => grad.addColorStop(i / (colors.length - 1), col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
