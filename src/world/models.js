import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glowTexture } from '../effects.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
const mesh = (geo, material, shadow = true) => {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  return m;
};
const damp = (cur, target, lambda, dt) => THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-lambda * dt));

// ---------------------------------------------------------------- kitten
export function createCat() {
  const orange = mat('#f6a04d');
  const cream = mat('#fff3df');
  const pink = mat('#ff9fb4');
  const dark = mat('#2b2230', { roughness: 0.25 });
  const stripe = mat('#d9772b');
  const white = mat('#ffffff', { roughness: 0.2 });
  const scarfMat = mat('#4aa3ff');

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.3;
  root.add(body);

  const torso = mesh(new THREE.SphereGeometry(0.22, 24, 16), orange);
  torso.scale.set(1, 0.88, 1.2);
  body.add(torso);
  const belly = mesh(new THREE.SphereGeometry(0.18, 20, 14), cream);
  belly.position.set(0, -0.05, 0.07);
  belly.scale.set(0.85, 0.75, 1.05);
  body.add(belly);
  for (let i = 0; i < 3; i++) {
    const s = mesh(new THREE.TorusGeometry(0.2, 0.016, 6, 20, Math.PI * 0.6), stripe, false);
    s.rotation.z = Math.PI * 0.2;
    s.position.z = -0.06 - i * 0.08;
    s.scale.set(1.02 - i * 0.08, 0.92 - i * 0.08, 1);
    body.add(s);
  }

  // scarf
  const scarf = mesh(new THREE.TorusGeometry(0.15, 0.045, 10, 24), scarfMat);
  scarf.position.set(0, 0.13, 0.11);
  scarf.rotation.x = Math.PI / 2 + 0.35;
  body.add(scarf);
  const knot = mesh(new THREE.SphereGeometry(0.05, 12, 10), scarfMat);
  knot.position.set(0.05, 0.1, 0.25);
  body.add(knot);
  const scarfTail = mesh(new THREE.BoxGeometry(0.06, 0.13, 0.02), scarfMat);
  scarfTail.position.set(0.08, 0.03, 0.26);
  scarfTail.rotation.z = 0.35;
  body.add(scarfTail);

  // head
  const head = new THREE.Group();
  head.position.set(0, 0.25, 0.16);
  body.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.25, 28, 20), orange);
  skull.scale.set(1.08, 0.95, 0.95);
  head.add(skull);
  const muzzle = mesh(new THREE.SphereGeometry(0.1, 16, 12), cream);
  muzzle.position.set(0, -0.07, 0.19);
  muzzle.scale.set(1.35, 0.8, 0.8);
  head.add(muzzle);
  const nose = mesh(new THREE.SphereGeometry(0.032, 12, 10), pink, false);
  nose.position.set(0, -0.025, 0.268);
  nose.scale.set(1.3, 0.9, 0.8);
  head.add(nose);
  const mustache = mesh(new THREE.SphereGeometry(0.07, 16, 10), white, false);
  mustache.position.set(0, -0.085, 0.27);
  mustache.scale.set(1.9, 0.55, 0.6);
  mustache.visible = false;
  head.add(mustache);

  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.095, 0.035, 0.205);
    const ball = mesh(new THREE.SphereGeometry(0.05, 16, 12), dark, false);
    ball.scale.set(1, 1.25, 0.6);
    eye.add(ball);
    const shine = mesh(new THREE.SphereGeometry(0.016, 8, 6), white, false);
    shine.position.set(0.015, 0.025, 0.028);
    eye.add(shine);
    head.add(eye);
    eyes.push(eye);

    const cheek = mesh(
      new THREE.SphereGeometry(0.045, 12, 8),
      mat('#ff8fa8', { transparent: true, opacity: 0.55 }),
      false,
    );
    cheek.position.set(s * 0.165, -0.06, 0.165);
    cheek.scale.set(1.2, 0.7, 0.4);
    head.add(cheek);

    for (let i = 0; i < 3; i++) {
      const w = mesh(new THREE.BoxGeometry(0.16, 0.006, 0.006), mat('#fffaf0'), false);
      w.position.set(s * 0.17, -0.07 + (i - 1) * 0.02, 0.2);
      w.rotation.z = s * (i - 1) * 0.18;
      head.add(w);
    }
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.14, 0.16, -0.01);
    ear.rotation.z = -s * 0.32;
    const outer = mesh(new THREE.ConeGeometry(0.095, 0.19, 16), orange);
    outer.position.y = 0.08;
    ear.add(outer);
    const inner = mesh(new THREE.ConeGeometry(0.058, 0.12, 16), pink, false);
    inner.position.set(0, 0.06, 0.035);
    ear.add(inner);
    head.add(ear);
    ears.push(ear);
  }
  for (let i = -1; i <= 1; i++) {
    const st = mesh(new THREE.BoxGeometry(0.026, 0.08, 0.02), stripe, false);
    st.position.set(i * 0.05, 0.17, 0.17);
    st.rotation.x = -0.6;
    head.add(st);
  }

  // legs: pivots at the hips, ordered FL, FR, BL, BR
  const legs = [];
  for (const [x, z] of [[-0.11, 0.12], [0.11, 0.12], [-0.11, -0.13], [0.11, -0.13]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, -0.12, z);
    const leg = mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.15, 12), orange);
    leg.position.y = -0.06;
    pivot.add(leg);
    const paw = mesh(new THREE.SphereGeometry(0.06, 12, 8), cream);
    paw.position.y = -0.14;
    paw.scale.set(1, 0.7, 1.2);
    pivot.add(paw);
    body.add(pivot);
    legs.push(pivot);
  }

  // tail: nested segments that curl upwards
  const tail = [];
  let parent = body;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, 0, i === 0 ? -0.24 : -0.065);
    const r = 0.05 - i * 0.003;
    seg.add(mesh(new THREE.SphereGeometry(r, 10, 8), i >= 5 ? stripe : orange));
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }

  const holdAnchor = new THREE.Group(); // item held above the head
  holdAnchor.position.set(0, 0.62, 0.05);
  body.add(holdAnchor);
  const pawsAnchor = new THREE.Group(); // item held in front of the face
  pawsAnchor.position.set(0, 0.1, 0.55);
  body.add(pawsAnchor);

  return {
    root, body, head, legs, tail, eyes, ears, mustache, holdAnchor, pawsAnchor,
    mode: 'idle', armsUp: false, time: 0, phase: 0, blink: 2, earTwitch: 3, materials: [orange, cream, stripe],
  };
}

