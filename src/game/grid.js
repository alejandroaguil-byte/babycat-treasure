// Pure grid logic: walkability, ladders, bridges and shortest paths.
// No three.js here so it can be tested in Node.

export const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const BLOCKING_DECOR = new Set(['tree', 'hedge', 'rock']);

export const cellKey = (x, z) => `${x},${z}`;
const edgeKey = (a, b) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;
export const sameCell = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

export function parseLevel(def) {
  const heights = def.map.map((row) => [...row].map((ch) => (ch === '.' ? null : Number(ch))));
  const blocked = new Set(
    def.decor.filter((d) => BLOCKING_DECOR.has(d.type)).map((d) => cellKey(...d.at)),
  );
  const ladderSet = new Set(def.ladders.flatMap(({ a, b }) => [edgeKey(a, b), edgeKey(b, a)]));
  const bridges = new Map(def.bridges.map((b) => [cellKey(b.x, b.z), b]));
  return {
    def,
    width: heights[0].length,
    depth: heights.length,
    heights,
    blocked,
    ladderSet,
    bridges,
  };
}

export function heightAt(level, state, x, z) {
  if (x < 0 || z < 0 || x >= level.width || z >= level.depth) return null;
  const bridge = level.bridges.get(cellKey(x, z));
  if (bridge) return state.bridgeUp ? bridge.h : null;
  return level.heights[z][x];
}

export function isWalkable(level, state, [x, z]) {
  return heightAt(level, state, x, z) !== null && !level.blocked.has(cellKey(x, z));
}

export function isLadder(level, a, b) {
  return level.ladderSet.has(edgeKey(a, b));
}

export function canStep(level, state, a, b) {
  if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;
  if (!isWalkable(level, state, a) || !isWalkable(level, state, b)) return false;
  const ha = heightAt(level, state, ...a);
  const hb = heightAt(level, state, ...b);
  return ha === hb || isLadder(level, a, b);
}

export function neighbors(level, state, cell) {
  return DIRS.map(([dx, dz]) => [cell[0] + dx, cell[1] + dz]).filter((n) =>
    canStep(level, state, cell, n),
  );
}

/** Breadth-first shortest path. Returns [from, ..., to] or null. */
export function findPath(level, state, from, to) {
  if (!isWalkable(level, state, to) || !isWalkable(level, state, from)) return null;
  const startKey = cellKey(...from);
  const goalKey = cellKey(...to);
  const prev = new Map([[startKey, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    const curKey = cellKey(...cur);
    if (curKey === goalKey) {
      const path = [];
      for (let k = curKey, c = cur; c; ) {
        path.unshift(c);
        const p = prev.get(k);
        c = p;
        k = p ? cellKey(...p) : null;
      }
      return path;
    }
    for (const n of neighbors(level, state, cur)) {
      const k = cellKey(...n);
      if (!prev.has(k)) {
        prev.set(k, cur);
        queue.push(n);
      }
    }
  }
  return null;
}
