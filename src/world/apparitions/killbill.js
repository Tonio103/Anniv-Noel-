import * as THREE from 'three';
import { grainRond } from '../../core/dot.js';
import { smoothstep, clamp } from '../../core/noise.js';
import {
  REPERES, construireCorps, nouvelleInstance, piste, regarderVers, appliquerPose,
} from '../humanoide.js';
import { tacheDeSang } from './communs.js';

/* ==========================================================================
   2. KILL BILL

   Une silhouette, et c'est tout ce qu'il faut : un survetement JAUNE avec
   sa bande noire le long des bras et des jambes, et un sabre japonais. Ces
   deux elements suffisent — personne n'a jamais eu besoin de voir un visage
   pour reconnaitre ce plan-la.

   La bande noire ne peut pas se decouper a l'abscisse : dans une pose en
   « A », les membres sont inclines et aucun seuil sur x ne separe le dehors
   du dedans. On se sert de la NORMALE de la surface, qui le dit exactement.
   ========================================================================== */
const JAUNE = new THREE.Color(0xC9A215);
const NOIR = new THREE.Color(0x0B0C10);

function teinteKillBill(x, y, z, c, os, nx, ny, nz) {
  // Les chaussures, jaunes elles aussi mais plus sombres.
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x8A6E0E); return; }
  /* La bande. Elle court sur le cote EXTERIEUR des membres : la normale y
     pointe lateralement, loin de l'axe du corps. On exige en plus que le
     point soit du bon cote, sans quoi la face interne de la cuisse opposee
     se retrouverait rayee elle aussi. */
  const limbe = os === 'brasD' || os === 'brasG' || os === 'avantD' || os === 'avantG'
             || os === 'cuisseD' || os === 'cuisseG' || os === 'molletD' || os === 'molletG';
  if (limbe) {
    const dehors = (x > 0 ? nx : -nx);
    if (dehors > 0.72) { c.copy(NOIR); return; }
  }
  // Le col, noir : il detache la tete du survetement.
  if (y > REPERES.baseCou - 0.02 && y < REPERES.menton - 0.03) { c.copy(NOIR); return; }
  // La tete : on ne modelise pas un visage, on suggere une chevelure sombre.
  if (os === 'tete' && (z > -0.02 || y > REPERES.crane + 0.02)) { c.setHex(0x2A2118); return; }
  if (os === 'tete') { c.setHex(0xC9A98A); return; }        // le visage, dans l'ombre
  c.copy(JAUNE);
  void ny; void nz;
}

/* Le sabre. Une lame LEGEREMENT COURBE et a dos plat : c'est cette asymetrie
   qui fait « katana » plutot que « epee ». On la construit en decalant les
   sommets d'une boite fine le long d'un arc, ce qui coute deux boucles. */
function katana() {
  const g = new THREE.Group();
  const L = 0.72, N = 14;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = t * L;
    // La courbure, tres faible : deux centimetres sur toute la lame.
    const cx = Math.sin(t * 0.55) * 0.028;
    // Elle s'affine vers la pointe, et le dos reste plus epais que le fil.
    const demi = 0.0155 * (1 - t * 0.35);
    const ep = 0.0055 * (1 - t * 0.45);
    pos.push(cx - demi, y, -ep, cx + demi, y, 0, cx - demi, y, ep);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 3, b = a + 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    idx.push(a + 2, b + 2, a, a, b + 2, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const lame = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xD8E2EE, roughness: 0.12, metalness: 0.95,
    emissive: 0x1A2230, emissiveIntensity: 1, side: THREE.DoubleSide,
  }));
  g.add(lame);

  // La garde ronde, puis la poignee tressee.
  const tsuba = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.008, 14),
    new THREE.MeshStandardMaterial({ color: 0x24282F, roughness: 0.45, metalness: 0.7 })
  );
  g.add(tsuba);
  const poignee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.019, 0.24, 8),
    new THREE.MeshStandardMaterial({ color: 0x14161B, roughness: 0.85 })
  );
  poignee.position.y = -0.13;
  g.add(poignee);
  return g;
}

