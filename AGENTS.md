# AGENTS.md

## Project

Hive Garden is a vertical mobile match-3 MVP inspired by the Empire & Puzzles board layout. The lower half is a 3-match puzzle board. The upper half is not combat; it is an egg habitat that grows as the player makes matches.

## Product Rules

- User-facing language is Korean.
- Call puzzle pieces "블록". Do not call them "타일" or "조각" in user-facing copy.
- The main loop is: drag a block, resolve a match, send growth energy upward, reveal habitat, hatch the egg.
- Match success should feel like energy feeding the habitat.
- Combos should unlock multiple habitat elements at once.
- The habitat should become dense and full before hatching, especially near the final stages.
- From stage 29 onward, the rear background should feel filled with leaves and vines.
- The egg and hatchling must always remain in the front visual layer. Habitat assets must not cover them.
- Hatching should focus attention on the egg: glow, tremble, pop, then reveal the hatchling.

## Implementation Rules

- Keep the MVP runnable by opening `index.html` directly in a browser.
- Use plain HTML, CSS, and JavaScript unless the user asks for a framework or build step.
- Keep gameplay logic in `game.js`.
- Keep visual layout and animation in `styles.css`.
- Store reusable SVG art assets under `assets/`.
- Prefer the existing SVG asset approach for prototype art unless there is a clear reason to move a layer to canvas or another format.
- Keep edits small and aligned with the current prototype structure.

## Verification

After code changes:

- Run `node --check game.js`.
- Run `.\scripts\check.ps1` when available.
- Confirm `index.html` references existing assets.
- Update `README.md` when player-facing behavior changes.
- Append a short entry to `docs/devlog.md` when gameplay, art direction, or project structure changes.

## Current Notes

- The copied prototype originally lived at `F:\Personal_project\codex_test`.
- This project root is now `F:\Personal_project\Hive_Garden_codex`.
- The current prototype uses a 7x7 board, drag-based block swapping, 30 habitat growth stages, dense fill layers, a stage 29 rear leaf/vine backdrop, and a final hatch sequence.
