// Level = rooms laid out end to end in one continuous world, drawn through separate parallax layers.
//
// WORLD SCALE: 1 world unit = 1 layer pixel. Zee is ~132 units tall. The visible window is 900 x 506 units.
// Vertical layout of the 506-unit-tall world:
//   Y   0 - 205   upper architecture (ceiling, tall windows)
//   Y 205 - 325   background office furniture, doors, wall details (the wall's base line is Y 325)
//   Y 325 - 485   the walkable floor band: the Y of the characters' FEET
//   Y 485 - 506   floor in front of the band (foreground decoration may sit here, never in the band)
//
// LAYERS (tracks), drawn back to front:   far (sky, skyline)  >  arch (walls, windows, floor)  >  props (furniture, doors)
//   >  [characters, effects]  >  fore (foreground decoration, in FRONT of the characters).
// Each track has a parallax speed (1 = scrolls with the world, < 1 = further away and slower, > 1 = closer and faster).
//
// ROOMS: { id, name, width, doorRight: { locked }, art: { far, arch, props, fore } }
//   art.<track> is either a function (ctx, w, h, room) that draws the room's slice of that track in room-local units
//   (temporary geometry below), or an image URL string (the final art: 1 image pixel = 1 world unit, so the Quality
//   Department's arch/props art is 1800 x 507 px; far is 1170 px wide and fore is 1908 px wide at the current speeds).
//   doorRight is the door to the NEXT room: while it is locked the player cannot pass it; no door (or unlocked) = open.
import { CONFIG } from './config.js?v=202611220038';

const C = CONFIG.camera, F = CONFIG.floor;
export const LAYER_H = 507;                       // layer height in pixels (the view shows 506.25)
const WALL_MARGIN = 40;                           // how close to a wall the characters' feet can get
const TRACKS = [
  { id: 'far',   speed: 0.30, front: false },
  { id: 'arch',  speed: 1.00, front: false },
  { id: 'props', speed: 1.00, front: false },
  { id: 'fore',  speed: 1.12, front: true },
];

export class Level {
  constructor(rooms = []) {
    this.rooms = []; this.width = 0;
    this.tracks = TRACKS.map((t) => ({ ...t, canvas: null }));
    for (const r of rooms) this.addRoom(r, false);
    this.build();
  }

  // adds a room at the end of the level (seamless: the world just continues, layers are rebuilt)
  addRoom(room, rebuild = true) {
    room.x0 = this.width; this.rooms.push(room); this.width += room.width;
    if (rebuild) this.build();
  }

  // where the player's feet may go. Rooms joined by an open (or no) door form one big space; a locked door is a wall.
  boundsFor(x) {
    let i = this.rooms.findIndex((r) => x >= r.x0 && x < r.x0 + r.width);
    if (i < 0) i = x < 0 ? 0 : this.rooms.length - 1;
    let a = i, b = i;
    while (a > 0 && !(this.rooms[a - 1].doorRight && this.rooms[a - 1].doorRight.locked)) a--;
    while (b < this.rooms.length - 1 && !(this.rooms[b].doorRight && this.rooms[b].doorRight.locked)) b++;
    return { minX: this.rooms[a].x0 + WALL_MARGIN, maxX: this.rooms[b].x0 + this.rooms[b].width - WALL_MARGIN };
  }

  roomAt(x) { return this.rooms.find((r) => x >= r.x0 && x < r.x0 + r.width) || this.rooms[this.rooms.length - 1]; }

  // renders every track into its own canvas (1 px per world unit). A track at speed s is  viewW + (levelW - viewW) * s  wide;
  // each room paints the slice of it that its part of the level scrolls past.
  build() {
    for (const t of this.tracks) {
      const wt = Math.max(C.viewW, Math.round(C.viewW + (this.width - C.viewW) * t.speed));
      const cv = document.createElement('canvas'); cv.width = wt; cv.height = LAYER_H;
      const c = cv.getContext('2d');
      const bounds = this.rooms.map((r) => Math.round(r.x0 * t.speed)); bounds.push(wt);
      this.rooms.forEach((room, i) => this._paint(c, t.id, room, bounds[i], bounds[i + 1] - bounds[i]));
      t.canvas = cv;
    }
  }
  _paint(c, id, room, u0, w) {
    const art = room.art && room.art[id];
    if (!art || w <= 0) return;
    if (typeof art === 'string') {                  // final art: an image, drawn when it has loaded
      const img = new Image();
      img.onload = () => { c.clearRect(u0, 0, w, LAYER_H); c.drawImage(img, u0, 0, w, LAYER_H); };
      img.src = art; return;
    }
    c.save(); c.translate(u0, 0); c.beginPath(); c.rect(0, 0, w, LAYER_H); c.clip(); art(c, w, LAYER_H, room); c.restore();
  }

