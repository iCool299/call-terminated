// Enemy: a fighter with a small brain. It lines up with Zee, flanks, chains combos, sidesteps her swings, punishes her recovery,
// throws call-centre headsets, and (navy + sporty, the "heavies") grabs and throws her.
// Art comes from assets/characters/<id>/ ; every enemy shares this one brain.
import { CONFIG } from './config.js?v=202611211704';
import { frameAt, drawAnim, silhouette } from './assets.js?v=202611211704';
import { SOFT } from './zee.js?v=202611211704';

const E = CONFIG.enemy;
const rnd = (a, b) => a + Math.random() * (b - a);
const sgn = (v) => (v < 0 ? -1 : 1);

// internal ids only (not shown in the game)
export const ENEMY_IDS = ['navy', 'polo', 'plum', 'cream', 'fighter', 'gangly', 'sporty', 'curvy'];

// The grabbers' animation sheet is drawn WITH Zee in it (so the two are always perfectly in sync). These numbers line the real Zee up
// with it: CLAMP_DX = how far in front of the grabber Zee stands in the clamp frame; RELEASE = where she leaves his hands (px in front
// of his feet, px above the ground) when the throw releases.
// Each enemy walks in its own way. step = length of one step as a share of its height (the walk cycle is advanced by the distance it
// actually covers, so feet never skate), speed = walking-pace multiplier, lean = forward tilt (radians), bounce = extra lift at mid-step (px),
// sway = side-to-side body roll (radians), turn = seconds to commit to a new facing after changing direction.
const WALK_STYLE = {
  navy:    { step: 0.56, speed: 0.92, lean: 0.00, bounce: 0.6, sway: 0.010, turn: 0.14 },   // heavy and upright: slow, planted steps
  sporty:  { step: 0.60, speed: 1.12, lean: 0.05, bounce: 1.5, sway: 0.012, turn: 0.08 },   // athletic: long bouncy strides, leans in
  polo:    { step: 0.40, speed: 1.00, lean: 0.02, bounce: 1.3, sway: 0.030, turn: 0.10 },   // short and round: quick little steps, waddle
  plum:    { step: 0.50, speed: 1.05, lean: 0.01, bounce: 0.7, sway: 0.008, turn: 0.09 },   // brisk and composed
  cream:   { step: 0.52, speed: 0.98, lean: 0.02, bounce: 0.9, sway: 0.016, turn: 0.10 },   // casual stroll
  fighter: { step: 0.55, speed: 1.15, lean: 0.07, bounce: 1.4, sway: 0.010, turn: 0.07 },   // aggressive: fast, leaning forward
  gangly:  { step: 0.64, speed: 0.90, lean: 0.10, bounce: 0.5, sway: 0.028, turn: 0.15 },   // slouched and loose: long lazy strides
  curvy:   { step: 0.48, speed: 1.00, lean: 0.00, bounce: 0.8, sway: 0.034, turn: 0.10 },   // confident swagger
};
const ACCEL = 560;                                                // px/s^2: enemies speed up and slow down instead of snapping

const CLAMP_DX = { navy: 52, sporty: 48 };
const RELEASE = { navy: { dx: 92, z: 78 }, sporty: { dx: 58, z: 46 } };