/* L'ADVERSAIRE. Antoine : « elle ne combat personne, il n'y a pas
   d'animation de combat, il faut vraiment que ce soit du Tarantino avec
   beaucoup de sang ». Une choregraphie solo, aussi enchainee soit-elle,
   ne raconte jamais un combat — il faut quelqu'un en face, et quelqu'un
   qui PERD. Un des hommes masques du film — costume noir, masque blanc —
   affronte donc le sabre de Kill Bill et n'y survit pas : deux coups
   portes, deux reactions, une chute, et le sang sur la neige qui reste
   bien apres que tout le reste s'est efface. */
const NOIR_MASQUE = new THREE.Color(0x101114);
const MASQUE_BLANC = new THREE.Color(0xE8E4DA);

function teinteMasque(x, y, z, c, os) {
  if (os === 'tete') {
    // Le masque couvre tout sauf une bande etroite autour des yeux.
    if (Math.abs(x) < 0.045 && y > REPERES.menton - 0.01 && y < REPERES.crane - 0.03) {
      c.setHex(0x0A0A0C);
      return;
    }
    c.copy(MASQUE_BLANC);
    return;
  }
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x08090B); return; }
  c.copy(NOIR_MASQUE);
  void z;
}

let _corpsAdversaire = null;

function adversaireMasque(palier) {
  const g = new THREE.Group();
  if (!_corpsAdversaire) {
    _corpsAdversaire = construireCorps(palier, {
      teinter: teinteMasque,
      // Plus large qu'elle : c'est ce rapport, encore, qui fait lire un
      // homme en face d'une femme, avant tout autre detail.
      gabarit: { carrure: 1.12, masse: 1.14 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.72, metalness: 0.02,
    emissive: new THREE.Color(0x0A0A0C), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsAdversaire, mat, { ombres: palier.ombres });
  g.add(perso);
  const os = perso.userData.os;

  const sabre = katana();
  sabre.rotation.x = -0.30;
  sabre.position.y = -0.02;
  os.mainD.add(sabre);

  const POSE = {
    garde: {
      brasD: [-0.95, 0, 0.30], avantD: [1.15, 0, 0], mainD: [0, 0, 0.15],
      brasG: [-0.70, 0, -0.40], avantG: [0.90, 0, 0],
      cuisseD: [-0.30, 0, 0.14], molletD: [-0.20, 0, 0],
      cuisseG: [0.30, 0, -0.16], molletG: [-0.24, 0, 0],
      colonne: [0.04, 0, 0], poitrine: [0.03, 0, 0],
    },
    /* LE PREMIER COUP LE TOUCHE : le corps se casse en arriere, le sabre
       echappe presque de la main. */
    touche1: {
      brasD: [-0.30, 0.60, -0.50], avantD: [0.30, 0, 0], mainD: [0, 0, -0.4],
      brasG: [0.40, 0, -0.70], avantG: [0.20, 0, 0],
      cuisseD: [0.20, 0, 0.10], molletD: [0.10, 0, 0],
      cuisseG: [-0.35, 0, -0.20], molletG: [0.30, 0, 0],
      bassin: [0, -0.30, 0], colonne: [-0.45, -0.20, 0.20], poitrine: [-0.35, -0.15, 0.15],
      cou: [0.10, -0.10, 0.20], tete: [0.15, -0.10, 0.25],
    },
    /* LE SECOND LE COUCHE : les genoux cedent, le sabre part au sol. */
    chute: {
      brasD: [0.10, 0.30, -0.90], avantD: [0.60, 0, 0], mainD: [0, 0, 0],
      brasG: [0.30, 0, -0.60], avantG: [0.70, 0, 0],
      cuisseD: [-1.35, 0, 0.30], molletD: [-1.65, 0, 0], piedD: [0.80, 0, 0],
      cuisseG: [-1.20, 0, -0.30], molletG: [-1.55, 0, 0], piedG: [0.75, 0, 0],
      bassin: [0, 0.70, 0.60], colonne: [0.55, 0.30, 0.30], poitrine: [0.45, 0.20, 0.20],
      cou: [0.30, 0.10, 0], tete: [0.35, 0.15, 0],
    },
  };

  g.userData.os = os;
  g.userData.POSE = POSE;
  return g;
}

/* LE SANG. Antoine, deux fois : « je veux surtout enormement de sang ».
   Quarante-six points qui retombaient en trois quarts de seconde etaient
   un aveu de pudeur, pas une scene de Tarantino. On ne retouche pas la
   nuance : on retouche l'ECHELLE — quatre fois plus de particules, deux
   fois plus grosses, qui giclent trois fois plus loin et mettent deux
   fois plus longtemps a s'effacer. */
function gerbeDeSang(N = 170) {
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0x9C0D12, size: 0.19,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const dirs = Array.from({ length: N }, () => {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.6 + 0.15;
    return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
  });
  pts.userData.dirs = dirs;
  pts.userData.mat = mat;
  return pts;
}

/* LA FONTAINE. Le second coup est celui qui tue : il merite plus qu'une
   gerbe de plus, il merite le geyser vertical le plus cite du cinema de
   sabre — un jet qui monte, retombe, et continue de pulser une seconde
   ou deux apres l'impact. */
function fontaineDeSang() {
  const N = 140;
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xA80F14, size: 0.20,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  // Presque vertical, avec juste assez d'ecart pour faire un jet et non
  // un fil — c'est cet ecart qui donne l'epaisseur du geyser.
  const dirs = Array.from({ length: N }, () => {
    const a = Math.random() * Math.PI * 2, e = 0.62 + Math.random() * 0.5;
    return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
  });
  const dephasages = Float32Array.from({ length: N }, () => Math.random() * 0.9);
  pts.userData.dirs = dirs;
  pts.userData.dephasages = dephasages;
  pts.userData.mat = mat;
  return pts;
}

let _corpsKB = null;

export function killBill(palier) {
  const g = new THREE.Group();
  if (!_corpsKB) {
    _corpsKB = construireCorps(palier, {
      teinter: teinteKillBill,
      /* Une charpente plus fine et moins large que celle de Spider-Man :
         c'est ce seul rapport qui fait lire une femme plutot qu'un homme en
         jaune, bien avant n'importe quel detail. */
      gabarit: { carrure: 0.90, masse: 0.90 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.66, metalness: 0.02,
    emissive: new THREE.Color(0x141008), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsKB, mat, { ombres: palier.ombres });
  g.add(perso);

  const os = perso.userData.os;
  const sabre = katana();
  /* Le sabre prolonge le poing : greffe sur l'os de la main, tout ce que
     fait l'epaule se propage jusqu'a la pointe. */
  sabre.rotation.x = -0.30;
  sabre.position.y = -0.02;
  os.mainD.add(sabre);

  /* LA QUEUE-DE-CHEVAL. Antoine : « on ne reconnait pas Kill Bill ». Le
     survetement jaune et le sabre suffisent en photo fixe, mais en
     mouvement, de loin et de nuit, ils se lisent comme n'importe quel
     escrimeur. La coiffure — stricte, tiree en arriere, qui fouette dans
     les coups — est le troisieme signe reconnaissable entre tous : c'est
     elle qui manquait. Une chaine de troncons coniques, comme la lame,
     greffee a l'arriere du crane. */
  const queue = new THREE.Group();
  const matCheveux = new THREE.MeshStandardMaterial({ color: 0x1C160E, roughness: 0.55 });
  const SEG = 5;
  for (let i = 0; i < SEG; i++) {
    const t0 = i / SEG;
    const l = 0.11 - t0 * 0.045;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028 * (1 - t0 * 0.55), 0.032 * (1 - t0 * 0.45), l, 6),
      matCheveux
    );
    seg.position.y = -t0 * 0.30 - l / 2;
    // Elle s'ecarte legerement du crane puis retombe, jamais tout a fait droite.
    seg.position.z = 0.05 + Math.sin(t0 * 2.4) * 0.05;
    queue.add(seg);
  }
  queue.position.set(0, REPERES.crane - 0.06, 0.05);
  os.tete.add(queue);

  /* L'ADVERSAIRE, plante la ou ses coups portent — voir plus bas, la
     sequence l'attaque a u=0,67 puis u=0,78. Il lui fait face, de l'autre
     cote de l'axe qu'elle prend une fois retournee. */
  const adversaire = adversaireMasque(palier);
  adversaire.position.set(0.55, 0, -1.95);
  adversaire.rotation.y = Math.PI - 0.35;
  g.add(adversaire);
  const osAdv = adversaire.userData.os;
  const POSE_ADV = adversaire.userData.POSE;
  appliquerPose(osAdv, POSE_ADV.garde);

  /* LE SANG. Antoine : « enormement de sang ». Une gerbe au premier coup,
     puis la FONTAINE — le geyser vertical — au second, celui qui l'acheve.
     Et une mare, pas une tache, qui reste bien apres que tout le reste
     s'est efface. */
  const sangs = [gerbeDeSang(), fontaineDeSang()];
  for (const s of sangs) { s.position.copy(adversaire.position).add(new THREE.Vector3(0, 1.1, 0)); g.add(s); }
  const tache = tacheDeSang();
  tache.position.set(adversaire.position.x, 0.02, adversaire.position.z + 0.3);
  g.add(tache);
  g.userData.poser = (relief) => {
    tache.position.y = relief.hauteur(
      g.position.x + tache.position.x, g.position.z + tache.position.z) - g.position.y + 0.02;
  };

  /* LA SEQUENCE. Antoine : « elle doit bouger, elle doit avoir une
     choregraphie ». La pose de garde tenue jusqu'au bout etait un choix
     assume — mais assume a tort : sans coup porte, une femme en jaune
     immobile ne dit "Kill Bill" a personne. On garde l'arrivee en garde
     (le sursaut, le demi-tour) puis on enchaine deux coups tres differents
     l'un de l'autre, comme le duel au sabre l'a appris : un coup HAUT
     abattu de haut en bas, puis un REVERS remontant de l'autre cote. La
     garde ne revient qu'a la toute fin, desormais GAGNEE par l'action
     plutot que donnee d'emblee. */
  const POSE = {
    dos: {
      brasD: [0.20, 0, 0.22], avantD: [0.55, 0, 0], mainD: [0, 0, -0.3],
      brasG: [0.14, 0, -0.20], avantG: [0.42, 0, 0],
      cuisseD: [-0.06, 0, 0.10], molletD: [0.10, 0, 0],
      cuisseG: [0.10, 0, -0.12], molletG: [-0.18, 0, 0],
      colonne: [0.04, 0, 0], poitrine: [0.02, 0, 0],
    },
    alerte: {
      brasD: [0.30, 0, 0.26], avantD: [0.85, 0, 0], mainD: [0, 0, -0.3],
      brasG: [0.20, 0, -0.24], avantG: [0.60, 0, 0],
      cuisseD: [-0.14, 0, 0.12], molletD: [0.14, 0, 0],
      cuisseG: [0.18, 0, -0.14], molletG: [-0.26, 0, 0],
      colonne: [0.02, -0.28, 0], poitrine: [0, -0.34, 0],
      cou: [0, -0.30, 0], tete: [0, -0.34, 0],
    },
    /* LA GARDE. Le sabre tendu vers l'avant, presque a l'horizontale, les
       deux mains sur la poignee, le corps de trois quarts et le poids en
       arriere. C'est la pose la plus citee du film. */
    garde: {
      brasD: [-1.35, 0, 0.34], avantD: [0.72, 0, 0], mainD: [0.15, 0, 0],
      brasG: [-1.05, 0, -0.52], avantG: [1.05, 0, 0],
      cuisseD: [-0.52, 0, 0.20], molletD: [-0.30, 0, 0], piedD: [0.35, 0, 0],
      cuisseG: [0.46, 0, -0.26], molletG: [-0.42, 0, 0],
      bassin: [0, 0.34, 0], colonne: [0.08, 0.28, 0], poitrine: [0.04, 0.22, 0],
      cou: [-0.06, -0.42, 0], tete: [-0.04, -0.38, 0],
    },
    // LE COUP HAUT : la lame se leve loin derriere l'epaule...
    leve: {
      brasD: [-2.55, 0.30, 0.30], avantD: [0.25, 0, 0], mainD: [0.10, 0, 0],
      brasG: [-1.05, 0, -0.52], avantG: [1.05, 0, 0],
      cuisseD: [-0.30, 0, 0.16], molletD: [-0.20, 0, 0],
      cuisseG: [0.30, 0, -0.18], molletG: [-0.30, 0, 0],
      bassin: [0, 0.10, 0], colonne: [-0.10, 0.10, 0], poitrine: [-0.12, 0.06, 0],
      cou: [-0.04, -0.20, 0], tete: [-0.02, -0.18, 0],
    },
    // ...puis s'abat, le corps en fente, jusqu'au sol de l'autre cote.
    abattu: {
      brasD: [0.55, -0.85, 0.10], avantD: [0.95, 0, 0], mainD: [0.05, 0, 0],
      brasG: [-0.30, 0, -0.10], avantG: [0.40, 0, 0],
      cuisseD: [-0.85, 0, 0.30], molletD: [-0.55, 0, 0], piedD: [0.55, 0, 0],
      cuisseG: [0.15, 0, -0.10], molletG: [-0.15, 0, 0],
      bassin: [0, 0.55, 0], colonne: [0.20, 0.45, 0], poitrine: [0.10, 0.35, 0],
      cou: [-0.10, 0.10, 0], tete: [-0.06, 0.12, 0],
    },
    // LE REVERS : la lame revient bas, de l'autre cote...
    ramene: {
      brasD: [0.10, -0.20, -0.85], avantD: [1.10, 0, 0], mainD: [0, 0, 0.20],
      brasG: [-0.60, 0, -0.30], avantG: [0.70, 0, 0],
      cuisseD: [-0.35, 0, 0.15], molletD: [-0.25, 0, 0],
      cuisseG: [0.10, 0, -0.15], molletG: [-0.20, 0, 0],
      bassin: [0, -0.20, 0], colonne: [-0.05, -0.15, 0], poitrine: [-0.05, -0.10, 0],
    },
    // ...et remonte en un revers qui balaie jusqu'a l'epaule opposee.
    revers: {
      brasD: [-1.70, 0.50, 0.75], avantD: [0.35, 0, 0], mainD: [0.10, 0, 0],
      brasG: [-0.90, 0, -0.45], avantG: [0.85, 0, 0],
      cuisseD: [-0.10, 0, 0.10], molletD: [-0.10, 0, 0],
      cuisseG: [0.45, 0, -0.20], molletG: [-0.35, 0, 0], piedG: [-0.40, 0, 0],
      bassin: [0, -0.30, 0], colonne: [-0.15, -0.30, 0], poitrine: [-0.10, -0.20, 0],
      cou: [0.06, -0.30, 0], tete: [0.04, -0.28, 0],
    },
  };

  /* LE COMBAT DOIT SE JOUER TOT DANS LA FENETRE, ET C'EST UNE MESURE, PAS
     UNE INTUITION.

     La halte suivante tombe a peine six metres apres l'ancre de cette
     scene (193,3 contre 187,4) : des u=0,33 environ, la camera bascule en
     'approche' et se met a cadrer le cadeau de la halte, pas le duel — a
     u=0,67, la ou le coup haut atterrissait, l'ancrage etait deja a
     x=-1,3 a l'ecran et sortait du champ dans la foulee. Toute la
     choregraphie, aussi reussie soit-elle, se jouait donc hors champ.
     Mesure faite avec une vraie marche simulee (pas une reconstitution) :
     le combat entier — demi-tour compris — est donc resserre pour se
     terminer avant u=0,46, largement dans la fenetre ou le cadrage tient
     encore. La garde finale, elle, peut deriver hors champ sans dommage :
     rien n'y bouge plus. */
  const sequence = piste([
    { t: 0.00, pose: POSE.dos },
    { t: 0.10, pose: POSE.dos },
    { t: 0.16, pose: POSE.alerte },
    { t: 0.20, pose: POSE.alerte },
    { t: 0.26, pose: POSE.garde },
    { t: 0.30, pose: POSE.leve },
    { t: 0.34, pose: POSE.abattu },
    { t: 0.36, pose: POSE.abattu },
    { t: 0.39, pose: POSE.ramene },
    { t: 0.42, pose: POSE.revers },
    { t: 0.44, pose: POSE.revers },
    { t: 0.50, pose: POSE.garde },
    { t: 1.00, pose: POSE.garde },
  ]);

  /* L'ADVERSAIRE ENCAISSE LES DEUX COUPS, cale sur les memes instants que
     `sequence` ci-dessus (abattu a t=0,34 ; revers a t=0,42). */
  const sequenceAdv = piste([
    { t: 0.00, pose: POSE_ADV.garde },
    { t: 0.33, pose: POSE_ADV.garde },
    { t: 0.37, pose: POSE_ADV.touche1 },
    { t: 0.40, pose: POSE_ADV.touche1 },
    { t: 0.44, pose: POSE_ADV.chute },
    { t: 1.00, pose: POSE_ADV.chute },
  ]);

  /* Elle commence DE DOS, tournee vers la foret. Le demi-tour se fait sur le
     groupe entier, parce qu'un corps qui pivote autour de sa colonne
     vertebrale sans deplacer ses appuis se lit comme une poupee sur un
     socle. */
  let lameFaite = false;
  let coup1Fait = false, coup2Fait = false;
  let coup1T = 0, coup2T = 0;
  g.userData.reinit = () => {
    lameFaite = false; coup1Fait = false; coup2Fait = false;
    sangs[0].material.opacity = 0; sangs[1].material.opacity = 0;
    for (const m of tache.userData.taches) m.opacity = 0;
    tache.scale.setScalar(1);
  };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    sequence(os, u);
    /* LA LAME CHANTE QUAND ELLE SE MET EN GARDE, juste avant le premier
       coup : c'est ce qui transforme la pose en un evenement qui annonce
       l'action a venir. Il ne se rejoue pas tant que la fenetre ne s'est
       pas refermee. */
    if (!lameFaite && u > 0.24) { lameFaite = true; g.userData.emettre?.('lame'); }
    // Le demi-tour, cale sur le deuxieme temps de la sequence.
    const tourne = smoothstep(0.12, 0.28, u);
    perso.rotation.y = Math.PI * (1 - tourne) + 0.35 * tourne;
    /* Elle vous suit du regard des qu'elle se met en garde — avant, elle ne
       vous a pas encore vu — et jusqu'au bout du combat : elle se bat pour
       vous, pas pour un adversaire qu'on ne voit jamais. */
    regarderVers(perso, os, camera, smoothstep(0.22, 0.28, u) * 0.85);

    /* Une respiration minuscule quand elle tient la garde, avant et apres
       les coups : sans elle, une pose tenue devient une statue ; avec,
       elle est immobile mais vivante, ce qui n'est pas la meme chose. */
    const tientGarde = smoothstep(0.50, 0.54, u) + (1 - smoothstep(0.26, 0.30, u)) * smoothstep(0.24, 0.26, u);
    const souffle = tientGarde * Math.sin(t * 1.4) * 0.022;
    os.poitrine.rotation.x += souffle;
    os.brasD.rotation.x += souffle * 0.8;
    os.brasG.rotation.x += souffle * 0.8;
    // La queue-de-cheval fouette avec un leger retard sur la tete.
    queue.rotation.x = Math.sin(t * 3.1) * 0.05 - os.tete.rotation.x * 0.35;
    queue.rotation.z = Math.cos(t * 2.3) * 0.04 - os.tete.rotation.y * 0.25;

    // L'adversaire encaisse, recule, tombe — sans jamais bouger de place :
    // c'est elle qui se deplace pour porter les coups, pas lui.
    sequenceAdv(osAdv, u);
    adversaire.position.y = u > 0.435 ? -0.62 * smoothstep(0.435, 0.50, u) : 0;

    /* LES DEUX COUPS. Chacun declenche sa propre gerbe, une seule fois, au
       moment exact ou la lame de `sequence` touche (voir les temps cles
       0,34 et 0,42 ci-dessus). */
    if (!coup1Fait && u > 0.335) { coup1Fait = true; coup1T = t; g.userData.emettre?.('choc'); }
    if (!coup2Fait && u > 0.415) { coup2Fait = true; coup2T = t; g.userData.emettre?.('choc'); }

    /* LE PREMIER COUP : une gerbe large, qui gicle loin et met deux fois
       plus longtemps qu'avant a s'effacer. */
    if (coup1Fait) {
      const dt = t - coup1T;
      const gerbe = sangs[0];
      const pos = gerbe.geometry.attributes.position;
      const dirs = gerbe.userData.dirs;
      for (let i = 0; i < dirs.length; i++) {
        const [dx, dy, dz] = dirs[i];
        const vol = Math.min(dt, 1.1);
        pos.setXYZ(i, dx * vol * 3.0, dy * vol * 2.6 - dt * dt * 2.6, dz * vol * 3.0);
      }
      pos.needsUpdate = true;
      gerbe.userData.mat.opacity = Math.max(0, 1 - dt * 0.75) * vis;
    }
    /* LE SECOND, LE COUP FATAL : LA FONTAINE. Un jet vertical qui monte,
       retombe, et pulse encore une fois avant de s'eteindre — c'est ce
       second sursaut qui fait « geyser » plutot que « fuite ». */
    if (coup2Fait) {
      const dt = t - coup2T;
      const gerbe = sangs[1];
      const pos = gerbe.geometry.attributes.position;
      const dirs = gerbe.userData.dirs;
      const dephasages = gerbe.userData.dephasages;
      for (let i = 0; i < dirs.length; i++) {
        const [dx, dy, dz] = dirs[i];
        // Un second pouls, decale, pour que le jet retombe puis reparte.
        const local = Math.max(0, dt - dephasages[i] * 0.35);
        const vol = Math.min(local, 0.85);
        pos.setXYZ(i, dx * vol * 2.2, dy * vol * 4.4 - local * local * 3.4, dz * vol * 2.2);
      }
      pos.needsUpdate = true;
      gerbe.userData.mat.opacity = Math.max(0, 1 - dt * 0.55) * vis;

      // La mare s'etale largement une fois au sol, et y reste jusqu'a la fin.
      const depuis = clamp((t - coup2T) * 0.42, 0, 1);
      for (const m of tache.userData.taches) m.opacity = depuis * 0.88 * vis;
      tache.scale.setScalar(0.25 + depuis * 1.9);
    }
  };
  return g;
}

export function coutKillBill() {
  return _corpsKB ? { triangles: _corpsKB.triangles, sommets: _corpsKB.sommets } : null;
}
