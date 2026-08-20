import * as THREE from 'three';
import { lueurDiffuse, tacheDouce, grainRond } from '../../core/dot.js';
import { smoothstep, clamp } from '../../core/noise.js';
import { halo } from './communs.js';

/* ==========================================================================
   3. E.T. DEVANT LA LUNE

   Le plan le plus cite du cinema, et il ne coute qu'une silhouette noire :
   un velo, deux passagers, un panier. Tout tient dans le CONTOUR — c'est
   d'ailleurs ainsi que le plan est filme, entierement a contre-jour.

   « VRAIE 3D, PAS JUSTE DES CARRES ET DES TRIANGLES. » La silhouette
   vivait entierement dans une texture peinte au canvas, plaquee sur un
   plan unique — la seule apparition de tout ce dossier construite en
   image plutot qu'en geometrie, alors que chaque autre personnage (le
   moindre katana, la moindre branche) est un assemblage de primitives
   3D. Un plan texture reste un plan : vu legerement de travers, ou des
   qu'une ombre porterait sur son contour, il se trahit comme un carton
   decoupe. Le velo et ses deux passagers sont donc reconstruits comme un
   vrai petit assemblage 3D — cylindres pour le cadre et les membres,
   tores pour les roues (avec leurs rayons), spheres pour les tetes,
   boites pour le panier et la selle — peint dans la meme teinte de
   silhouette qu'avant. Le CONTOUR reste identique (c'est lui qui
   raconte le plan), mais il porte desormais une vraie epaisseur.

   La silhouette se place sur la direction de la lune et suit la camera, de
   sorte qu'elle passe toujours devant le disque, quel que soit l'endroit du
   chemin ou la scene se declenche.
   ========================================================================== */
const _AXE_Y_ET = new THREE.Vector3(0, 1, 0);
const _dirSeg = new THREE.Vector3();

/* Un cylindre tendu entre deux points du plan XY — le cadre, les membres,
   la fourche. Meme idiome que `tendreFil`/`tendreElastique` ailleurs dans
   ce dossier : une primitive orientee par quaternion plutot qu'un calcul
   d'angle a la main. */
function segmentSilhouette(mat, x0, y0, x1, y1, rayon, segs = 6) {
  _dirSeg.set(x1 - x0, y1 - y0, 0);
  const l = _dirSeg.length() || 0.001;
  _dirSeg.divideScalar(l);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rayon, rayon, l, segs), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
  m.quaternion.setFromUnitVectors(_AXE_Y_ET, _dirSeg);
  return m;
}

/* Une roue a rayons : un tore fin, et trois rayons qui le traversent —
   sans eux, la roue se serait lue comme un simple anneau plutot que comme
   une roue de bicyclette, meme en silhouette. */
function roueSilhouette(mat, cx, cy, rayon) {
  const g = new THREE.Group();
  const jante = new THREE.Mesh(new THREE.TorusGeometry(rayon - 0.006, 0.006, 5, 14), mat);
  jante.position.set(cx, cy, 0);
  g.add(jante);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const dx = Math.cos(a) * rayon, dy = Math.sin(a) * rayon;
    g.add(segmentSilhouette(mat, cx - dx, cy - dy, cx + dx, cy + dy, 0.0045, 4));
  }
  return g;
}

function siluetteVelo() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x05070B, transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const g = new THREE.Group();

  /* Coordonnees en unites normalisees (le meme carre -0.5..0.5 en x que
     l'ancien plan) : roues en bas, cadre au milieu, cycliste penche vers
     l'avant et panier releve a l'avant, avec la petite tete du passager
     qui en depasse — la silhouette exacte du plan original. */
  const rArr = -0.20, yRoue = -0.14, rRoue = 0.115;
  const fAv = 0.24;

  g.add(roueSilhouette(mat, rArr, yRoue, rRoue));
  g.add(roueSilhouette(mat, fAv, yRoue, rRoue));

  // Le cadre : tube superieur, tube inferieur, fourche.
  g.add(segmentSilhouette(mat, rArr, yRoue, -0.03, 0.10, 0.014));   // tube arriere -> selle
  g.add(segmentSilhouette(mat, rArr, yRoue, 0.17, 0.045, 0.012));   // tube arriere -> pedalier -> tube de direction
  g.add(segmentSilhouette(mat, 0.17, 0.045, fAv, yRoue, 0.013));    // fourche avant
  g.add(segmentSilhouette(mat, 0.17, 0.045, -0.03, 0.10, 0.011));   // tube de selle

  // Guidon et selle.
  g.add(segmentSilhouette(mat, 0.17, 0.045, 0.255, 0.125, 0.010));  // potence + guidon
  const selle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.020, 0.05), mat);
  selle.position.set(-0.015, 0.115, 0);
  g.add(selle);

  /* Le panier a l'avant, avec la petite tete du passager qui en depasse —
     le detail qui, dans le plan original, dit « E.T. » avant meme le
     velo. */
  const panier = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.065, 0.06), mat);
  panier.position.set(0.29, 0.075, 0);
  g.add(panier);
  const tetePassager = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), mat);
  tetePassager.position.set(0.30, 0.135, 0);
  g.add(tetePassager);

  /* Le cycliste : buste penche loin vers l'avant, tete, un bras tendu au
     guidon, une jambe pliee au pedalier — c'est cette inclinaison
     prononcee, plus que n'importe quel autre trait, qui donne au plan
     son elan. */
  g.add(segmentSilhouette(mat, -0.01, 0.05, 0.095, 0.185, 0.017));  // buste
  const teteCycliste = new THREE.Mesh(new THREE.SphereGeometry(0.043, 9, 7), mat);
  teteCycliste.position.set(0.125, 0.225, 0);
  g.add(teteCycliste);
  g.add(segmentSilhouette(mat, 0.075, 0.145, 0.235, 0.115, 0.013)); // bras -> guidon
  g.add(segmentSilhouette(mat, -0.02, 0.03, 0.015, -0.075, 0.014)); // cuisse
  g.add(segmentSilhouette(mat, 0.015, -0.075, -0.03, yRoue, 0.011)); // mollet -> pedale

  g.userData.mat = mat;
  g.renderOrder = 3;
  return g;
}

