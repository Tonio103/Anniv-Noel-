/* CAPTURE TELEPHONE.

   Toutes mes captures etaient en paysage, sur un large ecran, au palier haut.
   Or l'experience se regarde en portrait, sur un ecran de six pouces, au
   palier moyen — et c'est la que les defauts se voient : le cadrage vertical
   remplit la moitie basse de l'image avec le sol proche, la carte des traces
   est deux fois moins fine, et le brouillard mange tout le fond.

   Ce script reproduit ces trois conditions. Il ne remplace pas le vrai
   appareil, mais il ne ment plus sur le cadre.
*/

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const plans = (process.argv[2] || '2,5').split(',').map(Number);
const palier = process.env.Q || 'moyen';
// iPhone 14/15 : 393 x 852 points, densite 3.
const L = 393, H = 852, DPR = Number(process.env.DPR || 3);

await build();
await mkdir(join(root, 'shots'), { recursive: true });

const nav = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
});
const page = await nav.newPage({
  viewport: { width: L, height: H },
  deviceScaleFactor: DPR,
  isMobile: true, hasTouch: true,
});
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));

await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=' + palier,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 180000 });

const info = await page.evaluate(() => ({
  palier: window.__scene.palier?.nom,
  dpr: window.__scene.palier?.dpr,
  densite: window.devicePixelRatio,
  taillePixels: [window.__scene.renderer.domElement.width, window.__scene.renderer.domElement.height],
  brouillard: window.__scene.scene.fog?.density,
}));
console.log('  ', JSON.stringify(info));

for (const p of plans) {
  await page.evaluate((pl) => {
    const s = window.__scene;
    s.aller(pl);
    s.simuler(3);
  }, p);
  await page.waitForTimeout(2200);
  const f = join(root, `shots/tel-${p}.png`);
  await page.screenshot({ path: f });
  console.log('  →', f);
}

await nav.close();
