// TELUK SENJA — wanted level and police: stars rise on crime, police cars and
// foot cops chase the player, getting caught means BUSTED (lose cash, respawn).

import * as THREE from 'three';
import { WANTED } from './config.js';
import { makeCarMesh, Car } from './vehicles.js';

export class Police {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.wanted = 0;
    this.heat = 0; // seconds since last crime
    this.cops = []; // {mesh, x, z, heading, speed}
    this.cars = []; // Car instances (police)
    this.bustedTimer = 0;
    this.spawnTimer = 0;
  }

  addWanted(n, playerPos, onCrime) {
    const before = this.wanted;
    this.wanted = Math.min(WANTED.max, this.wanted + n);
    this.heat = 0;
    if (this.wanted > before && onCrime) onCrime(this.wanted);
    this.syncUnits(playerPos);
  }

  // Make sure the right number of police units exist for the wanted level.
  syncUnits(playerPos) {
    const [foot, cars] = WANTED.policePerLevel[this.wanted] || [0, 0];
    while (this.cops.length < foot) this.spawnFootCop(playerPos);
    while (this.cars.length < cars) this.spawnPoliceCar(playerPos);
    // Extra units stay until wanted drops (they drive off when cleared).
  }

  spawnFootCop(playerPos) {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x1c3a6b }),
    );
    body.position.y = 1.1;
    mesh.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.4, 0.38),
      new THREE.MeshLambertMaterial({ color: 0xc98a5a }),
    );
    head.position.y = 1.75;
    mesh.add(head);
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.12, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x101418 }),
    );
    hat.position.y = 1.98;
    mesh.add(hat);
    const angle = Math.random() * Math.PI * 2;
    const dist = 26 + Math.random() * 14;
    const x = playerPos.x + Math.sin(angle) * dist;
    const z = playerPos.z + Math.cos(angle) * dist;
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.cops.push({ mesh, x, z, heading: 0, speed: 6.5, health: 3, downTimer: 0 });
  }

  spawnPoliceCar(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 34 + Math.random() * 16;
    const x = playerPos.x + Math.sin(angle) * dist;
    const z = playerPos.z + Math.cos(angle) * dist;
    const mesh = makeCarMesh(0xf2f2f2, true);
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, Math.random() * Math.PI * 2, { isPolice: true });
    this.cars.push(car);
  }

  // Damage a foot cop: 3 hits knock him down for a while, then he gets up.
  // Returns true when this hit knocked him down.
  damageCop(cop, n = 1) {
    if (!cop || cop.downTimer > 0) return false;
    cop.health -= n;
    if (cop.health > 0) return false;
    cop.downTimer = 20;
    cop.mesh.rotation.z = Math.PI / 2;
    cop.mesh.position.y = 0.4;
    return true;
  }

  clearUnits() {
    for (const c of this.cops) this.scene.remove(c.mesh);
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cops = [];
    this.cars = [];
  }

  // Returns 'busted' when a cop catches the player on foot, else null.
  update(dt, player, playerCar, onBusted) {
    if (this.wanted === 0) {
      // Stragglers drive off.
      if (this.cops.length || this.cars.length) this.clearUnits();
      return null;
    }
    this.heat += dt;
    if (this.heat > WANTED.decaySeconds) {
      this.wanted = Math.max(0, this.wanted - 1);
      this.heat = 0;
      this.syncUnits(player);
      if (this.wanted === 0) this.clearUnits();
    }
    const px = playerCar ? playerCar.x : player.x;
    const pz = playerCar ? playerCar.z : player.z;
    // Foot cops run at the player; catching on foot = busted. They slide
    // around buildings instead of running straight through them, and a
    // knocked-down cop stays down until he gets back up.
    for (const cop of this.cops) {
      if (cop.downTimer > 0) {
        cop.downTimer -= dt;
        if (cop.downTimer <= 0) {
          cop.health = 3;
          cop.mesh.rotation.z = 0;
          cop.mesh.position.y = 0;
        }
        continue;
      }
      const dx = px - cop.x;
      const dz = pz - cop.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        cop.heading = Math.atan2(dx, dz);
        let nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
        let nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
        const fixed = this.world.resolveBuildings(nx, nz, 0.5);
        cop.x = fixed.x;
        cop.z = fixed.z;
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      if (!playerCar && d < 1.4) {
        return 'busted';
      }
    }
    // Police cars chase and ram the player's car (or the player on foot, slowly).
    // Far away they route along the road grid instead of driving through
    // buildings: if the straight line to the player is blocked, aim for the
    // nearest road intersection on the player's side first.
    for (const car of this.cars) {
      const dx = px - car.x;
      const dz = pz - car.z;
      const d = Math.hypot(dx, dz);
      let tx = px;
      let tz = pz;
      if (d > 45) {
        const steps = Math.ceil(d / 6);
        let blocked = false;
        for (let i = 1; i < steps; i++) {
          const sx = car.x + (dx * i) / steps;
          const sz = car.z + (dz * i) / steps;
          if (this.world.hitsBuilding(sx, sz, 2.2)) { blocked = true; break; }
        }
        if (blocked) {
          const lines = this.world.lineCenters;
          const nearest = (v) => lines.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
          tx = nearest(px);
          tz = nearest(pz);
        }
      }
      const tdx = tx - car.x;
      const tdz = tz - car.z;
      const wantHeading = Math.atan2(tdx, tdz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      const speed = d < 6 ? 14 : 26;
      car.speed = speed;
      const f = car.forward();
      car.x += f.x * speed * dt;
      car.z += f.z * speed * dt;
      // Ram: shove the player's car.
      if (playerCar && d < 4.5) {
        const push = 9 * dt;
        playerCar.x += (dx / (d || 1)) * push;
        playerCar.z += (dz / (d || 1)) * push;
        playerCar.speed *= 0.94;
      }
      // Light bar flash.
      if (car.mesh.userData.lightBar) {
        car.mesh.userData.lightBar.material.color.setHex(
          Math.floor(performance.now() / 300) % 2 === 0 ? 0x2244ff : 0xff2222,
        );
      }
      car.updateMesh();
    }
    return null;
  }
}
