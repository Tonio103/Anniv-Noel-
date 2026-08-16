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
function flaque(couleur, taille) {
  /* Le maillage est SUBDIVISE, et ce n'est pas un detail : il doit epouser
     le terrain, ce qu'un quadrilatere de deux triangles ne peut pas faire.
     Douze cases de cote sur quinze metres, soit un sommet tous les metres
     et quart — assez fin pour suivre un devers, assez grossier pour ne rien
     couter. */
  const geo = new THREE.PlaneGeometry(taille, taille, 12, 12);
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
  const solBleu = flaque([0.04, 0.26, 2.3], 15);
  const solRouge = flaque([2.3, 0.05, 0.04], 15);
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

   Il apparait DEUX fois — c'est le seul a qui ce fichier accorde ce
   privilege, et c'est assume : Antoine dit qu'il l'aime beaucoup.

   La premiere fois suspendu la tete en bas au bout de son fil, la seconde en
   plein balancement au-dessus du chemin. Les deux poses sont celles qu'on
   reconnait a la silhouette seule, sans voir un seul detail du costume — ce
   qui tombe bien, puisque de nuit et a dix metres on n'en verra aucun.

   Le costume tient a trois choses : le ROUGE du torse et de la tete, le BLEU
   des jambes et des avant-bras, et les DEUX YEUX blancs cernes de noir. Rien
   d'autre ne survit a la distance, surtout pas la toile dessinee.
   ========================================================================== */
/* --- LE TISSU ------------------------------------------------------------

   La toile du costume. On la DESSINE, on ne la suggere pas : deux rayons
   verticaux et des fils transversaux qui pendent entre eux, exactement
   comme une vraie toile d'araignee — des lignes droites d'un bord a l'autre
   donneraient un quadrillage de maillot de foot.

   Le motif est volontairement gros. A vingt metres et de nuit, un reseau
   fin disparait completement ; un reseau large laisse voir quelques traits
   sombres qui cassent l'aplat de couleur, et c'est tout ce qu'on demande.
   Le detail exact ne se lira jamais — ce qui se lit, c'est qu'il y a
   QUELQUE CHOSE dessus, et que ce n'est pas un pyjama uni.

   Les textures sont fabriquees une seule fois et partagees par les cinq
   Spider-Man de la balade : cinq canevas de deux cent cinquante-six pixels
   pour un motif identique seraient du gaspillage pur. */
const _tissus = new Map();
function tissuCostume(fond, trait) {
  const cle = fond + '|' + trait;
  const dejaLa = _tissus.get(cle);
  if (dejaLa) return dejaLa;

  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = n; cv.height = n;
  const c = cv.getContext('2d');
  c.fillStyle = fond;
  c.fillRect(0, 0, n, n);

  /* LE TRAIT ETAIT DIX FOIS TROP FIN, ET LE CALCUL LE DIT.

     Sept mailles de deux virgule six pixels sur deux cent cinquante-six :
     enroule autour d'un torse de vingt-trois centimetres de tour, cela fait
     un fil de deux millimetres. A six metres — la distance la plus courte a
     laquelle on verra jamais ce personnage — un tel fil couvre un dixieme
     de pixel a l'ecran. Il ne pouvait donc RIEN se voir, et le costume
     sortait uniformement rouge.

     On passe a cinq mailles et a des traits de six a sept pixels, soit des
     fils de cinq millimetres : visibles de pres, encore lisibles a dix
     metres, fondus en un grain sombre au-dela. C'est le bon compromis pour
     un personnage qu'on croise de cinq a vingt-cinq metres. */
  const M = 5, pas = n / M;
  c.strokeStyle = trait;
  c.lineCap = 'round';

  /* Les RAYONS : les fils porteurs. On les fait legerement ondulants —
     une toile tendue a la regle a l'air d'un grillage. */
  c.lineWidth = 7;
  for (let i = 0; i <= M; i++) {
    const x = i * pas;
    c.beginPath();
    c.moveTo(x, 0);
    for (let y = 10; y <= n; y += 10) c.lineTo(x + Math.sin(y * 0.055 + i * 1.7) * 2.6, y);
    c.stroke();
  }

  /* Les FILS TRANSVERSAUX : ils PENDENT entre deux rayons. C'est cette
     courbure, et elle seule, qui fait lire « toile » plutot que « filet ». */
  c.lineWidth = 5.5;
  for (let j = 0; j <= M; j++) {
    const y = j * pas;
    for (let i = 0; i < M; i++) {
      const x = i * pas;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + pas * 0.5, y + pas * 0.30, x + pas, y);
      c.stroke();
    }
  }

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  _tissus.set(cle, t);
  return t;
}

