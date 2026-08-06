/* Le cerf.

   Rien n'est charge : le cerf est entierement fabrique par le code. Il est vu
   de dos et de trois quarts, a contre-jour, souvent a demi masque par les
   troncs et la neige — c'est le bon choix de mise en scene (un guide qu'on
   suit) et celui qui joue sur les forces du procedural : la silhouette, la
   lumiere sur les contours, le mouvement.

   Ce qui fait qu'on reconnait un cerf elaphe, dans l'ordre d'importance :

   1. LA SILHOUETTE. Poitrail profond, ventre remonte, croupe puissante,
      encolure epaisse portee en oblique. Un tube de section constante donne
      un lama ; il faut une section ELLIPTIQUE (le cerf est plus haut que
      large) dont les proportions varient le long du dos.
   2. LA ROBE. Ce n'est pas un animal uni. Ligne dorsale sombre, flancs plus
      clairs, ventre creme, encolure et pattes nettement plus foncees, et
      surtout la TACHE CLAIRE DE LA CROUPE, qui est le repere le plus
      identifiable a distance.
   3. LA CRINIERE D'HIVER. Un male en decembre porte un collier de poils longs
      autour du cou. C'est elle qui distingue un cerf d'un grand chevreuil.
   4. LA TETE. Un coin allonge, front large, chanfrein qui s'affine, museau
      sombre cercle de clair.
   5. LES BOIS. Merrain epais partant en arriere avant de se relever, avec des
      andouillers tournes vers l'avant.

   Proportions retenues : environ 1,30 m au garrot, 1,80 m du poitrail a la
   croupe. L'axe du corps est a 1,00 m du sol — c'est le CENTRE de la section,
   pas le dos.
*/

import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);

/* --------------------------------------------------------------------------
   Tube generalise : polyligne, section elliptique variable, couleur decidee
   par une fonction (rang, angle). C'est l'outil unique — torse, encolure,
   criniere, membres, queue et bois en sortent tous.

   La normale tient compte de la variation de rayon le long du tube : sans
   cela, un volume qui s'effile s'eclaire comme un cylindre et parait plat.
   -------------------------------------------------------------------------- */
