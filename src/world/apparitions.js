/* LES APPARITIONS.

   Antoine : « tout au long du trajet je veux qu'il y ait des apparitions wtf,
   en mode voitures de police, Spider-Man (j'aime beaucoup Spider-Man), les
   films, etc. »

   Six clins d'oeil semes le long du chemin. Trois regles, et elles decident
   de tout :

   · C'EST BREF. Chacun dure quelques secondes, apparait a l'ecart du chemin
     et s'en va. Une blague qui reste plantee dans le decor cesse d'etre une
     surprise des la deuxieme halte et devient un element de decor rate ;
   · CA NE COUPE JAMAIS LA BALADE. Rien ne s'arrete, rien ne demande un
     geste, le cerf continue de marcher. On l'apercoit ou on le rate — et le
     rater est une bonne chose, ca donne envie de refaire le trajet ;
   · TOUT EST PROCEDURAL. Aucun modele, aucune texture chargee : le fichier
     doit rester un seul HTML chiffre et autonome. Une silhouette bien
     choisie en dit plus qu'un maillage detaille, surtout de nuit et a
     vingt metres.

   Chaque apparition dort (groupe invisible) tant que le cerf n'entre pas
   dans sa fenetre, joue sa scene, puis se rendort. Le cout au repos est donc
   nul, et en pleine action il ne depasse jamais quelques dizaines de
   triangles.
*/

import * as THREE from 'three';
import { lueurDiffuse, grainRond } from '../core/dot.js';
import { smoothstep, clamp } from '../core/noise.js';

/* Un halo, l'element de base de presque toutes ces scenes : c'est lui qui
   porte a distance, bien plus que la geometrie. */
function halo(couleur, taille, force = 1) {
  const m = new THREE.SpriteMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  m.color.setRGB(couleur[0] * force, couleur[1] * force, couleur[2] * force);
  const s = new THREE.Sprite(m);
  s.scale.setScalar(taille);
  return s;
}

const boite = (l, h, p, coul, opts = {}) => new THREE.Mesh(
  new THREE.BoxGeometry(l, h, p),
  new THREE.MeshStandardMaterial({ color: coul, roughness: 0.7, ...opts })
);

const capsule = (r, l, coul, opts = {}) => new THREE.Mesh(
  new THREE.CapsuleGeometry(r, l, 4, 8),
  new THREE.MeshStandardMaterial({ color: coul, roughness: 0.62, ...opts })
);

/* ==========================================================================
   1. LA VOITURE DE POLICE

   Ce qui fait « police », ce n'est pas la voiture — a vingt metres, de nuit,
   entre des troncs, on n'en voit qu'une masse sombre. C'est le GYROPHARE :
   deux halos qui alternent, bleu puis rouge, et qui battent la neige autour
   d'eux. On peut supprimer la carrosserie entiere sans que personne ne s'en
   apercoive ; on ne peut pas toucher au rythme du gyrophare.
   ========================================================================== */
function voiturePolice() {
  const g = new THREE.Group();

  const caisse = boite(1.85, 0.62, 4.25, 0x1B2432);
  caisse.position.y = 0.72;
  g.add(caisse);
  // Portiere blanche : le bicolore se lit meme en silhouette.
  const flanc = boite(1.88, 0.34, 2.10, 0xD8DEE6);
  flanc.position.set(0, 0.66, 0.15);
  g.add(flanc);

  const habitacle = boite(1.62, 0.56, 2.05, 0x0E141C, { roughness: 0.35 });
  habitacle.position.set(0, 1.28, -0.15);
  g.add(habitacle);

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const roue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.24, 10),
      new THREE.MeshStandardMaterial({ color: 0x0A0C10, roughness: 0.95 })
    );
    roue.rotation.z = Math.PI / 2;
    roue.position.set(sx * 0.92, 0.35, sz * 1.42);
    g.add(roue);
  }

  // La rampe, et les deux halos qui font tout le travail.
  const rampe = boite(1.30, 0.16, 0.34, 0x14181F);
  rampe.position.set(0, 1.64, -0.15);
  g.add(rampe);

  const bleu = halo([0.35, 0.85, 3.4], 3.6);
  bleu.position.set(-0.42, 1.70, -0.15);
  const rouge = halo([3.4, 0.42, 0.30], 3.6);
  rouge.position.set(0.42, 1.70, -0.15);
  g.add(bleu, rouge);

  // Deux phares vers l'avant, tres faibles : ils posent la voiture au sol.
  for (const sx of [-1, 1]) {
    const p = halo([2.2, 2.0, 1.5], 1.5, 0.5);
    p.position.set(sx * 0.62, 0.78, -2.15);
    g.add(p);
  }

  g.userData.jouer = (u, t) => {
    // Entree et sortie en fondu : rien n'apparait ni ne disparait d'un coup.
    const vis = smoothstep(0, 0.12, u) * smoothstep(1, 0.86, u);
    /* L'ALTERNANCE, pas le clignotement. Un gyrophare de police ne fait pas
       « allume / eteint » : chaque cote pulse deux fois vite, puis passe la
       main a l'autre. C'est ce rythme-la qu'on reconnait de loin. */
    const cy = (t * 1.6) % 1;
    const cote = cy < 0.5;
    const bat = Math.pow(Math.abs(Math.sin(t * 19)), 0.6);
    bleu.material.opacity = vis * (cote ? bat : 0.06);
    rouge.material.opacity = vis * (cote ? 0.06 : bat);
  };
  return g;
}

