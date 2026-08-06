/* Le cerf.

   Il n'y a aucun modele 3D a charger ici : tout est fabrique par le code.
   Le parti pris qui en decoule est assume — le cerf est vu de dos et de
   trois quarts, a contre-jour, souvent a demi masque par les troncs et la
   neige. C'est a la fois le bon choix de mise en scene (un guide qu'on
   suit, pas un animal d'exposition) et celui qui joue sur les forces du
   procedural : la silhouette, la lumiere sur les contours, le mouvement.

   Le corps est fait de tubes generes le long de polylignes — un outil qui
   sert aussi bien au torse qu'au cou ou aux membres. Chaque partie mobile
   est un objet rigide distinct, mais les volumes se CHEVAUCHENT largement :
   c'est ce recouvrement qui masque les articulations et evite l'aspect
   pantin articule.

   Les proportions sont celles d'un cerf elaphe adulte : environ 1,35 m au
   garrot, 2 m du poitrail a la croupe. A cette echelle, un sapin de vingt
   metres le domine — et c'est exactement l'impression voulue.
*/

import * as THREE from 'three';

/* --------------------------------------------------------------------------
   Tube le long d'une polyligne, avec un rayon variable et une couleur
   variable par anneau. Sert a tout : torse, cou, membres, queue.
   -------------------------------------------------------------------------- */
function tube(points, rayons, couleurs, segments = 10) {
  const n = points.length;
  const pos = [], nor = [], col = [], idx = [];

  const tangente = new THREE.Vector3();
  const normale = new THREE.Vector3();
  const binorm = new THREE.Vector3();
  const haut = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    // Tangente par differences centrees : le tube ne se vrille pas.
    if (i === 0) tangente.subVectors(points[1], points[0]);
    else if (i === n - 1) tangente.subVectors(points[n - 1], points[n - 2]);
    else tangente.subVectors(points[i + 1], points[i - 1]);
    tangente.normalize();

    binorm.crossVectors(haut, tangente);
    if (binorm.lengthSq() < 1e-5) binorm.set(1, 0, 0);
    binorm.normalize();
    normale.crossVectors(tangente, binorm).normalize();

    const r = rayons[i];
    const c = couleurs[i];
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      tmp.set(
        binorm.x * ca * r + normale.x * sa * r,
        binorm.y * ca * r + normale.y * sa * r,
        binorm.z * ca * r + normale.z * sa * r
      );
      pos.push(points[i].x + tmp.x, points[i].y + tmp.y, points[i].z + tmp.z);
      tmp.normalize();
      nor.push(tmp.x, tmp.y, tmp.z);
      // Le ventre est plus clair que le dos : sa est negatif vers le bas.
      const versLeBas = Math.max(0, -sa);
      const t = versLeBas * versLeBas * 0.9;
      col.push(
        c.r * (1 + 1.15 * t),
        c.g * (1 + 1.35 * t),
        c.b * (1 + 1.60 * t)
      );
    }
  }

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const j2 = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + j2;
      const c = (i + 1) * segments + j;
      const d = (i + 1) * segments + j2;
      idx.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);

/* --------------------------------------------------------------------------
   Bois : une ramure construite par recursion. Deux ou trois embranchements
   suffisent — au-dela, plus personne ne compte les cors.
   -------------------------------------------------------------------------- */
