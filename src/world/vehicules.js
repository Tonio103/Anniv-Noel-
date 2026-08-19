/* LES VEHICULES.

   Les blocs de construction communs a toutes les scenes qui roulent : la
   carrosserie generique (`carrosserie`), le gyrophare, le projecteur de
   recherche, la gerbe de neige, et la DeLorean elle-meme.

   La course-poursuite de police qui consomme la plupart de ces briques vit
   desormais dans `apparitions/police.js` — c'est elle qui raconte
   l'histoire, ce fichier-ci ne fournit que la matiere premiere. La
   DeLorean, elle, garde sa construction ici : `apparitions/delorean.js` ne
   fait qu'appeler `delorean()`, elle ne partage aucune autre brique avec
   la course-poursuite.
*/

import * as THREE from 'three';
import { lueurDiffuse, grainRond } from '../core/dot.js';
import { smoothstep, clamp } from '../core/noise.js';

export const boite = (l, h, p, coul, opts = {}) => new THREE.Mesh(
  new THREE.BoxGeometry(l, h, p),
  new THREE.MeshStandardMaterial({ color: coul, roughness: 0.55, ...opts })
);

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

/* Le faisceau : un cone additif, sombre a sa base et clair a sa pointe.
   En addition, le noir n'ajoute rien : un degrade vers le noir EST un
   degrade vers la transparence, sans texture ni tri de transparence. */
export function faisceau(couleur, longueur, ouverture, exposant = 2.9) {
  const geo = new THREE.ConeGeometry(ouverture, longueur, 14, 6, true);
  geo.translate(0, -longueur / 2, 0);
  geo.rotateX(Math.PI / 2);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.max(0, 1 + pos.getZ(i) / longueur);
    const f = Math.pow(k, exposant);
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

/* LE DECALQUE « POLICE ». Peint une seule fois puis reutilise pour toutes
   les voitures qui le portent — inutile de repeindre un canevas identique
   a chaque instanciation. Fond transparent : c'est ce qui permet de le
   poser par-dessus le bandeau blanc sans y dessiner de rectangle. */
let _texPolice = null;
function texturePolice() {
  if (_texPolice) return _texPolice;
  const l = 512, h = 96;
  const cv = document.createElement('canvas');
  cv.width = l; cv.height = h;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, l, h);
  c.fillStyle = '#0A1440';
  c.font = '700 62px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('POLICE', l / 2, h / 2 + 2);
  // Un filet fin au-dessus et au-dessous du mot, comme sur les vrais vehicules.
  c.fillRect(l * 0.08, h * 0.18, l * 0.84, h * 0.05);
  c.fillRect(l * 0.08, h * 0.77, l * 0.84, h * 0.05);
  _texPolice = new THREE.CanvasTexture(cv);
  _texPolice.colorSpace = THREE.SRGBColorSpace;
  return _texPolice;
}

/* --------------------------------------------------------------------------
   UNE CARROSSERIE.

   Une berline, en volumes empiles — et pour une fois c'est le bon outil : de
   nuit, a vingt metres, ce qu'on lit d'une voiture c'est sa LIGNE DE TOIT et
   ses lumieres, rien d'autre. Ce qui compte ici, c'est que le capot soit bas,
   le pare-brise incline et l'habitacle recule : trois rapports qui font
   « voiture » et non « brique ».

   Les roues tournent. C'est un detail minuscule et c'est le premier qu'on
   remarque quand il manque : une voiture qui glisse sur des roues figees se
   lit comme un jouet tire par une ficelle.
   -------------------------------------------------------------------------- */
