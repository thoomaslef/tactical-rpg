import { ISpell } from '../data/spells/ISpell';
import { SPELL_UPGRADES } from '../data/spells/spellUpgrades';
import { gameState } from '../game/gameState';

const UPGRADE_COST = 5_000;
const MAX_LEVEL    = 3;

let _instance: SpellUpgradeUI | null = null;
export function getSpellUpgradeUI(): SpellUpgradeUI {
  if (!_instance) _instance = new SpellUpgradeUI();
  return _instance;
}

export class SpellUpgradeUI {
  private overlay: HTMLDivElement | null = null;
  private _isOpen = false;
  private _spells: ISpell[] = [];
  private _gold   = 0;
  private _onClose: ((newGold: number) => void) | null = null;

  isOpen(): boolean { return this._isOpen; }

  open(spells: ISpell[], gold: number, onClose: (newGold: number) => void): void {
    this._cleanup();
    this._spells  = spells.filter(s => SPELL_UPGRADES[s.id]);
    this._gold    = gold;
    this._onClose = onClose;
    this._isOpen  = true;
    this._render();
  }

  close(): void { this._cleanup(); }

  private _cleanup(): void {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    this._isOpen = false;
    if (this._onClose) { this._onClose(this._gold); this._onClose = null; }
  }

  private _upgrade(spellId: string): void {
    const current = gameState.spellUpgrades.get(spellId) ?? 0;
    if (current >= MAX_LEVEL) return;
    if (this._gold < UPGRADE_COST) return;
    this._gold -= UPGRADE_COST;
    gameState.spellUpgrades.set(spellId, current + 1);
    this._refresh();
  }

  private _refresh(): void {
    if (!this.overlay) return;
    const body = this.overlay.querySelector('#suu-body') as HTMLDivElement;
    const goldEl = this.overlay.querySelector('#suu-gold') as HTMLSpanElement;
    if (goldEl) goldEl.textContent = `💰 ${this._gold.toLocaleString()} or`;
    if (body) { body.innerHTML = ''; this._buildCards(body); }
  }

  private _buildCards(container: HTMLDivElement): void {
    for (const spell of this._spells) {
      const upgData   = SPELL_UPGRADES[spell.id]!;
      const current   = gameState.spellUpgrades.get(spell.id) ?? 0;
      const maxed     = current >= MAX_LEVEL;
      const canAfford = this._gold >= UPGRADE_COST;
      const nextTier  = !maxed ? upgData.tiers[current] : null;

      const card = document.createElement('div');
      card.style.cssText = `
        background:#111827; border:1px solid ${maxed ? '#22c55e44' : '#334155'};
        border-radius:10px; padding:12px 14px; margin-bottom:10px;
        display:flex; align-items:center; gap:12px;
      `;

      // Icône + nom
      const left = document.createElement('div');
      left.style.cssText = 'flex:1; min-width:0;';
      left.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:18px">${spell.icon}</span>
          <span style="font-weight:bold;color:#e2e8f0;font-size:14px">${spell.name}</span>
          ${maxed ? '<span style="background:#14532d;color:#4ade80;font-size:9px;padding:1px 6px;border-radius:4px;font-weight:bold">MAXÉ</span>' : ''}
        </div>
        <div style="display:flex;gap:4px;margin-bottom:6px">
          ${[0,1,2].map(i => `<div style="width:28px;height:6px;border-radius:3px;background:${i < current ? '#a78bfa' : '#1e293b'};border:1px solid ${i < current ? '#7c3aed' : '#334155'}"></div>`).join('')}
        </div>
        <div style="font-size:11px;color:#64748b">
          ${maxed
            ? `<span style="color:#4ade80">${upgData.tiers[2].label}</span>`
            : nextTier
              ? `Prochain : <span style="color:#c4b5fd">${nextTier.label}</span>`
              : ''}
        </div>
      `;

      // Bouton
      const right = document.createElement('div');
      right.style.cssText = 'flex-shrink:0;text-align:center;';
      if (!maxed) {
        const btn = document.createElement('button');
        btn.style.cssText = `
          background:${canAfford ? '#4c1d95' : '#1e293b'};
          color:${canAfford ? '#e9d5ff' : '#475569'};
          border:1px solid ${canAfford ? '#7c3aed' : '#334155'};
          border-radius:8px; padding:6px 12px; font-size:12px; font-weight:bold;
          cursor:${canAfford ? 'pointer' : 'default'}; white-space:nowrap;
          font-family:monospace; transition:background 0.15s;
        `;
        btn.textContent = `✨ ${UPGRADE_COST.toLocaleString()} or`;
        if (canAfford) {
          btn.onmouseenter = () => { btn.style.background = '#5b21b6'; };
          btn.onmouseleave = () => { btn.style.background = '#4c1d95'; };
          btn.onclick = () => this._upgrade(spell.id);
        }
        right.appendChild(btn);
        const lvlTxt = document.createElement('div');
        lvlTxt.style.cssText = 'font-size:10px;color:#64748b;margin-top:4px;font-family:monospace;';
        lvlTxt.textContent = `Palier ${current} / ${MAX_LEVEL}`;
        right.appendChild(lvlTxt);
      }

      card.appendChild(left);
      card.appendChild(right);
      container.appendChild(card);
    }

    if (this._spells.length === 0) {
      container.innerHTML = `<div style="color:#64748b;text-align:center;padding:24px;font-size:13px">Aucun sort améliorable disponible.</div>`;
    }
  }

  private _render(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:#00000099;display:flex;
      align-items:center;justify-content:center;z-index:8000;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background:#0d1117;border:1px solid #7c3aed;border-radius:16px;
      width:460px;max-width:95vw;max-height:80vh;display:flex;flex-direction:column;
      font-family:monospace;box-shadow:0 0 50px #7c3aed44;overflow:hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding:16px 20px;border-bottom:1px solid #1e293b;
      display:flex;align-items:center;justify-content:space-between;
      background:#0a0d14;
    `;
    header.innerHTML = `
      <div>
        <div style="font-size:17px;font-weight:bold;color:#e9d5ff">🧙 Magicien Elthorn</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">Améliorez vos sorts en échange d'or</div>
      </div>
      <span id="suu-gold" style="font-size:13px;font-weight:bold;color:#fde047">💰 ${this._gold.toLocaleString()} or</span>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      position:absolute;top:14px;right:16px;background:none;border:none;
      color:#64748b;font-size:20px;cursor:pointer;padding:2px 6px;
    `;
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => this._cleanup();
    header.style.position = 'relative';
    header.appendChild(closeBtn);

    // Body scrollable
    const body = document.createElement('div');
    body.id = 'suu-body';
    body.style.cssText = 'padding:16px;overflow-y:auto;flex:1;';
    this._buildCards(body);

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);

    // Click hors modal → ferme
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._cleanup();
    });

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }
}
