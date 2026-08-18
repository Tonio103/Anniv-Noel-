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
import { lueurDiffuse, grainRond, tacheDouce } from '../core/dot.js';
import { smoothstep, clamp } from '../core/noise.js';
import {
  REPERES, piste, appliquerPose, regarderVers, construireCorps, nouvelleInstance,
} from './humanoide.js';
import { creerSpider, POSES } from './spider.js';
import { creerDuelliste, GARDES, ECHANGES } from './encapuchonne.js';
import { coursePoursuite, delorean } from './vehicules.js';
import { trouNoir, killBill, shining } from './cinema.js';
import { creerTrex, marcheTrex } from './trex.js';
import { creerCerf } from '../deer/deerMesh.js';

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

/* --- LA LUMIERE QUI TOMBE SUR LA NEIGE -----------------------------------

   Une flaque additive posee a plat sur le sol. C'est un truc de theatre, et
   c'est le bon : on veut que la neige AUTOUR du gyrophare batte en bleu et
   en rouge, or ajouter deux vraies lampes a la scene ferait recompiler tous
   les nuanceurs du monde au moment ou la fenetre s'ouvre — donc un a-coup
   franc, exactement la ou l'on regarde. Une flaque ne coute rien, ne
   recompile rien, et rend le meme service a vingt metres.

   Elle est legerement surelevee : posee pile au sol, elle se battrait avec
   le terrain en combat de profondeur et clignoterait. */
