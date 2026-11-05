// Companion behaviors: following Mochi along her trail, Pip's perch and hint
// flights, and the pure helpers they rely on. Trail and nearestReachable are
// pure; the controllers move three.js objects but never touch the DOM.
import * as THREE from 'three';
import { findPath, sameCell } from '../game/grid.js';

const copy = (cell) => [cell[0], cell[1]];
const damp = (cur, target, lambda, dt) => THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-lambda * dt));
const turnTowards = (obj, yaw, dt, speed = 10) => {
  let diff = yaw - obj.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  obj.rotation.y += diff * (1 - Math.exp(-speed * dt));
};

/** The last cells the leader settled on, oldest first. PURE. */
export class Trail {
  constructor(start, maxLength = 6) {
    this.maxLength = Math.max(2, maxLength);
    this.cells = [copy(start)];
  }

  /** Call each time the leader settles on a new cell; consecutive repeats are ignored. */
  record(cell) {
    if (sameCell(this.cells.at(-1), cell)) return;
    this.cells.push(copy(cell));
    if (this.cells.length > this.maxLength) this.cells.shift();
  }

  /** Index into `cells` that is `stepsBehind` steps behind the latest cell (clamped to the oldest). */
  targetIndex(stepsBehind) {
    return Math.max(0, this.cells.length - 1 - stepsBehind);
  }

  /** Cell `stepsBehind` steps behind the leader (1 = previous cell), or the oldest known cell. */
  target(stepsBehind) {
    return copy(this.cells[this.targetIndex(stepsBehind)]);
  }

  /** The leader's current cell. */
  get latest() {
    return copy(this.cells.at(-1));
  }

  reset(cell) {
    this.cells = [copy(cell)];
  }
}

/** The cell of `cells` with the shortest path from `from` (ties: input order), or null. PURE. */
export function nearestReachable(level, state, from, cells) {
  let best = null;
  let bestLength = Infinity;
  for (const cell of cells) {
    const path = findPath(level, state, from, cell);
    if (path && path.length < bestLength) {
      best = copy(cell);
      bestLength = path.length;
    }
  }
  return best;
}

const WALK_SPEED = 2.6;
const MAX_SPEED = 6;

/** Walks a companion model cell by cell along the leader's trail. */
export class Follower {
  constructor({ model, cell, cellCenter, stepsBehind = 1, hover = 0 }) {
    this.model = model;
    this.cellCenter = cellCenter;
    this.stepsBehind = stepsBehind;
    this.hover = hover;
    this.teleport(cell);
  }

  /** The companion's logical cell: the last cell it reached. */
  get cell() {
    return copy(this.from);
  }

  /** World position of a cell for this companion (including its hover height). */
  place(cell) {
    const p = this.cellCenter(cell).clone();
    p.y += this.hover;
    return p;
  }

  teleport(cell) {
    this.from = copy(cell);
    this.next = null;
    this.t = 0;
    this.model.root.position.copy(this.place(cell));
  }

  /** Next trail cell on the way to the target, or null to wait. */
  chooseNext(trail) {
    const cells = trail.cells;
    const goal = trail.targetIndex(this.stepsBehind);
    let i = -1;
    for (let k = goal; k >= 0; k--) {
      if (sameCell(cells[k], this.from)) {
        i = k;
        break;
      }
    }
    // Off the remembered trail (left far behind): rejoin at the oldest cell.
    if (i < 0) return { cell: cells[0], behind: goal + 1, jump: true };
    if (i >= goal) return null;
    return { cell: cells[i + 1], behind: goal - i };
  }

  update(dt, trail) {
    const root = this.model.root;
    // While the leader stands on (or hops over) this companion, it holds still instead of swapping places.
    if (!this.next && !sameCell(this.from, trail.latest)) {
      const step = this.chooseNext(trail);
      if (step && sameCell(step.cell, trail.latest)) {
        this.next = null; // never walk onto the leader; wait for her to move on
      } else if (step?.jump) {
        this.teleport(step.cell);
      } else if (step) {
        this.next = copy(step.cell);
        this.behind = step.behind;
        this.t = 0;
      }
    }

    if (this.next) {
      const a = this.place(this.from);
      const b = this.place(this.next);
      const speed = this.behind >= 2 ? Math.min(MAX_SPEED, WALK_SPEED + (this.behind - 1) * 1.2) : WALK_SPEED;
      this.t += (speed * dt) / Math.max(0.01, a.distanceTo(b));
      root.position.lerpVectors(a, b, Math.min(1, this.t));
      turnTowards(root, Math.atan2(b.x - a.x, b.z - a.z), dt);
      this.model.setState('walk');
      if (this.t >= 1) {
        this.from = this.next;
        this.next = null;
        this.t = 0;
      }
    } else {
      // idle: look at the leader
      const here = this.place(this.from);
      const lead = this.place(trail.latest);
      if (!sameCell(this.from, trail.latest)) turnTowards(root, Math.atan2(lead.x - here.x, lead.z - here.z), dt, 4);
      root.position.copy(here);
      this.model.setState('idle');
    }
    this.model.animate(dt);
  }
}