export function animateCat(c, dt) {
  c.time += dt;
  const t = c.time;
  const m = c.mode;
  const walking = m === 'walk';
  const climbing = m === 'climb';
  c.phase += dt * (walking ? 13 : climbing ? 9 : 0);
  const ph = c.phase;

  // body
  let bodyY = 0.3 + Math.sin(t * 2.2) * 0.006;
  let bodyRX = 0;
  let bodyRZ = 0;
  if (walking) {
    bodyY = 0.3 + Math.abs(Math.sin(ph)) * 0.04;
    bodyRZ = Math.sin(ph) * 0.05;
  } else if (climbing) {
    bodyRX = -0.25;
    bodyY = 0.32 + Math.sin(ph * 2) * 0.015;
  } else if (m === 'hurt') {
    bodyRZ = Math.sin(t * 30) * 0.2;
  } else if (m === 'drink') {
    bodyRX = -0.12;
  }
  c.body.position.y = damp(c.body.position.y, bodyY, 20, dt);
  c.body.rotation.x = damp(c.body.rotation.x, bodyRX, 10, dt);
  c.body.rotation.z = damp(c.body.rotation.z, bodyRZ, 12, dt);

  // legs
  const targets = [0, 0, 0, 0];
  if (walking) {
    const s = Math.sin(ph) * 0.75;
    targets[0] = s; targets[1] = -s; targets[2] = -s; targets[3] = s;
  } else if (climbing) {
    const s = Math.sin(ph);
    targets[0] = -1.6 + s * 0.4; targets[1] = -1.6 - s * 0.4; targets[2] = s * 0.5; targets[3] = -s * 0.5;
  } else if (m === 'cheer') {
    targets[0] = -2.6 + Math.sin(t * 14) * 0.3; targets[1] = -2.6 - Math.sin(t * 14) * 0.3;
  }
  if (c.armsUp && !climbing) {
    targets[0] = m === 'drink' ? -1.35 : -2.7;
    targets[1] = targets[0];
  }
  c.legs.forEach((leg, i) => (leg.rotation.x = damp(leg.rotation.x, targets[i], 18, dt)));

  // head
  let headRX = 0;
  let headRY = Math.sin(t * 0.6) * 0.18;
  if (walking || climbing) headRY = 0;
  if (m === 'drink') headRX = -0.45;
  if (c.armsUp && m !== 'drink') headRX = -0.15;
  if (c.lookAtCamera) headRY = 0;
  c.head.rotation.x = damp(c.head.rotation.x, headRX, 8, dt);
  c.head.rotation.y = damp(c.head.rotation.y, headRY, 4, dt);

  // tail
  const wagSpeed = walking ? 10 : m === 'cheer' ? 16 : 3;
  const wagAmp = walking ? 0.25 : m === 'cheer' ? 0.35 : 0.15;
  c.tail.forEach((seg, i) => {
    seg.rotation.x = -0.32 - (walking ? 0.05 : 0);
    seg.rotation.y = Math.sin(t * wagSpeed - i * 0.6) * wagAmp;
  });

  // blink + ear twitch
  c.blink -= dt;
  const eyeScale = c.blink < 0.12 ? 0.1 : m === 'drink' ? 0.25 : 1;
  if (c.blink < 0) c.blink = 2 + Math.random() * 3;
  c.eyes.forEach((e) => (e.scale.y = damp(e.scale.y, eyeScale, 30, dt)));
  c.earTwitch -= dt;
  const twitch = c.earTwitch < 0.15 ? 0.4 : 0;
  if (c.earTwitch < 0) c.earTwitch = 2 + Math.random() * 4;
  c.ears[1].rotation.x = damp(c.ears[1].rotation.x, -twitch, 25, dt);
}

