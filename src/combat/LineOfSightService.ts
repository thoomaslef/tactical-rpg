import { GRID_W, GRID_H } from '../game/iso';

/** Coordonnées d'une cellule sur la grille. Compatible avec GridPos de types/index.ts */
export interface GridCoord {
  x: number;
  y: number;
}

/**
 * Service de calcul de la Ligne de Vue (LDV).
 *
 * Principe : on trace une ligne droite entre le lanceur et la cible (coordonnées
 * de grille). Si une cellule intermédiaire contient un obstacle opaque, la LDV
 * est bloquée et le sort ne peut pas être lancé.
 *
 * Algorithme : DDA (Digital Differential Analyzer) — variante de Bresenham
 * adaptée pour détecter le passage exact par un coin de cellule (cas diagonal).
 *
 * Cas diagonal (règle Dofus) :
 *   Quand la ligne passe exactement entre deux cellules (coin),
 *   les DEUX cellules adjacentes sont testées.
 *   ✓ Une seule bloque → la LDV passe quand même.
 *   ✗ Les deux bloquent → LDV bloquée.
 *
 * Usage dans CombatScene :
 *   const blocker = (x, y) => !!units.find(u => u.hp > 0 && u.pos.x===x && u.pos.y===y);
 *   if (LineOfSightService.hasLineOfSight(caster.pos, target, blocker)) { ... }
 */
export class LineOfSightService {

  // ─── API publique ────────────────────────────────────────────────────────────

  /**
   * Vérifie si la ligne de vue entre deux cellules est dégagée.
   *
   * @param from      - Coordonnées {x,y} du lanceur (pas de sa cible)
   * @param to        - Coordonnées {x,y} de la cible
   * @param isBlocker - Callback : retourne true si la cellule (x,y) est opaque
   * @returns true si la LDV est libre, false si bloquée
   */
  static hasLineOfSight(
    from: GridCoord,
    to: GridCoord,
    isBlocker: (x: number, y: number) => boolean,
  ): boolean {
    const groups = LineOfSightService._getIntermediateCellGroups(from, to);
    for (const group of groups) {
      // Un groupe d'une cellule : bloqué si cette cellule est opaque.
      // Un groupe de deux cellules (coin diagonal) : bloqué uniquement si LES DEUX sont opaques.
      if (group.every(c => isBlocker(c.x, c.y))) return false;
    }
    return true;
  }

  /**
   * Retourne toutes les cellules qui bloquent effectivement la LDV entre from et to.
   * Utile pour le debug ou l'affichage d'un chemin de LDV bloqué.
   */
  static getBlockingCells(
    from: GridCoord,
    to: GridCoord,
    isBlocker: (x: number, y: number) => boolean,
  ): GridCoord[] {
    const blocking: GridCoord[] = [];
    const groups = LineOfSightService._getIntermediateCellGroups(from, to);
    for (const group of groups) {
      if (group.every(c => isBlocker(c.x, c.y))) {
        blocking.push(...group);
      }
    }
    return blocking;
  }

