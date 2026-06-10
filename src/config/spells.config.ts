import { SpellElement } from '../data/spells/ISpell';

/** Couleur Phaser (0xRRGGBB) par élément — projectiles et flashs */
export const ELEMENT_COLORS: Record<SpellElement, number> = {
  feu:     0xf97316,
  air:     0xa78bfa,
  eau:     0x38bdf8,
  terre:   0x84cc16,
  neutre:  0xfde047,
  psy:     0xe879f9,
  glace:   0x67e8f9,
  electrik: 0xfacc15,
};

/** Label texte par élément (pour l'UI) */
export const ELEMENT_LABELS: Record<SpellElement, string> = {
  feu:     '🔥 Feu',
  air:     '💨 Air',
  eau:     '💧 Eau',
  terre:   '🌿 Terre',
  neutre:  '⚪ Neutre',
  psy:     '🔮 Psy',
  glace:   '❄️ Glace',
  electrik: '⚡ Électrik',
};

/** Couleur CSS hex par élément */
export const ELEMENT_CSS_COLORS: Record<SpellElement, string> = {
  feu:     '#f97316',
  air:     '#a78bfa',
  eau:     '#38bdf8',
  terre:   '#84cc16',
  neutre:  '#fde047',
  psy:     '#e879f9',
  glace:   '#67e8f9',
  electrik: '#facc15',
};
