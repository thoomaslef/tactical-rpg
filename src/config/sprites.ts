/**
 * Catalogue global des sprites de décoration (Assets/sprites/).
 * Chaque ID court (SpriteId) pointe vers le fichier image transparent.
 *
 * Utilisation dans les maps :
 *   "decorations": [{ "id": "d1", "sprite": "pine_tree", "x": 5, "y": 3 }]
 *
 * Fichiers présents dans public/Assets/sprites/ :
 *   pine_tree_1.png, pine_tree_2.png, pine_tree_3.png
 *   leafy_tree_1.png, leafy_tree_4.png
 *   rock_large_1.png …rock_large_4.png
 *   rock_small_1.png …rock_small_4.png
 *   mushrooms_1.png, mushrooms_4.png
 *   wall_wood.webp, gate_wood.png
 */

export type SpriteId =
  // Sapins / conifères (3 variantes)
  | 'pine_tree'   | 'pine_tree_2'  | 'pine_tree_3'
  // Arbres feuillus (2 variantes)
  | 'leafy_tree'  | 'leafy_tree_4'
  // Grands rochers gris (4 variantes)
  | 'rock_large'  | 'rock_large_2' | 'rock_large_3' | 'rock_large_4'
  // Petits rochers gris (4 variantes)
  | 'rock_small'  | 'rock_small_2' | 'rock_small_3' | 'rock_small_4'
  // Groupes de champignons rouges (2 variantes)
  | 'mushrooms'   | 'mushrooms_4'
  // Muraille en bois + porte
  | 'wall_wood'   | 'gate_wood';

export const SPRITES_PATH = 'Assets/sprites/';

/** Correspond à chaque SpriteId le nom de fichier dans Assets/sprites/ */
export const SPRITES_MANIFEST: Record<SpriteId, string> = {
  // Sapins / conifères
  pine_tree:   'pine_tree_1.png',
  pine_tree_2: 'pine_tree_2.png',
  pine_tree_3: 'pine_tree_3.png',

  // Arbres feuillus
  leafy_tree:   'leafy_tree_1.png',
  leafy_tree_4: 'leafy_tree_4.png',

  // Grands rochers
  rock_large:   'rock_large_1.png',
  rock_large_2: 'rock_large_2.png',
  rock_large_3: 'rock_large_3.png',
  rock_large_4: 'rock_large_4.png',

  // Petits rochers
  rock_small:   'rock_small_1.png',
  rock_small_2: 'rock_small_2.png',
  rock_small_3: 'rock_small_3.png',
  rock_small_4: 'rock_small_4.png',

  // Champignons rouges
  mushrooms:   'mushrooms_1.png',
  mushrooms_4: 'mushrooms_4.png',

  // Muraille en bois + porte
  wall_wood: 'wall_wood.webp',
  gate_wood: 'gate_wood.png',
};

/** Sprites qui bloquent le passage (non traversables) */
export const SPRITES_BLOCKED = new Set<SpriteId>([
  'pine_tree',   'pine_tree_2',  'pine_tree_3',
  'leafy_tree',  'leafy_tree_4',
  'rock_large',  'rock_large_2', 'rock_large_3', 'rock_large_4',
  'rock_small',  'rock_small_2', 'rock_small_3', 'rock_small_4',
  'wall_wood',   // murs en bois — infranchissables
  // mushrooms, gate_wood → passables
]);
