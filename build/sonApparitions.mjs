/* LES APPARITIONS FONT-ELLES DU BRUIT ?

   Un son qu'on ne peut pas entendre dans un navigateur sans carte son se
   verifie autrement : on regarde le GRAPHE. Une sirene ouverte, c'est une
   entree dans `continus` et des oscillateurs demarres ; une sirene fermee,
   c'est cette entree qui disparait. Si elle survit a la sortie de fenetre,
   elle tournera pour toujours — c'est le seul vrai risque de ce module, et
   c'est precisement ce que ce banc traque.

   On verifie donc trois choses, dans l'ordre d'importance :

   · qu'ouvrir une fenetre allume ce qui doit l'etre ;
   · qu'en sortir eteint TOUT, sans exception ;
   · qu'un aller-retour ne laisse rien derriere lui, meme repete. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
const page = await nav.newPage({ viewport: { width: 600, height: 500 } });
const erreurs = [];
page.on('pageerror', (e) => { erreurs.push(e.message); console.log('  [ERREUR PAGE]', e.message); });
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen',
                { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 180000 });
await page.click('#enterBtn');
await page.waitForTimeout(600);

const pret = await page.evaluate(() => !!(window.__scene.son && window.__scene.son.pret));
console.log(`contexte audio ouvert : ${pret ? 'oui' : 'NON — le reste ne prouve rien'}`);

const r = await page.evaluate(() => {
  const s = window.__scene;
  const ap = s.apparitions;
  const son = ap.son;
  const journal = [];
  // Le nombre de noeuds encore vivants, tel que le module le connait.
  const etat = () => [...son.continus.keys()].sort().join(',') || '—';
  /* `apparitions.maj` prend maintenant le CERF entier, pas sa seule
     abscisse — c'est par lui qu'elle arrete et relance la marche pour une
     apparition. Ce banc ne teste que le son, avec des sauts d'abscisse
     tres artificiels (loin devant, loin derriere) : on lui fournit un cerf
     factice et on desactive le mecanisme d'arret (`cadrageBase = null`),
     qui n'aurait aucun sens applique a un teleport plutot qu'a une vraie
     marche. */
  const cerfFaux = { s: 0, vitesseCible: 3.3 };
  const majFaux = (dt, t, sVal) => { cerfFaux.s = sVal; ap.maj(dt, t, cerfFaux, s.camera, null, null, null); };

  for (const sc of ap.scenes) {
    // Loin de tout : rien ne doit etre ouvert.
    majFaux(1 / 60, 0, -5000);
    const avant = etat();
    // En plein milieu de la fenetre.
    const dedans = sc.s - sc.avant * 0.5;
    for (let i = 0; i < 6; i++) majFaux(1 / 60, 10 + i / 60, dedans);
    const pendant = etat();
    // Puis bien au-dela : la fenetre s'est refermee derriere nous.
    majFaux(1 / 60, 12, sc.s + sc.apres + 200);
    const apres = etat();
    journal.push({ nom: sc.nom, avant, pendant, apres, voix: son.voix.has(sc.nom) });
  }

  /* Trois allers-retours d'affilee sur la police : si quelque chose fuit,
     c'est ici qu'on le verra s'accumuler. */
  const police = ap.scenes.find((x) => x.nom === 'police');
  for (let k = 0; k < 3; k++) {
    majFaux(1 / 60, 20 + k, police.s - police.avant * 0.5);
    majFaux(1 / 60, 20.5 + k, -5000);
  }
  const fuite = etat();

  return { journal, fuite, voix: son.voix.size };
});

let ko = 0;
for (const l of r.journal) {
  const attenduPendant = ['police', 'sabres', 'patronus'].includes(l.nom);
  const okPendant = attenduPendant ? l.pendant.includes(l.nom) : true;
  const okApres = !l.apres.includes(l.nom);
  const ok = okPendant && okApres && l.voix;
  if (!ok) ko++;
  console.log(`  ${ok ? 'OK ' : 'KO '} ${l.nom.padEnd(9)} hors=${l.avant.padEnd(10)} dedans=${l.pendant.padEnd(10)} apres=${l.apres.padEnd(10)} voix=${l.voix}`);
}
console.log(`\naucune fuite apres trois allers-retours : ${r.fuite === '—' ? 'OK' : 'KO (' + r.fuite + ')'}`);
console.log(`voix creees : ${r.voix} · erreurs de page : ${erreurs.length}`);
console.log(ko === 0 && r.fuite === '—' && erreurs.length === 0 ? '\nTOUT EST BON' : '\nIL RESTE DU TRAVAIL');
await nav.close();
