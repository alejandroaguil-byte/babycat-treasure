import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LEVEL_1 } from './game/levelData.js';
import { parseLevel, findPath, canStep, heightAt, isWalkable, sameCell, DIRS } from './game/grid.js';
import { buildWorld } from './world/build.js';
import { createCat, animateCat, createDustBunny, animateDustBunny, createYarnBall } from './world/models.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { Tweens, ease } from './tween.js';

// ------------------------------------------------------------ setup
const DEF = LEVEL_1;
const level = parseLevel(DEF);
const state = { bridgeUp: false };
const ox = (level.width - 1) / 2;
const oz = (level.depth - 1) / 2;
const toWorld = (x, z, h) => new THREE.Vector3(x - ox, h, z - oz);
const heightOf = ([x, z]) => heightAt(level, state, x, z);
const cellCenter = (cell) => toWorld(cell[0], cell[1], heightOf(cell));

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
const DEFAULT_TARGET = new THREE.Vector3(0, 1.2, 0);
const DEFAULT_CAM = new THREE.Vector3(9.5, 10.5, 12.5);
camera.position.set(22, 26, 30);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(DEFAULT_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 7;
controls.maxDistance = 26;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = 1.35;
controls.rotateSpeed = 0.7;
controls.enabled = false;

scene.add(new THREE.HemisphereLight('#d6eeff', '#8a6a4a', 1.5));
const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
sun.position.set(6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const world = buildWorld(scene, level, toWorld);
const effects = new Effects(scene);
const audio = new AudioEngine();
const tweens = new Tweens();

// ------------------------------------------------------------ actors
const cat = createCat();
cat.root.position.copy(cellCenter(DEF.start));
scene.add(cat.root);

const actor = {
  cell: [...DEF.start],
  target: null,
  path: [],
  waypoints: [],
  pending: null,
  yaw: 0,
  stepTimer: 0,
  hurtTimer: 0,
};

const enemy = {
  ...createDustBunny(),
  points: DEF.enemyPath.map((c) => cellCenter(c)),
  seg: 0,
  t: 0,
  speed: 1.5,
  alive: true,
};
enemy.root.position.copy(enemy.points[0]);
scene.add(enemy.root);

const game = {
  mode: 'title',
  hearts: 3,
  gems: 0,
  coins: 0,
  held: null,
  invuln: 0,
  shake: 0,
  time: 0,
  projectiles: [],
};

// Hover/target markers
const markerMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false });
const hoverMarker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), markerMat);
hoverMarker.rotation.x = -Math.PI / 2;
hoverMarker.visible = false;
scene.add(hoverMarker);

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
};

