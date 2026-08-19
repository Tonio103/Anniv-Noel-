import * as THREE from 'three';
import { lueurDiffuse } from '../../core/dot.js';
import { smoothstep } from '../../core/noise.js';
import { creerDuelliste, GARDES, ECHANGES } from '../encapuchonne.js';
import { piste } from '../humanoide.js';
import { halo, flaque, epouserLeSol } from './communs.js';

/* ==========================================================================
   4. LE DUEL DE SABRES

   J'avais ecrit ici que les duellistes etaient inutiles — « deux lames qui
   claquent dans le noir se passent d'acteurs ». L'image dit le contraire :
   sans personne pour les tenir, on ne lit pas un duel, on lit deux tubes
   fluorescents plantes dans la neige. Rien n'avancait, rien ne portait, et
   les deux halos ronds accroches au milieu des lames ne ressemblaient a
   aucun eclairage connu.

   Deux silhouettes ENCAPUCHONNEES corrigent tout cela, et elles sont le
   sujet le plus indulgent qui soit : une cape est un cone, un capuchon une
   sphere, et la nuit se charge du reste. On ne verra jamais un visage —
   c'est d'ailleurs comme cela que ces plans-la sont eclaires au cinema, a
   contre-jour de la lame.

   Trois choses font le duel, dans l'ordre :

   · les lames S'ECLAIRENT elles-memes, en long et non par un rond pose au
     milieu. Une lame de sabre est une source lineaire ;
   · la neige en dessous vire au vert et au rouge. C'est elle qui donne
     l'echelle et qui dit que ces lumieres sont dans le monde ;
   · ils AVANCENT et RECULENT. Une passe d'armes est un deplacement, pas un
     poignet qui tourne.
   ========================================================================== */

/* La lueur en long. Un rectangle additif dans le plan de la lame, avec le
   degrade doux au centre : la lame est une source LINEAIRE, et un halo rond
   pose sur son milieu ne ressemble a rien — ni a une lame, ni a une lampe. */
function halolame(couleur, longueur, largeur) {
  const mat = new THREE.MeshBasicMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    side: THREE.DoubleSide,
  });
  mat.color.setRGB(couleur[0], couleur[1], couleur[2]);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largeur, longueur), mat);
  m.renderOrder = 2;
  return m;
}

function lame(couleur, halos) {
  const g = new THREE.Group();
  const LONG = 1.15, R = 0.035;
  /* ANTOINE : « j'ai pas compris la reference au film Star Wars ». Le coeur
     de la lame etait blanc pur, quelle que soit l'arme — c'est le HALO
     seul qui portait la couleur, et un halo additif se noie facilement
     dans le blanc du posttraitement (bloom) ou de la neige environnante.
     Deux sabres qui different seulement par une lueur autour d'un meme
     coeur blanc se lisent comme « deux epees lumineuses », pas comme
     « vert contre rouge » — or c'est justement cette opposition de
     couleur, avant tout le reste, qui EST la reference. Le coeur porte
     donc lui-meme la teinte, adoucie vers le blanc pour garder l'aspect
     incandescent plutot qu'un simple baton peint. */
  const teinte = new THREE.Color(couleur).lerp(new THREE.Color(1, 1, 1), 0.32);
  const l = new THREE.Mesh(
    new THREE.CapsuleGeometry(R, LONG, 4, 8),
    new THREE.MeshBasicMaterial({ color: teinte })
  );
  l.position.y = LONG / 2 + 0.10;
  g.add(l);

  /* Deux plans croises plutot qu'un seul : de trois quarts, un plan unique
     disparait par la tranche et la lame perd sa lueur pile au moment ou
     elle se met de profil. Deux plans perpendiculaires ne peuvent jamais
     s'effacer ensemble. */
  /* LA LUEUR NE DOIT PAS DEBORDER SUR LE PORTEUR. Elle etait centree sur le
     milieu de la lame avec neuf decimetres de rab : elle descendait donc de
     trente-cinq centimetres SOUS la poignee, c'est-a-dire en plein sur la
     poitrine du duelliste, qu'elle repeignait en vert fluo ou en rouge vif
     par-dessus. Une lame eclaire celui qui la tient, mais par un reflet, pas
     en le badigeonnant. On la remonte pour qu'elle parte de l'emetteur, et
     on l'affine. */
  const halosLame = [];
  for (const a of [0, Math.PI / 2]) {
    const h = halolame(halos, LONG + 0.42, 0.50);
    h.position.y = LONG / 2 + 0.24;
    h.rotation.y = a;
    g.add(h);
    halosLame.push(h);
  }
  // Un rond a la pointe : c'est la ou la lumiere se concentre vraiment.
  const pointe = halo(halos, 0.95);
  pointe.position.y = LONG + 0.12;
  pointe.material.opacity = 0;
  g.add(pointe);

  const poignee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.028, 0.20, 6),
    new THREE.MeshStandardMaterial({ color: 0x2A2E36, roughness: 0.5, metalness: 0.6 })
  );
  g.add(poignee);
  g.userData.halos = [...halosLame, pointe];
  g.userData.lame = l;
  return g;
}

