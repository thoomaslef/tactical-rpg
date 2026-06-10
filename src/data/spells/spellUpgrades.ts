import { ISpell } from './ISpell';

export interface SpellUpgradeTier {
  /** Description courte de ce que gagne ce palier */
  label: string;
  /** Champs de ISpell à écraser (appliqués en cumulatif sur la base) */
  changes: Partial<ISpell>;
}

export interface SpellUpgradeData {
  spellId: string;
  tiers: [SpellUpgradeTier, SpellUpgradeTier, SpellUpgradeTier];
}

export const SPELL_UPGRADES: Record<string, SpellUpgradeData> = {

  fleche_basique: {
    spellId: 'fleche_basique',
    tiers: [
      { label: 'Dégâts +2',                      changes: { baseDamage: { min: 10, max: 16 } } },
      { label: 'Dégâts +2 · Fluide −1',           changes: { baseDamage: { min: 12, max: 18 }, fluideCost: 1 } },
      { label: 'Dégâts +2 · Portée +1',           changes: { baseDamage: { min: 14, max: 20 }, maxRange: 7 } },
    ],
  },

  fleche_recul: {
    spellId: 'fleche_recul',
    tiers: [
      { label: 'Recul +1 case',                   changes: { pushDistance: 2 } },
      { label: 'Recul +1 case · Portée +1',        changes: { pushDistance: 3, maxRange: 6 } },
      { label: 'Fluide −1',                        changes: { fluideCost: 2 } },
    ],
  },

  fleche_percante: {
    spellId: 'fleche_percante',
    tiers: [
      { label: 'Dégâts +2',                        changes: { baseDamage: { min: 18, max: 24 } } },
      { label: 'Dégâts +2 · Portée +1',            changes: { baseDamage: { min: 20, max: 26 }, maxRange: 9 } },
      { label: 'Dégâts +2 · Fluide −1',            changes: { baseDamage: { min: 22, max: 28 }, fluideCost: 2 } },
    ],
  },

  bond: {
    spellId: 'bond',
    tiers: [
      { label: 'Dégâts +2',                        changes: { baseDamage: { min: 10, max: 16 } } },
      { label: 'Portée +1',                         changes: { maxRange: 5 } },
      { label: 'Dégâts +3 · PA −1',                changes: { baseDamage: { min: 13, max: 19 }, paCost: 2 } },
    ],
  },

  epee_divine: {
    spellId: 'epee_divine',
    tiers: [
      { label: 'Dégâts +3',                        changes: { baseDamage: { min: 21, max: 29 } } },
      { label: 'Dégâts +3',                        changes: { baseDamage: { min: 24, max: 32 } } },
      { label: 'Dégâts +3 · PA −1',                changes: { baseDamage: { min: 27, max: 35 }, paCost: 3 } },
    ],
  },

  fleche_explosive: {
    spellId: 'fleche_explosive',
    tiers: [
      { label: 'Dégâts +2',                        changes: { baseDamage: { min: 22, max: 30 } } },
      { label: 'Dégâts +2 · Portée +1',            changes: { baseDamage: { min: 24, max: 32 }, maxRange: 7 } },
      { label: 'Dégâts +2 · Fluide −1',            changes: { baseDamage: { min: 26, max: 34 }, fluideCost: 2 } },
    ],
  },

  epee_eclair: {
    spellId: 'epee_eclair',
    tiers: [
      { label: 'Dégâts +2',                        changes: { baseDamage: { min: 16, max: 24 } } },
      { label: 'Dégâts +2 · Portée +1',            changes: { baseDamage: { min: 18, max: 26 }, maxRange: 3 } },
      { label: 'Dégâts +2 · CD −1',                changes: { baseDamage: { min: 20, max: 28 }, cooldown: 1 } },
    ],
  },

  colere: {
    spellId: 'colere',
    tiers: [
      { label: 'Dégâts +2',                        changes: { baseDamage: { min: 24, max: 32 } } },
      { label: 'Dégâts +2 · PA −1',                changes: { baseDamage: { min: 26, max: 34 }, paCost: 4 } },
      { label: 'Dégâts +2 · Fluide −1',            changes: { baseDamage: { min: 28, max: 36 }, fluideCost: 2 } },
    ],
  },

  pluie_fleches: {
    spellId: 'pluie_fleches',
    tiers: [
      { label: 'Dégâts +2',                        changes: { baseDamage: { min: 12, max: 18 } } },
      { label: 'Dégâts +2 · CD −1',                changes: { baseDamage: { min: 14, max: 20 }, cooldown: 2 } },
      { label: 'Dégâts +2 · Portée +1',            changes: { baseDamage: { min: 16, max: 22 }, maxRange: 8 } },
    ],
  },

  devastation: {
    spellId: 'devastation',
    tiers: [
      { label: 'Dégâts +3',                        changes: { baseDamage: { min: 38, max: 53 } } },
      { label: 'Dégâts +3 · Fluide −1',            changes: { baseDamage: { min: 41, max: 56 }, fluideCost: 4 } },
      { label: 'Dégâts +3 · PA −1',                changes: { baseDamage: { min: 44, max: 59 }, paCost: 5 } },
    ],
  },

  // Sorts Enutrof
  enu_javelin: {
    spellId: 'enu_javelin',
    tiers: [
      { label: 'Dégâts +3',                        changes: { baseDamage: { min: 21, max: 29 } } },
      { label: 'Dégâts +3 · CD 1→0',              changes: { baseDamage: { min: 24, max: 32 }, cooldown: 0 } },
      { label: 'Dégâts +3',                        changes: { baseDamage: { min: 27, max: 35 } } },
    ],
  },

  enu_curse: {
    spellId: 'enu_curse',
    tiers: [
      { label: 'Durée +1 tour',                    changes: { statusDuration: 4 } },
      { label: 'Durée +1 tour · CD −1',            changes: { statusDuration: 5, cooldown: 1 } },
      { label: 'Portée +1',                        changes: { maxRange: 6 } },
    ],
  },

  enu_greed: {
    spellId: 'enu_greed',
    tiers: [
      { label: 'Dégâts +3',                        changes: { baseDamage: { min: 23, max: 31 } } },
      { label: 'Dégâts +3 · Portée +1',            changes: { baseDamage: { min: 26, max: 34 }, maxRange: 4 } },
      { label: 'Dégâts +3 · CD −1',                changes: { baseDamage: { min: 29, max: 37 }, cooldown: 3 } },
    ],
  },

  enu_scythe: {
    spellId: 'enu_scythe',
    tiers: [
      { label: 'Dégâts +3',                        changes: { baseDamage: { min: 25, max: 33 } } },
      { label: 'Dégâts +3 · Attrait +1',           changes: { baseDamage: { min: 28, max: 36 }, pullDistance: 2 } },
      { label: 'Dégâts +3',                        changes: { baseDamage: { min: 31, max: 39 } } },
    ],
  },

  panda_throw: {
    spellId: 'panda_throw',
    tiers: [
      { label: 'Dégâts +4',                        changes: { baseDamage: { min: 32, max: 42 } } },
      { label: 'Dégâts +4 · Collision +3',         changes: { baseDamage: { min: 36, max: 46 }, collisionDamage: { min: 15, max: 19 } } },
      { label: 'Dégâts +4 · CD −1',               changes: { baseDamage: { min: 40, max: 50 }, cooldown: 2 } },
    ],
  },

  panda_taz: {
    spellId: 'panda_taz',
    tiers: [
      { label: 'Dégâts psych. +3',                 changes: { psychicDamage: 13 } },
      { label: 'Dégâts psych. +3 · CD −1',        changes: { psychicDamage: 16, cooldown: 1 } },
      { label: 'Dégâts psych. +4',                 changes: { psychicDamage: 20 } },
    ],
  },
};

/**
 * Retourne le sort avec les améliorations du magicien appliquées jusqu'au palier `level`.
 * Chaque palier écrase les champs définis dans ses `changes` (cumulatif).
 */
export function getUpgradedSpell(base: ISpell, level: number): ISpell {
  if (level === 0) return base;
  const upgData = SPELL_UPGRADES[base.id];
  if (!upgData) return base;
  let result: ISpell = { ...base };
  for (let i = 0; i < level && i < 3; i++) {
    result = { ...result, ...upgData.tiers[i].changes };
  }
  return result;
}
