/* LE DUELLISTE ENCAPUCHONNE.

   Il etait un CONE. Une cape en cone ferme, une boule pour la tete, deux
   capsules pour les bras : de loin cela passait pour une silhouette, de pres
   c'etait une piece d'echecs. Antoine a raison de ne pas s'en contenter.

   Il a maintenant un vrai corps — le meme humanoide implicite que Spider-Man,
   avec de vraies epaules et de vrais appuis — et par-dessus :

   · UNE CAPE OUVERTE PAR DEVANT. C'est la seule facon de voir qu'il y a
     quelqu'un dessous : une cape fermee est un cone, et un cone n'a pas de
     bras. Elle tombe des epaules jusqu'au sol, avec de vrais plis, et elle
     s'ecarte quand il avance ;
   · UN CAPUCHON, calotte ouverte devant, posee sur la tete et non a la place
     de la tete. Le visage reste dans l'ombre — c'est ainsi que ces plans-la
     sont eclaires au cinema, a contre-jour de la lame, et c'est le sujet le
     plus indulgent qui soit.

   LE CORPS EST GROSSIER, ET C'EST VOULU. Neuf dixiemes en sont caches par la
   cape : le payer a la finesse de Spider-Man serait jeter quarante mille
   triangles pour montrer deux avant-bras. La grille est donc nettement plus
   large, et l'on ne voit pas la difference.
*/

import * as THREE from 'three';
import { REPERES, construireCorps, nouvelleInstance } from './humanoide.js';

/* --------------------------------------------------------------------------
   LA CAPE.

   Une nappe parametree en (angle, hauteur), et non un cone de revolution :
   il lui faut une OUVERTURE devant, des PLIS, et un ourlet plus large que
   les epaules. Les trois se font en trois lignes chacun ici, et aucun ne
   serait possible avec une geometrie toute faite.

   L'ouverture est comptee depuis l'avant (-Z), qui est la direction du
   regard : la cape couvre le dos et les flancs, et laisse le devant libre.
   -------------------------------------------------------------------------- */
