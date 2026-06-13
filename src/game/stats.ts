export interface PlayerStats {
  vitalite: number;
  fluide: number;
  portee: number;
  eau: number;
  feu: number;
  air: number;
  terre: number;
  psy: number;
  glace: number;
  electrik: number;
  soin: number;
  resistance: number;
}

export function emptyStats(): PlayerStats {
  return { vitalite: 0, fluide: 0, portee: 0, eau: 0, feu: 0, air: 0, terre: 0, psy: 0, glace: 0, electrik: 0, soin: 0, resistance: 0 };
}

/**
 * XP nécessaire pour atteindre le niveau `lvl` (depuis 0).
 * Courbe exponentielle douce — 100 niveaux, ~1M XP au niveau 100.
 *   Nv 1  :       0 XP
 *   Nv 2  :     100 XP   (~1 combat)
 *   Nv 5  :     850 XP
 *   Nv 10 :   3 900 XP
 *   Nv 20 :  17 000 XP
 *   Nv 50 : 130 000 XP
 *   Nv100 : 600 000 XP
 */
export function xpForLevel(lvl: number): number {
  if (lvl <= 1) return 0;
  return Math.floor(100 * Math.pow(lvl - 1, 1.8));
}

/** Retourne le niveau du joueur en fonction de son XP total. */
export function getLevel(xp: number): number {
  let lvl = 1;
  while (lvl < 100 && xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

export function usedPoints(stats: PlayerStats): number {
  return (Object.keys(stats) as (keyof PlayerStats)[]).reduce((s, k) => s + stats[k], 0);
}

export function availablePoints(xp: number, stats: PlayerStats): number {
  return Math.max(0, (getLevel(xp) - 1) * 10 - usedPoints(stats));
}

/**
 * PV max du joueur.
 * @param playerLevel  Niveau du joueur (facultatif). Chaque niveau au-delà du 1er ajoute +10 PV.
 */
export function maxHp(stats: PlayerStats, playerLevel = 1): number {
  return 50 + stats.vitalite + (playerLevel - 1) * 10;
}

/**
 * Bonus de dégâts finaux (en %) conféré par le niveau du joueur.
 * +1 % par niveau au-delà du niveau 1.
 */
export function finalDamagePercent(playerLevel: number): number {
  return Math.max(0, playerLevel - 1);
}

export function maxPa(stats: PlayerStats): number {
  return 6;
}

export function maxPm(stats: PlayerStats): number {
  return 3;
}

export function maxMagic(stats: PlayerStats): number {
  // Base 15 Fluide au niveau 1 + 1 point de Fluide max tous les 5 points investis dans la stat
  return 15 + Math.floor(stats.fluide / 5);
}

export function effectiveResistance(stats: PlayerStats): number {
  // 1 point de Résistance effectif tous les 3 points investis
  return Math.floor(stats.resistance / 3);
}

export function applyXpBonus(baseXp: number): number {
  return baseXp;
}