export function carrosserie(opts) {
  const g = new THREE.Group();
  const teinte = opts.teinte;
  const roues = [];

  // Le bas de caisse, long et bas.
  const bas = boite(1.86, 0.46, 4.35, teinte, { metalness: 0.35, roughness: 0.42 });
  bas.position.y = 0.62;
  g.add(bas);

  // Le capot, plus etroit et plus bas que le bas de caisse.
  const capot = boite(1.74, 0.20, 1.35, teinte, { metalness: 0.35, roughness: 0.42 });
  capot.position.set(0, 0.86, -1.42);
  g.add(capot);

  // Le coffre.
  const coffre = boite(1.78, 0.24, 1.05, teinte, { metalness: 0.35, roughness: 0.42 });
  coffre.position.set(0, 0.88, 1.60);
  g.add(coffre);

  /* L'HABITACLE, incline. C'est l'inclinaison du pare-brise qui fait la
     silhouette : une boite droite posee sur une autre boite donne un
     autobus. On l'obtient en biseautant la boite du toit. */
  const cabine = boite(1.60, 0.58, 1.95, 0x0C1018, { roughness: 0.22, metalness: 0.5 });
  cabine.position.set(0, 1.20, 0.05);
  g.add(cabine);
  const parebrise = boite(1.56, 0.52, 0.62, 0x121826, { roughness: 0.14, metalness: 0.6 });
  parebrise.position.set(0, 1.12, -0.98);
  parebrise.rotation.x = -0.52;
  g.add(parebrise);
  const lunette = boite(1.54, 0.48, 0.56, 0x121826, { roughness: 0.14, metalness: 0.6 });
  lunette.position.set(0, 1.14, 1.05);
  lunette.rotation.x = 0.46;
  g.add(lunette);

  // Le bandeau blanc des voitures de police : le bicolore se lit en silhouette.
  if (opts.bicolore) {
    const flanc = boite(1.90, 0.30, 2.05, 0xD8DEE6, { roughness: 0.5 });
    flanc.position.set(0, 0.62, 0.15);
    g.add(flanc);
  }

  // Les quatre roues, avec un pneu et une jante claire.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const roue = new THREE.Group();
    const pneu = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: 0x0A0C10, roughness: 0.95 })
    );
    pneu.rotation.z = Math.PI / 2;
    roue.add(pneu);
    const jante = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x8A939E, roughness: 0.35, metalness: 0.7 })
    );
    jante.rotation.z = Math.PI / 2;
    roue.add(jante);
    // Un rayon plus clair : sans lui, la rotation d'une roue ronde est invisible.
    const rayon = boite(0.30, 0.05, 0.05, 0xC8CFD8, { metalness: 0.6, roughness: 0.3 });
    rayon.position.x = sx * 0.02;
    roue.add(rayon);
    roue.position.set(sx * 0.92, 0.36, sz * 1.46);
    g.add(roue);
    roues.push(roue);
  }

  // Feux avant et arriere.
  const phares = [];
  for (const sx of [-1, 1]) {
    const p = halo([2.4, 2.2, 1.7], 1.7, 0.6);
    p.position.set(sx * 0.62, 0.82, -2.20);
    g.add(p);
    phares.push(p);
  }
  const feux = [];
  for (const sx of [-1, 1]) {
    const f = halo([3.0, 0.30, 0.18], 1.1, 0.7);
    f.position.set(sx * 0.70, 0.92, 2.16);
    g.add(f);
    feux.push(f);
  }

  /* Les deux cones de phares, qui donnent la profondeur : c'est eux qui
     disent qu'il y a de l'air charge de neige devant la voiture. */
  const cones = [];
  for (const sx of [-1, 1]) {
    const c = faisceau([1.9, 1.75, 1.35], 26, 2.6, 2.4);
    c.position.set(sx * 0.62, 0.82, -2.2);
    c.rotation.x = -0.035;
    g.add(c);
    cones.push(c);
  }

  /* LES RETROVISEURS. Un detail minuscule, et pourtant le premier qu'on
     remarque quand il manque : une berline sans retroviseurs se lit comme
     un jouet, meme a vingt metres et de nuit — l'oeil cherche ces deux
     petites saillies sans savoir pourquoi il les cherche. */
  if (opts.miroirs !== false) {
    for (const sx of [-1, 1]) {
      const bras = boite(0.05, 0.05, 0.16, 0x14181F, { roughness: 0.6 });
      bras.position.set(sx * 0.86, 1.04, -0.62);
      g.add(bras);
      const coquille = boite(0.15, 0.11, 0.07, teinte, { metalness: 0.35, roughness: 0.42 });
      coquille.position.set(sx * 0.96, 1.04, -0.62);
      g.add(coquille);
    }
  }

  /* L'ANTENNE. Une tige fine, penchee vers l'arriere : plantee droite elle
     se lit comme un defaut d'assemblage, penchee elle se lit comme un
     objet qui fend l'air a vitesse. */
  if (opts.antenne !== false) {
    const antenne = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.015, 0.62, 5),
      new THREE.MeshStandardMaterial({ color: 0x0A0C10, roughness: 0.6 })
    );
    antenne.position.set(-0.55, 1.72, 1.35);
    antenne.rotation.x = 0.30;
    g.add(antenne);
  }

  /* LE CONDUCTEUR. Une silhouette tres sommaire — buste et tete, sans
     visage, matiere plate et tres sombre — assise derriere le volant. On
     ne la voit presque jamais nettement : le pare-brise incline la
     reflete plus qu'il ne la montre. C'est justement ce qui la rend
     credible — une voiture qui roule vite de nuit ne montre jamais son
     conducteur en detail, seulement sa forme. Sans elle, ces voitures
     roulaient toutes seules. */
  if (opts.conducteur !== false) {
    const matConducteur = new THREE.MeshBasicMaterial({ color: 0x05060A });
    const buste = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.30, 3, 6), matConducteur);
    buste.position.set(-0.34, 0.98, -0.42);
    g.add(buste);
    const tete = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), matConducteur);
    tete.position.set(-0.34, 1.28, -0.42);
    g.add(tete);
  }

  /* LE PARE-CHOCS POUSSOIR (push bar). Reserve a la voiture DE TETE : c'est
     l'accessoire qui dit « vehicule d'intervention », la ou le bicolore
     seul pourrait etre n'importe quel vehicule d'urgence. Un cadre de
     tubes soude devant le pare-chocs, deux pieds obliques qui le rattachent
     au chassis. */
  if (opts.pareChocsAvant) {
    const matTube = new THREE.MeshStandardMaterial({ color: 0x1C2026, roughness: 0.4, metalness: 0.75 });
    const barreHaute = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.55, 8), matTube);
    barreHaute.rotation.z = Math.PI / 2;
    barreHaute.position.set(0, 0.66, -2.32);
    g.add(barreHaute);
    const barreBasse = barreHaute.clone();
    barreBasse.position.y = 0.42;
    g.add(barreBasse);
    for (const sx of [-1, 1]) {
      const montant = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.26, 8), matTube);
      montant.position.set(sx * 0.70, 0.54, -2.32);
      g.add(montant);
      const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.36, 8), matTube);
      pied.position.set(sx * 0.70, 0.60, -2.10);
      pied.rotation.x = -0.55;
      g.add(pied);
    }
  }

  /* LE DECALQUE « POLICE ». Peint sur le bandeau blanc, cote gauche et cote
     droit — sans lui le bicolore pourrait etre n'importe quel vehicule
     d'intervention, une ambulance comprise. Legerement detache de la
     carrosserie (0,956 contre 0,95 de large pour le bandeau) pour ne
     jamais se battre en profondeur avec la boite qu'il recouvre. */
  if (opts.decal && opts.bicolore) {
    const tex = texturePolice();
    for (const sx of [-1, 1]) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.24), mat);
      plaque.position.set(sx * 0.956, 0.62, 0.15);
      plaque.rotation.y = sx * Math.PI / 2;
      g.add(plaque);
    }
  }

  g.userData = { roues, phares, feux, cones };
  return g;
}

