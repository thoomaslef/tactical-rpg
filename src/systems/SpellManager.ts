import { ISpell } from '../data/spells/ISpell';
import { PlayerStats } from '../game/stats';
// import { ALL_SPELLS } from '../data/spells/spellsData'; // FUTURE: re-activer pour getSpellsByClass

/**
 * Service pur (sans Phaser) responsable de la logique des sorts :
 * calcul des dégâts avec bonus élémentaires, vérification des conditions de lancer.
 */
export class SpellManager {
  private static _instance: SpellManager | null = null;

  static getInstance(): SpellManager {
    if (!SpellManager._instance) SpellManager._instance = new SpellManager();
    return SpellManager._instance;
  }

  /**
   * Calcule les dégâts finaux d'un sort pour un lanceur donné.
   *
   * @param spell            Le sort lancé.
   * @param stats            Stats du joueur.
   * @param finalDmgPct      Bonus global de dégâts en % (ex: niveau joueur → +1%/nv).
   * @param extraTerreBonus  Bonus Terre passif (ex: niveau Bûcheronnage → +1/nv).
   */
  computeDamage(spell: ISpell, stats: PlayerStats, finalDmgPct = 0, extraTerreBonus = 0): number {
    if (!spell.baseDamage) return 0;
    const { min, max } = spell.baseDamage;
    const raw = min + Math.floor(Math.random() * (max - min + 1));
    const elemBonus = this.elementBonus(spell, stats, extraTerreBonus);
    const base = Math.max(1, raw + elemBonus);
    return Math.max(1, Math.round(base * (1 + finalDmgPct / 100)));
  }

  /** Retourne le bonus de stats applicable à l'élément du sort. */
  elementBonus(spell: ISpell, stats: PlayerStats, extraTerreBonus = 0): number {
    // Sort multi-éléments : somme des bonus de chaque élément
    if (spell.elements && spell.elements.length > 0) {
      return spell.elements.reduce((sum, el) => sum + this._bonusForElement(el, stats, extraTerreBonus), 0);
    }
    return this._bonusForElement(spell.element, stats, extraTerreBonus);
  }

  private _bonusForElement(element: string | undefined, stats: PlayerStats, extraTerreBonus = 0): number {
    switch (element) {
      case 'feu':     return stats.feu;
      case 'air':     return stats.air;
      case 'eau':     return stats.eau;
      case 'terre':   return stats.terre + extraTerreBonus;
      case 'psy':     return stats.psy;
      case 'glace':   return stats.glace;
      case 'electrik': return stats.electrik;
      default:        return 0;
    }
  }

  // FUTURE: filtrer les sorts par classe (Enutrof, Pandawa…) quand le système
  // de sélection de classe sera implémenté.
  // getSpellsByClass(classe: string): ISpell[] { return ALL_SPELLS.filter(s => s.classe === classe); }

  /**
   * Vérifie si un sort peut être lancé dans l'état actuel du tour.
   * @param spell - le sort à vérifier
   * @param pa - PA restants du lanceur
   * @param fluide - Fluide restant du lanceur
   * @param cooldownsLeft - map(spellId → tours restants de CD)
   * @param castsThisTurn - map(spellId → nombre de fois lancé ce tour)
   */
  canCast(
    spell: ISpell,
    pa: number,
    fluide: number,
    cooldownsLeft: Map<string, number>,
    castsThisTurn: Map<string, number>,
  ): boolean {
    if (pa < spell.paCost) return false;
    if (fluide < spell.fluideCost) return false;
    if ((cooldownsLeft.get(spell.id) ?? 0) > 0) return false;
    if (spell.maxPerTurn !== undefined) {
      if ((castsThisTurn.get(spell.id) ?? 0) >= spell.maxPerTurn) return false;
    }
    return true;
  }
}
