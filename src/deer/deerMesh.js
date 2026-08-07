/* Le cerf — assemblage.

   La peau est UNE SEULE surface continue, extraite du champ implicite decrit
   dans shape.js, puis liee a un squelette. Elle se deforme donc d'un seul
   tenant : l'epaule se plisse, la hanche roule, l'encolure suit le mouvement
   de la tete. C'est la difference de fond avec les versions precedentes, qui
   empilaient des tubes rigides et laissaient voir chaque jonction.

   La pose de LIAISON a les membres tendus a la verticale. C'est volontaire :
   la cinematique inverse du rig les plie ensuite dans leur vraie attitude.
   Faire l'inverse — modeliser une patte deja pliee — obligerait a compenser
   cette pliure dans toute l'animation, pour aucun gain.

   Restent en geometrie separee, parce que ce sont de vraies pieces rigides
   qui ne gagnent rien a etre fondues dans la peau : les bois, les oreilles,
   les yeux et le mufle. Ils sont accroches a l'os de la tete.
*/

import * as THREE from 'three';
import { grainRond } from '../core/dot.js';
import { anatomie, champ, polygoniser, normalesParGradient, orienterFaces } from './shape.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);

/* Hauteur de l'axe du corps. Tout le reste s'y refere. */
const AXE = 1.00;

/* --------------------------------------------------------------------------
   LE SQUELETTE.

   Chaque os porte un segment (tete → extremite) exprime dans la pose de
   liaison, et une importance. Les deux servent a repartir la peau : un
   sommet appartient d'autant plus a un os qu'il en est proche, ponderee par
   cette importance. Sans elle, le ventre proche d'une epaule se met a suivre
   la patte plutot que le tronc.
   -------------------------------------------------------------------------- */
function squelette() {
  const os = [];
  const O = (nom, parent, tete, bout, importance, portee) =>
    os.push({ nom, parent, tete, bout, importance, portee });

  O('racine', null, V(0, 0, 0), V(0, 0.2, 0), 0, 0);
  O('corps', 'racine', V(0, AXE, 0.80), V(0, AXE - 0.06, -0.62), 3.2, 1.10);
  O('cou', 'corps', V(0, 0.96, -0.66), V(0, 1.38, -0.90), 1.5, 0.50);
  O('tete', 'cou', V(0, 1.40, -0.92), V(0, 1.30, -1.22), 1.5, 0.42);
  O('queue', 'corps', V(0, 1.02, 0.90), V(0, 0.88, 1.02), 0.7, 0.24);

  for (const [suf, sgn] of [['G', 1], ['D', -1]]) {
    /* Anterieurs. L'attache est un pivot sans epaisseur : elle ne recoit
       aucune peau, elle sert seulement de point d'articulation. */
    O('attA' + suf, 'corps', V(sgn * 0.155, 0.80, -0.44), V(sgn * 0.155, 0.80, -0.44), 0, 0);
    O('hautA' + suf, 'attA' + suf, V(sgn * 0.155, 0.80, -0.44), V(sgn * 0.155, 0.38, -0.44), 1.0, 0.34);
    O('basA' + suf, 'hautA' + suf, V(sgn * 0.155, 0.38, -0.44), V(sgn * 0.155, -0.02, -0.44), 1.0, 0.26);

    /* Posterieurs. */
    O('attP' + suf, 'corps', V(sgn * 0.170, 0.80, 0.60), V(sgn * 0.170, 0.80, 0.60), 0, 0);
    O('hautP' + suf, 'attP' + suf, V(sgn * 0.170, 0.80, 0.60), V(sgn * 0.170, 0.36, 0.60), 1.0, 0.38);
    O('basP' + suf, 'hautP' + suf, V(sgn * 0.170, 0.36, 0.60), V(sgn * 0.170, -0.02, 0.60), 1.0, 0.26);
  }
  return os;
}

