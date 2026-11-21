// Game world: Zee + enemies, combat resolution, projectiles and all the "juice" (hit flash, sparks, shake, hit-stop, sound).
import { CONFIG } from './config.js?v=202611211950';
import { Enemy } from './enemy.js?v=202611211950';
import { SOFT } from './zee.js?v=202611211950';
import { sfx } from './sfx.js?v=202611211950';

const E = CONFIG.enemy;

export class Game {
  constructor(zee, bounds) {
    this.zee = zee; this.bounds = bounds; this.sfx = sfx;
    this.enemies = []; this.shots = []; this.parts = []; this.texts = [];
    this.hitstop = 0; this.shake = 0; this.combo = 0; this.comboT = 0; this.kos = 0;
    this.reviveT = 0;
    this.test = null;                                  // animation test mode state (null = normal battle)
  }

  // Animation test mode: every enemy stands in front of Zee, nobody attacks; the page's test panel picks what they play.
  enterTest(chars) {
    this.test = { speed: 1, paused: false, step: 0, target: 'all', face: -1 };
    this.enemies = []; this.shots = []; this.parts = []; this.texts = [];
    const z = this.zee; z.x = 54; z.y = 292; z.face = 1; z.hp = CONFIG.zee.maxHp; z.z = 0;
    chars.forEach(([id, c], i) => {
      const e = new Enemy(id, c, 150 + i * 64, i % 2 ? 314 : 270);
      e.face = -1; e.spawnT = 0; e.hp = e.maxHp;
      e.testPlay('idle'); e.snapshot(); this.enemies.push(e);
    });
  }
  exitTest() { this.test = null; this.enemies = []; this.shots = []; }
  testSet(name, target = this.test.target) {
    let n = 0; for (const e of this.enemies) if ((target === 'all' || e.id === target) && e.testPlay(name)) n++; return n;
  }

  snapshot() { this.zee.snapshot(); for (const e of this.enemies) e.snapshot(); }

  // how many enemies are in the middle of attacking Zee right now (the rest circle and wait their turn)
  attackerCount() { let n = 0; for (const e of this.enemies) if (e.attacking) n++; return n; }
  get maxAttackers() { return this.enemies.length > 4 ? E.maxAttackers + 1 : E.maxAttackers; }

  spawn(id, character) {
    const z = this.zee, W = CONFIG.view.w;
    const x = z.x > W / 2 ? 70 + Math.random() * 60 : W - 70 - Math.random() * 60;     // appears on the side away from her
    const y = this.bounds.minY + 10 + Math.random() * (this.bounds.maxY - this.bounds.minY - 20);
    const e = new Enemy(id, character, x, y);
    e.face = x < z.x ? 1 : -1;
    this.enemies.push(e);
    this._burst(x, y, 40, 10, ['#c9c4dd', '#8f88aa'], 70, 'dust');
    sfx.spawn();
    return e;
  }

  // ---------- fighting ----------
  hurtZee(dmg, dir, src) {
    const z = this.zee;
    if (!z.takeHit(dmg, dir)) return false;
    this._impact(z.x, z.y, 62, dmg, '#ff5a4a', 1.0);
    this.shake = Math.max(this.shake, 3); this.hitstop = Math.max(this.hitstop, 0.06);
    sfx.hurt(); try { navigator.vibrate && navigator.vibrate(25); } catch (e) { /* not supported */ }
    return true;
  }

  fireHeadset(e) { this.shots.push({ x: e.x + e.face * 28, y: e.y, z: 64, vx: e.face * E.headsetSpeed, spin: 0 }); sfx.whoosh(); }
  onThrow() { sfx.whoosh(); this.shake = Math.max(this.shake, 2); }

  _hitEnemy(e, dmg, dir, knock) {
    const r = e.takeHit(dmg, dir, knock);
    if (!r) return false;
    const kill = r === 'kill';
    this._impact(e.x - dir * 6, e.y, 66, dmg, kill ? '#ffd24a' : '#fff1b0', kill ? 1.4 : knock ? 1.2 : 1);
    this.hitstop = Math.max(this.hitstop, kill ? 0.14 : knock ? 0.09 : 0.05);
    this.shake = Math.max(this.shake, kill ? 6 : knock ? 4 : 1.6);
    sfx.hit(kill || knock ? 1.25 : 0.9); if (kill) { sfx.ko(); this.kos++; }
    this.combo++; this.comboT = 1.7;
    return true;
  }