const PERCH_HEIGHT = 0.95;
const PERCH_BACK = 0.22;
const FLY_SPEED = 4;
const CIRCLE_TIME = 2.5;
const CIRCLE_HEIGHT = 1.2;
const CIRCLE_RADIUS = 0.45;

/** Pip perches over Mochi's head and can fly off to point at something. */
export class PipController {
  constructor({ model }) {
    this.model = model;
    this.phase = 'perch';
    this.heading = new THREE.Vector3(0, 0, 1);
    this.lastMochi = null;
    this.time = 0;
    this.resolve = null;
  }

  get busy() {
    return this.phase !== 'perch';
  }

  perchPoint(mochiPos) {
    const p = mochiPos.clone().addScaledVector(this.heading, -PERCH_BACK);
    p.y += PERCH_HEIGHT + Math.sin(this.time * 3) * 0.03;
    return p;
  }

  /** Flies an arc to above `worldPos`, circles there, flies back and resolves. */
  sendTo(worldPos) {
    if (this.busy) return Promise.resolve();
    this.phase = 'out';
    this.goal = worldPos.clone();
    this.startArc();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Cancels a flight (restart or respawn) and snaps back to the perch. */
  reset(mochiPos) {
    this.phase = 'perch';
    this.finish();
    if (mochiPos) this.model.root.position.copy(this.perchPoint(mochiPos));
  }

  finish() {
    const done = this.resolve;
    this.resolve = null;
    done?.();
  }

  startArc() {
    this.arcFrom = this.model.root.position.clone();
    this.arcT = 0;
  }

  /** Point along an arc from `arcFrom` to `to`, `u` in [0, 1]. */
  arcPoint(to, u) {
    const p = new THREE.Vector3().lerpVectors(this.arcFrom, to, u);
    p.y += Math.sin(Math.PI * u) * Math.min(1.2, 0.35 + this.arcFrom.distanceTo(to) * 0.2);
    return p;
  }

  flyArc(dt, to) {
    const length = Math.max(0.5, this.arcFrom.distanceTo(to) * 1.15);
    this.arcT = Math.min(1, this.arcT + (FLY_SPEED * dt) / length);
    return this.arcPoint(to, this.arcT);
  }

  update(dt, mochiPos) {
    this.time += dt;
    const root = this.model.root;
    const before = root.position.clone();
    if (this.lastMochi) {
      const moved = mochiPos.clone().sub(this.lastMochi).setY(0);
      if (moved.lengthSq() > 1e-6) this.heading.lerp(moved.normalize(), 1 - Math.exp(-8 * dt)).normalize();
    }
    this.lastMochi = mochiPos.clone();

    if (this.phase === 'perch') {
      const target = this.perchPoint(mochiPos);
      const far = root.position.distanceTo(target);
      if (far > 4) root.position.copy(target);
      else {
        root.position.x = damp(root.position.x, target.x, 9, dt);
        root.position.y = damp(root.position.y, target.y, 9, dt);
        root.position.z = damp(root.position.z, target.z, 9, dt);
      }
      this.model.setState(far > 0.18 ? 'fly' : 'idle');
      turnTowards(root, Math.atan2(this.heading.x, this.heading.z), dt, 6);
    } else if (this.phase === 'out') {
      const over = this.goal.clone().add(new THREE.Vector3(CIRCLE_RADIUS, CIRCLE_HEIGHT, 0));
      root.position.copy(this.flyArc(dt, over));
      if (this.arcT >= 1) {
        this.phase = 'circle';
        this.circleT = 0;
      }
    } else if (this.phase === 'circle') {
      this.circleT += dt;
      const angle = (this.circleT / CIRCLE_TIME) * Math.PI * 4;
      root.position.set(
        this.goal.x + Math.cos(angle) * CIRCLE_RADIUS,
        this.goal.y + CIRCLE_HEIGHT + Math.sin(this.circleT * 5) * 0.08,
        this.goal.z + Math.sin(angle) * CIRCLE_RADIUS,
      );
      if (this.circleT >= CIRCLE_TIME) {
        this.phase = 'back';
        this.startArc();
      }
    } else if (this.phase === 'back') {
      root.position.copy(this.flyArc(dt, this.perchPoint(mochiPos)));
      if (this.arcT >= 1) {
        this.phase = 'perch';
        this.finish();
      }
    }

    if (this.phase !== 'perch') {
      this.model.setState('fly');
      const v = root.position.clone().sub(before);
      if (v.x * v.x + v.z * v.z > 1e-8) turnTowards(root, Math.atan2(v.x, v.z), dt, 12);
    }
    this.model.animate(dt);
  }
}
