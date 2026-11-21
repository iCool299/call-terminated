# HANDOFF: Escalation Brawl (Office Mayhem)

Notes passed from a separate Claude chat (mobile, 2026-11-21) into this project. Read this first when starting or resuming a Claude Code session here, then keep it updated.

## Project
- 2D side-scrolling beat 'em up, web app (keyboard + touch). See README.md for controls, folder layout and the sprite pipeline.
- Playable character: Zee. Enemies, grab and throw, Printout Barrage special exist.
- Last commit before this handoff: "Face-down grab+throw with prone landing, tougher smarter enemies, 100/200 HP, HP numbers instead of names".

## Why this file exists
The original Claude Code session ("Office Mayhem game design") disconnected while the user was away from the laptop. A new chat could not reattach to it, so context lives here instead.

## Decisions and changes made in the other chat
- 2026-11-21: rebuilt the walk strip (`<id>_w.png` + manifest `walk` entry) for all 8 enemies: frames stabilised (torso x fixed, smooth head bob), flow-interpolated in-betweens only where artifact-free, palette-snapped. Frame counts now 15-24 per enemy (manifest `to`/`fps` updated, same ~0.57 s loop). Originals are in `tools/walk_backup_20261121/`. NOT yet tested in the game or pushed. `tools/build-enemy.ps1` regenerates `_w` strips from the raw sheets, so do not re-run it for walk or these edits are overwritten.

## Next steps (from the user)
- (none stated yet; add here)

## Rule for updating
After any work, add a dated line under "Decisions and changes" and adjust "Next steps".
