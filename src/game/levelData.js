// Level layout. Each character of `map` is a column height ('.' = empty).
// Rows are z (back to front), columns are x (left to right).
export const LEVEL_1 = {
  episode: 'Episode 1',
  title: 'The Milk Tower',
  map: [
    '2222..444',
    '2222.2222',
    '2222.2222',
    '2222.2222',
    '2222.2222',
    '1111.1111',
    '1111.1111',
    '111111111',
    '1111.1111',
  ],
  start: [1, 7],
  milk: [6, 0],
  button: [0, 0],
  ladders: [
    { a: [1, 5], b: [1, 4] },
    { a: [7, 1], b: [7, 0] },
  ],
  bridges: [{ x: 4, z: 2, h: 2 }],
  gems: [
    [7, 6],
    [3, 0],
    [8, 4],
  ],
  coins: [
    [2, 6], [3, 6], [3, 7], [4, 7],
    [0, 3], [1, 2], [2, 2],
    [5, 1], [6, 1], [6, 3], [5, 4],
    [6, 7],
  ],
  sprouts: [
    [2, 8],
    [0, 6],
  ],
  // Dust bunny patrol loop (cells, walked in order and repeated).
  enemyPath: [
    [5, 5], [8, 5], [8, 8], [5, 8],
  ],
  decor: [
    { type: 'tree', at: [3, 8] },
    { type: 'tree', at: [0, 8] },
    { type: 'hedge', at: [2, 1] },
    { type: 'hedge', at: [3, 1] },
    { type: 'rock', at: [7, 3] },
    { type: 'tree', at: [8, 1] },
    { type: 'rock', at: [0, 4] },
  ],
};
