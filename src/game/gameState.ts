import { InventoryEntry } from './items';

export const gameState = {
  /** Coffres déjà pillés — clé : "mapId:chestId" */
  lootedChests: new Set<string>(),
  /** PNJ avec lesquels le joueur a déjà interagi */
  npcInteracted: new Set<string>(),
  /** Monnaie du joueur */
  gold: 0,
  /** Monstres vaincus en attente de respawn — clé : "mapId:monsterId" → timestamp respawn */
  monsterRespawnTimes: new Map<string, number>(),
  /** Compteur de monstres tués (quête Professeur) */
  questKills: 0,
  /** True si la récompense de la quête 1 (5 monstres) a été donnée */
  questRewardGiven: false,
  /** True si la récompense de la quête 2 (craft Clef de la Crypte) a été donnée */
  quest2RewardGiven: false,
  /** True si le Razmotek a été vaincu (quête 3) */
  quest3Done: false,
  /** True si la récompense finale (quête 3) a été donnée */
  quest3RewardGiven: false,
  /** True si le Professeur a envoyé le joueur vers le Chasseur (quête 4 démarrée) */
  quest4Started: false,
  /** True si l'Alchimiste a accepté la quête des essences */
  alchimiste01Started: false,
  /** True si la récompense de la quête Alchimiste (lame forgée) a été donnée */
  alchimiste01RewardGiven: false,
  /** True si la quête de suivi (Vestiges) a été débloquée */
  alchimiste02Unlocked: false,
  /** Inventaire de la banque — persiste entre les maps */
  bankInventory: [] as InventoryEntry[],
  /** Niveau actuel du joueur — pour détecter les montées de niveau */
  currentLevel: 1,
  /** Améliorations de sorts achetées chez le Magicien — clé : spellId → palier (1-3) */
  spellUpgrades: new Map<string, number>(),
};
