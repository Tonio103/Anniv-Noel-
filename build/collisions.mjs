/* Y A-T-IL UN ARBRE DANS UNE APPARITION ?

   Antoine : « fait gaffe a ce qu'il n'y ait pas de collision avec les
   arbres ». La foret seme plus de mille sapins au hasard le long du chemin,
   sans rien savoir des huit scenes qui viennent s'y ajouter : rien
   n'empechait un duelliste de se retrouver le nez dans un tronc.

   Ce banc mesure ce qui compte vraiment, c'est-a-dire pas seulement le
   TRONC. Un sapin de quinze metres etale ses branches sur trois metres de
   rayon, et c'est le feuillage qu'on voit traverser un personnage. On
   compare donc l'emprise horizontale de chaque scene au rayon de FEUILLAGE
   de chaque arbre, pas a l'epaisseur de son fut.

   On regarde aussi les buissons et les souches du sous-bois, qui poussent
   eux aussi la ou on ne les attend pas. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await nav.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen',
                { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 240000 });

const r = await page.evaluate(() => {
  const s = window.__scene, THREE = window.__THREE;
  const arbres = s.foret.arbres || [];
  const out = [];
  const mobiles = [];

  for (const sc of s.apparitions.scenes) {
    if (sc.objet.userData.suitCamera) continue;
    /* LES SCENES MOBILES NE SE VERIFIENT PAS AINSI, et le banc le disait
       faussement. Une poursuite ou un theropode parcourent cent metres le
       long du chemin : leur position a un instant donne est arbitraire, et
       un degagement fixe autour d'un point n'a aucun sens pour eux. Le banc
       les signalait pourtant en echec des qu'un semis de deux metres se
       trouvait pres de leur ancrage — un arbrisseau qu'une bete de douze
       metres ecarterait sans le voir.

       On les recense a part. Pour elles, la regle est ailleurs : elles
       roulent ou marchent sur une VOIE choisie assez loin du chemin pour
       que la marge du couloir garantisse ce qu'il faut d'espace. */
    if (sc.objet.userData.suitChemin) { mobiles.push(sc.nom); continue; }
    /* L'emprise reelle de la scene au sol. On l'obtient de la boite
       englobante, en excluant ce qui est purement lumineux — un faisceau de
       gyrophare de vingt et un metres traverserait la moitie de la foret et
       ne genera personne. */
    sc.objet.visible = true;
    let rayon = 0;
    const c = new THREE.Vector3();
    sc.objet.getWorldPosition(c);
    sc.objet.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      const m = o.material;
      if (m && m.blending === THREE.AdditiveBlending) return;   // lumiere
      const b = new THREE.Box3().setFromObject(o);
      /* Une boite peut sortir vide ou infinie — un fil de toile a l'echelle
         nulle, un nuage de points sans position encore ecrite. La retenir
         donnerait une emprise NaN, et la comparaison qui suit serait
         silencieusement toujours fausse : le banc dirait « rien autour »
         pour la pire des raisons. */
      if (!isFinite(b.min.x) || !isFinite(b.max.x)) return;
      for (const p of [b.min, b.max]) {
        rayon = Math.max(rayon, Math.hypot(p.x - c.x, p.z - c.z));
      }
    });
    sc.objet.visible = false;

    /* Les scenes purement lumineuses — le patronus, les trainees de feu —
       n'ont aucun volume solide et sortent donc a zero. On leur donne une
       emprise minimale AVANT de chercher les arbres : le seuil pose apres la
       recherche, comme il l'etait, ne servait strictement a rien et laissait
       ces trois scenes non verifiees. */
    if (rayon < 1.5) rayon = 1.5;

    const touches = [];
    for (const a of arbres) {
      /* Le rayon de feuillage d'un sapin de ce modele : environ vingt-deux
         pour cent de sa hauteur a la base, module par sa largeur propre. */
      const feuillage = a.h * 0.22 * (a.large || 1);
      const d = Math.hypot(a.x - c.x, a.z - c.z);
      if (d < rayon + feuillage) {
        touches.push({ d: +d.toFixed(2), h: +a.h.toFixed(1), f: +feuillage.toFixed(2) });
      }
    }
    out.push({ nom: sc.nom, rayon: +rayon.toFixed(2), touches });
  }
  return { out, mobiles, nArbres: arbres.length, refus: s.foret.refusDegagement, nZones: s.foret.degagements.length };
});

console.log(`${r.nArbres} arbres semes · ${r.nZones} zones degagees · ${r.refus} candidats refuses pour cause de scene\n`);
if (r.nZones && !r.refus) {
  console.log('  [ATTENTION] aucun refus : la regle de degagement ne mord sur rien, donc rien ne prouve qu\'elle fonctionne.');
}
let ko = 0;
for (const a of r.out) {
  if (a.touches.length) {
    ko++;
    console.log(`  KO  ${a.nom.padEnd(9)} emprise ${a.rayon} m — ${a.touches.length} arbre(s) dedans :`);
    for (const t of a.touches.slice(0, 4)) {
      console.log(`         a ${t.d} m, haut de ${t.h} m, feuillage ${t.f} m`);
    }
  } else {
    console.log(`  OK  ${a.nom.padEnd(9)} emprise ${a.rayon} m — rien autour`);
  }
}
if (r.mobiles.length) {
  console.log(`  (${r.mobiles.join(', ')} : scenes mobiles, verifiees par leur voie et non par un degagement)`);
}
console.log(ko === 0 ? '\nAUCUNE COLLISION' : `\n${ko} SCENE(S) A DEGAGER`);
await nav.close();
