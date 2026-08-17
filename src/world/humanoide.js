/* LE CORPS HUMAIN — surface implicite, comme le cerf.

   ANTOINE : « on dirait un personnage Roblox ».

   Il a raison, et le defaut etait structurel, pas cosmetique. Les
   personnages etaient faits de capsules POSEES COTE A COTE : un torse, deux
   bras, deux jambes, chacun son volume ferme. Or la ou deux tubes se
   rencontrent, on voit deux tubes qui se rencontrent. Aucune epaule, aucune
   hanche, aucun cou ne peut exister quand la geometrie est un assemblage —
   on peut raffiner chaque piece indefiniment, le personnage reste un jouet
   emboite. C'est exactement le probleme qu'avait le cerf avant sa refonte,
   et exactement le meme remede :

   1. on decrit le corps par des capsules ANISOTROPES et EFFILEES — la ou
      seraient ses os et ses masses musculaires. Un deltoide n'est pas une
      sphere posee sur un bras : c'est un volume qui deborde du tronc et
      s'effile vers le biceps ;
   2. on en fait un champ scalaire en fusionnant tout par un minimum adouci
      qui traite les capsules D'UN SEUL COUP (voir `shape.js` : la version
      par paires accumule les retraits et fabrique des bourrelets) ;
   3. on extrait la surface de niveau zero par marching tetrahedra : UNE
      SEULE PEAU CONTINUE, fermee, sans une seule soudure ;
   4. les normales viennent du GRADIENT du champ, pas des faces. Elles sont
      donc exactes et lisses meme la ou le maillage est grossier — c'est ce
      qui fait qu'un personnage a mille facettes ne se lit pas comme facette.

   La peau est ensuite repartie sur un squelette par proximite ponderee, si
   bien qu'elle SE DEFORME : un coude qui plie ecrase le pli interieur et
   tend le pli exterieur, au lieu de faire tourner un tube dans un autre.

   CE QUI EST PARTAGE, ET POURQUOI. La polygonisation coute cher — c'est la
   seule operation lourde de tout ce fichier. On la fait UNE FOIS et les
   cinq Spider-Man de la balade se partagent la meme geometrie ; seuls les
   squelettes sont propres a chacun, et un squelette ne coute que quelques
   dizaines d'objets vides. Sans ce partage, la scene des trois se paierait
   trois polygonisations d'affilee au moment precis ou l'on arrive dessus.
*/

import * as THREE from 'three';
import { champ, polygoniser, orienterFaces, normalesParGradient } from '../deer/shape.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* --------------------------------------------------------------------------
   LES REPERES DU CORPS.

   Toutes les hauteurs sont mesurees depuis la PLANTE DES PIEDS, en metres,
   sur une silhouette d'un metre soixante-dix-huit de type athletique. Ils
   sont rassembles ici parce qu'ils se repondent : deplacer l'epaule sans
   deplacer le coude disloque le bras, et le squelette comme l'anatomie
   lisent les memes chiffres. C'est la seule facon d'eviter que la peau et
   les os se contredisent.
   -------------------------------------------------------------------------- */
export const REPERES = {
  sol: 0,
  cheville: 0.075,
  genou: 0.500,
  fourche: 0.840,
  hanche: 0.920,
  nombril: 1.080,
  cotes: 1.200,
  poitrine: 1.340,
  epaule: 1.440,
  baseCou: 1.500,
  menton: 1.585,
  crane: 1.660,
  sommet: 1.786,

  // Demi-ecartements
  demiEpaule: 0.203,
  demiHanche: 0.096,

  // Longueurs des segments des membres
  humerus: 0.270,
  radius: 0.265,
  paume: 0.130,
  femur: 0.420,
  tibia: 0.425,
  pied: 0.150,
};

