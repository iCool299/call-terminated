// Zee: the player character. A small state machine driven by input actions.
// Movement, combat timing, and animation selection live here; art comes from the manifest (assets.js).
import { CONFIG } from './config.js?v=202611202048';
import { frameAt, drawAnim, silhouette } from './assets.js?v=202611202048';

const C = CONFIG.zee;
const FREE = new Set(['idle', 'walk', 'run', 'makeup']);

// A soft round shadow blob, drawn once and reused for Zee's contact shadow and the paper shadows (no per-frame gradients).
const SOFT = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(0,0,0,0.85)'); r.addColorStop(0.55, 'rgba(0,0,0,0.38)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return c;
})();
const TRAIL_LAGS = [2, 4, 6];            // history samples (60 per second) used for the motion-blur ghosts
const TRAIL_ALPHA = [0.2, 0.11, 0.05];
const SMEAR_TIME = 0.07;                 // seconds the previous frame lingers as a smear on swings / rolls
const SMEAR_STATES = new Set(['attack', 'dodge']);

export class Zee {
  constructor(character, x, y) {
    this.character = character;
    this.anims = character.anims;
    this.x = x; this.y = y; this.z = 0; this.vz = 0; this.vx = 0;
    this.face = 1;
    this.hp = C.maxHp;
    this.invuln = 0;
    this.cd = { special: 0, dodge: 0 };
    this.papers = [];             // Printout Barrage projectiles
    this.barrageFrame = -1;
    this.blur = 0;                // 0..1 motion-blur strength, follows her real speed
    this.trail = [];              // recent positions (newest first) for the blur ghosts
    this._trailT = 0; this._key = ''; this.smear = null;
    this.state = 'idle';
    this.idleTime = 0;
    this.queued = false;
    this.phase = '';
    this.viewer = null;           // {name, loop} when the animation viewer is driving the sprite
    this._play('idle');
  }

  // ---------- animation helpers ----------
  _play(name) { this.anim = this.anims[name]; this.animName = name; this.t = 0; }
  get frame() { return frameAt(this.anim, this.t); }
  get done() { return this.t >= this.anim.duration; }
  get cooldowns() { return { special: C.specialCooldown, dodge: C.dodgeCooldown }; }

  // ---------- Printout Barrage ----------
  _fire() {
    const B = C.barrage;
    for (let i = 0; i < B.perFrame; i++) {
      this.papers.push({
        x: this.x + this.face * 34, y: this.y, z: 70 + Math.random() * 22 - 8,
        vx: this.face * (B.speed + Math.random() * 60), vz: (Math.random() - 0.5) * B.spread,
        spin: Math.random() * 6.28, t: 0,
      });
    }
  }
  _updatePapers(dt) {
    for (const p of this.papers) { p.t += dt; p.x += p.vx * dt; p.vz -= 55 * dt; p.z = Math.max(4, p.z + p.vz * dt); p.spin += dt * 14; }
    this.papers = this.papers.filter((p) => p.t < C.barrage.life && p.x > -20 && p.x < CONFIG.view.w + 20);
  }

  // ---------- main update ----------
  update(dt, input, bounds) {
    this.t += dt;
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    const actions = input.consume();
    this._updatePapers(dt);
    if (this.viewer) { this._viewer(); return; }

    for (const a of actions) this._dev(a);

    switch (this.state) {
      case 'idle': case 'walk': case 'run': case 'makeup': this._free(dt, input, actions); break;
      case 'attack': this._attack(dt, input, actions); break;
      case 'jump': this._jump(dt, input, actions); break;
      case 'dodge': this._dodge(dt); break;
      case 'hurt': this._hurt(dt); break;
      case 'down': this._down(dt); break;
      case 'getup': if (this.done) this._enter('idle'); break;
      case 'defeat': break;
      case 'victory': if (input.moving || actions.some((a) => !a.startsWith('dev_'))) this._enter('idle'); break;
      case 'interact': if (this.done) this._enter('idle'); break;
    }
    this._clamp(bounds);
    this._visuals(dt);
  }

