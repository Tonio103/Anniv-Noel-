/* Pourquoi ne voit-on pas les empreintes ?

   Trois maillons peuvent casser sans bruit : le cerf ne signale aucun poser,
   la carte reste noire, ou la carte est bien remplie mais le sol la lit au
   mauvais endroit. On mesure les trois separement. */

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
  const s = window.__scene;
  const emp = s.empreintes;

  // 1. Combien de sabots se posent reellement ?
  let poses = 0;
  const vrai = emp.ajouter.bind(emp);
  emp.ajouter = (...a) => { poses++; return vrai(...a); };

  s.aller(3);
  s.simuler(10);

  // 2. La carte contient-elle quelque chose ?
  const t = emp.taille;
  const buf = new Uint8Array(t * t * 4);
  s.renderer.readRenderTargetPixels(emp.rtA, 0, 0, t, t, buf);
  let max = 0, allumes = 0, somme = 0;
  for (let i = 0; i < buf.length; i += 4) {
    const v = buf[i];
    if (v > max) max = v;
    if (v > 8) allumes++;
    somme += v;
  }

  // 3. Le sol lit-il au bon endroit ? On refait le calcul du shader pour la
  //    position du cerf : uv doit tomber dans [0,1] et la carte y etre chaude.
  const u = s.relief.materiau.userData.uniforms;
  const p = s.cerf.racine.position;
  const uv = [
    (p.x - u.uEmpMin.value.x) / u.uEmpTaille.value.x,
    (p.z - u.uEmpMin.value.y) / u.uEmpTaille.value.y,
  ];
  const px = Math.floor(uv[0] * t), py = Math.floor(uv[1] * t);
  const idx = (py * t + px) * 4;

  // 4. La tuile de sol sous le cerf existe-t-elle, et a quelle finesse ?
  let tuile = null;
  for (const o of s.relief.groupe.children) {
    if (!o.geometry?.attributes?.position) continue;
    const d = Math.hypot(o.position.x - p.x, o.position.z - p.z);
    if (!tuile || d < tuile.d) tuile = { d: +d.toFixed(1), visible: o.visible, sommets: o.geometry.attributes.position.count };
  }

  return {
    poses,
    fileRestante: emp.file.length,
    actif: emp.actif,
    tailleCarte: t,
    carte: { max, texelsAllumes: allumes, pourcentAllume: +(allumes / (t * t) * 100).toFixed(3), moyenne: +(somme / (t * t)).toFixed(2) },
    emprise: emp.emprise(),
    cerf: [+p.x.toFixed(1), +p.z.toFixed(1)],
    uvSousCerf: uv.map((v) => +v.toFixed(3)),
    valeurSousCerf: px >= 0 && px < t && py >= 0 && py < t ? buf[idx] : 'hors carte',
    tuileLaPlusProche: tuile,
    uEmpTaille: u.uEmpTaille.value.toArray(),
    aEmpreintes: u.uAEmpreintes.value,
  };
});

console.log(JSON.stringify(r, null, 2));
await nav.close();
