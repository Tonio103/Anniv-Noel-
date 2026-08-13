/* QU'Y A-T-IL A VOIR A LA PREMIERE IMAGE ?

   Le plan d'ouverture montre une plaine blanche presque nue : trois arbres au
   loin et un cerf gros comme un pouce. Avant de recomposer le mouvement, il
   faut savoir si c'est le CADRAGE qui rate ou s'il n'y a reellement rien a
   cadrer. On compte donc les troncs autour du depart, par couronnes. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
await build();
const nav = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=bas',
                { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const r = await page.evaluate(() => {
  const s = window.__scene, THREE = window.__THREE;
  const DEPART = 26;
  const p0 = s.chemin.point(DEPART, new THREE.Vector3());

  /* Les sapins vivent dans des InstancedMesh par troncon : on relit leurs
     matrices pour recuperer les positions reelles, plutot que de refaire le
     semis a la main et de mesurer autre chose que ce qui est affiche. */
  const arbres = [];
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  s.foret.groupe.traverse((o) => {
    if (!o.isInstancedMesh) return;
    if (!/tronc|arbre|sapin|feuill/i.test(o.name || '')) { /* on prend tout */ }
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      v.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
      arbres.push([v.x, v.z, o.name]);
    }
  });

  const couronnes = [15, 25, 35, 50, 70, 100];
  const compte = {};
  for (const R of couronnes) {
    const vus = new Set();
    let n = 0;
    for (const [x, z, nom] of arbres) {
      if (Math.hypot(x - p0.x, z - p0.z) < R) { n++; vus.add(nom); }
    }
    compte[R] = n;
  }

  const noms = {};
  for (const [, , nom] of arbres) noms[nom] = (noms[nom] || 0) + 1;

  return {
    p0: [+p0.x.toFixed(1), +p0.z.toFixed(1)],
    total: arbres.length, compte, noms,
    clairieres: s.chemin.haltes.slice(0, 2).map((h) => ({ s: +h.s.toFixed(1) })),
    halte0: +s.chemin.haltes[0].s.toFixed(1),
  };
});
console.log(JSON.stringify(r, null, 2));
await nav.close();
