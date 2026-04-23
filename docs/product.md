# Hive Garden Product Notes

## Concept

Hive Garden is a vertical mobile 3-match puzzle MVP. The player matches nature-themed blocks in the lower puzzle board. Each successful match sends visible energy upward into an egg habitat. The habitat grows denser with leaves, vines, trees, flowers, grass, mushrooms, water, stones, reeds, and butterflies. When the habitat is complete, the egg glows, trembles, pops, and hatches.

## Core Loop

1. Drag a block toward an adjacent block.
2. If the swap makes a 3-match, resolve matched blocks.
3. Matched blocks create effects and growth energy.
4. Growth energy flies to the habitat.
5. Habitat elements appear where the energy lands.
6. Combos unlock more habitat growth at once.
7. At full growth, the egg hatches.

## Vocabulary

- 블록: one circular puzzle piece in the board.
- 환경 요소: visual habitat item around the egg.
- 성장 에너지: match reward projectile that travels from the puzzle to the habitat.
- 부화: final sequence after habitat completion.

## MVP Requirements

- Vertical mobile-first layout.
- Top area: egg and growing habitat.
- Bottom area: 7x7 match-3 puzzle.
- Drag-based block swapping similar to Candy Crush.
- Invalid swaps return to their original positions.
- Match, clear, fall, refill, and combo resolution.
- Dense environment by late game, not sparse individual decorations.
- Egg and hatchling always render above habitat elements.

## Art Direction

The current MVP uses separate SVG files as reusable prototype assets. This keeps art easy to replace, reposition, and multiply. Puzzle blocks remain individual SVG assets. Habitat density is created by layering reusable SVG assets across foreground, fill, and rear backdrop layers.
