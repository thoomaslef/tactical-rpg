import Phaser from 'phaser';
import { Mode, Spell, Unit, GridPos } from '../types';
import { TILE_W, TILE_H, GRID_W, GRID_H, gridToIso, isoToGrid, manhattan, inBounds } from '../game/iso';
import { bfsReachable, reconstructPath } from '../game/pathfinding';
import { SPELLS } from '../game/spells';
import { HUD } from '../ui/hud';

interface TileGfx {
  poly: Phaser.GameObjects.Polygon;
  gx: number;
  gy: number;
}

export class CombatScene extends Phaser.Scene {
  private originX = 0;
  private originY = 0;
  private tiles: TileGfx[] = [];
  private tileMap = new Map<string, TileGfx>();
  private units: Unit[] = [];
  private turnOrder: Unit[] = [];
  private turnIndex = 0;
  private turnNumber = 1;
  private mode: Mode = 'idle';
  private activeSpell: Spell | null = null;
  private hud!: HUD;
  private highlightLayer!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private unitLayer!: Phaser.GameObjects.Container;
  private reachable: Map<string, { dist: number; prev: string | null }> = new Map();
  private busy = false;

  constructor() {
    super('CombatScene');
  }

  create(data?: { portraits?: Record<string, string> }) {
    this.cameras.main.setBackgroundColor('#0e1320');
    this.originX = this.scale.width / 2;
    this.originY = 120;

    this.drawGrid();

    this.highlightLayer = this.add.container(0, 0).setDepth(500);
    this.fxLayer = this.add.container(0, 0).setDepth(5000);
    this.unitLayer = this.add.container(0, 0).setDepth(1000);

    // Units
    const archer: Unit = this.makeUnit('hero', 'Archer', 'player', { x: 4, y: 7 }, 50, 6, 3, 12);
    const monster: Unit = this.makeUnit('mob', 'Bouftou', 'enemy', { x: 10, y: 7 }, 60, 6, 3, 8);
    archer.spells = [SPELLS.arrow, SPELLS.explosive, SPELLS.push];
    monster.spells = [SPELLS.arrow];
    this.units = [archer, monster];

    for (const u of this.units) this.spawnUnitSprite(u);
    this.depthSort();

    // Turn order by initiative desc
    this.turnOrder = [...this.units].sort((a, b) => b.initiative - a.initiative);

    // HUD
    this.hud = new HUD();
    this.hud.onSpellClick = (sp) => this.selectSpell(sp);
    this.hud.onEndTurn = () => this.endTurn();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    this.scale.on('resize', () => {
      this.originX = this.scale.width / 2;
      this.originY = 120;
      this.redrawAll();
    });

    if (data?.portraits) this.hud.setPortraits(data.portraits);

    this.startTurn();
    this.hud.log('Combat engagé. À toi de jouer !', 'sys');
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

  private drawGrid() {
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
      u.sprite.setPosition(x, y - 18);
    }
    this.depthSort();
    this.clearHighlights();
    if (this.mode === 'move') this.showMoveRange();
    if (this.mode === 'cast' && this.activeSpell) this.showSpellRange(this.activeSpell);
  }

  private spawnUnitSprite(u: Unit) {
    const { x, y } = gridToIso(u.pos.x, u.pos.y, this.originX, this.originY);
    const c = this.add.container(x, y - 18);
    // shadow
    const shadow = this.add.ellipse(0, 18, 36, 14, 0x000000, 0.4);
    // body
    const body = this.add.graphics();
    const color = u.team === 'player' ? 0x38bdf8 : 0xef4444;
    const accent = u.team === 'player' ? 0x0ea5e9 : 0xb91c1c;
    body.fillStyle(accent, 1);
    body.fillRoundedRect(-12, 0, 24, 18, 4);
    body.fillStyle(color, 1);
    body.fillCircle(0, -8, 10);
    body.lineStyle(2, 0x000000, 0.35);
    body.strokeCircle(0, -8, 10);
    body.strokeRoundedRect(-12, 0, 24, 18, 4);

    // emblem (archer = arrow, monster = fangs)
    const label = this.add.text(0, -10, u.team === 'player' ? '🏹' : '👹', { fontSize: '14px' }).setOrigin(0.5);

    // HP bar
    const bg = this.add.rectangle(0, -28, 36, 5, 0x000000, 0.6).setOrigin(0.5);
    const bar = this.add.rectangle(-18, -28, 36, 5, 0x22c55e, 1).setOrigin(0, 0.5);
    bar.setData('hpbar', true);
    bg.setData('hpbg', true);

    c.add([shadow, body, label, bg, bar]);
    c.setSize(40, 40);
    u.sprite = c;
    this.unitLayer.add(c);
  }