  // ctx must already have the camera's world transform. camX = the camera's x in world units (device-pixel aligned).
  drawBack(ctx, camX) { this._draw(ctx, camX, false); }
  drawFront(ctx, camX) { this._draw(ctx, camX, true); }
  _draw(ctx, camX, front) {
    ctx.imageSmoothingEnabled = false;              // nearest-neighbour: crisp pixels, no blur between layer pixels
    for (const t of this.tracks) {
      if (t.front !== front || !t.canvas) continue;
      const sx = Math.max(0, Math.min(t.canvas.width - C.viewW, t.speed * camX));
      ctx.drawImage(t.canvas, sx, 0, C.viewW, C.viewH, camX, 0, C.viewW, C.viewH);
    }
  }
}

// ======================================================================================================================
// TEMPORARY ART: simple geometry in the right proportions, until the final level art is ready.
// ======================================================================================================================
const BASE = F.top - 2;                           // the wall's base line, where furniture stands

function farArt(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, F.top); g.addColorStop(0, '#2aa8ff'); g.addColorStop(0.6, '#8fd8ff'); g.addColorStop(1, '#e2f6ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const cloud = (x, y, s) => { ctx.fillStyle = 'rgba(255,255,255,0.96)'; for (const [dx, dy, r] of [[0, 0, 26], [30, -10, 32], [64, 0, 28], [34, 8, 30]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.283); ctx.fill(); } };
  for (let i = 0; i * 260 < w; i++) cloud(40 + i * 260 + ((i * 97) % 70), 50 + ((i * 53) % 90), 0.8 + ((i * 31) % 5) / 10);
  const cols = ['#ffb3c7', '#ffd59e', '#a8e6cf', '#c3b1ff', '#ffe9a8', '#9fd8ff'];
  for (let x = 0, i = 0; x < w; i++) {              // pastel skyline
    const bw = 60 + ((i * 37) % 50), bh = 70 + ((i * 53) % 110);
    ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(x, F.top - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let wy = F.top - bh + 10; wy < F.top - 10; wy += 16) for (let wx = x + 8; wx < x + bw - 8; wx += 14) ctx.fillRect(wx, wy, 6, 8);
    x += bw + 6;
  }
}

