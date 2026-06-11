import Phaser from 'phaser';
import { MapData, MapExit, MonsterSpawn, ChestData, ChestItem, NPCData, DungeonDoor, DecorationSpawn } from '../maps/MapLoader';
import { SPRITES_MANIFEST, SPRITES_PATH, SPRITES_BLOCKED, SpriteId } from '../config/sprites';
import { MapManager } from '../maps/MapManager';
import { WS_TW, WS_TH, DEFAULT_MAP_W, DEFAULT_MAP_H } from '../config/game.config';
import { HUD } from '../ui/hud';
import { PlayerStats, emptyStats, getLevel, availablePoints, xpForLevel } from '../game/stats';
import { PlayerEquipment, InventoryEntry, emptyEquipment, startingInventory } from '../game/items';
import { gameState } from '../game/gameState';
import { getCharacterMenu } from '../ui/CharacterMenu';
import { getSpellsPanel } from '../ui/SpellsPanel';
import { getEquipmentMenu } from '../ui/EquipmentMenu';
import { getChestModal } from '../ui/ChestModal';
import { getDialogueBox } from '../ui/DialogueBox';
import { getQuestPanel } from '../ui/QuestPanel';
import { getBankModal } from '../ui/BankModal';
import { getShopModal } from '../ui/ShopModal';
import { getSpellUpgradeUI } from '../ui/SpellUpgradeUI';
import { ALL_SPELLS } from '../data/spells/spellsData';

const BLOCKED = new Set([3, 4, 6, 8]);

const TILE_COLORS: Record<number, [number, number]> = {
  0: [0x4a7c3f, 0x3d6b34],   // herbe
  1: [0x2d5a20, 0x263d1d],   // herbe sombre (bordure)
  2: [0x9b8060, 0x8a7050],   // chemin / terre
  3: [0x1a5a8a, 0x163d5a],   // eau
  4: [0x2d5a20, 0x263d1d],   // forêt (sol)
  5: [0x4a7c3f, 0x3d6b34],   // fleurs (base herbe)
  6: [0x4a4040, 0x3a3030],   // mur de pierre
  7: [0x7a6a50, 0x6a5a40],   // sol de ruines
  8: [0x4a4040, 0x3a3030],   // pierre haute
  9: [0x7a6a50, 0x6a5a40],   // pierre plate
};

export class WorldScene extends Phaser.Scene {
  private mapManager = new MapManager();
  private mapData!: MapData;
  private playerX = 11;
  private playerY = 8;
  private playerXP = 0;
  private playerStats: PlayerStats = emptyStats();
  private equipment: PlayerEquipment = emptyEquipment();
  private inventory: InventoryEntry[] = startingInventory();
  private defeatedMonsters: string[] = [];
  private gold = 0;
  private isMoving = false;
  private playerCont!: Phaser.GameObjects.Container;
  private monsterConts = new Map<string, Phaser.GameObjects.Container>();
  private chestConts = new Map<string, Phaser.GameObjects.Container>();
  private npcConts = new Map<string, Phaser.GameObjects.Container>();
  private dungeonDoorCont: Phaser.GameObjects.Container | null = null;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private _monsterTooltip: HTMLDivElement | null = null;
  private statsBtn!: Phaser.GameObjects.Text;
  private uiXpGoldText!: Phaser.GameObjects.Text;
  private messageText: Phaser.GameObjects.Text | null = null;
  private isDialogueOpen = false;
  private isChestOpen = false;
  private isBankOpen = false;

  constructor() { super('WorldScene'); }

  /** Clés de textures custom déjà traitées (survit aux restarts partiels) */
  private _customTexKeys = new Set<string>();

  /** Taille effective des tuiles — recalculée dans drawTiles() pour les maps custom */
  private _tileW = WS_TW;
  private _tileH = WS_TH;

  /** Nombre de tuiles extra rendues + walkables au-delà des bords de la map */
  private readonly EXTRA_WALK = 8;

  preload() {
    // ── Tuiles custom (tileManifest) ───────────────────────────────────────
    const manifest = this.mapData?.tileManifest;
    if (manifest) {
      for (const [idx, filename] of Object.entries(manifest)) {
        const rawKey = `__ctile_raw_${idx}`;
        if (!this.textures.exists(rawKey)) {
          const basePath = this.mapData.tilesPath ?? 'Assets/tiles/custom/';
          this.load.image(rawKey, `${basePath}${filename}`);
        }
      }
    }

    // ── Sprites de décoration (Assets/sprites/) ────────────────────────────
    for (const deco of (this.mapData?.decorations ?? [])) {
      const spriteKey = `__sprite_${deco.sprite}`;
      if (!this.textures.exists(spriteKey)) {
        const filename = SPRITES_MANIFEST[deco.sprite as SpriteId];
        if (filename) this.load.image(spriteKey, `${SPRITES_PATH}${filename}`);
      }
    }

  }

  private _originX = 0;
  private _originY = 70;
  private get originX() { return this._originX; }
  private get originY() { return this._originY; }

  init(data?: {
    mapId?: string;
    playerX?: number;
    playerY?: number;
    xp?: number;
    defeatedMonsters?: string[];
    playerStats?: PlayerStats;
    equipment?: PlayerEquipment;
    inventory?: InventoryEntry[];
    gold?: number;
  }) {
    this.playerX          = data?.playerX ?? 11;
    this.playerY          = data?.playerY ?? 8;
    this.playerXP         = data?.xp ?? 0;
    this.playerStats      = data?.playerStats ? { ...data.playerStats } : emptyStats();
    this.equipment        = data?.equipment ? { ...data.equipment } : emptyEquipment();
    this.inventory        = data?.inventory ? data.inventory.map(e => ({ ...e })) : startingInventory();
    this.defeatedMonsters = data?.defeatedMonsters ? [...data.defeatedMonsters] : [];
    this.gold             = data?.gold ?? 0;
    this.mapData          = this.mapManager.loadMap(data?.mapId ?? 'map_c');
    this.monsterConts.clear();
    this.chestConts.clear();
    this.npcConts.clear();
    this.dungeonDoorCont  = null;
    this.isMoving         = false;
    this.isDialogueOpen   = false;
    this.isChestOpen      = false;


    this._hideMonsterTooltip();
    getCharacterMenu().close();
    getSpellsPanel().close();
    getEquipmentMenu().close();
    getDialogueBox().close();
    getChestModal().close();
    getQuestPanel().close();
    getBankModal().close();
    getShopModal().close();
  }