export class Enemy {
  constructor(id, character, x, y) {
    this.id = id; this.character = character; this.anims = character.anims;
    this.heavy = !!character.manifest.grab;                          // navy + sporty: tougher, harder hitting, can grab
    this.canGrab = this.heavy;
    this.x = x; this.y = y; this.z = 0; this.vx = 0; this.face = 1;
    this.hp = this.maxHp = this.heavy ? E.heavyHp : E.hp;
    this.dmgMul = this.heavy ? E.heavyDmgMul : 1;
    this.aggr = rnd(0.9, 1.25) * (this.heavy ? 1.1 : 1);              // how fast it recovers between attacks
    this.style = WALK_STYLE[id] || WALK_STYLE.cream;
    this.speed = E.walkSpeed * rnd(0.95, 1.2) * (this.heavy ? 1.05 : 1) * this.style.speed;
    this.stepLen = this.style.step * (character.manifest.gameHeight || 140);      // px covered by one step (one pass through the walk loop)
    this.vw = 0; this.vh = 0; this.turnT = 0; this.stride = 0; this.leanK = 0;                      // smoothed velocity, turn timer, walk phase 0..1 per step
    this.atkRate = this.heavy ? 1.12 : 1.1;                           // their swings are quicker than the raw animation
    this.evadeChance = this.heavy ? 0.12 : 0.4;
    this.prefersRange = !this.canGrab && Math.random() < 0.45;       // some enemies keep their distance and throw headsets
    this.side = sgn(x - 320);                                         // which side of Zee it likes to fight from
    this.flash = 0; this.barT = 0; this.spawnT = 0.5; this.cool = rnd(0.5, 0.9);
    this.mx = 0; this.my = 0; this.decideT = 0; this.still = 0; this.sideT = 0; this.hitCool = 0; this.combo = 0; this.evadeId = -1; this.evadeT = 0;
    this.hitId = -1; this.holdingZee = false; this.struggle = 0; this.deadT = 0; this.remove = false;
    this.state = 'spawn'; this.attackName = 'punch';
    this._play('idle');
  }

  _play(name) { this.anim = this.anims[name]; this.animName = name; this.t = 0; }
  get frame() { return frameAt(this.anim, this.t); }
  get done() { return this.t >= this.anim.duration; }
  snapshot() { this.px = this.x; this.py = this.y; }
  canBeHit() { return !['spawn', 'dead', 'down'].includes(this.state) && !this.holdingZee; }
  get attacking() { return ['attack', 'grab', 'hold', 'throw'].includes(this.state); }

  breakFree() { this.holdingZee = false; this.state = 'hurt'; this._play('hurt'); this.vx = -this.face * 40; this.cool = 1.2; }

  // returns false if ignored, 'kill' if it killed, true otherwise
  takeHit(dmg, dir, knock) {
    if (!this.canBeHit()) return false;
    this.hp -= dmg; this.flash = 0.22; this.barT = 2.6;
    if (this.hp <= 0) { this.hp = 0; this.state = 'dead'; this._play('defeat'); this.vx = dir * 100; this.deadT = 0; return 'kill'; }
    if (knock) { this.state = 'down'; this._play('knockdown'); this.vx = dir * 120; this.hitCool = 0; return true; }
    // committed swings (past the wind-up) can't be flinched by a light hit, and nobody can be stun-locked forever
    const committed = (this.state === 'attack' && this.frame >= Math.min(...this.anim.active)) || this.state === 'ranged' && this.frame >= (this.anim.release[0] || 0);
    if (committed || this.hitCool > 0) return true;
    this.state = 'hurt'; this._play('hurt'); this.vx = dir * 55; this.hitCool = E.hitCool; this.combo = 0;
    return true;
  }

  update(dt, g) {
    const rate = this.state === 'attack' ? this.atkRate : 1;
    if (this.state !== 'whiff' && this.animName !== 'walk') this.t += dt * rate;   // the walk loop is advanced by distance walked (see _stride)
    this.flash = Math.max(0, this.flash - dt);
    const tl = (this.state === 'walk' || this.state === 'evade') ? Math.min(1, Math.hypot(this.vw, this.vh) / Math.max(1, this.speed)) : 0;
    this.leanK += (tl - this.leanK) * Math.min(1, dt * 9);        // eases the style in and out as it starts and stops walking
    this.barT = Math.max(0, this.barT - dt);
    this.hitCool = Math.max(0, this.hitCool - dt);
    switch (this.state) {
      case 'spawn': this.spawnT -= dt; if (this.spawnT <= 0) { this.state = 'idle'; this._play('idle'); } break;
      case 'idle': case 'walk': this._free(dt, g); break;
      case 'evade': this._evade(dt, g); break;
      case 'attack': this._attack(dt, g); break;
      case 'ranged': this._ranged(dt, g); break;
      case 'grab': this._grab(dt, g); break;
      case 'whiff': this.whiffT -= dt; if (this.whiffT <= 0) this._back(0.7); break;
      case 'hold': this._hold(dt, g); break;
      case 'throw': this._throw(dt, g); break;
      case 'hurt': this.x += this.vx * dt; this.vx *= Math.pow(0.02, dt); if (this.done) this._back(0.2); break;
      case 'down': this._down(dt); break;
      case 'dead':
        this.x += this.vx * dt; this.vx *= Math.pow(0.04, dt);
        if (this.done) { this.deadT += dt; if (this.deadT > E.corpseTime) this.remove = true; }
        break;
    }
    const b = g.bounds;
    this.x = Math.max(b.minX - 20, Math.min(b.maxX + 20, this.x));
    this.y = Math.max(b.minY, Math.min(b.maxY, this.y));
  }

