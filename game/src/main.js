// TELUK SENJA — main entry: boots the renderer, wires every system, runs the
// game loop and the menu / pause / busted / dead states. Prabowo, a courier in a
// dusk coastal city, takes jobs from Dara while the police watch the streets.

import * as THREE from 'three';
import { WORLD, PLAYER, MISSIONS } from './config.js';
import { makeRng } from './rng.js';
import { World } from './world.js';
import { Player } from './player.js';
import { makeCarMesh, Car, randomCarColor } from './vehicles.js';
import { PedestrianCrowd } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { SoundEngine } from './audio.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const isShot = !!shotName;

// --- Renderer / scene ---------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const world = new World(scene);
const rng = makeRng(WORLD.seed + 31);
const sound = new SoundEngine();
const hud = new Hud(world);

// --- Player --------------------------------------------------------------
const start = world.spots.playerStart;
const player = new Player(scene, world, start.x, start.z);

// --- Cars: the player's car, parked cars, traffic ------------------------
function spawnCarAt(x, z, heading, color, opts = {}) {
  const mesh = makeCarMesh(color, opts.isPolice);
  scene.add(mesh);
  return new Car(mesh, x, z, heading, { color, ...opts });
}

const playerCar = spawnCarAt(world.lineCenters[0] + 2, 26, Math.PI / 2, 0xc23a3a, { isPlayer: true });
const parkedCars = [];
{
  // Six parked cars along roads; E near one steals it.
  const spots = [
    { x: world.lineCenters[1] + 3, z: -40, h: 0 },
    { x: world.lineCenters[3] - 3, z: 80, h: Math.PI },
    { x: world.lineCenters[5] + 3, z: -120, h: 0 },
    { x: world.lineCenters[2] - 3, z: 150, h: Math.PI },
    { x: world.lineCenters[6] + 3, z: 30, h: 0 },
    { x: world.lineCenters[4] - 3, z: -60, h: Math.PI },
  ];
  for (const s of spots) {
    parkedCars.push(spawnCarAt(s.x, s.z, s.h, randomCarColor(rng)));
  }
}
const traffic = [];
for (let i = 0; i < 10; i++) {
  const loop = world.roadLoops[i % world.roadLoops.length];
  const wp = loop[Math.floor(rng() * loop.length)];
  const car = spawnCarAt(wp.x, wp.z, rng() * Math.PI * 2, randomCarColor(rng), {
    isTraffic: true, loop, loopIndex: 0, loopSpeed: 7 + rng() * 4,
  });
  traffic.push(car);
}
// The box van for the tail mission (parked until mission 3 starts).
const tailVan = spawnCarAt(world.lineCenters[2], -100, 0, 0x8a8a8a, {
  isTraffic: true, loop: world.roadLoops[0], loopIndex: 0, loopSpeed: 9,
});
tailVan.mesh.visible = false;
let tailVanActive = false;

// --- Crowd, police, missions, combat --------------------------------------
const crowd = new PedestrianCrowd(scene, world, 26, rng);
const police = new Police(scene, world);
const combat = new Combat(scene, sound);

let cash = 0;
let missionIndex = 0;

const missions = new Missions(scene, (type, payload) => {
  if (type === 'mission-start') {
    hud.setObjective(payload.title, payload.objective);
    hud.toast(payload.briefing, 5200);
  } else if (type === 'mission-complete') {
    cash += payload.reward;
    hud.setCash(cash);
    hud.toast(`Misi selesai: ${payload.title}  +$${payload.reward}`, 4200);
    sound.missionComplete();
    missionIndex = missions.index;
    persist();
  } else if (type === 'mission-pickup') {
    hud.toast('Setoran diambil! Kembali ke base.', 3800);
    sound.pickup();
  } else if (type === 'mission-failed') {
    hud.toast('Ketahuan! Ekoran gagal, coba lagi.', 3800);
  } else if (type === 'mission-wanted') {
    police.addWanted(payload, player, () => {});
    hud.setWanted(police.wanted);
  } else if (type === 'missions-finished') {
    cash += 1000;
    hud.setCash(cash);
    hud.toast('Semua misi selesai! Bonus $1000. Teluk Senja milikmu, Prabowo.', 6000);
    sound.missionComplete();
    persist();
  }
});

