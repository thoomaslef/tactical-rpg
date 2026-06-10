export type SpellElement = 'feu' | 'air' | 'eau' | 'terre' | 'neutre' | 'psy' | 'glace' | 'electrik';

export type SpellEffectType = 'debuff' | 'buff' | 'summon';

export interface ISpell {
  id: string;
  name: string;
  icon: string;
  /** Classe propriétaire du sort (absent = générique) */
  classe?: string;
  /** Coût en Points d'Action */
  paCost: number;
  /** Coût en Fluide (0 = aucun) */
  fluideCost: number;
  /** Portée maximale */
  maxRange: number;
  /** Portée minimale (défaut : 1) */
  minRange?: number;
  /** Dégâts de base min/max (absent = sort sans dégâts) */
  baseDamage?: { min: number; max: number };
  /** Rayon de zone autour de la cible (0 ou absent = monocible) */
  aoeSize?: number;
  /** Forme de la zone ('circle' | 'cross' | ...) */
  aoeShape?: string;
  /** Si true, la zone est centrée sur le lanceur lui-même */
  aoeAroundSelf?: boolean;
  /** Cases de recul infligées à la cible */
  pushDistance?: number;
  /** Cases d'attraction vers le lanceur */
  pullDistance?: number;
  /** Élément du sort — détermine quel bonus de stats s'applique */
  element?: SpellElement;
  /** Éléments multiples (remplace element si défini — bonus cumulés) */
  elements?: SpellElement[];
  /** Recharge en tours après utilisation (0 ou absent = pas de CD) */
  cooldown?: number;
  /** Nombre max de lancers par tour (absent = illimité) */
  maxPerTurn?: number;
  /** Si true, le bonus Portée du joueur s'ajoute à maxRange */
  isModifiable?: boolean;
  /** Si true, le sort frappe en ligne orthogonale — toutes les cibles sur la trajectoire */
  isLinear?: boolean;
  /** Si true, le lancer est contraint en ligne droite orthogonale (ex : charge) */
  lineOnly?: boolean;
  /** Niveau minimum du joueur pour débloquer ce sort (défaut : 1) */
  learnLevel?: number;

  // ── Effets & statuts ──────────────────────────────────────────────────────
  /** Type d'effet non-dommage appliqué par le sort */
  effectType?: SpellEffectType;
  /** Identifiant de l'effet de statut appliqué */
  statusEffect?: string;
  /** Durée du statut en tours */
  statusDuration?: number;
  /** Durée générique d'un effet secondaire (malus PM, objet posé…) en tours */
  durationTurns?: number;

  // ── Mécaniques spéciales ──────────────────────────────────────────────────
  /** Si true, les dégâts sont doublés quand la cible est à 100 % de ses PV */
  targetFullHpBonus?: boolean;
  /** Dégâts psychiques fixes infligés (ignorent les résistances élémentaires) */
  psychicDamage?: number;
  /** Dégâts de collision sur les cibles sur la trajectoire de projection */
  collisionDamage?: { min: number; max: number };
  /** PA retirés à la cible à chaque lancer (drain spectral) */
  drainPa?: number;
  /** PM retirés à la cible au prochain tour (ralentissement) */
  drainPm?: number;
  /** Si true, l'entité invoquée ne peut pas être détruite */
  isIndestructible?: boolean;
  /** Si true, le sort téléporte le lanceur sur la case cible (pas de dégâts) */
  isTeleport?: boolean;
  /**
   * Si true, le sort peut cibler n'importe quelle cellule dans sa portée
   * sans vérification de ligne de vue.
   * Cas typiques : sorts centrés sur soi-même, pluie du ciel, téléportations.
   */
  ignoresLineOfSight?: boolean;

  description: string;
}
