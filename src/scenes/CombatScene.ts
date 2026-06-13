import Phaser from 'phaser';
import { Mode, Unit, GridPos } from '../types';
import { ISpell } from '../data/spells/ISpell';
import { LineOfSightService } from '../combat/LineOfSightService';
import { TILE_W, TILE_H, GRID_W, GRID_H, gridToIso, isoToGrid, manhattan, inBounds } from '../game/iso';
import { bfsReachable, reconstructPath } from '../game/pathfinding';
import { SPELLS } from '../game/spells';
import { getSpellsForLevel } from '../data/spells/spellsData';
import { getUpgradedSpell } from '../data/spells/spellUpgrades';
import { ELEMENT_COLORS } from '../config/spells.config';
import { SpellManager } from '../systems/SpellManager';
import { HUD } from '../ui/hud';
import { PlayerStats, emptyStats, maxHp, maxPa, maxPm, maxMagic, effectiveResistance, getLevel, finalDamagePercent } from '../game/stats';
import { PlayerEquipment, InventoryEntry, emptyEquipment, getEquipBonuses, getMeleeSpell, ITEMS, RESOURCE_CATALOG } from '../game/items';
import { MonsterSpawn } from '../maps/MapLoader';
import { gameState } from '../game/gameState';

// Positions de départ des ennemis dans l'arène de combat (grille 15×15)
const ENEMY_SPAWN_POSITIONS: GridPos[] = [
  { x: 10, y: 7 },   // position principale
  { x: 9,  y: 5 },   // 2e ennemi
  { x: 10, y: 10 },  // 3e ennemi
  { x: 12, y: 7 },   // 4e ennemi (boss)
];

// Position du boss quand il y a plusieurs ennemis
const BOSS_POSITION: GridPos = { x: 11, y: 7 };

interface TileGfx {
  poly: Phaser.GameObjects.Polygon;
  gx: number;
  gy: number;
}

export class CombatScene extends Phaser.Scene {
  private _originX = 0;
  private _originY = 120;
  private get originX() { return this._originX; }
  private get originY() { return this._originY; }
  private tiles: TileGfx[] = [];
  private tileMap = new Map<string, TileGfx>();
  private units: Unit[] = [];
  private turnOrder: Unit[] = [];
  private turnIndex = 0;
  private turnNumber = 1;
  private mode: Mode = 'idle';
  private activeSpell: ISpell | null = null;
  /** Tours de recharge restants par sort (spellId → tours) */
  private spellCooldowns = new Map<string, number>();
  /** Nombre de fois qu'un sort a été lancé ce tour (spellId → count) */
  private spellCastsThisTurn = new Map<string, number>();
  private spellManager = SpellManager.getInstance();
  private hud!: HUD;
  private highlightLayer!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private unitLayer!: Phaser.GameObjects.Container;
  private reachable: Map<string, { dist: number; prev: string | null }> = new Map();
  private busy = false;
  private playerXP = 0;
  private damageDealt = 0;
  private turnsUsed = 0;
  private eveilMineurTurns = 0;
  private mapId = 'map_c';
  private returnX = 6;
  private returnY = 4;
  private defeatedMonsters: string[] = [];
  private monsterIds: string[] = [];
  private playerStats: PlayerStats = emptyStats();
  private playerEquipment: PlayerEquipment = emptyEquipment();
  private playerInventory: InventoryEntry[] = [];
  private playerFluide = 0;
  private playerMaxFluide = 10;
  private monsters: MonsterSpawn[] = [];
  private isDungeonBoss = false;
  private playerGold = 0;

  constructor() {
    super('CombatScene');
  }