function bois(rand) {
  const geos = [];

  function branche(depart, direction, longueur, rayon, profondeur) {
    const pts = [], rs = [], cs = [];
    const pas = 4;
    const p = depart.clone();
    const d = direction.clone().normalize();
    // Une courbure legere : les bois ne sont jamais rectilignes.
    const courbe = V((rand() - 0.5) * 0.5, 0.36, (rand() - 0.5) * 0.5).multiplyScalar(0.1);

    for (let i = 0; i <= pas; i++) {
      pts.push(p.clone());
      rs.push(rayon * (1 - (i / pas) * 0.72));
      cs.push(C(0x6B5540));
      p.addScaledVector(d, longueur / pas);
      d.add(courbe).normalize();
    }
    geos.push(tube(pts, rs, cs, 6));

    if (profondeur > 0) {
      const nb = profondeur === 2 ? 3 : 2;
      for (let k = 0; k < nb; k++) {
        const t = 0.32 + k * 0.26;
        const base = pts[Math.min(pas, Math.round(t * pas))].clone();
        const dir = d.clone();
        dir.x += (rand() - 0.5) * 1.5;
        dir.z += (rand() - 0.5) * 1.0;
        dir.y += 0.55 + rand() * 0.4;
        branche(base, dir, longueur * (0.44 + rand() * 0.16), rayon * 0.6, profondeur - 1);
      }
    }
  }

  for (const cote of [-1, 1]) {
    branche(
      V(cote * 0.055, 0.02, 0.0),
      V(cote * 0.52, 1.0, -0.16),
      0.50, 0.032, 2
    );
  }

  return mergeGeos(geos);
}

