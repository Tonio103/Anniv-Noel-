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
import { REPERES, piste, appliquerPose, regarderVers } from './humanoide.js';
import { creerSpider, POSES } from './spider.js';
import { creerDuelliste, GARDES } from './encapuchonne.js';

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

  /* CE QUI MANQUAIT VRAIMENT : LA NEIGE NE REAGISSAIT PAS.

     Deux halos qui clignotent dans le noir, c'est une guirlande. Ce qui
     fait « voiture de police », c'est que TOUT AUTOUR bat au meme rythme —
     le sol vire au bleu puis au rouge, et deux rayons balaient les troncs.
     C'est la reaction du decor qui donne l'echelle et la puissance, jamais
     la lampe elle-meme. */
  /* DES COULEURS TRES SATUREES, ET C'EST UNE OBLIGATION, PAS UN GOUT.

     Une lumiere additive posee sur de la neige — donc sur du presque blanc
     — remonte les TROIS canaux, et le resultat vire au blanc lavande : on
     voit que ca s'eclaire, on ne voit pas de quelle couleur. Verifie en
     vue de dessus, ou la flaque est parfaitement lisible mais pale. Pour
     qu'une couleur survive, il faut lui retirer presque tout ce qui n'est
     pas elle. */
  const solBleu = flaque([0.04, 0.26, 2.3], 15, 1.7);
  const solRouge = flaque([2.3, 0.05, 0.04], 15, 1.7);
  solBleu.position.z = 0.6;
  solRouge.position.z = 0.6;
  g.add(solBleu, solRouge);
  /* Les deux flaques doivent suivre le devers, sans quoi elles s'enterrent
     — voir `epouserLeSol`, qui raconte precisement ce qui se passait. */
  g.userData.poser = (relief) => {
    epouserLeSol(solBleu, relief, 0.10);
    epouserLeSol(solRouge, relief, 0.11);
  };

  /* Les deux rayons tournent en sens INVERSE l'un de l'autre. Sur une vraie
     rampe ils tournent dans le meme sens, mais alors ils se suivent et l'on
     ne voit jamais qu'un balayage ; opposes, ils se croisent devant la
     voiture a chaque tour, et c'est ce croisement qui accroche l'oeil. */
  const rayonBleu = faisceau([0.24, 0.60, 2.3], 21, 2.8);
  const rayonRouge = faisceau([2.3, 0.28, 0.22], 21, 2.8);
  for (const r of [rayonBleu, rayonRouge]) {
    r.position.set(0, 1.70, -0.15);
    /* L'ordre compte : on veut d'abord tourner (le lacet), puis pencher
       DANS le repere deja tourne, comme une tourelle. Dans l'ordre par
       defaut, l'inclinaison se fait autour d'un axe fixe et le faisceau
       plonge dans le sol d'un cote, part vers le ciel de l'autre. */
    r.rotation.order = 'YXZ';
    g.add(r);
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
    const fB = cote ? bat : 0.06;
    const fR = cote ? 0.06 : bat;
    bleu.material.opacity = vis * fB;
    rouge.material.opacity = vis * fR;

    /* La flaque suit le battement mais garde toujours un fond : la neige
       eclairee une fois reste un peu chaude a l'oeil, et un sol qui
       s'eteint completement entre deux eclats scintille desagreablement. */
    solBleu.material.opacity = vis * (0.10 + fB * 0.42);
    solRouge.material.opacity = vis * (0.10 + fR * 0.42);

    rayonBleu.rotation.y = t * 2.4;
    rayonRouge.rotation.y = -t * 2.4 + Math.PI;
    /* Un rayon qui pointe vers la camera eblouit et remplit l'ecran d'une
       tache plate ; on le laisse donc respirer un peu de haut en bas, ce qui
       casse cette symetrie et donne du relief au balayage. */
    rayonBleu.rotation.x = Math.sin(t * 0.9) * 0.09 - 0.06;
    rayonRouge.rotation.x = Math.sin(t * 0.9 + 2.1) * 0.09 - 0.06;
    rayonBleu.material.opacity = vis * (0.16 + fB * 0.30);
    rayonRouge.material.opacity = vis * (0.16 + fR * 0.30);
  };
  return g;
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
  const pivot = new THREE.Group();
  pivot.add(perso);

  /* IL PENDAIT SOUS LA NEIGE, PUIS PAR LE VENTRE. Deux corrections
     successives, dont voici le compte definitif : le groupe est pose AU SOL,
     le personnage est retourne d'un demi-tour autour de Z — donc ses pieds
     restent a la hauteur qu'on lui donne et sa tete descend d'un metre
     soixante-dix-huit en dessous. On accroche les chevilles a 3,55 m : la
     tete arrive alors a 1,77 m, pile a hauteur de regard du drone. */
  const CHEVILLES = 3.55;
  perso.rotation.z = Math.PI;
  perso.position.y = CHEVILLES;

  const fil = filDeToile(3.4);
  fil.position.y = CHEVILLES + 1.70;
  pivot.add(fil);
  g.add(pivot);

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
  ancre.position.y = 9.2;

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
  const ACCROCHE = new THREE.Vector3(-porteeX * 0.85, 11.5, -17);
  const _poignet = new THREE.Vector3();
  const _bout = new THREE.Vector3();

  let tirFait = false;
  g.userData.reinit = () => { tirFait = false; };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.08, u) * smoothstep(1, 0.90, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    sequence(os, u);

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
    /* Le corps se redresse au point bas et se couche aux extremites : c'est
       ce qu'un pendule vivant fait de son bassin, et c'est ce qui empeche la
       silhouette de rester raide comme un pendu. */
    perso.rotation.x = -0.30 + Math.abs(a) * 0.28;

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
    disque.material.opacity = vis * 0.55;
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
    /* Descendu de trente-quatre a vingt-neuf metres apres avoir regarde
       l'image : a 7,3° la silhouette frolait le bord haut du cadre en
       paysage, et l'on ne peut pas compter sur le format portrait du
       telephone pour la rattraper. A 6,3°, elle est franchement dans le
       ciel sans jamais toucher la ligne d'arbres. */
    g.position.y = camera.position.y + 29;
    g.lookAt(camera.position);

    /* LA TRAVERSEE PASSAIT A COTE DE LA LUNE. Le disque mesure cinquante-
       huit unites de large, mais son coeur clair n'en fait qu'une quinzaine
       — le reste est une diffusion qui s'eteint. Une course de soixante-
       quatorze unites promenait donc le velo sur le halo et jamais devant
       l'astre. Vingt-six, et la silhouette traverse le disque lui-meme,
       ce qui est tout le sujet du plan. */
    velo.position.set((u - 0.5) * 26, 2 + Math.sin(t * 0.8) * 1.2, 1);
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
  const l = new THREE.Mesh(
    new THREE.CapsuleGeometry(R, LONG, 4, 8),
    new THREE.MeshBasicMaterial({ color: 0xF2FFF6 })
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
  void couleur;
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

  /* Les trois temps de la passe d'armes, joues en boucle. Chaque duelliste
     lit la meme piste, decalee d'un demi-temps : quand l'un frappe, l'autre
     recule, et c'est ce contretemps qui fait lire un echange plutot que deux
     gymnastiques paralleles. */
  const passeGauche = piste([
    { t: 0.00, pose: GARDES.garde },
    { t: 0.42, pose: GARDES.frappe },
    { t: 0.56, pose: GARDES.frappe },
    { t: 0.80, pose: GARDES.recul },
    { t: 1.00, pose: GARDES.garde },
  ]);
  const passeDroite = piste([
    { t: 0.00, pose: GARDES.recul },
    { t: 0.30, pose: GARDES.garde },
    { t: 0.46, pose: GARDES.frappe },
    { t: 0.58, pose: GARDES.frappe },
    { t: 0.86, pose: GARDES.recul },
    { t: 1.00, pose: GARDES.recul },
  ]);

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

    /* LE CORPS ENTIER JOUE LA PASSE. La piste enchaine garde, frappe et
       recul sur seize os ; l'ancienne version ne bougeait qu'une epaule, et
       c'est pour cela qu'on voyait deux batons plutot que deux escrimeurs. */
    passeGauche(gauche.userData.os, passe);
    passeDroite(droite.userData.os, passe);

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

function traineesDeFeu(longueur) {
  const g = new THREE.Group();
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
    for (const b of bandes) b.material.opacity = allume * 1.15 * scint;
    front.material.opacity = smoothstep(0, 0.04, u) * smoothstep(0.34, 0.10, u) * 0.9;
    g.visible = allume > 0.01;

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
function cerfDeLumiere() {
  const g = new THREE.Group();
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
function trioSpider(palier) {
  const g = new THREE.Group();
  const R = 1.50;                       // rayon du triangle
  const persos = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p = creerSpider(palier, { ombres: palier.ombres, variante: 'trio' });
    p.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);

    /* Chacun regarde le suivant : c'est cet alignement, et lui seul, qui
       fait lire la scene. Un triangle de personnages qui regardent ailleurs
       n'est qu'un attroupement.

       ILS NE SE REGARDAIENT PAS. L'ancien calcul valait un quart de tour de
       trop : les trois pointaient a cote, ce qui rendait la scene
       proprement incomprehensible. Le personnage regarde vers -Z, donc
       viser une direction (dx, dz) demande atan2(-dx, -dz) — et rien
       d'autre. */
    const b = ((i + 1) / 3) * Math.PI * 2;
    const dx = (Math.cos(b) - Math.cos(a)) * R;
    const dz = (Math.sin(b) - Math.sin(a)) * R;
    p.rotation.y = Math.atan2(-dx, -dz);

    const os = p.userData.os;
    appliquerPose(os, POSES.pointe);
    /* Trois exemplaires strictement identiques se lisent comme trois copies
       collees. On decale donc legerement chacun — le bras un peu plus haut
       ou plus bas, l'appui sur une jambe ou sur l'autre, la tete a peine
       tournee. Ce sont des ecarts de quelques degres, et ils suffisent a
       faire trois individus. */
    const d = (i - 1) * 0.055;
    os.brasD.rotation.x += d;
    os.brasD.rotation.z += d * 0.5;
    os.avantD.rotation.x += Math.abs(d) * 0.6;
    os.colonne.rotation.z += d * 0.4;
    os.tete.rotation.y += d * 1.2;
    os.tete.rotation.z += d * 0.5;
    os.cuisseD.rotation.z += d * 0.3;

    g.add(p);
    persos.push(p);
  }

  /* CHACUN SUR SON PROPRE SOL. Le groupe est pose a la hauteur du terrain en
     son centre, mais les trois sont repartis sur un triangle de trois metres
     de cote : sur un devers, celui d'amont s'enfonce et celui d'aval flotte.
     On releve donc la hauteur reelle sous chaque paire de pieds. */
  g.userData.poser = (relief) => {
    g.updateWorldMatrix(true, false);
    const y0 = g.position.y;
    const p = new THREE.Vector3();
    for (const perso of persos) {
      p.copy(perso.position).applyMatrix4(g.matrixWorld);
      perso.position.y = relief.hauteur(p.x, p.z) - y0;
    }
  };

  g.userData.jouer = (u) => {
    const vis = smoothstep(0, 0.12, u) * smoothstep(1, 0.86, u);
    g.visible = vis > 0.01;
    /* Aucune animation. C'est le sujet : leur RAIDEUR est ce qui rend la
       scene inquietante, et une animation les rendrait seulement rigolos. */
    void persos;
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
    { nom: 'police',   s: L * 0.09, cote: -1, ecart: 6.5, avant: 42, apres: 10, tourne: 0.6, degage: 7.5 },
    { nom: 'spider1',  s: L * 0.21, cote: -1, ecart: 3.5, avant: 30, apres: 8,  degage: 5.5 },
    { nom: 'et',       s: L * 0.33, cote:  0, ecart: 0,   avant: 34, apres: 24, degage: 0 },
    { nom: 'sabres',   s: L * 0.45, cote: -1, ecart: 4.5, avant: 40, apres: 10, degage: 6.5 },
    { nom: 'trio',     s: L * 0.57, cote: -1, ecart: 7.0, avant: 34, apres: 10, tourne: 0.4, degage: 5.5 },
    { nom: 'patronus', s: L * 0.68, cote: -1, ecart: 5.5, avant: 38, apres: 12, degage: 8.0 },
    { nom: 'spider2',  s: L * 0.79, cote: -1, ecart: 3.0, avant: 28, apres: 8,  degage: 7.0 },
    { nom: 'delorean', s: L * 0.90, cote:  0, ecart: 0,   avant: 34, apres: 8,  degage: 4.0 },
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
      police: () => voiturePolice(),
      spider1: () => spiderSuspendu(palier),
      et: () => etDevantLaLune(),
      sabres: () => duelSabres(palier),
      trio: () => trioSpider(palier),
      patronus: () => patronus(),
      spider2: () => spiderBalance(9, palier),
      delorean: () => traineesDeFeu(26),
    };
    const plan = planApparitions(L).map((d) => ({ ...d, faire: FABRIQUES[d.nom] }));

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
