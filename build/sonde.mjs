/* Sonde de diagnostic : ou est le cerf, que voit la camera, que rend-on.

   Quand une capture montre l'ombre de contact SANS l'animal au-dessus, il faut
   savoir laquelle des trois hypotheses est vraie : le cerf est ailleurs, il est
   invisible, ou il est bien la mais noir sur noir. On mesure au lieu de
   supposer. */

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
const page = await nav.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));

await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const s = window.__scene;
  const THREE = window.__THREE;
  s.aller(3);
  s.simuler(6);

  const cam = s.camera;
  cam.updateMatrixWorld(true);
  const proj = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(proj);

  const pos = new THREE.Vector3();
  const lignes = [];
  const boite = new THREE.Box3();

  s.cerf.racine.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.getWorldPosition(pos);
    const e = new THREE.Vector3(pos.x, pos.y, pos.z).project(cam);
    lignes.push({
      nom: o.name || o.type,
      visible: o.visible,
      parentsVisibles: (() => { let p = o, v = true; while (p) { v = v && p.visible; p = p.parent; } return v; })(),
      monde: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)],
      ecran: [+e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(3)],
      dansCadre: e.x > -1 && e.x < 1 && e.y > -1 && e.y < 1 && e.z > -1 && e.z < 1,
      tris: o.geometry?.index ? o.geometry.index.count / 3 : (o.geometry?.attributes?.position?.count || 0) / 3,
    });
  });

  boite.setFromObject(s.cerf.racine);

  return {
    racine: s.cerf.racine.position.toArray().map((v) => +v.toFixed(2)),
    racineVisible: s.cerf.racine.visible,
    boite: { min: boite.min.toArray().map((v) => +v.toFixed(2)), max: boite.max.toArray().map((v) => +v.toFixed(2)) },
    boiteDansFrustum: frustum.intersectsBox(boite),
    camera: cam.position.toArray().map((v) => +v.toFixed(2)),
    distanceCam: +cam.position.distanceTo(s.cerf.racine.position).toFixed(2),
    near: cam.near, far: cam.far, fov: cam.fov,
    phase: s.phase(),
    maillages: lignes,
  };
});

console.log(JSON.stringify(r, null, 2));
await nav.close();
