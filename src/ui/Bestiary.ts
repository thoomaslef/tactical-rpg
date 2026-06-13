import { MONSTER_DROPS, GENERIC_DROPS, MonsterDef } from '../game/drops';
import { ITEMS, RESOURCE_CATALOG } from '../game/items';

type Tab = 'monsters' | 'items';

let _instance: Bestiary | null = null;
export function getBestiary(): Bestiary {
  if (!_instance) _instance = new Bestiary();
  return _instance;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Partial<CSSStyleDeclaration> = {},
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e.style, styles);
  return e;
}

function pct(chance: number): string {
  return chance === 1 ? '100%' : `${Math.round(chance * 100)} %`;
}

function pctColor(chance: number): string {
  if (chance >= 1)   return '#4ade80';
  if (chance >= 0.5) return '#facc15';
  if (chance >= 0.2) return '#fb923c';
  return '#f87171';
}

export class Bestiary {
  private overlay: HTMLDivElement | null = null;
  private _open = false;
  private activeTab: Tab = 'monsters';
  private selectedMonster: MonsterDef | null = null;
  private selectedItemId: string | null = null;
  onClose: () => void = () => {};

  isOpen() { return this._open; }

  open(onClose: () => void = () => {}) {
    if (this._open) { this.close(); return; }
    this.onClose = onClose;
    this._open = true;
    this.selectedMonster = null;
    this.selectedItemId = null;
    this.render();
  }

  close() {
    this.overlay?.remove();
    this.overlay = null;
    this._open = false;
    this.onClose();
  }

