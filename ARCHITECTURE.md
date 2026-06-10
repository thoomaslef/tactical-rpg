# Architecture — Tactical RPG

> Dernière mise à jour : 2026-05-22  
> Stack : Phaser 3 · TypeScript · Vite

---

## Vue d'ensemble

Tactical RPG isométrique inspiré de Dofus.  
Le joueur explore une carte du monde en vue iso, engage des combats au tour par tour, monte en niveau, équipe son personnage et progresse dans un donjon.

```
main.ts
 └── Phaser.Game
       ├── WorldScene   ← carte du monde, exploration, PNJ, coffres, arbres
       ├── PreloadScene ← transition / chargement avant combat
       └── CombatScene  ← arène tactique tour par tour
```

---

## Structure des dossiers

```
src/
├── main.ts                     # Bootstrap Phaser — déclare les 3 scènes
│
├── config/
│   ├── game.config.ts          # Constantes globales : tuiles WorldScene (WS_TW=112, WS_TH=56)
│   ├── spells.config.ts        # Configuration UI des sorts (icônes, raccourcis)
│   └── professions/
│       └── woodcutting.config.ts
│
├── scenes/
│   ├── WorldScene.ts           # Scène principale — exploration isométrique
│   ├── PreloadScene.ts         # Splash screen avant combat (charge portraits Pollinations)
│   └── CombatScene.ts          # Combat tactique iso (grille 15×11)
│
├── game/
│   ├── iso.ts                  # Math iso combat : TILE_W=64, TILE_H=32, GRID_W=15, GRID_H=11
│   ├── stats.ts                # PlayerStats, XP/level, HP/PA/PM/Fluide max
│   ├── items.ts                # Items, équipement, inventaire
│   ├── spells.ts               # Helpers sorts (filtrage, tri)
│   ├── quests.ts               # Système de quêtes
│   ├── pathfinding.ts          # BFS accessibilité + reconstruction de chemin
│   └── gameState.ts            # Singleton état global persistant entre scènes
│
├── data/
│   ├── spells/
│   │   ├── ISpell.ts           # Interface ISpell + SpellElement + SpellEffectType
│   │   └── spellsData.ts       # Catalogue complet de tous les sorts
│   └── professions/
│       └── trees.ts            # Données des arbres récoltables
│
├── maps/
│   ├── MapLoader.ts            # Interfaces : MapData, MonsterSpawn, MapExit, NPCData…
│   ├── MapManager.ts           # Chargement/cache des JSONs de map
│   └── data/                   # Maps JSON
│       ├── village_centre.json
│       ├── plaine_nord.json
│       ├── foret_ouest.json
│       ├── ruines_est.json
│       ├── donjon_entree.json
│       ├── donjon_salle2.json
│       ├── donjon_salle3.json
│       └── donjon_boss.json
│
├── systems/
│   ├── SpellManager.ts         # Service pur : calcul dégâts, elementBonus, canCast
│   ├── ProfessionRegistry.ts   # Registre des professions
│   └── professions/
│       ├── BaseProfession.ts
│       └── WoodcuttingProfession.ts
│
├── objects/
│   └── harvestable/
│       ├── BaseHarvestable.ts
│       └── TreeObject.ts       # Arbre interactif (récolte, respawn)
│
├── ui/
│   ├── hud.ts                  # HUD en jeu (PV, PA, PM, or, niveau)
│   ├── SpellsPanel.ts          # Barre de sorts en combat
│   ├── CharacterMenu.ts        # Menu personnage (stats, distribution points)
│   ├── EquipmentMenu.ts        # Menu équipement
│   ├── QuestPanel.ts           # Journal de quêtes
│   ├── BankModal.ts            # Interface banque
│   ├── ChestModal.ts           # Interface coffre
│   ├── DialogueBox.ts          # Bulles de dialogue PNJ
│   ├── MinimapOverlay.ts       # Minimap (maps visitées)
│   └── ProfessionBookUI.ts / ProfessionDetailUI.ts
│
└── types/
    └── index.ts                # Types partagés : Unit, GridPos, Team, Mode, Spell (alias ISpell)
```

---

## Grilles isométriques (deux contextes distincts)

| Contexte | Fichier source | Largeur tuile | Hauteur tuile | Grille |
|----------|---------------|---------------|---------------|--------|
| **WorldScene** (exploration) | `config/game.config.ts` | `WS_TW = 112` | `WS_TH = 56` | variable (JSON) |
| **CombatScene** (combat) | `game/iso.ts` | `TILE_W = 64` | `TILE_H = 32` | `GRID_W=15 × GRID_H=11` |

### Formule de placement tuile (WorldScene)
```typescript
// Sprite Kenney 256×512 px — diamond top à setOrigin(0.5, 0.5)
const SCALE = WS_TW / 256; // = 0.4375
this.add.image(cx, py, key)
  .setOrigin(0.5, 0.5)
  .setScale(SCALE)
  .setDepth(py + WS_TH / 2);
```

