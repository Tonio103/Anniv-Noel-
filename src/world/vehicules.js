/* LES VEHICULES, ET LA COURSE-POURSUITE.

   ANTOINE : « la voiture de police doit se deplacer, ca doit etre une
   veritable course-poursuite ».

   La version precedente etait une voiture GAREE dans la neige avec son
   gyrophare allume. Elle avait beau balayer les troncs de deux faisceaux
   tournants, elle ne racontait rien : une voiture de police immobile au
   milieu d'une foret, c'est un decor, pas une scene. Et pire, sa fenetre
   s'ouvrait quarante-deux metres avant son emplacement, c'est-a-dire AVANT
   LE POINT DE DEPART DE LA BALADE — on voyait donc le gyrophare des la
   premiere seconde, ce qui grillait le seul effet de surprise qu'elle avait.

   Il y a maintenant DEUX voitures, elles roulent vite, et elles arrivent de
   derriere. Ce qui fait une poursuite tient a quatre choses, dans cet ordre :

   · LE FUYARD PASSE D'ABORD, tous feux arriere allumes, en zigzag. Sans lui
     la police ne poursuit rien et l'on regarde une ronde ;
   · ELLES ARRIVENT DU FOND, phares dans le brouillard. On les voit venir de
     loin, ce qui installe l'attente ;
   · ELLES DOUBLENT LE CERF, tres vite, au ras du chemin. C'est le seul
     instant ou l'echelle et la vitesse se lisent vraiment ;
   · ELLES DISPARAISSENT DEVANT, avalees par la brume, en laissant le
     gyrophare battre encore un moment sur les arbres.

   Tout cela se joue en une dizaine de secondes, et le reste de la fenetre
   est du silence — c'est lui qui fait la surprise.
*/

import * as THREE from 'three';
import { lueurDiffuse, grainRond } from '../core/dot.js';
import { smoothstep, clamp } from '../core/noise.js';

const boite = (l, h, p, coul, opts = {}) => new THREE.Mesh(
  new THREE.BoxGeometry(l, h, p),
  new THREE.MeshStandardMaterial({ color: coul, roughness: 0.55, ...opts })
);

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

/* Le faisceau : un cone additif, sombre a sa base et clair a sa pointe.
   En addition, le noir n'ajoute rien : un degrade vers le noir EST un
   degrade vers la transparence, sans texture ni tri de transparence. */
