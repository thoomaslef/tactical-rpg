import { InventoryEntry, ITEMS, RESOURCE_CATALOG } from '../game/items';
import { gameState } from '../game/gameState';

let _instance: BankModal | null = null;
export function getBankModal(): BankModal {
  if (!_instance) _instance = new BankModal();
  return _instance;
}

class BankModal {
  private overlay: HTMLDivElement | null = null;
  private _isOpen = false;
  private playerInv: InventoryEntry[] = [];
  private onCloseCallback: ((inv: InventoryEntry[]) => void) | null = null;

  isOpen(): boolean { return this._isOpen; }

  open(playerInventory: InventoryEntry[], onClose: (updated: InventoryEntry[]) => void): void {
    this._cleanup(false);
    this.playerInv = playerInventory.map(e => ({ ...e }));
    this.onCloseCallback = onClose;
    this._isOpen = true;
    this._render();
  }

  close(): void { this._cleanup(true); }

  private _cleanup(fireCallback: boolean): void {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    this._isOpen = false;
    if (fireCallback && this.onCloseCallback) {
      this.onCloseCallback([...this.playerInv]);
      this.onCloseCallback = null;
    }
  }

  // ── Logique dépôt / retrait ────────────────────────────────────────────────

  private _label(id: string): { name: string; icon: string } {
    if (ITEMS[id])            return { name: ITEMS[id].name,            icon: ITEMS[id].icon };
    if (RESOURCE_CATALOG[id]) return { name: RESOURCE_CATALOG[id].name, icon: RESOURCE_CATALOG[id].icon };
    return { name: id, icon: '📦' };
  }

  private _deposit(id: string): void {
    const idx = this.playerInv.findIndex(e => e.id === id);
    if (idx === -1) return;
    const { qty } = this.playerInv[idx];
    const bank = gameState.bankInventory.find(e => e.id === id);
    if (bank) bank.qty += qty; else gameState.bankInventory.push({ id, qty });
    this.playerInv.splice(idx, 1);
    this._refresh();
  }

  private _withdraw(id: string): void {
    const idx = gameState.bankInventory.findIndex(e => e.id === id);
    if (idx === -1) return;
    const { qty } = gameState.bankInventory[idx];
    const player = this.playerInv.find(e => e.id === id);
    if (player) player.qty += qty; else this.playerInv.push({ id, qty });
    gameState.bankInventory.splice(idx, 1);
    this._refresh();
  }

  private _depositAll(): void {
    for (const entry of [...this.playerInv]) this._deposit(entry.id);
  }

  private _withdrawAll(): void {
    for (const entry of [...gameState.bankInventory]) this._withdraw(entry.id);
  }

  private _refresh(): void {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    this._render();
  }

  // ── Rendu DOM ──────────────────────────────────────────────────────────────

  private _render(): void {
    const ov = document.createElement('div');
    ov.style.cssText = [
      'position:fixed;inset:0;background:rgba(0,0,0,0.78);',
      'display:flex;align-items:center;justify-content:center;',
      'z-index:30000;font-family:sans-serif;',
    ].join('');
    ov.addEventListener('click', (e) => { if (e.target === ov) this.close(); });

    const modal = document.createElement('div');
    modal.style.cssText = [
      'background:#0e1320;border:1px solid #2a3448;border-radius:12px;',
      'width:min(860px,96vw);max-height:88vh;display:flex;flex-direction:column;',
      'box-shadow:0 12px 48px rgba(0,0,0,0.75);overflow:hidden;',
    ].join('');

    modal.appendChild(this._makeHeader());

    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex:1;overflow:hidden;min-height:0;';

    const bankPanel = this._makePanel(
      '🏦 Banque',
      `${gameState.bankInventory.length} objet${gameState.bankInventory.length !== 1 ? 's' : ''} stocké${gameState.bankInventory.length !== 1 ? 's' : ''}`,
      gameState.bankInventory,
      (id) => this._withdraw(id),
      '← Retirer',
      '#22c55e', '#0a1f12',
      () => this._withdrawAll(),
      'Tout retirer',
    );
    bankPanel.style.borderRight = '1px solid #1a2333';

    const invPanel = this._makePanel(
      '🎒 Inventaire',
      `${this.playerInv.length} objet${this.playerInv.length !== 1 ? 's' : ''}`,
      this.playerInv,
      (id) => this._deposit(id),
      'Déposer →',
      '#a78bfa', '#0e0c22',
      () => this._depositAll(),
      'Tout déposer',
    );

    body.appendChild(bankPanel);
    body.appendChild(invPanel);
    modal.appendChild(body);
    ov.appendChild(modal);
    document.body.appendChild(ov);
    this.overlay = ov;
  }

