/* Captures d'ecran de controle.

   Le rendu se fait ici en logiciel (SwiftShader) : c'est lent, mais c'est le
   seul moyen de verifier de mes propres yeux a quoi ressemble la scene, plutot
   que de supposer qu'elle est correcte. */

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const plans = (process.argv[2] || '0,1,2,3').split(',').map(Number);
const large = Number(process.env.W || 900);
const haut = Number(process.env.H || 560);

await build();
await mkdir(join(root, 'shots'), { recursive: true });

const nav = await chromium.launch({
  executablePath: CHROME,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
    '--force-device-scale-factor=1',
  ],
});

const page = await nav.newPage({ viewport: { width: large, height: haut }, deviceScaleFactor: 1 });
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || /palier|erreur|WebGL/i.test(t)) console.log('  [page]', t);
});
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));

await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1' + (process.env.Q ? '&q=' + process.env.Q : ''), {
  waitUntil: 'load', timeout: 60000,
});

// Laisse la generation du monde se terminer
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 }).catch(() => {
  console.log('  (la scene ne s’est pas exposee — capture quand meme)');
});

const infos = await page.evaluate(() => {
  const s = window.__scene;
  if (!s) return null;
  return {
    palier: s.palier?.nom,
    sommetsRelief: s.relief?.nbSommets,
    longueurChemin: Math.round(s.chemin?.longueur),
    objets: s.scene.children.length,
  };
});
console.log('  scene :', JSON.stringify(infos));

for (const p of plans) {
  // Avance la balade jusqu'au point voulu avant de capturer.
  await page.evaluate((pl) => {
    const s = window.__scene;
    if (s?.aller) s.aller(pl);
    // On laisse la balade se stabiliser en temps simule, pas en temps reel :
    // le rendu logiciel est trop lent pour que l'attente suffise.
    if (s?.simuler) s.simuler(6);
  }, p);
  await page.waitForTimeout(1800);
  const f = join(root, `shots/plan-${p}.png`);
  await page.screenshot({ path: f });
  console.log('  →', f);
}

await nav.close();
