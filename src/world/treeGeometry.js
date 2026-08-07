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

   Une PHASE propre a chaque etage evite que les creux et les bosses du bord
   se superposent verticalement : sans elle, l'arbre se couvre de cannelures
   regulieres tres visibles de loin. Une MODULATION PAR SOMMET, sombre pres du
   tronc et claire a la pointe, lui rend son epaisseur sans rien couter.
/* POURQUOI L'ARBRE SEMBLAIT PLAT — et pourquoi des plans croises n'y
   auraient rien change.

   Ce n'etait pas une geometrie en 2D : chaque etage etait deja un cone
   complet, ferme sur trois cent soixante degres. Le probleme est ailleurs, et
   il est plus interessant.

   Un etage etait une JUPE CONTINUE : les triangles se touchaient tous, du
   premier au dernier, sans le moindre interstice. Une telle surface, meme
   parfaitement tridimensionnelle, n'offre a l'oeil aucun indice de
   profondeur — on ne voit jamais a travers, on ne voit jamais une branche
   passer DEVANT une autre, et rien ne se detache sur le fond. Le cerveau
   conclut a une decoupe, et il a raison de le faire : il n'a recu aucune
   information contraire.

   Ce qui fait qu'un conifere se lit en volume, ce sont les TROUS. Entre ses
   branches on apercoit le ciel, la neige, le tronc, les branches du cote
   oppose. Ce sont ces occlusions successives, et elles seules, qui
   construisent la profondeur.

   Chaque etage devient donc un ANNEAU DE BRANCHES SEPAREES : chacune part du
   tronc, s'effile, retombe de son propre angle, et laisse un vide avant la
   suivante. Le nombre de triangles ne change quasiment pas — on ne remplit
   plus l'espace entre elles, ce qu'on gagne finance le fait que chaque
   branche soit un quadrilatere plutot qu'un triangle. */
