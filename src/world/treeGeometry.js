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

/* Ajoute un etage de branches dans les tableaux fournis.

   Deux ajouts par rapport a un simple cone, et ce sont eux qui font toute la
   difference entre un conifere et un cornet de carton :

   · une PHASE propre a chaque etage. Sans elle, les creux et les bosses du
     bord se superposent verticalement d'un etage a l'autre et l'arbre se
     couvre de cannelures regulieres, tres visibles de loin ;
   · une MODULATION PAR SOMMET, sombre au bord tombant et claire vers la
     pointe. Un etage eclaire d'un seul tenant se lit comme un panneau plat ;
     ce dégradé lui rend son epaisseur sans rien couter au rendu. */
function pousserCone(pos, nor, col, { y0, y1, rayon, segments, rand, dechire, tombant, phase = 0, sombre = 0.58, clair = 1.14 }) {
  const anglePas = (Math.PI * 2) / segments;
  const rayons = [];
  for (let i = 0; i < segments; i++) {
    // Deux frequences : une grosse irregularite et un decoupage plus fin.
    const g = Math.sin(i * 1.7 + phase) * 0.5 + 0.5;
    rayons.push(rayon * (1 - dechire * 0.5 + (rand() * 0.6 + g * 0.4) * dechire));
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

    /* Le bord retombant est dans l'ombre de l'etage du dessus, la pointe
       recoit le ciel. On module donc la teinte de l'instance plutot que de
       poser une couleur absolue : la variation par arbre est preservee. */
    const jitter = 0.94 + rand() * 0.12;
    const kb = sombre * jitter, kc = clair * jitter;
    col.push(kb, kb, kb, kb, kb, kb, kc, kc, kc);
  }
}

/* Concatene des geometries indexees ou non en une seule, sans index. On ne
   garde que position et normale : le materiau du tronc ne consomme rien
   d'autre. */
function fusionnerGeos(geos) {
  let n = 0;
  for (const g of geos) n += g.index ? g.index.count : g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    const gp = g.attributes.position.array;
    const gn = g.attributes.normal.array;
    const idx = g.index ? g.index.array : null;
    if (idx) {
      for (let i = 0; i < idx.length; i++) {
        const k = idx[i] * 3;
        pos[o] = gp[k]; pos[o + 1] = gp[k + 1]; pos[o + 2] = gp[k + 2];
        nor[o] = gn[k]; nor[o + 1] = gn[k + 1]; nor[o + 2] = gn[k + 2];
        o += 3;
      }
    } else {
      pos.set(gp, o); nor.set(gn, o); o += gp.length;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, o), 3));
  g.computeBoundingSphere();
  return g;
}

