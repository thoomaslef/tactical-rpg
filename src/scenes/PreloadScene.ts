import Phaser from 'phaser';

const PROMPTS = {
  hero: 'pixel art archer hero character portrait, blue outfit, bow and quiver, dofus RPG style, fantasy, clean face, dark background, square portrait',
  enemy: 'pixel art monster creature portrait, red furry bouftou ram beast, dofus RPG style, fantasy, menacing face, dark background, square portrait'
};

export function pollinationsUrl(prompt: string, seed = 12) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=128&height=128&nologo=true&seed=${seed}`;
}

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload() {
    this.load.crossOrigin = 'anonymous';
    this.load.image('hero', pollinationsUrl(PROMPTS.hero, 12));
    this.load.image('enemy', pollinationsUrl(PROMPTS.enemy, 34));
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0e1320);

    this.add.text(W / 2, H / 2 - 100, 'TACTICAL RPG', {
      fontSize: '36px', color: '#38bdf8', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5);

    // Portraits générés
    if (this.textures.exists('hero')) {
      const hero = this.add.image(W / 2 - 80, H / 2 - 10, 'hero')
        .setDisplaySize(100, 100).setOrigin(0.5);
      hero.setPostPipeline !== undefined && this.add.rectangle(W / 2 - 80, H / 2 - 10, 104, 104, 0x000000, 0).setStrokeStyle(2, 0x38bdf8).setOrigin(0.5);
    }
    if (this.textures.exists('enemy')) {
      this.add.image(W / 2 + 80, H / 2 - 10, 'enemy')
        .setDisplaySize(100, 100).setOrigin(0.5);
      this.add.rectangle(W / 2 + 80, H / 2 - 10, 104, 104, 0x000000, 0).setStrokeStyle(2, 0xef4444).setOrigin(0.5);
    }

    this.add.text(W / 2 - 80, H / 2 + 46, 'Archer', { fontSize: '13px', color: '#38bdf8', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(W / 2 + 80, H / 2 + 46, 'Bouftou', { fontSize: '13px', color: '#ef4444', fontStyle: 'bold' }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 + 80, 'Combat imminent…', {
      fontSize: '13px', color: '#8b93a7'
    }).setOrigin(0.5);

    // URLs directes pour les <img> du HUD (pas besoin de CORS canvas)
    const portraits = {
      hero: pollinationsUrl(PROMPTS.hero, 12),
      enemy: pollinationsUrl(PROMPTS.enemy, 34)
    };

    this.time.delayedCall(1800, () => {
      this.scene.start('CombatScene', { portraits });
    });
  }
}