function mergeGeos(geos) {
  let nPos = 0, nIdx = 0;
  for (const g of geos) {
    nPos += g.attributes.position.count;
    nIdx += g.index.count;
  }
  const pos = new Float32Array(nPos * 3);
  const nor = new Float32Array(nPos * 3);
  const col = new Float32Array(nPos * 3);
  const idx = new Uint16Array(nIdx);
  let po = 0, io = 0, base = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, po * 3);
    nor.set(g.attributes.normal.array, po * 3);
    col.set(g.attributes.color.array, po * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + base;
    po += g.attributes.position.count;
    io += gi.length;
    base = po;
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
   Materiau : fourrure approchee.

   Deux ajouts au materiau standard font tout le travail. D'abord un liseré
   de lumiere sur les bords (la lumiere qui traverse les poils du contour) —
   c'est ce qui detache le cerf du fond sombre et le rend vivant a
   contre-jour. Ensuite un grain fin qui casse l'aspect lisse du plastique.
   -------------------------------------------------------------------------- */
function matiereFourrure() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6B5136,
    roughness: 0.92,
    metalness: 0.0,
    vertexColors: true,
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
        varying vec3 vMondeD;
        varying vec3 vNormD;
      `)
      .replace('#include <project_vertex>', `
        #include <project_vertex>
        vMondeD = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vNormD = normalize(mat3(modelMatrix) * objectNormal);
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vMondeD;
        varying vec3 vNormD;
        uniform vec3 uLisereCol, uLisereDir;
        uniform float uLisere;
      `)
      .replace('#include <opaque_fragment>', `
        {
          vec3 Vd = normalize(cameraPosition - vMondeD);
          vec3 N = normalize(vNormD);
          // Liseré : maximal la ou la surface fuit le regard, et seulement
          // du cote d'ou vient la lumiere.
          // L'exposant doit etre eleve : sur un corps cylindrique, un liseré
          // large deborde sur toute la silhouette et l'animal vire au blanc.
          float bord = pow(1.0 - clamp(dot(N, Vd), 0.0, 1.0), 6.0);
          float versLum = clamp(dot(N, normalize(uLisereDir)) * 0.5 + 0.5, 0.0, 1.0);
          outgoingLight += uLisereCol * bord * versLum * 0.34 * uLisere;

          // Grain de pelage : tres fin, il suffit a tuer l'effet plastique.
          float poil = fract(sin(dot(floor(vMondeD * 210.0), vec3(12.99, 78.23, 37.71))) * 43758.55);
          outgoingLight *= 0.94 + poil * 0.12;
        }
        #include <opaque_fragment>
      `);
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => 'fourrure';
  mat.userData.uniforms = u;
  return mat;
}

/* --------------------------------------------------------------------------
   Assemblage
   -------------------------------------------------------------------------- */
export function creerCerf(palier) {
  const rand = (() => { let a = 99; return () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();
  const seg = palier.nom === 'bas' ? 7 : 10;
  const mat = matiereFourrure();

  const racine = new THREE.Group();
  racine.name = 'cerf';

  /* --- le corps ---------------------------------------------------------- */
  // Le tronc part de la croupe (z positif) vers le poitrail (z negatif) :
  // le cerf regarde donc vers -Z, comme le chemin.
  const corps = new THREE.Group();
  corps.position.y = 1.20;
  racine.add(corps);

  const dos = C(0x6A4F35);
  const ptsCorps = [
    V(0, 0.00, 0.86), V(0, 0.10, 0.62), V(0, 0.13, 0.30),
    V(0, 0.10, -0.06), V(0, 0.12, -0.42), V(0, 0.07, -0.70), V(0, -0.03, -0.86),
  ];
  const rCorps = [0.15, 0.32, 0.375, 0.355, 0.365, 0.30, 0.19];
  const torse = new THREE.Mesh(tube(ptsCorps, rCorps, ptsCorps.map(() => dos), seg + 2), mat);
  torse.castShadow = palier.ombres;
  corps.add(torse);

  /* --- le cou et la tete -------------------------------------------------- */
  // Pivot au poitrail : c'est lui qu'on anime pour les mouvements de tete.
  const cou = new THREE.Group();
  cou.position.set(0, 0.12, -0.78);
  corps.add(cou);

  const ptsCou = [V(0, 0, 0.04), V(0, 0.24, -0.10), V(0, 0.50, -0.20), V(0, 0.74, -0.27)];
  const cheveux = new THREE.Mesh(
    tube(ptsCou, [0.215, 0.165, 0.125, 0.098], ptsCou.map(() => C(0x604832)), seg),
    mat
  );
  cheveux.castShadow = palier.ombres;
  cou.add(cheveux);

  const tete = new THREE.Group();
  tete.position.set(0, 0.74, -0.27);
  cou.add(tete);

  const ptsTete = [V(0, 0, 0), V(0, -0.01, -0.12), V(0, -0.05, -0.26), V(0, -0.08, -0.34)];
  const crane = new THREE.Mesh(
    tube(ptsTete, [0.105, 0.093, 0.062, 0.038], ptsTete.map(() => C(0x6B5138)), seg),
    mat
  );
  crane.castShadow = palier.ombres;
  tete.add(crane);

  // Museau sombre et humide
  const museau = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x1A1410, roughness: 0.45 })
  );
  museau.position.set(0, -0.085, -0.36);
  tete.add(museau);

  // Oreilles : deux palettes largement ecartees, tres reconnaissables
  for (const cote of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5), mat);
    o.scale.set(0.42, 1.0, 0.62);
    o.position.set(cote * 0.085, 0.03, -0.02);
    o.rotation.z = cote * 0.72;
    o.rotation.x = -0.2;
    tete.add(o);
  }

  // Les yeux attrapent la lumiere : deux points suffisent a donner un regard.
  const matOeil = new THREE.MeshStandardMaterial({
    color: 0x120C08, roughness: 0.18, metalness: 0.1,
    emissive: 0x2A1E10, emissiveIntensity: 0.5,
  });
  for (const cote of [-1, 1]) {
    const y = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), matOeil);
    y.position.set(cote * 0.072, -0.012, -0.145);
    tete.add(y);
  }

  const ramure = new THREE.Mesh(bois(rand), mat);
  ramure.position.set(0, 0.05, -0.03);
  ramure.castShadow = palier.ombres;
  tete.add(ramure);

  /* --- la queue ----------------------------------------------------------- */
  const queue = new THREE.Group();
  queue.position.set(0, 0.05, 0.84);
  corps.add(queue);
  const ptsQ = [V(0, 0, 0), V(0, -0.06, 0.09), V(0, -0.14, 0.12)];
  queue.add(new THREE.Mesh(
    tube(ptsQ, [0.055, 0.042, 0.022], [C(0x5E4630), C(0x8C7A5E), C(0xC9BCA0)], 6), mat
  ));

  /* --- les quatre membres -------------------------------------------------
     Chaque membre : une cuisse, un canon, un sabot. Le genou des anterieurs
     plie vers l'arriere, le jarret des posterieurs vers l'avant — inverser
     les deux est l'erreur qui fait immediatement "faux". */
  const membres = [];
  const config = [
    { nom: 'AG', avant: true, cote: -1 },
    { nom: 'AD', avant: true, cote: 1 },
    { nom: 'PG', avant: false, cote: -1 },
    { nom: 'PD', avant: false, cote: 1 },
  ];

  for (const cfg of config) {
    const attache = new THREE.Group();
    const x = cfg.cote * 0.215;
    const z = cfg.avant ? -0.54 : 0.58;
    attache.position.set(x, cfg.avant ? -0.02 : -0.04, z);
    corps.add(attache);

    /* Somme des segments SUPERIEURE a la hauteur d'attache (environ 1,16) :
       il faut garder de la flexion au repos. Des membres trop courts forcent
       la resolution a saturer, et l'animal se retrouve sur des echasses. */
    const L1 = cfg.avant ? 0.62 : 0.66;   // epaule / cuisse
    const L2 = cfg.avant ? 0.58 : 0.56;   // canon

    const haut = new THREE.Group();
    attache.add(haut);
    const gHaut = tube(
      [V(0, 0, 0), V(0, -L1 * 0.5, 0), V(0, -L1, 0)],
      cfg.avant ? [0.125, 0.088, 0.058] : [0.150, 0.100, 0.056],
      [C(0x63492F), C(0x5C452E), C(0x54402A)], seg - 2
    );
    const mHaut = new THREE.Mesh(gHaut, mat);
    mHaut.castShadow = palier.ombres;
    haut.add(mHaut);

    const bas = new THREE.Group();
    bas.position.y = -L1;
    haut.add(bas);
    const gBas = tube(
      [V(0, 0, 0), V(0, -L2 * 0.55, 0), V(0, -L2, 0)],
      [0.054, 0.038, 0.028],
      [C(0x4E3A26), C(0x46341F), C(0x33251A)], seg - 3
    );
    const mBas = new THREE.Mesh(gBas, mat);
    mBas.castShadow = palier.ombres;
    bas.add(mBas);

    const sabot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.030, 0.038, 0.075, 6),
      new THREE.MeshStandardMaterial({ color: 0x14100C, roughness: 0.5 })
    );
    sabot.position.y = -L2 - 0.03;
    bas.add(sabot);

    membres.push({ ...cfg, attache, haut, bas, L1, L2, longueur: L1 + L2 });
  }

  /* Ombre de contact.

     Mesure faite, les sabots se posent a un centimetre du sol : ils ne
     flottent pas. Pourtant l'oeil les voit flotter, parce qu'il manque
     l'assombrissement au point de contact — sur une neige tres claire, la
     seule ombre portee ne suffit pas a poser l'animal. Cette tache sombre
     tres douce le rattache au sol, et elle coute un triangle. */
  const ombre = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 3.4),
    new THREE.MeshBasicMaterial({
      map: tacheDouce(), transparent: true, opacity: 0.34,
      depthWrite: false, color: 0x0A1622, fog: true,
    })
  );
  ombre.rotation.x = -Math.PI / 2;
  ombre.position.y = 0.04;
  ombre.renderOrder = 2;
  racine.add(ombre);

  /* Souffle visible dans le froid — une bouffee de particules devant le
     museau. Discret, mais c'est un detail qui fait dire "il est vivant". */
  const souffle = creerSouffle();
  souffle.position.set(0, -0.09, -0.40);
  tete.add(souffle);

  return {
    racine, corps, cou, tete, queue, membres, materiau: mat, souffle, ombre,
    hauteurGarrot: 1.20,
  };
}

/* Tache radiale douce, dessinee une fois sur un canevas. */
function tacheDouce() {
  const n = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Petit nuage de buee, en points. */
function creerSouffle() {
  const N = 26;
  const pos = new Float32Array(N * 3);
  const vie = new Float32Array(N);
  for (let i = 0; i < N; i++) vie[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: 0xDCE8F4, size: 0.075, transparent: true, opacity: 0.24,
    depthWrite: false, sizeAttenuation: true, blending: THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.userData = { vie, N };
  return pts;
}
