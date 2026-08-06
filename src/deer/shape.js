/* La forme du cerf — surface implicite.

   POURQUOI CHANGER DE METHODE.

   Les versions precedentes assemblaient des tubes rigides : un torse, une
   encolure, quatre membres, chacun son volume. Le probleme n'etait pas le
   soin apporte a chaque piece, il etait STRUCTUREL — la ou deux tubes se
   rencontrent, on voit deux tubes qui se rencontrent. Aucune epaule, aucune
   hanche, aucune attache d'encolure ne peut exister quand la geometrie est
   faite de morceaux qui s'interpenetrent. On peut raffiner indefiniment
   chaque morceau, l'animal reste un assemblage.

   La methode retenue ici produit UNE SEULE PEAU CONTINUE :

   1. on decrit l'animal par des capsules (des segments epais) — la ou
      seraient ses os et ses masses musculaires ;
   2. on en fait un champ scalaire, en fusionnant les capsules par un
      minimum ADOUCI. C'est cette fusion qui cree les vraies transitions :
      l'epaule nait du recouvrement entre le membre et le tronc, elle n'est
      pas modelisee ;
   3. on extrait la surface de niveau zero de ce champ par marching
      tetrahedra, ce qui donne un maillage unique et ferme ;
   4. les normales viennent du GRADIENT du champ, pas des faces. Elles sont
      donc exactes et parfaitement lisses, sans aucune soudure a faire.

   On prefere les tetraedres aux cubes parce que le cas d'un tetraedre se
   traite en seize possibilites triviales, la ou le cube en demande deux cent
   cinquante-six tabulees a la main — autant d'occasions de faute de frappe
   invisible.
*/

import * as THREE from 'three';

/* --------------------------------------------------------------------------
   Minimum adouci. C'est la piece maitresse : c'est lui qui soude les volumes
   au lieu de les empiler. `k` regle la largeur du raccord — trop grand, tout
   fond en un seul boudin ; trop petit, on retrouve des aretes vives.
   -------------------------------------------------------------------------- */
