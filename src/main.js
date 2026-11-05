import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LEVELS } from './game/levels/index.js';
import {
  parseLevel, createState, findPath, canStep, heightAt, isWalkable, sameCell, slideNext, windPush, DIRS,
} from './game/grid.js';
import { buildWorld } from './world/build.js';
import { THEMES, skyTexture } from './world/themes.js';
import { PostFX, QualityGovernor, autoQuality } from './render/postfx.js';
import { addOutline } from './render/outline.js';
import { settings, saveSettings, vibrate } from './ui/settings.js';
import { createCat, animateCat, createYarnBall } from './world/models.js';
import { createEnemies } from './mechanics/enemies.js';
import { Weather } from './mechanics/weather.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { Tweens, ease } from './tween.js';

// ------------------------------------------------------------ engine setup
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Neutral keeps the pastel sky saturated when post-processing tone-maps the whole frame.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enableDamping: true, dampingFactor: 0.08, enablePan: false, minPolarAngle: 0.25, maxPolarAngle: 1.35, rotateSpeed: 0.7, enabled: false,
});

const hemi = new THREE.HemisphereLight('#d6eeff', '#8a6a4a', 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
sun.position.set(6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 45 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const postfx = new PostFX(renderer, scene, camera, sun);
const governor = new QualityGovernor((level, fps) => {
  postfx.setQuality(level);
  console.info(`[quality] ${Math.round(fps)} fps, switching to ${level}`);
});
function applyQuality() {
  const level = settings.quality === 'auto' ? autoQuality() : settings.quality;
  governor.reset(level);
  postfx.setQuality(level);
}
applyQuality();

const effects = new Effects(scene);
const audio = new AudioEngine();
audio.setVolumes(settings.music, settings.sfx);
const tweens = new Tweens();

const markerMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false });
const hoverMarker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), markerMat);
hoverMarker.rotation.x = -Math.PI / 2;
hoverMarker.visible = false;
scene.add(hoverMarker);

// ------------------------------------------------------------ progress
const PROGRESS_KEY = 'babycat-progress';
const progress = (() => {
  try {
    return { unlocked: 1, best: {}, ...JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') };
  } catch {
    return { unlocked: 1, best: {} };
  }
})();
const saveProgress = () => localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));

// ------------------------------------------------------------ level runtime
let levelIndex = 0;
let def;
let level;
let state;
let theme;
let world;
let cat;
let enemies = [];
let weather = null;
let levelGroup = null;
let ox = 0;
let oz = 0;
let defaultCam = new THREE.Vector3();
const defaultTarget = new THREE.Vector3(0, 1.2, 0);

const toWorld = (x, z, h) => new THREE.Vector3(x - ox, h ?? 0, z - oz);
const heightOf = ([x, z]) => heightAt(level, state, x, z);
const cellCenter = (cell) => toWorld(cell[0], cell[1], heightOf(cell));

const actor = {};
const game = { mode: 'title', run: 0 };

function resetRuntime() {
  Object.assign(actor, {
    cell: [...def.start], target: null, path: [], waypoints: [], pending: null, yaw: 0,
    stepTimer: 0, hurtTimer: 0, slid: 0, sliding: false, busy: false, pushCooldown: 0,
  });
  Object.assign(game, {
    hearts: 3, gems: 0, coins: 0, held: null, invuln: 0, shake: 0, time: 0, projectiles: [],
    keys: 0, fireflies: 0, warmth: 100, coldTick: 0, spinning: false,
  });
}

function applyTheme() {
  document.body.style.background = theme.sky;
  postfx.sky?.texture.dispose();
  postfx.setSky(theme.sky.match(/#[0-9a-f]{6}/gi), skyTexture(theme));
  hemi.color.set(theme.hemi[0]);
  hemi.groundColor.set(theme.hemi[1]);
  hemi.intensity = theme.hemi[2];
  sun.color.set(theme.sun[0]);
  sun.intensity = theme.sun[1];
  scene.fog = theme.fog ? new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far) : null;
}

function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  });
}

function unloadLevel() {
  game.run++;
  tweens.list.length = 0;
  effects.clear();
  weather?.dispose();
  weather = null;
  enemies.forEach((e) => e.dispose?.());
  enemies = [];
  if (levelGroup) {
    scene.remove(levelGroup);
    disposeTree(levelGroup);
    levelGroup = null;
  }
  hoverMarker.visible = false;
  keys.clear();
}

function loadLevel(index) {
  unloadLevel();
  levelIndex = index;
  def = LEVELS[index];
  level = parseLevel(def);
  state = createState();
  theme = THEMES[def.theme];
  ox = (level.width - 1) / 2;
  oz = (level.depth - 1) / 2;
  applyTheme();
  resetRuntime();

  levelGroup = new THREE.Group();
  scene.add(levelGroup);
  world = buildWorld(level, theme, toWorld);
  levelGroup.add(world.group);

  cat = createCat();
  cat.root.position.copy(cellCenter(def.start));
  levelGroup.add(cat.root);
  if (def.weather?.night) {
    const lantern = new THREE.PointLight('#ffd27a', 9, 6.5, 1.3);
    lantern.position.set(0, 1.0, 0.2);
    cat.root.add(lantern);
  }

  enemies = createEnemies(def, {
    level, state, cellCenter, effects, audio, group: levelGroup, catCell: () => actor.cell,
  });
  addOutline(cat.root, 0.07);
  enemies.forEach((e) => addOutline(e.root, 0.06));
  postfx.setTiltStrength(1);
  weather = new Weather({ scene, def, level, fog: scene.fog, hemi, audio, ui });

  const size = Math.max(level.width, level.depth) / 9;
  defaultCam = new THREE.Vector3(9.5, 10.5, 12.5).multiplyScalar(size);
  controls.minDistance = 7 * size;
  controls.maxDistance = 26 * size;
  sun.shadow.camera.far = 45 * size;
  camera.position.copy(defaultCam).multiplyScalar(2.2);
  controls.target.copy(defaultTarget);
  camera.lookAt(defaultTarget);
  ui.levelLabel.textContent = `${def.episode} · ${def.title}`;
  renderHud();
}

