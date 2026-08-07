/* Regarder UN objet, seul, de pres.

   Deduire la forme d'un objet a partir d'une vignette de trente pixels au
   milieu d'une foret, c'est se tromper. On masque tout le reste, on place la
   camera devant lui, et on regarde. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CIBLE = process.argv[2] || 'buisson';   // index du maillage dans fouillis

await build();
const nav = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
});
const page = await nav.newPage({ viewport: { width: 700, height: 700 } });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=haut', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const info = await page.evaluate((cible) => {
  const s = window.__scene, THREE = window.__THREE;
  const noms = ['rocher', 'rocher.neige', 'souche', 'souche.neige',
                'tronc', 'tronc.neige', 'buisson'];
  const enfants = s.fouillis.groupe.children.filter((c) => c.isInstancedMesh);
  const i = noms.indexOf(cible);
  const cible0 = enfants[i];
  if (!cible0) return { erreur: 'introuvable', dispo: enfants.length };

  document.getElementById('entry').hidden = true;
  document.getElementById('boot')?.setAttribute('hidden', '');
  // La boucle rendrait la main au drone et rallumerait les tuiles : on la coupe.
  s.boucle.pause();

  /* On RETIRE les autres groupes au lieu de les masquer : leurs proprietaires
     remettent `visible` a vrai a chaque image. */
  for (const g of [s.foret?.groupe, s.details?.groupe, s.cabanes?.groupe,
                   s.ruisseau?.groupe, s.halte?.groupe, s.cerf?.racine]) {
    if (g && g.parent) g.parent.remove(g);
  }
  for (const enf of s.fouillis.groupe.children) enf.visible = (enf === cible0);

  // Camera devant la premiere instance.
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  const q = new THREE.Quaternion(), e = new THREE.Vector3();
  cible0.getMatrixAt(0, m); m.decompose(p, q, e);
  const haut = Math.max(e.x, e.y, e.z);
  const cam = s.camera;
  cam.position.set(p.x + haut * 1.9, p.y + haut * 1.0, p.z + haut * 2.3);
  cam.lookAt(p.x, p.y + haut * 0.45, p.z);
  cam.updateMatrixWorld(true);
  s.postfx.rendre(s.scene, cam, s.boucle.t);
  return { cible, instances: cible0.count, echelle: e.toArray().map((v) => +v.toFixed(2)) };
}, CIBLE);

console.log(JSON.stringify(info));
await page.waitForTimeout(600);
await page.screenshot({ path: join(root, `shots/iso-${CIBLE}.png`) });
console.log('→ shots/iso-' + CIBLE + '.png');
await nav.close();
