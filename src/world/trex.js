/* JURASSIC PARK — LE THEROPODE.

   Antoine voulait « des vraies scenes de films ». Celle-ci est la plus
   celebre de toutes, et elle a une particularite qu'aucune autre n'a : ELLE
   COMMENCE AVANT QU'ON VOIE QUOI QUE CE SOIT. Le verre d'eau qui tremble,
   puis le silence, puis la chose. C'est cette construction en trois temps
   qu'on reprend ici, transposee a une foret enneigee :

   1. LA NEIGE TOMBE DES BRANCHES, deux fois, a intervalle regulier. On ne
      voit rien d'autre. Un pas, puis un autre ;
   2. LE RUGISSEMENT, alors qu'il n'est toujours pas visible ;
   3. IL PASSE DERRIERE LA LIGNE D'ARBRES, jamais entierement degage.

   Le troisieme point n'est pas une economie, c'est le bon choix : un
   dinosaure entierement visible invite a l'examiner, et il ne resiste
   jamais a l'examen. Entrevu entre deux troncs, il est enorme.

   La bete est construite par le meme pipeline que le cerf et les
   personnages — capsules anisotropes, fusion adoucie, marching tetrahedra,
   peau repartie sur un squelette. Trois anatomies sans rien en commun, une
   seule machine.
*/

import * as THREE from 'three';
import { construirePeau, nouvelleInstance } from './humanoide.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* --------------------------------------------------------------------------
   LES REPERES.

   Un tyrannosaure adulte : quatre mètres au bassin, douze du museau au bout
   de la queue. L'origine est au sol entre les pieds, le museau vers -Z,
   comme pour tout le reste du projet.

   LE RAPPORT QUI DECIDE DE TOUT est l'EQUILIBRE : la colonne est presque
   HORIZONTALE, la tete et la queue se font contrepoids de part et d'autre
   de la hanche. Un theropode dresse a la verticale — la posture des vieux
   musees — se lit immediatement comme un jouet en plastique. C'est le seul
   chiffre qu'il ne faut surtout pas rater.
   -------------------------------------------------------------------------- */
export const OS_TREX = {
  hanche: 3.30,
  genou: 1.95,
  cheville: 0.90,
  dosAvant: 3.95,          // hauteur de la colonne au niveau des epaules
  epaule: 3.70,
  baseCou: 3.95,
  tete: 4.35,
  demiHanche: 0.52,
};

