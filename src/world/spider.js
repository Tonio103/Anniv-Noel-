/* SPIDER-MAN.

   Il apparait deux fois dans la balade — c'est le seul personnage a qui ce
   projet accorde ce privilege, et c'est assume : Antoine dit qu'il l'aime
   beaucoup. Il merite donc d'etre le personnage le mieux fait du fichier.

   Le corps vient de `humanoide.js` : une seule peau continue extraite d'un
   champ implicite, avec de vrais deltoides, de vrais mollets et un
   resserrement a la taille. Ce fichier-ci ne s'occupe que de ce qui fait
   Spider-Man plutot qu'un homme en collant :

   · LES ZONES DE COULEUR, peintes par sommet et decoupees PAR OS — un gant
     est une main, pas une tranche d'espace ;
   · LA TOILE DU COSTUME, dessinee dans le NUANCEUR et non dans une texture.
     C'est la seule facon d'obtenir un motif net qui suive l'anatomie sans
     couture ni etirement : une texture plaquee sur une surface implicite
     n'a aucune coordonnee naturelle, et un motif par sommet aurait la
     finesse du maillage, soit deux centimetres ;
   · L'ARAIGNEE DE POITRINE, dessinee elle aussi dans le nuanceur, donc
     franche a n'importe quelle distance ;
   · LES YEUX, qui restent des pieces separees parce qu'ils sont
     physiquement en relief sur le masque et qu'ils doivent rester nets.
*/

import * as THREE from 'three';
import { REPERES, construireCorps, nouvelleInstance } from './humanoide.js';

const ROUGE = new THREE.Color(0x8E1620);
const BLEU = new THREE.Color(0x14265E);

/* --------------------------------------------------------------------------
   LE DECOUPAGE DU COSTUME.

   Le costume classique : masque rouge, plastron rouge sur le haut du tronc
   et les epaules, gants rouges, bottes rouges ; tout le reste bleu.

   La limite du plastron n'est pas un plan horizontal — elle DESCEND devant
   et REMONTE derriere, ce qui donne la bavette caracteristique. Une coupe a
   plat donnerait un tee-shirt.
   -------------------------------------------------------------------------- */
export function teinteSpider(x, y, z, c, os) {
  // Les gants et les bottes se decident par l'os, jamais par la position.
  if (os === 'mainD' || os === 'mainG' || os === 'piedD' || os === 'piedG') {
    c.copy(ROUGE); return;
  }
  /* Le bas de jambe est rouge sur une botte haute : on remonte donc un peu
     au-dessus de la cheville, ce qui se decide bien, lui, a la hauteur. */
  if (y < REPERES.cheville + 0.15) { c.copy(ROUGE); return; }

  const limite = 1.150 + 0.085 * Math.max(-1, Math.min(1, z / 0.16));
  c.copy(y > limite ? ROUGE : BLEU);
}

/* --------------------------------------------------------------------------
   LA MATIERE.

   Trois choses sont ajoutees au nuanceur standard, dans cet ordre precis :

   1. LA TOILE. Trois familles de plans paralleles, d'orientations
      differentes, qui decoupent le corps. L'intersection d'une surface
      quelconque avec une famille de plans est un reseau de lignes qui
      epouse le relief — c'est exactement ce qu'on veut, et cela marche
      identiquement sur le masque, le torse, un bras leve ou un mollet, sans
      la moindre coordonnee de texture. Un enroulement cylindrique, lui,
      aurait fonctionne sur le tronc et se serait effondre sur les membres.

   2. L'ARAIGNEE, en distance a quelques segments. Franche a toute distance.

   3. UN LISERE DE LUNE. De nuit, un personnage sombre a vingt metres n'est
      qu'une tache ; un lisere sur les bords le detache du fond sans en
      faire une lampe.

   PRECISION. Les arguments des sinus sont ramenes autour du centre du corps
   avant d'etre multiplies : sur un telephone, le nuanceur de fragments
   travaille en precision moyenne, et un sinus dont l'argument depasse la
   centaine de radians y perd toute sa finesse — c'est le defaut qui avait
   fait apparaitre un « vieil ecran » sur le grain de l'image et des taches
   sur le pelage du cerf. On demande en plus explicitement la haute
   precision : ce materiau n'est porte que par cinq objets, la depense est
   nulle.
   -------------------------------------------------------------------------- */