/* L'ARAIGNEE DE POITRINE. Quatre paires de pattes recourbees autour d'un
   corps ovale : c'est un dessin de trois lignes, mais c'est le seul detail
   du costume qui soit une FORME et non une matiere, donc le seul qui puisse
   encore se reconnaitre quand la toile, elle, s'est deja fondue en gris. */
let _araignee = null;
function ecussonAraignee() {
  if (_araignee) return _araignee;
  const n = 128;
  const cv = document.createElement('canvas');
  cv.width = n; cv.height = n;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, n, n);
  c.strokeStyle = '#07090C'; c.fillStyle = '#07090C';
  c.lineCap = 'round'; c.lineJoin = 'round';

  // Le corps : deux ovales, l'abdomen plus gros que le cephalothorax.
  c.beginPath(); c.ellipse(64, 74, 11, 20, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(64, 47, 8, 11, 0, 0, Math.PI * 2); c.fill();

  // Les huit pattes, recourbees vers le bas.
  c.lineWidth = 5.5;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const y0 = 42 + i * 9;
      const ouv = 26 + i * 7;
      const chute = 16 + i * 10;
      c.beginPath();
      c.moveTo(64 + sx * 6, y0);
      c.quadraticCurveTo(64 + sx * ouv, y0 - 10 + i * 3, 64 + sx * (ouv + 6), y0 + chute);
      c.stroke();
    }
  }

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  _araignee = t;
  return t;
}

/* UN COSTUME LEGEREMENT EMISSIF. De nuit, sous une lune rasante et a vingt
   metres, un bonhomme rouge et bleu non eclaire n'est qu'une tache noire de
   plus dans les arbres. Une emission faible — pas assez pour qu'il rayonne,
   assez pour qu'il existe — le detache sans en faire une lampe. C'est la
   meme correction que pour les cabanes et le sapin.

   Les deux matieres sont partagees, comme les textures : cinq personnages,
   deux materiaux, donc deux programmes de nuanceur au total. */
let _matRouge = null, _matBleu = null;
function matiereCostume(quelle) {
  if (quelle === 'rouge') {
    if (!_matRouge) {
      _matRouge = new THREE.MeshStandardMaterial({
        map: tissuCostume('#B3202B', 'rgba(12,5,8,0.88)'),
        roughness: 0.60, emissive: 0x3E0A10, emissiveIntensity: 1,
      });
    }
    return _matRouge;
  }
  if (!_matBleu) {
    _matBleu = new THREE.MeshStandardMaterial({
      map: tissuCostume('#1B3C86', 'rgba(4,7,20,0.88)'),
      roughness: 0.60, emissive: 0x0A1430, emissiveIntensity: 1,
    });
  }
  return _matBleu;
}

