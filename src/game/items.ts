import { Spell } from '../types';

export type EquipSlot = 'helmet' | 'chest' | 'legs' | 'boots' | 'weapon' | 'offhand' | 'ring1' | 'ring2' | 'amulet' | 'cape';

export interface ItemBonuses {
  hp?: number;
  fluide?: number;
  resistance?: number;
  portee?: number;
  meleeDamage?: number;
}

export interface EquipBonuses {
  hp: number;
  fluide: number;
  resistance: number;
  portee: number;
  pa: number;
  pm: number;
}

export interface Item {
  id: string;
  name: string;
  icon: string;
  slot: EquipSlot;
  weight: number;
  bonuses: ItemBonuses;
  description: string;
}

export interface InventoryEntry { id: string; qty: number; }

export type PlayerEquipment = Partial<Record<EquipSlot, string>>;

export interface PanoplyDef {
  id: string;
  name: string;
  slotRequirements: Partial<Record<EquipSlot, string>>;
  bonus: Partial<EquipBonuses>;
}

export const ITEMS: Record<string, Item> = {
  casque_fer: {
    id: 'casque_fer', name: 'Casque de Fer', icon: '⛑️', slot: 'helmet',
    weight: 5, bonuses: { hp: 10, fluide: 5 },
    description: '+10 PV max · +5 Magie max',
  },
  torse_fer: {
    id: 'torse_fer', name: 'Plastron de Fer', icon: '🥋', slot: 'chest',
    weight: 15, bonuses: { hp: 12, resistance: 3 },
    description: '+12 PV max · +3 Résistance',
  },
  jambieres_fer: {
    id: 'jambieres_fer', name: 'Jambières de Fer', icon: '👖', slot: 'legs',
    weight: 10, bonuses: { hp: 8, resistance: 2 },
    description: '+8 PV max · +2 Résistance',
  },
  bottes_fer: {
    id: 'bottes_fer', name: 'Bottes de Fer', icon: '👟', slot: 'boots',
    weight: 8, bonuses: { hp: 5, portee: 1 },
    description: '+5 PV max · +1 Portée',
  },
  arc_fer: {
    id: 'arc_fer', name: 'Arc de Fer', icon: '🏹', slot: 'weapon',
    weight: 12, bonuses: { portee: 1, meleeDamage: 6 },
    description: '+1 Portée · Corps à corps : 6 dégâts',
  },
  epee_fer: {
    id: 'epee_fer', name: 'Épée de Fer', icon: '⚔️', slot: 'weapon',
    weight: 14, bonuses: { meleeDamage: 15 },
    description: 'Corps à corps : 15 dégâts',
  },
  bouclier_fer: {
    id: 'bouclier_fer', name: 'Bouclier de Fer', icon: '🛡️', slot: 'offhand',
    weight: 15, bonuses: { hp: 5, resistance: 4 },
    description: '+5 PV max · +4 Résistance',
  },
  anneau_fer: {
    id: 'anneau_fer', name: 'Anneau de Fer', icon: '💍', slot: 'ring1',
    weight: 2, bonuses: { hp: 3, fluide: 3 },
    description: '+3 PV max · +3 Magie max',
  },
  amulette_fer: {
    id: 'amulette_fer', name: 'Amulette de Fer', icon: '📿', slot: 'amulet',
    weight: 3, bonuses: { fluide: 5, portee: 1 },
    description: '+5 Magie max · +1 Portée',
  },
  cape_fer: {
    id: 'cape_fer', name: 'Cape de Fer', icon: '🧣', slot: 'cape',
    weight: 5, bonuses: { hp: 6, fluide: 2 },
    description: '+6 PV max · +2 Magie max',
  },
};

export const MAX_WEIGHT = 1000;

