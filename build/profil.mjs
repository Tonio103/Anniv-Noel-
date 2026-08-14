/* OU PASSE LE TEMPS ?

   Antoine veut de la fluidite sans perdre UN SEUL pixel de qualite. Autant
   dire qu'on ne peut rien baisser : il faut trouver ce qui coute sans rien
   rendre. La seule facon de ne pas se tromper est de chronometrer.

   Deux mesures sont fiables ici, et une ne l'est pas :

   · le temps JAVASCRIPT est vrai. Il s'execute sur un vrai processeur, au
     vrai rythme, et c'est lui qu'on peut reduire sans toucher a l'image ;
   · les APPELS DE DESSIN et les TRIANGLES sont vrais : ce sont des comptes,
     pas des durees ;
   · le temps GPU ne l'est pas. Je rends en logiciel ; ce chiffre-la ne dit
     rien d'un telephone. Je ne le rapporte donc pas comme une conclusion.

   On enveloppe chaque poste de la boucle pour savoir lequel mange quoi. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const q = process.env.Q || 'bas';
const large = Number(process.env.W || 390);
const haut = Number(process.env.H || 844);

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
  const s = window.__scene;
  s.aller(3, 'route');
  s.simuler(3);

  /* Enveloppes de chronometrage. On mesure la METHODE elle-meme, pas la
     ligne d'appel : ainsi on n'a rien a modifier dans les sources. */
  const T = {};
  const enrober = (obj, nom, etiquette) => {
    if (!obj || typeof obj[nom] !== 'function') return;
    const f = obj[nom].bind(obj);
    T[etiquette] = 0;
    obj[nom] = (...a) => {
      const t0 = performance.now();
      const v = f(...a);
      T[etiquette] += performance.now() - t0;
      return v;
    };
  };
  enrober(s.relief, 'maj', 'relief.maj');
  enrober(s.relief, 'majEmpreintes', 'relief.majEmpreintes');
  enrober(s.foret, 'maj', 'foret.maj');
  enrober(s.cerf, 'maj', 'cerf.maj');
  enrober(s.drone, 'maj', 'drone.maj');
  enrober(s.brume, 'maj', 'brume.maj');
  enrober(s.details, 'maj', 'details.maj');
  enrober(s.habitants, 'maj', 'habitants.maj');
  enrober(s.cabanes, 'maj', 'cabanes.maj');
  enrober(s.ciel, 'maj', 'ciel.maj');
  enrober(s.empreintes, 'rendre', 'empreintes.rendre');
  enrober(s.postfx, 'rendre', 'postfx.rendre');
  enrober(s.son, 'maj', 'son.maj');

  // Combien de fois interroge-t-on la hauteur du terrain par image ?
  let nHauteur = 0, tHauteur = 0;
  const h0 = s.relief.hauteur.bind(s.relief);
  s.relief.hauteur = (x, z) => {
    nHauteur++;
    const t0 = performance.now(); const v = h0(x, z); tHauteur += performance.now() - t0;
    return v;
  };
  let nNormale = 0;
  const n0 = s.relief.normale.bind(s.relief);
  s.relief.normale = (x, z, c) => { nNormale++; return n0(x, z, c); };

  const inf = s.renderer.info;
  inf.autoReset = false;

  const N = 90;
  const dessins = [], tris = [], images = [];
  for (let i = 0; i < N; i++) {
    inf.reset();
    const t0 = performance.now();
    s.simuler(1 / 60);
    // `simuler` ne dessine pas : on ajoute le rendu reel, comme la boucle.
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
    images.push(performance.now() - t0);
    dessins.push(inf.render.calls);
    tris.push(inf.render.triangles);
  }

  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const somme = (a) => a.reduce((x, y) => x + y, 0);

  // L'inventaire de la scene : ce qui est dessine, et par combien d'objets.
  let objets = 0, meshes = 0, instances = 0, instancesTotal = 0, visiblesInst = 0;
  s.scene.traverse((o) => {
    objets++;
    if (o.isInstancedMesh) { instances++; instancesTotal += o.count; if (o.visible) visiblesInst++; }
    else if (o.isMesh) meshes++;
  });

  return {
    palier: s.palier.nom,
    images: { median: +med(images).toFixed(2), pire: +Math.max(...images).toFixed(2) },
    postes: Object.fromEntries(Object.entries(T)
      .map(([k, v]) => [k, +(v / N).toFixed(3)])
      .sort((a, b) => b[1] - a[1])),
    totalPostes: +(somme(Object.values(T)) / N).toFixed(2),
    hauteur: { appelsParImage: Math.round(nHauteur / N), msParImage: +(tHauteur / N).toFixed(3) },
    normaleParImage: Math.round(nNormale / N),
    dessins: { median: med(dessins), pire: Math.max(...dessins) },
    triangles: { median: med(tris), pire: Math.max(...tris) },
    programmes: s.renderer.info.programs.length,
    textures: s.renderer.info.memory.textures,
    geometries: s.renderer.info.memory.geometries,
    scene: { objets, meshes, instances, instancesTotal, visiblesInst },
  };
});

console.log(JSON.stringify(r, null, 2));
await nav.close();
