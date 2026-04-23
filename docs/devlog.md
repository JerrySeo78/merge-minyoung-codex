# Devlog

## 2026-04-20

- Started from a pasted prior Codex conversation and copied the existing prototype from `F:\Personal_project\codex_test` into this project.
- Established `F:\Personal_project\Hive_Garden_codex` as the current project root.
- Added project memory files: `AGENTS.md`, `docs/product.md`, `docs/devlog.md`, and decision notes.
- Restored Korean UI labels and growth text that were corrupted during the copy.

## 2026-04-23

- Reframed the puzzle board into a portrait-first honeycomb layout with hex cells.
- Replaced drag swapping with tap-to-select adjacent swap input for more reliable one-handed mobile play.
- Added an in-board nectar dispenser button that injects three matching drops into the hive.
- Introduced synthesized Web Audio effects for tap, swap, match, growth, dispenser, and hatch moments.
- Upgraded tile art direction with richer SVG icons and added stronger merge beam/core particle feedback.
- Reworked the prototype again into a true drag-and-drop merge game with mostly empty hex floor cells.
- Removed the egg hatch direction and replaced the top stage with a roaming Brown mascot panel.
- Added level-based item progression SVGs and dispenser-driven item spawning.

## Prior Prototype Summary

- Created a static HTML/CSS/JS vertical mobile match-3 MVP.
- Added a 7x7 board with drag-based block swaps.
- Renamed puzzle pieces to "블록".
- Changed blocks to circular tokens with smoother movement.
- Added match particles, rings, board feedback, and habitat sparkles.
- Added growth energy that flies from matched blocks to habitat positions.
- Expanded habitat progression to 30 stages.
- Added combo rewards that unlock up to 4 habitat elements at once.
- Added dense fill layer with 120 small nature elements.
- Added stage 29 rear backdrop with leaves and vines.
- Kept egg and hatchling in the front visual layer.
- Fixed a stage 30 crash caused by missing stage text.