  // Advance the walk loop by the distance covered (negative = walking backwards): one step = one pass through the 12-frame loop.
  _stride(d) {
    const dur = this.anim.duration;
    this.stride = (((this.stride + d / this.stepLen) % 1) + 1) % 1;
    this.t = this.stride * dur;
  }
  // Ease the velocity toward a target (no sudden starts, stops or reversals).
  _steer(tvx, tvy, dt) {
    const a = ACCEL * dt, ex = tvx - this.vw, ey = tvy - this.vh, m = Math.hypot(ex, ey);
    if (m <= a) { this.vw = tvx; this.vh = tvy; } else { this.vw += ex / m * a; this.vh += ey / m * a; }
  }
  // Which way to look: the way it is walking, never walking backwards at her. Standing still (or only closing in depth) it looks at her.
  // A change of facing waits a moment (and for the body to slow down), so a turn-around reads as a real turn.
  _facing(z, dt, moving) {
    let want = this.face;
    if (moving && Math.abs(this.vw) > 14) want = sgn(this.vw);
    else if (Math.abs(z.x - this.x) > 5) want = z.x > this.x ? 1 : -1;
    if (want === this.face) { this.turnT = 0; return; }
    this.turnT += dt;
    if (this.turnT >= this.style.turn) { this.face = want; this.turnT = 0; }
  }

  _back(cd) { this.state = 'idle'; this._play('idle'); this.vw = 0; this.vh = 0; this.cool = Math.max(this.cool, cd / this.aggr); }
  _faceZee(z) { if (Math.abs(z.x - this.x) > 5) this.face = z.x > this.x ? 1 : -1; }

  // ---------- animation test mode: no AI at all, it just plays the chosen animation ----------
  testPlay(name) {
    if (!this.anims[name]) return false;
    this.state = 'test'; this._play(name); this.testHold = 0; this.vw = 0; this.vh = 0; this.leanK = 0; this.flash = 0; return true;
  }
  testUpdate(dt, T) {
    const a = this.anim;
    if (T.step) {                                                   // frame stepping (works while paused)
      const n = a.frames, f = (this.frame + T.step + n) % n;
      this.t = a.starts[f] + 0.0005; this.testHold = 0; return;
    }
    if (T.paused) return;
    this.t += dt * T.speed;
    if (!a.loop && !a.pingpong && this.t >= a.duration) {           // one-shots: hold the last frame a moment, then play again
      this.testHold += dt;
      if (this.testHold > 0.6) { this.t = 0; this.testHold = 0; }
    }
  }

