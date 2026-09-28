/* LA BALADE ENTIERE, EN JOURNAL.

   Chaque systeme a son banc — la locomotion, la faune, les apparitions —
   mais aucun ne regardait ce qui se passe quand ils se croisent. Or c'est
   la que tout se cassait : une apparition qui arrete le cerf pendant que la
   balade, elle, entre dans l'approche d'une halte ; une halte qui se
   termine a deux metres du point d'arret d'une scene. Chaque piece etait
   juste, l'enchainement ne l'etait pas.

   On joue donc la balade d'un bout a l'autre, dans le vrai rendu, sans rien
   sauter : le visiteur touche l'ecran quand un cadeau attend, referme la
   carte au bout de quelques secondes. Le temps est simule image par image
   (1/60 s), boucle de rendu en pause, pour que le journal ne depende pas de
   la vitesse de la machine. On note chaque bascule de phase, chaque arret
   pour une apparition, chaque depart et chaque arret du cerf — puis on juge.

   Usage : `node build/balade.mjs [--journal]` (et `GRAINE=n` pour un autre
   tirage). Sortie non nulle si un controle echoue. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
/* LE HASARD EST FIXE. Le cerf tire ses gestes au sort (un regard en
   arriere, une secousse, un coup d'allant), les oiseaux leurs seuils de
   fuite : sans graine, deux passages ne donnent pas le meme journal, et un
   defaut rare passe une fois sur trois. `GRAINE=n` en essaie une autre. */
