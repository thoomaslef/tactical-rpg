import { ALL_SPELLS } from '../data/spells/spellsData';
import { ISpell } from '../data/spells/ISpell';
import { ELEMENT_CSS_COLORS, ELEMENT_LABELS } from '../config/spells.config';
import { gameState } from '../game/gameState';
import { getUpgradedSpell, SPELL_UPGRADES } from '../data/spells/spellUpgrades';

const MAX_UPGRADE = 3;

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
  }

  /** @param playerLevel Niveau actuel du joueur (pour afficher sorts verrouillés) */
  open(playerLevel = 1, onClose: () => void = () => {}) {
    this.onCloseCallback = onClose;
    this.buildDOM(playerLevel);
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

  private buildDOM(playerLevel: number) {
    this.overlay.innerHTML = '';

    const panel = el('div', {
      background: '#0e1320',
      border: '2px solid #2a3142',
      borderRadius: '10px',
      padding: '18px 20px',
      width: 'min(520px, 96vw)',
      maxHeight: '90dvh',
      overflowY: 'auto',
      color: '#e6e8ee',
      boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
    });
    (panel.style as any).WebkitOverflowScrolling = 'touch';

    // ── Header ──
    const hdr = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' });
    const titleWrap = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
    const titleIcon = el('span', { fontSize: '18px' });
    titleIcon.textContent = '📖';
    const titleText = el('span', { fontSize: '15px', fontWeight: '700', letterSpacing: '2px' });
    titleText.textContent = 'GRIMOIRE DE SORTS';
    titleWrap.append(titleIcon, titleText);

    // Compteur débloqués
    const unlocked = ALL_SPELLS.filter(s => (s.learnLevel ?? 1) <= playerLevel).length;
    const counter = el('span', {
      fontSize: '11px', fontWeight: '700', color: '#4ade80',
      background: '#0d2a1a', borderRadius: '10px', padding: '2px 10px',
      marginRight: '8px',
    });
    counter.textContent = `${unlocked}/${ALL_SPELLS.length} sorts`;

    const xBtn = document.createElement('button');
    xBtn.textContent = '✕';
    Object.assign(xBtn.style, {
      background: 'none', border: 'none', color: '#8b93a7',
      fontSize: '18px', cursor: 'pointer', padding: '8px',
      lineHeight: '1', minWidth: '44px', minHeight: '44px',
    });
    xBtn.onmouseenter = () => { xBtn.style.color = '#e6e8ee'; };
    xBtn.onmouseleave = () => { xBtn.style.color = '#8b93a7'; };
    xBtn.onclick = () => this.close();
    hdr.append(titleWrap, el('div', { display: 'flex', alignItems: 'center' }));
    hdr.children[1].appendChild(counter);
    hdr.children[1].appendChild(xBtn);
    panel.appendChild(hdr);

    // ── Séparateur ──
    panel.appendChild(sep());

    // ── Cartes de sorts ──
    for (const spell of ALL_SPELLS) {
      const isLocked = (spell.learnLevel ?? 1) > playerLevel;
      panel.appendChild(this.makeCard(spell, isLocked));
    }

    // ── Footer ──
    const foot = el('div', { marginTop: '16px', fontSize: '11px', color: '#4a5568', textAlign: 'center' });
    foot.textContent = '[S] pour ouvrir/fermer · Les sorts se débloquent en montant de niveau';
    panel.appendChild(foot);

    this.overlay.appendChild(panel);
  }

  private makeCard(spell: ISpell, isLocked: boolean): HTMLElement {
    const learnLvl   = spell.learnLevel ?? 1;
    const upgLevel   = gameState.spellUpgrades.get(spell.id) ?? 0;
    const hasUpgData = !!SPELL_UPGRADES[spell.id];
    const isMaxed    = upgLevel >= MAX_UPGRADE;
    // Affiche les stats upgradées si le sort a été amélioré
    const displayed  = (!isLocked && upgLevel > 0) ? getUpgradedSpell(spell, upgLevel) : spell;

    const borderColor = isLocked ? '#151c28' : isMaxed ? '#22c55e44' : upgLevel > 0 ? '#7c3aed66' : '#1e2738';
    const card = el('div', {
      background: isLocked ? '#090c12' : '#0b0f1a',
      border: `1px solid ${borderColor}`,
      borderRadius: '10px',
      padding: '14px 16px',
      marginBottom: '10px',
      display: 'flex',
      gap: '14px',
      alignItems: 'flex-start',
      opacity: isLocked ? '0.5' : '1',
      filter: isLocked ? 'grayscale(60%)' : 'none',
    });

    // Icon box
    const iconBox = el('div', {
      width: '52px', height: '52px', flexShrink: '0',
      background: '#131929', borderRadius: '10px',
      border: `1px solid ${isLocked ? '#1a2030' : '#2a3142'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: isLocked ? '22px' : '26px',
      position: 'relative',
    });
    iconBox.textContent = isLocked ? '🔒' : spell.icon;

    // Right content
    const right = el('div', { flex: '1' });

    // Titre + badges
    const topRow = el('div', { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' });
    const nameEl = el('span', { fontWeight: '700', fontSize: '14px', color: isLocked ? '#4a5568' : '#e6e8ee' });
    nameEl.textContent = spell.name;
    topRow.appendChild(nameEl);

    if (isLocked) {
      topRow.appendChild(badge(`🔒 Niveau ${learnLvl}`, '#6b7280', '#111827'));
    } else {
      topRow.appendChild(badge(`⚡ ${displayed.paCost} PA`, '#fde047', '#1c1a08'));
      if (displayed.fluideCost > 0) topRow.appendChild(badge(`💧 ${displayed.fluideCost} Fluide`, '#a855f7', '#160d1e'));
      if (displayed.elements && displayed.elements.length > 0) {
        for (const el of displayed.elements) {
          if (el !== 'neutre') {
            const ec = ELEMENT_CSS_COLORS[el];
            topRow.appendChild(badge(ELEMENT_LABELS[el], ec, `${ec}18`));
          }
        }
      } else if (displayed.element && displayed.element !== 'neutre') {
        const ec = ELEMENT_CSS_COLORS[displayed.element];
        topRow.appendChild(badge(ELEMENT_LABELS[displayed.element], ec, `${ec}18`));
      }
      // Niveau débloqué (petit badge vert discret)
      if (learnLvl > 1) topRow.appendChild(badge(`Nv.${learnLvl}`, '#4ade80', '#0d2a1a'));
      // Badge MAXÉ
      if (isMaxed) topRow.appendChild(badge('MAXÉ ✨', '#4ade80', '#14532d'));
    }

    // ── Barres de palier d'amélioration ──────────────────────────────────────
    let upgradeRow: HTMLElement | null = null;
    if (!isLocked && hasUpgData) {
      upgradeRow = el('div', { display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' });
      const lbl = el('span', { fontSize: '10px', color: '#64748b', marginRight: '2px', fontFamily: 'monospace' });
      lbl.textContent = 'Palier';
      upgradeRow.appendChild(lbl);
      for (let i = 0; i < MAX_UPGRADE; i++) {
        const bar = el('div', {
          width: '26px', height: '5px', borderRadius: '3px',
          background: i < upgLevel ? '#a78bfa' : '#1e293b',
          border: `1px solid ${i < upgLevel ? '#7c3aed' : '#334155'}`,
        });
        upgradeRow.appendChild(bar);
      }
      if (upgLevel > 0 && upgLevel < MAX_UPGRADE) {
        const nextTierLabel = SPELL_UPGRADES[spell.id]!.tiers[upgLevel].label;
        const nextHint = el('span', { fontSize: '10px', color: '#64748b', marginLeft: '6px', fontFamily: 'monospace' });
        nextHint.innerHTML = `→ <span style="color:#c4b5fd">${nextTierLabel}</span>`;
        upgradeRow.appendChild(nextHint);
      }
    }

    // Stats
    const statsRow = el('div', { display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' });
    if (!isLocked) {
      const rangeStr = displayed.minRange ? `${displayed.minRange}–${displayed.maxRange}` : `1–${displayed.maxRange}`;
      statsRow.appendChild(chip('🎯 Portée', rangeStr + (displayed.isModifiable ? ' (+portée)' : '')));
      if (displayed.baseDamage)    statsRow.appendChild(chip('⚔️ Dégâts', `${displayed.baseDamage.min}–${displayed.baseDamage.max}`));
      if (displayed.aoeSize)       statsRow.appendChild(chip('💥 Zone', `rayon ${displayed.aoeSize}`));
      if (displayed.pushDistance)  statsRow.appendChild(chip('💨 Recul', `${displayed.pushDistance} cases`));
      if (displayed.isLinear)      statsRow.appendChild(chip('➡️ Ligne', 'orthogonale'));
      if (displayed.cooldown)      statsRow.appendChild(chip('🔄 CD', `${displayed.cooldown} tours`));
      if (displayed.maxPerTurn)    statsRow.appendChild(chip('🔢 Max/tour', `${displayed.maxPerTurn}×`));
    }

    // Description
    const descEl = el('p', { fontSize: '12px', color: '#8b93a7', margin: '0', lineHeight: '1.6' });
    descEl.textContent = isLocked
      ? `Se débloque au niveau ${learnLvl}.`
      : displayed.description;

    if (upgradeRow) right.append(topRow, upgradeRow, statsRow, descEl);
    else right.append(topRow, statsRow, descEl);
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

function sep(): HTMLElement {
  return el('div', { borderTop: '1px solid #1e2738', marginBottom: '16px' });
}

function badge(text: string, color: string, bg: string): HTMLElement {
  const b = el('span', {
    fontSize: '11px', fontWeight: '700', color,
    background: bg, border: `1px solid ${color}44`,
    borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap',
  });
  b.textContent = text;
  return b;
}

function chip(label: string, value: string): HTMLElement {
  const c = el('span', {
    fontSize: '11px', color: '#8b93a7',
    background: '#131929', borderRadius: '4px',
    padding: '2px 7px', border: '1px solid #1e2738',
    whiteSpace: 'nowrap',
  });
  c.innerHTML = `${label}&nbsp;<strong style="color:#c8ccd6">${value}</strong>`;
  return c;
}
