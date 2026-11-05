// Low-poly companion models: Pip the sparrow, Bruno the tortoise, Luna the glow
// moth and Pom the penguin, plus the "!" talk bubble. Every factory returns
// { root, setState(state), animate(dt) } with state 'idle' | 'walk' | 'fly' |
// 'happy'. Models face +z and stand with their feet at y = 0.
import * as THREE from 'three';
import { glowTexture } from '../effects.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
const mesh = (geo, material, shadow = true) => {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  return m;
};
const damp = (cur, target, lambda, dt) => THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-lambda * dt));

const EYE = mat('#2b2230', { roughness: 0.25 });
const SHINE = mat('#ffffff', { roughness: 0.2 });

/** Two shiny cartoon eyes added to `parent` at ±x. */
function addEyes(parent, { x, y, z, r, spread = 1 }) {
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * x, y, z);
    eye.rotation.y = s * 0.25 * spread;
    const ball = mesh(new THREE.SphereGeometry(r, 12, 10), EYE, false);
    ball.scale.set(1, 1.2, 0.6);
    eye.add(ball);
    const shine = mesh(new THREE.SphereGeometry(r * 0.32, 8, 6), SHINE, false);
    shine.position.set(r * 0.3, r * 0.45, r * 0.5);
    eye.add(shine);
    parent.add(eye);
    eyes.push(eye);
  }
  return eyes;
}

/** Shared blink + state bookkeeping for every companion. */
function rig(root, eyes) {
  const r = { root, eyes, state: 'idle', time: 0, phase: 0, blink: 2 + Math.random() * 2 };
  r.setState = (state) => {
    r.state = state;
  };
  r.tick = (dt) => {
    r.time += dt;
    r.blink -= dt;
    if (r.blink < -0.12) r.blink = 2 + Math.random() * 3;
    const open = r.blink < 0 ? 0.1 : 1;
    eyes.forEach((e) => (e.scale.y = damp(e.scale.y, open, 30, dt)));
  };
  return r;
}

// ---------------------------------------------------------------- Pip the sparrow
export function createPip() {
  const brown = mat('#a0714f');
  const darkBrown = mat('#6e4a33');
  const cream = mat('#fff1dc');
  const blue = mat('#4aa3ff');
  const beakMat = mat('#ffb340', { roughness: 0.5 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.11;
  root.add(body);

  const torso = mesh(new THREE.SphereGeometry(0.095, 18, 14), brown);
  torso.scale.set(1, 0.95, 1.15);
  body.add(torso);
  const belly = mesh(new THREE.SphereGeometry(0.075, 14, 10), cream, false);
  belly.position.set(0, -0.02, 0.04);
  belly.scale.set(0.95, 0.9, 0.9);
  body.add(belly);
  const tail = mesh(new THREE.BoxGeometry(0.08, 0.015, 0.1), darkBrown);
  tail.position.set(0, 0.03, -0.13);
  tail.rotation.x = -0.45;
  body.add(tail);

  const head = new THREE.Group();
  head.position.set(0, 0.1, 0.05);
  body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.07, 18, 14), brown));
  const face = mesh(new THREE.SphereGeometry(0.05, 12, 10), cream, false);
  face.position.set(0, -0.015, 0.035);
  face.scale.set(1.1, 0.8, 0.7);
  head.add(face);
  const beak = mesh(new THREE.ConeGeometry(0.02, 0.05, 8), beakMat, false);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.005, 0.085);
  head.add(beak);
  const eyes = addEyes(head, { x: 0.035, y: 0.015, z: 0.06, r: 0.014, spread: 2 });

  // little blue cap with a brim
  const cap = mesh(new THREE.SphereGeometry(0.072, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), blue);
  cap.position.y = 0.012;
  cap.scale.set(1.02, 0.75, 1.02);
  head.add(cap);
  const brim = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 16, 1, false, -Math.PI / 2, Math.PI), blue, false);
  brim.position.set(0, 0.015, 0.05);
  brim.scale.z = 0.9;
  head.add(brim);
  const pompom = mesh(new THREE.SphereGeometry(0.016, 8, 6), mat('#ffffff'), false);
  pompom.position.y = 0.068;
  head.add(pompom);
  // matching scarf
  const scarf = mesh(new THREE.TorusGeometry(0.058, 0.014, 8, 18), blue, false);
  scarf.position.set(0, 0.06, 0.02);
  scarf.rotation.x = Math.PI / 2 + 0.25;
  body.add(scarf);

  const wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.085, 0.03, -0.01);
    const feather = mesh(new THREE.SphereGeometry(0.07, 12, 8), darkBrown);
    feather.scale.set(0.25, 0.7, 1.1);
    feather.position.set(s * 0.012, -0.02, -0.02);
    wing.add(feather);
    body.add(wing);
    wings.push(wing);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), beakMat, false);
    leg.position.set(s * 0.03, -0.09, 0.01);
    body.add(leg);
    legs.push(leg);
  }

  const r = rig(root, eyes);
  r.animate = (dt) => {
    r.tick(dt);
    const t = r.time;
    const flying = r.state === 'fly' || r.state === 'happy';
    let y = 0.11;
    let tilt = 0;
    if (r.state === 'idle' || r.state === 'happy') {
      // little hops every ~1.3s (constantly when happy)
      const cycle = r.state === 'happy' ? (t * 3) % 1 : (t * 0.75) % 1;
      if (cycle < 0.3) y += Math.sin((cycle / 0.3) * Math.PI) * 0.05;
    } else if (r.state === 'walk') {
      y += Math.abs(Math.sin(t * 14)) * 0.035;
    }
    if (r.state === 'fly') tilt = 0.25;
    body.position.y = damp(body.position.y, y, 25, dt);
    body.rotation.x = damp(body.rotation.x, tilt, 8, dt);
    head.rotation.y = damp(head.rotation.y, r.state === 'idle' ? Math.sin(t * 1.3) * 0.35 : 0, 8, dt);
    const flap = flying ? Math.sin(t * 34) * 0.9 + 0.5 : 0;
    wings.forEach((w, i) => {
      const s = i === 0 ? -1 : 1;
      w.rotation.z = damp(w.rotation.z, s * flap, flying ? 60 : 12, dt);
    });
    legs.forEach((l) => (l.visible = r.state !== 'fly'));
    tail.rotation.x = -0.45 + Math.sin(t * 6) * 0.08;
  };
  return { root, setState: r.setState, animate: r.animate };
}

