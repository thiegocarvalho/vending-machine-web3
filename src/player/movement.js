export function clampToWall(x, z, radius, center = { x: 0, z: 0 }) {
  const dx = x - center.x, dz = z - center.z;
  const d = Math.hypot(dx, dz);
  if (d <= radius) return { x, z };
  const k = radius / d;
  return { x: center.x + dx * k, z: center.z + dz * k };
}
