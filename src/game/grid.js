// Pure grid logic: walkability, ladders, bridges, gates, slippery surfaces and
// shortest paths. No three.js here so it can be tested in Node.

export const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const BLOCKING_DECOR = new Set(['tree', 'hedge', 'rock', 'pine', 'mushroom', 'lamp', 'stump', 'pumpkin']);
const MAX_SLIDE = 40;

export const cellKey = (x, z) => `${x},${z}`;
const edgeKey = (a, b) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;
export const sameCell = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

/** Mutable puzzle state of a level: raised triggers and the gate. */
export const createState = () => ({ raised: new Set(), gateOpen: false });

export function parseLevel(def) {
  const heights = def.map.map((row) => [...row].map((ch) => (ch === '.' ? null : Number(ch))));
  const surface = (def.surface ?? []).map((row) =>
    [...row].map((ch) => (ch === 'w' ? 'wet' : ch === 'i' ? 'ice' : null)),
  );
  const blockers = [
    ...(def.decor ?? []).filter((d) => BLOCKING_DECOR.has(d.type)).map((d) => d.at),
    ...(def.campfires ?? []),
    ...(def.snowmen ?? []).map((s) => s.at),
  ];
  const ladderSet = new Set((def.ladders ?? []).flatMap(({ a, b }) => [edgeKey(a, b), edgeKey(b, a)]));
  const bridges = new Map(
    (def.bridges ?? []).map((b) => [cellKey(b.x, b.z), { trigger: 'switch', ...b }]),
  );
  return {
    def,
    width: heights[0].length,
    depth: heights.length,
    heights,
    surface,
    blocked: new Set(blockers.map((c) => cellKey(...c))),
    gates: new Set((def.gates ?? []).map((c) => cellKey(...c))),
    ladderSet,
    bridges,
  };
}

export function inBounds(level, [x, z]) {
  return x >= 0 && z >= 0 && x < level.width && z < level.depth;
}

export function heightAt(level, state, x, z) {
  if (!inBounds(level, [x, z])) return null;
  const bridge = level.bridges.get(cellKey(x, z));
  if (bridge) return state.raised.has(bridge.trigger) ? bridge.h : null;
  return level.heights[z][x];
}

export function surfaceAt(level, [x, z]) {
  return level.surface[z]?.[x] ?? null;
}

export function isBlocked(level, state, [x, z]) {
  const k = cellKey(x, z);
  return level.blocked.has(k) || (level.gates.has(k) && !state.gateOpen);
}

export function isWalkable(level, state, cell) {
  return heightAt(level, state, ...cell) !== null && !isBlocked(level, state, cell);
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

/**
 * After entering `cell` from `from`, returns the cell the kitten is forced to
 * slide into, or null. Ice keeps sliding until blocked; wet tiles slide exactly
 * one extra tile (only when the tile was entered by a normal step).
 */
export function slideNext(level, state, from, cell, slid) {
  const kind = surfaceAt(level, cell);
  if (!kind || (kind === 'wet' && slid > 0)) return null;
  const next = [cell[0] * 2 - from[0], cell[1] * 2 - from[1]];
  const same = heightAt(level, state, ...next) === heightAt(level, state, ...cell);
  return same && canStep(level, state, cell, next) ? next : null;
}

/** All cells traversed when stepping from `cell` in `dir`, including slides. */
export function moveSequence(level, state, cell, dir) {
  const first = [cell[0] + dir[0], cell[1] + dir[1]];
  if (!canStep(level, state, cell, first)) return null;
  const seq = [first];
  let prev = cell;
  let cur = first;
  for (let slid = 0; slid < MAX_SLIDE; slid++) {
    const next = slideNext(level, state, prev, cur, slid);
    if (!next) break;
    seq.push(next);
    prev = cur;
    cur = next;
  }
  return seq;
}

/**
 * Breadth-first shortest path over resting cells (slides are forced).
 * Returns [from, ...every traversed cell..., to] or null.
 */
export function findPath(level, state, from, to) {
  if (!isWalkable(level, state, to) || !isWalkable(level, state, from)) return null;
  const goalKey = cellKey(...to);
  const prev = new Map([[cellKey(...from), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    const curKey = cellKey(...cur);
    if (curKey === goalKey) {
      const path = [];
      for (let k = curKey; k; ) {
        const entry = prev.get(k);
        if (!entry) {
          path.unshift(from);
          break;
        }
        path.unshift(...entry.seq);
        k = cellKey(...entry.from);
      }
      return path;
    }
    for (const dir of DIRS) {
      const seq = moveSequence(level, state, cur, dir);
      if (!seq) continue;
      const k = cellKey(...seq.at(-1));
      if (!prev.has(k)) {
        prev.set(k, { from: cur, seq });
        queue.push(seq.at(-1));
      }
    }
  }
  return null;
}

/** Cells reachable by single steps (used by chasing enemies, ignores slides). */
export function stepPath(level, state, from, to) {
  const goalKey = cellKey(...to);
  const prev = new Map([[cellKey(...from), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cellKey(...cur) === goalKey) {
      const path = [];
      for (let c = cur; c; c = prev.get(cellKey(...c))) path.unshift(c);
      return path;
    }
    for (const [dx, dz] of DIRS) {
      const n = [cur[0] + dx, cur[1] + dz];
      const k = cellKey(...n);
      if (!prev.has(k) && canStep(level, state, cur, n)) {
        prev.set(k, cur);
        queue.push(n);
      }
    }
  }
  return null;
}

/** Where a wind gust pushes the kitten: {to} | {fall: true} | null (holds on). */
export function windPush(level, state, cell, dir) {
  const upwind = [cell[0] - dir[0], cell[1] - dir[1]];
  const h = heightAt(level, state, ...cell);
  const hUp = heightAt(level, state, ...upwind);
  if (isBlocked(level, state, upwind) || (hUp !== null && hUp > h)) return null; // sheltered
  const to = [cell[0] + dir[0], cell[1] + dir[1]];
  const hTo = heightAt(level, state, ...to);
  if (hTo === null || hTo < h) return isBlocked(level, state, to) ? null : { fall: true };
  if (hTo === h && !isBlocked(level, state, to)) return { to };
  return null;
}

/** Every cell the kitten can pass through (including mid-slide cells). */
export function reachableCells(level, state, from) {
  const seen = new Set([cellKey(...from)]);
  const visited = new Set(seen);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const dir of DIRS) {
      const seq = moveSequence(level, state, cur, dir);
      if (!seq) continue;
      seq.forEach((c) => seen.add(cellKey(...c)));
      const k = cellKey(...seq.at(-1));
      if (!visited.has(k)) {
        visited.add(k);
        queue.push(seq.at(-1));
      }
    }
  }
  return seen;
}
