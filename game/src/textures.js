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
  // window grid
  const cols = 4;
  const rows = 10;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = 10 + col * 30;
      const y = 12 + r * 24;
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.6 ? '#ffd27a' : '#9ad7ff') : '#1c2433';
      g.fillRect(x, y, 18, 14);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.strokeRect(x, y, 18, 14);
    }
  }
  // roof line
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, 0, 128, 6);
  return c;
}

export function roadTextureH() {
  // Dashes run along the road's length (u axis): a horizontal bar per tile.
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#2e2a33';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#d8c56a';
  g.fillRect(10, 60, 48, 8);
  g.fillRect(74, 60, 44, 8);
  return c;
}

export function roadTextureV() {
  // Same asphalt, dashes along the v axis (for north-south roads).
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#2e2a33';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#d8c56a';
  g.fillRect(60, 10, 8, 48);
  g.fillRect(60, 74, 8, 44);
  return c;
}

export function skyTexture() {
  // Vertical dusk gradient: deep indigo overhead, orange band at the horizon.
  const c = makeCanvas(4, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#141c3a');
  grad.addColorStop(0.42, '#3a2f5e');
  grad.addColorStop(0.6, '#8a4a5a');
  grad.addColorStop(0.7, '#ff8a4a');
  grad.addColorStop(0.78, '#ffb37a');
  grad.addColorStop(1, '#2a1a2a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
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
