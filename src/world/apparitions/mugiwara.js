import * as THREE from 'three';
import { smoothstep, clamp } from '../../core/noise.js';
import {
  construireCorps, nouvelleInstance, appliquerPose, regarderVers,
} from '../humanoide.js';
import {
  halo, ondeChoc, majOndeChoc, gerbeImpact, majImpact,
} from './communs.js';

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

   CETTE PASSE-CI REPREND L'IDEE DEJA NOTEE ET JAMAIS TENTEE : « le poing
   qui revient en frappant quelque chose, gerbe de neige a l'impact ». Le
   coup unique devient un vrai ENCHAINEMENT en trois temps :

     1. LE CROCHET DROIT — un grand geste, lance, qui porte loin.
     2. LE DIRECT GAUCHE — le meme geste, en miroir, decale dans le temps.
     3. « GOMU GOMU NO GATLING » — la signature ultime du personnage, une
        rafale de coups courts et rapides, alternant les deux poings, qui
        n'existait pas du tout dans la version precedente et qui est LA
        chose qu'un spectateur qui connait la serie attend de voir.

   Chacun des trois temps se conclut par un vrai IMPACT : une gerbe de
   neige/glace qui gicle au point d'extension maximale, et un choc camera,
   via le meme canal generique `emettre` qu'utilisent deja le duel de
   sabres et Kill Bill. Un poing qui vole vers l'objectif sans jamais rien
   y rencontrer se lisait comme un geste dans le vide ; un impact, meme
   sans adversaire visible, le fait lire comme un coup PORTE.

   AU-DELA DU COMBAT : la scene gagne aussi une petite trainee de mouvement
   sur chaque poing (l'etirement se voit mieux s'il laisse une trace), un
   temps d'arrivee — un leger tassement dans la neige au tout premier
   instant, comme un personnage qui vient de sauter dans le champ — et un
   habitant discret de la foret : un Den Den Mushi, l'escargot-telephone de
   la serie, pose dans la neige a cote, qui sursaute a chaque impact. Une
   reference dans la reference, jamais au centre du cadre. */
const ROUGE_VESTE = new THREE.Color(0xB0271E);
const BLEU_SHORT = new THREE.Color(0x28345A);
const PEAU_LUFFY = new THREE.Color(0xE0A876);
const SANDALE_LUFFY = new THREE.Color(0x4A3320);
const CICATRICE = new THREE.Color(0x8A5A42);

/* LA CICATRICE. Un trait sombre sous l'oeil gauche — le signe le plus
   discret possible, et pourtant l'un des plus reconnaissables du
   personnage une fois qu'on sait le chercher. Peinte par position, comme
   le reste du costume : une bande etroite en Z (le cote du visage) et une
   plage resserree en Y (juste sous l'oeil), pas assez large pour se lire
   comme une salissure. */
function teinteLuffy(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG') { c.copy(SANDALE_LUFFY); return; }
  if (os === 'cuisseD' || os === 'cuisseG') { c.copy(BLEU_SHORT); return; }
  if (os === 'colonne' || os === 'poitrine') { c.copy(ROUGE_VESTE); return; }
  if (os === 'tete' && x < -0.02 && x > -0.075 && y > 1.245 && y < 1.275 && z < -0.03) {
    c.copy(CICATRICE);
    return;
  }
  c.copy(PEAU_LUFFY);
  void y; void z;
}

/* LE CHAPEAU DE PAILLE. Trois pieces suffisaient a le nommer ; celui-ci
   ajoute la frange effrangee du bord — de vrais chapeaux de paille
   n'ont jamais un contour parfaitement lisse — et le cordon de menton qui
   pend sur le cote, visible meme quand le chapeau est simplement pose sur
   la tete plutot que tenu par le vent. */
