import { ISpell } from '../data/spells/ISpell';

export type EquipSlot = 'helmet' | 'chest' | 'legs' | 'boots' | 'weapon' | 'offhand' | 'ring1' | 'ring2' | 'amulet' | 'cape';

export interface ItemBonuses {
  hp?: number;
  fluide?: number;
  resistance?: number;
  portee?: number;
  meleeDamage?: number;
  terre?: number;
  feu?: number;
}

export interface EquipBonuses {
  hp: number;
  fluide: number;
  resistance: number;
  portee: number;
  pa: number;
  pm: number;
  terre: number;
  feu: number;
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
    weight: 5, bonuses: { hp: 5, fluide: 3 },
    description: '+5 PV max · +3 Fluide max',
  },
  torse_fer: {
    id: 'torse_fer', name: 'Plastron de Fer', icon: '🥋', slot: 'chest',
    weight: 15, bonuses: { hp: 12 },
    description: '+12 PV max',
  },
  jambieres_fer: {
    id: 'jambieres_fer', name: 'Jambières de Fer', icon: '👖', slot: 'legs',
    weight: 10, bonuses: { hp: 8 },
    description: '+8 PV max',
  },
  bottes_fer: {
    id: 'bottes_fer', name: 'Bottes de Fer', icon: '👟', slot: 'boots',
    weight: 8, bonuses: { hp: 5 },
    description: '+5 PV max',
  },
  arc_fer: {
    id: 'arc_fer', name: 'Arc de Fer', icon: '🏹', slot: 'weapon',
    weight: 12, bonuses: { meleeDamage: 6 },
    description: 'Corps à corps : 6 dégâts',
  },
  epee_fer: {
    id: 'epee_fer', name: 'Épée de Fer', icon: '⚔️', slot: 'weapon',
    weight: 14, bonuses: { meleeDamage: 15 },
    description: 'Corps à corps : 15 dégâts',
  },
  bouclier_fer: {
    id: 'bouclier_fer', name: 'Bouclier de Fer', icon: '🛡️', slot: 'offhand',
    weight: 15, bonuses: { hp: 5 },
    description: '+5 PV max',
  },
  anneau_fer: {
    id: 'anneau_fer', name: 'Anneau de Fer', icon: '💍', slot: 'ring1',
    weight: 2, bonuses: { hp: 3, fluide: 3 },
    description: '+3 PV max · +3 Fluide max',
  },
  amulette_fer: {
    id: 'amulette_fer', name: 'Amulette de Fer', icon: '📿', slot: 'amulet',
    weight: 3, bonuses: { fluide: 2 },
    description: '+2 Fluide max',
  },
  cape_fer: {
    id: 'cape_fer', name: 'Cape de Fer', icon: '🧣', slot: 'cape',
    weight: 5, bonuses: { hp: 6, fluide: 2 },
    description: '+6 PV max · +2 Fluide max',
  },
  defense_razmotek: {
    id: 'defense_razmotek', name: 'Défense de Razmotek', icon: '🦷', slot: 'weapon',
    weight: 8, bonuses: { meleeDamage: 10 },
    description: 'La dent du boss vaincu. Corps à corps : +10 dégâts.',
  },
  anneau_foret: {
    id: 'anneau_foret', name: 'Anneau de la Forêt', icon: '🌿', slot: 'ring1',
    weight: 2, bonuses: { terre: 10, feu: 10 },
    description: '+10% dégâts Terre · +10% dégâts Feu',
  },
  amulette_foret: {
    id: 'amulette_foret', name: 'Amulette de la Forêt', icon: '🍀', slot: 'amulet',
    weight: 3, bonuses: { fluide: 10, hp: 10 },
    description: '+10 Fluide max · +10 PV max',
  },
  casque_foret: {
    id: 'casque_foret', name: 'Casque de la Forêt', icon: '🌲', slot: 'helmet',
    weight: 6, bonuses: { terre: 10, feu: 10, resistance: 3 },
    description: '+10% dégâts Terre · +10% dégâts Feu · +3 Résistances',
  },
};

export const MAX_WEIGHT = 1000;

export const PANOPLIES: PanoplyDef[] = [
  {
    id: 'panoplie_fer',
    name: 'Panoplie de Fer',
    slotRequirements: {
      helmet:  'casque_fer',
      chest:   'torse_fer',
      legs:    'jambieres_fer',
      boots:   'bottes_fer',
      offhand: 'bouclier_fer',
      ring1:   'anneau_fer',
      ring2:   'anneau_fer',
      amulet:  'amulette_fer',
      cape:    'cape_fer',
    },
    bonus: { pa: 1 },
  },
  {
    id: 'panoplie_foret',
    name: 'Panoplie de la Forêt',
    slotRequirements: {
      helmet: 'casque_foret',
      ring1:  'anneau_foret',
      ring2:  'anneau_foret',
      amulet: 'amulette_foret',
    },
    bonus: { pa: 1 },
  },
];

