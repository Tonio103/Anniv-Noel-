/* Les LIENS sont-ils atteignables ?

   Complement de cartes.mjs : savoir qu'une carte est coupee a soixante pour
   cent ne dit pas encore ce qu'on perd. Ce qu'on perd, ici, ce sont les liens
   d'achat, les sources et les cases a cocher — tous places en fin de carte,
   donc tous du mauvais cote de la ligne de flottaison.

   On compte, halte par halte, combien de ces elements tombent au-dessus du
   bas visible du conteneur. Resultat de la premiere mesure : zero lien sur
   dix, zero source sur une, deux cases sur cinq. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const large = Number(process.env.W || 390);
const haut = Number(process.env.H || 844);

await build();
const nav = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
});
const page = await nav.newPage({ viewport: { width: large, height: haut }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=bas', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const r = await page.evaluate(() => {
const s = window.__scene;
const out = [];
for (let h = 1; h <= 9; h++) {
  s.aller(h, 'approche'); s.simuler(30);
  s.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  s.simuler(16);
  const sc = document.querySelector('.card-scroll');
  if (!sc) continue;
  const bas = sc.getBoundingClientRect().bottom;
  const compte = (sel) => {
    const els = [...sc.querySelectorAll(sel)];
    const visibles = els.filter((e) => e.getBoundingClientRect().top < bas - 8);
    return els.length ? `${visibles.length}/${els.length}` : '-';
  };
  out.push({ halte: h, liens: compte('.c-link'), sources: compte('.c-sub'), coches: compte('.c-ck') });
}
return out;

});
console.log('halte  liens visibles  sources  coches');
for (const l of r) console.log(`  ${l.halte}      ${l.liens.padEnd(12)} ${l.sources.padEnd(8)} ${l.coches}`);
await nav.close();