// ---------------------------------------------------------------- enemy
export function createDustBunny() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const fur = mat('#8f7fae', { flatShading: true, roughness: 1 });
  const ball = mesh(new THREE.IcosahedronGeometry(0.27, 1), fur);
  body.add(ball);
  const spikeMat = mat('#5d4f78', { flatShading: true });
  const spikeGeo = new THREE.ConeGeometry(0.06, 0.16, 5);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 16; i++) {
    const dir = new THREE.Vector3().randomDirection();
    if (dir.z > 0.55) dir.z = -dir.z; // keep the face clear
    const spike = mesh(spikeGeo, spikeMat);
    spike.position.copy(dir).multiplyScalar(0.26);
    spike.quaternion.setFromUnitVectors(up, dir);
    body.add(spike);
  }
  const white = mat('#ffffff');
  const black = mat('#1b1424');
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.075, 12, 10), white, false);
    eye.position.set(s * 0.09, 0.05, 0.22);
    body.add(eye);
    const pupil = mesh(new THREE.SphereGeometry(0.035, 10, 8), black, false);
    pupil.position.set(s * 0.085, 0.04, 0.29);
    body.add(pupil);
    const brow = mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), black, false);
    brow.position.set(s * 0.09, 0.14, 0.26);
    brow.rotation.z = s * -0.45;
    body.add(brow);
    const foot = mesh(new THREE.SphereGeometry(0.07, 10, 8), spikeMat);
    foot.position.set(s * 0.12, -0.25, 0.04);
    foot.scale.set(1, 0.6, 1.3);
    root.add(foot);
  }
  return { root, body, time: Math.random() * 10 };
}

export function animateDustBunny(e, dt) {
  e.time += dt;
  const hop = Math.abs(Math.sin(e.time * 7));
  e.body.position.y = 0.3 + hop * 0.14;
  e.body.scale.set(1 + (1 - hop) * 0.12, 1 - (1 - hop) * 0.15, 1 + (1 - hop) * 0.12);
}