export function matiereCostume() {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.04,
    /* Une emission faible, teintee du costume. Sans elle, le personnage est
       une silhouette noire dans une foret de nuit ; avec, il existe sans
       rayonner. C'est la meme correction que pour les cabanes et le sapin. */
    emissive: new THREE.Color(0x1A0A12),
    emissiveIntensity: 1,
  });
  mat.precision = 'highp';

  mat.onBeforeCompile = (nuance) => {
    nuance.vertexShader = 'varying vec3 vRepos;\n' + nuance.vertexShader;
    nuance.vertexShader = nuance.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       /* La position DE LIAISON, avant deformation par les os. C'est elle
          qu'il faut : prise apres l'animation, le motif nagerait sur la
          peau a chaque mouvement, ce qui est le defaut classique et le plus
          voyant de ce genre d'effet. */
       vRepos = position;`
    );

    nuance.fragmentShader = `
      varying vec3 vRepos;

      /* Une raie sombre chaque fois que u passe par un entier. On la tire
         d'un sinus plutot que d'une partie fractionnaire : la fonction fract,
         sur un grand argument, s'effondre en precision moyenne, la ou le
         sinus se degrade doucement.

         (Troisieme fois qu'un accent grave se glisse dans un litteral
         gabarit contenant du GLSL et casse la compilation. Il n'y en a plus
         un seul dans ce fichier, et c'est une regle et non un accident.) */
      float raie(float u, float largeur) {
        float s = abs(sin(u * 3.14159265));
        return 1.0 - smoothstep(0.0, largeur, s);
      }

      float dSeg(vec2 p, vec2 a, vec2 b) {
        vec2 e = b - a;
        vec2 q = p - a;
        float t = clamp(dot(q, e) / max(1e-6, dot(e, e)), 0.0, 1.0);
        return length(q - e * t);
      }

      /* L'araignee : deux ovales pour le corps, quatre pattes coudees
         mirroitees. On travaille sur la valeur absolue de l'abscisse, ce qui
         donne les huit pattes pour le prix de quatre. */
      float araignee(vec2 p) {
        float u = abs(p.x), v = p.y;
        vec2 q = vec2(u, v);
        float m = 1.0 - smoothstep(0.88, 1.06, length(vec2(u / 0.020, (v + 0.014) / 0.050)));
        m = max(m, 1.0 - smoothstep(0.88, 1.06, length(vec2(u / 0.0155, (v - 0.040) / 0.023))));
        float e = 1.0;
        e = min(e, dSeg(q, vec2(0.011, 0.030), vec2(0.049, 0.049)));
        e = min(e, dSeg(q, vec2(0.049, 0.049), vec2(0.072, 0.027)));
        e = min(e, dSeg(q, vec2(0.013, 0.017), vec2(0.056, 0.026)));
        e = min(e, dSeg(q, vec2(0.056, 0.026), vec2(0.085, -0.006)));
        e = min(e, dSeg(q, vec2(0.013, 0.002), vec2(0.056, -0.002)));
        e = min(e, dSeg(q, vec2(0.056, -0.002), vec2(0.086, -0.036)));
        e = min(e, dSeg(q, vec2(0.012, -0.014), vec2(0.049, -0.028)));
        e = min(e, dSeg(q, vec2(0.049, -0.028), vec2(0.074, -0.064)));
        return max(m, 1.0 - smoothstep(0.0032, 0.0062, e));
      }
    ` + nuance.fragmentShader;

    /* L'ORDRE EST TOUT, ET JE M'Y SUIS REPRIS.

       Le bloc etait ecrit APRES le fragment opaque. Or c'est lui qui ecrit
       gl_FragColor : tout ce qu'on fait ensuite a `outgoingLight` ne va
       nulle part, et la toile n'a jamais atteint l'ecran une seule fois.
       C'est exactement la lecon deja notee sur le pelage du cerf, et je ne
       l'avais pas relue. On calcule AVANT, on laisse le fragment opaque
       conclure. */
    nuance.fragmentShader = nuance.fragmentShader.replace(
      '#include <opaque_fragment>',
      `{
         /* Ramene au centre du corps : voir la note de precision. */
         vec3 q = vRepos - vec3(0.0, 0.95, 0.0);
         /* Une ondulation lente : des fils parfaitement rectilignes se
            lisent comme un grillage de poulailler, jamais comme une toile. */
         q += 0.008 * vec3(sin(q.y * 17.0), sin(q.z * 15.0), sin(q.x * 19.0));

         const float MAILLE = 21.0;          // environ quatre centimetres et demi
         float t1 = raie(dot(q, vec3( 0.93,  0.31,  0.20)) * MAILLE, 0.17);
         float t2 = raie(dot(q, vec3(-0.37,  0.90,  0.23)) * MAILLE, 0.17);
         float t3 = raie(dot(q, vec3( 0.22,  0.29,  0.93)) * MAILLE, 0.17);
         float toile = max(t1, max(t2, t3));

         /* L'ARAIGNEE. Elle n'existe que sur la poitrine, et le test qui la
            borne sert autant a la placer qu'a epargner le calcul partout
            ailleurs. */
         float ecusson = 0.0;
         if (vRepos.z < -0.02 && vRepos.y > 1.16 && vRepos.y < 1.46 && abs(vRepos.x) < 0.15) {
           ecusson = araignee(vec2(vRepos.x, vRepos.y - 1.300));
         }

         /* La toile assombrit, l'araignee eteint. Elles ne s'additionnent
            pas : la ou l'araignee est noire, la toile n'a plus a se voir. */
         outgoingLight *= (1.0 - toile * 0.52) * (1.0 - ecusson * 0.88);

         /* LE LISERE DE LUNE. Un bord clair, teinte du ciel de nuit, qui
            detache la silhouette du sous-bois. Il est proportionnel a
            l'incidence rasante, donc il n'apparait que sur les contours. */
         float rasant = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
         outgoingLight += vec3(0.16, 0.20, 0.30) * pow(rasant, 3.2) * 0.55;
       }
       #include <opaque_fragment>`
    );
  };
  /* Le nuanceur injecte ci-dessus n'est pas connu du cache de programmes de
     three.js : sans cette cle, un materiau standard deja compile serait
     reutilise tel quel et rien de tout ceci n'apparaitrait. */
  mat.customProgramCacheKey = () => 'costume-spider-3';
  return mat;
}

