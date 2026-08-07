/* Revue d'ensemble : une capture a chaque moment-cle du parcours, au format
   et au palier du telephone d'Antoine. Sert a regarder la presentation en
   entier plutot que le seul morceau qu'on vient de toucher. */

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
         '--no-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
         '--force-device-scale-factor=1'],
});
const page = await nav.newPage({ viewport: { width: large, height: haut }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text()); });

await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=' + (process.env.Q || 'bas'),
                { waitUntil: 'load', timeout: 60000 });

// 1. L'ecran d'entree, tel qu'il s'affiche avant tout geste.
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: join(root, 'shots/r0-seuil.png') });
console.log('  → r0-seuil');

/* Ensuite : chaque halte amenee jusqu'a la lecture de sa carte. On simule
   assez longtemps pour traverser fouille, percee, attente et ouverture. */
const moments = [
  { nom: 'r1-marche', halte: 1, sec: 8, toucher: false },
  { nom: 'r2-paquet', halte: 3, sec: 30, toucher: false },
  { nom: 'r3-carte', halte: 3, sec: 30, toucher: true },
  { nom: 'r4-carte-longue', halte: 6, sec: 30, toucher: true },
  { nom: 'r5-clairiere', halte: 7, sec: 30, toucher: true },
  { nom: 'r6-finale', halte: 9, sec: 30, toucher: true },
];

for (const mo of moments) {
  const etat = await page.evaluate(([h, sec, toucher]) => {
    const s = window.__scene;
    s.aller(h, 'approche');
    s.simuler(sec);
    if (toucher) {
      /* Le geste du visiteur : c'est lui qui ouvre le paquet. L'ecoute est
         posee sur le canevas, pas sur la fenetre — un evenement envoye a
         `window` ne descend nulle part. */
      s.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      s.simuler(16);
    }
    const c = document.querySelector('.card');
    return {
      phase: s.phase(),
      carteVisible: !!c && !c.hidden,
      hauteurCarte: c ? Math.round(c.getBoundingClientRect().height) : null,
      debordeEnBas: c ? Math.round(c.getBoundingClientRect().bottom) : null,
      hauteurEcran: window.innerHeight,
    };
  }, [mo.halte, mo.sec, mo.toucher]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(root, `shots/${mo.nom}.png`) });
  console.log(`  → ${mo.nom}  ${JSON.stringify(etat)}`);
}

await nav.close();
