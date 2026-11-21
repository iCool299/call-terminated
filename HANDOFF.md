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

- 2026-11-21 (later): walk strips rebuilt as 12 frames each (like Zee; legs morphed around the hip). enemy.js now: walk loop advanced by distance walked (no foot skating, per-enemy `WALK_STYLE` step length/lean/bounce/sway/speed), eased acceleration, enemies face the way they walk (no more walking backwards while looking at Zee; brief braking turn), evade = backpedal (reverse walk loop), enemies nudge apart instead of stacking. `tools/publish-walk.bat` = release + push (log in tools/publish-walk.log).

- 2026-11-21 (verified): live build 202611211713 is pushed; in the local preview all 8 enemies walk with the 12-frame loop, no console errors.

## Next steps (from the user)
- (none stated yet; add here)

## Rule for updating
After any work, add a dated line under "Decisions and changes" and adjust "Next steps".

- 2026-11-21 (walk redraw): regenerated two-step walk sheets for all 8 enemies (+ navy flex idle sheet 'f') via ChatGPT; raw in sprites/agents/raw/<id>_w.png, navy_f.png. tools/order-walk.ps1 now drops standing-still frames, finds the smoothest closed loop and rewrites manifest walk frames/fps (per-enemy manual drops in tools/walk-drop-<id>.txt, e.g. sporty). tools/legid.ps1 = experimental near/far leg detector (too weak on dark clothes, not used). Known limit: near/far leg identity can't be verified automatically; loops were checked by eye frame by frame.

- 2026-11-21 (AI+walk pass): enemies always close in (no retreat/keep-distance), one takes Zee's front while others go round her back (depth detour), attack instantly from behind, always face their walking direction (no backwards walking; evade = depth sidestep). Walk loops pruned of near-duplicate frames (tools/walk-drop-<id>.txt from visual review; order-walk also auto-prunes). Navy: normal idle + occasional bicep flex ('flex' anim).

- 2026-11-21: no redesign (master redesign gave little gain). Added tools/lock-head.ps1 (one clean head pasted on every walk/idle frame, matched position) - run automatically by build-enemy after order-walk. Heavies HP 140.

- 2026-11-21: polish pass - body separation + pushback, white-pop/light-red hit flash, decluttered damage numbers, new HUD, enemies walk in from screen edges, enemies step back off a beaten Zee.
- 2026-11-21: grabbed Zee struggles (shake + jolt per mash); enemies surround her (pick the emptier side, separate depth lanes), spawns alternate edges.
