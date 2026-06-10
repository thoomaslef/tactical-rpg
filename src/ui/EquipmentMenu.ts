import {
  EquipSlot, Item, InventoryEntry, PlayerEquipment,
  ITEMS, RESOURCE_CATALOG, MAX_WEIGHT, emptyEquipment,
  getEquipBonuses, currentWeight, PANOPLIES, isPanoplyComplete, getPanoplyProgress,
} from '../game/items';

interface SlotDef { id: EquipSlot; label: string; icon: string; }

const SLOT_LAYOUT: (SlotDef | null)[][] = [
  [null,                                    { id: 'amulet',  label: 'Amulette', icon: '📿' }, { id: 'cape',    label: 'Cape',    icon: '🧣' }],
  [null,                                    { id: 'helmet',  label: 'Casque',   icon: '🪖' }, null],
  [{ id: 'weapon',  label: 'Arme',    icon: '⚔️'  }, { id: 'chest',   label: 'Torse',   icon: '🥋' }, { id: 'offhand', label: 'Second.',  icon: '🛡️' }],
  [{ id: 'ring1',   label: 'Anneau',  icon: '💍'  }, { id: 'legs',    label: 'Jambes',  icon: '👖' }, { id: 'ring2',   label: 'Anneau',  icon: '💍' }],
  [null,                                    { id: 'boots',   label: 'Bottes',   icon: '👟' }, null],
];

let _instance: EquipmentMenu | null = null;

export function getEquipmentMenu(): EquipmentMenu {
  if (!_instance) _instance = new EquipmentMenu();
  return _instance;
}

export class EquipmentMenu {
  private overlay: HTMLElement;
  private equip: PlayerEquipment = emptyEquipment();
  private inventory: InventoryEntry[] = [];
  private onClose: (e: PlayerEquipment, inv: InventoryEntry[]) => void = () => {};
  private slotSize = 64;