  create() {
    new HUD().hide();
    this.cameras.main.setBackgroundColor(this.mapData?.tileManifest ? '#1a1a1a' : '#0e1320');
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.hoverGfx = this.add.graphics().setDepth(9990);

    // Traitement des tuiles custom (suppression fond blanc + enregistrement texture Phaser)
    this._processCustomTiles();

    this.drawTiles();
    this.drawBuildingDecorations();
    this.drawExitMarkers();
    this.drawDungeonDoor();
    this.drawChests();
    this.drawMonsters();
    this._setupMonsterRespawns();
    this.drawNPCs();
    this.drawDecorations();
    this.drawPlayer();
    this.drawUI();
    this._checkLevelUp();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onHover(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handleClick(p));
    this.input.on('pointerout',  () => this._hideMonsterTooltip());

    this.input.keyboard?.on('keydown-C', () => this.openCharMenu());
    this.input.keyboard?.on('keydown-S', () => this.openSpellsPanel());
    this.input.keyboard?.on('keydown-E', () => this.openEquipMenu());
    this.input.keyboard?.on('keydown-Q', () => this.openQuestPanel());
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.isDialogueOpen) getDialogueBox().advance();
    });

    this.scale.on('resize', () => {
      this.scene.restart({
        mapId:            this.mapData.id,
        playerX:          this.playerX,
        playerY:          this.playerY,
        xp:               this.playerXP,
        gold:             this.gold,
        playerStats:      this.playerStats,
        equipment:        this.equipment,
        inventory:        this.inventory,
        defeatedMonsters: this.defeatedMonsters,
      });
    });

  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private tileAt(gx: number, gy: number): number {
    const mw = this.mapData.width  ?? DEFAULT_MAP_W;
    const mh = this.mapData.height ?? DEFAULT_MAP_H;
    if (gx < 0 || gy < 0 || gx >= mw || gy >= mh) return 0; // tuile extra = herbe
    return this.mapData.tiles[gy]?.[gx] ?? 0;
  }

  /**
   * Centre pixel de la tuile (gx, gy) — à utiliser pour positionner
   * tous les sprites/containers sur la grille.
   * iso() retourne le coin haut-gauche de la bounding box ; le centre visuel
   * est décalé de (+_tileW/2, +_tileH/2).
   */
  private tileCenter(gx: number, gy: number) {
    const { x, y } = this.iso(gx, gy);
    return { x: x + this._tileW / 2, y: y + this._tileH / 2 };
  }

  /** Isometric projection using WorldScene's scaled tile size */
  private iso(gx: number, gy: number) {
    return {
      x: this._originX + (gx - gy) * (this._tileW / 2),
      y: this._originY + (gx + gy) * (this._tileH / 2),
    };
  }

  /** Inverse iso — screen pixel → grid cell (uses WorldScene scaled tile size) */
  private screenToGrid(px: number, py: number) {
    // iso() retourne le coin haut-gauche du bounding-box de la tuile.
    // Le centre visuel du losange est à (iso.x + _tileW/2, iso.y + _tileH/2).
    // On soustrait ce décalage avant d'inverser la projection isométrique,
    // de sorte qu'un clic au centre du losange renvoie bien la bonne case.
    const dx = px - this._originX - this._tileW / 2;
    const dy = py - this._originY - this._tileH / 2;
    return {
      x: Math.round((dx / (this._tileW / 2) + dy / (this._tileH / 2)) / 2),
      y: Math.round((dy / (this._tileH / 2) - dx / (this._tileW / 2)) / 2),
    };
  }

  private inBounds(x: number, y: number): boolean {
    const mw = this.mapData.width  ?? DEFAULT_MAP_W;
    const mh = this.mapData.height ?? DEFAULT_MAP_H;
    const E  = this.EXTRA_WALK;
    return x >= -E && y >= -E && x < mw + E && y < mh + E;
  }

  private isBlocked(x: number, y: number): boolean {
    const tile = this.tileAt(x, y);
    if (this.mapData.tileManifest) {
      // Map custom : utiliser blockedTiles[] si défini, sinon aucune tuile bloquante
      const blocked = this.mapData.blockedTiles ?? [];
      if (blocked.includes(tile)) return true;
    } else {
      if (BLOCKED.has(tile)) return true;
    }
    // Décorations bloquantes (arbres, rochers…)
    const deco = (this.mapData.decorations ?? []).find(d => d.x === x && d.y === y);
    if (deco && SPRITES_BLOCKED.has(deco.sprite as SpriteId)) return true;
    return false;
  }

  /** Retourne l'exit exactement positionné sur la case (gx, gy), ou undefined. */
  private getExitAt(gx: number, gy: number): MapExit | undefined {
    return this.mapData.exits.find(e => e.x === gx && e.y === gy);
  }

  /** Vrai si l'exit vers la forêt est verrouillé (quête 3 non terminée). */
  private isExitLocked(exit: { targetMap: string }): boolean {
    return exit.targetMap.startsWith('map_foret') && !gameState.quest3RewardGiven;
  }

  /**
   * Retourne un exit coordonnées pour les 4 coins visuels du losange isométrique :
   *  (1,1)       = sommet haut   → Nord   (↑ écran)
   *  (mw-2,mh-2) = sommet bas    → Sud    (↓ écran)
   *  (mw-2,1)    = sommet droite → Est    (→ écran)
   *  (1,mh-2)    = sommet gauche → Ouest  (← écran)
   */
  private getCoordExit(gx: number, gy: number): { targetMap: string; targetX: number; targetY: number } | null {
    const coords = this.mapData.coords;
    if (!coords) return null;
    const [cx, cy] = coords;
    const mw = this.mapData.width  ?? DEFAULT_MAP_W;
    const mh = this.mapData.height ?? DEFAULT_MAP_H;
    const nbW = (nb: MapData) => nb.width  ?? DEFAULT_MAP_W;
    const nbH = (nb: MapData) => nb.height ?? DEFAULT_MAP_H;
    const blocked = this.mapData.blockedCoordDirs ?? [];

    if (gx === 1 && gy === 1 && !blocked.includes('N')) {
      const nb = this.mapManager.getByCoords(cx, cy - 1);
      if (nb) return { targetMap: nb.id, targetX: 1, targetY: nbH(nb) - 2 };
    }
    if (gx === mw - 2 && gy === mh - 2 && !blocked.includes('S')) {
      const nb = this.mapManager.getByCoords(cx, cy + 1);
      if (nb) return { targetMap: nb.id, targetX: nbW(nb) - 2, targetY: 1 };
    }
    if (gx === mw - 2 && gy === 1 && !blocked.includes('E')) {
      const nb = this.mapManager.getByCoords(cx + 1, cy);
      if (nb) return { targetMap: nb.id, targetX: 1, targetY: 1 };
    }
    if (gx === 1 && gy === mh - 2 && !blocked.includes('W')) {
      const nb = this.mapManager.getByCoords(cx - 1, cy);
      if (nb) return { targetMap: nb.id, targetX: nbW(nb) - 2, targetY: nbH(nb) - 2 };
    }
    return null;
  }

  /** Retourne n'importe quel exit (explicite ou coordonnée) sur la case (gx, gy). */
  private getAnyExit(gx: number, gy: number): { targetMap: string; targetX: number; targetY: number } | null {
    return this.getExitAt(gx, gy) ?? this.getCoordExit(gx, gy);
  }

  private getMonsterAt(x: number, y: number): MonsterSpawn | undefined {
    return this.mapData.spawns.find(s =>
      s.x === x && s.y === y && !this.defeatedMonsters.includes(s.id)
    );
  }

  private getChestAt(x: number, y: number): ChestData | undefined {
    return (this.mapData.chests ?? []).find(c =>
      c.x === x && c.y === y &&
      !gameState.lootedChests.has(`${this.mapData.id}:${c.id}`)
    );
  }

  private getNPCAt(x: number, y: number): NPCData | undefined {
    return (this.mapData.npcs ?? []).find(n => n.x === x && n.y === y);
  }

  private roomCleared(): boolean {
    if (!this.mapData.blockExitsUntilCleared) return true;
    return this.mapData.spawns.every(s => this.defeatedMonsters.includes(s.id));
  }

  // ── Custom tile helpers ───────────────────────────────────────────────────

  /**
   * Prend chaque texture chargée depuis tileManifest (clé __ctile_raw_N),
   * supprime le fond blanc par flood-fill, et enregistre la version nettoyée
   * sous la clé __ctile_N dans le cache Phaser.
   */
  private _processCustomTiles(): void {
    const manifest = this.mapData?.tileManifest;
    if (!manifest) return;

    for (const idx of Object.keys(manifest)) {
      const rawKey   = `__ctile_raw_${idx}`;
      const cleanKey = `__ctile_${idx}`;
      if (this._customTexKeys.has(cleanKey)) continue;   // déjà traité
      if (!this.textures.exists(rawKey))    continue;   // pas chargé ?

      const src = this.textures.get(rawKey).getSourceImage() as HTMLImageElement;
      const w = src.naturalWidth  || src.width;
      const h = src.naturalHeight || src.height;
      if (!w || !h) continue;

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(src, 0, 0);
      this._floodRemoveWhite(ctx, w, h);

      this.textures.addCanvas(cleanKey, canvas);
      this._customTexKeys.add(cleanKey);
    }
  }

  /**
   * Flood-fill depuis les 4 coins pour rendre le fond blanc transparent.
   * Même algorithme que dans map-editor.html.
   */
  private _floodRemoveWhite(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const THRESH = 240;
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    const visited = new Uint8Array(w * h);
    const queue: number[] = [];

    const enqueue = (i: number) => {
      if (visited[i]) return;
      const p = i * 4;
      if (d[p] > THRESH && d[p + 1] > THRESH && d[p + 2] > THRESH) {
        visited[i] = 1;
        queue.push(i);
      }
    };

    // Amorce depuis les 4 coins
    enqueue(0);
    enqueue(w - 1);
    enqueue((h - 1) * w);
    enqueue((h - 1) * w + (w - 1));

    while (queue.length) {
      const i = queue.pop()!;
      const p = i * 4;
      d[p + 3] = 0; // transparent
      const x = i % w, y = Math.floor(i / w);
      if (x > 0)     enqueue(i - 1);
      if (x < w - 1) enqueue(i + 1);
      if (y > 0)     enqueue(i - w);
      if (y < h - 1) enqueue(i + w);
    }

    // Adoucir les bords anti-aliasés (pixels clairs mais non-blancs)
    for (let i = 0; i < w * h; i++) {
      if (visited[i] || d[i * 4 + 3] === 0) continue;
      const p = i * 4;
      const bright = (d[p] + d[p + 1] + d[p + 2]) / 3;
      if (bright > 220) {
        d[p + 3] = Math.round(((255 - bright) / 35) * 255);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  private drawTiles() {
    const mw = this.mapData.width  ?? DEFAULT_MAP_W;
    const mh = this.mapData.height ?? DEFAULT_MAP_H;
    const cw        = this.sys.canvas.getBoundingClientRect().width  || this.scale.width;
    const ch        = this.sys.canvas.getBoundingClientRect().height || this.scale.height;
    const barH      = 48;
    const isCustomMap = !!this.mapData.tileManifest;

    // ── Taille de tuile effective : toujours agrandie pour remplir l'écran ──
    {
      const mapW_px = (mw + mh) * (WS_TW / 2);
      const mapH_px = (mw + mh) * (WS_TH / 2);
      const scaleX  = cw / mapW_px;
      const scaleY  = (ch - barH) / mapH_px;
      const scale   = Math.max(scaleX, scaleY) * 1.06;
      this._tileW   = Math.round(WS_TW * scale);
      this._tileH   = Math.round(WS_TH * scale);
    }

    // Recalculer l'origine avec la taille de tuile effective
    const mapHeight2 = (mw + mh) * (this._tileH / 2);
    this._originX    = cw / 2 - (mw - mh) * (this._tileW / 4) - this._tileW / 2;
    this._originY    = barH + (ch - barH - mapHeight2) / 2; // peut être négatif → map déborde en haut

    // On étend le rendu hors-limites pour remplir les coins noirs.
    // Les tuiles hors-carte utilisent le type 0 (herbe) pour les maps procédurales.
    const BORDER_TILE = isCustomMap ? 17 : 0;
    const EXTRA = this.EXTRA_WALK;

    for (let gy = -EXTRA; gy < mh + EXTRA; gy++) {
      for (let gx = -EXTRA; gx < mw + EXTRA; gx++) {
        const inMap = gx >= 0 && gx < mw && gy >= 0 && gy < mh;
        const rawT  = inMap ? (this.mapData.tiles[gy]?.[gx] ?? -1) : -1;
        const t     = inMap ? (rawT ?? (isCustomMap ? -1 : 1))
                            : (isCustomMap ? BORDER_TILE : -1);
        const { x: px, y: py } = this.iso(gx, gy);

        // Cull : ignorer les tuiles entièrement hors écran
        if (px + this._tileW < 0 || px > cw || py + this._tileH < 0 || py > ch) continue;

        const cx = px + this._tileW / 2;
        const cy = py + this._tileH / 2;

        // ── Tuiles PNG custom (map exportée depuis l'éditeur) ─────────────
        if (isCustomMap) {
          if (t < 0) continue;  // case vide, on ne dessine rien
          const cleanKey = `__ctile_${t}`;
          if (this.textures.exists(cleanKey)) {
            // L'image est carrée WS_TW×WS_TW, positionnée depuis le coin haut-gauche
            // du losange — même logique que ctx.drawImage() dans l'éditeur.
            this.add.image(px, py, cleanKey)
              .setOrigin(0, 0)
              .setDisplaySize(this._tileW, this._tileW)
              .setDepth(py);
          }
          continue;  // pas de polygone ni de décoration procédurale
        }

        // ── Tuile procédurale (polygone diamant) ──────────────────────────
        const tileType = inMap ? t : BORDER_TILE;
        if (tileType < 0) continue; // tuile vide
        const checker = (gx + gy) % 2 === 0;
        const colors = TILE_COLORS[tileType] ?? TILE_COLORS[0];
        const color = checker ? colors[0] : colors[1];

        const poly = this.add.polygon(cx, cy, [
          0,            -this._tileH / 2,
          this._tileW / 2,    0,
          0,             this._tileH / 2,
          -this._tileW / 2,   0,
        ], color, 1);
        poly.setStrokeStyle(1, 0x000000, 0.18);
        poly.setDepth(py);

        // ── Décorations de tuiles ─────────────────────────────────────────
        if (tileType === 3) {
          // Eau — reflet
          const g = this.add.graphics().setDepth(py + 1);
          g.fillStyle(0x4fc3f7, 0.22);
          g.fillTriangle(cx - 10, cy - 4, cx + 10, cy - 4, cx, cy - this._tileH / 2 + 4);
          g.fillStyle(0x4fc3f7, 0.12);
          g.fillTriangle(cx - 8, cy + 4, cx + 8, cy + 4, cx, cy + 2);
        } else if (tileType === 4) {
          // Forêt — tronc + frondaison
          const treeY = cy - this._tileH / 2;
          const g = this.add.graphics().setDepth(py + 3);
          g.fillStyle(0x5c3d1a, 1);
          g.fillRect(cx - 3, treeY - 6, 6, 10);
          g.fillStyle(0x1a3a12, 1);
          g.fillTriangle(cx, treeY - 28, cx - 14, treeY - 4, cx + 14, treeY - 4);
          g.fillStyle(0x1f4a15, 1);
          g.fillTriangle(cx, treeY - 34, cx - 10, treeY - 16, cx + 10, treeY - 16);
        } else if (tileType === 5) {
          // Fleurs
          const g = this.add.graphics().setDepth(py + 1);
          g.fillStyle(0xffd700, 1);
          g.fillCircle(cx - 12, cy - 4, 3);
          g.fillStyle(0xff69b4, 0.9);
          g.fillCircle(cx + 4, cy - 8, 2.5);
          g.fillStyle(0xffffff, 1);
          g.fillCircle(cx + 10, cy + 2, 2);
        } else if (tileType === 6 || tileType === 8) {
          // Mur de pierre — faces 3D
          const g = this.add.graphics().setDepth(py + 2);
          const wallH = 14;
          g.fillStyle(checker ? 0x2e2828 : 0x261e1e, 1);
          g.fillPoints([
            { x: cx + this._tileW / 2, y: cy },
            { x: cx,              y: cy + this._tileH / 2 },
            { x: cx,              y: cy + this._tileH / 2 + wallH },
            { x: cx + this._tileW / 2, y: cy + wallH },
          ], true);
          g.fillStyle(checker ? 0x221c1c : 0x1a1414, 1);
          g.fillPoints([
            { x: cx - this._tileW / 2, y: cy },
            { x: cx,              y: cy + this._tileH / 2 },
            { x: cx,              y: cy + this._tileH / 2 + wallH },
            { x: cx - this._tileW / 2, y: cy + wallH },
          ], true);
        }
      }
    }
  }

  private drawBuildingDecorations() {
    if (this.mapData.id !== 'map_c') return;

    // ── Puits central de la Grande Place — purement décoratif ─────────────────
    // Positionné entre les tiles (6,3) et (7,3), centre de la place
    const { x: wx1, y: wy1 } = this.iso(6, 3);
    const { x: wx2, y: wy2 } = this.iso(7, 3);
    const wx = (wx1 + wx2) / 2;
    const wy = (wy1 + wy2) / 2;
    const depth = wy + 80;

    const g = this.add.graphics().setDepth(depth);

    // Ombre au sol
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(wx, wy + 10, 52, 20);

    // Margelle (bord de pierre du puits) — face avant
    g.fillStyle(0x8a7a60, 1);
    g.fillEllipse(wx, wy + 6, 46, 18);
    // Margelle — dessus
    g.fillStyle(0xa89878, 1);
    g.fillEllipse(wx, wy - 4, 46, 18);
    // Anneau intérieur (ouverture du puits)
    g.fillStyle(0x1a1a22, 1);
    g.fillEllipse(wx, wy - 6, 28, 11);
    // Reflet d'eau
    g.fillStyle(0x2a6a9a, 0.7);
    g.fillEllipse(wx, wy - 6, 22, 8);
    g.fillStyle(0x4fc3f7, 0.35);
    g.fillEllipse(wx - 3, wy - 7, 10, 4);

    // Montants verticaux (2 piliers en bois)
    g.fillStyle(0x6b4a28, 1);
    g.fillRect(wx - 16, wy - 22, 5, 18);
    g.fillRect(wx + 11, wy - 22, 5, 18);

    // Poutre horizontale
    g.fillStyle(0x7a5530, 1);
    g.fillRect(wx - 18, wy - 26, 36, 5);

    // Corde (descend au centre)
    g.lineStyle(1.5, 0x9a8060, 0.85);
    g.beginPath();
    g.moveTo(wx, wy - 22);
    g.lineTo(wx, wy - 8);
    g.strokePath();

    // Seau en bois
    g.fillStyle(0x7a5530, 1);
    g.fillRect(wx - 5, wy - 18, 10, 9);
    g.fillStyle(0x5a3d1a, 1);
    g.fillRect(wx - 5, wy - 18, 10, 2);
    g.fillRect(wx - 5, wy - 10, 10, 1);

    // Animation douce : puits légèrement animé (reflet de l'eau)
    const waterGlow = this.add.graphics().setDepth(depth + 1);
    waterGlow.fillStyle(0x4fc3f7, 0.2);
    waterGlow.fillEllipse(wx, wy - 6, 22, 8);
    this.tweens.add({ targets: waterGlow, alpha: 0.05, yoyo: true, repeat: -1, duration: 1400 });
  }

  /**
   * Retourne la direction de la bande de sortie sous le pointeur (espace écran),
   * ou null si le pointeur est en dehors des bandes.
   */
  /**
   * Dessine les marqueurs visuels des sorties.
   * - Maps avec coords : bandes de bordure colorées par direction + flèche centrale.
   * - Maps sans coords (legacy) : losange par exit explicite.
   */
  private drawExitMarkers(): void {
    const mw = this.mapData.width  ?? DEFAULT_MAP_W;
    const mh = this.mapData.height ?? DEFAULT_MAP_H;

    if (this.mapData.coords) {
      this._drawCoordExitStrips(mw, mh);
      // Exits explicites hors-bordure uniquement (raccourcis, téléportations)
      for (const exit of this.mapData.exits) {
        const onBorder = exit.x === 1 || exit.x === mw - 2 || exit.y === 1 || exit.y === mh - 2;
        if (!onBorder) this._drawExplicitExitMarker(exit, mw, mh);
      }
    } else {
      for (const exit of this.mapData.exits) {
        this._drawExplicitExitMarker(exit, mw, mh);
      }
    }
  }

  /** Dessine des bandes de bordure pour chaque direction avec un voisin dans le registre de coords. */
  private _drawCoordExitStrips(mw: number, mh: number): void {
    if (!this.mapData.coords) return;
    const [cx, cy] = this.mapData.coords;
    const hw = this._tileW / 2;
    const hh = this._tileH / 2;

    // Coins visuels du losange iso : haut=(1,1), bas=(mw-2,mh-2), droite=(mw-2,1), gauche=(1,mh-2)
    const blockedDirs = this.mapData.blockedCoordDirs ?? [];
    const dirs = [
      { dir: 'N' as const, dx:  0, dy: -1, arrow: '▲', egx: 1,      egy: 1,      ax:  0,       ay: -hh - 14 },
      { dir: 'S' as const, dx:  0, dy: +1, arrow: '▼', egx: mw - 2,  egy: mh - 2, ax:  0,       ay:  hh + 6  },
      { dir: 'E' as const, dx: +1, dy:  0, arrow: '▶', egx: mw - 2,  egy: 1,      ax:  hw + 10, ay:  0        },
      { dir: 'W' as const, dx: -1, dy:  0, arrow: '◀', egx: 1,       egy: mh - 2, ax: -hw - 10, ay:  0        },
    ];

    for (const { dir, dx, dy, arrow, egx, egy, ax, ay } of dirs) {
      if (blockedDirs.includes(dir)) continue;
      const nb = this.mapManager.getByCoords(cx + dx, cy + dy);
      if (!nb) continue;

      const locked  = this.isExitLocked({ targetMap: nb.id });
      const fillCol = locked ? 0x991b1b : 0x0369a1;
      const lineCol = locked ? 0xef4444 : 0x38bdf8;
      const label   = locked ? '🔒' : arrow;

      const { x: tx, y: ty } = this.tileCenter(egx, egy);
      const g = this.add.graphics().setDepth(ty + 1);
      g.fillStyle(fillCol, 0.30);
      g.fillPoints([{x:tx,y:ty-hh},{x:tx+hw,y:ty},{x:tx,y:ty+hh},{x:tx-hw,y:ty}], true);
      g.lineStyle(2, lineCol, 0.9);
      g.strokePoints([{x:tx,y:ty-hh},{x:tx+hw,y:ty},{x:tx,y:ty+hh},{x:tx-hw,y:ty}], true);
      this.tweens.add({ targets: g, alpha: 0.15, yoyo: true, repeat: -1, duration: locked ? 1400 : 950 });

      const txt = this.add.text(tx + ax, ty + ay, label, {
        fontSize: '18px', color: locked ? '#fca5a5' : '#7dd3fc', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(ty + 2);
      this.tweens.add({ targets: txt, y: txt.y - 6, yoyo: true, repeat: -1, duration: 750 });
    }
  }

  /** Dessine un losange de surbrillance pour un exit explicite (legacy ou hors-bordure). */
  private _drawExplicitExitMarker(exit: MapExit, mw: number, mh: number): void {
    const { x: cx, y: cy } = this.tileCenter(exit.x, exit.y);
    const halfW = mw / 2, halfH = mh / 2;
    let arrow: string;
    if      (exit.x <  halfW && exit.y <  halfH) arrow = '▲';
    else if (exit.x >= halfW && exit.y <  halfH) arrow = '▶';
    else if (exit.x >= halfW && exit.y >= halfH) arrow = '▼';
    else                                          arrow = '◀';

    const locked  = this.isExitLocked(exit);
    const fillCol = locked ? 0x991b1b : 0x38bdf8;
    const lineCol = locked ? 0xef4444 : 0x38bdf8;
    const diamond = [
      { x: cx,                   y: cy - this._tileH / 2 },
      { x: cx + this._tileW / 2, y: cy },
      { x: cx,                   y: cy + this._tileH / 2 },
      { x: cx - this._tileW / 2, y: cy },
    ];
    const g = this.add.graphics().setDepth(cy + 1);
    g.fillStyle(fillCol, 0.30);
    g.fillPoints(diamond, true);
    g.lineStyle(2, lineCol, 0.9);
    g.strokePoints(diamond, true);
    this.tweens.add({ targets: g, alpha: 0.15, yoyo: true, repeat: -1, duration: locked ? 1400 : 950 });

    const label = locked ? '🔒' : arrow;
    const txt = this.add.text(cx, cy - this._tileH / 2 - 12, label, {
      fontSize: '16px', color: locked ? '#fca5a5' : '#7dd3fc', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(cy + 2);
    this.tweens.add({ targets: txt, y: txt.y - 6, yoyo: true, repeat: -1, duration: 750 });
  }

  private drawDungeonDoor() {
    const door = this.mapData.dungeonDoor;
    if (!door) return;
    const { x: cx, y: cy } = this.tileCenter(door.x, door.y);

    const c = this.add.container(cx, cy).setDepth(cy + 4);

    // Cadre de porte
    const g = this.add.graphics();
    g.fillStyle(0x1a0a2e, 1);
    g.fillPoints([
      { x: 0, y: -this._tileH / 2 },
      { x: this._tileW / 2, y: 0 },
      { x: 0, y: this._tileH / 2 },
      { x: -this._tileW / 2, y: 0 },
    ], true);
    g.lineStyle(2, 0x7c3aed, 1);
    g.strokePoints([
      { x: 0, y: -this._tileH / 2 },
      { x: this._tileW / 2, y: 0 },
      { x: 0, y: this._tileH / 2 },
      { x: -this._tileW / 2, y: 0 },
    ], true);

    const icon = this.add.text(0, -4, '🚪', { fontSize: '14px' }).setOrigin(0.5);
    c.add([g, icon]);
    this.tweens.add({ targets: g, alpha: 0.5, yoyo: true, repeat: -1, duration: 1100 });

    this.dungeonDoorCont = c;
  }

  private drawChests() {
    for (const chest of (this.mapData.chests ?? [])) {
      if (gameState.lootedChests.has(`${this.mapData.id}:${chest.id}`)) continue;
      const { x: cx, y: cy } = this.tileCenter(chest.x, chest.y);
      const c = this.add.container(cx, cy - 10).setDepth(1000 + cy);

      const glow = this.add.circle(0, 10, 26, 0xffd700, 0.18).setDepth(cy);
      const g = this.add.graphics();
      g.fillStyle(0x7a4a1e, 1);
      g.fillRoundedRect(-13, 2, 26, 16, 3);
      g.fillStyle(0x9b6230, 1);
      g.fillRoundedRect(-13, -4, 26, 10, 3);
      g.fillStyle(0xffd700, 1);
      g.fillRect(-13, 2, 26, 3);
      g.fillStyle(0xffd700, 1);
      g.fillCircle(0, 4, 4);
      g.fillStyle(0xc8a010, 1);
      g.fillCircle(0, 4, 2);

      const sparkle = this.add.text(0, -16, '✨', { fontSize: '12px' }).setOrigin(0.5);
      c.add([glow, g, sparkle]);
      this.tweens.add({ targets: sparkle, y: sparkle.y - 5, alpha: 0.5, yoyo: true, repeat: -1, duration: 700 });
      this.tweens.add({ targets: glow, alpha: 0.35, yoyo: true, repeat: -1, duration: 900 });

      this.chestConts.set(chest.id, c);
    }
  }

  private drawMonsters() {
    const alive = this.mapData.spawns.filter(s => !this.defeatedMonsters.includes(s.id));
    for (const spawn of alive) this._spawnMonsterSprite(spawn);
  }

  private _spawnMonsterSprite(spawn: MonsterSpawn) {
    const { x: cx, y: cy } = this.tileCenter(spawn.x, spawn.y);

    const ring = this.add.circle(cx, cy + 2, spawn.isBoss ? 34 : 24, 0xef4444, 0.12).setDepth(999 + cy);
    this.tweens.add({ targets: ring, scaleX: 1.35, scaleY: 1.35, alpha: 0, yoyo: true, repeat: -1, duration: 900 });

    const c = this.add.container(cx, cy - 14).setDepth(1000 + cy);
    const shadow = this.add.ellipse(0, 14, spawn.isBoss ? 40 : 28, spawn.isBoss ? 14 : 9, 0x000000, 0.28);
    const body = this.add.graphics();

    if (spawn.isBoss) {
      body.fillStyle(0x7f1d1d, 1);
      body.fillRoundedRect(-16, 0, 32, 20, 4);
      body.fillStyle(0xb91c1c, 1);
      body.fillCircle(0, -10, 13);
      const bossIcon = this.add.text(0, -11, '👹', { fontSize: '14px' }).setOrigin(0.5);
      const bossTag  = this.add.text(0, -30, 'BOSS', {
        fontSize: '9px', color: '#fca5a5', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      c.add([shadow, body, bossIcon, bossTag]);
    } else {
      body.fillStyle(0xb91c1c, 1);
      body.fillRoundedRect(-10, 0, 20, 14, 3);
      body.fillStyle(0xef4444, 1);
      body.fillCircle(0, -7, 8);
      const icon  = this.add.text(0, -8, '👹', { fontSize: '11px' }).setOrigin(0.5);
      const badge = this.add.text(10, -18, '!', {
        fontSize: '13px', color: '#fde047', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      c.add([shadow, body, icon, badge]);
    }

    this.tweens.add({ targets: c, y: c.y - 4, yoyo: true, repeat: -1, duration: 800 });
    this.monsterConts.set(spawn.id, c);
  }

  /** Gère les respawns de monstres en utilisant des timestamps persistants dans gameState. */
  private _setupMonsterRespawns() {
    const RESPAWN_MS = 60_000;
    for (const id of [...this.defeatedMonsters]) {
      const spawn = this.mapData.spawns.find(s => s.id === id);
      if (!spawn || spawn.isBoss) continue;
      const key = `${this.mapData.id}:${id}`;
      // Enregistre le timestamp la première fois qu'on voit ce monstre vaincu
      if (!gameState.monsterRespawnTimes.has(key)) {
        gameState.monsterRespawnTimes.set(key, Date.now() + RESPAWN_MS);
      }
      const respawnAt = gameState.monsterRespawnTimes.get(key)!;
      const remaining = respawnAt - Date.now();
      if (remaining <= 0) {
        // Déjà l'heure de respawner — immédiat
        this.defeatedMonsters = this.defeatedMonsters.filter(d => d !== id);
        gameState.monsterRespawnTimes.delete(key);
        this._spawnMonsterSprite(spawn);
      } else {
        // Planifie pour le temps restant
        this.time.delayedCall(remaining, () => {
          this.defeatedMonsters = this.defeatedMonsters.filter(d => d !== id);
          gameState.monsterRespawnTimes.delete(key);
          this._spawnMonsterSprite(spawn);
        });
      }
    }
  }

  private drawNPCs() {
    for (const npc of (this.mapData.npcs ?? [])) {
      const { x: cx, y: cy } = this.tileCenter(npc.x, npc.y);
      const c = this.add.container(cx, cy - 14).setDepth(1000 + cy);

      const isBanker   = npc.id === 'banquier';
      const isMage     = npc.id === 'magicien';
      const isMarchand = npc.id === 'marchand';
      const bodyColor  = isBanker ? 0x92400e : isMage ? 0x4c1d95 : isMarchand ? 0x7c2d12 : 0x1d4ed8;
      const headColor  = isBanker ? 0xd97706 : isMage ? 0x7c3aed : isMarchand ? 0xea580c : 0x3b82f6;
      const npcIcon    = isBanker ? '💰' : isMage ? '🧙' : isMarchand ? '🛒' : '👨‍🏫';
      const bubbleIcon = isBanker ? '🏦' : isMage ? '✨' : isMarchand ? '🛍️' : '💬';
      const nameColor  = isBanker ? '#fbbf24' : isMage ? '#c4b5fd' : isMarchand ? '#fb923c' : '#fde047';

      const shadow = this.add.ellipse(0, 14, 28, 9, 0x000000, 0.28);
      const body = this.add.graphics();
      body.fillStyle(bodyColor, 1);
      body.fillRoundedRect(-10, 0, 20, 14, 3);
      body.fillStyle(headColor, 1);
      body.fillCircle(0, -7, 8);

      const icon    = this.add.text(0, -8, npcIcon, { fontSize: '11px' }).setOrigin(0.5);
      const nameTag = this.add.text(0, -26, npc.name, {
        fontSize: '9px', color: nameColor,
        fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
      const bubble  = this.add.text(12, -22, bubbleIcon, { fontSize: '10px' }).setOrigin(0.5);

      c.add([shadow, body, icon, nameTag, bubble]);
      this.tweens.add({ targets: c, y: c.y - 3, yoyo: true, repeat: -1, duration: 1200 });
      this.npcConts.set(npc.id, c);
    }
  }

  private drawDecorations() {
    for (const deco of (this.mapData.decorations ?? [])) {
      const spriteKey = `__sprite_${deco.sprite}`;
      if (!this.textures.exists(spriteKey)) continue;

      const { x: cx, y: cy } = this.tileCenter(deco.x, deco.y);

      // Les sprites font 1024×1024. On les affiche à ~1.8× la largeur de tuile.
      // L'ancre est à (0.5, 0.82) : le pied de l'objet correspond au centre de la case.
      const displaySize = this._tileW * 1.8 * (deco.scale ?? 1.0);
      this.add.image(cx, cy, spriteKey)
        .setOrigin(0.5, 0.82)
        .setDisplaySize(displaySize, displaySize)
        .setAngle(deco.rotation ?? 0)
        .setDepth(cy + 5);
    }
  }

  private drawPlayer() {
    const { x: cx, y: cy } = this.tileCenter(this.playerX, this.playerY);
    const c = this.add.container(cx, cy - 14).setDepth(1000 + cy);
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

  private _checkLevelUp() {
    const newLevel = getLevel(this.playerXP);
    if (newLevel <= gameState.currentLevel) {
      gameState.currentLevel = newLevel;
      return;
    }
    const levelsGained = newLevel - gameState.currentLevel;
    gameState.currentLevel = newLevel;

    const W = this.scale.width, H = this.scale.height;
    const div = document.createElement('div');
    div.style.cssText = [
      'position:fixed', 'inset:0', 'display:flex', 'align-items:center',
      'justify-content:center', 'z-index:99999', 'pointer-events:none',
    ].join(';');
    div.innerHTML = `
      <div style="
        background:#0e1320ee;
        border:2px solid #facc15;
        border-radius:16px;
        padding:28px 48px;
        text-align:center;
        font-family:monospace;
        box-shadow:0 0 40px #facc1566;
        animation:lvlup 0.4s cubic-bezier(.17,.67,.35,1.3);
      ">
        <style>@keyframes lvlup{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}</style>
        <div style="font-size:40px;margin-bottom:8px">🌟</div>
        <div style="font-size:22px;font-weight:bold;color:#facc15;margin-bottom:4px">NIVEAU ${newLevel} !</div>
        ${levelsGained > 1 ? `<div style="font-size:13px;color:#fde047">+${levelsGained} niveaux</div>` : ''}
        <div style="font-size:13px;color:#94a3b8;margin-top:8px">+${levelsGained * 10} points de stats</div>
        <div style="font-size:12px;color:#f87171;margin-top:3px">+${levelsGained * 10} PV max</div>
        <div style="font-size:12px;color:#fb923c;margin-top:3px">+${levelsGained} % dégâts finaux</div>
      </div>
    `;
    document.body.appendChild(div);
    setTimeout(() => {
      div.style.transition = 'opacity 0.4s';
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 400);
    }, 2800);
  }

  private drawUI() {
    const W = this.scale.width;
    const lvl   = getLevel(this.playerXP);
    const avail = availablePoints(this.playerXP, this.playerStats);
    const isMobile  = this.sys.game.device.input.touch;
    const fontSize  = isMobile ? '15px' : '13px';
    const pad       = isMobile ? { x: 14, y: 10 } : { x: 10, y: 6 };
    const barH      = isMobile ? 56 : 48;

    this.add.rectangle(W / 2, barH / 2, W, barH, 0x0e1320, 0.92).setDepth(10000);
    const coordSuffix = this.mapData.coords
      ? `  (${this.mapData.coords[0]}, ${this.mapData.coords[1]})`
      : '';
    this.add.text(W / 2, barH / 2, this.mapData.zone.toUpperCase() + coordSuffix, {
      fontSize: isMobile ? '14px' : '15px', color: '#e6e8ee', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(10001);
    this.uiXpGoldText = this.add.text(W - 14, barH / 2, `✦ ${this.playerXP} XP  ·  💰 ${this.gold}`, {
      fontSize: isMobile ? '13px' : '14px', color: '#fde047', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(10001);

    const btnColor  = avail > 0 ? '#4ade80' : '#a5b4fc';
    const btnBg     = avail > 0 ? '#0f2318' : '#1c2230';
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

    const spellsBtn = this.add.text(tb.right + 8, barH / 2, '⚔️ Sorts', {
      fontSize, color: '#f97316', fontStyle: 'bold', backgroundColor: '#1c0f08', padding: pad,
    }).setOrigin(0, 0.5).setDepth(10001).setInteractive({ cursor: 'pointer' });
    spellsBtn.on('pointerover', () => spellsBtn.setColor('#e6e8ee'));
    spellsBtn.on('pointerout',  () => spellsBtn.setColor('#f97316'));
    spellsBtn.on('pointerdown', () => this.openSpellsPanel());

    const spellsBounds = spellsBtn.getBounds();
    const equipBtn = this.add.text(spellsBounds.right + 8, barH / 2, '🎒 Équip.', {
      fontSize, color: '#a78bfa', fontStyle: 'bold', backgroundColor: '#12102a', padding: pad,
    }).setOrigin(0, 0.5).setDepth(10001).setInteractive({ cursor: 'pointer' });
    equipBtn.on('pointerover', () => equipBtn.setColor('#e6e8ee'));
    equipBtn.on('pointerout',  () => equipBtn.setColor('#a78bfa'));
    equipBtn.on('pointerdown', () => this.openEquipMenu());

    if (!isMobile) {
      this.add.text(W / 2, this.scale.height - 16,
        '[C] Caract.  ·  [S] Sorts  ·  [E] Équip.  ·  [Q] Quêtes  ·  Clic ennemi pour combattre',
        { fontSize: '11px', color: '#8b93a7' }
      ).setOrigin(0.5).setDepth(10001);

      // Bouton Quêtes
      const equipBounds = equipBtn.getBounds();
      const questBtn = this.add.text(equipBounds.right + 8, barH / 2, '📜 [Q]', {
        fontSize, color: '#f59e0b', fontStyle: 'bold', backgroundColor: '#1c1300', padding: pad,
      }).setOrigin(0, 0.5).setDepth(10001).setInteractive({ cursor: 'pointer' });
      questBtn.on('pointerover', () => questBtn.setColor('#e6e8ee'));
      questBtn.on('pointerout',  () => questBtn.setColor('#f59e0b'));
      questBtn.on('pointerdown', () => this.openQuestPanel());
    }
  }


  // ── Menus ─────────────────────────────────────────────────────────────────

  private openCharMenu() {
    if (this.isMoving || this.isDialogueOpen || this.isChestOpen) return;
    const menu = getCharacterMenu();
    if (menu.isOpen()) { menu.close(); return; }
    getSpellsPanel().close();
    getEquipmentMenu().close();
    menu.open(this.playerStats, this.playerXP, (updated) => { this.playerStats = updated; }, this.equipment);
  }

  private openSpellsPanel() {
    if (this.isMoving || this.isDialogueOpen || this.isChestOpen) return;
    const panel = getSpellsPanel();
    if (panel.isOpen()) { panel.close(); return; }
    getCharacterMenu().close();
    getEquipmentMenu().close();
    panel.open(getLevel(this.playerXP));
  }

  private openQuestPanel() {
    if (this.isMoving || this.isDialogueOpen || this.isChestOpen) return;
    const panel = getQuestPanel();
    if (panel.isOpen()) { panel.close(); return; }
    getCharacterMenu().close();
    getSpellsPanel().close();
    getEquipmentMenu().close();
    panel.open();
  }

  private openEquipMenu() {
    if (this.isMoving || this.isDialogueOpen || this.isChestOpen) return;
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

  private ptrPos(p: Phaser.Input.Pointer): { x: number; y: number } {
    const rect = this.sys.canvas.getBoundingClientRect();
    const e = p.event as PointerEvent;
    return {
      x: (e.clientX - rect.left) * (this.sys.canvas.width / rect.width),
      y: (e.clientY - rect.top)  * (this.sys.canvas.height / rect.height),
    };
  }

  // ── Tooltip monstre (survol carte du monde) ──────────────────────────────

  private _showMonsterTooltip(spawns: MonsterSpawn[], e: MouseEvent) {
    if (!this._monsterTooltip) {
      const div = document.createElement('div');
      div.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'z-index:9999',
        'background:#0e1320ee',
        'border:1px solid #ef444488',
        'border-radius:8px',
        'padding:8px 12px',
        'min-width:160px',
        'font-family:monospace',
        'font-size:13px',
        'color:#f1f5f9',
        'box-shadow:0 4px 18px #00000088',
      ].join(';');
      document.body.appendChild(div);
      this._monsterTooltip = div;
    }

    const hasBoss = spawns.some(s => s.isBoss);
    const totalXp = spawns.reduce((sum, s) => sum + (s.xpDrop ?? 100), 0);

    const mobRows = spawns.map(spawn => {
      const isBoss = !!spawn.isBoss;
      const behaviorLabel = spawn.behavior === 'melee' ? '⚔️' : '🏹';
      return `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:13px">👹</span>
          <span style="font-weight:bold;color:${isBoss ? '#fca5a5' : '#fde047'};font-size:13px">${spawn.name}</span>
          ${isBoss ? '<span style="background:#7f1d1d;color:#fca5a5;font-size:8px;padding:1px 4px;border-radius:3px;font-weight:bold">BOSS</span>' : ''}
          <span style="color:#64748b;font-size:10px;margin-left:auto">${behaviorLabel} ${spawn.hp} PV</span>
        </div>`;
    }).join('');

    const groupLabel = spawns.length > 1
      ? `<div style="color:#94a3b8;font-size:10px;margin-bottom:6px">Groupe de ${spawns.length} adversaires</div>`
      : '';

    this._monsterTooltip.innerHTML = `
      ${groupLabel}
      ${mobRows}
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #1e293b;margin-top:5px;padding-top:5px">
        <span style="color:#64748b;font-size:10px">Clic pour combattre</span>
        <span style="color:#4ade80;font-size:10px;font-weight:bold">+${totalXp} XP</span>
      </div>
    `;

    const W = window.innerWidth, H = window.innerHeight;
    const TW = 220, TH = 60 + spawns.length * 26;
    let tx = e.clientX + 16;
    let ty = e.clientY + 8;
    if (tx + TW > W) tx = e.clientX - TW - 8;
    if (ty + TH > H) ty = H - TH - 8;
    this._monsterTooltip.style.left = `${tx}px`;
    this._monsterTooltip.style.top  = `${ty}px`;
    this._monsterTooltip.style.display = 'block';
  }

  private _hideMonsterTooltip() {
    if (this._monsterTooltip) {
      this._monsterTooltip.remove();
      this._monsterTooltip = null;
    }
  }

  private onHover(ptr: Phaser.Input.Pointer) {
    if (this.isMoving) { this._hideMonsterTooltip(); return; }
    const pp = this.ptrPos(ptr);

    const { x: gx, y: gy } = this.screenToGrid(pp.x, pp.y);
    this.hoverGfx.clear();
    if (!this.inBounds(gx, gy)) {
      this.input.setDefaultCursor('default');
      return;
    }
    const { x: cx, y: cy } = this.tileCenter(gx, gy);

    const monster       = this.getMonsterAt(gx, gy);
    const hasMonster    = !!monster;
    const hasExit       = !!this.getAnyExit(gx, gy);
    const hasChest      = !!this.getChestAt(gx, gy);
    const hasNPC        = !!this.getNPCAt(gx, gy);
    const hasDoorHere   = this.mapData.dungeonDoor?.x === gx && this.mapData.dungeonDoor?.y === gy;
    const blocked       = this.isBlocked(gx, gy) && !hasMonster && !hasDoorHere;

    if (monster) {
      let combatGroup: MonsterSpawn[];
      if (this.mapData.groupFight) {
        combatGroup = this.mapData.spawns.filter(s => !this.defeatedMonsters.includes(s.id));
      } else if (monster.group) {
        combatGroup = this.mapData.spawns.filter(s => s.group === monster.group && !this.defeatedMonsters.includes(s.id));
      } else {
        combatGroup = [monster];
      }
      this._showMonsterTooltip(combatGroup, ptr.event as MouseEvent);
    } else {
      this._hideMonsterTooltip();
    }

    const color = hasMonster ? 0xef4444
      : hasChest   ? 0xffd700
      : hasNPC     ? 0x60a5fa
      : hasDoorHere? 0xa855f7
      : hasExit    ? 0x38bdf8
      : blocked    ? 0x555566
      : 0xffffff;
    const alpha = blocked ? 0.25 : 0.45;

    this.hoverGfx.lineStyle(1.5, color, alpha);
    this.hoverGfx.beginPath();
    this.hoverGfx.moveTo(cx,                   cy - this._tileH / 2);
    this.hoverGfx.lineTo(cx + this._tileW / 2, cy);
    this.hoverGfx.lineTo(cx,                   cy + this._tileH / 2);
    this.hoverGfx.lineTo(cx - this._tileW / 2, cy);
    this.hoverGfx.closePath();
    this.hoverGfx.strokePath();

    const isInteractable = hasMonster || hasExit || hasChest || hasNPC || hasDoorHere;
    this.input.setDefaultCursor(isInteractable ? 'pointer' : 'default');
  }

  // ── Click / movement ──────────────────────────────────────────────────────

  private handleClick(ptr: Phaser.Input.Pointer) {
    if (this.isMoving || this.isDialogueOpen || this.isChestOpen || this.isBankOpen
      || getSpellUpgradeUI().isOpen() || getShopModal().isOpen()) return;
    const pp = this.ptrPos(ptr);

    const { x: gx, y: gy } = this.screenToGrid(pp.x, pp.y);
    if (!this.inBounds(gx, gy)) return;

    // 0. Case de sortie de map
    const exitTile = this.getAnyExit(gx, gy);
    if (exitTile) {
      if (gx === this.playerX && gy === this.playerY) {
        this.triggerTransition(exitTile);
      } else {
        const path = this.findPath(this.playerX, this.playerY, gx, gy);
        if (path.length >= 2) this.moveAlongPath(path);
      }
      return;
    }

    // 1. Porte de donjon
    const door = this.mapData.dungeonDoor;
    if (door && gx === door.x && gy === door.y) {
      this.tryDungeonDoor(door);
      return;
    }

    // 2. Coffre
    const chest = this.getChestAt(gx, gy);
    if (chest) { this.openChest(chest); return; }

    // 3. PNJ
    const npc = this.getNPCAt(gx, gy);
    if (npc) { this.triggerNPC(npc); return; }

    // 4. Monstre → combat
    const monster = this.getMonsterAt(gx, gy);
    if (monster) {
      if (this.mapData.groupFight) {
        // Map donjon : tous les monstres vivants s'engagent ensemble
        const allAlive = this.mapData.spawns.filter(s => !this.defeatedMonsters.includes(s.id));
        this.triggerCombat(allAlive);
      } else if (monster.group) {
        // Groupe lié : tous les membres vivants du même groupe s'engagent
        const groupAlive = this.mapData.spawns.filter(
          s => s.group === monster.group && !this.defeatedMonsters.includes(s.id)
        );
        this.triggerCombat(groupAlive.length > 0 ? groupAlive : [monster]);
      } else {
        this.triggerCombat([monster]);
      }
      return;
    }

    if (this.isBlocked(gx, gy)) return;
    if (gx === this.playerX && gy === this.playerY) return;

    const path = this.findPath(this.playerX, this.playerY, gx, gy);
    if (path.length < 2) return;
    this.moveAlongPath(path);
  }

  // ── Coffre (modal) ───────────────────────────────────────────────────────

  private openChest(chest: ChestData) {
    const key = `${this.mapData.id}:${chest.id}`;
    // On passe une COPIE des items (pour que le modal puisse les retirer un par un)
    const remainingItems: ChestItem[] = [...chest.items.map(i => ({ ...i }))];

    this.isChestOpen = true;
    let anythingTaken = false;
    getChestModal().open(
      chest,
      remainingItems,
      (item: ChestItem) => {
        anythingTaken = true;

        // ── Consommable spécial : Élixir du Maître → niveau 100 immédiat ──────
        if (item.id === 'xp_scroll_max') {
          const xpMax = xpForLevel(100);
          if (this.playerXP < xpMax) {
            this.playerXP = xpMax;
            if (this.uiXpGoldText?.active) {
              this.uiXpGoldText.setText(`✦ ${this.playerXP} XP  ·  💰 ${this.gold}`);
            }
            this._checkLevelUp();
          }
          remainingItems.splice(remainingItems.findIndex(i => i.id === item.id), 1);
          return; // consommé sur place, ne va pas en inventaire
        }

        // Ajouter l'objet à l'inventaire
        const existing = this.inventory.find(e => e.id === item.id);
        if (existing) existing.qty += item.qty;
        else this.inventory.push({ id: item.id, qty: item.qty });
        // Retirer du coffre (gestion dans ChestModal)
        remainingItems.splice(remainingItems.findIndex(i => i.id === item.id), 1);
      },
      () => {
        // Marquer le coffre comme pillé et le détruire seulement si quelque chose a été pris
        if (anythingTaken) {
          gameState.lootedChests.add(key);
          const cont = this.chestConts.get(chest.id);
          if (cont) {
            this.tweens.add({
              targets: cont, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 300,
              ease: 'Back.easeIn', onComplete: () => { cont.destroy(); this.chestConts.delete(chest.id); },
            });
          }
        }
        this.isChestOpen = false;
      }
    );
  }

  // ── PNJ / Dialogue ───────────────────────────────────────────────────────

  private triggerNPC(npc: NPCData) {
    // ── Cas spécial : Magicien → amélioration de sorts ───────────────────────
    if (npc.id === 'magicien') {
      if (!gameState.npcInteracted.has('magicien')) {
        gameState.npcInteracted.add('magicien');
        this.isDialogueOpen = true;
        getDialogueBox().open(npc.name, npc.firstDialogues ?? ['…'], () => {
          this.isDialogueOpen = false;
          this._openSpellUpgrade();
        });
        return;
      }
      this._openSpellUpgrade();
      return;
    }

    // ── Cas spécial : Banquier → ouvre la banque ─────────────────────────────
    if (npc.id === 'banquier') {
      if (!gameState.npcInteracted.has('banquier')) {
        gameState.npcInteracted.add('banquier');
        this.isDialogueOpen = true;
        getDialogueBox().open(npc.name, npc.firstDialogues ?? ['Bienvenue !'], () => {
          this.isDialogueOpen = false;
          this._openBank();
        });
        return;
      }
      this._openBank();
      return;
    }

    // ── Cas spécial : Marchand → ouvre la boutique ───────────────────────────
    if (npc.id === 'marchand') {
      if (!gameState.npcInteracted.has('marchand')) {
        gameState.npcInteracted.add('marchand');
        this.isDialogueOpen = true;
        getDialogueBox().open(npc.name, npc.firstDialogues ?? ['Bienvenue !'], () => {
          this.isDialogueOpen = false;
          this._openShop();
        });
        return;
      }
      this._openShop();
      return;
    }

    // ── Cas spécial : Professeur Aldren — arbre de quêtes complet ────────────
    if (npc.id === 'prof_aldren') {
      const gs = gameState;

      const giveRewardAndOpen = (xp: number, gold: number, lines: string[]) => {
        this.playerXP += xp;
        this.gold     += gold;
        if (this.uiXpGoldText?.active) {
          this.uiXpGoldText.setText(`✦ ${this.playerXP} XP  ·  💰 ${this.gold}`);
        }
        this._checkLevelUp();
        this.isDialogueOpen = true;
        getDialogueBox().open(npc.name, lines, () => { this.isDialogueOpen = false; });
      };

      // ── Première rencontre ────────────────────────────────────────────────
      if (!gs.npcInteracted.has('prof_aldren')) {
        gs.npcInteracted.add('prof_aldren');
        this.isDialogueOpen = true;
        getDialogueBox().open(npc.name, npc.firstDialogues ?? ['…'], () => { this.isDialogueOpen = false; });
        return;
      }

      // ── Quête 1 : donner récompense (5 monstres vaincus) ─────────────────
      if (gs.questKills >= 5 && !gs.questRewardGiven) {
        gs.questRewardGiven = true;
        giveRewardAndOpen(250, 500, [
          'Excellent travail, Coursier ! Cinq monstres éliminés, comme convenu.',
          'Voici votre récompense : 500 pièces d\'or et 250 XP. Vous l\'avez bien mérité.',
          'J\'ai une autre mission pour vous. Ces rats mutants transportent parfois une Clef de l\'Antre du Razmotek.',
          'Continuez à les éliminer — vous en trouverez une. Revenez me la montrer quand vous l\'aurez.',
        ]);
        return;
      }

      // ── Quête 1 : en cours ────────────────────────────────────────────────
      if (!gs.questRewardGiven) {
        const remaining = Math.max(0, 5 - gs.questKills);
        this.isDialogueOpen = true;
        getDialogueBox().open(npc.name, [
          `Il vous reste ${remaining} monstre${remaining > 1 ? 's' : ''} à éliminer. Courage, Coursier !`,
        ], () => { this.isDialogueOpen = false; });
        return;
      }

      // ── Quête 2 : donner récompense (clef inspectée puis rendue) ─────────────
      if (gs.questRewardGiven && !gs.quest2RewardGiven) {
        const hasKey = this.inventory.some(e => e.id === 'clef_antre_razmotek' && e.qty > 0);
        if (hasKey) {
          gs.quest2RewardGiven = true;
          // Le professeur inspecte la clef mais la rend au joueur — pas de consommation
          giveRewardAndOpen(500, 750, [
            'Ah… la Clef de l\'Antre du Razmotek. Je savais que les rats en portaient une.',
            'Bien. Voici votre récompense : 750 pièces d\'or et 500 XP.',
            'Gardez bien cette clef — vous en aurez besoin pour entrer dans le donjon.',
            'Une dernière épreuve vous attend. Le Razmotek terrorise nos fondations depuis trop longtemps.',
            'Pénétrez dans son antre aux Ruines de l\'Est et éliminez-le. Prouvez que vous êtes prêt.',
          ]);
          return;
        }
        // Clef pas encore trouvée
        this.isDialogueOpen = true;
        getDialogueBox().open(npc.name, [
          'Avez-vous trouvé la Clef de l\'Antre du Razmotek ?',
          'Les rats mutants qui rôdent dans la ville en transportent parfois. Continuez à les éliminer.',
        ], () => { this.isDialogueOpen = false; });
        return;
      }

      // ── Quête 3 : donner récompense finale (Razmotek vaincu) ─────────────
      if (gs.quest2RewardGiven && !gs.quest3RewardGiven && gs.quest3Done) {
        gs.quest3RewardGiven = true;
        giveRewardAndOpen(1000, 1000, [
          '...Je n\'en crois pas mes yeux. Vous avez réellement vaincu le Razmotek.',
          'Voici ce que je vous dois : 1 000 pièces d\'or et 1 000 XP. C\'est amplement mérité.',
          'Vous avez surpassé toutes mes espérances, Coursier.',
          'Le monde de dehors est vaste, dangereux, et plein de mystères que nul n\'a encore percés.',
          'Ici ne vous retient plus rien. Allez, aventurier — le monde vous attend.',
        ]);
        return;
      }

      // ── Quête 3 : en cours (Razmotek pas encore vaincu) ──────────────────
      if (gs.quest2RewardGiven && !gs.quest3RewardGiven) {
        this.isDialogueOpen = true;
        getDialogueBox().open(npc.name, [
          'Le Razmotek attend dans son antre, aux Ruines de l\'Est.',
          'Vous aurez besoin d\'une Clef de l\'Antre pour y accéder. Bonne chasse.',
        ], () => { this.isDialogueOpen = false; });
        return;
      }

      // ── Quête 4 : premier contact — envoyer vers le Chasseur ─────────────
      if (!gs.quest4Started) {
        gs.quest4Started = true;
        this.isDialogueOpen = true;
        getDialogueBox().open(npc.name, [
          'Tu as prouvé ta valeur au-delà de mes espérances. Le Razmotek est tombé.',
          'Il est temps pour toi de quitter la ville. Le monde extérieur t\'attend.',
          'Avant de partir, laisse-moi te parler d\'un homme — un chasseur solitaire.',
          'Il vit reclus dans la Clairière du Chasseur, au nord de la Forêt Nord-Ouest.',
          'On l\'appelle Roan. Ce qu\'il fait là-haut, je l\'ignore... Mais il connaît ces terres mieux que quiconque.',
          'Rends-lui visite. Il aura peut-être besoin d\'un aventurier de ta trempe.',
        ], () => { this.isDialogueOpen = false; });
        return;
      }

      // ── Quête 4 : rappel ──────────────────────────────────────────────────
      this.isDialogueOpen = true;
      getDialogueBox().open(npc.name, [
        'Roan t\'attend dans la Clairière du Chasseur, au nord de la Forêt Nord-Ouest.',
        'Pars quand tu te sens prêt. Le monde extérieur ne t\'attend pas indéfiniment.',
      ], () => { this.isDialogueOpen = false; });
      return;
    }

    const alreadyMet = gameState.npcInteracted.has(npc.id);
    let lines: string[];

    if (!alreadyMet) {
      lines = npc.firstDialogues ?? ['…'];
      gameState.npcInteracted.add(npc.id);
    } else {
      // Choisir une ligne aléatoire parmi les répétitions
      const repeats = npc.repeatDialogues ?? [];
      lines = repeats.length > 0
        ? [repeats[Math.floor(Math.random() * repeats.length)]]
        : ['…'];
    }

    this.isDialogueOpen = true;
    getDialogueBox().open(npc.name, lines, () => {
      this.isDialogueOpen = false;
    });
  }

  // ── Banque ────────────────────────────────────────────────────────────────

  private _openBank(): void {
    this.isBankOpen = true;
    getBankModal().open(this.inventory, (updated) => {
      this.inventory = updated;
      this.isBankOpen = false;
    });
  }

  // ── Boutique ──────────────────────────────────────────────────────────────

  private _openShop(): void {
    getShopModal().open(this.inventory, this.gold, (updatedInv, updatedGold) => {
      this.inventory = updatedInv;
      this.gold      = updatedGold;
      if (this.uiXpGoldText?.active) {
        this.uiXpGoldText.setText(`✦ ${this.playerXP} XP  ·  💰 ${this.gold}`);
      }
    });
  }

  private _openSpellUpgrade(): void {
    const ui = getSpellUpgradeUI();
    ui.open(ALL_SPELLS, this.gold, (newGold) => {
      this.gold = newGold;
      if (this.uiXpGoldText?.active) {
        this.uiXpGoldText.setText(`✦ ${this.playerXP} XP  ·  💰 ${this.gold}`);
      }
    });
  }


  // ── Porte de donjon ──────────────────────────────────────────────────────

  private tryDungeonDoor(door: DungeonDoor) {
    if (!door) return;
    const hasKey = this.inventory.some(e => e.id === door.requiredItem && e.qty > 0);
    if (hasKey) {
      // Consommer la clef
      const keyEntry = this.inventory.find(e => e.id === door.requiredItem)!;
      keyEntry.qty--;
      if (keyEntry.qty <= 0) {
        this.inventory = this.inventory.filter(e => e.id !== door.requiredItem);
      }
      this.triggerTransition({
        targetMap: door.targetMap,
        targetX: door.targetX,
        targetY: door.targetY,
      });
    } else {
      this.showMessage(`Il vous faut ${door.requiredItemName} pour entrer ici.`);
    }
  }

  // ── Message flottant ─────────────────────────────────────────────────────

  private showMessage(text: string) {
    if (this.messageText) { this.messageText.destroy(); this.messageText = null; }
    const W = this.scale.width, H = this.scale.height;
    const msg = this.add.text(W / 2, H / 2 - 60, text, {
      fontSize: '14px', color: '#fde047', fontStyle: 'bold',
      backgroundColor: '#0e132080', padding: { x: 16, y: 8 },
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20000);
    this.messageText = msg;
    this.tweens.add({
      targets: msg, alpha: 0, duration: 2000, delay: 1200,
      onComplete: () => { msg.destroy(); this.messageText = null; },
    });
  }

  // ── Pathfinding ───────────────────────────────────────────────────────────

  private findPath(sx: number, sy: number, tx: number, ty: number): [number, number][] {
    const visited = new Set<string>();
    const prev    = new Map<string, string>();
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
      for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]] as [number,number][]) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;
        if (this.isBlocked(nx, ny)) continue;
        if (this.getMonsterAt(nx, ny)) continue;
        const npcHere = this.getNPCAt(nx, ny);
        if (npcHere && !(nx === tx && ny === ty)) continue; // bloque chemin (pas destination)
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
        // Vérifier sortie ou porte de donjon à la fin du déplacement
        const door = this.mapData.dungeonDoor;
        if (door && this.playerX === door.x && this.playerY === door.y) {
          this.tryDungeonDoor(door);
          return;
        }
        const exit = this.getAnyExit(this.playerX, this.playerY);
        if (exit) { this.triggerTransition(exit); return; }
        return; // fin de chemin normale
      }
      const [nx, ny] = path[i++];
      this.playerX = nx;
      this.playerY = ny;
      const { x: cx, y: cy } = this.tileCenter(nx, ny);
      this.playerCont.setDepth(1000 + cy);
      this.tweens.add({
        targets: this.playerCont,
        x: cx, y: cy - 14,
        duration: 140,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          // Vérifier porte de donjon à chaque case
          const door = this.mapData.dungeonDoor;
          if (door && nx === door.x && ny === door.y) {
            this.isMoving = false;
            this.tweens.add({ targets: this.playerCont, y: this.playerCont.y - 4, yoyo: true, repeat: -1, duration: 950 });
            this.tryDungeonDoor(door);
            return;
          }
          // Vérifier sortie normale
          const exit = this.getAnyExit(nx, ny);
          if (exit) { this.isMoving = false; this.triggerTransition(exit); return; }
          step();
        },
      });
    };
    step();
  }

  // ── Transitions ───────────────────────────────────────────────────────────

  private triggerTransition(exit: { targetMap: string; targetX: number; targetY: number }) {
    if (this.isExitLocked(exit)) {
      this.showMessage('⚔️ Vaincez le Razmotek pour quitter Hélia.');
      return;
    }
    // Vérifier si les sorties sont bloquées
    if (!this.roomCleared()) {
      this.showMessage('Vaincre les ennemis pour continuer !');
      return;
    }
    this.isMoving = true;
    this.input.setDefaultCursor('default');
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.restart({
        mapId:            exit.targetMap,
        playerX:          exit.targetX,
        playerY:          exit.targetY,
        xp:               this.playerXP,
        gold:             this.gold,
        playerStats:      this.playerStats,
        equipment:        this.equipment,
        inventory:        this.inventory,
        defeatedMonsters: this.defeatedMonsters,
      });
    });
  }

  private triggerCombat(monsters: MonsterSpawn[]) {
    if (monsters.length === 0) return;
    this._hideMonsterTooltip();
    this.isMoving = true;
    this.input.setDefaultCursor('default');
    const hasBoss = monsters.some(m => m.isBoss);

    // Animer disparition du premier monstre cliqué
    const firstCont = this.monsterConts.get(monsters[0].id);
    const launch = () => {
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.time.delayedCall(300, () => {
        this.scene.start('PreloadScene', {
          fromWorld:        true,
          xp:               this.playerXP,
          gold:             this.gold,
          playerStats:      this.playerStats,
          equipment:        this.equipment,
          inventory:        this.inventory,
          mapId:            this.mapData.id,
          playerX:          this.playerX,
          playerY:          this.playerY,
          defeatedMonsters: this.defeatedMonsters,
          monsters:         monsters,
          isDungeonBoss:    hasBoss,
        });
      });
    };
    if (firstCont) {
      this.tweens.add({
        targets: firstCont, scaleX: 1.3, scaleY: 1.3, alpha: 0,
        duration: 280, ease: 'Back.easeIn', onComplete: launch,
      });
    } else {
      launch();
    }
  }
}
