// Enemy: walks up to Zee, punches / kicks, throws call-centre headsets, and (navy + sporty) grabs and throws her.
// Art comes from assets/characters/<id>/ ; every enemy shares this one brain.
import { CONFIG } from './config.js?v=202611211353';
import { frameAt, drawAnim, silhouette } from './assets.js?v=202611211353';
import { SOFT } from './zee.js?v=202611211353';

const E = CONFIG.enemy;
const rnd = (a, b) => a + Math.random() * (b - a);

// code names (never real names)
export const CODENAMES = { navy: 'TITAN', polo: 'NOTEPAD', plum: 'AUDIT', cream: 'HOODIE', fighter: 'RINGER', gangly: 'STATIC', sporty: 'ANVIL', curvy: 'SASS' };
export const ENEMY_IDS = Object.keys(CODENAMES);

// The grabbers' animation sheet is drawn WITH Zee in it (so the two are always perfectly in sync). These numbers line the real Zee up
// with it: CLAMP_DX = how far in front of the grabber Zee stands in the clamp frame; RELEASE = where she leaves his hands (px in front
// of his feet, px above the ground) when the throw releases.
const CLAMP_DX = { navy: 52, sporty: 48 };
const RELEASE = { navy: { dx: 92, z: 78 }, sporty: { dx: 58, z: 46 } };

export class Enemy {
  constructor(id, character, x, y) {
    this.id = id; this.character = character; this.anims = character.anims;
    this.canGrab = !!character.manifest.grab;
    this.name = CODENAMES[id] || id.toUpperCase();
    this.x = x; this.y = y; this.z = 0; this.vx = 0; this.face = 1;
    this.hp = this.maxHp = E.hp;
    this.speed = E.walkSpeed * rnd(0.9, 1.15);
    this.prefersRange = !this.canGrab && Math.random() < 0.5;     // some enemies keep their distance and throw headsets
    this.flash = 0; this.barT = 0; this.spawnT = 0.5; this.cool = rnd(0.8, 1.4);
    this.mx = 0; this.my = 0; this.decideT = 0; this.still = 0; this.faceT = 0;
    this.hitId = -1; this.holdingZee = false; this.struggle = 0; this.deadT = 0; this.remove = false;
    this.state = 'spawn'; this.attackName = 'punch';
    this._play('idle');
  }

  _play(name) { this.anim = this.anims[name]; this.animName = name; this.t = 0; }
  get frame() { return frameAt(this.anim, this.t); }
  get done() { return this.t >= this.anim.duration; }
  snapshot() { this.px = this.x; this.py = this.y; }
  canBeHit() { return !['spawn', 'dead', 'down'].includes(this.state) && !this.holdingZee; }

  breakFree() { this.holdingZee = false; this.state = 'hurt'; this._play('hurt'); this.vx = -this.face * 40; }

  // returns false if ignored, 'kill' if it killed, true otherwise
  takeHit(dmg, dir, knock) {
    if (!this.canBeHit()) return false;
    this.hp -= dmg; this.flash = 0.22; this.barT = 2.4;
    if (this.hp <= 0) { this.hp = 0; this.state = 'dead'; this._play('defeat'); this.vx = dir * 100; this.deadT = 0; return 'kill'; }
    if (knock) { this.state = 'down'; this._play('knockdown'); this.vx = dir * 120; }
    else { this.state = 'hurt'; this._play('hurt'); this.vx = dir * 55; }
    return true;
  }

