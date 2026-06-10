import Phaser from 'phaser';
import { PlayerStats } from '../game/stats';
import { PlayerEquipment, InventoryEntry, emptyEquipment } from '../game/items';
import { MonsterSpawn } from '../maps/MapLoader';

const PROMPTS = {
  hero:  'pixel art archer hero character portrait, blue outfit, bow and quiver, dofus RPG style, fantasy, clean face, dark background, square portrait',
  enemy: 'pixel art monster creature portrait, red furry enemy beast, dofus RPG style, fantasy, menacing face, dark background, square portrait',
  boss:  'pixel art dark powerful boss monster portrait, crimson armored beast, glowing red eyes, dofus RPG style, epic fantasy villain, dark background, square portrait',
};

function pollinationsUrl(prompt: string, seed = 12) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=128&height=128&nologo=true&seed=${seed}`;
}

export class PreloadScene extends Phaser.Scene {
  private playerXP = 0;
  private playerStats: PlayerStats | undefined;
  private equipment: PlayerEquipment = emptyEquipment();
  private inventory: InventoryEntry[] = [];
  private mapId = 'map_c';
  private playerX = 6;
  private playerY = 4;
  private defeatedMonsters: string[] = [];
  private monsters: MonsterSpawn[] = [];
  private isDungeonBoss = false;
  private gold = 0;

  constructor() { super('PreloadScene'); }

  init(data: {
    fromWorld?: boolean;
    xp?: number;
    playerStats?: PlayerStats;
    equipment?: PlayerEquipment;
    inventory?: InventoryEntry[];
    mapId?: string;
    playerX?: number;
    playerY?: number;
    defeatedMonsters?: string[];
    monsters?: MonsterSpawn[];
    isDungeonBoss?: boolean;
    gold?: number;
  }) {
    this.playerXP          = data?.xp ?? 0;
    this.playerStats       = data?.playerStats ? { ...data.playerStats } : undefined;
    this.equipment         = data?.equipment ? { ...data.equipment } : emptyEquipment();
    this.inventory         = data?.inventory ? data.inventory.map(e => ({ ...e })) : [];
    this.mapId             = data?.mapId ?? 'map_c';
    this.playerX           = data?.playerX ?? 6;
    this.playerY           = data?.playerY ?? 4;
    this.defeatedMonsters  = data?.defeatedMonsters ? [...data.defeatedMonsters] : [];
    this.monsters          = data?.monsters ? [...data.monsters] : [];
    this.isDungeonBoss     = data?.isDungeonBoss ?? false;
    this.gold              = data?.gold ?? 0;
  }

  preload() {
    if (!this.textures.exists('hero')) {
      this.load.crossOrigin = 'anonymous';
      this.load.image('hero', pollinationsUrl(PROMPTS.hero, 12));
    }
    const enemyKey = this.isDungeonBoss ? 'boss' : 'enemy';
    if (!this.textures.exists(enemyKey)) {
      this.load.crossOrigin = 'anonymous';
      this.load.image(enemyKey, pollinationsUrl(this.isDungeonBoss ? PROMPTS.boss : PROMPTS.enemy, this.isDungeonBoss ? 77 : 34));
    }
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0e1320);

    this.add.text(W / 2, H / 2 - 100, this.isDungeonBoss ? '☠ BOSS ☠' : 'TACTICAL RPG', {
      fontSize: this.isDungeonBoss ? '32px' : '36px',
      color: this.isDungeonBoss ? '#ef4444' : '#38bdf8',
      fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5);

    if (this.textures.exists('hero')) {
      this.add.image(W / 2 - 80, H / 2 - 10, 'hero').setDisplaySize(100, 100).setOrigin(0.5);
      this.add.rectangle(W / 2 - 80, H / 2 - 10, 104, 104, 0x000000, 0).setStrokeStyle(2, 0x38bdf8).setOrigin(0.5);
    }
    const enemyKey = this.isDungeonBoss ? 'boss' : 'enemy';
    if (this.textures.exists(enemyKey)) {
      this.add.image(W / 2 + 80, H / 2 - 10, enemyKey).setDisplaySize(100, 100).setOrigin(0.5);
      this.add.rectangle(W / 2 + 80, H / 2 - 10, 104, 104, 0x000000, 0)
        .setStrokeStyle(2, this.isDungeonBoss ? 0xef4444 : 0xef4444).setOrigin(0.5);
    }

    this.add.text(W / 2 - 80, H / 2 + 46, 'Archer', { fontSize: '13px', color: '#38bdf8', fontStyle: 'bold' }).setOrigin(0.5);
    const enemyLabel = this.isDungeonBoss
      ? (this.monsters.find(m => m.isBoss)?.name ?? 'Boss')
      : (this.monsters[0]?.name ?? 'Ennemi');
    this.add.text(W / 2 + 80, H / 2 + 46, enemyLabel, {
      fontSize: '13px',
      color: this.isDungeonBoss ? '#ef4444' : '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 + 80, 'Combat imminent…', { fontSize: '13px', color: '#8b93a7' }).setOrigin(0.5);

    if (this.monsters.length > 1) {
      this.add.text(W / 2, H / 2 + 98, `${this.monsters.length} ennemis`, { fontSize: '12px', color: '#fca5a5' }).setOrigin(0.5);
    }

    const portraits = {
      hero:  pollinationsUrl(PROMPTS.hero, 12),
      enemy: pollinationsUrl(this.isDungeonBoss ? PROMPTS.boss : PROMPTS.enemy, this.isDungeonBoss ? 77 : 34),
    };

    this.time.delayedCall(1800, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => {
        this.scene.start('CombatScene', {
          portraits,
          xp:               this.playerXP,
          gold:             this.gold,
          playerStats:      this.playerStats,
          equipment:        this.equipment,
          inventory:        this.inventory,
          mapId:            this.mapId,
          playerX:          this.playerX,
          playerY:          this.playerY,
          defeatedMonsters: this.defeatedMonsters,
          monsters:         this.monsters,
          isDungeonBoss:    this.isDungeonBoss,
        });
      });
    });
  }
}
