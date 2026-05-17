import {
  PlayerStats, emptyStats,
  getLevel, xpForLevel,
  availablePoints, maxHp, maxPa, maxPm, maxMagic,
} from '../game/stats';
import { PlayerEquipment, emptyEquipment, getEquipBonuses, PANOPLIES, isPanoplyComplete, getPanoplyProgress } from '../game/items';

interface StatCfg {
  key: keyof PlayerStats;
  label: string;
  icon: string;
  desc: string;
  color: string;
}

const STAT_CFGS: StatCfg[] = [
  { key: 'vitalite',   label: 'Vitalité', icon: '❤️',  desc: '+1 PV maximum',         color: '#f87171' },
  { key: 'sagesse',    label: 'Sagesse',  icon: '📚',  desc: '+1 % bonus XP',         color: '#c084fc' },
  { key: 'fluide',     label: 'Fluide',   icon: '💧',  desc: '+1 magie max par pt',    color: '#a855f7' },
  { key: 'portee',     label: 'Portée',   icon: '🎯',  desc: '+1 case de portée',      color: '#34d399' },
  { key: 'eau',        label: 'EAU',      icon: '🌊',  desc: 'Sorts Eau + %',          color: '#7dd3fc' },
  { key: 'feu',        label: 'FEU',      icon: '🔥',  desc: 'Sorts Feu + %',          color: '#fb923c' },
  { key: 'air',        label: 'AIR',      icon: '🌪️', desc: 'Sorts Air + %',          color: '#bef264' },
  { key: 'terre',      label: 'TERRE',    icon: '🪨',  desc: 'Sorts Terre + %',        color: '#d97706' },
  { key: 'soin',       label: 'Soin',     icon: '💚',  desc: 'Bonus soins + %',        color: '#4ade80' },
  { key: 'resistance', label: 'Résist.',  icon: '🛡️', desc: '-1 dégât reçu / pt',     color: '#94a3b8' },
];

let _instance: CharacterMenu | null = null;

export function getCharacterMenu(): CharacterMenu {
  if (!_instance) _instance = new CharacterMenu();
  return _instance;
}

export class CharacterMenu {
  private overlay: HTMLElement;
  private stats: PlayerStats = emptyStats();
  private equip: PlayerEquipment = emptyEquipment();
  private xp = 0;
  private onClose: (s: PlayerStats) => void = () => {};

