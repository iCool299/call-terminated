// Game shell: loads Zee, runs the loop, draws the placeholder office + HUD, wires pause / touch UI / animation viewer.
import { CONFIG } from './config.js?v=202611212040';
import { loadCharacter, VERSION, LOOK } from './assets.js?v=202611212040';
import { Input } from './input.js?v=202611212040';
import { Zee } from './zee.js?v=202611212040';
import { Game } from './game.js?v=202611212040';
import { ENEMY_IDS } from './enemy.js?v=202611212040';
import { unlock } from './sfx.js?v=202611212040';

const { w: W, h: H } = CONFIG.view;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const bg = document.createElement('canvas');      // the static office is painted once, then just blitted
const bgCtx = bg.getContext('2d');
let k = 1;                                        // internal pixels per game pixel (canvas renders at display resolution)

const $ = (id) => document.getElementById(id);
const loadedEnemyChars = [];
const input = new Input(document);
let character, zee, game;
const enemyChars = new Map();                     // id -> Promise<character>, loaded on demand (and preloaded in the background)
let paused = false;
let last = performance.now();

// ---------- layout: fit the 16:9 stage to any screen ----------
function resize() {
  const vw = innerWidth, vh = innerHeight;
  let s = Math.min(vw / W, vh / H);
  if (s >= 2) s = Math.floor(s * 2) / 2;          // keep pixels crisp on big screens
  const cssW = Math.round(W * s), cssH = Math.round(H * s);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  document.body.classList.toggle('portrait', vh > vw && vw < 700);
  // render at the real screen resolution (capped) so movement is sub-pixel smooth, not snapped to 640x360 steps
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cw = Math.max(W, Math.min(1920, Math.round(cssW * dpr)));
  k = cw / W;
  if (character) character.px = k;       // device pixels per game unit, used to snap sprites to whole pixels
  for (const c of loadedEnemyChars) c.px = k;
  canvas.width = cw; canvas.height = Math.round(H * k);
  bg.width = canvas.width; bg.height = canvas.height;
  ctx.imageSmoothingEnabled = false;
  bgCtx.imageSmoothingEnabled = false;
  bgCtx.setTransform(k, 0, 0, k, 0, 0);
  drawScene(bgCtx);
}
addEventListener('resize', resize); addEventListener('orientationchange', resize); resize();

// ---------- stop iOS/Android page zoom (double-tap, pinch) and rubber-band scrolling ----------
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
let lastTap = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTap < 350) e.preventDefault();      // second tap of a double-tap
  lastTap = now;
}, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !e.target.closest('#viewer')) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---------- touch UI ----------
const isTouch = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
document.body.classList.toggle('touch', isTouch);
const cdButtons = { special: $('btn-special'), dodge: $('btn-dodge') };