// ---------------------------------------------------------------- pickups
export function createGem(color) {
  const root = new THREE.Group();
  const gem = mesh(
    new THREE.OctahedronGeometry(0.17, 0),
    mat(color, { emissive: color, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.15, flatShading: true }),
  );
  gem.scale.y = 1.4;
  gem.position.y = 0.45;
  root.add(gem);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  halo.scale.setScalar(0.9);
  halo.position.y = 0.45;
  root.add(halo);
  return { root, gem, halo };
}

const coinGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 24);
const coinMat = mat('#ffcf3a', { metalness: 0.6, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.3 });
export function createCoin() {
  const root = new THREE.Group();
  const coin = mesh(coinGeo, coinMat);
  coin.rotation.x = Math.PI / 2;
  const holder = new THREE.Group();
  holder.position.y = 0.32;
  holder.add(coin);
  root.add(holder);
  return { root, holder };
}

export function createYarnBall() {
  const root = new THREE.Group();
  const yarn = mat('#ff6fa3', { roughness: 0.9 });
  root.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), yarn));
  const lineMat = mat('#e24d86', { roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const r = mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 24), lineMat, false);
    r.rotation.set(i * 0.9, i * 1.3, 0);
    root.add(r);
  }
  const loose = mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), lineMat, false);
  loose.position.set(0.12, -0.06, 0);
  root.add(loose);
  return root;
}

export function createSprout() {
  const root = new THREE.Group();
  const leaf = mat('#3fae49', { flatShading: true });
  for (const s of [-1, 1]) {
    const l = mesh(new THREE.SphereGeometry(0.08, 8, 6), leaf);
    l.scale.set(0.5, 0.25, 1.1);
    l.position.set(s * 0.06, 0.12, 0);
    l.rotation.z = s * 0.6;
    root.add(l);
  }
  const stem = mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.12, 6), leaf);
  stem.position.y = 0.06;
  root.add(stem);
  const peek = createYarnBall();
  peek.scale.setScalar(0.7);
  peek.position.y = -0.04;
  root.add(peek);
  return { root, peek };
}

// ---------------------------------------------------------------- goal
export function createMilk() {
  const root = new THREE.Group();
  const pedestal = mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.14, 24), mat('#ffd166', { metalness: 0.4, roughness: 0.3 }));
  pedestal.position.y = 0.07;
  pedestal.receiveShadow = true;
  root.add(pedestal);
  const cloth = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 24), mat('#e63e62'));
  cloth.position.y = 0.15;
  root.add(cloth);

  const glass = new THREE.Group();
  glass.position.y = 0.5;
  root.add(glass);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.13, 0.44, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  glass.add(shell);
  const bottom = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 28), mat('#e8f7ff', { transparent: true, opacity: 0.6 }));
  bottom.position.y = -0.21;
  glass.add(bottom);
  const milkGeo = new THREE.CylinderGeometry(0.148, 0.125, 0.36, 28);
  milkGeo.translate(0, -0.18, 0); // pivot at the rim so it drains towards the mouth
  const milk = mesh(milkGeo, mat('#ffffff', { roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.15 }));
  milk.position.y = 0.16;
  glass.add(milk);
  const straw = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8), mat('#ff5b7f'));
  straw.position.set(0.05, 0.17, 0);
  straw.rotation.z = -0.25;
  glass.add(straw);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff6c4', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  halo.scale.setScalar(1.6);
  halo.position.y = 0.5;
  root.add(halo);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.45, 4, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = 2;
  root.add(beam);
  return { root, glass, milk, straw, halo, beam };
}

// ---------------------------------------------------------------- props
export function createButton() {
  const root = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.08, 24), mat('#8d8f99', { metalness: 0.3 }));
  base.position.y = 0.04;
  base.receiveShadow = true;
  root.add(base);
  const capMat = mat('#ff4d5e', { emissive: '#ff4d5e', emissiveIntensity: 0.25 });
  const cap = mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 24), capMat);
  cap.position.y = 0.13;
  root.add(cap);
  return { root, cap, capMat };
}

