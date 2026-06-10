// ── Grille isométrique — WorldScene (carte du monde) ─────────────────────────
// Ces valeurs définissent la taille des tuiles sur la carte du monde.
// Elles sont indépendantes de la grille de combat (voir game/iso.ts).
export const WS_TW = 112; // largeur  tuile monde  (= 64 × 1.75)
export const WS_TH =  56; // hauteur  tuile monde  (= 32 × 1.75)

// Dimensions de carte par défaut (fallback si le JSON ne définit pas width/height)
export const DEFAULT_MAP_W = 14;
export const DEFAULT_MAP_H =  9;

// ── Grille isométrique — CombatScene (arène de combat) ───────────────────────
// Définie également dans game/iso.ts (TILE_W, TILE_H, GRID_W, GRID_H).
// Source unique de vérité : game/iso.ts — ne pas dupliquer ici.