// ------------------------------------------------------------ HUD
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'),
  hearts: $('hearts'),
  gems: $('gems'),
  coins: $('coin-count'),
  toast: $('toast'),
  held: $('held-hint'),
  flash: $('flash'),
  mute: $('mute'),
  keySlot: $('key-slot'),
  keyLabel: $('key-label'),
  fireflySlot: $('firefly-slot'),
  fireflyCount: $('firefly-count'),
  warmth: $('warmth'),
  warmthFill: $('warmth-fill'),
  levelLabel: $('level-label'),
  weather: $('weather'),
  flashWhite() {
    $('flash-white').classList.add('on');
    setTimeout(() => $('flash-white').classList.remove('on'), 80);
  },
};

function renderHud() {
  ui.hearts.innerHTML = [0, 1, 2].map((i) => `<span class="${i < game.hearts ? '' : 'lost'}">&#9829;</span>`).join('');
  ui.gems.innerHTML = world.items
    .filter((i) => i.kind === 'gem')
    .map((g) => `<span class="${g.collected ? 'got' : ''}" style="--c:${g.color}"></span>`)
    .join('');
  ui.coins.textContent = game.coins;
  ui.held.classList.toggle('hidden', !game.held);
  $('btn-throw').classList.toggle('hidden', !game.held);
  ui.keySlot.classList.toggle('hidden', !def.keys);
  ui.keySlot.classList.toggle('got', game.keys > 0);
  ui.keyLabel.textContent = game.keys > 0 ? 'Gate open!' : 'Find the key';
  ui.fireflySlot.classList.toggle('hidden', !def.fireflies);
  ui.fireflyCount.textContent = `${game.fireflies}/${def.fireflies?.length ?? 0}`;
  ui.warmth.classList.toggle('hidden', !def.weather?.cold);
}

function bump(el) {
  el.parentElement.classList.remove('bump');
  void el.parentElement.offsetWidth;
  el.parentElement.classList.add('bump');
}

function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.remove('hidden');
  ui.toast.style.animation = 'none';
  void ui.toast.offsetWidth;
  ui.toast.style.animation = '';
}

// ------------------------------------------------------------ movement
const dirVector = (from, to) => new THREE.Vector3(to[0] - from[0], 0, to[1] - from[1]);

/** Builds the waypoints to move between two adjacent cells (walking, sliding or via ladder). */
function beginStep(to) {
  const from = actor.cell;
  const hf = heightOf(from);
  const ht = heightOf(to);
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dir = dirVector(from, to);
  actor.target = to;
  if (hf === ht) {
    actor.waypoints = [{ p: b, face: dir, speed: actor.sliding ? 4.5 : undefined }];
    return;
  }
  const up = ht > hf;
  const lowToHigh = up ? dir.clone() : dir.clone().negate();
  const boundary = a.clone().lerp(b, 0.5);
  const hLow = Math.min(hf, ht);
  const hHigh = Math.max(hf, ht);
  const foot = boundary.clone().addScaledVector(lowToHigh, -0.24).setY(hLow);
  const top = foot.clone().setY(hHigh);
  const ledge = boundary.clone().addScaledVector(lowToHigh, 0.18).setY(hHigh);
  actor.waypoints = up
    ? [{ p: foot, face: dir }, { p: top, face: lowToHigh, climb: true }, { p: ledge, face: dir }, { p: b, face: dir }]
    : [{ p: ledge, face: dir }, { p: top, face: lowToHigh }, { p: foot, face: lowToHigh, climb: true }, { p: b, face: dir }];
}

function goTo(dest) {
  if (actor.busy) return;
  const from = actor.target ?? actor.cell;
  const path = findPath(level, state, from, dest);
  if (!path) {
    if (level.gates.has(`${dest[0]},${dest[1]}`) && !state.gateOpen) audio.locked();
    else audio.denied();
    effects.ring(toWorld(dest[0], dest[1], heightOf(dest) ?? level.heights[dest[1]]?.[dest[0]] ?? 0), '#ff6b6b');
    return;
  }
  audio.uiClick();
  effects.ring(cellCenter(dest), '#ffffff');
  if (actor.target) {
    actor.path = [];
    actor.pending = dest;
  } else {
    actor.path = path.slice(1);
  }
}

function arrive(cell) {
  const prev = actor.cell;
  actor.cell = cell;
  actor.target = null;
  onEnterCell(cell);
  if (game.mode !== 'play') return;
  const forced = slideNext(level, state, prev, cell, actor.slid);
  if (forced) {
    if (!actor.sliding) audio.slide();
    actor.slid++;
    actor.sliding = true;
    if (!(actor.path.length && sameCell(actor.path[0], forced))) actor.path = [forced];
    return;
  }
  actor.slid = 0;
  actor.sliding = false;
  if (actor.pending) {
    const p = findPath(level, state, cell, actor.pending);
    actor.path = p ? p.slice(1) : [];
    actor.pending = null;
  }
}

const keys = new Set();
const KEY_DIRS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

/** Picks the grid direction that best matches the held key relative to the camera. */
function keyboardStep() {
  let input = null;
  for (const k of keys) if (KEY_DIRS[k]) input = KEY_DIRS[k];
  if (!input) return null;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const want = right.multiplyScalar(input[0]).addScaledVector(fwd, -input[1]);
  let best = DIRS[0];
  let bestDot = -Infinity;
  for (const d of DIRS) {
    const dot = d[0] * want.x + d[1] * want.z;
    if (dot > bestDot) {
      bestDot = dot;
      best = d;
    }
  }
  return best;
}

