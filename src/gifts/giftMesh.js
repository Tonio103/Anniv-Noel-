/* Le paquet.

   Une boite, un couvercle, deux rubans croises, un noeud. Rien d'exotique,
   mais quelques details font la difference entre un cube colore et un cadeau :

   · le ruban est SATINE (rugosite basse, un peu de metal) et attrape donc la
     carte d'environnement — c'est ce qui le distingue du carton mat ;
   · une calotte de neige repose sur le couvercle, puisque le paquet sort
     tout juste d'une congere. Elle glisse quand on l'ouvre ;
   · l'interieur est emissif : a l'ouverture, la lumiere qui en sort eclaire
     reellement la neige alentour.
*/

import * as THREE from 'three';
import { lueurDiffuse } from '../core/dot.js';

/* La meme lueur diffuse que partout ailleurs : peinte pixel par pixel, sans
   arret de degrade, donc sans anneau de Mach et sans contour. */
function halo() {
  return lueurDiffuse();
}

/* --------------------------------------------------------------------------
   LA BOITE ETAIT UN PAVE NU.

   `BoxGeometry` toute seule donne huit aretes a quatre-vingt-dix degres
   parfaits — exactement ce qu'aucun carton emballe ne montre jamais : le
   papier plie et le ruban tendu arrondissent toujours un peu les bords.
   Vu de pres, au moment precis ou la balade s'arrete pour qu'on le regarde,
   ce pave nu se lisait comme une primitive de moteur 3D, pas comme un objet
   du monde.

   On arrondit les QUATRE ARETES VERTICALES — celles qui dominent la
   silhouette de face et de trois-quarts, les deux angles de vue ou le
   paquet est effectivement regarde. Les arrondir toutes (les douze aretes,
   avec des conges spheriques aux huit coins) demanderait un algorithme
   nettement plus lourd pour un gain qui ne se voit presque plus une fois le
   couvercle en place. On extrude donc un rectangle aux coins coupes au lieu
   d'un simple rectangle — la meme technique qu'un boitier de savon ou une
   housse rembourree, ou seuls les bords lateraux sont adoucis. */
function formeArrondie(largeur, profondeur, rayon) {
  const s = new THREE.Shape();
  const hw = largeur / 2, hd = profondeur / 2;
  const r = Math.min(rayon, hw * 0.9, hd * 0.9);
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return s;
}

/* Boite aux aretes verticales arrondies, centree sur son origine comme le
   serait une `BoxGeometry(largeur, hauteur, profondeur)` — c'est ce
   centrage que tout le reste du fichier suppose (`position.y = H/2`, etc.),
   donc le remplacement est transparent pour le montage et pour l'animation
   d'ouverture. */