function persist() {
  saveGame({
    cash,
    missionIndex: missions.index,
    health: player.health,
    ammo: combat.ammo,
    x: player.x,
    z: player.z,
  });
}

// --- Game state ------------------------------------------------------------
let state = 'menu'; // menu | playing | paused | busted | dead
let fixedCamera = null; // {pos, look} for screenshot poses
let caughtTimer = 0;
let lastDamageAt = 0;
let elapsed = 0;
let autosaveTimer = 0;

const input = {
  forward: false, back: false, left: false, right: false,
  run: false, jump: false,
};
const keys = {};
let dragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

function setState(next) {
  state = next;
  document.getElementById('menu').style.display = next === 'menu' ? 'flex' : 'none';
  document.getElementById('pause').style.display = next === 'paused' ? 'flex' : 'none';
  document.getElementById('busted').style.display = next === 'busted' ? 'flex' : 'none';
  document.getElementById('dead').style.display = next === 'dead' ? 'flex' : 'none';
  document.getElementById('hud').style.display = next === 'playing' ? 'block' : 'none';
}

function startGame(fromSave) {
  sound.init();
  if (fromSave) {
    const s = loadGame();
    if (s) {
      cash = s.cash;
      player.health = s.health;
      combat.ammo = s.ammo;
      player.x = s.x;
      player.z = s.z;
      missions.index = s.missionIndex || 0;
      player.updateMesh();
    }
  } else {
    cash = 0;
    missions.index = 0;
  }
  hud.setCash(cash);
  hud.setHealth(player.health, PLAYER.maxHealth);
  hud.setWanted(0);
  hud.setObjective('Selamat datang di Teluk Senja', 'Tekan E dekat mobil untuk mengemudi. Cari Dara untuk misi pertama.');
  missions.start();
  setState('playing');
}

function respawn(reason) {
  // Busted or dead: lose some cash, wake up at base, wanted cleared.
  const lost = reason === 'busted' ? Math.min(cash, 100) : Math.min(cash, 50);
  cash -= lost;
  hud.setCash(cash);
  police.wanted = 0;
  police.heat = 0;
  police.clearUnits();
  player.health = PLAYER.maxHealth;
  hud.setHealth(player.health, PLAYER.maxHealth);
  hud.setWanted(0);
  if (player.inCar) {
    player.inCar = null;
  }
  player.x = world.spots.base.x;
  player.z = world.spots.base.z;
  player.y = 0;
  player.updateMesh();
  sound.busted();
  hud.toast(reason === 'busted' ? `Ditangkap! Kehilangan $${lost}.` : `Pingsan! Kehilangan $${lost}.`, 4000);
  persist();
  setState('playing');
}

// --- Input ------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.back = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'KeyM') {
    sound.setMuted(!sound.muted);
    hud.toast(sound.muted ? 'Suara mati' : 'Suara hidup', 1500);
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === 'playing') { setState('paused'); persist(); }
    else if (state === 'paused') setState('playing');
  }
  if (e.code === 'KeyE' && state === 'playing') tryEnterExitCar();
  if (e.code === 'KeyF' && state === 'playing' && !player.inCar) tryPunch();
  if (e.code === 'KeyG' && state === 'playing' && !player.inCar) tryShoot();
  if (e.code === 'Enter' && state === 'menu') startGame(false);
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.back = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false;
  if (e.code === 'Space') input.jump = false;
});

renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  player.camYaw -= dx * 0.005;
  player.camPitch = Math.max(0.05, Math.min(1.1, player.camPitch + dy * 0.004));
});
window.addEventListener('mouseup', () => { dragging = false; });
renderer.domElement.addEventListener('click', () => {
  if (state === 'playing' && !player.inCar) tryShoot();
});

document.getElementById('start-btn').addEventListener('click', () => startGame(false));
document.getElementById('continue-btn').addEventListener('click', () => startGame(true));
document.getElementById('resume-btn').addEventListener('click', () => setState('playing'));
document.getElementById('restart-btn').addEventListener('click', () => {
  clearSave();
  location.reload();
});
document.getElementById('busted-btn').addEventListener('click', () => respawn('busted'));
document.getElementById('dead-btn').addEventListener('click', () => respawn('dead'));
if (hasSave()) {
  document.getElementById('continue-btn').style.display = 'inline-block';
}

