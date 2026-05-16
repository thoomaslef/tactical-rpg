import { Spell } from '../types';

export const SPELLS: Record<string, Spell> = {
  arrow: {
    id: 'arrow',
    name: 'Flèche',
    icon: '🏹',
    cost: 3,
    range: 7,
    minRange: 1,
    damage: 14,
    description: 'Flèche simple — 14 dégâts, portée 7.'
  },
  explosive: {
    id: 'explosive',
    name: 'Explosive',
    icon: '💥',
    cost: 5,
    range: 6,
    minRange: 2,
    damage: 22,
    aoe: 1,
    description: 'Flèche explosive — 22 dégâts en zone (1), portée 6.'
  },
  push: {
    id: 'push',
    name: 'Recul',
    icon: '💨',
    cost: 2,
    range: 3,
    minRange: 1,
    damage: 6,
    push: 3,
    description: 'Repousse l\'ennemi de 3 cases, 6 dégâts.'
  }
};

export const ALL_SPELLS = [SPELLS.arrow, SPELLS.explosive, SPELLS.push];