function flaque(couleur, taille, trou = 0) {
  /* LE TROU AU MILIEU N'EST PAS UNE COQUETTERIE.

     Une flaque pleine posee douze centimetres au-dessus du sol TRAVERSE ce
     qui se tient dessus : la roue de la voiture, l'ourlet de la cape. Le
     plan gagne le test de profondeur partout ou il passe devant la surface,
     et l'on obtient un lisere fluorescent au bas du personnage — deux
     duellistes en jupe de fete verte et rouge, ce qui n'etait pas l'effet
     recherche.

     Un anneau regle la chose une fois pour toutes, et il est en plus
     physiquement juste : ce qui produit la lumiere se fait de l'ombre
     juste en dessous de lui.

     Le maillage est SUBDIVISE dans les deux sens — il doit epouser le
     terrain, ce qu'un quadrilatere de deux triangles ne peut pas faire. */
  const geo = trou > 0
    ? new THREE.RingGeometry(trou, taille / 2, 28, 6)
    : new THREE.PlaneGeometry(taille, taille, 12, 12);
  geo.rotateX(-Math.PI / 2);
  /* LA LUEUR RONDE NE CONVIENT PAS ICI, ET C'EST MESURE. Son profil tombe a
     treize pour cent a mi-rayon : etalee sur quinze metres, elle ne peint
     donc reellement que les trois metres du centre — lesquels sont caches
     par la voiture elle-meme. On lui prefere la tache douce, qui tient
     encore quarante-quatre pour cent aux sept dixiemes du rayon : c'est
     elle qui donne une VRAIE flaque, large et franche. */
  const mat = new THREE.MeshBasicMaterial({
    map: tacheDouce(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  mat.color.setRGB(couleur[0], couleur[1], couleur[2]);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.12;
  m.renderOrder = 1;
  return m;
}

/* --- EPOUSER LE SOL ------------------------------------------------------

   UN PLAN POSE A PLAT NE MARCHE PAS, ET C'EST MESURABLE.

   Une flaque de gyrophare de quinze metres, posee douze centimetres
   au-dessus de l'origine de la voiture, disparaissait entierement : le
   terrain monte de plus de deux metres sur cette distance, donc la moitie
   du disque etait ENTERREE et l'autre moitie flottait. Les trainees de la
   DeLorean, longues de vingt-six metres, avaient exactement le meme sort —
   d'ou les deux traits maigres qu'on voyait au lieu de deux coulees de feu.

   La correction consiste a relever chaque sommet a la hauteur reelle du sol
   sous lui. C'est un calcul unique, fait au montage : ces decors ne bougent
   jamais.

   Une hypothese, et elle est verifiee partout ici : les apparitions ne
   subissent que des rotations autour de Y et aucune mise a l'echelle. La
   hauteur d'un sommet dans le monde vaut donc sa hauteur locale plus celle
   de son objet, sans autre terme — ce qui rend l'operation exacte et, au
   passage, idempotente. */
const _sommet = new THREE.Vector3();
function epouserLeSol(mesh, relief, marge) {
  mesh.updateWorldMatrix(true, false);
  const yMonde = mesh.matrixWorld.elements[13];
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    _sommet.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    p.setY(i, relief.hauteur(_sommet.x, _sommet.z) + marge - yMonde);
  }
  p.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
}

/* --- LE FAISCEAU ---------------------------------------------------------

   Un cone additif, sombre a sa base et clair a sa pointe. L'astuce tient a
   la couleur par sommet : en addition, le noir n'ajoute rien, donc un
   degrade vers le noir EST un degrade vers la transparence — sans texture,
   sans tri de transparence, sans le moindre cout.

   C'est ce qui donne l'impression que l'air est charge de neige : un
   gyrophare dans une nuit claire ne montre que sa lampe, un gyrophare dans
   une nuit chargee balaie des rayons visibles. */
function faisceau(couleur, longueur, ouverture) {
  const geo = new THREE.ConeGeometry(ouverture, longueur, 14, 6, true);
  /* La pointe du cone est en +Y : on la ramene a l'origine, puis on couche
     l'axe vers -Z pour que le faisceau parte du projecteur vers l'avant.
     Le sens de cette rotation n'est pas indifferent — avec l'autre, la base
     part vers +Z et le degrade se calcule a l'envers, ce qui donne un cone
     brillant au loin et noir a la lampe. */
  geo.translate(0, -longueur / 2, 0);
  geo.rotateX(Math.PI / 2);

  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    /* z va de 0 (la lampe) a -longueur (le bout) : on s'eteint en chemin.
       L'exposant est fort a dessein — c'est lui qui evacue le bout du cone,
       la ou son arete triangulaire se verrait le plus. */
    const k = Math.max(0, 1 + pos.getZ(i) / longueur);
    const f = Math.pow(k, 2.9);
    cols[i * 3] = couleur[0] * f;
    cols[i * 3 + 1] = couleur[1] * f;
    cols[i * 3 + 2] = couleur[2] * f;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, fog: true,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
}


/* ==========================================================================
   2. SPIDER-MAN

   Il apparait TROIS fois — c'est le seul a qui ce fichier accorde ce
   privilege, et c'est assume : Antoine dit qu'il l'aime beaucoup.

   ANTOINE : « on dirait un personnage Roblox ». C'etait vrai, et le defaut
   etait structurel : le personnage etait fait de capsules posees cote a cote,
   et la ou deux tubes se rencontrent, on voit deux tubes qui se rencontrent.
   Il vient desormais de `humanoide.js` — une seule peau continue extraite
   d'un champ implicite, avec de vrais deltoides, un vrai resserrement a la
   taille, de vrais mollets — et de `spider.js`, qui lui pose son costume, sa
   toile dessinee dans le nuanceur et ses yeux.

   Ce qui reste ici, c'est la MISE EN SCENE : ou il est, ce qu'il fait, et
   dans quel ordre. Chaque apparition est ecrite comme une petite sequence de
   poses cles datees, pas comme une pile de sinusoides reglees a la main.
   ========================================================================== */

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

/* Tendre un fil entre deux points donnes dans le repere du groupe. Le
   cylindre est bati le long de +Y et centre sur son milieu : on le pose au
   milieu du segment, on l'oriente, on l'etire. C'est la seule facon
   d'obtenir un fil qui reste accroche a une main qui bouge. */
const _AXE_Y = new THREE.Vector3(0, 1, 0);
const _milieu = new THREE.Vector3();
const _delta = new THREE.Vector3();
function tendreFil(m, a, b) {
  _milieu.addVectors(a, b).multiplyScalar(0.5);
  _delta.subVectors(b, a);
  const l = _delta.length();
  if (l < 1e-4) { m.visible = false; return; }
  m.visible = true;
  m.position.copy(_milieu);
  m.scale.set(1, l, 1);
  m.quaternion.setFromUnitVectors(_AXE_Y, _delta.divideScalar(l));
}

/* LA BRANCHE D'ACCROCHE.

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
   l'absence de branche. */
/* SECONDE CORRECTION. Antoine, encore : « le premier Spider-Man flotte
   toujours dans le vide ». La premiere reponse — une touffe d'aiguilles au
   bout d'un baton d'un metre — restait un petit objet flottant, pas un
   arbre : le degagement de 5,5 m autour de la pose (voir `planApparitions`)
   retire justement tout ce qui aurait pu convaincre autour de lui.
   Cette fois la scene porte un arbre COMPLET, du sol jusqu'a la ramure,
   pose a cote du personnage — pas un accessoire suspendu au-dessus de lui.

   Le tronc n'est PAS ajoute au pivot qui fait tourner et se balancer le
   personnage : un tronc qui pivote ou se souleve du sol a chaque balancement
   se voit immediatement, bien plus qu'un fil sans attache. Il est donc fixe
   dans le groupe, immobile ; seule une petite touffe D'EXTREMITE, ajoutee
   au pivot avec le fil, suit le balancement — comme la pointe souple d'une
   vraie branche, quand le tronc, lui, ne bouge pas. */
function troncAccroche() {
  const g = new THREE.Group();
  const matBois = new THREE.MeshStandardMaterial({ color: 0x2B2119, roughness: 0.95 });
  const matAiguilles = new THREE.MeshStandardMaterial({
    color: 0x3D6354, roughness: 0.92, side: THREE.DoubleSide,
  });
  const matNeige = new THREE.MeshStandardMaterial({ color: 0xE7F0F9, roughness: 0.82 });

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
   le balancement — voir `spiderSuspendu`. */
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
  return g;
}

/* ==========================================================================
   SPIDER-MAN, PREMIER PASSAGE : SUSPENDU LA TETE EN BAS

   La pose la plus reconnaissable du personnage, et de loin la plus facile a
   rater : accroche par un pied, l'autre jambe repliee, les bras qui pendent
   vers le sol.

   LA SCENE EST ECRITE COMME UN PLAN DE FILM, en quatre temps :

     il pend et tourne lentement  →  il vous repere et s'immobilise
       →  il vous salue  →  il reprend sa derive

   Chaque temps est une pose cle datee ; la piste les enchaine avec une
   acceleration et une deceleration, parce qu'un passage a vitesse constante
   d'une pose a l'autre se lit immediatement comme une machine.
   ========================================================================== */
function spiderSuspendu(palier) {
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

  const os = perso.userData.os;
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

    // Il se balance doucement, et tourne un peu sur lui-meme.
    pivot.rotation.z = Math.sin(t * 1.15) * 0.15;
    /* La rotation propre s'ARRETE quand il vous a vu : on ne detaille pas
       quelqu'un qui tourne sur lui-meme, et surtout, un regard qui suit
       pendant que le corps pivote se lit comme un decrochage de nuque. */
    const attention = smoothstep(0.20, 0.36, u) * smoothstep(0.94, 0.82, u);
    pivot.rotation.y = Math.sin(t * 0.52) * 0.85 * (1 - attention);
    regarderVers(perso, os, camera, attention);
  };
  return g;
}

/* ==========================================================================
   SPIDER-MAN, SECOND PASSAGE : EN PLEIN BALANCEMENT

   Il traverse au-dessus du chemin, suspendu a un fil, et lance le suivant a
   mi-course. Ce second tir n'est pas un ornement : sans lui on voit un homme
   pendu a une corde qui oscille, avec lui on voit quelqu'un qui SE DEPLACE
   — la difference tient a un fil de plus.
   ========================================================================== */
function spiderBalance(porteeX, palier) {
  const g = new THREE.Group();
  const ancre = new THREE.Group();       // le point d'accroche, en hauteur
  const perso = creerSpider(palier, { ombres: palier.ombres });

  /* LE FIL PARTAIT DANS LE MAUVAIS SENS. Il montait de l'ancre vers le ciel
     pendant que le personnage pendait dessous, sans rien qui les relie :
     un homme en vol plane sous une corde tendue vers rien. Il descend
     desormais de l'ancre jusqu'a la main levee, ce qui est le seul montage
     qui se tienne. */
  const LONGUEUR = 3.4;
  const fil = filDeToile(LONGUEUR);
  fil.position.y = -LONGUEUR / 2;
  ancre.add(fil);

  /* Le poignet leve se trouve a `epaule + humerus + radius` au-dessus des
     pieds. C'est une constante CALCULEE a partir des reperes du corps,
     jamais un nombre ajuste a vue : le jour ou l'on rallonge un bras, la
     main reste accrochee a son fil.

     ELLE ETAIT DEVENUE « NON DEFINI ». Le corps ne decrivait plus ses bras
     par la HAUTEUR de leurs articulations mais par la LONGUEUR de leurs
     segments — la pose de liaison en « A » l'imposait — et deux reperes
     disparus laissaient ici un calcul valant NaN. Le personnage partait
     alors a une position invalide, ce qui contaminait sa matrice monde,
     donc la position de sa source sonore, et le Web Audio refusait un
     parametre non fini. Un metre de trop dans un fil se voit ; une position
     invalide se manifeste trois modules plus loin, par une erreur qui ne
     parle de rien. */
  const POIGNET = REPERES.epaule + REPERES.humerus + REPERES.radius;
  perso.position.y = -LONGUEUR - POIGNET;
  ancre.add(perso);
  g.add(ancre);
  ancre.position.y = 7.6;

  const os = perso.userData.os;
  const sequence = piste([
    { t: 0.00, pose: POSES.balance },
    { t: 0.40, pose: POSES.balance },
    { t: 0.56, pose: POSES.arme },
    { t: 0.64, pose: POSES.lance },
    { t: 0.82, pose: POSES.balance },
    { t: 1.00, pose: POSES.balance },
  ]);

  const tir = filDeToile(1);          // longueur pilotee par l'etirement
  tir.visible = false;
  g.add(tir);
  /* Le point vers lequel il lance son fil suivant. Il est DEVANT lui dans
     le sens de la marche : un fil lance vers l'arriere le ferait freiner. */
  const ACCROCHE = new THREE.Vector3(-porteeX * 0.7, 13.0, -46);
  const _poignet = new THREE.Vector3();
  const _bout = new THREE.Vector3();

  let tirFait = false;
  g.userData.reinit = () => { tirFait = false; };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.08, u) * smoothstep(1, 0.90, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    sequence(os, u);

    /* IL SE BALANCAIT SUR PLACE, ET C'ETAIT LE VRAI DEFAUT.

       Antoine : « je veux que le dernier Spider-Man se balance enfin, qu'il
       bouge vraiment ». L'ancienne version faisait osciller le personnage
       autour d'un point d'accroche FIXE : il allait de gauche a droite et
       revenait, sans jamais avancer d'un metre. On regardait un pendule,
       pas quelqu'un qui se deplace — et se deplacer est tout ce que ce
       personnage sait faire.

       Il TRAVERSE desormais : son point d'accroche remonte la scene sur
       cinquante-quatre metres pendant qu'il pendule dessous, si bien qu'il
       arrive de derriere, passe au-dessus du chemin et file devant. Le
       balancement se fait dans le plan de la marche — d'arriere en avant
       sous l'ancre — et non plus lateralement : c'est ainsi qu'un pendule
       porte celui qui s'y accroche.

       Il louvoie tout de meme un peu de cote, parce qu'une trajectoire
       rigoureusement rectiligne se lit comme un rail. */
    const av = clamp((u - 0.10) / 0.78, 0, 1);
    ancre.position.z = 27 - av * 54;
    ancre.position.x = Math.sin(av * Math.PI * 1.6) * porteeX * 0.42;

    /* Le pendule : trois arcs sur la traversee, vite au point bas et lent
       aux extremites. Un deplacement lineaire se lirait comme un panneau
       qu'on tire sur un rail. */
    const a = Math.sin(av * Math.PI * 3.0) * 1.0;
    ancre.rotation.x = a * 0.62;
    ancre.rotation.z = Math.cos(av * Math.PI * 1.6) * 0.22;
    /* Il monte au point haut de chaque arc et redescend au point bas : c'est
       ce qui distingue un vol plane d'un balancement. */
    /* SEPT METRES SOIXANTE, PAS NEUF DEUX. Mesure au format du telephone :
       a neuf metres d'accroche, sa tete passait a plus de sept metres du sol
       et sortait par le haut du cadre au moment ou il est le plus pres —
       c'est-a-dire au seul moment ou l'on voudrait le voir. */
    ancre.position.y = 7.6 + Math.abs(a) * 1.5;
    /* Le corps se redresse au point bas et se couche aux extremites : c'est
       ce qu'un pendule vivant fait de son bassin, et c'est ce qui empeche la
       silhouette de rester raide comme un pendu. */
    perso.rotation.x = -0.30 + Math.abs(a) * 0.28;
    perso.rotation.z = -ancre.rotation.z * 0.5;

    /* Il se retourne vers vous au passage le plus bas — le seul instant ou
       il est assez pres pour que ca se voie. */
    regarderVers(perso, os, camera,
      smoothstep(0.28, 0.42, u) * smoothstep(0.80, 0.66, u));

    if (!tirFait && u > 0.60) { tirFait = true; g.userData.emettre?.('toile'); }

    const sortie = smoothstep(0.60, 0.70, u);
    if (sortie > 0.01) {
      /* La position du poignet, prise dans le repere du groupe. On force la
         mise a jour de la branche concernee : les matrices du monde ne sont
         recalculees qu'au moment du rendu, donc sans cela le fil accuserait
         une image de retard — visible, sur un mouvement aussi rapide. */
      ancre.updateWorldMatrix(true, true);
      _poignet.set(0, 0, 0);
      os.mainD.localToWorld(_poignet);
      g.worldToLocal(_poignet);
      /* Le fil ne jaillit pas d'un coup sur toute sa longueur : il PART de
         la main et file vers son point d'accroche. */
      _bout.lerpVectors(_poignet, ACCROCHE, sortie);
      tendreFil(tir, _poignet, _bout);
    } else {
      tir.visible = false;
    }
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

function etDevantLaLune(chemin) {
  const g = new THREE.Group();

  /* SA PROPRE LUNE, ET C'EST UNE DECISION MESUREE.

     L'idee de depart etait de faire passer la silhouette devant la vraie
     lune du ciel. Mesure faite le long de tout le chemin : la lune est dans
     une direction FIXE du monde, le chemin serpente, et l'ecart entre l'axe
     de la camera et la lune ne descend jamais sous 30° — bien au-dela du
     champ, surtout en portrait, et l'eclat de la vraie lune (un lobe
     specular a la puissance soixante-deux dans le nuanceur du ciel) s'y
     eteint de toute facon completement. Elle n'est donc JAMAIS visible
     pendant la balade. Une silhouette noire sur un ciel noir n'aurait rien
     donne.

     La scene porte donc son propre disque, pose devant la camera. */
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

  g.userData.suitCamera = true;

  /* ANTOINE, DEUX FOIS : « la lune bouge toujours avec la camera, et en
     plus ca fait deux lunes ». Le premier correctif figeait la position au
     moment ou la fenetre s'ouvre — mais il la calculait a partir de la
     direction INSTANTANEE de la camera a cet instant precis, et cet
     instant tombe parfois pendant une transition (approche d'une halte,
     ajustement du cadrage) ou cette direction n'est pas stable d'une image
     a l'autre. Un simple decalage d'une image dans le declenchement du gel
     suffit alors a figer la lune a un endroit legerement different a
     chaque essai — ce qui, revu comme un « saut », se lit comme deux lunes
     distinctes plutot qu'une derive.

     LA VRAIE CORRECTION : ne plus jamais interroger la camera pour
     PLACER la lune. On se sert du CHEMIN — fixe, connu d'avance, identique
     a chaque image — pour batir un repere stable a l'endroit ou la scene
     s'ouvre, une fois pour toutes. La camera ne sert plus qu'a orienter le
     disque face a elle (un panneau plat vu de travers se lit comme une
     lame) et a le faire naitre au bon moment ; plus jamais a le DEPLACER. */
  const p = new THREE.Vector3(), tan = new THREE.Vector3(), cote = new THREE.Vector3();
  let calcule = false;
  const posLune = new THREE.Vector3();
  g.userData.reinit = () => { calcule = false; };

  g.userData.jouer = (u, t, camera, sAncre) => {
    const vis = smoothstep(0, 0.16, u) * smoothstep(1, 0.80, u);
    disque.material.opacity = vis * 0.55;
    velo.material.opacity = vis * 0.98;
    g.visible = vis > 0.01;
    if (!camera) return;

    if (!calcule) {
      /* Devant l'axe general du chemin a cet endroit, haut dans le ciel,
         assez loin pour etre derriere toute la foret : la silhouette doit
         se detacher sur le disque, jamais sur des branches. */
      chemin.point(sAncre, p);
      chemin.tangente(sAncre, tan);
      chemin.cote(sAncre, cote);
      const D = 265;
      posLune.copy(p).addScaledVector(tan, D).addScaledVector(cote, -50);
      /* HAUTEUR MESUREE, PAS DEVINEE. A 62 m pour 240 de distance, cela
         faisait 14,5° d'elevation — et comme le drone pique legerement vers
         le cerf, le disque sortait par le haut du cadre. A 34 m pour 265,
         on est a 7,3°, ce qui le pose au-dessus de la ligne d'arbres sans
         jamais toucher le bord. Le drone vole une dizaine de metres
         au-dessus du chemin : on part donc de la hauteur DU CHEMIN, pas de
         celle, instable, de la camera. */
      posLune.y = p.y + 39;
      calcule = true;
    }
    g.position.copy(posLune);
    g.lookAt(camera.position);

    /* LA BOUCLE. Antoine : « je veux qu'elle exerce une boucle ». Le velo
       ne faisait que GLISSER a plat devant le disque ; le plan du film,
       lui, est un bond — la roue avant se souleve, l'engin monte, retombe.
       Meme course horizontale qu'avant (le disque mesure cinquante-huit
       unites de large, son coeur clair une quinzaine ; vingt-six fait
       traverser le velo devant l'astre lui-meme), mais desormais avec une
       vraie trajectoire d'arc par-dessus, et le cadre qui suit l'inclinaison
       du saut. */
    const av = clamp(u, 0, 1);
    const arc = Math.sin(av * Math.PI);
    velo.position.set((av - 0.5) * 26, 1.4 + arc * 4.2, 1);
    velo.rotation.z = (0.5 - av) * 0.9;
  };
  return g;
}

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

function duelSabres(palier) {
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

/* ==========================================================================
   5. LA DELOREAN

   Elle est deja partie : il ne reste que les deux trainees de feu sur la
   neige, qui s'allument et s'eteignent. C'est LA façon de citer ce film sans
   modeliser une voiture — le plan de fin ne montre lui-meme que ca.
   ========================================================================== */
/* La matiere du feu au sol. La lueur ronde partagee ne convient PAS ici :
   son profil radial, etire sur une bande de vingt-six metres, ne laisse
   qu'un mince filament clair au milieu et du noir partout ailleurs — ce
   qu'on voyait, deux rayures palottes sur la neige. Il faut un degrade qui
   ne s'eteigne que dans la LARGEUR et reste plein sur toute la longueur,
   avec un coeur presque blanc borde d'orange : un pneu qui a brule laisse
   une marque chaude au centre et rougeoyante sur les bords. */
let _braise = null;
function texturebraise() {
  if (_braise) return _braise;
  const l = 8, h = 128;
  const cv = document.createElement('canvas');
  cv.width = l; cv.height = h;
  const c = cv.getContext('2d');
  const d = c.createLinearGradient(0, 0, l, 0);
  d.addColorStop(0.00, 'rgba(255,110,20,0)');
  d.addColorStop(0.22, 'rgba(255,140,40,0.55)');
  d.addColorStop(0.46, 'rgba(255,225,170,1)');
  d.addColorStop(0.54, 'rgba(255,225,170,1)');
  d.addColorStop(0.78, 'rgba(255,140,40,0.55)');
  d.addColorStop(1.00, 'rgba(255,110,20,0)');
  c.fillStyle = d;
  c.fillRect(0, 0, l, h);
  _braise = new THREE.CanvasTexture(cv);
  _braise.colorSpace = THREE.SRGBColorSpace;
  return _braise;
}

function traineesDeFeu(longueur, palier, relief) {
  const g = new THREE.Group();

  /* LA VOITURE ELLE-MEME, QUI MANQUAIT.

     Antoine : « il y a Retour vers le futur, ameliore-la ». Il n'y avait que
     les deux trainees de feu. C'est le plan de fin du film, et c'est joli,
     mais on ne cite pas un film en n'en montrant que la consequence.

     Elle arrive de loin derriere, monte en regime — les arcs bleus du
     condensateur se mettent a courir sur la caisse —, passe, et DISPARAIT
     dans un eclair a l'instant precis ou les trainees s'allument. La
     sequence entiere dure six secondes sur une fenetre qui en compte douze.

     Elle roule dans le repere LOCAL de la scene, le long de son axe Z. La
     scene est posee sur le chemin et orientee selon sa tangente : sur les
     quatre-vingts metres que la voiture parcourt, l'ecart avec la vraie
     courbe reste sous le metre, et a cette vitesse-la personne ne peut le
     voir. C'est le seul endroit du fichier ou l'on se permet cette
     approximation, et c'est parce qu'elle achete beaucoup de simplicite. */
  const auto = delorean();
  g.add(auto);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  flash.material.color.setRGB(3.6, 3.5, 3.2);
  flash.scale.setScalar(18);
  g.add(flash);
  const bandes = [];
  for (const sx of [-1, 1]) {
    /* Trente-deux tronçons dans la longueur : c'est ce qu'il faut pour que
       la bande suive les bosses au lieu de plonger dedans. */
    const geo = new THREE.PlaneGeometry(0.72, longueur, 1, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: texturebraise(), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    });
    mat.color.setRGB(2.2, 1.0, 0.42);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(sx * 0.78, 0.06, 0);
    m.renderOrder = 1;
    g.add(m);
    bandes.push(m);
  }
  const front = halo([3.6, 1.6, 0.5], 4.2);
  front.position.set(0, 0.7, -longueur / 2);
  g.add(front);

  /* LES BRAISES. Ce qui manquait pour que ce soit du feu et non deux
     marques au sol : des points qui montent et s'eteignent au-dessus des
     trainees. Le feu se lit a ce qui s'en echappe, pas a ce qui reste. */
  const N = 90;
  const pos = new Float32Array(N * 3);
  const geoBr = new THREE.BufferGeometry();
  geoBr.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const matBr = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xFFB059, size: 0.11,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const braises = new THREE.Points(geoBr, matBr);
  braises.frustumCulled = false;
  g.add(braises);
  // Chaque braise a sa propre avance, son cote et sa derive laterale.
  const vies = new Float32Array(N).map(() => Math.random());
  const cotes = new Float32Array(N).map((_, i) => (i % 2 ? 0.78 : -0.78));
  const dispersion = new Float32Array(N).map(() => (Math.random() - 0.5) * 0.55);
  const lelong = new Float32Array(N).map(() => Math.random());

  g.userData.poser = (relief) => {
    for (const b of bandes) epouserLeSol(b, relief, 0.07);
  };

  /* Le saut n'a lieu qu'une fois par passage. On remet tout a zero quand la
     fenetre se referme, pour que la voiture repasse si l'on refait la
     balade. */
  g.userData.reinit = () => { sautFait = false; zPrecedent = null; };

  /* Le trajet de la voiture, en metres le long de l'axe local. Elle part
     au-dela du brouillard et s'evanouit a l'extremite arriere des trainees,
     celle par laquelle elles commencent. */
  const Z0 = 58, Z1 = -longueur / 2 - 2;
  const _p = new THREE.Vector3();
  const SAUT = 0.30;                       // l'instant du flash, en fraction de fenetre
  let sautFait = false;
  let zPrecedent = null;

  g.userData.jouer = (u, t) => {
    /* --- LA VOITURE, jusqu'au saut. ------------------------------------- */
    const k = clamp(u / SAUT, 0, 1);
    /* LA COURBE DE POSITION, EN TROIS TEMPS. Antoine : « on ne reconnait
       pas la DeLorean ». Une pure acceleration (le carre du parcours) la
       laissait loin et minuscule presque tout le temps, puis elle jaillissait
       pres de nous une fraction de seconde avant le flash — jamais assez
       longtemps pour VOIR une voiture, seulement assez pour deviner qu'il y
       avait quelque chose de lumineux. On lui donne desormais un temps FORT
       au milieu : elle approche, se stabilise a bonne distance le temps
       qu'on la voie vraiment — carrosserie basse, reacteur, arcs bleus —
       puis elle s'elance pour de bon vers le point du saut. */
    let av;
    if (k < 0.38) {
      const p = k / 0.38;
      av = 0.78 * (p * p * (3 - 2 * p));
    } else if (k < 0.72) {
      av = 0.78;
    } else {
      const p = (k - 0.72) / 0.28;
      av = 0.78 + 0.22 * p * p;
    }
    const encoreLa = u < SAUT;
    auto.visible = encoreLa;
    if (encoreLa) {
      auto.position.z = Z0 + (Z1 - Z0) * av;
      /* ELLE ROULAIT SOUS LA NEIGE. La scene est posee a la hauteur du sol
         SOUS SON ANCRAGE, et la voiture parcourt plusieurs dizaines de
         metres a partir de la : sur cette distance le terrain monte et
         descend de plusieurs metres, si bien qu'elle etait enterree la
         moitie du temps et flottait le reste. Elle prend donc la hauteur du
         sol SOUS ELLE, a chaque image. C'est le meme oubli que pour les
         flaques de gyrophare, et il se manifeste ici en pire : la voiture
         disparaissait purement et simplement. */
      _p.set(0, 0, auto.position.z).applyMatrix4(g.matrixWorld);
      auto.position.y = relief.hauteur(_p.x, _p.z) - g.position.y;
      /* Les roues tournent au rythme du deplacement REEL, mesure d'une
         image a l'autre — indispensable maintenant que la vitesse n'est
         plus une simple derivee du carre : sur le palier du milieu, ou la
         voiture est stable, elles doivent cesser de tourner, pas continuer
         d'accelerer comme le laissait croire l'ancienne formule. */
      const dz = zPrecedent === null ? 0 : Math.abs(auto.position.z - zPrecedent);
      zPrecedent = auto.position.z;
      for (const r of auto.userData.roues) r.rotation.x -= dz / 0.32;
      const proche = smoothstep(0.35, 0.95, k);
      for (const p of auto.userData.phares) p.material.opacity = 0.9;
      for (const c of auto.userData.cones) c.material.opacity = 0.30;
      /* LES ARCS DU CONDENSATEUR. Ils n'apparaissent qu'a la toute fin de
         la montee en regime, et par a-coups tres brefs : c'est ce
         crepitement qui annonce le saut. */
      for (let i = 0; i < auto.userData.arcs.length; i++) {
        const bruit = Math.pow(Math.abs(Math.sin(t * 23 + i * 2.1)), 8);
        auto.userData.arcs[i].material.opacity = proche * bruit * 0.95;
      }
      /* Le son suit la montee en regime, et le crepitement du condensateur
         arrive avec les arcs — donc juste avant le saut. Sans cette montee,
         la disparition tombe sans prevenir. */
      const regler = [{ regime: 0.25 + av * 0.75, doppler: 0, volume: 1 }];
      regler.crepite = proche;
      g.userData.emettre?.('regler', regler);
    }

    /* --- L'ECLAIR, une seule fois. --------------------------------------- */
    const depuis = (u - SAUT) / 0.06;
    flash.material.opacity = u >= SAUT && depuis < 1
      ? Math.pow(1 - clamp(depuis, 0, 1), 2.2)
      : 0;
    _p.set(0, 0, Z1).applyMatrix4(g.matrixWorld);
    flash.position.set(0, relief.hauteur(_p.x, _p.z) - g.position.y + 0.9, Z1);
    if (!sautFait && u >= SAUT) {
      sautFait = true;
      /* LE SAUT, PAS UNE EXPLOSION. Une aspiration qui monte, le claquement,
         puis une queue de sub qui s'effondre : c'est la forme d'un depart.
         Et l'on coupe le moteur dans le meme geste — la voiture n'est plus
         la, son moteur ne peut pas continuer a tourner. */
      g.userData.emettre?.('saut');
      const eteint = [{ regime: 0, doppler: 0, volume: 0 }];
      eteint.crepite = 0;
      g.userData.emettre?.('regler', eteint);
    }

    /* --- LES TRAINEES. Elles ne s'allument qu'APRES le saut : ce sont
       elles qui restent quand la voiture n'est plus la. ------------------- */
    const allume = smoothstep(SAUT, SAUT + 0.05, u) * smoothstep(1, 0.62, u);
    const scint = 0.82 + Math.sin(t * 27) * 0.18;
    for (const b of bandes) b.material.opacity = allume * 1.15 * scint;
    /* Le halo de tete ne s'allume qu'au saut, avec les trainees : avant, la
       voiture est encore la et c'est ELLE qu'on regarde. */
    front.material.opacity = smoothstep(SAUT, SAUT + 0.03, u) * smoothstep(SAUT + 0.30, SAUT + 0.08, u) * 0.9;

    /* LA VISIBILITE DU GROUPE NE PEUT PAS DEPENDRE DES SEULES TRAINEES.

       Elle en dependait, et les trainees ne s'allument qu'APRES le saut :
       tout le groupe — donc la voiture, donc toute la premiere moitie de la
       scene — restait invisible pendant l'approche. On voyait le resultat
       sans jamais voir ce qui l'avait produit, ce qui est exactement le
       defaut qu'on cherchait a corriger. Le groupe vit tant que l'un OU
       l'autre a quelque chose a montrer. */
    g.visible = allume > 0.01 || encoreLa || flash.material.opacity > 0.01;

    /* Les braises montent, derivent, et s'eteignent d'autant plus vite que
       la trainee elle-meme faiblit. */
    matBr.opacity = allume * 0.85;
    for (let i = 0; i < N; i++) {
      vies[i] += 0.019;
      if (vies[i] > 1) vies[i] -= 1;
      const k = vies[i];
      pos[i * 3] = cotes[i] + dispersion[i] * k + Math.sin(t * 2.3 + i) * 0.10 * k;
      pos[i * 3 + 1] = 0.08 + k * k * 1.7;
      pos[i * 3 + 2] = (lelong[i] - 0.5) * longueur * 0.92 + k * 0.7;
    }
    geoBr.attributes.position.needsUpdate = true;
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
/* LE CERF DE LUMIERE. Antoine : « le patronus n'est pas beau ». Il avait
   raison — trois capsules pour le corps et deux eventails de baguettes
   pour les bois ne composent pas un cerf, seulement son idee la plus
   grossiere. La foret, elle, en contient deja un vrai : un maillage lisse,
   extrait d'un champ implicite, corne et ramure comprises, construit avec
   tout le soin qu'on a mis a le rendre reconnaissable. Le patronus REPREND
   ce maillage plutot que d'en refaire un au rabais — meme squelette, meme
   silhouette, meme ramure detaillee — et le rend en lumiere plutot qu'en
   pelage : une seule matiere additive remplace toutes celles du vrai
   corps, l'ombre au sol et la buee des naseaux disparaissent (un fantome
   n'a ni l'une ni l'autre), et c'est tout. La beaute du sort tient a la
   qualite du corps qu'il anime, pas a un habillage special. */
function cerfDeLumiere(palier) {
  const corps = creerCerf(palier);
  const { racine, ombre, souffle } = corps;

  /* UN BLEU FRANC, PAS UN BLANC BLEUTE. Le patronus passe au-dessus d'une
     clairiere enneigee : une matiere additive presque blanche, ajoutee a du
     blanc, donne du blanc, et le cerf de lumiere disparaissait dans le sol.
     On charge donc le bleu bien au-dela de un — `setRGB` travaille en
     lineaire, rien n'empeche de depasser — et on vide le rouge. */
  const mat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  mat.color.setRGB(0.26, 0.80, 1.60);

  /* TOUTE PIECE RIGIDE DU VRAI CERF — mufle, oreilles, yeux, ramure —
     portait sa propre matiere de pelage. On les fait toutes basculer vers
     la meme lumiere additive, ce qui a aussi pour effet d'unifier la
     silhouette : plus aucun detail sombre ne casse le glow. */
  const pieces = [];
  racine.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.material = mat;
    o.castShadow = false;
    o.receiveShadow = false;
    pieces.push(o);
  });
  ombre.visible = false;
  souffle.visible = false;

  // Le halo qui l'enveloppe : c'est lui qui porte a distance.
  const aura = halo([0.55, 1.15, 1.9], 5.4);
  aura.position.set(0, 1.15, -0.1);
  racine.add(aura);

  racine.userData.pieces = pieces;
  racine.userData.aura = aura;
  return racine;
}

/* LE SORCIER. Antoine : « on doit voir Harry Potter qui tient sa baguette,
   qui fait un sort et qui invoque le patronus ». Le cerf de lumiere seul
   est un beau fantome, mais rien ne dit QUI l'a fait naitre. Une
   silhouette encapuchonnee, la baguette tendue vers la trajectoire du
   cerf, plantee la ou il surgit : c'est elle qui transforme l'apparition
   en sort lance, et non en hasard lumineux. */
const CAPE_SOMBRE = new THREE.Color(0x14161C);
const PEAU_HARRY = new THREE.Color(0xD8B48C);

function teinteHarry(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x0C0D10); return; }
  if (os === 'tete') { c.copy(PEAU_HARRY); return; }
  c.copy(CAPE_SOMBRE);
  void x; void y; void z;
}

