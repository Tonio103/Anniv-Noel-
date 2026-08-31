/* LES HELPERS PARTAGES ENTRE APPARITIONS.

   Rien de ce qui suit n'appartient a une seule scene : chaque fonction est
   utilisee par au moins deux fichiers de ce dossier. C'est ce partage, et
   lui seul, qui justifie qu'elle vive ici plutot que dans le fichier de la
   scene qui l'a fait naitre en premier.
*/

import * as THREE from 'three';
import { lueurDiffuse, tacheDouce, grainRond } from '../../core/dot.js';

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

/* --------------------------------------------------------------------------
   L'ONDE DE CHOC AU SOL.

   Nee avec Mugiwara (un poing qui ebranle la neige a chaque coup), puis
   reprise telle quelle par le duel de sabres (la lame qui frappe
   l'adversaire) des qu'un second fichier en a eu besoin — c'est la regle
   de ce module : partager des le DEUXIEME usage reel, jamais par
   anticipation du premier.
   Un anneau additif qui nait au point de contact, s'elargit d'un bond puis
   s'efface : la gerbe de particules dit la MATIERE projetee, l'onde dit la
   FORCE elle-meme, et les deux ensemble lisent un impact bien plus lourd
   que l'un ou l'autre seul. */
export function ondeChoc(couleur = 0xEAF2FF, rayon = 0.4, epaisseur = 0.16) {
  const geo = new THREE.RingGeometry(rayon, rayon + epaisseur, 24, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: couleur, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.03;
  m.renderOrder = 1;
  return m;
}

/* `dtE` : le temps ecoule depuis le declenchement. L'onde bondit vite puis
   ralentit (`sqrt`) — a vitesse d'expansion constante, un anneau qui
   grossit se lit comme un cercle qui grossit, pas comme un choc. */
export function majOndeChoc(onde, dtE, duree = 0.5) {
  /* `.visible` EN PLUS DE L'OPACITE, ET PAS SEULEMENT PAR PROPRETE.
     `Box3.setFromObject` (voir `build/apparitions.mjs`) ignore l'opacite
     mais respecte `.visible` : un impact eteint qui reste `visible=true`
     continue de peser dans la boite englobante de la scene entiere, ce
     qui n'a aucune consequence quand il vit pres du sujet (Mugiwara, le
     duel de sabres) mais en aurait une bien reelle si un futur appelant
     le posait LOIN de son sujet — un cas deja rencontre une fois (un fil
     lance vers une accroche a cinquante metres du personnage) : la
     mesure de cadrage se retrouvait gonflee par un point que personne ne
     voit jamais. Couper `.visible` quand l'opacite tombe a zero rend cette
     categorie de defaut structurellement impossible, pour cet appelant
     comme pour tout futur appelant qui placerait son impact loin du
     sujet. */
  if (dtE < 0 || dtE > duree) { onde.material.opacity = 0; onde.visible = false; return; }
  onde.visible = true;
  const k = dtE / duree;
  const echelle = 1 + Math.sqrt(k) * 7;
  onde.scale.set(echelle, 1, echelle);
  onde.material.opacity = (1 - k) * 0.5;
}

/* --------------------------------------------------------------------------
   LA GERBE D'IMPACT.

   Nee avec Mugiwara (le poing qui gicle de la glace/poudreuse a l'impact),
   puis reprise ici des que le duel de sabres en a eu besoin a son tour —
   la meme regle que l'onde de choc ci-dessus. Un eclatement UNIQUE de
   points, positions tirees une fois, rejouees en fonction du temps ecoule
   depuis le declenchement — un cercle de particules qui part du point
   d'impact dans toutes les directions, plutot qu'en parabole vers le bas
   comme une gerbe de roue.

   Les couleurs et l'echelle par defaut sont celles de Mugiwara ; le duel
   de sabres passe ses propres valeurs (des etincelles bien plus petites
   et bien plus rapides qu'un poing qui frappe la glace). */
export function gerbeImpact(n, couleur = 0xEEF4FC, taille = 0.06) {
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: couleur, size: taille,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  // Presque toutes dans le plan de l'impact, avec juste assez de derive en
  // profondeur pour que l'eclatement ait une epaisseur plutot qu'un disque.
  const dirs = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    return [Math.cos(a), Math.sin(a) * 0.7 + 0.3, (Math.random() - 0.5) * 0.6];
  });
  pts.userData = { dirs, n };
  return pts;
}

export function majImpact(pts, dtE, opts = {}) {
  const {
    duree = 0.55, plateau = 0.45, portee = 5.5, monte = 5.0,
    gravite = 3.0, decroissance = 2.0,
  } = opts;
  // Meme raison que `majOndeChoc` : `.visible` a zero pendant l'attente
  // exempte l'impact de toute mesure de boite englobante quand il n'a
  // rien a montrer, pas seulement rien a montrer a l'oeil.
  if (dtE < 0 || dtE > duree) { pts.material.opacity = 0; pts.visible = false; return; }
  pts.visible = true;
  const { dirs, n } = pts.userData;
  const pos = pts.geometry.attributes.position.array;
  for (let i = 0; i < n; i++) {
    const [dx, dy, dz] = dirs[i];
    const vol = Math.min(dtE, plateau);
    pos[i * 3] = dx * vol * portee;
    pos[i * 3 + 1] = dy * vol * monte - dtE * dtE * gravite;
    pos[i * 3 + 2] = dz * vol * portee;
  }
  pts.geometry.attributes.position.needsUpdate = true;
  pts.material.opacity = Math.max(0, 1 - dtE * decroissance);
}

/* --------------------------------------------------------------------------
   LA BUEE.

   Nee avec Kevin (« il tremble de froid » restait une affirmation non
   prouvee tant qu'aucun souffle visible ne sortait de sa bouche par une
   nuit visiblement glaciale), puis reprise des que Patronus et la DeLorean
   en ont eu besoin a leur tour — la meme regle que partout ailleurs dans
   ce module. Un petit nuage additif qui nait, grandit puis s'estompe ;
   `echelle` et `duree` laissent chaque appelant regler l'ampleur du
   souffle a la taille de qui le pousse. */
export function buee(teinte = [0.85, 0.88, 0.94]) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.NormalBlending, depthWrite: false, fog: true,
  }));
  m.material.color.setRGB(teinte[0], teinte[1], teinte[2]);
  m.scale.setScalar(0.001);
  return m;
}

export function majBuee(nuage, t, dernierSouffleT, vis, echelle = 0.34, duree = 1.1) {
  const dtE = t - dernierSouffleT;
  // Meme raison que `majOndeChoc`/`majImpact` : `.visible` a zero exempte
  // le souffle de toute mesure de boite englobante entre deux declenchements.
  if (dtE < 0 || dtE > duree) { nuage.material.opacity = 0; nuage.visible = false; return; }
  nuage.visible = true;
  const k = dtE / duree;
  nuage.scale.setScalar(0.10 + k * echelle);
  nuage.material.opacity = vis * Math.sin(k * Math.PI) * 0.32;
}
