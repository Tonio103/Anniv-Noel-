/* LA COURSE-POURSUITE DE POLICE.

   ANTOINE : « la voiture de police doit se deplacer, ca doit etre une
   veritable course-poursuite ».

   La toute premiere version etait une voiture GAREE dans la neige avec son
   gyrophare allume. Elle avait beau balayer les troncs de deux faisceaux
   tournants, elle ne racontait rien : une voiture de police immobile au
   milieu d'une foret, c'est un decor, pas une scene.

   Ce qui fait une poursuite tient a quatre choses, dans cet ordre :

   · LE FUYARD PASSE D'ABORD, tous feux arriere allumes, en zigzag. Sans lui
     la police ne poursuit rien et l'on regarde une ronde ;
   · ELLES ARRIVENT DU FOND, phares dans le brouillard. On les voit venir de
     loin, ce qui installe l'attente ;
   · ELLES DOUBLENT LE CERF, tres vite, au ras du chemin. C'est le seul
     instant ou l'echelle et la vitesse se lisent vraiment ;
   · ELLES DISPARAISSENT DEVANT, avalees par la brume, en laissant le
     gyrophare battre encore un moment sur les arbres.

   CETTE PASSE-CI EN AJOUTE UNE CINQUIEME : LE QUASI-ACCIDENT. Une vraie
   poursuite n'est jamais parfaitement lisse — quelqu'un manque de percuter
   quelque chose, et c'est cet instant-la qu'on retient. Une congere avec
   une branche cassee attend sur la voie du fuyard ; il l'evite au dernier
   moment, dans une embardee franche, freins a fond, gerbe de neige qui part
   de travers. La camera encaisse le choc — voir le canal `emettre`
   generique, qui secoue le drone pour n'importe quel evenement ponctuel.

   ET UNE SECONDE VOITURE DE POLICE REJOINT LA CHASSE, quelques metres en
   retrait de la premiere : une poursuite a un seul vehicule se lit comme
   un controle routier qui a mal tourne, deux vehicules se lisent comme une
   VRAIE intervention. La voiture de tete porte le pare-chocs poussoir et
   le projecteur de recherche qui balaie devant elle ; le renfort suit,
   plus sobre, et ne fait que repeter le gyrophare avec un decalage de
   phase — sans quoi les deux rampes clignoteraient en parfaite synchronie,
   ce qu'aucune paire de vehicules reels ne fait jamais.

   Tout cela se joue en une dizaine de secondes, et le reste de la fenetre
   est du silence — c'est lui qui fait la surprise.
*/

import * as THREE from 'three';
import { grainRond } from '../../core/dot.js';
import { smoothstep, clamp } from '../../core/noise.js';
import {
  carrosserie, gyrophare, gerbe, majGerbe, projecteurRecherche,
} from '../vehicules.js';

/* --------------------------------------------------------------------------
   LA CONGERE ET SA BRANCHE.

   Sans elle, l'embardee du fuyard n'a AUCUNE cause visible : on verrait
   juste une voiture qui se met a zigzaguer plus fort, sans raison, ce qui
   se lit comme un bogue d'animation plutot qu'une decision de pilotage.
   Avec elle, la meme embardee se lit d'un coup d'oeil : il y a quelque
   chose sur la voie, et il l'evite.

   Une seule branche qui depasse suffit — c'est elle, pas le monticule
   lui-meme, qui donne l'echelle du danger. Un tas de neige seul se lirait
   comme une simple bosse du terrain.
   -------------------------------------------------------------------------- */