/* --- LE CORPS ------------------------------------------------------------

   Deux decisions structurent tout ce qui suit, et les deux corrigent un
   defaut qu'on voit a l'ecran.

   1. L'ORIGINE EST AUX PIEDS, pas au bassin.

      Les apparitions sont posees sur le terrain a la hauteur du sol : leur
      origine EST le sol. Un personnage dont l'origine tombait au niveau du
      bassin s'enfoncait donc de quarante-quatre centimetres dans la neige,
      et c'est exactement ce qu'on voyait — trois Spider-Man sans jambes,
      des bustes rouges plantes dans la poudreuse. Le corps se construit
      desormais vers le HAUT depuis la plante des pieds.

   2. LES MEMBRES SONT DES CHAINES, pas des morceaux poses cote a cote.

      Chaque bras est une epaule qui porte un coude qui porte une main ;
      chaque jambe, une hanche qui porte un genou qui porte un pied. Avec des
      capsules independantes, lever un bras laissait l'avant-bras en
      arriere — c'est la definition d'un pantin casse, et c'est pour cela
      que les poses ne tenaient jamais. Une chaine coute six groupes vides
      par personnage : rien du tout, et tout devient possible.

   Les cotes sont nommes correctement : le personnage regarde vers -Z, donc
   son cote DROIT est en +X. L'ancien code appelait « G » ce qui etait la
   droite ; les poses ecrites dessus etaient donc miroir. */
const piece = (r, l, quelle) => new THREE.Mesh(
  new THREE.CapsuleGeometry(r, l, 4, 10), matiereCostume(quelle));

/* Les cotes du squelette, en metres, mesures depuis la plante des pieds.
   Ils sont rassembles ici parce qu'ils se repondent : deplacer l'epaule
   sans deplacer le coude disloque le bras. */
const CORPS = {
  cheville: 0.050, genou: 0.338, hanche: 0.658,
  bassin: 0.710, torse: 1.020, epaule: 1.190, tete: 1.400,
  ecartHanche: 0.078, ecartEpaule: 0.135,
  brasHaut: 0.264, brasBas: 0.252,
  cuisse: 0.320, mollet: 0.288,
};