  private _makeHeader(): HTMLElement {
    const h = document.createElement('div');
    h.style.cssText = [
      'display:flex;align-items:center;justify-content:space-between;',
      'padding:14px 20px;border-bottom:1px solid #1a2333;background:#0a0f1c;',
      'flex-shrink:0;',
    ].join('');

    const title = document.createElement('div');
    title.style.cssText = 'display:flex;align-items:center;gap:10px;';
    title.innerHTML = `
      <span style="font-size:22px">🏦</span>
      <div>
        <div style="font-size:15px;font-weight:800;color:#e6e8ee;letter-spacing:1.5px">BANQUE DE VARENNE</div>
        <div style="font-size:11px;color:#4a5568;margin-top:1px">Stockez vos objets en toute sécurité</div>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = [
      'background:none;border:1px solid #2a3448;color:#8b93a7;',
      'border-radius:6px;width:32px;height:32px;cursor:pointer;font-size:15px;',
      'transition:all 0.15s;',
    ].join('');
    closeBtn.onmouseenter = () => { closeBtn.style.color = '#fff'; closeBtn.style.borderColor = '#4a5568'; };
    closeBtn.onmouseleave = () => { closeBtn.style.color = '#8b93a7'; closeBtn.style.borderColor = '#2a3448'; };
    closeBtn.onclick = () => this.close();

    h.appendChild(title);
    h.appendChild(closeBtn);
    return h;
  }

  private _makePanel(
    title: string,
    subtitle: string,
    items: InventoryEntry[],
    onAction: (id: string) => void,
    actionLabel: string,
    accentColor: string,
    accentBg: string,
    onAll: () => void,
    allLabel: string,
  ): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;';

    // Panel header
    const ph = document.createElement('div');
    ph.style.cssText = [
      'padding:10px 14px;border-bottom:1px solid #1a2333;',
      'display:flex;align-items:baseline;justify-content:space-between;flex-shrink:0;',
    ].join('');
    ph.innerHTML = `
      <span style="font-size:13px;font-weight:700;color:#c8ccd6">${title}</span>
      <span style="font-size:11px;color:#4a5568">${subtitle}</span>
    `;

    // Items list
    const list = document.createElement('div');
    list.style.cssText = [
      'flex:1;overflow-y:auto;padding:8px;',
      'scrollbar-width:thin;scrollbar-color:#1e2a3a transparent;',
    ].join('');

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#4a5568;font-size:12px;text-align:center;padding:40px 16px;font-style:italic;';
      empty.textContent = 'Aucun objet';
      list.appendChild(empty);
    } else {
      for (const entry of items) {
        list.appendChild(this._makeRow(entry, onAction, actionLabel, accentColor, accentBg));
      }
    }

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:10px 12px;border-top:1px solid #1a2333;flex-shrink:0;';
    const allBtn = document.createElement('button');
    allBtn.textContent = allLabel;
    allBtn.disabled = items.length === 0;
    allBtn.style.cssText = [
      `width:100%;font-size:12px;font-weight:700;color:${accentColor};`,
      `background:${accentBg};border:1px solid ${accentColor}40;`,
      'border-radius:6px;padding:8px;cursor:pointer;transition:background 0.15s;',
      items.length === 0 ? 'opacity:0.35;cursor:default;' : '',
    ].join('');
    if (items.length > 0) {
      allBtn.onmouseenter = () => { allBtn.style.background = accentColor + '28'; };
      allBtn.onmouseleave = () => { allBtn.style.background = accentBg; };
      allBtn.onclick = onAll;
    }
    footer.appendChild(allBtn);

    panel.appendChild(ph);
    panel.appendChild(list);
    panel.appendChild(footer);
    return panel;
  }

  private _makeRow(
    entry: InventoryEntry,
    onAction: (id: string) => void,
    actionLabel: string,
    accentColor: string,
    accentBg: string,
  ): HTMLDivElement {
    const { name, icon } = this._label(entry.id);
    const row = document.createElement('div');
    row.style.cssText = [
      'display:flex;align-items:center;gap:8px;',
      'padding:8px 10px;border-radius:7px;margin-bottom:4px;',
      'background:#090d18;border:1px solid #1a2333;',
      'transition:border-color 0.15s;',
    ].join('');
    row.onmouseenter = () => { row.style.borderColor = '#2a3448'; row.style.background = '#0d1220'; };
    row.onmouseleave = () => { row.style.borderColor = '#1a2333'; row.style.background = '#090d18'; };

    row.innerHTML = `
      <span style="font-size:18px;flex-shrink:0">${icon}</span>
      <span style="font-size:12px;color:#c8ccd6;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span>
      <span style="font-size:12px;font-weight:700;color:#fde047;background:#1c1300;border:1px solid #2a2000;padding:2px 8px;border-radius:4px;flex-shrink:0">×${entry.qty}</span>
    `;

    const btn = document.createElement('button');
    btn.textContent = actionLabel;
    btn.style.cssText = [
      `font-size:11px;font-weight:700;color:${accentColor};`,
      `background:${accentBg};border:1px solid ${accentColor}50;`,
      'border-radius:5px;padding:4px 9px;cursor:pointer;flex-shrink:0;',
      'white-space:nowrap;transition:background 0.15s;',
    ].join('');
    btn.onmouseenter = () => { btn.style.background = accentColor + '28'; };
    btn.onmouseleave = () => { btn.style.background = accentBg; };
    btn.onclick = () => onAction(entry.id);
    row.appendChild(btn);
    return row;
  }
}
