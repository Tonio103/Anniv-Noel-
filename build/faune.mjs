/* LA FAUNE, SANS NAVIGATEUR.

   Un vrai cerf parcourt tout le chemin comme dans la balade — croisiere,
   approche ralentie, ARRET a chaque halte le temps d'une lecture, reprise —
   suivi d'une camera placee comme le drone, qui tourne autour de lui pendant
   les haltes ; la faune vit autour d'eux. On verifie ce
   qui ne se juge pas sur une capture : que chaque animal fait ce qu'il doit
   (fuir, traverser, se cacher, regarder), qu'il ne passe jamais sous la
   neige ni dans un tronc, et — pour la chouette — que la geometrie de son
   vol est la bonne, puisque c'est precisement le genre de chose qu'on se
   trompe a deduire et qu'on ne peut pas voir ici.

   Usage : `node build/faune.mjs`. Sortie non nulle si un controle echoue. */

let graine = 0x2F6E2B1;
Math.random = () => {
  graine ^= graine << 13; graine ^= graine >>> 17; graine ^= graine << 5;
  return ((graine >>> 0) % 1000000) / 1000000;
};
const faux2d = new Proxy({}, { get: () => () => faux2d });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => faux2d }) };

const THREE = await import('three');
const { Chemin } = await import('../src/camera/path.js');
const { Relief } = await import('../src/world/terrain.js');
const { Foret } = await import('../src/world/forest.js');
const { Cerf } = await import('../src/deer/deerRig.js');
const { PALIERS } = await import('../src/core/quality.js');
const { sitesApparitions } = await import('../src/world/apparitions/index.js');
const { planApparitions } = await import('../src/world/apparitions/index.js');
const { STATIONS } = await import('../src/content/stations.js');
const { Faune } = await import('../src/world/faune/index.js');

const palier = PALIERS.moyen;
const chemin = new Chemin(9, 7);
const relief = new Relief(chemin, palier, []);
const vent = { uTemps: { value: 0 }, uVent: { value: new THREE.Vector2() }, uLuneCol: { value: new THREE.Color() }, uCielCol: { value: new THREE.Color() }, uRafale: { value: 0 } };
const foret = new Foret(chemin, relief, palier, [], vent, sitesApparitions(chemin));
const scene = new THREE.Scene();
const faune = new Faune(scene, chemin, relief, palier, { foret, stations: STATIONS });

const cerf = new Cerf(palier, chemin, relief);
cerf.s = 26; cerf.placer(26);
const camera = new THREE.PerspectiveCamera(58, 0.46, 0.35, 620);

/* La camera suit le cerf comme le drone : en route, huit metres derriere,
   un peu sur la droite, a hauteur d'homme et demi ; a l'arret, elle se
   rapproche et tourne lentement autour de lui, comme pendant une halte. */
const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Vector3();
let orbite = 0, arret = 0;
const placerCamera = (dt) => {
  arret = cerf.vitesse < 0.2 ? Math.min(1, arret + dt * 0.5) : Math.max(0, arret - dt * 0.5);
  orbite = arret > 0 ? orbite + dt * 0.085 * arret : orbite * Math.exp(-0.55 * dt);
  const recul = 8 - 3.4 * arret, lat = 1.6 + 1.8 * arret;
  chemin.point(cerf.s, _p); chemin.tangente(cerf.s, _t); chemin.cote(cerf.s, _c);
  const ca = Math.cos(orbite), sa = Math.sin(orbite);
  const ox = _t.x * (-recul * ca - lat * sa) + _c.x * (lat * ca - recul * sa);
  const oz = _t.z * (-recul * ca - lat * sa) + _c.z * (lat * ca - recul * sa);
  const x = cerf.racine.position.x + ox, z = cerf.racine.position.z + oz;
  camera.position.set(x, relief.hauteur(x, z) + 2.9 - 1.1 * arret, z);
  camera.lookAt(cerf.racine.position.x, cerf.racine.position.y + 1, cerf.racine.position.z);
  camera.updateMatrixWorld(true);
};

// Instruments : on capture les poses avant que l'orchestrateur ne les vide.
const empreintes = { poses: [], ajouter(x, z, angle, force, echelle) { this.poses.push({ x, z, angle, force, echelle }); } };
const poudre = { n: 0, poser() { this.n++; } };

