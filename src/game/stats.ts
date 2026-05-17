export interface PlayerStats {
  vitalite: number;
  sagesse: number;
  fluide: number;
  portee: number;
  eau: number;
  feu: number;
  air: number;
  terre: number;
  soin: number;
  resistance: number;
}

export function emptyStats(): PlayerStats {
  return { vitalite: 0, sagesse: 0, fluide: 0, portee: 0, eau: 0, feu: 0, air: 0, terre: 0, soin: 0, resistance: 0 };
}

export function getLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

export function xpForLevel(lvl: number): number {
  return (lvl - 1) * 100;
}

export function usedPoints(stats: PlayerStats): number {
  return (Object.keys(stats) as (keyof PlayerStats)[]).reduce((s, k) => s + stats[k], 0);
}

export function availablePoints(xp: number, stats: PlayerStats): number {
  return Math.max(0, (getLevel(xp) - 1) * 10 - usedPoints(stats));
}

export function maxHp(stats: PlayerStats): number {
  return 50 + stats.vitalite;
}

export function maxPa(stats: PlayerStats): number {
  return 6;
}

export function maxPm(stats: PlayerStats): number {
  return 3;
}

export function maxMagic(stats: PlayerStats): number {
  return 10 + stats.fluide;
}

export function applyXpBonus(baseXp: number, stats: PlayerStats): number {
  return Math.floor(baseXp * (1 + stats.sagesse / 100));
}
