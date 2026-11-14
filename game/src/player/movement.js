export function clampToWall(x, z, radius, center = { x: 0, z: 0 }) {
  const dx = x - center.x, dz = z - center.z;
  const d = Math.hypot(dx, dz);
  if (d <= radius) return { x, z };
  const k = radius / d;
  return { x: center.x + dx * k, z: center.z + dz * k };
}

// Empurra um círculo (jogador) para fora de caixas alinhadas aos eixos: não dá para atravessar paredes nem a máquina.
// box = { minX, maxX, minZ, maxZ }
export function collideCircle(x, z, r, boxes, passes = 3) {
  for (let p = 0; p < passes; p++) {
    for (const b of boxes) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      let dx = x - cx, dz = z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d > 1e-9) { x = cx + (dx / d) * r; z = cz + (dz / d) * r; continue; }
      // centro dentro da caixa: sai pelo lado de menor penetração
      const out = [[x - b.minX, -1, 0], [b.maxX - x, 1, 0], [z - b.minZ, 0, -1], [b.maxZ - z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
      x += out[1] * (out[0] + r); z += out[2] * (out[0] + r);
    }
  }
  return { x, z };
}