/* ==========================================================================
   2. SPIDER-MAN

   Il apparait DEUX fois — c'est le seul a qui ce fichier accorde ce
   privilege, et c'est assume : Antoine dit qu'il l'aime beaucoup.

   La premiere fois suspendu la tete en bas au bout de son fil, la seconde en
   plein balancement au-dessus du chemin. Les deux poses sont celles qu'on
   reconnait a la silhouette seule, sans voir un seul detail du costume — ce
   qui tombe bien, puisque de nuit et a dix metres on n'en verra aucun.

   Le costume tient a trois choses : le ROUGE du torse et de la tete, le BLEU
   des jambes et des avant-bras, et les DEUX YEUX blancs cernes de noir. Rien
   d'autre ne survit a la distance, surtout pas la toile dessinee.
   ========================================================================== */
function spiderMan() {
  const g = new THREE.Group();
  const ROUGE = 0xB3202B, BLEU = 0x1B3C86;

  /* UN COSTUME LEGEREMENT EMISSIF. De nuit, sous une lune rasante et a
     vingt metres, un bonhomme rouge et bleu non eclaire n'est qu'une tache
     noire de plus dans les arbres. Une emission faible — pas assez pour
     qu'il rayonne, assez pour qu'il existe — le detache sans en faire une
     lampe. C'est la meme correction que pour les cabanes et le sapin. */
  const emisR = { emissive: 0x3E0A10, emissiveIntensity: 1 };
  const emisB = { emissive: 0x0A1430, emissiveIntensity: 1 };
  const torse = capsule(0.115, 0.30, ROUGE, emisR);
  torse.position.y = 0.30;
  g.add(torse);

  const bassin = capsule(0.105, 0.10, BLEU, emisB);
  bassin.position.y = 0.08;
  g.add(bassin);

  const tete = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 12, 10),
    new THREE.MeshStandardMaterial({ color: ROUGE, roughness: 0.55, ...emisR })
  );
  tete.scale.set(0.92, 1.0, 1.02);
  tete.position.y = 0.56;
  g.add(tete);

  /* LES YEUX. C'est LA signature — deux amandes blanches cernees de noir,
     inclinees vers l'interieur. Sans elles on a un bonhomme rouge et bleu ;
     avec elles, tout le monde le nomme instantanement. */
  for (const sx of [-1, 1]) {
    const cerne = new THREE.Mesh(
      new THREE.SphereGeometry(0.049, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x08090C })
    );
    cerne.scale.set(1.24, 0.78, 0.5);
    cerne.position.set(sx * 0.046, 0.575, -0.083);
    cerne.rotation.z = sx * -0.34;
    g.add(cerne);

    const oeil = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xF2F6FF })
    );
    oeil.scale.set(1.22, 0.76, 0.5);
    oeil.position.set(sx * 0.046, 0.575, -0.094);
    oeil.rotation.z = sx * -0.34;
    g.add(oeil);
  }

  // Bras et jambes, en deux segments chacun : c'est assez pour une pose.
  const membres = {};
  for (const sx of [-1, 1]) {
    const n = sx > 0 ? 'G' : 'D';
    const brasH = capsule(0.042, 0.17, ROUGE, emisR);
    brasH.position.set(sx * 0.13, 0.40, 0);
    const brasB = capsule(0.036, 0.17, BLEU, emisB);
    brasB.position.set(sx * 0.17, 0.22, 0);
    const cuisse = capsule(0.055, 0.19, BLEU, emisB);
    cuisse.position.set(sx * 0.062, -0.08, 0);
    const mollet = capsule(0.044, 0.19, BLEU, emisB);
    mollet.position.set(sx * 0.062, -0.29, 0);
    g.add(brasH, brasB, cuisse, mollet);
    membres['brasH' + n] = brasH; membres['brasB' + n] = brasB;
    membres['cuisse' + n] = cuisse; membres['mollet' + n] = mollet;
  }
  g.userData.membres = membres;
  return g;
}

/* Le fil : un cylindre tres fin, legerement lumineux, qui monte hors champ.
   Sans lui le personnage flotte ; avec lui, il PEND, et c'est toute la
   difference entre une figurine et une scene. */
