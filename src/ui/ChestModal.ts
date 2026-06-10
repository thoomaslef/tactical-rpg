import { ChestData, ChestItem } from '../maps/MapLoader';

let _instance: ChestModal | null = null;

export function getChestModal(): ChestModal {
  if (!_instance) _instance = new ChestModal();
  return _instance;
}

export class ChestModal {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private listEl: HTMLElement;
  private footerEl: HTMLElement;
  private onTake!: (item: ChestItem) => void;
  private onClose!: () => void;
  private currentItems: ChestItem[] = [];
  private isOpen = false;

  constructor() {
    const existing = document.getElementById('_chestModal');
    if (existing) {
      this.overlay  = existing;
      this.titleEl  = existing.querySelector('._cm_title')!;
      this.listEl   = existing.querySelector('._cm_list')!;
      this.footerEl = existing.querySelector('._cm_footer')!;
      return;
    }

    // Styles
    if (!document.getElementById('_cm_styles')) {
      const style = document.createElement('style');
      style.id = '_cm_styles';
      style.textContent = `
        #_chestModal {
          position: fixed; inset: 0;
          display: none;
          align-items: center; justify-content: center;
          background: rgba(0,0,0,0.72);
          z-index: 20000;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }
        ._cm_panel {
          background: #0e1320;
          border: 1px solid #2a3142;
          border-radius: 14px;
          padding: 0;
          min-width: 320px;
          max-width: 420px;
          width: 90vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.7);
          overflow: hidden;
        }
        ._cm_header {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 20px 12px;
          border-bottom: 1px solid #1c2230;
        }
        ._cm_title {
          font-size: 16px; font-weight: 700;
          color: #ffd700; letter-spacing: 0.5px;
          flex: 1;
        }
        ._cm_list {
          flex: 1; overflow-y: auto; padding: 8px 12px;
          display: flex; flex-direction: column; gap: 6px;
        }
        ._cm_empty {
          text-align: center; color: #4b5563;
          font-size: 13px; padding: 24px 0;
          font-style: italic;
        }
        ._cm_item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px;
          background: #131826;
          border: 1px solid #1c2230;
          border-radius: 8px;
          transition: background 0.12s;
        }
        ._cm_item:hover { background: #1a2235; }
        ._cm_item_icon {
          font-size: 22px; width: 32px; text-align: center;
        }
        ._cm_item_info { flex: 1; min-width: 0; }
        ._cm_item_name {
          font-size: 13px; font-weight: 600; color: #e6e8ee;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        ._cm_item_qty {
          font-size: 11px; color: #6b7280; margin-top: 2px;
        }
        ._cm_take_btn {
          padding: 6px 14px; border-radius: 6px; cursor: pointer;
          background: #134e4a; border: 1px solid #0d9488;
          color: #5eead4; font-size: 12px; font-weight: 700;
          white-space: nowrap;
          transition: background 0.1s, transform 0.08s;
        }
        ._cm_take_btn:hover { background: #0f3e3a; transform: scale(1.04); }
        ._cm_take_btn:disabled { opacity: 0.35; cursor: default; transform: none; }
        ._cm_footer {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 20px;
          border-top: 1px solid #1c2230;
          gap: 10px;
        }
        ._cm_take_all_btn {
          padding: 9px 18px; border-radius: 8px; cursor: pointer;
          background: #14532d; border: 1px solid #16a34a;
          color: #4ade80; font-size: 13px; font-weight: 700;
          transition: background 0.1s;
        }
        ._cm_take_all_btn:hover { background: #0f4225; }
        ._cm_close_btn {
          padding: 9px 18px; border-radius: 8px; cursor: pointer;
          background: #1c2230; border: 1px solid #2a3142;
          color: #9ca3af; font-size: 13px; font-weight: 600;
          transition: background 0.1s;
        }
        ._cm_close_btn:hover { background: #232a3c; }
      `;
      document.head.appendChild(style);
    }

    this.overlay = document.createElement('div');
    this.overlay.id = '_chestModal';

    const panel = document.createElement('div');
    panel.className = '_cm_panel';

    // Header
    const header = document.createElement('div');
    header.className = '_cm_header';

    const chestIcon = document.createElement('span');
    chestIcon.textContent = '📦';
    chestIcon.style.fontSize = '20px';

    this.titleEl = document.createElement('div');
    this.titleEl.className = '_cm_title';
    this.titleEl.textContent = 'Coffre';

    header.append(chestIcon, this.titleEl);

    // List
    this.listEl = document.createElement('div');
    this.listEl.className = '_cm_list';

    // Footer
    this.footerEl = document.createElement('div');
    this.footerEl.className = '_cm_footer';

    panel.append(header, this.listEl, this.footerEl);
    this.overlay.appendChild(panel);
    document.getElementById('app')!.appendChild(this.overlay);
  }

  open(
    chest: ChestData,
    items: ChestItem[],
    onTake: (item: ChestItem) => void,
    onClose: () => void
  ) {
    this.currentItems = items.map(i => ({ ...i }));
    this.onTake = onTake;
    this.onClose = onClose;
    this.titleEl.textContent = 'Coffre';
    this.isOpen = true;
    this.render();
    this.overlay.style.display = 'flex';
  }

  private render() {
    this.listEl.innerHTML = '';
    this.footerEl.innerHTML = '';

    if (this.currentItems.length === 0) {
      const empty = document.createElement('div');
      empty.className = '_cm_empty';
      empty.textContent = 'Ce coffre est vide.';
      this.listEl.appendChild(empty);
    } else {
      for (const item of this.currentItems) {
        this.listEl.appendChild(this.buildItemRow(item));
      }
    }

    // Footer
    if (this.currentItems.length > 0) {
      const takeAllBtn = document.createElement('button');
      takeAllBtn.className = '_cm_take_all_btn';
      takeAllBtn.textContent = '✅ Tout prendre';
      takeAllBtn.onclick = () => this.takeAll();
      this.footerEl.appendChild(takeAllBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = '_cm_close_btn';
    closeBtn.textContent = 'Fermer';
    closeBtn.onclick = () => this.close();
    this.footerEl.appendChild(closeBtn);
  }

  private buildItemRow(item: ChestItem): HTMLElement {
    const row = document.createElement('div');
    row.className = '_cm_item';
    row.dataset.id = item.id;

    const icon = document.createElement('div');
    icon.className = '_cm_item_icon';
    icon.textContent = item.icon;

    const info = document.createElement('div');
    info.className = '_cm_item_info';

    const name = document.createElement('div');
    name.className = '_cm_item_name';
    name.textContent = item.name;

    const qty = document.createElement('div');
    qty.className = '_cm_item_qty';
    qty.textContent = item.qty > 1 ? `×${item.qty}` : '×1';

    info.append(name, qty);

    const btn = document.createElement('button');
    btn.className = '_cm_take_btn';
    btn.textContent = 'Prendre';
    btn.onclick = () => this.takeItem(item);

    row.append(icon, info, btn);
    return row;
  }

  private takeItem(item: ChestItem) {
    this.onTake(item);
    this.currentItems = this.currentItems.filter(i => i.id !== item.id);
    this.render();
  }

  private takeAll() {
    const all = [...this.currentItems];
    for (const item of all) this.onTake(item);
    this.currentItems = [];
    this.render();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    if (this.onClose) this.onClose();
  }

  getIsOpen() { return this.isOpen; }
}