function renderHud() {
  ui.hearts.innerHTML = [0, 1, 2].map((i) => `<span class="${i < game.hearts ? '' : 'lost'}">&#9829;</span>`).join('');
  ui.gems.innerHTML = world.gems
    .map((g) => `<span class="${g.collected ? 'got' : ''}" style="--c:${g.color}"></span>`)
    .join('');
  ui.coins.textContent = game.coins;
  ui.held.classList.toggle('hidden', !game.held);
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
function dirVector(from, to) {
  return new THREE.Vector3(to[0] - from[0], 0, to[1] - from[1]);
}

/** Builds the waypoints to move between two adjacent cells (walking or via ladder). */
function beginStep(to) {
  const from = actor.cell;
  const hf = heightOf(from);
  const ht = heightOf(to);
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dir = dirVector(from, to);
  actor.target = to;
  if (hf === ht) {
    actor.waypoints = [{ p: b, face: dir }];
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
    ? [
        { p: foot, face: dir },
        { p: top, face: lowToHigh, climb: true },
        { p: ledge, face: dir },
        { p: b, face: dir },
      ]
    : [
        { p: ledge, face: dir },
        { p: top, face: lowToHigh },
        { p: foot, face: lowToHigh, climb: true },
        { p: b, face: dir },
      ];
}

function goTo(dest) {
  const from = actor.target ?? actor.cell;
  const path = findPath(level, state, from, dest);
  if (!path) {
    audio.denied();
    effects.ring(toWorld(dest[0], dest[1], heightOf(dest) ?? 0), '#ff6b6b');
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
  actor.cell = cell;
  actor.target = null;
  onEnterCell(cell);
  if (actor.pending && game.mode === 'play') {
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
  if (!actor.waypoints.length) {
    if (!actor.path.length && game.mode === 'play') {
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
    if (wp.face && !wp.backwards) actor.yaw = Math.atan2(wp.face.x, wp.face.z);
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
    cat.mode = actor.hurtTimer > 0 ? 'hurt' : wp.climb ? 'climb' : 'walk';
    actor.stepTimer -= dt;
    if (actor.stepTimer <= 0) {
      if (wp.climb) {
        audio.climb();
        actor.stepTimer = 0.2;
      } else if (cat.mode === 'walk') {
        audio.step();
        actor.stepTimer = 0.24;
        if (Math.random() < 0.35) effects.dust(pos.clone().add(new THREE.Vector3(0, 0.05, 0)), 2);
      }
    }
  } else if (game.mode === 'play') {
    cat.mode = actor.hurtTimer > 0 ? 'hurt' : 'idle';
  }

  turnCat(dt);

  // invulnerability blink
  if (game.invuln > 0) {
    game.invuln -= dt;
    cat.root.visible = game.invuln <= 0 || Math.floor(game.invuln * 12) % 2 === 0;
  } else cat.root.visible = true;
}

// ------------------------------------------------------------ cell events
function onEnterCell(cell) {
  for (const coin of world.coins) {
    if (!coin.collected && sameCell(coin.cell, cell)) collectCoin(coin);
  }
  for (const gem of world.gems) {
    if (!gem.collected && sameCell(gem.cell, cell)) collectGem(gem);
  }
  for (const sprout of world.sprouts) {
    if (sprout.ready && !game.held && sameCell(sprout.cell, cell)) pluck(sprout);
  }
  if (!state.bridgeUp && sameCell(DEF.button, cell)) pressButton();
  if (sameCell(DEF.milk, cell)) victory();
}

function collectCoin(coin) {
  coin.collected = true;
  game.coins++;
  audio.coin();
  const p = coin.root.position.clone().add(new THREE.Vector3(0, 0.35, 0));
  effects.burst({ pos: p, count: 8, colors: ['#ffe066', '#fff6c4'], speed: 1.2, up: 2, life: 0.5, size: 0.18 });
  const start = coin.holder.position.y;
  tweens.add(0.4, (k) => {
    coin.holder.position.y = start + k * 0.8;
    coin.holder.scale.setScalar(1 - k);
    coin.holder.rotation.y += 0.5;
  }, ease.outCubic).then(() => (coin.root.visible = false));
  renderHud();
  bump(ui.coins);
}

function collectGem(gem) {
  gem.collected = true;
  game.gems++;
  audio.gem();
  const p = gem.root.position.clone().add(new THREE.Vector3(0, 0.5, 0));
  effects.burst({ pos: p, count: 26, colors: [gem.color, '#ffffff'], speed: 2.5, up: 3, life: 0.9, size: 0.25 });
  effects.ring(gem.root.position, gem.color);
  game.shake = 0.08;
  tweens.add(0.8, (k) => {
    gem.gem.position.y = 0.45 + k * 1.3;
    gem.gem.rotation.y += 0.4;
    gem.root.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.6 - k * 0.9);
  }, ease.outCubic).then(() => (gem.root.visible = false));
  toast(`Gem found! (${game.gems}/${world.gems.length})`);
  renderHud();
  bump(ui.gems.firstChild ?? ui.gems);
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

function pressButton() {
  state.bridgeUp = true;
  audio.button();
  const btn = world.button;
  tweens.add(0.15, (k) => (btn.cap.position.y = 0.13 - k * 0.07));
  btn.capMat.color.set('#5fd36a');
  btn.capMat.emissive.set('#5fd36a');
  effects.ring(btn.root.position, '#5fd36a');
  toast('Click! Something moved...');
  for (const b of world.bridges) raiseBridge(b);
}

async function raiseBridge(b) {
  await tweens.wait(0.35);
  audio.bridge();
  b.mesh.visible = true;
  const start = b.mesh.position.clone();
  game.shake = 0.15;
  await tweens.add(1.1, (k) => {
    b.mesh.position.lerpVectors(start, b.finalPos, k);
    b.mesh.rotation.y = (1 - k) * Math.PI;
  }, ease.outBack);
  game.shake = 0.12;
  effects.dust(b.finalPos.clone(), 14);
  effects.burst({ pos: b.finalPos.clone().add(new THREE.Vector3(0, 0.3, 0)), count: 16, colors: ['#ffe066', '#ffffff'], speed: 2, up: 2.5 });
  b.mesh.traverse((o) => o.isMesh && world.pickables.push(o));
  toast('A bridge appeared!');
}

// ------------------------------------------------------------ enemy + combat
function updateEnemy(dt) {
  if (!enemy.alive) return;
  animateDustBunny(enemy, dt);
  const a = enemy.points[enemy.seg];
  const b = enemy.points[(enemy.seg + 1) % enemy.points.length];
  const len = a.distanceTo(b);
  enemy.t += (enemy.speed * dt) / len;
  if (enemy.t >= 1) {
    enemy.t = 0;
    enemy.seg = (enemy.seg + 1) % enemy.points.length;
  }
  enemy.root.position.lerpVectors(a, b, enemy.t);
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  let diff = yaw - enemy.root.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  enemy.root.rotation.y += diff * (1 - Math.exp(-8 * dt));

  if (game.mode !== 'play' || game.invuln > 0) return;
  const cp = cat.root.position;
  const ep = enemy.root.position;
  if (Math.abs(cp.y - ep.y) < 0.5 && Math.hypot(cp.x - ep.x, cp.z - ep.z) < 0.55) hurtCat();
}

function hurtCat() {
  game.hearts--;
  game.invuln = 2;
  game.shake = 0.25;
  actor.hurtTimer = 0.6;
  audio.hurt();
  ui.flash.classList.add('on');
  setTimeout(() => ui.flash.classList.remove('on'), 60);
  effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 0.6, 0)), count: 10, colors: ['#ffe066', '#ff6b6b'], speed: 2, up: 2, size: 0.2 });
  renderHud();

  // knock the kitten back to the safest nearby cell
  const options = [actor.cell, actor.target, ...DIRS.map((d) => [actor.cell[0] + d[0], actor.cell[1] + d[1]])]
    .filter((c) => c && isWalkable(level, state, c) && heightOf(c) === heightOf(actor.cell));
  const ep = enemy.root.position;
  let best = actor.cell;
  let bestDist = -1;
  for (const c of options) {
    const d = cellCenter(c).distanceTo(ep);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  actor.path = [];
  actor.pending = null;
  actor.cell = best;
  actor.target = best;
  const away = cellCenter(best).sub(ep);
  actor.waypoints = [{ p: cellCenter(best), speed: 5, face: away.negate(), backwards: false }];
  if (game.hearts <= 0) gameOver();
}

function throwYarn(dirOverride) {
  if (!game.held || game.mode !== 'play') return;
  const yarn = game.held;
  game.held = null;
  cat.armsUp = false;
  renderHud();
  const start = new THREE.Vector3();
  yarn.getWorldPosition(start);
  scene.attach(yarn);
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
    const ep = enemy.root.position;
    const mp = p.mesh.position;
    if (enemy.alive && Math.hypot(mp.x - ep.x, mp.z - ep.z) < 0.55 && Math.abs(mp.y - ep.y - 0.4) < 1) {
      defeatEnemy();
      done = true;
    }
    if (done) {
      effects.burst({ pos: p.mesh.position.clone(), count: 10, colors: ['#ff6fa3', '#ffffff'], speed: 1.5, up: 1.5 });
      scene.remove(p.mesh);
      game.projectiles.splice(i, 1);
    }
  }
}

async function defeatEnemy() {
  enemy.alive = false;
  audio.hit();
  audio.enemyDefeat();
  game.shake = 0.2;
  const p0 = enemy.root.position.clone();
  effects.burst({ pos: p0.clone().add(new THREE.Vector3(0, 0.4, 0)), count: 20, colors: ['#b8a8d8', '#ffffff', '#8f7fae'], speed: 3, up: 3, additive: false, size: 0.3 });
  await tweens.add(0.9, (k) => {
    enemy.root.position.set(p0.x, p0.y + Math.sin(k * Math.PI) * 1.8 - k * 3, p0.z);
    enemy.root.rotation.z = k * 8;
    enemy.root.scale.setScalar(1 - k * 0.8);
  }, ease.linear);
  enemy.root.visible = false;
  effects.burst({ pos: p0.clone().add(new THREE.Vector3(0, 0.5, 0)), count: 14, colors: ['#ffe066'], speed: 2, up: 3 });
  game.coins += 3;
  audio.coin();
  toast('Dust bunny defeated! +3 coins');
  renderHud();
  bump(ui.coins);
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
async function startGame() {
  audio.init();
  audio.uiClick();
  $('screen-start').classList.add('hidden');
  game.mode = 'intro';
  audio.startMusic();
  audio.whoosh();
  const card = $('title-card');
  card.querySelector('.episode').textContent = DEF.episode;
  card.querySelector('.name').textContent = DEF.title;
  card.classList.remove('hidden');
  await tweenCamera(DEFAULT_CAM, DEFAULT_TARGET, 2.6, ease.inOutCubic);
  audio.meow({ pitch: 1.2 });
  cat.mode = 'cheer';
  effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 10, colors: ['#ff9fb4', '#ffffff'], speed: 1, up: 2 });
  await tweens.wait(0.6);
  setTimeout(() => card.classList.add('hidden'), 1500);
  ui.hud.classList.remove('hidden');
  renderHud();
  controls.enabled = true;
  game.mode = 'play';
}

