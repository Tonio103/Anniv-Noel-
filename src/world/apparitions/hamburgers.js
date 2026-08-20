import * as THREE from 'three';
import { smoothstep } from '../../core/noise.js';
import { buee, majBuee, gerbeImpact, majImpact } from './communs.js';

/* ==========================================================================
   LES HAMBURGERS QUI VOLENT

   Antoine : « je veux des hamburgers qui volent car j'aime la nourriture ».
   Rien a expliquer, rien a reconnaitre — juste une nuee qui tourbillonne
   devant le chemin. Plantee une fois pour toutes a un point fixe : voir la
   lune plus haut pour la raison exacte (jamais recalculee depuis la
   camera, jamais deux fois au meme endroit par accident).

   LA PREMIERE VERSION ETAIT CINQ PRIMITIVES EMPILEES, TOUJOURS LES MEMES.
   Un pain, un steak, une salade, un carre de fromage, un second pain :
   reconnaissable, mais interchangeable d'un exemplaire a l'autre, et sans
   aucun des petits details qui font qu'un hamburger a l'air d'exister
   vraiment plutot que d'etre un diagramme de hamburger. Chaque exemplaire
   de la nuee tire maintenant sa PROPRE composition (double steak ou non,
   fromage, tomate, cornichon, œuf au plat), porte des graines de sesame
   sur le pain du dessus et quelques coulures de sauce — et fume, parce
   qu'un hamburger qui vole vient forcement de sortir du gril. */
const matPainHB = new THREE.MeshStandardMaterial({ color: 0xD9A24B, roughness: 0.85 });
const matSteakHB = new THREE.MeshStandardMaterial({ color: 0x5A3420, roughness: 0.92 });
const matFromageHB = new THREE.MeshStandardMaterial({ color: 0xF0B93C, roughness: 0.45 });
const matSaladeHB = new THREE.MeshStandardMaterial({ color: 0x4C8A3A, roughness: 0.9 });
const matSesameHB = new THREE.MeshStandardMaterial({ color: 0xF3E0B8, roughness: 0.7 });
const matTomateHB = new THREE.MeshStandardMaterial({ color: 0xB4351E, roughness: 0.55 });
const matCornichonHB = new THREE.MeshStandardMaterial({ color: 0x5F7A2E, roughness: 0.75 });
const matKetchupHB = new THREE.MeshStandardMaterial({ color: 0x8E1712, roughness: 0.35 });
const matMoutardeHB = new THREE.MeshStandardMaterial({ color: 0xD9A61A, roughness: 0.35 });
const matBlancOeufHB = new THREE.MeshStandardMaterial({ color: 0xEDE6D4, roughness: 0.4 });
const matJauneOeufHB = new THREE.MeshStandardMaterial({ color: 0xF2A82C, roughness: 0.3 });
// Les frites partagent le meme pain doré pour la panure, et un carton
// rouge et blanc classique — jamais modelise ailleurs dans ce dossier.
const matFriteHB = new THREE.MeshStandardMaterial({ color: 0xE8C468, roughness: 0.8 });
const matCartonHB = new THREE.MeshStandardMaterial({ color: 0xC81E2C, roughness: 0.85 });

