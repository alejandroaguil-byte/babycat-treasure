# Feature: levels 2-4 with weather, new characters and collectibles

Objective: add three new levels with changing environments, gameplay-affecting weather, rising difficulty, new characters and new collectibles; fix the drinking pose.
Branch: `feat/levels-2-4` (from `feat/level-1`). Delivery: `ask-on-risk`, work-unit commits, no push/PR. Test runner: `npm test` (node:test) + headless Chrome smoke runs.

## Specs

- S1: "Desarrolla tres niveles más." Three new playable levels after level 1, each ending with the milk-glass reward.
- S2: "Que vayan cambiando el ambiente" Each level has its own environment (palette, sky, decor, lighting).
- S3: "que se vaya sumando condiciones atmosféricas que afecten la jugabilidad" Weather accumulates and changes gameplay: L2 wind gusts (push, falling off edges, shelters), L3 night storm (darkness + lantern, lightning, wet slippery tiles), L4 snow (ice sliding, blizzard whiteouts, cold meter).
- S4: "Que el nivel de dificultad vaya subiendo progresivamente" Larger layouts, more/faster hazards per level.
- S5: "que se vayan sumando nuevos personajes y nuevos ítems que colectar" New characters per level (L2 hedgehog, L3 will-o'-wisp chaser, L4 snowman throwing snowballs) and new items (L2 key + gate, fish treat; L3 fireflies; L4 hot cocoa, campfires).
- S6: "el gato al final se toma el vaso de leche pero al revés, con el vaso al revés." Fix the drinking pose so the glass is held rim-to-mouth with the bottom tipped up.
- S7: "Comitea y avanza" Commit in work units and continue without stopping.
- Assumption: level progression with "Next level", level select and saved progress in localStorage (needed to reach levels 2-4).

## Tasks

| ID | Specs | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| T1 | S6, S7 | inline | done | 5bcf2f1 (drink pose verified via screenshot) |
| T2 | S1, S2 | inline | done | multi-level engine, themes, level select, localStorage progress |
| T3 | S3, S5 | inline | done | grid slides/gates/triggers/windPush; 24 tests incl. no-soft-lock |
| T4 | S1-S5 | inline | done | L2 completed in headless run; gust knocked kitten off ridge (hearts 3->2) |
| T5 | S1-S5 | inline | done | L3 completed; wisp chased toward kitten |
| T6 | S1-S5 | inline | done | L4 completed after soft-lock fix; cold + snowball damage observed |

## Log

- L1 (2026-11-05): "Lo veo bien. Hay que avanzar en crear más niveles. Desarrolla tres niveles más. Que vayan cambiando el ambiente, que se vaya sumando condiciones atmosféricas que afecten la jugabilidad. Que el nivel de dificultad vaya subiendo progresivamente, que se vayan sumando nuevos personajes y nuevos ítems que colectar. Un detalle, el gato al final se toma el vaso de leche pero al revés, con el vaso al revés. Comitea y avanza"
- L2: T1 done. Glass tilt was -0.75 rad (bottom down, rim leaning into the face). Now it tips from -1.5 to -2.3 rad with the rim held at the mouth, and the milk pivot moved to the rim. Level 1 committed as 5bcf2f1. RDD assess: medium, under_budget.
- L3: Route: all tasks inline (sequential and dependent, sharing main.js, so no writer trigger).
- L4: T2-T6 done. Headless Chrome playthroughs reached the win screen in all 4 levels, with no page errors. Mechanics were checked without invulnerability: wind fall, wisp chase, cold damage, snowball hit.
- L5: Bug found by the playthrough: on the L4 ice lake, the gem at (10,6) trapped the kitten (every slide landed on another lake corner). Added a no-soft-lock test (RED: "stuck at 5,6") and a rock at (5,9) as the fix (GREEN, 24/24).
- L6: Removed firefly point lights to keep the phone GPU budget sane (sprites carry the glow).
