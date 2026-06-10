export type QuestStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface QuestObjective {
  id: string;
  description: string;
  current: number;
  target: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: QuestStatus;
  objectives: QuestObjective[];
  rewards?: { xp?: number; gold?: number; item?: string; itemName?: string };
}

// ── Quêtes du jeu ─────────────────────────────────────────────────────────────

export const QUESTS: Quest[] = [
  {
    id: 'professeur_01',
    title: 'Ordre du Professeur',
    description:
      'Le Professeur Aldren vous demande de prouver votre valeur en éliminant 5 monstres dans les environs du village.',
    icon: '⚔️',
    status: 'available',
    objectives: [
      { id: 'kill_monsters', description: 'Vaincre des monstres', current: 0, target: 5 },
    ],
    rewards: { xp: 250, gold: 500 },
  },
  {
    id: 'professeur_02',
    title: "La Clef de l'Antre",
    description:
      "Les rats mutants qui infestent la ville transportent parfois une Clef de l'Antre du Razmotek. Éliminez-les jusqu'à en trouver une, puis montrez-la au Professeur Aldren.",
    icon: '🔑',
    status: 'locked',
    objectives: [
      { id: 'craft_clef', description: "Trouver une Clef de l'Antre du Razmotek (drop sur les rats)", current: 0, target: 1 },
    ],
    rewards: { xp: 500, gold: 750 },
  },
  {
    id: 'professeur_03',
    title: 'La Chute du Razmotek',
    description:
      'Pour prouver que vous êtes prêt à explorer le monde extérieur, le Professeur Aldren vous demande de vaincre le Razmotek dans son antre.',
    icon: '👹',
    status: 'locked',
    objectives: [
      { id: 'defeat_razmotek', description: 'Vaincre le Razmotek', current: 0, target: 1 },
    ],
    rewards: { xp: 1000, gold: 1000 },
  },
  {
    id: 'professeur_04',
    title: 'Le Chasseur de la Clairière',
    description:
      'Le Professeur Aldren vous parle d\'un chasseur solitaire nommé Roan, qui vit reclus dans la Clairière du Chasseur, au nord de la Forêt Nord-Ouest. Retrouvez-le.',
    icon: '🏹',
    status: 'locked',
    objectives: [
      { id: 'find_hunter', description: 'Retrouver le Chasseur Roan dans la Clairière', current: 0, target: 1 },
    ],
  },
];

/** Compte les quêtes complétées. */
export function countCompleted(quests: Quest[]): number {
  return quests.filter(q => q.status === 'completed').length;
}
