# Escalation Brawl

2D side-scrolling beat 'em up. This stage contains the playable main character (Zee), built as a web app for
PC/laptop (keyboard) and Android/iPhone (touch).

## Run it
```
powershell -ExecutionPolicy Bypass -File tools\serve.ps1      # then open http://localhost:8765/
```
On a phone on the same Wi-Fi, open `http://<your-PC-IP>:8765/` (allow the port in the firewall) or host the folder on any static host.
Add `?touch=1` to force the touch controls on a desktop browser.

## Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move / run | WASD or arrows, Shift to run | drag on the left half (push far to run) |
| Light attack (3-hit combo) | J | HIT |
| Heavy attack | K | HEAVY |
| Dodge roll | L | DODGE |
| Jump (+ HIT in the air = jump kick) | I | JUMP |
| Special (Red Pen, 6 s cooldown) | Space | SPECIAL |
| Pause | Esc | pause button |

Dev keys: `1` hurt, `2` knockdown, `3` defeat, `4` victory, `E` interact, `R` revive. The "Animations" button opens a viewer for every animation.

## Folder layout
```
index.html, manifest.webmanifest     game shell (installable web app)
src/            config.js (all balance + key bindings), assets.js, input.js, zee.js (state machine), main.js
assets/characters/zee/               game-ready strips (zee_<strip>.png) + zee.manifest.json (animation table)
sprites/zee/master/                  the master reference sprite every animation was generated from
sprites/zee/raw/                     raw ChatGPT sheets (green screen), one per animation, untouched
sprites/zee/legacy/                  the first-generation sheets
tools/          build-zee.ps1 (raw -> strips + manifest), zee-sheets.ps1 (grid + scale per sheet),
                zee-anims.ps1 (game animations / frame ranges / fps), ZeePipeline.cs, serve.ps1, stash.ps1
```

## Rebuilding the sprites
`powershell -ExecutionPolicy Bypass -File tools\build-zee.ps1`
The tool cuts out the green background, aligns every frame to one feet-baseline, scales each sheet so Zee has the
same size everywhere, and snaps all colors to one palette taken from the master sprite.
To replace an animation: put the new raw sheet in `sprites/zee/raw/`, update its line in `tools/zee-sheets.ps1`, rebuild.

## Sprite spec (final)
Cell 224x224 px, feet anchor at (112, 204), Zee about 132 px tall, drawn facing right (mirrored in code for left).
Recommended game size 640x360 (scaled to fit any screen).