// --- Actions ------------------------------------------------------------------
function nearestCar(maxDist) {
  const all = [playerCar, ...parkedCars, ...traffic];
  let best = null;
  let bestD = maxDist;
  for (const car of all) {
    if (car.isPolice) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function tryEnterExitCar() {
  if (player.inCar) {
    const car = player.inCar;
    player.inCar = null;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    player.x = car.x + side.x * 2.4;
    player.z = car.z + side.z * 2.4;
    player.y = 0;
    player.updateMesh();
    sound.setEngine(0);
    hud.setHint('WASD jalan • Shift lari • E naik mobil • F pukul • G tembak • P jeda');
    return;
  }
  const car = nearestCar(4);
  if (!car) return;
  const wasParked = parkedCars.includes(car);
  const wasTraffic = traffic.includes(car);
  if (wasTraffic) {
    // Stealing a car with a driver: the driver flees, wanted +1.
    police.addWanted(1, player, () => {});
    hud.setWanted(police.wanted);
    hud.toast('Mobil dicuri! Polisi mengejarmu.', 3000);
    crowd.scareNear(car.x, car.z, 12);
    const idx = traffic.indexOf(car);
    if (idx >= 0) traffic.splice(idx, 1);
    car.isTraffic = false;
    car.stolen = true;
  } else if (wasParked) {
    const idx = parkedCars.indexOf(car);
    if (idx >= 0) parkedCars.splice(idx, 1);
  }
  player.inCar = car;
  car.isPlayer = true;
  player.x = car.x;
  player.z = car.z;
  sound.blip(440, 0.08);
  hud.setHint('WASD mengemudi • Shift ngebut • E keluar mobil • P jeda');
}

function tryPunch() {
  const result = combat.punch(player, player.heading, crowd, police.cops);
  if (result && result.type === 'ped') {
    police.addWanted(1, player, () => {});
    hud.setWanted(police.wanted);
    crowd.scareNear(player.x, player.z, 14);
  } else if (result && result.type === 'cop') {
    police.addWanted(1, player, () => {});
    hud.setWanted(police.wanted);
  }
}

function tryShoot() {
  const result = combat.shoot(player, player.camYaw);
  if (!result || result.type !== 'shot') return;
  // Check the shot line against pedestrians and cops.
  const fx = -Math.sin(player.camYaw);
  const fz = -Math.cos(player.camYaw);
  const checkHit = (x, z) => {
    const dx = x - player.x;
    const dz = z - player.z;
    const along = dx * fx + dz * fz;
    if (along < 0 || along > 60) return false;
    const perp = Math.abs(dx * fz - dz * fx);
    return perp < 1.2;
  };
  let hitSomething = false;
  const ped = crowd.nearest(player.x, player.z, 60);
  if (ped && checkHit(ped.x, ped.z)) {
    ped.fleeFrom(player.x, player.z);
    hitSomething = true;
  }
  for (const cop of police.cops) {
    if (checkHit(cop.x, cop.z)) {
      hitSomething = true;
      // A shot cop falls back; the law notices.
      cop.x -= fx * 2;
      cop.z -= fz * 2;
    }
  }
  if (hitSomething || true) {
    // Any gunfire in the city draws attention.
    police.addWanted(1, player, () => {});
    hud.setWanted(police.wanted);
    crowd.scareNear(player.x, player.z, 20);
  }
}

// --- Car collisions ------------------------------------------------------------
function collideCars(dt) {
  const all = [playerCar, ...parkedCars, ...traffic, ...police.cars];
  if (tailVanActive) all.push(tailVan);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        a.speed *= 0.9;
        b.speed *= 0.9;
        a.updateMesh();
        b.updateMesh();
      }
    }
  }
  // Cars vs buildings (cheap circle resolve).
  for (const car of all) {
    const fixed = world.resolveBuildings(car.x, car.z, 2.1);
    if (fixed.x !== car.x || fixed.z !== car.z) {
      car.x = fixed.x;
      car.z = fixed.z;
      car.speed *= 0.55;
      car.updateMesh();
    }
    const clamped = world.clampToWorld(car.x, car.z, 6);
    car.x = clamped.x;
    car.z = clamped.z;
  }
}