async function victory() {
  if (game.mode !== 'play') return;
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

  // close-up camera
  const catPos = cat.root.position.clone();
  const toCam = camera.position.clone().sub(catPos).setY(0).normalize();
  actor.yaw = Math.atan2(toCam.x, toCam.z);
  cat.lookAtCamera = true;
  cat.mode = 'idle';
  await tweenCamera(catPos.clone().addScaledVector(toCam, 3.2).add(new THREE.Vector3(0, 1.4, 0)), catPos.clone().add(new THREE.Vector3(0, 0.55, 0)), 1.3);

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
  audio.meow({ pitch: 1.3, dur: 0.35 });
  await tweens.wait(0.3);

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
    audio.gulp();
    effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 0.75, 0)), count: 2, colors: ['#ffffff'], speed: 0.6, up: 1.2, size: 0.12, additive: false, life: 0.5 });
    const s0 = 1 - i / 6;
    await tweens.add(0.36, (k) => {
      milk.milk.scale.y = Math.max(0.02, s0 - k / 6);
      holdGlass(-1.5 - ((i + k) / 6) * 0.8);
    });
  }
  await tweens.add(0.4, (k) => holdGlass(-2.3 * (1 - k)));
  cat.mode = 'idle';
  cat.mustache.visible = true;
  audio.meow({ pitch: 1.05, dur: 0.8 });
  effects.burst({ pos: cat.root.position.clone().add(new THREE.Vector3(0, 1.0, 0)), count: 12, colors: ['#ff8fb4', '#ffd1e8'], speed: 1.2, up: 2, size: 0.28, life: 1.2 });

  // empty glass vanishes
  await tweens.wait(0.5);
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
  actor.yaw = cat.root.rotation.y;
  game.spinning = false;
  confetti();
  await tweens.wait(1.2);

  const secs = Math.floor(game.time);
  $('res-gems').textContent = `${game.gems}/${world.gems.length}`;
  $('res-coins').textContent = game.coins;
  $('res-time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
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

function gameOver() {
  game.mode = 'gameover';
  audio.stopMusic();
  audio.meow({ sad: true, dur: 0.9, pitch: 0.9 });
  controls.enabled = false;
  cat.mode = 'hurt';
  setTimeout(() => $('screen-lose').classList.remove('hidden'), 900);
}

// ------------------------------------------------------------ input
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

function pick(event) {
  pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (enemy.alive) {
    const hitEnemy = raycaster.intersectObject(enemy.root, true)[0];
    const hitGround = raycaster.intersectObjects(world.pickables, false)[0];
    if (hitEnemy && (!hitGround || hitEnemy.distance < hitGround.distance)) return { enemy: true };
  }
  const hit = raycaster.intersectObjects(world.pickables, false)[0];
  return hit ? { cell: hit.object.userData.cell } : null;
}

renderer.domElement.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || game.mode !== 'play') return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return;
  const hit = pick(e);
  if (!hit) return;
  if (hit.enemy) {
    if (game.held) throwYarn(enemy.root.position.clone().sub(cat.root.position).setY(0));
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
  if (game.mode !== 'play') return;
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

$('btn-play').addEventListener('click', startGame);
$('rot-left').addEventListener('click', () => rotateCamera(-Math.PI / 2));
$('rot-right').addEventListener('click', () => rotateCamera(Math.PI / 2));
ui.mute.addEventListener('click', toggleMute);
document.querySelectorAll('[data-action="restart"]').forEach((b) => b.addEventListener('click', () => location.reload()));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------ loop
const timer = new THREE.Timer();
timer.connect(document);
function frame(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  if (game.mode === 'play') game.time += dt;

  tweens.update(dt);
  if (game.mode === 'play' || game.mode === 'gameover') updateActor(dt);
  else if (game.mode === 'victory') turnCat(dt);
  else if (game.mode === 'title') cat.root.rotation.y = Math.sin(t * 0.5) * 0.6;
  animateCat(cat, dt);
  updateEnemy(dt);
  updateProjectiles(dt);
  effects.update(dt);

  // idle animations of the world
  for (const g of world.gems) {
    if (g.collected) continue;
    g.gem.rotation.y += dt * 1.5;
    g.gem.position.y = 0.45 + Math.sin(t * 2 + g.cell[0]) * 0.07;
    g.halo.material.opacity = 0.45 + Math.sin(t * 3) * 0.15;
  }
  for (const c of world.coins) if (!c.collected) c.holder.rotation.y += dt * 3;
  for (const s of world.sprouts) {
    if (s.ready) s.root.rotation.z = Math.sin(t * 3 + s.cell[0]) * 0.08;
    else if ((s.regrow -= dt) <= 0) {
      s.ready = true;
      s.root.visible = true;
      s.root.scale.setScalar(0.01);
      tweens.add(0.4, (k) => s.root.scale.setScalar(Math.max(0.01, k)), ease.outBack);
    }
  }
  if (game.mode !== 'victory' || world.milk.glass.parent === world.milk.root) {
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
  renderer.render(scene, camera);
  camera.position.copy(saved);
  requestAnimationFrame(frame);
}

camera.lookAt(DEFAULT_TARGET);
renderHud();
frame();

// Debug handle for automated smoke tests in development builds only.
if (import.meta.env.DEV) window.__babycat = { game, actor, state, goTo, throwYarn, enemy, cat, tweens, camera };
