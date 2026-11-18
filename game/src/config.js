// TELUK SENJA — shared constants: city layout, colours, tuning, mission script.
// Every name here is invented for this game; nothing comes from any commercial game.

export const WORLD = {
  seed: 7,
  half: 260, // playable half-extent in world units (x and z)
  block: 40, // building block size
  road: 12, // road width
  pitch: 52, // block + road
  blocks: 8, // blocks across the grid (8 x 8)
  gridOrigin: -208, // blocks span gridOrigin .. gridOrigin + blocks*pitch
  seaX: -246, // x where the water starts (west edge)
  beachX: -222, // x where the beach strip ends (its east edge)
};

export const COLOURS = {
  duskSkyTop: 0x2b3a67,
  duskSkyBottom: 0xff9a56,
  sun: 0xffd27a,
  fog: 0xe08a5a,
  road: 0x2e2a33,
  roadLine: 0xd8c56a,
  sidewalk: 0x8a7f72,
  beach: 0xd9b98a,
  sea: 0x1d4e6b,
  seaDeep: 0x123a52,
  buildingPalette: [0x6b4a5a, 0x4a5a6b, 0x7a5a3a, 0x5a6b4a, 0x8a6a4a, 0x4a6b6b, 0x715a7a],
  neon: [0xff5a8a, 0x39d0ff, 0xffd23a, 0x7aff8a, 0xff7a3a],
  lampGlow: 0xffc46b,
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 12,
  jumpSpeed: 8,
  gravity: 22,
  radius: 0.6,
  height: 1.8,
  maxHealth: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  drag: 0.6,
};

export const WANTED = {
  max: 5,
  decaySeconds: 22,
  // police units per wanted level: [foot cops, police cars]
  policePerLevel: [[0, 0], [1, 0], [2, 1], [2, 2], [3, 3], [4, 4]],
};

// Mission chain: Raka the courier takes jobs from Dara, the dispatcher.
// Each mission: id, title, briefing, objective text, target position, reward.
export const MISSIONS = [
  {
    id: 'antar-paket',
    title: 'Paket ke Dermaga',
    briefing: 'Dara: "Raka, antar paket ini ke Dermaga Senja sebelum magrib. Jangan ditanya isinya."',
    objective: 'Antar paket ke penanda kuning di Dermaga',
    target: { x: -224, z: 0 },
    reward: 150,
    kind: 'goto',
  },
  {
    id: 'kabur',
    title: 'Kabur dari Razia',
    briefing: 'Dara: "Polisi lagi razia di jalan utama. Kabur dan capai titik temu di Pasar Ikan."',
    objective: 'Capai titik temu sambil dikejar polisi',
    target: { x: -110, z: -110 },
    reward: 250,
    kind: 'getaway',
    wantedOnStart: 2,
  },
  {
    id: 'ekor',
    title: 'Ekorin Mobil Box',
    briefing: 'Dara: "Ada mobil box mencurigakan. Ekorin dari jauh, jangan sampai ketahuan."',
    objective: 'Ikuti mobil box tanpa ketahuan (jaga jarak)',
    target: { x: 0, z: 0 }, // filled at runtime: the box van's position
    reward: 350,
    kind: 'tail',
  },
  {
    id: 'jemput-kas',
    title: 'Jemput Setoran',
    briefing: 'Dara: "Setoran terakhir malam ini di warung Bu Lastri. Ambil dan bawa pulang ke base."',
    objective: 'Ambil setoran, lalu kembali ke base',
    target: { x: -58, z: 150 },
    reward: 500,
    kind: 'collect',
    returnTo: { x: 26, z: 26 },
  },
];

export const SAVE_KEY = 'teluk-senja-save-v1';

// Screenshot poses (?shot=...): deterministic staged scenes for the entry screenshots.
export const SHOTS = {
  chase: { label: 'Pengejaran di jalan pesisir' },
  city: { label: 'Kota Teluk Senja saat senja' },
  mission: { label: 'Raka di Dermaga Senja' },
  drive: { label: 'Berkendara di jalan pantai' },
};
