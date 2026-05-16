import Phaser from 'phaser';
import { HUD } from '../ui/hud';

const MAP_W = 20;
const MAP_H = 14;
const TILE = 48;

// Terrain map: 0=grass, 1=dark grass, 2=path, 3=water, 4=tree, 5=flower
const TERRAIN: number[][] = [
  [1,1,1,3,3,3,3,3,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,1,1],
  [1,0,4,3,3,4,3,3,0,4,0,0,4,0,0,5,0,0,0,1],
  [1,0,0,2,2,2,2,2,2,0,0,0,0,0,5,0,0,4,0,1],
  [1,0,0,2,0,0,0,0,2,0,0,4,0,0,0,0,0,0,0,1],
  [1,4,0,2,0,0,0,0,2,0,0,0,0,0,0,0,4,0,0,1],
  [1,0,0,2,0,0,0,0,2,0,0,0,0,0,0,0,0,0,5,1],
  [1,0,5,2,0,0,0,0,2,0,0,4,0,0,0,0,0,0,0,1],
  [1,0,0,2,0,0,0,0,2,0,0,0,0,5,0,0,0,4,0,1],
  [1,0,4,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,5,0,0,1],
  [1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const TILE_COLORS: Record<number, number[]> = {
  0: [0x4a7c3f, 0x3d6b34],   // grass
  1: [0x2d4a24, 0x263d1d],   // dark grass (border)
  2: [0x8b7355, 0x7a6347],   // path
  3: [0x1a4a6b, 0x163d5a],   // water
  4: [0x2d4a24, 0x263d1d],   // tree (same as dark, drawn on top)
  5: [0x4a7c3f, 0x3d6b34],   // flower (same as grass)
};

export class MapScene extends Phaser.Scene {
  private playerXP = 0;
  private enemyContainer?: Phaser.GameObjects.Container;
  private enemyTween?: Phaser.Tweens.Tween;

  constructor() { super('MapScene'); }

  init(data: { xp?: number }) {
    this.playerXP = data?.xp ?? 0;
  }

  create() {
    // Masquer le HUD combat
    new HUD().hide();

    const W = this.scale.width;
    const H = this.scale.height;

    const offX = (W - MAP_W * TILE) / 2;
    const offY = (H - MAP_H * TILE) / 2;

    this.drawTerrain(offX, offY);
    this.spawnDecorations(offX, offY);
    this.spawnPlayer(offX, offY);
    this.spawnEnemy(offX, offY);
    this.drawUI();
  }

  private drawTerrain(offX: number, offY: number) {
    for (let row = 0; row < MAP_H; row++) {
      for (let col = 0; col < MAP_W; col++) {
        const t = TERRAIN[row][col];
        const colors = TILE_COLORS[t] ?? TILE_COLORS[0];
        const checker = (row + col) % 2 === 0;
        const color = checker ? colors[0] : colors[1];

        const g = this.add.graphics();
        g.fillStyle(color, 1);
        g.fillRect(offX + col * TILE, offY + row * TILE, TILE, TILE);

        // Water shimmer
        if (t === 3) {
          g.fillStyle(0x2196f3, 0.15);
          g.fillRect(offX + col * TILE + 4, offY + row * TILE + 4, TILE - 8, 6);
          g.fillRect(offX + col * TILE + 8, offY + row * TILE + 18, TILE - 16, 4);
        }
      }
    }

    // Grid lines
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x000000, 0.15);
    for (let row = 0; row <= MAP_H; row++) {
      grid.lineBetween(offX, offY + row * TILE, offX + MAP_W * TILE, offY + row * TILE);
    }
    for (let col = 0; col <= MAP_W; col++) {
      grid.lineBetween(offX + col * TILE, offY, offX + col * TILE, offY + MAP_H * TILE);
    }
  }

  private spawnDecorations(offX: number, offY: number) {
    for (let row = 0; row < MAP_H; row++) {
      for (let col = 0; col < MAP_W; col++) {
        const t = TERRAIN[row][col];
        const cx = offX + col * TILE + TILE / 2;
        const cy = offY + row * TILE + TILE / 2;

        if (t === 4) {
          // Tree
          const g = this.add.graphics();
          g.fillStyle(0x1a3a12, 1);
          g.fillTriangle(cx, cy - 18, cx - 14, cy + 8, cx + 14, cy + 8);
          g.fillStyle(0x1f4a15, 1);
          g.fillTriangle(cx, cy - 24, cx - 12, cy + 2, cx + 12, cy + 2);
          g.fillStyle(0x5c3d1a, 1);
          g.fillRect(cx - 4, cy + 8, 8, 10);
        } else if (t === 5) {
          // Flower
          const g = this.add.graphics();
          g.fillStyle(0xffd700, 1);
          g.fillCircle(cx, cy, 4);
          g.fillStyle(0xff69b4, 0.8);
          g.fillCircle(cx - 5, cy, 3);
          g.fillCircle(cx + 5, cy, 3);
          g.fillCircle(cx, cy - 5, 3);
        }
      }
    }
  }

  private spawnPlayer(offX: number, offY: number) {
    // Player on the path around col 4, row 6
    const px = offX + 4 * TILE + TILE / 2;
    const py = offY + 6 * TILE + TILE / 2;

    const c = this.add.container(px, py);
    const shadow = this.add.ellipse(0, 14, 30, 10, 0x000000, 0.3);
    const body = this.add.graphics();
    body.fillStyle(0x0ea5e9, 1);
    body.fillRoundedRect(-10, 0, 20, 16, 3);
    body.fillStyle(0x38bdf8, 1);
    body.fillCircle(0, -8, 9);
    const icon = this.add.text(0, -10, '🏹', { fontSize: '12px' }).setOrigin(0.5);
    c.add([shadow, body, icon]);

    // Label
    this.add.text(px, py + 26, 'Archer', {
      fontSize: '12px', color: '#38bdf8', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);

    // Idle bob
    this.tweens.add({
      targets: c, y: py - 4, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut'
    });
  }

  private spawnEnemy(offX: number, offY: number) {
    // Enemy around col 14, row 6
    const ex = offX + 14 * TILE + TILE / 2;
    const ey = offY + 6 * TILE + TILE / 2;

    // Exclamation glow ring
    const ring = this.add.circle(ex, ey, 32, 0xef4444, 0.15);
    this.tweens.add({
      targets: ring, scaleX: 1.3, scaleY: 1.3, alpha: 0,
      yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut'
    });

    const c = this.add.container(ex, ey);
    const shadow = this.add.ellipse(0, 14, 30, 10, 0x000000, 0.3);
    const body = this.add.graphics();
    body.fillStyle(0xb91c1c, 1);
    body.fillRoundedRect(-10, 0, 20, 16, 3);
    body.fillStyle(0xef4444, 1);
    body.fillCircle(0, -8, 9);
    const icon = this.add.text(0, -10, '👹', { fontSize: '12px' }).setOrigin(0.5);

    // "!" badge
    const badge = this.add.text(12, -20, '!', {
      fontSize: '16px', color: '#fde047', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);

    c.add([shadow, body, icon, badge]);
    c.setSize(48, 48);
    c.setInteractive({ cursor: 'pointer' });

    this.enemyContainer = c;

    // Hover effect
    c.on('pointerover', () => {
      this.tweens.add({ targets: c, scaleX: 1.1, scaleY: 1.1, duration: 120 });
      tooltip.setVisible(true);
    });
    c.on('pointerout', () => {
      this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 120 });
      tooltip.setVisible(false);
    });
    c.on('pointerdown', () => this.startCombat());

    // Tooltip
    const tooltip = this.add.container(ex, ey - 52).setVisible(false);
    const tooltipBg = this.add.rectangle(0, 0, 110, 28, 0x0e1320, 0.92).setStrokeStyle(1, 0xef4444);
    const tooltipTxt = this.add.text(0, 0, '⚔ Lancer le combat', {
      fontSize: '11px', color: '#fca5a5', fontStyle: 'bold'
    }).setOrigin(0.5);
    tooltip.add([tooltipBg, tooltipTxt]);

    // Label
    this.add.text(ex, ey + 26, 'Ennemi', {
      fontSize: '12px', color: '#ef4444', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);

    // Idle bob
    this.enemyTween = this.tweens.add({
      targets: c, y: ey - 4, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.easeInOut'
    });
  }

  private drawUI() {
    const W = this.scale.width;

    // Top bar
    const bar = this.add.rectangle(W / 2, 24, W, 48, 0x0e1320, 0.9).setDepth(10);
    this.add.text(W / 2, 24, 'CARTE DU MONDE', {
      fontSize: '16px', color: '#e6e8ee', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5).setDepth(10);

    // XP display
    this.add.text(W - 16, 24, `✦ ${this.playerXP} XP`, {
      fontSize: '14px', color: '#fde047', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(1, 0.5).setDepth(10);

    // Hint
    this.add.text(W / 2, this.scale.height - 16, 'Clique sur l\'ennemi pour combattre', {
      fontSize: '12px', color: '#8b93a7'
    }).setOrigin(0.5).setDepth(10);
  }

  private startCombat() {
    if (this.enemyContainer) {
      this.tweens.add({
        targets: this.enemyContainer, scaleX: 1.3, scaleY: 1.3, alpha: 0,
        duration: 300, ease: 'Back.easeIn',
        onComplete: () => {
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.time.delayedCall(300, () => {
            this.scene.start('PreloadScene', { fromMap: true, xp: this.playerXP });
          });
        }
      });
    }
  }
}