const H = 1 / 60;
let t = 0;
const cotePath = (x, z, s) => {
  chemin.point(s, _p); chemin.cote(s, _c);
  return (x - _p.x) * _c.x + (z - _p.z) * _c.z;
};

// Suivi par animal.
const suivi = {
  oiseaux: { decollages: new Map(), vitesseCerf: new Map(), sousSol: 0, vMax: 0, changementsVy: 0, sain: true },
  lievres: faune.lievres.map(() => ({ etats: new Set(), cotes: [], vMax: 0, sousSol: 0, sain: true, posers: [],
    tapiMax: 0, fuiteALArret: false, departFuite: -1, oreillesArriere: 0, oreillesMesures: 0 })),
  chouettes: faune.chouettes.map(() => ({ etats: new Set(), meilleurRegard: 180, cris: 0, cotes: [], ailes: [], sain: true,
    envolALArret: false })),
};
const vyPrec = new Map();

/* Un drone espion : il ne fait que noter ce qu'on lui demande de regarder. */
const droneEspion = {
  point: new THREE.Vector3(), force: 0,
  coupDOeil(p, f) { if (f > this.force) { this.point.copy(p); this.force = f; } },
};
const regards = { bouvreuils: { duree: 0, forceMax: 0 }, lievre: { duree: 0, forceMax: 0 }, chouette: { duree: 0, forceMax: 0 } };

/* La balade : croisiere a 3,3 m/s, approche a 2,3 dans les vingt-quatre
   derniers metres, arret d'une lecture (vingt-cinq secondes) a chaque halte,
   puis reprise — exactement les consignes de main.js. */