function minDoux(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/* Distance a un segment epais, avec etirement anisotrope facultatif : le
   tronc d'un cerf est nettement plus haut que large, et une capsule ronde ne
   peut pas le rendre. */
function capsule(px, py, pz, c) {
  const sx = c.sx || 1, sy = c.sy || 1, sz = c.sz || 1;
  const ax = c.ax / sx, ay = c.ay / sy, az = c.az / sz;
  const bx = c.bx / sx, by = c.by / sy, bz = c.bz / sz;
  const qx = px / sx - ax, qy = py / sy - ay, qz = pz / sz - az;
  const ex = bx - ax, ey = by - ay, ez = bz - az;

  const ee = ex * ex + ey * ey + ez * ez;
  let t = ee > 1e-9 ? (qx * ex + qy * ey + qz * ez) / ee : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;

  const dx = qx - ex * t, dy = qy - ey * t, dz = qz - ez * t;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // Rayon interpole : la capsule s'effile d'un bout a l'autre.
  return d - (c.ra + (c.rb - c.ra) * t);
}

/* --------------------------------------------------------------------------
   L'ANATOMIE.

   Tout le cerf tient dans cette liste. Les reperes sont ceux d'un cerf
   elaphe adulte : environ 1,30 m au garrot, 1,80 m du poitrail a la croupe,
   l'origine au sol entre les sabots, le museau vers -Z.

   Les capsules du tronc sont etirees en hauteur (sy > 1) : c'est ce rapport,
   et non le rayon, qui donne la silhouette d'un cervide plutot que celle
   d'un tonneau.
   -------------------------------------------------------------------------- */
export function anatomie() {
  const c = [];
  const C = (ax, ay, az, bx, by, bz, ra, rb, opt) =>
    c.push({ ax, ay, az, bx, by, bz, ra, rb, ...(opt || {}) });

  /* --- tronc : une chaine, du bassin au poitrail ------------------------- */
  const tronc = { sy: 1.24, groupe: 'tronc' };
  C(0, 1.00, 0.86, 0, 1.03, 0.66, 0.135, 0.205, tronc);   // bassin
  C(0, 1.03, 0.66, 0, 1.00, 0.40, 0.205, 0.200, tronc);   // croupe
  C(0, 1.00, 0.40, 0, 0.98, 0.08, 0.200, 0.198, tronc);   // rein
  C(0, 0.98, 0.08, 0, 1.00, -0.26, 0.198, 0.212, tronc);  // dos
  C(0, 1.00, -0.26, 0, 0.97, -0.54, 0.212, 0.190, tronc); // garrot / poitrail
  C(0, 0.97, -0.54, 0, 0.90, -0.78, 0.190, 0.120, tronc); // avant-poitrail

  /* Les masses musculaires : ce sont elles qui donnent le galbe. Sans la
     cuisse et l'epaule, le tronc est un cylindre et les membres y sont
     plantes comme des piquets. */
  C(0.10, 0.98, 0.60, 0.155, 0.72, 0.60, 0.185, 0.105, { sx: 0.78, groupe: 'cuisseG' });
  C(-0.10, 0.98, 0.60, -0.155, 0.72, 0.60, 0.185, 0.105, { sx: 0.78, groupe: 'cuisseD' });
  C(0.09, 1.00, -0.34, 0.145, 0.76, -0.42, 0.155, 0.095, { sx: 0.80, groupe: 'epauleG' });
  C(-0.09, 1.00, -0.34, -0.145, 0.76, -0.42, 0.155, 0.095, { sx: 0.80, groupe: 'epauleD' });

  /* --- encolure : epaisse a la base, portee en oblique -------------------- */
  C(0, 0.96, -0.66, 0, 1.16, -0.80, 0.175, 0.150, { sy: 1.10, groupe: 'cou0' });
  C(0, 1.16, -0.80, 0, 1.38, -0.90, 0.150, 0.115, { sy: 1.08, groupe: 'cou1' });

  /* --- tete : un coin allonge, front large, chanfrein qui s'affine -------- */
  C(0, 1.40, -0.92, 0, 1.36, -1.04, 0.108, 0.082, { groupe: 'tete' });
  C(0, 1.36, -1.04, 0, 1.30, -1.20, 0.082, 0.048, { groupe: 'tete' });

  /* --- membres anterieurs ------------------------------------------------- */
  for (const s of [1, -1]) {
    const g = s > 0 ? 'G' : 'D';
    C(s * 0.155, 0.78, -0.44, s * 0.165, 0.46, -0.40, 0.098, 0.052, { groupe: 'brasA' + g });
    C(s * 0.165, 0.46, -0.40, s * 0.168, 0.13, -0.43, 0.048, 0.030, { groupe: 'canonA' + g });
    C(s * 0.168, 0.13, -0.43, s * 0.168, 0.02, -0.41, 0.030, 0.026, { groupe: 'piedA' + g });
  }

  /* --- membres posterieurs ------------------------------------------------ */
  for (const s of [1, -1]) {
    const g = s > 0 ? 'G' : 'D';
    C(s * 0.165, 0.74, 0.58, s * 0.175, 0.44, 0.66, 0.110, 0.055, { groupe: 'brasP' + g });
    C(s * 0.175, 0.44, 0.66, s * 0.178, 0.14, 0.54, 0.050, 0.030, { groupe: 'canonP' + g });
    C(s * 0.178, 0.14, 0.54, s * 0.178, 0.02, 0.56, 0.030, 0.026, { groupe: 'piedP' + g });
  }

  /* --- queue --------------------------------------------------------------- */
  C(0, 1.02, 0.90, 0, 0.88, 1.00, 0.048, 0.020, { groupe: 'queue' });

  return c;
}

/* Champ scalaire de l'animal : negatif dedans, positif dehors. */
export function champ(caps, k) {
  return function (x, y, z) {
    let d = 1e9;
    for (let i = 0; i < caps.length; i++) {
      const di = capsule(x, y, z, caps[i]);
      d = i === 0 ? di : minDoux(d, di, k);
    }
    return d;
  };
}

/* --------------------------------------------------------------------------
   MARCHING TETRAHEDRA.

   Le cube elementaire est decoupe en six tetraedres autour de la diagonale
   0-6. Chaque tetraedre n'a que seize configurations, toutes reductibles a
   "un sommet d'un cote" ou "deux sommets de chaque cote" : le code tient en
   quelques lignes, sans table de deux cent cinquante-six entrees a saisir
   sans faute.

   Les sommets produits vivent sur les aretes de la grille. On les identifie
   par le couple de coins qu'ils relient, ce qui les fait PARTAGER
   automatiquement entre tetraedres voisins : le maillage sort deja soude,
   sans passe de fusion.
   -------------------------------------------------------------------------- */
const TETS = [
  [0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
  [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6],
];
// Decalages des huit coins d'une cellule, dans l'ordre binaire (x, y, z).
const COINS = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

export function polygoniser(f, boite, pas) {
  const nx = Math.ceil((boite.max.x - boite.min.x) / pas) + 1;
  const ny = Math.ceil((boite.max.y - boite.min.y) / pas) + 1;
  const nz = Math.ceil((boite.max.z - boite.min.z) / pas) + 1;

  /* Le champ est evalue une fois par noeud de grille et memorise : chaque
     noeud sert a six tetraedres, et l'evaluation est la partie couteuse. */
  const val = new Float32Array(nx * ny * nz);
  const idx = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) {
    const z = boite.min.z + k * pas;
    for (let j = 0; j < ny; j++) {
      const y = boite.min.y + j * pas;
      for (let i = 0; i < nx; i++) {
        val[idx(i, j, k)] = f(boite.min.x + i * pas, y, z);
      }
    }
  }

  const pos = [];
  const tris = [];
  const cache = new Map();

  const cx = new Int32Array(8), cy = new Int32Array(8), cz = new Int32Array(8);
  const cv = new Float32Array(8);

  /* Sommet sur l'arete reliant deux coins : interpolation lineaire du champ.
     La cle du cache est le couple ordonne des deux indices de noeud. */
  function surArete(a, b) {
    const ia = idx(cx[a], cy[a], cz[a]);
    const ib = idx(cx[b], cy[b], cz[b]);
    const cle = ia < ib ? ia * val.length + ib : ib * val.length + ia;
    const vu = cache.get(cle);
    if (vu !== undefined) return vu;

    const va = cv[a], vb = cv[b];
    let t = (0 - va) / (vb - va);
    if (!isFinite(t)) t = 0.5;
    t = t < 0 ? 0 : t > 1 ? 1 : t;

    const n = pos.length / 3;
    pos.push(
      (boite.min.x + cx[a] * pas) + ((cx[b] - cx[a]) * pas) * t,
      (boite.min.y + cy[a] * pas) + ((cy[b] - cy[a]) * pas) * t,
      (boite.min.z + cz[a] * pas) + ((cz[b] - cz[a]) * pas) * t
    );
    cache.set(cle, n);
    return n;
  }

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        // Rejet rapide : si les huit coins sont du meme cote, rien a extraire.
        let dedans = 0;
        for (let c = 0; c < 8; c++) {
          const o = COINS[c];
          cx[c] = i + o[0]; cy[c] = j + o[1]; cz[c] = k + o[2];
          cv[c] = val[idx(cx[c], cy[c], cz[c])];
          if (cv[c] < 0) dedans++;
        }
        if (dedans === 0 || dedans === 8) continue;

        for (const T of TETS) {
          const [a, b, c, d] = T;
          const m = (cv[a] < 0 ? 1 : 0) | (cv[b] < 0 ? 2 : 0)
                  | (cv[c] < 0 ? 4 : 0) | (cv[d] < 0 ? 8 : 0);
          if (m === 0 || m === 15) continue;

          // Les seize cas se ramenent a trois familles.
          switch (m) {
            case 1: case 14: {
              const t = [surArete(a, b), surArete(a, c), surArete(a, d)];
              tris.push(m === 1 ? t : [t[0], t[2], t[1]]);
              break;
            }
            case 2: case 13: {
              const t = [surArete(b, a), surArete(b, d), surArete(b, c)];
              tris.push(m === 2 ? t : [t[0], t[2], t[1]]);
              break;
            }
            case 4: case 11: {
              const t = [surArete(c, a), surArete(c, b), surArete(c, d)];
              tris.push(m === 4 ? t : [t[0], t[2], t[1]]);
              break;
            }
            case 8: case 7: {
              const t = [surArete(d, a), surArete(d, c), surArete(d, b)];
              tris.push(m === 8 ? t : [t[0], t[2], t[1]]);
              break;
            }
            case 3: case 12: {
              const q = [surArete(a, c), surArete(a, d), surArete(b, d), surArete(b, c)];
              if (m === 3) { tris.push([q[0], q[1], q[2]]); tris.push([q[0], q[2], q[3]]); }
              else { tris.push([q[0], q[2], q[1]]); tris.push([q[0], q[3], q[2]]); }
              break;
            }
            case 5: case 10: {
              const q = [surArete(a, b), surArete(a, d), surArete(c, d), surArete(c, b)];
              if (m === 5) { tris.push([q[0], q[1], q[2]]); tris.push([q[0], q[2], q[3]]); }
              else { tris.push([q[0], q[2], q[1]]); tris.push([q[0], q[3], q[2]]); }
              break;
            }
            case 9: case 6: {
              const q = [surArete(a, b), surArete(a, c), surArete(d, c), surArete(d, b)];
              if (m === 9) { tris.push([q[0], q[1], q[2]]); tris.push([q[0], q[2], q[3]]); }
              else { tris.push([q[0], q[2], q[1]]); tris.push([q[0], q[3], q[2]]); }
              break;
            }
          }
        }
      }
    }
  }

  const index = new Uint32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) {
    index[i * 3] = tris[i][0];
    index[i * 3 + 1] = tris[i][1];
    index[i * 3 + 2] = tris[i][2];
  }

  return { positions: new Float32Array(pos), index, nx, ny, nz };
}

