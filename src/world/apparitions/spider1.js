import * as THREE from 'three';
import { grainRond } from '../../core/dot.js';
import { smoothstep } from '../../core/noise.js';
import { piste, regarderVers } from '../humanoide.js';
import { creerSpider, POSES } from '../spider.js';
import { filDeToile, halo } from './communs.js';

/* L'axe vertical, reutilise par les segments et touffes du tronc
   d'accroche pour orienter chaque piece le long de sa propre direction. */
const _AXE_Y = new THREE.Vector3(0, 1, 0);

/* ==========================================================================
   SPIDER-MAN, PREMIER PASSAGE : SUSPENDU LA TETE EN BAS

   La pose la plus reconnaissable du personnage, et de loin la plus facile a
   rater : accroche par un pied, l'autre jambe repliee, les bras qui pendent
   vers le sol.

   LA SCENE EST ECRITE COMME UN PLAN DE FILM, en six temps desormais :

     il vient de se poser, le fil se stabilise encore  →  il pend et tourne
     lentement  →  il vous repere et s'immobilise  →  il vous salue
       →  il tend l'oreille vers la foret  →  il reprend sa derive

   Chaque temps est une pose cle datee ; la piste les enchaine avec une
   acceleration et une deceleration, parce qu'un passage a vitesse constante
   d'une pose a l'autre se lit immediatement comme une machine.

   CETTE PASSE-CI PEUPLE LE DECOR AUTOUR DE LUI PLUTOT QUE LE PERSONNAGE
   SEUL : un hibou perche non loin, qui tourne la tete pour le regarder
   passer et cligne des yeux a son propre rythme — un temoin discret, pas un
   second sujet — et l'arbre d'accroche porte desormais des glaçons et une
   neige qui se detache doucement du fil a chaque oscillation. Rien de tout
   cela ne rivalise avec le personnage : tout reste plus petit, plus sombre
   ou plus lent que lui.

   UN TROISIEME HABITANT REAGIT DIFFEREMMENT DES DEUX AUTRES : un moineau,
   bas sur le tronc, qui s'enfuit des que le personnage s'agite pour de bon
   — ressort comprime, gerbe de neige, battement d'ailes vif — la ou le
   hibou, lui, se contente d'observer. Deux reactions animales opposees a
   la meme apparition valent mieux qu'une seule repetee deux fois. */

/* --------------------------------------------------------------------------
   LE HIBOU.

   Perche sur son propre moignon de branche, a l'ecart du fil pour ne
   jamais s'y emmeler visuellement. Il n'existe pas pour etre remarque en
   premier — il existe pour recompenser un second regard : la foret n'est
   pas vide autour du heros, elle a ses propres habitants qui l'observent.

   La tete est un sous-groupe distinct du corps, exactement comme celle du
   personnage principal : c'est ce qui permet de la faire pivoter seule,
   sans emporter les ailes avec elle. Un hibou tourne la tete bien plus loin
   qu'un visage humain ne le pourrait — un ressort qu'on se permet ici
   volontiers, puisque c'est precisement ce qui rend un hibou reconnaissable
   en silhouette.
   -------------------------------------------------------------------------- */
function hibouPerche() {
  const g = new THREE.Group();

  // Le perchoir : un court moignon de branche, independant du grand tronc
  // d'accroche — le hibou a le sien, il ne partage pas celui du heros.
  const matBranche = new THREE.MeshStandardMaterial({ color: 0x2B2119, roughness: 0.94 });
  const branche = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.62, 6), matBranche);
  branche.rotation.z = Math.PI / 2 - 0.18;
  branche.position.set(-0.15, -0.04, 0);
  g.add(branche);
  const neigeBranche = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshStandardMaterial({
    color: 0xE7F0F9, roughness: 0.85,
  }));
  neigeBranche.scale.set(2.6, 0.5, 1.1);
  neigeBranche.position.set(-0.15, 0.03, 0);
  g.add(neigeBranche);

  const matCorps = new THREE.MeshStandardMaterial({ color: 0x3A3226, roughness: 0.86 });
  const matVentre = new THREE.MeshStandardMaterial({ color: 0xC9BFA8, roughness: 0.82 });
  const matBec = new THREE.MeshStandardMaterial({ color: 0x241A12, roughness: 0.5, metalness: 0.15 });

  // Le corps : une goutte dressee, plus haute que large — la posture
  // caracteristique d'un rapace nocturne au repos, epaules rentrees.
  const corps = new THREE.Mesh(new THREE.SphereGeometry(0.155, 9, 7), matCorps);
  corps.scale.set(0.86, 1.22, 0.80);
  corps.position.y = 0.16;
  g.add(corps);
  const ventre = new THREE.Mesh(new THREE.SphereGeometry(0.095, 7, 6), matVentre);
  ventre.scale.set(0.92, 1.05, 0.75);
  ventre.position.set(0, 0.13, 0.095);
  g.add(ventre);

  // Les ailes, repliees en pointe le long du corps — un hibou perche ne
  // montre jamais l'envergure, seulement deux triangles sombres serres.
  for (const sx of [-1, 1]) {
    const aile = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.30, 5), matCorps);
    aile.rotation.x = Math.PI;
    aile.rotation.z = sx * 0.30;
    aile.position.set(sx * 0.115, 0.12, -0.02);
    g.add(aile);
  }

  // La tete, sous-groupe pivotable — c'est elle, et elle seule, qui tourne.
  const tete = new THREE.Group();
  tete.position.y = 0.35;
  g.add(tete);
  const crane = new THREE.Mesh(new THREE.SphereGeometry(0.105, 9, 7), matCorps);
  tete.add(crane);
  // Le disque facial, aplati, clair : c'est lui qui concentre le son vers
  // les oreilles et qui donne au visage sa forme si particuliere.
  const disque = new THREE.Mesh(new THREE.SphereGeometry(0.092, 9, 7), matVentre);
  disque.scale.set(1.0, 1.0, 0.42);
  disque.position.z = 0.045;
  tete.add(disque);

  // Les yeux : tres grands, tres ronds, tournes plein axe — c'est la
  // vision binoculaire d'un predateur nocturne, jamais celle d'une proie.
  const yeux = [];
  for (const sx of [-1, 1]) {
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.027, 7, 6),
      new THREE.MeshBasicMaterial({ color: 0xF4C430 }));
    oeil.position.set(sx * 0.044, 0.012, 0.092);
    tete.add(oeil);
    const pupille = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x0A0806 }));
    pupille.position.set(sx * 0.044, 0.012, 0.113);
    tete.add(pupille);
    yeux.push(oeil);
  }
  const bec = new THREE.Mesh(new THREE.ConeGeometry(0.020, 0.048, 6), matBec);
  bec.rotation.x = Math.PI / 2;
  bec.position.set(0, -0.028, 0.105);
  tete.add(bec);

  // Les aigrettes : deux touffes dressees, le signe le plus reconnaissable
  // du hibou en silhouette — sans elles on ne distingue plus un hibou d'une
  // chouette, or c'est bien un hibou qu'on veut ici.
  for (const sx of [-1, 1]) {
    const aigrette = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.075, 4), matCorps);
    aigrette.position.set(sx * 0.048, 0.235, 0.015);
    aigrette.rotation.z = sx * -0.30;
    tete.add(aigrette);
  }

  // Les serres, agrippees a la branche — deux pattes suffisent, on ne
  // detaille jamais des griffes qu'on ne verra pas a cette distance.
  for (const sx of [-1, 1]) {
    const patte = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.09, 5),
      new THREE.MeshStandardMaterial({ color: 0xB08A3C, roughness: 0.7 }));
    patte.position.set(sx * 0.05, 0.02, 0.01);
    g.add(patte);
  }

  g.userData = { tete, yeux };
  return g;
}