// --- Pedestrian hit by a car ----------------------------------------------------
function checkPedHits() {
  const cars = [playerCar, ...traffic, ...police.cars];
  if (tailVanActive) cars.push(tailVan);
  for (const car of cars) {
    if (Math.abs(car.speed) < 5) continue;
    const ped = crowd.nearest(car.x, car.z, 2.4);
    if (ped && ped.alive) {
      ped.alive = false;
      ped.mesh.rotation.z = Math.PI / 2;
      ped.mesh.position.y = 0.4;
      crowd.scareNear(car.x, car.z, 16);
      if (car === playerCar) {
        police.addWanted(1, player, () => {});
        hud.setWanted(police.wanted);
        hud.toast('Kamu menabrak pejalan kaki!', 3000);
      }
      // A replacement pedestrian joins the crowd after a while.
      setTimeout(() => {
        const lines = world.lineCenters;
        const line = lines[Math.floor(Math.random() * lines.length)];
        const along = -230 + Math.random() * 460;
        const off = (Math.random() < 0.5 ? -1 : 1) * 7.5;
        ped.x = Math.random() < 0.5 ? line + off : along;
        ped.z = Math.random() < 0.5 ? along : line + off;
        ped.alive = true;
        ped.mesh.rotation.z = 0;
        ped.mesh.position.y = 0;
        ped.updateMesh();
      }, 15000);
    }
  }
}

// --- Tail mission van -------------------------------------------------------------
function updateTailVan(dt) {
  const m = missions.current();
  if (missions.state === 'active' && m && m.kind === 'tail' && !tailVanActive) {
    tailVanActive = true;
    tailVan.mesh.visible = true;
    tailVan.x = player.x + 40;
    tailVan.z = player.z - 30;
    tailVan.updateMesh();
  }
  if (tailVanActive) {
    if (missions.state !== 'active' || !m || m.kind !== 'tail') {
      tailVanActive = false;
      tailVan.mesh.visible = false;
    } else {
      tailVan.updateTraffic(dt, world, player.inCar);
    }
  }
}

