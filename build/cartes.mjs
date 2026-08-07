/* Les cartes montrent-elles tout leur contenu ?

   Une carte qui deborde sans le dire est pire qu'une carte trop longue : la
   famille lira la moitie d'une idee en croyant l'avoir lue en entier. On
   mesure, pour chaque halte, la hauteur reelle du contenu contre la hauteur
   visible, et on regarde si quelque chose signale qu'il faut faire defiler. */

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

const n = await page.evaluate(() => window.__scene.chemin.haltes.length);
const lignes = [];

for (let i = 0; i < n; i++) {
  const r = await page.evaluate((h) => {
    const s = window.__scene;
    s.aller(h, 'approche');
    s.simuler(30);
    s.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    s.simuler(16);

    const carte = document.querySelector('.card');
    const dedans = document.querySelector('.card-scroll');
    if (!carte || !dedans) return { halte: h, erreur: 'pas de carte', phase: s.phase() };

    const titre = carte.querySelector('h2, .card-title, .titre');
    return {
      halte: h,
      phase: s.phase(),
      titre: titre ? titre.textContent.trim().slice(0, 26) : '?',
      contenu: dedans.scrollHeight,
      visible: dedans.clientHeight,
      coupe: dedans.scrollHeight - dedans.clientHeight,
      partCachee: +(1 - dedans.clientHeight / dedans.scrollHeight).toFixed(2),
      // Y a-t-il quoi que ce soit qui annonce le defilement ?
      indice: !!carte.querySelector('.c-suite'),
      basCarte: Math.round(carte.getBoundingClientRect().bottom),
      hauteurEcran: window.innerHeight,
    };
  }, i);
  lignes.push(r);
}

console.log('halte  titre                       contenu  visible  coupe  cache  indice');
for (const l of lignes) {
  if (l.erreur) { console.log(`  ${l.halte}    ${l.erreur} (phase ${l.phase})`); continue; }
  const alerte = l.coupe > 12 ? '  <<< COUPE' : '';
  console.log(`  ${String(l.halte).padStart(2)}   ${String(l.titre).padEnd(26)} ${String(l.contenu).padStart(6)}   ${String(l.visible).padStart(6)}  ${String(l.coupe).padStart(5)}  ${String(Math.round(l.partCachee * 100) + '%').padStart(5)}  ${l.indice ? 'oui' : 'NON'}${alerte}`);
}
await nav.close();