function congereBranche() {
  const g = new THREE.Group();
  const matNeige = new THREE.MeshStandardMaterial({ color: 0xE7F0F9, roughness: 0.86 });
  const matNeigeSale = new THREE.MeshStandardMaterial({ color: 0xC7D2DE, roughness: 0.9 });
  const matBois = new THREE.MeshStandardMaterial({ color: 0x2B2119, roughness: 0.92 });

  // Le monticule principal, aplati et allonge dans le sens de la voie :
  // une congere pousse par le vent n'est jamais un dome parfait.
  const monticule = new THREE.Mesh(new THREE.SphereGeometry(0.66, 9, 6), matNeige);
  monticule.scale.set(1.75, 0.52, 1.25);
  monticule.position.y = 0.30;
  g.add(monticule);

  // Un second amas plus petit, decale : deux volumes valent toujours mieux
  // qu'un seul pour eviter la lecture « ballon pose au sol ».
  const secondaire = new THREE.Mesh(new THREE.SphereGeometry(0.40, 8, 5), matNeigeSale);
  secondaire.scale.set(1.3, 0.6, 1.1);
  secondaire.position.set(0.55, 0.20, -0.35);
  g.add(secondaire);

  // La branche principale, qui depasse largement du monticule — c'est elle
  // qui doit se lire dans le cone des phares bien avant l'obstacle entier.
  const branche = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.10, 1.55, 6), matBois);
  branche.position.set(0.30, 0.42, 0.05);
  branche.rotation.z = 1.05;
  branche.rotation.y = 0.35;
  g.add(branche);

  // Deux ramifications plus fines : la silhouette d'une branche cassee
  // n'est jamais un seul baton, toujours un fouillis irregulier.
  const brindille1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.62, 5), matBois);
  brindille1.position.set(0.66, 0.62, 0.18);
  brindille1.rotation.z = 0.55;
  brindille1.rotation.y = -0.4;
  g.add(brindille1);
  const brindille2 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.42, 5), matBois);
  brindille2.position.set(0.44, 0.70, -0.10);
  brindille2.rotation.z = 1.5;
  brindille2.rotation.y = 0.7;
  g.add(brindille2);

  // Un peu de neige agrippee sur la branche elle-meme.
  const neigeBranche = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), matNeige);
  neigeBranche.scale.set(1.2, 0.6, 1.0);
  neigeBranche.position.set(0.50, 0.68, 0.10);
  g.add(neigeBranche);

  return g;
}

/* --------------------------------------------------------------------------
   LA GERBE DE L'EMBARDEE.

   Contrairement a la gerbe CONTINUE des roues (`gerbe()`/`majGerbe()`,
   partagee avec toutes les scenes de vehicules dans `vehicules.js`), celle-
   ci est un eclatement UNIQUE : des chunks de neige qui giclent du sommet
   du monticule au moment ou le fuyard le frole, retombent, et ne rejouent
   plus jusqu'au prochain passage. C'est exactement la meme technique que
   `gerbeDeSang()` dans `killbill.js` — une position tiree une fois par
   particule, relue chaque image en fonction du temps ecoule depuis le
   declenchement — appliquee ici a de la neige plutot qu'a un liquide.

   Elle est ajoutee comme ENFANT de l'obstacle plutot que du groupe
   principal : l'obstacle est deja repositionne chaque image dans le
   repere du groupe (voir plus bas), la gerbe herite donc gratuitement sa
   place sans calcul supplementaire — seule l'animation LOCALE, relative
   au sommet du monticule, reste a la charge de cette fonction.
   -------------------------------------------------------------------------- */
function gerbeEmbardee(n) {
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xE3ECF8, size: 0.15,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.position.y = 0.55;    // au sommet du monticule, la ou la roue le frole
  // Chaque chunk a sa propre direction de depart, tiree une fois pour
  // toutes — c'est ce desordre qui empeche l'eclatement de se lire comme
  // un motif regle plutot qu'un vrai impact.
  const dirs = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.55 + 0.10;
    return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
  });
  pts.userData = { pos, dirs, n };
  return pts;
}

/* `dtE` : le temps ecoule depuis le declenchement. La gerbe part vite,
   monte, puis retombe en parabole avant de s'eteindre — exactement le
   meme principe que les braises de la DeLorean ou le sang de Kill Bill,
   juste applique a un nuage de neige projetee. */
function majGerbeEmbardee(pts, dtE) {
  const { pos, dirs, n } = pts.userData;
  if (dtE > 1.05) { pts.material.opacity = 0; return; }
  for (let i = 0; i < n; i++) {
    const [dx, dy, dz] = dirs[i];
    const vol = Math.min(dtE, 0.85);
    pos[i * 3] = dx * vol * 2.7;
    pos[i * 3 + 1] = Math.max(-0.4, dy * vol * 2.3 - dtE * dtE * 2.5);
    pos[i * 3 + 2] = dz * vol * 2.7;
  }
  pts.geometry.attributes.position.needsUpdate = true;
  pts.material.opacity = Math.max(0, 1 - dtE * 0.85);
}