function versGeometrie(pos, nor, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

export function genererSapin(rand, detail = 6) {
  const segments = Math.max(6, detail * 2);
  const couches = detail >= 6 ? 15 : 10;

  const fPos = [], fNor = [], fCol = [];
  const nPos = [], nNor = [], nCol = [];

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

    pousserCone(fPos, fNor, fCol, {
      y0,
      y1: y0 + hauteurEtage,
      rayon: largeur,
      segments,
      rand,
      dechire: 0.50,          // c'est ce chiffre qui casse l'aspect "cone"
      tombant: 0.22,
      phase: i * 2.39,        // decale chaque etage : pas de cannelures
      // Les etages du bas sont enfouis sous ceux du dessus, donc plus sombres.
      sombre: 0.42 + t * 0.22,
      clair: 0.95 + t * 0.30,
    });

    /* Calotte de neige. Point delicat : elle doit DEPASSER du feuillage,
       sinon elle se retrouve enfermee a l'interieur du cone et on ne la voit
       jamais. Le cone de feuillage se resserre en montant ; on pose donc la
       calotte un peu plus haut ET un peu plus large que le feuillage a cette
       hauteur, de sorte qu'elle affleure en lisere blanc sur chaque etage. */
    if (t < 0.92) {
      const montee = 0.14;                       // fraction de l'etage
      const rayonFeuillageIci = largeur * (1 - montee);
      pousserCone(nPos, nNor, nCol, {
        y0: y0 + hauteurEtage * montee + 0.004,
        y1: y0 + hauteurEtage * 0.80,
        rayon: rayonFeuillageIci * (1.06 + rand() * 0.12),
        segments,
        rand,
        dechire: 0.56,
        tombant: 0.13,
        phase: i * 2.39 + 0.8,
        // La neige aussi s'assombrit au bord, ou elle retombe dans l'ombre.
        sombre: 0.66 + t * 0.14,
        clair: 1.02 + t * 0.12,
      });
    }
  }

  /* LE TRONC, ET SON PIED.

     Trois defauts d'un coup dans la version precedente.

     1. SON DIAMETRE SUIVAIT LA HAUTEUR. Comme la matrice d'instance met la
        meme echelle en x, y et z, un rayon de 0,026 donnait 0,65 m sur un
        arbre de vingt-cinq metres — un tronc d'un metre trente de diametre,
        soit un sequoia. Un epicea de cette taille fait quarante centimetres.
        On ne peut pas corriger dans la geometrie, qui est partagee : c'est la
        matrice d'instance qui doit cesser d'etre uniforme (voir forest.js).
        Ici on se contente de dimensionner pour un arbre moyen.

     2. IL N'AVAIT PAS DE PIED. Un cone qui sort de la neige, sans
        empattement, se lit comme un poteau plante. Un vrai tronc S'EVASE au
        contact du sol, et la neige s'accumule contre lui. On ajoute donc un
        empattement dans le profil — le rayon augmente fortement sur les
        derniers pourcents, ce qui suffit a poser l'arbre au lieu de le
        planter.

     3. IL N'AVAIT QU'UN SEGMENT EN HAUTEUR, donc le shader de vent le
        courbait en ligne droite, comme une tige rigide qui pivote. Quatre
        segments donnent une vraie flexion, ou le pied reste fixe. */
  const seg = Math.max(5, detail);
  const parties = [];
  const profil = [
    [0.000, 0.052],   // empattement, sous la neige et juste au-dessus
    [0.030, 0.032],
    [0.090, 0.026],
    [0.400, 0.019],
    [1.000, 0.009],
  ];
  for (let i = 0; i < profil.length - 1; i++) {
    const [y0, r0] = profil[i];
    const [y1, r1] = profil[i + 1];
    const c = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 2, true);
    c.translate(0, (y0 + y1) / 2, 0);
    parties.push(c);
  }
  const tronc = fusionnerGeos(parties);

  return {
    feuillage: versGeometrie(fPos, fNor, fCol),
    neige: versGeometrie(nPos, nNor, nCol),
    tronc,
  };
}

/* LE FEUILLAGE, ECLAIRE COMME DES AIGUILLES ET NON COMME UNE TOLE.

   Un conifere de nuit occupe le deuxieme plus grand nombre de pixels apres la
   neige, et il etait rendu comme une surface opaque en facettes plates : sur
   une face detournee de la lune, N·L tombe a zero et l'etage entier devient
   un aplat noir. D'ou l'aspect de decoupe en carton, surtout au loin ou les
   facettes se lisent une a une.

   Or une masse d'aiguilles n'est pas une tole. Trois choses la distinguent, et
   toutes les trois sont bon marche :

   · ELLE TRANSMET. La lumiere passe entre les aiguilles et ressort de l'autre
     cote. On ajoute donc un terme qui vit LA OU N·L EST NEGATIF, c'est-a-dire
     precisement la ou le rendu classique donne du noir. C'est ce terme qui
     redonne du volume aux etages a contre-jour.

   · ELLE VOIT LE CIEL PAR LE HAUT. Les branches hautes recoivent le bleu du
     ciel, les basses sont enfouies. Un simple gradient vertical, indexe sur la
     hauteur dans l'arbre, remplace une occlusion ambiante qu'on ne peut pas se
     payer ici.

   · SON BORD S'ALLUME. Sur une silhouette, les aiguilles du contour sont
     traversees par la lumiere et brillent. Comme pour le cerf, le terme
     n'existe que la ou la normale regarde a la fois de cote ET vers la lune :
     sans ce second facteur, tout l'arbre s'allumerait uniformement.

   Le resultat vise n'est pas un arbre plus clair — c'est un arbre dont on lit
   encore la forme quand il n'est pas eclaire de face. */