const LECTURE = 25;
let halte = 1, repos = -1;
const arrets = [];          // [debut, fin] de chaque arret, en temps
cerf.vitesseCible = 3.3;
while (cerf.s < chemin.longueur - 45) {
  t += H;
  const h = chemin.haltes[halte];
  if (repos >= 0) {
    repos += H;
    if (repos > LECTURE) { repos = -1; cerf.vitesseCible = 3.3; arrets[arrets.length - 1][1] = t; halte++; }
  } else if (h && cerf.s > h.s - 1.2) {
    cerf.vitesseCible = 0; repos = 0; arrets.push([t, Infinity, halte]);
  } else if (h && cerf.s > h.s - 24) cerf.vitesseCible = 2.3;
  cerf.maj(H, t);
  placerCamera(H);
  const nCris = faune.chouettes.map((ch) => ch.cris.length);
  faune.maj(H, t, cerf, camera, empreintes, poudre, droneEspion);
  const aLArret = repos >= 0;
  // Qui le drone regarde-t-il, a cette image ? On range le coup d'oeil
  // aupres de l'animal le plus proche du point vise.
  if (droneEspion.force > 0) {
    const pr = droneEspion.point;
    const candidats = [
      ...faune.passereaux.oiseaux.map((o) => ['bouvreuils', o.pos]),
      ...faune.lievres.map((l) => ['lievre', l.pos]),
      ...faune.chouettes.map((c) => ['chouette', c.pos]),
    ];
    let meilleur = null, dMin = Infinity;
    for (const [nom, p] of candidats) { const d = p.distanceTo(pr); if (d < dMin) { dMin = d; meilleur = nom; } }
    if (dMin < 2.5) {
      const g = regards[meilleur];
      g.duree += H; g.forceMax = Math.max(g.forceMax, droneEspion.force);
    }
    droneEspion.force = 0;
  }

  // --- bouvreuils --------------------------------------------------------
  for (const o of faune.passereaux.oiseaux) {
    if (o.etat >= 2 && !suivi.oiseaux.decollages.has(o.index)) {
      suivi.oiseaux.decollages.set(o.index, t);
      suivi.oiseaux.vitesseCerf.set(o.index, cerf.vitesse);
    }
    if (o.etat === 2 || o.etat === 3) {
      const sol = relief.hauteur(o.pos.x, o.pos.z);
      if (o.pos.y < sol - 0.02) suivi.oiseaux.sousSol++;
      suivi.oiseaux.vMax = Math.max(suivi.oiseaux.vMax, o.vit.length());
      /* L'ONDULATION SE LIT DANS L'ACCELERATION, PAS DANS LE SIGNE DE LA
         VITESSE. Premiere version : compter les inversions de la vitesse
         verticale. Mais les bouvreuils MONTENT vers leur refuge dans les
         branches : pendant la glissade ils ralentissent leur montee sans
         redescendre, et la vitesse ne change jamais de signe — le test
         echouait sur un vol pourtant ondule. On compte donc les inversions de
         l'acceleration verticale : chacune marque le passage d'une salve a
         une glissade, ou l'inverse. */
      const p = vyPrec.get(o.index);
      if (p !== undefined && o.etat === 3) {
        const acc = o.vit.y - p.vy;
        if (p.acc !== undefined && Math.sign(acc) !== Math.sign(p.acc) && Math.abs(acc) > 1e-4) suivi.oiseaux.changementsVy++;
        vyPrec.set(o.index, { vy: o.vit.y, acc });
      } else vyPrec.set(o.index, { vy: o.vit.y });
    }
    if (![o.pos.x, o.pos.y, o.pos.z].every(Number.isFinite)) suivi.oiseaux.sain = false;
  }

  // --- lievres -------------------------------------------------------------
  faune.lievres.forEach((l, i) => {
    const sv = suivi.lievres[i];
    sv.etats.add(l.etat);
    sv.tapiMax = Math.max(sv.tapiMax, l.tapi);
    if (l.etat === 2 && sv.departFuite < 0) {
      sv.departFuite = t;
      if (aLArret) sv.fuiteALArret = true;
    }
    /* Les oreilles en course : le bout doit etre DERRIERE la base, dans le
       sens de la fuite. C'est le signe qu'on s'etait trompe a deduire. */
    if (l.etat === 2 && l.vitesse > 4) {
      l.m.racine.updateMatrixWorld(true);
      const o = l.m.oreilles[0];
      const base = o.getWorldPosition(new THREE.Vector3());
      const bout = o.localToWorld(new THREE.Vector3(0, 0.19, 0));
      const av = { x: -Math.sin(l.cap), z: -Math.cos(l.cap) };
      sv.oreillesMesures++;
      if ((bout.x - base.x) * av.x + (bout.z - base.z) * av.z < 0) sv.oreillesArriere++;
    }
    if (l.etat === 2) {
      sv.vMax = Math.max(sv.vMax, l.vitesse);
      sv.cotes.push(cotePath(l.pos.x, l.pos.z, l.site.s));
      if (l.pos.y < relief.hauteur(l.pos.x, l.pos.z) - 0.02) sv.sousSol++;
    }
    if (![l.pos.x, l.pos.y, l.pos.z].every(Number.isFinite)) sv.sain = false;
  });

  // --- chouettes -------------------------------------------------------------
  faune.chouettes.forEach((ch, i) => {
    const sv = suivi.chouettes[i];
    sv.etats.add(ch.etat);
    if (ch.etat === 0 && ch.m.racine.visible) {
      /* Le regard : angle entre l'avant de la tete (-Z local) et la direction
         de la camera, dans le plan horizontal. */
      ch.m.racine.updateMatrixWorld(true);
      const q = ch.m.tete.getWorldQuaternion(new THREE.Quaternion());
      const av = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      const vers = camera.position.clone().sub(ch.m.tete.getWorldPosition(new THREE.Vector3()));
      const dCam = Math.hypot(vers.x, vers.z);
      if (dCam < 28) {
        const a = Math.acos(Math.max(-1, Math.min(1, (av.x * vers.x + av.z * vers.z) / (Math.hypot(av.x, av.z) * dCam || 1))));
        sv.meilleurRegard = Math.min(sv.meilleurRegard, a * 57.3);
      }
    }
    if (ch.etat === 1 && aLArret) sv.envolALArret = true;
    if (ch.etat === 1) {
      sv.cotes.push(cotePath(ch.pos.x, ch.pos.z, ch.site.s));
      /* La geometrie du vol : normale de l'aile dans le monde (doit etre
         proche de la verticale), et hauteur du bout d'aile selon le signe du
         battement (doit monter quand `aile` est positif). */
      ch.m.racine.updateMatrixWorld(true);
      const aile = ch.m.ailes[1];
      const qa = aile.getWorldQuaternion(new THREE.Quaternion());
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(qa);   // l'aile est mince selon Z local
      const bout = aile.localToWorld(new THREE.Vector3(0.5, 0, 0)).y - aile.getWorldPosition(new THREE.Vector3()).y;
      sv.ailes.push({ ny: Math.abs(n.y), bat: ch.aile, bout });
    }
    sv.cris += nCris[i] > 0 || ch.cris.length ? 0 : 0;
    if (![ch.pos.x, ch.pos.y, ch.pos.z].every(Number.isFinite)) sv.sain = false;
  });
  // Le cri : l'orchestrateur vide la liste ; on compte via le drapeau.
  faune.chouettes.forEach((ch, i) => { suivi.chouettes[i].cris = ch.cri ? 1 : 0; });
}

