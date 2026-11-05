import * as THREE from 'three';

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

const confettiGeo = new THREE.PlaneGeometry(0.07, 0.11);
const ringGeo = new THREE.RingGeometry(0.38, 0.46, 40);

/** Small particle system: sparkles, dust puffs, confetti and ground rings. */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  burst({
    pos,
    count = 12,
    colors = ['#ffffff'],
    speed = 2,
    up = 2,
    gravity = -6,
    life = 0.8,
    size = 0.15,
    additive = true,
    shape = 'sprite',
    spin = 0,
  }) {
    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      let obj;
      if (shape === 'confetti') {
        obj = new THREE.Mesh(
          confettiGeo,
          new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true }),
        );
        obj.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      } else {
        obj = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture(),
            color,
            transparent: true,
            depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
          }),
        );
        obj.scale.setScalar(size);
      }
      obj.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      const vel = new THREE.Vector3(Math.cos(a) * s, up * (0.5 + Math.random() * 0.7), Math.sin(a) * s);
      this.scene.add(obj);
      this.items.push({ obj, vel, gravity, life: life * (0.7 + Math.random() * 0.5), age: 0, size, shape, spin });
    }
  }

  ring(pos, color = '#ffffff') {
    const mesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos).add(new THREE.Vector3(0, 0.03, 0));
    this.scene.add(mesh);
    this.items.push({ obj: mesh, ring: true, life: 0.5, age: 0 });
  }

  dust(pos, count = 6) {
    this.burst({ pos, count, colors: ['#f3ead8', '#e2d4bb'], speed: 1.2, up: 0.8, gravity: -1, life: 0.5, size: 0.22, additive: false });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        this.scene.remove(p.obj);
        p.obj.material.dispose();
        this.items.splice(i, 1);
        continue;
      }
      if (p.ring) {
        p.obj.scale.setScalar(0.6 + k * 1.2);
        p.obj.material.opacity = 1 - k;
        continue;
      }
      p.vel.y += p.gravity * dt;
      if (p.shape === 'confetti') p.vel.multiplyScalar(1 - 1.5 * dt);
      p.obj.position.addScaledVector(p.vel, dt);
      if (p.shape === 'confetti') {
        p.obj.rotation.x += dt * 8;
        p.obj.rotation.y += dt * 5;
      } else {
        p.obj.scale.setScalar(p.size * (1 - k * 0.7));
      }
      p.obj.material.opacity = Math.min(1, (1 - k) * 2);
    }
  }
}