/* --------------------------------------------------------------------------
   LA POSE DE LIAISON EST UN « A », ET C'EST LA CORRECTION LA PLUS IMPORTANTE
   DE TOUT CE FICHIER.

   Premiere tentative : bras le long du corps, jambes jointes. Le resultat
   etait pire que les capsules qu'il remplacait — un bras palme, une tete
   fondue dans l'epaule, une masse sans articulation. Deux causes, et les
   deux tiennent a ce choix-la :

   · LA FUSION SOUDE CE QUI SE TOUCHE. Un bras de cinq centimetres de rayon
     colle contre un thorax de quinze ne se distingue plus de lui : le
     minimum adouci fait exactement ce qu'on lui demande, il fusionne. Il
     faut donc que les volumes soient SEPARES dans la pose ou l'on extrait
     la surface ;

   · LA PEAU GARDE LA MEMOIRE DE LA LIAISON. Ce qui a ete soude reste soude :
     quand le bras se leve, il emmene le morceau de thorax avec lequel il a
     fusionne, et l'on obtient une palme. Aucun reglage de poids ne repare
     cela — le defaut est dans la geometrie, pas dans la peau.

   D'ou le « A » : bras ecartes de trente-huit degres, jambes de six. C'est
   la pose de liaison de tous les personnages de jeu depuis toujours, et pour
   cette raison exacte.

   Les poses, elles, restent ecrites en termes ANATOMIQUES — zero veut dire
   « bras le long du corps » — parce que c'est ainsi qu'on peut les relire.
   La table ci-dessous fait la conversion, une fois pour toutes.
   -------------------------------------------------------------------------- */
export const OUVERTURE_BRAS = 0.663;   // 38 degres
export const OUVERTURE_JAMBES = 0.105; // 6 degres

/* Angle a appliquer a un os pour le ramener de la pose de liaison a la pose
   anatomique de reference. Se deduit de l'ouverture, jamais saisi a la main. */
export const REPOS = {
  brasD: [0, 0, -OUVERTURE_BRAS], brasG: [0, 0, OUVERTURE_BRAS],
  cuisseD: [0, 0, -OUVERTURE_JAMBES], cuisseG: [0, 0, OUVERTURE_JAMBES],
};

/* --------------------------------------------------------------------------
   L'ANATOMIE.

   Chaque ligne est un volume musculaire ou osseux, pas un membre. C'est la
   difference entre « un bras » et « un deltoide, un biceps, un triceps, un
   brachio-radial » : le premier est un tube, les seconds font une silhouette.

   L'ANISOTROPIE FAIT LE PLUS GROS DU TRAVAIL. Un thorax humain est nettement
   PLUS LARGE QUE PROFOND — de l'ordre de trois pour deux — et une capsule
   ronde ne peut pas le rendre : elle donne un tonneau, donc un bonhomme de
   neige. Les facteurs `sx` et `sz` etirent le champ dans chaque direction et
   c'est ce rapport, bien plus que le rayon, qui separe une silhouette humaine
   d'un empilement de boudins.

   `gabarit` permet d'en tirer plusieurs physiques a partir des memes
   proportions : `carrure` elargit le haut du corps, `masse` epaissit
   l'ensemble. Les duellistes encapuchonnes n'ont pas la meme charpente qu'un
   acrobate.
   -------------------------------------------------------------------------- */
/* Les points d'articulation du bras et de la jambe dans la pose de liaison.
   UNE SEULE definition, lue par l'anatomie ET par le squelette : c'est la
   seule facon d'etre certain que la peau et les os sont d'accord. */
export function pointBras(cote, long, carrure = 1) {
  const R = REPERES;
  const sx = Math.sin(OUVERTURE_BRAS) * cote, sy = -Math.cos(OUVERTURE_BRAS);
  return [cote * R.demiEpaule * carrure + sx * long, R.epaule + sy * long, 0];
}
export function pointJambe(cote, long) {
  const R = REPERES;
  const sx = Math.sin(OUVERTURE_JAMBES) * cote, sy = -Math.cos(OUVERTURE_JAMBES);
  return [cote * R.demiHanche + sx * long, R.hanche + sy * long, 0];
}

