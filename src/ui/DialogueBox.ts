let _instance: DialogueBox | null = null;

export function getDialogueBox(): DialogueBox {
  if (!_instance) _instance = new DialogueBox();
  return _instance;
}

export class DialogueBox {
  private overlay: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private hintEl: HTMLElement;
  private lines: string[] = [];
  private index = 0;
  private onDone: () => void = () => {};
  private isOpen = false;

  constructor() {
    const existing = document.getElementById('_dialogueBox');
    if (existing) {
      this.overlay = existing;
      this.nameEl  = existing.querySelector('._db_name')!;
      this.textEl  = existing.querySelector('._db_text')!;
      this.hintEl  = existing.querySelector('._db_hint')!;
      return;
    }

    if (!document.getElementById('_db_styles')) {
      const style = document.createElement('style');
      style.id = '_db_styles';
      style.textContent = `
        #_dialogueBox {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          display: none;
          align-items: flex-end; justify-content: center;
          padding: 0 16px 80px;
          z-index: 15000;
          pointer-events: auto;
          font-family: 'Segoe UI', system-ui, sans-serif;
          cursor: pointer;
        }
        ._db_panel {
          background: rgba(7,10,18,0.94);
          border: 1px solid #2a3142;
          border-radius: 12px;
          padding: 14px 20px 16px;
          max-width: 680px;
          width: 100%;
          box-shadow: 0 -4px 30px rgba(0,0,0,0.6);
          backdrop-filter: blur(6px);
          user-select: none;
        }
        ._db_name {
          font-size: 13px;
          font-weight: 700;
          color: #fde047;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        ._db_text {
          font-size: 14px;
          line-height: 1.6;
          color: #e6e8ee;
          min-height: 42px;
        }
        ._db_hint {
          margin-top: 10px;
          font-size: 10px;
          color: #4b5563;
          text-align: right;
          letter-spacing: 0.5px;
        }
        @media (max-width: 600px) {
          #_dialogueBox { padding-bottom: 120px; }
          ._db_text { font-size: 13px; }
        }
      `;
      document.head.appendChild(style);
    }

    this.overlay = document.createElement('div');
    this.overlay.id = '_dialogueBox';

    const panel = document.createElement('div');
    panel.className = '_db_panel';

    this.nameEl = document.createElement('div');
    this.nameEl.className = '_db_name';

    this.textEl = document.createElement('div');
    this.textEl.className = '_db_text';

    this.hintEl = document.createElement('div');
    this.hintEl.className = '_db_hint';

    panel.append(this.nameEl, this.textEl, this.hintEl);
    this.overlay.appendChild(panel);
    document.getElementById('app')!.appendChild(this.overlay);

    // Clic sur l'overlay → avancer
    this.overlay.addEventListener('click', () => this.advance());
  }

  open(npcName: string, lines: string[], onDone: () => void) {
    this.lines = lines;
    this.index = 0;
    this.onDone = onDone;
    this.nameEl.textContent = npcName;
    this.isOpen = true;
    this.showLine(0);
    this.overlay.style.display = 'flex';
  }

  private showLine(i: number) {
    // Petit effet : réinitialise puis affiche le texte
    this.textEl.textContent = '';
    // requestAnimationFrame pour animer l'apparition
    requestAnimationFrame(() => {
      this.textEl.textContent = this.lines[i] ?? '';
    });

    const isLast = i >= this.lines.length - 1;
    this.hintEl.textContent = isLast
      ? '[ Espace ou Clic pour fermer ]'
      : `[ Espace ou Clic pour continuer ]  ${i + 1}/${this.lines.length}`;
  }

  advance() {
    if (!this.isOpen) return;
    if (this.index < this.lines.length - 1) {
      this.index++;
      this.showLine(this.index);
    } else {
      this.close();
    }
  }

  close() {
    if (!this.isOpen) return;          // déjà fermé → ne pas re-déclencher le callback
    this.isOpen = false;
    this.overlay.style.display = 'none';
    const cb = this.onDone;
    this.onDone = () => {};            // reset avant l'appel pour éviter toute ré-entrance
    cb();
  }

  getIsOpen() { return this.isOpen; }
}