function hamburgerVolant(echelle, opts = {}) {
  const {
    double = false, fromage = true, tomate = false, cornichon = false, oeuf = false,
    sauce = 'ketchup',
  } = opts;
  const g = new THREE.Group();
  const bas = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 10, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
    matPainHB);
  bas.position.y = -0.08;
  g.add(bas);

  /* LA PILE, CONSTRUITE COUCHE PAR COUCHE. Un curseur de hauteur qui monte
     a mesure qu'on empile, plutot que des positions fixes codees en dur :
     c'est ce qui permet a un exemplaire double-steak d'etre reellement
     plus HAUT qu'un exemplaire simple, au lieu d'avoir ses couches qui se
     recouvrent. */
  let y = -0.02;
  const nSteaks = double ? 2 : 1;
  for (let i = 0; i < nSteaks; i++) {
    const steak = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.10, 12), matSteakHB);
    steak.position.y = y + 0.05;
    g.add(steak);
    y += 0.10;
    if (fromage) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.025, 0.50), matFromageHB);
      fr.position.y = y + 0.012;
      fr.rotation.y = Math.PI / 4 + i * 0.3;
      g.add(fr);
      y += 0.025;
    }
  }
  if (oeuf) {
    const blanc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.035, 14), matBlancOeufHB);
    blanc.position.y = y + 0.017;
    g.add(blanc);
    const jaune = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), matJauneOeufHB);
    jaune.scale.y = 0.55;
    jaune.position.y = y + 0.037;
    g.add(jaune);
    y += 0.045;
  }
  if (tomate) {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 12), matTomateHB);
    tr.position.y = y + 0.012;
    g.add(tr);
    y += 0.025;
  }
  if (cornichon) {
    // Trois rondelles, jamais alignees : un cornichon tranche tombe en
    // eventail sur le plateau, pas en pile bien droite.
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.016, 8), matCornichonHB);
      const a = (i / 3) * Math.PI * 2;
      c.position.set(Math.cos(a) * 0.16, y + 0.008, Math.sin(a) * 0.16);
      g.add(c);
    }
    y += 0.016;
  }
  const salade = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 14), matSaladeHB);
  salade.rotation.x = Math.PI / 2;
  salade.position.y = y + 0.05;
  g.add(salade);
  y += 0.07;

  /* LES COULURES DE SAUCE, JAMAIS SYMETRIQUES — ET UNE SEULE COULEUR PAR
     EXEMPLAIRE PLUTOT QUE DEUX EN ALTERNANCE. Un zigzag de petits blobs
     aplatis plutot qu'un vrai tube courbe : a cette echelle et vue en
     plein vol, la silhouette suffit largement. UNE SEULE MATIERE VEUT
     DIRE UN SEUL `InstancedMesh` : cinq petits blobs par hamburger,
     multiplies par une dizaine d'exemplaires, seraient cinquante appels
     de dessin distincts pour un detail qu'on ne fixe jamais — exactement
     le genre d'addition invisible a l'oeil qui a deja fait reculer la
     densite des sapins ailleurs dans ce projet (voir `quality.js`). */
  const matSauceChoisie = sauce === 'moutarde' ? matMoutardeHB : matKetchupHB;
  const sauceBlobs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 6, 5), matSauceChoisie, 5);
  const mSauce = new THREE.Matrix4();
  for (let i = 0; i < 5; i++) {
    const a = -1.6 + i * 0.75;
    mSauce.compose(
      new THREE.Vector3(Math.cos(a) * 0.20, y + 0.008, Math.sin(a) * 0.20 - 0.05),
      new THREE.Quaternion(),
      new THREE.Vector3(1, 0.35, 1));
    sauceBlobs.setMatrixAt(i, mSauce);
  }
  g.add(sauceBlobs);

  const haut = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
    matPainHB);
  haut.position.y = y + 0.05;
  g.add(haut);

  /* LES GRAINES DE SESAME, MEME PRINCIPE. Une douzaine de demi-billes
     semees sur le dome, avec juste assez d'irregularite dans le rayon et
     l'angle pour ne jamais lire comme un motif repete — c'est exactement
     ce qui fait qu'un pain a l'air VRAIMENT saupoudre plutot que
     décalque — mais un seul appel de dessin pour les douze, pas douze. */
  const graines = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 5, 4), matSesameHB, 12);
  const mGraine = new THREE.Matrix4();
  for (let i = 0; i < 12; i++) {
    const phi = Math.acos(1 - Math.random() * 0.62);
    const theta = Math.random() * Math.PI * 2;
    const r = 0.305;
    mGraine.compose(
      new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        y + 0.05 + r * Math.cos(phi) * 0.72,
        r * Math.sin(phi) * Math.sin(theta)),
      new THREE.Quaternion(),
      new THREE.Vector3(1, 0.6, 1.4));
    graines.setMatrixAt(i, mGraine);
  }
  g.add(graines);

  /* LA FUMEE. Reprend la construction du sprite de buee (`core/dot.js`,
     deja partagee par kevin.js/jurassique.js pour un SOUFFLE discret) mais
     pilotee en continu plutot que par declenchements espaces — un
     hamburger qui vient de sortir du gril ne respire pas par a-coups, il
     fume sans arret tant qu'il est chaud. */
  const fumee = buee([0.92, 0.88, 0.80]);
  fumee.position.set(0, y + 0.16, 0);
  fumee.scale.setScalar(0.45);
  g.add(fumee);
  g.userData.fumee = fumee;
  g.userData.dephasageFumee = Math.random() * 10;

  g.scale.setScalar(echelle);
  return g;
}