/* --------------------------------------------------------------------------
   LES GLAÇONS.

   Une simple frange de cones fins, de longueurs et d'ecarts irreguliers,
   suspendue a la fourche du tronc d'accroche. Une seule taille repetee se
   lirait comme une grille d'orgue ; le desordre, lui, se lit comme du vrai
   givre qui a fondu et regele au hasard des gouttes.
   -------------------------------------------------------------------------- */
function glacons(n, alea) {
  const g = new THREE.Group();
  /* Un materiau standard, transparent et tres lisse — pas la vraie
     refraction physique (`MeshPhysicalMaterial.transmission`), qui force
     le moteur a refaire un rendu complet de la scene en coulisse pour
     chaque objet qui la porte. Rien d'autre dans ce projet ne paie ce
     cout, et un glaçon de quelques centimetres a vingt metres ne le
     justifie certainement pas : l'opacite partielle suffit largement a
     l'oeil. */
  const mat = new THREE.MeshStandardMaterial({
    color: 0xD8E8F5, roughness: 0.15, metalness: 0.05,
    transparent: true, opacity: 0.82,
  });
  const pointes = [];
  for (let i = 0; i < n; i++) {
    const r = alea();
    const longueur = 0.10 + r * 0.22;
    const rayon = 0.010 + r * 0.008;
    const glacon = new THREE.Mesh(new THREE.ConeGeometry(rayon, longueur, 5), mat);
    /* LA POINTE DOIT TOMBER VERS LE BAS. Un cone three.js a sa POINTE en
       +Y et sa base (le cote large) en -Y — la meme convention que
       `faisceau()` dans `vehicules.js`. Sans cette rotation de cent
       quatre-vingts degres, le glaçon se dresse pointe en l'air, base
       large en bas : un piquant plutot qu'un glaçon. */
    glacon.rotation.x = Math.PI;
    glacon.position.set((i - (n - 1) / 2) * 0.075 + (alea() - 0.5) * 0.03, -longueur / 2, (alea() - 0.5) * 0.04);
    g.add(glacon);
    pointes.push(glacon);
  }
  // Un glint tres discret, en haut du rideau : juste assez pour dire que
  // la glace attrape la lumiere, jamais assez pour se lire comme une lampe.
  const glint = halo([0.75, 0.90, 1.05], 0.42, 0.55);
  glint.position.y = 0.02;
  g.add(glint);
  g.userData = { glint, pointes };
  return g;
}