function boiteArrondie(largeur, hauteur, profondeur, rayon, segments = 3) {
  const forme = formeArrondie(largeur, profondeur, rayon);
  const geo = new THREE.ExtrudeGeometry(forme, {
    depth: hauteur, bevelEnabled: false, curveSegments: segments, steps: 1,
  });
  // L'extrusion part en +Z depuis le plan XY de la forme ; on la redresse en
  // +Y et on la recentre pour retrouver la convention d'une boite centree.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -hauteur / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

/* --------------------------------------------------------------------------
   LE PAPIER ETAIT UNE COULEUR PLATE — ET LE PREMIER MOTIF NE SURVIVAIT PAS
   A LA NUIT.

   Un carton cadeau porte presque toujours un motif imprime — c'est ce qui
   dit "papier" plutot que "plastique teinte". Le premier essai peignait un
   semis de petits losanges a 16-22 % d'opacite : correct extrait a plat,
   INVISIBLE une fois pose sur la boite — la scene se passe de nuit, sous un
   eclairage deja faible, et la courbe ACES ecrase encore ce qui reste dans
   les tons sombres. Mesure faite en extrayant la texture brute : le motif
   existait bel et bien, il ne restait tout simplement rien de lui a l'ecran.

   Deux corrections, pas une seule : DES BANDES, pas des petits pois — un
   motif a grande echelle survit a l'ecrasement tonal la ou un detail fin
   disparait purement et simplement — et un ECART DE TEINTE beaucoup plus
   large, pousse au-dela de ce qui semblerait raisonnable sur une capture en
   plein jour, exactement par le meme raisonnement que la lueur du paquet et
   le pelage du cerf ailleurs dans ce projet : ce qui doit survivre a la
   compression doit partir plus loin qu'il n'en a l'air necessaire. */
function papierCadeau(teinte) {
  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');

  const base = new THREE.Color(teinte);
  const clair = base.clone().offsetHSL(0.01, -0.05, 0.16);
  const sombre = base.clone().offsetHSL(-0.01, 0.05, -0.14);
  c.fillStyle = `#${base.getHexString()}`;
  c.fillRect(0, 0, n, n);

  // Larges bandes diagonales, un motif classique de papier cadeau — assez
  // grand pour rester lisible meme reduit a quelques pixels a l'ecran.
  c.save();
  c.translate(n / 2, n / 2);
  c.rotate(Math.PI / 4);
  c.translate(-n, -n);
  const large = 2 * n, pas = 46;
  for (let x = -pas; x < large + pas; x += pas * 2) {
    c.fillStyle = `#${clair.getHexString()}`;
    c.globalAlpha = 0.34;
    c.fillRect(x, -n * 0.5, pas * 0.62, large * 2);
  }
  c.restore();

  // Un semis de petits losanges par-dessus, plus sombres : la variation
  // fine qui empeche chaque bande de se lire comme un aplat uniforme.
  const grain = 30;
  for (let y = -grain; y < n + grain; y += grain) {
    for (let x = -grain; x < n + grain; x += grain) {
      const decale = (Math.round(y / grain) % 2) * (grain / 2);
      const cx = x + decale, cy = y, r = grain * 0.26;
      c.beginPath();
      c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy);
      c.closePath();
      c.fillStyle = `#${sombre.getHexString()}`;
      c.globalAlpha = 0.30;
      c.fill();
    }
  }
  c.globalAlpha = 1;

  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1.6, 1.6);
  t.anisotropy = 4;
  return t;
}