  // ---------- on the move ----------
  _free(dt, g) {
    const z = g.zee, dx = z.x - this.x, dy = z.y - this.y, adx = Math.abs(dx), ady = Math.abs(dy);
    this.cool -= dt * this.aggr;
    const calm = z.state === 'defeat';
    // she just whiffed or is stuck in a recovery: punish it
    if (z.state === 'attack' && z.anim.active.length && z.frame > Math.max(...z.anim.active) && adx < E.attackRange + 40) this.cool = Math.min(this.cool, 0.06);
    // she starts a swing next to me: maybe sidestep it, then counter
    if (!calm && z.state === 'attack' && z.attackId !== this.evadeId && adx < 78 && ady < 22 && z.anim.active.length && z.frame < Math.min(...z.anim.active)) {
      this.evadeId = z.attackId;
      if (Math.random() < this.evadeChance) {
        this._faceZee(z); this.state = 'evade'; this.evadeT = 0.28; this._play('walk');
        this.mx = -sgn(dx) * 0.9; this.my = (ady > 6 ? -sgn(dy) : (Math.random() < 0.5 ? 1 : -1)) * 1.1; return;
      }
    }
    // pick a spot: melee fighters stand in front of her on their own side; if that side is crowded they go around to the other
    this.decideT -= dt; this.sideT -= dt;
    if (this.decideT <= 0) {
      this.decideT = 0.18;
      if (this.sideT <= 0) {
        const crowd = g.enemies.filter((o) => o !== this && o.state !== 'dead' && sgn(o.x - z.x) === this.side && Math.abs(o.x - z.x) < 90 && Math.abs(o.y - this.y) < 40).length;
        if (crowd >= 1 && Math.random() < 0.7) { this.side = -this.side; this.sideT = 2.2; }       // flank
      }
      const wait = g.attackerCount() >= g.maxAttackers && !this.attacking;                        // too many already attacking: circle and wait
      let tx, mx = 0, my = 0;
      if (calm) { this.mx = 0; this.my = 0; }
      else {
        if (this.prefersRange) {
          const want = E.keepDistance * this.side;
          tx = z.x + want;
          if (adx < E.attackRange + 30) tx = z.x + this.side * (E.attackRange * 0.8);              // she is on top of me: fight
        } else tx = z.x + this.side * (wait ? E.attackRange + 70 : E.attackRange * 0.8);
        const ex = tx - this.x;
        if (Math.abs(ex) > 7) mx = sgn(ex) * (this.heavy && Math.abs(ex) > 170 ? 1.35 : 1);       // heavies charge in from afar
        if (ady > 5) my = sgn(dy) * 0.85;
        this.mx = mx; this.my = my;
      }
    }
    // ---- move (eased) ----
    let tvx = this.mx * this.speed, tvy = this.my * this.speed * CONFIG.zee.depthSpeedFactor * 1.15;
    if (!calm) {                                                     // don't stack on top of other enemies: nudge apart
      for (const o of g.enemies) {
        if (o === this || o.state === 'dead' || o.state === 'down') continue;
        const ox = this.x - o.x, oy = this.y - o.y;
        if (Math.abs(ox) < 30 && Math.abs(oy) < 12) { const k = 1 - Math.abs(ox) / 30; tvx += (ox === 0 ? (this.id < o.id ? 1 : -1) : sgn(ox)) * 70 * k; tvy += (oy === 0 ? 1 : sgn(oy)) * 40 * k; }
      }
    }
    if (this.turnT > 0) { tvx *= 0.25; tvy *= 0.5; }                  // braking while it turns round
    this._steer(tvx, tvy, dt);
    const spd = Math.hypot(this.vw, this.vh), moving = spd > 8;
    if (moving) {
      const px = this.x, py = this.y;
      this.x += this.vw * dt; this.y += this.vh * dt;
      this.still = 0;
      if (this.state !== 'walk') { this.state = 'walk'; this._play('walk'); this.t = this.stride * this.anim.duration; }
      const d = Math.hypot(this.x - px, this.y - py);
      this._stride(d * (Math.abs(this.vw) < 14 || sgn(this.vw) === this.face ? 1 : -1));      // backwards only while turning round
    } else {
      this.still += dt;
      if (this.state === 'walk' && this.still > 0.15) { this.state = 'idle'; this._play('idle'); }
    }
    if (!calm) this._facing(z, dt, moving);
    if (calm || this.cool > 0 || z.state === 'held') return;
    // ---- choose an attack ----
    const inRange = adx < E.attackRange + 8 && ady < E.engageY + 4;
    if (inRange && g.attackerCount() < g.maxAttackers) {
      this._faceZee(z); this.turnT = 0;
      if (this.canGrab && Math.random() < E.grabChance && z.canBeGrabbed()) { this.state = 'grab'; this._play('grab'); g.sfx.grab(); return; }
      this.combo = this.combo > 0 ? this.combo : (Math.random() < 0.6 ? Math.floor(rnd(1, 3.4)) : 0);   // 0-2 follow-up hits
      this._startMelee(g);
    } else if (!this.canGrab && adx > 130 && adx < 460 && ady < 9 && (this.prefersRange || Math.random() < 0.02)) {
      this.state = 'ranged'; this.fired = false; this._play('throw_headset'); this._faceZee(z);
    }
  }

