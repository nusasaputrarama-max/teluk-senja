// TELUK SENJA — missions: Raka's job chain from Dara the dispatcher.
// States: idle -> active -> (done) -> next. A beacon marks the target in the
// world and on the minimap; rewards are paid in cash on completion.

import * as THREE from 'three';
import { MISSIONS } from './config.js';

export class Missions {
  constructor(scene, onEvent) {
    this.scene = scene;
    this.onEvent = onEvent; // (type, payload) -> main.js (hud, sound, wanted)
    this.index = 0; // which mission is current
    this.state = 'idle'; // idle | active | done | finished
    this.target = null; // {x, z}
    this.phase = 'go'; // go | return (for collect missions)
    this.tailTarget = null; // Car instance for tail missions
    this.tailSeenTimer = 0;
    this.tailTooClose = 0;
    this.beacon = null;
    this.beaconLight = null;
    this.buildBeacon();
  }

  buildBeacon() {
    // A tall glowing column + a floating marker so the target reads from afar.
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 60, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd23a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.18, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23a }),
    );
    ring.rotation.x = Math.PI / 2;
    // The beacon mesh sits at y=30 (cylinder centre); the ring must sit on
    // the ground, so its local y is -29.7.
    ring.position.y = -29.7;
    this.beacon.add(ring);
    this.beaconLight = new THREE.PointLight(0xffd23a, 20, 30);
    this.beacon.add(this.beaconLight);
    this.beaconLight.position.y = -22;
  }

  current() {
    return MISSIONS[this.index] || null;
  }

  start() {
    const m = this.current();
    if (!m) {
      this.state = 'finished';
      return;
    }
    this.state = 'active';
    this.phase = 'go';
    this.setTarget(m.target.x, m.target.z);
    this.onEvent('mission-start', m);
    if (m.kind === 'getaway' && m.wantedOnStart) {
      this.onEvent('mission-wanted', m.wantedOnStart);
    }
  }

  setTarget(x, z) {
    this.target = { x, z };
    this.beacon.position.set(x, 30, z);
    this.beacon.visible = true;
  }

  hideBeacon() {
    this.beacon.visible = false;
    this.target = null;
  }

  complete() {
    const m = this.current();
    if (!m) return;
    this.hideBeacon();
    this.state = 'done';
    this.onEvent('mission-complete', m);
    this.index += 1;
    if (this.index >= MISSIONS.length) {
      this.state = 'finished';
      this.onEvent('missions-finished', null);
    } else {
      // Short breather, then the next job arrives.
      setTimeout(() => {
        if (this.state === 'done') this.start();
      }, 2500);
    }
  }

  // Called every frame with the player's position. Returns nothing; fires events.
  update(dt, playerPos, tailCar) {
    if (this.state !== 'active' || !this.target) return;
    const m = this.current();
    if (!m) return;
    // Beacon pulse.
    this.beacon.rotation.y += dt * 0.8;
    this.beacon.material.opacity = 0.22 + Math.sin(performance.now() / 300) * 0.08;

    if (m.kind === 'tail') {
      // The target IS the box van: follow it, keep 12-30 units away.
      if (tailCar) {
        this.target = { x: tailCar.x, z: tailCar.z };
        this.beacon.position.set(tailCar.x, 30, tailCar.z);
        const d = Math.hypot(playerPos.x - tailCar.x, playerPos.z - tailCar.z);
        if (d < 10) {
          this.tailTooClose += dt;
          if (this.tailTooClose > 4) {
            // Spotted: the van speeds off and the job fails back to start.
            this.onEvent('mission-failed', m);
            this.tailTooClose = 0;
            this.start();
            return;
          }
        } else {
          this.tailTooClose = Math.max(0, this.tailTooClose - dt);
        }
        this.tailSeenTimer += dt;
        if (this.tailSeenTimer > 25) {
          this.tailSeenTimer = 0;
          this.complete();
        }
      }
      return;
    }

    const d = Math.hypot(playerPos.x - this.target.x, playerPos.z - this.target.z);
    if (d < 4.5) {
      if (m.kind === 'collect' && this.phase === 'go') {
        this.phase = 'return';
        this.setTarget(m.returnTo.x, m.returnTo.z);
        this.onEvent('mission-pickup', m);
      } else {
        this.complete();
      }
    }
  }
}