/* Remet toutes les faces dans le meme sens.

   L'extraction par tetraedres ne garantit pas une orientation coherente :
   selon la configuration rencontree, certains triangles sortent retournes.
   Les consequences sont tres visibles — en simple face ils sont elimines et
   percent la peau de micro-trous par lesquels on voit le decor ; en double
   face ils sont eclaires a l'envers et mouchettent l'animal.

   On dispose pourtant d'une reference fiable : le gradient du champ pointe
   toujours vers l'exterieur. Il suffit de comparer la normale geometrique de
   chaque face a ce gradient, et d'echanger deux sommets quand elles
   s'opposent. */
export function orienterFaces(positions, index, normales) {
  let retournes = 0;
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const ux = positions[b * 3] - ax, uy = positions[b * 3 + 1] - ay, uz = positions[b * 3 + 2] - az;
    const vx = positions[c * 3] - ax, vy = positions[c * 3 + 1] - ay, vz = positions[c * 3 + 2] - az;

    // normale geometrique de la face
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;

    // normale de reference : moyenne des gradients aux trois sommets
    const gx = normales[a * 3] + normales[b * 3] + normales[c * 3];
    const gy = normales[a * 3 + 1] + normales[b * 3 + 1] + normales[c * 3 + 1];
    const gz = normales[a * 3 + 2] + normales[b * 3 + 2] + normales[c * 3 + 2];

    if (nx * gx + ny * gy + nz * gz < 0) {
      index[t + 1] = c; index[t + 2] = b;
      retournes++;
    }
  }
  return retournes;
}

/* Normales par gradient du champ : exactes et lisses par construction, sans
   avoir a moyenner les faces ni a souder quoi que ce soit. */
export function normalesParGradient(f, positions, pas) {
  const n = positions.length / 3;
  const nor = new Float32Array(n * 3);
  const e = pas * 0.6;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    let gx = f(x + e, y, z) - f(x - e, y, z);
    let gy = f(x, y + e, z) - f(x, y - e, z);
    let gz = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    nor[i * 3] = gx / l; nor[i * 3 + 1] = gy / l; nor[i * 3 + 2] = gz / l;
  }
  return nor;
}
