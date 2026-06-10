import { InventoryEntry, ITEMS, RESOURCE_CATALOG } from '../game/items';

// ── Catalogue achat (items proposés par le marchand) ──────────────────────────
const BUY_CATALOG: { id: string; price: number }[] = [
  { id: 'casque_fer',    price: 1000 },
  { id: 'torse_fer',     price: 1000 },
  { id: 'jambieres_fer', price: 1000 },
  { id: 'bottes_fer',    price: 1000 },
  { id: 'bouclier_fer',  price: 1000 },
  { id: 'anneau_fer',    price: 1000 },
  { id: 'amulette_fer',  price: 1000 },
  { id: 'cape_fer',      price: 1000 },
];

// ── Prix de revente acceptés par le marchand ──────────────────────────────────
const SELL_PRICES: Record<string, number> = {
  rat_fur:          70,
  cuir_rumineuse:  150,
  psylo:              360,
  defense_defoncier:  666,
  casque_fer:    100,
  torse_fer:     100,
  jambieres_fer: 100,
  bottes_fer:    100,
  bouclier_fer:  100,
  anneau_fer:    100,
  amulette_fer:  100,
  cape_fer:      100,
};

// ── Singleton ─────────────────────────────────────────────────────────────────

let _instance: ShopModal | null = null;
export function getShopModal(): ShopModal {
  if (!_instance) _instance = new ShopModal();
  return _instance;
}

export class ShopModal {
  private overlay: HTMLDivElement | null = null;
  private _isOpen = false;
  private inv: InventoryEntry[] = [];
  private gold = 0;
  private onClose: ((inv: InventoryEntry[], gold: number) => void) | null = null;
  private activeTab: 'buy' | 'sell' = 'buy';

  isOpen(): boolean { return this._isOpen; }

  open(
    inventory: InventoryEntry[],
    gold: number,
    onCloseCb: (inv: InventoryEntry[], gold: number) => void,
  ): void {
    this._cleanup(false);
    this.inv     = inventory.map(e => ({ ...e }));
    this.gold    = gold;
    this.onClose = onCloseCb;
    this._isOpen = true;
    this.activeTab = 'buy';
    this._render();
  }

  close(): void { this._cleanup(true); }