export const PANOPLIES: PanoplyDef[] = [
  {
    id: 'panoplie_fer',
    name: 'Panoplie de Fer',
    slotRequirements: {
      helmet: 'casque_fer',
      chest: 'torse_fer',
      legs: 'jambieres_fer',
      boots: 'bottes_fer',
      weapon: 'arc_fer',
      offhand: 'bouclier_fer',
      ring1: 'anneau_fer',
      ring2: 'anneau_fer',
      amulet: 'amulette_fer',
      cape: 'cape_fer',
    },
    bonus: { pa: 1, pm: 1 },
  },
];

export function emptyEquipment(): PlayerEquipment { return {}; }

export function startingInventory(): InventoryEntry[] {
  return [
    { id: 'casque_fer', qty: 1 },
    { id: 'torse_fer', qty: 1 },
    { id: 'jambieres_fer', qty: 1 },
    { id: 'bottes_fer', qty: 1 },
    { id: 'arc_fer', qty: 1 },
    { id: 'bouclier_fer', qty: 1 },
    { id: 'anneau_fer', qty: 2 },
    { id: 'amulette_fer', qty: 1 },
    { id: 'cape_fer', qty: 1 },
  ];
}

export function isPanoplyComplete(equip: PlayerEquipment, p: PanoplyDef): boolean {
  for (const [slot, requiredId] of Object.entries(p.slotRequirements) as [EquipSlot, string][]) {
    if (equip[slot] !== requiredId) return false;
  }
  return true;
}

export function getPanoplyProgress(equip: PlayerEquipment, p: PanoplyDef): { count: number; total: number } {
  const entries = Object.entries(p.slotRequirements) as [EquipSlot, string][];
  let count = 0;
  for (const [slot, requiredId] of entries) {
    if (equip[slot] === requiredId) count++;
  }
  return { count, total: entries.length };
}

export function getEquipBonuses(equip: PlayerEquipment): EquipBonuses {
  const result: EquipBonuses = { hp: 0, fluide: 0, resistance: 0, portee: 0, pa: 0, pm: 0 };
  for (const itemId of Object.values(equip)) {
    if (!itemId) continue;
    const item = ITEMS[itemId];
    if (!item) continue;
    result.hp += item.bonuses.hp ?? 0;
    result.fluide += item.bonuses.fluide ?? 0;
    result.resistance += item.bonuses.resistance ?? 0;
    result.portee += item.bonuses.portee ?? 0;
  }
  for (const p of PANOPLIES) {
    if (isPanoplyComplete(equip, p)) {
      result.hp += p.bonus.hp ?? 0;
      result.fluide += p.bonus.fluide ?? 0;
      result.resistance += p.bonus.resistance ?? 0;
      result.portee += p.bonus.portee ?? 0;
      result.pa += p.bonus.pa ?? 0;
      result.pm += p.bonus.pm ?? 0;
    }
  }
  return result;
}

export function getMeleeSpell(equip: PlayerEquipment): Spell {
  const weapon = equip.weapon ? ITEMS[equip.weapon] : null;
  const dmg = weapon?.bonuses.meleeDamage ?? 5;
  const icon = weapon ? weapon.icon : '👊';
  const name = weapon ? weapon.name.split(' ')[0] : 'Poings';
  return {
    id: 'melee',
    name,
    icon,
    cost: 2,
    fluideCost: 0,
    range: 1,
    minRange: 1,
    damage: dmg,
    description: weapon
      ? `Corps à corps avec ${weapon.name} — ${dmg} dégâts. Adjacent.`
      : `Coups de poings — ${dmg} dégâts. Adjacent.`,
  };
}

export function chestInventory(): InventoryEntry[] {
  return Object.keys(ITEMS).map(id => ({ id, qty: id === 'anneau_fer' ? 2 : 1 }));
}

export function currentWeight(equip: PlayerEquipment, inv: InventoryEntry[]): number {
  let w = 0;
  for (const itemId of Object.values(equip)) {
    if (itemId) w += ITEMS[itemId]?.weight ?? 0;
  }
  for (const e of inv) {
    w += (ITEMS[e.id]?.weight ?? 0) * e.qty;
  }
  return w;
}