  private updateHpBar(u: Unit) {
    if (!u.sprite) return;
    const bar = u.sprite.list.find((o) => (o as any).getData && (o as any).getData('hpbar')) as Phaser.GameObjects.Rectangle | undefined;
    if (!bar) return;
    const ratio = Math.max(0, u.hp / u.maxHp);
    bar.width = 36 * ratio;
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

  private currentUnit(): Unit {
    return this.turnOrder[this.turnIndex];
  }

  private unitAt(x: number, y: number): Unit | undefined {
    return this.units.find((u) => u.hp > 0 && u.pos.x === x && u.pos.y === y);
  }

  private startTurn() {
    const u = this.currentUnit();
    u.pa = u.maxPa;
    u.pm = u.maxPm;
    this.activeSpell = null;
    this.mode = 'idle';
    this.clearHighlights();
    this.hud.setActiveSpell(null);
    this.hud.setTurn(this.turnNumber, u.name, u.team);
    this.hud.update(this.playerUnit());

    if (u.team === 'player') {
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
    this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
    if (this.turnIndex === 0) this.turnNumber++;
    if (this.checkWinLose()) return;
    if (this.currentUnit().hp <= 0) {
      this.advanceTurn();
      return;
    }
    this.startTurn();
  }

  private playerUnit(): Unit {
    return this.units.find((u) => u.team === 'player')!;
  }

  // ───── Highlights ─────
  private clearHighlights() {
    this.highlightLayer.removeAll(true);
  }

  private highlightTile(x: number, y: number, color: number, alpha = 0.45) {
    const { x: px, y: py } = gridToIso(x, y, this.originX, this.originY);
    const poly = this.add.polygon(px, py, [
      0, -TILE_H / 2,
      TILE_W / 2, 0,
      0, TILE_H / 2,
      -TILE_W / 2, 0
    ], color, alpha);
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

  private showSpellRange(spell: Spell) {
    const u = this.currentUnit();
    this.clearHighlights();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const d = manhattan(u.pos, { x, y });
        if (d > spell.range) continue;
        if (spell.minRange && d < spell.minRange) continue;
        if (d === 0) continue;
        this.highlightTile(x, y, 0x38bdf8, 0.30);
      }
    }
  }

  // ───── Input ─────
  private hoverPoly: Phaser.GameObjects.Polygon | null = null;

  private onPointerMove(p: Phaser.Input.Pointer) {
    if (this.busy) return;
    if (this.currentUnit().team !== 'player') return;
    const { x, y } = isoToGrid(p.worldX, p.worldY, this.originX, this.originY);
    if (!inBounds(x, y)) return;
    if (this.hoverPoly) { this.hoverPoly.destroy(); this.hoverPoly = null; }
    if (this.mode === 'move') {
      if (!this.reachable.has(`${x},${y}`)) return;
      this.hoverPoly = this.highlightTile(x, y, 0xfbbf24, 0.55);
    } else if (this.mode === 'cast' && this.activeSpell) {
      const u = this.currentUnit();
      const d = manhattan(u.pos, { x, y });
      if (d > this.activeSpell.range) return;
      if (this.activeSpell.minRange && d < this.activeSpell.minRange) return;
      this.hoverPoly = this.highlightTile(x, y, 0xef4444, 0.5);
      if (this.activeSpell.aoe) {
        for (let dy = -this.activeSpell.aoe; dy <= this.activeSpell.aoe; dy++) {
          for (let dx = -this.activeSpell.aoe; dx <= this.activeSpell.aoe; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > this.activeSpell.aoe) continue;
            if (dx === 0 && dy === 0) continue;
            if (!inBounds(x + dx, y + dy)) continue;
            this.highlightLayer.add(this.highlightTile(x + dx, y + dy, 0xef4444, 0.25));
          }
        }
      }
    }
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    if (this.busy) return;
    if (this.currentUnit().team !== 'player') return;
    const { x, y } = isoToGrid(p.worldX, p.worldY, this.originX, this.originY);
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
      if (d > this.activeSpell.range) return;
      if (this.activeSpell.minRange && d < this.activeSpell.minRange) return;
      this.castSpell(u, this.activeSpell, { x, y });
    }
  }

  private selectSpell(sp: Spell) {
    if (this.busy) return;
    const u = this.currentUnit();
    if (u.team !== 'player') return;
    if (u.pa < sp.cost) return;
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
        x, y: y - 18,
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

  private castSpell(caster: Unit, spell: Spell, target: GridPos) {
    if (caster.pa < spell.cost) return;
    this.busy = true;
    caster.pa -= spell.cost;
    this.clearHighlights();
    this.hud.log(`${caster.name} lance ${spell.name}`, 'sys');

    // projectile FX
    if (!caster.sprite) { this.busy = false; return; }
    const start = { x: caster.sprite.x, y: caster.sprite.y };
    const targetPx = gridToIso(target.x, target.y, this.originX, this.originY);
    const proj = this.add.circle(start.x, start.y, 6, spell.id === 'explosive' ? 0xfb923c : spell.id === 'push' ? 0xa78bfa : 0xfde047, 1);
    proj.setDepth(5000);
    this.tweens.add({
      targets: proj,
      x: targetPx.x,
      y: targetPx.y,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => {
        proj.destroy();
        this.applySpell(caster, spell, target);
        this.busy = false;
        if (caster.team === 'player') {
          this.hud.update(this.playerUnit());
          if (caster.pa < spell.cost) {
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

  private applySpell(caster: Unit, spell: Spell, target: GridPos) {
    const flash = (gx: number, gy: number, color: number) => {
      const { x, y } = gridToIso(gx, gy, this.originX, this.originY);
      const f = this.add.circle(x, y, 18, color, 0.7).setDepth(5500);
      this.tweens.add({ targets: f, alpha: 0, scale: 2, duration: 350, onComplete: () => f.destroy() });
    };
    flash(target.x, target.y, spell.id === 'explosive' ? 0xfb923c : 0xfde047);

    const damageAt = (gx: number, gy: number, dmg: number) => {
      const v = this.unitAt(gx, gy);
      if (!v) return;
      v.hp = Math.max(0, v.hp - dmg);
      this.popDamage(v, dmg);
      this.updateHpBar(v);
      this.hud.log(`${v.name} subit ${dmg} dégâts`, 'dmg');
    };

    if (spell.aoe) {
      for (let dy = -spell.aoe; dy <= spell.aoe; dy++) {
        for (let dx = -spell.aoe; dx <= spell.aoe; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > spell.aoe) continue;
          if (!inBounds(target.x + dx, target.y + dy)) continue;
          flash(target.x + dx, target.y + dy, 0xfb923c);
          damageAt(target.x + dx, target.y + dy, spell.damage ?? 0);
        }
      }
    } else {
      if (spell.damage) damageAt(target.x, target.y, spell.damage);
    }

    if (spell.push) {
      const victim = this.unitAt(target.x, target.y);
      if (victim) {
        const dx = Math.sign(target.x - caster.pos.x);
        const dy = Math.sign(target.y - caster.pos.y);
        const stepX = dx !== 0 && dy === 0 ? dx : 0;
        const stepY = dy !== 0 && dx === 0 ? dy : (dx === 0 ? dy : 0);
        const ax = stepX || (dx !== 0 ? dx : 0);
        const ay = stepY || (dy !== 0 ? dy : 0);
        let nx = victim.pos.x, ny = victim.pos.y;
        for (let i = 0; i < (spell.push ?? 0); i++) {
          const tx = nx + ax;
          const ty = ny + ay;
          if (!inBounds(tx, ty)) break;
          if (this.unitAt(tx, ty)) break;
          nx = tx; ny = ty;
        }
        if (nx !== victim.pos.x || ny !== victim.pos.y) {
          victim.pos = { x: nx, y: ny };
          if (victim.sprite) {
            const { x, y } = gridToIso(nx, ny, this.originX, this.originY);
            this.tweens.add({ targets: victim.sprite, x, y: y - 18, duration: 220, ease: 'Quad.easeOut', onUpdate: () => this.depthSort() });
          }
        }
      }
    }
  }

  private popDamage(u: Unit, dmg: number) {
    if (!u.sprite) return;
    const t = this.add.text(u.sprite.x, u.sprite.y - 30, `-${dmg}`, {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#7f1d1d', strokeThickness: 4
    }).setOrigin(0.5).setDepth(9000);
    this.tweens.add({
      targets: t,
      y: t.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => t.destroy()
    });
    if (u.sprite) {
      this.tweens.add({
        targets: u.sprite,
        x: u.sprite.x + 4, yoyo: true, repeat: 3, duration: 40
      });
    }
  }

  // ───── Enemy AI ─────
  private runEnemyAI() {
    const me = this.currentUnit();
    if (me.team !== 'enemy' || me.hp <= 0) { this.advanceTurn(); return; }
    const target = this.units.find((u) => u.team === 'player' && u.hp > 0);
    if (!target) { this.advanceTurn(); return; }

    const spell = me.spells[0];
    const dist = manhattan(me.pos, target.pos);
    const inRange = (from: GridPos) => {
      const d = manhattan(from, target.pos);
      return d <= spell.range && (!spell.minRange || d >= spell.minRange);
    };

    const tryCast = () => {
      if (me.pa >= spell.cost && inRange(me.pos)) {
        this.castSpell(me, spell, target.pos);
        this.time.delayedCall(700, tryCast);
      } else {
        this.time.delayedCall(500, () => this.advanceTurn());
      }
    };

    if (!inRange(me.pos) && me.pm > 0) {
      // Move closer
      const blocked = (x: number, y: number) => !!this.units.find((o) => o.hp > 0 && o !== me && o.pos.x === x && o.pos.y === y);
      const reach = bfsReachable(me.pos, me.pm, blocked);
      let best: GridPos = me.pos;
      let bestScore = Infinity;
      for (const [k] of reach) {
        const [xs, ys] = k.split(',');
        const p = { x: +xs, y: +ys };
        const d = manhattan(p, target.pos);
        if (d < bestScore) { bestScore = d; best = p; }
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

  private checkWinLose(): boolean {
    const player = this.units.find((u) => u.team === 'player')!;
    const enemy = this.units.find((u) => u.team === 'enemy')!;
    if (player.hp <= 0) {
      this.busy = true;
      this.hud.log('Défaite…', 'sys');
      this.showResult('DÉFAITE', 0xef4444);
      return true;
    }
    if (enemy.hp <= 0) {
      this.busy = true;
      this.hud.log('Victoire !', 'sys');
      this.showResult('VICTOIRE', 0x22c55e);
      return true;
    }
    return false;
  }

  private showResult(text: string, color: number) {
    const w = this.scale.width, h = this.scale.height;
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55).setDepth(10000);
    const t = this.add.text(w / 2, h / 2, text, {
      fontSize: '64px', color: '#fff', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5).setDepth(10001);
    t.setTint(color);
  }
}