function spiderMan() {
  const g = new THREE.Group();

  const torse = piece(0.115, 0.30, 'rouge');
  torse.position.y = CORPS.torse;
  g.add(torse);

  const bassin = piece(0.105, 0.10, 'bleu');
  bassin.position.y = CORPS.bassin;
  g.add(bassin);

  /* L'ecusson, pose juste devant le torse. Un decalage de deux millimetres
     suffit a eviter le combat de profondeur, et le plan reste invisible de
     dos — ce qui est correct, la version noire de l'araignee dorsale
     n'appartient pas a ce costume-la. */
  const ecusson = new THREE.Mesh(
    new THREE.PlaneGeometry(0.165, 0.165),
    new THREE.MeshStandardMaterial({
      map: ecussonAraignee(), transparent: true, roughness: 0.6,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    })
  );
  ecusson.position.set(0, CORPS.torse + 0.045, -0.113);
  g.add(ecusson);

  /* LA TETE EST UN GROUPE, ET C'EST LA DIFFERENCE ENTRE UN MANNEQUIN ET
     QUELQU'UN. Le crane et les deux yeux vivent dedans, donc il suffit de
     tourner ce groupe pour qu'il REGARDE — s'ils etaient poses directement
     dans le corps, tourner le crane laisserait les yeux en arriere, ce qui
     est la definition meme d'un bug de poupee. */
  /* Le cou. Sans lui la tete flotte deux centimetres au-dessus des epaules,
     ce qui se voit tout de suite et fait « figurine mal emboitee ». Il
     appartient au corps et non a la tete : un cou qui tourne avec le crane
     tordrait le col du costume. */
  const cou = piece(0.055, 0.06, 'rouge');
  cou.position.y = (CORPS.torse + CORPS.tete) / 2 + 0.06;
  g.add(cou);

  const tete = new THREE.Group();
  tete.position.y = CORPS.tete;
  g.add(tete);

  const crane = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), matiereCostume('rouge'));
  crane.scale.set(0.92, 1.0, 1.02);
  tete.add(crane);

  /* LES YEUX. C'est LA signature — deux amandes blanches cernees de noir,
     inclinees vers l'interieur. Sans elles on a un bonhomme rouge et bleu ;
     avec elles, tout le monde le nomme instantanement. */
  const matOeil = new THREE.MeshBasicMaterial({ color: 0xF2F6FF });
  const matCerne = new THREE.MeshBasicMaterial({ color: 0x08090C });
  for (const sx of [-1, 1]) {
    const cerne = new THREE.Mesh(new THREE.SphereGeometry(0.049, 10, 8), matCerne);
    cerne.scale.set(1.24, 0.78, 0.5);
    cerne.position.set(sx * 0.046, 0.015, -0.083);
    cerne.rotation.z = sx * -0.34;
    tete.add(cerne);

    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), matOeil);
    oeil.scale.set(1.22, 0.76, 0.5);
    oeil.position.set(sx * 0.046, 0.015, -0.094);
    oeil.rotation.z = sx * -0.34;
    tete.add(oeil);
  }

  const membres = {};
  for (const sx of [-1, 1]) {
    const n = sx > 0 ? 'D' : 'G';

    /* --- LE BRAS. Au repos il PEND : chaque segment part vers -Y depuis
       son articulation, et les rotations se lisent alors comme des angles
       d'anatomie et non comme des corrections. */
    const epaule = new THREE.Group();
    epaule.position.set(sx * CORPS.ecartEpaule, CORPS.epaule, 0);
    g.add(epaule);

    const brasH = piece(0.042, 0.18, 'rouge');
    brasH.position.y = -CORPS.brasHaut / 2;
    epaule.add(brasH);

    const coude = new THREE.Group();
    coude.position.y = -CORPS.brasHaut;
    epaule.add(coude);

    const brasB = piece(0.036, 0.18, 'bleu');
    brasB.position.y = -CORPS.brasBas / 2;
    coude.add(brasB);

    const main = new THREE.Group();
    main.position.y = -CORPS.brasBas;
    coude.add(main);
    // Le gant : une petite sphere rouge, qui ferme proprement l'avant-bras.
    const gant = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), matiereCostume('rouge'));
    gant.scale.set(1, 1.15, 1.1);
    main.add(gant);

    /* --- LA JAMBE, sur le meme principe. */
    const hanche = new THREE.Group();
    hanche.position.set(sx * CORPS.ecartHanche, CORPS.hanche, 0);
    g.add(hanche);

    const cuisse = piece(0.055, 0.21, 'bleu');
    cuisse.position.y = -CORPS.cuisse / 2;
    hanche.add(cuisse);

    const genou = new THREE.Group();
    genou.position.y = -CORPS.cuisse;
    hanche.add(genou);

    const mollet = piece(0.044, 0.20, 'bleu');
    mollet.position.y = -CORPS.mollet / 2;
    genou.add(mollet);

    const pied = new THREE.Group();
    pied.position.y = -CORPS.mollet;
    genou.add(pied);
    /* La botte. Elle avance sous la cheville : sans elle, la jambe se
       termine par un moignon arrondi et le personnage a l'air de flotter,
       meme quand il touche exactement le sol. */
    const botte = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.075, 0.20), matiereCostume('rouge'));
    botte.position.set(0, -0.0125, -0.045);
    pied.add(botte);

    membres['epaule' + n] = epaule; membres['coude' + n] = coude; membres['main' + n] = main;
    membres['hanche' + n] = hanche; membres['genou' + n] = genou; membres['pied' + n] = pied;
  }

  g.userData.membres = membres;
  g.userData.tete = tete;
  return g;
}

/* Une pose de repos qui ne soit pas un garde-a-vous : les bras s'ecartent
   un peu du corps, les coudes flechissent, un genou est legerement plie.
   Trois lignes qui suffisent a faire la difference entre quelqu'un debout
   et un mannequin de vitrine. */