let _corpsHarry = null;

function sorcierPatronus(palier) {
  const g = new THREE.Group();
  if (!_corpsHarry) {
    _corpsHarry = construireCorps(palier, {
      teinter: teinteHarry,
      gabarit: { carrure: 0.86, masse: 0.84 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.85, metalness: 0.0,
    emissive: new THREE.Color(0x06070A), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsHarry, mat, { ombres: palier.ombres });
  g.add(perso);
  const os = perso.userData.os;

  // Le bras tendu, la baguette au bout du poing, le corps legerement en
  // fente vers l'avant — l'effort du sort, pas une pose de repos.
  appliquerPose(os, {
    brasD: [-1.15, 0.05, 0.35], avantD: [0.20, 0, 0], mainD: [0, 0, 0],
    brasG: [0.10, 0, -0.16], avantG: [0.35, 0, 0],
    cuisseD: [-0.16, 0, 0.10], molletD: [0.10, 0, 0],
    cuisseG: [0.10, 0, -0.10], molletG: [0.06, 0, 0],
    colonne: [0.05, 0, 0], poitrine: [0.04, 0, 0], cou: [0, 0, 0], tete: [0.02, 0, 0],
  });

  // La baguette : un fin fuseau de bois, greffe sur le poing.
  const baguette = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.016, 0.34, 5),
    new THREE.MeshStandardMaterial({ color: 0x3A2A18, roughness: 0.7 })
  );
  baguette.rotation.x = Math.PI / 2;
  baguette.position.set(0, 0, -0.20);
  os.mainD.add(baguette);

  // L'etincelle a la pointe : c'est elle qui vend le sort, au moment ou
  // le cerf de lumiere jaillit.
  const etincelle = halo([1.4, 2.2, 3.6], 1.3);
  etincelle.position.set(0, 0, -0.37);
  os.mainD.add(etincelle);

  g.userData.os = os;
  g.userData.etincelle = etincelle;
  return g;
}

function patronus(palier) {
  const g = new THREE.Group();
  const bete = cerfDeLumiere(palier);
  g.add(bete);

  /* Harry se tient la ou le cerf de lumiere surgit — l'origine de son
     trajet local, voir plus bas — face a la trajectoire, un peu de cote
     pour ne jamais se trouver sur le passage de la bete. */
  const harry = sorcierPatronus(palier);
  harry.position.set(0.9, 0, -13);
  harry.rotation.y = Math.PI;
  g.add(harry);
  const osHarry = harry.userData.os;

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

  g.userData.jouer = (u, t, camera) => {
    /* Il surgit vite et se defait lentement : une apparition surnaturelle
       ne s'installe pas en fondu, elle EST la d'un coup. */
    const vis = smoothstep(0, 0.06, u) * smoothstep(1, 0.62, u);
    const scint = 0.78 + Math.sin(t * 5.5) * 0.12 + Math.sin(t * 13.1) * 0.10;
    for (const p of bete.userData.pieces) p.material.opacity = vis * 0.52 * scint;
    bete.userData.aura.material.opacity = vis * 0.34 * scint;
    ptsMat.opacity = vis * 0.7;
    g.visible = vis > 0.01;

    /* LE SORT. La pointe de la baguette s'embrase juste avant que le cerf
       ne jaillisse — c'est CE flash, et non une simple apparition de
       fantome, qui doit se lire en premier — puis retombe a une braise
       discrete qui tient pendant toute la course : Harry ne range pas sa
       baguette tant que le sort dure. */
    const jaillit = smoothstep(0, 0.05, u) * smoothstep(0.22, 0.09, u);
    const brasedure = smoothstep(0, 0.10, u) * smoothstep(1, 0.55, u);
    harry.userData.etincelle.material.opacity = vis * (brasedure * 0.28 + jaillit * 0.9);
    /* Le poignet accuse le coup au moment du sort : un petit recul suivi
       d'une tension qui tient tant que le sort dure — pas un mouvement
       continu, sinon on croirait qu'il agite betement sa baguette. */
    const kick = Math.max(0, 1 - Math.abs(u - 0.05) * 14);
    osHarry.avantD.rotation.x = 0.20 - kick * 0.55;
    osHarry.mainD.rotation.z = kick * 0.4;
    // Un bref regard vers vous, une fois le sort lance — pas plus, il
    // regarde surtout ou son cerf de lumiere s'en va.
    const regard = smoothstep(0.25, 0.35, u) * smoothstep(0.55, 0.45, u);
    regarderVers(harry, osHarry, camera, regard * 0.7);

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
   8. SEUL A LA MAISON

   Antoine : « trois Spider-Man c'est trop, rajoute une reference a un
   autre film connu ». Le triangle de Spider-Man qui se pointent du doigt
   est retire (deux passages du personnage suffisent, et le troisieme
   citait surtout un mème) ; a sa place, la pose la plus reconnaissable du
   cinema familial de Noel — les deux mains plaquees sur les joues, la
   bouche grande ouverte. Un enfant seul, en pleine neige, qui hurle sans
   bruit : ca n'a besoin d'aucun visage pour se reconnaitre, seulement de
   ce geste-la.
   ========================================================================== */
const BEIGE_PULL = new THREE.Color(0xC9A876);
const PANTALON_SOMBRE = new THREE.Color(0x262B33);
const PEAU_CLAIRE = new THREE.Color(0xD8B48C);

function teinteKevin(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x1B1E24); return; }
  const jambe = os === 'cuisseD' || os === 'cuisseG' || os === 'molletD' || os === 'molletG';
  if (jambe) { c.copy(PANTALON_SOMBRE); return; }
  if (os === 'tete') {
    /* Le bonnet, sur le dessus et l'arriere du crane ; le visage, dans
       l'ombre, en dessous — la meme logique de coupe par la normale que
       la chevelure de Kill Bill, ici sur un bonnet plutot qu'un carre. */
    if (y > REPERES.crane - 0.05 || (z > 0.01 && y > REPERES.menton)) { c.setHex(0xB23B3B); return; }
    c.copy(PEAU_CLAIRE);
    return;
  }
  c.copy(BEIGE_PULL);
  void x; void z;
}

/* LA POSE. Les deux bras montent haut et se replient fort — les mains
   viennent aux joues, les coudes ecartes — c'est exactement la silhouette
   de l'affiche, jusque dans l'asymetrie legere qui empeche une symetrie
   parfaite de se lire comme une pose de mannequin. */
const POSE_KEVIN = {
  brasD: [-2.00, 0.15, 0.22], avantD: [-1.85, 0, 0], mainD: [0, 0, 0.15],
  brasG: [-2.10, -0.12, -0.20], avantG: [-1.90, 0, 0], mainG: [0, 0, -0.15],
  cuisseD: [-0.04, 0, 0.05], molletD: [0.06, 0, 0],
  cuisseG: [0.04, 0, -0.05], molletG: [0.06, 0, 0],
  colonne: [-0.10, 0, 0], poitrine: [-0.16, 0, 0],
  cou: [0.10, 0, 0], tete: [0.18, 0, 0],
};

let _corpsKevin = null;

function seulALaMaison(palier) {
  const g = new THREE.Group();
  if (!_corpsKevin) {
    _corpsKevin = construireCorps(palier, {
      teinter: teinteKevin,
      // Une charpente plus menue : c'est ce rapport, avant toute echelle,
      // qui fait lire un enfant plutot qu'un adulte reduit.
      gabarit: { carrure: 0.80, masse: 0.76 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.78, metalness: 0.0,
    emissive: new THREE.Color(0x0A0806), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsKevin, mat, { ombres: palier.ombres });
  // Et une echelle plus petite encore, par-dessus le gabarit : a vingt
  // metres et de nuit, c'est elle qui achieve de le distinguer d'un adulte.
  perso.scale.setScalar(0.82);
  g.add(perso);

  const os = perso.userData.os;
  appliquerPose(os, POSE_KEVIN);

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    /* IL TREMBLE — de froid, de peur, ou des deux a la fois. Sans ce
       battement rapide et minuscule, la pose la plus celebre du cinema
       familial de Noel devient une statue de cire plantee dans la neige. */
    const tremble = Math.sin(t * 14) * 0.035 + Math.sin(t * 23 + 1.7) * 0.02;
    os.brasD.rotation.z += tremble;
    os.brasG.rotation.z -= tremble;
    os.tete.rotation.z += tremble * 0.6;

    // Il vous voit passer, et son hurlement silencieux se tourne vers vous.
    regarderVers(perso, os, camera, smoothstep(0.18, 0.34, u) * 0.85);
    void clamp;
  };
  return g;
}

/* ==========================================================================
   MUGIWARA — UN CLIN D'OEIL A ONE PIECE, PAS AU CINEMA CETTE FOIS.

   Antoine : « je veux one piece » — et, dans le meme message, que TOUTES
   les apparitions donnent l'impression que la camera reagit a ce qui
   bouge. Le geste le plus reconnaissable de la serie est aussi celui qui
   s'y prete le mieux : le poing qui s'etire jusqu'a nous, comme si le
   personnage frappait a travers l'ecran. Le bras n'est pas un OS qu'on
   etire — deformer un bras skinne a ce point le tordrait affreusement —
   c'est un ELASTIQUE a part, un cylindre redimensionne et oriente chaque
   image pour joindre l'epaule a un poing qui vole vers la camera.
   ========================================================================== */
const ROUGE_VESTE = new THREE.Color(0xB0271E);
const BLEU_SHORT = new THREE.Color(0x28345A);
const PEAU_LUFFY = new THREE.Color(0xE0A876);
const SANDALE_LUFFY = new THREE.Color(0x4A3320);

function teinteLuffy(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG') { c.copy(SANDALE_LUFFY); return; }
  if (os === 'cuisseD' || os === 'cuisseG') { c.copy(BLEU_SHORT); return; }
  if (os === 'colonne' || os === 'poitrine') { c.copy(ROUGE_VESTE); return; }
  c.copy(PEAU_LUFFY);
  void x; void y; void z;
}

function chapeauPaille() {
  const g = new THREE.Group();
  const paille = new THREE.MeshStandardMaterial({ color: 0xE3C468, roughness: 0.88 });
  const bandeau = new THREE.MeshStandardMaterial({ color: 0xA8222A, roughness: 0.6 });
  const bord = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 6, 16), paille);
  bord.rotation.x = Math.PI / 2;
  g.add(bord);
  const calotte = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.20, 10, 1, true), paille);
  calotte.position.y = 0.10;
  g.add(calotte);
  const ruban = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.045, 10), bandeau);
  ruban.position.y = 0.015;
  g.add(ruban);
  return g;
}