  private render() {
    this.overlay?.remove();

    const overlay = el('div', {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '9999', fontFamily: 'monospace',
    });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) this.close(); });
    this.overlay = overlay;

    const panel = el('div', {
      background: '#0e1320', border: '1px solid #1e2738', borderRadius: '14px',
      width: '700px', maxWidth: '96vw', maxHeight: '85vh',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
    });

    // ── Header ──
    const header = el('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px 12px', borderBottom: '1px solid #1e2738', flexShrink: '0',
    });
    const title = el('span', { fontSize: '16px', fontWeight: '700', color: '#e6e8ee', letterSpacing: '2px' });
    title.textContent = '📖  BESTIAIRE';
    const closeBtn = el('button', {
      background: 'none', border: 'none', color: '#6b7280', fontSize: '20px', cursor: 'pointer', lineHeight: '1',
    });
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => this.close();
    header.append(title, closeBtn);

    // ── Tabs ──
    const tabs = el('div', {
      display: 'flex', gap: '8px', padding: '10px 20px 0', borderBottom: '1px solid #1e2738', flexShrink: '0',
    });
    const makeTab = (label: string, tab: Tab) => {
      const t = el('button', {
        background: 'none', border: 'none', borderBottom: this.activeTab === tab ? '2px solid #38bdf8' : '2px solid transparent',
        color: this.activeTab === tab ? '#38bdf8' : '#6b7280',
        fontSize: '13px', fontWeight: '700', fontFamily: 'monospace',
        padding: '6px 12px 8px', cursor: 'pointer', letterSpacing: '1px',
      });
      t.textContent = label;
      t.onclick = () => { this.activeTab = tab; this.selectedMonster = null; this.selectedItemId = null; this.render(); };
      return t;
    };
    tabs.append(makeTab('🐾  MONSTRES', 'monsters'), makeTab('📦  ITEMS', 'items'));

    // ── Body ──
    const body = el('div', { display: 'flex', flex: '1', overflow: 'hidden', minHeight: '0' });

    if (this.activeTab === 'monsters') {
      body.append(this.buildMonsterList(), this.buildMonsterDetail());
    } else {
      body.append(this.buildItemList(), this.buildItemDetail());
    }

    panel.append(header, tabs, body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // ── Monster list ──────────────────────────────────────────────────────────

  private buildMonsterList(): HTMLElement {
    const list = el('div', {
      width: '220px', flexShrink: '0', overflowY: 'auto',
      borderRight: '1px solid #1e2738', padding: '10px 8px',
    });

    const allMonsters: (MonsterDef | { name: string; icon: string; isGeneric: true })[] = [
      ...MONSTER_DROPS,
      { name: 'Tout monstre (non-boss)', icon: '🌍', isGeneric: true },
    ];

    for (const mon of allMonsters) {
      const isSelected = this.selectedMonster?.name === mon.name;

      const card = el('div', {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '3px',
        background: isSelected ? '#132240' : 'transparent',
        border: `1px solid ${isSelected ? '#38bdf8' : 'transparent'}`,
        transition: 'background 0.15s',
      });

      const icon = el('span', { fontSize: '20px', lineHeight: '1' });
      icon.textContent = mon.icon;

      const info = el('div', { flex: '1' });
      const name = el('div', { fontSize: '13px', fontWeight: '700', color: '#e6e8ee' });
      name.textContent = mon.name;
      const drops = el('div', { fontSize: '10px', color: '#6b7280', marginTop: '1px' });
      drops.textContent = 'isGeneric' in mon
        ? `${GENERIC_DROPS.length} drops`
        : `${mon.drops.length} drop${mon.drops.length > 1 ? 's' : ''}`;
      info.append(name, drops);
      card.append(icon, info);

      card.addEventListener('mouseenter', () => { if (!isSelected) card.style.background = '#0f1929'; });
      card.addEventListener('mouseleave', () => { if (!isSelected) card.style.background = 'transparent'; });
      card.onclick = () => {
        this.selectedMonster = 'isGeneric' in mon ? { name: mon.name, icon: mon.icon, drops: GENERIC_DROPS } : mon;
        this.selectedItemId = null;
        this.render();
      };

      list.appendChild(card);
    }
    return list;
  }

  private buildMonsterDetail(): HTMLElement {
    const detail = el('div', { flex: '1', overflowY: 'auto', padding: '16px 20px' });

    if (!this.selectedMonster) {
      const hint = el('div', { color: '#4a5568', fontSize: '13px', marginTop: '40px', textAlign: 'center' });
      hint.textContent = '← Sélectionne un monstre';
      detail.appendChild(hint);
      return detail;
    }

    const mon = this.selectedMonster;

    const hdr = el('div', { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' });
    const ico = el('span', { fontSize: '36px' });
    ico.textContent = mon.icon;
    const nme = el('div', { fontSize: '18px', fontWeight: '700', color: '#e6e8ee' });
    nme.textContent = mon.name;
    hdr.append(ico, nme);
    detail.appendChild(hdr);

    const sec = el('div', { fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', color: '#4a5568', textTransform: 'uppercase', marginBottom: '10px' });
    sec.textContent = 'Butin';
    detail.appendChild(sec);

    if (mon.drops.length === 0) {
      const empty = el('div', { color: '#4a5568', fontSize: '12px' });
      empty.textContent = 'Aucun drop.';
      detail.appendChild(empty);
      return detail;
    }

    for (const drop of mon.drops) {
      const itemDef = ITEMS[drop.itemId] ?? null;
      const resDef  = RESOURCE_CATALOG[drop.itemId] ?? null;
      const itemName = itemDef?.name ?? resDef?.name ?? drop.itemId;
      const itemIcon = itemDef?.icon ?? resDef?.icon ?? '❓';

      const row = el('div', {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '9px 12px', borderRadius: '8px', marginBottom: '4px',
        background: '#0b0f1a', border: '1px solid #1e2738',
      });

      const icoEl = el('span', { fontSize: '18px', minWidth: '24px', textAlign: 'center' });
      icoEl.textContent = itemIcon;

      const nameEl = el('div', { flex: '1', fontSize: '13px', color: '#cbd5e1', fontWeight: '600' });
      nameEl.textContent = itemName;

      const descEl = itemDef?.description
        ? (() => { const d = el('div', { fontSize: '10px', color: '#4a5568', marginTop: '1px' }); d.textContent = itemDef.description; return d; })()
        : null;

      const nameWrap = el('div', { flex: '1' });
      nameWrap.appendChild(nameEl);
      if (descEl) nameWrap.appendChild(descEl);

      const chanceEl = el('div', {
        fontSize: '14px', fontWeight: '700',
        color: pctColor(drop.chance), minWidth: '44px', textAlign: 'right',
      });
      chanceEl.textContent = pct(drop.chance);

      row.append(icoEl, nameWrap, chanceEl);
      detail.appendChild(row);
    }

    return detail;
  }

  // ── Item list ─────────────────────────────────────────────────────────────

  private buildItemList(): HTMLElement {
    const list = el('div', {
      width: '220px', flexShrink: '0', overflowY: 'auto',
      borderRight: '1px solid #1e2738', padding: '10px 8px',
    });

    // Build unique list of droppable items
    const droppableIds = new Set<string>();
    for (const mon of MONSTER_DROPS) for (const d of mon.drops) droppableIds.add(d.itemId);
    for (const d of GENERIC_DROPS) droppableIds.add(d.itemId);

    for (const itemId of droppableIds) {
      const itemDef = ITEMS[itemId] ?? null;
      const resDef  = RESOURCE_CATALOG[itemId] ?? null;
      const itemName = itemDef?.name ?? resDef?.name ?? itemId;
      const itemIcon = itemDef?.icon ?? resDef?.icon ?? '❓';

      const isSelected = this.selectedItemId === itemId;

      const card = el('div', {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '3px',
        background: isSelected ? '#132240' : 'transparent',
        border: `1px solid ${isSelected ? '#38bdf8' : 'transparent'}`,
      });

      const ico = el('span', { fontSize: '18px', lineHeight: '1' });
      ico.textContent = itemIcon;
      const name = el('div', { fontSize: '12px', fontWeight: '700', color: '#e6e8ee' });
      name.textContent = itemName;
      card.append(ico, name);

      card.addEventListener('mouseenter', () => { if (!isSelected) card.style.background = '#0f1929'; });
      card.addEventListener('mouseleave', () => { if (!isSelected) card.style.background = 'transparent'; });
      card.onclick = () => { this.selectedItemId = itemId; this.selectedMonster = null; this.render(); };

      list.appendChild(card);
    }

    return list;
  }

  private buildItemDetail(): HTMLElement {
    const detail = el('div', { flex: '1', overflowY: 'auto', padding: '16px 20px' });

    if (!this.selectedItemId) {
      const hint = el('div', { color: '#4a5568', fontSize: '13px', marginTop: '40px', textAlign: 'center' });
      hint.textContent = '← Sélectionne un item';
      detail.appendChild(hint);
      return detail;
    }

    const id = this.selectedItemId;
    const itemDef = ITEMS[id] ?? null;
    const resDef  = RESOURCE_CATALOG[id] ?? null;
    const itemName = itemDef?.name ?? resDef?.name ?? id;
    const itemIcon = itemDef?.icon ?? resDef?.icon ?? '❓';

    // Header
    const hdr = el('div', { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' });
    const icoEl = el('span', { fontSize: '32px' });
    icoEl.textContent = itemIcon;
    const titleWrap = el('div');
    const nameEl = el('div', { fontSize: '17px', fontWeight: '700', color: '#e6e8ee' });
    nameEl.textContent = itemName;
    titleWrap.appendChild(nameEl);
    if (itemDef?.description) {
      const desc = el('div', { fontSize: '11px', color: '#6b7280', marginTop: '2px' });
      desc.textContent = itemDef.description;
      titleWrap.appendChild(desc);
    }
    hdr.append(icoEl, titleWrap);
    detail.appendChild(hdr);

    const sec = el('div', { fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', color: '#4a5568', textTransform: 'uppercase', margin: '14px 0 10px' });
    sec.textContent = 'Droppé par';
    detail.appendChild(sec);

    // Find all sources
    const sources: { monsterName: string; icon: string; chance: number }[] = [];

    for (const mon of MONSTER_DROPS) {
      const drop = mon.drops.find(d => d.itemId === id);
      if (drop) sources.push({ monsterName: mon.name, icon: mon.icon, chance: drop.chance });
    }

    const genericDrop = GENERIC_DROPS.find(d => d.itemId === id);
    if (genericDrop) {
      sources.push({ monsterName: 'Tout monstre (non-boss)', icon: '🌍', chance: genericDrop.chance });
    }

    if (sources.length === 0) {
      const none = el('div', { color: '#4a5568', fontSize: '12px' });
      none.textContent = 'Aucun monstre connu.';
      detail.appendChild(none);
      return detail;
    }

    for (const src of sources) {
      const row = el('div', {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '9px 12px', borderRadius: '8px', marginBottom: '4px',
        background: '#0b0f1a', border: '1px solid #1e2738',
      });

      const ico = el('span', { fontSize: '20px', minWidth: '28px', textAlign: 'center' });
      ico.textContent = src.icon;

      const nameEl = el('div', { flex: '1', fontSize: '13px', color: '#cbd5e1', fontWeight: '600' });
      nameEl.textContent = src.monsterName;

      const chanceEl = el('div', {
        fontSize: '14px', fontWeight: '700',
        color: pctColor(src.chance), minWidth: '44px', textAlign: 'right',
      });
      chanceEl.textContent = pct(src.chance);

      row.append(ico, nameEl, chanceEl);
      detail.appendChild(row);
    }

    return detail;
  }
}
