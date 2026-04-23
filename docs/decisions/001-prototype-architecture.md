# 001. Prototype Architecture

## Decision

Use plain HTML, CSS, JavaScript, and reusable SVG files for the MVP.

## Why

- The game can run by opening `index.html` directly.
- The prototype stays easy to inspect and edit.
- SVG assets can be reused many times with different positions, sizes, rotations, and animation timing.
- Nature elements can be replaced later with production art without rewriting the game loop.
- The approach makes it easy to test gameplay, habitat density, layer ordering, and hatching direction before choosing a larger engine or asset pipeline.

## Consequences

- File count is higher because individual SVG assets live under `assets/`.
- Dense habitat scenes rely on DOM layering and CSS animation.
- If the environment becomes much denser, a future canvas or sprite atlas layer may be useful for performance and art cohesion.
