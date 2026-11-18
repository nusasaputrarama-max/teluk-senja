// TELUK SENJA — HUD: wanted stars, cash, health, speed, objective text,
// message toasts, and a live minimap canvas (roads, sea, player, cars,
// police, mission marker).

import { WORLD } from './config.js';

export class Hud {
  constructor(world) {
    this.world = world;
    this.el = {};
    for (const id of ['wanted', 'cash', 'health-fill', 'health-text', 'speed', 'objective', 'objective-title', 'toast', 'hint', 'minimap']) {
      this.el[id] = document.getElementById(id);
    }
    this.map = this.el.minimap.getContext('2d');
    this.toastTimer = null;
  }

  setWanted(n) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < n ? '★' : '☆';
    this.el.wanted.textContent = stars;
    this.el.wanted.style.color = n >= 3 ? '#ff4040' : '#ffd23a';
  }

  setCash(n) {
    this.el.cash.textContent = '$' + n.toLocaleString('en-US');
  }

  setHealth(h, max) {
    const pct = Math.max(0, Math.round((h / max) * 100));
    this.el['health-fill'].style.width = pct + '%';
    this.el['health-text'].textContent = pct;
    this.el['health-fill'].style.background = pct > 50 ? '#3ac27a' : pct > 25 ? '#d8a23a' : '#ff4040';
  }

  setSpeed(kmh, driving) {
    this.el.speed.textContent = driving ? Math.round(Math.abs(kmh)) + ' km/h' : '';
  }

  setObjective(title, text) {
    this.el['objective-title'].textContent = title;
    this.el.objective.textContent = text;
  }

  toast(text, ms = 3500) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.toast.style.opacity = '0';
    }, ms);
  }

  setHint(text) {
    this.el.hint.textContent = text;
  }

  // Minimap: north is -z (up on the canvas).
  drawMinimap(playerPos, playerHeading, cars, policeCars, cops, missionTarget, spots) {
    const ctx = this.map;
    const S = 180; // canvas pixels
    const H = WORLD.half;
    const toMap = (x, z) => [(x + H) / (H * 2) * S, (z + H) / (H * 2) * S];
    ctx.clearRect(0, 0, S, S);
    // Sea (west strip) + land.
    ctx.fillStyle = '#123a52';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#2e4632';
    const [bx] = toMap(WORLD.beachX, 0);
    ctx.fillRect(bx, 0, S - bx, S);
    // Beach.
    ctx.fillStyle = '#d9b98a';
    const [sx] = toMap(WORLD.seaX, 0);
    ctx.fillRect(sx, 0, bx - sx, S);
    // Roads.
    ctx.strokeStyle = '#555050';
    ctx.lineWidth = 3;
    for (const c of this.world.lineCenters) {
      const [mx] = toMap(c, 0);
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, S); ctx.stroke();
      const [, mz] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(0, mz); ctx.lineTo(S, mz); ctx.stroke();
    }
    // Mission target.
    if (missionTarget) {
      const [x, y] = toMap(missionTarget.x, missionTarget.z);
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#14101c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Traffic cars (white dots), police (blue/red), cops (blue).
    const dot = (x, z, color, r = 2.5) => {
      const [mx, mz] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI * 2); ctx.fill();
    };
    for (const car of cars) dot(car.x, car.z, '#e8e8e8');
    for (const car of policeCars) dot(car.x, car.z, '#2244ff', 3.5);
    for (const cop of cops) dot(cop.x, cop.z, '#66aaff', 2.5);
    // Player arrow (orange triangle, rotated to heading).
    const [px, py] = toMap(playerPos.x, playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(playerHeading), Math.cos(playerHeading)) * -1 + Math.PI);
    ctx.fillStyle = '#ff7a3a';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