/* --------------------------------------------------------------------------
   LES FRITES. Pas seulement des hamburgers — Antoine a dit « j'aime la
   nourriture », pas « j'aime les hamburgers » — et un second objet dans la
   nuee casse la repetition visuelle bien plus efficacement qu'une variete
   de garnitures seule. Un cornet rouge et blanc, quelques batonnets dores
   qui en depassent a des hauteurs et des angles irreguliers : la aussi,
   l'irregularite est ce qui vend l'objet.
   -------------------------------------------------------------------------- */
function friteVolante(echelle) {
  const g = new THREE.Group();
  const carton = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.34, 8, 1, true), matCartonHB);
  carton.position.y = -0.05;
  g.add(carton);
  // Les bandes blanches du cornet, deux faces plates qui se detachent du
  // rouge — un carton de frites sans son liseré blanc n'en est pas un.
  for (const a of [0, Math.PI]) {
    const bande = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.30, 0.01), matBlancOeufHB);
    bande.position.set(Math.sin(a) * 0.145, -0.05, Math.cos(a) * 0.145);
    bande.rotation.y = a;
    g.add(bande);
  }
  /* NEUF BATONNETS, UN SEUL APPEL DE DESSIN. Une geometrie de longueur
     UNITAIRE, etiree par la matrice d'instance plutot que neuf
     `BoxGeometry` distinctes — le meme raisonnement que les graines de
     sesame et les coulures de sauce du hamburger : la variete vient de la
     transformation, jamais de la geometrie elle-meme. */
  const N_FRITES = 9;
  const frites = new THREE.InstancedMesh(new THREE.BoxGeometry(0.028, 1, 0.028), matFriteHB, N_FRITES);
  const mFrite = new THREE.Matrix4();
  const qFrite = new THREE.Euler();
  const qFriteQ = new THREE.Quaternion();
  for (let i = 0; i < N_FRITES; i++) {
    const long = 0.30 + Math.random() * 0.16;
    const a = (i / N_FRITES) * Math.PI * 2 + Math.random() * 0.4;
    const r = Math.random() * 0.08;
    qFrite.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
    qFriteQ.setFromEuler(qFrite);
    mFrite.compose(
      new THREE.Vector3(Math.cos(a) * r, 0.05 + long / 2 - 0.05, Math.sin(a) * r),
      qFriteQ,
      new THREE.Vector3(1, long, 1));
    frites.setMatrixAt(i, mFrite);
  }
  g.add(frites);
  g.scale.setScalar(echelle);
  return g;
}

