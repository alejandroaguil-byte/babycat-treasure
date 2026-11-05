# Feature: visual polish + missing basics (v1.1)

Objective: raise the bar of the game. Phase 1 adds the visual leap (post-processing, outlines, adaptive quality). Phase 2 adds missing basics (pause, restart, settings, mobile UX, PWA, GitHub Pages).
Branch: `feat/polish` (from `main` at v1.0.0). Delivery: work-unit commits, push to main when done (authorized flow from v1.0.0). Test runner: `npm test` + headless Chrome smoke.

## Specs

- S1: "Que se vea mejor": post-processing with tilt-shift (miniature look), bloom on glowing things, vignette/grading; ambient occlusion only on high quality.
- S2: Cartoon identity: outlines on characters (kitten and enemies).
- S3: Adaptive quality so phones stay smooth: Auto/High/Medium/Low, with automatic downgrade when FPS is low.
- S4: "No hay menú de pausa ni botón para reiniciar el nivel. Tampoco hay ajustes de volumen o calidad." Add a pause menu (resume, restart, settings, levels), restart, and settings (music/SFX volume, quality, vibration), persisted.
- S5: Mobile: installable PWA that works offline, vibration on damage, bigger touch buttons (including a throw button).
- S6: "Publicarlo en GitHub Pages con deploy automático".
- S7: "Vamos en la dirección y orden que me indicas": phases 1 and 2 now; phase 3 (depth) comes next.

## Tasks

| ID | Specs | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| T1 | S1, S2, S3 | inline | done | screenshots at each quality level; sky pass fixes the tone-mapping desaturation |
| T2 | S4 | inline | done | headless: Esc pauses, settings persist, R restarts at start cell |
| T3 | S5 | inline | done | preview build: SW controls the page, manifest ok, offline reload renders level select |
| T4 | S6 | inline | blocked | workflow ready (deploy gated on public repo); API: "Your current plan does not support GitHub Pages for this repository." |

## Log

- L1 (2026-11-05): "Vamos en la dirección y orden que me indicas". The recommendation accepted: "empezar por el 1 junto con lo básico del 2 (pausa, reiniciar y GitHub Pages)... Después sigue el 3".
- L2: The scene background moves from a CSS gradient to a scene texture, because post-processing render targets drop canvas alpha.
- L3: GTAO dropped. It drew additive glow sprites as dark squares and is too heavy for phones. Bloom threshold raised to 1.0, because the bright sky was blooming into haze.
- L4: The sky looked desaturated through the pipeline: OutputPass tone-maps the sRGB background, which direct rendering skips. Fix: ToneMapping is now Neutral, and a final SkyShader pass composites the gradient after tone mapping (rgb + sky*(1-a)).
- L5: The Pages enable call returned HTTP 422: "Your current plan does not support GitHub Pages for this repository." Needs a decision from the user: make the repo public, or keep it private and only run CI.
- L6: Native review (lineage review-9e114e2e99ca19b6, lenses risk/resilience/reliability) was granted and APPROVED, then acknowledged. Its 13 advisory findings were verified against the code. 4 were not real: sfx is created before the volume block, init() resumes a suspended context, the cat is recreated per level, and tone() guards a missing ctx. 6 were fixed in a follow-up: workflow permissions scoped to the deploy job, a governor threshold of 26 fps (30 Hz phones keep their level), a pure governor module with tests, settings validation with tests, offline cache pruning of stale assets, saving on Esc from settings, and no rendering while paused. SHA pinning of actions was left as a suggestion.
- L7: Evidence: 27/27 tests. In the preview build, the SW caches assets, a planted stale asset gets pruned, the offline reload renders the level select, and the pause screen keeps the last frame.
- L8: Second native review (risk/resilience) was granted, APPROVED and acknowledged. Fixed its findings: pruning now removes only replaced hashed versions of the same file, only runs on our own page (no captive-portal wipe), and the canvas redraws after a quality change while paused. Verified in the preview build: old index pruned, lazy chunk kept, offline OK.
- L9: Pushed main (adbca70..10ff6ff). GitHub Actions run 42028609864: build job success (npm ci, 27 tests, build); deploy job skipped because the repo is private. T4 stays blocked until the user decides on repo visibility.
