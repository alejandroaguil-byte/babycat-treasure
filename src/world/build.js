import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cellKey } from '../game/grid.js';
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

function dirtTexture(rand) {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#a06c45';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#8c5b38';
    for (let y = 0; y < s; y += 32) g.fillRect(0, y + 22, s, 6);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rand() > 0.5 ? '#b98260' : '#7d5031';
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
      g.fillStyle = rand() > 0.5 ? '#e6f5dc' : '#f5fff0';
      g.fillRect(rand() * s, rand() * s, 2, 4);
    }
  });
}

/**
 * Builds every mesh of the level and returns handles to the interactive parts.
 * `toWorld(x, z, h)` converts grid coordinates to a world-space Vector3.
 */
export function buildWorld(scene, level, toWorld) {
  const def = level.def;
  const rand = seeded(42);
  const group = new THREE.Group();
  scene.add(group);
  const pickables = [];

  // ---- diorama base tray
  const tray = new THREE.Mesh(
    new RoundedBoxGeometry(level.width + 0.6, 0.5, level.depth + 0.6, 3, 0.2),
    new THREE.MeshStandardMaterial({ color: '#6b4430', roughness: 1 }),
  );
  tray.position.set(0, BASE_Y - 0.25, 0);
  tray.receiveShadow = true;
  group.add(tray);
  const rim = new THREE.Mesh(
    new RoundedBoxGeometry(level.width + 0.8, 0.12, level.depth + 0.8, 3, 0.05),
    new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.5, metalness: 0.2 }),
  );
  rim.position.set(0, BASE_Y - 0.5, 0);
  group.add(rim);

  // ---- terrain columns
  const dirtTex = dirtTexture(rand);
  const grassTex = grassTexture(rand);
  const capGeo = new RoundedBoxGeometry(1, CAP, 1, 2, 0.06);
  const capMats = [
    new THREE.MeshStandardMaterial({ color: '#86d65f', map: grassTex, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: '#74c552', map: grassTex, roughness: 0.9 }),
  ];
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

  for (let z = 0; z < level.depth; z++) {
    for (let x = 0; x < level.width; x++) {
      const h = level.heights[z][x];
      if (h === null) continue;
      const p = toWorld(x, z, 0);
      const dh = h - CAP - BASE_Y;
      const { geo, mat } = dirtFor(dh);
      const dirt = new THREE.Mesh(geo, mat);
      dirt.position.set(p.x, BASE_Y + dh / 2, p.z);
      const cap = new THREE.Mesh(capGeo, capMats[(x + z) % 2]);
      cap.position.set(p.x, h - CAP / 2, p.z);
      for (const m of [dirt, cap]) {
        m.castShadow = m.receiveShadow = true;
        m.userData.cell = [x, z];
        group.add(m);
        pickables.push(m);
      }
    }
  }

  const placeOn = (obj, [x, z], h) => {
    obj.position.copy(toWorld(x, z, h ?? level.heights[z][x]));
    group.add(obj);
    return obj;
  };

  // ---- decor
  for (const d of def.decor) {
    const obj = placeOn(M.createDecor(d.type, rand), d.at);
    obj.rotation.y = Math.floor(rand() * 4) * (Math.PI / 2);
  }
  const occupied = new Set([
    ...def.decor.map((d) => cellKey(...d.at)),
    ...def.gems.map((c) => cellKey(...c)),
    ...def.coins.map((c) => cellKey(...c)),
    ...def.sprouts.map((c) => cellKey(...c)),
    cellKey(...def.button), cellKey(...def.milk), cellKey(...def.start),
  ]);
  for (let z = 0; z < level.depth; z++) {
    for (let x = 0; x < level.width; x++) {
      if (level.heights[z][x] === null || occupied.has(cellKey(x, z)) || rand() > 0.35) continue;
      const f = placeOn(M.createDecor('flowers', rand), [x, z]);
      f.position.x += (rand() > 0.5 ? 1 : -1) * 0.33;
      f.position.z += (rand() > 0.5 ? 1 : -1) * 0.33;
    }
  }

  // ---- ladders (mounted on the face of the higher column)
  for (const { a, b } of def.ladders) {
    const ha = level.heights[a[1]][a[0]];
    const hb = level.heights[b[1]][b[0]];
    const [low, high] = ha < hb ? [a, b] : [b, a];
    const hLow = Math.min(ha, hb);
    const hHigh = Math.max(ha, hb);
    const ladder = M.createLadder(hHigh - hLow);
    const pl = toWorld(...low, hLow);
    const ph = toWorld(...high, hLow);
    ladder.position.copy(pl.clone().lerp(ph, 0.5));
    const dir = pl.clone().sub(ph).normalize();
    ladder.position.addScaledVector(dir, 0.04);
    ladder.rotation.y = Math.atan2(dir.x, dir.z);
    group.add(ladder);
  }

  // ---- bridge (hidden until the button is pressed)
  const bridges = def.bridges.map((b) => {
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
    return { cell: [b.x, b.z], mesh, finalPos };
  });

  // ---- interactive objects
  const button = M.createButton();
  placeOn(button.root, def.button);

  const gems = def.gems.map((cell, i) => {
    const g = M.createGem(GEM_COLORS[i % GEM_COLORS.length]);
    placeOn(g.root, cell);
    return { cell, ...g, color: GEM_COLORS[i % GEM_COLORS.length], collected: false };
  });
  const coins = def.coins.map((cell, i) => {
    const c = M.createCoin();
    placeOn(c.root, cell);
    c.holder.rotation.y = i * 0.6;
    return { cell, ...c, collected: false };
  });
  const sprouts = def.sprouts.map((cell) => {
    const s = M.createSprout();
    placeOn(s.root, cell);
    return { cell, ...s, ready: true, regrow: 0 };
  });

  const milk = M.createMilk();
  placeOn(milk.root, def.milk);

  // ---- clouds around the diorama
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = M.createCloud(rand);
    const angle = (i / 7) * Math.PI * 2;
    const radius = 10 + rand() * 4;
    c.userData = { angle, radius, speed: 0.02 + rand() * 0.03, y: -2 + rand() * 7 };
    scene.add(c);
    clouds.push(c);
  }

  return { group, pickables, bridges, button, gems, coins, sprouts, milk, clouds };
}

