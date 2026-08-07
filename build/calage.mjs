/* Les empreintes tombent-elles LA OU LE SABOT S'EST POSE ?

   Antoine : « les empreintes sont sur le cote, en diagonale ». On ne discute
   pas : on enregistre chaque position de sabot transmise, puis on relit la
   carte a cette position exacte. Si la carte est noire la ou un sabot s'est
   pose, le decalage est dans le rendu de la carte ; si elle est allumee, le
   decalage est dans la LECTURE que fait le sol. */

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
  const s = window.__scene;
  const emp = s.empreintes;

  const poses = [];
  const vrai = emp.ajouter.bind(emp);
  emp.ajouter = (x, z, a, f) => { poses.push({ x, z, a }); return vrai(x, z, a, f); };

  s.aller(5);
  s.simuler(9);

  const t = emp.taille;
  const buf = new Uint8Array(t * t * 4);
  s.renderer.readRenderTargetPixels(emp.rtA, 0, 0, t, t, buf);

  // Emprise telle que LE SOL la lit (uniformes), pas telle que la carte la croit.
  const u = s.relief.materiau.userData.uniforms;
  const minX = u.uEmpMin.value.x, minZ = u.uEmpMin.value.y;
  const tX = u.uEmpTaille.value.x, tZ = u.uEmpTaille.value.y;

  const lire = (wx, wz) => {
    const fx = (wx - minX) / tX, fz = (wz - minZ) / tZ;
    if (fx < 0 || fx > 1 || fz < 0 || fz > 1) return -1;
    const px = Math.min(t - 1, Math.floor(fx * t));
    // Meme convention que le shader : V est l'oppose de Z (voir snowMaterial).
    const py = Math.min(t - 1, Math.floor((1 - fz) * t));
    return buf[(py * t + px) * 4];
  };

  // Pour chaque pas encore dans la fenetre : la carte est-elle allumee dessus ?
  // Et si non, ou est le maximum dans un voisinage ? Cela donne le decalage.
  let dedans = 0, touche = 0;
  let sx = 0, sz = 0, n = 0;
  const exemples = [];
  for (const p of poses) {
    const v = lire(p.x, p.z);
    if (v < 0) continue;
    dedans++;
    if (v > 20) { touche++; continue; }
    // Recherche du maximum autour, en metres.
    let best = -1, bx = 0, bz = 0;
    for (let dz = -1.2; dz <= 1.2; dz += 0.06) {
      for (let dx = -1.2; dx <= 1.2; dx += 0.06) {
        const w = lire(p.x + dx, p.z + dz);
        if (w > best) { best = w; bx = dx; bz = dz; }
      }
    }
    if (best > 20) {
      sx += bx; sz += bz; n++;
      if (exemples.length < 5) exemples.push({ pas: [+p.x.toFixed(2), +p.z.toFixed(2)], decalage: [+bx.toFixed(2), +bz.toFixed(2)], niveau: best });
    }
  }

  /* HYPOTHESE : l'axe V de la cible de rendu et celui que lit le sol sont
     opposes, donc la piste est MIROITEE en Z autour du centre de la fenetre.
     On teste directement : la carte est-elle allumee au point symetrique ? */
  const cz = emp.centre.y;
  let toucheMiroir = 0;
  for (const p of poses) {
    if (lire(p.x, 2 * cz - p.z) > 20) toucheMiroir++;
  }

  return {
    carteAllumeeSurLeMiroirEnZ: toucheMiroir,
    posesEnregistrees: poses.length,
    dansLaFenetre: dedans,
    carteAllumeeSurLePas: touche,
    decalageMoyen: n ? [+(sx / n).toFixed(2), +(sz / n).toFixed(2)] : null,
    echantillon: n,
    exemples,
    cerf: [+s.cerf.racine.position.x.toFixed(2), +s.cerf.racine.position.z.toFixed(2)],
    centreCarte: [+emp.centre.x.toFixed(2), +emp.centre.y.toFixed(2)],
    empriseLueParLeSol: { minX: +minX.toFixed(2), minZ: +minZ.toFixed(2), taille: [tX, tZ] },
    empriseDeLaCarte: emp.emprise(),
  };
});

console.log(JSON.stringify(r, null, 2));
await nav.close();