export function createLadder(height) {
  const root = new THREE.Group();
  const wood = mat('#b97a45');
  for (const s of [-1, 1]) {
    const rail = mesh(new THREE.BoxGeometry(0.06, height + 0.15, 0.06), wood);
    rail.position.set(s * 0.22, height / 2 + 0.05, 0);
    root.add(rail);
  }
  for (let y = 0.2; y < height; y += 0.25) {
    const rung = mesh(new THREE.BoxGeometry(0.44, 0.045, 0.05), wood);
    rung.position.y = y;
    root.add(rung);
  }
  return root;
}

export function createBridgeBlock() {
  const root = new THREE.Group();
  const block = mesh(new RoundedBoxGeometry(1, 0.42, 1, 2, 0.06), mat('#c98b4f'));
  block.position.y = -0.21;
  block.receiveShadow = true;
  root.add(block);
  const lineMat = mat('#8a5a30');
  for (let i = -1; i <= 1; i += 2) {
    const line = mesh(new THREE.BoxGeometry(1.01, 0.02, 0.03), lineMat, false);
    line.position.set(0, 0.002, i * 0.17);
    root.add(line);
  }
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), lineMat);
    post.position.set(s * 0.44, 0.15, 0.44);
    root.add(post);
    const post2 = post.clone();
    post2.position.z = -0.44;
    root.add(post2);
  }
  return root;
}

export function createDecor(type, rand, theme) {
  const root = new THREE.Group();
  const pick = (list) => list[Math.floor(rand() * list.length)];
  if (type === 'tree') {
    const trunk = mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 8), mat('#8a5a34'));
    trunk.position.y = 0.25;
    root.add(trunk);
    const leaves = mat(pick(theme.foliage), { flatShading: true });
    [[0, 0.75, 0, 0.38], [0.15, 1.0, 0.05, 0.28], [-0.12, 1.05, -0.05, 0.25]].forEach(([x, y, z, r]) => {
      const l = mesh(new THREE.IcosahedronGeometry(r, 1), leaves);
      l.position.set(x, y, z);
      root.add(l);
    });
    const apple = mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#ff4d4d'));
    apple.position.set(0.25, 0.7, 0.25);
    root.add(apple);
  } else if (type === 'hedge') {
    const h = mesh(new RoundedBoxGeometry(0.95, 0.85, 0.95, 3, 0.18), mat('#3f9e46', { flatShading: true }));
    h.position.y = 0.42;
    root.add(h);
    for (let i = 0; i < 4; i++) {
      const f = mesh(new THREE.SphereGeometry(0.04, 6, 6), mat(['#ffffff', '#ffd1e8'][i % 2]), false);
      f.position.set((rand() - 0.5) * 0.8, 0.3 + rand() * 0.5, 0.48);
      root.add(f);
    }
  } else if (type === 'rock') {
    const r = mesh(new THREE.DodecahedronGeometry(0.32, 0), mat('#9aa0a8', { flatShading: true }));
    r.position.y = 0.2;
    r.scale.set(1, 0.75, 0.9);
    r.rotation.y = rand() * 3;
    root.add(r);
    const r2 = mesh(new THREE.DodecahedronGeometry(0.15, 0), mat('#b6bcc4', { flatShading: true }));
    r2.position.set(0.25, 0.1, 0.2);
    root.add(r2);
  } else if (type === 'flowers') {
    const colors = theme.flowers;
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      g.position.set((rand() - 0.5) * 0.25, 0, (rand() - 0.5) * 0.25);
      const stem = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 4), mat('#3a9a40'), false);
      stem.position.y = 0.07;
      g.add(stem);
      const bloom = mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(colors[Math.floor(rand() * colors.length)]), false);
      bloom.position.y = 0.15;
      bloom.scale.y = 0.6;
      g.add(bloom);
      root.add(g);
    }
  } else {
    createExtraDecor(type, root, rand, theme);
  }
  return root;
}

