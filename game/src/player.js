// TELUK SENJA — Prabowo on foot: third-person walker with run, jump, and a
// mouse-drag orbit camera. Also owns entering / exiting cars.

import * as THREE from 'three';
import { PLAYER } from './config.js';

// Face hook: the character's face comes from a single swappable file,
// game/assets/face.png (the same file the menu portrait shows). The owner's
// real photo is used as-is, centre-cropped to a square — no caricature, no
// stylisation. Until it arrives, face.png is a neutral placeholder silhouette
// (no real person's face). Set FACE_ON_HEAD false if a head texture ever reads
// badly at gameplay distance; the menu portrait is the face's primary home.
const FACE_ON_HEAD = true;
const FACE_SRC = './assets/face.png';

function makeFaceMaterial(skinMat) {
  if (!FACE_ON_HEAD) return skinMat;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#c98a5a'; // plain skin until the photo loads (or if it fails)
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    // Frame the face + peci as-is (no stylisation). The official portrait
    // carries the face in the upper middle, so crop that square region
    // instead of the whole head-and-shoulders shot (which reads as a suit
    // on the head box). Fractions of the image; retune if the photo changes.
    const side = img.width * 0.44;
    const sx = img.width * 0.28;
    const sy = img.height * 0.06;
    g.drawImage(img, sx, sy, side, side, 0, 0, 128, 128);
    tex.needsUpdate = true;
  };
  img.src = FACE_SRC;
  return new THREE.MeshLambertMaterial({ map: tex });
}

export function makePlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff7a3a }); // Prabowo's orange jacket
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.42, 0.4),
    // Box material order: +x, -x, +y, -y, +z (face), -z. The face looks +z,
    // the direction the character faces at heading 0.
    [skin, skin, skin, skin, makeFaceMaterial(skin), skin],
  );
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  cap.position.y = 2.02;
  g.add(cap);
  const legGeo = new THREE.BoxGeometry(0.24, 0.78, 0.26);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.16, 0.39, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.16, 0.39, 0);
  g.add(legR);
  const armGeo = new THREE.BoxGeometry(0.2, 0.66, 0.22);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.42, 1.18, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.42, 1.18, 0);
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene, world, x, z) {
    this.world = world;
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.y = 0; // height above ground (jump)
    this.vy = 0;
    this.heading = 0; // facing
    this.camYaw = Math.PI; // camera orbit yaw
    this.camPitch = 0.32;
    this.camDist = 9;
    this.inCar = null; // Car instance when driving
    this.health = PLAYER.maxHealth;
    this.walkPhase = 0;
    this.moving = false;
    this.updateMesh();
  }

  updateMesh() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    // Walk-cycle limb swing.
    const s = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = s;
    u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.8;
    u.armR.rotation.x = s * 0.8;
  }

  // input: {forward, back, left, right, run, jump} as booleans; dt seconds.
  update(input, dt) {
    if (this.inCar) return; // driving is handled by the car
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    // Movement is relative to the camera yaw.
    let mx = 0;
    let mz = 0;
    if (input.forward) { mx += -Math.sin(this.camYaw); mz += -Math.cos(this.camYaw); }
    if (input.back) { mx += Math.sin(this.camYaw); mz += Math.cos(this.camYaw); }
    if (input.left) { mx += -Math.cos(this.camYaw); mz += Math.sin(this.camYaw); }
    if (input.right) { mx += Math.cos(this.camYaw); mz += -Math.sin(this.camYaw); }
    const len = Math.hypot(mx, mz);
    this.moving = len > 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      this.heading = Math.atan2(mx, mz);
      let nx = this.x + mx * speed * dt;
      let nz = this.z + mz * speed * dt;
      const fixed = this.world.resolveBuildings(nx, nz, PLAYER.radius);
      nx = fixed.x;
      nz = fixed.z;
      const clamped = this.world.clampToWorld(nx, nz);
      this.x = clamped.x;
      this.z = clamped.z;
      this.walkPhase += dt * speed * 1.4;
    }
    // Jump + gravity.
    if (input.jump && this.y === 0) this.vy = PLAYER.jumpSpeed;
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= PLAYER.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
      }
    }
    this.updateMesh();
  }

  // Third-person camera: returns the camera position and look target.
  cameraPose() {
    const cx = this.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cz = this.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cy = this.y + 1.6 + Math.sin(this.camPitch) * this.camDist;
    return {
      pos: { x: cx, y: Math.max(1.2, cy), z: cz },
      look: { x: this.x, y: this.y + 1.4, z: this.z },
    };
  }

  // Camera that follows a driven car (chase cam).
  carCameraPose(car) {
    const back = 11;
    const cx = car.x - Math.sin(car.heading) * back;
    const cz = car.z - Math.cos(car.heading) * back;
    return {
      pos: { x: cx, y: 5.2, z: cz },
      look: { x: car.x + Math.sin(car.heading) * 6, y: 1.4, z: car.z + Math.cos(car.heading) * 6 },
    };
  }
}
