export const TILE_W = 64;
export const TILE_H = 32;
export const GRID_W = 15;
export const GRID_H = 15;

export function gridToIso(gx: number, gy: number, originX: number, originY: number) {
  const x = originX + (gx - gy) * (TILE_W / 2);
  const y = originY + (gx + gy) * (TILE_H / 2);
  return { x, y };
}

export function isoToGrid(px: number, py: number, originX: number, originY: number) {
  const dx = px - originX;
  const dy = py - originY;
  const gx = (dx / (TILE_W / 2) + dy / (TILE_H / 2)) / 2;
  const gy = (dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2;
  return { x: Math.round(gx), y: Math.round(gy) };
}

export function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
}