function turnCat(dt) {
  if (game.spinning) return;
  let diff = actor.yaw - cat.root.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  cat.root.rotation.y += diff * (1 - Math.exp(-14 * dt));
}

function updateActor(dt) {
  actor.hurtTimer = Math.max(0, actor.hurtTimer - dt);
  actor.pushCooldown -= dt;
  if (actor.busy) return;

  if (!actor.waypoints.length && game.mode === 'play') {
    if (weather?.gust && !actor.sliding && game.invuln <= 0 && actor.pushCooldown <= 0) {
      const push = windPush(level, state, actor.cell, weather.wind.dir);
      if (push) {
        actor.pushCooldown = 0.6;
        pushCat(push);
        return;
      }
    }
    if (!actor.path.length) {
      const d = keyboardStep();
      if (d) {
        const next = [actor.cell[0] + d[0], actor.cell[1] + d[1]];
        if (canStep(level, state, actor.cell, next)) actor.path = [next];
        else actor.yaw = Math.atan2(d[0], d[1]);
      }
    }
    if (actor.path.length) beginStep(actor.path.shift());
  }

  const pos = cat.root.position;
  if (actor.waypoints.length) {
    const wp = actor.waypoints[0];
    const speed = wp.speed ?? (wp.climb ? 1.8 : 3);
    const delta = wp.p.clone().sub(pos);
    const dist = delta.length();
    const move = speed * dt;
    if (wp.face && !wp.keepFacing) actor.yaw = Math.atan2(wp.face.x, wp.face.z);
    cat.mode = actor.hurtTimer > 0 ? 'hurt' : wp.climb ? 'climb' : actor.sliding || wp.keepFacing ? 'idle' : 'walk';
    if (dist <= move) {
      pos.copy(wp.p);
      actor.waypoints.shift();
      if (!actor.waypoints.length) {
        arrive(actor.target);
        if (game.mode !== 'play') return;
      }
    } else {
      pos.addScaledVector(delta, move / dist);
    }
    actor.stepTimer -= dt;
    if (actor.stepTimer <= 0) {
      if (wp.climb) {
        audio.climb();
        actor.stepTimer = 0.2;
      } else if (cat.mode === 'walk') {
        audio.step();
        actor.stepTimer = 0.24;
        if (Math.random() < 0.35) effects.dust(pos.clone().add(new THREE.Vector3(0, 0.05, 0)), 2);
      } else if (actor.sliding) {
        effects.burst({ pos: pos.clone().add(new THREE.Vector3(0, 0.05, 0)), count: 2, colors: ['#ffffff', '#dff4ff'], speed: 0.6, up: 0.4, gravity: -1, life: 0.4, size: 0.12, additive: false });
        actor.stepTimer = 0.08;
      }
    }
  } else if (game.mode === 'play') {
    cat.mode = actor.hurtTimer > 0 ? 'hurt' : 'idle';
  }

  turnCat(dt);
  if (game.invuln > 0) {
    game.invuln -= dt;
    cat.root.visible = game.invuln <= 0 || Math.floor(game.invuln * 12) % 2 === 0;
  } else cat.root.visible = true;
}

/** Wind gust: slide one tile downwind, or fall off the edge. */
function pushCat(push) {
  actor.path = [];
  actor.pending = null;
  effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 0.4, 0)), count: 6, colors: ['#ffffff'], speed: 1, up: 0.5, additive: false, size: 0.2, life: 0.4 });
  if (push.to) {
    actor.target = push.to;
    actor.waypoints = [{ p: cellCenter(push.to), speed: 4, keepFacing: true }];
    audio.meow({ pitch: 1.4, dur: 0.25, vol: 0.1 });
    return;
  }
  fallOff(weather.wind.dir);
}

async function fallOff(dir) {
  const run = game.run;
  actor.busy = true;
  audio.fall();
  const start = cat.root.position.clone();
  const edge = start.clone().add(new THREE.Vector3(dir[0] * 0.75, 0, dir[1] * 0.75));
  await tweens.add(0.25, (k) => cat.root.position.lerpVectors(start, edge, k), ease.linear);
  if (run !== game.run) return;
  await tweens.add(0.9, (k) => {
    cat.root.position.set(edge.x + dir[0] * k, edge.y - k * k * 7, edge.z + dir[1] * k);
    cat.root.rotation.z = k * 6;
  }, ease.linear);
  if (run !== game.run) return;
  cat.root.rotation.z = 0;
  cat.root.position.copy(cellCenter(actor.cell));
  effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 0.5, 0)), count: 12, colors: ['#ffffff', '#ffe066'], speed: 1.5, up: 2 });
  actor.busy = false;
  damage('fall');
}

// ------------------------------------------------------------ cell events
function onEnterCell(cell) {
  for (const item of world.items) {
    if (!item.collected && sameCell(item.cell, cell)) collect(item);
  }
  for (const sprout of world.sprouts) {
    if (sprout.ready && !game.held && sameCell(sprout.cell, cell)) pluck(sprout);
  }
  if (def.switch && sameCell(def.switch, cell) && !state.raised.has('switch')) pressSwitch();
  if (sameCell(def.milk, cell)) victory();
}

function flyAway(item, height = 1.0) {
  const holder = item.holder ?? item.gem ?? item.root;
  const y0 = holder.position.y;
  return tweens.add(0.6, (k) => {
    holder.position.y = y0 + k * height;
    holder.rotation.y += 0.4;
    item.root.scale.setScalar(Math.max(0.01, 1 + Math.sin(k * Math.PI) * 0.4 - k));
  }, ease.outCubic).then(() => (item.root.visible = false));
}