export function nueeHamburgers(chemin, palier) {
  const g = new THREE.Group();
  g.userData.suitCamera = true;

  const N = palier.nom === 'bas' ? 6 : 10;
  const burgers = [];
  /* UN COMBO FIXE PAR INDICE, JAMAIS TIRE AU HASARD A CHAQUE VISITE — la
     meme regle que partout ailleurs dans ce dossier : deux passages de la
     balade doivent montrer la meme nuee. On fait tourner un petit jeu de
     compositions plutot que relancer `Math.random()` sur chaque
     garniture, ce qui garantirait deja la reproductibilite meme sans y
     penser, mais melangerait aussi les silhouettes plus franchement
     qu'un tirage independant par garniture (qui tend, sur peu d'essais, a
     redonner souvent « un peu de tout »). */
  const COMBOS = [
    { double: false, fromage: true, tomate: false, cornichon: true, oeuf: false },
    { double: true, fromage: true, tomate: false, cornichon: false, oeuf: false },
    { double: false, fromage: false, tomate: true, cornichon: true, oeuf: false },
    { double: false, fromage: true, tomate: true, cornichon: false, oeuf: true },
    { double: true, fromage: false, tomate: false, cornichon: true, oeuf: false },
  ];
  for (let i = 0; i < N; i++) {
    // Une frite sur quatre en moyenne (indices 3, 7, 11...) : assez pour
    // casser la repetition, jamais assez pour que la nuee cesse de lire
    // comme « des hamburgers qui volent ».
    const estFrite = i % 4 === 3;
    const mesh = estFrite
      ? friteVolante(1.6 + ((i * 0.37) % 1) * 1.0)
      : hamburgerVolant(1.8 + ((i * 0.53) % 1) * 1.1, COMBOS[i % COMBOS.length]);
    g.add(mesh);
    burgers.push({
      mesh,
      frite: estFrite,
      ang: (i / N) * Math.PI * 2 + (i * 0.71) % 0.6,
      rayon: 1.6 + (i * 0.29) % 1.8,
      vAng: 0.35 + (i * 0.13) % 0.55,
      hauteur: -0.8 + (i * 0.41) % 2.2,
      dephasage: (i * 1.7) % 10,
      spinX: estFrite ? 0 : ((i % 2 === 0 ? 1 : -1) * (0.6 + (i * 0.23) % 1.8)),
      spinZ: (i % 2 === 0 ? -1 : 1) * (0.6 + (i * 0.31) % 1.8),
    });
  }

  const p = new THREE.Vector3(), tan = new THREE.Vector3(), cote = new THREE.Vector3();
  let calcule = false;
  const posNuee = new THREE.Vector3();

  /* LE « POP » D'APPARITION. Une bouffee d'etincelles doree au centre de
     la nuee, une seule fois par passage, au moment ou elle devient
     franchement visible — le meme principe comique qu'un dessin anime :
     la nourriture ne se contente pas d'apparaitre, elle POP. */
  const pop = gerbeImpact(22, 0xFFD37A, 0.05);
  g.add(pop);
  let popFait = false, popT = -999;

  g.userData.reinit = () => { calcule = false; popFait = false; popT = -999; };

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

    if (!popFait && vis > 0.5) { popFait = true; popT = t; }
    majImpact(pop, t - popT, {
      duree: 0.6, plateau: 0.4, portee: 3.2, monte: 2.0, gravite: 1.8, decroissance: 1.8,
    });

    for (const b of burgers) {
      const a = b.ang + t * b.vAng;
      b.mesh.position.set(
        Math.cos(a) * b.rayon,
        b.hauteur + Math.sin(t * 0.8 + b.dephasage) * 0.45,
        Math.sin(a) * b.rayon
      );
      b.mesh.rotation.x += 0.017 * b.spinX;
      b.mesh.rotation.z += 0.017 * b.spinZ;

      /* LA FUMEE, EN BOUCLE, JAMAIS DEUX HAMBURGERS EN PHASE. Le meme
         helper que le souffle de Kevin ou du theropode (`majBuee`), mais
         redeclenche a l'infini plutot qu'une fois par pas : `cyclePos` est
         l'age depuis le dernier declenchement VIRTUEL, calcule directement
         depuis `t` et le dephasage propre a l'exemplaire — aucun etat a
         faire vivre entre deux images, juste une horloge modulaire. */
      if (!b.frite) {
        const cyclePos = (t + b.dephasage) % 1.3;
        majBuee(b.mesh.userData.fumee, t, t - cyclePos, vis, 0.9, 1.15);
      }
    }
  };
  return g;
}