/* --------------------------------------------------------------------------
   LA BRANCHE D'ACCROCHE.

   Antoine : « le premier Spider-Man pend dans le vide ». Il avait raison :
   le degagement qui protege la pose (5,5 m de rayon, voir `planApparitions`)
   retire aussi tout arbre susceptible d'expliquer a quoi le fil est
   attache. Au-dessus des chevilles, il ne restait donc rien — un fil qui
   monte tout droit et s'arrete en l'air, sans que rien n'explique pourquoi
   il ne tombe pas.

   La scene porte donc sa propre branche : un moignon de conifere qui entre
   par le cote et rejoint exactement la pointe du fil. Elle est ajoutee au
   PIVOT, comme le fil, jamais au groupe : les deux doivent rester
   rigidement solidaires quand l'ensemble se balance, sinon l'accroche se
   desolidarise a chaque oscillation — ce qui se verrait plus encore que
   l'absence de branche.

   SECONDE CORRECTION. Antoine, encore : « le premier Spider-Man flotte
   toujours dans le vide ». La premiere reponse — une touffe d'aiguilles au
   bout d'un baton d'un metre — restait un petit objet flottant, pas un
   arbre : le degagement de 5,5 m autour de la pose retire justement tout
   ce qui aurait pu convaincre autour de lui. Cette fois la scene porte un
   arbre COMPLET, du sol jusqu'a la ramure, pose a cote du personnage — pas
   un accessoire suspendu au-dessus de lui.

   Le tronc n'est PAS ajoute au pivot qui fait tourner et se balancer le
   personnage : un tronc qui pivote ou se souleve du sol a chaque balancement
   se voit immediatement, bien plus qu'un fil sans attache. Il est donc fixe
   dans le groupe, immobile ; seule une petite touffe D'EXTREMITE, ajoutee
   au pivot avec le fil, suit le balancement — comme la pointe souple d'une
   vraie branche, quand le tronc, lui, ne bouge pas.

   CETTE PASSE-CI AJOUTE CE QUI FAIT UN VIEIL ARBRE PLUTOT QU'UN SAPIN DE
   CATALOGUE : un evasement de racines a la base, une branche cassee au
   bois expose, de la mousse sur le flanc a l'abri du vent, et des glaçons
   suspendus a deux etages plutot qu'au seul point d'accroche. Rien de tout
   cela n'est necessaire a la lisibilite de la scene — c'est exactement
   pour ca que c'est ce qui la fait paraitre habitee plutot que construite
   pour l'occasion. */
function troncAccroche() {
  const g = new THREE.Group();
  const matBois = new THREE.MeshStandardMaterial({ color: 0x2B2119, roughness: 0.95 });
  const matBoisExpose = new THREE.MeshStandardMaterial({ color: 0x8A6F4A, roughness: 0.88 });
  const matAiguilles = new THREE.MeshStandardMaterial({
    color: 0x3D6354, roughness: 0.92, side: THREE.DoubleSide,
  });
  const matNeige = new THREE.MeshStandardMaterial({ color: 0xE7F0F9, roughness: 0.82 });
  const matMousse = new THREE.MeshStandardMaterial({ color: 0x3E4A2E, roughness: 0.95 });
  const matGlace = new THREE.MeshStandardMaterial({
    color: 0xD8E8F5, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.80,
  });

  const segment = (a, b, rA, rB, mat) => {
    const l = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, l, 6), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      _AXE_Y, new THREE.Vector3().subVectors(b, a).divideScalar(l));
    return m;
  };
  const touffe = (centre, azimut, elev, longueur, rayon) => {
    const dir = new THREE.Vector3(
      Math.cos(azimut) * Math.cos(elev), Math.sin(elev), Math.sin(azimut) * Math.cos(elev));
    const m = new THREE.Mesh(new THREE.ConeGeometry(rayon, longueur, 5), matAiguilles);
    m.position.copy(centre).addScaledVector(dir, longueur * 0.5);
    m.quaternion.setFromUnitVectors(_AXE_Y, dir);
    return m;
  };

  /* Le pied est au sol, nettement ecarte — un tronc qui penche, pas un
     poteau plante au ras du personnage. La fourche, elle, doit rester
     TOUTE PROCHE de la pointe du fil (0, 6,95, 0) : au format portrait, le
     champ horizontal ne fait qu'une trentaine de degres, et un ecart qui
     semble anodin en metres s'ouvre en un fosse a l'ecran. Mesure faite : a
     quatre-vingt-quinze centimetres d'ecart, la fourche et la pointe du fil
     se separaient nettement a l'image, l'arbre lu comme un decor a part,
     sans rapport avec le personnage qui pend juste a cote. */
  const pied = new THREE.Vector3(1.35, 0, -0.85);
  const fourche = new THREE.Vector3(0.30, 7.00, -0.16);
  g.add(segment(pied, fourche, 0.22, 0.07, matBois));

  /* L'EVASEMENT DES RACINES. Un tronc qui plonge tout droit dans la neige,
     sans rien qui s'elargisse a son pied, se lit comme plante plutot que
     poussee — un arbre reel etale toujours des racines qui affleurent,
     surtout en foret ou le sol est peu profond. Quatre suffisent : plus,
     et on retombe dans les aiguilles qu'on vient d'ajouter au reste. */
  for (let i = 0; i < 4; i++) {
    const az = (i / 4) * Math.PI * 2 + 0.35;
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const haut = pied.clone().addScaledVector(dir, 0.06).add(new THREE.Vector3(0, 0.32, 0));
    const bas = pied.clone().addScaledVector(dir, 0.38);
    g.add(segment(haut, bas, 0.05, 0.15, matBois));
  }

  // La ramure haute, autour de la fourche.
  g.add(touffe(fourche, 0.3, 0.55, 0.44, 0.12));
  g.add(touffe(fourche, 1.3, 0.15, 0.52, 0.14));
  g.add(touffe(fourche, 2.6, 0.65, 0.36, 0.11));
  g.add(touffe(fourche, 3.6, -0.10, 0.48, 0.13));
  g.add(touffe(fourche, 4.5, 0.40, 0.32, 0.10));
  g.add(touffe(fourche, 5.6, 0.75, 0.40, 0.11));

  // Deux etages plus bas sur le tronc : c'est ce qui fait reconnaitre un
  // arbre plutot qu'un poteau surmonte d'un plumeau.
  for (const [h, rayon] of [[0.30, 0.15], [0.55, 0.12]]) {
    const c = new THREE.Vector3().lerpVectors(pied, fourche, h);
    for (let i = 0; i < 5; i++) {
      const az = (i / 5) * Math.PI * 2 + h * 4;
      g.add(touffe(c, az, 0.05 + (i % 2) * 0.18, 0.34, rayon));
    }
  }

  /* LA BRANCHE CASSEE. Un moignon au bois expose, clair contre l'ecorce
     sombre — la cicatrice qu'une branche laisse en tombant, des annees
     plus tot. Placee sous la fourche, jamais dedans : elle doit rester une
     signature du tronc, pas concurrencer l'accroche elle-meme. */
  const hCassure = 0.72;
  const cCassure = new THREE.Vector3().lerpVectors(pied, fourche, hCassure);
  const dirCassure = new THREE.Vector3(-0.85, 0.20, 0.4).normalize();
  const boutCassure = cCassure.clone().addScaledVector(dirCassure, 0.34);
  const moignon = segment(cCassure, boutCassure, 0.05, 0.09, matBois);
  g.add(moignon);
  // La coupe elle-meme : un disque de bois clair, perpendiculaire a la
  // cassure — c'est lui, plus que le moignon, qui raconte l'accident.
  const coupe = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), matBoisExpose);
  coupe.position.copy(boutCassure).addScaledVector(dirCassure, 0.005);
  coupe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirCassure);
  g.add(coupe);

  /* LA MOUSSE. Toujours du meme cote — celui a l'abri du vent dominant,
     jamais reparti au hasard tout autour du tronc, exactement comme sur un
     arbre reel. Quatre plaques aplaties, tres discretes : c'est une texture
     de fond, pas un motif qu'on doit remarquer en premier. */
  const versMousse = new THREE.Vector3(-0.7, 0, 0.35).normalize();
  for (let i = 0; i < 4; i++) {
    const h = 0.12 + i * 0.13;
    const c = new THREE.Vector3().lerpVectors(pied, fourche, h);
    const plaque = new THREE.Mesh(new THREE.SphereGeometry(0.085 + (i % 2) * 0.025, 6, 4), matMousse);
    plaque.scale.set(1.0, 0.35, 0.55);
    plaque.position.copy(c).addScaledVector(versMousse, 0.15 + h * 0.03);
    g.add(plaque);
  }

  /* LES GLAÇONS DU TRONC. Le rideau principal, plus fourni, reste au point
     d'accroche (voir `glacons()` et son usage dans `spiderSuspendu`) ; ceux-
     ci sont une simple ponctuation, deux ou trois par etage de branches,
     pour que l'hiver ne s'arrete pas net a la hauteur du personnage. */
  for (const h of [0.32, 0.56]) {
    const c = new THREE.Vector3().lerpVectors(pied, fourche, h);
    for (let i = 0; i < 3; i++) {
      const longueur = 0.07 + (i % 2) * 0.05;
      const glacon = new THREE.Mesh(new THREE.ConeGeometry(0.011, longueur, 5), matGlace);
      // Meme correction d'orientation que dans `glacons()` : la pointe
      // d'un cone three.js est en +Y, il faut la retourner vers le bas.
      glacon.rotation.x = Math.PI;
      glacon.position.copy(c).add(new THREE.Vector3((i - 1) * 0.11, -0.20 - longueur / 2, 0.16));
      g.add(glacon);
    }
  }

  // Neige au creux de la fourche et contre le pied.
  const neigeHaut = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), matNeige);
  neigeHaut.scale.set(1.3, 0.5, 1.15);
  neigeHaut.position.copy(fourche).addScaledVector(_AXE_Y, 0.18);
  g.add(neigeHaut);
  const neigePied = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 5), matNeige);
  neigePied.scale.set(1.5, 0.26, 1.4);
  neigePied.position.copy(pied).addScaledVector(_AXE_Y, 0.04);
  g.add(neigePied);

  return g;
}