  update(dt, g) {
    if (this.state !== 'whiff') this.t += dt * (this.animName === 'walk' ? 1.5 : 1);       // the walk loop is one step (12 frames): played at the speed that matches how fast they walk, so feet don't slide
    this.flash = Math.max(0, this.flash - dt);
    this.barT = Math.max(0, this.barT - dt);
    switch (this.state) {
      case 'spawn': this.spawnT -= dt; if (this.spawnT <= 0) { this.state = 'idle'; this._play('idle'); } break;
      case 'idle': case 'walk': this._free(dt, g); break;
      case 'attack': this._attack(dt, g); break;
      case 'ranged': this._ranged(dt, g); break;
      case 'grab': this._grab(dt, g); break;
      case 'whiff': this.whiffT -= dt; if (this.whiffT <= 0) this._back(1.0); break;
      case 'hold': this._hold(dt, g); break;
      case 'throw': this._throw(dt, g); break;
      case 'hurt': this.x += this.vx * dt; this.vx *= Math.pow(0.02, dt); if (this.done) this._back(0.35); break;
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

  _back(cd) { this.state = 'idle'; this._play('idle'); this.cool = Math.max(this.cool, cd); }

  _free(dt, g) {
    const z = g.zee, dx = z.x - this.x, dy = z.y - this.y, adx = Math.abs(dx), ady = Math.abs(dy);
    this.cool -= dt;
    const idleOnly = z.state === 'defeat';
    if (!idleOnly && adx > 8) {                    // turn only after she has been on the other side for a moment (no flip-flopping)
      const want = dx > 0 ? 1 : -1;
      if (want !== this.face) { this.faceT += dt; if (this.faceT > 0.12) { this.face = want; this.faceT = 0; } } else this.faceT = 0;
    }
    // Decide where to move only a few times a second (and keep going meanwhile): re-deciding every frame made enemies flick
    // between walk and idle near the edge of their spacing, restarting the animation each time.
    this.decideT -= dt;
    if (this.decideT <= 0) {
      this.decideT = 0.2;
      let mx = 0, my = 0;
      if (!idleOnly) {
        if (this.prefersRange && adx > E.attackRange + 60) {
          if (adx < E.keepDistance - 40) mx = -Math.sign(dx) * 0.8;                                   // back off
          else if (adx > E.keepDistance + 60) mx = Math.sign(dx);                                     // come closer
          if (ady > 10) my = Math.sign(dy) * 0.7;
        } else {
          if (ady > E.engageY + 3) my = Math.sign(dy) * 0.75;
          if (adx > E.attackRange) mx = Math.sign(dx); else if (adx < 12) mx = -Math.sign(dx) * 0.5;       // only step back if literally on top of her
        }
      }
      this.mx = mx; this.my = my;
    }
    if (this.mx || this.my) {
      this.x += this.mx * this.speed * dt; this.y += this.my * this.speed * CONFIG.zee.depthSpeedFactor * dt;
      this.still = 0;
      if (this.state !== 'walk') { this.state = 'walk'; this._play('walk'); }
    } else {
      this.still += dt;
      if (this.state === 'walk' && this.still > 0.15) { this.state = 'idle'; this._play('idle'); }
    }
    if (idleOnly || this.cool > 0) return;
    // pick an attack
    if (adx < E.attackRange + 8 && ady < E.engageY + 5) {
      if (this.canGrab && Math.random() < E.grabChance && z.canBeGrabbed()) { this.state = 'grab'; this._play('grab'); g.sfx.grab(); return; }
      this.attackName = Math.random() < 0.55 ? 'punch' : 'kick';
      this.state = 'attack'; this.hitDone = false; this._play(this.attackName);
    } else if (!this.canGrab && adx > 120 && adx < 440 && ady < 22 && (this.prefersRange || Math.random() < 0.012)) {
      this.state = 'ranged'; this.fired = false; this._play('throw_headset'); this.face = dx > 0 ? 1 : -1;
    }
  }

  _attack(dt, g) {
    const f = this.frame, a = this.anim, z = g.zee;
    if (f >= 1 && f <= Math.max(...a.active) && Math.abs(z.x - this.x) > 30) this.x += this.face * 40 * dt;    // step into the swing (never through her)
    if (!this.hitDone && a.active.includes(f)) {
      const dx = (z.x - this.x) * this.face;
      if (dx > -10 && dx < E.attackRange + 18 && Math.abs(z.y - this.y) < 16 && z.z < 40) {
        const dmg = this.attackName === 'punch' ? E.punchDmg : E.kickDmg;
        if (g.hurtZee(dmg, this.face, this)) this.hitDone = true;
      }
    }
    if (this.done) this._back(rnd(...E.cooldown));
  }

  _ranged(dt, g) {
    if (!this.fired && this.frame >= this.anim.release[0]) { this.fired = true; g.fireHeadset(this); }
    if (this.done) this._back(rnd(1.4, 2.4));
  }

  // coil -> lunge -> CLAMP (the catch) -> hoist -> overhead. Zee is drawn inside this animation from the clamp frame on.
  _grab(dt, g) {
    const f = this.frame, z = g.zee, clamp = this.anim.active[0];
    if (!this.holdingZee) {
      if (f < clamp) { this.x += this.face * 90 * dt; return; }                  // lunge in
      const dx = (z.x - this.x) * this.face;
      if (dx > -14 && dx < E.grabRange + 14 && Math.abs(z.y - this.y) < 16 && z.canBeGrabbed()) {
        this.holdingZee = true; this.struggle = 0; z.getGrabbed(this);
        this.x = z.x - this.face * (CLAMP_DX[this.id] || 50); this.y = z.y;          // line up with the clamp pose (a few px at most)
        g.sfx.grab(); g.shake = Math.max(g.shake, 2.5); g.hitstop = Math.max(g.hitstop, 0.05);
      } else {                                                                      // missed: she dodged or jumped away
        this.state = 'whiff'; this.whiffT = 0.4; this.t = this.anim.starts[clamp] - 0.001;
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
    if (this.done) this._back(rnd(1.2, 1.8));
  }

  _down(dt) {
    this.x += this.vx * dt; this.vx *= Math.pow(0.05, dt);
    if (this.animName === 'knockdown' && this.t >= this.anim.duration + 0.55) this._play('get_up');
    else if (this.animName === 'get_up' && this.done) this._back(0.5);
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
    drawAnim(ctx, ch, this.anim, this.frame, x, y, this.face, fade, this.flash * 6);
    // name + health bar for a moment after being hit
    if (this.barT > 0 && this.state !== 'dead') {
      const bw = 34, bx = Math.round(x - bw / 2), by = Math.round(y - ch.manifest.gameHeight - 12);
      ctx.globalAlpha = Math.min(1, this.barT * 2);
      ctx.fillStyle = '#10101a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = '#3a2430'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = '#e2574c'; ctx.fillRect(bx, by, Math.round(bw * this.hp / this.maxHp), 4);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 7px ui-monospace, Consolas, monospace'; ctx.textAlign = 'center';
      ctx.fillText(this.name, x, by - 3); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
  }
}