  _startMelee(g) {
    this.attackName = this.combo % 2 === 0 ? 'punch' : 'kick';
    if (Math.random() < 0.2) this.attackName = this.attackName === 'punch' ? 'kick' : 'punch';
    this.state = 'attack'; this.hitDone = false; this._play(this.attackName);
  }

  _evade(dt, g) {
    this.evadeT -= dt;
    const px = this.x, py = this.y;
    this.x += this.mx * this.speed * 1.9 * dt; this.y += this.my * this.speed * 1.0 * dt;
    this.vw = this.mx * this.speed * 1.9; this.vh = this.my * this.speed;
    const back = Math.sign((this.x - px) * this.face) || 1;
    this._stride(Math.hypot(this.x - px, this.y - py) * back);
    if (this.evadeT <= 0) { this.state = 'idle'; this._play('idle'); this.cool = 0.05; this.combo = 1; }   // and straight back in
  }

  _attack(dt, g) {
    const f = this.frame, a = this.anim, z = g.zee, first = Math.min(...a.active), last = Math.max(...a.active);
    if (f < first) this._faceZee(z);                                  // can still re-aim during the wind-up (she jumped over / went round), never after
    if (f >= 1 && f <= last && Math.abs(z.x - this.x) > 30) this.x += this.face * 48 * dt;    // step into the swing (never through her)
    if (!this.hitDone && a.active.includes(f)) {
      const dx = (z.x - this.x) * this.face;
      if (dx > -8 && dx < E.attackRange + 20 && Math.abs(z.y - this.y) < 17 && z.z < 40) {
        const dmg = Math.round((this.attackName === 'punch' ? E.punchDmg : E.kickDmg) * this.dmgMul);
        if (g.hurtZee(dmg, this.face, this)) this.hitDone = true;
      }
    }
    if (this.done) {
      const dx = Math.abs(z.x - this.x), dy = Math.abs(z.y - this.y);
      if (this.combo > 0 && dx < E.attackRange + 24 && dy < E.engageY + 6 && z.state !== 'defeat' && z.state !== 'down') {
        this.combo--; this._faceZee(z); this._startMelee(g); this.cool = 0;             // chain the next hit
      } else { this.combo = 0; this._back(rnd(...E.cooldown)); }
    }
  }

  _ranged(dt, g) {
    if (!this.fired && this.frame >= this.anim.release[0]) { this.fired = true; g.fireHeadset(this); }
    if (this.done) this._back(rnd(1.0, 1.9));
  }

  // ---------- heavies: grab and throw ----------
  // coil -> lunge -> CLAMP (the catch) -> hoist -> overhead. Zee is drawn inside this animation from the clamp frame on.
  _grab(dt, g) {
    const f = this.frame, z = g.zee, clamp = this.anim.active[0];
    if (!this.holdingZee) {
      if (f < clamp) { this._faceZee(z); this.x += this.face * 100 * dt; return; }               // lunge in
      const dx = (z.x - this.x) * this.face;
      if (dx > -14 && dx < E.grabRange + 14 && Math.abs(z.y - this.y) < 16 && z.canBeGrabbed()) {
        this.holdingZee = true; this.struggle = 0; z.getGrabbed(this);
        this.x = z.x - this.face * (CLAMP_DX[this.id] || 50); this.y = z.y;                      // line up with the clamp pose (a few px at most)
        g.sfx.grab(); g.shake = Math.max(g.shake, 2.5); g.hitstop = Math.max(g.hitstop, 0.05);
      } else {                                                                                   // missed: she dodged or jumped away
        this.state = 'whiff'; this.whiffT = 0.35; this.t = this.anim.starts[clamp] - 0.001;
      }
      return;
    }
    if (this.done) { this.state = 'hold'; this.holdT = 0; this._play('hold'); }
  }

