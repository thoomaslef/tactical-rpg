import { Spell } from '../types';

export const SPELLS: Record<string, Spell> = {
  arrow: {
    id: 'arrow',
    name: 'Flèche',
    icon: '🏹',
    cost: 3,
    fluideCost: 3,
    range: 7,
    minRange: 1,
    damage: 10,
    description: 'Inflige 10 dégâts à portée 7. Sort de base polyvalent.'
  },
  explosive: {
    id: 'explosive',
    name: 'Explosive',
    icon: '💥',
    cost: 5,
    fluideCost: 5,
    range: 6,
    minRange: 2,
    damage: 22,
    aoe: 1,
    description: 'Flèche explosive — 22 dégâts en zone de rayon 1. Portée 2–6.'
  },
  push: {
    id: 'push',
    name: 'Fl. Recul',
    icon: '💨',
    cost: 3,
    fluideCost: 3,
    range: 3,
    minRange: 1,
    push: 3,
    description: 'Repousse l\'ennemi de 3 cases. Aucun dégât. Portée 3.'
  }
};

export const ALL_SPELLS = [SPELLS.arrow, SPELLS.explosive, SPELLS.push];