export function anatomieHumaine(gabarit = {}) {
  const R = REPERES;
  const carrure = gabarit.carrure ?? 1;
  const masse = gabarit.masse ?? 1;
  const c = [];
  /* `ra`/`rb` sont les rayons aux deux bouts : c'est l'effilement qui donne
     un muscle. Une capsule a rayon constant est un tuyau, et un corps fait
     de tuyaux se voit immediatement. */
  const C = (ax, ay, az, bx, by, bz, ra, rb, opt) =>
    c.push({ ax, ay, az, bx, by, bz, ra: ra * masse, rb: rb * masse, ...(opt || {}) });

  /* ======================================================================
     LE TRONC

     Cinq etages, chacun avec sa propre section. De bas en haut la section
     passe d'ovale large (bassin) a etroite (taille) puis a tres large et
     aplatie (thorax) : c'est ce RESSERREMENT A LA TAILLE qui fait lire un
     corps humain. Sans lui, on obtient un tronc en tonneau, c'est-a-dire
     exactement la silhouette qu'on cherche a fuir.
     ====================================================================== */
  // Bassin — large, court, legerement bascule.
  C(0, R.fourche + 0.02, 0.015, 0, R.hanche + 0.06, 0.005,
    0.128, 0.140, { sx: 1.30, sz: 0.94 });
  // Abdomen — le point le plus etroit du tronc.
  C(0, R.hanche + 0.06, 0.005, 0, R.nombril + 0.04, 0.000,
    0.140, 0.128, { sx: 1.24, sz: 0.86 });
  // Bas des cotes — la cage commence a s'ouvrir.
  C(0, R.nombril + 0.04, 0.000, 0, R.cotes + 0.06, -0.008,
    0.128, 0.144, { sx: 1.38, sz: 0.88 });
  // Thorax — le plus large, le plus aplati.
  C(0, R.cotes + 0.06, -0.008, 0, R.poitrine + 0.05, -0.010,
    0.144, 0.150, { sx: 1.50 * carrure, sz: 0.90 });
  // Haut du thorax et attache des epaules.
  C(0, R.poitrine + 0.05, -0.010, 0, R.epaule + 0.02, -0.004,
    0.150, 0.132, { sx: 1.52 * carrure, sz: 0.92 });

  /* Les PECTORAUX, en avant du thorax. Deux masses distinctes, separees au
     milieu : c'est cette rainure centrale qui donne le relief, et elle
     n'apparait que si on modelise deux volumes et non un seul. */
  for (const s of [-1, 1]) {
    C(s * 0.030, R.poitrine + 0.02, -0.100, s * 0.150 * carrure, R.poitrine + 0.05, -0.055,
      0.062, 0.048, { sy: 0.80 });
  }
  /* Les GRANDS DORSAUX, en arriere et sur les cotes : ils elargissent le dos
     vers les aisselles et creent le fameux profil en V. */
  for (const s of [-1, 1]) {
    C(s * 0.075, R.cotes, 0.055, s * 0.170 * carrure, R.poitrine + 0.06, 0.010,
      0.055, 0.048, { sy: 1.15 });
  }
  /* Les TRAPEZES : du cou vers chaque epaule, en pente. Sans eux, la tete
     est plantee sur une planche et le personnage a l'air d'un mannequin. */
  for (const s of [-1, 1]) {
    /* LE TRAPEZE MANGEAIT LE COU. A sept centimetres de rayon partant du
       cou lui-meme, il l'engloutissait entierement et la tete se retrouvait
       plantee sur les epaules. Il part desormais un peu plus bas et plus
       loin de l'axe, et il est nettement plus mince a son depart : c'est
       une PENTE entre le cou et l'epaule, pas un col roule. */
    C(s * 0.045, R.baseCou - 0.005, -0.006, s * 0.165 * carrure, R.epaule + 0.025, -0.004,
      0.050, 0.068, { sy: 0.82 });
  }

  /* ======================================================================
     LES BRAS — construits le long de la direction du « A ».

     Chaque articulation se DEDUIT de la precedente, le long d'un vecteur
     unite. C'est ce qui garantit que l'anatomie et le squelette parlent des
     memes points : les deux lisent la meme fonction `pointBras`, et le jour
     ou l'ouverture change, la peau et les os bougent ensemble.
     ====================================================================== */
  for (const s of [-1, 1]) {
    const ep = pointBras(s, 0, carrure);
    const co = pointBras(s, R.humerus, carrure);
    const po = pointBras(s, R.humerus + R.radius, carrure);
    const bo = pointBras(s, R.humerus + R.radius + R.paume, carrure);
    // Un point intermediaire, en fraction de la longueur totale du bras.
    const le = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

    /* DELTOIDE — la piece la plus importante du haut du corps. Il chevauche
       le tronc et le bras, et c'est LUI qui fabrique l'epaule ronde au
       moment de la fusion. Sans deltoide, le bras sort du torse comme un
       manche de balai. */
    C(s * 0.115 * carrure, R.epaule + 0.048, -0.012, ...le(ep, co, 0.30),
      0.068, 0.058, { sz: 0.94 });
    // Biceps et triceps : epais pres de l'epaule, effiles au coude.
    C(...le(ep, co, 0.10), ...le(ep, co, 0.88), 0.056, 0.043, { sz: 1.06 });
    // Le coude lui-meme : un renflement osseux, court et net.
    C(...le(ep, co, 0.92), ...le(co, po, 0.06), 0.044, 0.044, {});
    /* AVANT-BRAS. Il est GROS pres du coude (le brachio-radial) et fin au
       poignet — le rapport est de trois a deux chez un adulte. Un avant-bras
       a rayon constant se lit comme un tuyau de descente. */
    C(...le(co, po, 0.08), ...le(co, po, 0.94), 0.049, 0.031, { sz: 1.04 });
    /* LA MAIN, en moufle aplatie. A la finesse de grille utilisee ici, des
       doigts separes sortiraient en grumeaux ; une main fermee et aplatie,
       avec un pouce, se lit juste et ne peut pas rater. */
    C(...le(po, bo, 0.10), ...le(po, bo, 0.95), 0.037, 0.030, { sx: 0.74, sz: 1.28 });
    // Le pouce, decolle vers l'avant : c'est lui qui dit « main » et non « gant ».
    const m1 = le(po, bo, 0.25), m2 = le(po, bo, 0.62);
    C(m1[0] - s * 0.018, m1[1], m1[2] - 0.024, m2[0] - s * 0.030, m2[1], m2[2] - 0.046,
      0.019, 0.014, {});
  }

  /* ======================================================================
     LES JAMBES
     ====================================================================== */
  for (const s of [-1, 1]) {
    const ha = pointJambe(s, 0);
    const ge = pointJambe(s, R.femur);
    const ch = pointJambe(s, R.femur + R.tibia);
    const le = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

    // Fessier : il ferme le bassin par l'arriere et donne la hanche.
    C(ha[0] - s * 0.010, ha[1] + 0.035, 0.048, ha[0], ha[1] - 0.075, 0.020,
      0.096, 0.090, { sz: 1.08 });
    /* CUISSE. Tres epaisse en haut (quadriceps), nettement plus fine au
       genou : le rapport est proche de deux pour un. */
    C(...le(ha, ge, 0.02), ...le(ha, ge, 0.86), 0.097, 0.059, { sx: 0.96, sz: 1.04 });
    // Genou : un elargissement bref, pas un point.
    C(...le(ha, ge, 0.93), ...le(ge, ch, 0.06), 0.059, 0.055, { sz: 0.96 });
    /* MOLLET. La masse est HAUTE et EN ARRIERE — c'est le repere le plus sur
       d'une jambe humaine, et c'est ce qui manque a un simple cone. */
    const m1 = le(ge, ch, 0.08), m2 = le(ge, ch, 0.46);
    C(m1[0], m1[1], m1[2] + 0.022, m2[0], m2[1], m2[2] + 0.008, 0.067, 0.045, { sz: 1.12 });
    // Bas de jambe : le tibia, fin et anguleux.
    C(...le(ge, ch, 0.46), ...le(ge, ch, 0.96), 0.045, 0.034, { sz: 0.95 });
    /* LE PIED. Aplati, oriente vers l'avant, avec un talon marque en
       arriere : un pied rond se lit comme un sabot. */
    C(ch[0], ch[1] + 0.012, 0.022, ch[0], ch[1] - 0.030, -0.095,
      0.041, 0.039, { sx: 0.90, sy: 0.72 });
    // Avant-pied et orteils.
    C(ch[0], ch[1] - 0.030, -0.095, ch[0], ch[1] - 0.040, -0.168,
      0.039, 0.027, { sx: 0.95, sy: 0.58 });
  }

  /* ======================================================================
     LE COU ET LA TETE
     ====================================================================== */
  // Cou : un cylindre legerement ovale, incline vers l'avant.
  C(0, R.epaule - 0.005, -0.004, 0, R.baseCou + 0.085, -0.016,
    0.056, 0.050, { sx: 1.06, sz: 1.02 });
  /* Le CRANE. Legerement plus haut que large et plus profond que large :
     une sphere donne une tete de poupee. La boite cranienne remonte en
     arriere, le front est plus court. */
  C(0, R.crane - 0.020, 0.010, 0, R.crane + 0.055, -0.005,
    0.086, 0.084, { sx: 0.97, sy: 1.10, sz: 1.08 });
  /* Le visage. LA MACHOIRE AVANCAIT TROP : a cinq centimetres devant l'axe
     avec un rayon de six, elle depassait le front de deux centimetres et le
     personnage avait un museau. Un masque, justement, EFFACE la machoire —
     c'est un ovoide lisse. On la recule et on la retrecit. */
  C(0, R.menton + 0.035, -0.030, 0, R.menton - 0.002, -0.034,
    0.058, 0.046, { sx: 0.92, sy: 0.96, sz: 0.90 });
  // La nuque, qui raccorde le crane au cou par l'arriere.
  C(0, R.crane - 0.030, 0.045, 0, R.baseCou + 0.030, 0.020,
    0.052, 0.050, {});

  return c;
}

