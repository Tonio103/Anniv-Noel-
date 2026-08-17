/* LE CORPS, DE PRES.

   Un personnage se juge de pres, sur sa silhouette et sur ses attaches — une
   epaule, une taille, un mollet. Les bancs de parcours cadrent a vingt
   metres et ne peuvent rien en dire ; celui-ci fait l'inverse.

   Il rapporte aussi le COUT, parce que ce personnage n'est plus fait de
   quatorze capsules mais d'une surface implicite polygonisee, et que trois
   exemplaires apparaissent en meme temps dans la scene du trio. Une belle
   silhouette qui fait tomber le telephone a vingt images par seconde n'est
   pas une amelioration.

   Les vues sont prises sous plusieurs angles et sur plusieurs poses : un
   corps peut etre juste de face et faux de profil, et c'est de profil que se
   voient les fautes de proportion. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await nav.newPage({ viewport: { width: 460, height: 700 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen',
                { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 240000 });
await page.click('#enterBtn');
await page.waitForTimeout(300);

const cout = await page.evaluate(() => {
  const s = window.__scene;
  const c = s.spider?.cout?.() || null;
  // Combien de sommets portent chaque os ? Un os sans peau est un os mort.
  let peau = null;
  const sc = s.apparitions.scenes.find((x) => x.nom === 'trio');
  sc.objet.traverse((o) => { if (o.isSkinnedMesh && !peau) peau = o; });
  const compte = {};
  if (peau) {
    const si = peau.geometry.attributes.skinIndex;
    const sw = peau.geometry.attributes.skinWeight;
    for (let i = 0; i < si.count; i++) {
      const k = si.getX(i);
      if (sw.getX(i) > 0.4) compte[peau.skeleton.bones[k].name] = (compte[peau.skeleton.bones[k].name] || 0) + 1;
    }
  }
  return { c, os: compte, nOs: peau ? peau.skeleton.bones.length : 0 };
});
console.log('cout du corps :', JSON.stringify(cout.c));
console.log('os :', cout.nOs, '· sommets dominants par os :');
const paires = Object.entries(cout.os).sort((a, b) => b[1] - a[1]);
console.log('   ' + paires.map(([n, v]) => `${n}=${v}`).join('  '));
const morts = ['bassin', 'colonne', 'poitrine', 'cou', 'tete',
  'brasD', 'avantD', 'mainD', 'cuisseD', 'molletD', 'piedD',
  'brasG', 'avantG', 'mainG', 'cuisseG', 'molletG', 'piedG']
  .filter((n) => !cout.os[n]);
console.log(morts.length ? `   OS SANS PEAU : ${morts.join(', ')}` : '   tous les os portent de la peau');

/* Les vues. On isole un personnage du trio, on l'eclaire comme la balade
   l'eclaire, et on tourne autour. */
const ANGLES = [
  { nom: 'face', a: 0 },
  { nom: 'trois-quarts', a: 0.9 },
  /* DEUX PROFILS, PAS UN. Le premier essai regardait toujours du meme cote
     et tombait pile derriere une lanterne de la clairiere : la vue de
     profil, celle ou se voient toutes les fautes de proportion, etait la
     seule qu'on ne pouvait pas lire. */
  { nom: 'profil', a: -Math.PI / 2 },
  { nom: 'profil-droit', a: Math.PI / 2 },
  { nom: 'dos', a: Math.PI },
];
for (const vue of ANGLES) {
  await page.evaluate(({ a }) => {
    const s = window.__scene, THREE = window.__THREE;
    let sec = 0; while (s.drone.enCinematique && sec++ < 900) s.simuler(1 / 60);
    s.boucle.pause();
    s.drone.liberer();

    const sc = s.apparitions.scenes.find((x) => x.nom === 'trio');
    const sVue = sc.s - sc.avant * 0.5;
    s.cerf.s = sVue; s.cerf.placer(sVue);
    for (let i = 0; i < 3; i++) { s.relief.maj(s.camera, s.ciel.actuel); s.foret.maj(s.camera); }
    s.apparitions.maj(1 / 60, 30, sVue, s.camera);

    // Le premier des trois, cadre en pied.
    const perso = sc.objet.children[0];
    const p = new THREE.Vector3();
    perso.getWorldPosition(p);
    const D = 2.9;
    s.camera.position.set(p.x + Math.sin(a) * D, p.y + 1.15, p.z + Math.cos(a) * D);
    s.camera.lookAt(p.x, p.y + 0.92, p.z);
    s.camera.updateMatrixWorld();
    for (let i = 0; i < 2; i++) { s.relief.maj(s.camera, s.ciel.actuel); s.foret.maj(s.camera); }
    s.postfx.rendre(s.scene, s.camera, 30);
  }, vue);
  await page.waitForTimeout(140);
  await page.screenshot({ path: join(root, `shots/corps-${vue.nom}.png`) });
  console.log(`  ecrit shots/corps-${vue.nom}.png`);
}
await nav.close();