  private _cleanup(fire: boolean): void {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    this._isOpen = false;
    if (fire && this.onClose) {
      this.onClose([...this.inv], this.gold);
      this.onClose = null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _label(id: string): { name: string; icon: string } {
    if (ITEMS[id])            return { name: ITEMS[id].name,            icon: ITEMS[id].icon };
    if (RESOURCE_CATALOG[id]) return { name: RESOURCE_CATALOG[id].name, icon: RESOURCE_CATALOG[id].icon };
    return { name: id, icon: '📦' };
  }

  private _qty(id: string): number {
    return this.inv.find(e => e.id === id)?.qty ?? 0;
  }

  private _addToInv(id: string, qty: number): void {
    const e = this.inv.find(e => e.id === id);
    if (e) e.qty += qty; else this.inv.push({ id, qty });
  }

  private _removeFromInv(id: string, qty: number): void {
    const e = this.inv.find(e => e.id === id);
    if (!e) return;
    e.qty -= qty;
    if (e.qty <= 0) this.inv = this.inv.filter(x => x.id !== id);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  private _buy(id: string, price: number): void {
    if (this.gold < price) return;
    this.gold -= price;
    this._addToInv(id, 1);
    this._render();
  }

  private _sellOne(id: string, price: number): void {
    if (this._qty(id) < 1) return;
    this._removeFromInv(id, 1);
    this.gold += price;
    this._render();
  }

  private _sellAll(id: string, price: number): void {
    const qty = this._qty(id);
    if (qty < 1) return;
    this._removeFromInv(id, qty);
    this.gold += price * qty;
    this._render();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  private _render(): void {
    if (this.overlay) this.overlay.remove();

    const overlay = el('div', {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20000', fontFamily: "'Segoe UI', system-ui, sans-serif",
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    this.overlay = overlay;

    const panel = el('div', {
      background: '#0e1320',
      border: '2px solid #2a3142',
      borderRadius: '12px',
      padding: '18px 20px',
      width: 'min(460px, 96vw)',
      maxHeight: '88dvh',
      overflowY: 'auto',
      color: '#e6e8ee',
      boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
    });

    // ── Header ──
    const hdr = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' });
    const title = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
    const icon = el('span', { fontSize: '20px' }); icon.textContent = '🛒';
    const name = el('span', { fontSize: '15px', fontWeight: '700', letterSpacing: '2px' });
    name.textContent = 'MARCHAND';
    title.append(icon, name);

    const goldBadge = el('span', {
      fontSize: '13px', fontWeight: '700', color: '#fde047',
      background: '#1a1400', border: '1px solid #fde04755',
      borderRadius: '6px', padding: '3px 10px',
    });
    goldBadge.textContent = `💰 ${this.gold} or`;

    const xBtn = document.createElement('button');
    xBtn.textContent = '✕';
    Object.assign(xBtn.style, {
      background: 'none', border: 'none', color: '#8b93a7',
      fontSize: '18px', cursor: 'pointer', padding: '6px',
      lineHeight: '1', minWidth: '36px',
    });
    xBtn.onmouseenter = () => { xBtn.style.color = '#e6e8ee'; };
    xBtn.onmouseleave = () => { xBtn.style.color = '#8b93a7'; };
    xBtn.onclick = () => this.close();

    hdr.append(title, goldBadge, xBtn);
    panel.appendChild(hdr);

    // ── Tabs ──
    const tabBar = el('div', { display: 'flex', gap: '6px', marginBottom: '14px' });
    const mkTab = (label: string, tab: 'buy' | 'sell') => {
      const t = document.createElement('button');
      t.textContent = label;
      const active = this.activeTab === tab;
      Object.assign(t.style, {
        flex: '1', padding: '8px', borderRadius: '7px',
        border: `1px solid ${active ? '#38bdf8' : '#2a3142'}`,
        background: active ? '#0c2132' : '#131929',
        color: active ? '#38bdf8' : '#6b7280',
        fontWeight: '700', fontSize: '13px', cursor: 'pointer',
      });
      t.onclick = () => { this.activeTab = tab; this._render(); };
      return t;
    };
    tabBar.append(mkTab('🛍️ Acheter', 'buy'), mkTab('💰 Vendre', 'sell'));
    panel.appendChild(tabBar);

    // ── Content ──
    if (this.activeTab === 'buy') this._renderBuy(panel);
    else                          this._renderSell(panel);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  private _renderBuy(panel: HTMLElement): void {
    const list = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' });

    for (const { id, price } of BUY_CATALOG) {
      const { name, icon } = this._label(id);
      const canAfford = this.gold >= price;
      const row = el('div', {
        display: 'flex', alignItems: 'center', gap: '12px',
        background: '#0b0f1a', border: '1px solid #1e2738',
        borderRadius: '8px', padding: '10px 12px',
      });

      const ico = el('span', { fontSize: '22px', flexShrink: '0' }); ico.textContent = icon;
      const info = el('div', { flex: '1' });
      const nm = el('div', { fontSize: '13px', fontWeight: '600', color: '#e6e8ee' }); nm.textContent = name;
      const pr = el('div', { fontSize: '11px', color: '#fde047', marginTop: '2px' });
      pr.textContent = `💰 ${price.toLocaleString()} or`;
      info.append(nm, pr);

      const btn = document.createElement('button');
      btn.textContent = 'Acheter';
      Object.assign(btn.style, {
        padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
        border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed',
        background: canAfford ? '#15803d' : '#1e293b',
        color: canAfford ? '#fff' : '#4b5563',
      });
      if (canAfford) btn.onclick = () => this._buy(id, price);

      row.append(ico, info, btn);
      list.appendChild(row);
    }

    panel.appendChild(list);
  }

  private _renderSell(panel: HTMLElement): void {
    // Items vendables que le joueur possède
    const sellable = this.inv.filter(e => SELL_PRICES[e.id] !== undefined);

    if (sellable.length === 0) {
      const empty = el('div', {
        textAlign: 'center', color: '#4b5563', fontSize: '13px',
        padding: '32px 0',
      });
      empty.textContent = 'Aucun item à vendre.';
      panel.appendChild(empty);
      return;
    }

    const list = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' });

    for (const entry of sellable) {
      const price = SELL_PRICES[entry.id];
      const { name, icon } = this._label(entry.id);

      const row = el('div', {
        display: 'flex', alignItems: 'center', gap: '12px',
        background: '#0b0f1a', border: '1px solid #1e2738',
        borderRadius: '8px', padding: '10px 12px',
      });

      const ico = el('span', { fontSize: '22px', flexShrink: '0' }); ico.textContent = icon;
      const info = el('div', { flex: '1' });
      const nm = el('div', { fontSize: '13px', fontWeight: '600', color: '#e6e8ee' });
      nm.textContent = `${name} ×${entry.qty}`;
      const pr = el('div', { fontSize: '11px', color: '#34d399', marginTop: '2px' });
      pr.textContent = `💰 ${price} or / unité · Total: ${price * entry.qty} or`;
      info.append(nm, pr);

      // Boutons : vendre 1 / vendre tout
      const btnOne = document.createElement('button');
      btnOne.textContent = '−1';
      Object.assign(btnOne.style, {
        padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
        border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', cursor: 'pointer',
      });
      btnOne.onclick = () => this._sellOne(entry.id, price);

      const btnAll = document.createElement('button');
      btnAll.textContent = 'Tout';
      Object.assign(btnAll.style, {
        padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
        border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer',
      });
      btnAll.onclick = () => this._sellAll(entry.id, price);

      const btns = el('div', { display: 'flex', gap: '6px', flexShrink: '0' });
      btns.append(btnOne, btnAll);
      row.append(ico, info, btns);
      list.appendChild(row);
    }

    panel.appendChild(list);
  }
}

function el(tag: string, styles: Partial<CSSStyleDeclaration> = {}): HTMLDivElement {
  const node = document.createElement(tag) as HTMLDivElement;
  Object.assign(node.style, styles);
  return node;
}
