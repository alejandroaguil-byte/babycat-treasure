// Level 2 — windy autumn cliffs. Adds wind gusts that push the kitten (rocks give
// shelter, edges are deadly), a fast hedgehog, a key that opens a gate and fish treats.
export default {
  id: 2,
  theme: 'autumn',
  map: [
    '1111.222.3',
    '.1.1.22223',
    '21...222..',
    '.1...2222.',
    '21..1111..',
    '111.1111..',
    '11111111..',
    '111.1111..',
    '111.1111..',
  ],
  companions: [{ id: 'bruno', at: [0, 5] }],
  start: [1, 7],
  milk: [9, 0],
  ladders: [
    { a: [6, 4], b: [6, 3] },
    { a: [8, 1], b: [9, 1] },
  ],
  keys: [[0, 0]],
  gates: [[3, 6]],
  fish: [[2, 0]],
  gems: [[3, 1], [8, 3], [6, 7]],
  coins: [
    [1, 6], [2, 5], [1, 3], [1, 1], [3, 0],
    [4, 7], [7, 6], [5, 2], [6, 1], [7, 2], [8, 1],
  ],
  sprouts: [[2, 8], [0, 6]],
  enemies: [
    { type: 'hedgehog', path: [[4, 5], [7, 5], [7, 8], [4, 8]], speed: 2.4 },
    { type: 'dust', path: [[5, 0], [7, 0]], speed: 1.4 },
  ],
  weather: { wind: { dir: [1, 0], calm: 4.5, warning: 1.3, gust: 1.7 }, leaves: true },
  decor: [
    { type: 'rock', at: [0, 2] },
    { type: 'rock', at: [0, 4] },
    { type: 'tree', at: [0, 8] },
    { type: 'tree', at: [7, 4] },
    { type: 'pumpkin', at: [5, 6] },
    { type: 'stump', at: [2, 7] },
  ],
};
