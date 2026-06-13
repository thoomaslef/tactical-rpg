#!/usr/bin/env node
/**
 * remove-bg.cjs  — Suppression automatique des fonds blancs
 *
 * Usage:
 *   node scripts/remove-bg.cjs              → traite tous les fichiers de public/Assets/raw/
 *   node scripts/remove-bg.cjs --watch      → mode veille : traite chaque nouveau fichier
 *
 * Algorithme : flood-fill BFS depuis les 4 coins (identique au jeu)
 *   - Pixels R,G,B > THRESH   → complètement transparents
 *   - Pixels entre SOFT_MIN et THRESH → transparence progressive (anti-aliasing)
 *   - Pixels intérieurs         → inchangés
 *
 * Input  : public/Assets/raw/     (PNG ou JPEG)
 * Output : public/Assets/sprites/ (PNG transparent)
 */

'use strict';

const { Jimp, intToRGBA, rgbaToInt } = require('jimp');
const fs   = require('fs');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────────────────
const THRESH   = 238;   // seuil haut : pixel « blanc pur »  (R,G,B tous > THRESH)
const SOFT_MIN = 210;   // seuil bas  : début de la transition (anti-aliasing bords)
const RAW_DIR  = path.join(__dirname, '..', 'public', 'Assets', 'raw');
const OUT_DIR  = path.join(__dirname, '..', 'public', 'Assets', 'sprites');
// ─────────────────────────────────────────────────────────────────────────────

fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Flood-fill ───────────────────────────────────────────────────────────────
function floodRemoveBg(image) {
  const w       = image.bitmap.width;
  const h       = image.bitmap.height;
  const visited = new Uint8Array(w * h);
  const queue   = [];

  // Amorcer depuis les 4 coins
  for (const [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    const rgba = intToRGBA(image.getPixelColor(cx, cy));
    if (rgba.r > THRESH && rgba.g > THRESH && rgba.b > THRESH) {
      const idx = cy * w + cx;
      visited[idx] = 1;
      queue.push(idx);
    }
  }

  while (queue.length) {
    const idx  = queue.pop();
    const x    = idx % w;
    const y    = (idx / w) | 0;
    const rgba = intToRGBA(image.getPixelColor(x, y));
    const lum  = Math.min(rgba.r, rgba.g, rgba.b);

    if (lum > SOFT_MIN) {
      const alpha = lum > THRESH
        ? 0
        : Math.round(255 * (1 - (lum - SOFT_MIN) / (THRESH - SOFT_MIN)));
      image.setPixelColor(rgbaToInt(rgba.r, rgba.g, rgba.b, alpha), x, y);
    }

    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (visited[ni]) continue;
      const np = intToRGBA(image.getPixelColor(nx, ny));
      if (np.r > THRESH && np.g > THRESH && np.b > THRESH) {
        visited[ni] = 1;
        queue.push(ni);
      }
    }
  }
}

// ── Traitement d'un fichier ──────────────────────────────────────────────────
async function processFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;

  const inPath  = path.join(RAW_DIR, filename);
  const outName = path.basename(filename, ext) + '.png';
  const outPath = path.join(OUT_DIR, outName);

  if (!fs.existsSync(inPath)) return;

  try {
    process.stdout.write(`  ⚙  ${filename.padEnd(40)} →  `);
    const image = await Jimp.read(inPath);
    floodRemoveBg(image);
    await image.write(outPath);
    process.stdout.write(`✅  ${outName}\n`);
  } catch (err) {
    process.stdout.write(`❌  ${err.message}\n`);
  }
}

// ── Mode unique ──────────────────────────────────────────────────────────────
async function processAll() {
  const files = fs.readdirSync(RAW_DIR).filter(f =>
    ['.png', '.jpg', '.jpeg'].includes(path.extname(f).toLowerCase())
  );

  if (!files.length) {
    console.log('\n📂  public/Assets/raw/ est vide.');
    console.log('    Dépose des PNG/JPEG puis relance le script.\n');
    return;
  }

  console.log(`\n🖼  ${files.length} fichier(s) trouvé(s) dans raw/\n`);
  for (const f of files) await processFile(f);
  console.log(`\n✔  Résultats dans public/Assets/sprites/\n`);
}

// ── Mode veille ──────────────────────────────────────────────────────────────
function startWatch() {
  console.log('\n👁  Mode veille actif');
  console.log('    Input  : public/Assets/raw/');
  console.log('    Output : public/Assets/sprites/');
  console.log('    Ctrl+C pour arrêter.\n');

  processAll(); // traiter les fichiers déjà présents

  fs.watch(RAW_DIR, (event, filename) => {
    if (event === 'rename' && filename) {
      setTimeout(() => processFile(filename), 400);
    }
  });
}

// ── Entrée ───────────────────────────────────────────────────────────────────
process.argv.includes('--watch') ? startWatch() : processAll();