/* LE PROJECTEUR DE RECHERCHE. Monte sur le pilier avant, independant du
   gyrophare : celui-ci tourne en continu pour SIGNALER, celui-la BALAIE
   pour CHERCHER — deux gestes differents, et seule la voiture de tete le
   porte : c'est elle qui traque, le renfort se contente de suivre. */
export function projecteurRecherche(g) {
  const pivot = new THREE.Group();
  pivot.position.set(0.68, 1.32, -0.80);
  g.add(pivot);

  const corps = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.13, 10),
    new THREE.MeshStandardMaterial({ color: 0x2A2E36, roughness: 0.4, metalness: 0.7 })
  );
  corps.rotation.x = Math.PI / 2;
  pivot.add(corps);

  const eclat = halo([2.6, 2.5, 2.1], 1.0, 0.75);
  pivot.add(eclat);

  const rayon = faisceau([2.4, 2.3, 1.95], 22, 1.9, 3.0);
  pivot.add(rayon);

  return { pivot, rayon, eclat };
}

/* La rampe de gyrophare, et les deux rayons tournants. */
export function gyrophare(g) {
  const rampe = boite(1.34, 0.16, 0.36, 0x14181F);
  rampe.position.set(0, 1.56, -0.15);
  g.add(rampe);

  const bleu = halo([0.30, 0.80, 3.4], 3.4);
  bleu.position.set(-0.44, 1.64, -0.15);
  const rouge = halo([3.4, 0.36, 0.26], 3.4);
  rouge.position.set(0.44, 1.64, -0.15);
  g.add(bleu, rouge);

  const rayonBleu = faisceau([0.22, 0.55, 2.2], 19, 2.6);
  const rayonRouge = faisceau([2.2, 0.24, 0.20], 19, 2.6);
  for (const r of [rayonBleu, rayonRouge]) {
    r.position.set(0, 1.64, -0.15);
    // Tourner d'abord, pencher ensuite : le comportement d'une tourelle.
    r.rotation.order = 'YXZ';
    g.add(r);
  }
  return { bleu, rouge, rayonBleu, rayonRouge };
}