const _elDir = new THREE.Vector3();
const _elUp = new THREE.Vector3(0, 1, 0);

/* Le bras : un cylindre tendu entre l'epaule et le poing, redimensionne et
   oriente chaque image — jamais un os anime, toujours une piece a part. */
function busteElastique(couleur) {
  const geoTube = new THREE.CylinderGeometry(0.075, 0.11, 1, 7, 1, true);
  geoTube.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.72 });
  const tube = new THREE.Mesh(geoTube, mat);
  tube.visible = false;
  const poing = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), mat);
  poing.visible = false;
  const g = new THREE.Group();
  g.add(tube, poing);
  g.userData = { tube, poing };
  return g;
}

function tendreElastique(el, origine, cible) {
  const { tube, poing } = el.userData;
  _elDir.copy(cible).sub(origine);
  const dist = _elDir.length();
  if (dist < 0.03) { tube.visible = false; poing.visible = false; return; }
  _elDir.multiplyScalar(1 / dist);
  tube.visible = true; poing.visible = true;
  tube.position.copy(origine);
  tube.scale.set(1, dist, 1);
  tube.quaternion.setFromUnitVectors(_elUp, _elDir);
  poing.position.copy(cible);
}

let _corpsLuffy = null;

function mugiwara(palier) {
  const g = new THREE.Group();
  if (!_corpsLuffy) {
    _corpsLuffy = construireCorps(palier, {
      teinter: teinteLuffy,
      gabarit: { carrure: 0.92, masse: 0.90 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.80, metalness: 0.0,
    emissive: new THREE.Color(0x0A0806), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsLuffy, mat, { ombres: palier.ombres });
  g.add(perso);
  const os = perso.userData.os;

  // Plante, jambes ecartees, le bras gauche recule pour l'appel du coup —
  // le droit reste libre, c'est l'elastique qui en tient lieu.
  appliquerPose(os, {
    cuisseD: [-0.18, 0, 0.14], molletD: [0.10, 0, 0],
    cuisseG: [-0.18, 0, -0.14], molletG: [0.10, 0, 0],
    brasG: [-0.35, 0.10, -0.55], avantG: [-0.65, 0, 0],
    colonne: [0.06, 0.08, 0], poitrine: [0.04, 0.05, 0],
  });

  const chapeau = chapeauPaille();
  chapeau.position.set(0, 0.30, 0.02);
  os.tete.add(chapeau);

  const elastique = busteElastique(PEAU_LUFFY.getHex());
  g.add(elastique);
  const origine = new THREE.Vector3();
  const cible = new THREE.Vector3();

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    regarderVers(perso, os, camera, smoothstep(0.04, 0.14, u) * 0.7);

    /* L'ELAN — le poing recule et se crispe — puis LE TIR, qui l'envoie
       loin devant, jusqu'a nous, avant de le laisser revenir. */
    const arme = smoothstep(0.14, 0.32, u) * smoothstep(0.56, 0.42, u);
    const lance = smoothstep(0.42, 0.54, u) * smoothstep(0.88, 0.64, u);
    os.brasD.rotation.set(-0.10 - arme * 0.85, 0.05, 0.12);
    os.avantD.rotation.set(0.08 + arme * 0.5, 0, 0);

    origine.set(0.36, 1.32, -0.08);
    const portee = lance * 6.4;
    cible.set(
      0.36 + Math.sin(t * 11) * 0.05 * lance,
      1.32 + Math.sin(lance * Math.PI) * 0.5,
      -0.08 - portee
    );
    tendreElastique(elastique, origine, cible);
  };
  return g;
}

/* ==========================================================================
   LES HAMBURGERS QUI VOLENT

   Antoine : « je veux des hamburgers qui volent car j'aime la nourriture ».
   Rien a expliquer, rien a reconnaitre — juste une nuee qui tourbillonne
   devant le chemin. Plantee une fois pour toutes a un point fixe : voir la
   lune plus haut pour la raison exacte (jamais recalculee depuis la
   camera, jamais deux fois au meme endroit par accident). */
const matPainHB = new THREE.MeshStandardMaterial({ color: 0xD9A24B, roughness: 0.85 });
const matSteakHB = new THREE.MeshStandardMaterial({ color: 0x5A3420, roughness: 0.92 });
const matFromageHB = new THREE.MeshStandardMaterial({ color: 0xF0B93C, roughness: 0.45 });
const matSaladeHB = new THREE.MeshStandardMaterial({ color: 0x4C8A3A, roughness: 0.9 });

function hamburgerVolant(echelle) {
  const g = new THREE.Group();
  const bas = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 10, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
    matPainHB);
  bas.position.y = -0.08;
  g.add(bas);
  const steak = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.10, 12), matSteakHB);
  steak.position.y = 0.02;
  g.add(steak);
  const salade = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 14), matSaladeHB);
  salade.rotation.x = Math.PI / 2;
  salade.position.y = 0.09;
  g.add(salade);
  const fromage = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.03, 0.50), matFromageHB);
  fromage.position.y = 0.11;
  fromage.rotation.y = Math.PI / 4;
  g.add(fromage);
  const haut = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
    matPainHB);
  haut.position.y = 0.16;
  g.add(haut);
  g.scale.setScalar(echelle);
  return g;
}

