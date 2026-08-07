/* Quelles instances de fouillis occupent le bas du cadre ? */

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
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=haut', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const r = await page.evaluate(() => {
  const s = window.__scene, THREE = window.__THREE;
  s.aller(2); s.simuler(6);
  const cam = s.camera; cam.updateMatrixWorld(true);

  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Vector3();
  const out = [];
  // L'ordre d'ajout est connu : chaque famille pose son maillage puis sa neige.
  const noms = ['rocher', 'rocher.neige', 'souche', 'souche.neige',
                'tronc', 'tronc.neige', 'buisson'];
  let ordre = 0;
  for (const im of s.fouillis.groupe.children) {
    if (!im.isInstancedMesh) continue;
    const famille = [noms[ordre++] || '?'];
    const nbTris = im.geometry.index ? im.geometry.index.count / 3 : im.geometry.attributes.position.count / 3;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m);
      m.decompose(p, q, e);
      const d = cam.position.distanceTo(p);
      if (d > 26) continue;
      const ec = p.clone().project(cam);
      if (Math.abs(ec.x) > 1 || Math.abs(ec.y) > 1 || ec.z > 1) continue;
      out.push({
        maillage: famille[0], tris: nbTris,
        distance: +d.toFixed(1),
        echelle: e.toArray().map((v) => +v.toFixed(2)),
        monde: p.toArray().map((v) => +v.toFixed(1)),
        ecran: [+ec.x.toFixed(2), +ec.y.toFixed(2)],
      });
    }
  }
  out.sort((a, b) => a.distance - b.distance);
  return { ordreDesMaillages: s.fouillis.groupe.children.map((c) => c.geometry.attributes.position.count), proches: out.slice(0, 24) };
});

console.log(JSON.stringify(r, null, 2));
await nav.close();
