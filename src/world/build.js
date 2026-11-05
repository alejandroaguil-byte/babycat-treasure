import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cellKey, surfaceAt } from '../game/grid.js';
import * as M from './models.js';

const BASE_Y = -0.9;
const CAP = 0.24;
const GEM_COLORS = ['#3de0ff', '#ff5fd2', '#7dff6a'];

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function dirtTexture(rand, d) {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = d.base;
    g.fillRect(0, 0, s, s);
    g.fillStyle = d.strata;
    for (let y = 0; y < s; y += 32) g.fillRect(0, y + 22, s, 6);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rand() > 0.5 ? d.light : d.dark;
      g.beginPath();
      g.arc(rand() * s, rand() * s, 2 + rand() * 4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function grassTexture(rand) {
  return canvasTexture(64, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = rand() > 0.5 ? '#e6efe0' : '#f5fff0';
      g.fillRect(rand() * s, rand() * s, 2, 4);
    }
  });
}

/**
 * Builds every mesh of a level under one group and returns handles to its
 * interactive parts. `toWorld(x, z, h)` converts grid coordinates to world space.
 */
export function buildWorld(level, theme, toWorld) {
  const def = level.def;
  const rand = seeded(42 + def.id * 7);
  const group = new THREE.Group();
  const pickables = [];

  // ---- diorama base tray
  const tray = new THREE.Mesh(
    new RoundedBoxGeometry(level.width + 0.6, 0.5, level.depth + 0.6, 3, 0.2),
    new THREE.MeshStandardMaterial({ color: theme.tray, roughness: 1 }),
  );
  tray.position.set(0, BASE_Y - 0.25, 0);
  tray.receiveShadow = true;
  group.add(tray);
  const rim = new THREE.Mesh(
    new RoundedBoxGeometry(level.width + 0.8, 0.12, level.depth + 0.8, 3, 0.05),
    new THREE.MeshStandardMaterial({ color: theme.rim, roughness: 0.5, metalness: 0.2 }),
  );
  rim.position.set(0, BASE_Y - 0.5, 0);
  group.add(rim);

  // ---- terrain columns
  const dirtTex = dirtTexture(rand, theme.dirt);
  const grassTex = grassTexture(rand);
  const capGeo = new RoundedBoxGeometry(1, CAP, 1, 2, 0.06);
  const capMats = theme.grass.map((color) => new THREE.MeshStandardMaterial({ color, map: grassTex, roughness: 0.9 }));
  const wetMat = new THREE.MeshStandardMaterial({ color: theme.wet, roughness: 0.15, metalness: 0.2 });
  const iceMat = new THREE.MeshStandardMaterial({ color: theme.ice, roughness: 0.05, metalness: 0.15, emissive: '#3a7fb0', emissiveIntensity: 0.15 });
  const dirtCache = new Map();
  const dirtFor = (dh) => {
    if (!dirtCache.has(dh)) {
      const tex = dirtTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, dh);
      dirtCache.set(dh, {
        geo: new THREE.BoxGeometry(0.995, dh, 0.995),
        mat: new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }),
      });
    }
    return dirtCache.get(dh);
  };
  const puddles = [];

  for (let z = 0; z < level.depth; z++) {
    for (let x = 0; x < level.width; x++) {
      const h = level.heights[z][x];
      if (h === null) continue;
      const p = toWorld(x, z, 0);
      const dh = h - CAP - BASE_Y;
      const { geo, mat } = dirtFor(dh);
      const dirt = new THREE.Mesh(geo, mat);
      dirt.position.set(p.x, BASE_Y + dh / 2, p.z);
      const kind = surfaceAt(level, [x, z]);
      const cap = new THREE.Mesh(capGeo, kind === 'ice' ? iceMat : kind === 'wet' ? wetMat : capMats[(x + z) % 2]);
      cap.position.set(p.x, h - CAP / 2, p.z);
      for (const m of [dirt, cap]) {
        m.castShadow = m.receiveShadow = true;
        m.userData.cell = [x, z];
        group.add(m);
        pickables.push(m);
      }
      if (kind) {
        const shine = new THREE.Mesh(
          new THREE.CircleGeometry(0.22 + rand() * 0.12, 16),
          new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: kind === 'ice' ? 0.35 : 0.18, depthWrite: false }),
        );
        shine.rotation.x = -Math.PI / 2;
        shine.position.set(p.x + (rand() - 0.5) * 0.3, h + 0.005, p.z + (rand() - 0.5) * 0.3);
        shine.scale.x = 1.6;
        group.add(shine);
        puddles.push(shine);
      }
    }
  }

  const placeOn = (obj, [x, z], h) => {
    obj.position.copy(toWorld(x, z, h ?? level.heights[z][x]));
    group.add(obj);
    return obj;
  };

  // ---- decor
  for (const d of def.decor ?? []) {
    const obj = placeOn(M.createDecor(d.type, rand, theme), d.at);
    obj.rotation.y = Math.floor(rand() * 4) * (Math.PI / 2);
  }
  const listed = ['gems', 'coins', 'sprouts', 'keys', 'gates', 'fish', 'fireflies', 'cocoa', 'campfires'];
  const occupied = new Set([
    ...(def.decor ?? []).map((d) => cellKey(...d.at)),
    ...listed.flatMap((k) => (def[k] ?? []).map((c) => cellKey(...c))),
    ...(def.snowmen ?? []).map((s) => cellKey(...s.at)),
    ...[def.switch, def.milk, def.start].filter(Boolean).map((c) => cellKey(...c)),
  ]);
  for (let z = 0; z < level.depth; z++) {
    for (let x = 0; x < level.width; x++) {
      if (level.heights[z][x] === null || surfaceAt(level, [x, z]) || occupied.has(cellKey(x, z)) || rand() > 0.35) continue;
      const f = placeOn(M.createDecor('flowers', rand, theme), [x, z]);
      f.position.x += (rand() > 0.5 ? 1 : -1) * 0.33;
      f.position.z += (rand() > 0.5 ? 1 : -1) * 0.33;
    }
  }

  // ---- ladders (mounted on the face of the higher column)
  const colHeight = ([x, z]) => level.heights[z][x] ?? level.bridges.get(cellKey(x, z))?.h;
  for (const { a, b } of def.ladders ?? []) {
    const ha = colHeight(a);
    const hb = colHeight(b);
    const [low, high] = ha < hb ? [a, b] : [b, a];
    const hLow = Math.min(ha, hb);
    const ladder = M.createLadder(Math.max(ha, hb) - hLow);
    const pl = toWorld(...low, hLow);
    const ph = toWorld(...high, hLow);
    ladder.position.copy(pl.clone().lerp(ph, 0.5));
    const dir = pl.clone().sub(ph).normalize();
    ladder.position.addScaledVector(dir, 0.04);
    ladder.rotation.y = Math.atan2(dir.x, dir.z);
    group.add(ladder);
  }

  // ---- bridges (hidden until their trigger fires)
  const bridges = (def.bridges ?? []).map((b) => {
    const mesh = M.createBridgeBlock();
    const finalPos = toWorld(b.x, b.z, b.h);
    mesh.position.copy(finalPos).add(new THREE.Vector3(0, -6, 0));
    mesh.visible = false;
    mesh.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.cell = [b.x, b.z];
      }
    });
    group.add(mesh);
    return { cell: [b.x, b.z], trigger: b.trigger ?? 'switch', mesh, finalPos };
  });

  let button = null;
  if (def.switch) {
    button = M.createButton();
    placeOn(button.root, def.switch);
  }

  const gates = (def.gates ?? []).map((cell) => {
    const g = M.createGate();
    placeOn(g.root, cell);
    // Bars face the passage: along z when there is ground north and south, else along x.
    const has = (x, z) => level.heights[z]?.[x] !== null && level.heights[z]?.[x] !== undefined;
    if (!(has(cell[0], cell[1] - 1) && has(cell[0], cell[1] + 1))) g.root.rotation.y = Math.PI / 2;
    return { cell, ...g };
  });

  // ---- collectibles
  const items = [];
  const addItems = (kind, cells, factory) =>
    (cells ?? []).forEach((cell, i) => {
      const obj = factory(i);
      placeOn(obj.root, cell);
      items.push({ kind, cell, ...obj, collected: false, index: i });
    });
  addItems('gem', def.gems, (i) => ({ ...M.createGem(GEM_COLORS[i % 3]), color: GEM_COLORS[i % 3] }));
  addItems('coin', def.coins, (i) => {
    const c = M.createCoin();
    c.holder.rotation.y = i * 0.6;
    return c;
  });
  addItems('key', def.keys, () => M.createKey());
  addItems('fish', def.fish, () => M.createFish());
  addItems('firefly', def.fireflies, () => M.createFirefly());
  addItems('cocoa', def.cocoa, () => M.createCocoa());

  const sprouts = (def.sprouts ?? []).map((cell) => {
    const s = M.createSprout();
    placeOn(s.root, cell);
    return { cell, ...s, ready: true, regrow: 0 };
  });

  const campfires = (def.campfires ?? []).map((cell) => {
    const c = M.createCampfire();
    placeOn(c.root, cell);
    return { cell, ...c };
  });

  const milk = M.createMilk();
  placeOn(milk.root, def.milk);

  // ---- clouds around the diorama
  const clouds = [];
  const radiusBase = Math.max(level.width, level.depth) * 0.8 + 3;
  for (let i = 0; i < 7; i++) {
    const c = M.createCloud(rand, theme.clouds);
    c.userData = { angle: (i / 7) * Math.PI * 2, radius: radiusBase + rand() * 4, speed: 0.02 + rand() * 0.03, y: -2 + rand() * 7 };
    group.add(c);
    clouds.push(c);
  }

  return { group, pickables, bridges, button, gates, items, sprouts, campfires, milk, clouds, puddles };
}
