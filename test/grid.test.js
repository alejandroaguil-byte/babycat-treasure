import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, findPath, canStep, heightAt } from '../src/game/grid.js';
import { LEVEL_1 } from '../src/game/levelData.js';

const level = parseLevel(LEVEL_1);

test('the milk is unreachable until the bridge is raised', () => {
  assert.equal(findPath(level, { bridgeUp: false }, LEVEL_1.start, LEVEL_1.milk), null);
  const path = findPath(level, { bridgeUp: true }, LEVEL_1.start, LEVEL_1.milk);
  assert.ok(path, 'expected a path once the bridge is up');
  assert.deepEqual(path[0], LEVEL_1.start);
  assert.deepEqual(path.at(-1), LEVEL_1.milk);
});

test('the button and every gem are reachable once the bridge is up', () => {
  assert.ok(findPath(level, { bridgeUp: false }, LEVEL_1.start, LEVEL_1.button));
  for (const gem of LEVEL_1.gems) {
    assert.ok(findPath(level, { bridgeUp: true }, LEVEL_1.start, gem), `gem ${gem} unreachable`);
  }
});

test('height changes require a ladder', () => {
  // (1,5) -> (1,4) has a ladder, (2,5) -> (2,4) does not.
  assert.equal(canStep(level, { bridgeUp: false }, [1, 5], [1, 4]), true);
  assert.equal(canStep(level, { bridgeUp: false }, [2, 5], [2, 4]), false);
});

test('blocking decor and void cells cannot be entered', () => {
  const hedge = LEVEL_1.decor.find((d) => d.type === 'hedge').at;
  assert.equal(findPath(level, { bridgeUp: true }, LEVEL_1.start, hedge), null);
  assert.equal(heightAt(level, { bridgeUp: false }, 4, 2), null);
  assert.equal(heightAt(level, { bridgeUp: true }, 4, 2), 2);
});

test('paths are shortest and made of single steps', () => {
  const path = findPath(level, { bridgeUp: false }, [1, 7], [3, 7]);
  assert.deepEqual(path, [[1, 7], [2, 7], [3, 7]]);
});