/* --------------------------------------------------------------------------
   LE SQUELETTE.

   Seize os, ce qui est peu pour un humain et largement assez pour ce qu'on
   lui demande : marcher, se balancer, pointer du doigt, croiser le fer. On
   n'a ni doigts, ni orteils, ni omoplates mobiles — rien de tout cela n'est
   lisible a vingt metres, et chaque os coute une colonne de plus dans les
   poids de peau.

   Chaque os porte un segment (tete → bout) exprime dans la pose de liaison,
   une IMPORTANCE et une PORTEE. Les trois servent a repartir la peau : un
   sommet appartient d'autant plus a un os qu'il en est proche, pondere par
   l'importance, et un os ne tire rien au-dela de sa portee. Sans la portee,
   la main influencerait la hanche des que le bras pend le long du corps —
   ils sont a douze centimetres l'un de l'autre.
   -------------------------------------------------------------------------- */
export function squeletteHumain() {
  const R = REPERES;
  const os = [];
  const O = (nom, parent, tete, bout, importance, portee) =>
    os.push({ nom, parent, tete, bout, importance, portee });

  O('racine', null, V(0, 0, 0), V(0, 0.2, 0), 0, 0);
  O('bassin', 'racine', V(0, R.hanche, 0), V(0, R.nombril, 0), 2.6, 0.30);
  O('colonne', 'bassin', V(0, R.nombril, 0), V(0, R.cotes + 0.06, 0), 2.2, 0.30);
  O('poitrine', 'colonne', V(0, R.cotes + 0.06, 0), V(0, R.epaule + 0.02, 0), 2.6, 0.36);
  /* LE COU N'AVAIT PAS UN SEUL SOMMET A LUI. Mesure faite : la tete et la
     poitrine, plus importantes et de plus longue portee, se partageaient
     toute la gorge. Un os sans peau est un os mort — et c'est justement lui
     qui porte le tiers du mouvement du regard. On lui donne assez de poids
     pour tenir sa zone, et on raccourcit la portee de la tete pour qu'elle
     s'arrete au menton. */
  O('cou', 'poitrine', V(0, R.baseCou - 0.03, 0), V(0, R.menton, 0), 2.4, 0.13);
  O('tete', 'cou', V(0, R.menton, 0), V(0, R.sommet, -0.02), 2.0, 0.17);

  const P = (t) => V(t[0], t[1], t[2]);
  for (const [suf, sgn] of [['D', 1], ['G', -1]]) {
    /* Les os suivent EXACTEMENT les memes points que l'anatomie — ils lisent
       la meme fonction. C'est la seule facon d'etre certain que l'os d'un
       bras passe bien au milieu de la chair de ce bras : a la main, dans une
       pose en « A », l'erreur est garantie. */
    const ep = P(pointBras(sgn, 0)), co = P(pointBras(sgn, R.humerus));
    const po = P(pointBras(sgn, R.humerus + R.radius));
    const bo = P(pointBras(sgn, R.humerus + R.radius + R.paume));
    O('bras' + suf, 'poitrine', ep, co, 1.3, 0.17);
    O('avant' + suf, 'bras' + suf, co, po, 1.3, 0.15);
    O('main' + suf, 'avant' + suf, po, bo, 1.4, 0.11);

    const ha = P(pointJambe(sgn, 0)), ge = P(pointJambe(sgn, R.femur));
    const ch = P(pointJambe(sgn, R.femur + R.tibia));
    O('cuisse' + suf, 'bassin', ha, ge, 1.5, 0.22);
    O('mollet' + suf, 'cuisse' + suf, ge, ch, 1.5, 0.18);
    O('pied' + suf, 'mollet' + suf, ch, V(ch.x, ch.y - 0.02, ch.z - R.pied), 1.5, 0.12);
  }
  return os;
}

