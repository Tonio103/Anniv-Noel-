/* Capture une halte a une phase precise : c'est le seul moyen de voir le
   paquet sorti, sa lueur et la carte, qui n'existent pas pendant la marche. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const halte = Number(process.argv[2] || 3);
const phase = process.argv[3] || 'lecture';
const secondes = Number(process.argv[4] || 26);
const large = Number(process.env.W || 1280);
const haut = Number(process.env.H || 720);

await build();
const nav = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
         '--force-device-scale-factor=1'],
});
const page = await nav.newPage({ viewport: { width: large, height: haut }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=haut', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const etat = await page.evaluate(([h, ph, s]) => {
  const sc = window.__scene;
  sc.aller(h, 'approche');
  sc.simuler(s);
  return { phase: sc.phase(), voulue: ph };
}, [halte, phase, secondes]);
console.log('  phase atteinte :', JSON.stringify(etat));

await page.waitForTimeout(1800);
const f = join(root, `shots/halte-${halte}-${etat.phase}.png`);
await page.screenshot({ path: f });
console.log('  →', f);
await nav.close();
