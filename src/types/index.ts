export type Team = 'player' | 'enemy';

export interface GridPos { x: number; y: number; }

// Spell est maintenant ISpell — tous les champs ont été renommés :
//   cost → paCost | range → maxRange | damage → baseDamage{min,max}
//   aoe → aoeSize | push → pushDistance
export type { ISpell as Spell } from '../data/spells/ISpell';
export type { SpellElement } from '../data/spells/ISpell';

export interface Unit {
  id: string;
  name: string;
  team: Team;
  pos: GridPos;
  hp: number;
  maxHp: number;
  pa: number;
  pm: number;
  maxPa: number;
  maxPm: number;
  initiative: number;
  spells: import('../data/spells/ISpell').ISpell[];
  sprite?: Phaser.GameObjects.Container;
  /** Résistances élémentaires en % (valeur positive = résistance, négative = vulnérabilité) */
  resistances?: Partial<Record<import('../data/spells/ISpell').SpellElement, number>>;
  /** Propriétés optionnelles pour les boss */
  isBoss?: boolean;
  behavior?: 'melee' | 'range' | 'spectral' | 'fungal' | 'charge';
  baseDamage?: number;
  /** PA drainés accumulés pendant les tours ennemis — appliqués au prochain reset de tour */
  drainedPa?: number;
  /** PM drainés accumulés pendant les tours ennemis — appliqués au prochain reset de tour */
  drainedPm?: number;
}

export type Mode = 'idle' | 'move' | 'cast';
