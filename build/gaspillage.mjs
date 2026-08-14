/* COMBIEN DE CE QU'ON DESSINE EST HORS DU CADRE ?

   Le seul gisement autorise : Antoine interdit de retirer quoi que ce soit de
   visible. Reste ce qui est envoye a la carte graphique sans jamais atteindre
   un pixel. Trois raisons a cela dans cette scene :

   · un `InstancedMesh` se selectionne EN BLOC. Trois cents arbres partagent
     une seule sphere englobante ; il suffit qu'un seul soit dans le cadre
     pour que les trois cents soient dessines ;
   · l'ecran est DEBOUT. En portrait le champ horizontal fait une trentaine de
     degres : tout ce qui est sur les cotes est paye et jamais vu. C'est
     exactement la situation d'Antoine ;
   · le fouillis n'est pas decoupe du tout — un seul maillage par famille pour
     six cent soixante-neuf metres de chemin.

   On compte donc, instance par instance, celles qui touchent vraiment le
   tronc de vision. Le rapport entre les deux, c'est la marge disponible. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const q = process.env.Q || 'bas';
const large = Number(process.env.W || 390), haut = Number(process.env.H || 844);

await build();
const nav = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'] });
const page = await nav.newPage({ viewport: { width: large, height: haut }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + `?debug=1&q=${q}`,
                { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const r = await page.evaluate(() => {
  const s = window.__scene, THREE = window.__THREE;

  const mesurer = () => {
    s.camera.updateMatrixWorld();
    const fr = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(s.camera.projectionMatrix, s.camera.matrixWorldInverse));
    const m = new THREE.Matrix4(), c = new THREE.Vector3();
    const sph = new THREE.Sphere();

    const acc = {};
    const compter = (groupe, etiquette, rayon) => {
      const a = acc[etiquette] || (acc[etiquette] = { dessinees: 0, utiles: 0, tri: 0, triUtiles: 0 });
      groupe.traverse((o) => {
        if (!o.isInstancedMesh || !o.visible) return;
        let parentVisible = true;
        o.traverseAncestors((p) => { if (!p.visible) parentVisible = false; });
        if (!parentVisible) return;
        const g = o.geometry;
        const tri = (g.index ? g.index.count : g.attributes.position.count) / 3;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          c.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
          a.dessinees++; a.tri += tri;
          sph.set(c, rayon);
          if (fr.intersectsSphere(sph)) { a.utiles++; a.triUtiles += tri; }
        }
      });
    };
    // Rayon genereux : un sapin est haut, son pied peut sortir du cadre alors
    // que sa cime y est. Mieux vaut surestimer l'utile que se felicier a tort.
    compter(s.foret.groupe, 'foret', 9);
    compter(s.fouillis.groupe, 'fouillis', 1.5);
    return acc;
  };

  const releves = [];
  for (const h of [1, 3, 5, 7]) {
    s.aller(h, 'route');
    s.simuler(2.5);
    const a = mesurer();
    releves.push({ halte: h, ...JSON.parse(JSON.stringify(a)) });
  }
  return { releves, aspect: +s.camera.aspect.toFixed(3), fov: +s.camera.fov.toFixed(1) };
});

console.log(`  cadre : aspect ${r.aspect} · fov vertical ${r.fov}°\n`);
console.log('  halte  famille    instances dessinees   dont dans le cadre      triangles   dont utiles');
for (const l of r.releves) {
  for (const f of ['foret', 'fouillis']) {
    const a = l[f]; if (!a) continue;
    const pc = a.dessinees ? Math.round(a.utiles / a.dessinees * 100) : 0;
    const pct = a.tri ? Math.round(a.triUtiles / a.tri * 100) : 0;
    console.log(`  ${String(l.halte).padStart(5)}  ${f.padEnd(9)} ${String(a.dessinees).padStart(12)} ${String(a.utiles).padStart(20)} (${String(pc).padStart(3)}%) ${String(Math.round(a.tri)).padStart(12)} ${String(Math.round(a.triUtiles)).padStart(9)} (${pct}%)`);
  }
}
await nav.close();