/* Distance d'un point a un segment — la meme que pour le cerf. */
function distSegment(px, py, pz, a, b) {
  const ex = b.x - a.x, ey = b.y - a.y, ez = b.z - a.z;
  const qx = px - a.x, qy = py - a.y, qz = pz - a.z;
  const ee = ex * ex + ey * ey + ez * ez;
  let t = ee > 1e-9 ? (qx * ex + qy * ey + qz * ez) / ee : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = qx - ex * t, dy = qy - ey * t, dz = qz - ez * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/* --------------------------------------------------------------------------
   LA FABRIQUE.

   Elle rend une geometrie PARTAGEABLE : positions, normales de gradient,
   couleurs par sommet et poids de peau. Le squelette, lui, se reconstruit
   par instance — c'est la seule partie qui ne peut pas etre partagee, deux
   personnages n'ayant pas la meme pose.

   `teinter(x, y, z, couleur)` peint la robe par sommet. C'est le bon endroit
   pour les GRANDES ZONES d'un costume — un torse rouge, des jambes bleues —
   et le mauvais endroit pour un motif fin : la nettete d'une couleur par
   sommet est celle du maillage, soit deux centimetres ici. Les motifs fins
   se font dans le nuanceur, ou ils sont continus.
   -------------------------------------------------------------------------- */
export function construireCorps(palier, options = {}) {
  const caps = anatomieHumaine(options.gabarit);
  /* Le rayon de fusion. Trop grand, le cou disparait dans les epaules et les
     jambes se soudent a mi-cuisse ; trop petit, on retrouve les aretes vives
     des capsules et tout le benefice de la methode est perdu. Deux
     un centimetre et demi sur un corps de un metre quatre-vingts, c'est
     l'echelle d'un pli de peau.

     PREMIERE VALEUR ESSAYEE : deux centimetres et demi. C'etait le reglage
     du cerf, et il etait deux fois trop grand ici — un cerf est fait de
     masses epaisses, un humain de membres fins tres proches les uns des
     autres. Le cou disparaissait dans les trapezes et le bras dans le
     thorax. */
  const f = champ(caps, options.fusion ?? 0.015);

  /* LA FINESSE DE GRILLE SUIT LE PALIER, comme pour le cerf.

     Un corps humain est BEAUCOUP plus fin qu'un cerf : un avant-bras fait
     sept centimetres de diametre, un pouce quatre. A pas egal, il faut donc
     une grille plus serree pour lui qu'elle ne l'etait pour l'animal, sans
     quoi les extremites sortent en grumeaux. Le volume a balayer est en
     revanche bien plus petit — un corps debout tient dans un demi-metre cube
     — donc le compte y retrouve son dû. */
  const pas = options.pas
    ?? (palier.nom === 'bas' ? 0.0265 : palier.nom === 'moyen' ? 0.0205 : 0.0175);

  /* La boite doit contenir TOUT le champ, pouces et talons compris : un
     volume qui deborde se fait trancher net par le bord de la grille et
     laisse un trou beant dans la peau. */
  /* La boite s'est ELARGIE avec la pose en « A » : les mains partent
     maintenant a soixante-trois centimetres de l'axe. Un volume qui deborde
     se fait trancher net par le bord de la grille et laisse un trou beant
     dans la peau — on prend large, le cout n'est que lineaire. */
  const boite = new THREE.Box3(V(-0.76, -0.05, -0.30), V(0.76, 1.85, 0.24));
  const { positions, index } = polygoniser(f, boite, pas);
  const normales = normalesParGradient(f, positions, pas);
  orienterFaces(positions, index, normales);
  const nSommets = positions.length / 3;

  /* --- repartition de la peau sur les os ---------------------------------- */
  const osDef = squeletteHumain();
  const pesants = osDef.map((o, i) => ({ ...o, i })).filter((o) => o.importance > 0);

  const skinIndex = new Uint16Array(nSommets * 4);
  const skinWeight = new Float32Array(nSommets * 4);
  const cand = [];

  for (let v = 0; v < nSommets; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    cand.length = 0;
    for (const o of pesants) {
      const d = distSegment(x, y, z, o.tete, o.bout);
      if (d > o.portee) continue;
      /* Le cube de la distance, et non son carre : c'est ce qui rend
         l'attribution FRANCHE. Avec un exponent plus doux, un point du
         flanc se partage a parts presque egales entre le tronc et le bras,
         et le flanc part avec le bras des qu'il se leve. */
      cand.push([o.i, o.importance / (Math.pow(d, 3) + 1e-4)]);
    }
    if (!cand.length) {
      let meilleur = pesants[0], best = Infinity;
      for (const o of pesants) {
        const d = distSegment(x, y, z, o.tete, o.bout);
        if (d < best) { best = d; meilleur = o; }
      }
      cand.push([meilleur.i, 1]);
    }
    cand.sort((p, q) => q[1] - p[1]);
    let somme = 0;
    const n = Math.min(4, cand.length);
    for (let k = 0; k < n; k++) somme += cand[k][1];
    for (let k = 0; k < n; k++) {
      skinIndex[v * 4 + k] = cand[k][0];
      skinWeight[v * 4 + k] = cand[k][1] / somme;
    }
  }

  /* --- la robe, par sommet -----------------------------------------------

     ON PEINT APRES AVOIR REPARTI LA PEAU, ET C'EST INDISPENSABLE.

     Un costume se decoupe par PARTIE DU CORPS — un gant, une botte, un
     plastron — et non par region de l'espace. Or dans la pose de liaison,
     les mains pendent exactement le long des cuisses : a hauteur du poignet,
     la surface de la main et celle de la cuisse occupent la meme tranche
     d'abscisses, a un centimetre pres. Aucune regle geometrique ne peut les
     separer, et j'ai essaye — on obtient une cuisse gantee.

     L'attribution aux os, elle, sait exactement de quoi chaque sommet fait
     partie. On lui passe donc l'os dominant, et la question ne se pose plus. */
  const couleurs = new Float32Array(nSommets * 3);
  const teinter = options.teinter;
  const c = new THREE.Color(0xffffff);
  for (let i = 0; i < nSommets; i++) {
    if (teinter) {
      const nomOs = osDef[skinIndex[i * 4]] ? osDef[skinIndex[i * 4]].nom : '';
      teinter(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], c, nomOs);
    }
    couleurs[i * 3] = c.r; couleurs[i * 3 + 1] = c.g; couleurs[i * 3 + 2] = c.b;
  }

  /* LA PLANTE DES PIEDS DOIT TOMBER EXACTEMENT A ZERO.

     L'origine est censee etre au sol, mais la surface reelle ne passe pas
     par le centre de la derniere capsule : elle passe a un rayon en dessous,
     et ce rayon depend de l'aplatissement du pied et de l'ouverture des
     jambes. Le personnage flottait donc de deux a trois centimetres — assez
     pour se voir, et pas assez pour qu'on devine pourquoi. On MESURE le
     point le plus bas de la peau plutot que de le calculer a la main, et
     l'instance se decale d'autant. */
  let solLocal = Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    if (positions[i] < solLocal) solLocal = positions[i];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normales, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeBoundingSphere();

  return { geo, osDef, solLocal, triangles: index.length / 3, sommets: nSommets };
}

