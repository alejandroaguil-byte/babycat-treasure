import * as THREE from 'three';
import { heightAt, isBlocked, stepPath, sameCell } from '../game/grid.js';
import {
  createDustBunny, animateDustBunny, createHedgehog, createWisp, createSnowman, createSnowball,
} from '../world/models.js';

const touching = (a, b, radius = 0.55, height = 0.6) =>
  Math.abs(a.y - b.y) < height && Math.hypot(a.x - b.x, a.z - b.z) < radius;

const turnTowards = (obj, yaw, dt, speed = 8) => {
  let diff = yaw - obj.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  obj.rotation.y += diff * (1 - Math.exp(-speed * dt));
};

/** Walks a closed loop of cells. Dust bunnies are defeated by yarn; hedgehogs only get stunned. */
function patrol(def, ctx, model, animate) {
  const points = def.path.map((c) => ctx.cellCenter(c));
  const e = { kind: def.type, root: model.root, alive: true, seg: 0, t: 0, stunTime: 0 };
  e.root.position.copy(points[0]);
  e.update = (dt) => {
    if (!e.alive) return;
    if (e.stunTime > 0) {
      e.stunTime -= dt;
      e.root.rotation.z = Math.sin(e.stunTime * 20) * 0.15;
      if (model.stars) {
        model.stars.visible = e.stunTime > 0;
        model.stars.rotation.y += dt * 6;
      }
      return;
    }
    e.root.rotation.z = 0;
    animate(dt);
    const a = points[e.seg];
    const b = points[(e.seg + 1) % points.length];
    e.t += (def.speed * dt) / Math.max(0.01, a.distanceTo(b));
    if (e.t >= 1) {
      e.t = 0;
      e.seg = (e.seg + 1) % points.length;
    }
    e.root.position.lerpVectors(a, b, Math.min(1, e.t));
    turnTowards(e.root, Math.atan2(b.x - a.x, b.z - a.z), dt);
  };
  e.hits = (catPos) => e.alive && e.stunTime <= 0 && touching(catPos, e.root.position);
  e.center = () => e.root.position.clone().add(new THREE.Vector3(0, 0.3, 0));
  e.onYarn = () => {
    if (def.type === 'hedgehog') {
      e.stun(3.5);
      return 'stun';
    }
    return 'defeat';
  };
  /** Freezes the enemy for `seconds` (yarn on hedgehogs, Luna's flash). */
  e.stun = (seconds) => {
    e.stunTime = Math.max(e.stunTime, seconds);
  };
  return e;
}

function dustBunny(def, ctx) {
  const m = createDustBunny();
  return patrol(def, ctx, m, (dt) => animateDustBunny(m, dt));
}

function hedgehog(def, ctx) {
  const m = createHedgehog();
  let time = 0;
  return patrol(def, ctx, m, (dt) => {
    time += dt;
    m.body.position.y = 0.2 + Math.abs(Math.sin(time * 14)) * 0.04;
    m.body.rotation.x = Math.sin(time * 14) * 0.08;
  });
}

/** Hovering ghost that chases the kitten when she comes close, then drifts home. */
function wisp(def, ctx) {
  const m = createWisp();
  const e = { kind: 'wisp', root: m.root, alive: true, cell: [...def.home], next: null, t: 0, time: 0, stunTime: 0 };
  const hover = (cell) => ctx.cellCenter(cell).add(new THREE.Vector3(0, 0.45, 0));
  const baseGlow = m.ghostMat.emissiveIntensity;
  e.root.position.copy(hover(e.cell));
  const chooseNext = () => {
    const catCell = ctx.catCell();
    const toCat = stepPath(ctx.level, ctx.state, e.cell, catCell);
    if (toCat && toCat.length - 1 <= def.radius && toCat.length > 1) return toCat[1];
    if (sameCell(e.cell, def.home)) return null;
    const home = stepPath(ctx.level, ctx.state, e.cell, def.home);
    return home && home.length > 1 ? home[1] : null;
  };
  e.update = (dt) => {
    if (!e.alive) return;
    e.time += dt;
    m.body.position.y = Math.sin(e.time * 3) * 0.08;
    if (e.stunTime > 0) {
      // dazed: frozen in place, dim and flickering
      e.stunTime -= dt;
      m.ghostMat.opacity = 0.25 + Math.abs(Math.sin(e.time * 22)) * 0.2;
      m.ghostMat.emissiveIntensity = 0.25;
      m.body.rotation.z = Math.sin(e.time * 18) * 0.2;
      return;
    }
    m.ghostMat.emissiveIntensity = baseGlow;
    m.body.rotation.z = 0;
    m.ghostMat.opacity = 0.7 + Math.sin(e.time * 9) * 0.15;
    if (!e.next) {
      e.next = chooseNext();
      e.t = 0;
      if (!e.next) return;
    }
    const a = hover(e.cell);
    const b = hover(e.next);
    e.t += (def.speed * dt) / Math.max(0.01, a.distanceTo(b));
    e.root.position.lerpVectors(a, b, Math.min(1, e.t));
    turnTowards(e.root, Math.atan2(b.x - a.x, b.z - a.z), dt, 6);
    if (e.t >= 1) {
      e.cell = e.next;
      e.next = null;
    }
  };
  e.hits = (catPos) =>
    e.alive && e.stunTime <= 0 && touching(catPos.clone().add(new THREE.Vector3(0, 0.45, 0)), e.root.position);
  e.center = () => e.root.position.clone();
  e.onYarn = () => 'defeat';
  /** Freezes the wisp for `seconds`: it stops chasing and cannot hurt the kitten. */
  e.stun = (seconds) => {
    e.stunTime = Math.max(e.stunTime, seconds);
  };
  return e;
}