/* La touffe d'extremite : solidaire du fil, elle suit le meme balancement
   que lui — comme la pointe souple d'une branche, alors que le tronc,
   fixe, ne bouge pas. Elle est batie autour de l'origine locale : depuis
   que le pivot est lui-meme place a hauteur de l'accroche, cette origine
   EST le noeud du fil, et reste (a peu de choses pres) fixe quel que soit
   le balancement. */
function touffeExtremite() {
  const g = new THREE.Group();
  const matAiguilles = new THREE.MeshStandardMaterial({
    color: 0x3D6354, roughness: 0.92, side: THREE.DoubleSide,
  });
  const matNeige = new THREE.MeshStandardMaterial({ color: 0xE7F0F9, roughness: 0.82 });
  const pointe = new THREE.Vector3(0, 0, 0);
  const touffe = (azimut, elev, longueur, rayon) => {
    const dir = new THREE.Vector3(
      Math.cos(azimut) * Math.cos(elev), Math.sin(elev), Math.sin(azimut) * Math.cos(elev));
    const m = new THREE.Mesh(new THREE.ConeGeometry(rayon, longueur, 5), matAiguilles);
    m.position.copy(pointe).addScaledVector(dir, longueur * 0.5);
    m.quaternion.setFromUnitVectors(_AXE_Y, dir);
    return m;
  };
  g.add(touffe(0.9, 0.45, 0.30, 0.09));
  g.add(touffe(2.2, 0.20, 0.34, 0.10));
  g.add(touffe(4.0, 0.55, 0.26, 0.08));
  const neige = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), matNeige);
  neige.scale.set(1.2, 0.5, 1.1);
  neige.position.copy(pointe).addScaledVector(_AXE_Y, 0.10);
  g.add(neige);

  /* Deux petits glaçons, solidaires de la touffe : ils se balancent donc
     avec elle, jamais figes pendant que tout le reste de la scene bouge.
     Meme correction d'orientation que partout ailleurs dans ce fichier —
     la pointe d'un cone est en +Y, il faut la retourner. */
  const matGlace = new THREE.MeshStandardMaterial({
    color: 0xD8E8F5, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.80,
  });
  for (const [dx, dz, longueur] of [[0.06, 0.03, 0.06], [-0.05, 0.05, 0.045]]) {
    const glacon = new THREE.Mesh(new THREE.ConeGeometry(0.008, longueur, 5), matGlace);
    glacon.rotation.x = Math.PI;
    glacon.position.copy(pointe).add(new THREE.Vector3(dx, -0.06 - longueur / 2, dz));
    g.add(glacon);
  }
  return g;
}

