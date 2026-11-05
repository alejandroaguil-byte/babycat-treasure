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
npm test         # grid / pathfinding tests
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

## Level 1 — The Milk Tower

- Press the red switch hidden at the back of the upper garden to raise a bridge.
- One gem hides behind the hedges: rotate the camera to spot it.
- A dust bunny patrols the lower garden. Pluck a yarn ball from a sprout and throw it.
- Climb the tower and drink the milk to complete the mission.

## Structure

| Path | Purpose |
| --- | --- |
| `src/game/` | Pure level data and grid/pathfinding logic (tested in Node) |
| `src/world/` | three.js models (kitten, enemy, props) and level construction |
| `src/audio.js` | Procedural Web Audio music and sound effects (no audio files) |
| `src/effects.js` | Particles: sparkles, dust, confetti, rings |
| `src/main.js` | Game loop, input, camera, gameplay and cutscenes |