export function createCloud(rand, color = '#ffffff') {
  const root = new THREE.Group();
  const m = mat(color, { roughness: 1, flatShading: true });
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rand() * 0.5, 1), m);
    p.position.set(i * 0.7 - n * 0.35, rand() * 0.3, rand() * 0.4);
    root.add(p);
  }
  return root;
}

function createExtraDecor(type, root, rand, theme) {
  if (type === 'pine') {
    const trunk = mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.35, 8), mat('#6b4a32'));
    trunk.position.y = 0.17;
    root.add(trunk);
    const needles = mat(theme.foliage[0], { flatShading: true });
    const snow = mat('#ffffff', { flatShading: true });
    [[0.42, 0.42, 0.35], [0.72, 0.33, 0.3], [0.98, 0.22, 0.26]].forEach(([y, r, h]) => {
      const c = mesh(new THREE.ConeGeometry(r, h + 0.1, 8), needles);
      c.position.y = y;
      root.add(c);
      const cap = mesh(new THREE.ConeGeometry(r * 0.75, h * 0.45, 8), snow, false);
      cap.position.y = y + h * 0.3;
      root.add(cap);
    });
  } else if (type === 'mushroom') {
    const stem = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.4, 10), mat('#f1e6d2'));
    stem.position.y = 0.2;
    root.add(stem);
    const capMat = mat('#7b5cff', { emissive: '#5b3cff', emissiveIntensity: 0.6 });
    const cap = mesh(new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.position.y = 0.38;
    cap.scale.y = 0.7;
    root.add(cap);
    for (let i = 0; i < 5; i++) {
      const dot = mesh(new THREE.SphereGeometry(0.04, 8, 6), mat('#d8fbff', { emissive: '#9ff0ff', emissiveIntensity: 1 }), false);
      const a = (i / 5) * Math.PI * 2;
      dot.position.set(Math.cos(a) * 0.22, 0.52, Math.sin(a) * 0.22);
      root.add(dot);
    }
  } else if (type === 'lamp') {
    const post = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8), mat('#2b2a3a', { metalness: 0.5 }));
    post.position.y = 0.45;
    root.add(post);
    const bulb = mesh(new THREE.SphereGeometry(0.12, 12, 10), mat('#fff0b0', { emissive: '#ffcc55', emissiveIntensity: 2 }), false);
    bulb.position.y = 0.95;
    root.add(bulb);
    const light = new THREE.PointLight('#ffcc66', 4, 4, 1.6);
    light.position.y = 0.95;
    root.add(light);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcc66', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.1);
    halo.position.y = 0.95;
    root.add(halo);
  } else if (type === 'stump') {
    const s = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.3, 12), mat('#8a5a34'));
    s.position.y = 0.15;
    root.add(s);
    const top = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 12), mat('#d9b07a'), false);
    top.position.y = 0.31;
    root.add(top);
  } else if (type === 'pumpkin') {
    const p = mesh(new THREE.SphereGeometry(0.3, 12, 10), mat('#ff8a1f', { flatShading: true }));
    p.scale.y = 0.75;
    p.position.y = 0.22;
    root.add(p);
    const stem = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.14, 6), mat('#4b7a2a'));
    stem.position.y = 0.5;
    root.add(stem);
  }
}

// ---------------------------------------------------------------- new characters
export function createHedgehog() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const belly = mesh(new THREE.SphereGeometry(0.2, 14, 10), mat('#e8c9a0'));
  belly.scale.set(1, 0.85, 1.2);
  body.add(belly);
  const spikeMat = mat('#6b4a32', { flatShading: true });
  const spikeGeo = new THREE.ConeGeometry(0.05, 0.2, 5);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 26; i++) {
    const dir = new THREE.Vector3().randomDirection();
    if (dir.z > 0.35 || dir.y < -0.2) dir.set(dir.x, Math.abs(dir.y), -Math.abs(dir.z));
    dir.normalize();
    const spike = mesh(spikeGeo, spikeMat);
    spike.position.copy(dir).multiplyScalar(0.19);
    spike.quaternion.setFromUnitVectors(up, dir);
    body.add(spike);
  }
  const snout = mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#e8c9a0'));
  snout.position.set(0, -0.02, 0.24);
  body.add(snout);
  const nose = mesh(new THREE.SphereGeometry(0.025, 8, 6), mat('#1b1424'), false);
  nose.position.set(0, -0.01, 0.3);
  body.add(nose);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.025, 8, 6), mat('#1b1424'), false);
    eye.position.set(s * 0.07, 0.05, 0.2);
    body.add(eye);
  }
  const stars = new THREE.Group(); // shown while stunned
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffe066', blending: THREE.AdditiveBlending, depthWrite: false }));
    st.scale.setScalar(0.16);
    st.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.25, 0.45, Math.sin((i / 3) * Math.PI * 2) * 0.25);
    stars.add(st);
  }
  stars.visible = false;
  root.add(stars);
  return { root, body, stars };
}