---

## Flux de scènes

```
WorldScene ──(combat)──► PreloadScene ──(fadeOut)──► CombatScene
    ▲                                                      │
    └──────────────────────(victoire/défaite)──────────────┘
```

Données transmises via `scene.start(key, data)` — voir `init()` de chaque scène.

---

## Types centraux

### `Unit` (`types/index.ts`)
```typescript
interface Unit {
  id, name, team: 'player' | 'enemy'
  pos: GridPos            // position sur la grille de combat
  hp, maxHp, pa, maxPa, pm, maxPm
  initiative
  spells: ISpell[]
  resistances?: Partial<Record<SpellElement, number>>  // % résistance (négatif = vulnérabilité)
  isBoss?, behavior?: 'melee' | 'range', baseDamage?
}
```

### `ISpell` (`data/spells/ISpell.ts`)
Champs clés : `paCost`, `fluideCost`, `maxRange`, `minRange`, `baseDamage {min,max}`,
`element / elements[]`, `aoeSize`, `pushDistance`, `pullDistance`, `cooldown`, `maxPerTurn`.

### `PlayerStats` (`game/stats.ts`)
`vitalite · sagesse · fluide · portee · eau · feu · air · terre · psy · glace · electrik · soin · resistance`  
→ 10 points par niveau ; `(niveau - 1) × 10` points au total.

### `MapData` (`maps/MapLoader.ts`)
`tiles: number[][]` — grille 2D de types de tuiles (0=herbe, 1=pierre, 2=pierre detail…)  
+ `exits`, `spawns`, `chests`, `npcs`, `trees`, `dungeonDoor`, `groupFight`, `blockExitsUntilCleared`

---

## Services et systèmes purs (sans Phaser)

| Fichier | Responsabilité |
|---------|---------------|
| `systems/SpellManager.ts` | Singleton. `computeDamage()`, `elementBonus()`, `canCast()` |
| `game/pathfinding.ts` | `bfsReachable()` (BFS accessibilité), `reconstructPath()` |
| `game/stats.ts` | Calculs dérivés : `maxHp`, `maxPa`, `maxMagic`, `getLevel`, `xpForLevel` |
| `game/gameState.ts` | Singleton mutable global : coffres pillés, maps visitées, or, quêtes |
| `maps/MapManager.ts` | Chargement et mise en cache des JSONs de map |

---

## Sprites & assets

- **Tuiles monde** : `kenney_isometric-miniature-bases/Isometric/*_E.png` (variante East, 256×512 px)
- **Portraits combat** : générés à la volée via `https://image.pollinations.ai/` (hero / enemy / boss)
- **Icônes sorts** : emojis Unicode dans `spellsData.ts` (champ `icon`)

---

## État global persistant (`gameState.ts`)

```typescript
gameState.lootedChests     // Set<"mapId:chestId">
gameState.visitedMaps      // Set<string>
gameState.npcInteracted    // Set<string>
gameState.harvestedTrees   // Map<"mapId:treeId", timestampRespawn>
gameState.gold             // number
gameState.questKills       // number
gameState.bankInventory    // InventoryEntry[]
```

> ⚠️ Cet état vit en mémoire JS. Pas de persistance entre rechargements de page pour l'instant.

---

## Roadmap / FUTURE

| Priorité | Fonctionnalité | Notes |
|----------|---------------|-------|
| 🔴 Haute | Effets de sorts complets | `targetFullHpBonus`, `pullDistance`, `statusEffect`, `collisionDamage`, `psychicDamage` — champs définis dans ISpell, non branché dans CombatScene |
| 🟡 Moyenne | Système de classes | `getSpellsByClass()` commenté dans SpellManager — attente sélection de classe (Enutrof/Pandawa…) |
| 🟡 Moyenne | Ligne de vue (LOS) | `lineOfCells()` commenté dans pathfinding.ts — algorithme de Bresenham prêt |
| 🟡 Moyenne | Persistance sauvegarde | localStorage ou backend — gameState actuel = in-memory uniquement |
| 🟢 Basse | Cartes 22×14 | Résolution 2560×1440 chez développeur, 1920×1080 en portable — Phaser Scale.RESIZE actif |
| 🟢 Basse | Phaser Scale Manager | main.ts utilise RESIZE, mais pas de breakpoints 1080/1440 — à peaufiner |

---

## Conventions de code

- **Imports** : relatifs depuis `src/`, pas d'alias `@/`
- **Singletons** : `SpellManager.getInstance()`, `gameState` (export direct)
- **Nommage** : `_privateMethod()` avec underscore pour les méthodes internes des scènes
- **TODO futurs** : commentés avec `// FUTURE:` suivi d'une explication
- **TypeScript strict** : 0 erreurs — vérifier avec `npx tsc --noEmit` avant commit