/* --------------------------------------------------------------------------
   LES YEUX.

   C'est LA signature. Deux amandes blanches cernees de noir, inclinees vers
   l'interieur : sans elles on a un homme en rouge et bleu, avec elles tout
   le monde le nomme instantanement.

   Elles restent des pieces separees, et pour une bonne raison : elles sont
   physiquement EN RELIEF sur le masque — de vraies lentilles bombees — et
   elles doivent rester nettes de pres comme de loin. Peintes par sommet,
   elles auraient la finesse du maillage ; dessinees dans le nuanceur, elles
   n'auraient aucun relief.

   Elles sont attachees a l'os de la tete, donc elles suivent le regard.
   -------------------------------------------------------------------------- */
function lentille(rayon, couleur, basique) {
  const geo = new THREE.SphereGeometry(rayon, 14, 10);
  const mat = basique
    ? new THREE.MeshBasicMaterial({ color: couleur })
    : new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.28, metalness: 0.1 });
  const m = new THREE.Mesh(geo, mat);
  return m;
}

function poserYeux(os) {
  const tete = os.tete;
  if (!tete) return [];
  /* L'os de la tete a son origine au menton : les coordonnees ci-dessous
     sont donc comptees depuis la, et non depuis le sol. */
  const dy = REPERES.crane - REPERES.menton;
  /* ILS ETAIENT DEUX SOUCOUPES. Cinq centimetres de rayon sur une tete de
     dix-sept de large, c'est un tiers du visage par oeil : le personnage
     avait des lunettes de plongee. Les vrais sont des AMANDES — allongees,
     nettement inclinees vers l'interieur, et bien plus petites qu'on ne
     croit. On les aplatit fortement en profondeur pour qu'elles epousent la
     courbure du masque au lieu d'en ressortir comme deux bulles. */
  const yeux = [];
  for (const sx of [-1, 1]) {
    const cerne = lentille(0.040, 0x06070A, true);
    cerne.scale.set(1.45, 0.66, 0.34);
    cerne.position.set(sx * 0.042, dy + 0.008, -0.070);
    cerne.rotation.z = sx * -0.42;
    cerne.rotation.y = sx * 0.30;
    tete.add(cerne);

    const oeil = lentille(0.033, 0xEDF3FF, true);
    oeil.scale.set(1.42, 0.62, 0.32);
    oeil.position.set(sx * 0.043, dy + 0.008, -0.078);
    oeil.rotation.z = sx * -0.42;
    oeil.rotation.y = sx * 0.30;
    tete.add(oeil);
    /* La lentille SEULE, sans son cerne : c'est elle qu'on retrecit pour un
       clignement ou un plissement — retrecir le cerne avec elle donnerait
       l'impression que le masque entier se froisse plutot que l'oeil qui
       se ferme. */
    yeux.push(oeil);
  }
  return yeux;
}

