/* L'OMBRE DE CONTACT EXISTE-T-ELLE VRAIMENT A L'ECRAN ?

   Mesure faite sur une capture : sous le cerf, la neige vaut #b7b6b9 ; a un
   metre de la, #b3b4b9. Autrement dit l'ombre ne fonce RIEN. Elle est pourtant
   bien dans la scene et le code la met a jour. Il faut donc savoir ou elle est,
   quelle opacite elle a, et si elle est seulement rendue. */

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
  s.aller(2, 'route');
  s.simuler(4);

  let ombre = null;
  s.cerf.racine.traverse((o) => {
    if (o.isMesh && o.material?.isMeshBasicMaterial && o.material.transparent) ombre = o;
  });
  if (!ombre) return { erreur: 'ombre introuvable' };

  const pm = new THREE.Vector3();
  ombre.getWorldPosition(pm);
  const solIci = s.relief.hauteur(pm.x, pm.z);

  // Le rendu la dessine-t-il ? On compte les appels de dessin qui la concernent.
  let vue = false;
  const frustum = new THREE.Frustum();
  s.camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(s.camera.projectionMatrix, s.camera.matrixWorldInverse));
  ombre.geometry.computeBoundingSphere();
  const bs = ombre.geometry.boundingSphere.clone().applyMatrix4(ombre.matrixWorld);
  vue = frustum.intersectsSphere(bs);

  return {
    visible: ombre.visible,
    opacite: +ombre.material.opacity.toFixed(3),
    couleur: '#' + ombre.material.color.getHexString(),
    aMap: !!ombre.material.map,
    depthTest: ombre.material.depthTest,
    blending: ombre.material.blending,
    yMonde: +pm.y.toFixed(3),
    sol: +solIci.toFixed(3),
    ecartAuSol: +(pm.y - solIci).toFixed(3),
    racineY: +s.cerf.racine.position.y.toFixed(3),
    dansLeChamp: vue,
    echelleRacine: s.cerf.racine.scale.toArray(),
    auSol: s.cerf.membres ? s.cerf.membres.length : null,
    toneMapped: ombre.material.toneMapped,
  };
});
console.log(JSON.stringify(r, null, 2));
await nav.close();