/* --------------------------------------------------------------------------
   UNE INSTANCE.

   Meme geometrie, squelette neuf. On rend un objet dont les os sont
   accessibles par nom, ce qui fait que toute la choregraphie s'ecrit en
   clair — `os.brasD.rotation.x = ...` — au lieu de fouiller un tableau.
   -------------------------------------------------------------------------- */
export function nouvelleInstance(corps, materiau, opts = {}) {
  const bones = [];
  const parNom = {};
  for (const o of corps.osDef) {
    const b = new THREE.Bone();
    b.name = o.nom;
    const orig = o.parent ? corps.osDef.find((q) => q.nom === o.parent).tete : V(0, 0, 0);
    b.position.copy(o.tete).sub(orig);
    if (o.parent) parNom[o.parent].add(b);
    parNom[o.nom] = b;
    bones.push(b);
  }
  const squelette = new THREE.Skeleton(bones);

  const peau = new THREE.SkinnedMesh(corps.geo, materiau);
  /* Le decalage se pose AVANT la liaison : la matrice de liaison est
     capturee au moment du `bind`, et la deplacer apres coup ferait glisser
     la peau par rapport a ses os. */
  peau.position.y = -(corps.solLocal || 0);
  peau.castShadow = opts.ombres !== false;
  peau.receiveShadow = opts.ombres !== false;
  /* Une peau animee sort de sa sphere englobante de liaison des qu'un bras
     se leve : le tri par frustum la ferait disparaitre en pleine action. Le
     groupe parent, lui, reste cullable normalement. */
  peau.frustumCulled = false;
  peau.add(bones[0]);
  peau.bind(squelette);

  const racine = new THREE.Group();
  racine.add(peau);
  racine.userData.os = parNom;
  racine.userData.peau = peau;
  return racine;
}

