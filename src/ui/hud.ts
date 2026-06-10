import { Spell, Unit } from '../types';
import { ALL_SPELLS } from '../game/spells';

export class HUD {
  private hpEl = document.getElementById('hp')!;
  private paEl = document.getElementById('pa')!;
  private pmEl = document.getElementById('pm')!;
  private flEl = document.getElementById('fl')!;
  private spellsEl = document.getElementById('spells')!;
  private playerFluide = 0;
  private turnEl = document.getElementById('turnInfo')!;
  private logEl = document.getElementById('log')!;
  private endTurnEl = document.getElementById('endTurn') as HTMLButtonElement;
  private heroPortraitEl = document.getElementById('portrait-hero') as HTMLImageElement | null;
  private enemyPortraitEl = document.getElementById('portrait-enemy') as HTMLImageElement | null;
  private heroPanelEl = document.getElementById('panel-hero') as HTMLElement | null;
  private enemyPanelEl = document.getElementById('panel-enemy') as HTMLElement | null;
  private activeSpellId: string | null = null;
  private currentUnit: Unit | null = null;
  private spells: Spell[] = [];

  onSpellClick: (spell: Spell) => void = () => {};
  onEndTurn: () => void = () => {};

  constructor(spells: Spell[] = ALL_SPELLS) {
    this.spells = spells;
    this.spellsEl.innerHTML = '';
    for (const s of this.spells) {
      const el = document.createElement('div');
      el.className = 'spell';
      el.dataset.id = s.id;
      const fcost = s.fluideCost > 0 ? `<span class="fcost">${s.fluideCost}💧</span>` : '';
      el.innerHTML = `<span class="cost">${s.cost}PA</span><span class="icon">${s.icon}</span><span class="name">${s.name}</span>${fcost}`;
      el.title = s.description;
      el.addEventListener('click', () => {
        if (el.classList.contains('disabled')) return;
        this.onSpellClick(s);
      });
      this.spellsEl.appendChild(el);
    }
    this.endTurnEl.onclick = () => this.onEndTurn();
  }

  setActiveSpell(id: string | null) {
    this.activeSpellId = id;
    this.spellsEl.querySelectorAll('.spell').forEach((el) => {
      const e = el as HTMLElement;
      e.classList.toggle('active', e.dataset.id === id);
    });
  }

  updateFluide(current: number, max: number) {
    this.playerFluide = current;
    this.flEl.textContent = `${current}/${max}`;
    this.refreshSpellStates();
  }

  update(unit: Unit) {
    this.currentUnit = unit;
    this.hpEl.textContent = `${unit.hp}/${unit.maxHp}`;
    this.paEl.textContent = `${unit.pa}`;
    this.pmEl.textContent = `${unit.pm}`;
    this.refreshSpellStates();
  }

  private refreshSpellStates() {
    const unit = this.currentUnit;
    if (!unit) return;
    this.spellsEl.querySelectorAll('.spell').forEach((el) => {
      const e = el as HTMLElement;
      const sp = this.spells.find((s) => s.id === e.dataset.id);
      if (!sp) return;
      const disabled = unit.team !== 'player' || unit.pa < sp.cost || this.playerFluide < sp.fluideCost;
      e.classList.toggle('disabled', disabled);
    });
  }

  show() {
    ['hud', 'turnInfo', 'log'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.visibility = 'visible';
        el.style.pointerEvents = '';
      }
    });
  }

  hide() {
    ['hud', 'turnInfo', 'log'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
      }
    });
    const heroPanel = document.getElementById('panel-hero');
    const enemyPanel = document.getElementById('panel-enemy');
    if (heroPanel) heroPanel.style.display = 'none';
    if (enemyPanel) enemyPanel.style.display = 'none';
  }

  setPortraits(portraits: Record<string, string>) {
    if (portraits.hero && this.heroPortraitEl && this.heroPanelEl) {
      this.heroPortraitEl.src = portraits.hero;
      this.heroPanelEl.style.display = 'flex';
    }
    if (portraits.enemy && this.enemyPortraitEl && this.enemyPanelEl) {
      this.enemyPortraitEl.src = portraits.enemy;
      this.enemyPanelEl.style.display = 'flex';
    }
  }

  setTurn(turn: number, name: string, team: 'player' | 'enemy') {
    this.turnEl.textContent = `Tour ${turn} — ${name}`;
    this.turnEl.style.borderColor = team === 'player' ? '#38bdf8' : '#ef4444';
    this.endTurnEl.disabled = team !== 'player';
    this.endTurnEl.style.opacity = team === 'player' ? '1' : '0.4';
  }

  log(msg: string, kind: 'sys' | 'dmg' | '' = '') {
    const div = document.createElement('div');
    div.className = `entry ${kind}`;
    div.textContent = msg;
    this.logEl.appendChild(div);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }
}
