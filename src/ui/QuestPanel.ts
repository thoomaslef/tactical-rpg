import { QUESTS, Quest, QuestStatus, countCompleted } from '../game/quests';
import { gameState } from '../game/gameState';

let _instance: QuestPanel | null = null;

export function getQuestPanel(): QuestPanel {
  if (!_instance) _instance = new QuestPanel();
  return _instance;
}

const STATUS_LABEL: Record<QuestStatus, string> = {
  locked:      '🔒 Verrouillée',
  available:   '📋 Disponible',
  in_progress: '⚡ En cours',
  completed:   '✅ Terminée',
};

const STATUS_COLOR: Record<QuestStatus, string> = {
  locked:      '#4b5563',
  available:   '#fde047',
  in_progress: '#38bdf8',
  completed:   '#4ade80',
};

export class QuestPanel {
  private overlay: HTMLElement;
  private onCloseCallback: () => void = () => {};

  constructor() {
    const existing = document.getElementById('_quest_panel_overlay');
    if (existing) {
      this.overlay = existing;
    } else {
      this.overlay = document.createElement('div');
      this.overlay.id = '_quest_panel_overlay';
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
    this.buildDOM();
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
      borderRadius: '12px',
      padding: '20px 22px',
      width: 'min(480px, 96vw)',
      maxHeight: '90dvh',
      overflowY: 'auto',
      color: '#e6e8ee',
      boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
    });
    (panel.style as any).WebkitOverflowScrolling = 'touch';

    // ── Header ──
    const hdr = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' });
    const titleWrap = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
    const titleIcon = el('span', { fontSize: '20px' });
    titleIcon.textContent = '📜';
    const titleText = el('span', { fontSize: '15px', fontWeight: '700', letterSpacing: '2px' });
    titleText.textContent = 'JOURNAL DE QUÊTES';
    titleWrap.append(titleIcon, titleText);

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
    hdr.append(titleWrap, xBtn);
    panel.appendChild(hdr);