function filDeToile(longueur) {
  const f = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.008, longueur, 5),
    new THREE.MeshStandardMaterial({
      color: 0xE8EEF6, roughness: 0.5, emissive: 0x2A3140, emissiveIntensity: 1,
    })
  );
  f.position.y = longueur / 2;
  return f;
}

function spiderSuspendu() {
  const g = new THREE.Group();
  const perso = spiderMan();
  const pivot = new THREE.Group();
  pivot.add(perso);
  /* Tete en bas : on retourne le personnage et on le suspend par un pied.
     Le fil part donc du haut du groupe et le corps pend dessous. */
  /* IL PENDAIT SOUS LA NEIGE. Le fil part de l'origine du groupe, laquelle
     est posee AU SOL ; placer le corps a -0,62 l'enterrait purement et
     simplement. On le suspend a hauteur d'oeil et le fil monte au-dessus de
     lui, vers une branche qu'on ne voit pas. */
  perso.rotation.z = Math.PI;
  perso.position.y = 2.45;
  const fil = filDeToile(3.6);
  fil.position.y = 2.45 + 1.8;
  pivot.add(fil);
  g.add(pivot);

  const m = perso.userData.membres;
  // Bras qui pendent vers le bas (donc vers le haut dans le repere retourne).
  m.brasHG.rotation.z = 0.5; m.brasHD.rotation.z = -0.5;

  g.userData.jouer = (u, t) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.traverse((o) => {
      if (o.material && o.material.transparent) o.material.opacity = vis;
    });
    g.visible = vis > 0.01;
    // Il se balance doucement, et tourne un peu sur lui-meme.
    pivot.rotation.z = Math.sin(t * 1.15) * 0.16;
    pivot.rotation.y = Math.sin(t * 0.52) * 0.9;
  };
  return g;
}

function spiderBalance(porteeX) {
  const g = new THREE.Group();
  const ancre = new THREE.Group();       // le point d'accroche, en hauteur
  const perso = spiderMan();
  const fil = filDeToile(5.2);
  ancre.add(fil);
  perso.position.y = -5.0;
  perso.rotation.x = -0.35;              // il file vers l'avant
  ancre.add(perso);
  g.add(ancre);
  ancre.position.y = 6.4;

  const m = perso.userData.membres;
  m.brasHG.rotation.z = 2.5; m.brasHD.rotation.z = -0.6;
  m.cuisseG.rotation.x = -0.7; m.molletG.rotation.x = -0.5;

  g.userData.jouer = (u, t) => {
    const vis = smoothstep(0, 0.08, u) * smoothstep(1, 0.90, u);
    g.visible = vis > 0.01;
    /* Un balancement, c'est un pendule : vite en bas, lent aux extremites.
       Un deplacement lineaire se lirait comme un panneau qu'on tire sur un
       rail. */
    const a = Math.sin((u - 0.5) * Math.PI) * 1.05;
    ancre.rotation.z = a * 0.55;
    /* LE DEPLACEMENT VA SUR L'ANCRE, PAS SUR LE GROUPE. `g.position` porte
       l'emplacement calcule au montage, le long du chemin ; y ecrire ici
       l'ECRASAIT, et le personnage se retrouvait projete a l'origine du
       monde — hors champ, evidemment. L'ancre, elle, vit dans le repere du
       groupe, deja oriente face au chemin : c'est le bon endroit. */
    ancre.position.x = -a * porteeX * 0.5;
    void t;
  };
  return g;
}

/* ==========================================================================
   3. E.T. DEVANT LA LUNE

   Le plan le plus cite du cinema, et il ne coute qu'une silhouette noire :
   un velo, deux passagers, un panier. Tout tient dans le CONTOUR — c'est
   d'ailleurs ainsi que le plan est filme, entierement a contre-jour.

   La silhouette se place sur la direction de la lune et suit la camera, de
   sorte qu'elle passe toujours devant le disque, quel que soit l'endroit du
   chemin ou la scene se declenche.
   ========================================================================== */