export function anatomieTrex() {
  const R = OS_TREX;
  const c = [];
  const C = (ax, ay, az, bx, by, bz, ra, rb, opt) =>
    c.push({ ax, ay, az, bx, by, bz, ra, rb, ...(opt || {}) });

  /* ======================================================================
     LA COLONNE : de la pointe de la queue au museau, en une seule ligne
     presque horizontale. C'est elle la silhouette ; tout le reste s'y
     accroche.
     ====================================================================== */
  // La queue : quatre troncons qui s'effilent, et qui REMONTENT legerement.
  C(0, R.hanche - 0.15, 5.90, 0, R.hanche - 0.05, 4.60, 0.10, 0.24, { sy: 1.20 });
  C(0, R.hanche - 0.05, 4.60, 0, R.hanche + 0.02, 3.30, 0.24, 0.42, { sy: 1.25 });
  C(0, R.hanche + 0.02, 3.30, 0, R.hanche + 0.04, 2.10, 0.42, 0.60, { sy: 1.30 });
  C(0, R.hanche + 0.04, 2.10, 0, R.hanche + 0.02, 1.00, 0.60, 0.74, { sy: 1.25, sx: 0.92 });

  // Le bassin : la piece la plus massive, elle porte tout le poids.
  C(0, R.hanche + 0.02, 1.00, 0, R.hanche - 0.02, 0.05, 0.74, 0.76, { sy: 1.22, sx: 1.05 });

  // Le tronc, qui monte doucement vers les epaules.
  C(0, R.hanche - 0.02, 0.05, 0, R.hanche + 0.14, -0.95, 0.76, 0.72, { sy: 1.28, sx: 1.02 });
  C(0, R.hanche + 0.14, -0.95, 0, R.epaule - 0.05, -1.85, 0.72, 0.62, { sy: 1.24, sx: 0.98 });

  /* LE COU. Il decrit un S, comme chez tous les theropodes : il remonte en
     sortant des epaules, puis redescend vers la tete. Un cou droit donne un
     lezard sur pattes ; le S donne un predateur. */
  C(0, R.epaule - 0.05, -1.85, 0, R.baseCou + 0.28, -2.45, 0.52, 0.40, { sy: 1.10 });
  C(0, R.baseCou + 0.28, -2.45, 0, R.tete - 0.02, -3.05, 0.40, 0.36, { sy: 1.05 });

  /* LA TETE. Longue, etroite, profonde — et surtout MASSIVE A L'ARRIERE :
     c'est la boite des muscles de la machoire, et c'est ce qui donne son
     profil en coin. Le museau, lui, est etroit et carre. */
  C(0, R.tete - 0.02, -3.05, 0, R.tete - 0.06, -3.70, 0.38, 0.30, { sx: 0.80, sy: 1.15 });
  C(0, R.tete - 0.06, -3.70, 0, R.tete - 0.14, -4.35, 0.30, 0.21, { sx: 0.72, sy: 1.05 });
  // La machoire inferieure, legerement ouverte.
  C(0, R.tete - 0.34, -3.20, 0, R.tete - 0.44, -4.25, 0.20, 0.13, { sx: 0.70, sy: 0.72 });
  // Les bosses au-dessus des yeux : deux petites cretes, tres reconnaissables.
  for (const s of [-1, 1]) {
    C(s * 0.17, R.tete + 0.14, -3.28, s * 0.19, R.tete + 0.10, -3.62, 0.08, 0.05, {});
  }

  /* ======================================================================
     LES PATTES. Elles portent quatre tonnes : elles sont enormes en haut et
     fines en bas, et le pied est DIGITIGRADE — il marche sur ses doigts, le
     talon tres haut. C'est ce talon haut qui fait la demarche.
     ====================================================================== */
  for (const s of [-1, 1]) {
    const hx = s * R.demiHanche;
    // La cuisse : la masse musculaire la plus grosse de l'animal.
    C(hx * 0.7, R.hanche + 0.10, 0.55, hx, R.genou + 0.12, 0.10,
      0.60, 0.34, { sz: 1.18 });
    // Le tibia, long et fin.
    C(hx, R.genou + 0.05, 0.10, hx, R.cheville + 0.05, -0.05, 0.30, 0.19, {});
    // Le metatarse : presque vertical, tres haut — c'est le « talon ».
    C(hx, R.cheville + 0.05, -0.05, hx, 0.30, -0.28, 0.18, 0.15, {});
    // Le pied a trois doigts, poses a plat.
    C(hx, 0.28, -0.28, hx, 0.16, -0.72, 0.15, 0.10, { sy: 0.70 });
    for (const d of [-1, 0, 1]) {
      C(hx, 0.16, -0.60, hx + d * 0.22, 0.12, -1.00, 0.10, 0.06, { sy: 0.62 });
    }
  }

  /* LES BRAS, minuscules et c'est tout le sel : deux doigts, colles au
     poitrail. Les oublier serait perdre le detail que tout le monde
     connait. */
  for (const s of [-1, 1]) {
    C(s * 0.44, R.epaule - 0.30, -1.70, s * 0.52, R.epaule - 0.62, -1.95, 0.13, 0.09, {});
    C(s * 0.52, R.epaule - 0.62, -1.95, s * 0.54, R.epaule - 0.80, -2.16, 0.09, 0.05, {});
  }

  return c;
}

/* --------------------------------------------------------------------------
   LE SQUELETTE.

   Quatorze os. La queue en compte trois a elle seule, parce que c'est elle
   qui donne la vie : une queue rigide transforme n'importe quel animal en
   maquette, et elle est ici le plus long appendice de la bete.
   -------------------------------------------------------------------------- */
export function squeletteTrex() {
  const R = OS_TREX;
  const os = [];
  const O = (nom, parent, tete, bout, importance, portee) =>
    os.push({ nom, parent, tete, bout, importance, portee });

  O('racine', null, V(0, 0, 0), V(0, 0.4, 0), 0, 0);
  O('bassin', 'racine', V(0, R.hanche, 0.30), V(0, R.hanche, -0.50), 3.0, 1.20);
  O('queue1', 'bassin', V(0, R.hanche, 0.90), V(0, R.hanche, 2.30), 2.0, 1.00);
  O('queue2', 'queue1', V(0, R.hanche, 2.30), V(0, R.hanche, 3.70), 1.6, 0.80);
  O('queue3', 'queue2', V(0, R.hanche, 3.70), V(0, R.hanche - 0.10, 5.90), 1.4, 0.70);
  O('tronc', 'bassin', V(0, R.hanche, -0.50), V(0, R.epaule, -1.85), 2.6, 1.05);
  O('cou', 'tronc', V(0, R.epaule, -1.85), V(0, R.tete, -3.00), 1.8, 0.70);
  O('crane', 'cou', V(0, R.tete, -3.00), V(0, R.tete - 0.10, -4.35), 2.2, 0.68);

  for (const [suf, sgn] of [['D', 1], ['G', -1]]) {
    O('cuisse' + suf, 'bassin',
      V(sgn * R.demiHanche, R.hanche, 0.30), V(sgn * R.demiHanche, R.genou, 0.10), 1.8, 0.70);
    O('tibia' + suf, 'cuisse' + suf,
      V(sgn * R.demiHanche, R.genou, 0.10), V(sgn * R.demiHanche, R.cheville, -0.05), 1.8, 0.42);
    O('pied' + suf, 'tibia' + suf,
      V(sgn * R.demiHanche, R.cheville, -0.05), V(sgn * R.demiHanche, 0.16, -0.80), 1.8, 0.42);
  }
  return os;
}

