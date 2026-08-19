/* LES HELPERS PARTAGES ENTRE APPARITIONS.

   Rien de ce qui suit n'appartient a une seule scene : chaque fonction est
   utilisee par au moins deux fichiers de ce dossier. C'est ce partage, et
   lui seul, qui justifie qu'elle vive ici plutot que dans le fichier de la
   scene qui l'a fait naitre en premier.
*/

import * as THREE from 'three';
import { lueurDiffuse, tacheDouce } from '../../core/dot.js';

/* Un halo, l'element de base de presque toutes ces scenes : c'est lui qui
   porte a distance, bien plus que la geometrie. */
export function halo(couleur, taille, force = 1) {
  const m = new THREE.SpriteMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  m.color.setRGB(couleur[0] * force, couleur[1] * force, couleur[2] * force);
  const s = new THREE.Sprite(m);
  s.scale.setScalar(taille);
  return s;
}

export const boite = (l, h, p, coul, opts = {}) => new THREE.Mesh(
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
export function flaque(couleur, taille, trou = 0) {
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
export function epouserLeSol(mesh, relief, marge) {
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
export function faisceau(couleur, longueur, ouverture) {
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
   SPIDER-MAN — LE FIL ET L'ACCROCHE

   Partages entre les deux passages du personnage (`spider1.js`, `spider2.js`).

   ANTOINE : « on dirait un personnage Roblox ». C'etait vrai, et le defaut
   etait structurel : le personnage etait fait de capsules posees cote a cote,
   et la ou deux tubes se rencontrent, on voit deux tubes qui se rencontrent.
   Il vient desormais de `humanoide.js` — une seule peau continue extraite
   d'un champ implicite, avec de vrais deltoides, un vrai resserrement a la
   taille, de vrais mollets — et de `spider.js`, qui lui pose son costume, sa
   toile dessinee dans le nuanceur et ses yeux.
   ========================================================================== */

/* Le fil : un cylindre tres fin, legerement lumineux, qui monte hors champ.
   Sans lui le personnage flotte ; avec lui, il PEND, et c'est toute la
   difference entre une figurine et une scene. */
export function filDeToile(longueur) {
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
export function tendreFil(m, a, b) {
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
export function troncAccroche() {
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
   le balancement — voir `spider1.js`. */
export function touffeExtremite() {
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

/* LA MARE DE SANG. Partagee entre Kill Bill et Shining : la meme tache
   irreguliere sert a l'adversaire masque (`killbill.js`) et a l'ascenseur
   de l'Overlook (`shining.js`). Trois eclaboussures superposees, de tailles
   differentes, plutot qu'un cercle unique — c'est ce qui rompt le contour
   parfaitement circulaire qu'une seule tache trahit toujours. */
export function tacheDeSang() {
  const g = new THREE.Group();
  const taches = [];
  const disposition = [
    { x: 0, z: 0.3, r: 1.35, rot: 0.4 },
    { x: 0.55, z: 0.85, r: 0.75, rot: 1.7 },
    { x: -0.5, z: 0.55, r: 0.65, rot: 2.6 },
  ];
  for (const d of disposition) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x60090D, transparent: true, opacity: 0, depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(d.r, 11), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = d.rot;
    m.position.set(d.x, 0, d.z);
    m.renderOrder = 1;
    g.add(m);
    taches.push(mat);
  }
  g.userData.taches = taches;
  return g;
}