// ---------- pause ----------
function setPaused(p) { paused = p; $('pause-screen').hidden = !p; }
$('btn-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); setPaused(!paused); });
$('resume').addEventListener('click', () => setPaused(false));
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

// ---------- animation viewer drawer ----------
function buildViewer() {
  const list = $('anim-list');
  for (const name of Object.keys(character.anims)) {
    const b = document.createElement('button');
    b.textContent = name; b.dataset.n = name;
    b.addEventListener('click', () => {
      zee.viewer = { name, loop: true }; zee.z = 0; zee.invuln = 0;
      list.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    });
    list.appendChild(b);
  }
  $('viewer-exit').addEventListener('click', () => { zee.viewer = null; zee._enter('idle'); list.querySelectorAll('button').forEach((x) => x.classList.remove('on')); });
  $('viewer-flip').addEventListener('click', () => { zee.face *= -1; });
  $('btn-viewer').addEventListener('click', () => { $('viewer').classList.toggle('open'); });
  $('viewer-close').addEventListener('click', () => $('viewer').classList.remove('open'));
}

// ---------- scene ----------
function drawScene(ctx) {
  const F = CONFIG.floor;
  const g = ctx.createLinearGradient(0, 0, 0, F.top);
  g.addColorStop(0, '#323752'); g.addColorStop(1, '#474d6c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, F.top);
  for (let x = 24; x < W; x += 112) {          // windows
    ctx.fillStyle = '#272b40'; ctx.fillRect(x, 38, 72, 92);
    ctx.fillStyle = '#6e79a8'; ctx.fillRect(x + 4, 42, 64, 84);
    ctx.fillStyle = '#8791bd'; ctx.fillRect(x + 4, 42, 64, 10);
  }
  ctx.fillStyle = '#585369'; ctx.fillRect(0, F.top - 8, W, 8);
  ctx.fillStyle = '#7a7186'; ctx.fillRect(0, F.top, W, H - F.top);
  ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 1;
  for (let y = F.top + 28; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x + .5, F.top); ctx.lineTo(x + .5, H); ctx.stroke(); }
}

let hudGhost = 1;                                   // the white "recent damage" chunk that drains after a hit
function drawHud() {
  const x = 12, y = 10, bw = 150, bh = 9, k = 1 / 1;
  const pct = Math.max(0, zee.hp / CONFIG.zee.maxHp);
  hudGhost = Math.max(pct, hudGhost - 0.012); if (hudGhost < pct) hudGhost = pct;
  ctx.font = 'bold 9px ui-monospace, Consolas, monospace'; ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = '#10101a';
  // name
  ctx.strokeText('ZEE', x, y + 7); ctx.fillStyle = '#ffffff'; ctx.fillText('ZEE', x, y + 7);
  // health bar: frame, dark trough, white damage trail, colour fill with a light top line, HP number inside on the right
  const by = y + 11;
  ctx.fillStyle = zee.flash > 0 ? '#ff6a5a' : '#10101a'; ctx.fillRect(x - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#2a1d27'; ctx.fillRect(x, by, bw, bh);
  ctx.fillStyle = '#f3e9ea'; ctx.fillRect(x, by, Math.round(bw * hudGhost), bh);
  const col = pct > 0.5 ? '#5fcf6a' : pct > 0.25 ? '#e8c34a' : '#e2574c';
  ctx.fillStyle = col; ctx.fillRect(x, by, Math.round(bw * pct), bh);
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, by, Math.round(bw * pct), 2);
  ctx.font = 'bold 8px ui-monospace, Consolas, monospace'; ctx.textAlign = 'right'; ctx.lineWidth = 3;
  const hp = String(Math.ceil(zee.hp)); ctx.strokeText(hp, x + bw - 2, by + bh - 1); ctx.fillStyle = '#ffffff'; ctx.fillText(hp, x + bw - 2, by + bh - 1);
  // special meter: labelled, fills while charging, pulses when ready
  const sy = by + bh + 6, sw = 96, sp = Math.min(1, 1 - zee.cd.special / CONFIG.zee.specialCooldown);
  ctx.fillStyle = '#10101a'; ctx.fillRect(x - 2, sy - 2, sw + 4, 8);
  ctx.fillStyle = '#231f33'; ctx.fillRect(x, sy, sw, 4);
  const pulse = sp >= 1 ? 0.65 + 0.35 * Math.sin(performance.now() / 160) : 1;
  ctx.globalAlpha = pulse; ctx.fillStyle = sp >= 1 ? '#ff8a5c' : '#8a7fc9'; ctx.fillRect(x, sy, Math.round(sw * sp), 4); ctx.globalAlpha = 1;
  ctx.textAlign = 'left'; ctx.font = 'bold 7px ui-monospace, Consolas, monospace'; ctx.lineWidth = 3;
  const lab = sp >= 1 ? 'SPECIAL READY  [SPACE]' : 'SPECIAL';
  ctx.strokeText(lab, x + sw + 8, sy + 5); ctx.fillStyle = sp >= 1 ? '#ffc2a6' : '#b7b0d6'; ctx.fillText(lab, x + sw + 8, sy + 5);
}
const cdCache = {};
function updateButtons() {       // only touch the DOM when a value actually changed (style writes are expensive on phones)
  for (const [name, el] of Object.entries(cdButtons)) {
    const total = { special: CONFIG.zee.specialCooldown, dodge: CONFIG.zee.dodgeCooldown }[name];
    const left = zee.cd[name] / total;
    const deg = Math.round(left * 120) * 3;     // 3-degree steps
    if (cdCache[name] === deg) continue;
    cdCache[name] = deg;
    el.style.setProperty('--cd', deg + 'deg');
    el.classList.toggle('cooling', left > 0);
  }
}

// ---------- enemies: spawn button ----------
function enemyChar(id) {
  if (!enemyChars.has(id)) {
    enemyChars.set(id, loadCharacter(`assets/characters/${id}/`, id).then((c) => { c.px = k; loadedEnemyChars.push(c); return c; }));
  }
  return enemyChars.get(id);
}
function setupSpawner() {
  const btn = $('btn-spawn');
  let lastId = '';
  const spawn = async () => {
    unlock();
    const pool = ENEMY_IDS.filter((i) => i !== lastId);
    const id = pool[Math.floor(Math.random() * pool.length)]; lastId = id;
    try { game.spawn(id, await enemyChar(id)); } catch (err) { console.error(err); }
  };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); spawn(); });
  btn.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });     // Space is the special attack, not a button press
  btn.tabIndex = -1;
  // warm the cache one by one in the background so the first spawn of each type is instant
  (async () => { for (const id of ENEMY_IDS) { try { await enemyChar(id); } catch (e) { /* loaded on demand later */ } } })();
  addEventListener('pointerdown', unlock, { once: true }); addEventListener('keydown', unlock, { once: true });
  window.__spawn = (id) => enemyChar(id).then((c) => game.spawn(id, c));
  // V: toggle the lit "finish" pass (outline, rim light, foot shading, scene wash, colour grade) to compare before / after
  addEventListener('keydown', (e) => { if (e.key === 'v' || e.key === 'V') { LOOK.on = !LOOK.on; window.__look = LOOK.on; } });
  window.__LOOK = LOOK;
}