function nueeHamburgers(chemin, palier) {
  const g = new THREE.Group();
  g.userData.suitCamera = true;

  const N = palier.nom === 'bas' ? 6 : 10;
  const burgers = [];
  for (let i = 0; i < N; i++) {
    const mesh = hamburgerVolant(1.8 + Math.random() * 1.1);
    g.add(mesh);
    burgers.push({
      mesh,
      ang: (i / N) * Math.PI * 2 + Math.random() * 0.6,
      rayon: 1.6 + Math.random() * 1.8,
      vAng: 0.35 + Math.random() * 0.55,
      hauteur: -0.8 + Math.random() * 2.2,
      dephasage: Math.random() * 10,
      spinX: (Math.random() - 0.5) * 2.4,
      spinZ: (Math.random() - 0.5) * 2.4,
    });
  }

  const p = new THREE.Vector3(), tan = new THREE.Vector3(), cote = new THREE.Vector3();
  let calcule = false;
  const posNuee = new THREE.Vector3();
  g.userData.reinit = () => { calcule = false; };

  g.userData.jouer = (u, t, camera, sAncre) => {
    const vis = smoothstep(0, 0.14, u) * smoothstep(1, 0.84, u);
    g.visible = vis > 0.01;
    if (!g.visible || !camera) return;

    if (!calcule) {
      chemin.point(sAncre, p);
      chemin.tangente(sAncre, tan);
      chemin.cote(sAncre, cote);
      posNuee.copy(p).addScaledVector(tan, 10).addScaledVector(cote, -6);
      posNuee.y = p.y + 4.4;
      calcule = true;
    }
    g.position.copy(posNuee);
    // Materialisation par l'echelle plutot que par l'opacite : les
    // materiaux sont partages entre toutes les instances (peu couteux),
    // et une opacite par-objet n'existe donc pas a ce niveau.
    g.scale.setScalar(Math.max(0.001, vis));

    for (const b of burgers) {
      const a = b.ang + t * b.vAng;
      b.mesh.position.set(
        Math.cos(a) * b.rayon,
        b.hauteur + Math.sin(t * 0.8 + b.dephasage) * 0.45,
        Math.sin(a) * b.rayon
      );
      b.mesh.rotation.x += 0.017 * b.spinX;
      b.mesh.rotation.z += 0.017 * b.spinZ;
    }
  };
  return g;
}

