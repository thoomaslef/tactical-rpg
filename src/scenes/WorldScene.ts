import Phaser from 'phaser';
import { MapData, MapExit, MonsterSpawn } from '../maps/MapLoader';
import { MapManager } from '../maps/MapManager';
import { gridToIso, isoToGrid, TILE_W, TILE_H } from '../game/iso';
import { HUD } from '../ui/hud';
import { PlayerStats, emptyStats, getLevel, availablePoints } from '../game/stats';
import { PlayerEquipment, InventoryEntry, emptyEquipment, startingInventory, chestInventory } from '../game/items';
import { gameState } from '../game/gameState';
import { getCharacterMenu } from '../ui/CharacterMenu';
import { getSpellsPanel } from '../ui/SpellsPanel';
import { getEquipmentMenu } from '../ui/EquipmentMenu';

const MAP_W = 14;
const MAP_H = 9;
const BLOCKED = new Set([3, 4, 6]);
const CHEST_X = 8;
const CHEST_Y = 3;

const TILE_COLORS: Record<number, [number, number]> = {
  0: [0x4a7c3f, 0x3d6b34],   // grass
  1: [0x2d5a20, 0x263d1d],   // dark grass (border)
  2: [0x9b8060, 0x8a7050],   // path / dirt
  3: [0x1a5a8a, 0x163d5a],   // water
  4: [0x2d5a20, 0x263d1d],   // tree base (forest floor)
  5: [0x4a7c3f, 0x3d6b34],   // flowers (grass base)
  6: [0x4a4040, 0x3a3030],   // stone wall
  7: [0x7a6a50, 0x6a5a40],   // ruins floor
};

export class WorldScene extends Phaser.Scene {
  private mapManager = new MapManager();
  private mapData!: MapData;
  private playerX = 6;
  private playerY = 4;
  private playerXP = 0;
  private playerStats: PlayerStats = emptyStats();
  private equipment: PlayerEquipment = emptyEquipment();
  private inventory: InventoryEntry[] = startingInventory();
  private defeatedMonsters: string[] = [];
  private isMoving = false;
  private playerCont!: Phaser.GameObjects.Container;
  private monsterConts = new Map<string, Phaser.GameObjects.Container>();
  private chestCont: Phaser.GameObjects.Container | null = null;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private statsBtn!: Phaser.GameObjects.Text;

  constructor() { super('WorldScene'); }

  private get originX() {
    return this.scale.width / 2 - (MAP_W - MAP_H) * (TILE_W / 4);
  }
  private get originY() { return 70; }

  init(data?: { mapId?: string; playerX?: number; playerY?: number; xp?: number; defeatedMonsters?: string[]; playerStats?: PlayerStats; equipment?: PlayerEquipment; inventory?: InventoryEntry[] }) {
    this.playerX = data?.playerX ?? 6;
    this.playerY = data?.playerY ?? 4;
    this.playerXP = data?.xp ?? 0;
    this.playerStats = data?.playerStats ? { ...data.playerStats } : emptyStats();
    this.equipment = data?.equipment ? { ...data.equipment } : emptyEquipment();
    this.inventory = data?.inventory ? data.inventory.map(e => ({ ...e })) : startingInventory();
    this.defeatedMonsters = data?.defeatedMonsters ? [...data.defeatedMonsters] : [];
    this.mapData = this.mapManager.loadMap(data?.mapId ?? 'village_centre');
    this.monsterConts.clear();
    this.isMoving = false;
    getCharacterMenu().close();
    getSpellsPanel().close();
    getEquipmentMenu().close();
  }

