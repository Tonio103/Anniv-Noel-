/* DE QUEL COTE POINTE LE GENOU ?

   Antoine : « ses pattes arriere sont a l'envers ». Le rig donne le meme sens
   de pliure aux quatre membres (`mb.sens = 1`), au motif — ecrit dans le
   commentaire — que « les deux membres vont dans le meme sens ». C'est faux
   pour un cervide :

   · l'ANTERIEUR se replie comme un bras : le carpe ressort vers l'AVANT
     (un cheval qui leve un anterieur monte le genou en avant, le canon pend
     en arriere) ;
   · le POSTERIEUR a son jarret qui ressort vers l'ARRIERE, franchement — le
     fameux zigzag de la patte arriere des ongules.

   Ils sont donc OPPOSES. Mais le signe ne se derive pas au tableau : la
   rotation se fait autour d'un axe du repere LOCAL de l'os, lui-meme deja
   pivote vers la cible. On mesure donc, au lieu de raisonner : pour chaque
   membre on releve ou tombe l'articulation par rapport a la corde qui va de
   l'attache au sabot, projetee sur l'axe du corps. Le museau pointe vers -Z,
   donc un ecart NEGATIF veut dire « vers l'avant ». */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await nav.newPage({ viewport: { width: 600, height: 500 } });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen',
                { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 180000 });

const r = await page.evaluate(() => {
  const s = window.__scene, THREE = window.__THREE;
  const cerf = s.cerf;
  s.aller(2, 'route');
  for (let i = 0; i < 40; i++) s.simuler(1 / 60);

  const releve = (etiquette) => {
    const out = {};
    for (const mb of cerf.membres) {
      const att = new THREE.Vector3(), genou = new THREE.Vector3(), pied = new THREE.Vector3();
      mb.haut.getWorldPosition(att);
      mb.bas.getWorldPosition(genou);
      // Le bout du segment bas, c'est le sabot : on l'obtient en descendant
      // de L2 le long de l'axe local de l'os.
      pied.set(0, -mb.L2, 0).applyMatrix4(mb.bas.matrixWorld);
      // Ecart du genou a la corde attache→sabot, ramene dans le repere du
      // corps (le cerf regarde vers -Z de son repere local).
      const t = new THREE.Vector3().subVectors(pied, att);
      const u = new THREE.Vector3().subVectors(genou, att);
      const k = u.dot(t) / Math.max(1e-6, t.dot(t));
      const ecart = u.clone().sub(t.clone().multiplyScalar(k));
      // Repasser l'ecart du monde vers le repere du corps
      const inv = new THREE.Matrix4().copy(cerf.racine.matrixWorld).invert();
      const e2 = ecart.clone().transformDirection(inv);
      out[mb.nom] = +e2.z.toFixed(4);
    }
    return { etiquette, ecartsZ: out };
  };

  const avant = releve('sens actuel (1 partout)');

  // On inverse le sens des posterieurs et on remesure.
  for (const mb of cerf.membres) mb.sens = mb.avant ? 1 : -1;
  for (let i = 0; i < 40; i++) s.simuler(1 / 60);
  const apres = releve('posterieurs inverses');

  return { avant, apres };
});

const lire = (o) => {
  console.log(`\n${o.etiquette}`);
  for (const [nom, z] of Object.entries(o.ecartsZ)) {
    const ou = z < -0.002 ? 'AVANT' : z > 0.002 ? 'ARRIERE' : 'aligne';
    const attendu = nom[0] === 'A' ? 'AVANT' : 'ARRIERE';
    console.log(`   ${nom}  ecart z = ${String(z).padStart(8)}  → pointe vers ${ou.padEnd(7)} (attendu ${attendu}) ${ou === attendu ? 'OK' : 'KO'}`);
  }
};
lire(r.avant);
lire(r.apres);
await nav.close();
