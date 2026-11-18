// TELUK SENJA — cars: procedural low-poly models, arcade driving, traffic AI.
// A car is a group: body, cabin, wheels, headlights. Traffic follows road loops.

import * as THREE from 'three';
import { CAR, WORLD } from './config.js';

const CAR_COLORS = [0xc23a3a, 0x3a7ac2, 0xd8a23a, 0x3ac27a, 0x8a8a8a, 0x2a2a2e, 0xe8e0d0, 0x7a3ac2];

export function makeCarMesh(color, isPolice = false, isVan = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  if (isVan) {
    // Box van: tall cargo box behind a short cab (the tail-mission target).
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.9, 3.2), bodyMat);
    cargo.position.set(0, 1.25, -0.8);
    cargo.castShadow = true;
    g.add(cargo);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 1.0, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x8a8a8a }),
    );
    cab.position.set(0, 0.8, 1.4);
    cab.castShadow = true;
    g.add(cab);
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x9fc4d8 }),
    );
    windshield.position.set(0, 1.05, 2.12);
    g.add(windshield);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.55, 2.2),
      new THREE.MeshLambertMaterial({ color: isPolice ? 0xdddddd : 0x2a3a4a }),
    );
    cabin.position.set(0, 1.1, -0.2);
    cabin.castShadow = true;
    g.add(cabin);
    // Glass: a lighter windshield strip on the cabin front.
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.34, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x9fc4d8 }),
    );
    glass.position.set(0, 1.12, 0.92);
    g.add(glass);
    // Front grille + bumper.
    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.16, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1e }),
    );
    grille.position.set(0, 0.5, 2.22);
    g.add(grille);
    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.14, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2e }),
    );
    bumper.position.set(0, 0.32, 2.2);
    g.add(bumper);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), headMat);
    h.position.set(x, 0.55, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const tailZ = isVan ? -2.44 : -2.22; // van cargo box is longer than a sedan
  for (const x of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), tailMat);
    t.position.set(x, 0.55, tailZ);
    g.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    bar.position.set(0, 1.5, -0.2);
    g.add(bar);
    g.userData.lightBar = bar;
  }
  // Wheels with hubcaps.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.32, 8);
  const hubMat = new THREE.MeshLambertMaterial({ color: 0xb8b8c0 });
  g.userData.wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.36, z);
    g.add(hub);
    g.userData.wheels.push(w);
  }
  return g;
}

export class Car {
  constructor(mesh, x, z, heading, opts = {}) {
    this.mesh = mesh;
    this.x = x;
    this.z = z;
    this.heading = heading; // radians, 0 = facing -z? we use +z forward via sin/cos
    this.speed = 0;
    this.isPolice = !!opts.isPolice;
    this.isPlayer = !!opts.isPlayer;
    this.isTraffic = !!opts.isTraffic;
    this.isVan = !!opts.isVan;
    this.color = opts.color || 0xffffff;
    this.loop = opts.loop || null;
    this.loopIndex = opts.loopIndex || 0;
    this.loopSpeed = opts.loopSpeed || 8;
    this.stolen = false;
    this.driver = opts.driver !== false; // NPC cars have a driver until stolen
    this.damage = 0; // 0-100; >40 smokes, >70 slows the car
    this.smokeTimer = 0;
    this.updateMesh();
  }

  // Damage from a hit; returns the new damage level.
  addDamage(n) {
    this.damage = Math.min(100, this.damage + n);
    return this.damage;
  }

  get topSpeed() {
    if (this.damage > 70) return CAR.maxSpeed * 0.55;
    if (this.damage > 40) return CAR.maxSpeed * 0.8;
    return CAR.maxSpeed;
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  updateMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016;
    for (const w of this.mesh.userData.wheels || []) w.rotation.x += spin;
  }

  // Arcade driving: throttle -1..1, steer -1..1, dt seconds.
  drive(throttle, steer, dt) {
    const accel = throttle > 0 ? CAR.accel * throttle : CAR.brake * throttle;
    this.speed += accel * dt;
    // Drag + rolling resistance.
    this.speed -= this.speed * CAR.drag * dt;
    if (this.speed > this.topSpeed) this.speed = this.topSpeed;
    if (this.speed < -CAR.maxReverse) this.speed = -CAR.maxReverse;
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    // Steering scales with speed, reverses when reversing.
    const steerAmount = steer * CAR.steer * dt * Math.min(1, Math.abs(this.speed) / 8) * Math.sign(this.speed || 1);
    this.heading += steerAmount;
    const f = this.forward();
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    this.updateMesh();
  }

  // Traffic: follow the assigned loop of waypoints, slow near the player car.
  updateTraffic(dt, world, playerCar) {
    if (!this.loop || this.loop.length === 0) return;
    const target = this.loop[this.loopIndex];
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) {
      this.loopIndex = (this.loopIndex + 1) % this.loop.length;
      return;
    }
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    // Slow down if the player's car is right ahead.
    let speed = this.loopSpeed;
    if (playerCar) {
      const pdx = playerCar.x - this.x;
      const pdz = playerCar.z - this.z;
      const pd = Math.hypot(pdx, pdz);
      const ahead = (pdx * Math.sin(this.heading) + pdz * Math.cos(this.heading)) / (pd || 1);
      if (pd < 10 && ahead > 0.6) speed = 0;
    }
    const f = this.forward();
    this.x += f.x * speed * dt;
    this.z += f.z * speed * dt;
    this.speed = speed;
    this.updateMesh();
  }
}

export function randomCarColor(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}