  create() {
    new HUD().hide();
    this.cameras.main.setBackgroundColor('#0e1320');
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.hoverGfx = this.add.graphics().setDepth(9990);

    this.drawTiles();
    this.drawExits();
    this.drawMonsters();
    this.drawChest();
    this.drawPlayer();
    this.drawUI();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onHover(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handleClick(p));
    this.input.keyboard?.on('keydown-C', () => this.openCharMenu());
    this.input.keyboard?.on('keydown-S', () => this.openSpellsPanel());
    this.input.keyboard?.on('keydown-E', () => this.openEquipMenu());
    this.scale.on('resize', () => {
      this.scene.restart({
        mapId: this.mapData.id,
        playerX: this.playerX,
        playerY: this.playerY,
        xp: this.playerXP,
        playerStats: this.playerStats,
        equipment: this.equipment,
        inventory: this.inventory,
        defeatedMonsters: this.defeatedMonsters,
      });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private tileAt(gx: number, gy: number): number {
    return this.mapData.tiles[gy]?.[gx] ?? 1;
  }

  private iso(gx: number, gy: number) {
    return gridToIso(gx, gy, this.originX, this.originY);
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  }

  private isBlocked(x: number, y: number): boolean {
    return BLOCKED.has(this.tileAt(x, y));
  }

  private getExitAt(x: number, y: number): MapExit | undefined {
    return this.mapData.exits.find(e => e.x === x && e.y === y);
  }

  private getMonsterAt(x: number, y: number): MonsterSpawn | undefined {
    return this.mapData.spawns.find(s =>
      s.x === x && s.y === y && !this.defeatedMonsters.includes(s.id)
    );
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  private drawTiles() {
    for (let gy = 0; gy < MAP_H; gy++) {
      for (let gx = 0; gx < MAP_W; gx++) {
        const t = this.tileAt(gx, gy);
        const colors = TILE_COLORS[t] ?? TILE_COLORS[0];
        const checker = (gx + gy) % 2 === 0;
        const color = checker ? colors[0] : colors[1];
        const { x: px, y: py } = this.iso(gx, gy);

        const poly = this.add.polygon(px, py, [
          0, -TILE_H / 2,
          TILE_W / 2, 0,
          0, TILE_H / 2,
          -TILE_W / 2, 0,
        ], color, 1);
        poly.setStrokeStyle(1, 0x000000, 0.15);
        poly.setDepth(py);

        // Tile decorations
        if (t === 3) {
          // Water shimmer
          const g = this.add.graphics().setDepth(py + 1);
          g.fillStyle(0x4fc3f7, 0.22);
          g.fillTriangle(px - 10, py - 4, px + 10, py - 4, px, py - TILE_H / 2 + 2);
          g.fillStyle(0x4fc3f7, 0.12);
          g.fillTriangle(px - 8, py + 4, px + 8, py + 4, px, py + 2);
        } else if (t === 4) {
          // Tree trunk + canopy
          const treeY = py - TILE_H / 2;
          const g = this.add.graphics().setDepth(py + 3);
          g.fillStyle(0x5c3d1a, 1);
          g.fillRect(px - 3, treeY - 6, 6, 10);
          g.fillStyle(0x1a3a12, 1);
          g.fillTriangle(px, treeY - 28, px - 14, treeY - 4, px + 14, treeY - 4);
          g.fillStyle(0x1f4a15, 1);
          g.fillTriangle(px, treeY - 34, px - 10, treeY - 16, px + 10, treeY - 16);
        } else if (t === 5) {
          // Flowers
          const g = this.add.graphics().setDepth(py + 1);
          g.fillStyle(0xffd700, 1);
          g.fillCircle(px - 7, py - 2, 3);
          g.fillStyle(0xff69b4, 0.9);
          g.fillCircle(px + 4, py - 5, 2.5);
          g.fillStyle(0xfff, 1);
          g.fillCircle(px + 9, py + 2, 2);
        } else if (t === 6) {
          // Stone wall – raised cube sides
          const g = this.add.graphics().setDepth(py + 2);
          // right face
          g.fillStyle(checker ? 0x2e2828 : 0x261e1e, 1);
          g.fillPoints([
            { x: px + TILE_W / 2, y: py },
            { x: px, y: py + TILE_H / 2 },
            { x: px, y: py + TILE_H / 2 + 10 },
            { x: px + TILE_W / 2, y: py + 10 },
          ], true);
          // left face
          g.fillStyle(checker ? 0x221c1c : 0x1a1414, 1);
          g.fillPoints([
            { x: px - TILE_W / 2, y: py },
            { x: px, y: py + TILE_H / 2 },
            { x: px, y: py + TILE_H / 2 + 10 },
            { x: px - TILE_W / 2, y: py + 10 },
          ], true);
        }
      }
    }
  }

  private drawExits() {
    for (const exit of this.mapData.exits) {
      const { x: px, y: py } = this.iso(exit.x, exit.y);

      const g = this.add.graphics().setDepth(py + 4);
      g.fillStyle(0x38bdf8, 0.3);
      g.fillPoints([
        { x: px, y: py - TILE_H / 2 },
        { x: px + TILE_W / 2, y: py },
        { x: px, y: py + TILE_H / 2 },
        { x: px - TILE_W / 2, y: py },
      ], true);
      g.lineStyle(2, 0x38bdf8, 0.75);
      g.strokePoints([
        { x: px, y: py - TILE_H / 2 },
        { x: px + TILE_W / 2, y: py },
        { x: px, y: py + TILE_H / 2 },
        { x: px - TILE_W / 2, y: py },
      ], true);

      this.tweens.add({ targets: g, alpha: 0.2, yoyo: true, repeat: -1, duration: 900 });

      const arrow = this.getExitArrow(exit);
      this.add.text(px, py - 3, arrow, {
        fontSize: '10px', color: '#7dd3fc', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(py + 5);
    }
  }

  private getExitArrow(exit: MapExit): string {
    if (exit.x === 0) return '◀';
    if (exit.x === MAP_W - 1) return '▶';
    if (exit.y === 0) return '▲';
    return '▼';
  }

  private drawMonsters() {
    const alive = this.mapData.spawns.filter(s => !this.defeatedMonsters.includes(s.id));
    for (const spawn of alive) {
      const { x: px, y: py } = this.iso(spawn.x, spawn.y);

      // Pulse ring
      const ring = this.add.circle(px, py + 2, 24, 0xef4444, 0.12).setDepth(999 + py);
      this.tweens.add({ targets: ring, scaleX: 1.35, scaleY: 1.35, alpha: 0, yoyo: true, repeat: -1, duration: 900 });

      // Sprite container
      const c = this.add.container(px, py - 14).setDepth(1000 + py);
      const shadow = this.add.ellipse(0, 14, 28, 9, 0x000000, 0.28);
      const body = this.add.graphics();
      body.fillStyle(0xb91c1c, 1);
      body.fillRoundedRect(-10, 0, 20, 14, 3);
      body.fillStyle(0xef4444, 1);
      body.fillCircle(0, -7, 8);
      const icon = this.add.text(0, -8, '👹', { fontSize: '11px' }).setOrigin(0.5);
      const badge = this.add.text(10, -18, '!', {
        fontSize: '13px', color: '#fde047', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      c.add([shadow, body, icon, badge]);
      this.tweens.add({ targets: c, y: c.y - 4, yoyo: true, repeat: -1, duration: 800 });

      this.monsterConts.set(spawn.id, c);
    }
  }

  private drawChest() {
    if (gameState.chestLooted) return;
    const { x: px, y: py } = this.iso(CHEST_X, CHEST_Y);
    const c = this.add.container(px, py - 10).setDepth(1000 + py);

    const glow = this.add.circle(0, 10, 26, 0xffd700, 0.18).setDepth(py);
    const g = this.add.graphics();
    // Coffre — corps
    g.fillStyle(0x7a4a1e, 1);
    g.fillRoundedRect(-13, 2, 26, 16, 3);
    // Couvercle
    g.fillStyle(0x9b6230, 1);
    g.fillRoundedRect(-13, -4, 26, 10, 3);
    // Bande dorée
    g.fillStyle(0xffd700, 1);
    g.fillRect(-13, 2, 26, 3);
    // Serrure
    g.fillStyle(0xffd700, 1);
    g.fillCircle(0, 4, 4);
    g.fillStyle(0xc8a010, 1);
    g.fillCircle(0, 4, 2);

    const sparkle = this.add.text(0, -16, '✨', { fontSize: '12px' }).setOrigin(0.5);
    c.add([glow, g, sparkle]);
    this.tweens.add({ targets: sparkle, y: sparkle.y - 5, alpha: 0.5, yoyo: true, repeat: -1, duration: 700 });
    this.tweens.add({ targets: glow, alpha: 0.35, yoyo: true, repeat: -1, duration: 900 });

    this.chestCont = c;
  }

  private lootChest() {
    gameState.chestLooted = true;
    if (this.chestCont) {
      this.tweens.add({
        targets: this.chestCont,
        scaleX: 1.4, scaleY: 1.4,
        alpha: 0,
        duration: 350,
        ease: 'Back.easeIn',
        onComplete: () => { this.chestCont?.destroy(); this.chestCont = null; },
      });
    }
    const loot = chestInventory();
    for (const item of loot) {
      const existing = this.inventory.find(e => e.id === item.id);
      if (existing) existing.qty += item.qty;
      else this.inventory.push({ ...item });
    }
    const popup = this.add.text(
      this.iso(CHEST_X, CHEST_Y).x,
      this.iso(CHEST_X, CHEST_Y).y - 30,
      '🎁 Tous les objets obtenus !',
      { fontSize: '13px', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5).setDepth(20000);
    this.tweens.add({ targets: popup, y: popup.y - 40, alpha: 0, duration: 1800, onComplete: () => popup.destroy() });
  }

  private drawPlayer() {
    const { x: px, y: py } = this.iso(this.playerX, this.playerY);
    const c = this.add.container(px, py - 14).setDepth(1000 + py);
    const shadow = this.add.ellipse(0, 14, 28, 9, 0x000000, 0.28);
    const body = this.add.graphics();
    body.fillStyle(0x0ea5e9, 1);
    body.fillRoundedRect(-10, 0, 20, 14, 3);
    body.fillStyle(0x38bdf8, 1);
    body.fillCircle(0, -7, 8);
    const icon = this.add.text(0, -8, '🏹', { fontSize: '11px' }).setOrigin(0.5);
    c.add([shadow, body, icon]);
    this.playerCont = c;
    this.tweens.add({ targets: c, y: c.y - 4, yoyo: true, repeat: -1, duration: 950 });
  }

  private drawUI() {
    const W = this.scale.width;
    const lvl = getLevel(this.playerXP);
    const avail = availablePoints(this.playerXP, this.playerStats);
    const isMobile = this.sys.game.device.input.touch;
    const fontSize = isMobile ? '15px' : '13px';
    const pad = isMobile ? { x: 14, y: 10 } : { x: 10, y: 6 };
    const barH = isMobile ? 56 : 48;

    // Top bar background
    this.add.rectangle(W / 2, barH / 2, W, barH, 0x0e1320, 0.92).setDepth(10000);

    // Zone name (center)
    this.add.text(W / 2, barH / 2, this.mapData.zone.toUpperCase(), {
      fontSize: isMobile ? '14px' : '15px', color: '#e6e8ee', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(10001);

    // XP (right)
    this.add.text(W - 14, barH / 2, `✦ ${this.playerXP} XP`, {
      fontSize: isMobile ? '13px' : '14px', color: '#fde047', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(10001);

    // Stats button (left)
    const btnColor = avail > 0 ? '#4ade80' : '#a5b4fc';
    const btnBg   = avail > 0 ? '#0f2318' : '#1c2230';
    const btnBorder = avail > 0 ? '#16a34a' : '#2a3248';
    this.statsBtn = this.add.text(14, barH / 2,
      `Nv.${lvl}  📋${avail > 0 ? ` ✨${avail}` : ''}`,
      { fontSize, color: btnColor, fontStyle: 'bold', backgroundColor: btnBg, padding: pad }
    ).setOrigin(0, 0.5).setDepth(10001).setInteractive({ cursor: 'pointer' });

    const tb = this.statsBtn.getBounds();
    this.add.rectangle(tb.centerX, tb.centerY, tb.width + 2, tb.height + 2, 0x000000, 0)
      .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(btnBorder).color)
      .setDepth(10000);

    this.statsBtn.on('pointerover', () => this.statsBtn.setColor('#e6e8ee'));
    this.statsBtn.on('pointerout',  () => this.statsBtn.setColor(btnColor));
    this.statsBtn.on('pointerdown', () => this.openCharMenu());

    // Sorts button
    const spellsBtn = this.add.text(tb.right + 8, barH / 2, '⚔️ Sorts', {
      fontSize, color: '#f97316', fontStyle: 'bold', backgroundColor: '#1c0f08', padding: pad,
    }).setOrigin(0, 0.5).setDepth(10001).setInteractive({ cursor: 'pointer' });
    spellsBtn.on('pointerover', () => spellsBtn.setColor('#e6e8ee'));
    spellsBtn.on('pointerout',  () => spellsBtn.setColor('#f97316'));
    spellsBtn.on('pointerdown', () => this.openSpellsPanel());

    // Equipment button
    const spellsBounds = spellsBtn.getBounds();
    const equipBtn = this.add.text(spellsBounds.right + 8, barH / 2, '🎒 Équip.', {
      fontSize, color: '#a78bfa', fontStyle: 'bold', backgroundColor: '#12102a', padding: pad,
    }).setOrigin(0, 0.5).setDepth(10001).setInteractive({ cursor: 'pointer' });
    equipBtn.on('pointerover', () => equipBtn.setColor('#e6e8ee'));
    equipBtn.on('pointerout',  () => equipBtn.setColor('#a78bfa'));
    equipBtn.on('pointerdown', () => this.openEquipMenu());

    // Bottom hint — keyboard only, hidden on touch
    if (!isMobile) {
      this.add.text(W / 2, this.scale.height - 16,
        '[C] Caract.  ·  [S] Sorts  ·  [E] Équipement  ·  Clic ennemi pour combattre',
        { fontSize: '11px', color: '#8b93a7' }
      ).setOrigin(0.5).setDepth(10001);
    }
  }

  private openCharMenu() {
    if (this.isMoving) return;
    const menu = getCharacterMenu();
    if (menu.isOpen()) { menu.close(); return; }
    getSpellsPanel().close();
    getEquipmentMenu().close();
    menu.open(this.playerStats, this.playerXP, (updated) => {
      this.playerStats = updated;
    }, this.equipment);
  }

  private openSpellsPanel() {
    if (this.isMoving) return;
    const panel = getSpellsPanel();
    if (panel.isOpen()) { panel.close(); return; }
    getCharacterMenu().close();
    getEquipmentMenu().close();
    panel.open();
  }

  private openEquipMenu() {
    if (this.isMoving) return;
    const menu = getEquipmentMenu();
    if (menu.isOpen()) { menu.close(); return; }
    getCharacterMenu().close();
    getSpellsPanel().close();
    menu.open(this.equipment, this.inventory, (equip, inv) => {
      this.equipment = equip;
      this.inventory = inv;
    });
  }

  // ── Hover ─────────────────────────────────────────────────────────────────

  private onHover(ptr: Phaser.Input.Pointer) {
    const { x: gx, y: gy } = isoToGrid(ptr.x, ptr.y, this.originX, this.originY);
    this.hoverGfx.clear();
    if (!this.inBounds(gx, gy)) {
      this.input.setDefaultCursor('default');
      return;
    }
    const { x: px, y: py } = this.iso(gx, gy);
    const hasMonster = !!this.getMonsterAt(gx, gy);
    const hasExit = !!this.getExitAt(gx, gy);
    const hasChest = !gameState.chestLooted && gx === CHEST_X && gy === CHEST_Y;
    const blocked = this.isBlocked(gx, gy) && !hasMonster;

    const color = hasMonster ? 0xef4444 : hasChest ? 0xffd700 : hasExit ? 0x38bdf8 : blocked ? 0x555566 : 0xffffff;
    const alpha = blocked ? 0.25 : 0.45;
    this.hoverGfx.lineStyle(1.5, color, alpha);
    this.hoverGfx.beginPath();
    this.hoverGfx.moveTo(px, py - TILE_H / 2);
    this.hoverGfx.lineTo(px + TILE_W / 2, py);
    this.hoverGfx.lineTo(px, py + TILE_H / 2);
    this.hoverGfx.lineTo(px - TILE_W / 2, py);
    this.hoverGfx.closePath();
    this.hoverGfx.strokePath();

    this.input.setDefaultCursor(hasMonster || hasExit || hasChest ? 'pointer' : 'default');
  }

  // ── Click / movement ──────────────────────────────────────────────────────

  private handleClick(ptr: Phaser.Input.Pointer) {
    if (this.isMoving) return;
    const { x: gx, y: gy } = isoToGrid(ptr.x, ptr.y, this.originX, this.originY);
    if (!this.inBounds(gx, gy)) return;

    // Chest
    if (!gameState.chestLooted && gx === CHEST_X && gy === CHEST_Y) { this.lootChest(); return; }

    // Monster → combat
    const monster = this.getMonsterAt(gx, gy);
    if (monster) { this.triggerCombat(monster); return; }

    if (this.isBlocked(gx, gy)) return;
    if (gx === this.playerX && gy === this.playerY) return;

    const path = this.findPath(this.playerX, this.playerY, gx, gy);
    if (path.length < 2) return;
    this.moveAlongPath(path);
  }

  private findPath(sx: number, sy: number, tx: number, ty: number): [number, number][] {
    const visited = new Set<string>();
    const prev = new Map<string, string>();
    const queue: [number, number][] = [[sx, sy]];
    visited.add(`${sx},${sy}`);

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      if (cx === tx && cy === ty) {
        const path: [number, number][] = [];
        let cur = `${cx},${cy}`;
        while (cur !== `${sx},${sy}`) {
          const [px, py] = cur.split(',').map(Number) as [number, number];
          path.unshift([px, py]);
          cur = prev.get(cur)!;
        }
        path.unshift([sx, sy]);
        return path;
      }
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as [number, number][]) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;
        if (this.isBlocked(nx, ny)) continue;
        if (this.getMonsterAt(nx, ny)) continue; // monsters block pathfinding
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        visited.add(key);
        prev.set(key, `${cx},${cy}`);
        queue.push([nx, ny]);
      }
    }
    return [];
  }

  private moveAlongPath(path: [number, number][]) {
    if (path.length < 2) return;
    this.isMoving = true;
    this.tweens.killTweensOf(this.playerCont);

    let i = 1;
    const step = () => {
      if (i >= path.length) {
        this.isMoving = false;
        this.tweens.add({ targets: this.playerCont, y: this.playerCont.y - 4, yoyo: true, repeat: -1, duration: 950 });
        const exit = this.getExitAt(this.playerX, this.playerY);
        if (exit) this.triggerTransition(exit);
        return;
      }
      const [nx, ny] = path[i++];
      this.playerX = nx;
      this.playerY = ny;
      const { x: px, y: py } = this.iso(nx, ny);
      this.playerCont.setDepth(1000 + py);
      this.tweens.add({
        targets: this.playerCont,
        x: px, y: py - 14,
        duration: 140,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          const exit = this.getExitAt(nx, ny);
          if (exit) { this.isMoving = false; this.triggerTransition(exit); return; }
          step();
        },
      });
    };
    step();
  }

  // ── Transitions ───────────────────────────────────────────────────────────

  private triggerTransition(exit: MapExit) {
    this.isMoving = true;
    this.input.setDefaultCursor('default');
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.restart({
        mapId: exit.targetMap,
        playerX: exit.targetX,
        playerY: exit.targetY,
        xp: this.playerXP,
        playerStats: this.playerStats,
        equipment: this.equipment,
        inventory: this.inventory,
        defeatedMonsters: this.defeatedMonsters,
      });
    });
  }

  private triggerCombat(monster: MonsterSpawn) {
    this.isMoving = true;
    this.input.setDefaultCursor('default');
    const cont = this.monsterConts.get(monster.id);
    const launch = () => {
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.time.delayedCall(300, () => {
        this.scene.start('PreloadScene', {
          fromWorld: true,
          xp: this.playerXP,
          playerStats: this.playerStats,
          equipment: this.equipment,
          inventory: this.inventory,
          mapId: this.mapData.id,
          playerX: this.playerX,
          playerY: this.playerY,
          defeatedMonsters: this.defeatedMonsters,
          monsterId: monster.id,
        });
      });
    };
    if (cont) {
      this.tweens.add({ targets: cont, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 280, ease: 'Back.easeIn', onComplete: launch });
    } else {
      launch();
    }
  }
}