  _zeeAttacks() {
    const z = this.zee, a = z.attackBox();
    if (!a) return;
    for (const e of this.enemies) {
      if (e.hitId === a.id) continue;
      const dx = (e.x - z.x) * z.face;
      if (dx < -10 || dx > a.reach || Math.abs(e.y - z.y) > 18 || z.z > 90 || !e.canBeHit()) continue;
      e.hitId = a.id;
      this._hitEnemy(e, a.dmg, z.face, a.knock);
    }
    // (papers are resolved below)
  }

  _papers() {
    const z = this.zee;
    for (const p of z.papers) {
      if (p.dead) continue;
      for (const e of this.enemies) {
        if (Math.abs(p.x - e.x) < 24 && Math.abs(p.y - e.y) < 20 && e.canBeHit()) {
          p.dead = true; this._hitEnemy(e, CONFIG.zee.barrage.damage, Math.sign(p.vx), false); break;
        }
      }
    }
  }

  _shots(dt) {
    const z = this.zee, W = CONFIG.view.w;
    for (const s of this.shots) {
      s.x += s.vx * dt; s.spin += dt * 22;
      if (Math.abs(s.x - z.x) < 16 && Math.abs(s.y - z.y) < 14 && z.z < 50 && this.hurtZee(E.headsetDmg, Math.sign(s.vx), null)) s.dead = true;   // jump over it!
      if (s.x < -30 || s.x > W + 30) s.dead = true;
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  // ---------- main step ----------
  update(dt, input) {
    if (this.hitstop > 0) { this.hitstop -= dt; return; }          // freeze for a beat on impact
    const z = this.zee;
    z.update(dt, input, this.bounds);
    for (const ev of z.events.splice(0)) {
      if (ev.type === 'slam') {
        this._impact(z.x, z.y, 14, ev.dmg, '#ff5a4a', 1.5);
        this._burst(z.x, z.y, 4, 14, ['#d8d2ea', '#9b94b4'], 120, 'dust');
        this.shake = 9; this.hitstop = Math.max(this.hitstop, 0.11); sfx.thud(); try { navigator.vibrate && navigator.vibrate(50); } catch (e) { /* ok */ }
      } else if (ev.type === 'escape') { this._text(z.x, z.y, 90, 'FREE!', '#8be28b'); sfx.hit(0.7); }
    }
    if (this.test) {
      const T = this.test;
      for (const e of this.enemies) { e.testUpdate(dt, T); e.snapshot(); }
      T.step = 0; return;
    }
    for (const e of this.enemies) e.update(dt, this);
    this._zeeAttacks(); this._papers(); this._shots(dt);
    this.enemies = this.enemies.filter((e) => !e.remove);
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    this.shake = Math.max(0, this.shake - dt * 22);
    // sandbox: she gets back up after being knocked out
    if (z.state === 'defeat' && z.done) { this.reviveT += dt; if (this.reviveT > 2.2) { z.hp = CONFIG.zee.maxHp; z.z = 0; z.vz = 0; z._enter('idle'); z.invuln = 1.2; this.reviveT = 0; } }
    else this.reviveT = 0;
    // particles
    for (const p of this.parts) {
      p.t += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vz -= (p.g || 0) * dt; p.vx *= p.drag || 1;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < 0.8);
  }

  // ---------- effects ----------
  _impact(x, y, z, dmg, color, size) {
    this._burst(x, y, z, 9, [color, '#ffffff'], 190 * size, 'spark');
    this.parts.push({ type: 'ring', x, y, z, vx: 0, vz: 0, t: 0, life: 0.18, r: 22 * size, color });
    this._text(x, y, z + 20, String(dmg), color);
  }
  _burst(x, y, z, n, colors, speed, type) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = speed * (0.35 + Math.random() * 0.65);
      const dust = type === 'dust';
      this.parts.push({ type, x, y, z, vx: Math.cos(a) * s, vz: dust ? Math.abs(Math.sin(a)) * s * 0.4 : Math.sin(a) * s * 0.8, t: 0, life: dust ? 0.5 + Math.random() * 0.3 : 0.22 + Math.random() * 0.12, color: colors[i % colors.length], g: dust ? 0 : 500, drag: dust ? 0.96 : 0.9 });
    }
  }
  _text(x, y, z, text, color) { this.texts.push({ x: x + (Math.random() - 0.5) * 10, y, z, t: 0, text, color }); }