/* --------------------------------------------------------------------------
   LA PEAU.

   Vert-brun tres sombre sur le dos, ventre plus clair : c'est le
   contre-ombrage de tous les animaux, et il compte double ici parce que la
   bete est vue a contre-jour. On y ajoute des bandes verticales sur les
   flancs — le motif le plus courant des grands predateurs, et le seul qui
   se lise encore a quarante metres.
   -------------------------------------------------------------------------- */
const _dos = new THREE.Color(0x2A2E22);
const _flanc = new THREE.Color(0x3E4230);
const _ventre = new THREE.Color(0x6A6550);

function teinteTrex(x, y, z, c) {
  const R = OS_TREX;
  /* Le contre-ombrage. La hauteur de reference suit la colonne : elle est
     plus basse a la queue qu'aux epaules, et un seuil unique donnerait un
     ventre clair sur le dos de la queue. */
  const ligne = R.hanche + 0.10 - Math.max(0, z) * 0.03;
  const h = (y - ligne + 0.85) / 1.7;
  if (h > 0.66) c.copy(_dos);
  else if (h > 0.30) c.copy(_flanc);
  else c.copy(_ventre);

  /* Les bandes. Analytiques, en fonction de l'abscisse le long du corps :
     rien qui puisse s'effondrer en precision, et elles suivent la peau
     puisqu'elles sont calculees sur la position de liaison. */
  if (h > 0.28) {
    const b = Math.sin(z * 2.35 + Math.sin(z * 0.7) * 0.8);
    if (b > 0.45) c.multiplyScalar(0.62);
  }
  void x;
}

let _corps = null;

export function creerTrex(palier) {
  if (!_corps) {
    /* LA FINESSE EST RELATIVE A LA TAILLE, ET C'EST CE QUI RECONCILIE LE
       COUT AVEC L'AMBITION.

       La bete fait douze metres de long : neuf centimetres de grille sur
       elle, c'est proportionnellement PLUS FIN que les deux centimetres
       qu'on donne a un humain d'un metre quatre-vingts. Et comme le volume
       a balayer croit comme le cube de la taille alors que la finesse
       requise croit comme la taille, on s'en tire avec un nombre de noeuds
       du meme ordre que pour le cerf. */
    /* MESURE : a neuf centimetres de grille, la bete pesait cinquante-quatre
       mille triangles — plus que le cerf, qui est le sujet de toute la
       balade et qu'on voit a huit metres. Or celle-ci ne se montre jamais a
       moins de cinquante metres, a demi mangee par le brouillard et par les
       troncs : elle y fait deux cents pixels de long. Quatorze centimetres
       la ramenent a une vingtaine de milliers, et la difference n'existe
       tout simplement pas a cette distance. */
    const pas = palier.nom === 'bas' ? 0.165 : palier.nom === 'moyen' ? 0.140 : 0.110;
    _corps = construirePeau(anatomieTrex(), squeletteTrex(), {
      pas,
      /* La fusion suit l'echelle : deux centimetres et demi sur un humain,
         donc une douzaine sur une bete six fois plus grosse. Avec la valeur
         humaine, la peau garderait toutes les aretes des capsules. */
      fusion: 0.12,
      boite: new THREE.Box3(V(-1.15, -0.10, -4.70), V(1.15, 5.05, 6.25)),
      teinter: teinteTrex,
    });
  }

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, metalness: 0.0,
    /* Une emission tres faible, verdatre. Comme pour tout ce qui vit dans
       cette foret de nuit : sans elle, la bete est une decoupe noire. */
    emissive: new THREE.Color(0x0A0E08), emissiveIntensity: 1,
  });
  const bete = nouvelleInstance(_corps, mat, { ombres: palier.ombres });

  /* LES YEUX. Antoine : « il ne fait pas peur ». Rapprochee, la bete se
     voit enfin, mais un regard trop discret reste un detail qu'on manque
     a vingt metres de nuit. Deux braises, plus grandes et franchement
     lumineuses (MeshBasicMaterial ignore l'eclairage de la scene : elles
     restent vives meme a contre-jour) — c'est ce qui fait qu'on se sent
     REGARDE avant meme de distinguer la silhouette entiere. */
  const os = bete.userData.os;
  for (const sx of [-1, 1]) {
    const oeil = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xFFB020 })
    );
    // L'os du crane part de (0, tete, -3.00) : coordonnees comptees de la.
    oeil.position.set(sx * 0.24, 0.14, -0.34);
    os.crane.add(oeil);
  }

  return bete;
}

