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
  /** Champs optionnels pour les boss */
  pa?: number;
  pm?: number;
  initiative?: number;
  isBoss?: boolean;
  damage?: number;
  behavior?: 'melee' | 'range' | 'spectral' | 'fungal' | 'charge';
  /** Or lâché par ce monstre (défaut : 100) */
  goldDrop?: number;
  /** XP accordée pour ce monstre (défaut : 100) */
  xpDrop?: number;
  /** Identifiant de groupe — tous les monstres du même groupe s'engagent ensemble */
  group?: string;
  /** Résistances élémentaires en % (0-100) */
  resistances?: { feu?: number; air?: number; eau?: number; terre?: number };
}

export interface ChestItem {
  id: string;
  qty: number;
  name: string;
  icon: string;
}

export interface ChestData {
  id: string;
  x: number;
  y: number;
  items: ChestItem[];
}

export interface DungeonDoor {
  x: number;
  y: number;
  targetMap: string;
  targetX: number;
  targetY: number;
  requiredItem: string;
  requiredItemName: string;
}

export interface NPCData {
  id: string;
  x: number;
  y: number;
  name: string;
  firstDialogues: string[];
  repeatDialogues: string[];
}

/**
 * Décoration sprite placée sur une case de la map.
 * Utilise un SpriteId du catalogue src/config/sprites.ts.
 * Le sprite est rendu centré sur la case, ancré au bas du sprite.
 *
 * Exemple JSON :
 *   { "id": "d1", "sprite": "pine_tree", "x": 5, "y": 3 }
 *   { "id": "d2", "sprite": "rock_large", "x": 10, "y": 7, "scale": 0.8 }
 */
export interface DecorationSpawn {
  id: string;
  /** ID court défini dans src/config/sprites.ts (ex: "pine_tree", "rock_small") */
  sprite: string;
  x: number;
  y: number;
  /** Facteur d'échelle optionnel (défaut 1.0) */
  scale?: number;
  /** Rotation en degrés, dans le sens horaire (défaut 0) */
  rotation?: number;
}

export interface MapData {
  id: string;
  width: number;
  height: number;
  zone: string;
  tiles: number[][];
  exits: MapExit[];
  spawns: MonsterSpawn[];
  /** Coordonnées de la map dans le monde [X, Y] style Dofus */
  coords?: [number, number];
  /** Coffres présents sur la map */
  chests?: ChestData[];
  /** Porte de donjon (nécessite un objet clef) */
  dungeonDoor?: DungeonDoor;
  /** PNJ présents sur la map */
  npcs?: NPCData[];
  /** Décorations sprite (arbres, rochers, champignons…) */
  decorations?: DecorationSpawn[];
  /** Bloque toutes les sorties tant que des monstres sont vivants */
  blockExitsUntilCleared?: boolean;
  /** En donjon : cliquer un monstre engage tous les monstres vivants */
  groupFight?: boolean;
  /**
   * Tuiles personnalisées : associe un index de tile (tel qu'exporté par l'éditeur)
   * au nom du fichier dans le dossier tilesPath.
   * Ex : { "0": "herbe.png", "1": "pave.png" }
   * Quand ce champ est présent, drawTiles() utilise des sprites image au lieu de polygones.
   */
  tileManifest?: Record<string, string>;
  /**
   * Chemin du dossier d'images (relatif à public/).
   * Défaut : "Assets/tiles/custom/"
   * Ex : "Assets/tiles/sol/"
   */
  tilesPath?: string;
  /**
   * Indices de tuiles bloquantes pour une map custom (remplacement de BLOCKED).
   * Si absent et tileManifest présent, aucune tuile n'est bloquante par défaut.
   */
  blockedTiles?: number[];
}