function chapeauPaille() {
  const g = new THREE.Group();
  const paille = new THREE.MeshStandardMaterial({ color: 0xE3C468, roughness: 0.88 });
  const pailleSombre = new THREE.MeshStandardMaterial({ color: 0xC9A850, roughness: 0.9 });
  const bandeau = new THREE.MeshStandardMaterial({ color: 0xA8222A, roughness: 0.6 });
  const cordon = new THREE.MeshStandardMaterial({ color: 0x8A6A38, roughness: 0.8 });

  const bord = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 6, 16), paille);
  bord.rotation.x = Math.PI / 2;
  g.add(bord);
  const calotte = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.20, 10, 1, true), paille);
  calotte.position.y = 0.10;
  g.add(calotte);
  const ruban = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.045, 10), bandeau);
  ruban.position.y = 0.015;
  g.add(ruban);

  /* LA FRANGE. De petites esquilles de paille qui depassent du bord,
     irregulieres en longueur et en angle — c'est ce desordre, precisement,
     qui distingue un vrai chapeau de paille d'un disque peint en jaune. */
  for (let i = 0; i < 16; i++) {
    const az = (i / 16) * Math.PI * 2;
    const long = 0.03 + ((i * 7) % 5) * 0.006;
    const brin = new THREE.Mesh(new THREE.ConeGeometry(0.006, long, 3), i % 3 ? paille : pailleSombre);
    brin.position.set(Math.cos(az) * 0.335, -0.005 + ((i * 3) % 4) * 0.004, Math.sin(az) * 0.335);
    brin.rotation.z = Math.PI / 2;
    brin.rotation.y = -az;
    g.add(brin);
  }

  /* LE CORDON DE MENTON. Deux segments qui partent du bord et se
     rejoignent sous le menton, avec un leger mou — un cordon tendu au
     carre se lirait comme une sangle rigide plutot que comme une corde. */
  const noeud = new THREE.Vector3(0, -0.34, 0.08);
  for (const sx of [-1, 1]) {
    const depart = new THREE.Vector3(sx * 0.30, -0.02, 0.10);
    const l = depart.distanceTo(noeud);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, l, 5), cordon);
    seg.position.copy(depart).add(noeud).multiplyScalar(0.5);
    seg.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(noeud, depart).normalize());
    g.add(seg);
  }
  return g;
}

/* --------------------------------------------------------------------------
   LE DETAIL DU COSTUME.

   Le buste generique de `humanoide.js` teinte le gilet et le short en
   aplat — juste assez pour se reperer, pas assez pour se lire comme un
   VETEMENT. A la distance ou cette scene se regarde, sans un liseret qui
   marque l'ouverture du gilet, gilet et peau se confondent en un seul
   aplat rouge continu ; et Luffy porte un short retenu par une simple
   corde, jamais une boucle de cuir. Deux ajouts bon marche, tous deux en
   geometrie posee sur les os plutot qu'en peinture sur la peau — comme le
   chapeau, ils bougent avec le squelette sans aucun calcul de plus.
   -------------------------------------------------------------------------- */
function detailCostume(os) {
  const cordeMat = new THREE.MeshStandardMaterial({ color: 0x6B4A2A, roughness: 0.85 });
  const liseretMat = new THREE.MeshStandardMaterial({ color: 0x7A1812, roughness: 0.6 });

  // La ceinture : une simple corde nouee, pas une boucle de cuir.
  const ceinture = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.014, 6, 16), cordeMat);
  ceinture.rotation.x = Math.PI / 2;
  ceinture.position.y = -0.02;
  os.bassin.add(ceinture);
  // Le noeud qui pend sur le cote, deux brins courts.
  for (const dz of [-1, 1]) {
    const brin = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.008, 0.10, 5), cordeMat);
    brin.position.set(0.16, -0.06, dz * 0.02);
    brin.rotation.z = 0.15 * dz;
    os.bassin.add(brin);
  }

  /* Le liseret du gilet ouvert : deux bandes fines qui descendent en V
     depuis les epaules, seul indice visible que le gilet est porte ouvert
     plutot que peint directement sur la peau — a cette distance de camera,
     sans ce liseret, veste et peau se confondraient en un seul aplat rouge. */
  for (const sx of [-1, 1]) {
    const bande = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.30, 0.02), liseretMat);
    bande.position.set(sx * 0.10, 0.02, 0.13);
    bande.rotation.z = sx * 0.18;
    os.poitrine.add(bande);
  }
}

const _elDir = new THREE.Vector3();
const _elUp = new THREE.Vector3(0, 1, 0);

/* Le bras : un cylindre tendu entre l'epaule et le poing, redimensionne et
   oriente chaque image — jamais un os anime, toujours une piece a part. */