  // ---------- drawing ----------
  draw(ctx, alpha) {
    const z = this.zee;
    const list = [{ y: z.py !== undefined ? z.py + (z.y - z.py) * alpha : z.y, d: () => z.draw(ctx, alpha) }];
    for (const e of this.enemies) list.push({ y: e.py !== undefined ? e.py + (e.y - e.py) * alpha : e.y, d: () => e.draw(ctx, alpha) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.d();
    this._drawShots(ctx);
    for (const p of this.parts) this._drawPart(ctx, p);
    ctx.font = 'bold 11px ui-monospace, Consolas, monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#10101a';
    for (const t of this.texts) {
      const k = t.t / 0.8; ctx.globalAlpha = 1 - k * k;
      const yy = t.y - t.z - t.t * 34; ctx.strokeText(t.text, t.x, yy); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, yy);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    if (this.test) {                                           // labels under every enemy: id, animation, frame
      ctx.font = 'bold 7px ui-monospace, Consolas, monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = '#10101a';
      for (const e of this.enemies) {
        const t = `${e.id} ${e.animName} ${e.frame + 1}/${e.anim.frames}`;
        ctx.strokeText(t, e.x, e.y + 10); ctx.fillStyle = '#ffd9c7'; ctx.fillText(t, e.x, e.y + 10);
      }
      ctx.textAlign = 'left';
    }
  }

  _drawShots(ctx) {
    for (const s of this.shots) {
      ctx.globalAlpha = 0.5; ctx.drawImage(SOFT, s.x - 8, s.y - 2, 16, 5); ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(s.x, s.y - s.z); ctx.rotate(s.spin);
      ctx.strokeStyle = '#10101a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 6, Math.PI, 0); ctx.stroke();        // headband outline
      ctx.fillStyle = '#10101a'; ctx.fillRect(-9, -2, 5, 8); ctx.fillRect(4, -2, 5, 8);                                  // ear cups outline
      ctx.strokeStyle = '#3b3b4d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 6, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#5a5a72'; ctx.fillRect(-8, -1, 3, 6); ctx.fillRect(5, -1, 3, 6);
      ctx.restore();
    }
  }

  _drawPart(ctx, p) {
    const k = p.t / p.life, py = p.y - p.z;
    if (p.type === 'ring') {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, py, p.r * k + 3, (p.r * k + 3) * 0.7, 0, 0, 6.283); ctx.stroke();
    } else if (p.type === 'spark') {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, py); ctx.lineTo(p.x - p.vx * 0.045, py + p.vz * 0.045); ctx.stroke();
    } else {
      ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = p.color; const s = 3 + k * 5; ctx.fillRect(p.x - s / 2, py - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawHud(ctx) {
    if (this.combo >= 2) {
      const pop = 1 + Math.max(0, this.comboT - 1.45) * 2.5;
      ctx.save(); ctx.translate(CONFIG.view.w - 16, 34); ctx.scale(pop, pop); ctx.textAlign = 'right';
      ctx.font = 'bold 20px ui-monospace, Consolas, monospace'; ctx.lineWidth = 4; ctx.strokeStyle = '#10101a';
      const t = this.combo + ' HITS'; ctx.strokeText(t, 0, 0); ctx.fillStyle = this.combo >= 5 ? '#ffd24a' : '#fff'; ctx.fillText(t, 0, 0);
      ctx.restore();
    }
    ctx.fillStyle = '#c9c4dd'; ctx.font = 'bold 8px ui-monospace, Consolas, monospace';
    ctx.fillText('KO ' + this.kos, 12, 56);
  }
}
