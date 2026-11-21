// Loads a character's manifest + strips and turns them into ready-to-play animation objects.
// To swap art, replace the PNG strips / manifest in assets/characters/<name>/ - no code changes needed.
import { CONFIG } from './config.js?v=202611211629';

// Release stamp, taken from this module's own URL (?v=...): every release uses new URLs so browsers never serve stale files.
export const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';
const stamp = (u) => u + '?v=' + VERSION;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = stamp(src);
  });
}

export async function loadCharacter(baseUrl, id = 'zee') {
  const text = await (await fetch(stamp(baseUrl + id + '.manifest.json'))).text();
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
      name, img: images[a.strip], cols: manifest.strips[a.strip].cols || 99999, from: a.from, frames, fps: a.fps, loop: !!a.loop,
      loopFrom: a.loopFrom || 0, active, iframes: a.iframes || [], release: a.release || [], pingpong: !!a.pingpong,
      starts, duration: starts[frames],
    };
  }
  return { manifest, anims, cw: manifest.cell.w, ch: manifest.cell.h, anchor: manifest.anchor, scale: manifest.drawScale || 1, silhouettes: new Map(), tints: new Map() };
}

// Red-tinted copy of a frame (same pixels, coloured red), cached. Drawn over the normal sprite for the "got hit" flash.
export function tinted(character, anim, frame) {
  const key = anim.name + ':' + frame;
  let s = character.tints.get(key);
  if (s) return s;
  const { cw, ch } = character;
  s = document.createElement('canvas'); s.width = cw; s.height = ch;
  const c = s.getContext('2d');
  const [sx, sy] = srcOf(anim, frame, cw, ch);
  c.drawImage(anim.img, sx, sy, cw, ch, 0, 0, cw, ch);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(255,24,24,0.72)'; c.fillRect(0, 0, cw, ch);
  character.tints.set(key, s);
  return s;
}

// Source rectangle of a frame inside its (grid-packed) strip.
function srcOf(anim, frame, cw, ch) {
  const i = anim.from + frame;
  return [(i % anim.cols) * cw, Math.floor(i / anim.cols) * ch];
}

// Black, half-resolution silhouette of a frame, built once and cached: used as the sprite's cast shadow.
export function silhouette(character, anim, frame) {
  const key = anim.name + ':' + frame;
  let s = character.silhouettes.get(key);
  if (s) return s;
  const { cw, ch } = character, w = cw >> 1, h = ch >> 1;
  s = document.createElement('canvas'); s.width = w; s.height = h;
  const c = s.getContext('2d');
  const [sx, sy] = srcOf(anim, frame, cw, ch);
  c.imageSmoothingQuality = 'high';
  c.drawImage(anim.img, sx, sy, cw, ch, 0, 0, w, h);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  character.silhouettes.set(key, s);
  return s;
}

// Which frame (0-based inside the animation) is showing at time t.
export function frameAt(anim, t) {
  const { starts, frames } = anim;
  if (anim.pingpong && frames > 2) {                       // 0 1 2 1 0 1 2 ... : always seamless, no jump back to the start
    const p = Math.floor(t * anim.fps) % (2 * frames - 2);
    return p < frames ? p : 2 * frames - 2 - p;
  }
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
// Frames are stored at 2x, so they are drawn at `scale` (0.5) game units per sprite pixel with smoothing on.
export function drawAnim(ctx, character, anim, frame, x, y, face, alpha = 1, tint = 0) {
  const { cw, ch, anchor, scale } = character;
  const [sx, sy] = srcOf(anim, frame, cw, ch);
  const dw = cw * scale, dh = ch * scale, ax = anchor.x * scale, ay = anchor.y * scale;
  // Snap to whole device pixels: a sprite drawn at a fractional position gets re-filtered every frame, which makes thin
  // lines and shading shimmer ("changing lines") while she moves. Whole-pixel positions keep every frame crisp and stable.
  const px = character.px || 1;
  x = Math.round(x * px) / px; y = Math.round(y * px) / px;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (alpha !== 1) ctx.globalAlpha = alpha;
  const red = tint > 0.01 ? tinted(character, anim, frame) : null;
  if (face < 0) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(-1, 1);
    ctx.drawImage(anim.img, sx, sy, cw, ch, -ax, -ay, dw, dh);
    if (red) { ctx.globalAlpha = alpha * Math.min(1, tint); ctx.drawImage(red, 0, 0, cw, ch, -ax, -ay, dw, dh); }
    ctx.restore();
  } else {
    ctx.drawImage(anim.img, sx, sy, cw, ch, x - ax, y - ay, dw, dh);
    if (red) { ctx.globalAlpha = alpha * Math.min(1, tint); ctx.drawImage(red, 0, 0, cw, ch, x - ax, y - ay, dw, dh); }
  }
  if (alpha !== 1 || red) ctx.globalAlpha = 1;
}
