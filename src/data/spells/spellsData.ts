import { ISpell } from './ISpell';

/**
 * Tous les sorts du jeu, ordonnés par niveau d'apprentissage.
 * Le joueur les débloque automatiquement en montant de niveau.
 */
export const ALL_SPELLS: ISpell[] = [
  // ── Niveau 1 ──────────────────────────────────────────────────────────────
  {
    id: 'fleche_basique',
    name: 'Flèche',
    icon: '🏹',
    paCost: 3,
    fluideCost: 2,
    maxRange: 5,
    minRange: 1,
    baseDamage: { min: 8, max: 14 },
    element: 'terre',
    isModifiable: true,
    learnLevel: 1,
    description: 'Attaque à distance de base — 8 à 14 dégâts Terre. Portée modifiée par la stat Portée.',
  },

  // ── Niveau 2 ──────────────────────────────────────────────────────────────
  {
    id: 'fleche_recul',
    name: 'Recul',
    icon: '💨',
    paCost: 3,
    fluideCost: 3,
    maxRange: 5,
    minRange: 1,
    pushDistance: 1,
    isModifiable: true,
    learnLevel: 2,
    description: 'Repousse une cible de 1 case. Portée 1–5.',
  },

  // ── Niveau 3 ──────────────────────────────────────────────────────────────
  {
    id: 'fleche_percante',
    name: 'Orage',
    icon: '⛈️',
    paCost: 4,
    fluideCost: 3,
    maxRange: 8,
    minRange: 2,
    baseDamage: { min: 16, max: 22 },
    element: 'air',
    isModifiable: true,
    learnLevel: 45,
    description: 'Flèche longue portée — 16 à 22 dégâts Air. Portée 2–8, modifiable.',
  },

  // ── Niveau 4 ──────────────────────────────────────────────────────────────
  {
    id: 'bond',
    name: 'Jump',
    icon: '🦘',
    paCost: 2,
    fluideCost: 1,
    maxRange: 1,
    minRange: 1,
    element: 'neutre',
    isModifiable: false,
    isTeleport: true,
    ignoresLineOfSight: true,  // téléportation : pas de projectile, pas de LDV requise
    learnLevel: 25,
    description: 'Téléportation sur une case adjacente vide — aucun dégât. Coûte 2 PA et 1 Fluide.',
  },

  // ── Niveau 5 ──────────────────────────────────────────────────────────────
  {
    id: 'epee_divine',
    name: 'Klak',
    icon: '⚔️',
    paCost: 4,
    fluideCost: 0,
    maxRange: 1,
    minRange: 1,
    baseDamage: { min: 18, max: 26 },
    element: 'feu',
    isModifiable: false,
    learnLevel: 5,
    description: 'Frappe puissante adjacente — 18 à 26 dégâts Feu.',
  },

  // ── Niveau 6 ──────────────────────────────────────────────────────────────
  {
    id: 'fleche_explosive',
    name: 'Séisme',
    icon: '🌋',
    paCost: 5,
    fluideCost: 3,
    maxRange: 6,
    minRange: 2,
    baseDamage: { min: 20, max: 28 },
    aoeSize: 1,
    element: 'feu',
    isModifiable: true,
    learnLevel: 55,
    description: 'Frappe sismique — 20 à 28 dégâts Feu en zone rayon 1. Portée 2–6.',
  },

  // ── Niveau 7 ──────────────────────────────────────────────────────────────
  {
    id: 'epee_eclair',
    name: 'Éclair',
    icon: '⚡',
    paCost: 4,
    fluideCost: 3,
    maxRange: 2,
    minRange: 1,
    baseDamage: { min: 14, max: 22 },
    element: 'air',
    cooldown: 2,
    isModifiable: false,
    learnLevel: 65,
    description: 'Frappe foudroyante — 14 à 22 dégâts Air. Portée 1–2. CD 2 tours.',
  },

  // ── Niveau 8 ──────────────────────────────────────────────────────────────
  {
    id: 'colere',
    name: 'Colère',
    icon: '😤',
    paCost: 5,
    fluideCost: 3,
    maxRange: 1,
    minRange: 1,
    baseDamage: { min: 22, max: 30 },
    aoeSize: 1,
    element: 'terre',
    isModifiable: false,
    ignoresLineOfSight: true,  // zone autour de soi : aucune LDV requise
    learnLevel: 47,
    description: 'Explosion de rage — 22 à 30 dégâts Terre en zone rayon 1. Adjacent.',
  },

  // ── Niveau 70 ─────────────────────────────────────────────────────────────
  {
    id: 'pluie_fleches',
    name: 'Pluie',
    icon: '🌧️',
    paCost: 5,
    fluideCost: 4,
    maxRange: 7,
    minRange: 3,
    baseDamage: { min: 10, max: 16 },
    aoeSize: 2,
    element: 'eau',
    cooldown: 3,
    isModifiable: false,
    ignoresLineOfSight: true,  // pluie tombant du ciel : pas de LDV requise
    learnLevel: 70,
    description: 'Pluie de flèches Eau — 10 à 16 dégâts en zone rayon 2. Portée 3–7. CD 3 tours.',
  },

  // ── Niveau 10 ─────────────────────────────────────────────────────────────
  {
    id: 'devastation',
    name: 'Dévastation',
    icon: '🗡️',
    paCost: 6,
    fluideCost: 5,
    maxRange: 1,
    minRange: 1,
    baseDamage: { min: 35, max: 50 },
    element: 'neutre',
    maxPerTurn: 1,
    isModifiable: false,
    learnLevel: 10,
    description: 'Coup ultime — 35 à 50 dégâts. Adjacent. 1× par tour.',
  },

  // ============================================================
  // SORTS ENUTROF
  // ============================================================

  // Sort 11 : Javelot
  {
    id: 'enu_javelin',
    name: 'Javelot',
    icon: '🪃',
    classe: 'enutrof',
    paCost: 3,
    fluideCost: 0,
    maxRange: 6,
    minRange: 2,
    baseDamage: { min: 18, max: 26 },
    element: 'terre',
    isModifiable: true,
    targetFullHpBonus: true,
    cooldown: 1,
    maxPerTurn: 2,
    learnLevel: 11,
    description: 'Lance de terre — 18 à 26 dégâts. Dégâts doublés si la cible est à 100 % de ses PV. Portée 2–6 modifiable. CD 1 tour.',
  },

  // Sort 12 : Malédiction
  {
    id: 'enu_curse',
    name: 'Malédiction',
    icon: '💀',
    classe: 'enutrof',
    paCost: 3,
    fluideCost: 0,
    maxRange: 5,
    minRange: 1,
    element: 'neutre',
    isModifiable: false,
    effectType: 'debuff',
    statusEffect: 'cursed',
    statusDuration: 3,
    cooldown: 2,
    maxPerTurn: 1,
    learnLevel: 12,
    description: 'Réduit les résistances de la cible de −15 % pendant 3 tours. Portée 1–5. CD 2 tours.',
  },

  // Sort 13 : Avarice
  {
    id: 'enu_greed',
    name: 'Avarice',
    icon: '🪙',
    classe: 'enutrof',
    paCost: 4,
    fluideCost: 0,
    maxRange: 3,
    minRange: 1,
    baseDamage: { min: 20, max: 28 },
    element: 'eau',
    isModifiable: false,
    statusEffect: 'pa_stolen',
    cooldown: 4,
    maxPerTurn: 1,
    learnLevel: 13,
    description: 'Dégâts Eau — 20 à 28. Vole 1 PA à l\'ennemi : il perd 1 PA à son prochain tour, l\'Enutrof en gagne 1 ce tour-ci. Portée 1–3. CD 4 tours.',
  },

  // Sort 14 : Fossoyeur
  {
    id: 'enu_scythe',
    name: 'Fossoyeur',
    icon: '☠️',
    classe: 'enutrof',
    paCost: 3,
    fluideCost: 0,
    maxRange: 1,
    minRange: 1,
    baseDamage: { min: 22, max: 30 },
    element: 'terre',
    isModifiable: false,
    pullDistance: 1,
    cooldown: 1,
    maxPerTurn: 2,
    learnLevel: 14,
    description: 'Coup de faux corps-à-corps — 22 à 30 dégâts Terre. Attire la cible de 1 case vers l\'Enutrof. CD 1 tour.',
  },

  // ============================================================
  // SORTS PANDAWA
  // ============================================================

  // Sort 15 : Lancé
  {
    id: 'panda_throw',
    name: 'Lancé',
    icon: '🤾',
    classe: 'pandawa',
    paCost: 4,
    fluideCost: 0,
    maxRange: 3,
    minRange: 1,
    baseDamage: { min: 28, max: 38 },
    element: 'neutre',
    isModifiable: false,
    lineOnly: true,
    collisionDamage: { min: 12, max: 16 },
    cooldown: 3,
    maxPerTurn: 1,
    learnLevel: 15,
    description: 'Attrape un ennemi adjacent et le propulse en ligne droite sur 1–3 cases — 28 à 38 dégâts à l\'impact. Les ennemis sur la trajectoire subissent 12–16 dégâts de collision. CD 3 tours.',
  },

  // Sort 16 : Ricar
  {
    id: 'panda_ricar',
    name: 'Ricar',
    icon: '🧘',
    classe: 'pandawa',
    paCost: 2,
    fluideCost: 0,
    maxRange: 0,
    element: 'neutre',
    isModifiable: false,
    effectType: 'buff',
    statusEffect: 'ricar',
    statusDuration: 1,
    durationTurns: 2,
    cooldown: 3,
    maxPerTurn: 1,
    ignoresLineOfSight: true,  // buff sur soi-même : pas de LDV requise
    learnLevel: 16,
    description: 'Concentration — +10 % aux dégâts pendant 1 tour. En contrepartie, −1 PM pendant 2 tours. CD 3 tours.',
  },

  // Sort 17 : Enclume
  {
    id: 'panda_anvil',
    name: 'Enclume',
    icon: '⚒️',
    classe: 'pandawa',
    paCost: 3,
    fluideCost: 0,
    maxRange: 3,
    minRange: 1,
    element: 'terre',
    isModifiable: false,
    effectType: 'summon',
    isIndestructible: true,
    durationTurns: 2,
    cooldown: 4,
    maxPerTurn: 1,
    learnLevel: 17,
    description: 'Pose une enclume invincible sur une case vide. Bloque le passage pendant 2 tours — ne peut pas être détruite. Portée 1–3. CD 4 tours.',
  },

  // Sort 18 : Taz
  {
    id: 'panda_taz',
    name: 'Taz',
    icon: '🌀',
    classe: 'pandawa',
    paCost: 3,
    fluideCost: 0,
    maxRange: 0,
    element: 'neutre',
    isModifiable: false,
    psychicDamage: 10,
    aoeAroundSelf: true,
    aoeShape: 'circle',
    aoeSize: 1,
    cooldown: 2,
    maxPerTurn: 1,
    ignoresLineOfSight: true,  // zone autour de soi : pas de LDV requise
    learnLevel: 18,
    description: 'Le Pandawa tourne sur lui-même — inflige 10 dégâts psychiques (ignorent les résistances) à tous les ennemis adjacents. Zone rayon 1. CD 2 tours.',
  },
];

/**
 * Retourne tous les sorts disponibles pour un niveau donné.
 * (learnLevel absent = niveau 1 par défaut)
 */
export function getSpellsForLevel(level: number): ISpell[] {
  return ALL_SPELLS.filter(s => (s.learnLevel ?? 1) <= level);
}
