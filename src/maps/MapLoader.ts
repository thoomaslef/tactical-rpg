export interface MapExit {
  x: number;
  y: number;
  targetMap: string;
  targetX: number;
  targetY: number;
}

export interface MonsterSpawn {
  id: string;
  x: number;
  y: number;
  hp: number;
  name: string;
}

export interface MapData {
  id: string;
  width: number;
  height: number;
  zone: string;
  tiles: number[][];
  exits: MapExit[];
  spawns: MonsterSpawn[];
}
