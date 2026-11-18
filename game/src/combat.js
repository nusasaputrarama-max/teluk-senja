// TELUK SENJA — combat: a punch and a pistol. Hitscan shots with a tracer
// line, a short cooldown, and damage that makes pedestrians flee and cops angry.

import * as THREE from 'three';

export class Combat {
  constructor(scene, sound) {
    this.scene = scene;
    this.sound = sound;
    this.ammo = 12;
    this.punchCooldown = 0;
    this.shotCooldown = 0;
    this.tracer = null;
    this.tracerTimer = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this.tracer.visible = false;
    this.tracer.frustumCulled = false;
    scene.add(this.tracer);
  }

  update(dt) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0) this.tracer.visible = false;
    }
  }

  // Melee: hits the nearest pedestrian or cop within 2.2 units in front.
  punch(playerPos, heading, crowd, cops) {
    if (this.punchCooldown > 0) return null;
    this.punchCooldown = 0.45;
    this.sound.punch();
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const hit = (x, z) => {
      const dx = x - playerPos.x;
      const dz = z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.4) return false;
      const dot = (dx * fx + dz * fz) / (d || 1);
      return dot > 0.3;
    };
    const ped = crowd ? crowd.nearest(playerPos.x, playerPos.z, 2.4) : null;
    if (ped && hit(ped.x, ped.z)) {
      ped.fleeFrom(playerPos.x, playerPos.z);
      return { type: 'ped', target: ped };
    }
    if (cops) {
      for (const cop of cops) {
        if (hit(cop.x, cop.z)) return { type: 'cop', target: cop };
      }
    }
    return { type: 'whiff' };
  }

  // Hitscan pistol: fires from the player toward the aim direction (camera yaw).
  // Returns {hit: 'ped'|'cop'|'car'|null, point}.
  shoot(playerPos, aimYaw) {
    if (this.shotCooldown > 0) return null;
    if (this.ammo <= 0) {
      this.shotCooldown = 0.3;
      this.sound.blip(220, 0.06, 'square', 0.08);
      return { type: 'empty' };
    }
    this.shotCooldown = 0.35;
    this.ammo -= 1;
    this.sound.gunshot();
    const fx = -Math.sin(aimYaw);
    const fz = -Math.cos(aimYaw);
    const range = 60;
    const end = {
      x: playerPos.x + fx * range,
      y: 1.4,
      z: playerPos.z + fz * range,
    };
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, playerPos.x, 1.4, playerPos.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.visible = true;
    this.tracerTimer = 0.12;
    return { type: 'shot', end };
  }

  addAmmo(n) {
    this.ammo += n;
  }
}
