// TELUK SENJA — procedural canvas textures. No image files, no network.
// Building facades with lit windows, asphalt with lane dashes, sand, pier planks.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function buildingTexture(baseColor, litRatio, rng) {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  // subtle vertical shade variation
  for (let x = 0; x < 128; x += 8) {
    g.fillStyle = `rgba(0,0,0,${0.04 + rng() * 0.06})`;
    g.fillRect(x, 0, 8, 256);
  }
  // faint horizontal floor lines
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 24; y < 256; y += 24) g.fillRect(0, y, 128, 1);
  // window grid: size varies per building so facades don't repeat identically
  const cols = 3 + Math.floor(rng() * 2);
  const rows = 7 + Math.floor(rng() * 4);
  const cw = 128 / cols;
  const rh = 232 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = 6 + col * cw;
      const y = 12 + r * rh;
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.6 ? '#ffd27a' : '#9ad7ff') : '#1c2433';
      g.fillRect(x, y, cw - 12, rh - 9);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.strokeRect(x, y, cw - 12, rh - 9);
    }
  }
  // ground floor: shopfront — darker base, a door and a wide lit window
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 232, 128, 24);
  g.fillStyle = rng() < 0.5 ? '#ffd27a' : '#2a2a33';
  g.fillRect(14, 236, 56, 16);
  g.fillStyle = '#14101c';
  g.fillRect(88, 236, 20, 20);
  // roof line
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, 0, 128, 6);
  return c;
}

export function roadTextureH() {
  // Dashes run along the road's length (u axis): a horizontal bar per tile.
  // Lighter asphalt than the old near-black so the road reads at dusk.
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#3a3540';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  // worn edge lines
  g.fillStyle = 'rgba(216,197,106,0.55)';
  g.fillRect(0, 4, 128, 2);
  g.fillRect(0, 122, 128, 2);
  g.fillStyle = '#d8c56a';
  g.fillRect(10, 60, 48, 8);
  g.fillRect(74, 60, 44, 8);
  return c;
}

export function roadTextureV() {
  // Same asphalt, dashes along the v axis (for north-south roads).
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#3a3540';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = 'rgba(216,197,106,0.55)';
  g.fillRect(4, 0, 2, 128);
  g.fillRect(122, 0, 2, 128);
  g.fillStyle = '#d8c56a';
  g.fillRect(60, 10, 8, 48);
  g.fillRect(60, 74, 8, 44);
  return c;
}

export function seaTexture() {
  // Dark teal with pale wave streaks; the world scrolls its offset so the
  // water drifts instead of sitting flat.
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#1d4e6b';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) {
    const y = Math.random() * 256;
    const len = 20 + Math.random() * 70;
    const x = Math.random() * 256;
    g.strokeStyle = `rgba(140,200,220,${0.05 + Math.random() * 0.12})`;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y + (Math.random() - 0.5) * 6);
    g.stroke();
  }
  return c;
}

export function foamTexture() {
  // White speckle foam where the sea meets the sand.
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(240,244,240,${0.15 + Math.random() * 0.5})`;
    const r = 1 + Math.random() * 3;
    g.beginPath();
    g.arc(Math.random() * 128, Math.random() * 128, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function skyTexture() {
  // Vertical dusk gradient: deep indigo overhead, orange band at the horizon.
  // Faint early stars in the upper third so the sky is not a flat wash.
  const c = makeCanvas(4, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0e1430');
  grad.addColorStop(0.35, '#2a2a55');
  grad.addColorStop(0.5, '#5a3a63');
  grad.addColorStop(0.62, '#a8545a');
  grad.addColorStop(0.72, '#ff8a4a');
  grad.addColorStop(0.8, '#ffb37a');
  grad.addColorStop(1, '#2a1a2a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return c;
}

export function starsTexture() {
  // Sparse stars for a plane high overhead (transparent, additive feel).
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 130; i++) {
    const a = 0.25 + Math.random() * 0.65;
    g.fillStyle = `rgba(255,255,255,${a})`;
    const r = Math.random() < 0.12 ? 2 : 1;
    g.fillRect(Math.random() * 256, Math.random() * 256, r, r);
  }
  return c;
}

export function sidewalkTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#8a7f72';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  return c;
}

export function sandTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#d9b98a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1200; i++) {
    g.fillStyle = `rgba(120,90,50,${Math.random() * 0.16})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  return c;
}

export function pierTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#6b4a2e';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 2;
  for (let y = 0; y < 128; y += 16) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
  }
  return c;
}

export function neonSignTexture(text, color) {
  const c = makeCanvas(256, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#14101c';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  return c;
}