function poseDebout(perso, graine = 0) {
  const m = perso.userData.membres;
  for (const [n, sx] of [['D', 1], ['G', -1]]) {
    m['epaule' + n].rotation.z = sx * -0.14;
    m['epaule' + n].rotation.x = 0.10 + Math.sin(graine + sx) * 0.05;
    m['coude' + n].rotation.x = 0.28;
  }
  m.genouG.rotation.x = -0.16;
  m.hancheG.rotation.x = 0.10;
}

/* --- IL VOUS REGARDE -----------------------------------------------------

   Le geste qui change tout. Une silhouette accrochee a un arbre est un
   decor ; la meme silhouette qui TOURNE LA TETE vers vous quand vous
   passez est une rencontre. Ca ne coute que deux angles, et c'est de loin
   le meilleur rapport qualite-prix de tout ce fichier.

   Deux precautions, sans lesquelles l'effet se retourne :

   · on calcule dans le repere du PERSONNAGE, pas du monde. Le Spider-Man
     suspendu est retourne tete en bas ; un calcul en coordonnees monde lui
     ferait tordre la nuque du mauvais cote ;
   · on BRIDE. Une tete qui pivote de cent quatre-vingts degres pour ne pas
     lacher la camera cesse d'etre inquietante et devient cassee. Au-dela de
     la limite, il perd la camera de vue — et c'est tres bien ainsi. */
const _cible = new THREE.Vector3();
const _dir = new THREE.Vector3();
function regarder(perso, camera, force = 1, limiteY = 1.15, limiteX = 0.62) {
  const tete = perso.userData.tete;
  if (!tete || !camera) return;
  perso.updateWorldMatrix(true, false);
  _cible.setFromMatrixPosition(camera.matrixWorld);
  perso.worldToLocal(_cible);
  _dir.copy(_cible).sub(tete.position);
  if (_dir.lengthSq() < 1e-6) return;
  _dir.normalize();
  /* Le visage pointe vers -Z : le lacet vaut donc atan2 sur les composantes
     opposees, et le tangage est directement l'arc-sinus de la hauteur. */
  const lacet = Math.atan2(-_dir.x, -_dir.z);
  const tangage = Math.asin(clamp(_dir.y, -1, 1));
  tete.rotation.y = clamp(lacet, -limiteY, limiteY) * force;
  tete.rotation.x = clamp(tangage, -limiteX, limiteX) * force;
}

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
   vers le sol. Trois temps la font vivre — il pend, il vous repere, il vous
   salue — et sans ces trois temps on regarde un pantin au bout d'une
   ficelle pendant huit secondes.
   ========================================================================== */
