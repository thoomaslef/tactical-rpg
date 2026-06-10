import {
  PlayerStats, emptyStats,
  getLevel, xpForLevel,
  availablePoints, usedPoints, maxHp, maxPa, maxPm, maxMagic, effectiveResistance, finalDamagePercent,
} from '../game/stats';
import { PlayerEquipment, emptyEquipment, getEquipBonuses, PANOPLIES, isPanoplyComplete, getPanoplyProgress } from '../game/items';

interface StatCfg {
  key: keyof PlayerStats;
  label: string;
  icon: string;
  desc: string;
  color: string;
  /** Si true, la stat ne peut pas être augmentée manuellement */
  readOnly?: boolean;
}

const STAT_CFGS: StatCfg[] = [
  { key: 'vitalite',   label: 'Vitalité', icon: '❤️',  desc: '+1 PV maximum',         color: '#f87171' },
  { key: 'sagesse',    label: 'Sagesse',  icon: '📚',  desc: '+1 % bonus XP',         color: '#c084fc' },
  { key: 'fluide',     label: 'Fluide',   icon: '💧',  desc: '+1 Fluide max par 5 pts', color: '#a855f7' },
  { key: 'eau',        label: 'EAU',      icon: '🌊',  desc: 'Sorts Eau + %',              color: '#7dd3fc' },
  { key: 'feu',        label: 'FEU',      icon: '🔥',  desc: 'Sorts Feu + %',              color: '#fb923c' },
  { key: 'air',        label: 'AIR',      icon: '🌪️', desc: 'Sorts Air + %',              color: '#bef264' },
  { key: 'terre',      label: 'TERRE',    icon: '🌿',  desc: 'Sorts Terre + %',            color: '#84cc16' },
  { key: 'psy',        label: 'PSY',      icon: '🔮',  desc: 'Sorts Psy + %',              color: '#e879f9' },
  { key: 'glace',      label: 'GLACE',    icon: '❄️',  desc: 'Sorts Glace + %',            color: '#67e8f9' },
  { key: 'electrik',   label: 'ÉLECTRIK', icon: '⚡',  desc: 'Sorts Électrik + %',         color: '#facc15' },
  { key: 'soin',       label: 'Soin',     icon: '💚',  desc: 'Bonus soins + %',            color: '#4ade80' },
  { key: 'resistance', label: 'Résist.',  icon: '🛡️', desc: '-1 dégât reçu / 3 pts',     color: '#94a3b8' },
  { key: 'chance',     label: 'Chance',   icon: '🍀',  desc: '+1 % taux de drop / pt',     color: '#34d399' },
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

    // ── Available points badge + reset button ──
    const ptsBadge = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: avail > 0 ? '#0f2318' : '#0b0f1a',
      border: `1px solid ${avail > 0 ? '#16a34a' : '#1e2738'}`,
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '12px',
      fontSize: '13px',
    });
    ptsBadge.innerHTML = `
      <span style="font-size:20px;">${avail > 0 ? '✨' : '⚙️'}</span>
      <span>Points à distribuer : </span>
      <strong style="font-size:17px;color:${avail > 0 ? '#4ade80' : '#6b7280'};">${avail}</strong>
      ${avail > 0 ? '<span style="color:#6b7280;font-size:11px;">— cliquez + pour dépenser</span>' : ''}
    `;
    panel.appendChild(ptsBadge);

    // ── Reset button ──
    const totalSpent = usedPoints(this.stats);
    const resetRow = el('div', { display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' });
    const resetBtn = btn('↺ Réinitialiser les stats', {
      background: totalSpent > 0 ? '#1a0f0f' : '#0b0f1a',
      border: `1px solid ${totalSpent > 0 ? '#7f1d1d' : '#1e2738'}`,
      color: totalSpent > 0 ? '#f87171' : '#374151',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '600',
      padding: '6px 12px',
      cursor: totalSpent > 0 ? 'pointer' : 'default',
    });
    resetBtn.disabled = totalSpent === 0;
    if (totalSpent > 0) {
      resetBtn.onmouseenter = () => { resetBtn.style.background = '#2d1010'; resetBtn.style.borderColor = '#ef4444'; };
      resetBtn.onmouseleave = () => { resetBtn.style.background = '#1a0f0f'; resetBtn.style.borderColor = '#7f1d1d'; };
      resetBtn.onclick = () => {
        (Object.keys(this.stats) as (keyof PlayerStats)[]).forEach(k => { this.stats[k] = 0; });
        this.render();
      };
    }
    resetRow.appendChild(resetBtn);
    panel.appendChild(resetRow);

    // Separator
    const sep = el('div', { borderTop: '1px solid #1e2738', marginBottom: '10px' });
    panel.appendChild(sep);

    // ── Stat rows ──
    for (const cfg of STAT_CFGS) {
      const val = this.stats[cfg.key];
      const canAdd = avail > 0 && !cfg.readOnly;

      const row = el('div', {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '9px 2px',
        borderBottom: '1px solid #131929',
        opacity: cfg.readOnly ? '0.65' : '1',
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

      if (cfg.readOnly) {
        // Stat verrouillée : affiche un cadenas à la place du bouton +
        const lockEl = el('span', {
          width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', flexShrink: '0',
        });
        lockEl.textContent = '🔒';
        lockEl.title = 'Ne peut pas être augmenté manuellement';
        row.append(ico, nameLbl, descLbl, valLbl, lockEl);
      } else {
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
      }

      panel.appendChild(row);
    }

    // ── Summary footer ──
    const eb = getEquipBonuses(this.equip);
    const effHp  = maxHp(this.stats, lvl) + eb.hp;
    const effMag = maxMagic(this.stats) + eb.fluide;
    const effRes = effectiveResistance(this.stats) + eb.resistance;
    const effPo  = this.stats.portee + eb.portee;
    const effPa  = maxPa(this.stats) + eb.pa;
    const effPm  = maxPm(this.stats) + eb.pm;
    const lvlDmgPct = finalDamagePercent(lvl);
    const dropChancePct = Math.min(90, 10 + this.stats.chance);

    const foot = el('div', { marginTop: '16px' });

    // Helper : titre de section
    const secTitle = (label: string) => {
      const t = el('div', {
        fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px',
        color: '#4a5568', textTransform: 'uppercase', marginBottom: '6px',
        marginTop: '12px',
      });
      t.textContent = label;
      return t;
    };

    // Helper : grille de stats
    const statGrid = (items: { icon: string; label: string; value: string; color: string; sub?: string }[]) => {
      const grid = el('div', {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '5px',
      });
      for (const item of items) {
        const cell = el('div', {
          background: '#0b0f1a',
          border: '1px solid #1e2738',
          borderRadius: '6px',
          padding: '6px 8px',
          fontSize: '11px',
          color: '#6b7280',
        });
        cell.innerHTML = `
          <div style="margin-bottom:2px;">${item.icon} ${item.label}</div>
          <div style="font-size:15px;font-weight:700;color:${item.color};">${item.value}</div>
          ${item.sub ? `<div style="font-size:9px;color:#4ade80;margin-top:1px;">${item.sub}</div>` : ''}
        `;
        grid.appendChild(cell);
      }
      return grid;
    };

    // ── Section Combat ──
    foot.appendChild(secTitle('Combat'));
    foot.appendChild(statGrid([
      { icon: '❤️', label: 'PV max',     value: String(effHp),  color: '#f87171', sub: eb.hp > 0 ? `+${eb.hp} équip.` : '' },
      { icon: '⚡', label: 'PA',          value: String(effPa),  color: '#fde047', sub: eb.pa > 0 ? `+${eb.pa} équip.` : '' },
      { icon: '👟', label: 'PM',          value: String(effPm),  color: '#a78bfa', sub: eb.pm > 0 ? `+${eb.pm} équip.` : '' },
      { icon: '🎯', label: 'Portée',      value: String(effPo),  color: '#34d399', sub: eb.portee > 0 ? `+${eb.portee} équip.` : '' },
      { icon: '🛡️', label: 'Résistance', value: String(effRes), color: '#94a3b8', sub: eb.resistance > 0 ? `+${eb.resistance} équip.` : '' },
      { icon: '💧', label: 'Fluide max',  value: String(effMag), color: '#a855f7', sub: eb.fluide > 0 ? `+${eb.fluide} équip.` : '' },
    ]));

    // ── Section Dégâts ──
    foot.appendChild(secTitle('Dégâts & Éléments'));
    foot.appendChild(statGrid([
      { icon: '💥', label: 'Finaux',   value: `+${lvlDmgPct} %`, color: '#fb923c', sub: `nv ${lvl}` },
      { icon: '🌊', label: 'Eau',      value: String(this.stats.eau),                   color: '#7dd3fc' },
      { icon: '🔥', label: 'Feu',      value: String(this.stats.feu + eb.feu),          color: '#fb923c', sub: eb.feu   > 0 ? `+${eb.feu} équip.`   : '' },
      { icon: '🌪️', label: 'Air',     value: String(this.stats.air),                   color: '#bef264' },
      { icon: '🌿', label: 'Terre',    value: String(this.stats.terre + eb.terre),      color: '#84cc16', sub: eb.terre > 0 ? `+${eb.terre} équip.` : '' },
      { icon: '🔮', label: 'Psy',      value: String(this.stats.psy),                   color: '#e879f9' },
      { icon: '❄️', label: 'Glace',   value: String(this.stats.glace),                 color: '#67e8f9' },
      { icon: '⚡', label: 'Électrik', value: String(this.stats.electrik),              color: '#facc15' },
      { icon: '💚', label: 'Soin',     value: String(this.stats.soin),                  color: '#4ade80' },
    ]));

    // ── Section Utilitaires ──
    foot.appendChild(secTitle('Utilitaires'));
    foot.appendChild(statGrid([
      { icon: '📚', label: 'Bonus XP',   value: `+${this.stats.sagesse} %`, color: '#c084fc' },
      { icon: '🍀', label: 'Drop',       value: `${dropChancePct} %`,       color: '#34d399' },
      { icon: '🍀', label: 'Chance pts', value: String(this.stats.chance),  color: '#34d399' },
    ]));

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