function busteElastique(couleur) {
  const geoTube = new THREE.CylinderGeometry(0.075, 0.11, 1, 10, 10, true);
  geoTube.translate(0, 0.5, 0);
  /* UN CYLINDRE PARFAITEMENT LISSE SE LIT COMME UN TUYAU, PAS COMME UN
     MEMBRE ETIRE — exactement le defaut qu'Antoine designe en demandant
     de la « vraie 3D, pas juste des carres et des triangles ». Une legere
     ondulation radiale, en phase avec la hauteur locale ET l'angle autour
     du tube, donne au cylindre la torsion visible d'un vrai elastique
     tendu au lieu d'une primitive nue. Elle est definie en coordonnees
     NORMALISEES (avant l'etirement de `tendreElastique`) : au repos, le
     bras porte environ trois tours visibles ; totalement lance, le meme
     nombre de tours s'etale sur six metres, exactement comme un vrai
     elastique dont les plis s'espacent en s'etirant. Discrete — quatre
     pour cent du rayon — assez pour se voir en silhouette rasante,
     jamais assez pour ressembler a une vis. */
  const pos = geoTube.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const onde = 1 + Math.sin(y * 17 + a * 3) * 0.04;
    pos.setX(i, Math.cos(a) * r * onde);
    pos.setZ(i, Math.sin(a) * r * onde);
  }
  geoTube.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: couleur, roughness: 0.72, emissive: new THREE.Color(couleur), emissiveIntensity: 0,
  });
  const tube = new THREE.Mesh(geoTube, mat);
  tube.visible = false;
  const poing = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), mat);
  poing.visible = false;
  const g = new THREE.Group();
  g.add(tube, poing);
  g.userData = { tube, poing, mat };
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

/* --------------------------------------------------------------------------
   LA TRAINEE DE MOUVEMENT.

   Un poing qui parcourt six metres en un dixieme de seconde, rendu comme un
   simple solide plein, se lit comme un poing qui TELEPORTE d'une image a
   l'autre — l'oeil n'a rien pour relier la position d'avant a celle
   d'apres. Une petite poignee de fantomes, poses aux positions RECENTES du
   poing et qui s'effacent avec l'age, comble ce vide : c'est la meme
   astuce que les jeux de combat emploient pour un coup rapide, et elle ne
   coute qu'une poignee de spheres additives sans texture.

   L'historique se decale d'un cran a chaque image plutot que d'echantillonner
   a intervalle fixe : plus simple, et suffisant a cette vitesse — le poing
   ne bouge presque pas d'une image a l'autre pendant l'armement, et
   beaucoup pendant le tir, ce qui est exactement le moment ou la trainee
   doit s'allonger. */
function traineeElastique(n, couleurHex) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.13, 0);
  const fantomes = [];
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: couleurHex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    });
    const m = new THREE.Mesh(geo, mat);
    g.add(m);
    fantomes.push(m);
  }
  const historique = Array.from({ length: n }, () => new THREE.Vector3());
  g.userData = { fantomes, historique };
  return g;
}

function majTrainee(trainee, poingPos, intensite) {
  const { fantomes, historique } = trainee.userData;
  const n = fantomes.length;
  for (let i = n - 1; i > 0; i--) historique[i].copy(historique[i - 1]);
  historique[0].copy(poingPos);
  for (let i = 0; i < n; i++) {
    fantomes[i].position.copy(historique[i]);
    const age = i / (n - 1);
    fantomes[i].material.opacity = intensite * (1 - age) * (1 - age) * 0.30;
  }
}

/* LA GERBE D'IMPACT — `gerbeImpact()`/`majImpact()`, importees de
   `communs.js`. Nee ici (le poing qui gicle de la glace/poudreuse a
   l'impact, meme technique que la gerbe de debris de la course-poursuite
   de police ou l'embardee du moineau chez Spider-Man), puis remontee au
   moment ou le duel de sabres en a eu besoin a son tour, avec ses propres
   couleurs et sa propre echelle (des etincelles, pas des eclats de
   glace).

   LA MEME GERBE SERT AUX QUATRE DECLENCHEURS DE CETTE SCENE (l'arrivee,
   les deux gros coups, chacun des coups de la rafale) : elle se
   REPOSITIONNE a chaque declenchement plutot que d'exister en plusieurs
   exemplaires, puisqu'aucun des evenements ne chevauche un autre dans le
   temps — voir les fenetres de `jouer()` plus bas. */