function siluetteVelo() {
  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = n; cv.height = Math.round(n * 0.62);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  c.strokeStyle = '#000'; c.fillStyle = '#000';
  c.lineCap = 'round'; c.lineJoin = 'round';

  const R = 34, yR = 108;                    // roues
  c.lineWidth = 7;
  for (const cx of [66, 190]) {
    c.beginPath(); c.arc(cx, yR, R, 0, Math.PI * 2); c.stroke();
  }
  // Cadre
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(66, yR); c.lineTo(112, 62); c.lineTo(168, 62);
  c.lineTo(190, yR); c.lineTo(112, yR); c.lineTo(112, 62);
  c.stroke();
  // Guidon et selle
  c.lineWidth = 8;
  c.beginPath(); c.moveTo(168, 62); c.lineTo(186, 44); c.stroke();
  c.beginPath(); c.moveTo(112, 62); c.lineTo(104, 46); c.stroke();
  c.fillRect(92, 40, 26, 9);
  // Panier a l'avant, avec la petite tete dedans
  c.fillRect(176, 46, 30, 22);
  c.beginPath(); c.arc(191, 40, 11, 0, Math.PI * 2); c.fill();
  // Le cycliste : buste penche, jambes pliees, tete
  c.lineWidth = 13;
  c.beginPath(); c.moveTo(112, 58); c.lineTo(138, 30); c.stroke();
  c.beginPath(); c.arc(146, 22, 15, 0, Math.PI * 2); c.fill();
  c.lineWidth = 10;
  c.beginPath(); c.moveTo(138, 34); c.lineTo(170, 48); c.stroke();   // bras
  c.beginPath(); c.moveTo(118, 62); c.lineTo(126, 92); c.lineTo(112, yR); c.stroke();

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: t, transparent: true, opacity: 0, color: 0x05070B,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.62), mat);
  q.renderOrder = 3;
  return q;
}

function etDevantLaLune() {
  const g = new THREE.Group();

  /* SA PROPRE LUNE, ET C'EST UNE DECISION MESUREE.

     L'idee de depart etait de faire passer la silhouette devant la vraie
     lune du ciel. Mesure faite le long de tout le chemin : la lune est dans
     une direction FIXE du monde, le chemin serpente, et l'ecart entre l'axe
     de la camera et la lune ne descend jamais sous 47° — bien au-dela du
     champ, surtout en portrait. Elle n'est donc JAMAIS dans le cadre pendant
     la balade. Une silhouette noire sur un ciel noir n'aurait rien donne.

     La scene porte donc son propre disque, pose devant la camera. Il n'y a
     aucun risque de voir deux lunes : la vraie est a plus de quarante-sept
     degres de la, donc jamais dans la meme image. Et un grand disque pale
     qui se leve entre les arbres est, en soi, exactement le genre
     d'apparition demandee. */
  const disque = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  disque.material.color.setRGB(1.35, 1.32, 1.12);
  disque.scale.setScalar(58);
  disque.renderOrder = 2;
  g.add(disque);

  const velo = siluetteVelo();
  velo.scale.setScalar(13);
  g.add(velo);

  const avant = new THREE.Vector3();
  const cote = new THREE.Vector3();
  g.userData.suitCamera = true;
  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.16, u) * smoothstep(1, 0.80, u);
    disque.material.opacity = vis * 0.42;
    velo.material.opacity = vis * 0.98;
    g.visible = vis > 0.01;
    if (!camera) return;

    /* Devant la camera, haut dans le ciel, assez loin pour etre derriere
       toute la foret : la silhouette doit se detacher sur le disque, jamais
       sur des branches. */
    const D = 265;
    camera.getWorldDirection(avant);
    avant.y = 0;
    if (avant.lengthSq() < 1e-6) avant.set(0, 0, -1);
    avant.normalize();
    cote.set(-avant.z, 0, avant.x);

    g.position.copy(camera.position)
      .addScaledVector(avant, D)
      .addScaledVector(cote, -14);
    /* HAUTEUR MESUREE, PAS DEVINEE. A 62 m pour 240 de distance, cela
       faisait 14,5° d'elevation — et comme le drone pique legerement vers le
       cerf, le disque sortait par le haut du cadre. A 34 m pour 265, on est
       a 7,3°, ce qui le pose au-dessus de la ligne d'arbres sans jamais
       toucher le bord. */
    g.position.y = camera.position.y + 34;
    g.lookAt(camera.position);

    // La traversee : de gauche a droite devant le disque, en montant a peine.
    velo.position.set((u - 0.5) * 74, 3 + Math.sin(t * 0.8) * 1.4, 1);
  };
  return g;
}

/* ==========================================================================
   4. LE DUEL DE SABRES

   Deux lames, une verte et une rouge, qui s'entrechoquent derriere les
   troncs. On ne voit jamais les duellistes — et c'est mieux ainsi : deux
   silhouettes mal faites tueraient l'effet, alors que deux lames qui
   claquent l'une contre l'autre dans le noir se passent d'acteurs.
   ========================================================================== */
function lame(couleur, halos) {
  const g = new THREE.Group();
  const l = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.035, 1.15, 4, 8),
    new THREE.MeshBasicMaterial({ color: 0xF2FFF6 })
  );
  l.position.y = 0.68;
  g.add(l);
  const h = halo(halos, 2.3);
  h.position.y = 0.68;
  h.material.opacity = 0;
  g.add(h);
  const poignee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.028, 0.20, 6),
    new THREE.MeshStandardMaterial({ color: 0x2A2E36, roughness: 0.5, metalness: 0.6 })
  );
  g.add(poignee);
  g.userData.halo = h;
  g.userData.lame = l;
  void couleur;
  return g;
}

