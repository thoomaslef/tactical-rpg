import { GridPos } from '../types';
import { GRID_W, GRID_H, inBounds, manhattan } from './iso';

export function bfsReachable(start: GridPos, maxDist: number, blocked: (x: number, y: number) => boolean): Map<string, { dist: number; prev: string | null }> {
  const result = new Map<string, { dist: number; prev: string | null }>();
  const key = (x: number, y: number) => `${x},${y}`;
  result.set(key(start.x, start.y), { dist: 0, prev: null });
  const queue: GridPos[] = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = result.get(key(cur.x, cur.y))!.dist;
    if (d >= maxDist) continue;
    const neighbors = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 }
    ];
    for (const n of neighbors) {
      if (!inBounds(n.x, n.y)) continue;
      const k = key(n.x, n.y);
      if (result.has(k)) continue;
      if (blocked(n.x, n.y)) continue;
      result.set(k, { dist: d + 1, prev: key(cur.x, cur.y) });
      queue.push(n);
    }
  }
  return result;
}

export function reconstructPath(target: GridPos, reached: Map<string, { dist: number; prev: string | null }>): GridPos[] {
  const key = (x: number, y: number) => `${x},${y}`;
  const path: GridPos[] = [];
  let cur: string | null = key(target.x, target.y);
  while (cur) {
    const [xs, ys] = cur.split(',');
    path.unshift({ x: +xs, y: +ys });
    const node = reached.get(cur);
    if (!node) break;
    cur = node.prev;
  }
  return path;
}

export function lineOfCells(a: GridPos, b: GridPos): GridPos[] {
  const cells: GridPos[] = [];
  let x = a.x, y = a.y;
  const dx = Math.abs(b.x - x), dy = Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx - dy;
  while (true) {
    cells.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return cells;
}