/* --------------------------------------------------------------------------
   LE MOINEAU EFFRAYE.

   Le hibou regarde calmement ; ce petit oiseau-la, lui, PART — c'est ce
   contraste de comportement, plus que la difference d'espece, qui donne
   l'impression d'une vraie foret plutot que d'un decor peuple au hasard.
   Il est perche bas sur le tronc, largement sous la fourche, et s'envole
   des que le personnage commence a s'agiter serieusement : un animal de
   cette taille ne tolere pas longtemps un mouvement inconnu au-dessus de
   lui.

   Contrairement au hibou, il n'a pas de tete pivotante — un moineau ne
   regarde pas, il REAGIT. Toute sa caracterisation tient dans le moment ou
   il decolle et dans la vitesse a laquelle il disparait.
   -------------------------------------------------------------------------- */
function moineauEffraye() {
  const g = new THREE.Group();
  const matCorps = new THREE.MeshStandardMaterial({ color: 0x5A4A38, roughness: 0.88 });
  const matVentre = new THREE.MeshStandardMaterial({ color: 0xC9BCA0, roughness: 0.85 });
  const matBec = new THREE.MeshStandardMaterial({ color: 0x3A2A18, roughness: 0.6 });

  const corps = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), matCorps);
  corps.scale.set(1.0, 0.85, 1.35);
  g.add(corps);
  const ventre = new THREE.Mesh(new THREE.SphereGeometry(0.030, 6, 5), matVentre);
  ventre.position.set(0, -0.014, 0.012);
  g.add(ventre);
  const tete = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), matCorps);
  tete.position.set(0, 0.032, 0.048);
  g.add(tete);
  const bec = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.022, 4), matBec);
  bec.rotation.x = Math.PI / 2;
  bec.position.set(0, 0.030, 0.070);
  g.add(bec);
  const queue = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.055, 4), matCorps);
  queue.rotation.x = -Math.PI / 2 + 0.35;
  queue.position.set(0, 0.010, -0.058);
  g.add(queue);

  /* Les ailes, dans un sous-groupe distinct : au repos, immobiles et
     serrees le long du corps ; en vol, elles battent — c'est ce battement,
     seul, qui distingue un oiseau perche d'un oiseau qui fuit. */
  const ailes = [];
  for (const sx of [-1, 1]) {
    const pivotAile = new THREE.Group();
    pivotAile.position.set(sx * 0.028, 0.006, 0);
    g.add(pivotAile);
    const aile = new THREE.Mesh(new THREE.ConeGeometry(0.020, 0.065, 4), matCorps);
    aile.rotation.z = sx * 1.15;
    aile.position.set(sx * 0.028, 0, 0);
    pivotAile.add(aile);
    ailes.push(pivotAile);
  }

  g.userData = { ailes };
  return g;
}

/* --------------------------------------------------------------------------
   LA BOURRASQUE DE NEIGE DU DEPART.

   Un oiseau qui decolle d'une branche enneigee en fait toujours tomber un
   peu — c'est exactement le meme principe que la gerbe de debris de la
   congere dans la course-poursuite de police (`police.js`) : un eclatement
   UNIQUE, pas une pluie continue, declenche pile a l'instant du depart et
   qui ne rejoue plus jusqu'au prochain passage.
   -------------------------------------------------------------------------- */
function bourrasqueDepart(n) {
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xEEF4FC, size: 0.045,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const dirs = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.5 + 0.10;
    return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
  });
  pts.userData = { dirs, n };
  return pts;
}

function majBourrasque(pts, dtE) {
  if (dtE > 0.85) { pts.material.opacity = 0; return; }
  const { dirs, n } = pts.userData;
  const pos = pts.geometry.attributes.position.array;
  for (let i = 0; i < n; i++) {
    const [dx, dy, dz] = dirs[i];
    const vol = Math.min(dtE, 0.7);
    pos[i * 3] = dx * vol * 1.1;
    pos[i * 3 + 1] = Math.max(-0.3, dy * vol * 0.9 - dtE * dtE * 1.4);
    pos[i * 3 + 2] = dz * vol * 1.1;
  }
  pts.geometry.attributes.position.needsUpdate = true;
  pts.material.opacity = Math.max(0, 1 - dtE * 1.1);
}

