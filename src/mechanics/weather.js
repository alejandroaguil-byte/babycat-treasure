import * as THREE from 'three';
import { glowTexture } from '../effects.js';
import { t } from '../i18n/index.js';

/**
 * Atmospheric conditions of a level. Purely visual parts (rain, snow, leaves,
 * lightning) plus the gameplay-relevant wind cycle: calm -> warning -> gust.
 */
export class Weather {
  constructor({ scene, def, level, fog, hemi, audio, ui }) {
    this.scene = scene;
    this.audio = audio;
    this.ui = ui;
    this.hemi = hemi;
    this.hemiBase = hemi.intensity;
    this.fog = fog;
    this.fogBase = fog ? { near: fog.near, far: fog.far } : null;
    this.cfg = def.weather ?? {};
    this.extent = Math.max(level.width, level.depth) / 2 + 2;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;

    const w = this.cfg.wind;
    this.wind = w ? { ...w, dirV: new THREE.Vector3(w.dir[0], 0, w.dir[1]), phase: 'calm', t: w.calm } : null;
    if (this.cfg.rain) this.rain = this.makeRain();
    if (this.cfg.snow) this.snow = this.makeFlakes(900, '#ffffff', 0.14);
    if (this.cfg.leaves) this.leaves = this.makeFlakes(160, null, 0.2);
    if (this.cfg.lightning) this.nextStrike = 3;
    if (this.rain) audio.startAmbience('rain');
    if (this.wind?.blizzard) audio.startAmbience('wind');

    ui.weather.classList.toggle('hidden', !this.wind);
    this.renderUi();
  }

  get gust() {
    return this.wind?.phase === 'gust';
  }

  get blizzard() {
    return this.gust && this.wind.blizzard;
  }

  // ------------------------------------------------------------ builders
  makeRain() {
    const count = 900;
    const pos = new Float32Array(count * 6);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.resetDrop(pos, i, Math.random() * 14);
      speed[i] = 11 + Math.random() * 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: '#a9b8ff', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    lines.frustumCulled = false;
    this.group.add(lines);
    return { lines, pos, speed, count };
  }

  resetDrop(pos, i, y) {
    const e = this.extent;
    const x = (Math.random() * 2 - 1) * e;
    const z = (Math.random() * 2 - 1) * e;
    pos.set([x, y, z, x - 0.05, y + 0.4, z], i * 6);
  }

  makeFlakes(count, color, size) {
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = ['#e8662c', '#f2a03d', '#c8412b', '#ffd166'].map((c) => new THREE.Color(c));
    const e = this.extent;
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() * 2 - 1) * e, Math.random() * 12 - 1, (Math.random() * 2 - 1) * e], i * 3);
      const c = color ? new THREE.Color(color) : palette[i % palette.length];
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, opacity: 0.95 }),
    );
    points.frustumCulled = false;
    this.group.add(points);
    return { points, pos, count, seeds: Float32Array.from({ length: count }, () => Math.random() * 10) };
  }

  // ------------------------------------------------------------ update
  /** `holdWind` freezes the gust cycle (story dialogue) while rain and snow keep falling. */
  update(dt, camera, { holdWind = false } = {}) {
    this.time += dt;
    if (!holdWind) this.updateWind(dt);
    const windSpeed = !this.wind ? 0 : this.wind.phase === 'gust' ? (this.wind.blizzard ? 9 : 7) : this.wind.phase === 'warning' ? 2.5 : 0.4;
    const wx = this.wind ? this.wind.dirV.x * windSpeed : 0;
    const wz = this.wind ? this.wind.dirV.z * windSpeed : 0;

    if (this.rain) {
      const { pos, speed, count, lines } = this.rain;
      for (let i = 0; i < count; i++) {
        const o = i * 6;
        const dy = speed[i] * dt;
        pos[o + 1] -= dy;
        pos[o + 4] -= dy;
        if (pos[o + 1] < -1) this.resetDrop(pos, i, 12 + Math.random() * 2);
      }
      lines.geometry.attributes.position.needsUpdate = true;
    }
    for (const flakes of [this.snow, this.leaves]) {
      if (!flakes) continue;
      const { pos, count, seeds, points } = flakes;
      const fall = flakes === this.leaves ? 0.8 : 1.1;
      const e = this.extent;
      for (let i = 0; i < count; i++) {
        const o = i * 3;
        const s = seeds[i];
        pos[o] += (Math.sin(this.time * 1.3 + s) * 0.4 + wx) * dt;
        pos[o + 1] -= fall * (0.6 + (s % 1)) * dt;
        pos[o + 2] += (Math.cos(this.time * 1.1 + s) * 0.4 + wz) * dt;
        if (pos[o + 1] < -1.2) pos[o + 1] = 11;
        if (pos[o] > e) pos[o] -= 2 * e;
        if (pos[o] < -e) pos[o] += 2 * e;
        if (pos[o + 2] > e) pos[o + 2] -= 2 * e;
        if (pos[o + 2] < -e) pos[o + 2] += 2 * e;
      }
      points.geometry.attributes.position.needsUpdate = true;
    }

    // blizzard whiteout
    if (this.fog && this.fogBase && this.wind?.blizzard) {
      const target = this.blizzard ? { near: 3, far: 13 } : this.fogBase;
      this.fog.near += (target.near - this.fog.near) * Math.min(1, dt * 2);
      this.fog.far += (target.far - this.fog.far) * Math.min(1, dt * 2);
    }

    // lightning
    if (this.cfg.lightning) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) this.strike();
      const k = this.flash ?? 0;
      this.hemi.intensity = this.hemiBase + k * 6;
      this.flash = Math.max(0, k - dt * 5);
    }

    if (this.wind && camera) this.renderArrow(camera);
  }

  updateWind(dt) {
    const w = this.wind;
    if (!w) return;
    w.t -= dt;
    if (w.t > 0) return;
    if (w.phase === 'calm') {
      w.phase = 'warning';
      w.t = w.warning;
      this.audio.windRise(w.warning);
    } else if (w.phase === 'warning') {
      w.phase = 'gust';
      w.t = w.gust;
      this.audio.gust(w.gust);
    } else {
      w.phase = 'calm';
      w.t = w.calm * (0.85 + Math.random() * 0.3);
    }
    this.renderUi();
  }

  strike() {
    const { min, max } = this.cfg.lightning;
    this.nextStrike = min + Math.random() * (max - min);
    this.flash = 1;
    this.ui.flashWhite();
    setTimeout(() => (this.flash = 0.8), 140);
    this.audio.thunder(0.3 + Math.random() * 0.5);
  }

  renderUi() {
    if (!this.wind) return;
    const el = this.ui.weather;
    el.dataset.phase = this.wind.phase;
    el.querySelector('.label').textContent =
      this.wind.phase === 'gust'
        ? t(this.wind.blizzard ? 'weather.blizzard' : 'weather.gust')
        : t(this.wind.phase === 'warning' ? 'weather.rising' : 'weather.calm');
  }

  renderArrow(camera) {
    const a = new THREE.Vector3(0, 0, 0).project(camera);
    const b = this.wind.dirV.clone().project(camera);
    const angle = Math.atan2(-(b.y - a.y), b.x - a.x);
    this.ui.weather.querySelector('.arrow').style.transform = `rotate(${angle}rad)`;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.audio.stopAmbience();
    this.ui.weather.classList.add('hidden');
    if (this.fog && this.fogBase) Object.assign(this.fog, this.fogBase);
    this.hemi.intensity = this.hemiBase;
  }
}