  /**
   * Retourne toutes les cellules ciblables depuis `from` pour un sort donné,
   * en tenant compte de la portée ET de la ligne de vue.
   *
   * @param from        - Position du lanceur
   * @param minRange    - Portée minimale (inclusive)
   * @param maxRange    - Portée maximale (inclusive)
   * @param ignoresLOS  - Si true, la LDV n'est pas vérifiée
   * @param isBlocker   - Callback d'obstacle
   * @param gridW       - Largeur de la grille (défaut : GRID_W)
   * @param gridH       - Hauteur de la grille (défaut : GRID_H)
   */
  static getTargetableCells(
    from: GridCoord,
    minRange: number,
    maxRange: number,
    ignoresLOS: boolean,
    isBlocker: (x: number, y: number) => boolean,
    gridW = GRID_W,
    gridH = GRID_H,
  ): GridCoord[] {
    const result: GridCoord[] = [];
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        if (x === from.x && y === from.y) continue;
        // Distance de Manhattan (portée Dofus)
        const d = Math.abs(x - from.x) + Math.abs(y - from.y);
        if (d < minRange || d > maxRange) continue;
        if (ignoresLOS || LineOfSightService.hasLineOfSight(from, { x, y }, isBlocker)) {
          result.push({ x, y });
        }
      }
    }
    return result;
  }

  // ─── Algorithme interne ──────────────────────────────────────────────────────

  /**
   * Calcule les groupes de cellules intermédiaires entre `from` et `to`
   * (cellules de départ et d'arrivée exclues).
   *
   * Retourne un tableau de groupes :
   *   - groupe à 1 élément  → traversée directe : si cette cellule bloque, LDV bloquée
   *   - groupe à 2 éléments → traversée d'un coin : les DEUX doivent bloquer
   *
   * Implémentation DDA :
   *   On compte le nombre de "pas" dans chaque axe (nx = |dx|, ny = |dy|).
   *   À chaque pas on choisit la direction dont le "temps de franchissement"
   *   est le plus petit. Si les deux temps sont égaux → pas diagonal (coin).
   *
   *   Analogie : la ligne parcourt une distance totale de 1 (normalisée).
   *   tX = (ix + 0.5) / nx représente quand on franchira le prochain bord vertical.
   *   tY = (iy + 0.5) / ny représente quand on franchira le prochain bord horizontal.
   */
  private static _getIntermediateCellGroups(
    from: GridCoord,
    to: GridCoord,
  ): GridCoord[][] {
    const groups: GridCoord[][] = [];

    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // Même cellule : aucun intermédiaire
    if (dx === 0 && dy === 0) return [];

    const nx = Math.abs(dx);   // nombre de pas horizontaux
    const ny = Math.abs(dy);   // nombre de pas verticaux
    const sx = Math.sign(dx);  // direction en X (+1 ou -1)
    const sy = Math.sign(dy);  // direction en Y (+1 ou -1)

    let px = from.x;
    let py = from.y;

    for (let ix = 0, iy = 0; ix < nx || iy < ny;) {
      // "Temps" avant le prochain franchissement de bord dans chaque axe.
      // On utilise +0.5 pour rester au centre de chaque pas (évite les erreurs
      // d'arrondi sur les lignes orthogonales pures).
      const tX = nx > 0 ? (ix + 0.5) / nx : Infinity;
      const tY = ny > 0 ? (iy + 0.5) / ny : Infinity;

      // Tolérance pour comparer deux flottants (cas où tX ≈ tY = coin diagonal)
      const isDiagonal = Math.abs(tX - tY) < 1e-10;

      if (isDiagonal) {
        // ── CAS DIAGONAL : la ligne passe exactement par un coin ──────────────
        // Les deux cellules de part et d'autre du coin sont vérifiées ensemble.
        // cellA = la cellule qu'on atteindrait en ne bougeant que sur X
        // cellB = la cellule qu'on atteindrait en ne bougeant que sur Y
        const cellA: GridCoord = { x: px + sx, y: py };
        const cellB: GridCoord = { x: px,      y: py + sy };

        px += sx;
        py += sy;
        ix++;
        iy++;

        // Exclure la cellule d'arrivée
        if (px !== to.x || py !== to.y) {
          groups.push([cellA, cellB]);
        }
      } else if (tX < tY) {
        // ── PAS HORIZONTAL ───────────────────────────────────────────────────
        px += sx;
        ix++;

        if (px !== to.x || py !== to.y) {
          groups.push([{ x: px, y: py }]);
        }
      } else {
        // ── PAS VERTICAL ─────────────────────────────────────────────────────
        py += sy;
        iy++;

        if (px !== to.x || py !== to.y) {
          groups.push([{ x: px, y: py }]);
        }
      }
    }

    return groups;
  }
}