export function spiderSuspendu(palier) {
  const g = new THREE.Group();
  const perso = creerSpider(palier, { ombres: palier.ombres });

  /* IL PENDAIT SOUS LA NEIGE, PUIS PAR LE VENTRE. Deux corrections
     successives, dont voici le compte definitif : le groupe est pose AU SOL,
     le personnage est retourne d'un demi-tour autour de Z — donc ses pieds
     restent a la hauteur qu'on lui donne et sa tete descend d'un metre
     soixante-dix-huit en dessous. On accroche les chevilles a 3,55 m : la
     tete arrive alors a 1,77 m, pile a hauteur de regard du drone. Le fil
     mesure 3,4 m ; son sommet — l'ACCROCHE — est donc a 6,95 m. */
  const CHEVILLES = 3.55;
  const ACCROCHE = CHEVILLES + 3.4;

  /* LE PIVOT DE LA BALANCE ETAIT AU SOL, ET C'ETAIT PHYSIQUEMENT A
     L'ENVERS. Une fois le tronc ajoute, le defaut a saute aux yeux : le
     personnage se balancant autour d'un point a hauteur de ses PIEDS, le
     sommet du fil — cense rester noue a la branche — se deplaçait de PLUS
     D'UN METRE a chaque oscillation, largement assez pour se detacher du
     tronc, fixe lui, a l'ecran. Un corps suspendu se balance autour de son
     ACCROCHE, jamais autour du sol : le pivot est donc place a la hauteur
     du noeud, et tout ce qu'il contient est repere par rapport a CETTE
     hauteur — negatif pour le personnage, qui pend dessous. */
  const pivot = new THREE.Group();
  pivot.position.y = ACCROCHE;
  perso.rotation.z = Math.PI;
  perso.position.y = CHEVILLES - ACCROCHE;
  pivot.add(perso);

  const fil = filDeToile(3.4);
  fil.position.y = (CHEVILLES + 1.70) - ACCROCHE;
  pivot.add(fil);
  pivot.add(touffeExtremite());
  g.add(pivot);
  g.add(troncAccroche());

  /* LE HIBOU, plante a cote — pas sur le fil, pas dans le pivot : il vit
     dans le repere du GROUPE, immobile, pendant que le personnage se
     balance devant lui. Place plus bas et sur le cote, pour ne jamais
     couper la silhouette suspendue au premier plan. */
  const hibou = hibouPerche();
  hibou.scale.setScalar(2.4);
  hibou.position.set(-1.55, 5.55, -0.65);
  hibou.rotation.y = 0.6;
  g.add(hibou);

  /* LE MOINEAU, bas sur le tronc — largement sous la fourche, sous la
     branche cassee meme, pres du monticule de neige au pied de l'arbre.
     Il vit dans le repere du GROUPE, comme le hibou : sa position de
     depart doit rester fixe pendant qu'il est simplement perche. */
  const moineau = moineauEffraye();
  moineau.scale.setScalar(2.0);
  const posMoineauRepos = new THREE.Vector3(1.05, 0.85, -0.55);
  moineau.position.copy(posMoineauRepos);
  moineau.rotation.y = 2.4;
  g.add(moineau);
  const bourrasque = bourrasqueDepart(palier.nom === 'bas' ? 10 : 18);
  bourrasque.position.copy(posMoineauRepos);
  g.add(bourrasque);

  /* Une graine propre a cette instance de scene, pour que le desordre des
     glaçons soit fixe une fois pour toutes plutot que recalcule — et donc
     potentiellement different — a chaque image. */
  let graine = 1;
  const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
  // Comme la neige et la bourrasque du moineau plus bas : moins de
  // glaçons sur le palier le plus modeste, ou l'ecran ne montrera de
  // toute facon jamais assez de pixels pour compter les manquants.
  const rideauGlace = glacons(palier.nom === 'bas' ? 4 : 7, alea);
  rideauGlace.position.set(0.30, 6.95, -0.10);
  g.add(rideauGlace);

  const os = perso.userData.os;
  const yeuxSpider = os.tete.userData.yeux || [];
  const yeuxBaseY = yeuxSpider.map((o) => o.scale.y);
  const yeuxHibou = hibou.userData.yeux;
  const yeuxHibouBaseY = yeuxHibou.map((o) => o.scale.y);

  /* La sequence. Les instants sont exprimes en progression dans la fenetre,
     de zero a un : la scene dure ce qu'elle dure selon la vitesse du cerf,
     et elle se joue toujours en entier. */
  const sequence = piste([
    { t: 0.00, pose: POSES.suspendu },
    { t: 0.34, pose: POSES.suspendu },
    { t: 0.50, pose: POSES.suspenduSalut },
    { t: 0.70, pose: POSES.suspenduSalut },
    { t: 0.86, pose: POSES.suspendu },
    { t: 1.00, pose: POSES.suspendu },
  ]);

  /* LA NEIGE QUI SE DETACHE. Continue, jamais un seul eclatement : chaque
     particule reboucle sur son propre cycle, exactement le principe deja
     etabli pour le deluge de Shining, applique ici a un filet de poudreuse
     qui tombe du point d'accroche plutot qu'a un liquide. */
  const N_NEIGE = palier.nom === 'bas' ? 16 : 30;
  const posNeige = new Float32Array(N_NEIGE * 3);
  const geoNeige = new THREE.BufferGeometry();
  geoNeige.setAttribute('position', new THREE.BufferAttribute(posNeige, 3));
  const matNeige = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xEEF4FC, size: 0.05,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const chuteNeige = new THREE.Points(geoNeige, matNeige);
  chuteNeige.frustumCulled = false;
  chuteNeige.position.set(0.05, 6.85, -0.12);
  g.add(chuteNeige);
  const phaseNeige = Float32Array.from({ length: N_NEIGE }, () => alea());
  const cycleNeige = Float32Array.from({ length: N_NEIGE }, () => 1.1 + alea() * 1.0);
  const oxNeige = Float32Array.from({ length: N_NEIGE }, () => (alea() - 0.5) * 0.55);
  const ozNeige = Float32Array.from({ length: N_NEIGE }, () => (alea() - 0.5) * 0.35);

  /* L'envol du moineau ne se joue qu'UNE fois par passage — sans ce
     garde-fou, il redemarrerait sa fuite a chaque image tant que la
     fenetre de declenchement reste ouverte, ce qui le figerait a mi-vol.
     `reinit` le remet sur sa branche si jamais la balade recommence. */
  let envolFait = false, envolT = 0;
  /* LE SENS ARACHNEEN. Un seul pincement, au tout premier instant ou il
     vous repere — pas un tic qui reviendrait a chaque image tant que
     l'attention reste haute, ce qui se lirait comme un clignement nerveux
     plutot que comme un reflexe. */
  let sensFait = false, sensT = 0;
  g.userData.reinit = () => {
    envolFait = false;
    sensFait = false;
    moineau.position.copy(posMoineauRepos);
    moineau.rotation.set(0, 2.4, 0);
    moineau.scale.setScalar(2.0);
    moineau.visible = true;
    for (const aile of moineau.userData.ailes) aile.rotation.z = 0;
    bourrasque.material.opacity = 0;
  };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    sequence(os, u);

    /* LE SALUT SE SUPERPOSE A LA POSE, il ne la remplace pas : la main
       oscille deux fois pendant que le bras reste ou la sequence l'a mis.
       C'est ce qui evite qu'un geste dure trop et devienne un moulinet. */
    const salut = smoothstep(0.44, 0.52, u) * smoothstep(0.76, 0.66, u);
    if (salut > 0.001) {
      const bat = Math.sin(t * 5.6);
      os.avantD.rotation.z += salut * bat * 0.55;
      os.mainD.rotation.z += salut * bat * 0.35;
    }

    /* UNE RESPIRATION MINUSCULE. Sans elle, un corps suspendu et immobile
       entre deux gestes devient une poupee accrochee a un fil plutot
       qu'un acrobate qui reprend son souffle. */
    os.poitrine.rotation.x += Math.sin(t * 1.8) * 0.014;

    /* L'ARRIVEE. Il vient de se poser sur ce fil, et un fil qui vient de
       recevoir tout un corps ne se stabilise pas instantanement — il
       oscille fort puis s'amortit. L'amplitude de depart est portee bien
       au-dela du regime de croisiere et retombe vite, en tout debut de
       fenetre : une exponentielle decroissante sur `u`, pas sur `t`, pour
       que l'amortissement suive toujours le meme rythme narratif quelle
       que soit la vitesse a laquelle le cerf a rejoint la scene. */
    const arrivee = 1 + Math.exp(-u * 26) * 1.7;

    // Il se balance doucement, et tourne un peu sur lui-meme.
    pivot.rotation.z = Math.sin(t * 1.15) * 0.15 * arrivee;
    /* La rotation propre s'ARRETE quand il vous a vu : on ne detaille pas
       quelqu'un qui tourne sur lui-meme, et surtout, un regard qui suit
       pendant que le corps pivote se lit comme un decrochage de nuque. */
    const attention = smoothstep(0.20, 0.36, u) * smoothstep(0.94, 0.82, u);
    pivot.rotation.y = Math.sin(t * 0.52) * 0.85 * (1 - attention);
    regarderVers(perso, os, camera, attention);

    /* LE SENS ARACHNEEN. Le tout premier instant ou l'attention depasse la
       moitie de sa course : les yeux s'ecarquillent un bref instant avant
       de revenir a leur taille normale — le reflexe classique du
       personnage, transpose ici a des lentilles plutot qu'a un masque
       entier qui se contracte. */
    if (!sensFait && attention > 0.5) { sensFait = true; sensT = t; }
    const sensPulse = sensFait ? Math.max(0, 1 - (t - sensT) / 0.35) : 0;

    /* IL TEND L'OREILLE. Apres le salut, un dernier geste avant de repartir
       — la tete se tourne vers la foret, comme s'il avait entendu quelque
       chose. C'est ce battement, discret, qui relie le personnage au hibou
       plante juste a cote : les deux ecoutent la meme foret. */
    const ecoute = smoothstep(0.78, 0.86, u) * smoothstep(0.98, 0.90, u);
    os.tete.rotation.y += ecoute * 0.6;
    os.tete.rotation.z += ecoute * 0.12;

    /* LE CLIGNEMENT. Un cycle propre a chaque personnage, sur une horloge
       absolue plutot que sur `u` : un clin d'oeil qui se cale toujours sur
       le meme instant de la fenetre se repeterait identique a chaque
       passage, ce qu'un vrai battement de paupieres ne fait jamais. */
    const cycleSpider = (t * 0.19) % 1;
    const clinSpider = Math.max(0, 1 - Math.abs(cycleSpider - 0.5) / 0.018);
    const squint = attention * 0.22;
    for (let i = 0; i < yeuxSpider.length; i++) {
      yeuxSpider[i].scale.y = yeuxBaseY[i] * (1 - clinSpider * 0.88) * (1 - squint) * (1 + sensPulse * 0.38);
    }

    /* LE HIBOU. Il tourne la tete pour suivre le personnage tant qu'il
       s'agite, puis se detourne une fois le salut passe — un vrai animal
       ne fixe pas indefiniment ce qui a cesse de bouger. Son clignement
       suit sa PROPRE horloge, dephasee de celle du personnage : deux
       creatures qui clignent exactement ensemble se liraient comme un seul
       mecanisme partage plutot que comme deux etres distincts. */
    const suit = smoothstep(0.06, 0.22, u) * smoothstep(0.60, 0.48, u);
    /* AVANT DE SUIVRE, IL GUETTE. Le tout debut de la fenetre — avant que
       `suit` ne prenne le relais — n'est pas encore le moment ou le hibou
       reagit au personnage : il scrute simplement la foret, comme il le
       ferait de toute facon. Sans ce guet, sa tete resterait figee jusqu'a
       la premiere reaction, ce qui trahirait un animal qui attend son cue
       plutot qu'une creature qui vit deja la. */
    const guette = 1 - smoothstep(0.02, 0.16, u);
    const scan = Math.sin(t * 0.31) * 0.5 * guette;
    hibou.userData.tete.rotation.y = 0.6 + scan + Math.sin(u * Math.PI) * suit * 0.9
      - 0.6 * smoothstep(0.60, 0.78, u);
    /* LE FRISSON. Tant qu'il ne suit pas activement le personnage, un
       hibou pose par une nuit d'hiver n'est jamais parfaitement immobile
       — un tres leger gonflement du plumage, comme s'il se recroqueville
       un peu contre le froid. Attenue des que `suit` prend le relais, pour
       ne jamais brouiller le mouvement de tete qui, lui, doit rester lisible. */
    const frisson = (1 - suit) * (0.5 + 0.5 * Math.sin(t * 0.9 + 1.7));
    hibou.scale.setScalar(2.4 * (1 + frisson * 0.012));
    const cycleHibou = (t * 0.11 + 0.37) % 1;
    const clinHibou = Math.max(0, 1 - Math.abs(cycleHibou - 0.5) / 0.030);
    for (let i = 0; i < yeuxHibou.length; i++) {
      /* Le meme reflexe que le personnage, mais attenue : le hibou n'est
         pas surpris de la meme facon — il observait deja — seule une
         legere avance de la meme reaction, comme un echo. */
      yeuxHibou[i].scale.y = yeuxHibouBaseY[i] * (1 - clinHibou * 0.9) * (1 + sensPulse * 0.14);
    }

    /* LE MOINEAU S'ENFUIT. Declenche quand le personnage commence vraiment
       a s'agiter — pas des l'ouverture de la fenetre, ou rien ne bouge
       encore assez pour effrayer quoi que ce soit. Un seul declenchement,
       comme l'embardee de la course-poursuite : un animal ne s'envole
       qu'une fois par alerte. */
    if (!envolFait && u > 0.30) { envolFait = true; envolT = t; }
    if (envolFait) {
      const dtE = t - envolT;
      if (dtE < 1.4) {
        /* Un depart vif, presque vertical, puis une fuite en biais vers la
           foret — jamais une ligne droite parfaite, qui se lirait comme un
           rail plutot que comme un vol. Les ailes battent tres vite, bien
           plus vite que ne le ferait un hibou, ce qui a lui seul distingue
           deja les deux especes en silhouette. */
        const k = Math.min(1, dtE / 1.2);
        const monte = 1 - (1 - k) * (1 - k);
        moineau.position.set(
          posMoineauRepos.x - k * 1.7 + Math.sin(k * 6.0) * 0.10,
          posMoineauRepos.y + monte * 2.3,
          posMoineauRepos.z - k * 1.3
        );
        moineau.rotation.y = 2.4 - k * 0.9;
        moineau.rotation.x = -k * 0.35;
        const bat = Math.sin(t * 46) * (1 - k * 0.3);
        for (const aile of moineau.userData.ailes) aile.rotation.z = bat;

        /* LE RESSORT AVANT LE DEPART. Un oiseau ne quitte jamais une
           branche a plat : il se tasse d'abord, comme un ressort qu'on
           comprime, et c'est cette compression — pas le battement d'aile
           lui-meme — qui precede vraiment le decollage. Tres bref, et
           superpose au tout debut du vol plutot que de retarder son
           declenchement : on ne veut pas d'un temps mort avant l'action. */
        const ressort = Math.max(0, 1 - dtE / 0.12);
        moineau.scale.set(2.0 * (1 + ressort * 0.22), 2.0 * (1 - ressort * 0.30), 2.0 * (1 + ressort * 0.10));
      } else {
        moineau.visible = false;
      }
      majBourrasque(bourrasque, dtE);
    }

    /* LA NEIGE. Chaque particule reboucle sur son propre cycle et derive
       un peu plus fort quand le fil s'agite — c'est le meme mouvement qui
       la libere. */
    const secousse = Math.min(1, arrivee - 1 + Math.abs(Math.sin(t * 1.15)) * 0.4);
    matNeige.opacity = vis * (0.35 + secousse * 0.5);
    for (let i = 0; i < N_NEIGE; i++) {
      const k = ((t * 0.6) / cycleNeige[i] + phaseNeige[i]) % 1;
      posNeige[i * 3] = oxNeige[i] + Math.sin(t * 0.7 + i) * 0.05 * k;
      posNeige[i * 3 + 1] = -k * k * 2.6;
      posNeige[i * 3 + 2] = ozNeige[i];
    }
    geoNeige.attributes.position.needsUpdate = true;

    // Le glint des glaçons palpite tres lentement, comme la lune bouge
    // derriere les nuages plutot que comme une source qui clignote.
    rideauGlace.userData.glint.material.opacity = vis * (0.35 + Math.sin(t * 0.35) * 0.12);

    /* LE RIDEAU DE GLAÇONS BALANCE TRES LEGEREMENT — un vent de foret, pas
       la secousse du fil : une frequence propre a chacun, deux frequences
       non multiples l'une de l'autre pour qu'ils ne se figent jamais tous
       ensemble comme une rangee de pendules synchronises. */
    for (let i = 0; i < rideauGlace.userData.pointes.length; i++) {
      const p = rideauGlace.userData.pointes[i];
      p.rotation.z = Math.sin(t * 0.7 + i * 1.9) * 0.03 + Math.sin(t * 1.3 + i * 0.6) * 0.015;
    }
  };
  return g;
}