function collect(item) {
  item.collected = true;
  const p = item.root.position.clone().add(new THREE.Vector3(0, 0.45, 0));
  switch (item.kind) {
    case 'coin':
      game.coins++;
      audio.coin();
      effects.burst({ pos: p, count: 8, colors: ['#ffe066', '#fff6c4'], speed: 1.2, up: 2, life: 0.5, size: 0.18 });
      bump(ui.coins);
      break;
    case 'gem':
      game.gems++;
      audio.gem();
      effects.burst({ pos: p, count: 26, colors: [item.color, '#ffffff'], speed: 2.5, up: 3, life: 0.9, size: 0.25 });
      effects.ring(item.root.position, item.color);
      game.shake = 0.08;
      toast(`Gem found! (${game.gems}/${def.gems.length})`);
      vibrate(30);
      break;
    case 'key':
      game.keys++;
      audio.key();
      effects.burst({ pos: p, count: 18, colors: ['#ffe066', '#ffffff'], speed: 2, up: 2.5 });
      toast('Got the key! A gate creaks open...');
      openGates();
      break;
    case 'fish':
      audio.heal();
      if (game.hearts < 3) game.hearts++;
      else game.coins += 5;
      effects.burst({ pos: p, count: 14, colors: ['#ff7aa0', '#ffd1e8'], speed: 1.4, up: 2.2, size: 0.3 });
      toast(game.hearts === 3 ? 'Yummy fish! Hearts full' : 'Yummy fish! +1 heart');
      break;
    case 'firefly': {
      game.fireflies++;
      audio.firefly(game.fireflies);
      effects.burst({ pos: p, count: 16, colors: ['#d8ff5a', '#fffbb0'], speed: 1.8, up: 2, size: 0.22 });
      const total = def.fireflies.length;
      if (game.fireflies >= total) {
        toast('All fireflies! They light up a bridge!');
        raiseTrigger('fireflies');
      } else toast(`Firefly caught! (${game.fireflies}/${total})`);
      break;
    }
    case 'cocoa':
      game.warmth = 100;
      audio.cocoa();
      effects.burst({ pos: p, count: 10, colors: ['#ffffff', '#ffe0c0'], speed: 0.5, up: 2.5, gravity: 0.5, life: 1.1, size: 0.3, additive: false });
      toast('Hot cocoa! Toasty warm');
      break;
  }
  flyAway(item, item.kind === 'coin' ? 0.8 : 1.3);
  renderHud();
}

function pluck(sprout) {
  sprout.ready = false;
  audio.pluck();
  effects.dust(sprout.root.position.clone(), 8);
  sprout.root.visible = false;
  sprout.regrow = 8;
  const yarn = createYarnBall();
  cat.holdAnchor.add(yarn);
  yarn.scale.setScalar(0.01);
  tweens.add(0.35, (k) => yarn.scale.setScalar(Math.max(0.01, k)), ease.outBack);
  game.held = yarn;
  cat.armsUp = true;
  toast('Picked up a yarn ball!');
  renderHud();
}

function pressSwitch() {
  audio.button();
  const btn = world.button;
  tweens.add(0.15, (k) => (btn.cap.position.y = 0.13 - k * 0.07));
  btn.capMat.color.set('#5fd36a');
  btn.capMat.emissive.set('#5fd36a');
  effects.ring(btn.root.position, '#5fd36a');
  toast('Click! Something moved...');
  raiseTrigger('switch');
}

function raiseTrigger(trigger) {
  state.raised.add(trigger);
  world.bridges.filter((b) => b.trigger === trigger).forEach(raiseBridge);
}

async function raiseBridge(b) {
  const run = game.run;
  await tweens.wait(0.35);
  if (run !== game.run) return;
  audio.bridge();
  b.mesh.visible = true;
  const start = b.mesh.position.clone();
  game.shake = 0.15;
  await tweens.add(1.1, (k) => {
    b.mesh.position.lerpVectors(start, b.finalPos, k);
    b.mesh.rotation.y = (1 - k) * Math.PI;
  }, ease.outBack);
  if (run !== game.run) return;
  game.shake = 0.12;
  effects.dust(b.finalPos.clone(), 14);
  effects.burst({ pos: b.finalPos.clone().add(new THREE.Vector3(0, 0.3, 0)), count: 16, colors: ['#ffe066', '#ffffff'], speed: 2, up: 2.5 });
  b.mesh.traverse((o) => o.isMesh && world.pickables.push(o));
}

function openGates() {
  state.gateOpen = true;
  audio.gateOpen();
  for (const g of world.gates) {
    tweens.add(1.2, (k) => {
      g.bars.position.y = -k * 1.1;
      g.lock.rotation.z = k * 3;
    }, ease.inOutCubic);
    effects.dust(g.root.position.clone(), 10);
  }
}

// ------------------------------------------------------------ damage + combat
function damage(source, from) {
  if (game.mode !== 'play') return;
  game.hearts--;
  game.invuln = 2;
  game.shake = 0.25;
  actor.hurtTimer = 0.6;
  if (source === 'cold') audio.shiver();
  audio.hurt();
  ui.flash.classList.add('on');
  setTimeout(() => ui.flash.classList.remove('on'), 60);
  effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 0.6, 0)), count: 10, colors: ['#ffe066', '#ff6b6b'], speed: 2, up: 2, size: 0.2 });
  vibrate(source === 'fall' ? [80, 40, 220] : 160);
  renderHud();
  if (from) knockBack(from);
  if (game.hearts <= 0) gameOver(source);
}