/* ========================================================================== */
const verdicts = [];
const verifier = (ok, quoi) => verdicts.push([ok, quoi]);
const mm = (x) => x.toFixed(2);

/* Chaque rencontre, sa halte, et ce qui se passe autour. On reporte
   l'apparition et le passage du ruisseau les plus proches : c'est ce qui a
   fait choisir les haltes, et c'est ce qu'un deplacement du trace ou d'une
   apparition pourrait casser sans qu'on s'en apercoive. */
const apps = planApparitions(chemin.longueur);
const L = chemin.longueur;
for (const st of faune.sites) {
  const h = chemin.haltes[st.halte];
  const ouvertes = apps.filter((a) => st.s > a.s - a.avant && st.sHalte - 24 < a.s + a.apres)
    .map((a) => `${a.nom} [${(a.s - a.avant).toFixed(0)}-${(a.s + a.apres).toFixed(0)}]`);
  console.log(`  ${st.espece.padEnd(10)} halte ${st.halte} (${STATIONS[st.halte].kind}, ${h.s.toFixed(0)} m) -> ${st.s.toFixed(0)} m, cote ${st.cote > 0 ? 'drone' : 'oppose'} · fenetres ouvertes autour : ${ouvertes.join(', ') || 'aucune'}`);
}
verifier(faune.sites.filter((x) => x.espece === 'passereaux').length === 2, 'deux troupes de bouvreuils placees');
verifier(faune.lievres.length === 1, 'un lievre place');
verifier(faune.chouettes.length === 1, 'une chouette placee');
verifier(faune.sites.every((x) => x.halte > 0 && x.halte < chemin.haltes.length - 1), 'aucune rencontre au seuil ni a la derniere halte');
verifier(faune.sites.every((x) => x.s > 45 && x.s < L - 55), 'aucune rencontre sur le depart ni sur l arrivee');

// Personne dans un tronc.
const distTronc = (x, z) => Math.min(...foret.arbres.map((a) => Math.hypot(a.x - x, a.z - z)));
const dChicot = Math.min(...faune.chouettes.map((ch) => distTronc(ch.site.x, ch.site.z)));
const dLievre = Math.min(...faune.lievres.map((l) => distTronc(l.site.x, l.site.z)));
console.log(`  --- degagements : chicot a ${mm(dChicot)} m du tronc le plus proche, lievre a ${mm(dLievre)} m`);
verifier(dChicot >= 2.3, "le chicot ne pousse dans aucun sapin");
verifier(dLievre >= 1.1, "le lievre n'est assis dans aucun tronc");
/* Pres du chemin, sinon le cadre portrait ne les montre pas : c'est la
   raison d'etre de ce placement. */
const lat = (x, z, s) => Math.abs(cotePath(x, z, s));
const lats = {
  troupes: faune.passereaux.troupes.map((tr) => lat(tr.x, tr.z, tr.s)),
  lievre: faune.lievres.map((l) => lat(l.site.x, l.site.z, l.site.s)),
  chicot: faune.chouettes.map((ch) => lat(ch.site.x, ch.site.z, ch.site.s)),
};
console.log(`  --- ecarts au chemin : bouvreuils ${lats.troupes.map(mm).join(', ')} m · lievre ${lats.lievre.map(mm).join(', ')} m · chicot ${lats.chicot.map(mm).join(', ')} m`);
verifier(lats.troupes.every((d) => d < 4), 'bouvreuils a moins de 4 m du chemin');
verifier(lats.lievre.every((d) => d < 4.5), 'lievre a moins de 4,5 m du chemin');
verifier(lats.chicot.every((d) => d < 7), 'chicot a moins de 7 m du chemin');