export function capeGeometrie(opts = {}) {
  const NA = opts.na ?? 30;          // pas angulaires
  const NV = opts.nv ?? 16;          // pas verticaux
  /* ANTOINE, DEUX FOIS : « les personnages Star Wars c'est juste des cones ».
     Il avait encore raison, et le coupable n'etait plus le corps mais le
     VETEMENT. La cape partait des epaules a vingt centimetres de rayon et
     s'evasait jusqu'a quarante au ras du sol : c'est la definition d'une
     cloche. Peu importe la qualite du corps dessous, on ne voyait qu'un
     cone, parce qu'il n'y avait qu'un cone a voir.

     Trois chiffres corrigent cela, et ce sont les trois seuls qui comptent :

     · ELLE S'ARRETE A MI-MOLLET et non au sol. Les jambes et les bottes
       ressortent, donc on voit un homme habille et non une forme ;
     · ELLE NE S'EVASE PRESQUE PLUS — trente centimetres a l'ourlet contre
       quarante. Un manteau tombe, une cloche s'ouvre ;
     · ELLE EST BEAUCOUP PLUS OUVERTE DEVANT, cent dix degres au lieu de
       quatre-vingt-six, ce qui degage le torse et le bras arme. C'est par
       cette ouverture qu'on lit qu'il y a quelqu'un dedans. */
  const ouvre = opts.ouvre ?? 0.96;  // demi-angle laisse libre devant, en radians
  const yHaut = opts.yHaut ?? 1.455;
  const yBas = opts.yBas ?? 0.430;
  const rHaut = opts.rHaut ?? 0.205;
  const rBas = opts.rBas ?? 0.300;
  const plis = opts.plis ?? 11;

  const pos = [];
  const nor = [];
  const idx = [];
  const largeur = Math.PI * 2 - ouvre * 2;

  const rayon = (t) => {
    /* Un manteau ne s'evase pas lineairement : il tombe droit sur le buste
       puis s'ouvre a peine a partir des hanches. L'exposant est ce qui
       distingue un vetement d'un abat-jour. */
    const e = Math.pow(t, 2.1);
    return rHaut + (rBas - rHaut) * e;
  };

  for (let j = 0; j <= NV; j++) {
    const t = j / NV;
    const y = yHaut + (yBas - yHaut) * t;
    const r0 = rayon(t);
    for (let i = 0; i <= NA; i++) {
      const a = -Math.PI + ouvre + (largeur * i) / NA;
      /* Les PLIS. Ils naissent au niveau des epaules et s'amplifient en
         descendant : c'est ainsi que tombe un tissu lourd, et c'est ce qui
         empeche la cape de se lire comme une surface de revolution. */
      const pli = 1 + Math.sin(a * plis) * 0.075 * (0.20 + t * 0.80);
      const r = r0 * pli;
      // L'avant (-Z) correspond a l'angle zero : on tourne autour de +Y.
      const x = Math.sin(a) * r;
      const z = -Math.cos(a) * r;
      /* L'OURLET ONDULE. Un bord parfaitement horizontal se lit comme une
         decoupe a l'emporte-piece ; quelques centimetres de dent de scie
         suffisent a en faire un tissu. L'ondulation ne mord qu'en bas — le
         col, lui, doit rester net. */
      const ourlet = Math.sin(a * (plis * 0.5) + 1.2) * 0.055 * Math.pow(t, 3.0);
      pos.push(x, y - ourlet, z);
      /* La normale approchee : radiale, legerement inclinee vers le haut
         par l'evasement. Elle n'a pas besoin d'etre exacte — la cape est
         quasi noire et ne recoit presque pas de lumiere directe — mais elle
         doit etre continue, sinon on voit les bandes du maillage. */
      const pente = (rBas - rHaut) * 1.55 * Math.pow(Math.max(t, 1e-3), 0.55) / (yHaut - yBas);
      const n = new THREE.Vector3(Math.sin(a), pente * 0.5, -Math.cos(a)).normalize();
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NA; i++) {
      const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

/* Le capuchon : une calotte ouverte par devant, posee SUR la tete. C'est la
   difference entre un personnage encapuchonne et un personnage sans tete. */
function capuchonGeometrie() {
  const geo = new THREE.SphereGeometry(0.145, 16, 12, Math.PI * 0.30, Math.PI * 1.40, 0, Math.PI * 0.62);
  geo.scale(1.02, 1.16, 1.10);
  return geo;
}

let _corps = null;

/* Le corps sous la cape : sombre, mat, sans motif. Une legere emission
   TEINTEE DE LA LAME donne a chaque duelliste son lisere propre — l'un vert,
   l'autre rouge — ce qui les distingue meme quand les sabres se croisent. */
function matiereRobe(teinte) {
  /* L'EMISSION SE NORMALISE AVANT DE SE DOSER, ET C'EST LA TOUTE L'HISTOIRE.

     Les teintes des lames sont donnees en valeurs LINEAIRES tres au-dessus
     de un — le vert vaut 3,1 — parce qu'elles servent a des halos additifs
     qu'on veut eblouissants. Multipliees telles quelles par un petit
     coefficient, elles donnaient encore 0,17 d'emission sur un corps
     quasiment noir : les deux duellistes sortaient en vert fluo et en rouge
     vif, comme deux plots de chantier.

     On ramene donc la teinte a son maximum avant de la doser. Ce qui reste
     est ce qu'on voulait : un corps noir, avec juste assez de la couleur de
     sa lame pour qu'on sache lequel est lequel quand les deux se croisent. */
  const m = Math.max(teinte[0], teinte[1], teinte[2], 1e-3);
  const k = 0.024;
  return new THREE.MeshStandardMaterial({
    color: 0x0A0C11, roughness: 0.94, metalness: 0.0,
    emissive: new THREE.Color(teinte[0] / m * k, teinte[1] / m * k, teinte[2] / m * k),
    emissiveIntensity: 1,
    /* La cape est une nappe ouverte : sans les deux faces, on voit au
       travers des que le duelliste tourne le dos. Le corps, lui, est ferme
       et ne paie donc rien de plus a etre declare ainsi. */
    side: THREE.DoubleSide,
  });
}

export function creerDuelliste(palier, teinte) {
  if (!_corps) {
    _corps = construireCorps(palier, {
      /* NEUF DIXIEMES DU CORPS SONT SOUS LA CAPE. On paie donc la grille au
         tiers de la finesse de Spider-Man : seuls les avant-bras, les mains
         et le bas des jambes se voient, et a vingt-cinq metres. */
      pas: palier.nom === 'haut' ? 0.030 : 0.038,
      fusion: 0.020,
      /* Une charpente plus lourde : ce ne sont pas des acrobates. */
      gabarit: { carrure: 1.10, masse: 1.10 },
    });
  }
  const mat = matiereRobe(teinte);
  const perso = nouvelleInstance(_corps, mat, { ombres: palier.ombres });

  const cape = new THREE.Mesh(capeGeometrie(), mat);
  /* La cape est accrochee a la POITRINE et non a la racine : elle suit donc
     le buste quand il se penche dans l'echange, ce qui est ce qu'une cape
     fait. Accrochee au sol, elle resterait plantee pendant que l'homme
     bouge dedans. */
  const os = perso.userData.os;
  const attache = new THREE.Group();
  attache.position.y = -(REPERES.cotes + 0.06);   // l'os de la poitrine part de la
  attache.add(cape);
  os.poitrine.add(attache);

  const capuchon = new THREE.Mesh(capuchonGeometrie(), mat);
  capuchon.position.set(0, REPERES.crane - REPERES.menton + 0.012, 0.010);
  os.tete.add(capuchon);
  /* Le creux du capuchon : une calotte franchement noire, avancee. Sans
     elle on lit une boule ; avec elle, on lit un visage qu'on ne voit pas,
     ce qui est exactement le but. */
  const creux = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 12, 9),
    new THREE.MeshBasicMaterial({ color: 0x020304 })
  );
  creux.scale.set(1, 1.05, 0.6);
  creux.position.set(0, REPERES.crane - REPERES.menton + 0.006, -0.070);
  os.tete.add(creux);

  perso.userData.cape = cape;
  perso.userData.attacheCape = attache;
  return perso;
}

/* --------------------------------------------------------------------------
   LES POSES DU DUEL.

   La garde, la frappe, et le recul. Trois poses suffisent a faire lire une
   passe d'armes, a condition que le CORPS ENTIER y participe : une passe
   d'armes n'est pas un poignet qui tourne, c'est un appui qui se transfere,
   un buste qui se ferme et une epaule qui part.
   -------------------------------------------------------------------------- */
export const GARDES = {
  /* En garde : le poids en arriere, l'arme haute et en travers, le corps de
     trois quarts pour offrir le moins de cible possible. */
  garde: {
    brasD: [-0.85, 0, 0.55], avantD: [1.15, 0, 0], mainD: [0.2, 0, 0],
    brasG: [0.25, 0, -0.42], avantG: [1.05, 0, 0],
    cuisseD: [-0.30, 0, 0.22], molletD: [-0.55, 0, 0], piedD: [0.35, 0, 0],
    cuisseG: [0.34, 0, -0.24], molletG: [-0.18, 0, 0],
    bassin: [0, 0.24, 0], colonne: [0.06, 0.20, 0], poitrine: [0.04, 0.16, 0],
    cou: [-0.06, -0.22, 0], tete: [-0.04, -0.18, 0],
  },
  /* La frappe : tout part vers l'avant — l'appui, le bassin, l'epaule. Le
     bras arrive en dernier, comme dans tout geste porte. */
  frappe: {
    brasD: [-1.55, 0, 0.30], avantD: [0.45, 0, 0], mainD: [0.1, 0, 0],
    brasG: [0.55, 0, -0.55], avantG: [1.30, 0, 0],
    cuisseD: [-0.72, 0, 0.20], molletD: [-0.25, 0, 0], piedD: [0.45, 0, 0],
    cuisseG: [0.62, 0, -0.26], molletG: [-0.55, 0, 0],
    bassin: [0.06, 0.06, 0], colonne: [0.20, 0.04, 0], poitrine: [0.16, 0.02, 0],
    cou: [-0.14, 0, 0], tete: [-0.12, 0, 0],
  },
  /* Le recul : il se ferme, le bras remonte, le poids repasse en arriere. */
  recul: {
    brasD: [-0.45, 0, 0.72], avantD: [1.55, 0, 0], mainD: [0.3, 0, 0],
    brasG: [0.10, 0, -0.35], avantG: [0.85, 0, 0],
    cuisseD: [-0.10, 0, 0.24], molletD: [-0.70, 0, 0], piedD: [0.30, 0, 0],
    cuisseG: [0.18, 0, -0.22], molletG: [-0.10, 0, 0],
    bassin: [0, 0.32, 0], colonne: [-0.04, 0.26, 0], poitrine: [-0.06, 0.22, 0],
    cou: [0, -0.28, 0], tete: [0, -0.24, 0],
  },
};

/* --------------------------------------------------------------------------
   TROIS ECHANGES DIFFERENTS, ET NON UN SEUL REPETE.

   Antoine : « toujours la meme attaque de sabre ». C'etait exact : une seule
   piste de trois poses tournait en boucle, et au bout de deux passes on
   avait tout vu. Un duel, ce n'est pas un mouvement repete — c'est une
   SUITE de coups differents, et c'est la variete qui fait croire a un
   affrontement plutot qu'a un exercice.

   On ajoute donc deux coups au repertoire, choisis pour etre lisibles a
   vingt-cinq metres et de nuit, c'est-a-dire pour differer par la
   TRAJECTOIRE DE LA LAME et non par un detail de poignet :

   · le coup HAUT, porte de haut en bas par-dessus la garde ;
   · le BALAYAGE, porte de bas en haut en revers.

   Et surtout un quatrieme temps qui n'est pas un coup : le CORPS A CORPS,
   ou les deux lames restent bloquees l'une contre l'autre pendant que les
   duellistes poussent. C'est le temps fort de toute scene d'escrime au
   cinema, et c'est le seul ou l'on voit vraiment les deux silhouettes.
   -------------------------------------------------------------------------- */
GARDES.hautLeve = {
  brasD: [-2.45, 0, 0.42], avantD: [0.30, 0, 0], mainD: [0.1, 0, 0],
  brasG: [-1.95, 0, -0.60], avantG: [0.55, 0, 0],
  cuisseD: [-0.22, 0, 0.24], molletD: [-0.45, 0, 0], piedD: [0.3, 0, 0],
  cuisseG: [0.28, 0, -0.24], molletG: [-0.30, 0, 0],
  bassin: [0, 0.20, 0], colonne: [-0.12, 0.16, 0], poitrine: [-0.14, 0.12, 0],
  cou: [0.10, -0.18, 0], tete: [0.08, -0.16, 0],
};
GARDES.abattu = {
  brasD: [-0.55, 0, 0.22], avantD: [0.20, 0, 0], mainD: [0.1, 0, 0],
  brasG: [-0.35, 0, -0.30], avantG: [0.40, 0, 0],
  cuisseD: [-0.85, 0, 0.18], molletD: [-0.20, 0, 0], piedD: [0.5, 0, 0],
  cuisseG: [0.70, 0, -0.24], molletG: [-0.65, 0, 0],
  bassin: [0.10, 0.04, 0], colonne: [0.34, 0.02, 0], poitrine: [0.26, 0, 0],
  cou: [-0.22, 0, 0], tete: [-0.20, 0, 0],
};
GARDES.basRevers = {
  brasD: [0.55, 0, 0.30], avantD: [1.35, 0, 0], mainD: [0.3, 0, 0],
  brasG: [0.30, 0, -0.42], avantG: [1.10, 0, 0],
  cuisseD: [-0.15, 0, 0.30], molletD: [-0.80, 0, 0], piedD: [0.3, 0, 0],
  cuisseG: [0.22, 0, -0.30], molletG: [-0.25, 0, 0],
  bassin: [0.06, 0.36, 0], colonne: [0.22, 0.30, 0], poitrine: [0.18, 0.26, 0],
  cou: [-0.10, -0.30, 0], tete: [-0.08, -0.26, 0],
};
GARDES.remonte = {
  brasD: [-1.85, 0, 0.60], avantD: [0.45, 0, 0], mainD: [-0.2, 0, 0],
  brasG: [-0.90, 0, -0.55], avantG: [0.90, 0, 0],
  cuisseD: [-0.60, 0, 0.20], molletD: [-0.32, 0, 0], piedD: [0.4, 0, 0],
  cuisseG: [0.52, 0, -0.26], molletG: [-0.40, 0, 0],
  bassin: [-0.04, 0.12, 0], colonne: [-0.10, 0.08, 0], poitrine: [-0.08, 0.06, 0],
  cou: [0.06, -0.12, 0], tete: [0.06, -0.10, 0],
};
/* Le corps a corps : les deux lames bloquees, le poids en avant, les
   epaules basses. Rien ne bouge pendant une seconde — c'est ce blocage qui
   donne sa tension a tout le reste. */
GARDES.blocage = {
  brasD: [-1.15, 0, 0.30], avantD: [1.05, 0, 0], mainD: [0.15, 0, 0],
  brasG: [-1.00, 0, -0.42], avantG: [1.20, 0, 0],
  cuisseD: [-0.68, 0, 0.18], molletD: [-0.42, 0, 0], piedD: [0.4, 0, 0],
  cuisseG: [0.58, 0, -0.22], molletG: [-0.60, 0, 0],
  bassin: [0.08, 0.14, 0], colonne: [0.26, 0.10, 0], poitrine: [0.22, 0.08, 0],
  cou: [-0.18, 0, 0], tete: [-0.16, 0, 0],
};

/* Les echanges disponibles, sous forme de suites de poses. Le duel en tire
   un different a chaque passe, et le fait dans un ordre FIXE plutot
   qu'aleatoire : deux visites de la balade doivent montrer la meme scene,
   sans quoi on ne peut plus rien verifier a l'image. */
export const ECHANGES = [
  // La botte droite, celle qu'on avait deja.
  { attaquant: ['garde', 'frappe', 'frappe', 'recul'], pare: ['recul', 'garde', 'garde', 'recul'] },
  // Le coup haut, abattu par-dessus la garde.
  { attaquant: ['garde', 'hautLeve', 'abattu', 'recul'], pare: ['garde', 'garde', 'hautLeve', 'garde'] },
  // Le revers remontant.
  { attaquant: ['recul', 'basRevers', 'remonte', 'garde'], pare: ['garde', 'recul', 'garde', 'garde'] },
  // Le corps a corps : ils restent colles, puis se repoussent.
  { attaquant: ['garde', 'blocage', 'blocage', 'recul'], pare: ['garde', 'blocage', 'blocage', 'recul'] },
];

/* Le cout, pour le banc d'essai. */
export function coutDuelliste() {
  return _corps ? { triangles: _corps.triangles, sommets: _corps.sommets } : null;
}