function duelSabres() {
  const g = new THREE.Group();
  const vert = lame(0x8CFF7A, [0.55, 3.2, 0.75]);
  const rouge = lame(0xFF6A5A, [3.2, 0.45, 0.35]);
  vert.position.set(-1.15, 0.9, 0);
  rouge.position.set(1.15, 0.9, 0);
  rouge.rotation.z = Math.PI;
  rouge.position.y = 2.0;
  g.add(vert, rouge);

  const eclat = halo([2.6, 2.9, 2.4], 4.0);
  eclat.position.set(0, 1.5, 0);
  g.add(eclat);

  /* Le numero de la passe d'armes en cours : il sert a ne declencher le
     choc sonore QU'UNE FOIS par passe. Le pic dure cinq images environ, et
     sans ce garde-fou on entendrait cinq chocs colles bout a bout. */
  let dernierePasse = -1;

  g.userData.jouer = (u, t) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    /* Trois passes d'armes : les lames se rapprochent, claquent, se
       separent. Le rythme est ce qui fait « duel » plutot que « deux
       batons qui bougent ». */
    const passe = (t * 1.25) % 1;
    const choc = Math.pow(Math.max(0, 1 - Math.abs(passe - 0.5) * 5), 2);
    const numero = Math.floor(t * 1.25);
    if (choc > 0.55 && numero !== dernierePasse) {
      dernierePasse = numero;
      // Le son part au moment ou les lames se touchent, pas avant.
      if (vis > 0.2) g.userData.emettre?.('choc');
    }
    vert.rotation.z = -0.55 + Math.sin(t * 3.9) * 0.42 - choc * 0.35;
    rouge.rotation.z = Math.PI + 0.55 - Math.sin(t * 3.7 + 1.1) * 0.42 + choc * 0.35;
    vert.position.x = -1.15 + choc * 0.55;
    rouge.position.x = 1.15 - choc * 0.55;
    vert.userData.halo.material.opacity = vis * 0.85;
    rouge.userData.halo.material.opacity = vis * 0.85;
    eclat.material.opacity = vis * choc * 0.9;
  };
  return g;
}

/* ==========================================================================
   5. LA DELOREAN

   Elle est deja partie : il ne reste que les deux trainees de feu sur la
   neige, qui s'allument et s'eteignent. C'est LA façon de citer ce film sans
   modeliser une voiture — le plan de fin ne montre lui-meme que ca.
   ========================================================================== */
function traineesDeFeu(longueur) {
  const g = new THREE.Group();
  const bandes = [];
  for (const sx of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.42, longueur);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: lueurDiffuse(), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    });
    mat.color.setRGB(3.4, 1.15, 0.22);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(sx * 0.78, 0.06, 0);
    g.add(m);
    bandes.push(m);
  }
  const front = halo([3.6, 1.6, 0.5], 4.2);
  front.position.set(0, 0.7, -longueur / 2);
  g.add(front);

  /* Le bang n'arrive qu'une fois par passage. On le remet a zero quand la
     fenetre se referme, pour qu'il claque a nouveau si l'on refait la
     balade. */
  let bangFait = false;
  g.userData.reinit = () => { bangFait = false; };

  g.userData.jouer = (u, t) => {
    /* Elles s'allument d'un coup, tiennent, puis s'eteignent par l'arriere.
       Un fondu symetrique donnerait une lampe ; ici on doit lire un
       PASSAGE. */
    const allume = smoothstep(0, 0.06, u) * smoothstep(1, 0.55, u);
    /* LE BANG ARRIVE APRES LES TRAINEES, ET C'EST VOULU. La voiture est
       deja passee : le son la rattrape. C'est physiquement juste — et
       dramatiquement bien meilleur, parce que l'oeil a le temps de lire les
       deux traits de feu avant que l'oreille ne dise ce que c'etait. */
    if (!bangFait && u > 0.14) { bangFait = true; g.userData.emettre?.('bang'); }
    const scint = 0.82 + Math.sin(t * 27) * 0.18;
    for (const b of bandes) b.material.opacity = allume * 0.78 * scint;
    front.material.opacity = smoothstep(0, 0.04, u) * smoothstep(0.34, 0.10, u) * 0.9;
    g.visible = allume > 0.01;
  };
  return g;
}