  // overhead hold (looping): she struggles; mash buttons to break free (see Zee._held), otherwise he throws
  _hold(dt, g) {
    this.holdT += dt;
    if (!this.holdingZee) { this._back(1.0); return; }
    if (this.holdT >= E.holdTime) { this.state = 'throw'; this.thrown = false; this._play('throw'); }
  }

  // wind-up (Zee behind his head) -> heave -> RELEASE: Zee leaves his hands and flies
  _throw(dt, g) {
    if (!this.thrown && this.holdingZee && this.frame >= this.anim.release[0]) {
      const R = RELEASE[this.id] || { dx: 60, z: 60 };
      this.thrown = true; this.holdingZee = false;
      g.zee.throwAway(this.face, this.x + this.face * R.dx, R.z); g.onThrow();
    }
    if (this.done) this._back(rnd(1.0, 1.5));
  }

  _down(dt) {
    this.x += this.vx * dt; this.vx *= Math.pow(0.05, dt);
    if (this.animName === 'knockdown' && this.t >= this.anim.duration + 0.5) this._play('get_up');
    else if (this.animName === 'get_up' && this.done) { this._back(0.25); this.combo = 1; }
  }

  // ---------- drawing ----------
  draw(ctx, alpha = 1) {
    if (this.px === undefined) this.snapshot();
    const x = this.px + (this.x - this.px) * alpha, y = this.py + (this.y - this.py) * alpha;
    let fade = 1;
    if (this.state === 'spawn') fade = 1 - this.spawnT / 0.5;
    if (this.state === 'dead' && this.deadT > E.corpseTime - 0.6) fade = Math.max(0, (E.corpseTime - this.deadT) / 0.6);
    const ch = this.character, lying = this.state === 'down' || this.state === 'dead' || this.animName === 'get_up';
    // shadow (soft contact + cast silhouette)
    const w = lying ? 44 : 26;
    ctx.globalAlpha = 0.5 * fade; ctx.drawImage(SOFT, x - w, y - w * 0.26 + 1, w * 2, w * 0.52);
    const dw = ch.cw * ch.scale, dh = ch.ch * ch.scale;
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -0.5, 0.3, 0, 0); ctx.scale(this.face, 1);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.globalAlpha = 0.2 * fade;
    ctx.drawImage(silhouette(ch, this.anim, this.frame), -ch.anchor.x * ch.scale, -ch.anchor.y * ch.scale, dw, dh);
    ctx.restore(); ctx.globalAlpha = 1;
    if (this.leanK > 0.01 && !lying) {                          // each enemy's walking style: forward lean, body roll and mid-step lift
      const S = this.style, k = this.leanK, roll = S.sway * Math.sin(this.stride * 2 * Math.PI) * k;
      const lift = S.bounce * Math.abs(Math.sin(this.stride * Math.PI)) * k;
      ctx.save(); ctx.translate(x, y); ctx.rotate(S.lean * k * this.face + roll); ctx.translate(-x, -y);
      drawAnim(ctx, ch, this.anim, this.frame, x, y - lift, this.face, fade, this.flash * 6);
      ctx.restore();
    } else drawAnim(ctx, ch, this.anim, this.frame, x, y, this.face, fade, this.flash * 6);
    // health bar with the HP number beside it, for a moment after being hit
    if (this.barT > 0 && this.state !== 'dead') {
      const bw = this.heavy ? 44 : 34, bx = Math.round(x - bw / 2 - 6), by = Math.round(y - ch.manifest.gameHeight - 12);
      ctx.globalAlpha = Math.min(1, this.barT * 2);
      ctx.fillStyle = '#10101a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = '#3a2430'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = '#e2574c'; ctx.fillRect(bx, by, Math.round(bw * this.hp / this.maxHp), 4);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 7px ui-monospace, Consolas, monospace'; ctx.textAlign = 'left';
      ctx.lineWidth = 2; ctx.strokeStyle = '#10101a'; const t = String(Math.ceil(this.hp));
      ctx.strokeText(t, bx + bw + 3, by + 4); ctx.fillText(t, bx + bw + 3, by + 4); ctx.globalAlpha = 1;
    }
  }
}
