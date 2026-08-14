/* LA MARCHE « BUGUE » DANS LES MONTEES ET LES DESCENTES — OU CA, EXACTEMENT ?

   Antoine ne dit pas ce qu'il voit, juste que ca bugue. Trois hypotheses
   mesurables, dans l'ordre de probabilite :

   1. UNE PATTE SATURE. `_resoudre` clame la distance a atteindre a
      (L1+L2)*0.995. Sur une pente raide, la cible verticale d'un sabot
      (`solPied - yRacine`) peut depasser l'allonge maximale de la jambe ;
      la patte se fige alors tendue au maximum au lieu de suivre le pied, et
      le sabot se detache visuellement du sol. C'est le genre de defaut qui
      se lit comme un bug plutot que comme une imperfection ;

   2. LE CORPS TELEPORTE. `placer()` fixe `racine.position.y` directement a
      la hauteur du terrain SOUS LE CENTRE, sans lissage, a chaque image. Si
      le terrain a des a-coups locaux (le grain fin, frequence 0,062), le
      corps entier peut sauter d'une image a l'autre ;

   3. LE CORPS NE S'INCLINE JAMAIS. Il n'y a nulle part de tangage lie a la
      pente — seul le tangage de demarche (cosmetique, +-0.03 rad) existe.
      Sur une pente forte, un corps parfaitement horizontal avec des pattes
      qui s'allongent au maximum est ce qui fait "patte de bois".

   On parcourt tout le chemin en simulant a 60 Hz, et pour chaque image on
   releve : la pente locale, la vitesse verticale du corps, et pour chaque
   patte le ratio entre la distance demandee et l'allonge maximale. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

await build();
const nav = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=bas',
                { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 180000 });

const r = await page.evaluate(() => {
  const s = window.__scene, THREE = window.__THREE;
  s.boucle.pause();
  s.aller(0, 'route');
  /* `aller()` place deja le cerf (a haltes[0].s - 30), puis on ecrasait
     `cerf.s` sans resynchroniser sa pose : la toute premiere image partait
     donc d'un corps teleporte, avec une vitesse verticale exorbitante
     (jusqu'a 58 m/s mesures) qui n'existe dans aucune vraie partie — c'est
     un artefact de LA SONDE, pas du jeu. `placer()` refait la pose au bon
     endroit avant toute simulation. */
  s.cerf.s = 0.01;
  s.cerf.placer(s.cerf.s);
  s.cerf.vitesseCible = 4.4;

  // On instrumente `_resoudre` pour recuperer le ratio d'allonge par patte,
  // sans dupliquer la geometrie du calcul.
  const cerf = s.cerf;
  const brut = cerf._resoudre.bind(cerf);
  let pireRatio = { valeur: 0 };
  let dernierRatio = {};
  cerf._resoudre = (mb, cibleCorps) => {
    const d = cibleCorps.clone().sub(mb.attache.position);
    const D = d.length();
    const max = (mb.L1 + mb.L2) * 0.995;
    const ratio = D / max;
    dernierRatio[mb.nom] = ratio;
    return brut(mb, cibleCorps);
  };

  const h = 1 / 60;
  let yPrec = cerf.racine.position.y;
  let sPrec = cerf.s;
  const releves = [];
  const trace = [];
  const N = Math.ceil((s.chemin.longueur / 4.4) / h) + 200;

  for (let i = 0; i < N && cerf.s < s.chemin.longueur - 5; i++) {
    s.simuler(h);
    const yNow = cerf.racine.position.y;
    const dY = (yNow - yPrec) / h;         // vitesse verticale du corps, m/s
    const dS = cerf.s - sPrec;

    // Pente locale : difference de hauteur du terrain sur un metre, le long
    // du chemin, au point courant.
    const p = new THREE.Vector3();
    s.chemin.point(cerf.s, p);
    const h0 = s.relief.hauteur(p.x, p.z);
    const p2 = new THREE.Vector3();
    s.chemin.point(Math.min(s.chemin.longueur, cerf.s + 1), p2);
    const h1 = s.relief.hauteur(p2.x, p2.z);
    const pente = h1 - h0;

    if (Math.abs(cerf.s - 9.2) < 3) {
      trace.push({ s: +cerf.s.toFixed(2), v: +cerf.vitesse.toFixed(2), allure: cerf.allure,
                   cycle: +cerf.cycle.toFixed(3), ratios: { ...dernierRatio } });
    }
    const pireIci = Math.max(...Object.values(dernierRatio));
    if (pireIci > pireRatio.valeur) {
      pireRatio = { valeur: pireIci, s: +cerf.s.toFixed(1), ratios: { ...dernierRatio } };
    }

    releves.push({ s: cerf.s, pente, dY, pireIci });
    yPrec = yNow; sPrec = cerf.s;
  }

  // Agregation par tranche de 20 m : pente moyenne, pire vitesse verticale,
  // pire ratio d'allonge.
  const TR = 20;
  const tranches = new Map();
  for (const r of releves) {
    const k = Math.floor(r.s / TR);
    let t = tranches.get(k);
    if (!t) tranches.set(k, (t = { s0: k * TR, pente: [], dY: 0, ratio: 0 }));
    t.pente.push(r.pente);
    t.dY = Math.max(t.dY, Math.abs(r.dY));
    t.ratio = Math.max(t.ratio, r.pireIci);
  }
  const table = [...tranches.values()].map((t) => ({
    s0: t.s0,
    penteMoy: +(t.pente.reduce((a, b) => a + b, 0) / t.pente.length).toFixed(3),
    dYmax: +t.dY.toFixed(2),
    ratioMax: +t.ratio.toFixed(3),
  }));

  return { table, pireRatio, nbImages: releves.length, trace };
});

console.log('  s debut   pente moy (m/m)   |vY| corps max (m/s)   allonge max/limite');
for (const t of r.table) {
  const alerte = t.ratio > 0.97 ? '  <-- SATURE' : t.dYmax > 3 ? '  <-- a-coup vertical' : '';
  console.log(`  ${String(t.s0).padStart(6)} ${String(t.penteMoy).padStart(16)} ${String(t.dYmax).padStart(22)} ${String(t.ratioMax).padStart(19)}${alerte}`);
}
console.log('\n  pire ratio d\'allonge observe :', r.pireRatio.valeur, 'a s=', r.pireRatio.s, JSON.stringify(r.pireRatio.ratios));
console.log('  images simulees :', r.nbImages);

console.log('\n  --- trace autour de s=9.2 ---');
for (const t of r.trace) {
  console.log(`  s=${String(t.s).padStart(5)} v=${String(t.v).padStart(5)} allure=${t.allure.padEnd(4)} cycle=${String(t.cycle).padStart(5)} ratios=${JSON.stringify(t.ratios)}`);
}
await nav.close();