/** Snowman that rolls snowballs down a lane at a fixed rhythm. */
function snowman(def, ctx) {
  const m = createSnowman();
  const e = { kind: 'snowman', root: m.root, alive: true, timer: def.interval * 0.5, balls: [] };
  const base = ctx.cellCenter(def.at);
  e.root.position.copy(base);
  e.root.rotation.y = Math.atan2(def.dir[0], def.dir[1]);
  const h = heightAt(ctx.level, ctx.state, ...def.at);

  const spawn = () => {
    const mesh = createSnowball();
    const cell = [def.at[0] + def.dir[0], def.at[1] + def.dir[1]];
    mesh.position.copy(base).add(new THREE.Vector3(def.dir[0] * 0.5, 0.17, def.dir[1] * 0.5));
    ctx.group.add(mesh);
    e.balls.push({ mesh, cell, falling: 0 });
    ctx.audio.snowThrow();
  };
  const destroy = (ball, smash = true) => {
    ctx.group.remove(ball.mesh);
    if (smash) ctx.effects.burst({ pos: ball.mesh.position.clone(), count: 10, colors: ['#ffffff', '#dff4ff'], speed: 1.6, up: 1.5, additive: false, size: 0.18, life: 0.5 });
    e.balls.splice(e.balls.indexOf(ball), 1);
  };

  e.update = (dt) => {
    for (const ball of [...e.balls]) {
      if (ball.falling > 0) {
        ball.falling -= dt;
        ball.mesh.position.y -= dt * 6;
        if (ball.falling <= 0) destroy(ball, false);
        continue;
      }
      const target = ctx.cellCenter(ball.cell) ?? null;
      const step = 3.2 * dt;
      ball.mesh.position.x += def.dir[0] * step;
      ball.mesh.position.z += def.dir[1] * step;
      ball.mesh.rotation.x += def.dir[1] * step * 6;
      ball.mesh.rotation.z -= def.dir[0] * step * 6;
      const passed = target && (ball.mesh.position.x - target.x) * def.dir[0] + (ball.mesh.position.z - target.z) * def.dir[1] >= 0;
      if (passed) {
        const next = [ball.cell[0] + def.dir[0], ball.cell[1] + def.dir[1]];
        const hn = heightAt(ctx.level, ctx.state, ...next);
        if (hn === null || hn < h) {
          ball.cell = next;
          ball.falling = 0.8;
        } else if (hn > h || isBlocked(ctx.level, ctx.state, next)) destroy(ball);
        else ball.cell = next;
      }
    }
    if (!e.alive) return;
    e.timer -= dt;
    e.root.scale.y = 1 + Math.max(0, 0.3 - e.timer) * 0.3;
    if (e.timer <= 0) {
      e.timer = def.interval;
      spawn();
    }
  };
  e.hits = (catPos) => {
    for (const ball of e.balls) {
      if (ball.falling <= 0 && touching(catPos.clone().add(new THREE.Vector3(0, 0.17, 0)), ball.mesh.position, 0.45)) {
        destroy(ball);
        return true;
      }
    }
    return false;
  };
  e.center = () => e.root.position.clone().add(new THREE.Vector3(0, 0.6, 0));
  e.onYarn = () => 'defeat';
  e.dispose = () => [...e.balls].forEach((b) => destroy(b, false));
  return e;
}

const FACTORIES = { dust: dustBunny, hedgehog, wisp };

/** Creates every enemy of a level. `ctx` exposes level, state, cellCenter, catCell, group, effects, audio. */
export function createEnemies(def, ctx) {
  const list = (def.enemies ?? []).map((d) => FACTORIES[d.type](d, ctx));
  for (const s of def.snowmen ?? []) list.push(snowman(s, ctx));
  list.forEach((e) => ctx.group.add(e.root));
  return list;
}
