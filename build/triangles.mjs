/* D'OU VIENNENT LES 436 500 TRIANGLES ?

   Le profil a tranche : la logique JavaScript coute 0,23 ms par image, c'est
   a dire rien. Tout le temps est dans le dessin, et le dessin se resume a
   deux nombres — 96 appels et 436 500 triangles par image, sur un telephone.
   Antoine interdit de baisser la qualite ; on ne peut donc rien retirer de ce
   qui SE VOIT. Reste tout ce qui est envoye a la carte sans se voir.

   On releve donc, image par image et objet par objet, ce qui passe la
   selection par le champ de vision, et combien de triangles chacun apporte.
   Ce qui pese et ne se voit pas est notre marge ; le reste est intouchable. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const q = process.env.Q || 'bas';

await build();
const nav = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + `?debug=1&q=${q}`,
                { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const r = await page.evaluate(() => {
  const s = window.__scene, THREE = window.__THREE;
  s.aller(3, 'route');
  s.simuler(3);

  /* On intercepte le rendu au plus bas niveau utile : `renderBufferDirect`
     est appele une fois par appel de dessin reel, avec l'objet concerne.
     C'est la verite du pilote, pas une estimation refaite a la main. */
  const releve = new Map();
  const brut = s.renderer.renderBufferDirect.bind(s.renderer);
  let capture = false;
  s.renderer.renderBufferDirect = (cam, fog, geo, mat, obj, group) => {
    if (capture) {
      const g = obj.geometry || geo;
      const n = g.index ? g.index.count : (g.attributes.position?.count || 0);
      const inst = obj.isInstancedMesh ? obj.count : 1;
      const tri = (n / 3) * inst;
      const parent = obj.parent?.name || '';
      const clef = `${obj.name || obj.type}${parent ? ' ← ' + parent : ''}`;
      const e = releve.get(clef) || { tri: 0, appels: 0, inst: 0 };
      e.tri += tri; e.appels++; e.inst += inst;
      releve.set(clef, e);
    }
    return brut(cam, fog, geo, mat, obj, group);
  };

  const N = 20;
  capture = true;
  for (let i = 0; i < N; i++) {
    s.simuler(1 / 60);
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
  }
  capture = false;

  const lignes = [...releve.entries()]
    .map(([k, v]) => ({ objet: k, triParImage: Math.round(v.tri / N),
                        appelsParImage: +(v.appels / N).toFixed(1),
                        instParImage: Math.round(v.inst / N) }))
    .sort((a, b) => b.triParImage - a.triParImage);

  const total = lignes.reduce((a, l) => a + l.triParImage, 0);
  return { total, lignes: lignes.slice(0, 24), nbTypes: lignes.length };
});

console.log('  triangles par image (rendu + ombres) :', r.total, '·', r.nbTypes, 'entrees\n');
console.log('  triangles   appels   inst.  objet');
for (const l of r.lignes) {
  console.log(`  ${String(l.triParImage).padStart(9)} ${String(l.appelsParImage).padStart(8)} ${String(l.instParImage).padStart(7)}  ${l.objet}`);
}
await nav.close();