function faisceau(couleur, longueur, ouverture, exposant = 2.9) {
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
function carrosserie(opts) {
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

  g.userData = { roues, phares, feux, cones };
  return g;
}

/* La rampe de gyrophare, et les deux rayons tournants. */
function gyrophare(g) {
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
function gerbe(n) {
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

function majGerbe(pts, dt, force) {
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
   LA COURSE-POURSUITE
   ========================================================================== */
export function coursePoursuite(chemin, relief, palier) {
  const g = new THREE.Group();
  g.userData.suitChemin = true;

  /* La voiture de police est le SUJET : c'est elle qui porte le groupe, donc
     l'orientation, donc la source sonore. Le fuyard est un enfant place
     devant elle, sur la meme voie. */
  const police = carrosserie({ teinte: 0x1B2432, bicolore: true });
  g.add(police);
  const gyro = gyrophare(police);
  const poussierePolice = gerbe(palier.nom === 'bas' ? 40 : 70);
  police.add(poussierePolice);

  const fuyard = carrosserie({ teinte: 0x2A1418 });
  g.add(fuyard);
  const poussiereFuyard = gerbe(palier.nom === 'bas' ? 40 : 70);
  fuyard.add(poussiereFuyard);

  /* Les reperes de la course, en metres le long du chemin, comptes depuis
     le point d'ancrage de la scene. Le fuyard a vingt-deux metres d'avance :
     assez pour qu'on lise deux vehicules distincts, assez peu pour qu'ils
     tiennent dans la meme image quand ils passent. */
  const DEPART = -125, ARRIVEE = 130, AVANCE = 22;
  const p = new THREE.Vector3(), c = new THREE.Vector3(), tan = new THREE.Vector3();

  /* La voie : les deux voitures roulent A COTE du chemin, du cote utilisable
     du cadre, et jamais dessus — le cerf y marche. */
  /* MESURE : a six metres de voie, la voiture de police sortait par le bord
     gauche au moment ou elle double — moins zero virgule soixante-dix-huit
     a l'ecran, en portrait. Quatre metres et demi la ramenent dans le cadre
     sans qu'elle empiete sur le passage du cerf. */
  const VOIE = 4.5, COTE = -1;

  const placer = (objet, sVoiture, decalage, y0) => {
    const sc = clamp(sVoiture, 0, chemin.longueur);
    chemin.point(sc, p);
    chemin.cote(sc, c);
    chemin.tangente(sc, tan);
    const x = p.x + c.x * COTE * (VOIE + decalage);
    const z = p.z + c.z * COTE * (VOIE + decalage);
    objet.position.set(x, relief.hauteur(x, z) - y0, z);
    objet.rotation.y = Math.atan2(-tan.x, -tan.z);
    return objet.rotation.y;
  };

  let dernierS = 0;

  g.userData.jouer = (u, t, camera, sAncre, dt) => {
    /* LE PASSAGE NE DURE PAS TOUTE LA FENETRE. On les voit venir de loin,
       elles doublent, elles disparaissent — et il reste du silence avant et
       apres. Une poursuite qui dure vingt-cinq secondes cesse d'etre une
       poursuite. */
    const k = clamp((u - 0.18) / 0.46, 0, 1);
    const sPolice = sAncre + DEPART + k * (ARRIVEE - DEPART);
    const sFuyard = sPolice + AVANCE;

    /* Elles n'existent que tant qu'elles sont en piste. Avant et apres, tout
       s'eteint — y compris le gyrophare, qui sinon battrait dans le vide au
       bout du chemin. */
    const enPiste = smoothstep(0, 0.06, k) * smoothstep(1, 0.94, k);
    g.visible = enPiste > 0.005;
    if (!g.visible) return;

    /* Le groupe porte la position de la voiture de police. On garde ensuite
       tout en coordonnees du monde pour le fuyard : les deux voies ne sont
       pas paralleles quand le chemin tourne, et les rattacher rigidement
       ferait deraper le fuyard dans les virages. */
    placer(g, sPolice, 0, 0);
    police.position.set(0, 0, 0);
    police.rotation.set(0, 0, 0);

    /* Le fuyard, dans le repere du groupe. On calcule sa position du monde
       puis on la ramene : c'est le seul moyen qu'il suive vraiment la
       courbe du chemin. */
    g.updateMatrixWorld(true);
    const zig = Math.sin(t * 2.9) * 1.15;
    chemin.point(clamp(sFuyard, 0, chemin.longueur), p);
    chemin.cote(clamp(sFuyard, 0, chemin.longueur), c);
    chemin.tangente(clamp(sFuyard, 0, chemin.longueur), tan);
    const fx = p.x + c.x * COTE * (VOIE + zig);
    const fz = p.z + c.z * COTE * (VOIE + zig);
    fuyard.position.set(fx, relief.hauteur(fx, fz), fz);
    g.worldToLocal(fuyard.position);
    const capFuyard = Math.atan2(-tan.x, -tan.z);
    fuyard.rotation.y = capFuyard - g.rotation.y + Math.sin(t * 2.9 + 0.4) * 0.13;
    /* Il se couche dans ses embardees : une voiture qui zigzague a plat se
       lit comme un curseur qu'on fait glisser. */
    fuyard.rotation.z = -Math.cos(t * 2.9) * 0.075;

    /* LA VITESSE. On la mesure sur le deplacement reel plutot que de la
       supposer : elle sert a faire tourner les roues au bon rythme et a
       doser la gerbe de neige, et une valeur devinee se voit tout de suite
       en patinage. */
    const vitesse = dt > 1e-4 ? Math.abs(sPolice - dernierS) / dt : 0;
    dernierS = sPolice;
    const tour = (vitesse * dt) / 0.36;      // rayon de roue
    for (const v of [police, fuyard]) {
      for (const r of v.userData.roues) r.rotation.x -= tour;
    }

    const force = enPiste * clamp(vitesse / 14, 0, 1);
    majGerbe(poussierePolice, dt, force);
    majGerbe(poussiereFuyard, dt, force);

    // Les phares et les feux.
    for (const v of [police, fuyard]) {
      for (const ph of v.userData.phares) ph.material.opacity = enPiste * 0.85;
      for (const co of v.userData.cones) co.material.opacity = enPiste * 0.30;
    }
    for (const f of police.userData.feux) f.material.opacity = enPiste * 0.5;
    /* LE FUYARD FREINE PAR A-COUPS. Ses feux arriere s'allument franchement
       a chaque coup de frein : c'est le signal le plus lisible d'une
       poursuite, bien avant la vitesse elle-meme. */
    const frein = 0.35 + Math.pow(Math.max(0, Math.sin(t * 1.9)), 6) * 0.65;
    for (const f of fuyard.userData.feux) f.material.opacity = enPiste * frein;

    /* LE GYROPHARE. L'alternance, pas le clignotement : chaque cote pulse
       deux fois vite puis passe la main. C'est ce rythme qu'on reconnait de
       loin, et c'est lui qu'il ne faut jamais toucher. */
    const cy = (t * 1.6) % 1;
    const cote = cy < 0.5;
    const bat = Math.pow(Math.abs(Math.sin(t * 19)), 0.6);
    const fB = cote ? bat : 0.06, fR = cote ? 0.06 : bat;
    gyro.bleu.material.opacity = enPiste * fB;
    gyro.rouge.material.opacity = enPiste * fR;
    gyro.rayonBleu.rotation.y = t * 2.6;
    gyro.rayonRouge.rotation.y = -t * 2.6 + Math.PI;
    gyro.rayonBleu.rotation.x = -0.05;
    gyro.rayonRouge.rotation.x = -0.05;
    gyro.rayonBleu.material.opacity = enPiste * (0.14 + fB * 0.28);
    gyro.rayonRouge.material.opacity = enPiste * (0.14 + fR * 0.28);

    void camera;
  };
  return g;
}