/* Distance d'un point a un segment. */
function distSegment(px, py, pz, a, b) {
  const ex = b.x - a.x, ey = b.y - a.y, ez = b.z - a.z;
  const qx = px - a.x, qy = py - a.y, qz = pz - a.z;
  const ee = ex * ex + ey * ey + ez * ez;
  let t = ee > 1e-9 ? (qx * ex + qy * ey + qz * ez) / ee : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = qx - ex * t, dy = qy - ey * t, dz = qz - ez * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/* --------------------------------------------------------------------------
   LA ROBE.

   Elle est peinte par position dans la pose de liaison, donc elle suit la
   peau quoi qu'il arrive. Les reperes d'un cerf elaphe, par ordre de
   lisibilite a distance : tache claire de la croupe, ligne dorsale sombre,
   membres presque noirs, ventre creme, encolure foncee.

   Les valeurs sont nettement plus sombres que l'intuition ne le suggere :
   l'eclairement de la scene est calibre pour la neige (albedo ~0,8), et un
   pelage trop clair se fait pousser dans les blancs par la courbe ACES.
   -------------------------------------------------------------------------- */
const ROBE = {
  flanc: C(0x9A7A52), dorsal: C(0x56402A), ventre: C(0xC9B189),
  croupe: C(0xEADCBC), membre: C(0x5E4830), encolure: C(0x685039),
  museau: C(0xB29A74), cuisse: C(0x7C6142),
};

function robeAu(x, y, z, c) {
  c.copy(ROBE.flanc);

  // Ligne dorsale : d'autant plus sombre qu'on est haut sur le dos.
  const hautDos = THREE.MathUtils.clamp((y - AXE) / 0.26, 0, 1);
  c.lerp(ROBE.dorsal, Math.pow(hautDos, 1.4) * 0.85);

  // Ventre creme, sous l'axe du corps et seulement sur le tronc. La borne
  // arriere s'arrete avant le bassin : au-dela, le creme bavait sur la
  // croupe et noyait le miroir dans une meme masse claire.
  if (z > -0.70 && z < 0.52) {
    const bas = THREE.MathUtils.clamp((AXE - 0.05 - y) / 0.24, 0, 1);
    c.lerp(ROBE.ventre, Math.pow(bas, 1.6) * 0.75);
  }

  /* LE MIROIR.

     C'est le repere le plus important de tout l'animal, parce que la camera
     le suit par l'arriere : c'est cette tache-la qu'on regarde pendant les
     trois quarts de la balade.

     La version precedente etendait un creme uniforme sur toute l'arriere-main
     des que z depassait 0,46. Resultat : une croupe plate et sans relief, qui
     virait au vert-de-gris parce qu'un creme neutre eclaire par un ciel bleu
     ne peut rien faire d'autre. Vue de dos — la vue principale — le cerf
     n'etait plus qu'une couverture mouillee.

     Un vrai miroir de cerf elaphe est PETIT et VIF, cerne de poil sombre.
     C'est ce contraste qui le rend lisible a cinquante metres, pas sa
     surface. On le taille donc en ellipsoide autour de la naissance de la
     queue, et on FONCE l'arriere-cuisse tout autour pour qu'il ressorte. */
  const dz = (z - 0.66) / 0.24;
  const dy = (y - (AXE + 0.05)) / 0.24;
  const dx = x / 0.24;
  const d2 = dz * dz + dy * dy + dx * dx * 0.55;
  if (d2 < 2.8) {
    /* Cerne sombre. Il monte en s'eloignant du miroir PUIS REDESCEND : une
       rampe simple, coupee net a sa borne, laissait une arete franche en
       plein milieu de la cuisse — on lisait une couverture posee sur
       l'animal, pas un degrade de poil. Les deux pentes se croisent a la
       meme valeur, donc la teinte est continue partout. */
    const monte = (d2 - 0.55) / 0.75;
    const descend = (2.8 - d2) / 1.50;
    const cerne = THREE.MathUtils.clamp(Math.min(monte, descend), 0, 1);
    c.lerp(ROBE.cuisse, cerne * 0.55);
  }
  if (d2 < 1) {
    c.lerp(ROBE.croupe, Math.pow(1 - d2, 0.55) * 0.96);
  }

  // Encolure et poitrail, nettement plus fonces.
  if (z < -0.58) {
    const k = THREE.MathUtils.clamp((-0.58 - z) / 0.28, 0, 1);
    c.lerp(ROBE.encolure, k * 0.75);
  }

  // Membres : ils s'assombrissent en descendant, presque noirs au sabot.
  if (y < 0.80) {
    const k = THREE.MathUtils.clamp((0.80 - y) / 0.55, 0, 1);
    c.lerp(ROBE.membre, Math.pow(k, 0.8) * 0.92);
  }

  // Anneau clair autour du museau.
  if (z < -1.02 && y < 1.42) {
    const k = THREE.MathUtils.clamp((-1.02 - z) / 0.16, 0, 1);
    c.lerp(ROBE.museau, k * 0.7);
  }
  return c;
}

/* --------------------------------------------------------------------------
   Les bois — geometrie rigide, accrochee a l'os de la tete.
   -------------------------------------------------------------------------- */
function boisGeo(rand) {
  const pos = [], nor = [], col = [];
  const teinte = C(0x7A6647);
  const tmp = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const haut = V(0, 1, 0);

  function branche(depart, direction, longueur, rayon, profondeur) {
    const pas = 5, seg = 6;
    const pts = [], rs = [];
    const p = depart.clone();
    const d = direction.clone().normalize();
    const courbe = V((rand() - 0.5) * 0.26, 0.32, -0.22).multiplyScalar(0.17);
    for (let i = 0; i <= pas; i++) {
      pts.push(p.clone());
      rs.push(rayon * (1 - (i / pas) * 0.66));
      p.addScaledVector(d, longueur / pas);
      d.add(courbe).normalize();
    }

    for (let i = 0; i < pas; i++) {
      const A = pts[i], B = pts[i + 1];
      tmp.subVectors(B, A).normalize();
      bin.crossVectors(haut, tmp);
      if (bin.lengthSq() < 1e-6) bin.set(1, 0, 0);
      bin.normalize();
      nrm.crossVectors(tmp, bin).normalize();

      for (let j = 0; j < seg; j++) {
        const a1 = (j / seg) * Math.PI * 2, a2 = ((j + 1) / seg) * Math.PI * 2;
        const q = [
          [a1, A, rs[i]], [a2, A, rs[i]], [a2, B, rs[i + 1]], [a1, B, rs[i + 1]],
        ].map(([ang, pt, r]) => ({
          x: pt.x + bin.x * Math.cos(ang) * r + nrm.x * Math.sin(ang) * r,
          y: pt.y + bin.y * Math.cos(ang) * r + nrm.y * Math.sin(ang) * r,
          z: pt.z + bin.z * Math.cos(ang) * r + nrm.z * Math.sin(ang) * r,
          ca: Math.cos(ang), sa: Math.sin(ang),
        }));
        for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) {
          for (const k of [i0, i1, i2]) {
            const v = q[k];
            pos.push(v.x, v.y, v.z);
            const nx = bin.x * v.ca + nrm.x * v.sa;
            const ny = bin.y * v.ca + nrm.y * v.sa;
            const nz = bin.z * v.ca + nrm.z * v.sa;
            const l = Math.hypot(nx, ny, nz) || 1;
            nor.push(nx / l, ny / l, nz / l);
            col.push(teinte.r, teinte.g, teinte.b);
          }
        }
      }
    }

    if (profondeur > 0) {
      const nb = profondeur === 2 ? 3 : 2;
      for (let k = 0; k < nb; k++) {
        const t = 0.20 + k * 0.27;
        const base = pts[Math.min(pas, Math.round(t * pas))].clone();
        const dir = d.clone();
        dir.x += (rand() - 0.5) * 1.1;
        dir.z -= 0.5 + rand() * 0.7;          // les andouillers pointent devant
        dir.y += 0.9 + rand() * 0.5;
        branche(base, dir, longueur * (0.42 + rand() * 0.20), rayon * 0.62, profondeur - 1);
      }
    }
  }

  /* LA RAMURE.

     Elle etait beaucoup trop chetive : un merrain de trois centimetres de
     rayon sur cinquante de long, ce qui donne de loin deux brindilles. Or la
     ramure est ce qui identifie l'animal en une fraction de seconde, et c'est
     aussi le seul element qui depasse de sa silhouette — sur une capture de
     nuit, c'est souvent tout ce qu'on distingue.

     Un dix-cors porte des merrains longs de quatre-vingts centimetres, epais
     comme un poignet a la base, qui partent EN ARRIERE avant de se relever.
     C'est ce depart vers l'arriere qui fait la lyre caracteristique ; partir
     vers le haut donne une fourche de chevreuil. */
  for (const cote of [-1, 1]) {
    branche(V(cote * 0.068, 0.02, 0.00), V(cote * 0.34, 0.80, 0.50), 0.80, 0.052, 2);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
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
   Le pelage.

   Volontairement sobre : une teinte portee par les couleurs de sommets, une
   forte rugosite, et un grain fin calcule dans le repere de liaison pour
   qu'il ne nage pas quand l'animal bouge.

   Pas de liseré de contour. Deux tentatives precedentes en ont produit un
   qui valait 1 sur toute la surface au lieu du seul bord : mesure faite, un
   pelage d'albedo 0,02 rendait exactement la couleur du liseré, effacant
   tout le dessin de la robe. L'eclairage rasant de la scene detache deja
   tres bien l'animal de la neige.
   -------------------------------------------------------------------------- */
function matierePelage() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.97,
    metalness: 0.0,
    vertexColors: true,
    // La fourrure ne renvoie pas le ciel comme de la glace : sans cette
    // reduction, la carte d'environnement delave la robe.
    envMapIntensity: 0.18,
    /* L'orientation des faces est remise d'equerre a la generation (voir
       orienterFaces), donc le rendu simple face suffit et reste le plus
       propre. Sans cette passe, la peau se percait de micro-trous laissant
       voir la neige du fond. */
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vLiaison;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vLiaison = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vLiaison;
        float grain(vec3 p){
          return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }
      `)
      .replace('#include <opaque_fragment>', `
        {
          /* Grain de pelage, tres retenu. Une version precedente cumulait
             deux echelles a 0,11 et 0,06 : sur une robe sombre, ca ressortait
             en mouchetis blanc sur tout le corps au lieu d'un velours. */
          float g1 = grain(vLiaison * 34.0);
          outgoingLight *= 0.97 + g1 * 0.05;

          /* LA FOURRURE NE BLEUIT PAS.

             La lune est devant l'animal et la camera le suit par l'arriere :
             tout ce qu'on voit de lui est donc a contre-jour, eclaire par le
             seul ciel, qui est bleu. Un pelage brun sous une lumiere bleue
             devient vert-de-gris — c'est de la colorimetrie, pas un bug, et
             c'est exactement ce que la scene donnait.

             La neige, elle, DOIT bleuir : c'est ce qui fait le froid. On ne
             touche donc pas a l'eclairage, on corrige la reponse de la seule
             fourrure — ce que ferait un etalonneur. La correction est ancree
             sur la luminance : elle rechauffe sans eclaircir, sinon le cerf
             se detacherait du decor comme un decalque.

             Un poil garde toujours un fond roux, meme dans l'ombre : la
             seconde ligne remet ce fond, proportionnellement a ce que la
             lumiere a laisse, donc sans jamais deboucher les noirs. */
          float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
          outgoingLight = mix(outgoingLight, vec3(lum) * vec3(1.30, 0.98, 0.70), 0.42);
          outgoingLight += vec3(0.055, 0.030, 0.014) * lum;

          /* UN PLANCHER, pour qu'il ne tombe pas dans le noir absolu.

             Le terme ci-dessus est proportionnel a la luminance : il rechauffe
             ce qui est deja eclaire et ne peut, par construction, rien faire
             la ou il n'y a pas de lumiere. Or c'est precisement le cas du cerf
             sur la plus grande partie de la balade — lune devant, camera
             derriere. Il finissait en decoupe noire sur la neige, et l'animal
             qu'on est cense suivre n'etait plus qu'une silhouette.

             On ajoute donc un rebond ambiant CONSTANT, mais module par
             l'albedo : le ventre creme se releve, les membres presque noirs
             restent presque noirs. C'est ce qui distingue un plancher
             physique d'un simple eclaircissement — la robe garde tous ses
             contrastes internes, elle cesse seulement d'etre un trou. */
          outgoingLight += diffuseColor.rgb * vec3(0.34, 0.28, 0.21) * 0.19;

          /* LE LISERE DE LUNE.

             La lune est devant l'animal, la camera derriere : le cerf est en
             contre-jour permanent, donc plat, donc illisible. C'est le defaut
             le plus couteux de toute la scene, puisque cette vue-la est celle
             qu'on a sous les yeux pendant les trois quarts de la balade.

             Un contre-jour se traite par un LISERE, pas par du remplissage :
             on rallume la seule tranche de silhouette qui regarde la lumiere.
             Le poil, translucide en bordure, s'embrase la — c'est la plus
             belle chose qu'on puisse faire d'un animal a contre-jour, et
             lighting.js la promettait deja en commentaire sans que rien ne la
             produise.

             Une premiere tentative avait ete retiree, et pour une bonne
             raison : elle ne dependait que de l'angle de VUE. Sur un corps
             rond, (1 - N.V) vaut presque un partout, et l'animal entier
             s'allumait d'une couleur unie — au point qu'une robe forcee au
             noir restait beige. Le facteur qui manquait est celui-ci : il
             faut AUSSI que la normale regarde la lune. Le produit des deux
             ne survit que sur le contour eclaire, ce qui est exactement la
             definition d'un lisere. */
          #if NUM_DIR_LIGHTS > 0
          {
            vec3 N = normalize(normal);
            vec3 V = normalize(vViewPosition);
            vec3 L = normalize(directionalLights[0].direction);
            float tranche = pow(1.0 - abs(dot(N, V)), 3.0);
            float versLune = clamp(dot(N, L), 0.0, 1.0);
            // Reste sous le seuil du halo : le cerf s'ourle, il ne rayonne
            // pas. Un cerf qui bloome serait une lampe, pas un animal.
            outgoingLight += vec3(1.00, 0.78, 0.52) * tranche * versLune * 0.85;
          }
          #endif
        }
        #include <opaque_fragment>
      `);
  };
  mat.customProgramCacheKey = () => 'pelage6';
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

/* ==========================================================================
   ASSEMBLAGE
   ========================================================================== */
export function creerCerf(palier) {
  let a = 99;
  const rand = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  /* --- 1. la peau, extraite du champ ------------------------------------- */
  const caps = anatomie();
  const f = champ(caps, 0.055);
  const pas = palier.nom === 'bas' ? 0.046 : palier.nom === 'moyen' ? 0.036 : 0.029;

  /* La boite doit contenir TOUT le champ, criniere et poitrail compris : un
     volume qui deborde se fait trancher net par le bord de la grille, ce qui
     laisse un trou beant dans la peau. On la prend large — le cout est
     lineaire en volume, mais une troncature est irrattrapable. */
  const boite = new THREE.Box3(V(-0.40, -0.14, -1.38), V(0.40, 1.62, 1.02));
  const { positions, index } = polygoniser(f, boite, pas);
  const normales = normalesParGradient(f, positions, pas);
  const retournes = orienterFaces(positions, index, normales);
  const nSommets = positions.length / 3;

  /* --- 2. couleurs de la robe -------------------------------------------- */
  const couleurs = new Float32Array(nSommets * 3);
  const c = new THREE.Color();
  for (let i = 0; i < nSommets; i++) {
    robeAu(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], c);
    couleurs[i * 3] = c.r; couleurs[i * 3 + 1] = c.g; couleurs[i * 3 + 2] = c.b;
  }

  /* --- 3. repartition de la peau sur les os ------------------------------ */
  const osDef = squelette();
  const pesants = osDef.map((o, i) => ({ ...o, i })).filter((o) => o.importance > 0);

  const skinIndex = new Uint16Array(nSommets * 4);
  const skinWeight = new Float32Array(nSommets * 4);
  const cand = [];

  for (let v = 0; v < nSommets; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    cand.length = 0;
    for (const o of pesants) {
      const d = distSegment(x, y, z, o.tete, o.bout);
      // Au-dela de sa portee, un os ne doit plus rien tirer : sans cette
      // borne, la queue influencerait la tete des que le corps l'y invite.
      if (d > o.portee) continue;
      cand.push([o.i, o.importance / (Math.pow(d, 3) + 1e-4)]);
    }
    if (!cand.length) {
      // Repli : l'os le plus proche, quoi qu'il arrive.
      let meilleur = pesants[0], best = Infinity;
      for (const o of pesants) {
        const d = distSegment(x, y, z, o.tete, o.bout);
        if (d < best) { best = d; meilleur = o; }
      }
      cand.push([meilleur.i, 1]);
    }
    cand.sort((p, q) => q[1] - p[1]);
    let somme = 0;
    const n = Math.min(4, cand.length);
    for (let k = 0; k < n; k++) somme += cand[k][1];
    for (let k = 0; k < n; k++) {
      skinIndex[v * 4 + k] = cand[k][0];
      skinWeight[v * 4 + k] = cand[k][1] / somme;
    }
  }

  /* --- 4. la geometrie --------------------------------------------------- */
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normales, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeBoundingSphere();

  /* --- 5. les os --------------------------------------------------------- */
  const bones = [];
  const parNom = {};
  for (const o of osDef) {
    const b = new THREE.Bone();
    b.name = o.nom;
    const orig = o.parent ? osDef.find((q) => q.nom === o.parent).tete : V(0, 0, 0);
    b.position.copy(o.tete).sub(orig);
    if (o.parent) parNom[o.parent].add(b);
    parNom[o.nom] = b;
    bones.push(b);
  }
  const skeleton = new THREE.Skeleton(bones);

  const mat = matierePelage();
  const peau = new THREE.SkinnedMesh(geo, mat);
  peau.castShadow = palier.ombres;
  peau.receiveShadow = false;
  peau.frustumCulled = false;
  peau.add(bones[0]);
  peau.bind(skeleton);

  /* --- 6. le monde ------------------------------------------------------- */
  const racine = new THREE.Group();
  racine.name = 'cerf';
  racine.add(peau);

  const corps = parNom['corps'];
  const cou = parNom['cou'];
  const tete = parNom['tete'];
  const queue = parNom['queue'];

  /* --- 7. pieces rigides accrochees a la tete ----------------------------
     L'os de la tete est a (0, 1.40, -0.92) dans la pose de liaison ; les
     pieces sont donc exprimees relativement a ce point. */
  /* ATTENTION : ces pieces sont posees a des coordonnees FIXES, alors que la
     tete, elle, est un volume implicite. Elargir le champ de la tete les
     enfouit donc dessous sans que rien ne le signale — c'est exactement ce
     qui s'est produit en epaississant le chanfrein et en ajoutant les joues :
     oreilles et yeux ont purement disparu de la silhouette. Toute retouche du
     volume cranien impose de reverifier ces trois blocs. */
  const rel = (x, y, z) => V(x, y - 1.40, z + 0.92);

  const mufle = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x120E0A, roughness: 0.32 })
  );
  mufle.scale.set(1, 0.86, 0.78);
  mufle.position.copy(rel(0, 1.300, -1.285));
  tete.add(mufle);

  /* Oreilles : grandes et bien ecartees. Chez un cerf elles sont enormes ;
     les faire timides suffit a rendre la tete quelconque.

     Elles sont conservees dans une liste : le rig les fait pivoter, et c'est
     le mouvement d'oreille qui, plus que tout autre detail, distingue un
     animal vivant d'une figurine. Un cervide balaie en permanence — il
     entend derriere lui pendant qu'il regarde devant. */
  const oreilles = [];
  for (const cote of [-1, 1]) {
    const o = new THREE.Mesh(teinter(new THREE.SphereGeometry(0.092, 10, 8), 0x33251A), mat);
    o.scale.set(0.28, 0.98, 0.58);
    o.position.copy(rel(cote * 0.138, 1.462, -0.895));
    o.rotation.z = cote * 0.88;
    o.rotation.x = -0.34;
    o.userData = { cote, reposZ: cote * 0.88, reposX: -0.34 };
    tete.add(o);
    oreilles.push(o);
  }

  const matOeil = new THREE.MeshStandardMaterial({
    color: 0x0C0805, roughness: 0.10, metalness: 0.25,
    emissive: 0x3A2A16, emissiveIntensity: 0.8,
  });
  /* Les yeux sont gardes eux aussi : le rig les ecrase brievement pour
     figurer un clignement. On ne modelise pas de paupiere — a la distance ou
     l'animal est vu, un aplatissement vertical de l'oeil se lit exactement
     comme un clin, pour trois lignes au lieu d'une geometrie de plus. */
  const yeux = [];
  for (const cote of [-1, 1]) {
    const y = new THREE.Mesh(new THREE.SphereGeometry(0.026, 9, 8), matOeil);
    y.position.copy(rel(cote * 0.116, 1.412, -1.042));
    tete.add(y);
    yeux.push(y);
  }

  const ramure = new THREE.Mesh(boisGeo(rand), mat);
  ramure.position.copy(rel(0, 1.478, -0.915));
  ramure.castShadow = palier.ombres;
  tete.add(ramure);

  /* --- 8. ombre de contact ----------------------------------------------- */
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

  /* --- 9. buee des naseaux ----------------------------------------------- */
  const souffle = creerSouffle();
  souffle.position.copy(rel(0, 1.292, -1.345));
  tete.add(souffle);

  /* --- 10. les membres, tels que le rig les attend ------------------------ */
  const membres = [];
  for (const [suf, sgn] of [['G', 1], ['D', -1]]) {
    for (const pre of ['A', 'P']) {
      const haut = parNom[`haut${pre}${suf}`];
      const bas = parNom[`bas${pre}${suf}`];
      membres.push({
        nom: pre + suf,
        avant: pre === 'A',
        cote: sgn,
        attache: parNom[`att${pre}${suf}`],
        haut,
        bas,
        L1: bas.position.length(),
        L2: pre === 'A' ? 0.40 : 0.38,
        longueur: bas.position.length() + (pre === 'A' ? 0.40 : 0.38),
      });
    }
  }

  return {
    racine, peau, corps, cou, tete, queue, membres, oreilles, yeux,
    materiau: mat, souffle, ombre, skeleton,
    hauteurGarrot: AXE,
    infos: { sommets: nSommets, triangles: index.length / 3, pas, retournes },
  };
}

/* Buee des naseaux : quelques points expulses puis emportes vers l'arriere. */
function creerSouffle() {
  const N = 26;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const m = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02,
    color: 0xDCE8F4, size: 0.075, transparent: true, opacity: 0.24,
    depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.userData = { vie: Float32Array.from({ length: N }, () => Math.random()), N };
  return pts;
}