// ---------------------------------------------------------------- Bruno the tortoise
export function createBruno() {
  const skin = mat('#8fc46a');
  const skinDark = mat('#6fa04f');
  const shellMat = mat('#b9824a', { roughness: 0.6 });
  const plateMat = mat('#8a5a2e', { roughness: 0.6 });
  const rimMat = mat('#e0b878', { roughness: 0.6 });
  const gold = mat('#ffd36b', { metalness: 0.6, roughness: 0.3 });
  const lens = mat('#dff4ff', { transparent: true, opacity: 0.35, roughness: 0.05 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.11;
  root.add(body);

  // domed shell with patterned plates
  const shell = mesh(new THREE.SphereGeometry(0.28, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  shell.scale.set(1, 0.92, 1.1);
  body.add(shell);
  const rim = mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 28), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 1.1, 1);
  body.add(rim);
  const belly = mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.06, 20), rimMat, false);
  belly.position.y = -0.03;
  belly.scale.z = 1.1;
  body.add(belly);
  const plates = [[0, Math.PI / 2]];
  for (let i = 0; i < 6; i++) plates.push([(i / 6) * Math.PI * 2, 0.75]);
  for (const [az, el] of plates) {
    const plate = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 6), plateMat, false);
    const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    plate.position.set(dir.x * 0.283, dir.y * 0.283 * 0.92, dir.z * 0.283 * 1.1);
    const normal = new THREE.Vector3(dir.x, dir.y / 0.92, dir.z / 1.1).normalize();
    plate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    body.add(plate);
  }

  // head on a neck
  const neck = new THREE.Group();
  neck.position.set(0, 0.05, 0.26);
  body.add(neck);
  const neckMesh = mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.18, 12), skin);
  neckMesh.position.set(0, 0.06, 0.03);
  neckMesh.rotation.x = 0.7;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.08);
  neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.11, 18, 14), skin);
  skull.scale.set(1, 0.9, 1.1);
  head.add(skull);
  const snout = mesh(new THREE.SphereGeometry(0.07, 12, 10), skinDark, false);
  snout.position.set(0, -0.03, 0.07);
  snout.scale.set(1.1, 0.7, 0.9);
  head.add(snout);
  const smile = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), mat('#3c5a2a'), false);
  smile.position.set(0, -0.045, 0.125);
  smile.rotation.z = Math.PI;
  head.add(smile);
  const eyes = addEyes(head, { x: 0.045, y: 0.02, z: 0.1, r: 0.018 });
  // tiny round glasses
  for (const s of [-1, 1]) {
    const ring = mesh(new THREE.TorusGeometry(0.028, 0.005, 6, 16), gold, false);
    ring.position.set(s * 0.045, 0.02, 0.121);
    head.add(ring);
    const glass = mesh(new THREE.CircleGeometry(0.026, 16), lens, false);
    glass.position.set(s * 0.045, 0.02, 0.12);
    head.add(glass);
    const arm = mesh(new THREE.BoxGeometry(0.004, 0.004, 0.08), gold, false);
    arm.position.set(s * 0.075, 0.025, 0.08);
    head.add(arm);
  }
  const bridge = mesh(new THREE.BoxGeometry(0.035, 0.005, 0.005), gold, false);
  bridge.position.set(0, 0.025, 0.124);
  head.add(bridge);

  const legs = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = new THREE.Group();
    leg.position.set(x * 0.19, -0.02, z * 0.2);
    const foot = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.11, 10), skin);
    foot.position.y = -0.04;
    leg.add(foot);
    body.add(leg);
    legs.push(leg);
  }
  const tail = mesh(new THREE.ConeGeometry(0.035, 0.09, 8), skin);
  tail.rotation.x = -Math.PI / 2 - 0.3;
  tail.position.set(0, 0.0, -0.32);
  body.add(tail);

  const r = rig(root, eyes);
  r.animate = (dt) => {
    r.tick(dt);
    const t = r.time;
    const walking = r.state === 'walk';
    r.phase += dt * (walking ? 6 : 0);
    const ph = r.phase;
    legs.forEach((leg, i) => {
      const s = i === 0 || i === 3 ? 1 : -1; // diagonal pairs
      leg.rotation.x = damp(leg.rotation.x, walking ? Math.sin(ph) * 0.45 * s : 0, 10, dt);
    });
    let bodyY = 0.11 + (walking ? Math.abs(Math.sin(ph)) * 0.015 : 0);
    let rollZ = walking ? Math.sin(ph) * 0.03 : 0;
    if (r.state === 'happy') {
      bodyY = 0.11 + Math.abs(Math.sin(t * 6)) * 0.04;
      rollZ = Math.sin(t * 6) * 0.06;
    }
    body.position.y = damp(body.position.y, bodyY, 15, dt);
    body.rotation.z = damp(body.rotation.z, rollZ, 10, dt);
    // slow, wise head bob
    neck.position.y = 0.05 + Math.sin(t * 1.6) * 0.012;
    head.rotation.x = Math.sin(t * 1.6 + 0.6) * 0.1;
    head.rotation.y = r.state === 'idle' ? Math.sin(t * 0.5) * 0.25 : damp(head.rotation.y, 0, 5, dt);
    tail.rotation.y = Math.sin(t * 2) * 0.2;
  };
  return { root, setState: r.setState, animate: r.animate };
}