function pousserCone(pos, nor, col, { y0, y1, rayon, segments, rand, dechire, tombant, phase = 0, sombre = 0.58, clair = 1.14, simple = false }) {
  const anglePas = (Math.PI * 2) / segments;

  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const n = new THREE.Vector3();

  const tri = (A, B, C, cA, cB, cC) => {
    e1.subVectors(B, A);
    e2.subVectors(C, A);
    n.crossVectors(e1, e2).normalize();
    pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z);
    for (let k = 0; k < 3; k++) nor.push(n.x, n.y, n.z);
    col.push(cA, cA, cA, cB, cB, cB, cC, cC, cC);
  };

  for (let i = 0; i < segments; i++) {
    const a = i * anglePas + (rand() - 0.5) * anglePas * 0.35;

    // Longueur propre a chaque branche : c'est elle qui dechire la silhouette.
    const g = Math.sin(i * 1.7 + phase) * 0.5 + 0.5;
    const L = rayon * (1 - dechire * 0.5 + (rand() * 0.6 + g * 0.4) * dechire);

    /* LE VIDE ENTRE DEUX BRANCHES — le reglage central, et celui que j'ai
       rate du premier coup.

       A 0,30 de demi-largeur avec un pincement de 0,34, chaque branche ne
       couvrait qu'un cinquieme de son secteur : l'arbre s'est retrouve reduit
       a son tronc entoure de confettis. Il faut viser environ DEUX TIERS de
       couverture — assez de vide pour voir a travers et lire la profondeur,
       assez de matiere pour que la masse existe. */
    const demiLarge = anglePas * 0.46;
    const pincee = 0.82;

    /* LA RETOMBEE DOIT RATTRAPER L'ETAGE DU DESSOUS. Les etages sont espaces
       verticalement ; si la branche ne descend pas au moins jusqu'au suivant,
       il reste une fente horizontale entre chaque rang et on voit le tronc
       par tranches. La chute se calcule donc a partir de l'ESPACEMENT, pas
       seulement de la longueur de la branche. */
    const espace = Math.max(1e-4, (y1 - y0) * 0.42);
    const chute = espace * (1.15 + rand() * 0.75) + L * tombant * 0.5;
    // Chacune est portee un peu plus haut ou plus bas que sa voisine : c'est
    // ce desordre vertical qui fait lire un etage epais et non un disque.
    const dy = (rand() - 0.5) * espace * 0.55;

    const ca = Math.cos(a), sa = Math.sin(a);
    const cg = Math.cos(a - demiLarge), sg = Math.sin(a - demiLarge);
    const cd = Math.cos(a + demiLarge), sd = Math.sin(a + demiLarge);

    // Base : deux points au ras du tronc, largeur pleine.
    const rBase = rayon * 0.14;
    p0.set(cg * rBase, y0 + dy, sg * rBase);
    p1.set(cd * rBase, y0 + dy, sd * rBase);
    // Pointe : la branche s'effile un peu, sans se refermer.
    p2.set(
      (ca + (cd - ca) * pincee) * L,
      y0 + dy - chute,
      (sa + (sd - sa) * pincee) * L
    );
    p3.set(
      (ca + (cg - ca) * pincee) * L,
      y0 + dy - chute,
      (sa + (sg - sa) * pincee) * L
    );

    /* Le bord retombant est dans l'ombre de l'etage du dessus, la base recoit
       moins de ciel que la pointe. On module donc la teinte de l'instance
       plutot que de poser une couleur absolue : la variation par arbre est
       preservee. */
    const jitter = 0.90 + rand() * 0.20;
    const kb = sombre * jitter;      // pres du tronc, enfoui
    const kc = clair * jitter;       // la pointe, exposee

    tri(p0, p1, p2, kb, kb, kc);
    tri(p0, p2, p3, kb, kc, kc);

    /* LA POINTE SE REDRESSE. Le bout d'une branche d'epicea remonte, et ce
       petit crochet est ce qui empeche l'etage de se lire comme un disque
       pose a plat : il fait accrocher la lumiere a une orientation
       differente du reste de la branche. Un triangle par branche. */
    if (!simple) {
      const bout = new THREE.Vector3(
        ca * L * 1.10, y0 + dy - chute + chute * 0.50, sa * L * 1.10
      );
      tri(p2, bout, p3, kc, clair * jitter * 1.10, kc);
    }
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

/* `simple` : version pour le lointain. Les branches separees coutent trois
   triangles chacune au lieu d'un — c'est ce qui leur donne leur volume, et
   c'est aussi ce qui a fait passer la scene de 395 000 a 875 000 triangles
   quand je les ai introduites. Or ce volume ne sert a rien au-dela de
   cinquante metres : a cette distance un arbre fait trente pixels, on ne
   distingue plus une branche d'une autre, et seule la silhouette compte.

   La version simple retire donc le relevement de pointe (un triangle sur
   trois) et divise le nombre d'etages. Elle garde exactement la meme
   enveloppe, donc la bascule reste invisible. */
export function genererSapin(rand, detail = 6, simple = false) {
  /* Chaque branche coute maintenant trois triangles au lieu d'un, mais on
     ne remplit plus les vides : a nombre de secteurs egal, l'etage est un peu
     plus lourd. On en retire donc quelques-uns — l'irregularite fait
     desormais le travail que faisait le nombre. */
  const segments = Math.max(4, Math.round(detail * (simple ? 1.1 : 1.4)));
  const couches = simple ? 6 : (detail >= 6 ? 14 : 10);

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
      simple,
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
        /* LA NEIGE SE POSE SUR LA BRANCHE, PAS AUTOUR.

           Elle etait dessinee 6 a 18 % PLUS LARGE que le feuillage — ce qui
           marchait tant que les etages etaient des jupes pleines, puisqu'elle
           n'affleurait qu'en lisere. Maintenant que ce sont des branches
           separees, la meme marge la fait deborder de chaque branche et
           recouvrir tout l'arbre : les sapins viraient au blanc et le vert
           disparaissait. Elle rentre donc a l'interieur, et ce sont les
           POINTES qui restent vertes — comme sur un vrai conifere charge. */
        rayon: rayonFeuillageIci * (0.80 + rand() * 0.10),
        segments,
        rand,
        dechire: 0.56,
        tombant: 0.13,
        simple,
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