function knockBack(from) {
  if (actor.sliding || actor.waypoints.some((w) => w.climb)) return;
  const options = [actor.cell, actor.target, ...DIRS.map((d) => [actor.cell[0] + d[0], actor.cell[1] + d[1]])]
    .filter((c) => c && isWalkable(level, state, c) && heightOf(c) === heightOf(actor.cell));
  let best = actor.cell;
  let bestDist = -1;
  for (const c of options) {
    const d = cellCenter(c).distanceTo(from);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  actor.path = [];
  actor.pending = null;
  actor.cell = best;
  actor.target = best;
  actor.waypoints = [{ p: cellCenter(best), speed: 5, keepFacing: true }];
}

function throwYarn(dirOverride) {
  if (!game.held || game.mode !== 'play') return;
  const yarn = game.held;
  game.held = null;
  cat.armsUp = false;
  renderHud();
  levelGroup.attach(yarn);
  const dir = dirOverride ?? new THREE.Vector3(Math.sin(actor.yaw), 0, Math.cos(actor.yaw));
  if (dirOverride) actor.yaw = Math.atan2(dir.x, dir.z);
  audio.throw();
  game.projectiles.push({ mesh: yarn, vel: dir.clone().normalize().multiplyScalar(8), life: 1.1, age: 0 });
}

function updateProjectiles(dt) {
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    p.life -= dt;
    p.age += dt;
    if (p.age > 0.45) p.vel.y -= 14 * dt; // flies flat, then drops
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += dt * 15;
    let done = p.life <= 0;
    const mp = p.mesh.position;
    for (const e of enemies) {
      if (!e.alive || done) continue;
      const c = e.center();
      if (Math.hypot(mp.x - c.x, mp.z - c.z) < 0.55 && Math.abs(mp.y - c.y) < 1) {
        done = true;
        const result = e.onYarn();
        if (result === 'defeat') defeatEnemy(e);
        else {
          audio.stun();
          toast('Stunned! Hurry past!');
        }
      }
    }
    if (done) {
      effects.burst({ pos: mp.clone(), count: 10, colors: ['#ff6fa3', '#ffffff'], speed: 1.5, up: 1.5 });
      levelGroup.remove(p.mesh);
      game.projectiles.splice(i, 1);
    }
  }
}

async function defeatEnemy(e) {
  const run = game.run;
  e.alive = false;
  audio.hit();
  audio.enemyDefeat();
  game.shake = 0.2;
  const p0 = e.root.position.clone();
  effects.burst({ pos: p0.clone().add(new THREE.Vector3(0, 0.4, 0)), count: 20, colors: ['#ffffff', '#b8a8d8', '#9fdcff'], speed: 3, up: 3, additive: false, size: 0.3 });
  await tweens.add(0.9, (k) => {
    if (e.kind === 'snowman') {
      e.root.scale.set(1 + k * 0.3, Math.max(0.05, 1 - k), 1 + k * 0.3);
      return;
    }
    e.root.position.set(p0.x, p0.y + Math.sin(k * Math.PI) * 1.8 - k * 3, p0.z);
    e.root.rotation.z = k * 8;
    e.root.scale.setScalar(Math.max(0.05, 1 - k * 0.8));
  }, ease.linear);
  if (run !== game.run) return;
  e.root.visible = false;
  game.coins += 3;
  audio.coin();
  toast('Enemy defeated! +3 coins');
  renderHud();
  bump(ui.coins);
}

function updateCold(dt) {
  if (!def.weather?.cold || game.mode !== 'play') return;
  const near = world.campfires.some((f) => Math.max(Math.abs(f.cell[0] - actor.cell[0]), Math.abs(f.cell[1] - actor.cell[1])) <= 1);
  if (near) game.warmth = Math.min(100, game.warmth + 40 * dt);
  else game.warmth -= def.weather.cold.drain * (weather?.blizzard ? 2.2 : 1) * dt;
  if (game.warmth <= 0) {
    game.warmth = 60;
    toast('Brrr! Too cold! Find a campfire');
    damage('cold');
  }
  ui.warmthFill.style.width = `${Math.max(0, game.warmth)}%`;
  ui.warmth.classList.toggle('cold', game.warmth < 30);
  game.coldTick -= dt;
  if (game.warmth < 30 && game.coldTick <= 0) {
    game.coldTick = 2.5;
    audio.shiver();
  }
}

// ------------------------------------------------------------ camera helpers
function rotateCamera(delta) {
  if (game.mode !== 'play') return;
  audio.whoosh();
  const offset = camera.position.clone().sub(controls.target);
  const sph = new THREE.Spherical().setFromVector3(offset);
  const from = sph.theta;
  tweens.add(0.6, (k) => {
    sph.theta = from + delta * k;
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
  });
}

function tweenCamera(pos, target, duration, easing = ease.inOutCubic) {
  const p0 = camera.position.clone();
  const t0 = controls.target.clone();
  return tweens.add(duration, (k) => {
    camera.position.lerpVectors(p0, pos, k);
    controls.target.lerpVectors(t0, target, k);
    camera.lookAt(controls.target);
  }, easing);
}

// ------------------------------------------------------------ flow
function hideScreens() {
  ['screen-start', 'screen-win', 'screen-lose', 'screen-pause', 'screen-settings'].forEach((id) => $(id).classList.add('hidden'));
}

// ------------------------------------------------------------ pause + settings
function pauseGame() {
  if (game.mode !== 'play' && game.mode !== 'intro') return;
  game.resumeMode = game.mode;
  game.mode = 'paused';
  controls.enabled = false;
  hoverMarker.visible = false;
  keys.clear();
  audio.pause();
  $('screen-pause').classList.remove('hidden');
}

function resumeGame() {
  if (game.mode !== 'paused') return;
  $('screen-pause').classList.add('hidden');
  $('screen-settings').classList.add('hidden');
  game.mode = game.resumeMode;
  controls.enabled = game.mode === 'play';
  audio.resume();
}

let settingsReturn = null;
function openSettings(from) {
  settingsReturn = from;
  $(from).classList.add('hidden');
  $('set-music').value = settings.music;
  $('set-sfx').value = settings.sfx;
  $('set-quality').value = settings.quality;
  $('set-vibration').checked = settings.vibration;
  $('set-vibration').disabled = !('vibrate' in navigator);
  renderQualityNote();
  $('screen-settings').classList.remove('hidden');
}