// --- Main loop --------------------------------------------------------------------
const clock = new THREE.Clock();
let menuAngle = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  // Screenshot mode: the scene is staged, not simulated — render it frozen
  // so the composition never drifts between load and capture.
  if (isShot) {
    if (fixedCamera) {
      camera.position.set(fixedCamera.pos.x, fixedCamera.pos.y, fixedCamera.pos.z);
      camera.lookAt(fixedCamera.look.x, fixedCamera.look.y, fixedCamera.look.z);
    }
    renderer.render(scene, camera);
    return;
  }

  if (state === 'menu') {
    // Slow cinematic orbit over the city behind the title screen.
    menuAngle += dt * 0.02;
    camera.position.set(Math.sin(menuAngle) * 190, 85, Math.cos(menuAngle) * 190);
    camera.lookAt(-40, 0, 0);
    traffic.forEach((c) => c.updateTraffic(dt, world, null));
    crowd.update(dt, player);
    renderer.render(scene, camera);
    return;
  }
  if (state !== 'playing') {
    renderer.render(scene, camera);
    return;
  }

  // --- Playing ---
  combat.update(dt);
  crowd.update(dt, player);

  // Driving or walking.
  let driving = false;
  if (player.inCar) {
    driving = true;
    const car = player.inCar;
    const throttle = (input.forward ? 1 : 0) - (input.back ? 0.7 : 0);
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    car.drive(throttle, steer, dt);
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    player.mesh.visible = false;
    sound.setEngine(Math.abs(car.speed) / 34);
    hud.setSpeed(car.speed * 3.6, true);
  } else {
    player.update(input, dt);
    player.mesh.visible = true;
    sound.setEngine(0);
    hud.setSpeed(0, false);
  }

  // Traffic + parked + tail van.
  for (const car of traffic) car.updateTraffic(dt, world, player.inCar);
  updateTailVan(dt);
  collideCars(dt);
  checkPedHits();

  // Police.
  const busted = police.update(dt, player, player.inCar, () => {});
  sound.setSiren(police.wanted > 0);
  hud.setWanted(police.wanted);
  if (busted === 'busted') {
    setState('busted');
    renderer.render(scene, camera);
    return;
  }
  // Caught while driving: police car pinned the player car.
  if (player.inCar) {
    let pinned = false;
    for (const pc of police.cars) {
      const d = Math.hypot(pc.x - player.inCar.x, pc.z - player.inCar.z);
      if (d < 4.2 && Math.abs(player.inCar.speed) < 3) pinned = true;
    }
    caughtTimer = pinned ? caughtTimer + dt : 0;
    if (caughtTimer > 2.5) {
      setState('busted');
      renderer.render(scene, camera);
      return;
    }
  }

  // Foot cops hurt the player up close.
  for (const cop of police.cops) {
    const d = Math.hypot(cop.x - player.x, cop.z - player.z);
    if (!player.inCar && d < 1.8) {
      player.health -= 9 * dt;
      lastDamageAt = elapsed;
      hud.setHealth(player.health, PLAYER.maxHealth);
      if (player.health <= 0) {
        player.health = 0;
        setState('dead');
        renderer.render(scene, camera);
        return;
      }
    }
  }
  // Slow health regen out of trouble.
  if (elapsed - lastDamageAt > 8 && player.health > 0 && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + 2.5 * dt);
    hud.setHealth(player.health, PLAYER.maxHealth);
  }

  // Missions.
  const m = missions.current();
  if (m && m.kind === 'tail') {
    missions.update(dt, player, tailVanActive ? tailVan : null);
  } else {
    missions.update(dt, player, null);
  }
  if (m) hud.setObjective(m.title, m.kind === 'tail' ? m.objective + ` (${Math.max(0, 25 - Math.floor(missions.tailSeenTimer))} dtk)` : m.objective);

  // Camera.
  if (fixedCamera) {
    camera.position.set(fixedCamera.pos.x, fixedCamera.pos.y, fixedCamera.pos.z);
    camera.lookAt(fixedCamera.look.x, fixedCamera.look.y, fixedCamera.look.z);
  } else if (player.inCar) {
    const pose = player.carCameraPose(player.inCar);
    camera.position.lerp(new THREE.Vector3(pose.pos.x, pose.pos.y, pose.pos.z), 1 - Math.pow(0.001, dt));
    camera.lookAt(pose.look.x, pose.look.y, pose.look.z);
  } else {
    const pose = player.cameraPose();
    camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
    camera.lookAt(pose.look.x, pose.look.y, pose.look.z);
  }

  // Minimap + autosave.
  hud.drawMinimap(player, player.heading, [...traffic, ...parkedCars], police.cars, police.cops, missions.target, world.spots);
  autosaveTimer += dt;
  if (autosaveTimer > 30) {
    autosaveTimer = 0;
    persist();
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Screenshot mode -------------------------------------------------------------
if (isShot) {
  // Skip the menu: stage the pose and play immediately.
  sound.init = () => {};
  startGame(false);
  const pose = applyShot(shotName, {
    player, playerCar, traffic, police, missions, crowd, world,
  });
  if (pose) fixedCamera = pose;
  // The staged wanted level / mission must show on the HUD too.
  hud.setWanted(police.wanted);
  hud.drawMinimap(player, player.heading, [...traffic, ...parkedCars], police.cars, police.cops, missions.target, world.spots);
  window.__shotReady = true;
}

window.__gameReady = false;
animate();
window.__gameReady = true;

// Testing hook: read-only live state for automated playtests (headless Chrome)
// and the finalist review. Not part of gameplay; it only exposes references
// the page already owns, and never lets a test write game state except the
// camera yaw (equivalent to dragging the mouse).
window.__teluk = {
  get state() { return state; },
  get cash() { return cash; },
  get missionIndex() { return missions.index; },
  get missionState() { return missions.state; },
  get mission() {
    const m = missions.current();
    return m ? {
      id: m.id, kind: m.kind, phase: missions.phase,
      target: missions.target ? { ...missions.target } : null,
      tailSeenTimer: missions.tailSeenTimer,
    } : null;
  },
  get inCar() { return !!player.inCar; },
  get wanted() { return police.wanted; },
  get health() { return player.health; },
  get ammo() { return combat.ammo; },
  player, police, missions, combat, crowd, world,
  cars: { playerCar, parkedCars, traffic, get tailVan() { return tailVanActive ? tailVan : null; } },
  start: (fromSave) => startGame(fromSave),
};