    // ── Progression globale ──
    const hydratedQuests = QUESTS.map(q => this.hydrateQuest(q));
    const done = countCompleted(hydratedQuests);
    const total = hydratedQuests.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const progressWrap = el('div', { marginBottom: '18px' });
    const progressLabel = el('div', { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8b93a7', marginBottom: '5px' });
    const progLeft = el('span');
    progLeft.textContent = `${done} / ${total} quête${total !== 1 ? 's' : ''} terminée${done !== 1 ? 's' : ''}`;
    const progRight = el('span', { color: '#4ade80', fontWeight: '700' });
    progRight.textContent = `${pct} %`;
    progressLabel.append(progLeft, progRight);

    const trackBg = el('div', { background: '#1e2738', borderRadius: '4px', height: '6px', overflow: 'hidden' });
    const trackFill = el('div', { background: 'linear-gradient(90deg, #22c55e, #4ade80)', height: '100%', borderRadius: '4px', transition: 'width 0.4s ease' });
    trackFill.style.width = `${pct}%`;
    trackBg.appendChild(trackFill);
    progressWrap.append(progressLabel, trackBg);
    panel.appendChild(progressWrap);

    // ── Séparateur ──
    panel.appendChild(sep());

    // ── Cartes de quêtes ──
    for (const quest of QUESTS) {
      panel.appendChild(this.makeCard(this.hydrateQuest(quest)));
    }

    // ── Footer ──
    const foot = el('div', { marginTop: '16px', fontSize: '11px', color: '#4a5568', textAlign: 'center' });
    foot.textContent = '[Q] pour ouvrir/fermer le journal';
    panel.appendChild(foot);

    this.overlay.appendChild(panel);
  }

  /** Injecte les valeurs live (gameState) dans la quête avant affichage. */
  private hydrateQuest(quest: Quest): Quest {
    const gs = gameState;

    if (quest.id === 'professeur_01') {
      const kills = gs.questKills;
      return {
        ...quest,
        status: gs.questRewardGiven ? 'completed'
               : kills >= 5         ? 'completed'
               : kills > 0          ? 'in_progress'
               :                      'available',
        objectives: quest.objectives.map(obj =>
          obj.id === 'kill_monsters' ? { ...obj, current: Math.min(kills, 5) } : obj
        ),
      };
    }

    if (quest.id === 'professeur_02') {
      if (!gs.questRewardGiven) return { ...quest, status: 'locked' };
      if (gs.quest2RewardGiven) return {
        ...quest, status: 'completed',
        objectives: quest.objectives.map(o => ({ ...o, current: 1 })),
      };
      return { ...quest, status: 'in_progress' };
    }

    if (quest.id === 'professeur_03') {
      if (!gs.quest2RewardGiven) return { ...quest, status: 'locked' };
      if (gs.quest3RewardGiven) return {
        ...quest, status: 'completed',
        objectives: quest.objectives.map(o => ({ ...o, current: 1 })),
      };
      return {
        ...quest,
        status: gs.quest3Done ? 'completed' : 'in_progress',
        objectives: quest.objectives.map(o =>
          o.id === 'defeat_razmotek' ? { ...o, current: gs.quest3Done ? 1 : 0 } : o
        ),
      };
    }

    if (quest.id === 'professeur_04') {
      if (!gs.quest4Started) return { ...quest, status: 'locked' };
      return { ...quest, status: 'in_progress' };
    }

    if (quest.id === 'alchimiste_01') {
      if (!gs.alchimiste01Started) return { ...quest, status: 'locked' };
      if (gs.alchimiste01RewardGiven) return {
        ...quest, status: 'completed',
        objectives: quest.objectives.map(o => ({ ...o, current: o.target })),
      };
      // Hydrater chaque objectif depuis l'inventaire courant — pas accessible ici,
      // on garde current=0/1 symbolique via gameState
      return { ...quest, status: 'in_progress' };
    }

    if (quest.id === 'alchimiste_02') {
      if (!gs.alchimiste02Unlocked) return { ...quest, status: 'locked' };
      return { ...quest, status: 'available' };
    }

    return quest;
  }

  private makeCard(quest: Quest): HTMLElement {
    const isLocked = quest.status === 'locked';
    const color = STATUS_COLOR[quest.status];

    const card = el('div', {
      background: isLocked ? '#090d14' : '#0b0f1a',
      border: `1px solid ${isLocked ? '#1a2030' : '#1e2738'}`,
      borderRadius: '10px',
      padding: '16px 18px',
      opacity: isLocked ? '0.6' : '1',
    });

    // ── Top row ──
    const top = el('div', { display: 'flex', alignItems: 'flex-start', gap: '14px' });

    const iconBox = el('div', {
      width: '48px', height: '48px', flexShrink: '0',
      background: '#131929', borderRadius: '10px',
      border: `1px solid ${isLocked ? '#1a2030' : '#2a3142'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '24px',
    });
    iconBox.textContent = quest.icon;

    const right = el('div', { flex: '1' });

    // Title + status badge
    const titleRow = el('div', { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' });
    const titleEl = el('span', { fontWeight: '700', fontSize: '14px', color: '#e6e8ee' });
    titleEl.textContent = quest.title;
    const statusBadge = el('span', {
      fontSize: '10px', fontWeight: '700', color,
      background: `${color}18`, border: `1px solid ${color}44`,
      borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap',
    });
    statusBadge.textContent = STATUS_LABEL[quest.status];
    titleRow.append(titleEl, statusBadge);
    right.appendChild(titleRow);

    // Description
    const desc = el('p', { fontSize: '12px', color: '#8b93a7', margin: '0 0 10px 0', lineHeight: '1.6' });
    desc.textContent = quest.description;
    right.appendChild(desc);

    // Objectifs
    if (quest.objectives.length > 0) {
      const objWrap = el('div', { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' });
      for (const obj of quest.objectives) {
        const done = obj.current >= obj.target;
        const objRow = el('div', { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' });
        const check = el('span', { flexShrink: '0', fontSize: '13px' });
        check.textContent = done ? '✅' : '○';
        const objText = el('span', { color: done ? '#4ade80' : '#9ca3af', textDecoration: done ? 'line-through' : 'none', flex: '1' });
        objText.textContent = `${obj.description} (${obj.current}/${obj.target})`;
        objRow.append(check, objText);

        // Progress bar
        if (obj.target > 1) {
          const pct = Math.min(100, (obj.current / obj.target) * 100);
          const barBg = el('div', { height: '4px', background: '#1e2738', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' });
          const barFill = el('div', { height: '100%', borderRadius: '2px' });
          barFill.style.width = `${pct}%`;
          barFill.style.background = done
            ? 'linear-gradient(90deg,#22c55e,#4ade80)'
            : 'linear-gradient(90deg,#38bdf8,#818cf8)';
          barBg.appendChild(barFill);
          const barWrap = el('div', { flex: '1' });
          barWrap.append(objText, barBg);
          objRow.innerHTML = '';
          objRow.append(check, barWrap);
        }
        objWrap.appendChild(objRow);
      }
      right.appendChild(objWrap);
    }

    // Récompenses
    if (quest.rewards && !isLocked) {
      const rewWrap = el('div', { display: 'flex', gap: '8px', flexWrap: 'wrap' });
      const rewLabel = el('span', { fontSize: '11px', color: '#6b7280', alignSelf: 'center' });
      rewLabel.textContent = 'Récompenses :';
      rewWrap.appendChild(rewLabel);
      if (quest.rewards.xp)       rewWrap.appendChild(reward(`✨ ${quest.rewards.xp} XP`, '#4ade80', '#0d2a1a'));
      if (quest.rewards.gold)     rewWrap.appendChild(reward(`💰 ${quest.rewards.gold} or`, '#fde047', '#1a1400'));
      if (quest.rewards.itemName) rewWrap.appendChild(reward(`🎁 ${quest.rewards.itemName}`, '#a78bfa', '#12102a'));
      right.appendChild(rewWrap);
    }

    top.append(iconBox, right);
    card.appendChild(top);
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
  return el('div', { borderTop: '1px solid #1e2738', margin: '14px 0' });
}

function reward(text: string, color: string, bg: string): HTMLElement {
  const b = el('span', {
    fontSize: '11px', fontWeight: '700', color,
    background: bg, border: `1px solid ${color}44`,
    borderRadius: '4px', padding: '3px 9px',
  });
  b.textContent = text;
  return b;
}
