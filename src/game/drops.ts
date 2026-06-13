export interface DropEntry {
  itemId: string;
  chance: number; // 0.0–1.0
  qty?: number;
}

export interface MonsterDef {
  name: string;
  icon: string;
  drops: DropEntry[];
}

export const MONSTER_DROPS: MonsterDef[] = [
  {
    name: 'Rat',
    icon: '🐀',
    drops: [
      { itemId: 'rat_fur',             chance: 1.00 },
      { itemId: 'clef_antre_razmotek', chance: 0.10 },
    ],
  },
  {
    name: 'Rumineuse',
    icon: '🐄',
    drops: [
      { itemId: 'cuir_rumineuse', chance: 0.30 },
      { itemId: 'anneau_foret',   chance: 0.20 },
    ],
  },
  {
    name: 'Sporrin',
    icon: '🍄',
    drops: [
      { itemId: 'psylo',          chance: 0.30 },
      { itemId: 'amulette_foret', chance: 0.20 },
    ],
  },
  {
    name: 'Défoncier',
    icon: '🐗',
    drops: [
      { itemId: 'defense_defoncier', chance: 0.30 },
      { itemId: 'casque_foret',      chance: 0.20 },
    ],
  },
  {
    name: 'Groinard',
    icon: '🦌',
    drops: [
      { itemId: 'anneau_foret', chance: 0.20 },
    ],
  },
  {
    name: 'Razmotek',
    icon: '💀',
    drops: [
      { itemId: 'defense_razmotek', chance: 1.00 },
    ],
  },
];

/** Items droppables par n'importe quel monstre non-boss (panoplie de Fer). */
export const GENERIC_DROPS: DropEntry[] = [
  { itemId: 'casque_fer',    chance: 0.10 },
  { itemId: 'torse_fer',     chance: 0.10 },
  { itemId: 'jambieres_fer', chance: 0.10 },
  { itemId: 'bottes_fer',    chance: 0.10 },
  { itemId: 'bouclier_fer',  chance: 0.10 },
  { itemId: 'anneau_fer',    chance: 0.10 },
  { itemId: 'amulette_fer',  chance: 0.10 },
  { itemId: 'cape_fer',      chance: 0.10 },
];
