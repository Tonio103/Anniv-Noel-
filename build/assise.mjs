/* Les objets du sous-bois sont-ils POSES sur le sol ?

   Une souche qui flotte a vingt centimetres se voit immediatement et ruine la
   credibilite de tout le decor. On compare, pour chaque instance, le bas de
   sa geometrie a la hauteur du terrain sous elle. */

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
  const noms = ['rocher', 'rocher.neige', 'souche', 'souche.neige',
                'tronc', 'tronc.neige', 'buisson'];
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  const q = new THREE.Quaternion(), e = new THREE.Vector3();
  const out = [];
  let i = 0;
  for (const im of s.fouillis.groupe.children) {
    if (!im.isInstancedMesh) { continue; }
    const nom = noms[i++] || '?';
    if (nom.endsWith('.neige')) continue;
    // Le bas de la geometrie dans son repere modele.
    im.geometry.computeBoundingBox();
    const basModele = im.geometry.boundingBox.min.y;

    let flottants = 0, pireEcart = -Infinity, pireOu = null;
    const ecarts = [];
    for (let k = 0; k < im.count; k++) {
      im.getMatrixAt(k, m); m.decompose(p, q, e);
      const bas = p.y + basModele * e.y;         // approximation : pas de rotation forte
      const sol = s.relief.hauteur(p.x, p.z);
      const ecart = bas - sol;                    // > 0 : il flotte
      ecarts.push(ecart);
      if (ecart > 0.06) flottants++;
      if (ecart > pireEcart) { pireEcart = ecart; pireOu = [+p.x.toFixed(1), +p.z.toFixed(1)]; }
    }
    ecarts.sort((a, b) => a - b);
    const c = (f) => +ecarts[Math.min(ecarts.length - 1, Math.floor(ecarts.length * f))].toFixed(3);
    out.push({
      famille: nom, nombre: im.count,
      flottants, partFlottante: +(flottants / im.count * 100).toFixed(1),
      c50: c(0.5), c90: c(0.9), c99: c(0.99),
      pire: +pireEcart.toFixed(2), pireOu,
    });
  }
  return out;
});

console.log('famille      nb   flottants        median     c90     c99     pire');
for (const o of r) {
  const alerte = o.partFlottante > 5 ? '   <<<' : '';
  console.log(`${o.famille.padEnd(11)} ${String(o.nombre).padStart(4)}   ${String(o.flottants).padStart(4)} (${String(o.partFlottante + '%').padStart(5)})   ${String(o.c50).padStart(7)} ${String(o.c90).padStart(7)} ${String(o.c99).padStart(7)} ${String(o.pire).padStart(7)}${alerte}`);
}
await nav.close();