export function duelSabres(palier) {
  const g = new THREE.Group();

  /* Les deux camps se font face le long de X, donc de part et d'autre du
     chemin. Le personnage regarde vers -Z : viser +X demande un quart de
     tour negatif, viser -X un quart de tour positif. */
  /* Un metre trente-cinq entre eux, pas davantage : le duel est une scene
     LARGE, et en portrait chaque metre d'envergure coute un degre de champ
     qu'on n'a pas. Serres, ils tiennent tous les deux dans le cadre — et un
     duel a bout portant est de toute facon plus tendu qu'un duel a distance
     respectueuse. */
  const ECART = 1.35;
  const TVERT = [0.30, 3.1, 0.55], TROUGE = [3.1, 0.28, 0.22];
  const gauche = creerDuelliste(palier, TVERT);
  gauche.position.x = -ECART;
  gauche.rotation.y = -Math.PI / 2;
  const droite = creerDuelliste(palier, TROUGE);
  droite.position.x = ECART;
  droite.rotation.y = Math.PI / 2;
  g.add(gauche, droite);

  const vert = lame(0x8CFF7A, TVERT);
  const rouge = lame(0xFF6A5A, TROUGE);
  /* La lame prolonge le POING, et se greffe donc sur l'os de la main : tout
     ce que fait l'epaule se propage jusqu'a la pointe, ce qui est la seule
     facon qu'une passe d'armes parte du corps et non du poignet. */
  vert.rotation.x = -0.35;
  rouge.rotation.x = -0.35;
  vert.position.y = -0.04;
  rouge.position.y = -0.04;
  gauche.userData.os.mainD.add(vert);
  droite.userData.os.mainD.add(rouge);

  /* LES ECHANGES CHANGENT D'UNE PASSE A L'AUTRE.

     Antoine : « toujours la meme attaque de sabre ». C'etait exact — une
     seule suite de trois poses tournait en boucle, et au bout de deux
     passes on avait tout vu. Le repertoire compte maintenant quatre
     echanges (voir `encapuchonne.js`) : la botte droite, le coup haut
     abattu par-dessus la garde, le revers remontant, et le corps a corps ou
     les deux lames restent bloquees.

     On construit les pistes UNE FOIS a la creation, et l'on choisit
     laquelle jouer selon le numero de la passe. Les reconstruire a chaque
     image couterait quatre objets par image pour rien.

     L'ordre est FIXE et non tire au hasard : deux visites de la balade
     doivent montrer la meme scene, sans quoi plus rien n'est verifiable a
     l'image. */
  const tempsCles = [0.00, 0.40, 0.56, 0.86, 1.00];
  const construire = (noms) => piste(
    [...noms, noms[noms.length - 1]].map((n, i) => ({ t: tempsCles[i], pose: GARDES[n] }))
  );
  const pistes = ECHANGES.map((e) => ({
    attaquant: construire(e.attaquant),
    pare: construire(e.pare),
  }));

  const eclat = halo([2.8, 3.0, 2.6], 3.2);
  eclat.position.set(0, 1.55, 0);
  g.add(eclat);

  /* LA NEIGE PREND LA COULEUR DES LAMES. C'est ce qui manquait le plus :
     deux sources aussi vives, dans un sous-bois enneige, ne peuvent pas
     laisser le sol gris. Les flaques epousent le relief, comme celles du
     gyrophare. */
  const solVert = flaque([0.06, 1.5, 0.20], 7, 0.8);
  const solRouge = flaque([1.5, 0.05, 0.05], 7, 0.8);
  solVert.position.x = -ECART;
  solRouge.position.x = ECART;
  g.add(solVert, solRouge);
  g.userData.poser = (relief) => {
    epouserLeSol(solVert, relief, 0.10);
    epouserLeSol(solRouge, relief, 0.11);
  };

  /* Le numero de la passe d'armes en cours : il sert a ne declencher le
     choc sonore QU'UNE FOIS par passe. Le pic dure cinq images environ, et
     sans ce garde-fou on entendrait cinq chocs colles bout a bout. */
  let dernierePasse = -1;

  g.userData.jouer = (u, t) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    /* Les passes d'armes : ils se rapprochent, les lames claquent, ils se
       separent. Le rythme est ce qui fait « duel » plutot que « deux batons
       qui bougent ». */
    const passe = (t * 1.25) % 1;
    const choc = Math.pow(Math.max(0, 1 - Math.abs(passe - 0.5) * 5), 2);
    const numero = Math.floor(t * 1.25);
    if (choc > 0.55 && numero !== dernierePasse) {
      dernierePasse = numero;
      // Le son part au moment ou les lames se touchent, pas avant.
      if (vis > 0.2) g.userData.emettre?.('choc');
    }

    /* LE PAS. Un duelliste avance sur la passe et recule apres : c'est ce
       deplacement du CORPS qui fait la difference entre un combat et deux
       poignets. Il est volontairement ample — a vingt-cinq metres, dix
       centimetres ne se voient pas. */
    const pas = choc * 0.62;
    gauche.position.x = -ECART + pas;
    droite.position.x = ECART - pas;
    // Ils se penchent dans l'echange, puis se redressent.
    gauche.rotation.z = -choc * 0.16;
    droite.rotation.z = choc * 0.16;

    /* LE CORPS ENTIER JOUE LA PASSE. La piste enchaine les poses sur seize
       os ; l'ancienne version ne bougeait qu'une epaule, et c'est pour cela
       qu'on voyait deux batons plutot que deux escrimeurs.

       ET C'EST UN ECHANGE DIFFERENT A CHAQUE FOIS. On alterne aussi QUI
       attaque : sans cela, l'un porterait tous les coups et l'autre ne
       ferait que reculer, ce qui n'est pas un duel mais une correction. */
    const choix = pistes[((numero % pistes.length) + pistes.length) % pistes.length];
    const gaucheAttaque = (numero & 1) === 0;
    (gaucheAttaque ? choix.attaquant : choix.pare)(gauche.userData.os, passe);
    (gaucheAttaque ? choix.pare : choix.attaquant)(droite.userData.os, passe);

    /* La cape suit le mouvement avec un temps de retard — un tissu lourd ne
       part jamais en meme temps que le corps qui le porte. */
    for (const [d, sens] of [[gauche, 1], [droite, -1]]) {
      const a = d.userData.attacheCape;
      if (a) {
        a.rotation.x = -choc * 0.28;
        a.rotation.z = sens * Math.sin(t * 1.7) * 0.05;
      }
    }

    const eclatLame = 0.52 + choc * 0.26;
    for (const h of vert.userData.halos) h.material.opacity = vis * eclatLame;
    for (const h of rouge.userData.halos) h.material.opacity = vis * eclatLame;
    eclat.material.opacity = vis * choc * 0.9;

    /* Les flaques palpitent avec l'echange : au contact, tout le sous-bois
       s'allume d'un coup. */
    const bat = 0.55 + choc * 0.45;
    solVert.material.opacity = vis * bat * 0.34;
    solRouge.material.opacity = vis * bat * 0.34;
  };
  return g;
}