/* ==========================================================================
   7. LE PATRONUS

   Un second cerf, mais de lumiere : translucide, bleu-blanc, il surgit du
   sous-bois, court un moment a hauteur du notre, puis se defait.

   C'est la seule apparition qui DIALOGUE avec le sujet de la balade au lieu
   de simplement passer a cote — et c'est pour cela qu'elle est la premiere
   de cette serie. Un cerf de lumiere a cote d'un cerf de chair, c'est une
   image qui se passe de legende.

   Il est bati en capsules additives, sans eclairage : un fantome ne recoit
   pas la lumiere, il en emet. La silhouette suffit largement — a cette
   distance et a cette vitesse, personne ne cherchera le detail d'un bois.
   ========================================================================== */
function cerfDeLumiere() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xBFE4FF, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  const pieces = [];
  const P = (r, l, x, y, z, rx, rz) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 3, 7), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    g.add(m); pieces.push(m);
    return m;
  };

  // Le tronc, l'encolure, la tete : trois capsules, pas une de plus.
  P(0.30, 1.05, 0, 1.02, 0.05, Math.PI / 2, 0);
  P(0.17, 0.52, 0, 1.28, -0.72, 0.75, 0);
  P(0.12, 0.28, 0, 1.56, -1.06, 1.15, 0);

  // Les quatre membres.
  for (const sx of [-1, 1]) {
    P(0.055, 0.62, sx * 0.16, 0.52, -0.42);
    P(0.058, 0.66, sx * 0.17, 0.50, 0.58);
  }

  /* LA RAMURE. Deux eventails de segments qui montent et s'ecartent : c'est
     la seule partie ou l'on met du detail, parce que c'est elle qui NOMME
     l'animal. Sans bois, un cerf de lumiere est un chien de lumiere. */
  for (const sx of [-1, 1]) {
    const base = new THREE.Group();
    base.position.set(sx * 0.09, 1.66, -1.00);
    base.rotation.z = sx * 0.42;
    g.add(base);
    let x = 0, y = 0;
    for (let i = 0; i < 4; i++) {
      const l = 0.30 - i * 0.045;
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.022 - i * 0.003, l, 3, 6), mat);
      b.position.set(x, y + l / 2, 0);
      b.rotation.z = sx * (-0.12 - i * 0.06);
      base.add(b); pieces.push(b);
      // Un andouiller sur deux part vers l'avant.
      if (i % 2 === 0) {
        const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.16, 3, 6), mat);
        a.position.set(x + sx * 0.05, y + l * 0.7, -0.06);
        a.rotation.set(-0.9, 0, sx * 0.5);
        base.add(a); pieces.push(a);
      }
      y += l * 0.86;
      x += sx * 0.03;
    }
  }

  // Le halo qui l'enveloppe : c'est lui qui porte a distance.
  const aura = halo([0.55, 1.15, 1.9], 5.4);
  aura.position.set(0, 1.15, -0.1);
  g.add(aura);

  g.userData.pieces = pieces;
  g.userData.aura = aura;
  return g;
}

function patronus() {
  const g = new THREE.Group();
  const bete = cerfDeLumiere();
  g.add(bete);

  /* Une trainee de particules derriere lui : un patronus laisse toujours
     derriere soi un sillage qui se dissipe. Des points suffisent, la
     texture ronde partagee evite le carre disgracieux. */
  const N = 60;
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ptsMat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xAEDCFF, size: 0.16,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, ptsMat);
  pts.frustumCulled = false;
  g.add(pts);
  const vies = new Float32Array(N).map(() => Math.random());

  g.userData.jouer = (u, t) => {
    /* Il surgit vite et se defait lentement : une apparition surnaturelle
       ne s'installe pas en fondu, elle EST la d'un coup. */
    const vis = smoothstep(0, 0.06, u) * smoothstep(1, 0.62, u);
    const scint = 0.78 + Math.sin(t * 5.5) * 0.12 + Math.sin(t * 13.1) * 0.10;
    for (const p of bete.userData.pieces) p.material.opacity = vis * 0.52 * scint;
    bete.userData.aura.material.opacity = vis * 0.34 * scint;
    ptsMat.opacity = vis * 0.7;
    g.visible = vis > 0.01;

    // Il avance le long de son axe local, et bondit.
    const av = (u - 0.5) * 26;
    bete.position.z = av;
    bete.position.y = Math.abs(Math.sin(t * 3.4)) * 0.22;
    bete.rotation.x = Math.sin(t * 3.4) * 0.06;

    for (let i = 0; i < N; i++) {
      vies[i] += 0.016;
      if (vies[i] > 1) vies[i] -= 1;
      const k = vies[i];
      // Le sillage nait au niveau du corps et retombe en s'etalant.
      pos[i * 3] = (Math.random() - 0.5) * 0.5 * k;
      pos[i * 3 + 1] = 1.0 + Math.sin(i * 2.1) * 0.35 - k * 0.7;
      pos[i * 3 + 2] = av + 0.6 + k * 5.5;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return g;
}

/* ==========================================================================
   8. LES TROIS SPIDER-MAN QUI SE POINTENT DU DOIGT

   Il fallait bien la faire. Trois Spider-Man en triangle, chacun le bras
   tendu vers un autre, immobiles au milieu de la neige — c'est l'image la
   plus citee du personnage, et elle ne demande rien d'autre que trois copies
   du modele qu'on a deja et trois bras leves.

   Le sel de la chose tient a l'IMMOBILITE : ils ne bougent pas d'un pouce
   pendant qu'on passe. Une animation les rendrait rigolos ; leur raideur les
   rend inquietants, ce qui est bien plus drole.
   ========================================================================== */
function trioSpider() {
  const g = new THREE.Group();
  const R = 1.35;                       // rayon du triangle
  const persos = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p = spiderMan();
    p.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    /* Chacun regarde le suivant : c'est cet alignement, et lui seul, qui
       fait lire la scene. Un triangle de personnages qui regardent ailleurs
       n'est qu'un attroupement. */
    const b = ((i + 1) / 3) * Math.PI * 2;
    p.rotation.y = Math.atan2(Math.cos(b) * R - Math.cos(a) * R,
                              Math.sin(b) * R - Math.sin(a) * R) + Math.PI / 2;
    // Le bras tendu vers lui, l'autre le long du corps.
    const m = p.userData.membres;
    m.brasHG.rotation.z = -1.45;
    m.brasHG.position.set(0.20, 0.47, -0.06);
    m.brasBG.rotation.z = -1.55;
    m.brasBG.position.set(0.38, 0.50, -0.10);
    m.brasHD.rotation.z = 0.28;
    g.add(p);
    persos.push(p);
  }

  g.userData.jouer = (u) => {
    const vis = smoothstep(0, 0.12, u) * smoothstep(1, 0.86, u);
    g.visible = vis > 0.01;
    // Aucune animation. C'est le sujet.
    void persos;
  };
  return g;
}

