export type Team = 'player' | 'enemy';

export interface GridPos { x: number; y: number; }

export interface Spell {
  id: string;
  name: string;
  icon: string;
  cost: number;
  range: number;
  minRange?: number;
  damage?: number;
  aoe?: number;
  push?: number;
  description: string;
}

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
  spells: Spell[];
  sprite?: Phaser.GameObjects.Container;
}

export type Mode = 'idle' | 'move' | 'cast';
