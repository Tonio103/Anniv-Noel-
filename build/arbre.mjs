/* UN SAPIN, DE PRES, AU SOL.

   Juger un arbre depuis un plan large ou la camera flotte a trente metres,
   c'est juger le brouillard. Ce banc pose trois sapins — un jeune, un moyen,
   un grand — sur une neige plate, et les photographie depuis la hauteur d'un
   homme, dans la lumiere de la scene. C'est le seul cadre ou l'on voit si une
   branche a du volume. */

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LOIN = process.argv[2] === 'loin';

await build();
await mkdir(join(root, 'shots'), { recursive: true });

const nav = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
});
const page = await nav.newPage({ viewport: { width: 1000, height: 720 } });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=haut',
  { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 180000 });

const info = await page.evaluate((loin) => {
  const s = window.__scene, THREE = window.__THREE;
  document.getElementById('entry').hidden = true;
  s.boucle.pause();

  // On vide la scene de tout ce qui n'est pas le sol et le ciel.
  for (const g of [s.foret?.groupe, s.details?.groupe, s.cabanes?.groupe,
                   s.ruisseau?.groupe, s.halte?.groupe, s.cerf?.racine,
                   s.fouillis?.groupe]) {
    if (g && g.parent) g.parent.remove(g);
  }

  /* On reconstruit trois arbres a la main, avec les memes materiaux que la
     foret, pour voir exactement ce que produit la geometrie. */
  const f = s.foret;
  const modele = loin ? f.modeleLoin : f.modele;
  if (!modele) return { erreur: 'modele absent', clefs: Object.keys(f) };

  const groupe = new THREE.Group();
  const cam = s.camera;
  const base = new THREE.Vector3(cam.position.x, 0, cam.position.z - 22);
  base.y = s.relief.hauteur(base.x, base.z);

  const tailles = [4.5, 11, 22];
  const ecarts = [-9, 0, 13];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const v = new THREE.Vector3(), e = new THREE.Vector3();
  const teinte = new THREE.Color().setHSL(0.36, 0.28, 0.48);

  for (const [clef, mat] of [['feuillage', f.matFeuillage], ['neige', f.matNeige],
                             ['tronc', f.matTronc]]) {
    const im = new THREE.InstancedMesh(modele[clef], mat, tailles.length);
    for (let i = 0; i < tailles.length; i++) {
      const h = tailles[i];
      v.set(base.x + ecarts[i], s.relief.hauteur(base.x + ecarts[i], base.z + i * 3), base.z + i * 3);
      const large = 0.9;
      if (clef === 'tronc') {
        const ep = (1.6 + h * 0.27) * (0.85 + large * 0.2);
        e.set(ep, h, ep);
      } else {
        e.set(h * large, h, h * large);
      }
      m.compose(v, q, e);
      im.setMatrixAt(i, m);
      if (im.instanceColor !== undefined && clef !== 'tronc') im.setColorAt(i, teinte);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true;
    im.frustumCulled = false;
    groupe.add(im);
  }
  s.scene.add(groupe);

  cam.position.set(base.x + 2, base.y + 1.7, base.z + 17);
  cam.lookAt(base.x + 1, base.y + 7, base.z);
  cam.updateMatrixWorld(true);
  s.ciel.mesh.position.copy(cam.position);
  s.postfx.rendre(s.scene, cam, s.boucle.t);

  const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  return {
    variante: loin ? 'lointaine' : 'proche',
    triangles: { feuillage: tris(modele.feuillage), neige: tris(modele.neige), tronc: tris(modele.tronc) },
  };
}, LOIN);

console.log(JSON.stringify(info));
await page.waitForTimeout(700);
const f = join(root, `shots/arbre-${LOIN ? 'loin' : 'pres'}.png`);
await page.screenshot({ path: f });
console.log('→', f);
await nav.close();