/* --------------------------------------------------------------------------
   LES LANCE-TOILES.

   Un petit disque metallique sur le dessous de chaque poignet, avec sa
   plaque de declenchement — le detail qui explique D'OU vient le fil, sans
   lui les mains sont juste des mains. Discret a dessein : c'est un
   mecanisme, pas un gantelet, et il ne doit jamais rivaliser avec le motif
   de toile du costume.
   -------------------------------------------------------------------------- */
function poserLanceToiles(os) {
  const matBoitier = new THREE.MeshStandardMaterial({ color: 0x1C1418, roughness: 0.4, metalness: 0.55 });
  const matPlaque = new THREE.MeshStandardMaterial({ color: 0x3A2C30, roughness: 0.3, metalness: 0.7 });
  const matSangle = new THREE.MeshStandardMaterial({ color: 0x14161A, roughness: 0.7 });
  const matTemoin = new THREE.MeshBasicMaterial({ color: 0x8E1620 });
  for (const main of [os.mainD, os.mainG]) {
    if (!main) continue;
    const boitier = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.014, 10), matBoitier);
    boitier.rotation.x = Math.PI / 2;
    boitier.position.set(0, -0.028, 0.02);
    main.add(boitier);
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, 0.020), matPlaque);
    plaque.position.set(0, -0.036, 0.02);
    main.add(plaque);
    /* La sangle : un bracelet fin qui maintient le boitier au poignet — sans
       elle, le lance-toile a l'air pose la plutot qu'attache. */
    const sangle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 5, 10), matSangle);
    sangle.rotation.y = Math.PI / 2;
    sangle.position.set(0, -0.006, 0);
    main.add(sangle);
    /* Un temoin, minuscule et sombre — la seule tache de couleur du
       mecanisme. Il ne s'allume jamais : ce n'est pas une source de
       lumiere, seulement une pastille qui dit « ceci a une fonction ». */
    const temoin = new THREE.Mesh(new THREE.SphereGeometry(0.004, 5, 4), matTemoin);
    temoin.position.set(0, -0.028, 0.028);
    main.add(temoin);
  }
}

/* --------------------------------------------------------------------------
   LA FABRIQUE.

   Le corps est construit UNE FOIS et memorise. Les cinq apparitions du
   personnage se partagent la meme geometrie et le meme materiau ; seuls les
   squelettes, qui ne coutent rien, sont propres a chacune.
   -------------------------------------------------------------------------- */
/* DEUX FINESSES, ET LA RAISON EST ARITHMETIQUE.

   Le personnage coute quarante-deux mille triangles au palier moyen. C'est
   parfaitement raisonnable pour UN exemplaire — le cerf, sujet de toute la
   balade, en coute trente-deux — mais la scene du trio en montre TROIS en
   meme temps, soit cent vingt-huit mille triangles d'un coup sur une scene
   qui en compte cent cinquante. Un tiers de plus, pour un gag.

   Les deux apparitions solo, elles, sont les plus proches et les plus
   regardees : elles gardent la finesse pleine. Le trio se contente d'une
   grille elargie de moitie, ce qui divise son cout par deux et quelque —
   et a vingt-deux metres, ou les trois font quatre-vingts pixels de haut,
   la difference n'existe pas.

   Les deux variantes partagent le meme materiau : un seul programme de
   nuanceur pour les cinq personnages. */
const _corps = {};
let _matiere = null;