export function eclairerAiguilles(materiau, { uniforms, transmission = 1 } = {}) {
  const precedent = materiau.onBeforeCompile;
  materiau.onBeforeCompile = (shader) => {
    if (precedent) precedent(shader);
    shader.uniforms.uTransm = { value: transmission };
    shader.uniforms.uLuneCol = uniforms.uLuneCol;
    shader.uniforms.uCielCol = uniforms.uCielCol;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying float vHaut;')
      // `transformed.y` est la hauteur dans l'arbre normalise : zero au pied,
      // un a la cime, quelle que soit la taille de l'instance.
      .replace('#include <project_vertex>', '#include <project_vertex>\n vHaut = clamp(transformed.y, 0.0, 1.0);');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying float vHaut;
        uniform float uTransm;
        uniform vec3 uLuneCol, uCielCol;
      `)
      .replace('#include <opaque_fragment>', `
        #if NUM_DIR_LIGHTS > 0
        {
          vec3 N = normalize(normal);
          vec3 V = normalize(vViewPosition);
          vec3 L = normalize(directionalLights[0].direction);
          float nl = dot(N, L);

          // 1. Transmission : elle ne vit que du cote non eclaire.
          float dos = clamp(-nl, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * uLuneCol * pow(dos, 1.6) * 0.34 * uTransm;

          // 2. Le ciel arrive par le haut ; le pied de l'arbre est enfoui.
          outgoingLight += diffuseColor.rgb * uCielCol * (0.10 + vHaut * 0.30) * 0.42;

          // 3. Le bord des aiguilles s'allume, mais seulement face a la lune.
          float tranche = pow(1.0 - abs(dot(N, V)), 3.0);
          outgoingLight += uLuneCol * tranche * clamp(nl, 0.0, 1.0) * 0.30 * uTransm;
        }
        #endif
        #include <opaque_fragment>
      `);
  };
  const clefPrec = materiau.customProgramCacheKey ? materiau.customProgramCacheKey() : '';
  materiau.customProgramCacheKey = () => clefPrec + '-aiguilles' + transmission;
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
            float largeur = max(length(instanceMatrix[0].xyz), 0.001);
          #else
            vec3 ancre = vec3(0.0);
            float taille = 1.0;
            float largeur = 1.0;
          #endif

          float phase = ancre.x * 0.13 + ancre.z * 0.11;
          // Deux frequences : une houle lente et une vibration plus courte.
          float souffle = sin(uTemps * 0.62 + phase) * 0.72
                        + sin(uTemps * 1.63 + phase * 2.3) * 0.28;

          // La rafale traverse la foret : elle arrive plus tard au loin.
          float rafale = 0.55 + 0.45 * sin(uTemps * 0.21 - ancre.z * 0.012);

          float prise = pow(clamp(transformed.y, 0.0, 1.0), 1.7);

          /* LE BALANCEMENT SE CALCULE EN METRES, PUIS SE CONVERTIT.

             C'etait faux, et de facon spectaculaire. Le deplacement etait
             ajoute a transformed.xz, donc dans le repere NORMALISE du
             modele — puis multiplie par l'echelle horizontale de l'instance.
             Pour un sapin de vingt-cinq metres, cela donnait un balancement
             de pres de vingt metres. La foret entiere ondulait comme des
             algues, et surtout :

             LE FEUILLAGE GLISSAIT HORS DE SON TRONC. Feuillage et tronc
             recevaient des amplitudes differentes (1,0 contre 0,25) et,
             pire, des echelles horizontales differentes. Ils se separaient
             donc de plusieurs metres — le tronc restait planté droit pendant
             que le houppier partait de cote. C'est exactement ce qu'on voyait
             sans le comprendre : des poteaux nus dressés au milieu des
             arbres, que j'avais d'abord pris pour mes propres futs de premier
             plan.

             En divisant par la largeur de l'instance, le deplacement devient
             une vraie distance en metres, identique pour toutes les pieces du
             meme arbre quelle que soit leur epaisseur. L'arbre bouge d'un
             seul tenant, et l'amplitude reglee est enfin celle qu'on obtient. */
          transformed.xz += uVent * souffle * rafale * prise * uAmpVent
                          * taille * 0.030 / largeur;
        }
      `);
  };
  materiau.customProgramCacheKey = () => 'vent' + amplitude;
}