// ---------------------------------------------------------------- Luna the glow moth
export function createLuna() {
  const lilac = mat('#d9c2ff', { roughness: 0.9 });
  const fuzz = mat('#f6efff', { roughness: 1 });
  const wingMat = mat('#c8a8ff', {
    transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: '#8f6bff', emissiveIntensity: 0.35,
  });
  const edgeMat = mat('#f2e6ff', { side: THREE.DoubleSide, emissive: '#c79bff', emissiveIntensity: 1.6 });
  const spotMat = mat('#ffffff', { side: THREE.DoubleSide, emissive: '#ffe6ff', emissiveIntensity: 1.3 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.18;
  root.add(body);

  const thorax = mesh(new THREE.CapsuleGeometry(0.05, 0.12, 6, 12), lilac);
  thorax.rotation.x = Math.PI / 2 - 0.35;
  thorax.position.z = -0.03;
  body.add(thorax);
  const collar = mesh(new THREE.SphereGeometry(0.065, 14, 10), fuzz);
  collar.position.set(0, 0.03, 0.05);
  collar.scale.set(1.1, 0.8, 0.8);
  body.add(collar);
  const head = new THREE.Group();
  head.position.set(0, 0.07, 0.1);
  body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), lilac));
  const eyes = addEyes(head, { x: 0.028, y: 0.01, z: 0.048, r: 0.017, spread: 1.5 });
  // feathery antennae
  for (const s of [-1, 1]) {
    const antenna = new THREE.Group();
    antenna.position.set(s * 0.025, 0.045, 0.02);
    antenna.rotation.set(-0.4, 0, -s * 0.45);
    const stalk = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 5), fuzz, false);
    stalk.position.y = 0.06;
    antenna.add(stalk);
    const leaf = mesh(new THREE.SphereGeometry(0.03, 10, 8), edgeMat, false);
    leaf.position.y = 0.11;
    leaf.scale.set(0.5, 1, 0.2);
    antenna.add(leaf);
    head.add(antenna);
  }

  // big wings: soft fill, glowing edge and a glowing eye-spot, hinged along the body
  const wings = [];
  const wingShape = (rx, rz) => {
    const g = new THREE.Group();
    const fill = mesh(new THREE.CircleGeometry(1, 24), wingMat, false);
    fill.scale.set(rx, rz, 1);
    const edge = mesh(new THREE.RingGeometry(0.88, 1.05, 32), edgeMat, false);
    edge.scale.set(rx, rz, 1);
    edge.position.z = -0.002;
    const spot = mesh(new THREE.CircleGeometry(0.22, 12), spotMat, false);
    spot.scale.set(rx, rz, 1);
    spot.position.z = 0.002;
    g.add(fill, edge, spot);
    g.rotation.x = -Math.PI / 2;
    return g;
  };
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(s * 0.03, 0.02, 0);
    const fore = wingShape(0.15, 0.11);
    fore.position.set(s * 0.15, 0, 0.05);
    fore.rotation.z = s * 0.35;
    const hind = wingShape(0.1, 0.08);
    hind.position.set(s * 0.1, -0.005, -0.09);
    hind.rotation.z = -s * 0.3;
    hinge.add(fore, hind);
    body.add(hinge);
    wings.push(hinge);
  }

  const light = new THREE.PointLight('#c9a2ff', 2.4, 5, 1.6);
  light.position.y = 0.05;
  body.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#c9a2ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.setScalar(0.9);
  body.add(halo);

  const r = rig(root, eyes);
  r.animate = (dt) => {
    r.tick(dt);
    const t = r.time;
    const busy = r.state !== 'idle';
    const speed = r.state === 'happy' ? 30 : busy ? 24 : 14;
    r.phase += dt * speed;
    const flap = Math.sin(r.phase) * (busy ? 0.75 : 0.45) + 0.15;
    wings.forEach((w, i) => (w.rotation.z = (i === 0 ? -1 : 1) * flap));
    body.position.y = 0.18 + Math.sin(t * 2.4) * 0.04 + (r.state === 'happy' ? Math.abs(Math.sin(t * 5)) * 0.08 : 0);
    body.rotation.x = damp(body.rotation.x, busy ? 0.2 : 0, 6, dt);
    body.rotation.z = Math.sin(t * 1.7) * 0.08;
    const glow = 0.85 + Math.sin(t * 3) * 0.15;
    light.intensity = 2.4 * glow;
    halo.material.opacity = 0.45 * glow;
  };
  return { root, setState: r.setState, animate: r.animate };
}

