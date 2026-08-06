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

/* Degrade radial doux, dessine une fois. */
function halo() {
  const n = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function creerCadeau({ size = 1, box = 0x8E2B3A, ribbon = 0xF2C14E, glow = 0xFFC98A }, palier) {
  const g = new THREE.Group();
  g.name = 'cadeau';

  const L = size, H = size * 0.78, P = size * 0.86;

  const matBoite = new THREE.MeshStandardMaterial({
    color: box, roughness: 0.68, metalness: 0.04,
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
    color: glow, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    map: halo(),
  });

  /* --- la caisse --------------------------------------------------------- */
  const caisse = new THREE.Mesh(new THREE.BoxGeometry(L, H, P), matBoite);
  caisse.position.y = H / 2;
  caisse.castShadow = palier.ombres;
  caisse.receiveShadow = palier.ombres;
  g.add(caisse);

  // Rubans verticaux sur la caisse
  const ep = size * 0.085;
  for (const [sx, sz, w, d] of [[0, 0, ep, P * 1.005], [0, 0, L * 1.005, ep]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w || ep, H * 1.004, d || ep), matRuban);
    r.position.set(sx, H / 2, sz);
    g.add(r);
  }

  /* --- le couvercle, mobile ---------------------------------------------- */
  const couvercle = new THREE.Group();
  couvercle.position.y = H;
  g.add(couvercle);

  const hc = size * 0.16;
  const dessus = new THREE.Mesh(new THREE.BoxGeometry(L * 1.07, hc, P * 1.07), matBoite);
  dessus.position.y = hc / 2;
  dessus.castShadow = palier.ombres;
  couvercle.add(dessus);

  for (const vert of [true, false]) {
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(vert ? ep : L * 1.075, hc * 1.02, vert ? P * 1.075 : ep),
      matRuban
    );
    r.position.y = hc / 2;
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
    noeud.add(boucle);
  }
  const centre = new THREE.Mesh(new THREE.SphereGeometry(size * 0.055, 8, 6), matRuban);
  centre.position.y = size * 0.09;
  noeud.add(centre);

  /* --- la neige posee dessus, qui glissera a l'ouverture ------------------ */
  const calotte = new THREE.Mesh(new THREE.BoxGeometry(L * 1.03, size * 0.075, P * 1.03), matNeige);
  calotte.position.y = hc + size * 0.03;
  couvercle.add(calotte);

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