export function createWisp() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const ghostMat = mat('#bff3ff', { emissive: '#6fe3ff', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
  const head = mesh(new THREE.SphereGeometry(0.24, 18, 14), ghostMat, false);
  body.add(head);
  const tail = mesh(new THREE.ConeGeometry(0.2, 0.4, 14), ghostMat, false);
  tail.rotation.x = Math.PI;
  tail.position.y = -0.25;
  body.add(tail);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('#1b1424'), false);
    eye.position.set(s * 0.08, 0.04, 0.2);
    eye.scale.y = 1.4;
    body.add(eye);
  }
  const mouth = mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI), mat('#1b1424'), false);
  mouth.position.set(0, -0.06, 0.22);
  mouth.rotation.z = Math.PI;
  body.add(mouth);
  const light = new THREE.PointLight('#6fe3ff', 3, 3.5, 1.5);
  body.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#6fe3ff', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.2);
  body.add(halo);
  return { root, body, ghostMat };
}

export function createSnowman() {
  const root = new THREE.Group();
  const snow = mat('#ffffff', { roughness: 0.9 });
  [[0.25, 0.3], [0.62, 0.22], [0.9, 0.15]].forEach(([y, r]) => {
    const b = mesh(new THREE.SphereGeometry(r, 16, 12), snow);
    b.position.y = y;
    root.add(b);
  });
  const nose = mesh(new THREE.ConeGeometry(0.035, 0.18, 8), mat('#ff8a1f'));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.9, 0.2);
  root.add(nose);
  const coal = mat('#1b1424');
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.025, 8, 6), coal, false);
    eye.position.set(s * 0.06, 0.96, 0.13);
    root.add(eye);
    const brow = mesh(new THREE.BoxGeometry(0.07, 0.015, 0.015), coal, false);
    brow.position.set(s * 0.06, 1.01, 0.13);
    brow.rotation.z = s * -0.4;
    root.add(brow);
    const arm = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.35, 5), mat('#6b4a32'));
    arm.position.set(s * 0.32, 0.7, 0);
    arm.rotation.z = s * 1.0;
    root.add(arm);
  }
  const hat = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.16, 12), mat('#2b2a3a'));
  hat.position.y = 1.1;
  root.add(hat);
  const brim = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12), mat('#2b2a3a'));
  brim.position.y = 1.02;
  root.add(brim);
  const scarf = mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 16), mat('#e63e62'));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.78;
  root.add(scarf);
  return { root };
}

const snowballGeo = new THREE.IcosahedronGeometry(0.17, 1);
export function createSnowball() {
  return mesh(snowballGeo, mat('#ffffff', { flatShading: true, roughness: 0.8 }));
}

// ---------------------------------------------------------------- new items
export function createKey() {
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.y = 0.45;
  root.add(holder);
  const gold = mat('#ffd23f', { metalness: 0.7, roughness: 0.2, emissive: '#a07000', emissiveIntensity: 0.4 });
  const ring = mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 20), gold);
  ring.position.y = 0.12;
  holder.add(ring);
  const shaft = mesh(new THREE.BoxGeometry(0.04, 0.24, 0.04), gold);
  shaft.position.y = -0.06;
  holder.add(shaft);
  for (const y of [-0.14, -0.08]) {
    const tooth = mesh(new THREE.BoxGeometry(0.07, 0.03, 0.04), gold);
    tooth.position.set(0.05, y, 0);
    holder.add(tooth);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffe066', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.8);
  holder.add(halo);
  return { root, holder };
}