function tube(points, sections, couleurDe, segments = 12, dechire = 0) {
  const n = points.length;
  const pos = [], nor = [], col = [], idx = [];

  const tan = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const haut = V(0, 1, 0);
  const p = new THREE.Vector3();
  const nv = new THREE.Vector3();
  const c = new THREE.Color();

  for (let i = 0; i < n; i++) {
    if (i === 0) tan.subVectors(points[1], points[0]);
    else if (i === n - 1) tan.subVectors(points[n - 1], points[n - 2]);
    else tan.subVectors(points[i + 1], points[i - 1]);
    tan.normalize();

    bin.crossVectors(haut, tan);
    if (bin.lengthSq() < 1e-5) bin.set(1, 0, 0);
    bin.normalize();
    nrm.crossVectors(tan, bin).normalize();

    const [rx, ry] = sections[i];
    // Pente du volume : de combien le rayon varie par unite de longueur.
    const prec = sections[Math.max(0, i - 1)];
    const suiv = sections[Math.min(n - 1, i + 1)];
    const dl = points[Math.min(n - 1, i + 1)].distanceTo(points[Math.max(0, i - 1)]) || 1;
    const pente = (((suiv[0] + suiv[1]) - (prec[0] + prec[1])) * 0.5) / dl;

    for (let j = 0; j < segments; j++) {
      const ang = (j / segments) * Math.PI * 2;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const d = dechire
        ? 1 - dechire * 0.5 + Math.abs(Math.sin(ang * 5.3 + i * 2.1)) * dechire
        : 1;

      p.set(
        bin.x * ca * rx * d + nrm.x * sa * ry * d,
        bin.y * ca * rx * d + nrm.y * sa * ry * d,
        bin.z * ca * rx * d + nrm.z * sa * ry * d
      );
      pos.push(points[i].x + p.x, points[i].y + p.y, points[i].z + p.z);

      // Normale d'une ellipse : composantes divisees par le rayon de l'axe.
      nv.set(
        bin.x * ca / rx + nrm.x * sa / ry,
        bin.y * ca / rx + nrm.y * sa / ry,
        bin.z * ca / rx + nrm.z * sa / ry
      ).normalize();
      nv.addScaledVector(tan, -pente);
      nv.normalize();
      nor.push(nv.x, nv.y, nv.z);

      couleurDe(c, i, i / (n - 1), ang, sa, ca);
      col.push(c.r, c.g, c.b);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const j2 = (j + 1) % segments;
      const a = i * segments + j, b = i * segments + j2;
      const cc = (i + 1) * segments + j, dd = (i + 1) * segments + j2;
      idx.push(a, cc, b, b, cc, dd);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/* Reechantillonne une polyligne et ses sections sur une courbe lisse.

   Sept anneaux suffisent a POSER les proportions, pas a les rendre : entre
   deux anneaux eloignes, le tube est un tronc de cone, et le corps se
   couvre de panneaux plats bien visibles de profil. On repasse donc par une
   spline pour obtenir une vingtaine d'anneaux a partir des memes reperes. */
function lisser(points, sections, n) {
  const courbe = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const pts = [], sec = [];
  const m = points.length - 1;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push(courbe.getPoint(t));
    // Les sections suivent le meme parametre, interpolees lineairement.
    const u = t * m;
    const k = Math.min(m - 1, Math.floor(u));
    const f = u - k;
    sec.push([
      sections[k][0] + (sections[k + 1][0] - sections[k][0]) * f,
      sections[k][1] + (sections[k + 1][1] - sections[k][1]) * f,
    ]);
  }
  return [pts, sec];
}

/* Teinte unie, eclaircie vers le ventre. Les couleurs de sommets sont
   consommees en espace LINEAIRE : on eclaircit donc proportionnellement,
   jamais vers une valeur absolue, sous peine de virer au blanc. */
function robeUnie(base, ventre = 1.0) {
  const b = C(base);
  return (c, i, t, ang, sa) => {
    const bas = Math.max(0, -sa);
    const k = 1 + bas * bas * ventre;
    c.setRGB(b.r * k, b.g * k * 1.02, b.b * k * 1.10);
  };
}

/* --------------------------------------------------------------------------
   Le tronc — la piece qui porte la silhouette.
   -------------------------------------------------------------------------- */
function corpsGeo(segments) {
  /* Ligne du dos : creux derriere le garrot, remontee sur la croupe. */
  const pts = [
    V(0, 0.03, 0.94),    // naissance de la queue
    V(0, 0.07, 0.74),    // croupe
    V(0, 0.02, 0.44),    // rein
    V(0, -0.01, 0.10),   // milieu du dos
    V(0, 0.04, -0.26),   // garrot
    V(0, 0.00, -0.58),   // base de l'encolure
    V(0, -0.10, -0.86),  // poitrail
  ];
  /* Sections (demi-largeur, demi-hauteur). Le cerf est nettement plus haut
     que large : c'est ce rapport qui tue l'aspect tonneau. */
  const sec = [
    [0.110, 0.130],
    [0.235, 0.275],    // hanches
    [0.205, 0.265],
    [0.215, 0.290],
    [0.235, 0.325],    // poitrail profond
    [0.205, 0.285],
    [0.125, 0.185],
  ];

  /* Ces valeurs sont plus sombres qu'on ne l'imagine, et c'est voulu.
     L'eclairement de la scene est calibre pour la neige (albedo ~0,8) ; un
     pelage a 0,20 s'y retrouve pousse dans les clairs par la courbe ACES et
     l'animal vire au beige uniforme, ecrasant tout le dessin de la robe.
     Un vrai pelage brun est autour de 0,07 en lineaire — soit bien plus
     fonce que ce que l'intuition suggere. */
  const dorsal = C(0x241811);
  const flanc = C(0x634C34);
  const croupe = C(0xB09A74);   // la tache claire, repere le plus visible

  const [P, S] = lisser(pts, sec, 22);
  return tube(P, S, (c, i, t, ang, sa) => {
    const bas = Math.max(0, -sa);
    const dos = Math.max(0, sa);
    c.copy(flanc);
    c.lerp(dorsal, Math.pow(dos, 1.7) * 0.92);
    // t vaut 0 a la queue : la tache claire occupe l'arriere.
    const arriere = 1 - Math.min(1, t * 3.4);
    if (arriere > 0) c.lerp(croupe, arriere * (0.35 + bas * 0.5));
    const k = 1 + bas * bas * 0.55;
    c.setRGB(c.r * k, c.g * k * 1.02, c.b * k * 1.10);
  }, segments);
}

/* --------------------------------------------------------------------------
   La criniere d'hiver : un collier de poils longs autour de l'encolure.
   C'est le detail qui fait dire "cerf" plutot que "grand chevreuil".
   -------------------------------------------------------------------------- */
function crinieregeo(segments) {
  const [P, S] = lisser(
    [V(0, -0.02, 0.06), V(0, 0.16, -0.02), V(0, 0.34, -0.09), V(0, 0.50, -0.15)],
    [[0.250, 0.268], [0.232, 0.246], [0.196, 0.206], [0.136, 0.146]], 9
  );
  const poil = C(0x241811);
  return tube(P, S, (c, i, t, ang, sa) => {
    const bas = Math.max(0, -sa);
    c.copy(poil).multiplyScalar(0.85 + bas * 0.5);
  }, segments, 0.22);
}

/* --------------------------------------------------------------------------
   La tete : un coin allonge, pas un cone.
   -------------------------------------------------------------------------- */
function teteGeo(segments) {
  const pts = [
    V(0, 0.02, 0.06),     // nuque
    V(0, 0.01, -0.06),    // front
    V(0, -0.02, -0.18),   // chanfrein
    V(0, -0.055, -0.30),  // naseaux
    V(0, -0.075, -0.37),
  ];
  const sec = [
    [0.105, 0.115],
    [0.098, 0.115],       // front large
    [0.068, 0.085],
    [0.048, 0.058],
    [0.042, 0.048],
  ];
  const face = C(0x413020);
  const clair = C(0x6E5C42);
  const [P, S] = lisser(pts, sec, 12);
  return tube(P, S, (c, i, t, ang, sa) => {
    c.copy(face);
    if (t > 0.72) c.lerp(clair, ((t - 0.72) / 0.28) * 0.7);   // anneau du museau
    const bas = Math.max(0, -sa);
    c.multiplyScalar(1 + bas * bas * 0.45);                    // gorge claire
  }, segments);
}

/* --------------------------------------------------------------------------
   Les bois : merrain qui part en arriere puis se releve, andouillers vers
   l'avant.
   -------------------------------------------------------------------------- */
function boisGeo(rand) {
  const geos = [];
  const os = robeUnie(0x6E5B44, 0.15);

  function branche(depart, direction, longueur, rayon, profondeur) {
    const pts = [], sec = [];
    const pas = 5;
    const p = depart.clone();
    const d = direction.clone().normalize();
    const courbe = V((rand() - 0.5) * 0.24, 0.30, -0.20).multiplyScalar(0.16);

    for (let i = 0; i <= pas; i++) {
      pts.push(p.clone());
      const r = rayon * (1 - (i / pas) * 0.62);
      sec.push([r, r]);
      p.addScaledVector(d, longueur / pas);
      d.add(courbe).normalize();
    }
    geos.push(tube(pts, sec, os, 7));

    if (profondeur > 0) {
      const nb = profondeur === 2 ? 3 : 2;
      for (let k = 0; k < nb; k++) {
        const t = 0.18 + k * 0.28;
        const base = pts[Math.min(pas, Math.round(t * pas))].clone();
        const dir = d.clone();
        dir.x += (rand() - 0.5) * 1.1;
        dir.z -= 0.45 + rand() * 0.7;        // les andouillers pointent devant
        dir.y += 0.85 + rand() * 0.5;
        branche(base, dir, longueur * (0.40 + rand() * 0.20), rayon * 0.62, profondeur - 1);
      }
    }
  }

  for (const cote of [-1, 1]) {
    branche(V(cote * 0.062, 0.0, -0.02), V(cote * 0.42, 0.86, 0.30), 0.52, 0.030, 2);
  }
  return fusionner(geos);
}

function fusionner(geos) {
  let nPos = 0, nIdx = 0;
  for (const g of geos) { nPos += g.attributes.position.count; nIdx += g.index.count; }
  const pos = new Float32Array(nPos * 3);
  const nor = new Float32Array(nPos * 3);
  const col = new Float32Array(nPos * 3);
  const idx = new Uint16Array(nIdx);
  let po = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, po * 3);
    nor.set(g.attributes.normal.array, po * 3);
    col.set(g.attributes.color.array, po * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + po;
    po += g.attributes.position.count;
    io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/* --------------------------------------------------------------------------
   Le pelage.

   Deux ajouts au materiau standard, et chacun compte :
   · un LISERE serre sur les contours — la lumiere qui traverse les poils du
     bord. C'est lui qui detache l'animal du fond sombre et le rend vivant a
     contre-jour ;
   · un GRAIN DE POIL a deux echelles, calcule dans le repere LOCAL du corps
     pour qu'il ne nage pas quand l'animal se deplace.
   -------------------------------------------------------------------------- */
function matierePelage() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,          // la robe vient entierement des couleurs de sommets
    roughness: 0.98,
    metalness: 0.0,
    vertexColors: true,
    // La fourrure ne renvoie pas le ciel comme de la glace : sans cette
    // reduction, l'apport de la carte d'environnement delave la robe et
    // ecrase le dessin (ligne dorsale, tache de croupe).
    envMapIntensity: 0.22,
  });

  const u = {
    uLisereCol: { value: new THREE.Color(0xFFD9A8) },
    uLisereDir: { value: new THREE.Vector3(-0.45, 0.34, -0.83).normalize() },
    uLisere: { value: 1.0 },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vLocalD;
      `)
      .replace('#include <project_vertex>', `
        #include <project_vertex>
        vLocalD = position;
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vLocalD;
        uniform vec3 uLisereCol, uLisereDir;
        uniform float uLisere;

        float bruitP(vec3 p){
          return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }
      `)
      .replace('#include <opaque_fragment>', `
        {
          float p1 = bruitP(vLocalD * 42.0);
          float p2 = bruitP(vLocalD * 165.0);
          outgoingLight *= 0.90 + p1 * 0.14 + p2 * 0.08;

          /* Pas de liseré de contour ici, et c'est un choix documente.

             Deux formulations ont ete essayees — en espace monde avec des
             varyings maison, puis en espace vue avec les valeurs de three —
             et toutes deux donnaient un terme voisin de 1 sur TOUTE la
             surface au lieu du seul bord. Mesure a l'appui : un pelage
             d'albedo 0,02 rendait exactement la couleur du liseré. Il
             recouvrait donc integralement la robe, effacant la ligne
             dorsale, la tache de croupe et les pattes sombres — au point
             qu'aucun changement de couleur n'avait le moindre effet visible.

             L'eclairage seul detache deja tres bien l'animal de la neige.
             Plutot que de garder un effet dont je ne maitrise pas le
             comportement et qui detruit tout le dessin du pelage, il est
             retire. La lumiere rasante de la scene fait le travail. */
        }
        #include <opaque_fragment>
      `);
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => 'pelage';
  mat.userData.uniforms = u;
  return mat;
}

/* Tache radiale douce, pour l'ombre de contact. */
function tacheDouce() {
  const n = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Applique une couleur de sommet unie a une geometrie qui n'en a pas. */
function teinter(geo, hex) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const c = C(hex);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/* --------------------------------------------------------------------------
   Assemblage
   -------------------------------------------------------------------------- */
export function creerCerf(palier) {
  let a = 99;
  const rand = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const seg = palier.nom === 'bas' ? 12 : 18;
  const mat = matierePelage();
  const AXE = 1.00;                 // hauteur de l'axe du corps

  const racine = new THREE.Group();
  racine.name = 'cerf';

  const corps = new THREE.Group();
  corps.position.y = AXE;
  racine.add(corps);

  const torse = new THREE.Mesh(corpsGeo(seg), mat);
  torse.castShadow = palier.ombres;
  corps.add(torse);

  /* --- encolure ----------------------------------------------------------- */
  const cou = new THREE.Group();
  cou.position.set(0, -0.02, -0.80);
  corps.add(cou);

  const [pCou, sCou] = lisser(
    [V(0, 0, 0.06), V(0, 0.17, -0.03), V(0, 0.35, -0.10), V(0, 0.52, -0.16)],
    [[0.175, 0.205], [0.150, 0.175], [0.122, 0.140], [0.098, 0.108]], 10
  );
  const encolure = new THREE.Mesh(tube(pCou, sCou, robeUnie(0x342518, 0.45), seg), mat);
  encolure.castShadow = palier.ombres;
  cou.add(encolure);

  cou.add(new THREE.Mesh(crinieregeo(Math.max(9, seg - 2)), mat));

  /* --- tete --------------------------------------------------------------- */
  const tete = new THREE.Group();
  tete.position.set(0, 0.52, -0.16);
  cou.add(tete);

  const crane = new THREE.Mesh(teteGeo(seg), mat);
  crane.castShadow = palier.ombres;
  tete.add(crane);

  const mufle = new THREE.Mesh(
    new THREE.SphereGeometry(0.040, 9, 7),
    new THREE.MeshStandardMaterial({ color: 0x14100C, roughness: 0.35 })
  );
  mufle.scale.set(1, 0.85, 0.8);
  mufle.position.set(0, -0.075, -0.385);
  tete.add(mufle);

  /* Oreilles : grandes et ecartees. Chez un cerf elles sont enormes — les
     faire timides est l'erreur qui rend la tete quelconque. */
  for (const cote of [-1, 1]) {
    const geo = teinter(new THREE.SphereGeometry(0.075, 9, 7), 0x38281B);
    const o = new THREE.Mesh(geo, mat);
    o.scale.set(0.30, 0.95, 0.60);
    o.position.set(cote * 0.088, 0.045, 0.015);
    o.rotation.z = cote * 0.85;
    o.rotation.x = -0.30;
    tete.add(o);
  }

  /* Les yeux accrochent la lumiere : c'est ce qui donne un regard. */
  const matOeil = new THREE.MeshStandardMaterial({
    color: 0x0E0906, roughness: 0.12, metalness: 0.2,
    emissive: 0x3A2A16, emissiveIntensity: 0.7,
  });
  for (const cote of [-1, 1]) {
    const y = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 7), matOeil);
    y.position.set(cote * 0.078, 0.005, -0.115);
    tete.add(y);
  }

  const ramure = new THREE.Mesh(boisGeo(rand), mat);
  ramure.position.set(0, 0.055, -0.03);
  ramure.castShadow = palier.ombres;
  tete.add(ramure);

  /* --- queue -------------------------------------------------------------- */
  const queue = new THREE.Group();
  queue.position.set(0, 0.05, 0.92);
  corps.add(queue);
  queue.add(new THREE.Mesh(tube(
    [V(0, 0, 0), V(0, -0.07, 0.08), V(0, -0.16, 0.10)],
    [[0.048, 0.052], [0.038, 0.042], [0.020, 0.022]],
    (c, i, t, ang, sa) => { c.setHex(0x33241A).lerp(C(0x9E8F72), Math.max(0, -sa) * 0.8); }, 8
  ), mat));

  /* --- membres ------------------------------------------------------------
     La somme des segments doit DEPASSER la hauteur d'attache, sinon la
     cinematique inverse sature et l'animal se retrouve sur des echasses. */
  const membres = [];
  for (const cfg of [
    { nom: 'AG', avant: true, cote: -1 }, { nom: 'AD', avant: true, cote: 1 },
    { nom: 'PG', avant: false, cote: -1 }, { nom: 'PD', avant: false, cote: 1 },
  ]) {
    const attache = new THREE.Group();
    attache.position.set(
      cfg.cote * (cfg.avant ? 0.155 : 0.170),
      cfg.avant ? -0.09 : -0.11,
      cfg.avant ? -0.52 : 0.62
    );
    corps.add(attache);

    const L1 = cfg.avant ? 0.500 : 0.545;
    const L2 = cfg.avant ? 0.475 : 0.455;

    const haut = new THREE.Group();
    attache.add(haut);
    // Epaule et cuisse musclees en haut, fines au genou.
    const [pH, sH] = lisser(
      [V(0, 0, 0), V(0, -L1 * 0.42, cfg.avant ? 0.012 : -0.018), V(0, -L1, 0)],
      cfg.avant ? [[0.115, 0.135], [0.078, 0.092], [0.046, 0.050]]
                : [[0.140, 0.165], [0.088, 0.105], [0.044, 0.048]], 7
    );
    const mHaut = new THREE.Mesh(tube(
      pH, sH, robeUnie(cfg.avant ? 0x43301F : 0x4A3725, 0.30), Math.max(8, seg - 3)
    ), mat);
    mHaut.castShadow = palier.ombres;
    haut.add(mHaut);

    const bas = new THREE.Group();
    bas.position.y = -L1;
    haut.add(bas);
    // Le canon s'assombrit nettement vers le bas : les cerfs ont les
    // extremites presque noires, et ca ancre visuellement les pattes.
    const mBas = new THREE.Mesh(tube(
      [V(0, 0, 0), V(0, -L2 * 0.5, 0), V(0, -L2, 0)],
      [[0.044, 0.048], [0.030, 0.032], [0.024, 0.026]],
      (c, i, t) => { c.setHex(0x2E2015).multiplyScalar(1 - t * 0.45); }, Math.max(6, seg - 4)
    ), mat);
    mBas.castShadow = palier.ombres;
    bas.add(mBas);

    const sabot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.034, 0.070, 7),
      new THREE.MeshStandardMaterial({ color: 0x100C09, roughness: 0.42 })
    );
    sabot.position.y = -L2 - 0.028;
    bas.add(sabot);

    membres.push({ ...cfg, attache, haut, bas, L1, L2, longueur: L1 + L2 });
  }

  /* Ombre de contact. Les sabots se posent bien au sol (mesure), mais sur une
     neige aussi claire l'oeil ne le voit pas sans assombrissement au contact. */
  const ombre = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 3.1),
    new THREE.MeshBasicMaterial({
      map: tacheDouce(), transparent: true, opacity: 0.36,
      depthWrite: false, color: 0x0A1622, fog: true,
    })
  );
  ombre.rotation.x = -Math.PI / 2;
  ombre.position.y = 0.04;
  ombre.renderOrder = 2;
  racine.add(ombre);

  const souffle = creerSouffle();
  souffle.position.set(0, -0.085, -0.42);
  tete.add(souffle);

  return {
    racine, corps, cou, tete, queue, membres, materiau: mat, souffle, ombre,
    hauteurGarrot: AXE,
  };
}

/* Buee des naseaux : quelques points expulses puis emportes vers l'arriere. */
function creerSouffle() {
  const N = 26;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const m = new THREE.PointsMaterial({
    color: 0xDCE8F4, size: 0.075, transparent: true, opacity: 0.24,
    depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.userData = { vie: Float32Array.from({ length: N }, () => Math.random()), N };
  return pts;
}