/* ==========================================================================
   LA COURSE-POURSUITE
   ========================================================================== */
export function coursePoursuite(chemin, relief, palier) {
  const g = new THREE.Group();
  g.userData.suitChemin = true;
  /* Lu par `ApparitionsSon.ouvrir()` pour decider de construire ou non un
     troisieme moteur : le son ne doit exister que pour ce qui se voit
     vraiment, jamais pour un vehicule que le palier bas a omis. */
  const renfortActif = palier.nom !== 'bas';
  g.userData.renfortActif = renfortActif;

  /* La voiture de tete est le SUJET : c'est elle qui porte le groupe, donc
     l'orientation, donc la source sonore. Le fuyard et le renfort sont
     places devant et derriere elle, sur la meme voie. */
  const police = carrosserie({
    teinte: 0x1B2432, bicolore: true, decal: true, pareChocsAvant: true,
  });
  g.add(police);
  const gyro = gyrophare(police);
  const projecteur = projecteurRecherche(police);
  const poussierePolice = gerbe(palier.nom === 'bas' ? 40 : 70);
  police.add(poussierePolice);

  /* LE RENFORT. Une seconde voiture d'intervention, plus sobre — pas de
     pare-chocs poussoir, pas de projecteur : c'est la voiture de tete qui
     traque, celle-ci se contente de suivre. Le seul palier bas l'omet :
     sur le materiel le plus modeste, deux vehicules bicolores et leurs
     gyrophares en plus du fuyard commencent a couter cher pour un gain
     que la resolution d'ecran, de toute facon, ne rendra pas. */
  const renfort = renfortActif
    ? carrosserie({ teinte: 0x1F2836, bicolore: true, decal: true, pareChocsAvant: false })
    : null;
  let gyroRenfort = null;
  let poussiereRenfort = null;
  if (renfort) {
    g.add(renfort);
    gyroRenfort = gyrophare(renfort);
    poussiereRenfort = gerbe(palier.nom === 'haut' ? 60 : 40);
    renfort.add(poussiereRenfort);
  }

  const fuyard = carrosserie({ teinte: 0x2A1418 });
  g.add(fuyard);
  const poussiereFuyard = gerbe(palier.nom === 'bas' ? 40 : 70);
  fuyard.add(poussiereFuyard);

  /* L'obstacle qui declenche l'embardee. Il vit dans le groupe comme le
     fuyard et le renfort : sa position MONDE est fixe, mais le groupe
     entier se deplace avec la voiture de tete, donc sa position LOCALE,
     elle, change a chaque image — voir plus bas. */
  const obstacle = congereBranche();
  g.add(obstacle);
  const debris = gerbeEmbardee(palier.nom === 'bas' ? 26 : 46);
  obstacle.add(debris);

  /* Les reperes de la course, en metres le long du chemin, comptes depuis
     le point d'ancrage de la scene. Le fuyard a vingt-deux metres d'avance
     sur la voiture de tete : assez pour qu'on lise deux vehicules
     distincts, assez peu pour qu'ils tiennent dans la meme image quand ils
     passent. Le renfort, lui, reste dix-huit metres EN RETRAIT — une vraie
     colonne d'intervention, pas trois voitures collees. */
  const DEPART = -125, ARRIVEE = 130, AVANCE = 22, RECUL_RENFORT = 18;
  const p = new THREE.Vector3(), c = new THREE.Vector3(), tan = new THREE.Vector3();

  /* La voie : les vehicules roulent A COTE du chemin, du cote utilisable du
     cadre, et jamais dessus — le cerf y marche. */
  /* MESURE : a six metres de voie, la voiture de police sortait par le bord
     gauche au moment ou elle double — moins zero virgule soixante-dix-huit
     a l'ecran, en portrait. Quatre metres et demi la ramenent dans le cadre
     sans qu'elle empiete sur le passage du cerf. */
  const VOIE = 4.5, COTE = -1;
  /* Le renfort roule tres legerement plus large que la tete : dans une
     poursuite reelle, la seconde voiture ne colle jamais exactement dans
     l'ornière de la premiere — elle a besoin de champ visuel pour reagir.
     Cet ecart, minuscule, est ce qui empeche les deux vehicules de se lire
     comme une seule voiture dupliquee quand ils sont visibles ensemble. */
  const DECALAGE_RENFORT = 0.65;

  /* LE POINT DE L'EMBARDEE, en k (progression de 0 a 1 sur le segment
     DEPART..ARRIVEE) : c'est la que la congere attend, et c'est la que le
     fuyard doit visiblement s'en ecarter. Place aux deux tiers du trajet
     visible : assez tot pour laisser le temps de reagir a l'ecran, assez
     tard pour que la voiture de tete l'ait deja doublee et regarde la
     scene se jouer devant elle plutot que de la manquer. */
  const K_EMBARDEE = 0.58;

  const placer = (objet, sVoiture, decalage, y0) => {
    const sc = clamp(sVoiture, 0, chemin.longueur);
    chemin.point(sc, p);
    chemin.cote(sc, c);
    chemin.tangente(sc, tan);
    const x = p.x + c.x * COTE * (VOIE + decalage);
    const z = p.z + c.z * COTE * (VOIE + decalage);
    objet.position.set(x, relief.hauteur(x, z) - y0, z);
    objet.rotation.y = Math.atan2(-tan.x, -tan.z);
    return objet.rotation.y;
  };

  let dernierS = 0;
  /* Les distances de l'image precedente, pour la vitesse radiale du
     doppler, et leur version lissee — une par vehicule suivi. */
  let dernierDp = 0, dernierDf = 0, dernierDr = 0;
  let lissP = 0, lissF = 0, lissR = 0;
  const _oreille = new THREE.Vector3(), _ici = new THREE.Vector3();

  /* L'embardee ne se joue qu'UNE fois par passage : sans ce garde-fou, le
     choc camera et le son de derapage se redeclencheraient a chaque image
     tant que la fenetre de l'embardee reste ouverte. `embardeeT` retient
     l'instant du declenchement, pour dater la gerbe de debris qui en
     decoule — le meme principe que `coup1T`/`coup2T` dans `killbill.js`. */
  let derapageFait = false, embardeeT = 0;
  g.userData.reinit = () => { derapageFait = false; debris.material.opacity = 0; };

  g.userData.jouer = (u, t, camera, sAncre, dt) => {
    /* LE PASSAGE NE DURE PAS TOUTE LA FENETRE. On les voit venir de loin,
       elles doublent, elles disparaissent — et il reste du silence avant et
       apres. Une poursuite qui dure vingt-cinq secondes cesse d'etre une
       poursuite. */
    const k = clamp((u - 0.18) / 0.46, 0, 1);
    const sPolice = sAncre + DEPART + k * (ARRIVEE - DEPART);
    const sFuyard = sPolice + AVANCE;
    const sRenfort = sPolice - RECUL_RENFORT;

    /* Elles n'existent que tant qu'elles sont en piste. Avant et apres, tout
       s'eteint — y compris le gyrophare, qui sinon battrait dans le vide au
       bout du chemin. */
    const enPiste = smoothstep(0, 0.06, k) * smoothstep(1, 0.94, k);
    g.visible = enPiste > 0.005;
    if (!g.visible) return;

    /* Le groupe porte la position de la voiture de tete. On garde ensuite
       tout en coordonnees du monde pour le fuyard, le renfort et
       l'obstacle : les voies ne sont pas paralleles quand le chemin
       tourne, et les rattacher rigidement ferait deraper tout le monde
       dans les virages. */
    placer(g, sPolice, 0, 0);
    police.position.set(0, 0, 0);
    police.rotation.set(0, 0, 0);

    /* --------------------------------------------------------------------
       L'EMBARDEE. Une impulsion triangulaire, breve, centree sur K_EMBARDEE
       — le fuyard s'ecarte fort puis revient, comme un vrai coup de volant
       plutot qu'un glissement continu. */
    const ECART_EMBARDEE = 0.055;
    const embardee = Math.max(0, 1 - Math.abs(k - K_EMBARDEE) / ECART_EMBARDEE);
    if (!derapageFait && embardee > 0.92) {
      derapageFait = true;
      embardeeT = t;
      g.userData.emettre?.('derapage');
    }
    if (derapageFait) majGerbeEmbardee(debris, t - embardeeT);

    /* Le fuyard, dans le repere du groupe. On calcule sa position du monde
       puis on la ramene : c'est le seul moyen qu'il suive vraiment la
       courbe du chemin. */
    g.updateMatrixWorld(true);
    const zig = Math.sin(t * 2.9) * 1.15 + embardee * 2.6;
    chemin.point(clamp(sFuyard, 0, chemin.longueur), p);
    chemin.cote(clamp(sFuyard, 0, chemin.longueur), c);
    chemin.tangente(clamp(sFuyard, 0, chemin.longueur), tan);
    const fx = p.x + c.x * COTE * (VOIE + zig);
    const fz = p.z + c.z * COTE * (VOIE + zig);
    fuyard.position.set(fx, relief.hauteur(fx, fz), fz);
    g.worldToLocal(fuyard.position);
    const capFuyard = Math.atan2(-tan.x, -tan.z);
    /* Le cap normal est une legere sinusoide de conduite ; l'embardee y
       ajoute un vrai coup de volant, dans le sens qui l'ecarte de la
       congere, puis un contre-braquage bref au moment ou elle revient
       vers sa voie — c'est ce contre-braquage qui vend le rattrapage. */
    const braquage = Math.sin(t * 2.9 + 0.4) * 0.13
      + embardee * 0.42 * Math.sign(Math.sin((k - K_EMBARDEE) * 40 + 0.001));
    fuyard.rotation.y = capFuyard - g.rotation.y + braquage;
    /* Il se couche dans ses embardees : une voiture qui zigzague a plat se
       lit comme un curseur qu'on fait glisser. L'embardee majeure la
       couche bien plus fort que le zigzag de croisiere. */
    fuyard.rotation.z = -Math.cos(t * 2.9) * 0.075 - embardee * 0.16;

    /* Le renfort, dans le repere du groupe, meme technique que le fuyard :
       position calculee en coordonnees du monde puis ramenee, pour suivre
       la courbe du chemin plutot que de deraper en ligne droite dedans. */
    if (renfort) {
      const sR = clamp(sRenfort, 0, chemin.longueur);
      chemin.point(sR, p);
      chemin.cote(sR, c);
      chemin.tangente(sR, tan);
      const rx = p.x + c.x * COTE * (VOIE + DECALAGE_RENFORT);
      const rz = p.z + c.z * COTE * (VOIE + DECALAGE_RENFORT);
      renfort.position.set(rx, relief.hauteur(rx, rz), rz);
      g.worldToLocal(renfort.position);
      renfort.rotation.y = Math.atan2(-tan.x, -tan.z) - g.rotation.y;
    }

    /* L'obstacle : sa position MONDE est fixe (calculee au meme point du
       chemin a chaque image, mais ce point ne depend que de `sAncre`, qui
       ne change jamais pendant la duree de la scene), et on la ramene dans
       le repere du groupe comme le reste. Il est plante droit devant la
       trajectoire NORMALE du fuyard (zig nul), pour que l'embardee se lise
       comme un evitement et non comme un mouvement gratuit. */
    const sObstacle = clamp(sAncre + DEPART + K_EMBARDEE * (ARRIVEE - DEPART) + AVANCE, 0, chemin.longueur);
    chemin.point(sObstacle, p);
    chemin.cote(sObstacle, c);
    chemin.tangente(sObstacle, tan);
    const ox = p.x + c.x * COTE * VOIE;
    const oz = p.z + c.z * COTE * VOIE;
    obstacle.position.set(ox, relief.hauteur(ox, oz), oz);
    g.worldToLocal(obstacle.position);
    obstacle.rotation.y = Math.atan2(-tan.x, -tan.z) - g.rotation.y;
    obstacle.visible = enPiste > 0.005;

    /* LA VITESSE. On la mesure sur le deplacement reel plutot que de la
       supposer : elle sert a faire tourner les roues au bon rythme et a
       doser la gerbe de neige, et une valeur devinee se voit tout de suite
       en patinage. */
    const vitesse = dt > 1e-4 ? Math.abs(sPolice - dernierS) / dt : 0;
    dernierS = sPolice;
    const tour = (vitesse * dt) / 0.36;      // rayon de roue
    const vehicules = renfort ? [police, fuyard, renfort] : [police, fuyard];
    for (const v of vehicules) {
      for (const r of v.userData.roues) r.rotation.x -= tour;
    }

    /* La gerbe de l'embardee est asymetrique et plus forte : c'est un
       fishtail, pas un simple nuage de plus. */
    const forceBase = enPiste * clamp(vitesse / 14, 0, 1);
    majGerbe(poussierePolice, dt, forceBase);
    majGerbe(poussiereFuyard, dt, Math.min(1, forceBase + embardee * 0.7));
    if (poussiereRenfort) majGerbe(poussiereRenfort, dt, forceBase);

    /* --------------------------------------------------------------------
       LE SON SUIT LA COURSE.

       Trois grandeurs sont transmises au moteur a chaque image, une par
       vehicule suivi :

       · LE REGIME, tire de la vitesse reelle. Il ouvre le filtre de corps
         bien plus qu'il ne monte la hauteur — c'est cette ouverture qui
         s'entend comme « il accelere » ;
       · LE DECALAGE DOPPLER, calcule a partir de la VITESSE RADIALE, c'est-
         a-dire de la vitesse a laquelle le vehicule se rapproche de
         l'oreille. Le Web Audio ne le fait plus depuis longtemps ; sans lui,
         un passage rapide sonne exactement comme un passage lent, et c'est
         justement le moment ou la scene doit exister.

       On lisse la vitesse radiale : mesuree image par image sur une camera
       qui tremble, elle sauterait, et un doppler qui saute s'entend comme
       un disque raye. */
    if (camera) {
      _oreille.setFromMatrixPosition(camera.matrixWorld);
      const dPolice = g.position.distanceTo(_oreille);
      const dFuyard = fuyard.getWorldPosition(_ici).distanceTo(_oreille);
      const dRenfort = renfort ? renfort.getWorldPosition(_ici).distanceTo(_oreille) : dPolice;
      if (dt > 1e-4 && dernierDp > 0) {
        const vrP = (dPolice - dernierDp) / dt;
        const vrF = (dFuyard - dernierDf) / dt;
        const vrR = (dRenfort - dernierDr) / dt;
        lissP += (vrP - lissP) * 0.18;
        lissF += (vrF - lissF) * 0.18;
        lissR += (vrR - lissR) * 0.18;
      }
      dernierDp = dPolice;
      dernierDf = dFuyard;
      dernierDr = dRenfort;
      /* Trois cent quarante metres par seconde : la vitesse du son. Le
         rapport est donc tres petit — de l'ordre de six pour cent a
         soixante-quinze a l'heure — et c'est pourtant parfaitement
         audible. On le borne, parce qu'un pic de mesure au moment ou la
         camera saute produirait un couac. */
      const dopP = clamp(-lissP / 340, -0.14, 0.14);
      const dopF = clamp(-lissF / 340, -0.14, 0.14);
      const dopR = clamp(-lissR / 340, -0.14, 0.14);
      const rg = clamp(vitesse / 24, 0, 1);
      const valeurs = [
        { regime: rg, doppler: dopP, volume: enPiste },
        { regime: rg * 1.12, doppler: dopF, volume: enPiste * (0.9 + embardee * 0.3) },
      ];
      if (renfort) valeurs.push({ regime: rg * 0.94, doppler: dopR, volume: enPiste * 0.72 });
      g.userData.emettre?.('regler', valeurs);
    }

    // Les phares et les feux.
    for (const v of vehicules) {
      for (const ph of v.userData.phares) ph.material.opacity = enPiste * 0.85;
      for (const co of v.userData.cones) co.material.opacity = enPiste * 0.30;
    }
    for (const f of police.userData.feux) f.material.opacity = enPiste * 0.5;
    if (renfort) for (const f of renfort.userData.feux) f.material.opacity = enPiste * 0.5;
    /* LE FUYARD FREINE PAR A-COUPS. Ses feux arriere s'allument franchement
       a chaque coup de frein : c'est le signal le plus lisible d'une
       poursuite, bien avant la vitesse elle-meme. L'embardee les fait
       flamber a plein : freiner devant un obstacle est le coup de frein le
       plus franc de toute la scene. */
    const frein = 0.35 + Math.pow(Math.max(0, Math.sin(t * 1.9)), 6) * 0.65;
    const freinTotal = Math.max(frein, embardee * 1.05);
    for (const f of fuyard.userData.feux) f.material.opacity = enPiste * Math.min(1, freinTotal);

    /* LE GYROPHARE DE TETE. L'alternance, pas le clignotement : chaque
       cote pulse deux fois vite puis passe la main. C'est ce rythme qu'on
       reconnait de loin, et c'est lui qu'il ne faut jamais toucher. */
    const cy = (t * 1.6) % 1;
    const cote = cy < 0.5;
    const bat = Math.pow(Math.abs(Math.sin(t * 19)), 0.6);
    const fB = cote ? bat : 0.06, fR = cote ? 0.06 : bat;
    gyro.bleu.material.opacity = enPiste * fB;
    gyro.rouge.material.opacity = enPiste * fR;
    gyro.rayonBleu.rotation.y = t * 2.6;
    gyro.rayonRouge.rotation.y = -t * 2.6 + Math.PI;
    gyro.rayonBleu.rotation.x = -0.05;
    gyro.rayonRouge.rotation.x = -0.05;
    gyro.rayonBleu.material.opacity = enPiste * (0.14 + fB * 0.28);
    gyro.rayonRouge.material.opacity = enPiste * (0.14 + fR * 0.28);

    /* LE GYROPHARE DU RENFORT. Meme rythme, mais DEPHASE d'un tiers de
       cycle : deux rampes qui clignotent en parfaite synchronie ne se
       voient jamais sur deux vehicules reels, chacun a sa propre horloge
       electronique. Le dephasage, seul, suffit a lire « deux voitures »
       plutot que « une voiture et son reflet ». */
    if (renfort && gyroRenfort) {
      const cyR = (t * 1.6 + 0.33) % 1;
      const coteR = cyR < 0.5;
      const batR = Math.pow(Math.abs(Math.sin(t * 19 + 2.1)), 0.6);
      const fBR = coteR ? batR : 0.06, fRR = coteR ? 0.06 : batR;
      gyroRenfort.bleu.material.opacity = enPiste * fBR;
      gyroRenfort.rouge.material.opacity = enPiste * fRR;
      gyroRenfort.rayonBleu.rotation.y = -t * 2.4 + 1.1;
      gyroRenfort.rayonRouge.rotation.y = t * 2.4 - 1.1 + Math.PI;
      gyroRenfort.rayonBleu.rotation.x = -0.05;
      gyroRenfort.rayonRouge.rotation.x = -0.05;
      gyroRenfort.rayonBleu.material.opacity = enPiste * (0.14 + fBR * 0.28);
      gyroRenfort.rayonRouge.material.opacity = enPiste * (0.14 + fRR * 0.28);
    }

    /* LE PROJECTEUR DE RECHERCHE. Il ne tourne pas en continu comme le
       gyrophare — il BALAIE, lentement, d'un cote a l'autre de l'axe de
       marche, comme un equipage qui cherche quelque chose devant lui
       plutot que d'annoncer sa presence. Une sinusoide lente et un peu
       irreguliere (deux frequences non multiples) evite qu'il se lise
       comme un mecanisme d'horlogerie. */
    projecteur.pivot.rotation.y = Math.sin(t * 0.55) * 0.34 + Math.sin(t * 0.21) * 0.12;
    projecteur.rayon.material.opacity = enPiste * 0.42;
    projecteur.eclat.material.opacity = enPiste * 0.7;
  };
  return g;
}
