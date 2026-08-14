/* COMBIEN DE BOSSES LA LIGNE DE DOS A-T-ELLE ?

   Antoine : « il a plein de bosses sur le dos, ne ressemble pas a un cerf ».
   La cause mesuree : le tronc etait une chaine de six capsules reliees par
   des DROITES ; chaque segment change de pente a la jonction avec le
   suivant, et le minimum adouci lisse l'angle sans effacer le changement de
   courbure — ce residu se lit comme une succession de bosses. Sur la version
   d'origine, cet outil comptait NEUF extremums locaux entre la croupe et le
   poitrail, la ou un seul pic (le garrot) et un seul creux (le rein) etaient
   voulus.

   La correction trace desormais la ligne de dos et celle du ventre par une
   spline cubique monotone (Fritsch-Carlson), echantillonnee en vingt
   segments courts. Cet outil reste utile : toute retouche future de
   l'anatomie doit se revalider ici avant d'etre jugee a l'oeil, parce que le
   rendu seul ne dit pas SI un renflement est voulu ou accidentel — le champ,
   lui, ne ment pas. */
import { anatomie, champ } from '../src/deer/shape.js';

function surfaceY(f, z) {
  let lo = 0.9, hi = 1.6;
  if (f(0, hi, z) < 0) return null;   // toujours dedans : pas de surface a ce z
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    if (f(0, mid, z) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function extremes(nom, caps) {
  const f = champ(caps, 0.024);
  const pts = [];
  for (let z = 0.85; z >= -0.85; z -= 0.005) {
    const y = surfaceY(f, z);
    if (y !== null) pts.push([z, y]);
  }
  const ex = [];
  for (let i = 2; i < pts.length - 2; i++) {
    const [, y0] = pts[i - 2], [, y1] = pts[i - 1], [, y2] = pts[i], [, y3] = pts[i + 1], [, y4] = pts[i + 2];
    if (y2 > y1 && y2 > y3 && y2 >= y0 && y2 >= y4) ex.push(['pic', pts[i][0], y2]);
    if (y2 < y1 && y2 < y3 && y2 <= y0 && y2 <= y4) ex.push(['creux', pts[i][0], y2]);
  }
  console.log(`\n  --- ${nom} : ${ex.length} extremums locaux ---`);
  for (const [type, z, y] of ex) {
    console.log(`    ${type.padEnd(6)} a z=${z.toFixed(3).padStart(6)}  y=${y.toFixed(4)}`);
  }
  return ex;
}

const tous = anatomie();
const tronc = tous.filter((c) => c.groupe === 'tronc');
extremes('tronc seul', tronc);
const global = extremes('cerf entier', tous);

const attendus = 4;   // croupe, rein, garrot, transition poitrail->cou
if (global.length > attendus + 2) {
  console.log(`\n  ATTENTION : ${global.length} extremums, nettement plus que les ${attendus} attendus — verifier avant de rendre.`);
} else {
  console.log(`\n  OK : ${global.length} extremums, coherent avec la silhouette voulue.`);
}
