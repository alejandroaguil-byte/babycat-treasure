import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLevel, createState, findPath, canStep, heightAt, moveSequence,
  windPush, reachableCells, stepPath, cellKey,
} from '../src/game/grid.js';
import { LEVELS } from '../src/game/levels/index.js';

const full = (def) => {
  const s = createState();
  s.gateOpen = true;
  (def.bridges ?? []).forEach((b) => s.raised.add(b.trigger));
  return s;
};

for (const def of LEVELS) {
  const level = parseLevel(def);
  const can = (state, cell) => reachableCells(level, state, def.start).has(cellKey(...cell));

  test(`level ${def.id}: rows have equal width and surfaces match the map`, () => {
    def.map.forEach((row) => assert.equal(row.length, level.width));
    (def.surface ?? []).forEach((row) => assert.equal(row.length, level.width));
    if (def.surface) assert.equal(def.surface.length, level.depth);
  });

  test(`level ${def.id}: the milk needs every trigger and the gate`, () => {
    const hasLocks = (def.bridges ?? []).length || (def.gates ?? []).length;
    if (hasLocks) assert.equal(findPath(level, createState(), def.start, def.milk), null);
    const path = findPath(level, full(def), def.start, def.milk);
    assert.ok(path, 'milk unreachable with everything unlocked');
    assert.deepEqual(path[0], def.start);
    assert.deepEqual(path.at(-1), def.milk);
  });

  test(`level ${def.id}: no resting spot is a dead end (no soft-locks)`, () => {
    for (const [state, goal] of [[createState(), def.start], [full(def), def.milk]]) {
      for (let z = 0; z < level.depth; z++) {
        for (let x = 0; x < level.width; x++) {
          if (!findPath(level, state, def.start, [x, z])) continue;
          assert.ok(findPath(level, state, [x, z], goal), `stuck at ${x},${z}`);
        }
      }
    }
  });

  test(`level ${def.id}: objectives are reachable in order`, () => {
    const s0 = createState();
    for (const k of def.keys ?? []) assert.ok(can(s0, k), `key ${k}`);
    const s1 = createState();
    s1.gateOpen = true;
    if (def.switch) assert.ok(can(def.keys ? s1 : s0, def.switch), 'switch');
    for (const f of def.fireflies ?? []) assert.ok(can(s1, f), `firefly ${f}`);
    const s2 = full(def);
    for (const list of ['gems', 'coins', 'fish', 'cocoa', 'sprouts']) {
      for (const c of def[list] ?? []) assert.ok(can(s2, c), `${list} ${c}`);
    }
  });
}

const L1 = parseLevel(LEVELS[0]);
const L3 = parseLevel(LEVELS[2]);
const L4 = parseLevel(LEVELS[3]);

test('height changes require a ladder', () => {
  assert.equal(canStep(L1, createState(), [1, 5], [1, 4]), true);
  assert.equal(canStep(L1, createState(), [2, 5], [2, 4]), false);
});

test('bridges only exist once their trigger is raised', () => {
  const s = createState();
  assert.equal(heightAt(L1, s, 4, 2), null);
  s.raised.add('switch');
  assert.equal(heightAt(L1, s, 4, 2), 2);
});

test('a closed gate blocks the way', () => {
  const L2 = parseLevel(LEVELS[1]);
  const s = createState();
  assert.equal(canStep(L2, s, [2, 6], [3, 6]), false);
  s.gateOpen = true;
  assert.equal(canStep(L2, s, [2, 6], [3, 6]), true);
});

test('paths are shortest and made of single steps', () => {
  assert.deepEqual(findPath(L1, createState(), [1, 7], [3, 7]), [[1, 7], [2, 7], [3, 7]]);
});

test('ice slides until something stops the kitten', () => {
  // (4,8) -> east onto the lake, stopped by the rock at (9,8).
  assert.deepEqual(moveSequence(L4, createState(), [4, 8], [1, 0]), [[5, 8], [6, 8], [7, 8], [8, 8]]);
  // leaving the ice onto snow stops the slide
  assert.deepEqual(moveSequence(L4, createState(), [6, 8], [-1, 0]), [[5, 8], [4, 8]]);
});

test('wet tiles slide exactly one extra tile', () => {
  assert.deepEqual(moveSequence(L3, createState(), [2, 6], [0, 1]), [[2, 7], [2, 8]]);
  assert.deepEqual(moveSequence(L3, createState(), [1, 7], [1, 0]), [[2, 7], [3, 7]]);
});

test('wind pushes exposed kittens, shelters protect, edges make them fall', () => {
  const L2 = parseLevel(LEVELS[1]);
  const s = createState();
  const east = [1, 0];
  assert.deepEqual(windPush(L2, s, [1, 1], east), { fall: true }); // exposed ridge
  assert.equal(windPush(L2, s, [1, 2], east), null); // rock upwind
  assert.deepEqual(windPush(L2, s, [0, 0], east), { to: [1, 0] });
  assert.deepEqual(windPush(L2, s, [5, 3], east), { to: [6, 3] }); // void upwind gives no shelter
});

test('chasers walk single steps', () => {
  const path = stepPath(L3, createState(), [5, 7], [1, 9]);
  assert.ok(path && path.length >= 5);
});

test('a companion standing upwind shelters the kitten from the wind', () => {
  const L2 = parseLevel(LEVELS[1]);
  assert.equal(windPush(L2, createState(), [1, 1], [1, 0], [[0, 1]]), null);
});

test('without companions the wind behaves exactly as before', () => {
  const L2 = parseLevel(LEVELS[1]);
  const s = createState();
  assert.deepEqual(windPush(L2, s, [1, 1], [1, 0]), { fall: true });
  assert.deepEqual(windPush(L2, s, [1, 1], [1, 0], []), { fall: true });
});

test('a companion that is not upwind gives no shelter', () => {
  const L2 = parseLevel(LEVELS[1]);
  assert.deepEqual(windPush(L2, createState(), [1, 1], [1, 0], [[1, 0], [2, 1], [1, 2]]), { fall: true });
});