/* ==========================================================================
   JURASSIC PARK

   La scene la plus celebre du cinema d'aventure, et la seule qui COMMENCE
   AVANT QU'ON VOIE QUOI QUE CE SOIT. Le verre d'eau qui tremble, le
   silence, puis la chose. On reprend cette construction en trois temps,
   transposee a une foret enneigee.

   Il passe DERRIERE la ligne d'arbres, jamais entierement degage. Ce n'est
   pas une economie : un dinosaure entierement visible invite a l'examiner,
   et il ne resiste jamais a l'examen. Entrevu entre deux troncs, il est
   enorme.
   ========================================================================== */
function jurassique(chemin, relief, palier) {
  const g = new THREE.Group();
  g.userData.suitChemin = true;

  const bete = creerTrex(palier);
  g.add(bete);
  const os = bete.userData.os;

  /* LA NEIGE QUI TOMBE DES BRANCHES. C'est le premier temps de la scene, et
     c'est le seul moment ou elle repose entierement sur autre chose que la
     bete : deux gerbes qui se detachent des arbres, en cadence, pendant
     qu'on ne voit encore rien. */
  const N = palier.nom === 'bas' ? 90 : 170;
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const matN = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xE6EEFB, size: 0.13,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const chute = new THREE.Points(geo, matN);
  chute.frustumCulled = false;
  g.add(chute);
  const vies = new Float32Array(N).map(() => Math.random());
  const oX = new Float32Array(N).map(() => (Math.random() - 0.5) * 26);
  const oZ = new Float32Array(N).map(() => (Math.random() - 0.5) * 34);
  const oH = new Float32Array(N).map(() => 5 + Math.random() * 9);

  /* La voie : loin du chemin et DERRIERE les arbres. */
  /* OU LE PLACER, ET C'EST TOUTE LA DIFFICULTE DE CETTE SCENE.

     Premiere version : vingt-deux metres de cote, marchant a la hauteur du
     cerf. Il etait donc PARALLELE a nous et par le travers — c'est-a-dire a
     plus de trente degres de l'axe, alors qu'en portrait le champ n'en fait
     que seize et demi de chaque cote. On ne le voyait jamais.

     La reponse n'est pas de le rapprocher du chemin — il doit rester
     derriere des arbres — mais de le tenir DEVANT. A treize metres de cote,
     il tombe a douze degres de l'axe des qu'il precede le cerf de quelques
     metres : dans le cadre, loin, a demi mange par le brouillard et par les
     troncs. C'est exactement le plan qu'on veut.

     A treize metres, la marge du couloir garantit qu'il y a de grands
     sapins entre lui et nous : elle vaut deux metres soixante plus quatre
     dixiemes de la hauteur de l'arbre, soit pres de dix metres pour un
     sujet de quinze.

     SECONDE ERREUR, ET CELLE-LA ETAIT GRAVE : DEPART ET ARRIVEE COURAIENT
     DEVANT LA CAMERA, PAS DEVANT LE CERF.

     Avec `avant = 48` et `apres = 26`, la fenetre s'ouvre a `ancre - 48` et
     se ferme a `ancre + 26` : c'est la LE SEUL INTERVALLE ou le cerf — donc
     a peu pres la camera — peut se trouver pendant toute la scene. Or DEPART
     valait 26 et ARRIVEE 78 : la bete demarrait DEJA a la limite haute de
     cet intervalle et finissait cinquante-deux metres plus loin, hors de
     portee sur toute la duree. Mesure faite avec `build/apparitions.mjs`,
     qui balaie desormais la fenetre entiere d'une scene mobile au lieu d'un
     seul instant : la bete ne repassait JAMAIS a moins de cent trente metres
     de la camera. Elle courait devant une camera qui ne pouvait pas la
     suivre — invisible du debut a la fin, et rien dans un simple coup d'oeil
     ne le laissait voir, puisqu'une capture isolee tombait toujours, par
     chance, sur un instant ou elle etait encore loin devant.

     La marche visible se joue entre u=0,30 et u=0,86 (voir plus bas) ; sur
     ce segment le cerf va de `ancre-25,8` a `ancre+15,6`.

     TROISIEME ERREUR, MESUREE CETTE FOIS AVEC LA VRAIE CAMERA DE MARCHE, PAS
     UNE RECONSTITUTION.

     Le calage precedent (DEPART=-19, ARRIVEE=23) collait de trop pres a la
     progression du cerf : la bete finissait par rester quasiment FIXE en
     fin de fenetre (k sature a 1 des que u depasse 0,86) pendant que le
     cerf, lui, continue d'avancer jusqu'a `ancre+apres` puis au-dela. Le
     cerf la RATTRAPE, puis la depasse — et une bete treize metres sur le
     cote et desormais legerement EN ARRIERE tombe evidemment hors du champ
     d'une camera qui regarde devant. La marche complete simulee image par
     image (`build/_tmp_trex_real.mjs`, jamais un instantane reconstruit) l'a
     montre sans ambiguite : l'ecart ecran partait de -0,68 a la sortie de la
     halte voisine pour atteindre -20 quelques secondes plus tard.

     La regle qui en decoule : ARRIVEE doit rester en avance sur le cerf
     MEME apres la fin nominale de la fenetre, avec une marge confortable, et
     DEPART doit deja placer la bete en avance des le debut de la marche. On
     vise une avance qui ne descend jamais sous vingt-cinq metres sur tout le
     segment utile, ce qui, a treize metres de voie, tient l'angle sous
     vingt-huit degres — au-dela du champ theorique de seize degres et demi,
     mais la moitie de cette marge est mangee par le brouillard et les
     troncs, ce qui est justement l'effet voulu : on l'aperçoit, on ne le
     fixe pas. */
  /* ANTOINE : « le T-Rex ne ressemble a rien, il ne fait pas peur, on le
     voit de loin ». Le parti pris d'origine — le tenir loin, a demi mange
     par le brouillard — etait une lecture du plan du film ; pour Antoine
     ca ne marche pas, la bete est trop petite et trop floue pour qu'on la
     reconnaisse, et une menace qu'on ne reconnait pas ne fait pas peur. On
     la rapproche nettement : neuf metres de voie au lieu de treize, ce qui
     la rapproche ET l'ecarte moins de l'axe de la camera (l'angle depend
     du rapport voie/avance, donc les deux s'ameliorent ensemble). */
  const VOIE = 9, COTE = -1;
  const DEPART = 8, ARRIVEE = 58;
  const p = new THREE.Vector3(), c = new THREE.Vector3(), tan = new THREE.Vector3();

  let dernierPas = -1, rugi = false;
  g.userData.reinit = () => { dernierPas = -1; rugi = false; };

  g.userData.jouer = (u, t, camera, sAncre, dt) => {
    /* LES TROIS TEMPS.
       0.00 → 0.30  la neige tombe des branches, on ne voit rien
       0.22 → 0.32  le rugissement, toujours invisible
       0.30 → 0.86  il traverse derriere les arbres  */
    const vis = smoothstep(0, 0.04, u) * smoothstep(1, 0.92, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    const k = clamp((u - 0.30) / 0.56, 0, 1);
    const sBete = sAncre + DEPART + k * (ARRIVEE - DEPART);
    const sc = clamp(sBete, 0, chemin.longueur);
    chemin.point(sc, p);
    chemin.cote(sc, c);
    chemin.tangente(sc, tan);
    const x = p.x + c.x * COTE * VOIE;
    const z = p.z + c.z * COTE * VOIE;
    g.position.set(x, relief.hauteur(x, z), z);
    g.rotation.y = Math.atan2(-tan.x, -tan.z);

    /* IL N'EST LA QU'A PARTIR DU DEUXIEME TEMPS. Avant, le groupe existe —
       il porte la neige qui tombe et la source sonore — mais la bete est
       eteinte : c'est ce qui fait qu'on entend des pas sans voir personne. */
    bete.visible = u > 0.28;

    /* LA CADENCE. Un pas toutes les huit dixiemes de seconde, comptes sur le
       temps ABSOLU et non sur la progression : ainsi le rythme reste le meme
       quelle que soit la vitesse du cerf, et c'est le rythme qui fait la
       masse. */
    const cadence = t / 0.82;
    const phase = cadence % 1;
    marcheTrex(os, phase, 1);
    // Il avance vraiment : la marche et le deplacement sont accordes.
    bete.position.z = 0;

    /* Le pas qui vient de se poser. On declenche dessus la secousse et le
       son — jamais sur une horloge separee, sinon l'image et le bruit
       derivent l'un de l'autre au bout de quelques secondes. */
    const numero = Math.floor(cadence * 2);
    const neuf = numero !== dernierPas;
    if (neuf) {
      dernierPas = numero;
      if (u > 0.02) g.userData.emettre?.('pas');
    }
    // La force de la secousse decroit apres chaque impact.
    const depuis = (cadence * 2) % 1;
    const secousse = Math.pow(1 - depuis, 3);

    if (!rugi && u > 0.22) { rugi = true; g.userData.emettre?.('rugir'); }

    /* La neige des branches. Elle tombe surtout juste apres un pas, et elle
       s'arrete quand la bete est passee — c'est elle qui fait le compte a
       rebours du debut. */
    const pluie = smoothstep(0, 0.05, u) * smoothstep(0.92, 0.62, u);
    matN.opacity = pluie * (0.30 + secousse * 0.70);
    for (let i = 0; i < N; i++) {
      vies[i] += dt * 0.55;
      if (vies[i] > 1) vies[i] -= 1;
      const kk = vies[i];
      pos[i * 3] = oX[i];
      pos[i * 3 + 1] = oH[i] * (1 - kk * kk);
      pos[i * 3 + 2] = oZ[i] + kk * 0.6;
    }
    geo.attributes.position.needsUpdate = true;
    void camera;
  };
  return g;
}

/* --------------------------------------------------------------------------
   OU SE PLACENT LES APPARITIONS.

   Cette table est sortie du constructeur pour une raison precise : LA FORET
   DOIT LA CONNAITRE AVANT D'ETRE SEMEE.

   Antoine : « fait gaffe a ce qu'il n'y ait pas de collision avec les
   arbres ». Le semis place plus de mille sapins au hasard le long du chemin,
   sans rien savoir de ce qui viendra s'y ajouter : un duelliste pouvait donc
   se retrouver le nez dans un tronc, et un Spider-Man pendu au milieu d'un
   feuillage. Le seul remede qui tienne est de degager le terrain AVANT de
   semer — retirer un arbre apres coup laisse un trou visible, et deplacer
   une apparition apres coup casse le cadrage qu'on vient de mesurer.

   `sitesApparitions` rend donc la liste des zones a laisser libres, et
   `main.js` la passe a la foret au moment du semis.
   -------------------------------------------------------------------------- */
export function planApparitions(L) {
  return [
    /* LA POURSUITE ETAIT ALLUMEE DES LA PREMIERE SECONDE. Sa fenetre
       s'ouvrait quarante-deux metres avant son ancrage, place a neuf pour
       cent du chemin — soit dix-huit metres — alors que la balade DEMARRE a
       vingt-six. On voyait donc le gyrophare avant meme d'avoir fait un pas,
       ce qui grillait la seule surprise qu'il avait a offrir. Elle est
       reculee a quinze pour cent du parcours, ce qui laisse cinquante
       metres de foret silencieuse avant qu'il ne se passe quoi que ce soit.

       L'ancrage n'est plus qu'un REPERE : les voitures, elles, parcourent
       deux cent cinquante metres autour de lui. */
    /* ONZE APPARITIONS, ESPACEES DE HUIT POUR CENT DU PARCOURS.

       L'espacement n'est plus un choix de gout mais une contrainte
       arithmetique : chaque fenetre mesure de quarante a quatre-vingts
       metres, et le chemin en fait six cent soixante-neuf. A onze scenes,
       il reste cinquante-trois metres entre deux ancrages — juste de quoi
       qu'elles ne se chevauchent pas.

       La verification s'est imposee toute seule : le theropode, avec ses
       cinquante-deux metres d'approche, empietait a la fois sur le trio qui
       le precede et sur le patronus qui le suit. Trois apparitions
       simultanees, ce n'est plus une surprise, c'est une brocante. */
    { nom: 'police',    s: L * 0.12, cote: -1, ecart: 6.0, avant: 46, apres: 26, degage: 0 },
    { nom: 'spider1',   s: L * 0.20, cote: -1, ecart: 3.5, avant: 30, apres: 8,  degage: 5.5 },
    /* MUGIWARA, GLISSE DANS LE COURT INTERVALLE ENTRE SPIDER1 ET KILL BILL.
       Une fenetre volontairement breve — on ne le voit pas arriver, on
       tombe sur lui — meme logique que Shining plus loin sur le parcours. */
    { nom: 'mugiwara',  s: L * 0.2212, cote: -1, ecart: 4.0, avant: 8, apres: 5, degage: 5.5 },
    { nom: 'killbill',  s: L * 0.28, cote: -1, ecart: 4.0, avant: 32, apres: 12, tourne: 0.3, degage: 5.0 },
    { nom: 'et',        s: L * 0.36, cote:  0, ecart: 0,   avant: 34, apres: 24, degage: 0 },
    { nom: 'sabres',    s: L * 0.44, cote: -1, ecart: 4.5, avant: 40, apres: 10, degage: 6.5, assombrit: 1 },
    { nom: 'kevin',     s: L * 0.52, cote: -1, ecart: 7.0, avant: 34, apres: 10, tourne: 0.4, degage: 5.5 },
    /* Le theropode marche a vingt-deux metres du chemin, derriere la ligne
       d'arbres : on ne degage donc RIEN pour lui — ce sont justement les
       troncs entre lui et nous qui font la scene. */
    /* ANTOINE : « le T-Rex part en meme temps que le patronus ». Les deux
       fenetres ne se recouvraient que de vingt-deux centimetres sur le
       papier — assez pour paraitre reglees a la main — mais la traine du
       theropode qui s'efface et l'amorce du patronus qui se leve se
       lisaient bel et bien comme un seul instant a deux endroits. On
       raccourcit la traine du premier et on retarde l'amorce du second :
       vingt-huit metres d'ecart net entre les deux, largement plus qu'il
       n'en faut pour que le silence entre les deux se sente. */
    { nom: 'trex',      s: L * 0.61, cote: -1, ecart: 0,   avant: 48, apres: 12, degage: 0 },
    /* SHINING, GLISSEE DANS LE GRAND ECART LAISSE ENTRE LE T-REX ET LE
       PATRONUS (vingt-huit metres nets, voir plus haut). Une fenetre
       courte et sans amorce : ce n'est pas une scene qu'on voit arriver,
       c'est une scene qu'on DECOUVRE — l'effet ne marche que si l'on
       tombe dessus. */
    { nom: 'shining',   s: L * 0.6522, cote: -1, ecart: 5.0, avant: 12, apres: 6, degage: 6.0 },
    { nom: 'patronus',  s: L * 0.70, cote: -1, ecart: 5.5, avant: 20, apres: 10, degage: 8.0 },
    /* LES HAMBURGERS, DANS LE COURT INTERVALLE ENTRE PATRONUS ET GARGANTUA.
       Scene aerienne (suitCamera) : aucun degagement d'arbres a prevoir,
       elle flotte au-dessus de tout. */
    { nom: 'hamburgers', s: L * 0.7189, cote: 0, ecart: 0, avant: 5, apres: 3, degage: 0 },
    { nom: 'gargantua', s: L * 0.78, cote:  0, ecart: 0,   avant: 38, apres: 28, degage: 0 },
    { nom: 'spider2',   s: L * 0.86, cote: -1, ecart: 3.0, avant: 28, apres: 8,  degage: 7.0 },
    /* ECART RELEVE A QUATRE METRES. Antoine : « elle roule sur le cerf ».
       Pose exactement sur l'axe du chemin (ecart nul), la trainee de la
       DeLorean partageait la meme ligne que la marche du cerf — et les deux
       s'y trouvaient au meme instant (mesure faite : le flash tombe alors
       que le cerf n'est qu'a quelques metres de l'ancre). Decalee du meme
       cote que tout le reste, elle file desormais sur son propre bas-cote,
       assez large pour ne jamais toucher le corps du cerf ni ses bois. */
    { nom: 'delorean',  s: L * 0.94, cote: -1, ecart: 4.0, avant: 46, apres: 16, degage: 4.0 },
  ];
}

/* Les zones a laisser sans arbre, en coordonnees du monde. Le rayon est
   celui de la scene plus une marge : un sapin dont le TRONC est hors zone
   peut encore etaler ses branches dessus, et c'est le feuillage qu'on voit. */
export function sitesApparitions(chemin) {
  const L = chemin.longueur;
  const p = new THREE.Vector3(), c = new THREE.Vector3();
  const sites = [];
  for (const d of planApparitions(L)) {
    if (!d.degage) continue;
    chemin.point(d.s, p);
    chemin.cote(d.s, c);
    sites.push({
      x: p.x + c.x * d.cote * d.ecart,
      z: p.z + c.z * d.cote * d.ecart,
      r: d.degage,
    });
  }
  return sites;
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
    /* LES ECARTS SONT DICTES PAR LE FORMAT DU TELEPHONE, ET C'EST BEAUCOUP
       PLUS SERRE QU'IL N'Y PARAIT.

       En portrait, le champ vertical vaut soixante-six degres mais le champ
       HORIZONTAL n'en fait plus que trente-trois — seize et demi de chaque
       cote de l'axe. Une apparition posee a dix metres du chemin sort donc
       du cadre des que l'on n'est plus qu'a trente-cinq metres d'elle, et
       elle en est franchement dehors au moment ou l'on passe a son niveau.

       Mesure faite a la mi-fenetre, avant correction : cinq des huit
       apparitions etaient hors champ sur l'ecran d'Antoine, alors qu'elles
       tenaient toutes largement dans mon cadre paysage. C'est exactement le
       genre d'erreur qu'on ne peut pas commettre deux fois — on verifie au
       format de l'appareil, pas au sien.

       ET LE DRONE N'EST PAS DANS L'AXE DU CHEMIN. Il vole de cote, et le
       cadrage vise a cote du cerf par-dessus le marche. La mesure est sans
       appel : les trainees de la DeLorean sont posees EXACTEMENT sur le
       chemin — ecart nul — et leur centre tombe a plus zero virgule
       soixante-quinze de l'ecran. Tout le cadre est donc decale d'environ
       les trois quarts d'un demi-ecran vers la droite, en permanence.

       Consequence : un cote est utilisable, l'autre pas. Une apparition
       posee du cote « plus un » part vers le bord droit et n'en revient
       jamais ; du cote « moins un », l'ecart la ramene vers le milieu, a
       raison d'environ un dixieme d'ecran par metre. Tout est donc du meme
       cote, et la variete se fait sur la DISTANCE au chemin — de trois a
       sept metres — plutot que sur la gauche et la droite, alternance que
       personne ne remarquerait de toute facon et qui coutait ici la moitie
       des apparitions.

       (J'avais d'abord cru a un simple biais a compenser, sur la foi de deux
       mesures qui se contredisaient. Le banc lui-meme etait en cause : il
       passait au drone une heure figee et differente a chaque execution, si
       bien que son tremblement de main levee changeait le cadrage d'un demi-
       ecran d'un essai a l'autre. Une horloge fixe a rendu le banc
       reproductible, et les chiffres ci-dessus sont les premiers auxquels on
       puisse se fier.) Le prix a payer est qu'elles frolent le
       chemin ; c'est sans consequence, aucune n'est au sol devant le cerf —
       Spider-Man pend en hauteur, le patronus est un fantome, et le duel se
       tient assez loin pour qu'on n'ait pas a le contourner. */
    /* Les fabriques, indexees par nom. La table des positions vit desormais
       hors de la classe (voir `planApparitions`) parce que la foret doit la
       lire avant de semer ses arbres ; il ne reste ici que ce qui construit
       reellement les objets. */
    const FABRIQUES = {
      police: () => coursePoursuite(chemin, relief, palier),
      spider1: () => spiderSuspendu(palier),
      et: () => etDevantLaLune(chemin),
      sabres: () => duelSabres(palier),
      kevin: () => seulALaMaison(palier),
      patronus: () => patronus(palier),
      spider2: () => spiderBalance(9, palier),
      killbill: () => killBill(palier),
      trex: () => jurassique(chemin, relief, palier),
      shining: () => shining(palier),
      gargantua: () => trouNoir(relief, chemin),
      delorean: () => traineesDeFeu(26, palier, relief),
      mugiwara: () => mugiwara(palier),
      hamburgers: () => nueeHamburgers(chemin, palier),
    };
    const plan = planApparitions(L).map((d) => ({ ...d, faire: FABRIQUES[d.nom] }));

    const p = new THREE.Vector3(), c = new THREE.Vector3(), tan = new THREE.Vector3();
    this._viseeInteret = new THREE.Vector3();
    /* LE CERF S'ARRETE POUR CHAQUE APPARITION. Antoine : « ça doit être
       vraiment une vraie scène de film ». Une silhouette entr'apercue en
       marchant reste un decor qui defile ; on veut un ARRET, une camera qui
       s'installe et compose, comme a une halte-cadeau — mais sans toucher
       au minutage de chaque scene, deja regle avec soin. La vitesse
       virtuelle avance donc la scene exactement comme l'aurait fait la
       marche normale : arreter le cerf ne change ni le rythme ni la duree
       de ce qu'on voit, seulement le fait que la camera n'a plus a courir
       pour le suivre pendant qu'elle le regarde. */
    this._vitesseVirtuelle = 3.3;
    this._enArret = false;
    this._vitesseAvantArret = null;
    this._sensArc = 1;
    // Le point-tire de mise au point pendant un arret : voir `maj()`.
    this.cibleFocus = null;
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
         de se produire », et c'est ici qu'on sait a qui l'adresser.

         LE MEME EVENEMENT SECOUE AUSSI LA CAMERA. Un choc de lames, un rugissement,
         un ascenseur qui claque n'existaient jusqu'ici que dans ce qu'ils
         montraient — la camera, elle, ne reagissait jamais. `regler` (un simple
         ajustement continu de volume) et `pas` (repete a chaque foulee) sont
         exclus : les secouer donnerait une vibration permanente, pas un choc. */
      o.userData.emettre = (quoi, valeur) => {
        const s = this.son;
        if (s && typeof s[quoi] === 'function') s[quoi](d.nom, valeur);
        if (quoi !== 'regler' && quoi !== 'pas') {
          this._droneCourant?.choc(typeof valeur === 'number' ? clamp(valeur, 0.35, 1) : 0.6);
        }
      };
      if (!o.userData.suitCamera && !o.userData.suitChemin) {
        chemin.point(d.s, p);
        chemin.cote(d.s, c);
        chemin.tangente(d.s, tan);
        const x = p.x + c.x * d.cote * d.ecart;
        const z = p.z + c.z * d.cote * d.ecart;
        o.position.set(x, relief.hauteur(x, z), z);
        // Face au chemin, avec le decalage propre a chaque scene.
        o.rotation.y = Math.atan2(-tan.x, -tan.z) + (d.tourne || 0);
        /* Une fois la scene POSEE et ORIENTEE, elle peut conformer ce qui
           doit l'etre au relief — flaques de gyrophare, trainees de feu.
           L'ordre compte : avant l'orientation, on echantillonnerait le sol
           aux mauvais endroits. */
        if (o.userData.poser) {
          this.groupe.updateWorldMatrix(true, false);
          o.updateMatrixWorld(true);
          o.userData.poser(relief);
        }
      }
      o.visible = false;
      this.groupe.add(o);
      this.scenes.push({ ...d, objet: o, ouverte: false });
    }
  }

  /* Le moteur audio des apparitions, branche une fois le contexte ouvert. */
  brancherSon(son) { this.son = son; }

  /* On ouvre la fenetre BIEN AVANT d'arriver : une apparition qu'on decouvre
     au moment ou on la depasse est deja finie.

     `cadrageBase` est le cadrage que le cerf tiendrait s'il n'y avait pas
     d'apparition — 'route' ou 'approche', ou rien du tout si l'on est dans
     une halte ou une cinematique, auquel cas tout le mecanisme d'arret
     ci-dessous se desactive de lui-meme : l'arret du cerf pour une
     apparition ne doit jamais entrer en conflit avec l'arret pour un
     cadeau. */
  maj(dt, t, cerf, camera, drone, postfx, cadrageBase) {
    const sReel = cerf.s;
    // Pour que `emettre` (ferme plus bas, sur chaque scene) puisse secouer
    // la camera sans qu'on ait a le lui passer explicitement.
    this._droneCourant = drone;
    let assombrissement = 0;
    let teinteForce = 0;
    let teinteCouleur;
    let distorsion = 0;
    let quelquUnTient = false;
    let cibleFocus = null;

    for (const sc of this.scenes) {
      /* L'ABSCISSE EFFECTIVE. Tant qu'on ne retient pas la scene, elle suit
         le cerf reel — c'est exactement le calcul d'avant. Des qu'on la
         retient (plus bas), elle continue d'avancer TOUTE SEULE, a la
         vitesse a laquelle le cerf aurait marche : la scene se joue donc
         exactement comme prevu, minutee au meme rythme, que le cerf coure
         ou qu'il se tienne immobile pendant qu'on la regarde. */
      if (sc.sEff === undefined || !sc.enArret) sc.sEff = sReel;

      const u = (sc.sEff - (sc.s - sc.avant)) / (sc.avant + sc.apres);
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
          /* La camera cesse d'etre attiree des que la scene se referme : sans
             ce relachement, elle resterait braquee sur un point maintenant
             vide jusqu'a la prochaine apparition, voire jusqu'a la halte
             suivante. Les phases de halte (PERCEE et apres) reprennent de
             toute facon la main sur `regarder` a chaque image ; ce
             relachement ne les concerne donc jamais. */
          drone?.regarder(null, 0);
          sc.enArret = false;
          sc.arretFini = false;
          sc.sEff = undefined;
        }
      }

      if (!dedans) {
        if (sc.objet.visible) sc.objet.visible = false;
        continue;
      }
      sc.objet.visible = true;
      /* L'ABSCISSE DU CERF EST PASSEE AUX SCENES. Une apparition immobile
         n'en a que faire, mais celle qui se DEPLACE le long du chemin — la
         course-poursuite — a besoin de savoir ou l'on en est pour se placer
         par rapport a nous. */
      const uu = clamp(u, 0, 1);
      sc.objet.userData.jouer(uu, t, camera, sc.s, dt);

      /* LE CERF S'ARRETE POUR LA REGARDER — SAUF CE QUI COURT DEJA TOUT SEUL.
         Une poursuite de police ou un theropode en marche sont choregraphies
         pour un observateur qui AVANCE : ils parcourent leurs quarante a
         soixante-dix metres pendant que la camera les longe, restant a peu
         pres a distance constante. Le cerf arrete, cette distance n'est plus
         bornee par rien — l'engin continue son trajet tout seul, s'eloigne
         sans plus jamais revenir, et la moitie de l'arret se passe braquee
         sur un point vide (mesure faite : les voitures sortent du champ des
         146 m et y restent sept secondes). Ces scenes-la gardent donc leur
         defile d'origine, deja regle ; seules celles qui restent SUR PLACE
         meritent qu'on s'y arrete.

         Declenche a une distance fixe de l'ancre — plafonnee a la moitie de
         l'amorce de la scene, pour qu'une fenetre courte (Shining, decouverte
         a dessein) ne force pas un freinage qui deborderait sur ce qui la
         precede. Une fois retenue, la scene ne l'est qu'UNE fois : `arretFini`
         empeche un second freinage si jamais on repassait par la
         (recommencer()). */
      if (cadrageBase && !sc.arretFini && !sc.objet.userData.suitChemin) {
        const rayon = Math.min(14, sc.avant * 0.5);
        if (!sc.enArret && sReel >= sc.s - rayon) {
          sc.enArret = true;
          /* LE CIEL A BESOIN D'UN AUTRE CADRAGE. « apparition » decale
             fortement la camera de cote — le bon choix pour un personnage
             plante en bordure de chemin, mais un contresens pour la lune ou
             Gargantua : centres sur l'axe (cote:0), places tres loin, ils
             sortent purement et simplement du cadre des qu'on s'ecarte
             autant. Ces scenes-la gardent donc le cadrage de croisiere. */
          this._holdVersLeCiel = !!sc.objet.userData.suitCamera;
        }
        if (sc.enArret) {
          quelquUnTient = true;
          sc.sEff += dt * this._vitesseVirtuelle;
          if (sc.sEff >= sc.s + sc.apres) { sc.enArret = false; sc.arretFini = true; }
        }
      }

      /* LA CAMERA REGARDE VERS L'ACTION. Une apparition qu'on croise sans que
         le drone y prete attention se lit a peine, en peripherie de cadre —
         alors que le plan de drone la doit precisement chercher, comme un
         operateur qui reagit a ce qui bouge. On tire donc le point vise vers
         la scene active pendant toute sa fenetre, avec une force qui monte
         puis redescend : jamais un a-coup a l'ouverture. A l'arret, on pousse
         bien plus fort — plus rien ne s'oppose a un cadrage compose,
         puisqu'il n'y a plus de trajectoire a suivre en meme temps. */
      if (drone) {
        const pic = sc.enArret ? 0.88 : 0.6;
        const force = smoothstep(0, 0.16, uu) * smoothstep(1, 0.80, uu) * pic;
        if (force > 0.001) {
          /* La plupart des scenes placent leur GROUPE RACINE a l'endroit
             meme qu'elles occupent, et sa position suffit donc a designer
             ou regarder. Ce n'est pas vrai de toutes : une scene « suitCamera »
             dont les elements sont chacun positionnes independamment (le
             disque de Gargantua, loin dans le ciel ; l'astronaute, pres du
             sol) peut laisser sa racine a l'origine du monde — auquel cas
             viser `sc.objet.position` braque la camera vers un point vide,
             souvent a l'oppose de la scene reelle. Ces scenes-la exposent
             donc leur propre `pointRegard`, tenu a jour a la meme place que
             ce qu'elles montrent. */
          this._viseeInteret.copy(sc.objet.userData.pointRegard || sc.objet.position);
          drone.regarder(this._viseeInteret, force);
          /* LA MISE AU POINT SUIT LE MEME POINT, MAIS SEULEMENT A L'ARRET.
             Pendant une simple traversee, le plan de nettete doit rester sur
             le cerf — sans quoi l'image entiere se brouille a chaque
             apparition croisee en marchant. A l'arret, en revanche, rien ne
             s'oppose plus a un point de vue compose : la mise au point
             glisse vers ce qu'on regarde vraiment, comme un vrai
             point-tire de cinema. */
          if (sc.enArret) cibleFocus = sc.objet.userData.pointRegard || sc.objet.position;
        }
      }

      /* L'ASSOMBRISSEMENT D'UNIVERS. Certaines scenes — le duel de sabres —
         doivent faire sentir qu'on bascule ailleurs, pas seulement montrer
         un decor de plus. `assombrit` porte la force maximale voulue par la
         scene ; l'enveloppe (monte/descend avec la fenetre) est la meme
         logique que pour le regard camera, appliquee cette fois a l'image
         entiere plutot qu'au cadrage. */
      if (sc.assombrit) {
        const env = smoothstep(0, 0.22, uu) * smoothstep(1, 0.72, uu);
        assombrissement = Math.max(assombrissement, env * sc.assombrit);
      }

      /* MEME PRINCIPE, MAIS AU RYTHME DE LA SCENE ELLE-MEME plutot qu'a celui
         de sa fenetre entiere : l'ascenseur de Shining ne doit assombrir et
         teinter l'image qu'au moment precis ou le sang jaillit, pas pendant
         toute son ouverture. La scene ecrit donc elle-meme ces valeurs dans
         son `userData` a chaque image, et on les relit ici. */
      if (sc.objet.userData.assombritDyn) {
        assombrissement = Math.max(assombrissement, sc.objet.userData.assombritDyn);
      }
      if (sc.objet.userData.teinteForceDyn) {
        teinteForce = Math.max(teinteForce, sc.objet.userData.teinteForceDyn);
        teinteCouleur = sc.objet.userData.teinteDyn ?? teinteCouleur;
      }
      if (sc.objet.userData.distorsionDyn) {
        distorsion = Math.max(distorsion, sc.objet.userData.distorsionDyn);
      }
    }

    /* LA BASCULE ARRET / REPRISE, une seule fois par changement d'etat — pas
       a chaque image, sans quoi `cadrer` et `arc` recevraient sans cesse la
       meme consigne (inoffensif, mais inutile) et surtout la vitesse
       sauvegardee se ferait ecraser par du zero des la deuxieme image de
       l'arret. */
    if (cadrageBase) {
      if (quelquUnTient && !this._enArret) {
        this._enArret = true;
        this._vitesseAvantArret = cerf.vitesseCible;
        cerf.vitesseCible = 0;
        // Le sens de l'orbite alterne d'une apparition a l'autre, comme aux
        // haltes : sans quoi les douze arrets tournent tous du meme cote.
        this._sensArc *= -1;
        drone.cadrer(this._holdVersLeCiel ? cadrageBase : 'apparition');
        drone.arc(this._sensArc * 0.05, 0.10);
      } else if (!quelquUnTient && this._enArret) {
        this._enArret = false;
        cerf.vitesseCible = this._vitesseAvantArret ?? cerf.vitesseCible;
        drone.cadrer(cadrageBase);
        drone.arc(0, 0);
      }
    }

    postfx?.assombrir(assombrissement, dt);
    postfx?.teinter(teinteCouleur, teinteForce, dt);
    postfx?.distordre(distorsion, dt);
    // Lu par `main.js` pour le point-tire de mise au point : voir plus haut.
    this.cibleFocus = cibleFocus;
  }
}