  init(data: {
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
    this.playerXP         = data?.xp ?? 0;
    this.playerStats      = data?.playerStats ? { ...data.playerStats } : emptyStats();
    this.playerEquipment  = data?.equipment ? { ...data.equipment } : emptyEquipment();
    this.playerInventory  = data?.inventory ? data.inventory.map(e => ({ ...e })) : [];
    const eb              = getEquipBonuses(this.playerEquipment);
    this.playerMaxFluide  = maxMagic(this.playerStats) + eb.fluide;
    this.playerFluide     = this.playerMaxFluide;
    this.mapId            = data?.mapId ?? 'map_c';
    this.returnX          = data?.playerX ?? 6;
    this.returnY          = data?.playerY ?? 4;
    this.defeatedMonsters = data?.defeatedMonsters ? [...data.defeatedMonsters] : [];
    this.monsters         = data?.monsters ? [...data.monsters] : [];
    this.monsterIds       = this.monsters.map(m => m.id);
    this.isDungeonBoss    = data?.isDungeonBoss ?? false;
    this.playerGold       = data?.gold ?? 0;
    this.damageDealt      = 0;
    this.turnsUsed        = 0;
    this.turnNumber       = 1;
    this.turnIndex        = 0;
    this.turnOrder        = [];
    this.busy             = false;
    this.mode             = 'idle';
    this.activeSpell      = null;
    this.hoverPoly        = null;
    this.hoverAoePolys    = [];
    this._hoverLosText    = null;
    this.spellCooldowns   = new Map();
    this.spellCastsThisTurn = new Map();
  }

  create(data?: { portraits?: Record<string, string> }) {
    this.cameras.main.setBackgroundColor('#0e1320');

    this.drawGrid();

    this.highlightLayer = this.add.container(0, 0).setDepth(500);
    this.fxLayer        = this.add.container(0, 0).setDepth(5000);
    this.unitLayer      = this.add.container(0, 0).setDepth(1000);

    // ── Créer l'archer (joueur) ──
    const eb = getEquipBonuses(this.playerEquipment);
    const archer: Unit = this.makeUnit(
      'hero', 'Archer', 'player',
      { x: 4, y: 7 },
      maxHp(this.playerStats, getLevel(this.playerXP)) + eb.hp,
      maxPa(this.playerStats) + eb.pa,
      maxPm(this.playerStats) + eb.pm,
      12
    );
    const playerLevel = getLevel(this.playerXP);
    const baseSpells = getSpellsForLevel(playerLevel);
    const upgradedSpells = baseSpells.map(s => {
      const lvl = gameState.spellUpgrades.get(s.id) ?? 0;
      return lvl > 0 ? getUpgradedSpell(s, lvl) : s;
    });
    archer.spells = [getMeleeSpell(this.playerEquipment), ...upgradedSpells];

    // ── Créer les ennemis ──
    const enemies: Unit[] = this.createEnemyUnits();

    this.units = [archer, ...enemies];

    for (const u of this.units) this.spawnUnitSprite(u);
    this.depthSort();

    // Tri par initiative décroissante
    this.turnOrder = [...this.units].sort((a, b) => b.initiative - a.initiative);

    // HUD
    this.hud = new HUD(archer.spells);
    this.hud.onSpellClick = (sp) => this.selectSpell(sp);
    this.hud.onEndTurn    = () => this.endTurn();
    this.hud.onFlee       = () => this.confirmFlee();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    this.scale.on('resize', () => this.redrawAll());

    this.hud.show();
    if (data?.portraits) this.hud.setPortraits(data.portraits);

    this.startTurn();
    if (this.isDungeonBoss) {
      this.hud.log('⚠️ Razmotek approche…', 'sys');
    } else {
      this.hud.log('Combat engagé. À toi de jouer !', 'sys');
    }
  }

  // ───── Création des ennemis ─────

  private createEnemyUnits(): Unit[] {
    if (this.monsters.length === 0) {
      // Fallback : ennemi par défaut
      const m = this.makeUnit('mob', 'Ennemi', 'enemy', { x: 10, y: 7 }, 50, 6, 3, 8);
      m.spells = [SPELLS.arrow];
      return [m];
    }

    const hasBoss = this.monsters.some(m => m.isBoss);
    const units: Unit[] = [];

    // Trier : boss à la fin pour lui donner la meilleure position
    const sorted = [...this.monsters].sort((a, _b) => a.isBoss ? 1 : -1);

    sorted.forEach((spawn, idx) => {
      let pos: GridPos;
      if (spawn.isBoss && hasBoss) {
        // Boss au centre (si plusieurs ennemis, sinon position par défaut)
        pos = this.monsters.length > 1 ? BOSS_POSITION : ENEMY_SPAWN_POSITIONS[0];
      } else {
        pos = ENEMY_SPAWN_POSITIONS[idx] ?? { x: 9 + idx, y: 7 };
      }

      const pa  = spawn.pa  ?? 6;
      const pm  = spawn.pm  ?? 3;
      const ini = spawn.initiative ?? (spawn.isBoss ? 10 : 8);
      const hp  = spawn.hp;

      const u = this.makeUnit(spawn.id, spawn.name, 'enemy', pos, hp, pa, pm, ini);
      u.isBoss     = spawn.isBoss ?? false;
      u.behavior   = spawn.behavior ?? 'range';
      u.baseDamage = spawn.damage ?? 12;
      // Résistances élémentaires en % (défaut 0)
      u.resistances = {
        feu:   spawn.resistances?.feu   ?? 0,
        air:   spawn.resistances?.air   ?? 0,
        eau:   spawn.resistances?.eau   ?? 0,
        terre: spawn.resistances?.terre ?? 0,
      };

      if (spawn.isBoss) {
        u.spells = [this.makeBossMeleeSpell(spawn.damage ?? 30)];
      } else if (spawn.behavior === 'spectral') {
        u.spells = [SPELLS.spectral_strike];
      } else if (spawn.behavior === 'fungal') {
        u.spells = [SPELLS.spore_cloud];
      } else if (spawn.behavior === 'charge') {
        u.spells = [SPELLS.charge_attack];
      } else if (spawn.behavior === 'melee') {
        u.spells = [SPELLS.bite];
      } else {
        u.spells = [SPELLS.arrow];
      }

      units.push(u);
    });

    return units;
  }

  private makeBossMeleeSpell(damage: number): ISpell {
    return {
      id: 'boss_melee',
      name: 'Griffes',
      icon: '🦷',
      paCost: 2,
      fluideCost: 0,
      maxRange: 1,
      minRange: 1,
      baseDamage: { min: damage, max: damage },
      element: 'neutre',
      isModifiable: false,
      description: `Attaque de mêlée — ${damage} dégâts.`,
    };
  }

  private makeUnit(id: string, name: string, team: 'player' | 'enemy', pos: GridPos, hp: number, pa: number, pm: number, ini: number): Unit {
    return {
      id, name, team, pos,
      hp, maxHp: hp,
      pa, maxPa: pa,
      pm, maxPm: pm,
      initiative: ini,
      spells: []
    };
  }

  // ───── Grille ─────

  private drawGrid() {
    this._originX = this.sys.canvas.getBoundingClientRect().width / 2 || this.scale.width / 2;
    for (const t of this.tiles) t.poly.destroy();
    this.tiles = [];
    this.tileMap.clear();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const { x: px, y: py } = gridToIso(x, y, this.originX, this.originY);
        const checker = (x + y) % 2 === 0;
        const color = checker ? 0x2b3247 : 0x232a3c;
        const poly = this.add.polygon(px, py, [
          0, -TILE_H / 2,
          TILE_W / 2, 0,
          0, TILE_H / 2,
          -TILE_W / 2, 0
        ], color, 1);
        poly.setOrigin(0, 0);
        poly.setStrokeStyle(1, 0x161b28, 1);
        poly.setDepth(py);
        const tg: TileGfx = { poly, gx: x, gy: y };
        this.tiles.push(tg);
        this.tileMap.set(`${x},${y}`, tg);
      }
    }
  }

  private redrawAll() {
    this.drawGrid();
    for (const u of this.units) {
      if (!u.sprite) continue;
      const { x, y } = gridToIso(u.pos.x, u.pos.y, this.originX, this.originY);
      u.sprite.setPosition(x, y - 14);
    }
    this.depthSort();
    this.clearHighlights();
    if (this.mode === 'move') this.showMoveRange();
    if (this.mode === 'cast' && this.activeSpell) this.showSpellRange(this.activeSpell);
  }

  // ───── Sprites ─────

  private spawnUnitSprite(u: Unit) {
    const { x, y } = gridToIso(u.pos.x, u.pos.y, this.originX, this.originY);
    const c = this.add.container(x, y - 14);
    const shadow = this.add.ellipse(0, 18, 36, 14, 0x000000, 0.4);

    const body = this.add.graphics();

    if (u.isBoss) {
      // ── Sprite boss : grand rectangle rouge sombre ──
      body.fillStyle(0x7f1d1d, 1);
      body.fillRoundedRect(-18, 0, 36, 24, 5);
      body.fillStyle(0xb91c1c, 1);
      body.fillCircle(0, -12, 15);
      body.lineStyle(2, 0x000000, 0.4);
      body.strokeCircle(0, -12, 15);
      body.strokeRoundedRect(-18, 0, 36, 24, 5);

      const label = this.add.text(0, -13, '👹', { fontSize: '18px' }).setOrigin(0.5);
      const bossTag = this.add.text(0, -34, 'BOSS', {
        fontSize: '9px', color: '#fca5a5', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);

      const hpBg  = this.add.rectangle(0, -44, 44, 6, 0x000000, 0.7).setOrigin(0.5);
      const hpBar = this.add.rectangle(-22, -44, 44, 6, 0xef4444, 1).setOrigin(0, 0.5);
      hpBar.setData('hpbar', true);
      hpBg.setData('hpbg', true);
      c.add([shadow, body, label, bossTag, hpBg, hpBar]);
    } else {
      // ── Sprite standard ──
      const color  = u.team === 'player' ? 0x38bdf8 : 0xef4444;
      const accent = u.team === 'player' ? 0x0ea5e9 : 0xb91c1c;
      body.fillStyle(accent, 1);
      body.fillRoundedRect(-12, 0, 24, 18, 4);
      body.fillStyle(color, 1);
      body.fillCircle(0, -8, 10);
      body.lineStyle(2, 0x000000, 0.35);
      body.strokeCircle(0, -8, 10);
      body.strokeRoundedRect(-12, 0, 24, 18, 4);

      const label = this.add.text(0, -10, u.team === 'player' ? '🏹' : '👹', { fontSize: '14px' }).setOrigin(0.5);

      const hpBg  = this.add.rectangle(0, -28, 36, 5, 0x000000, 0.6).setOrigin(0.5);
      const hpBar = this.add.rectangle(-18, -28, 36, 5, 0x22c55e, 1).setOrigin(0, 0.5);
      hpBar.setData('hpbar', true);
      hpBg.setData('hpbg', true);
      c.add([shadow, body, label, hpBg, hpBar]);
    }

    c.setSize(40, 40);
    u.sprite = c;
    this.unitLayer.add(c);
  }

  private updateHpBar(u: Unit) {
    if (!u.sprite) return;
    const bar = u.sprite.list.find((o) => (o as any).getData && (o as any).getData('hpbar')) as Phaser.GameObjects.Rectangle | undefined;
    if (!bar) return;
    const ratio = Math.max(0, u.hp / u.maxHp);
    const maxW  = u.isBoss ? 44 : 36;
    const offX  = u.isBoss ? -22 : -18;
    bar.width = maxW * ratio;
    bar.x = offX;
    const color = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xeab308 : 0xef4444;
    bar.fillColor = color;
  }

  private depthSort() {
    for (const u of this.units) {
      if (!u.sprite) continue;
      const { y } = gridToIso(u.pos.x, u.pos.y, this.originX, this.originY);
      u.sprite.setDepth(y + 1000);
    }
  }

  // ───── Tour ─────

  private currentUnit(): Unit {
    return this.turnOrder[this.turnIndex];
  }

  private unitAt(x: number, y: number): Unit | undefined {
    return this.units.find((u) => u.hp > 0 && u.pos.x === x && u.pos.y === y);
  }

  private startTurn() {
    const u = this.currentUnit();
    // Applique les drains accumulés (PA et PM), puis les réinitialise
    u.pa = Math.max(0, u.maxPa - (u.drainedPa ?? 0));
    u.drainedPa = 0;
    u.pm = Math.max(0, u.maxPm - (u.drainedPm ?? 0));
    u.drainedPm = 0;
    this.activeSpell = null;
    this.mode = 'idle';
    this.clearHighlights();
    this.hud.setActiveSpell(null);
    this.hud.setTurn(this.turnNumber, u.name, u.team);
    this.hud.update(this.playerUnit());
    this.hud.updateFluide(this.playerFluide, this.playerMaxFluide);

    if (u.team === 'player') {
      // Réinitialise les lancers par tour au début du tour joueur
      this.spellCastsThisTurn = new Map();
      this.hud.updateSpellCooldowns(this.spellCooldowns, this.spellCastsThisTurn);
      this.mode = 'move';
      this.showMoveRange();
    } else {
      this.time.delayedCall(500, () => this.runEnemyAI());
    }
  }

  endTurn() {
    if (this.busy) return;
    if (this.currentUnit().team !== 'player') return;
    this.advanceTurn();
  }

  private advanceTurn() {
    this.clearHighlights();

    // ── Fin du tour joueur ──
    if (this.currentUnit().team === 'player') {
      this.regenFluide();
      // Décrémente les cooldowns
      for (const [id, remaining] of this.spellCooldowns) {
        if (remaining <= 1) this.spellCooldowns.delete(id);
        else this.spellCooldowns.set(id, remaining - 1);
      }
      // Décrémente Éveil Mineur
      if (this.eveilMineurTurns > 0) {
        this.eveilMineurTurns--;
        if (this.eveilMineurTurns === 0) this.hud.log('Éveil Mineur dissipé.', 'sys');
      }
    }

    this.turnsUsed++;
    this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
    if (this.turnIndex === 0) this.turnNumber++;
    if (this.checkWinLose()) return;
    if (this.currentUnit().hp <= 0) {
      this.advanceTurn();
      return;
    }
    this.startTurn();
  }

  // ── +1 PF à la fin du tour joueur ──
  private regenFluide() {
    if (this.playerFluide >= this.playerMaxFluide) return;
    this.playerFluide = Math.min(this.playerMaxFluide, this.playerFluide + 1);
    this.hud.updateFluide(this.playerFluide, this.playerMaxFluide);

    const player = this.playerUnit();
    if (player.sprite) {
      const t = this.add.text(player.sprite.x, player.sprite.y - 42, '+1 💧', {
        fontSize: '15px', color: '#a855f7', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(9000);
      this.tweens.add({
        targets: t, y: t.y - 28, alpha: 0,
        duration: 900, ease: 'Quad.easeOut',
        onComplete: () => t.destroy(),
      });
    }
  }

  private playerUnit(): Unit {
    return this.units.find((u) => u.team === 'player')!;
  }

  // ───── Highlights ─────
  private clearHighlights() {
    this.highlightLayer.removeAll(true);
    this.hoverPoly = null;
    this.hoverAoePolys = [];
    if (this._hoverLosText) { this._hoverLosText.destroy(); this._hoverLosText = null; }
  }

  /**
   * Construit le callback "obstacle LDV" pour un lanceur donné.
   * Toute unité vivante (sauf le lanceur lui-même) bloque la ligne de vue.
   * Note : la cellule cible est automatiquement exclue par l'algorithme
   * (les cellules FROM et TO ne sont jamais dans les intermédiaires).
   */
  private _losIsBlocker(casterPos: GridPos): (x: number, y: number) => boolean {
    return (x: number, y: number): boolean => {
      // Le lanceur ne bloque pas sa propre LDV
      if (x === casterPos.x && y === casterPos.y) return false;
      // Toute unité vivante est opaque
      return this.units.some(u => u.hp > 0 && u.pos.x === x && u.pos.y === y);
    };
  }

  private highlightTile(x: number, y: number, color: number, alpha = 0.45) {
    const { x: px, y: py } = gridToIso(x, y, this.originX, this.originY);
    const poly = this.add.polygon(px, py, [
      0, -TILE_H / 2,
      TILE_W / 2, 0,
      0, TILE_H / 2,
      -TILE_W / 2, 0
    ], color, alpha);
    poly.setOrigin(0, 0);
    poly.setDepth(py - 1);
    this.highlightLayer.add(poly);
    return poly;
  }

  private showMoveRange() {
    const u = this.currentUnit();
    const blocked = (x: number, y: number) => !!this.units.find((o) => o.hp > 0 && o !== u && o.pos.x === x && o.pos.y === y);
    this.reachable = bfsReachable(u.pos, u.pm, blocked);
    this.clearHighlights();
    for (const [k, v] of this.reachable) {
      if (v.dist === 0) continue;
      const [xs, ys] = k.split(',');
      this.highlightTile(+xs, +ys, 0x22c55e, 0.32);
    }
  }

  private effectiveRange(spell: ISpell): number {
    if (!spell.isModifiable) return spell.maxRange;
    const eb = getEquipBonuses(this.playerEquipment);
    return spell.maxRange + this.playerStats.portee + eb.portee;
  }

  private showSpellRange(spell: ISpell) {
    const u = this.currentUnit();
    const range = this.effectiveRange(spell);
    this.clearHighlights();

    // Prépare le callback d'obstacle LDV une seule fois (pas à chaque cellule)
    const losBlocker = this._losIsBlocker(u.pos);

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const d = manhattan(u.pos, { x, y });
        if (d > range) continue;
        if (spell.minRange && d < spell.minRange) continue;
        if (d === 0) continue;
        // Téléportation : seulement les cases libres
        if (spell.isTeleport && this.unitAt(x, y)) continue;

        // ── Vérification de la ligne de vue ────────────────────────────────
        // Les sorts avec ignoresLineOfSight n'ont pas besoin de LDV dégagée.
        if (!spell.ignoresLineOfSight) {
          if (!LineOfSightService.hasLineOfSight(u.pos, { x, y }, losBlocker)) continue;
        }

        this.highlightTile(x, y, spell.isTeleport ? 0xa855f7 : 0x38bdf8, 0.35);
      }
    }
  }

  // ───── Tooltip unité ──────────────────────────────────────────────────────
  private _tooltip: HTMLDivElement | null = null;

  private _showUnitTooltip(unit: Unit, mx: number, my: number): void {
    this._hideUnitTooltip();

    const ELEM_META: { key: string; icon: string; label: string }[] = [
      { key: 'feu',    icon: '🔥', label: 'Feu'    },
      { key: 'air',   icon: '💨', label: 'Air'   },
      { key: 'eau',   icon: '💧', label: 'Eau'   },
      { key: 'terre', icon: '🌍', label: 'Terre' },
    ];

    const hpRatio = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) : 0;
    const hpColor = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';

    const resistRows = ELEM_META.map(({ key, icon, label }) => {
      const val = (unit.resistances as Record<string, number> | undefined)?.[key] ?? 0;
      const color = val > 0 ? '#4ade80' : val < 0 ? '#f87171' : '#64748b';
      const sign  = val > 0 ? '+' : '';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:2px 0;">
          <span style="font-size:11px;color:#94a3b8;">${icon} ${label}</span>
          <span style="font-size:11px;font-weight:700;color:${color}">${sign}${val}%</span>
        </div>`;
    }).join('');

    const teamLabel = unit.team === 'player' ? 'JOUEUR' : (unit.isBoss ? 'BOSS' : 'ENNEMI');
    const teamColor = unit.team === 'player' ? '#38bdf8' : (unit.isBoss ? '#f87171' : '#fca5a5');

    const tip = document.createElement('div');
    tip.style.cssText = [
      'position:fixed;z-index:99999;pointer-events:none;',
      'background:#0d1117;border:1px solid #2a3448;border-radius:10px;',
      'padding:10px 14px;min-width:180px;max-width:220px;',
      'box-shadow:0 8px 32px rgba(0,0,0,0.7);font-family:sans-serif;',
    ].join('');

    tip.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:800;color:#e2e8f0">${unit.name}</span>
        <span style="font-size:9px;font-weight:700;color:${teamColor};background:${teamColor}22;
          border:1px solid ${teamColor}55;border-radius:4px;padding:1px 5px;">${teamLabel}</span>
      </div>
      <div style="margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-size:10px;color:#64748b;font-weight:600;">❤️ PV</span>
          <span style="font-size:10px;color:#e2e8f0;font-weight:700;">${unit.hp} / ${unit.maxHp}</span>
        </div>
        <div style="background:#1e293b;border-radius:3px;height:5px;overflow:hidden;">
          <div style="width:${hpRatio * 100}%;height:100%;background:${hpColor};border-radius:3px;transition:width 0.2s;"></div>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:8px;">
        <div style="font-size:10px;color:#64748b;">⚡ PA <span style="color:#fbbf24;font-weight:700;">${unit.pa}/${unit.maxPa}</span></div>
        <div style="font-size:10px;color:#64748b;">🦶 PM <span style="color:#818cf8;font-weight:700;">${unit.pm}/${unit.maxPm}</span></div>
      </div>
      <div style="border-top:1px solid #1e293b;padding-top:6px;">
        <div style="font-size:9px;color:#475569;font-weight:700;margin-bottom:4px;letter-spacing:0.5px;">RÉSISTANCES</div>
        ${resistRows}
      </div>
    `;

    // Positionnement : décalé par rapport au curseur
    const tipW = 220, tipH = 220;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = mx + 16;
    let top  = my - 20;
    if (left + tipW > vw - 8) left = mx - tipW - 16;
    if (top + tipH > vh - 8) top = vh - tipH - 8;
    if (top < 8) top = 8;
    tip.style.left = `${left}px`;
    tip.style.top  = `${top}px`;

    document.body.appendChild(tip);
    this._tooltip = tip;
  }

  private _hideUnitTooltip(): void {
    if (this._tooltip) { this._tooltip.remove(); this._tooltip = null; }
  }

  private _moveTooltip(mx: number, my: number): void {
    if (!this._tooltip) return;
    const tipW = 220, tipH = 220;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = mx + 16;
    let top  = my - 20;
    if (left + tipW > vw - 8) left = mx - tipW - 16;
    if (top + tipH > vh - 8) top = vh - tipH - 8;
    if (top < 8) top = 8;
    this._tooltip.style.left = `${left}px`;
    this._tooltip.style.top  = `${top}px`;
  }

  // ───── Input ─────
  private hoverPoly: Phaser.GameObjects.Polygon | null = null;
  private hoverAoePolys: Phaser.GameObjects.Polygon[] = [];
  /**
   * Texte flottant "🚫 LDV bloquée" affiché au survol d'une cellule hors LDV.
   * Détruit à chaque mouvement de souris pour être recréé à la bonne position.
   */
  private _hoverLosText: Phaser.GameObjects.Text | null = null;

  /** Convertit un PointerEvent en coordonnées jeu via getBoundingClientRect,
   *  sans passer par le système de scaling Phaser (évite les décalages DPR). */
  private ptrPos(p: Phaser.Input.Pointer): { x: number; y: number } {
    const canvas = this.sys.canvas;
    const rect   = canvas.getBoundingClientRect();
    const e      = p.event as PointerEvent;
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    if (this.busy) return;
    if (this.currentUnit().team !== 'player') return;

    if (this.hoverPoly) { this.hoverPoly.destroy(); this.hoverPoly = null; }
    for (const ap of this.hoverAoePolys) ap.destroy();
    this.hoverAoePolys = [];
    // Nettoyer le texte LDV du survol précédent
    if (this._hoverLosText) { this._hoverLosText.destroy(); this._hoverLosText = null; }

    const pp = this.ptrPos(p);
    const { x, y } = isoToGrid(pp.x, pp.y, this.originX, this.originY);

    // ── Tooltip au survol d'une unité ──────────────────────────────────────
    const e = p.event as PointerEvent;
    const hoveredUnit = inBounds(x, y) ? this.unitAt(x, y) : undefined;
    if (hoveredUnit) {
      this._showUnitTooltip(hoveredUnit, e.clientX, e.clientY);
    } else {
      this._hideUnitTooltip();
    }

    if (!inBounds(x, y)) return;

    if (this.mode === 'move') {
      if (!this.reachable.has(`${x},${y}`)) return;
      this.hoverPoly = this.highlightTile(x, y, 0xfbbf24, 0.55);
    } else if (this.mode === 'cast' && this.activeSpell) {
      const u = this.currentUnit();
      const d = manhattan(u.pos, { x, y });
      if (d > this.effectiveRange(this.activeSpell)) return;
      if (this.activeSpell.minRange && d < this.activeSpell.minRange) return;

      // ── Vérification LDV au survol ────────────────────────────────────────
      // Si la LDV est bloquée : feedback visuel rouge + texte "LDV bloquée"
      if (!this.activeSpell.ignoresLineOfSight) {
        const losBlocker = this._losIsBlocker(u.pos);
        const hasLOS = LineOfSightService.hasLineOfSight(u.pos, { x, y }, losBlocker);
        if (!hasLOS) {
          // Teinte rouge très légère sur la cellule ciblée
          this.hoverPoly = this.highlightTile(x, y, 0xef4444, 0.18);

          // Texte flottant au-dessus de la cellule
          const { x: px, y: py } = gridToIso(x, y, this.originX, this.originY);
          this._hoverLosText = this.add.text(px, py - 22, '🚫 LDV', {
            fontSize: '11px', color: '#ef4444', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
          }).setOrigin(0.5).setDepth(6000);

          return; // ne pas continuer — cellule non ciblable
        }
      }

      if (this.activeSpell.isLinear) {
        // Affiche toute la ligne orthogonale
        const rawDx = x - u.pos.x, rawDy = y - u.pos.y;
        if (rawDx !== 0 && rawDy !== 0) return; // diagonal refusé
        const ddx = Math.sign(rawDx), ddy = Math.sign(rawDy);
        if (ddx === 0 && ddy === 0) return;
        const range = this.effectiveRange(this.activeSpell);
        let cx = u.pos.x + ddx, cy = u.pos.y + ddy;
        while (inBounds(cx, cy) && manhattan(u.pos, { x: cx, y: cy }) <= range) {
          this.hoverAoePolys.push(this.highlightTile(cx, cy, 0xef4444, 0.4));
          cx += ddx; cy += ddy;
        }
      } else {
        this.hoverPoly = this.highlightTile(x, y, 0xef4444, 0.5);
        if (this.activeSpell.aoeSize) {
          for (let ady = -this.activeSpell.aoeSize; ady <= this.activeSpell.aoeSize; ady++) {
            for (let adx = -this.activeSpell.aoeSize; adx <= this.activeSpell.aoeSize; adx++) {
              if (Math.abs(adx) + Math.abs(ady) > this.activeSpell.aoeSize) continue;
              if (adx === 0 && ady === 0) continue;
              if (!inBounds(x + adx, y + ady)) continue;
              this.hoverAoePolys.push(this.highlightTile(x + adx, y + ady, 0xef4444, 0.25));
            }
          }
        }
      }
    }
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    if (this.busy) return;
    if (this.currentUnit().team !== 'player') return;
    const pp = this.ptrPos(p);
    const { x, y } = isoToGrid(pp.x, pp.y, this.originX, this.originY);
    if (!inBounds(x, y)) return;

    if (this.mode === 'move') {
      const u = this.currentUnit();
      const key = `${x},${y}`;
      if (!this.reachable.has(key)) return;
      const dist = this.reachable.get(key)!.dist;
      if (dist === 0) return;
      const path = reconstructPath({ x, y }, this.reachable);
      u.pm -= dist;
      this.busy = true;
      this.animateMove(u, path, () => {
        this.busy = false;
        this.hud.update(this.playerUnit());
        if (this.mode === 'move') this.showMoveRange();
      });
    } else if (this.mode === 'cast' && this.activeSpell) {
      const u = this.currentUnit();
      const d = manhattan(u.pos, { x, y });
      if (d > this.effectiveRange(this.activeSpell)) return;
      if (this.activeSpell.minRange && d < this.activeSpell.minRange) return;
      if (this.activeSpell.isLinear) {
        // Refuser les diagonales pour les sorts en ligne
        if (x !== u.pos.x && y !== u.pos.y) return;
      }
      // Téléportation : la case cible doit être libre
      if (this.activeSpell.isTeleport && this.unitAt(x, y)) return;
      // Vérification LDV : empêche le lancer si la ligne de vue est bloquée
      if (!this.activeSpell.isTeleport && !this.activeSpell.ignoresLineOfSight) {
        const losBlocker = this._losIsBlocker(u.pos);
        if (!LineOfSightService.hasLineOfSight(u.pos, { x, y }, losBlocker)) return;
      }
      if (!this.spellManager.canCast(this.activeSpell, u.pa, this.playerFluide, this.spellCooldowns, this.spellCastsThisTurn)) return;
      this.castSpell(u, this.activeSpell, { x, y });
    }
  }

  private selectSpell(sp: ISpell) {
    if (this.busy) return;
    const u = this.currentUnit();
    if (u.team !== 'player') return;
    if (!this.spellManager.canCast(sp, u.pa, this.playerFluide, this.spellCooldowns, this.spellCastsThisTurn)) return;
    if (this.activeSpell?.id === sp.id) {
      this.activeSpell = null;
      this.mode = 'move';
      this.hud.setActiveSpell(null);
      this.showMoveRange();
      return;
    }
    this.activeSpell = sp;
    this.mode = 'cast';
    this.hud.setActiveSpell(sp.id);
    this.showSpellRange(sp);
  }

  // ───── Actions ─────
  private animateMove(u: Unit, path: GridPos[], done: () => void) {
    if (!u.sprite || path.length <= 1) { done(); return; }
    let i = 1;
    const step = () => {
      if (i >= path.length) {
        u.pos = path[path.length - 1];
        this.depthSort();
        done();
        return;
      }
      const next = path[i++];
      const { x, y } = gridToIso(next.x, next.y, this.originX, this.originY);
      this.tweens.add({
        targets: u.sprite,
        x, y: y - 14,
        duration: 140,
        ease: 'Sine.easeInOut',
        onUpdate: () => this.depthSort(),
        onComplete: () => {
          u.pos = next;
          step();
        }
      });
    };
    step();
  }

  private castSpell(caster: Unit, spell: ISpell, target: GridPos) {
    if (caster.pa < spell.paCost) return;
    if (caster.team === 'player' && this.playerFluide < spell.fluideCost) return;

    // ── Sort téléportation (Bond) ────────────────────────────────────────────
    if (spell.isTeleport && caster.team === 'player') {
      this.busy = true;
      caster.pa -= spell.paCost;
      this.playerFluide = Math.max(0, this.playerFluide - spell.fluideCost);
      this.hud.updateFluide(this.playerFluide, this.playerMaxFluide);
      const prevCasts = this.spellCastsThisTurn.get(spell.id) ?? 0;
      this.spellCastsThisTurn.set(spell.id, prevCasts + 1);
      this.hud.updateSpellCooldowns(this.spellCooldowns, this.spellCastsThisTurn);
      this.hud.log(`${caster.name} bondit !`, 'sys');
      this.clearHighlights();

      // Flash de départ
      if (caster.sprite) {
        const fDep = this.add.circle(caster.sprite.x, caster.sprite.y, 20, 0xa855f7, 0.7).setDepth(5500);
        this.tweens.add({ targets: fDep, alpha: 0, scale: 2.2, duration: 300, onComplete: () => fDep.destroy() });
      }

      // Téléporter
      caster.pos = { x: target.x, y: target.y };
      const { x: tx, y: ty } = gridToIso(target.x, target.y, this.originX, this.originY);

      if (caster.sprite) {
        caster.sprite.setPosition(tx, ty - 14);
        this.depthSort();
        const fArr = this.add.circle(tx, ty, 20, 0xa855f7, 0.7).setDepth(5500);
        this.tweens.add({ targets: fArr, alpha: 0, scale: 2.2, duration: 300, onComplete: () => fArr.destroy() });
      }

      this.time.delayedCall(220, () => {
        this.busy = false;
        this.hud.update(this.playerUnit());
        this.hud.updateFluide(this.playerFluide, this.playerMaxFluide);
        this.activeSpell = null;
        this.hud.setActiveSpell(null);
        this.mode = 'move';
        this.showMoveRange();
      });
      return;
    }

    this.busy = true;
    caster.pa -= spell.paCost;
    if (caster.team === 'player') {
      this.playerFluide = Math.max(0, this.playerFluide - spell.fluideCost);
      this.hud.updateFluide(this.playerFluide, this.playerMaxFluide);

      // ── Suivi des CD et lancers par tour ──
      const prevCasts = this.spellCastsThisTurn.get(spell.id) ?? 0;
      this.spellCastsThisTurn.set(spell.id, prevCasts + 1);
      if (spell.cooldown && spell.cooldown > 0) {
        this.spellCooldowns.set(spell.id, spell.cooldown);
      }
      this.hud.updateSpellCooldowns(this.spellCooldowns, this.spellCastsThisTurn);
    }
    this.clearHighlights();
    this.hud.log(`${caster.name} lance ${spell.name}`, 'sys');

    if (!caster.sprite) { this.busy = false; return; }
    const start    = { x: caster.sprite.x, y: caster.sprite.y };
    const targetPx = gridToIso(target.x, target.y, this.originX, this.originY);

    // Couleur du projectile selon l'élément
    const projColor = ELEMENT_COLORS[spell.element ?? 'neutre'];
    const projSize = spell.id === 'boss_melee' ? 10 : 6;
    const proj = this.add.circle(start.x, start.y, projSize, projColor, 1);
    proj.setDepth(5000);

    this.tweens.add({
      targets: proj,
      x: targetPx.x,
      y: targetPx.y,
      duration: spell.id === 'boss_melee' ? 180 : 280,
      ease: 'Quad.easeOut',
      onComplete: () => {
        proj.destroy();
        this.applySpell(caster, spell, target);
        this.busy = false;
        if (caster.team === 'player') {
          this.hud.update(this.playerUnit());
          this.hud.updateFluide(this.playerFluide, this.playerMaxFluide);
          const canStillCast = this.spellManager.canCast(spell, caster.pa, this.playerFluide, this.spellCooldowns, this.spellCastsThisTurn);
          if (!canStillCast) {
            this.activeSpell = null;
            this.hud.setActiveSpell(null);
            this.mode = 'move';
            this.showMoveRange();
          } else {
            this.showSpellRange(spell);
          }
        }
        this.checkWinLose();
      }
    });
  }

  private applySpell(caster: Unit, spell: ISpell, target: GridPos) {
    const elemColor = ELEMENT_COLORS[spell.element ?? 'neutre'];
    const flash = (gx: number, gy: number, color: number) => {
      const { x, y } = gridToIso(gx, gy, this.originX, this.originY);
      const f = this.add.circle(x, y, 18, color, 0.7).setDepth(5500);
      this.tweens.add({ targets: f, alpha: 0, scale: 2, duration: 350, onComplete: () => f.destroy() });
    };
    flash(target.x, target.y, elemColor);

    const playerResist = effectiveResistance(this.playerStats) + getEquipBonuses(this.playerEquipment).resistance;
    const damageAt = (gx: number, gy: number, rawDmg: number) => {
      const v = this.unitAt(gx, gy);
      if (!v) return;
      let dmg: number;
      if (v.team === 'player') {
        // Résistance plate du joueur (stats + équipement)
        dmg = Math.max(1, rawDmg - playerResist);
      } else {
        // Résistance élémentaire % de l'ennemi
        const elem = spell.element ?? 'neutre';
        const pct  = (v.resistances as Record<string, number> | undefined)?.[elem] ?? 0;
        dmg = Math.max(1, Math.round(rawDmg * (1 - pct / 100)));
      }
      v.hp = Math.max(0, v.hp - dmg);
      this.popDamage(v, dmg, elemColor);
      this.updateHpBar(v);
      this.hud.log(`${v.name} subit ${dmg} dégâts`, 'dmg');
      if (v.team === 'enemy') this.damageDealt += dmg;
      // Animation de mort : le sprite disparaît quand les PV tombent à 0
      if (v.hp <= 0 && v.sprite) {
        this.tweens.add({
          targets: v.sprite,
          alpha: 0,
          scaleY: 0,
          y: v.sprite.y + 12,
          duration: 380,
          ease: 'Quad.easeIn',
          onComplete: () => { if (v.sprite) v.sprite.setVisible(false); },
        });
      }
    };

    // Calcul des dégâts : bonus élémentaires + bonus niveau + Éveil Mineur
    const _finalDmgPct = finalDamagePercent(getLevel(this.playerXP));
    const _eb = getEquipBonuses(this.playerEquipment);
    const _statsWithEquip = { ...this.playerStats, terre: this.playerStats.terre + _eb.terre, feu: this.playerStats.feu + _eb.feu };
    const _eveilMult = (caster.team === 'player' && this.eveilMineurTurns > 0) ? 2 : 1;
    const rawDamage = caster.team === 'player'
      ? Math.round(this.spellManager.computeDamage(spell, _statsWithEquip, _finalDmgPct, 0) * _eveilMult)
      : (spell.baseDamage ? spell.baseDamage.min + Math.floor(Math.random() * (spell.baseDamage.max - spell.baseDamage.min + 1)) : 0);

    /** Applique le recul orthogonal à une cible depuis la direction caster→cible */
    const applyPush = (victim: Unit, ddx: number, ddy: number) => {
      let nx = victim.pos.x, ny = victim.pos.y;
      for (let i = 0; i < (spell.pushDistance ?? 0); i++) {
        const tx = nx + ddx, ty = ny + ddy;
        if (!inBounds(tx, ty)) break;
        if (this.unitAt(tx, ty)) break;
        nx = tx; ny = ty;
      }
      if (nx !== victim.pos.x || ny !== victim.pos.y) {
        victim.pos = { x: nx, y: ny };
        if (victim.sprite) {
          const { x, y } = gridToIso(nx, ny, this.originX, this.originY);
          this.tweens.add({ targets: victim.sprite, x, y: y - 14, duration: 220, ease: 'Quad.easeOut', onUpdate: () => this.depthSort() });
        }
      }
    };

    if (spell.isLinear) {
      // Tir en ligne orthogonale : touche tous les ennemis sur la trajectoire
      const ddx = Math.sign(target.x - caster.pos.x);
      const ddy = Math.sign(target.y - caster.pos.y);
      const range = this.effectiveRange(spell);
      let cx = caster.pos.x + ddx, cy = caster.pos.y + ddy;
      while (inBounds(cx, cy) && manhattan(caster.pos, { x: cx, y: cy }) <= range) {
        flash(cx, cy, elemColor);
        const victim = this.unitAt(cx, cy);
        if (victim) {
          if (spell.baseDamage) damageAt(cx, cy, rawDamage);
          if (spell.pushDistance) applyPush(victim, ddx, ddy);
        }
        cx += ddx; cy += ddy;
      }
    } else if (spell.aoeSize) {
      for (let dy = -spell.aoeSize; dy <= spell.aoeSize; dy++) {
        for (let dx = -spell.aoeSize; dx <= spell.aoeSize; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > spell.aoeSize) continue;
          if (!inBounds(target.x + dx, target.y + dy)) continue;
          flash(target.x + dx, target.y + dy, elemColor);
          damageAt(target.x + dx, target.y + dy, rawDamage);
        }
      }
    } else {
      if (spell.baseDamage) damageAt(target.x, target.y, rawDamage);
      if (spell.pushDistance) {
        const victim = this.unitAt(target.x, target.y);
        if (victim) {
          const ddx = Math.sign(target.x - caster.pos.x);
          const ddy = Math.sign(target.y - caster.pos.y);
          applyPush(victim, ddx, ddy);
        }
      }
    }

    // ── Drain de PM (ex: Nuage de Spores) ───────────────────────────────────
    if (spell.drainPm && spell.drainPm > 0) {
      const drainTargets: Unit[] = [];
      if (spell.aoeSize) {
        // Zone : tous les alliés du caster dans l'aoe sont affectés
        const team = caster.team === 'enemy' ? 'player' : 'enemy';
        for (let dy = -spell.aoeSize; dy <= spell.aoeSize; dy++) {
          for (let dx = -spell.aoeSize; dx <= spell.aoeSize; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > spell.aoeSize) continue;
            const v = this.unitAt(target.x + dx, target.y + dy);
            if (v && v.team === team && v.hp > 0) drainTargets.push(v);
          }
        }
      } else {
        const v = caster.team === 'enemy'
          ? this.units.find(u => u.team === 'player' && u.hp > 0)
          : this.unitAt(target.x, target.y);
        if (v && v.hp > 0) drainTargets.push(v);
      }
      for (const dt of drainTargets) {
        dt.drainedPm = (dt.drainedPm ?? 0) + spell.drainPm;
        this.hud.log(`${dt.name} sera ralenti (−${spell.drainPm} PM) !`, 'dmg');
        if (dt.sprite) {
          const t = this.add.text(dt.sprite.x, dt.sprite.y - 50,
            `-${spell.drainPm} PM`, {
              fontSize: '16px', color: '#86efac', fontStyle: 'bold',
              stroke: '#000', strokeThickness: 3,
            }).setOrigin(0.5).setDepth(9000);
          this.tweens.add({ targets: t, y: t.y - 28, alpha: 0, duration: 900, onComplete: () => t.destroy() });
        }
      }
    }

    // ── Drain de PA (ex: Frappe Spectrale) ──────────────────────────────────
    if (spell.drainPa && spell.drainPa > 0) {
      const drainTarget = caster.team === 'enemy'
        ? this.units.find(u => u.team === 'player' && u.hp > 0)
        : this.unitAt(target.x, target.y);
      if (drainTarget && drainTarget.hp > 0) {
        const amount = spell.drainPa;
        // Accumuler dans drainedPa — sera soustrait au prochain startTurn()
        drainTarget.drainedPa = (drainTarget.drainedPa ?? 0) + amount;
        this.hud.log(`${drainTarget.name} perdra ${amount} PA au prochain tour !`, 'dmg');
        // Popup violet "-X PA"
        if (drainTarget.sprite) {
          const t = this.add.text(drainTarget.sprite.x, drainTarget.sprite.y - 50,
            `-${amount} PA`, {
              fontSize: '16px', color: '#c084fc', fontStyle: 'bold',
              stroke: '#000', strokeThickness: 3,
            }).setOrigin(0.5).setDepth(9000);
          this.tweens.add({ targets: t, y: t.y - 28, alpha: 0, duration: 900, onComplete: () => t.destroy() });
        }
      }
    }

    // ── Proc Éveil Mineur (Épée du Premier Éveil) ────────────────────────────
    if (caster.team === 'player' && spell.baseDamage) {
      const procChance = ITEMS[this.playerEquipment.weapon ?? '']?.bonuses.procEveilMineur ?? 0;
      if (procChance > 0 && Math.random() < procChance) {
        this.eveilMineurTurns = 2;
        this.hud.log('✨ Éveil Mineur ! ×2 dégâts pendant 2 tours !', 'sys');
        const player = this.playerUnit();
        if (player.sprite) {
          const t = this.add.text(player.sprite.x, player.sprite.y - 56, '✨ ÉVEIL MINEUR', {
            fontSize: '15px', color: '#facc15', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
          }).setOrigin(0.5).setDepth(9000);
          this.tweens.add({ targets: t, y: t.y - 32, alpha: 0, duration: 1400, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
        }
      }
    }
  }

  private popDamage(u: Unit, dmg: number, elemColor = 0xffffff) {
    if (!u.sprite) return;
    const hex = `#${elemColor.toString(16).padStart(6, '0')}`;
    const t = this.add.text(u.sprite.x, u.sprite.y - 30, `-${dmg}`, {
      fontSize: '20px', color: hex, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(9000);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 800, onComplete: () => t.destroy() });
    if (u.sprite) {
      this.tweens.add({ targets: u.sprite, x: u.sprite.x + 4, yoyo: true, repeat: 3, duration: 40 });
    }
  }

  // ───── IA ennemie ─────

  private runEnemyAI() {
    const me = this.currentUnit();
    if (me.team !== 'enemy' || me.hp <= 0) { this.advanceTurn(); return; }
    const target = this.units.find((u) => u.team === 'player' && u.hp > 0);
    if (!target) { this.advanceTurn(); return; }

    const spell = me.spells[0];
    if (!spell) { this.advanceTurn(); return; }

    /** Vérifie si le mob est à portée depuis une position donnée */
    const inRange = (from: GridPos) => {
      const d = manhattan(from, target.pos);
      return d <= spell.maxRange && (!spell.minRange || d >= spell.minRange);
    };

    /**
     * Vérifie la LDV depuis une position hypothétique (avant déplacement).
     * Exclut la case `from` ET la position actuelle du mob (il sera parti).
     */
    const hasLOSFrom = (from: GridPos): boolean => {
      if (spell.ignoresLineOfSight) return true;
      const blocker = (x: number, y: number): boolean => {
        if (x === from.x   && y === from.y)   return false; // position hypothétique d'arrivée
        if (x === me.pos.x && y === me.pos.y) return false; // position de départ (mob s'est déplacé)
        return this.units.some(u => u.hp > 0 && u.pos.x === x && u.pos.y === y);
      };
      return LineOfSightService.hasLineOfSight(from, target.pos, blocker);
    };

    /** Peut attaquer depuis `from` = en portée ET LDV dégagée */
    const canAttackFrom = (from: GridPos) => inRange(from) && hasLOSFrom(from);

    const tryCast = () => {
      if (me.pa >= spell.paCost && canAttackFrom(me.pos)) {
        this.castSpell(me, spell, target.pos);
        this.time.delayedCall(700, tryCast);
      } else {
        this.time.delayedCall(500, () => this.advanceTurn());
      }
    };

    if (!canAttackFrom(me.pos) && me.pm > 0) {
      const blocked = (x: number, y: number) => !!this.units.find((o) => o.hp > 0 && o !== me && o.pos.x === x && o.pos.y === y);
      const reach   = bfsReachable(me.pos, me.pm, blocked);
      let best: GridPos = me.pos;
      let bestScore = Infinity;

      // Priorité 1 : trouver une case qui donne portée + LDV
      for (const [k] of reach) {
        const [xs, ys] = k.split(',');
        const p = { x: +xs, y: +ys };
        if (canAttackFrom(p)) {
          const d = manhattan(p, target.pos);
          if (d < bestScore) { bestScore = d; best = p; }
        }
      }

      // Priorité 2 : si aucune case avec LDV+portée, se rapprocher au maximum
      if (bestScore === Infinity) {
        for (const [k] of reach) {
          const [xs, ys] = k.split(',');
          const p = { x: +xs, y: +ys };
          const d = manhattan(p, target.pos);
          if (d < bestScore) { bestScore = d; best = p; }
        }
      }

      // Si la meilleure case est la case actuelle, tenter de lancer quand même
      if (best.x === me.pos.x && best.y === me.pos.y) {
        tryCast();
        return;
      }

      const path = reconstructPath(best, reach);
      me.pm -= (reach.get(`${best.x},${best.y}`)!.dist);
      this.busy = true;
      this.animateMove(me, path, () => {
        this.busy = false;
        this.time.delayedCall(300, tryCast);
      });
    } else {
      tryCast();
    }
  }

  // ───── Abandon ─────

  private confirmFlee() {
    if (this.busy) return;
    if (this.currentUnit().team !== 'player') return;

    const W = this.scale.width, H = this.scale.height;

    // Fond semi-transparent
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(20000).setInteractive();

    const panelW = 320, panelH = 180;
    const panel  = this.add.container(W / 2, H / 2).setDepth(20001);

    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0e1320, 1).setStrokeStyle(2, 0x78716c);
    panel.add(bg);

    panel.add(this.add.text(0, -58, 'Abandonner le combat ?', {
      fontSize: '17px', color: '#e6e8ee', fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5));

    panel.add(this.add.text(0, -24, 'Vous retournez à la carte sans gain.', {
      fontSize: '12px', color: '#8b93a7',
    }).setOrigin(0.5));

    // Bouton Confirmer
    const confirmBg = this.add.rectangle(-72, 42, 130, 38, 0x44403c, 1).setStrokeStyle(1, 0x78716c).setInteractive({ cursor: 'pointer' });
    const confirmTxt = this.add.text(-72, 42, '↩ Fuir', { fontSize: '14px', color: '#e7e5e4', fontStyle: 'bold' }).setOrigin(0.5);
    confirmBg.on('pointerover', () => { confirmBg.fillColor = 0x57534e; });
    confirmBg.on('pointerout',  () => { confirmBg.fillColor = 0x44403c; });
    confirmBg.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      this.executeFlee();
    });
    panel.add([confirmBg, confirmTxt]);

    // Bouton Annuler
    const cancelBg = this.add.rectangle(72, 42, 130, 38, 0x1c2230, 1).setStrokeStyle(1, 0x2a3248).setInteractive({ cursor: 'pointer' });
    const cancelTxt = this.add.text(72, 42, 'Continuer', { fontSize: '14px', color: '#a5b4fc', fontStyle: 'bold' }).setOrigin(0.5);
    cancelBg.on('pointerover', () => { cancelBg.fillColor = 0x263048; });
    cancelBg.on('pointerout',  () => { cancelBg.fillColor = 0x1c2230; });
    cancelBg.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
    });
    panel.add([cancelBg, cancelTxt]);

    // Fermer aussi si on clique en dehors
    overlay.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
    });

    panel.setScale(0.85);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
  }

  private executeFlee() {
    this.busy = true;
    this.hud.log('Vous fuyez le combat…', 'sys');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => {
      const heroPanel  = document.getElementById('panel-hero');
      const enemyPanel = document.getElementById('panel-enemy');
      if (heroPanel)  heroPanel.style.display  = 'none';
      if (enemyPanel) enemyPanel.style.display = 'none';
      this.scene.start('WorldScene', {
        xp:               this.playerXP,
        gold:             this.playerGold,
        playerStats:      this.playerStats,
        equipment:        this.playerEquipment,
        inventory:        this.playerInventory,
        mapId:            this.mapId,
        playerX:          this.returnX,
        playerY:          this.returnY,
        defeatedMonsters: this.defeatedMonsters,
      });
    });
  }

  // ───── Fin du combat ─────

  private checkWinLose(): boolean {
    const player = this.units.find((u) => u.team === 'player')!;
    const enemies = this.units.filter((u) => u.team === 'enemy');
    const allDead = enemies.every(e => e.hp <= 0);

    if (player.hp <= 0) {
      this.busy = true;
      this.hud.log('Défaite…', 'sys');
      this.time.delayedCall(600, () => this.showResult(false));
      return true;
    }
    if (allDead) {
      this.busy = true;
      if (this.isDungeonBoss) {
        this.hud.log('⭐ Razmotek vaincu !', 'sys');
        this.time.delayedCall(700, () => this.showDungeonVictory());
      } else {
        this.hud.log('Victoire !', 'sys');
        this.time.delayedCall(600, () => this.showResult(true));
      }
      return true;
    }
    return false;
  }

  /** Tire les drops pour un combat contre des non-boss. */
  private _rollDrops(): InventoryEntry[] {
    const drops: InventoryEntry[] = [];

    // Clef de l'Antre : 10% fixe par rat tué (indépendant de la Chance)
    const ratCount = this.monsters.filter(m => m.name === 'Rat').length;

    // Panoplie de Fer : uniquement si des rats sont présents
    if (ratCount > 0) {
      const PANOPLIE_ITEMS = [
        'casque_fer', 'torse_fer', 'jambieres_fer', 'bottes_fer',
        'bouclier_fer', 'anneau_fer', 'amulette_fer', 'cape_fer',
      ];
      for (const id of PANOPLIE_ITEMS) {
        if (Math.random() < 0.10) drops.push({ id, qty: 1 });
      }
    }
    if (ratCount > 0) {
      for (let i = 0; i < ratCount; i++) {
        if (Math.random() < 0.10) {
          drops.push({ id: 'clef_antre_razmotek', qty: 1 });
          break; // une seule clef par combat max
        }
      }
    }

    // Poils de Rat : 100% par rat tué (non affecté par la Chance)
    if (ratCount > 0) drops.push({ id: 'rat_fur', qty: ratCount });

    // Cuir de Rumineuse : 30% par Rumineuse vaincue
    const rumiCount = this.monsters.filter(m => m.name === 'Rumineuse').length;
    for (let i = 0; i < rumiCount; i++) {
      if (Math.random() < 0.30) drops.push({ id: 'cuir_rumineuse', qty: 1 });
    }

    // Psylo : 30% par Sporrin vaincu
    const sporrinCount = this.monsters.filter(m => m.name === 'Sporrin').length;
    for (let i = 0; i < sporrinCount; i++) {
      if (Math.random() < 0.30) drops.push({ id: 'psylo', qty: 1 });
    }

    // Défense de Défoncier : 30% par Défoncier vaincu
    const defoncierCount = this.monsters.filter(m => m.name === 'Défoncier').length;
    for (let i = 0; i < defoncierCount; i++) {
      if (Math.random() < 0.30) drops.push({ id: 'defense_defoncier', qty: 1 });
    }

    // Panoplie de la Forêt : 20% par mob de forêt concerné
    for (let i = 0; i < rumiCount; i++) {
      if (Math.random() < 0.20) drops.push({ id: 'anneau_foret', qty: 1 });
    }
    const groinardCount = this.monsters.filter(m => m.name === 'Groinard').length;
    for (let i = 0; i < groinardCount; i++) {
      if (Math.random() < 0.20) drops.push({ id: 'anneau_foret', qty: 1 });
    }
    for (let i = 0; i < sporrinCount; i++) {
      if (Math.random() < 0.20) drops.push({ id: 'amulette_foret', qty: 1 });
    }
    for (let i = 0; i < defoncierCount; i++) {
      if (Math.random() < 0.20) drops.push({ id: 'casque_foret', qty: 1 });
    }

    return drops;
  }

  private showResult(victory: boolean) {
    this._hideUnitTooltip();
    const W = this.scale.width, H = this.scale.height;
    const xpGain   = victory
      ? this.monsters.reduce((sum, m) => sum + (m.xpDrop ?? 100), 0)
      : 0;
    const goldGain = victory
      ? this.monsters.reduce((sum, m) => sum + (m.goldDrop ?? 100), 0)
      : 0;
    const newXP    = this.playerXP + xpGain;
    const newGold  = this.playerGold + goldGain;

    // Drops panoplie + clef (non-boss uniquement)
    const drops: InventoryEntry[] = (victory && !this.isDungeonBoss) ? this._rollDrops() : [];
    if (drops.length > 0) {
      for (const drop of drops) {
        const existing = this.playerInventory.find(e => e.id === drop.id);
        if (existing) existing.qty += drop.qty;
        else this.playerInventory.push({ ...drop });
      }
    }

    // Quête : compter les monstres tués
    if (victory) {
      gameState.questKills = Math.min(5, gameState.questKills + this.monsterIds.length);
    }

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(10000);

    const hasDrops = drops.length > 0;
    const panelW = 340, panelH = (victory && hasDrops) ? 320 : 280;
    const panel  = this.add.container(W / 2, H / 2).setDepth(10001);

    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0e1320, 1)
      .setStrokeStyle(2, victory ? 0x22c55e : 0xef4444);
    panel.add(bg);

    const titleColor = victory ? '#22c55e' : '#ef4444';
    const titleText  = victory ? '✦ VICTOIRE ✦' : '✗ DÉFAITE ✗';
    panel.add(this.add.text(0, -100, titleText, {
      fontSize: '28px', color: titleColor, fontStyle: 'bold', stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5));

    const stats = [
      { label: 'Dégâts infligés', value: `${this.damageDealt}`, color: '#fca5a5' },
      { label: 'Tours joués',     value: `${Math.ceil(this.turnsUsed / 2)}`, color: '#e6e8ee' },
    ];
    stats.forEach((s, i) => {
      const y = -40 + i * 34;
      panel.add(this.add.text(-120, y, s.label, { fontSize: '13px', color: '#8b93a7' }).setOrigin(0, 0.5));
      panel.add(this.add.text(120, y, s.value,  { fontSize: '15px', color: s.color, fontStyle: 'bold' }).setOrigin(1, 0.5));
      const line = this.add.graphics();
      line.lineStyle(1, 0x2a3142, 1);
      line.lineBetween(-120, y + 16, 120, y + 16);
      panel.add(line);
    });

    if (victory) {
      const xpBg  = this.add.rectangle(0, 44, 200, 30, 0x14532d, 1).setStrokeStyle(1, 0x22c55e);
      const xpTxt = this.add.text(0, 44, `+ ${xpGain} XP`, {
        fontSize: '18px', color: '#4ade80', fontStyle: 'bold', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5);
      const goldBg  = this.add.rectangle(0, 80, 200, 30, 0x1a1400, 1).setStrokeStyle(1, 0xfbbf24);
      const goldTxt = this.add.text(0, 80, `💰 + ${goldGain} or`, {
        fontSize: '18px', color: '#fde047', fontStyle: 'bold', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5);
      panel.add([xpBg, xpTxt, goldBg, goldTxt]);
      this.tweens.add({ targets: xpTxt, y: 36, duration: 600, ease: 'Back.easeOut', delay: 300 });
      this.tweens.add({ targets: goldTxt, y: 72, duration: 600, ease: 'Back.easeOut', delay: 450 });

      // Affichage des drops
      if (drops.length > 0) {
        const dropLabels = drops.map(d => {
          const item = ITEMS[d.id] ?? RESOURCE_CATALOG[d.id];
          return item ? `${item.icon} ${item.name}` : d.id;
        }).join('  ');
        const dropTxt = this.add.text(0, 106, `🎁 ${dropLabels}`, {
          fontSize: '11px', color: '#fde047', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 2, wordWrap: { width: 300 },
        }).setOrigin(0.5);
        panel.add(dropTxt);
      }
    }

    const btnY  = (victory && hasDrops) ? 142 : 106;
    const btnBg = this.add.rectangle(0, btnY, 200, 40, 0x1c2230, 1)
      .setStrokeStyle(1, victory ? 0x22c55e : 0x4a5775)
      .setInteractive({ cursor: 'pointer' });
    const btnTxt = this.add.text(0, btnY, '↩ Retour à la carte', {
      fontSize: '13px', color: '#e6e8ee', fontStyle: 'bold'
    }).setOrigin(0.5);
    panel.add([btnBg, btnTxt]);

    btnBg.on('pointerover', () => { btnBg.fillColor = 0x2a3248; });
    btnBg.on('pointerout',  () => { btnBg.fillColor = 0x1c2230; });
    btnBg.on('pointerdown', () => {
      btnBg.disableInteractive();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      setTimeout(() => {
        const heroPanel  = document.getElementById('panel-hero');
        const enemyPanel = document.getElementById('panel-enemy');
        if (heroPanel)  heroPanel.style.display  = 'none';
        if (enemyPanel) enemyPanel.style.display = 'none';
        if (victory) {
          this.scene.start('WorldScene', {
            xp:               newXP,
            gold:             newGold,
            playerStats:      this.playerStats,
            equipment:        this.playerEquipment,
            inventory:        this.playerInventory,
            mapId:            this.mapId,
            playerX:          this.returnX,
            playerY:          this.returnY,
            defeatedMonsters: [...this.defeatedMonsters, ...this.monsterIds],
          });
        } else {
          this.scene.start('WorldScene', {
            xp:               newXP,
            gold:             this.playerGold,
            playerStats:      this.playerStats,
            equipment:        this.playerEquipment,
            inventory:        this.playerInventory,
            mapId:            'map_c',
            playerX:          6,
            playerY:          4,
            defeatedMonsters: this.defeatedMonsters,
          });
        }
      }, 320);
    });

    panel.setScale(0.7);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
  }

  // ─── Écran victoire donjon boss ───────────────────────────────────────────

  private showDungeonVictory() {
    this._hideUnitTooltip();
    const W = this.scale.width, H = this.scale.height;
    const dungeonGoldGain = 100 * Math.max(1, this.monsterIds.length);
    const dungeonNewGold  = this.playerGold + dungeonGoldGain;

    // Quête 3 : Razmotek vaincu
    gameState.quest3Done = true;

    // Quête : compter les monstres tués
    gameState.questKills = Math.min(5, gameState.questKills + this.monsterIds.length);

    // Donner la récompense
    const reward = { id: 'defense_razmotek', qty: 1 };
    const existing = this.playerInventory.find(e => e.id === reward.id);
    if (existing) existing.qty++;
    else this.playerInventory.push(reward);

    const rewardItem = ITEMS['defense_razmotek'];

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setDepth(10000);

    const panelW = 380, panelH = 360;
    const panel  = this.add.container(W / 2, H / 2).setDepth(10001);

    // Fond panneau
    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0a0d16, 1)
      .setStrokeStyle(2, 0xffd700);
    panel.add(bg);

    // Effet brillant en haut
    const glowBg = this.add.rectangle(0, -panelH / 2, panelW, 6, 0xffd700, 0.7).setOrigin(0.5, 0);
    panel.add(glowBg);

    // Titre
    panel.add(this.add.text(0, -148, '⭐ DONJON TERMINÉ ⭐', {
      fontSize: '24px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));

    panel.add(this.add.text(0, -112, 'Razmotek a été vaincu !', {
      fontSize: '14px', color: '#fca5a5', fontStyle: 'italic',
    }).setOrigin(0.5));

    // Séparateur
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x2a3142, 1);
    sep.lineBetween(-140, -90, 140, -90);
    panel.add(sep);

    // Récompense
    panel.add(this.add.text(0, -68, 'RÉCOMPENSE', {
      fontSize: '11px', color: '#6b7280', letterSpacing: 2,
    }).setOrigin(0.5));

    const rewardBox = this.add.rectangle(0, -20, 260, 60, 0x14532d, 1).setStrokeStyle(1, 0x16a34a);
    panel.add(rewardBox);

    const rewardIcon = this.add.text(-100, -20, rewardItem?.icon ?? '🦷', { fontSize: '26px' }).setOrigin(0.5);
    panel.add(rewardIcon);

    const rewardName = this.add.text(-60, -28, rewardItem?.name ?? 'Défense de Razmotek', {
      fontSize: '13px', color: '#e6e8ee', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    panel.add(rewardName);

    panel.add(this.add.text(-60, -10, rewardItem?.description ?? '+10 dégâts corps à corps', {
      fontSize: '11px', color: '#4ade80',
    }).setOrigin(0, 0.5));

    // Stats combat
    const statsY = 42;
    const sep2 = this.add.graphics();
    sep2.lineStyle(1, 0x2a3142, 1);
    sep2.lineBetween(-140, statsY - 14, 140, statsY - 14);
    panel.add(sep2);

    panel.add(this.add.text(-140, statsY, 'Dégâts infligés', { fontSize: '12px', color: '#8b93a7' }).setOrigin(0, 0.5));
    panel.add(this.add.text(140, statsY, `${this.damageDealt}`, { fontSize: '13px', color: '#fca5a5', fontStyle: 'bold' }).setOrigin(1, 0.5));

    // Bouton retour village
    const btnBg = this.add.rectangle(0, 110, 240, 44, 0x14532d, 1)
      .setStrokeStyle(1, 0xffd700)
      .setInteractive({ cursor: 'pointer' });
    panel.add(btnBg);
    panel.add(this.add.text(0, 110, '🏠 Retourner au village', {
      fontSize: '13px', color: '#fde047', fontStyle: 'bold',
    }).setOrigin(0.5));

    btnBg.on('pointerover', () => { btnBg.fillColor = 0x1a6b35; });
    btnBg.on('pointerout',  () => { btnBg.fillColor = 0x14532d; });
    btnBg.on('pointerdown', () => {
      btnBg.disableInteractive();  // empêche double-clic
      this.cameras.main.fadeOut(350, 0, 0, 0);
      // setTimeout (plus fiable que time.delayedCall en fin de scène)
      setTimeout(() => {
        const heroPanel  = document.getElementById('panel-hero');
        const enemyPanel = document.getElementById('panel-enemy');
        if (heroPanel)  heroPanel.style.display  = 'none';
        if (enemyPanel) enemyPanel.style.display = 'none';
        this.scene.start('WorldScene', {
          xp:               this.playerXP + this.monsters.reduce((sum, m) => sum + (m.xpDrop ?? 100), 0),
          gold:             dungeonNewGold,
          playerStats:      this.playerStats,
          equipment:        this.playerEquipment,
          inventory:        this.playerInventory,
          mapId:            'map_c',
          playerX:          6,
          playerY:          4,
          defeatedMonsters: [...this.defeatedMonsters, ...this.monsterIds],
        });
      }, 380);
    });

    panel.setScale(0.7);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, alpha: 1, duration: 400, ease: 'Back.easeOut' });

    // Particules dorées
    this.time.delayedCall(200, () => {
      for (let i = 0; i < 8; i++) {
        const px = W / 2 + (Math.random() - 0.5) * 300;
        const py = H / 2 + (Math.random() - 0.5) * 200;
        const star = this.add.text(px, py, '✦', {
          fontSize: `${14 + Math.random() * 12}px`, color: '#ffd700',
        }).setOrigin(0.5).setDepth(10002).setAlpha(0);
        this.tweens.add({
          targets: star, y: py - 60, alpha: 1,
          duration: 600, delay: i * 100,
          yoyo: true, repeat: 0,
          onComplete: () => star.destroy(),
        });
      }
    });
  }
}