/* --------------------------------------------------------------------------
   LA GERBE DE NEIGE.

   Ce qui manque le plus a une voiture rapide sur la neige, ce n'est pas la
   vitesse : c'est CE QU'ELLE SOULEVE. Un nuage de points qui part des roues
   arriere, s'etale et retombe suffit — et il n'existe que pendant le
   passage, donc il ne coute rien le reste du temps.
   -------------------------------------------------------------------------- */
export function gerbe(n) {
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xE8F0FF, size: 0.16,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const vies = new Float32Array(n).map(() => Math.random());
  const cote = new Float32Array(n).map((_, i) => (i % 2 ? 0.92 : -0.92));
  const derive = new Float32Array(n).map(() => (Math.random() - 0.5) * 1.5);
  pts.userData = { pos, geo, mat, vies, cote, derive, n };
  return pts;
}

export function majGerbe(pts, dt, force) {
  const { pos, geo, mat, vies, cote, derive, n } = pts.userData;
  mat.opacity = force * 0.75;
  if (force < 0.01) return;
  for (let i = 0; i < n; i++) {
    vies[i] += dt * 1.7;
    if (vies[i] > 1) vies[i] -= 1;
    const k = vies[i];
    pos[i * 3] = cote[i] + derive[i] * k;
    // Elle monte vite puis retombe : une parabole, pas une ligne.
    pos[i * 3 + 1] = 0.12 + k * 1.5 - k * k * 1.15;
    pos[i * 3 + 2] = 1.9 + k * 4.5;
  }
  geo.attributes.position.needsUpdate = true;
}

/* ==========================================================================
   LA DELOREAN

   ANTOINE : « il y a Retour vers le futur, ameliore-la ».

   Il n'y avait que les deux trainees de feu sur la neige. C'est le plan de
   fin du film, et c'est joli, mais on ne cite pas un film en n'en montrant
   que la consequence : il manquait LA VOITURE, et le moment ou elle
   disparait.

   La silhouette est tres particuliere et tient a quatre choses, aucune
   negociable :

   · ELLE EST TRES BASSE ET TRES PLATE. Un mètre quinze au toit, la moitie
     d'une berline. C'est le premier rapport qui la nomme ;
   · LE PARE-BRISE EST PRESQUE COUCHE, et le capot plonge vers l'avant en
     coin — c'est une voiture en biseau, pas une caisse ;
   · L'ARRIERE EST VERTICAL, barre de persiennes horizontales ;
   · ELLE EST EN INOX BROSSE, donc claire et tres reflechissante, la ou
     toutes les autres voitures de cette foret sont sombres. De nuit, c'est
     ce qui la fait ressortir immediatement.

   Et par-dessus : le reacteur, les arcs bleus qui montent quand elle
   accelere, et l'eclair au moment ou elle passe. Le reste — les trainees de
   feu — existait deja et n'a pas change.
   ========================================================================== */