export function createGate() {
  const root = new THREE.Group();
  const wood = mat('#7a4a2a');
  const iron = mat('#4a4a5a', { metalness: 0.6, roughness: 0.4 });
  const bars = new THREE.Group();
  root.add(bars);
  for (let i = -2; i <= 2; i++) {
    const bar = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), iron);
    bar.position.set(i * 0.17, 0.45, 0);
    bars.add(bar);
  }
  for (const y of [0.15, 0.75]) {
    const rail = mesh(new THREE.BoxGeometry(0.85, 0.06, 0.06), wood);
    rail.position.y = y;
    bars.add(rail);
  }
  const lock = mesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), mat('#ffd23f', { metalness: 0.7, roughness: 0.3 }));
  lock.position.set(0, 0.45, 0.06);
  bars.add(lock);
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.1, 1.05, 0.1), wood);
    post.position.set(s * 0.46, 0.52, 0);
    root.add(post);
  }
  return { root, bars, lock };
}

export function createFish() {
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.y = 0.4;
  root.add(holder);
  const fishMat = mat('#6ec6ff', { emissive: '#2a7ab0', emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.2 });
  const body = mesh(new THREE.SphereGeometry(0.13, 14, 10), fishMat);
  body.scale.set(1.5, 0.8, 0.5);
  holder.add(body);
  const tail = mesh(new THREE.ConeGeometry(0.09, 0.14, 4), fishMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -0.24;
  holder.add(tail);
  const eye = mesh(new THREE.SphereGeometry(0.022, 8, 6), mat('#1b1424'), false);
  eye.position.set(0.12, 0.03, 0.055);
  holder.add(eye);
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff7aa0', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  heart.scale.setScalar(0.7);
  holder.add(heart);
  return { root, holder };
}

export function createFirefly() {
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.y = 0.5;
  root.add(holder);
  const glow = mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#fffbb0', { emissive: '#d8ff5a', emissiveIntensity: 2 }), false);
  holder.add(glow);
  const wingMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), wingMat);
    w.position.set(s * 0.06, 0.04, 0);
    w.rotation.z = s * 0.4;
    holder.add(w);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#d8ff5a', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.9);
  holder.add(halo);
  return { root, holder, halo };
}

export function createCocoa() {
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.y = 0.3;
  root.add(holder);
  const cup = mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 16), mat('#e63e62'));
  holder.add(cup);
  const drink = mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.02, 16), mat('#6b3a22'), false);
  drink.position.y = 0.085;
  holder.add(drink);
  const handle = mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), mat('#e63e62'));
  handle.position.x = 0.13;
  holder.add(handle);
  const marsh = mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), mat('#ffffff'), false);
  marsh.position.set(0.02, 0.105, 0);
  holder.add(marsh);
  return { root, holder };
}

export function createCampfire() {
  const root = new THREE.Group();
  const stone = mat('#8a8f99', { flatShading: true });
  for (let i = 0; i < 7; i++) {
    const s = mesh(new THREE.DodecahedronGeometry(0.08, 0), stone);
    const a = (i / 7) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.26, 0.05, Math.sin(a) * 0.26);
    root.add(s);
  }
  const wood = mat('#6b4a32');
  for (let i = 0; i < 3; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 6), wood);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.06;
    root.add(log);
  }
  const flames = [];
  const colors = ['#ff4d1f', '#ff9a1f', '#ffe066'];
  colors.forEach((c, i) => {
    const f = mesh(new THREE.ConeGeometry(0.15 - i * 0.04, 0.4 - i * 0.08, 8), mat(c, { emissive: c, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 }), false);
    f.position.y = 0.25 - i * 0.02;
    root.add(f);
    flames.push(f);
  });
  const light = new THREE.PointLight('#ff9a3d', 4, 4, 1.5);
  light.position.y = 0.5;
  root.add(light);
  return { root, flames, light };
}