/* ========================================================================== */
export class Apparitions {
  constructor(scene, chemin, relief, palier) {
    this.chemin = chemin;
    this.relief = relief;
    this.groupe = new THREE.Group();
    this.groupe.name = 'apparitions';
    scene.add(this.groupe);

    const L = chemin.longueur;
    /* Reparties sur tout le trajet, jamais deux dans la meme foulee, et
       toujours A COTE du chemin : le cerf ne doit jamais avoir a les
       contourner. Les distances laterales sont choisies pour que la chose
       tienne dans le champ du drone, qui regarde devant et un peu de cote. */
    /* `avant` / `apres` : de combien de metres AVANT l'objet la scene
       s'allume, et combien de metres APRES elle s'eteint. Ce n'est pas une
       coquetterie de reglage — une fenetre centree sur l'objet l'allume au
       moment ou on le depasse, donc quand il est deja derriere la camera.
       Le drone regarde DEVANT : tout doit s'ouvrir largement en amont. */
    /* SEIZE APPARITIONS, UNE TOUS LES QUARANTE METRES ENVIRON — soit une
       toutes les douze ou treize secondes au rythme de marche du cerf.

       L'ordre n'est pas aleatoire. On alterne :

       · les PROCHES (le tuyau, le bonhomme de neige, Spider-Man) et les
         LOINTAINES (le T-Rex derriere les arbres, la fusee a l'horizon) ;
       · les BRUYANTES (le chasseur qui passe en rase-mottes, la soucoupe)
         et les SILENCIEUSES (le tuyau vert planté là sans un mot, le trio
         qui ne bouge pas d'un cil) ;
       · et l'on garde le traineau et la DeLorean pour la fin, quand on
         approche de la clairiere de Noel.

       Sans cette alternance, six gags spectaculaires d'affilee s'annulent
       les uns les autres : c'est le silence entre deux qui fait la
       surprise du suivant.

       `avant` / `apres` : de combien de metres AVANT l'objet la scene
       s'allume, et combien de metres APRES elle s'eteint. Une fenetre
       centree sur l'objet l'allumerait au moment ou on le depasse, donc
       quand il est deja derriere la camera : tout s'ouvre largement en
       amont. Les scenes du ciel, elles, peuvent s'ouvrir plus tot encore,
       puisque rien ne les masque. */
    /* HUIT APPARITIONS, ET PAS SEIZE.

       J'en avais ajoute dix d'un coup ; Antoine en a coupe la moitie, et il
       a eu raison : au-dela, elles se marchent dessus. Six gags
       spectaculaires d'affilee s'annulent les uns les autres — c'est le
       silence entre deux qui fait la surprise du suivant. Mieux vaut huit
       scenes travaillees qu'une brocante.

       Les huit retenues collent a ce qui etait demande : une voiture de
       police, du Spider-Man (trois fois — c'est assume, il l'aime beaucoup)
       et du cinema. Une toutes les quatre-vingts metres environ, soit une
       toutes les vingt-cinq secondes au rythme de marche du cerf.

       L'ordre alterne les proches et les lointaines, les bruyantes et les
       silencieuses : le trio qui ne bouge pas d'un cil tombe entre le duel
       de sabres et le balancement, et c'est cette respiration qui les rend
       toutes lisibles.

       `avant` / `apres` : de combien de metres AVANT l'objet la scene
       s'allume, et combien de metres APRES elle s'eteint. Une fenetre
       centree sur l'objet l'allumerait au moment ou on le depasse, donc
       quand il est deja derriere la camera. */
    const plan = [
      { nom: 'police',   s: L * 0.09, cote: -1, ecart: 10,  avant: 42, apres: 10, faire: () => voiturePolice(), tourne: 0.6 },
      { nom: 'spider1',  s: L * 0.21, cote:  1, ecart: 5.5, avant: 30, apres: 8,  faire: () => spiderSuspendu() },
      { nom: 'et',       s: L * 0.33, cote:  0, ecart: 0,   avant: 34, apres: 24, faire: () => etDevantLaLune() },
      { nom: 'sabres',   s: L * 0.45, cote: -1, ecart: 11,  avant: 40, apres: 10, faire: () => duelSabres() },
      { nom: 'trio',     s: L * 0.57, cote: -1, ecart: 7,   avant: 34, apres: 10, faire: () => trioSpider(), tourne: 0.4 },
      { nom: 'patronus', s: L * 0.68, cote:  1, ecart: 8,   avant: 38, apres: 12, faire: () => patronus() },
      { nom: 'spider2',  s: L * 0.79, cote:  1, ecart: 5.5, avant: 28, apres: 8,  faire: () => spiderBalance(9) },
      { nom: 'delorean', s: L * 0.90, cote:  0, ecart: 0,   avant: 34, apres: 8,  faire: () => traineesDeFeu(26) },
    ];

    const p = new THREE.Vector3(), c = new THREE.Vector3(), tan = new THREE.Vector3();
    this.scenes = [];
    /* Le son est branche plus tard : le contexte audio n'existe qu'apres le
       premier geste du visiteur, et les apparitions, elles, sont construites
       au chargement. Tant que rien n'est branche, tout se joue en silence
       sans qu'aucune scene n'ait a le savoir. */
    this.son = null;
    for (const d of plan) {
      const o = d.faire();
      if (!o) continue;
      /* Le canal par lequel une scene declenche un bruit ponctuel — le choc
         des lames, le bang de la DeLorean. Les scenes ne connaissent ni le
         moteur audio ni leur propre nom : elles disent seulement « ceci vient
         de se produire », et c'est ici qu'on sait a qui l'adresser. */
      o.userData.emettre = (quoi) => {
        const s = this.son;
        if (s && typeof s[quoi] === 'function') s[quoi](d.nom);
      };
      if (!o.userData.suitCamera) {
        chemin.point(d.s, p);
        chemin.cote(d.s, c);
        chemin.tangente(d.s, tan);
        const x = p.x + c.x * d.cote * d.ecart;
        const z = p.z + c.z * d.cote * d.ecart;
        o.position.set(x, relief.hauteur(x, z), z);
        // Face au chemin, avec le decalage propre a chaque scene.
        o.rotation.y = Math.atan2(-tan.x, -tan.z) + (d.tourne || 0);
      }
      o.visible = false;
      this.groupe.add(o);
      this.scenes.push({ ...d, objet: o, ouverte: false });
    }
    void palier;
  }

