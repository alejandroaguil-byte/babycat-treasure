import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Trail, Follower, nearestReachable } from '../src/mechanics/companions.js';
import { parseLevel, createState } from '../src/game/grid.js';
import { LEVELS } from '../src/game/levels/index.js';

test('Trail records cells and target(1) is the previous cell', () => {
  const t = new Trail([0, 0]);
  t.record([1, 0]);
  t.record([2, 0]);
  assert.deepEqual(t.target(1), [1, 0]);
  assert.deepEqual(t.target(2), [0, 0]);
});

test('Trail ignores consecutive repeats of the last cell', () => {
  const t = new Trail([0, 0]);
  t.record([1, 0]);
  t.record([1, 0]);
  assert.deepEqual(t.target(1), [0, 0]);
});

test('Trail falls back to the oldest known cell', () => {
  const t = new Trail([0, 0]);
  t.record([1, 0]);
  assert.deepEqual(t.target(5), [0, 0]);
});

test('Trail caps its history at maxLength', () => {
  const t = new Trail([0, 0], 3);
  for (let x = 1; x <= 5; x++) t.record([x, 0]);
  assert.deepEqual(t.target(10), [3, 0]);
});

test('Trail reset forgets the history', () => {
  const t = new Trail([0, 0]);
  t.record([1, 0]);
  t.reset([4, 4]);
  assert.deepEqual(t.target(1), [4, 4]);
});

const L1 = parseLevel(LEVELS[0]);

test('nearestReachable picks the closest cell by path, not by straight distance', () => {
  // [3,4] is one tile away in a straight line but sits on a cliff reached by the ladder at x=1.
  assert.deepEqual(nearestReachable(L1, createState(), [3, 5], [[3, 4], [3, 7]]), [3, 7]);
});

test('nearestReachable breaks ties by input order', () => {
  assert.deepEqual(nearestReachable(L1, createState(), [3, 7], [[2, 7], [4, 7]]), [2, 7]);
});

test('nearestReachable returns null when nothing is reachable', () => {
  // [4,2] is a lowered bridge and [5,0] is empty space.
  assert.equal(nearestReachable(L1, createState(), [1, 7], [[4, 2], [5, 0]]), null);
});

const stubModel = () => ({ root: new THREE.Group(), state: null, setState(s) { this.state = s; }, animate() {} });
const center = ([x, z]) => new THREE.Vector3(x, 1, z);

test('Follower walks cell by cell along the trail and never onto the leader', () => {
  const trail = new Trail([0, 0]);
  const model = stubModel();
  const f = new Follower({ model, cell: [0, 0], cellCenter: center });
  for (const c of [[1, 0], [1, 1], [2, 1], [3, 1]]) trail.record(c);
  const visited = [[0, 0]];
  for (let i = 0; i < 200; i++) {
    f.update(0.02, trail);
    const c = f.cell;
    if (!visited.some((v) => v[0] === c[0] && v[1] === c[1])) visited.push([...c]);
    assert.notDeepEqual(c, [3, 1]);
  }
  assert.deepEqual(visited, [[0, 0], [1, 0], [1, 1], [2, 1]]);
  assert.equal(model.state, 'idle');
});

test('Follower stays put while the leader walks back over it, then follows again', () => {
  const trail = new Trail([0, 0]);
  const model = stubModel();
  const f = new Follower({ model, cell: [1, 0], cellCenter: center });
  trail.record([1, 0]);
  trail.record([2, 0]); // leader ahead, follower one step behind
  trail.record([1, 0]); // leader turns back onto the follower's cell
  for (let i = 0; i < 100; i++) {
    f.update(0.02, trail);
    assert.deepEqual(f.cell, [1, 0]);
  }
  trail.record([0, 0]); // leader moves on past it
  for (let i = 0; i < 100; i++) {
    f.update(0.02, trail);
    assert.deepEqual(f.cell, [1, 0]); // already one step behind: no shuffle
  }
  trail.record([0, 1]);
  for (let i = 0; i < 100; i++) f.update(0.02, trail);
  assert.deepEqual(f.cell, [0, 0]);
});

test('Follower teleport snaps the model and adds hover height', () => {
  const model = stubModel();
  const f = new Follower({ model, cell: [0, 0], cellCenter: center, hover: 0.5 });
  f.teleport([2, 3]);
  assert.deepEqual(f.cell, [2, 3]);
  assert.deepEqual(model.root.position.toArray(), [2, 1.5, 3]);
});