export function corpsSpider(palier, variante = 'fin') {
  if (!_corps[variante]) {
    const pas = variante === 'trio'
      ? (palier.nom === 'bas' ? 0.038 : palier.nom === 'moyen' ? 0.031 : 0.026)
      : undefined;
    _corps[variante] = construireCorps(palier, {
      teinter: teinteSpider,
      pas,
      /* Une carrure un peu au-dessus de la normale : le personnage est un
         acrobate, pas un culturiste. Au-dela de 1,10 la silhouette devient
         celle d'un lutteur et cesse d'etre la sienne. */
      gabarit: { carrure: 1.06, masse: 0.98 },
    });
  }
  if (!_matiere) _matiere = matiereCostume();
  return _corps[variante];
}

export function creerSpider(palier, opts = {}) {
  const corps = corpsSpider(palier, opts.variante || 'fin');
  const perso = nouvelleInstance(corps, _matiere, opts);
  const os = perso.userData.os;
  /* Les lentilles sont retenues sur l'os de la tete, et non sur `perso`
     directement : c'est `os.tete` qu'une scene manipule deja pour le
     regard, autant y trouver les yeux au meme endroit. */
  os.tete.userData.yeux = poserYeux(os);
  poserLanceToiles(os);
  return perso;
}

/* Pour les bancs d'essai : le cout reel de chaque variante. */
export function coutSpider() {
  const out = {};
  for (const k in _corps) out[k] = { triangles: _corps[k].triangles, sommets: _corps[k].sommets };
  return out;
}

/* --------------------------------------------------------------------------
   LE REPERTOIRE DE POSES.

   Chaque pose est un dictionnaire d'angles par os. Les os absents sont au
   repos, ce qui evite de repeter seize lignes de zeros a chaque fois.

   Le repos, c'est le corps debout bras le long du corps : toutes les valeurs
   se lisent donc comme des angles d'anatomie. Un bras leve a la verticale
   vaut PI sur l'axe X, un bras a l'horizontale devant vaut PI/2.
   -------------------------------------------------------------------------- */
const PI = Math.PI;

/* --------------------------------------------------------------------------
   LE SENS DES ANGLES DE BRAS, PARCE QUE JE L'AVAIS PRIS A L'ENVERS.

   Dans la pose de liaison, le bras droit part vers +X et le bras gauche vers
   -X ; la correction de liaison les ramene tous deux a la verticale par une
   rotation autour de Z, negative a droite et positive a gauche. Il s'ensuit
   que pour ECARTER un bras du corps, il faut ajouter un angle POSITIF a
   droite et NEGATIF a gauche — soit l'inverse de ce que j'avais ecrit
   partout.

   Le resultat se voyait : les bras se plaquaient contre le thorax au lieu de
   s'en detacher, et la peau du bras se confondait avec celle du flanc. Un
   bras qui touche le corps n'est jamais lisible, quelle que soit la finesse
   du maillage — il faut un doigt de jour entre les deux.
   -------------------------------------------------------------------------- */