// ---------- game modes: Battle (default) / Animation test ----------
function setupModes() {
  const tgt = $('t-target'), anims = $('t-anims'), spd = $('t-speed');
  const chip = (parent, label, on, fn) => { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', () => { fn(b); }); parent.appendChild(b); return b; };
  const mark = (parent, b) => parent.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  const targets = {};
  targets.all = chip(tgt, 'all', true, (b) => { game.test.target = 'all'; mark(tgt, b); });
  targets.all.classList.add('on');
  for (const id of ENEMY_IDS) targets[id] = chip(tgt, id, false, (b) => { game.test.target = id; mark(tgt, b); });
  for (const s of [0.1, 0.25, 0.5, 1]) { const b = chip(spd, s + 'x', s === 1, (bb) => { game.test.speed = s; mark(spd, bb); }); if (s === 1) b.classList.add('on'); }
  $('t-pause').addEventListener('click', () => { game.test.paused = !game.test.paused; $('t-pause').textContent = game.test.paused ? 'Play' : 'Pause'; });
  $('t-prev').addEventListener('click', () => { game.test.paused = true; $('t-pause').textContent = 'Play'; game.test.step = -1; });
  $('t-next').addEventListener('click', () => { game.test.paused = true; $('t-pause').textContent = 'Play'; game.test.step = 1; });
  $('t-flip').addEventListener('click', () => { for (const e of game.enemies) e.face *= -1; });
  $('t-reset').addEventListener('click', () => enterTest());
  let animBtns = [];
  async function enterTest() {
    const chars = [];
    for (const id of ENEMY_IDS) chars.push([id, await enemyChar(id)]);
    game.enterTest(chars);
    const names = [];                                       // every animation any enemy has, in a sensible order
    const order = ['idle', 'walk', 'punch', 'kick', 'throw_headset', 'hurt', 'knockdown', 'get_up', 'defeat', 'grab', 'hold', 'throw'];
    for (const [, c] of chars) for (const n of Object.keys(c.anims)) if (!names.includes(n)) names.push(n);
    names.sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
    anims.textContent = ''; animBtns = [];
    for (const n of names) {
      const b = chip(anims, n, false, () => { game.testSet(n); mark(anims, b); });
      b.title = chars.filter(([, c]) => c.anims[n]).map(([id]) => id).join(', '); animBtns.push(b);
    }
    mark(anims, animBtns[0]);
    $('t-pause').textContent = 'Pause';
  }
  function setMode(test) {
    document.body.classList.toggle('testmode', test);
    $('btn-mode').innerHTML = test ? 'Mode: Animation test &#8644;' : 'Mode: Battle &#8644;';
    history.replaceState(null, '', test ? '?mode=test' : location.pathname);
    if (test) enterTest(); else { game.exitTest(); zee.x = W / 2; zee.y = 292; }
  }
  $('btn-mode').addEventListener('click', () => setMode(!game.test));
  $('btn-mode').tabIndex = -1;
  if (new URLSearchParams(location.search).get('mode') === 'test') setMode(true);
  window.__test = { set: (n, t) => game.testSet(n, t), state: () => game.test, enemies: () => game.enemies.map((e) => ({ id: e.id, anim: e.animName, frame: e.frame, frames: e.anim.frames, face: e.face })) };
}

// ---------- loop ----------
// Logic runs on a fixed 120 Hz step (same behaviour on any device); drawing runs every display refresh
// and interpolates between logic steps, so 60 / 90 / 120 / 144 Hz screens all look smooth.
const bounds = { minX: 40, maxX: W - 40, minY: CONFIG.floor.top + 14, maxY: CONFIG.floor.bottom };
const STEP = CONFIG.simStep;
let acc = 0, readoutText = '';
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;                       // tab was throttled: don't fast-forward
  const actions = input.queue;
  if (actions.includes('pause')) { input.queue = actions.filter((a) => a !== 'pause'); setPaused(!paused); }
  if (paused) { input.consume(); acc = 0; }
  else {
    acc += dt;
    while (acc >= STEP) { game.snapshot(); game.update(STEP, input); acc -= STEP; }
  }
  const sx = game.shake > 0 ? (Math.random() - 0.5) * 2 * game.shake : 0, sy = game.shake > 0 ? (Math.random() - 0.5) * 2 * game.shake : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, Math.round(sx * k), Math.round(sy * k));
  ctx.drawImage(bg, 0, 0);
  ctx.setTransform(k, 0, 0, k, Math.round(sx * k), Math.round(sy * k));
  game.draw(ctx, paused ? 1 : acc / STEP);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawHud(); game.drawHud(ctx); updateButtons();
  const text = `${zee.viewer ? 'viewer' : zee.state} | ${zee.animName} ${zee.frame + 1}/${zee.anim.frames} | v${VERSION}`;
  if (text !== readoutText) { readoutText = text; $('readout').textContent = text; }
  requestAnimationFrame(frame);
}

(async function boot() {
  try {
    character = await loadCharacter('assets/characters/zee/');
    character.px = k;
    zee = new Zee(character, W / 2, 292);
    game = new Game(zee, bounds);
    buildViewer();
    setupSpawner();
    setupModes();
    $('loading').remove();
    requestAnimationFrame((t) => { last = t; frame(t); });
    window.__zee = zee; window.__input = input; window.__game = game;     // handy for debugging in the console
  } catch (err) {
    $('loading').textContent = 'Could not load assets: ' + err.message + ' (run through a local web server)';
  }
})();
