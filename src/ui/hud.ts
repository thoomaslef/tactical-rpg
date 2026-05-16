import { Spell, Unit } from '../types';
import { ALL_SPELLS } from '../game/spells';

export class HUD {
  private hpEl = document.getElementById('hp')!;
  private paEl = document.getElementById('pa')!;
  private pmEl = document.getElementById('pm')!;
  private spellsEl = document.getElementById('spells')!;
  private turnEl = document.getElementById('turnInfo')!;
  private logEl = document.getElementById('log')!;
  private endTurnEl = document.getElementById('endTurn') as HTMLButtonElement;
  private activeSpellId: string | null = null;
  private currentUnit: Unit | null = null;

  onSpellClick: (spell: Spell) => void = () => {};
  onEndTurn: () => void = () => {};

  constructor() {
    for (const s of ALL_SPELLS) {
      const el = document.createElement('div');
      el.className = 'spell';
      el.dataset.id = s.id;
      el.innerHTML = `<span class="cost">${s.cost}</span><span class="icon">${s.icon}</span><span class="name">${s.name}</span>`;
      el.title = s.description;
      el.addEventListener('click', () => {
        if (el.classList.contains('disabled')) return;
        this.onSpellClick(s);
      });
      this.spellsEl.appendChild(el);
    }
    this.endTurnEl.addEventListener('click', () => this.onEndTurn());
  }

  setActiveSpell(id: string | null) {
    this.activeSpellId = id;
    this.spellsEl.querySelectorAll('.spell').forEach((el) => {
      const e = el as HTMLElement;
      e.classList.toggle('active', e.dataset.id === id);
    });
  }

  update(unit: Unit) {
    this.currentUnit = unit;
    this.hpEl.textContent = `${unit.hp}/${unit.maxHp}`;
    this.paEl.textContent = `${unit.pa}`;
    this.pmEl.textContent = `${unit.pm}`;
    this.spellsEl.querySelectorAll('.spell').forEach((el) => {
      const e = el as HTMLElement;
      const sp = ALL_SPELLS.find((s) => s.id === e.dataset.id)!;
      const disabled = unit.team !== 'player' || unit.pa < sp.cost;
      e.classList.toggle('disabled', disabled);
    });
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
