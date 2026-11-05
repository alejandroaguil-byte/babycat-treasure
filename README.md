<img src="assets/icon.svg" width="64" height="64" alt="">

# Babycat Treasure

A cozy diorama puzzle game built with [three.js](https://threejs.org/). Guide **Mochi the kitten**
through a tiny floating world: kittens can't jump, so use ladders, switches and bridges, rotate the
camera to uncover secrets, collect the 3 gems and reach the reward at the end of every stage — a
well-earned glass of milk.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # grid logic + solvability/no-soft-lock checks for every level
npm run build    # production build in dist/
```

## Controls

| Action | Input |
| --- | --- |
| Walk to a tile | Click it |
| Step one tile | `WASD` / arrow keys (camera-relative) |
| Rotate camera | Drag, or `Q` / `E` |
| Zoom | Mouse wheel |
| Throw a yarn ball | `Space`, or click the dust bunny |
| Mute | `M` |

## Worlds

Each world adds new weather, characters and items on top of the previous ones. Progress
(unlocked worlds and best gem count) is saved in `localStorage`.

| # | World | Weather and terrain | Characters | Items |
| --- | --- | --- | --- | --- |
| 1 | The Milk Tower (meadow) | Sunny | Dust bunny | Gems, coins, yarn sprouts, switch bridge |
| 2 | Windy Autumn Cliffs | Wind gusts push Mochi one tile; exposed edges make her fall. Rocks upwind give shelter | Hedgehog (yarn only stuns it) | Key + gate, fish treat (+1 heart) |
| 3 | Stormy Night Garden | Darkness (Mochi carries a lantern), lightning, wet tiles slide one extra tile | Will-o'-wisp that chases Mochi | 5 fireflies raise the bridge to the tower |
| 4 | Snowy Peak | Ice slides until something stops Mochi, blizzards (strong wind + whiteout), cold meter | Snowmen rolling snowballs | Hot cocoa, campfires (warm up nearby) |

## Structure

| Path | Purpose |
| --- | --- |
| `src/game/` | Pure level data (`levels/`) and grid logic: pathfinding, slides, gates, wind (tested in Node) |
| `src/mechanics/` | Weather cycle and particles, enemy behaviours |
| `src/world/` | three.js models, themes per world and level construction |
| `src/audio.js` | Procedural Web Audio music and sound effects (no audio files) |
| `src/effects.js` | Particles: sparkles, dust, confetti, rings |
| `src/main.js` | Game loop, input, camera, gameplay and cutscenes |