function renderQualityNote() {
  $('quality-note').textContent = settings.quality === 'auto' ? `Auto picked: ${postfx.level}` : '';
}

function closeSettings() {
  saveSettings();
  $('screen-settings').classList.add('hidden');
  $(settingsReturn ?? 'screen-start').classList.remove('hidden');
}

$('set-music').addEventListener('input', (e) => {
  settings.music = Number(e.target.value);
  audio.setVolumes(settings.music, settings.sfx);
});
$('set-sfx').addEventListener('input', (e) => {
  settings.sfx = Number(e.target.value);
  audio.setVolumes(settings.music, settings.sfx);
  audio.coin();
});
$('set-quality').addEventListener('change', (e) => {
  settings.quality = e.target.value;
  applyQuality();
  renderQualityNote();
});
$('set-vibration').addEventListener('change', (e) => {
  settings.vibration = e.target.checked;
  vibrate(60);
});

async function startLevel(index) {
  audio.init();
  audio.uiClick();
  hideScreens();
  loadLevel(index);
  const run = game.run;
  game.mode = 'intro';
  ui.hud.classList.add('hidden');
  controls.enabled = false;
  audio.startMusic(def.theme);
  audio.whoosh();
  const card = $('title-card');
  card.querySelector('.episode').textContent = def.episode;
  card.querySelector('.name').textContent = def.title;
  card.querySelector('.mission').textContent = def.mission;
  card.classList.remove('hidden');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';
  await tweenCamera(defaultCam, defaultTarget, 2.6, ease.inOutCubic);
  if (run !== game.run) return;
  audio.meow({ pitch: 1.2 });
  cat.mode = 'cheer';
  effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 10, colors: ['#ff9fb4', '#ffffff'], speed: 1, up: 2 });
  await tweens.wait(0.6);
  if (run !== game.run) return;
  setTimeout(() => card.classList.add('hidden'), 1500);
  ui.hud.classList.remove('hidden');
  renderHud();
  controls.enabled = true;
  game.mode = 'play';
}

async function victory() {
  if (game.mode !== 'play') return;
  const run = game.run;
  game.mode = 'victory';
  actor.path = [];
  actor.pending = null;
  controls.enabled = false;
  hoverMarker.visible = false;
  audio.stopMusic();
  audio.sparkle();
  if (game.held) {
    game.held.removeFromParent();
    game.held = null;
  }
  cat.armsUp = false;
  ui.hud.classList.add('hidden');
  const alive = () => run === game.run;

  // close-up camera
  const catPos = cat.root.position.clone();
  const toCam = camera.position.clone().sub(catPos).setY(0).normalize();
  actor.yaw = Math.atan2(toCam.x, toCam.z);
  cat.lookAtCamera = true;
  cat.mode = 'idle';
  postfx.setTiltStrength(0.3);
  await tweenCamera(catPos.clone().addScaledVector(toCam, 3.2).add(new THREE.Vector3(0, 1.4, 0)), catPos.clone().add(new THREE.Vector3(0, 0.55, 0)), 1.3);
  if (!alive()) return;

  // the glass floats into the kitten's paws
  const milk = world.milk;
  tweens.add(0.6, (k) => {
    milk.halo.material.opacity = 0.8 * (1 - k);
    milk.beam.material.opacity = 0.12 * (1 - k);
  });
  cat.pawsAnchor.attach(milk.glass);
  cat.armsUp = true;
  const g0 = milk.glass.position.clone();
  await tweens.add(0.7, (k) => {
    milk.glass.position.lerpVectors(g0, new THREE.Vector3(0, 0, 0), k);
    milk.glass.scale.setScalar(1 - k * 0.25);
  }, ease.outBack);
  if (!alive()) return;
  audio.meow({ pitch: 1.3, dur: 0.35 });
  await tweens.wait(0.3);
  if (!alive()) return;

  // drink! The rim stays at the mouth while the bottom tips up and away.
  cat.mode = 'drink';
  milk.straw.visible = false;
  const RIM = 0.22 * milk.glass.scale.y;
  const holdGlass = (angle) => {
    milk.glass.rotation.set(angle, 0, 0);
    milk.glass.position.set(0, 0.12 - RIM * Math.cos(angle), -0.15 - RIM * Math.sin(angle));
  };
  const y0 = milk.glass.rotation.y;
  await tweens.add(0.5, (k) => {
    holdGlass(-1.5 * k);
    milk.glass.rotation.y = y0 * (1 - k);
  });
  for (let i = 0; i < 6; i++) {
    if (!alive()) return;
    audio.gulp();
    effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 0.75, 0)), count: 2, colors: ['#ffffff'], speed: 0.6, up: 1.2, size: 0.12, additive: false, life: 0.5 });
    const s0 = 1 - i / 6;
    await tweens.add(0.36, (k) => {
      milk.milk.scale.y = Math.max(0.02, s0 - k / 6);
      holdGlass(-1.5 - ((i + k) / 6) * 0.8);
    });
  }
  await tweens.add(0.4, (k) => holdGlass(-2.3 * (1 - k)));
  if (!alive()) return;
  cat.mode = 'idle';
  cat.mustache.visible = true;
  audio.meow({ pitch: 1.05, dur: 0.8 });
  effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 12, colors: ['#ff8fb4', '#ffd1e8'], speed: 1.2, up: 2, size: 0.28, life: 1.2 });

  await tweens.wait(0.5);
  if (!alive()) return;
  const gp = new THREE.Vector3();
  milk.glass.getWorldPosition(gp);
  effects.burst({ pos: gp, count: 14, colors: ['#ffffff', '#dff4ff'], speed: 1.5, up: 1.5 });
  milk.glass.visible = false;
  cat.armsUp = false;

  // celebration jump
  audio.fanfare();
  cat.mode = 'cheer';
  const base = cat.root.position.clone();
  const yaw0 = cat.root.rotation.y;
  confetti();
  game.spinning = true;
  await tweens.add(0.8, (k) => {
    cat.root.position.y = base.y + Math.sin(k * Math.PI) * 0.9;
    cat.root.rotation.y = yaw0 + k * Math.PI * 2;
  }, ease.linear);
  if (!alive()) return;
  actor.yaw = cat.root.rotation.y;
  game.spinning = false;
  confetti();
  await tweens.wait(1.2);
  if (!alive()) return;

  const best = progress.best[def.id] ?? { gems: 0 };
  progress.best[def.id] = { gems: Math.max(best.gems, game.gems) };
  progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, def.id + 1));
  saveProgress();

  const secs = Math.floor(game.time);
  $('res-gems').textContent = `${game.gems}/${def.gems.length}`;
  $('res-coins').textContent = game.coins;
  $('res-time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const last = levelIndex === LEVELS.length - 1;
  $('btn-next').classList.toggle('hidden', last);
  $('win-text').textContent = last
    ? 'Mochi conquered every world and earned the coziest glass of milk. You did it!'
    : 'Mochi drank the whole glass of milk. Purrfect!';
  $('screen-win').classList.remove('hidden');
}