export const POSES = {
  /* Debout, mais pas au garde-a-vous : un poids sur une jambe, les coudes
     legerement flechis, les epaules qui tombent. Trois lignes qui font la
     difference entre quelqu'un debout et un mannequin de vitrine. */
  debout: {
    brasD: [0.10, 0, 0.20], avantD: [0.26, 0, 0],
    brasG: [0.06, 0, -0.18], avantG: [0.30, 0, 0],
    cuisseD: [-0.05, 0, 0.06], molletD: [0.10, 0, 0],
    cuisseG: [0.08, 0, -0.09], molletG: [-0.16, 0, 0],
    bassin: [0, 0, 0.03], colonne: [0.02, 0, -0.02], poitrine: [-0.02, 0, 0],
  },

  /* Le bras tendu vers l'autre, presque a l'horizontale, le coude a peine
     casse — un bras parfaitement droit a l'air d'une barre. L'autre reste
     le long du corps : deux bras tendus feraient un epouvantail. */
  pointe: {
    brasD: [1.44, 0, 0.12], avantD: [0.16, 0, 0], mainD: [0, 0, -0.20],
    brasG: [0.14, 0, -0.22], avantG: [0.36, 0, 0],
    cuisseD: [-0.04, 0, 0.10], molletD: [0.08, 0, 0],
    cuisseG: [0.10, 0, -0.12], molletG: [-0.18, 0, 0],
    colonne: [0.04, 0.06, 0], poitrine: [0, 0.10, 0],
  },

  /* Suspendu par un pied, l'autre jambe repliee en travers, les bras qui
     pendent VERS LE SOL — ce qui, dans un repere retourne, veut dire qu'ils
     remontent le long du corps. C'est le genre d'inversion ou l'on se
     trompe une fois sur deux, et ou l'image tranche immediatement. */
  suspendu: {
    cuisseD: [0.04, 0, 0.02], molletD: [-0.06, 0, 0], piedD: [0.30, 0, 0],
    cuisseG: [0.62, 0, -0.24], molletG: [-1.42, 0, 0],
    brasD: [2.86, 0, 0.17], avantD: [-0.40, 0, 0],
    brasG: [2.82, 0, -0.15], avantG: [-0.46, 0, 0],
    colonne: [-0.06, 0, 0.04], poitrine: [-0.05, 0, 0],
  },

  /* Le meme, mais il vous a vu : le buste se tourne, un bras se replie. */
  suspenduSalut: {
    cuisseD: [0.04, 0, 0.02], molletD: [-0.06, 0, 0], piedD: [0.30, 0, 0],
    cuisseG: [0.70, 0, -0.26], molletG: [-1.50, 0, 0],
    brasD: [1.55, 0, 0.62], avantD: [-1.05, 0, 0], mainD: [0, 0, 0.3],
    brasG: [2.80, 0, -0.18], avantG: [-0.50, 0, 0],
    colonne: [-0.10, 0.14, 0.06], poitrine: [-0.08, 0.16, 0],
  },

  /* En plein vol, accroche a son fil : un bras tendu vers le haut, le corps
     en fleche, les jambes qui trainent — une tendue, l'autre repliee. C'est
     l'image la plus reproduite du personnage. */
  balance: {
    brasG: [PI, 0, 0.10], avantG: [0.14, 0, 0],
    brasD: [0.58, 0, 0.30], avantD: [0.74, 0, 0],
    cuisseG: [-0.92, 0, -0.06], molletG: [-0.52, 0, 0], piedG: [0.4, 0, 0],
    cuisseD: [-0.34, 0, 0.10], molletD: [-1.20, 0, 0], piedD: [0.3, 0, 0],
    colonne: [-0.16, 0, 0], poitrine: [-0.12, 0, 0],
  },

  /* Le bras libre arme, prêt a lancer : l'epaule recule, le coude se ferme. */
  arme: {
    brasG: [PI, 0, 0.10], avantG: [0.14, 0, 0],
    brasD: [-0.30, 0, 0.50], avantD: [1.75, 0, 0], mainD: [0, 0, -0.4],
    cuisseG: [-1.05, 0, -0.06], molletG: [-0.40, 0, 0], piedG: [0.4, 0, 0],
    cuisseD: [-0.20, 0, 0.10], molletD: [-1.35, 0, 0], piedD: [0.3, 0, 0],
    colonne: [-0.10, -0.16, 0], poitrine: [-0.10, -0.20, 0],
  },

  /* Le lancer, tout detendu vers l'avant. */
  lance: {
    brasG: [PI, 0, 0.10], avantG: [0.14, 0, 0],
    brasD: [2.30, 0, 0.26], avantD: [0.10, 0, 0], mainD: [0.3, 0, 0],
    cuisseG: [-0.80, 0, -0.06], molletG: [-0.62, 0, 0], piedG: [0.4, 0, 0],
    cuisseD: [-0.45, 0, 0.10], molletD: [-1.05, 0, 0], piedD: [0.3, 0, 0],
    colonne: [-0.20, 0.16, 0], poitrine: [-0.16, 0.22, 0],
  },

  /* Accroupi sur ses appuis, mains au sol : la pose d'atterrissage, celle
     que tout le monde reconnait. */
  accroupi: {
    cuisseD: [-1.62, 0, 0.20], molletD: [-1.70, 0, 0], piedD: [0.7, 0, 0],
    cuisseG: [-1.05, 0, -0.34], molletG: [-2.05, 0, 0], piedG: [0.5, 0, 0],
    brasD: [0.55, 0, 0.58], avantD: [0.35, 0, 0],
    brasG: [-0.35, 0, -0.30], avantG: [0.80, 0, 0],
    bassin: [0.20, 0, 0], colonne: [0.34, 0, 0], poitrine: [0.16, 0, 0],
    cou: [-0.30, 0, 0], tete: [-0.32, 0, 0],
  },
};