// ---------------------------------------------------------------- Pom the penguin
export function createPom() {
  const black = mat('#25283a', { roughness: 0.55 });
  const white = mat('#ffffff', { roughness: 0.6 });
  const orange = mat('#ff9b2f', { roughness: 0.5 });
  const red = mat('#ff4d5e');

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = mesh(new THREE.SphereGeometry(0.2, 22, 16), black);
  torso.scale.set(1, 1.3, 0.95);
  torso.position.y = 0.27;
  body.add(torso);
  const belly = mesh(new THREE.SphereGeometry(0.17, 20, 14), white, false);
  belly.position.set(0, 0.22, 0.05);
  belly.scale.set(0.95, 1.2, 0.9);
  body.add(belly);
  const face = mesh(new THREE.SphereGeometry(0.11, 16, 12), white, false);
  face.position.set(0, 0.42, 0.11);
  face.scale.set(1.25, 0.85, 0.7);
  body.add(face);
  const eyes = addEyes(body, { x: 0.05, y: 0.44, z: 0.182, r: 0.022 });
  for (const s of [-1, 1]) {
    const cheek = mesh(new THREE.SphereGeometry(0.025, 10, 8), mat('#ff9fb4', { transparent: true, opacity: 0.6 }), false);
    cheek.position.set(s * 0.09, 0.4, 0.16);
    cheek.scale.set(1.2, 0.7, 0.4);
    body.add(cheek);
  }
  const beak = mesh(new THREE.ConeGeometry(0.03, 0.07, 10), orange, false);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.405, 0.215);
  body.add(beak);

  // tiny red scarf
  const scarf = mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 22), red);
  scarf.position.set(0, 0.34, 0.01);
  scarf.rotation.x = Math.PI / 2 + 0.12;
  body.add(scarf);
  const scarfTail = mesh(new THREE.BoxGeometry(0.05, 0.11, 0.02), red);
  scarfTail.position.set(0.07, 0.28, 0.15);
  scarfTail.rotation.z = 0.3;
  body.add(scarfTail);

  const flippers = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.18, 0.33, 0);
    const flipper = mesh(new THREE.SphereGeometry(0.08, 12, 8), black);
    flipper.scale.set(0.3, 1.1, 0.6);
    flipper.position.set(s * 0.015, -0.08, 0);
    pivot.add(flipper);
    pivot.rotation.z = s * 0.15;
    body.add(pivot);
    flippers.push(pivot);
  }
  const feet = [];
  for (const s of [-1, 1]) {
    const foot = mesh(new THREE.SphereGeometry(0.055, 12, 8), orange);
    foot.scale.set(1, 0.35, 1.4);
    foot.position.set(s * 0.08, 0.02, 0.07);
    root.add(foot);
    feet.push(foot);
  }

  const r = rig(root, eyes);
  r.animate = (dt) => {
    r.tick(dt);
    const t = r.time;
    const walking = r.state === 'walk';
    r.phase += dt * (walking ? 11 : 0);
    const ph = r.phase;
    let roll = Math.sin(t * 1.5) * 0.02;
    let y = 0;
    if (walking) roll = Math.sin(ph) * 0.17; // waddle side to side
    if (r.state === 'happy') y = Math.abs(Math.sin(t * 7)) * 0.06;
    body.rotation.z = damp(body.rotation.z, roll, 14, dt);
    body.position.y = damp(body.position.y, y, 20, dt);
    feet.forEach((f, i) => {
      const lift = walking ? Math.max(0, Math.sin(ph + i * Math.PI)) * 0.035 : 0;
      f.position.y = 0.02 + lift;
    });
    flippers.forEach((p, i) => {
      const s = i === 0 ? -1 : 1;
      let target = s * 0.15;
      if (r.state === 'happy') target = s * (0.5 + Math.sin(t * 22) * 0.45);
      else if (walking) target = s * (0.3 + Math.sin(ph) * 0.1 * s);
      p.rotation.z = damp(p.rotation.z, target, r.state === 'happy' ? 40 : 10, dt);
    });
    scarfTail.rotation.z = 0.3 + Math.sin(t * 4) * 0.12;
  };
  return { root, setState: r.setState, animate: r.animate };
}

