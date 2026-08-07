/* A quelle distance un arbre apparait-il ?

   Antoine dit « les arbres apparaissent a deux metres ». On mesure : pour la
   camera courante, on cherche l'instance de sapin la plus PROCHE qui n'est
   pas dessinee. Si cette distance est petite, le defaut est reproduit. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

await build();
const nav = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
});
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=bas', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const r = await page.evaluate(() => {
  const s = window.__scene, THREE = window.__THREE;
  const sorties = [];
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  const q = new THREE.Quaternion(), e = new THREE.Vector3();

  for (const halte of [2, 5, 8]) {
    s.aller(halte); s.simuler(6);
    const cam = s.camera; cam.updateMatrixWorld(true);
    const proj = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(proj);

    let procheInvisible = Infinity, loinVisible = 0, nVisibles = 0, nCaches = 0;
    let procheInvisibleDansCadre = Infinity;
    const parTroncon = [];

    for (const tr of s.foret.troncons) {
      if (!tr) continue;
      const feuillage = tr.pres[0];
      const loin = tr.loin[0];
      const dessine = feuillage.visible || loin.visible || (tr.fond && tr.fond[0].visible);
      const dc = Math.hypot(tr.centre.x - cam.position.x, tr.centre.z - cam.position.z);
      let dMin = Infinity;
      for (let i = 0; i < feuillage.count; i++) {
        feuillage.getMatrixAt(i, m); m.decompose(p, q, e);
        const d = Math.hypot(p.x - cam.position.x, p.z - cam.position.z);
        if (d < dMin) dMin = d;
        if (dessine) { nVisibles++; if (d > loinVisible) loinVisible = d; }
        else {
          nCaches++;
          if (d < procheInvisible) procheInvisible = d;
          // Est-il dans le champ de la camera ? Un arbre cache derriere soi
          // ne gene personne ; un arbre cache DEVANT soi, si.
          const haut = e.y || 1;
          const sph = new THREE.Sphere(new THREE.Vector3(p.x, p.y + haut * 0.5, p.z), haut * 0.6);
          if (frustum.intersectsSphere(sph) && d < procheInvisibleDansCadre) {
            procheInvisibleDansCadre = d;
          }
        }
      }
      parTroncon.push({ dCentre: +dc.toFixed(0), dArbreMin: +dMin.toFixed(0), dessine });
    }

    sorties.push({
      halte,
      arbresDessines: nVisibles, arbresCaches: nCaches,
      plusProcheCache: +procheInvisible.toFixed(1),
      plusProcheCacheDansLeCadre: procheInvisibleDansCadre === Infinity ? null : +procheInvisibleDansCadre.toFixed(1),
      plusLoinDessine: +loinVisible.toFixed(0),
      troncons: parTroncon.sort((a, b) => a.dCentre - b.dCentre).slice(0, 8),
    });
  }
  return sorties;
});

for (const o of r) {
  console.log(`\nhalte ${o.halte} : ${o.arbresDessines} arbres dessines, ${o.arbresCaches} caches`);
  console.log(`  arbre cache le plus proche      : ${o.plusProcheCache} m`);
  console.log(`  ... et DANS LE CHAMP de la vue  : ${o.plusProcheCacheDansLeCadre} m   <<<`);
  console.log(`  arbre dessine le plus lointain  : ${o.plusLoinDessine} m`);
  for (const t of o.troncons) {
    console.log(`    troncon  centre a ${String(t.dCentre).padStart(4)} m · arbre le plus proche ${String(t.dArbreMin).padStart(4)} m · ${t.dessine ? 'dessine' : 'CACHE'}`);
  }
}
await nav.close();