function spiderSuspendu() {
  const g = new THREE.Group();
  const perso = spiderMan();
  const pivot = new THREE.Group();
  pivot.add(perso);

  /* IL PENDAIT SOUS LA NEIGE, PUIS PAR LE VENTRE. Deux corrections
     successives, dont voici le compte definitif : le groupe est pose AU SOL,
     le personnage est retourne d'un demi-tour autour de Z — donc ses pieds
     restent a la hauteur qu'on lui donne et sa tete descend d'un metre et
     demi en dessous. On accroche les pieds a 3,30 m : la tete arrive alors
     a 1,80 m, pile a hauteur de regard du drone. */
  const CHEVILLES = 3.30;
  perso.rotation.z = Math.PI;
  perso.position.y = CHEVILLES;

  const fil = filDeToile(3.5);
  fil.position.y = CHEVILLES + 1.75;
  pivot.add(fil);
  g.add(pivot);

  const m = perso.userData.membres;

  /* LA POSE. Une jambe tendue — c'est elle qui tient le fil — l'autre
     repliee en travers ; les bras pendent VERS LE SOL, ce qui, dans un
     repere retourne, veut dire qu'ils remontent le long du corps. C'est le
     genre d'inversion ou l'on se trompe une fois sur deux, et ou l'image
     tranche immediatement. */
  m.hancheD.rotation.x = 0.06;
  m.genouD.rotation.x = -0.05;
  m.hancheG.rotation.x = 0.55;
  m.genouG.rotation.x = -1.35;
  m.hancheG.rotation.z = -0.22;

  const BRAS = 2.85;                 // presque un demi-tour : ils pendent
  for (const [n, sx] of [['D', 1], ['G', -1]]) {
    m['epaule' + n].rotation.x = BRAS;
    m['epaule' + n].rotation.z = sx * 0.16;
    m['coude' + n].rotation.x = -0.35;
  }

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.traverse((o) => {
      if (o.material && o.material.transparent) o.material.opacity = vis;
    });
    g.visible = vis > 0.01;

    // Il se balance doucement, et tourne un peu sur lui-meme.
    pivot.rotation.z = Math.sin(t * 1.15) * 0.16;
    /* La rotation propre s'ARRETE quand il vous a vu : on ne detaille pas
       quelqu'un qui tourne sur lui-meme, et surtout, un regard qui suit
       pendant que le corps pivote se lit comme un decrochage de nuque. */
    const attention = smoothstep(0.20, 0.36, u);
    pivot.rotation.y = Math.sin(t * 0.52) * 0.9 * (1 - attention);
    regarder(perso, camera, attention, 1.25, 0.85);

    /* LE SALUT. Un bras se leve et oscille deux fois, au milieu du passage.
       Court : un salut qui dure devient un moulinet. Il part de l'epaule et
       le coude suit — c'est tout l'interet d'avoir une chaine. */
    const salut = smoothstep(0.42, 0.50, u) * smoothstep(0.74, 0.62, u);
    const bat = Math.sin(t * 5.6);
    m.epauleD.rotation.x = BRAS - salut * 1.45;
    m.epauleD.rotation.z = 0.16 + salut * (0.55 + bat * 0.28);
    m.coudeD.rotation.x = -0.35 - salut * 0.55;
    m.coudeD.rotation.z = salut * bat * 0.45;
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
function spiderBalance(porteeX) {
  const g = new THREE.Group();
  const ancre = new THREE.Group();       // le point d'accroche, en hauteur
  const perso = spiderMan();

  /* LE FIL PARTAIT DANS LE MAUVAIS SENS. Il montait de l'ancre vers le ciel
     pendant que le personnage pendait dessous, sans rien qui les relie :
     un homme en vol plane sous une corde tendue vers rien. Il descend
     desormais de l'ancre jusqu'a la main levee, ce qui est le seul montage
     qui se tienne. */
  const LONGUEUR = 3.4;
  const fil = filDeToile(LONGUEUR);
  fil.position.y = -LONGUEUR / 2;
  ancre.add(fil);

  /* Le poignet leve se trouve a `epaule + brasHaut + brasBas` au-dessus des
     pieds : on descend le personnage d'autant pour que sa main touche
     exactement le bout du fil. Une constante calculee, jamais un nombre
     ajuste a vue — le jour ou l'on rallonge un bras, tout suit. */
  const POIGNET = CORPS.epaule + CORPS.brasHaut + CORPS.brasBas;
  perso.position.y = -LONGUEUR - POIGNET;
  ancre.add(perso);
  g.add(ancre);
  ancre.position.y = 9.2;

  const m = perso.userData.membres;
  /* Le bras gauche tendu vers le haut : c'est lui qui tient. Un demi-tour
     complet de l'epaule met le bras a la verticale, vers +Y. */
  m.epauleG.rotation.x = Math.PI;
  m.epauleG.rotation.z = -0.10;
  m.coudeG.rotation.x = 0.12;
  // Le droit reste bas, pret a lancer.
  m.epauleD.rotation.x = 0.55;
  m.epauleD.rotation.z = -0.30;
  m.coudeD.rotation.x = 0.7;
  /* Les jambes trainent en arriere, comme sur toutes les images du
     personnage en vol : une jambe tendue, l'autre repliee. */
  m.hancheG.rotation.x = -0.85;
  m.genouG.rotation.x = -0.55;
  m.hancheD.rotation.x = -0.30;
  m.genouD.rotation.x = -1.15;

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
    perso.rotation.x = -0.34 + Math.abs(a) * 0.30;

    /* Il se retourne vers vous au passage le plus bas — le seul instant ou
       il est assez pres pour que ca se voie. */
    regarder(perso, camera, smoothstep(0.30, 0.44, u) * smoothstep(0.80, 0.66, u), 1.4, 0.9);

    // Le bras libre s'arme, puis se detend d'un coup vers l'avant.
    const armer = smoothstep(0.40, 0.56, u);
    const lacher = smoothstep(0.56, 0.64, u);
    m.epauleD.rotation.x = 0.55 + armer * 0.75 - lacher * 3.4;
    m.epauleD.rotation.z = -0.30 - lacher * 0.35;
    m.coudeD.rotation.x = 0.70 + armer * 0.9 - lacher * 1.5;

    if (!tirFait && u > 0.58) { tirFait = true; g.userData.emettre?.('toile'); }

    const sortie = smoothstep(0.58, 0.68, u);
    if (sortie > 0.01) {
      /* La position du poignet, prise dans le repere du groupe. On force la
         mise a jour de la branche concernee : les matrices du monde ne sont
         recalculees qu'au moment du rendu, donc sans cela le fil accuserait
         une image de retard — visible, sur un mouvement aussi rapide. */
      ancre.updateWorldMatrix(true, true);
      _poignet.set(0, 0, 0);
      m.mainD.localToWorld(_poignet);
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
    disque.material.opacity = vis * 0.42;
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
    g.position.y = camera.position.y + 34;
    g.lookAt(camera.position);

    // La traversee : de gauche a droite devant le disque, en montant a peine.
    velo.position.set((u - 0.5) * 74, 3 + Math.sin(t * 0.8) * 1.4, 1);
  };
  return g;
}

/* ==========================================================================
   4. LE DUEL DE SABRES

   Deux lames, une verte et une rouge, qui s'entrechoquent derriere les
   troncs. On ne voit jamais les duellistes — et c'est mieux ainsi : deux
   silhouettes mal faites tueraient l'effet, alors que deux lames qui
   claquent l'une contre l'autre dans le noir se passent d'acteurs.
   ========================================================================== */
function lame(couleur, halos) {
  const g = new THREE.Group();
  const l = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.035, 1.15, 4, 8),
    new THREE.MeshBasicMaterial({ color: 0xF2FFF6 })
  );
  l.position.y = 0.68;
  g.add(l);
  const h = halo(halos, 2.3);
  h.position.y = 0.68;
  h.material.opacity = 0;
  g.add(h);
  const poignee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.028, 0.20, 6),
    new THREE.MeshStandardMaterial({ color: 0x2A2E36, roughness: 0.5, metalness: 0.6 })
  );
  g.add(poignee);
  g.userData.halo = h;
  g.userData.lame = l;
  void couleur;
  return g;
}