// ---------------------------------------------------------------- talk bubble
let bubbleTex = null;
function bubbleTexture() {
  if (bubbleTex) return bubbleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#2b2230';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(10, 8, 108, 88, 30);
  g.moveTo(52, 94);
  g.lineTo(64, 120);
  g.lineTo(78, 94);
  g.closePath();
  g.fill();
  g.stroke();
  // cover the seam between the bubble and its tail
  g.fillRect(55, 88, 20, 9);
  g.fillStyle = '#ff6b8a';
  g.font = 'bold 76px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', 64, 56);
  bubbleTex = new THREE.CanvasTexture(c);
  bubbleTex.colorSpace = THREE.SRGBColorSpace;
  return bubbleTex;
}

/** Floating "!" speech bubble shown above companions waiting to talk. */
export function createTalkBubble() {
  const root = new THREE.Group();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture(), transparent: true, depthWrite: false }));
  sprite.scale.setScalar(0.42);
  root.add(sprite);
  let time = 0;
  return {
    root,
    setVisible(visible) {
      root.visible = visible;
    },
    animate(dt) {
      time += dt;
      sprite.position.y = Math.sin(time * 3) * 0.06;
      sprite.scale.setScalar(0.42 * (1 + Math.max(0, Math.sin(time * 6)) * 0.06));
    },
  };
}
