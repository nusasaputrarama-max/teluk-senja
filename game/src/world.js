// TELUK SENJA — the city itself: a dusk coastal grid, sea to the west, a pier,
// procedural buildings with lit windows, palms, lamps, a market square.
// Layout is seeded, so every load builds the same city (screenshots stay stable).

import * as THREE from 'three';
import { WORLD, COLOURS } from './config.js';
import { makeRng, pick, range, intRange } from './rng.js';
import {
  buildingTexture, roadTextureH, roadTextureV, skyTexture, sidewalkTexture, sandTexture, pierTexture, neonSignTexture,
} from './textures.js';

function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(WORLD.seed);
    // Axis-aligned building colliders: {minX, maxX, minZ, maxZ}
    this.colliders = [];
    // Road centre lines (for traffic): arrays of {x,z} waypoints forming loops.
    this.roadLoops = [];
    // Named spots the missions and screenshots use.
    this.spots = {};
    // Parked cars the player can steal: filled by vehicles.js via registerParked().
    this.parkedSpots = [];
    this.build();
  }

  build() {
    const { scene, rng } = this;
    const H = WORLD.half;

    // --- Sky, sun, fog -------------------------------------------------
    const skyTex = new THREE.CanvasTexture(skyTexture());
    skyTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTex;
    scene.fog = new THREE.Fog(COLOURS.fog, 180, 620);
    const hemi = new THREE.HemisphereLight(0x9a8ac8, 0x4a3226, 1.15);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(COLOURS.sun, 2.6);
    sun.position.set(-260, 90, -140);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -280;
    sun.shadow.camera.right = 280;
    sun.shadow.camera.top = 280;
    sun.shadow.camera.bottom = -280;
    scene.add(sun);
    // Low sun disc on the horizon over the sea.
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(18, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb03a, fog: false }),
    );
    sunDisc.position.set(-460, 30, -60);
    sunDisc.lookAt(0, 30, -60);
    scene.add(sunDisc);

    // --- Ground: grass-ish base, beach, sea ----------------------------
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(H * 2 + 80, H * 2 + 80),
      new THREE.MeshLambertMaterial({ color: 0x4a5a44 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    // Beach strip: x in [seaX, beachX].
    const beachWidth = WORLD.beachX - WORLD.seaX;
    const beach = new THREE.Mesh(
      new THREE.PlaneGeometry(beachWidth, H * 2 + 80),
      new THREE.MeshLambertMaterial({ map: canvasTexture(sandTexture(), 2, 20) }),
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.set((WORLD.seaX + WORLD.beachX) / 2, 0.05, 0);
    beach.receiveShadow = true;
    scene.add(beach);

    // Sea: everything west of seaX.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(220, H * 2 + 400),
      new THREE.MeshLambertMaterial({ color: COLOURS.sea }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(WORLD.seaX - 110, 0.02, 0);
    scene.add(sea);
    const seaFar = new THREE.Mesh(
      new THREE.PlaneGeometry(400, H * 2 + 400),
      new THREE.MeshBasicMaterial({ color: COLOURS.seaDeep, fog: false }),
    );
    seaFar.rotation.x = -Math.PI / 2;
    seaFar.position.set(WORLD.seaX - 330, 0.01, 0);
    scene.add(seaFar);

    // --- Roads ----------------------------------------------------------
    // Road centres: internal roads between blocks + the two edge roads.
    // Blocks span gridOrigin .. gridOrigin + blocks*pitch; a road sits in
    // every 12-unit gap between neighbouring blocks and along both edges.
    const lineCenters = [];
    for (let k = 0; k < WORLD.blocks - 1; k++) {
      lineCenters.push(WORLD.gridOrigin + WORLD.block + WORLD.road / 2 + k * WORLD.pitch);
    }
    lineCenters.push(WORLD.gridOrigin - WORLD.road / 2);
    lineCenters.push(WORLD.gridOrigin + WORLD.blocks * WORLD.pitch + WORLD.road / 2);
    this.lineCenters = lineCenters.sort((a, b) => a - b);

    const roadMatH = new THREE.MeshLambertMaterial({ map: canvasTexture(roadTextureH(), H * 2 / 13, 1) });
    const roadMatV = new THREE.MeshLambertMaterial({ map: canvasTexture(roadTextureV(), 1, H * 2 / 13) });
    const roadGeoH = new THREE.PlaneGeometry(H * 2, WORLD.road);
    const roadGeoV = new THREE.PlaneGeometry(WORLD.road, H * 2);
    for (const c of this.lineCenters) {
      const rh = new THREE.Mesh(roadGeoH, roadMatH);
      rh.rotation.x = -Math.PI / 2;
      rh.position.set(0, 0.06, c);
      rh.receiveShadow = true;
      scene.add(rh);
      const rv = new THREE.Mesh(roadGeoV, roadMatV);
      rv.rotation.x = -Math.PI / 2;
      rv.position.set(c, 0.06, 0);
      rv.receiveShadow = true;
      scene.add(rv);
    }

    // Sidewalk strips along every road (thin, slightly raised).
    const walkMat = new THREE.MeshLambertMaterial({ map: canvasTexture(sidewalkTexture(), 8, 1) });
    const walkGeoH = new THREE.PlaneGeometry(H * 2, 3);
    const walkGeoV = new THREE.PlaneGeometry(3, H * 2);
    for (const c of this.lineCenters) {
      for (const off of [-WORLD.road / 2 - 1.5, WORLD.road / 2 + 1.5]) {
        const wh = new THREE.Mesh(walkGeoH, walkMat);
        wh.rotation.x = -Math.PI / 2;
        wh.position.set(0, 0.08, c + off);
        scene.add(wh);
        const wv = new THREE.Mesh(walkGeoV, walkMat);
        wv.rotation.x = -Math.PI / 2;
        wv.position.set(c + off, 0.08, 0);
        scene.add(wv);
      }
    }

    // --- Blocks: buildings, parks, market -------------------------------
    const blockOrigin = (b) => WORLD.gridOrigin + b * WORLD.pitch;
    const buildingGeos = new Map();
    const getBuildingGeo = (w, h, d) => {
      const key = `${w}|${h}|${d}`;
      if (!buildingGeos.has(key)) buildingGeos.set(key, new THREE.BoxGeometry(w, h, d));
      return buildingGeos.get(key);
    };

    const marketBlock = { bx: 4, bz: 4 }; // central market square
    const parkBlocks = [{ bx: 1, bz: 6 }, { bx: 6, bz: 1 }, { bx: 2, bz: 2 }];
    const isPark = (bx, bz) => parkBlocks.some((p) => p.bx === bx && p.bz === bz);
    const isMarket = (bx, bz) => bx === marketBlock.bx && bz === marketBlock.bz;

    for (let bx = 0; bx < WORLD.blocks; bx++) {
      for (let bz = 0; bz < WORLD.blocks; bz++) {
        const ox = blockOrigin(bx);
        const oz = blockOrigin(bz);
        if (isMarket(bx, bz)) {
          this.buildMarketSquare(scene, ox, oz, rng);
          continue;
        }
        if (isPark(bx, bz)) {
          this.buildPark(scene, ox, oz, rng);
          continue;
        }
        // 1-3 buildings per block, placed on a jittered sub-grid.
        const count = intRange(rng, 1, 3);
        for (let n = 0; n < count; n++) {
          const w = range(rng, 14, 26);
          const d = range(rng, 14, 26);
          const h = range(rng, 9, 42);
          const px = ox + 6 + rng() * (WORLD.block - 12 - w);
          const pz = oz + 6 + rng() * (WORLD.block - 12 - d);
          const color = pick(rng, COLOURS.buildingPalette);
          const tex = canvasTexture(
            buildingTexture('#' + color.toString(16).padStart(6, '0'), 0.45, rng),
          );
          const mat = new THREE.MeshLambertMaterial({ map: tex });
          const mesh = new THREE.Mesh(getBuildingGeo(w, h, d), mat);
          mesh.position.set(px + w / 2, h / 2, pz + d / 2);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
          this.colliders.push({ minX: px, maxX: px + w, minZ: pz, maxZ: pz + d });
          // Neon sign on some taller buildings.
          if (h > 24 && rng() < 0.5) {
            const signText = pick(rng, ['KOPI', 'MIE', 'HOTEL', 'BAR', 'TOKO', 'IKAN']);
            const signColor = pick(rng, COLOURS.neon);
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(10, 2.5),
              new THREE.MeshBasicMaterial({
                map: canvasTexture(neonSignTexture(signText, signColor)),
                transparent: false,
              }),
            );
            sign.position.set(px + w / 2, h * 0.72, pz - 0.1);
            sign.rotation.y = Math.PI;
            scene.add(sign);
          }
        }
      }
    }

    // --- Pier (Dermaga Senja) -------------------------------------------
    // Deck runs from the beach (x = beachX) west into the sea.
    const pierLength = 56;
    const pierCenterX = WORLD.beachX - pierLength / 2;
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(pierLength, 0.5, 10),
      new THREE.MeshLambertMaterial({ map: canvasTexture(pierTexture(), 6, 1) }),
    );
    pier.position.set(pierCenterX, 0.25, 0);
    pier.castShadow = true;
    pier.receiveShadow = true;
    scene.add(pier);
    // Pier posts.
    const postGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.4, 8);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
    for (let x = pierCenterX - pierLength / 2 + 2; x <= pierCenterX + pierLength / 2 - 2; x += 8) {
      for (const z of [-4.4, 4.4]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0.4, z);
        scene.add(post);
      }
    }
    // Pier end hut.
    const hutX = pierCenterX - pierLength / 2 + 6;
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(8, 5, 7),
      new THREE.MeshLambertMaterial({ color: 0x7a5a3a }),
    );
    hut.position.set(hutX, 3.2, 0);
    hut.castShadow = true;
    scene.add(hut);
    const hutRoof = new THREE.Mesh(
      new THREE.ConeGeometry(6.4, 3, 4),
      new THREE.MeshLambertMaterial({ color: 0xa03a2a }),
    );
    hutRoof.position.set(hutX, 7.2, 0);
    hutRoof.rotation.y = Math.PI / 4;
    scene.add(hutRoof);

    // --- Street lamps along the coastal (west edge) road ----------------
    const lampPoleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
    const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
    const lampHeadGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const lampHeadMat = new THREE.MeshBasicMaterial({ color: COLOURS.lampGlow });
    const coastalX = this.lineCenters[0]; // westernmost road centre
    for (let z = -H + 20; z < H - 10; z += 52) {
      const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
      pole.position.set(coastalX + 7.5, 3, z);
      scene.add(pole);
      const head = new THREE.Mesh(lampHeadGeo, lampHeadMat);
      head.position.set(coastalX + 7.5, 6.1, z);
      scene.add(head);
      const light = new THREE.PointLight(COLOURS.lampGlow, 12, 26);
      light.position.set(coastalX + 7.5, 6, z);
      scene.add(light);
    }

    // Palms on the beach (between the coastal road and the sea).
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
    const leafGeo = new THREE.ConeGeometry(2.6, 2.2, 6);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a });
    for (let z = -H + 30; z < H - 20; z += 44) {
      const x = WORLD.seaX + 4 + rng() * (WORLD.beachX - WORLD.seaX - 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 3.5, z);
      trunk.rotation.z = (rng() - 0.5) * 0.2;
      trunk.castShadow = true;
      scene.add(trunk);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x, 7.6, z);
      scene.add(leaves);
    }

    // --- Named spots ------------------------------------------------------
    const marketCenter = WORLD.gridOrigin + 4 * WORLD.pitch + WORLD.block / 2;
    this.spots.base = { x: 26, z: 26 }; // Prabowo's base: market square corner
    this.spots.pier = { x: WORLD.beachX - 2, z: 0 };
    this.spots.pierEnd = { x: WORLD.beachX - 50, z: 0 };
    this.spots.market = { x: marketCenter, z: marketCenter };
    this.spots.fishMarket = { x: -110, z: -110 };
    this.spots.warung = { x: -58, z: 150 };
    this.spots.playerStart = { x: this.lineCenters[0], z: 8 };

    // Traffic loops: rectangles along the road grid (used by traffic AI).
    for (const cx of this.lineCenters.slice(1, -1)) {
      for (const cz of this.lineCenters.slice(1, -1)) {
        if (rng() < 0.35) {
          this.roadLoops.push([
            { x: cx - 26, z: cz - 26 }, { x: cx + 26, z: cz - 26 },
            { x: cx + 26, z: cz + 26 }, { x: cx - 26, z: cz + 26 },
          ]);
        }
      }
    }
    // One long coastal loop for the getaway flavour.
    this.roadLoops.push([
      { x: coastalX, z: -H + 30 }, { x: coastalX, z: H - 30 },
      { x: coastalX + 52, z: H - 30 }, { x: coastalX + 52, z: -H + 30 },
    ]);
  }

  buildMarketSquare(scene, ox, oz, rng) {
    // Open plaza: stalls (small boxes with striped awnings), crates, string lights.
    const plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.block, WORLD.block),
      new THREE.MeshLambertMaterial({ color: 0x9a8a72 }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(ox + WORLD.block / 2, 0.07, oz + WORLD.block / 2);
    plaza.receiveShadow = true;
    scene.add(plaza);
    const stallColors = [0xc23a3a, 0x3a7ac2, 0x3ac27a, 0xd8a23a];
    for (let i = 0; i < 4; i++) {
      const sx = ox + 8 + (i % 2) * 20;
      const sz = oz + 8 + Math.floor(i / 2) * 20;
      const stall = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.4, 4),
        new THREE.MeshLambertMaterial({ color: stallColors[i] }),
      );
      stall.position.set(sx, 1.2, sz);
      stall.castShadow = true;
      scene.add(stall);
      this.colliders.push({ minX: sx - 3, maxX: sx + 3, minZ: sz - 2, maxZ: sz + 2 });
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(7, 0.3, 5),
        new THREE.MeshLambertMaterial({ color: 0xf2e8d8 }),
      );
      awning.position.set(sx, 2.8, sz);
      scene.add(awning);
    }
  }

  buildPark(scene, ox, oz, rng) {
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.block, WORLD.block),
      new THREE.MeshLambertMaterial({ color: 0x3a6b34 }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(ox + WORLD.block / 2, 0.07, oz + WORLD.block / 2);
    lawn.receiveShadow = true;
    scene.add(lawn);
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
    const leafGeo = new THREE.SphereGeometry(2.4, 8, 6);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a });
    for (let i = 0; i < 5; i++) {
      const x = ox + 6 + rng() * (WORLD.block - 12);
      const z = oz + 6 + rng() * (WORLD.block - 12);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 3, z);
      trunk.castShadow = true;
      scene.add(trunk);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x, 7, z);
      scene.add(leaves);
    }
    // Benches.
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
    for (let i = 0; i < 2; i++) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
      bench.position.set(ox + 10 + i * 16, 0.5, oz + WORLD.block / 2);
      scene.add(bench);
    }
  }

  // True if the circle at (x,z) with radius r overlaps any building collider.
  hitsBuilding(x, z, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  // Push a circle out of buildings: returns corrected {x, z}.
  resolveBuildings(x, z, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else if (d2 <= 0.0001) {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = x - c.minX;
        const pr = c.maxX - x;
        const pt = z - c.minZ;
        const pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r;
        else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r;
        else z = c.maxZ + r;
      }
    }
    return { x, z };
  }

  clampToWorld(x, z, margin = 4) {
    const H = WORLD.half;
    return {
      x: Math.max(-H + margin, Math.min(H - margin, x)),
      z: Math.max(-H + margin, Math.min(H - margin, z)),
    };
  }
}
