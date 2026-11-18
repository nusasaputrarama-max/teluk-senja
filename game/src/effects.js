// TELUK SENJA — lightweight sprite particles: smoke from damaged cars, dust
// kicked up by fast driving, muzzle flash, and punch impact stars. One shared
// pool of THREE.Sprites, no per-frame allocation, no network.

import * as THREE from 'three';

function softCircleTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SMOKE_TEX = softCircleTexture('rgba(120,120,120,0.85)', 'rgba(120,120,120,0)');
const DUST_TEX = softCircleTexture('rgba(200,180,140,0.7)', 'rgba(200,180,140,0)');
const FLASH_TEX = softCircleTexture('rgba(255,220,120,1)', 'rgba(255,140,40,0)');

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, transparent: true, depthWrite: false }));
      s.visible = false;
      s.userData = { life: 0, maxLife: 1, vy: 0, grow: 0, fade: 1 };
      scene.add(s);
      this.pool.push(s);
    }
    this.cursor = 0;
  }

  spawn(x, y, z, kind) {
    const s = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    const u = s.userData;
    s.visible = true;
    s.position.set(x, y, z);
    if (kind === 'smoke') {
      s.material.map = SMOKE_TEX;
      s.scale.set(1.2, 1.2, 1);
      u.maxLife = 1.4; u.vy = 2.2; u.grow = 2.4; u.fade = 0.5;
    } else if (kind === 'dust') {
      s.material.map = DUST_TEX;
      s.scale.set(0.9, 0.9, 1);
      u.maxLife = 0.8; u.vy = 0.8; u.grow = 1.8; u.fade = 0.55;
    } else if (kind === 'flash') {
      s.material.map = FLASH_TEX;
      s.scale.set(1.6, 1.6, 1);
      u.maxLife = 0.12; u.vy = 0; u.grow = 0.5; u.fade = 1;
    } else { // spark: small bright hit star
      s.material.map = FLASH_TEX;
      s.scale.set(0.8, 0.8, 1);
      u.maxLife = 0.25; u.vy = 1.5; u.grow = 0.3; u.fade = 1;
    }
    u.life = u.maxLife;
    s.material.opacity = u.fade;
    s.material.needsUpdate = false;
  }

  smoke(x, y, z) { this.spawn(x, y, z, 'smoke'); }
  dust(x, y, z) { this.spawn(x, y, z, 'dust'); }
  flash(x, y, z) { this.spawn(x, y, z, 'flash'); }
  spark(x, y, z) { this.spawn(x, y, z, 'spark'); }

  update(dt) {
    for (const s of this.pool) {
      if (!s.visible) continue;
      const u = s.userData;
      u.life -= dt;
      if (u.life <= 0) { s.visible = false; continue; }
      s.position.y += u.vy * dt;
      const k = 1 + u.grow * dt;
      s.scale.x *= k;
      s.scale.y *= k;
      s.material.opacity = u.fade * (u.life / u.maxLife);
    }
  }
}
