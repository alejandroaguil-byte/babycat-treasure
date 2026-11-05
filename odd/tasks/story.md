# Feature: companions, narrative, dialogue voices and ES/EN language

Objective: add companion characters that take part in gameplay and talk with Mochi, a narrative across the four worlds, a distinct voice per character, and a Spanish/English language mode.
Branch: `feat/story` (from `main` at d55aa7b). Delivery: work-unit commits, then push to main (auto-deploys to Pages). Test runner: `npm test` (node:test) + headless Chrome smoke.

## Specs

- S1: "Me gustaría que el juego tuviera mas personajes aparte del gato, que participen en el desarrollo del juego e interactuen con el gato en cuánto a la jugabilidad." Companions: Pip the sparrow (all worlds, hint flight to the nearest gem, 3 uses per level), Bruno the tortoise (world 2, follows Mochi and blocks wind from his side), Luna the glow moth (world 3, flash stuns wisps, with cooldown), Pom the penguin (world 4, follows Mochi; a huddle warms her while idle next to him).
- S2: "Quiero también que el juego tenga narrativa, aqui te doy libertad de desarrollar la narrativa." Story: Lord Fluff, the Dust Bunny King, blew Grandma Hazel's four magic milk glasses across the islands; Mochi recovers them with her friends. Scenes at intro, key moments and outro of each world.
- S3: "La idea es que los personajes interactúen y también se hablen." Dialogue box with portrait, name, typewriter text, advance and skip; companions join through dialogue.
- S4: "deben poder hablar en español o ingles, asi que habria que desarrollar la modalidad de poner el juego en español o ingles." Full i18n (UI, toasts, menus, level titles, dialogue) with a language selector, persisted, defaulting to the device language.
- S5: "Los personajes al hablar entre ellos deben tener una voz particular cada uno." Per-character voice: spoken (Web Speech TTS, distinct pitch/rate/voice per character, in the selected language) or procedural "chirp" voice with a per-character timbre (offline fallback); setting: spoken / chirps / off.

## Tasks

| ID | Specs | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| T1 | S3, S5 | delegated (writer A, parallel unit) | done | 2537157; 7 story tests; headless dialogue smoke |
| T2 | S1 | delegated (writer B, parallel unit) | done | de731db; companion + shelter tests |
| T3 | S4 | delegated (writer C, context backstop) | done | i18n + settings tests; ES/EN smoke |
| T4 | S2 | delegated (writer C) | done | 18 scenes, script tests |
| T5 | S1-S5 | delegated (writer C) + parent docs | done | 59/59 tests; smoke in worlds 1-4 (Bruno follows, Luna stun, Pom hug, Pip uses) |

## Log

- L1 (2026-11-05): "mientras juego, hagamos otra cosa. Me gustaría que el juevo tuviera mas personajes aparte del gato, que participen en el desarrollo del juego e interactuen con el gato en cuánto a la jugabilidad. Quiero también que el juego tenga narrativa, aqui te doy libertad de desarrollar la narrativa. La idea es que los personajes interactúen y también se hablen. En cuanto a esto último, deben poder hablar en español o ingles, asi que habria que desarrollar la modalidad de poner el juego en español o ingles. Los personajes al hablar entre ellos deben tener una voz particular cada uno. Vamos con eso"
- L2: Route. T1 and T2 are independent units with disjoint edit surfaces and several hundred lines each, so writers run in parallel (writer trigger a). The parent owns git, main.js, index.html, i18n and the narrative.
- L3: T3-T5 were delegated to writer C (context backstop: the parent session was very long). The parent spot-checked 59/59 tests and the screenshots (the ES dialogue and Bruno following).