/* --------------------------------------------------------------------------
   LA POSE.

   Une pose est un simple dictionnaire { nomDOs: [rx, ry, rz] }. Les melanger
   se fait par interpolation lineaire des angles, ce qui est exact pour de
   petites amplitudes et suffisamment juste au-dela : on n'a pas de rotation
   de plus d'un demi-tour sur un seul os, sauf le bras leve, et celui-la ne
   se melange qu'avec lui-meme.

   C'est ce qui permet d'ecrire les apparitions comme de PETITS FILMS : une
   suite de poses cles et des temps de passage, au lieu d'une pile de
   sinusoides ajustees a la main dont personne ne peut plus dire ce qu'elles
   font.
   -------------------------------------------------------------------------- */
export function appliquerPose(os, pose) {
  /* On parcourt LES OS, pas la pose : chaque os doit repartir de sa
     correction de liaison, y compris ceux que la pose ne mentionne pas.
     Parcourir la pose laisserait un bras leve a la pose precedente. */
  for (const nom in os) {
    const b = os[nom];
    const r = REPOS[nom] || ZERO;
    const a = pose[nom] || ZERO;
    b.rotation.set(r[0] + a[0], r[1] + a[1], r[2] + a[2]);
  }
}

/* Melange de deux poses. `k = 0` rend la premiere, `k = 1` la seconde. Les os
   absents d'une pose comptent comme au repos, ce qui evite d'avoir a repeter
   seize lignes de zeros dans chaque pose cle. */