function archArt(ctx, w, h) {
  ctx.fillStyle = '#ffe3c8'; ctx.fillRect(0, 0, w, 205);                       // upper wall
  ctx.fillStyle = '#9ee3d6'; ctx.fillRect(0, 205, w, F.top - 205);              // lower wall (furniture band)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 203, w, 4);                        // chair rail
  ctx.fillStyle = '#f6f8ff'; ctx.fillRect(0, 0, w, 24); ctx.fillStyle = '#d7dff5'; ctx.fillRect(0, 24, w, 4);   // ceiling
  ctx.fillStyle = '#fffbe0'; for (let x = 80; x < w - 100; x += 300) ctx.fillRect(x, 6, 120, 10);                // ceiling lights
  for (let x = 70; x + 150 <= w - 40; x += 250) {                               // tall windows: glass is cut out so the far layer shows through
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 8, 40, 166, 158);
    ctx.clearRect(x, 48, 150, 140);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 73, 48, 4, 140); ctx.fillRect(x, 112, 150, 4);
    ctx.fillStyle = '#e9d5bb'; ctx.fillRect(x - 14, 196, 178, 8);
  }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, F.top - 8, w, 8); ctx.fillStyle = '#cdb99d'; ctx.fillRect(0, F.top - 2, w, 2);   // baseboard
  const fl = ctx.createLinearGradient(0, F.top, 0, h); fl.addColorStop(0, '#d9d3e8'); fl.addColorStop(1, '#c4bcd9');
  ctx.fillStyle = fl; ctx.fillRect(0, F.top, w, h - F.top);                     // floor (calm: lower contrast than the characters)
  ctx.strokeStyle = 'rgba(70,60,110,0.10)'; ctx.lineWidth = 1;
  for (let y = F.top + 32; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
  for (let x = 0; x < w; x += 90) { ctx.beginPath(); ctx.moveTo(x + 0.5, F.top); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
}

function door(ctx, x, locked) {                    // 74 x 150 units: taller than Zee (132), so it reaches above the 205 line
  ctx.fillStyle = '#7a5a46'; ctx.fillRect(x - 6, BASE - 156, 86, 156);
  ctx.fillStyle = locked ? '#e0707a' : '#4fc3d9'; ctx.fillRect(x, BASE - 150, 74, 150);
  ctx.fillStyle = '#bfeef7'; ctx.fillRect(x + 14, BASE - 128, 46, 58);
  ctx.fillStyle = '#ffd24a'; ctx.fillRect(x + 60, BASE - 72, 6, 14);
  ctx.fillStyle = '#1f9d55'; ctx.fillRect(x + 12, BASE - 176, 50, 13);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EXIT', x + 37, BASE - 166);
}
function desk(ctx, x) {                            // 140 wide, 56 tall (about 0.45 of Zee's height)
  ctx.fillStyle = '#8fb8ff'; ctx.fillRect(x - 8, BASE - 96, 6, 96);                                  // cubicle partition
  ctx.fillStyle = '#d9a066'; ctx.fillRect(x + 6, BASE - 48, 128, 48);
  ctx.fillStyle = '#b8824a'; ctx.fillRect(x + 66, BASE - 46, 2, 44);
  ctx.fillStyle = '#f2c48e'; ctx.fillRect(x, BASE - 56, 140, 8);
  ctx.fillStyle = '#c9ccd6'; ctx.fillRect(x + 60, BASE - 66, 20, 10);
  ctx.fillStyle = '#2b3a6b'; ctx.fillRect(x + 36, BASE - 106, 68, 42);
  ctx.fillStyle = '#16204a'; ctx.fillRect(x + 39, BASE - 103, 62, 36);
  const bars = ['#5fcf6a', '#e8c34a', '#e2574c', '#5fcf6a', '#5fcf6a'];                              // a little score graph on the monitor
  bars.forEach((c, i) => { const bh = 8 + ((i * 13) % 20); ctx.fillStyle = c; ctx.fillRect(x + 45 + i * 11, BASE - 70 - bh, 7, bh); });
  ctx.fillStyle = '#eef0f6'; ctx.fillRect(x + 44, BASE - 60, 52, 4);                                 // keyboard
}
function propsArt(ctx, w, h) {
  door(ctx, 70, false); door(ctx, w - 144, true);
  for (let i = 0; i < 5; i++) desk(ctx, 230 + i * 250);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(1000, 214, 190, 82); ctx.fillStyle = '#7a5a46'; ctx.fillRect(996, 210, 198, 4); ctx.fillRect(996, 296, 198, 4);   // whiteboard
  ctx.fillStyle = '#2b3a6b'; ctx.font = 'bold 15px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SCORES', 1095, 236);
  [['#5fcf6a', 120], ['#e8c34a', 96], ['#e2574c', 62], ['#5fcf6a', 138]].forEach(([c, len], i) => { ctx.fillStyle = c; ctx.fillRect(1016, 246 + i * 12, len, 8); });
  ctx.fillStyle = '#aab4cf'; ctx.fillRect(1300, BASE - 104, 58, 104); ctx.fillStyle = '#8a95b4'; for (let i = 0; i < 3; i++) ctx.fillRect(1306, BASE - 98 + i * 33, 46, 28);   // filing cabinet
  ctx.fillStyle = '#e9f4ff'; ctx.fillRect(1420, BASE - 66, 32, 66); ctx.fillStyle = '#5ab8ff'; ctx.fillRect(1424, BASE - 100, 24, 34);   // water cooler
  const poster = (x, c, t) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 216, 38, 50); ctx.fillStyle = c; ctx.font = 'bold 22px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t, x + 19, 248); };
  poster(180, '#e2574c', 'F'); poster(470, '#5fcf6a', 'A+'); poster(740, '#e8c34a', 'B'); poster(1500, '#5fcf6a', 'A');
  for (const x of [190, 1260]) { ctx.fillStyle = '#c0724a'; ctx.fillRect(x, BASE - 24, 28, 24); ctx.fillStyle = '#3fae5a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(x + 14 + (i - 2) * 7, BASE - 40 - (i % 2) * 8, 6, 18, (i - 2) * 0.3, 0, 6.283); ctx.fill(); } }   // plants
}
function foreArt(ctx, w, h) {                      // foreground: ceiling lamps at the top and a shaded floor edge at the bottom; nothing inside the fighting band
  for (let x = 140; x < w; x += 330) {
    ctx.strokeStyle = '#6b6580'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 32); ctx.stroke();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(x - 22, 50); ctx.lineTo(x - 10, 30); ctx.lineTo(x + 10, 30); ctx.lineTo(x + 22, 50); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,170,0.35)'; ctx.fillRect(x - 14, 50, 28, 4);
  }
  const g = ctx.createLinearGradient(0, F.bottom + 2, 0, h); g.addColorStop(0, 'rgba(40,30,70,0)'); g.addColorStop(1, 'rgba(40,30,70,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, F.bottom + 2, w, h - F.bottom - 2);
}

// Level 1, room 1
export function qualityDepartment() {
  return { id: 'quality', name: 'Quality Department', width: 1800, doorRight: { locked: true }, art: { far: farArt, arch: archArt, props: propsArt, fore: foreArt } };
}