// Bouvreuils.
const ob = suivi.oiseaux;
const parTroupe = new Map();
for (const o of faune.passereaux.oiseaux) {
  const k = o.troupe.s;
  if (!parTroupe.has(k)) parTroupe.set(k, []);
  if (ob.decollages.has(o.index)) parTroupe.get(k).push(ob.decollages.get(o.index));
}
const etalements = [...parTroupe.values()].map((ts) => (ts.length ? Math.max(...ts) - Math.min(...ts) : 0));
const tousCaches = faune.passereaux.oiseaux.every((o) => o.etat === 4);
console.log(`  --- bouvreuils : ${faune.passereaux.oiseaux.length} oiseaux, ${ob.decollages.size} envoles, tous caches : ${tousCaches}`);
console.log(`      etalement des envols par troupe : ${etalements.map((e) => mm(e) + ' s').join(', ')} · vitesse max ${mm(ob.vMax)} m/s · inversions de l acceleration verticale ${ob.changementsVy}`);
verifier(ob.sain, 'bouvreuils : aucune valeur non finie');
verifier(ob.decollages.size === faune.passereaux.oiseaux.length, 'chaque bouvreuil s envole au passage du cerf');
/* L'envol se joue a l'arrivee du cerf, avant qu'il ne s'arrete : c'est le
   moment ou la camera le suit encore de dos et voit devant lui. */
const vDecol = [...ob.vitesseCerf.values()];
console.log(`      vitesse du cerf au decollage : min ${mm(Math.min(...vDecol))} m/s`);
verifier(vDecol.every((v) => v > 0.3), "les bouvreuils s'envolent pendant l'approche, pas a l'arret");
verifier(tousCaches, 'chaque bouvreuil finit cache dans un sapin');
verifier(etalements.every((e) => e > 0.1 && e < 1.2), "l'envol se propage dans la troupe (ni synchrone, ni etire)");
verifier(ob.vMax < 9.5, 'vitesse de vol plausible pour un passereau');
verifier(ob.changementsVy > faune.passereaux.oiseaux.length * 2, 'vol ondule (salves et glissades)');
verifier(ob.sousSol === 0, 'aucun bouvreuil sous la neige');

// Lievres.
faune.lievres.forEach((l, i) => {
  const sv = suivi.lievres[i];
  const traverse = sv.cotes.length && Math.sign(sv.cotes[0]) !== Math.sign(sv.cotes[sv.cotes.length - 1]);
  const poses = empreintes.poses.filter((p) => p.echelle < 0.9 && Math.hypot(p.x - l.site.x, p.z - l.site.z) < 45);
  console.log(`  --- lievre ${i + 1} (${l.site.s.toFixed(0)} m) : etats ${[...sv.etats].join(',')} · traverse ${traverse} · vitesse max ${mm(sv.vMax)} m/s · ${poses.length} empreintes`);
  verifier(sv.sain, `lievre ${i + 1} : aucune valeur non finie`);
  const arretLievre = arrets.find((a) => a[2] === faune.sites.find((x) => x.espece === 'lievre').halte);
  const delai = arretLievre ? sv.departFuite - arretLievre[1] : NaN;
  console.log(`      tapi max ${mm(sv.tapiMax)} · fuite ${mm(delai)} s apres la reprise · oreilles couchees vers l'arriere ${sv.oreillesMesures ? (100 * sv.oreillesArriere / sv.oreillesMesures).toFixed(0) : '-'} %`);
  verifier(sv.etats.has(1) && sv.etats.has(2), `lievre ${i + 1} : il se dresse, puis detale`);
  verifier(sv.tapiMax > 0.9, `lievre ${i + 1} : il se tapit pendant la halte`);
  verifier(!sv.fuiteALArret, `lievre ${i + 1} : il ne detale pas tant que le cerf est arrete`);
  verifier(delai > 0 && delai < 4, `lievre ${i + 1} : il detale dans les quatre secondes qui suivent la reprise`);
  verifier(sv.oreillesMesures > 0 && sv.oreillesArriere / sv.oreillesMesures > 0.95, `lievre ${i + 1} : en course, les oreilles sont couchees vers l'arriere`);
  verifier(traverse, `lievre ${i + 1} : il traverse le chemin`);
  verifier(sv.etats.has(3), `lievre ${i + 1} : il regagne le couvert`);
  verifier(sv.vMax > 6 && sv.vMax < 9, `lievre ${i + 1} : vitesse de fuite plausible`);
  verifier(poses.length >= 8, `lievre ${i + 1} : il laisse sa piste`);
  verifier(sv.sousSol === 0, `lievre ${i + 1} : jamais sous la neige`);
});