export function melangerPoses(os, a, b, k) {
  for (const nom in os) {
    const bone = os[nom];
    const r = REPOS[nom] || ZERO;
    const pa = a[nom] || ZERO, pb = b[nom] || ZERO;
    bone.rotation.set(
      r[0] + pa[0] + (pb[0] - pa[0]) * k,
      r[1] + pa[1] + (pb[1] - pa[1]) * k,
      r[2] + pa[2] + (pb[2] - pa[2]) * k
    );
  }
}
const ZERO = [0, 0, 0];

/* --------------------------------------------------------------------------
   UNE PISTE D'ANIMATION.

   Des poses cles datees, et l'on demande la pose a l'instant voulu. Le
   passage d'une cle a la suivante se fait en douceur — acceleration puis
   deceleration — parce qu'un mouvement a vitesse constante entre deux poses
   se lit immediatement comme une machine et jamais comme un corps.
   -------------------------------------------------------------------------- */
export function piste(cles) {
  // cles : [{ t, pose }, ...] triees par t croissant.
  return function (os, t) {
    if (t <= cles[0].t) { appliquerPose(os, cles[0].pose); return 0; }
    const dernier = cles[cles.length - 1];
    if (t >= dernier.t) { appliquerPose(os, dernier.pose); return cles.length - 1; }
    let i = 0;
    while (i < cles.length - 1 && cles[i + 1].t <= t) i++;
    const a = cles[i], b = cles[i + 1];
    const brut = (t - a.t) / Math.max(1e-6, b.t - a.t);
    /* Lissage cubique : derivee nulle aux deux bouts. C'est le minimum pour
       qu'un enchainement de poses ne claque pas a chaque cle. */
    const k = brut * brut * (3 - 2 * brut);
    melangerPoses(os, a.pose, b.pose, k);
    return i + brut;
  };
}

/* --------------------------------------------------------------------------
   IL VOUS REGARDE.

   Le geste qui change tout. Une silhouette accrochee a un arbre est un
   decor ; la meme qui TOURNE LA TETE vers vous quand vous passez est une
   rencontre. Deux precautions, sans lesquelles l'effet se retourne :

   · on calcule dans le repere du PERSONNAGE, pas du monde — un personnage
     suspendu la tete en bas se tordrait la nuque du mauvais cote ;
   · on BRIDE, et on repartit sur le cou ET la tete. Une nuque qui pivote
     seule de soixante-dix degres est un accident ; partagee entre deux
     articulations, la meme rotation se lit comme un regard.
   -------------------------------------------------------------------------- */
const _cible = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _bornes = (v, m) => (v < -m ? -m : v > m ? m : v);

export function regarderVers(racine, os, camera, force = 1) {
  if (!camera || !os.tete) return;
  racine.updateWorldMatrix(true, false);
  _cible.setFromMatrixPosition(camera.matrixWorld);
  racine.worldToLocal(_cible);
  _dir.copy(_cible).sub(V(0, REPERES.crane, 0));
  if (_dir.lengthSq() < 1e-8) return;
  _dir.normalize();
  /* Le visage pointe vers -Z : le lacet vaut donc l'arc-tangente des
     composantes opposees, et le tangage l'arc-sinus de la hauteur. */
  const lacet = _bornes(Math.atan2(-_dir.x, -_dir.z), 1.35) * force;
  const tangage = _bornes(Math.asin(_dir.y), 0.75) * force;
  // Un tiers pour le cou, deux tiers pour la tete : c'est la repartition
  // reelle, et c'est elle qui empeche le decrochage de nuque.
  if (os.cou) { os.cou.rotation.y = lacet * 0.34; os.cou.rotation.x = tangage * 0.30; }
  os.tete.rotation.y = lacet * 0.66;
  os.tete.rotation.x = tangage * 0.70;
}