  /* Le moteur audio des apparitions, branche une fois le contexte ouvert. */
  brancherSon(son) { this.son = son; }

  /* On ouvre la fenetre BIEN AVANT d'arriver : une apparition qu'on decouvre
     au moment ou on la depasse est deja finie. */
  maj(dt, t, s, camera) {
    for (const sc of this.scenes) {
      const u = (s - (sc.s - sc.avant)) / (sc.avant + sc.apres);
      const dedans = u > 0 && u < 1;

      /* LES DEUX BASCULES. On ne se contente pas de regarder si la scene est
         dans sa fenetre : on repere l'INSTANT ou elle y entre et celui ou
         elle en sort. C'est la seule facon d'allumer une sirene une fois et
         de la couper proprement — la tester a chaque image en rallumerait
         une par image. */
      if (dedans !== sc.ouverte) {
        sc.ouverte = dedans;
        if (dedans) this.son?.ouvrir(sc.nom, sc.objet);
        else {
          this.son?.fermer(sc.nom);
          sc.objet.userData.reinit?.();
        }
      }

      if (!dedans) {
        if (sc.objet.visible) sc.objet.visible = false;
        continue;
      }
      sc.objet.visible = true;
      sc.objet.userData.jouer(clamp(u, 0, 1), t, camera);
    }
    void dt;
  }
}