export function delorean() {
  const g = new THREE.Group();
  const inox = { color: 0xA8B0BA, roughness: 0.28, metalness: 0.92 };
  const roues = [];

  /* Le corps, en trois etages tres plats. La ligne de caisse est
     rigoureusement horizontale et le toit a peine plus haut : c'est ce
     manque de hauteur qui fait tout. */
  const bas = boite(1.84, 0.34, 4.30, 0xA8B0BA, inox);
  bas.position.y = 0.52;
  g.add(bas);

  // Le capot : il PLONGE vers l'avant, en coin.
  const capot = boite(1.72, 0.16, 1.70, 0xA8B0BA, inox);
  capot.position.set(0, 0.70, -1.55);
  capot.rotation.x = 0.085;
  g.add(capot);

  // Le pare-brise, presque couche : soixante-cinq degres de la verticale.
  const parebrise = boite(1.58, 0.72, 0.30, 0x0E1520,
    { roughness: 0.10, metalness: 0.75 });
  parebrise.position.set(0, 0.93, -0.62);
  parebrise.rotation.x = -1.02;
  g.add(parebrise);

  // Le toit, court et bas.
  const toit = boite(1.56, 0.10, 1.15, 0xA8B0BA, inox);
  toit.position.set(0, 1.14, 0.18);
  g.add(toit);

  /* L'ARRIERE VERTICAL, avec ses persiennes. Trois lattes suffisent : c'est
     leur horizontalite reguliere qui se lit, pas leur nombre. */
  const arriere = boite(1.62, 0.62, 0.14, 0x1A2028, { roughness: 0.5, metalness: 0.6 });
  arriere.position.set(0, 0.92, 0.86);
  g.add(arriere);
  for (let i = 0; i < 4; i++) {
    const latte = boite(1.56, 0.035, 0.10, 0x8A939E, { roughness: 0.35, metalness: 0.8 });
    latte.position.set(0, 0.72 + i * 0.13, 0.80);
    g.add(latte);
  }
  const pont = boite(1.72, 0.12, 1.10, 0xA8B0BA, inox);
  pont.position.set(0, 0.68, 1.62);
  g.add(pont);

  // Les prises d'air laterales, en creux sombre : elles cassent le flanc.
  for (const sx of [-1, 1]) {
    const prise = boite(0.06, 0.16, 1.20, 0x121820, { roughness: 0.7 });
    prise.position.set(sx * 0.92, 0.62, 0.55);
    g.add(prise);
  }

  /* LE REACTEUR sur le pont arriere : un cylindre trapu surmonte d'un
     entonnoir. Sans lui, c'est un coupe des annees quatre-vingts ; avec, on
     sait exactement de quelle voiture il s'agit. */
  const reacteur = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.24, 0.30, 10),
    new THREE.MeshStandardMaterial({ color: 0x2E353E, roughness: 0.45, metalness: 0.75 })
  );
  reacteur.position.set(0, 0.90, 1.55);
  g.add(reacteur);
  const entonnoir = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.16, 0.16, 10),
    new THREE.MeshStandardMaterial({ color: 0x39424D, roughness: 0.4, metalness: 0.8 })
  );
  entonnoir.position.set(0, 1.12, 1.55);
  g.add(entonnoir);

  // Les quatre roues, plus petites que celles d'une berline.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const roue = new THREE.Group();
    const pneu = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.24, 12),
      new THREE.MeshStandardMaterial({ color: 0x0A0C10, roughness: 0.95 })
    );
    pneu.rotation.z = Math.PI / 2;
    roue.add(pneu);
    const rayon = boite(0.26, 0.05, 0.05, 0xC8CFD8, { metalness: 0.6, roughness: 0.3 });
    roue.add(rayon);
    roue.position.set(sx * 0.88, 0.32, sz * 1.42);
    g.add(roue);
    roues.push(roue);
  }

  // Phares et feux.
  const phares = [];
  for (const sx of [-1, 1]) {
    const p = halo([2.5, 2.35, 1.9], 1.6, 0.65);
    p.position.set(sx * 0.56, 0.72, -2.16);
    g.add(p);
    phares.push(p);
  }
  const cones = [];
  for (const sx of [-1, 1]) {
    const c = faisceau([2.0, 1.85, 1.5], 24, 2.4, 2.4);
    c.position.set(sx * 0.56, 0.72, -2.16);
    c.rotation.x = -0.03;
    g.add(c);
    cones.push(c);
  }

  /* LES ARCS DU CONDENSATEUR. Quatre halos bleu-blanc qui courent le long
     de la caisse et s'allument par a-coups quand elle monte en regime.
     C'est le signal qui annonce le saut : sans lui, la disparition n'a
     aucune preparation et ressemble a un bogue d'affichage. */
  const arcs = [];
  for (let i = 0; i < 6; i++) {
    const a = halo([0.9, 1.9, 3.4], 1.5);
    a.position.set((i % 2 ? 1 : -1) * 0.92, 0.62 + (i % 3) * 0.22, -1.4 + i * 0.62);
    g.add(a);
    arcs.push(a);
  }

  g.userData = { roues, phares, cones, arcs, reacteur };
  return g;
}

/* La disparition : un eclair blanc bref et tres large. Un objet qui
   s'efface en fondu se lit comme une erreur ; le meme objet efface par un
   flash se lit comme un evenement. */
function eclair() {
  const s = halo([3.6, 3.5, 3.2], 16);
  s.position.y = 0.9;
  return s;
}
