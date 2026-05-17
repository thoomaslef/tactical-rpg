import { ALL_SPELLS } from '../game/spells';
import { Spell } from '../types';

let _instance: SpellsPanel | null = null;

export function getSpellsPanel(): SpellsPanel {
  if (!_instance) _instance = new SpellsPanel();
  return _instance;
}

export class SpellsPanel {
  private overlay: HTMLElement;
  private onCloseCallback: () => void = () => {};

  constructor() {
    const existing = document.getElementById('_spells_panel_overlay');
    if (existing) {
      this.overlay = existing;
    } else {
      this.overlay = document.createElement('div');
      this.overlay.id = '_spells_panel_overlay';
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
    this.buildDOM();
  }

  open(onClose: () => void = () => {}) {
    this.onCloseCallback = onClose;
    this.overlay.style.display = 'flex';
  }

  close() {
    if (this.overlay.style.display === 'none') return;
    this.overlay.style.display = 'none';
    this.onCloseCallback();
  }

  isOpen(): boolean {
    return this.overlay.style.display !== 'none';
  }

  private buildDOM() {
    this.overlay.innerHTML = '';

    const panel = el('div', {
      background: '#0e1320',
      border: '2px solid #2a3142',
      borderRadius: '10px',
      padding: '18px 20px',
      width: 'min(480px, 96vw)',
      maxHeight: '90dvh',
      overflowY: 'auto',
      color: '#e6e8ee',
      boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
    });
    (panel.style as any).WebkitOverflowScrolling = 'touch';

    // Header
    const hdr = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' });
    const title = el('span', { fontSize: '15px', fontWeight: '700', letterSpacing: '2px' });
    title.textContent = 'GRIMOIRE DE SORTS';
    const xBtn = btn('✕', { background: 'none', border: 'none', color: '#8b93a7', fontSize: '18px', cursor: 'pointer', padding: '8px', lineHeight: '1', minWidth: '44px', minHeight: '44px' });
    xBtn.onmouseenter = () => { xBtn.style.color = '#e6e8ee'; };
    xBtn.onmouseleave = () => { xBtn.style.color = '#8b93a7'; };
    xBtn.onclick = () => this.close();
    hdr.append(title, xBtn);
    panel.appendChild(hdr);

    // Separator
    const sep = el('div', { borderTop: '1px solid #1e2738', marginBottom: '16px' });
    panel.appendChild(sep);

    // Spell cards
    for (const spell of ALL_SPELLS) {
      panel.appendChild(this.makeCard(spell));
    }

    // Footer hint
    const foot = el('div', { marginTop: '16px', fontSize: '11px', color: '#4a5568', textAlign: 'center' });
    foot.textContent = '[S] pour ouvrir/fermer ce panneau';
    panel.appendChild(foot);

    this.overlay.appendChild(panel);
  }

  private makeCard(spell: Spell): HTMLElement {
    const card = el('div', {
      background: '#0b0f1a',
      border: '1px solid #1e2738',
      borderRadius: '10px',
      padding: '14px 16px',
      marginBottom: '12px',
      display: 'flex',
      gap: '14px',
      alignItems: 'flex-start',
    });

    // Icon box
    const iconBox = el('div', {
      width: '52px', height: '52px', flexShrink: '0',
      background: '#131929', borderRadius: '10px',
      border: '1px solid #2a3142',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '26px',
    });
    iconBox.textContent = spell.icon;

    // Right content
    const right = el('div', { flex: '1' });

    // Name + costs row
    const topRow = el('div', { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' });
    const nameEl = el('span', { fontWeight: '700', fontSize: '14px', color: '#e6e8ee' });
    nameEl.textContent = spell.name;

    const paBadge = badge(`⚡ ${spell.cost} PA`, '#fde047', '#1c1a08');
    const flBadge = badge(`💧 ${spell.fluideCost} Fluide`, '#a855f7', '#160d1e');
    topRow.append(nameEl, paBadge, flBadge);

    // Stats row
    const statsRow = el('div', { display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' });

    const rangeStr = spell.minRange ? `${spell.minRange}–${spell.range}` : `1–${spell.range}`;
    statsRow.appendChild(statChip('🎯 Portée', rangeStr));
    if (spell.aoe) statsRow.appendChild(statChip('💥 Zone', `rayon ${spell.aoe}`));
    if (spell.damage) statsRow.appendChild(statChip('⚔️ Dégâts', `${spell.damage}`));
    if (spell.push) statsRow.appendChild(statChip('💨 Recul', `${spell.push} cases`));

    // Description
    const descEl = el('p', { fontSize: '12px', color: '#8b93a7', margin: '0', lineHeight: '1.6' });
    descEl.textContent = spell.description;

    right.append(topRow, statsRow, descEl);
    card.append(iconBox, right);
    return card;
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

function badge(text: string, color: string, bg: string): HTMLElement {
  const b = el('span', {
    fontSize: '11px', fontWeight: '700', color,
    background: bg, border: `1px solid ${color}44`,
    borderRadius: '4px', padding: '2px 6px',
  });
  b.textContent = text;
  return b;
}

function statChip(label: string, value: string): HTMLElement {
  const chip = el('span', {
    fontSize: '11px', color: '#8b93a7',
    background: '#131929', borderRadius: '4px',
    padding: '2px 7px', border: '1px solid #1e2738',
  });
  chip.innerHTML = `${label}&nbsp;<strong style="color:#c8ccd6">${value}</strong>`;
  return chip;
}
