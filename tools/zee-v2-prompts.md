# Zee v2 sheets (more frames) - plan + prompts

Attach sprites/zee/master/zee_master_idle_v1.png to EVERY prompt. Download -> `tools\stash.ps1 -Name <anim>_v2` (goes to sprites/zee/raw).
Then add the line to tools/zee-sheets.ps1 (frames, rows, StandH) and tools/zee-anims.ps1, rebuild with tools\build-zee.ps1.

| anim | frames | grid (cols x rows) | game fps |
|---|---|---|---|
| idle | 12 | 4x3 | 10 loop |
| idle_makeup | 16 | 4x4 | 12 |
| walk | 12 | 4x3 | 16 loop |
| run | 12 | 4x3 | 22 loop |
| jump (start 1-3, rise 4-6, fall 7-9, land 10-12) | 12 | 4x3 | 18 |
| punch_1 | 10 | 5x2 | 26 |
| punch_2 | 10 | 5x2 | 26 |
| punch_3 | 12 | 4x3 | 24 |
| jump_kick | 8 | 4x2 | 20 |
| dodge | 12 | 4x3 | 24 |
| special (Printout Barrage) | 16 | 4x4 | 20 |
| hurt | 6 | 3x2 | 18 |
| knockdown | 12 | 4x3 | 16 |
| get_up | 12 | 4x3 | 16 |
| defeat | 12 | 4x3 | 12 |
| victory | 12 | 4x3 | 10 |
| interact | 8 | 4x2 | 14 |

Heavy attack removed. Special = Printout Barrage, 30 s cooldown.

PREFIX:
Same character and same exact style as the attached master sprite (identical face, outfit, palette, outline thickness, proportions, pixel size; do not redesign anything). IMPORTANT: the hijab and scarf stay the desaturated dark charcoal-gray-purple of the master (#5C4B5C, shadows #3A333F), never bright purple or magenta; the jacket stays the same denim blue, the pants the same dark charcoal, the sneakers the same white, the lanyard the same blue.

LAYOUT (fill name, n, cols, rows):
Create the animation sprite sheet '<NAME>', <N> frames, as one landscape image with a grid of <C> columns by <R> rows of equal-size cells (frames read left to right, top row first). Perfectly flat solid pure green #00FF00 background, no text, labels, numbers, grid lines or shadows. Same character scale as the master in every cell, her body centered in her cell, ground contact on the same baseline height in every cell, nothing touching the cell edges. She faces right in three-quarter view like the master.

SUFFIX:
Smooth, evenly spaced in-between poses so the motion is fluid. Crisp square pixels, no anti-aliasing, no blur, no gradients, same palette as the master.

Status log is kept in the project memory (zee-sprite-pipeline.md).