  // Motion-blur bookkeeping: blur strength from real speed, a short position history, and the previous frame for smears.
  _visuals(dt) {
    if (this.px !== undefined) {
      const v = Math.hypot(this.x - this.px, this.y - this.py) / dt;
      // walk (110 px/s) barely registers, a full run (220 px/s) gives a gentle trail
      const target = Math.min(0.5, Math.max(0, (v - 100) / 260));
      this.blur += (target - this.blur) * Math.min(1, dt * 18);
    }
    this._trailT += dt;
    if (this._trailT >= 1 / 60) {
      this._trailT -= 1 / 60;
      this.trail.unshift({ x: this.x, y: this.y, lift: Math.max(0, this.z), anim: this.anim, frame: this.frame, face: this.face });
      if (this.trail.length > 7) this.trail.pop();
    }
    const key = this.animName + ':' + this.frame;
    if (key !== this._key) { if (this._ka) this.smear = { anim: this._ka, frame: this._kf, t: 0 }; this._key = key; this._ka = this.anim; this._kf = this.frame; }
    if (this.smear) this.smear.t += dt;
  }

  _viewer() {
    const v = this.viewer;
    if (this.animName !== v.name) this._play(v.name);
    if (v.loop && this.t >= this.anim.duration + 0.35) this.t = 0;
  }

  // ---------- state transitions ----------
  _enter(state, anim) {
    this.state = state; this.phase = ''; this.queued = false; this.idleTime = 0;
    if (state === 'idle') this._play('idle');
    else if (anim) this._play(anim);
  }

  _dev(a) {
    if (a === 'dev_hurt') this.takeHit(10, -this.face);
    if (a === 'dev_knockdown') this._knockdown(-this.face);
    if (a === 'dev_defeat') { this.hp = 0; this._enter('defeat', 'defeat'); }
    if (a === 'dev_victory') this._enter('victory', 'victory');
    if (a === 'dev_revive') { this.hp = C.maxHp; this.z = 0; this.vz = 0; this._enter('idle'); }
  }

  takeHit(dmg, dir = -this.face) {
    if (this.invuln > 0 || this.state === 'defeat' || this.state === 'down' || this.state === 'getup') return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = C.invulnerabilityAfterHit;
    this.vx = dir * 90;
    if (this.hp <= 0) { this._knockdown(dir, true); return true; }
    this.z = 0; this.vz = 0;
    this._enter('hurt', 'hurt');
    return true;
  }

  _knockdown(dir, thenDefeat = false) {
    this.vx = dir * 70; this.z = 0; this.vz = 0;
    this.finalDefeat = thenDefeat;
    this._enter('down', 'knockdown');
  }

  // ---------- grounded movement + action intake ----------
  _free(dt, input, actions) {
    const a = input.axis;
    for (const act of actions) {
      if (act === 'jump') return this._startJump();
      if (act === 'light') return this._startAttack('punch_1', a);
      if (act === 'special' && this.cd.special <= 0) { this.cd.special = C.specialCooldown; return this._startAttack('special', a); }
      if (act === 'dodge' && this.cd.dodge <= 0) return this._startDodge(a);
      if (act === 'interact') return this._enter('interact', 'interact');
    }
    if (input.moving) {
      const running = input.run;
      const speed = running ? C.runSpeed : C.walkSpeed;
      this.x += a.x * speed * dt;
      this.y += a.y * speed * C.depthSpeedFactor * dt;
      if (Math.abs(a.x) > 0.05) this.face = a.x > 0 ? 1 : -1;
      const want = running ? 'run' : 'walk';
      if (this.state !== want) { this.state = want; this._play(want); }
      this.idleTime = 0;
    } else {
      if (this.state === 'walk' || this.state === 'run') { this.state = 'idle'; this._play('idle'); }
      if (this.state === 'idle') {
        this.idleTime += dt;
        if (this.idleTime > C.makeupIdleDelay) { this.state = 'makeup'; this._play('idle_makeup'); }
      } else if (this.state === 'makeup' && this.done) {
        this.state = 'idle'; this.idleTime = 0; this._play('idle');
      }
    }
    if (Math.abs(this.vx) > 1) { this.x += this.vx * dt; this.vx *= Math.pow(0.02, dt); } else this.vx = 0;
  }

  // ---------- attacks ----------
  _startAttack(name, axis) {
    if (Math.abs(axis.x) > 0.3) this.face = axis.x > 0 ? 1 : -1;
    this._enter('attack', name);
  }

