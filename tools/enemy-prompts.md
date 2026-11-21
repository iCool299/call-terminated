# Enemy re-draw sheets: full walk cycles + navy flex idle

Why: each enemy's source walk sheet shows only ONE step (the same leg always ends in front). Looping it makes the legs swap
places at the seam, which reads as "something wrong in the legs". Zee's walk is a full two-step cycle (left step + right
step), which is why it looks natural. No amount of in-betweening can create the missing second step: it has to be drawn.

Attach each enemy's current idle frame (assets/characters/<id>/<id>_a.png, first cell) to EVERY prompt.
Save downloads to sprites/<id>/raw/ and tell Claude; it will cut, align, palette-lock and wire them in.

| sheet | frames | grid | game fps |
|---|---|---|---|
| <id> walk (all 8 enemies) | 12 | 4x3 | 12 loop |
| navy idle_flex | 12 | 4x3 | 8 loop |

PREFIX:
Same character and same exact style as the attached sprite (identical face, outfit, palette, outline thickness, proportions,
pixel size; do not redesign anything).

LAYOUT:
Create the animation sprite sheet '<NAME>', <N> frames, as one landscape image with a grid of <C> columns by <R> rows of
equal-size cells (frames read left to right, top row first). Perfectly flat solid pure green #00FF00 background, no text,
labels, numbers, grid lines or shadows. Same character scale in every cell, body centered in its cell, feet on the same
baseline in every cell, nothing touching the cell edges. Faces right in three-quarter view like the attached sprite.

WALK BODY:
A complete, seamlessly looping walk cycle of TWO steps: frames 1-6 the left leg steps forward, frames 7-12 the right leg
steps forward, frame 12 flows back into frame 1. Contact, down, passing, up poses for each step; arms swing opposite to the
legs; relaxed natural pace, slight head bob, heels strike first. <PERSONALITY>

Personality lines: navy = confident heavy stride, shoulders back; sporty = bouncy athletic; polo = short waddling steps;
plum = composed office walk; cream = casual hands-light; fighter = loose boxer's gait; gangly = long lanky loping strides;
curvy = hip sway, swinging bag.

NAVY IDLE_FLEX BODY:
Relaxed idle loop: he stands with weight on one leg, raises his right arm and flexes, glances admiringly at his own biceps,
small proud smirk, then lowers the arm back to a relaxed stance; frame 12 matches frame 1 so it loops seamlessly.

SUFFIX:
Smooth, evenly spaced in-between poses so the motion is fluid. Crisp square pixels, no anti-aliasing, no blur, no gradients,
same palette as the attached sprite.