function confetti() {
  effects.burst({
    pos: cat.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
    count: 60,
    colors: ['#ff4d6d', '#ffd166', '#06d6a0', '#4aa3ff', '#b28dff'],
    speed: 3.5,
    up: 4,
    gravity: -4,
    life: 2.2,
    shape: 'confetti',
  });
}

const LOSE_TEXT = {
  fall: 'Mochi was blown off the cliff! Try again?',
  cold: 'Mochi got too cold and curled up for a nap. Try again?',
  enemy: 'Mochi got too dusty and needs a nap. Try again?',
};

function gameOver(source) {
  game.mode = 'gameover';
  audio.stopMusic();
  audio.meow({ sad: true, dur: 0.9, pitch: 0.9 });
  controls.enabled = false;
  cat.mode = 'hurt';
  $('lose-text').textContent = LOSE_TEXT[source] ?? LOSE_TEXT.enemy;
  setTimeout(() => $('screen-lose').classList.remove('hidden'), 900);
}

function showLevelSelect() {
  audio.stopMusic();
  hideScreens();
  ui.hud.classList.add('hidden');
  loadLevel(Math.min(progress.unlocked, LEVELS.length) - 1);
  game.mode = 'title';
  const list = $('level-select');
  list.innerHTML = LEVELS.map((l, i) => {
    const locked = l.id > progress.unlocked;
    const best = progress.best[l.id];
    const stats = locked ? 'Locked' : best ? `Gems ${best.gems}/${l.gems.length}` : 'New!';
    return `<button class="level-card theme-${l.theme}" data-level="${i}" ${locked ? 'disabled' : ''}>
      <div class="num">${l.episode}</div><div class="title">${l.title}</div><div class="stats">${stats}</div></button>`;
  }).join('');
  $('screen-start').classList.remove('hidden');
}

// ------------------------------------------------------------ input
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

function pick(event) {
  pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hitGround = raycaster.intersectObjects(world.pickables, false)[0];
  for (const e of enemies) {
    if (!e.alive) continue;
    const hitEnemy = raycaster.intersectObject(e.root, true)[0];
    if (hitEnemy && (!hitGround || hitEnemy.distance < hitGround.distance)) return { enemy: e };
  }
  return hitGround ? { cell: hitGround.object.userData.cell } : null;
}

renderer.domElement.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || game.mode !== 'play') return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 10) return;
  const hit = pick(e);
  if (!hit) return;
  if (hit.enemy) {
    if (game.held) throwYarn(hit.enemy.root.position.clone().sub(cat.root.position).setY(0));
    else audio.denied();
    return;
  }
  goTo(hit.cell);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (game.mode !== 'play' || e.buttons) {
    hoverMarker.visible = false;
    return;
  }
  const hit = pick(e);
  if (!hit?.cell || !isWalkable(level, state, hit.cell)) {
    hoverMarker.visible = false;
    renderer.domElement.style.cursor = hit?.enemy && game.held ? 'crosshair' : 'default';
    return;
  }
  const reachable = !!findPath(level, state, actor.target ?? actor.cell, hit.cell);
  markerMat.color.set(reachable ? '#ffffff' : '#ff6b6b');
  hoverMarker.position.copy(cellCenter(hit.cell)).add(new THREE.Vector3(0, 0.02, 0));
  hoverMarker.visible = true;
  renderer.domElement.style.cursor = reachable ? 'pointer' : 'not-allowed';
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (game.mode === 'paused') resumeGame();
    else pauseGame();
    return;
  }
  if (game.mode !== 'play') return;
  if (e.code === 'KeyR') startLevel(levelIndex);
  if (KEY_DIRS[e.code]) {
    keys.add(e.code);
    actor.path = [];
    actor.pending = null;
    e.preventDefault();
  }
  if (e.code === 'KeyQ') rotateCamera(-Math.PI / 2);
  if (e.code === 'KeyE') rotateCamera(Math.PI / 2);
  if (e.code === 'Space') {
    e.preventDefault();
    throwYarn();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

function toggleMute() {
  audio.setMuted(!audio.muted);
  ui.mute.classList.toggle('off', audio.muted);
}

$('level-select').addEventListener('click', (e) => {
  const card = e.target.closest('[data-level]');
  if (card && !card.disabled) startLevel(Number(card.dataset.level));
});
$('btn-next').addEventListener('click', () => startLevel(levelIndex + 1));
document.querySelectorAll('[data-action="replay"]').forEach((b) => b.addEventListener('click', () => startLevel(levelIndex)));
document.querySelectorAll('[data-action="levels"]').forEach((b) => b.addEventListener('click', showLevelSelect));
$('pause').addEventListener('click', pauseGame);
$('btn-throw').addEventListener('click', () => throwYarn());
document.querySelectorAll('[data-action="resume"]').forEach((b) => b.addEventListener('click', resumeGame));
document.querySelectorAll('[data-action="settings"]').forEach((b) =>
  b.addEventListener('click', () => openSettings(b.closest('.screen').id)),
);
document.querySelector('[data-action="settings-back"]').addEventListener('click', closeSettings);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'play') pauseGame();
});
if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
$('rot-left').addEventListener('click', () => rotateCamera(-Math.PI / 2));
$('rot-right').addEventListener('click', () => rotateCamera(Math.PI / 2));
ui.mute.addEventListener('click', toggleMute);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  postfx.resize();
});

