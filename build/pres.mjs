/* Tout ce qui se trouve pres de la camera, instances comprises, avec son
   origine dans la scene. Sert a mettre un nom sur une forme reperee a l'oeil
   dans une capture. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const HALTE = Number(process.argv[2] || 2);

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

const r = await page.evaluate((halte) => {
  const s = window.__scene, THREE = window.__THREE;
  s.aller(halte); s.simuler(6);
  const cam = s.camera; cam.updateMatrixWorld(true);

  const racines = {
    fouillis: s.fouillis?.groupe, details: s.details?.groupe, foret: s.foret?.groupe,
    relief: s.relief?.groupe, cabanes: s.cabanes?.groupe, ruisseau: s.ruisseau?.groupe,
    halte: s.halte?.groupe, cerf: s.cerf?.racine, brume: s.brume?.groupe,
  };
  const source = (o) => {
    for (const [nom, g] of Object.entries(racines)) {
      if (!g) continue;
      let p = o; while (p) { if (p === g) return nom; p = p.parent; }
    }
    return 'scene';
  };

  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  const q = new THREE.Quaternion(), e = new THREE.Vector3();
  const mon = new THREE.Vector3();
  const out = [];

  s.scene.traverse((o) => {
    if (!o.visible || !o.geometry) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const decrire = (pos, ech) => {
      const d = cam.position.distanceTo(pos);
      if (d > 30) return;
      const ec = pos.clone().project(cam);
      if (Math.abs(ec.x) > 1 || ec.y > 1 || ec.y < -1 || ec.z > 1) return;
      out.push({
        source: source(o), nom: o.name || o.type,
        couleur: mat?.color ? '#' + mat.color.getHexString() : null,
        matiere: mat?.type,
        distance: +d.toFixed(1), echelle: ech ? ech.toArray().map((v) => +v.toFixed(2)) : null,
        ecran: [+ec.x.toFixed(2), +ec.y.toFixed(2)],
      });
    };
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.decompose(p, q, e);
        mon.copy(p).applyMatrix4(o.matrixWorld);
        decrire(mon.clone(), e.clone());
      }
    } else if (o.isMesh || o.isPoints) {
      o.getWorldPosition(mon);
      decrire(mon.clone(), null);
    }
  });
  out.sort((a, b) => a.distance - b.distance);
  return out.filter((v) => v.source !== 'cerf').slice(0, 30);
}, HALTE);

for (const v of r) {
  console.log(`${String(v.distance).padStart(6)}  ${v.source.padEnd(9)} ${String(v.nom).padEnd(14)} ${String(v.matiere).padEnd(21)} col=${String(v.couleur).padEnd(9)} ecran=${JSON.stringify(v.ecran)} ech=${JSON.stringify(v.echelle)}`);
}
await nav.close();