  constructor() {
    const existing = document.getElementById('_equip_menu_overlay');
    if (existing) {
      this.overlay = existing;
    } else {
      this.overlay = document.createElement('div');
      this.overlay.id = '_equip_menu_overlay';
      Object.assign(this.overlay.style, {
        display: 'none',
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.72)',
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

  open(equip: PlayerEquipment, inventory: InventoryEntry[], onClose: (e: PlayerEquipment, inv: InventoryEntry[]) => void) {
    this.equip = { ...equip };
    this.inventory = inventory.map(e => ({ ...e }));
    this.onClose = onClose;
    this.render();
    this.overlay.style.display = 'flex';
  }

  close() {
    if (this.overlay.style.display === 'none') return;
    this.overlay.style.display = 'none';
    this.onClose({ ...this.equip }, this.inventory.map(e => ({ ...e })));
  }

  isOpen(): boolean { return this.overlay.style.display !== 'none'; }

  // ── Équipement logic ──────────────────────────────────────────────────────

  private equipFromBag(itemId: string) {
    const item = ITEMS[itemId];
    if (!item) return;

    // Smart ring handling: if natural slot occupied, try the other ring slot
    let targetSlot: EquipSlot = item.slot;
    if (item.slot === 'ring1' && this.equip['ring1'] && !this.equip['ring2']) {
      targetSlot = 'ring2';
    } else if (item.slot === 'ring2' && this.equip['ring2'] && !this.equip['ring1']) {
      targetSlot = 'ring1';
    }

    // If target slot occupied, swap back to bag
    const prev = this.equip[targetSlot];
    if (prev) {
      const existing = this.inventory.find(e => e.id === prev);
      if (existing) existing.qty++;
      else this.inventory.push({ id: prev, qty: 1 });
    }

    // Remove one from inventory
    const entry = this.inventory.find(e => e.id === itemId);
    if (!entry) return;
    entry.qty--;
    if (entry.qty <= 0) this.inventory = this.inventory.filter(e => e.id !== itemId);

    this.equip[targetSlot] = itemId;
    this.render();
  }

  private unequipSlot(slot: EquipSlot) {
    const itemId = this.equip[slot];
    if (!itemId) return;
    delete this.equip[slot];
    const existing = this.inventory.find(e => e.id === itemId);
    if (existing) existing.qty++;
    else this.inventory.push({ id: itemId, qty: 1 });
    this.render();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  private render() {
    this.overlay.innerHTML = '';

    const isMobile = window.innerWidth < 640;
    const panel = el('div', {
      background: '#0e1320',
      border: '2px solid #2a3142',
      borderRadius: '12px',
      padding: isMobile ? '14px 14px' : '22px 24px',
      width: isMobile ? `${Math.min(window.innerWidth - 16, 400)}px` : '680px',
      maxHeight: '92dvh',
      overflowY: 'auto',
      color: '#e6e8ee',
      boxShadow: '0 28px 72px rgba(0,0,0,0.9)',
    });
    (panel.style as any).WebkitOverflowScrolling = 'touch';

    // ── Header ──
    const hdr = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' });
    const title = el('span', { fontSize: '15px', fontWeight: '700', letterSpacing: '2px' });
    title.textContent = 'ÉQUIPEMENT';
    const xBtn = btn('✕', { background: 'none', border: 'none', color: '#8b93a7', fontSize: '18px', cursor: 'pointer', padding: '8px', lineHeight: '1', minWidth: '44px', minHeight: '44px' });
    xBtn.onmouseenter = () => { xBtn.style.color = '#e6e8ee'; };
    xBtn.onmouseleave = () => { xBtn.style.color = '#8b93a7'; };
    xBtn.onclick = () => this.close();
    hdr.append(title, xBtn);
    panel.appendChild(hdr);

    // ── Body (two columns, stacked on mobile) ──
    const body = el('div', { display: 'flex', gap: isMobile ? '0' : '20px', flexDirection: isMobile ? 'column' : 'row' });

    // LEFT — slots
    const left = el('div', { width: isMobile ? '100%' : '224px', flexShrink: '0' });
    const leftTitle = el('div', { fontSize: '10px', color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' });
    leftTitle.textContent = 'Équipé';
    left.appendChild(leftTitle);

    this.slotSize = isMobile ? 52 : 64;
    // 3×5 grid
    const grid = el('div', {
      display: 'grid',
      gridTemplateColumns: `repeat(3, ${this.slotSize}px)`,
      gap: '5px',
    });

    for (const row of SLOT_LAYOUT) {
      for (const cell of row) {
        if (cell === null) {
          grid.appendChild(el('div', { width: `${this.slotSize}px`, height: `${this.slotSize}px` })); // spacer
        } else {
          grid.appendChild(this.makeSlot(cell));
        }
      }
    }
    left.appendChild(grid);

    // Equipment bonus summary
    const eb = getEquipBonuses(this.equip);
    const hasBonus = eb.hp > 0 || eb.fluide > 0 || eb.resistance > 0 || eb.portee > 0 || eb.pa > 0 || eb.pm > 0;
    if (hasBonus) {
      const bonusSep = el('div', { borderTop: '1px solid #1e2738', margin: '14px 0 10px' });
      left.appendChild(bonusSep);

      const bonusTitle = el('div', { fontSize: '10px', color: '#4a5568', letterSpacing: '1px', marginBottom: '6px' });
      bonusTitle.textContent = 'BONUS D\'ÉQUIPEMENT';
      left.appendChild(bonusTitle);

      const bonusRow = el('div', { display: 'flex', flexWrap: 'wrap', gap: '6px' });
      if (eb.hp)         bonusRow.appendChild(bonusBadge(`❤️ +${eb.hp} PV`, '#f87171', '#1c0808'));
      if (eb.fluide)     bonusRow.appendChild(bonusBadge(`💧 +${eb.fluide} Fluide`, '#a855f7', '#160d1e'));
      if (eb.portee)     bonusRow.appendChild(bonusBadge(`🎯 +${eb.portee} Portée`, '#34d399', '#062011'));
      if (eb.resistance) bonusRow.appendChild(bonusBadge(`🛡️ +${eb.resistance} Résist.`, '#94a3b8', '#111827'));
      if (eb.pa)         bonusRow.appendChild(bonusBadge(`⚡ +${eb.pa} PA`, '#fde047', '#1a1500'));
      if (eb.pm)         bonusRow.appendChild(bonusBadge(`👟 +${eb.pm} PM`, '#a78bfa', '#100d1e'));
      left.appendChild(bonusRow);
    }

    // Panoply progress
    const anyPanoVisible = PANOPLIES.some(p => getPanoplyProgress(this.equip, p).count > 0);
    if (anyPanoVisible) {
      const panoSep = el('div', { borderTop: '1px solid #1e2738', margin: '14px 0 10px' });
      left.appendChild(panoSep);
      const panoTitle = el('div', { fontSize: '10px', color: '#4a5568', letterSpacing: '1px', marginBottom: '8px' });
      panoTitle.textContent = 'PANOPLIES';
      left.appendChild(panoTitle);

      for (const p of PANOPLIES) {
        const prog = getPanoplyProgress(this.equip, p);
        if (prog.count === 0) continue;
        const complete = isPanoplyComplete(this.equip, p);
        const pBox = el('div', {
          background: complete ? '#0d2208' : '#0b0f1a',
          border: `1px solid ${complete ? '#22c55e44' : '#1e2738'}`,
          borderRadius: '6px',
          padding: '7px 9px',
          marginBottom: '6px',
        });
        const pRow = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' });
        const pName = el('span', { fontSize: '10px', fontWeight: '700', color: complete ? '#4ade80' : '#8b93a7' });
        pName.textContent = `${complete ? '✨ ' : ''}${p.name}`;
        const pCount = el('span', { fontSize: '10px', color: complete ? '#86efac' : '#4a5568' });
        pCount.textContent = `${prog.count}/${prog.total}`;
        pRow.append(pName, pCount);
        pBox.appendChild(pRow);

        // Progress bar
        const barBg2 = el('div', { height: '3px', background: '#1e2738', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' });
        const barFill2 = el('div', { height: '100%', borderRadius: '2px' });
        barFill2.style.width = `${(prog.count / prog.total) * 100}%`;
        barFill2.style.background = complete ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#374151,#6b7280)';
        barBg2.appendChild(barFill2);
        pBox.appendChild(barBg2);

        const bonusParts: string[] = [];
        if (p.bonus.pa)     bonusParts.push(`+${p.bonus.pa} PA`);
        if (p.bonus.pm)     bonusParts.push(`+${p.bonus.pm} PM`);
        if (p.bonus.portee) bonusParts.push(`+${p.bonus.portee} Portée`);
        if (p.bonus.hp)     bonusParts.push(`+${p.bonus.hp} PV`);
        const bonusText = el('div', { fontSize: '9px', color: complete ? '#86efac' : '#374151' });
        bonusText.textContent = bonusParts.join(' · ');
        pBox.appendChild(bonusText);
        left.appendChild(pBox);
      }
    }

    body.appendChild(left);

    // DIVIDER
    if (!isMobile) {
      body.appendChild(el('div', { width: '1px', background: '#1e2738', flexShrink: '0' }));
    } else {
      body.appendChild(el('div', { borderTop: '1px solid #1e2738', margin: '14px 0 10px' }));
    }

    // RIGHT — bag
    const right = el('div', { flex: '1', minWidth: '0' });

    const bagHdr = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' });
    const bagTitle = el('span', { fontSize: '13px', fontWeight: '700', color: '#e6e8ee' });
    bagTitle.textContent = '💼 SAC';
    const weight = currentWeight(this.equip, this.inventory);
    const weightEl = el('span', { fontSize: '11px', color: weight > MAX_WEIGHT * 0.8 ? '#f97316' : '#8b93a7' });
    weightEl.textContent = `${weight} / ${MAX_WEIGHT} ⚖️`;
    bagHdr.append(bagTitle, weightEl);
    right.appendChild(bagHdr);

    // Weight bar
    const barBg = el('div', { height: '5px', background: '#1e2738', borderRadius: '3px', overflow: 'hidden', marginBottom: '14px' });
    const barFill = el('div', { height: '100%', borderRadius: '3px', transition: 'width .3s' });
    const pct = Math.min(100, (weight / MAX_WEIGHT) * 100);
    barFill.style.width = `${pct}%`;
    barFill.style.background = pct > 80 ? 'linear-gradient(90deg,#f97316,#ef4444)' : 'linear-gradient(90deg,#a855f7,#6366f1)';
    barBg.appendChild(barFill);
    right.appendChild(barBg);

    right.appendChild(el('div', { borderTop: '1px solid #1e2738', marginBottom: '12px' }));

    // Split inventory: equippable vs resources
    const equipItems = this.inventory.filter(e => !!ITEMS[e.id]);
    const resourceItems = this.inventory.filter(e => !ITEMS[e.id]);

    // ── Équipement dans le sac ──
    if (equipItems.length === 0) {
      const empty = el('div', { textAlign: 'center', color: '#2a3142', fontSize: '12px', padding: '16px 0' });
      empty.textContent = 'Aucun équipement';
      right.appendChild(empty);
    } else {
      for (const entry of equipItems) {
        const card = this.makeItemCard(entry);
        if (card) right.appendChild(card);
      }
    }

    // ── Ressources ──
    const resSep = el('div', { borderTop: '1px solid #1e2738', margin: '14px 0 10px' });
    right.appendChild(resSep);

    const resTitle = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' });
    const resTitleLeft = el('span', { fontSize: '13px', fontWeight: '700', color: '#e6e8ee' });
    resTitleLeft.textContent = '🌿 RESSOURCES';
    const resCount = el('span', { fontSize: '11px', color: '#8b93a7' });
    resCount.textContent = `${resourceItems.length} type${resourceItems.length !== 1 ? 's' : ''}`;
    resTitle.append(resTitleLeft, resCount);
    right.appendChild(resTitle);

    if (resourceItems.length === 0) {
      const emptyRes = el('div', { textAlign: 'center', color: '#2a3142', fontSize: '12px', padding: '12px 0' });
      emptyRes.textContent = 'Aucune ressource';
      right.appendChild(emptyRes);
    } else {
      const resGrid = el('div', { display: 'flex', flexWrap: 'wrap', gap: '8px' });
      for (const entry of resourceItems) {
        const res = RESOURCE_CATALOG[entry.id];
        const name = res?.name ?? entry.id;
        const icon = res?.icon ?? '📦';
        const chip = el('div', {
          display: 'flex', alignItems: 'center', gap: '7px',
          background: '#0b0f1a', border: '1px solid #1e2738',
          borderRadius: '8px', padding: '8px 10px',
        });
        const chipIcon = el('span', { fontSize: '18px' });
        chipIcon.textContent = icon;
        const chipInfo = el('div', {});
        const chipName = el('div', { fontSize: '12px', fontWeight: '600', color: '#c8ccd6' });
        chipName.textContent = name;
        const chipQty = el('div', { fontSize: '11px', color: '#4ade80', fontWeight: '700' });
        chipQty.textContent = `×${entry.qty}`;
        chipInfo.append(chipName, chipQty);
        chip.append(chipIcon, chipInfo);
        resGrid.appendChild(chip);
      }
      right.appendChild(resGrid);
    }

    body.appendChild(right);
    panel.appendChild(body);

    // Footer hint
    const foot = el('div', { marginTop: '16px', fontSize: '11px', color: '#2a3142', textAlign: 'center' });
    foot.textContent = '[E] pour ouvrir/fermer · Clic sur un slot équipé pour déséquiper';
    panel.appendChild(foot);

    this.overlay.appendChild(panel);
  }

  private makeSlot(def: SlotDef): HTMLElement {
    const equippedId = this.equip[def.id];
    const item: Item | undefined = equippedId ? ITEMS[equippedId] : undefined;
    const sz = `${this.slotSize}px`;

    const box = el('div', {
      width: sz, height: sz,
      background: item ? '#131929' : '#080c14',
      border: `1px ${item ? 'solid #5b5fef' : 'dashed #1e2738'}`,
      borderRadius: '8px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      cursor: item ? 'pointer' : 'default',
      position: 'relative',
      userSelect: 'none',
    });

    if (item) {
      const iconEl = el('span', { fontSize: '22px', lineHeight: '1', marginBottom: '3px' });
      iconEl.textContent = item.icon;
      const nameEl = el('span', { fontSize: '8px', color: '#a5b4fc', textAlign: 'center', lineHeight: '1.2', padding: '0 2px' });
      nameEl.textContent = item.name;
      box.append(iconEl, nameEl);

      // Unequip indicator (top-right corner)
      const badge = el('span', {
        position: 'absolute', top: '2px', right: '3px',
        fontSize: '8px', color: '#6366f1', fontWeight: '700',
      });
      badge.textContent = '✕';
      box.appendChild(badge);

      box.title = `${item.name} — ${item.description}\nClic : déséquiper`;
      box.onmouseenter = () => { box.style.borderColor = '#818cf8'; box.style.background = '#1c2035'; };
      box.onmouseleave = () => { box.style.borderColor = '#5b5fef'; box.style.background = '#131929'; };
      box.onclick = () => this.unequipSlot(def.id);
    } else {
      const iconEl = el('span', { fontSize: '20px', opacity: '0.18', lineHeight: '1', marginBottom: '2px' });
      iconEl.textContent = def.icon;
      const labelEl = el('span', { fontSize: '8px', color: '#1e2738', textAlign: 'center' });
      labelEl.textContent = def.label;
      box.append(iconEl, labelEl);
    }

    return box;
  }

  private makeItemCard(entry: InventoryEntry): HTMLElement | null {
    const item = ITEMS[entry.id];
    if (!item) return null;

    const card = el('div', {
      display: 'flex', alignItems: 'center', gap: '12px',
      background: '#0b0f1a', border: '1px solid #1e2738',
      borderRadius: '8px', padding: '10px 12px', marginBottom: '8px',
    });

    const iconBox = el('div', {
      width: '46px', height: '46px', flexShrink: '0',
      background: '#131929', borderRadius: '8px',
      border: '1px solid #2a3142',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '22px',
    });
    iconBox.textContent = item.icon;

    const info = el('div', { flex: '1', minWidth: '0' });
    const nameLine = el('div', { fontSize: '13px', fontWeight: '700', color: '#e6e8ee', marginBottom: '4px' });
    nameLine.textContent = entry.qty > 1 ? `${item.name} ×${entry.qty}` : item.name;

    const statLine = el('div', { fontSize: '11px', display: 'flex', gap: '8px', flexWrap: 'wrap' });
    if (item.bonuses.hp)         statLine.appendChild(statTag(`❤️ +${item.bonuses.hp} PV`,      '#f87171', '#1c0808'));
    if (item.bonuses.fluide)     statLine.appendChild(statTag(`💧 +${item.bonuses.fluide} Fluide`, '#a855f7', '#160d1e'));
    if (item.bonuses.resistance) statLine.appendChild(statTag(`🛡️ +${item.bonuses.resistance} Résist.`, '#94a3b8', '#111827'));
    statLine.appendChild(statTag(`⚖️ ${item.weight}`, '#4a5568', '#0b0f1a'));
    info.append(nameLine, statLine);

    // Check if equippable (slot free or will swap)
    const equipBtn = btn('Équiper', {
      background: '#0d2a1a', border: '1px solid #16a34a', borderRadius: '6px',
      color: '#4ade80', fontWeight: '700', fontSize: '12px',
      padding: '7px 14px', cursor: 'pointer', flexShrink: '0',
      whiteSpace: 'nowrap',
    });
    equipBtn.onmouseenter = () => { equipBtn.style.background = '#14391f'; };
    equipBtn.onmouseleave = () => { equipBtn.style.background = '#0d2a1a'; };
    equipBtn.onclick = () => this.equipFromBag(item.id);

    card.append(iconBox, info, equipBtn);
    return card;
  }
}

// ── DOM helpers ────────────────────────────────────────────────────────────────

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

function bonusBadge(text: string, color: string, bg: string): HTMLElement {
  const b = el('span', { fontSize: '11px', fontWeight: '700', color, background: bg, border: `1px solid ${color}44`, borderRadius: '4px', padding: '2px 7px' });
  b.textContent = text;
  return b;
}

function statTag(text: string, color: string, bg: string): HTMLElement {
  const t = el('span', { color, background: bg, border: `1px solid ${color}33`, borderRadius: '4px', padding: '1px 5px', fontSize: '11px' });
  t.textContent = text;
  return t;
}