const graine = Number(process.env.GRAINE || 20261128) >>> 0 || 1;
await page.addInitScript((g) => {
  let x = g;
  Math.random = () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 1000000) / 1000000;
  };
}, graine);
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=bas',
  { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__scene !== undefined', undefined, { timeout: 180000 });

const r = await page.evaluate(() => {
  const sc = window.__scene;
  sc.boucle.pause();
  const ev = [];                       // le journal, evenements dates
  const h = 1 / 60;

  /* La progression transmise a chaque scene, pour verifier qu'aucune ne
     recule (voir apparitions : LA PROGRESSION NE RECULE JAMAIS). */
  const reculs = {};
  for (const a of sc.apparitions.scenes) {
    const jouer = a.objet.userData.jouer;
    let max = 0;
    a.objet.userData.jouer = (u, ...reste) => {
      reculs[a.nom] = Math.max(reculs[a.nom] || 0, max - u);
      max = Math.max(max, u);
      return jouer(u, ...reste);
    };
  }

  /* On part en croisiere juste apres la cinematique d'ouverture, qui ne
     se simule pas (elle est pilotee par le temps reel). */
  sc.aller(1);
  sc.cerf.s = 45; sc.cerf.vitesse = 3.3; sc.cerf.vitesseCible = 3.3;

  /* LA FAUNE A L'ECRAN. Pour chaque animal, le temps passe dans le cadre
     et assez grand pour etre vu — au repos, et pendant son moment (l'envol,
     la fuite, la traversee). Taille en pixels a l'ecran du telephone, 844 px
     de haut : longueur de l'animal / distance, rapportee au champ vertical. */
  const T = window.__THREE;
  const v3 = new T.Vector3();
  const faune = [];
  for (const o of sc.faune.passereaux.oiseaux) faune.push({ nom: 'bouvreuils', o, taille: 0.15, seuil: 6, moment: () => o.etat === 2 || o.etat === 3, pos: () => o.pos, repos: () => o.etat <= 1 });
  sc.faune.lievres.forEach((l) => faune.push({ nom: 'lievre', o: l, taille: 0.6, seuil: 14, moment: () => l.etat === 2, pos: () => l.pos, repos: () => l.etat <= 1 }));
  sc.faune.chouettes.forEach((c) => faune.push({ nom: 'chouette', o: c, taille: 0.4, seuil: 10, moment: () => c.etat === 1, pos: () => c.pos, repos: () => c.etat === 0 }));
  const vus = {};
  const compter = (h) => {
    const cam = sc.camera;
    // Sans rendu, personne ne recalcule la matrice de vue : on projetterait
    // avec celle de la derniere image dessinee, avant la pause.
    cam.updateMatrixWorld();
    const k = 844 / (2 * Math.tan((cam.fov * Math.PI) / 360));
    const deja = new Set();
    for (const a of faune) {
      const r = vus[a.nom] || (vus[a.nom] = { repos: 0, moment: 0, momentTotal: 0, pxMax: 0 });
      const enMoment = a.moment();
      const cle = a.nom + (enMoment ? 'm' : 'r');
      if (deja.has(cle)) continue;                 // une troupe compte une fois
      if (!enMoment && !a.repos()) continue;
      v3.copy(a.pos()).project(cam);
      const d = cam.position.distanceTo(a.pos());
      const px = (a.taille / Math.max(d, 0.1)) * k;
      const dedans = Math.abs(v3.x) < 0.95 && Math.abs(v3.y) < 0.95 && v3.z < 1 && d < 60;
      if (enMoment) { r.momentTotal += h; deja.add(a.nom + 't'); }
      if (dedans && px >= a.seuil) {
        deja.add(cle);
        if (enMoment) r.moment += h; else r.repos += h;
        r.pxMax = Math.max(r.pxMax, px);
      }
    }
  };

  /* LES DISTANCES DE LA CAMERA : au paquet (quand il y en a un), au cerf,
     et au tronc le plus proche. Le drone tourne autour de chaque halte ; rien
     ne l'empechait de passer au travers du cadeau qu'il filme. */
  const arbres = sc.foret.arbres || [];
  const proches = { paquet: [], cerf: Infinity, tronc: Infinity, troncOu: 0 };
  const mesurer = () => {
    const c = sc.camera.position;
    if (sc.halte.cadeau) {
      const g = sc.halte.cadeau.groupe.position;
      const d = Math.hypot(c.x - g.x, c.z - g.z);
      const k = sc.halte.station?.id || String(sc.halte.station?.titre || '?');
      const e = proches.paquet.find((x) => x.k === k) || (proches.paquet.push({ k, d: Infinity, taille: sc.halte.station?.scene?.gift?.size || 1 }), proches.paquet[proches.paquet.length - 1]);
      e.d = Math.min(e.d, d);
    }
    const a = sc.cerf.racine.position;
    proches.cerf = Math.min(proches.cerf, Math.hypot(c.x - a.x, c.z - a.z));
    for (const t of arbres) {
      if (Math.abs(t.x - c.x) > 3 || Math.abs(t.z - c.z) > 3) continue;
      const d = Math.hypot(t.x - c.x, t.z - c.z);
      if (d < proches.tronc) { proches.tronc = d; proches.troncOu = sc.cerf.s; }
    }
  };

  let ph = sc.phase(), dansPhase = 0, arrete = false;
  const tient = new Map();
  for (let i = 0; i < 60 * 900; i++) {
    const t = i * h;
    sc.simuler(h);
    dansPhase += h;
    compter(h);
    mesurer();
    const p = sc.phase();
    const s = sc.cerf.s, v = sc.cerf.vitesse;
    if (p !== ph) {
      ev.push({ t, s, v, quoi: 'phase', de: ph, vers: p, halte: sc.chemin.haltes.findIndex((x) => Math.abs(x.s - s) < 3) });

      ph = p; dansPhase = 0;
    }
    for (const a of sc.apparitions.scenes) {
      if (!!a.enArret !== (tient.get(a.nom) || false)) {
        tient.set(a.nom, !!a.enArret);
        ev.push({ t, s, v, quoi: a.enArret ? 'retient' : 'relache', nom: a.nom, phase: p });
      }
    }
    const at = sc.cerf.attitudes;
    if (at.ebroue >= 0 && !(ev.ebroueEnCours)) { ev.push({ t, s, v, quoi: 'ebrouement', phase: p }); ev.ebroueEnCours = true; }
    if (at.ebroue < 0) ev.ebroueEnCours = false;
    if (at.k > 0.5 && !ev.attentif) { ev.push({ t, s, v, quoi: 'attentif', phase: p }); ev.attentif = true; }
    if (at.k < 0.1) ev.attentif = false;
    const immobile = v < 0.05;
    if (immobile !== arrete) { arrete = immobile; ev.push({ t, s, v, quoi: immobile ? 'arret' : 'depart', phase: p }); }
    // Le visiteur : il touche le cadeau, lit la carte, la referme.
    if (p === 'attente' && dansPhase > 3) {
      document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
      dansPhase = 0;
    }
    if (p === 'lecture' && dansPhase > 4) { document.getElementById('cardNext').click(); dansPhase = 0; }
    if (p === 'fin' && dansPhase > 8) break;
  }
  return { ev, reculs, vus, proches, fin: sc.phase(), haltes: sc.chemin.haltes.map((x) => x.s) };
});
await nav.close();

const f1 = (x) => x.toFixed(1);
if (process.argv.includes('--journal')) {
  for (const e of r.ev) {
    const tete = `${f1(e.t).padStart(6)} s  s=${f1(e.s).padStart(5)}  v=${e.v.toFixed(2)}`;
    if (e.quoi === 'phase') console.log(`${tete}  ${e.de} -> ${e.vers}`);
    else if (e.quoi === 'retient' || e.quoi === 'relache') console.log(`${tete}  [${e.nom}] ${e.quoi} (${e.phase})`);
    else console.log(`${tete}  cerf : ${e.quoi} (${e.phase})`);
  }
  console.log('');
}

/* ========================================================================= */
const verdicts = [];
const verifier = (ok, quoi) => verdicts.push([ok, quoi]);

verifier(!erreurs.length, `aucune erreur de page${erreurs.length ? ' : ' + erreurs[0] : ''}`);
verifier(r.fin === 'fin', 'la balade va jusqu a la fin');

/* 1. CHAQUE ARRET POUR UNE APPARITION ARRETE VRAIMENT LE CERF, et il ne
   repart qu'une fois la scene relachee. C'est ce que l'approche d'une halte
   cassait : Kevin retenait, l'approche relancait. */
const retenues = r.ev.filter((e) => e.quoi === 'retient');
const nonTenues = [];
for (const e of retenues) {
  const fin = r.ev.find((x) => x.t > e.t && x.quoi === 'relache' && x.nom === e.nom);
  // Deja immobile au moment ou la scene le retient (sortie de halte), ou
  // immobilise peu apres (freinage).
  const avant = r.ev.filter((x) => x.t <= e.t && (x.quoi === 'arret' || x.quoi === 'depart')).pop();
  const arret = avant?.quoi === 'arret' ? avant
    : r.ev.find((x) => x.t >= e.t && x.quoi === 'arret' && (!fin || x.t <= fin.t));
  const departAvant = arret && r.ev.find((x) => x.t > arret.t && x.quoi === 'depart' && fin && x.t < fin.t - 0.05);
  if (!arret || departAvant) nonTenues.push(e.nom);
}
console.log(`  arrets pour une apparition : ${retenues.map((e) => `${e.nom} a ${f1(e.s)} m (${e.phase})`).join(', ')}`);
verifier(retenues.length >= 7, `les scenes fixes retiennent le cerf (${retenues.length})`);
verifier(!nonTenues.length, `chaque arret immobilise le cerf jusqu a la fin de la scene${nonTenues.length ? ' — KO : ' + nonTenues.join(', ') : ''}`);

/* 2. PAS DE DEMARRAGE POUR RIEN : un depart suivi d'un arret moins de
   quatre secondes et demie plus tard, hors fin de balade. C'etait la sortie
   de halte suivie de l'arret pour Spider-Man, trois pas plus loin — trois
   secondes entre le depart et l'arret, mesurees sur l'ancien code : le
   seuil est choisi pour l'attraper avec de la marge. */
const sursauts = [];
for (const d of r.ev.filter((e) => e.quoi === 'depart' && e.phase !== 'fin')) {
  const a = r.ev.find((x) => x.t > d.t && x.quoi === 'arret');
  if (a && a.t - d.t < 4.5 && a.phase !== 'fin') sursauts.push(`${f1(d.s)} m (${f1(a.t - d.t)} s)`);
}
verifier(!sursauts.length, `aucun depart suivi d un arret dans les quatre secondes et demie${sursauts.length ? ' — ' + sursauts.join(', ') : ''}`);

/* 3. L'ARRIVEE A CHAQUE HALTE SE FAIT AU PAS DE L'APPROCHE (2,3 m/s), pas
   au trot de croisiere que la fin d'un arret restaurait a tort, et le cerf
   s'arrete au bon endroit — a moins d'un metre et demi de la halte. */
const arrivees = r.ev.filter((e) => e.quoi === 'phase' && e.de === 'approche');
// La vitesse au moment ou l'approche s'acheve : celle a laquelle il arrive.
const vMax = Math.max(...arrivees.map((e) => e.v));
const ecartMax = Math.max(...arrivees.map((e) => Math.min(...r.haltes.map((hs) => Math.abs(hs - e.s)))));
console.log(`  arrivees aux haltes : ${arrivees.length} · vitesse max a l arrivee ${vMax.toFixed(2)} m/s · ecart max a la halte ${ecartMax.toFixed(2)} m`);
verifier(arrivees.length === r.haltes.length - 1, 'le cerf arrive a chaque halte');
verifier(vMax < 2.6, "l'approche se fait au pas, jamais au trot");
verifier(ecartMax < 1.5, 'chaque arrivee tombe sur sa halte');

/* 4. AUCUNE SCENE NE SE REMBOBINE. */
const reculMax = Math.max(0, ...Object.values(r.reculs));
console.log(`  recul max de progression : ${reculMax.toFixed(3)} (${Object.keys(r.reculs).length} scenes jouees)`);
verifier(reculMax < 0.005, 'aucune apparition ne se rembobine');

/* 7. CE QUE LE CERF FAIT DE LUI-MEME : il s'ebroue pendant les haltes (et
   jamais en marchant), et il tourne la tete vers ce que fait la faune. */
const ebr = r.ev.filter((e) => e.quoi === 'ebrouement');
const att = r.ev.filter((e) => e.quoi === 'attentif');
console.log(`  cerf : ${ebr.length} ebrouements (${ebr.map((e) => `${f1(e.s)} m, ${e.phase}`).join(' · ')}) · ${att.length} moments d'attention`);
verifier(ebr.length >= 2 && ebr.every((e) => e.v < 0.05), 'il s ebroue aux haltes, jamais en marchant');
verifier(att.length >= 4, 'il tourne la tete vers la faune (bouvreuils, lievre, chouette)');

/* 6. LA CAMERA NE TRAVERSE RIEN : ni le paquet qu'elle filme, ni le cerf,
   ni un tronc. */
const pq = r.proches.paquet;
console.log(`  camera : paquet a ${pq.map((x) => x.d.toFixed(2)).join(', ')} m au plus pres · cerf ${r.proches.cerf.toFixed(2)} m · tronc ${r.proches.tronc.toFixed(2)} m (vers ${f1(r.proches.troncOu)} m)`);
verifier(pq.length >= 5 && pq.every((x) => x.d > 1.4 + 0.6 * x.taille), 'la camera ne passe jamais au travers d un paquet');
verifier(r.proches.cerf > 2.2, 'la camera ne rentre jamais dans le cerf');
verifier(r.proches.tronc > 0.9, 'la camera ne traverse aucun tronc');

/* 5. LA FAUNE SE VOIT. Au moins une seconde et demie de son moment dans
   le cadre, a une taille lisible — c'est tout ce qui separe une rencontre
   d'un calcul qui tourne pour rien. */
for (const [nom, v] of Object.entries(r.vus)) {
  console.log(`  ${nom.padEnd(10)} : au repos ${f1(v.repos)} s a l'image · moment ${f1(v.moment)} s sur ${f1(v.momentTotal)} s · ${Math.round(v.pxMax)} px au plus`);
}
for (const nom of ['bouvreuils', 'lievre', 'chouette']) {
  const v = r.vus[nom];
  verifier(v && v.moment >= 1.5, `${nom} : son moment se voit (${v ? f1(v.moment) : 0} s dans le cadre)`);
}

console.log('');
let echecs = 0;
for (const [ok, quoi] of verdicts) { if (!ok) echecs++; console.log(`  ${ok ? 'OK ' : 'KO '} ${quoi}`); }
console.log(`\nechecs : ${echecs}`);
process.exit(echecs ? 1 : 0);