  _attack(dt, input, actions) {
    const name = this.animName;
    const f = this.frame;
    const lastActive = this.anim.active.length ? Math.max(...this.anim.active) : this.anim.frames - 1;
    // Printout Barrage: spit out paper on every hit frame of the special
    if (name === 'special') {
      if (this.anim.active.includes(f) && this.barrageFrame !== f) { this.barrageFrame = f; this._fire(); }
    } else this.barrageFrame = -1;
    // chain the light combo: punch_1 -> punch_2 -> punch_3
    if (actions.includes('light') && (name === 'punch_1' || name === 'punch_2')) this.queued = true;
    // forward step while swinging
    const lunge = C.lunge[name] || 0;
    const st = this.anim.starts;
    if (lunge && f >= 1 && f <= lastActive) this.x += this.face * (lunge / (st[lastActive + 1] - st[1])) * dt;
    const next = name === 'punch_1' ? 'punch_2' : name === 'punch_2' ? 'punch_3' : null;
    if (this.queued && next && f > lastActive) { this.queued = false; this._enter('attack', next); return; }
    // recovery frames can be cancelled into a dodge or jump so the controls never feel stuck
    if (f > lastActive) {
      for (const act of actions) {
        if (act === 'jump') return this._startJump();
        if (act === 'dodge' && this.cd.dodge <= 0) return this._startDodge(input.axis);
      }
    }
    if (this.done) this._enter('idle');
  }

  // ---------- jump ----------
  _startJump() { this.state = 'jump'; this.phase = 'start'; this.airKick = false; this._play('jump_start'); }

  _jump(dt, input, actions) {
    const a = input.axis;
    if (this.phase === 'start') {
      if (this.t >= C.jumpStartTime) { this.phase = 'air'; this.vz = C.jumpVelocity; this._play('jump_rise'); }
      return;
    }
    if (this.phase === 'air') {
      // variable jump height: releasing the button early cuts the rise short (a tap = small hop, hold = full jump)
      if (!input.held('jump') && this.vz > C.jumpCutVelocity) this.vz = C.jumpCutVelocity;
      this.vz -= C.gravity * dt; this.z += this.vz * dt;
      const speed = (input.run ? C.runSpeed : C.walkSpeed) * C.airControl;
      this.x += a.x * speed * dt; this.y += a.y * speed * C.depthSpeedFactor * dt * 0.7;
      if (Math.abs(a.x) > 0.05) this.face = a.x > 0 ? 1 : -1;
      if (actions.includes('light') && !this.airKick) { this.airKick = true; this._play('jump_kick'); }
      if (!this.airKick) {
        const want = this.vz > 0 ? 'jump_rise' : 'jump_fall';
        if (this.animName !== want) this._play(want);
      }
      if (this.z <= 0 && this.vz < 0) { this.z = 0; this.vz = 0; this.phase = 'land'; this._play('jump_land'); }
      return;
    }
    if (this.phase === 'land' && this.done) this._enter('idle');
  }

