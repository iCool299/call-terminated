// Loads a character's manifest + strips and turns them into ready-to-play animation objects.
// To swap art, replace the PNG strips / manifest in assets/characters/<name>/ - no code changes needed.
import { CONFIG } from './config.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = src;
  });
}

export async function loadCharacter(baseUrl) {
  const text = await (await fetch(baseUrl + 'zee.manifest.json')).text();
  const manifest = JSON.parse(text.replace(/^﻿/, ''));
  const images = {};
  await Promise.all(Object.entries(manifest.strips).map(async ([name, s]) => {
    images[name] = await loadImage(baseUrl + s.file);
  }));
  const anims = {};
  for (const [name, a] of Object.entries(manifest.animations)) {
    const frames = a.to - a.from + 1;
    const active = a.active || [];
    // wind-up frames (before the first hit frame) play faster so attacks connect without a laggy start
    const firstActive = active.length ? Math.min(...active) : 0;
    const starts = [0];
    for (let i = 0; i < frames; i++) {
      const d = (1 / a.fps) / (i < firstActive ? CONFIG.windupSpeed : 1);
      starts.push(starts[i] + d);
    }
    anims[name] = {
      name, img: images[a.strip], from: a.from, frames, fps: a.fps, loop: !!a.loop,
      loopFrom: a.loopFrom || 0, active, iframes: a.iframes || [],
      starts, duration: starts[frames],
    };
  }
  return { manifest, anims, cell: manifest.cell.w, anchor: manifest.anchor };
}

// Which frame (0-based inside the animation) is showing at time t.
export function frameAt(anim, t) {
  const { starts, frames } = anim;
  if (t >= anim.duration) {
    if (!anim.loop) return frames - 1;
    const loopStart = starts[anim.loopFrom];
    t = loopStart + ((t - anim.duration) % (anim.duration - loopStart));
  }
  let f = 0;
  while (f < frames - 1 && t >= starts[f + 1]) f++;
  return f;
}

// x, y may be fractional: the canvas is rendered at display resolution so motion stays smooth.
export function drawAnim(ctx, character, anim, frame, x, y, face) {
  const { cell, anchor } = character;
  const sx = (anim.from + frame) * cell;
  if (face < 0) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(-1, 1);
    ctx.drawImage(anim.img, sx, 0, cell, cell, -anchor.x, -anchor.y, cell, cell);
    ctx.restore();
  } else {
    ctx.drawImage(anim.img, sx, 0, cell, cell, x - anchor.x, y - anchor.y, cell, cell);
  }
}