function duelSabres() {
  const g = new THREE.Group();
  const vert = lame(0x8CFF7A, [0.55, 3.2, 0.75]);
  const rouge = lame(0xFF6A5A, [3.2, 0.45, 0.35]);
  vert.position.set(-1.15, 0.9, 0);
  rouge.position.set(1.15, 0.9, 0);
  rouge.rotation.z = Math.PI;
  rouge.position.y = 2.0;
  g.add(vert, rouge);

  const eclat = halo([2.6, 2.9, 2.4], 4.0);
  eclat.position.set(0, 1.5, 0);
  g.add(eclat);

  /* Le numero de la passe d'armes en cours : il sert a ne declencher le
     choc sonore QU'UNE FOIS par passe. Le pic dure cinq images environ, et
     sans ce garde-fou on entendrait cinq chocs colles bout a bout. */
  let dernierePasse = -1;

  g.userData.jouer = (u, t) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    /* Trois passes d'armes : les lames se rapprochent, claquent, se
       separent. Le rythme est ce qui fait « duel » plutot que « deux
       batons qui bougent ». */
    const passe = (t * 1.25) % 1;
    const choc = Math.pow(Math.max(0, 1 - Math.abs(passe - 0.5) * 5), 2);
    const numero = Math.floor(t * 1.25);
    if (choc > 0.55 && numero !== dernierePasse) {
      dernierePasse = numero;
      // Le son part au moment ou les lames se touchent, pas avant.
      if (vis > 0.2) g.userData.emettre?.('choc');
    }
    vert.rotation.z = -0.55 + Math.sin(t * 3.9) * 0.42 - choc * 0.35;
    rouge.rotation.z = Math.PI + 0.55 - Math.sin(t * 3.7 + 1.1) * 0.42 + choc * 0.35;
    vert.position.x = -1.15 + choc * 0.55;
    rouge.position.x = 1.15 - choc * 0.55;
    vert.userData.halo.material.opacity = vis * 0.85;
    rouge.userData.halo.material.opacity = vis * 0.85;
    eclat.material.opacity = vis * choc * 0.9;
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
  const mat = new THREE.MeshBasicMaterial({
    color: 0xBFE4FF, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
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
function trioSpider() {
  const g = new THREE.Group();
  const R = 1.45;                       // rayon du triangle
  const persos = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p = spiderMan();
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

    const m = p.userData.membres;
    poseDebout(p, i * 2.1);
    /* Le bras tendu vers l'autre, presque a l'horizontale, le coude a peine
       casse — un bras parfaitement droit a l'air d'une barre. L'autre reste
       le long du corps : deux bras tendus feraient un epouvantail. */
    m.epauleD.rotation.x = 1.46 + (i % 2 ? 0.06 : -0.05);
    m.epauleD.rotation.z = -0.10;
    m.coudeD.rotation.x = 0.14;
    m.epauleG.rotation.x = 0.16;
    m.epauleG.rotation.z = -0.22;
    m.coudeG.rotation.x = 0.34;
    /* Un appui legerement decale : trois personnages pieds joints font trois
       poteaux. */
    m.hancheD.rotation.z = 0.10 + (i % 3) * 0.03;
    m.hancheG.rotation.z = -0.13;

    g.add(p);
    persos.push(p);
  }

  g.userData.jouer = (u) => {
    const vis = smoothstep(0, 0.12, u) * smoothstep(1, 0.86, u);
    g.visible = vis > 0.01;
    // Aucune animation. C'est le sujet.
    void persos;
  };
  return g;
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
    const plan = [
      { nom: 'police',   s: L * 0.09, cote: -1, ecart: 10,  avant: 42, apres: 10, faire: () => voiturePolice(), tourne: 0.6 },
      { nom: 'spider1',  s: L * 0.21, cote:  1, ecart: 5.5, avant: 30, apres: 8,  faire: () => spiderSuspendu() },
      { nom: 'et',       s: L * 0.33, cote:  0, ecart: 0,   avant: 34, apres: 24, faire: () => etDevantLaLune() },
      { nom: 'sabres',   s: L * 0.45, cote: -1, ecart: 11,  avant: 40, apres: 10, faire: () => duelSabres() },
      { nom: 'trio',     s: L * 0.57, cote: -1, ecart: 7,   avant: 34, apres: 10, faire: () => trioSpider(), tourne: 0.4 },
      { nom: 'patronus', s: L * 0.68, cote:  1, ecart: 8,   avant: 38, apres: 12, faire: () => patronus() },
      { nom: 'spider2',  s: L * 0.79, cote:  1, ecart: 5.5, avant: 28, apres: 8,  faire: () => spiderBalance(9) },
      { nom: 'delorean', s: L * 0.90, cote:  0, ecart: 0,   avant: 34, apres: 8,  faire: () => traineesDeFeu(26) },
    ];

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
    void palier;
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