/* --------------------------------------------------------------------------
   LA POUSSIERE D'ETOILES.

   Le velo qui « decolle » devant la lune ne l'a jamais vraiment fait
   jusqu'ici : un bond geometrique, sans rien qui le distingue d'un simple
   deplacement. Une trainee de poussiere scintillante — la signature
   visuelle de tout ce que E.T. touche dans le film — regle ca a peu de
   frais : chaque grain suit le MEME arc que le velo, mais en retard d'une
   fraction d'avancee (`lags`), ce qui dessine naturellement une comete
   plutot qu'un nuage statique. Aucun historique de positions a tenir :
   la trajectoire etant une fonction pure de `av`, il suffit d'echantillonner
   cette fonction a un `av` plus ancien pour chaque grain.
   -------------------------------------------------------------------------- */
function etincellesVelo(n) {
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xF3ECD2, size: 0.62,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  const lags = Array.from({ length: n }, (_, i) => 0.02 + (i / n) * 0.34);
  const phases = Array.from({ length: n }, () => Math.random() * Math.PI * 2);
  const decalLat = Array.from({ length: n }, () => (Math.random() - 0.5) * 1.7);
  pts.userData = { lags, phases, decalLat, n };
  return pts;
}

function majEtincelles(pts, av, t) {
  const { lags, phases, decalLat, n } = pts.userData;
  const pos = pts.geometry.attributes.position.array;
  for (let i = 0; i < n; i++) {
    const avL = clamp(av - lags[i], 0, 1);
    const arcL = Math.sin(avL * Math.PI);
    pos[i * 3] = (avL - 0.5) * 26 + decalLat[i] * 0.4;
    pos[i * 3 + 1] = 1.4 + arcL * 4.2 + Math.sin(t * 3.2 + phases[i]) * 0.16;
    pos[i * 3 + 2] = 1 + decalLat[i] * 0.25;
  }
  pts.geometry.attributes.position.needsUpdate = true;
  pts.geometry.computeBoundingSphere();
}

/* --------------------------------------------------------------------------
   LES NUAGES QUI DERIVENT DEVANT LE DISQUE.

   Une lune parfaitement propre, immobile, additive, se lit comme un halo
   de studio plus que comme un vrai ciel nocturne. Deux voiles sombres, en
   fondu normal plutot qu'additif (ils doivent MASQUER la lueur, pas s'y
   ajouter), qui traversent lentement le disque de part et d'autre —
   assez lents pour ne jamais distraire du velo, assez presents pour que
   le ciel respire pendant les quelques secondes ou la camera s'y attarde.
   -------------------------------------------------------------------------- */
function nuageLune(largeur, hauteur, opaciteMax) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tacheDouce(), transparent: true, opacity: 0, color: 0x141B28,
    depthWrite: false, fog: false,
  }));
  m.scale.set(largeur, hauteur, 1);
  m.renderOrder = 2;
  m.userData.opaciteMax = opaciteMax;
  return m;
}

export function etDevantLaLune(chemin) {
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

  // Deux voiles qui traversent lentement le disque, en sens opposes.
  const nuageA = nuageLune(50, 15, 0.34);
  const nuageB = nuageLune(38, 11, 0.26);
  g.add(nuageA, nuageB);

  /* LE HALO DE CONTRE-JOUR. Une silhouette pure, sans rien derriere elle,
     se lit comme une decoupe posee SUR le disque plutot que comme un
     objet qui bloque une vraie lumiere. Un halo additif, plus large que
     le velo et legerement en retrait, place juste derriere lui, simule le
     bord lumineux qu'une vraie source arriere dessinerait autour d'une
     forme opaque — exactement ce qui distingue un contre-jour d'un
     pochoir. */
  const haloVelo = halo([1.3, 1.28, 1.10], 9, 0.9);
  haloVelo.renderOrder = 2;
  g.add(haloVelo);

  const velo = siluetteVelo();
  velo.scale.setScalar(13);
  g.add(velo);

  // La trainee de poussiere derriere le velo — voir `etincellesVelo`.
  const etincelles = etincellesVelo(12);
  g.add(etincelles);

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
    velo.userData.mat.opacity = vis * 0.98;
    g.visible = vis > 0.01;
    if (!camera) return;

    // Les nuages derivent lentement et independamment, sans jamais
    // s'arreter — un ciel qui bouge en permanence, meme au repos.
    nuageA.position.set(-30 + ((t * 2.1) % 60), 6 + Math.sin(t * 0.17) * 5, 1.5);
    nuageA.material.opacity = vis * nuageA.userData.opaciteMax;
    nuageB.position.set(28 - ((t * 1.4) % 56), -4 + Math.sin(t * 0.13 + 2) * 6, 1.4);
    nuageB.material.opacity = vis * nuageB.userData.opaciteMax;

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

    // Le halo colle exactement a la silhouette, juste un peu en retrait.
    haloVelo.position.set(velo.position.x, velo.position.y, velo.position.z - 0.6);
    haloVelo.material.opacity = vis * 0.5;

    // La trainee de poussiere suit le meme arc, en retard.
    majEtincelles(etincelles, av, t);
    etincelles.material.opacity = vis * (0.55 + Math.sin(t * 4.1) * 0.15);
  };
  return g;
}