// ------------------------------------------------------------ loop
const timer = new THREE.Timer();
timer.connect(document);
function frame(timestamp) {
  timer.update(timestamp);
  const realDt = timer.getDelta();
  const dt = Math.min(realDt, 0.05);
  const t = timer.getElapsed();
  if (game.mode === 'paused') {
    postfx.render();
    requestAnimationFrame(frame);
    return;
  }
  if (game.mode === 'play') {
    game.time += dt;
    if (settings.quality === 'auto') governor.sample(realDt);
  }

  tweens.update(dt);
  if (game.mode === 'play' || game.mode === 'gameover') updateActor(dt);
  else if (game.mode === 'victory') turnCat(dt);
  else if (game.mode === 'title') {
    cat.root.rotation.y = Math.sin(t * 0.5) * 0.6;
    const ang = t * 0.08;
    camera.position.set(Math.sin(ang) * defaultCam.length() * 0.78, defaultCam.y, Math.cos(ang) * defaultCam.length() * 0.78);
    camera.lookAt(defaultTarget);
  }
  animateCat(cat, dt);
  for (const e of enemies) {
    e.update(dt);
    if (game.mode === 'play' && game.invuln <= 0 && !actor.busy && e.hits(cat.root.position)) {
      damage('enemy', e.root.position.clone());
    }
  }
  updateProjectiles(dt);
  updateCold(dt);
  weather?.update(dt, camera);
  effects.update(dt);

  // idle animations of the world
  for (const item of world.items) {
    if (item.collected) continue;
    const bob = Math.sin(t * 2 + item.cell[0] + item.cell[1]);
    if (item.kind === 'gem') {
      item.gem.rotation.y += dt * 1.5;
      item.gem.position.y = 0.45 + bob * 0.07;
      item.halo.material.opacity = 0.45 + Math.sin(t * 3) * 0.15;
    } else if (item.kind === 'coin') item.holder.rotation.y += dt * 3;
    else if (item.kind === 'firefly') {
      item.holder.position.set(Math.sin(t * 1.7 + item.index) * 0.15, 0.5 + bob * 0.12, Math.cos(t * 1.3 + item.index) * 0.15);
      item.halo.material.opacity = 0.6 + Math.sin(t * 8 + item.index) * 0.35;
    } else {
      item.holder.rotation.y += dt * 1.2;
      item.holder.position.y = (item.kind === 'cocoa' ? 0.3 : 0.42) + bob * 0.05;
    }
  }
  for (const s of world.sprouts) {
    if (s.ready) s.root.rotation.z = Math.sin(t * 3 + s.cell[0]) * 0.08;
    else if ((s.regrow -= dt) <= 0) {
      s.ready = true;
      s.root.visible = true;
      s.root.scale.setScalar(0.01);
      tweens.add(0.4, (k) => s.root.scale.setScalar(Math.max(0.01, k)), ease.outBack);
    }
  }
  for (const f of world.campfires) {
    f.flames.forEach((fl, i) => fl.scale.set(1 + Math.sin(t * 13 + i) * 0.12, 1 + Math.sin(t * 17 + i * 2) * 0.2, 1));
    f.light.intensity = 4 + Math.sin(t * 20) * 0.8;
  }
  if (world.milk.glass.parent === world.milk.root) {
    world.milk.glass.position.y = 0.5 + Math.sin(t * 2) * 0.06;
    world.milk.glass.rotation.y += dt * 0.8;
  }
  world.milk.halo.scale.setScalar(1.5 + Math.sin(t * 3) * 0.15);
  world.milk.beam.rotation.y += dt * 0.3;
  for (const c of world.clouds) {
    const u = c.userData;
    u.angle += u.speed * dt;
    c.position.set(Math.cos(u.angle) * u.radius, u.y + Math.sin(t * 0.3 + u.radius) * 0.3, Math.sin(u.angle) * u.radius);
  }
  if (hoverMarker.visible) hoverMarker.scale.setScalar(1 + Math.sin(t * 6) * 0.06);

  if (controls.enabled) controls.update();

  // camera shake applied only for this render
  const saved = camera.position.clone();
  if (game.shake > 0) {
    camera.position.add(new THREE.Vector3((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake));
    game.shake = Math.max(0, game.shake - dt * 0.6);
  }
  postfx.render();
  camera.position.copy(saved);
  requestAnimationFrame(frame);
}

showLevelSelect();
frame();

// Offline support / installable app (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Debug handle for automated smoke tests in development builds only.
if (import.meta.env.DEV) {
  window.__babycat = {
    get game() { return game; },
    get actor() { return actor; },
    get state() { return state; },
    get cat() { return cat; },
    get enemies() { return enemies; },
    get weather() { return weather; },
    get camera() { return camera; },
    get postfx() { return postfx; },
    tweens, goTo, throwYarn, startLevel, progress, pauseGame, resumeGame, settings,
  };
}