/* L'ONDE DE CHOC AU SOL — `ondeChoc()`/`majOndeChoc()`, importees de
   `communs.js`. Nee ici (un anneau additif qui nait sous les pieds du
   personnage, s'elargit d'un bond et s'efface — la gerbe d'impact dit la
   MATIERE projetee, l'onde dit la FORCE elle-meme), puis remontee au
   moment ou Kill Bill en a eu besoin a son tour : voir le banc partage
   pour le detail. */

/* --------------------------------------------------------------------------
   LE DEN DEN MUSHI — UN HABITANT DE PLUS, DISCRET.

   La foret porte deja un hibou et un moineau chez Spider-Man (voir
   `spider1.js`) : un petit temoin qui reagit a la scene principale sans
   jamais lui faire concurrence est devenu une habitude de cette serie
   d'apparitions, et cela vaut aussi pour One Piece. Plutot qu'un second
   animal, l'escargot-telephone est LA reference en plus : n'importe qui
   connaissant la serie le reconnait, et il ne demande aucune animation de
   corps entier — juste deux tiges oculaires qui reagissent aux impacts,
   exactement comme de vraies antennes d'escargot se retractent au choc.

   La coquille est une pile d'anneaux de rayon decroissant plutot qu'une
   vraie helice : une helice correcte demanderait un maillage parametrique
   dedie pour un accessoire qui ne mesure jamais plus de quelques pixels a
   l'ecran. La silhouette conique striee suffit a la faire lire comme un
   coquillage. */
function denDenMushi() {
  const g = new THREE.Group();
  const coquilleMat = new THREE.MeshStandardMaterial({ color: 0xC9A15A, roughness: 0.55 });
  const bandeMat = new THREE.MeshStandardMaterial({ color: 0x8A6432, roughness: 0.6 });
  const peauMat = new THREE.MeshStandardMaterial({ color: 0x8FA85C, roughness: 0.75 });
  const peauClaireMat = new THREE.MeshStandardMaterial({ color: 0xA8C070, roughness: 0.75 });
  const oeilMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.3 });

  // La coquille : des anneaux empiles de rayon decroissant, plus un dome
  // au sommet — pas une vraie spirale, mais une silhouette qui en tient lieu.
  const coquille = new THREE.Group();
  const etages = 5;
  for (let i = 0; i < etages; i++) {
    const r = 0.20 * Math.pow(0.72, i);
    const anneau = new THREE.Mesh(
      new THREE.TorusGeometry(r, r * 0.34, 6, 12),
      i % 2 === 0 ? coquilleMat : bandeMat
    );
    anneau.position.y = 0.05 + i * 0.055;
    anneau.rotation.x = Math.PI / 2;
    coquille.add(anneau);
  }
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), coquilleMat);
  dome.position.y = 0.02;
  coquille.add(dome);
  coquille.position.y = 0.10;
  g.add(coquille);

  // Le corps : une capsule aplatie, museau souriant.
  const corps = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.16, 4, 8), peauMat);
  corps.rotation.z = Math.PI / 2;
  corps.position.set(0.10, 0.07, 0.16);
  g.add(corps);
  const museau = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), peauClaireMat);
  museau.position.set(0.22, 0.06, 0.16);
  museau.scale.set(1.1, 0.85, 0.9);
  g.add(museau);

  /* Les yeux, au bout de deux tiges — le trait le plus reconnaissable de
     la creature. Chaque tige est un pivot independant : c'est lui qui
     porte le balancement d'ambiance ET le sursaut au choc, jamais la tige
     elle-meme qui n'a pas d'origine de rotation utile. */
  const tiges = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.16, 0.14, 0.16 + sx * 0.05);
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.11, 5), peauMat);
    tige.position.y = 0.055;
    pivot.add(tige);
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), oeilMat);
    oeil.position.y = 0.11;
    pivot.add(oeil);
    g.add(pivot);
    tiges.push(pivot);
  }

  g.userData = { tiges, basePhase: Math.random() * 10 };
  g.scale.setScalar(0.62);
  return g;
}

/* Une flaque de neige aplatie, pour que la creature ait l'air posee dans
   la congere plutot que flottant au-dessus. */
function monticuleNeige(rayon) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(rayon, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xF3F6FA, roughness: 0.92 })
  );
  m.scale.y = 0.45;
  return m;
}