export function creerCadeau({ size = 1, box = 0x8E2B3A, ribbon = 0xF2C14E, glow = 0xFFC98A }, palier) {
  const g = new THREE.Group();
  g.name = 'cadeau';

  const L = size, H = size * 0.78, P = size * 0.86;
  // Rayon du chanfrein vertical : assez pour se voir, jamais assez pour
  // que la boite ait l'air d'un savon — cinq pour cent de sa largeur.
  const rArrondi = size * 0.05;

  const matBoite = new THREE.MeshStandardMaterial({
    map: papierCadeau(box), color: 0xFFFFFF, roughness: 0.70, metalness: 0.02,
    emissive: box, emissiveIntensity: 0.22,
  });
  const matRuban = new THREE.MeshStandardMaterial({
    color: ribbon, roughness: 0.22, metalness: 0.40,
    emissive: ribbon, emissiveIntensity: 0.30,
  });
  const matNeige = new THREE.MeshStandardMaterial({
    color: 0xF0F6FC, roughness: 0.78, metalness: 0,
  });
  const matLueur = new THREE.SpriteMaterial({
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    map: halo(),
  });

  /* --- la caisse --------------------------------------------------------- */
  const caisse = new THREE.Mesh(boiteArrondie(L, H, P, rArrondi), matBoite);
  caisse.position.y = H / 2;
  caisse.castShadow = palier.ombres;
  caisse.receiveShadow = palier.ombres;
  g.add(caisse);

  // Rubans verticaux sur la caisse
  const ep = size * 0.085;
  for (const [sx, sz, w, d] of [[0, 0, ep, P * 1.005], [0, 0, L * 1.005, ep]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w || ep, H * 1.004, d || ep), matRuban);
    r.position.set(sx, H / 2, sz);
    // Le ruban est SATINE (voir le materiau) : sans ombre propre, ce reflet
    // net flotte au-dessus du papier au lieu de s'y attacher.
    r.castShadow = palier.ombres;
    r.receiveShadow = palier.ombres;
    g.add(r);
  }

  /* --- le couvercle, mobile ---------------------------------------------- */
  const couvercle = new THREE.Group();
  couvercle.position.y = H;
  g.add(couvercle);

  const hc = size * 0.16;
  const dessus = new THREE.Mesh(boiteArrondie(L * 1.07, hc, P * 1.07, rArrondi * 1.1), matBoite);
  dessus.position.y = hc / 2;
  dessus.castShadow = palier.ombres;
  dessus.receiveShadow = palier.ombres;
  couvercle.add(dessus);

  for (const vert of [true, false]) {
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(vert ? ep : L * 1.075, hc * 1.02, vert ? P * 1.075 : ep),
      matRuban
    );
    r.position.y = hc / 2;
    r.castShadow = palier.ombres;
    r.receiveShadow = palier.ombres;
    couvercle.add(r);
  }

  /* --- le noeud ---------------------------------------------------------- */
  const noeud = new THREE.Group();
  noeud.position.y = hc;
  couvercle.add(noeud);
  for (const cote of [-1, 1]) {
    const boucle = new THREE.Mesh(
      new THREE.TorusGeometry(size * 0.15, size * 0.042, 6, 14, Math.PI * 1.5),
      matRuban
    );
    boucle.position.set(cote * size * 0.13, size * 0.10, 0);
    boucle.rotation.set(Math.PI / 2, 0, cote * 0.5);
    boucle.scale.set(1, 0.72, 1);
    // C'est la piece la plus proche de l'oeil pendant l'attente : sans
    // ombre propre entre ses deux boucles, le noeud se lit a plat.
    boucle.castShadow = palier.ombres;
    boucle.receiveShadow = palier.ombres;
    noeud.add(boucle);
  }
  const centre = new THREE.Mesh(new THREE.SphereGeometry(size * 0.055, 8, 6), matRuban);
  centre.position.y = size * 0.09;
  centre.castShadow = palier.ombres;
  centre.receiveShadow = palier.ombres;
  noeud.add(centre);

  /* --- la neige posee dessus, qui glissera a l'ouverture ------------------
     La neige tassee arrondit toujours plus que le carton en dessous —
     jamais d'arete vive dans la nature. Un rayon nettement plus genereux
     que celui de la boite. */
  const calotte = new THREE.Mesh(boiteArrondie(L * 1.03, size * 0.075, P * 1.03, rArrondi * 2.2), matNeige);
  calotte.position.y = hc + size * 0.03;
  calotte.castShadow = palier.ombres;
  calotte.receiveShadow = palier.ombres;
  couvercle.add(calotte);

  // Poussee au-dela du blanc pour franchir le seuil du halo.
  /* LE HALO EST ADDITIF : SA SATURATION COMPTE DOUBLE.

     La lumiere du paquet a bien ete desaturee (voir main.js), mais ce halo-la
     posait encore la couleur BRUTE du cadeau, multipliee par 3,2 et ajoutee
     par-dessus la neige. C'est lui, et non l'eclairage, qui laissait une
     flaque franchement magenta autour du paquet « deco » : un melange additif
     ne peut que saturer davantage, alors qu'un eclairage se fait au moins
     moderer par l'albedo de ce qu'il touche.

     Meme regle que pour la lumiere, donc, et pour la meme raison : ce qui
     brille dans un paquet est chaud, quelle que soit la couleur du papier. Il
     reste un quart de la teinte d'origine — assez pour que deux haltes ne se
     ressemblent pas, plus assez pour teindre le sol. */
  matLueur.color.set(glow).lerp(new THREE.Color(0xFFE8C8), 0.75).multiplyScalar(3.2);

  /* --- la lumiere enfermee ------------------------------------------------
     Un panneau toujours face a la camera, avec un degre radial : c'est la
     seule facon d'obtenir un halo sans bord visible. Une sphere translucide,
     elle, se decoupe nettement sur le fond. */
  const lueur = new THREE.Sprite(matLueur);
  lueur.scale.setScalar(size * 3.4);
  lueur.position.y = H * 0.6;
  lueur.renderOrder = 6;
  g.add(lueur);

  return {
    groupe: g, caisse, couvercle, noeud, calotte, lueur,
    matBoite, matRuban, matLueur,
    hauteur: H, taille: size,
    /* Hauteur du centre visuel — la camera et la carte s'y accrochent. */
    centreY: H * 0.62,
  };
}