  // ---------- dodge roll ----------
  _startDodge(axis) {
    this.cd.dodge = C.dodgeCooldown;
    let dx = axis.x, dy = axis.y;
    if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) { dx = this.face; dy = 0; }
    const l = Math.hypot(dx, dy) || 1;
    this.dodgeDir = { x: dx / l, y: dy / l };
    if (Math.abs(dx) > 0.2) this.face = dx > 0 ? 1 : -1;
    this._enter('dodge', 'dodge');
  }

  _dodge(dt) {
    const f = this.frame;
    if (this.anim.iframes.includes(f)) this.invuln = Math.max(this.invuln, 0.08);
    const speed = C.dodgeDistance / this.anim.duration;
    this.x += this.dodgeDir.x * speed * dt;
    this.y += this.dodgeDir.y * speed * C.depthSpeedFactor * dt;
    if (this.done) this._enter('idle');
  }

  // ---------- reactions ----------
  _hurt(dt) {
    this.x += this.vx * dt; this.vx *= Math.pow(0.02, dt);
    if (this.done) this._enter('idle');
  }

  _down(dt) {
    this.x += this.vx * dt; this.vx *= Math.pow(0.05, dt);
    if (this.animName === 'knockdown' && this.done) {
      if (this.finalDefeat) { this._enter('defeat', 'defeat'); return; }
      if (this.t >= this.anim.duration + C.knockdownHold) { this.state = 'getup'; this._play('get_up'); this.invuln = 1.4; }
    }
  }

  _clamp(b) {
    this.x = Math.max(b.minX, Math.min(b.maxX, this.x));
    this.y = Math.max(b.minY, Math.min(b.maxY, this.y));
  }

  // ---------- drawing ----------
  // remember where she was before the next logic step, so drawing can interpolate (smooth at any refresh rate)
  snapshot() { this.px = this.x; this.py = this.y; this.pz = this.z; }

  draw(ctx, alpha = 1) {
    if (this.px === undefined) this.snapshot();
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const lift = Math.max(0, this.pz + (this.z - this.pz) * alpha);
    this._drawShadow(ctx, x, y, lift);
    // motion blur: faint ghosts along her recent path while she moves fast
    if (this.blur > 0.06) {
      for (let i = 0; i < TRAIL_LAGS.length; i++) {
        const h = this.trail[TRAIL_LAGS[i]];
        if (h) drawAnim(ctx, this.character, h.anim, h.frame, h.x, h.y - h.lift, h.face, TRAIL_ALPHA[i] * this.blur);
      }
    }
    // swing / roll smear: the previous frame lingers for a moment, which blurs fast poses together
    const s = this.smear;
    if (s && s.t < SMEAR_TIME && (SMEAR_STATES.has(this.state) || this.animName === 'jump_kick')) {
      drawAnim(ctx, this.character, s.anim, s.frame, x, y - lift, this.face, 0.32 * (1 - s.t / SMEAR_TIME));
    }
    // flicker while invulnerable after a hit
    if (!(this.invuln > 0 && this.state !== 'dodge' && Math.floor(this.invuln * 18) % 2 === 0)) {
      drawAnim(ctx, this.character, this.anim, this.frame, x, y - lift, this.face);
    }
    this._drawPapers(ctx);
  }

  // Soft contact shadow + a cast shadow built from her own silhouette (so it follows every pose), both fading as she rises.
  _drawShadow(ctx, x, y, lift) {
    const fade = Math.max(0.3, 1 - lift / 170);
    const lying = this.state === 'down' || this.state === 'getup' || this.state === 'defeat';
    const w = (lying ? 46 : 27) * (1 - Math.min(0.4, lift / 300));
    ctx.globalAlpha = 0.55 * fade;
    ctx.drawImage(SOFT, x - w, y - w * 0.26 + 1, w * 2, w * 0.52);
    const ch = this.character, dw = ch.cw * ch.scale, dh = ch.ch * ch.scale;
    ctx.save();
    ctx.translate(x, y); ctx.transform(1, 0, -0.5, 0.3, 0, 0); ctx.scale(this.face, 1);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.22 * fade;
    ctx.drawImage(silhouette(ch, this.anim, this.frame), -ch.anchor.x * ch.scale, -ch.anchor.y * ch.scale, dw, dh);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawPapers(ctx) {
    for (const p of this.papers) {
      const fade = Math.min(1, (C.barrage.life - p.t) * 5);
      // shadow on the floor under the flying sheet: shrinks and fades the higher it is
      const hs = Math.max(0, 1 - p.z / 170);
      ctx.globalAlpha = 0.5 * fade * hs;
      ctx.drawImage(SOFT, p.x - 9, p.y - 2.5, 18, 5);
      const dir = Math.sign(p.vx);
      // motion-blur streak behind the sheet
      for (let i = 2; i >= 0; i--) {
        ctx.save();
        ctx.globalAlpha = fade * (i === 0 ? 1 : 0.2 / i);
        ctx.translate(p.x - dir * i * 6, p.y - p.z); ctx.rotate(Math.sin(p.spin) * 0.5);
        ctx.fillStyle = '#10101a'; ctx.fillRect(-6, -4, 12, 9);              // outline
        ctx.fillStyle = '#f4f1ea'; ctx.fillRect(-5, -3, 10, 7);              // sheet
        if (i === 0) { ctx.fillStyle = '#9aa0b4'; ctx.fillRect(-3, -1, 6, 1); ctx.fillRect(-3, 1, 5, 1); }  // text lines
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