/* LA PISTE DU LIEVRE : les grandes empreintes (posterieurs) doivent tomber
   DEVANT les petites (anterieurs) de la meme foulee, dans le sens de la
   course. On prend chaque paire posterieure et les deux anterieures qui la
   precedent. */
{
  const poses = empreintes.poses.filter((p) => p.echelle < 0.9);
  let bons = 0, total = 0;
  for (let i = 3; i < poses.length; i++) {
    const p = poses[i];
    if (p.echelle < 0.4 || poses[i - 1].echelle < 0.4) continue;       // premiere posterieure de la paire
    const a1 = poses[i - 2], a2 = poses[i - 3];
    if (!(a1.echelle < 0.4 && a2.echelle < 0.4)) continue;
    const dir = { x: -Math.sin(p.angle), z: -Math.cos(p.angle) };
    const avance = (q) => q.x * dir.x + q.z * dir.z;
    total++;
    if (avance(p) > avance(a1) && avance(p) > avance(a2)) bons++;
  }
  console.log(`  --- piste : ${bons}/${total} foulees ou les posterieurs se posent devant les anterieurs`);
  verifier(total > 0 && bons / total > 0.8, 'piste de lievre : posterieurs devant les anterieurs');
}

// Chouette.
faune.chouettes.forEach((ch, i) => {
  const sv = suivi.chouettes[i];
  const traverse = sv.cotes.length && Math.sign(sv.cotes[0]) !== Math.sign(sv.cotes[sv.cotes.length - 1]);
  const enVol = sv.ailes.filter((a) => Math.abs(a.bat) > 0.3);
  const normaleOk = sv.ailes.length && sv.ailes.every((a) => a.ny > 0.55);
  const batMonte = enVol.length && enVol.filter((a) => Math.sign(a.bout) === Math.sign(a.bat)).length / enVol.length;
  console.log(`  --- chouette (${ch.site.s.toFixed(0)} m) : etats ${[...sv.etats].join(',')} · meilleur regard vers l objectif ${sv.meilleurRegard.toFixed(1)}° · cri ${sv.cris}`);
  console.log(`      vol : traverse ${traverse} · normale de l aile |ny| min ${sv.ailes.length ? mm(Math.min(...sv.ailes.map((a) => a.ny))) : '-'} · bout d aile dans le sens du battement ${enVol.length ? (batMonte * 100).toFixed(0) + ' %' : '-'}`);
  verifier(sv.sain, 'chouette : aucune valeur non finie');
  verifier(sv.meilleurRegard < 20, "elle tourne la tete vers l'objectif");
  verifier(sv.cris === 1, 'elle hulule une fois, a notre approche');
  verifier(!sv.envolALArret, "elle reste perchee pendant toute la halte");
  verifier(sv.etats.has(1) && traverse, 'elle traverse le chemin en vol');
  verifier(sv.etats.has(2), 'elle disparait sous les arbres');
  verifier(normaleOk, 'en vol, ses ailes sont a plat (et non verticales)');
  verifier(batMonte > 0.9, 'ses ailes battent de haut en bas (et non d avant en arriere)');
});

/* Le coup d'oeil du drone : chaque animal l'attire pendant son moment, et
   jamais au point d'en faire le sujet (force bornee). */
console.log(`  --- coups d oeil du drone : ${Object.entries(regards).map(([n, g]) => `${n} ${g.duree.toFixed(1)} s (force max ${g.forceMax.toFixed(2)})`).join(' · ')}`);
for (const [nom, g] of Object.entries(regards)) {
  verifier(g.duree > 1.2, `le drone jette un coup d oeil vers ${nom === 'chouette' ? 'la chouette' : nom === 'lievre' ? 'le lievre' : 'les bouvreuils'}`);
  verifier(g.forceMax < 0.6, `ce coup d oeil reste de second rang (${nom})`);
}

console.log('');
let echecs = 0;
for (const [ok, quoi] of verdicts) { if (!ok) echecs++; console.log(`  ${ok ? 'OK ' : 'KO '} ${quoi}`); }
console.log('');
console.log(`echecs : ${echecs}`);
process.exit(echecs ? 1 : 0);