export function emptyEquipment(): PlayerEquipment { return {}; }

export function startingInventory(): InventoryEntry[] {
  return [];
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
  const result: EquipBonuses = { hp: 0, fluide: 0, resistance: 0, portee: 0, pa: 0, pm: 0, terre: 0, feu: 0 };
  for (const itemId of Object.values(equip)) {
    if (!itemId) continue;
    const item = ITEMS[itemId];
    if (!item) continue;
    result.hp += item.bonuses.hp ?? 0;
    result.fluide += item.bonuses.fluide ?? 0;
    result.resistance += item.bonuses.resistance ?? 0;
    result.portee += item.bonuses.portee ?? 0;
    result.terre += item.bonuses.terre ?? 0;
    result.feu += item.bonuses.feu ?? 0;
  }
  for (const p of PANOPLIES) {
    if (isPanoplyComplete(equip, p)) {
      result.hp += p.bonus.hp ?? 0;
      result.fluide += p.bonus.fluide ?? 0;
      result.resistance += p.bonus.resistance ?? 0;
      result.portee += p.bonus.portee ?? 0;
      result.pa += p.bonus.pa ?? 0;
      result.pm += p.bonus.pm ?? 0;
      result.terre += p.bonus.terre ?? 0;
      result.feu += p.bonus.feu ?? 0;
    }
  }
  return result;
}

export function getMeleeSpell(equip: PlayerEquipment): ISpell {
  const weapon = equip.weapon ? ITEMS[equip.weapon] : null;
  const dmg = weapon?.bonuses.meleeDamage ?? 5;
  const icon = weapon ? weapon.icon : '👊';
  const name = weapon ? weapon.name.split(' ')[0] : 'Poings';
  return {
    id: 'melee',
    name,
    icon,
    paCost: 2,
    fluideCost: 0,
    maxRange: 1,
    minRange: 1,
    baseDamage: { min: dmg, max: dmg },
    element: 'neutre',
    isModifiable: false,
    description: weapon
      ? `Corps à corps avec ${weapon.name} — ${dmg} dégâts. Adjacent.`
      : `Coups de poings — ${dmg} dégâts. Adjacent.`,
  };
}

export function chestInventory(): InventoryEntry[] {
  return Object.keys(ITEMS).map(id => ({
    id,
    qty: (id === 'anneau_fer' || id === 'anneau_foret') ? 2 : 1,
  }));
}

// ── Catalogue de ressources non-équipables ────────────────────────────────────
export interface ResourceItem { id: string; name: string; icon: string; }

export const RESOURCE_CATALOG: Record<string, ResourceItem> = {
  // Bûcheronnage
  ash_wood:        { id: 'ash_wood',        name: 'Bois de Frêne',             icon: '🪵' },
  oak_wood:        { id: 'oak_wood',        name: 'Bois de Chêne',             icon: '🪵' },
  pine_resin:      { id: 'pine_resin',      name: 'Résine Ardente',            icon: '🍯' },
  dark_alder_wood: { id: 'dark_alder_wood', name: "Bois d'Aulne Noir",         icon: '🪵' },
  soul_wood:       { id: 'soul_wood',       name: "Bois d'Âme Rose",           icon: '🌸' },
  hydric_core:     { id: 'hydric_core',     name: 'Cœur Hydrique',             icon: '💧' },
  venom_bark:      { id: 'venom_bark',      name: 'Écorce Vénéneuse',          icon: '🌿' },
  ice_crystal:     { id: 'ice_crystal',     name: "Cristal de Glace d'Épicéa", icon: '❄️' },
  thunder_wood:    { id: 'thunder_wood',    name: 'Bois Foudroyé',             icon: '⚡' },
  eternity_shard:  { id: 'eternity_shard',  name: "Fragment d'Éternité",       icon: '✨' },
  // Objets clés / quêtes
  clef_antre_razmotek:  { id: 'clef_antre_razmotek',  name: "Clef de l'Antre du Razmotek", icon: '🔑' },
  // Matériaux de monstres
  rat_fur:              { id: 'rat_fur',               name: 'Poils de Rat',               icon: '🐀' },
  cuir_rumineuse:       { id: 'cuir_rumineuse',        name: 'Cuir de Rumineuse',           icon: '🐄' },
  psylo:                { id: 'psylo',                 name: 'Psylo',                        icon: '🍄' },
  defense_defoncier:    { id: 'defense_defoncier',     name: 'Défense de Défoncier',          icon: '🐗' },
  // Consommables spéciaux
  xp_scroll_max:        { id: 'xp_scroll_max',         name: 'Élixir du Maître',            icon: '⭐' },
};

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
