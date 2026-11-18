// TELUK SENJA — pedestrians: simple walkers on the sidewalks who wander,
// cross at corners, and flee when the player commits a crime nearby.

import * as THREE from 'three';

const SHIRTS = [0x3a7ac2, 0xc23a6b, 0x3ac27a, 0xd8d8d8, 0x7a3ac2, 0xc2a23a];

function makePedMesh(shirtColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xb98a62 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3), shirt);
  torso.position.y = 1.08;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), skin);
  head.position.y = 1.6;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.14, 0.35, 0);
  g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export class Pedestrian {
  constructor(scene, x, z, rng) {
    this.mesh = makePedMesh(SHIRTS[Math.floor(rng() * SHIRTS.length)]);
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.heading = rng() * Math.PI * 2;
    this.speed = 1.2 + rng() * 1.2;
    this.phase = rng() * 10;
    this.state = 'walk'; // walk | flee
    this.fleeTimer = 0;
    this.retargetTimer = 1 + rng() * 3;
    this.alive = true;
    this.updateMesh();
  }

  updateMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const s = Math.sin(this.phase) * 0.5;
    this.mesh.userData.legL.rotation.x = s;
    this.mesh.userData.legR.rotation.x = -s;
  }

  fleeFrom(x, z) {
    this.state = 'flee';
    this.fleeTimer = 3;
    const dx = this.x - x;
    const dz = this.z - z;
    this.heading = Math.atan2(dx, dz);
  }

  update(dt, world, playerPos, cars = []) {
    if (!this.alive) return;
    this.phase += dt * 6;
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) this.state = 'walk';
    } else {
      this.retargetTimer -= dt;
      if (this.retargetTimer <= 0) {
        this.retargetTimer = 2 + Math.random() * 4;
        // Mostly keep walking along the street grid; sometimes turn.
        const turn = (Math.random() - 0.5) * Math.PI;
        this.heading += turn;
      }
      // A fast car bearing down: step away from its path instead of
      // standing in the road waiting to be run over.
      for (const car of cars) {
        if (Math.abs(car.speed || 0) < 5) continue;
        const dx = this.x - car.x;
        const dz = this.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d > 9) continue;
        const fx = Math.sin(car.heading);
        const fz = Math.cos(car.heading);
        // dot > 0: the car's nose points at the pedestrian (closing in).
        const approaching = (dx * fx + dz * fz) / (d || 1);
        if (d < 5 || approaching > 0.4) {
          this.fleeFrom(car.x, car.z);
          break;
        }
      }
    }
    const speed = this.state === 'flee' ? 5.5 : this.speed;
    let nx = this.x + Math.sin(this.heading) * speed * dt;
    let nz = this.z + Math.cos(this.heading) * speed * dt;
    const fixed = world.resolveBuildings(nx, nz, 0.5);
    nx = fixed.x;
    nz = fixed.z;
    const clamped = world.clampToWorld(nx, nz, 2);
    // If blocked by a building, turn around.
    if (Math.abs(clamped.x - nx) > 0.01 || Math.abs(clamped.z - nz) > 0.01) {
      this.heading += Math.PI / 2;
    }
    this.x = clamped.x;
    this.z = clamped.z;
    this.updateMesh();
  }
}

export class PedestrianCrowd {
  constructor(scene, world, count, rng) {
    this.scene = scene;
    this.world = world;
    this.peds = [];
    const lines = world.lineCenters;
    for (let i = 0; i < count; i++) {
      // Spawn on a sidewalk next to a random road.
      const vertical = rng() < 0.5;
      const line = lines[Math.floor(rng() * lines.length)];
      const along = -230 + rng() * 460;
      const off = (rng() < 0.5 ? -1 : 1) * 7.5;
      const x = vertical ? line + off : along;
      const z = vertical ? along : line + off;
      this.peds.push(new Pedestrian(scene, x, z, rng));
    }
  }

  update(dt, playerPos, cars = []) {
    for (const p of this.peds) p.update(dt, this.world, playerPos, cars);
  }

  // Everyone near (x,z) runs away.
  scareNear(x, z, radius) {
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) p.fleeFrom(x, z);
    }
  }

  // Nearest living pedestrian to (x,z) within maxDist, or null.
  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}
