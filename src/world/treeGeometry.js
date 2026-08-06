/* Fabrication d'un sapin.

   Ce qui fait qu'un conifere est reconnaissable, ce n'est pas le detail des
   aiguilles — a vingt metres et dans la brume, personne ne les voit — c'est
   sa SILHOUETTE. Un cone lisse fait tout de suite "objet 3D" ; il faut que
   le bord soit dechiquete et que les etages se chevauchent irregulierement.

   On empile donc des etages de branches dont le rayon est bruite angle par
   angle, et on pose par-dessus des calottes de neige legerement plus petites.
   Trois geometries en sortent (tronc, feuillage, neige), chacune destinee a
   son propre rendu instancie : trois appels de dessin pour toute la foret.

   Le sapin est normalise — un metre de haut, base a l'origine — et c'est la
   matrice d'instance qui lui donne sa taille reelle. */

import * as THREE from 'three';

/* Ajoute un cone dechiquete dans les tableaux fournis. */
function pousserCone(pos, nor, { y0, y1, rayon, segments, rand, dechire, tombant }) {
  const anglePas = (Math.PI * 2) / segments;
  const rayons = [];
  for (let i = 0; i < segments; i++) {
    rayons.push(rayon * (1 - dechire * 0.5 + rand() * dechire));
  }

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3(0, y1, 0);   // pointe de l'etage
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    const a1 = i * anglePas;
    const a2 = j * anglePas;

    // Les branches retombent : le bord exterieur descend un peu.
    a.set(Math.cos(a1) * rayons[i], y0 - rayons[i] * tombant, Math.sin(a1) * rayons[i]);
    b.set(Math.cos(a2) * rayons[j], y0 - rayons[j] * tombant, Math.sin(a2) * rayons[j]);

    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac).normalize();

    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let k = 0; k < 3; k++) nor.push(n.x, n.y, n.z);
  }
}

function versGeometrie(pos, nor) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

export function genererSapin(rand, detail = 6) {
  const segments = Math.max(6, detail * 2);
  const couches = detail >= 6 ? 15 : 10;

  const fPos = [], fNor = [];
  const nPos = [], nNor = [];

  /* Etages de branches, du plus large en bas au plus serre en haut.
     Ils se chevauchent largement : c'est le recouvrement qui remplit la
     masse. Des etages espaces laissent voir le tronc au travers et l'arbre
     retombe aussitot dans le pictogramme de sapin. */
  const basFeuillage = 0.11 + rand() * 0.05;
  for (let i = 0; i < couches; i++) {
    const t = i / (couches - 1);

    // Profil : le plus large se situe vers le quart bas, pas tout en bas —
    // les branches du pied sont mortes et courtes chez les vrais coniferes.
    const profil = Math.pow(1 - t, 0.72) * (0.55 + 0.45 * Math.min(1, t * 5.5));
    const largeur = profil * 0.30 + 0.012;

    const y0 = basFeuillage + t * (1 - basFeuillage - 0.04);
    const hauteurEtage = 0.30 * (1 - t * 0.40);

    pousserCone(fPos, fNor, {
      y0,
      y1: y0 + hauteurEtage,
      rayon: largeur,
      segments,
      rand,
      dechire: 0.46,          // c'est ce chiffre qui casse l'aspect "cone"
      tombant: 0.20,
    });

    /* Calotte de neige. Point delicat : elle doit DEPASSER du feuillage,
       sinon elle se retrouve enfermee a l'interieur du cone et on ne la voit
       jamais. Le cone de feuillage se resserre en montant ; on pose donc la
       calotte un peu plus haut ET un peu plus large que le feuillage a cette
       hauteur, de sorte qu'elle affleure en lisere blanc sur chaque etage. */
    if (t < 0.92) {
      const montee = 0.14;                       // fraction de l'etage
      const rayonFeuillageIci = largeur * (1 - montee);
      pousserCone(nPos, nNor, {
        y0: y0 + hauteurEtage * montee + 0.004,
        y1: y0 + hauteurEtage * 0.80,
        rayon: rayonFeuillageIci * (1.06 + rand() * 0.12),
        segments,
        rand,
        dechire: 0.52,
        tombant: 0.13,
      });
    }
  }

  /* Tronc : un cone tres fin, visible seulement sous les branches basses. */
  const tronc = new THREE.CylinderGeometry(0.011, 0.026, 1.0, Math.max(4, detail), 1, true);
  tronc.translate(0, 0.5, 0);

  return {
    feuillage: versGeometrie(fPos, fNor),
    neige: versGeometrie(nPos, nNor),
    tronc,
  };
}

/* Le vent, injecte dans n'importe quel materiau instancie.

   Le balancement doit dependre de la position de l'arbre dans le monde,
   sinon toute la foret oscille en choeur — ce qui se remarque immediatement.
   L'amplitude croit avec la hauteur locale : le pied reste fixe, la cime
   travaille. */
export function appliquerVent(materiau, { amplitude = 1, uniforms }) {
  materiau.onBeforeCompile = (shader) => {
    shader.uniforms.uTemps = uniforms.uTemps;
    shader.uniforms.uVent = uniforms.uVent;
    shader.uniforms.uAmpVent = { value: amplitude };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        uniform float uTemps, uAmpVent;
        uniform vec2 uVent;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 ancre = instanceMatrix[3].xyz;
            float taille = length(instanceMatrix[1].xyz);
          #else
            vec3 ancre = vec3(0.0);
            float taille = 1.0;
          #endif

          float phase = ancre.x * 0.13 + ancre.z * 0.11;
          // Deux frequences : une houle lente et une vibration plus courte.
          float souffle = sin(uTemps * 0.62 + phase) * 0.72
                        + sin(uTemps * 1.63 + phase * 2.3) * 0.28;

          // La rafale traverse la foret : elle arrive plus tard au loin.
          float rafale = 0.55 + 0.45 * sin(uTemps * 0.21 - ancre.z * 0.012);

          float prise = pow(clamp(transformed.y, 0.0, 1.0), 1.7);
          transformed.xz += uVent * souffle * rafale * prise * uAmpVent * taille * 0.035;
        }
      `);
  };
  materiau.customProgramCacheKey = () => 'vent' + amplitude;
}