  constructor() {
    // Reuse existing DOM node if HMR recycled it
    const existing = document.getElementById('_char_menu_overlay');
    if (existing) {
      this.overlay = existing;
    } else {
      this.overlay = document.createElement('div');
      this.overlay.id = '_char_menu_overlay';
      Object.assign(this.overlay.style, {
        display: 'none',
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.65)',
        zIndex: '20000',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      });
      this.overlay.addEventListener('click', e => {
        if (e.target === this.overlay) this.close();
      });
      document.body.appendChild(this.overlay);
    }
  }

  open(stats: PlayerStats, xp: number, onClose: (s: PlayerStats) => void, equip: PlayerEquipment = {}) {
    this.stats = { ...stats };
    this.equip = { ...equip };
    this.xp = xp;
    this.onClose = onClose;
    this.render();
    this.overlay.style.display = 'flex';
  }

  close() {
    if (this.overlay.style.display === 'none') return;
    this.overlay.style.display = 'none';
    this.onClose({ ...this.stats });
  }

  isOpen(): boolean {
    return this.overlay.style.display !== 'none';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  private render() {
    this.overlay.innerHTML = '';

    const lvl   = getLevel(this.xp);
    const xpCur = this.xp - xpForLevel(lvl);
    const xpNxt = xpForLevel(lvl + 1) - xpForLevel(lvl);
    const pct   = Math.min(100, (xpCur / xpNxt) * 100);
    const avail = availablePoints(this.xp, this.stats);

    const panel = el('div', {
      background: '#0e1320',
      border: '2px solid #2a3142',
      borderRadius: '10px',
      padding: '18px 20px',
      width: 'min(390px, 96vw)',
      maxHeight: '90dvh',
      overflowY: 'auto',
      color: '#e6e8ee',
      boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
    });
    (panel.style as any).WebkitOverflowScrolling = 'touch';

    // ── Header ──
    const hdr = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' });
    const titleEl = el('span', { fontSize: '15px', fontWeight: '700', letterSpacing: '2px' });
    titleEl.textContent = 'CARACTÉRISTIQUES';
    const xBtn = btn('✕', { background: 'none', border: 'none', color: '#8b93a7', fontSize: '18px', cursor: 'pointer', padding: '8px', lineHeight: '1', minWidth: '44px', minHeight: '44px' });
    xBtn.onmouseenter = () => { xBtn.style.color = '#e6e8ee'; };
    xBtn.onmouseleave = () => { xBtn.style.color = '#8b93a7'; };
    xBtn.onclick = () => this.close();
    hdr.append(titleEl, xBtn);
    panel.appendChild(hdr);

    // ── Level / XP bar ──
    const lvlBox = el('div', { background: '#0b0f1a', border: '1px solid #1e2738', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' });
    lvlBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
        <span style="font-size:15px;font-weight:700;">Niveau&nbsp;<span style="color:#38bdf8;font-size:20px;">${lvl}</span></span>
        <span style="font-size:12px;color:#8b93a7;">${this.xp} XP &nbsp;·&nbsp; prochain : ${xpForLevel(lvl + 1)} XP</span>
      </div>
      <div style="height:7px;background:#1e2738;border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pct.toFixed(1)}%;background:linear-gradient(90deg,#38bdf8,#818cf8);border-radius:4px;transition:width .4s;"></div>
      </div>
    `;
    panel.appendChild(lvlBox);

    // ── Available points badge ──
    const ptsBadge = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: avail > 0 ? '#0f2318' : '#0b0f1a',
      border: `1px solid ${avail > 0 ? '#16a34a' : '#1e2738'}`,
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '18px',
      fontSize: '13px',
    });
    ptsBadge.innerHTML = `
      <span style="font-size:20px;">${avail > 0 ? '✨' : '⚙️'}</span>
      <span>Points à distribuer : </span>
      <strong style="font-size:17px;color:${avail > 0 ? '#4ade80' : '#6b7280'};">${avail}</strong>
      ${avail > 0 ? '<span style="color:#6b7280;font-size:11px;">— cliquez + pour dépenser</span>' : ''}
    `;
    panel.appendChild(ptsBadge);

    // Separator
    const sep = el('div', { borderTop: '1px solid #1e2738', marginBottom: '10px' });
    panel.appendChild(sep);

    // ── Stat rows ──
    for (const cfg of STAT_CFGS) {
      const val = this.stats[cfg.key];
      const canAdd = avail > 0;

      const row = el('div', {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '9px 2px',
        borderBottom: '1px solid #131929',
      });

      const ico = el('span', { fontSize: '17px', width: '26px', textAlign: 'center', flexShrink: '0' });
      ico.textContent = cfg.icon;

      const nameLbl = el('span', { fontSize: '13px', fontWeight: '600', minWidth: '62px', color: '#c8ccd6' });
      nameLbl.textContent = cfg.label;

      const descLbl = el('span', { fontSize: '11px', color: '#4a5568', flex: '1' });
      descLbl.textContent = cfg.desc;

      const valLbl = el('span', {
        minWidth: '30px',
        textAlign: 'center',
        fontWeight: '700',
        fontSize: '15px',
        color: val > 0 ? cfg.color : '#4a5568',
      });
      valLbl.textContent = String(val);

      const addBtn = btn('+', {
        width: '28px', height: '28px', borderRadius: '5px',
        fontWeight: '700', fontSize: '15px', lineHeight: '1',
        cursor: canAdd ? 'pointer' : 'default',
        background: canAdd ? '#0d2a1a' : '#0b0f1a',
        border: `1px solid ${canAdd ? '#16a34a' : '#1e2738'}`,
        color: canAdd ? '#4ade80' : '#374151',
      });
      addBtn.disabled = !canAdd;
      if (canAdd) {
        addBtn.onmouseenter = () => { addBtn.style.background = '#14391f'; };
        addBtn.onmouseleave = () => { addBtn.style.background = '#0d2a1a'; };
        addBtn.onclick = () => {
          if (availablePoints(this.xp, this.stats) <= 0) return;
          this.stats[cfg.key] += 1;
          this.render();
        };
      }

      row.append(ico, nameLbl, descLbl, valLbl, addBtn);
      panel.appendChild(row);
    }

    // ── Summary footer ──
    const foot = el('div', {
      marginTop: '16px',
      padding: '10px 14px',
      background: '#0b0f1a',
      borderRadius: '8px',
      fontSize: '12px',
      color: '#8b93a7',
      display: 'flex',
      gap: '18px',
      flexWrap: 'wrap',
    });
    const eb = getEquipBonuses(this.equip);
    const effHp  = maxHp(this.stats) + eb.hp;
    const effMag = maxMagic(this.stats) + eb.fluide;
    const effRes = this.stats.resistance + eb.resistance;
    const effPo  = this.stats.portee + eb.portee;
    const effPa  = maxPa(this.stats) + eb.pa;
    const effPm  = maxPm(this.stats) + eb.pm;
    const bonus = (n: number) => n > 0 ? `<span style="color:#4ade80;font-size:10px"> +${n}</span>` : '';
    foot.innerHTML = `
      <span>❤️ PV max&nbsp;: <strong style="color:#f87171;">${effHp}</strong>${bonus(eb.hp)}</span>
      <span>⚡ PA&nbsp;: <strong style="color:#fde047;">${effPa}</strong>${bonus(eb.pa)}</span>
      <span>👟 PM&nbsp;: <strong style="color:#a78bfa;">${effPm}</strong>${bonus(eb.pm)}</span>
      <span>💧 Magie&nbsp;: <strong style="color:#a855f7;">${effMag}</strong>${bonus(eb.fluide)}</span>
      <span>🎯 Portée&nbsp;: <strong style="color:#34d399;">${effPo}</strong>${bonus(eb.portee)}</span>
      <span>🛡️ Résist.&nbsp;: <strong style="color:#94a3b8;">${effRes}</strong>${bonus(eb.resistance)}</span>
      <span>📚 Bonus XP&nbsp;: <strong style="color:#c084fc;">+${this.stats.sagesse}&nbsp;%</strong></span>
    `;
    panel.appendChild(foot);

    // ── Panoply badges ──
    for (const p of PANOPLIES) {
      const prog = getPanoplyProgress(this.equip, p);
      const complete = isPanoplyComplete(this.equip, p);
      if (prog.count === 0) continue;
      const panoBox = el('div', {
        marginTop: '10px',
        padding: '8px 12px',
        background: complete ? '#0d2208' : '#0b0f1a',
        border: `1px solid ${complete ? '#22c55e' : '#1e2738'}`,
        borderRadius: '8px',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      });
      const star = el('span', { fontSize: '16px' });
      star.textContent = complete ? '✨' : '🔗';
      const info = el('div', { flex: '1' });
      const title = el('div', { fontWeight: '700', color: complete ? '#4ade80' : '#8b93a7', marginBottom: '2px' });
      title.textContent = `${p.name} — ${prog.count}/${prog.total}`;
      const bonusLine = el('div', { color: complete ? '#86efac' : '#4a5568' });
      const bonusParts: string[] = [];
      if (p.bonus.pa)  bonusParts.push(`+${p.bonus.pa} PA`);
      if (p.bonus.pm)  bonusParts.push(`+${p.bonus.pm} PM`);
      if (p.bonus.hp)  bonusParts.push(`+${p.bonus.hp} PV`);
      if (p.bonus.portee) bonusParts.push(`+${p.bonus.portee} Portée`);
      bonusLine.textContent = complete ? `✓ ${bonusParts.join(' · ')}` : bonusParts.join(' · ');
      info.append(title, bonusLine);
      panoBox.append(star, info);
      panel.appendChild(panoBox);
    }

    this.overlay.appendChild(panel);
  }
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function el(tag: string, styles: Partial<CSSStyleDeclaration> = {}): HTMLElement {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  return node;
}

function btn(text: string, styles: Partial<CSSStyleDeclaration> = {}): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  Object.assign(b.style, styles);
  return b;
}