/* --------------------------------------------------------------------------
   LA MARCHE.

   Un theropode ne trotte pas : il BASCULE. Chaque appui fait tomber tout le
   corps d'un cote, la tete plonge et la queue remonte en contrepoids. Trois
   choses font la demarche, et aucune n'est dans les pattes :

   · LE ROULIS DU BASSIN. C'est lui qu'on lit en premier, bien avant le
     mouvement des jambes ;
   · LE CONTRE-BALANCEMENT DE LA QUEUE, en opposition de phase avec la tete ;
   · LE TANGAGE DE LA COLONNE, qui plonge a chaque poser.

   Le cycle est LENT — un pas toutes les huit dixiemes de seconde. C'est la
   lenteur qui donne la masse : un pas rapide fait une poule.
   -------------------------------------------------------------------------- */
export function marcheTrex(os, phase, ampleur = 1) {
  const a = phase * Math.PI * 2;
  const sin = Math.sin(a), cos = Math.cos(a);

  // Le roulis et le tangage du corps.
  os.bassin.rotation.z = sin * 0.075 * ampleur;
  os.bassin.rotation.x = -0.02 + Math.abs(cos) * 0.035 * ampleur;
  os.tronc.rotation.z = -sin * 0.045 * ampleur;
  os.tronc.rotation.x = 0.02 + cos * 0.030 * ampleur;

  /* LA QUEUE, en opposition de phase et avec un RETARD croissant le long
     des troncons : c'est ce decalage qui donne l'onde, et sans onde une
     queue n'est qu'une poutre. */
  os.queue1.rotation.y = -sin * 0.10 * ampleur;
  os.queue2.rotation.y = -Math.sin(a - 0.6) * 0.13 * ampleur;
  os.queue3.rotation.y = -Math.sin(a - 1.2) * 0.16 * ampleur;
  os.queue1.rotation.x = cos * 0.030 * ampleur;
  os.queue2.rotation.x = Math.cos(a - 0.6) * 0.040 * ampleur;
  os.queue3.rotation.x = Math.cos(a - 1.2) * 0.050 * ampleur;

  // Le cou et la tete, qui plongent a chaque appui.
  os.cou.rotation.x = -0.04 + cos * 0.055 * ampleur;
  os.cou.rotation.y = sin * 0.075 * ampleur;
  os.crane.rotation.x = 0.03 - cos * 0.045 * ampleur;

  /* LES PATTES. Un cycle a deux temps, decale d'un demi-tour entre la
     gauche et la droite. La cuisse balance, le tibia se replie a la
     remontee et se tend a l'appui, le pied reste a peu pres a plat — un
     theropode pose son pied bien avant que la jambe ne soit tendue. */
  for (const [suf, dec] of [['D', 0], ['G', Math.PI]]) {
    const p = a + dec;
    const sp = Math.sin(p), cp = Math.cos(p);
    os['cuisse' + suf].rotation.x = sp * 0.42 * ampleur;
    /* Le genou ne se replie QUE pendant la phase aerienne. On l'obtient en
       ne gardant que la moitie positive du cosinus : pendant l'appui, la
       jambe reste tendue et porte le poids, ce qui est justement ce qu'on
       veut voir. */
    const enLAir = Math.max(0, cp);
    /* AUCUN ANGLE CONSTANT SUR LA JAMBE D'APPUI, ET C'EST LA RAISON POUR
       LAQUELLE IL FLOTTAIT.

       La version precedente gardait un tibia flechi de dix degres et un pied
       casse de douze en PERMANENCE, y compris pendant l'appui. Or une jambe
       flechie est plus courte qu'une jambe tendue : le corps entier montait
       donc d'une quinzaine de centimetres au repos, et comme rien ne le
       redescendait, la bete marchait au-dessus de la neige.

       La regle est simple et elle vaut pour tout animal : pendant l'appui,
       la chaine porte le poids et doit etre TENDUE ; toute la flexion
       appartient a la phase aerienne. */
    os['tibia' + suf].rotation.x = -enLAir * 0.90 * ampleur;
    os['pied' + suf].rotation.x = enLAir * 0.60 * ampleur - sp * 0.16 * ampleur;
  }
}

export function coutTrex() {
  return _corps ? { triangles: _corps.triangles, sommets: _corps.sommets } : null;
}