function majDenDenMushi(g, t, sursaut) {
  const { tiges, basePhase } = g.userData;
  // Balancement d'ambiance lent, independant du combat — c'est lui qui
  // signale que la creature est VIVANTE quand rien d'autre ne se passe.
  const balance = Math.sin(t * 1.3 + basePhase) * 0.10;
  for (let i = 0; i < tiges.length; i++) {
    const signe = i === 0 ? 1 : -1;
    tiges[i].rotation.z = balance - signe * 0.05 - sursaut * 0.35 * signe;
    tiges[i].rotation.x = -sursaut * 0.25;
  }
  // Un leger tassement au moment du sursaut : la creature se ratatine sur
  // elle-meme, comme n'importe quel mollusque surpris.
  g.scale.setScalar(0.62 * (1 - sursaut * 0.06));
}

let _corpsLuffy = null;

export function mugiwara(palier) {
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

  // Plante, jambes ecartees, les deux epaules legerement reculees — ni
  // l'une ni l'autre n'est au repos, puisque toutes deux vont frapper.
  appliquerPose(os, {
    cuisseD: [-0.18, 0, 0.14], molletD: [0.10, 0, 0],
    cuisseG: [-0.18, 0, -0.14], molletG: [0.10, 0, 0],
    colonne: [0.06, 0.08, 0], poitrine: [0.04, 0.05, 0],
  });

  const chapeau = chapeauPaille();
  chapeau.position.set(0, 0.30, 0.02);
  os.tete.add(chapeau);
  detailCostume(os);

  /* DEUX ELASTIQUES, PAS UN SEUL. Le meme couple sert aux deux gros coups
     ET a la rafale finale — un seul jeu de tube/poing par bras, jamais
     deux poings en meme temps du meme cote, donc jamais besoin d'un
     troisieme jeu. */
  const elastiqueD = busteElastique(PEAU_LUFFY.getHex());
  const elastiqueG = busteElastique(PEAU_LUFFY.getHex());
  g.add(elastiqueD, elastiqueG);
  const origineD = new THREE.Vector3(), cibleD = new THREE.Vector3();
  const origineG = new THREE.Vector3(), cibleG = new THREE.Vector3();

  // La trainee de chaque poing, cinq fantomes chacune : assez pour lire un
  // mouvement, trop peu pour couter quoi que ce soit de mesurable.
  const traineeD = traineeElastique(5, PEAU_LUFFY.getHex());
  const traineeG = traineeElastique(5, PEAU_LUFFY.getHex());
  g.add(traineeD, traineeG);

  /* La gerbe d'impact est unique et se replace a chaque coup — inutile
     d'en garder quatre, aucun des declencheurs ne recouvre un autre dans
     le temps. Elle vit directement dans le groupe, en coordonnees deja
     proches de la camera : tous les coups visent sensiblement le meme
     point devant le personnage. */
  const impact = gerbeImpact(palier.nom === 'bas' ? 20 : 34);
  g.add(impact);

  // L'onde de choc au sol, sous les pieds : voir `ondeChoc` plus haut.
  const onde = ondeChoc();
  onde.position.set(0, 0.03, 0.10);
  g.add(onde);

  /* LA MONTEE EN PUISSANCE. Un simple halo, deja disponible dans les
     helpers partages, pose autour du buste et dont l'opacite grimpe juste
     avant la rafale puis retombe d'un coup a son declenchement — l'anime
     classique : un temps de charge visible avant l'explosion de vitesse,
     qui fait lire la rafale comme une TECHNIQUE plutot que comme une
     simple acceleration des coups precedents. */
  const aura = halo([1.0, 0.86, 0.55], 2.4, 1.3);
  aura.position.set(0, 1.15, 0);
  g.add(aura);

  // Le compagnon, pose a cote — jamais devant, jamais dans l'axe des coups.
  const denDen = denDenMushi();
  denDen.position.set(-1.35, 0, 0.55);
  const socle = monticuleNeige(0.30);
  socle.position.set(-1.35, -0.02, 0.55);
  g.add(socle, denDen);

  /* Chaque coup ne declenche son impact qu'UNE fois. `reinit` remet tout
     a plat si jamais la balade recommence — sans lui, un second passage
     verrait les gerbes rejouer leur fin de vie au lieu de repartir de
     zero, et la rafale reprendrait au milieu de sa sequence. */
  let piedPuffFait = false;
  let impactDFait = false, impactGFait = false;
  let derniereImpactT = -999;
  let ondeT = -999;
  let dernierIndexGatling = -1;
  g.userData.reinit = () => {
    piedPuffFait = false;
    impactDFait = false;
    impactGFait = false;
    derniereImpactT = -999;
    ondeT = -999;
    dernierIndexGatling = -1;
    impact.material.opacity = 0;
    onde.material.opacity = 0;
    aura.material.opacity = 0;
  };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.06, u) * smoothstep(1, 0.95, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    regarderVers(perso, os, camera, smoothstep(0.02, 0.10, u) * 0.7);

    /* L'ARRIVEE. Un tout petit tassement silencieux dans la neige, sans
       choc camera — ce n'est pas un coup, juste le personnage qui prend
       appui avant l'enchainement. Reutilise la meme gerbe que les coups :
       aucun des declencheurs ne se chevauche dans le temps. */
    if (!piedPuffFait && u > 0.02) {
      piedPuffFait = true;
      derniereImpactT = t;
      impact.position.set(0, 0.04, 0.20);
    }

    /* --------------------------------------------------------------------
       LE CROCHET DROIT. Elan puis tir, resserres en debut de fenetre pour
       laisser toute la place necessaire aux deux temps suivants — cette
       scene n'a que treize metres de fenetre en tout (8 avant, 5 apres),
       il n'y a pas de temps mort a se permettre. */
    const armeD = smoothstep(0.06, 0.13, u) * smoothstep(0.24, 0.17, u);
    const lanceD = smoothstep(0.15, 0.20, u) * smoothstep(0.34, 0.24, u);
    os.brasD.rotation.set(-0.10 - armeD * 0.85, 0.05, 0.12);
    os.avantD.rotation.set(0.08 + armeD * 0.5, 0, 0);

    origineD.set(0.36, 1.32, -0.08);
    const porteeD = lanceD * 6.4;
    cibleD.set(
      0.36 + Math.sin(t * 11) * 0.05 * lanceD,
      1.32 + Math.sin(lanceD * Math.PI) * 0.5,
      -0.08 - porteeD
    );
    tendreElastique(elastiqueD, origineD, cibleD);
    // Le tube s'illumine legerement au moment ou il file le plus vite —
    // un fantome de mouvement, pas un neon, juste assez pour suggerer la
    // vitesse sans que le bras ait l'air de rayonner en continu.
    elastiqueD.userData.mat.emissiveIntensity = smoothstep(0.15, 0.20, u) * smoothstep(0.28, 0.22, u) * 0.35;
    let intensiteD = lanceD;

    if (!impactDFait && lanceD > 0.96) {
      impactDFait = true; derniereImpactT = t; ondeT = t; impact.position.copy(cibleD);
      g.userData.emettre?.('choc');
    }

    /* --------------------------------------------------------------------
       LE DIRECT GAUCHE. Meme mecanique, decale plus tard dans la fenetre —
       un vrai enchainement « droite puis gauche », jamais un miroir joue
       au meme instant. */
    const armeG = smoothstep(0.26, 0.33, u) * smoothstep(0.44, 0.37, u);
    const lanceG = smoothstep(0.35, 0.40, u) * smoothstep(0.54, 0.44, u);
    os.brasG.rotation.set(-0.10 - armeG * 0.85, -0.05, -0.12);
    os.avantG.rotation.set(0.08 + armeG * 0.5, 0, 0);

    origineG.set(-0.36, 1.32, -0.08);
    const porteeG = lanceG * 6.4;
    cibleG.set(
      -0.36 + Math.sin(t * 11 + 1.7) * 0.05 * lanceG,
      1.32 + Math.sin(lanceG * Math.PI) * 0.5,
      -0.08 - porteeG
    );
    tendreElastique(elastiqueG, origineG, cibleG);
    elastiqueG.userData.mat.emissiveIntensity = smoothstep(0.35, 0.40, u) * smoothstep(0.48, 0.42, u) * 0.35;
    let intensiteG = lanceG;

    if (!impactGFait && lanceG > 0.96) {
      impactGFait = true; derniereImpactT = t; ondeT = t; impact.position.copy(cibleG);
      g.userData.emettre?.('choc');
    }

    /* --------------------------------------------------------------------
       « GOMU GOMU NO GATLING ». La signature de la serie : une rafale de
       coups courts, alternes, bien plus rapides que les deux precedents et
       dont la portee est volontairement plus courte — ce n'est plus un
       coup qu'on lance loin, c'est un TAMBOURINEMENT. `uf` est le temps
       LOCAL a l'interieur de cette seule fenetre, ce qui garde le calcul
       de chaque coup individuel lisible independamment du reste de la
       scene. */
    const enveloppeGat = smoothstep(0.56, 0.62, u) * smoothstep(0.93, 0.86, u);
    if (enveloppeGat > 0.0005) {
      const NB_COUPS = 9;
      const uf = clamp((u - 0.58) / (0.90 - 0.58), 0, 1);
      const cycle = uf * NB_COUPS;
      const indexCoup = Math.floor(cycle);
      const frac = cycle - indexCoup;
      const droiteActif = indexCoup % 2 === 0;

      /* Chaque coup individuel : une impulsion triangulaire courte, une
         portee reduite, et une legere gigue laterale qui casse la
         symetrie parfaite d'un metronome — un vrai poing tremble un peu
         d'un coup a l'autre, meme a cette vitesse. */
      const tirCoup = Math.sin(Math.min(1, frac * 1.6) * Math.PI) * enveloppeGat;
      const portee = tirCoup * 2.6;
      const gigue = Math.sin(indexCoup * 12.9) * 0.04;

      if (droiteActif) {
        os.brasD.rotation.set(-0.10 - tirCoup * 0.7, 0.05 + gigue, 0.12);
        os.avantD.rotation.set(0.08 + tirCoup * 0.4, 0, 0);
        cibleD.set(0.30 + gigue, 1.30, -0.10 - portee);
        tendreElastique(elastiqueD, origineD, cibleD);
        elastiqueD.userData.mat.emissiveIntensity = tirCoup * 0.5;
        intensiteD = Math.max(intensiteD, tirCoup);
      } else {
        os.brasG.rotation.set(-0.10 - tirCoup * 0.7, -0.05 - gigue, -0.12);
        os.avantG.rotation.set(0.08 + tirCoup * 0.4, 0, 0);
        cibleG.set(-0.30 - gigue, 1.30, -0.10 - portee);
        tendreElastique(elastiqueG, origineG, cibleG);
        elastiqueG.userData.mat.emissiveIntensity = tirCoup * 0.5;
        intensiteG = Math.max(intensiteG, tirCoup);
      }

      /* Une etincelle par coup, declenchee une seule fois au pic de chaque
         impulsion — pas a chaque image ou `frac` depasse le seuil, sinon un
         seul coup redeclenche la gerbe dix fois de suite pendant qu'il
         reste au-dessus. Le choc camera est volontairement plus leger que
         celui des deux gros coups (0,40 contre le defaut 0,6) : neuf
         secousses pleines a la suite se liraient comme un tremblement de
         terre plutot que comme une rafale de poings. */
      if (indexCoup !== dernierIndexGatling && frac > 0.42) {
        dernierIndexGatling = indexCoup;
        derniereImpactT = t;
        impact.position.copy(droiteActif ? cibleD : cibleG);
        g.userData.emettre?.('choc', 0.40);
      }
    }

    // Un seul appel : la gerbe rejoue TOUJOURS le declencheur le plus
    // recent, quel qu'il soit — l'arrivee, un gros coup, ou un jab de la
    // rafale. Voir le commentaire de `gerbeImpact` plus haut.
    majImpact(impact, t - derniereImpactT);
    majOndeChoc(onde, t - ondeT);

    /* La montee en puissance : elle grimpe dans les six centiemes qui
       precedent la rafale et retombe d'un coup pile a son declenchement —
       le halo se VIDE au moment ou l'energie qu'il representait se
       libere enfin en coups, plutot que de s'estomper lentement pendant
       que la rafale joue deja. */
    const charge = smoothstep(0.50, 0.56, u) * smoothstep(0.585, 0.565, u);
    aura.material.opacity = charge * 0.55;
    aura.scale.setScalar(2.4 * (1 + charge * 0.5));

    majTrainee(traineeD, cibleD, intensiteD);
    majTrainee(traineeG, cibleG, intensiteG);

    // Le compagnon sursaute a chaque impact recent, camera comprise.
    const sursaut = clamp(1 - (t - derniereImpactT) * 7, 0, 1);
    majDenDenMushi(denDen, t, sursaut);
  };
  return g;
}
