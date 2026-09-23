/* Le post-traitement.

   Jusqu'ici la scene partait directement a l'ecran, tonemappee par le
   materiau. C'est correct, mais ca reste une image de moteur : nette partout,
   sans halo autour des sources, sans grain, sans coins qui s'assombrissent.
   Les quelques operations ci-dessous sont exactement celles qui separent une
   image de rendu d'une image de film.

   CHAINE. La scene est d'abord dessinee dans une cible flottante, donc SANS
   ecretage : une fenetre allumee ou une lueur de cadeau peut y valoir cinq
   fois le blanc. C'est la condition pour que le halo ait quelque chose a
   diffuser — sur une image deja ramenee a [0,1], un bloom ne fait que baver
   du gris.

   0. FLOU DE LA SCENE ENTIERE, en demi-resolution, pour la profondeur de
      champ ;
   1. EXTRACTION des hautes lumieres, en demi-resolution ;
   2. FLOU separable, deux passes croisees repetees deux fois — un flou large
      coute cher en une seule passe et se voit en croix ;
   3. COMPOSITION : halo ajoute, exposition, courbe ACES, aberration
      chromatique tres legere sur les bords, vignettage, grain.

   L'ordre compte. Le halo s'ajoute AVANT la courbe de tonalite, sinon il
   sature au lieu de se fondre. Le grain vient APRES, sinon la courbe l'ecrase
   dans les ombres, la ou il est justement le plus utile.

   PROFONDEUR DE CHAMP. C'est elle, plus que tout le reste, qui fait lire
   l'image comme prise par un appareil plutot que calculee : l'oeil accepte
   qu'un tronc passe flou au premier plan, et cette acceptation vaut
   reconnaissance d'un objectif. La mise au point suit le cerf en permanence,
   puisque c'est lui le sujet.

   Elle reste VOLONTAIREMENT DISCRETE. Un flou marque transforme la foret en
   maquette : au-dela d'un certain rayon, le cerveau lit une miniature filmee
   de pres et non un paysage. On garde donc une large zone nette et un flou
   plafonne.
*/

import * as THREE from 'three';
import { damp } from './noise.js';

// Temporaires de `reglerRais`, hors de la boucle : une projection par image.
const _avant = new THREE.Vector3();
const _pt = new THREE.Vector3();

/* Un seul triangle couvrant l'ecran : moins de sommets qu'un quad, et pas de
   couture diagonale au milieu de l'image. */
function trianglePlein() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(
    [-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/* --- extraction des hautes lumieres -------------------------------------- */
const FRAG_HAUT = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uSrc;
  uniform float uSeuil, uDouceur;
  void main(){
    vec3 c = texture2D(uSrc, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // Seuil adouci : une coupure franche fait clignoter les bords des
    // sources des qu'elles bougent d'un pixel.
    float k = smoothstep(uSeuil, uSeuil + uDouceur, l);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

/* --- flou gaussien separable --------------------------------------------- */
const FRAG_FLOU = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uSrc;
  uniform vec2 uPas;              // direction et amplitude, en UV
  void main(){
    vec3 s = texture2D(uSrc, vUv).rgb * 0.2270270270;
    s += texture2D(uSrc, vUv + uPas * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(uSrc, vUv - uPas * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(uSrc, vUv + uPas * 3.2307692308).rgb * 0.0702702703;
    s += texture2D(uSrc, vUv - uPas * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(s, 1.0);
  }
`;

/* --- rais de lumiere : 1. ce qui reste du ciel ---------------------------- */
/* On ne garde que LE CIEL, et noir partout ailleurs. C'est cette image-la
   qu'on etire ensuite depuis la lune : la ou un tronc se tient, la trainee
   s'interrompt, et c'est precisement cette interruption qui fait lire un
   rayon plutot qu'un halo.

   Le ciel se reconnait au tampon de profondeur : le dome n'y ecrit pas
   (`depthWrite: false` dans sky.js), donc ses pixels gardent la valeur
   d'effacement, exactement 1. Aucun autre objet ne peut valoir 1 — la
   camera a un plan lointain fini. Le test est donc exact, pas approche. */
const FRAG_CIEL = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uSrc, uProfondeur;
  uniform float uSeuil;
  void main(){
    float d = texture2D(uProfondeur, vUv).x;
    vec3 c = texture2D(uSrc, vUv).rgb;
    /* Seules les VRAIES sources tirent un rayon. Sans ce seuil, tout le
       degrade du ciel participe et on obtient un voile uniforme au lieu de
       faisceaux : c'est la lune et la lueur d'horizon qu'on veut etirer, pas
       le bleu de fond. */
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float garde = step(0.9999, d) * smoothstep(uSeuil, uSeuil * 2.2, l);
    gl_FragColor = vec4(c * garde, 1.0);
  }
`;

/* --- rais de lumiere : 2. l'etirement depuis la lune ---------------------- */
/* Un flou RADIAL, pas gaussien : chaque pixel remonte vers la lune en
   accumulant ce qu'il croise, avec une extinction geometrique. C'est la
   methode de rendu des « god rays » en espace ecran — elle ne connait
   evidemment rien a la vraie diffusion atmospherique, mais elle produit
   exactement ce que l'oeil attend : des faisceaux qui partent d'un point,
   se decoupent sur les troncs et se dissolvent en s'eloignant.

   Le nombre d'echantillons est fige a la COMPILATION (une boucle GLSL ES
   ne peut pas s'arreter sur une variable), d'ou la fabrication du source
   par fonction plutot qu'une constante unique. */
const fragRais = (n) => /* glsl */ `
  #define N ${n}
  varying vec2 vUv;
  uniform sampler2D uSrc;
  uniform vec2 uLumiere;          // position de la lune, en UV d'ecran
  uniform float uDensite, uExtinction, uPoids;
  void main(){
    vec2 uv = vUv;
    vec2 pas = (vUv - uLumiere) * (uDensite / float(N));
    float att = 1.0;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < N; i++) {
      uv -= pas;
      acc += texture2D(uSrc, clamp(uv, 0.0, 1.0)).rgb * att;
      att *= uExtinction;
    }
    gl_FragColor = vec4(acc * uPoids, 1.0);
  }
`;

/* --- composition finale --------------------------------------------------- */
const FRAG_FINAL = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uScene, uHalo, uFlou, uProfondeur, uRais;
  uniform float uExpo, uHaloForce, uVignette, uGrain, uAberr, uTemps;
  uniform float uNear, uFar, uFocus, uNet, uPlage, uDof;
  uniform vec3 uTeinte;
  uniform float uTeinteForce;
  uniform float uRaisForce;
  uniform vec3 uGrOmbres, uGrHautes;
  uniform float uGrContraste, uGrSature, uGrForce;

  /* Le tampon de profondeur n'est pas lineaire : la precision est concentree
     pres de la camera. Il faut le redresser pour raisonner en metres. */
  float distanceReelle(float d){
    float z = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  /* Courbe ACES, version approchee de Narkowicz. Elle tient les hautes
     lumieres sans virer au gris comme un simple Reinhard, et c'est elle qui
     garde la neige blanche sans la cramer. */
  vec3 aces(vec3 x){
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  /* UN HASARD QUI SE BRISE EN BANDES SUR CERTAINS ECRANS.

     Le classique hasard sin(dot(p, ...)) * grand nombre suppose un sinus
     precis pour des angles enormes : le parametre vaut ici jusqu'a plus de
     mille (uv * 1024), le produit scalaire monte donc a plusieurs dizaines
     de milliers de radians. En precision reduite — mediump, celle que
     beaucoup de telephones et de puces graphiques logicielles emploient par
     defaut pour les nuanceurs de fragment, sans jamais le signaler — un
     sinus a cette echelle ne reduit plus l'angle correctement et retombe
     sur un motif REGULIER au lieu d'un bruit : des bandes qui balaient
     l'image, ou des stries qui semblent rayonner depuis un point, exactement
     ce qu'Antoine decrit comme « un vieil ecran » ou « des rayons de
     soleil ». Ce n'etait donc pas un artefact du decor, mais du grain
     cense le dissimuler.

     Ce hasard-ci n'appelle jamais sin() : il ne fait que multiplier par de
     petites constantes et reprendre la partie fractionnaire, une operation
     stable quelle que soit la precision du materiel. */
  float bruit(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main(){
    vec2 uv = vUv;
    vec2 depuisCentre = uv - 0.5;
    float r2 = dot(depuisCentre, depuisCentre);

    /* Aberration chromatique : les canaux se decalent radialement, et
       seulement loin du centre. Toute autre repartition se lit comme un
       defaut d'image plutot que comme un objectif.

       ATTENTION A L'ECHELLE. Le decalage est exprime en UV, donc en
       FRACTION D'ECRAN. Le reglage precedent valait 0,9, ce qui deplace le
       canal rouge de vingt-deux pour cent de l'image dans les coins et de
       pres de trois pour cent a mi-rayon — mille fois trop. Chaque arete,
       chaque etoile, chaque flocon trainait une frange rouge et bleue, et
       l'horizon portait un liseré rouge franc.

       Un objectif reel decale d'un a trois PIXELS en bord de champ. On vise
       donc un decalage maximal de l'ordre du quart de pour cent, ce qui reste
       sous le pixel au centre et se sent a peine dans les angles — c'est-a-
       dire exactement ce qu'on veut d'une aberration : la deviner, jamais la
       voir. */
    vec3 col;
    if(uAberr > 0.0001){
      /* L'ecart est RADIAL, donc il sort du cadre sur les bords — c'est meme
         la ou il est maximal, puisqu'il croit avec le carre de la distance au
         centre. Une cible de rendu est echantillonnee en mode « bord
         prolonge » : hors du domaine, on relit indefiniment le dernier texel,
         ce qui l'etire en trainee le long de l'arete. On borne donc la
         coordonnee a un demi-texel de la bordure. Le decalage y devient nul au
         lieu de negatif, ce qui est exactement le comportement voulu : pas
         d'aberration la ou il n'y a plus rien a decaler. */
      vec2 d = depuisCentre * r2 * uAberr;
      vec2 demi = 0.5 / vec2(textureSize(uScene, 0));
      col.r = texture2D(uScene, clamp(uv + d, demi, 1.0 - demi)).r;
      col.g = texture2D(uScene, uv).g;
      col.b = texture2D(uScene, clamp(uv - d, demi, 1.0 - demi)).b;
    } else {
      col = texture2D(uScene, uv).rgb;
    }

    /* Profondeur de champ. Le cercle de confusion croit avec l'ecart a la
       mise au point ; on melange vers la version floue de la scene. Le flou
       est plafonne : au-dela, la foret se met a ressembler a une maquette. */
    if(uDof > 0.001){
      float d = distanceReelle(texture2D(uProfondeur, uv).x);
      float ecart = abs(d - uFocus);
      float coc = smoothstep(uNet, uNet + uPlage, ecart) * uDof;
      col = mix(col, texture2D(uFlou, uv).rgb, coc);
    }

    // Halo AVANT la courbe : ajoute apres, il saturerait au lieu de se fondre.
    col += texture2D(uHalo, uv).rgb * uHaloForce;

    /* Les rais s'ajoutent ici, pour la meme raison que le halo : ils sont de
       la LUMIERE, et de la lumiere s'additionne avant la courbe de tonalite,
       sinon elle ecrase les hautes lumieres au lieu de s'y fondre. */
    if (uRaisForce > 0.0001) col += texture2D(uRais, uv).rgb * uRaisForce;

    col = aces(col * uExpo);

    /* ETALONNAGE — LA DIRECTION ARTISTIQUE PROPREMENT DITE.

       Jusqu'ici, traverser la foret ne changeait que les couleurs du DECOR :
       le ciel virait, le brouillard suivait, et l'image restait rendue de la
       meme facon d'un bout a l'autre. Un film ne procede pas ainsi — il
       ETALONNE, et c'est l'etalonnage, bien plus que le contenu du plan, qui
       fait qu'une sequence de nuit ne ressemble pas a une sequence de jour
       assombrie.

       Trois gestes, dans l'ordre ou un coloriste les pose :

       1. le CONTRASTE, autour du gris moyen ;
       2. la SATURATION, apres le contraste (l'inverse deriverait les teintes
          des qu'on pousse un peu) ;
       3. le SPLIT-TONING : une teinte pour les ombres, une autre pour les
          hautes lumieres. C'est lui qui porte l'essentiel du caractere — des
          ombres froides sous une lumiere chaude, c'est la nuit americaine de
          tous les films d'hiver.

       La teinte est NORMALISEE en luminance avant d'etre appliquee : elle ne
       deplace donc que la couleur, jamais la luminosite. Sans cela, teinter
       les ombres d'un bleu sombre les assombrirait encore, et on perdrait au
       contraste ce qu'on gagne a la couleur. */
    col = clamp((col - 0.5) * uGrContraste + 0.5, 0.0, 1.0);
    float lum0 = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(lum0), col, uGrSature), 0.0, 1.0);
    {
      vec3 teinte = mix(uGrOmbres, uGrHautes, smoothstep(0.0, 1.0, lum0));
      teinte /= max(dot(teinte, vec3(0.2126, 0.7152, 0.0722)), 0.001);
      col = clamp(mix(col, col * teinte, uGrForce), 0.0, 1.0);
    }

    // Vignettage doux — il recentre le regard sans qu'on le remarque.
    col *= 1.0 - uVignette * smoothstep(0.15, 0.75, r2);

    /* Une teinte dramatique et ponctuelle — le sang de l'ascenseur qui
       envahit l'image. Elle mord davantage sur les bords que sur le centre,
       comme un fluide qui cerne le regard plutot qu'un filtre plat plaque
       sur tout l'ecran : c'est ce qui la fait lire comme une invasion et non
       comme un reglage de couleur. */
    if (uTeinteForce > 0.001) {
      float bord = mix(0.35, 1.0, smoothstep(0.0, 0.7, r2));
      col = mix(col, uTeinte, clamp(uTeinteForce * bord, 0.0, 1.0));
    }

    /* Grain. Il vient en dernier et se renforce dans les ombres : c'est la
       que le bruit d'un vrai capteur se voit, et c'est aussi la que les
       degrades de ciel ont besoin d'etre casses pour ne pas se strier.

       LE RENFORT DANS LES OMBRES SE CUMULAIT AVEC CELUI DU GAMMA. Ce qui
       suit s'ajoute en lineaire, AVANT l'encodage sRGB de la ligne du bas —
       une courbe concave, qui amplifie deja fortement tout ecart pres du
       noir. Le sapin sombre, dont la luminance tombe pres de zero, recevait
       donc l'ecart le plus fort de la formule ET l'amplification la plus
       forte de la courbe : le sable qu'Antoine signale encore, meme apres la
       correction du hasard casse. Le renfort est adouci et plafonne — il
       reste present, mais n'atteint plus le cumul des deux effets. */
    float g = bruit(uv * 1024.0 + fract(uTemps) * 91.7) - 0.5;
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col += g * uGrain * (1.0 - lum * 0.6);

    // Passage a l'espace d'affichage.
    col = clamp(col, 0.0, 1.0);
    col = mix(col * 12.92, 1.055 * pow(max(col, vec3(0.0031308)), vec3(1.0 / 2.4)) - 0.055,
              step(vec3(0.0031308), col));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class PostFX {
  constructor(renderer, palier) {
    this.renderer = renderer;
    this.palier = palier;
    this.actif = palier.postfx !== 'leger';   // le palier bas rend en direct

    this.geo = trianglePlein();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scenePasse = new THREE.Scene();
    this.quad = new THREE.Mesh(this.geo, null);
    this.quad.frustumCulled = false;
    this.scenePasse.add(this.quad);

    const commun = {
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    };
    /* Cible flottante : c'est elle qui autorise des valeurs au-dela du blanc,
       sans quoi il n'y a rien a faire diffuser au halo. */
    this.rtScene = new THREE.WebGLRenderTarget(2, 2, {
      ...commun, type: THREE.HalfFloatType, depthBuffer: true,
    });

    /* L'ANTIALIASING. C'est LE defaut d'image de tout le programme.

       Le moteur est bien construit avec `antialias: true`. Mais ce drapeau ne
       concerne QUE LE TAMPON PAR DEFAUT — celui qu'on n'utilise jamais, parce
       que la scene est rendue dans cette cible-ci pour le post-traitement. La
       cible, elle, etait mono-echantillonnee. Il n'y avait donc aucun
       antialiasing nulle part : ni sur telephone, ni sur PC, quel que soit le
       palier. D'ou l'escalier sur chaque branche, sur la silhouette du cerf et
       sur la ligne d'horizon, et l'impression de basse definition qui ne
       partait pas quand on montait la resolution.

       Quatre echantillons suffisent sur mobile : au-dela le gain devient
       invisible et le cout de resolution, lui, continue de monter. Le
       palier bas se contente de deux — il tourne sur les machines les plus
       modestes, ou la bande passante memoire est la ressource rare.

       Le palier haut, lui, N'EST JAMAIS MOBILE (voir detecterPalier dans
       quality.js) : il vise une carte de bureau, ou huit echantillons
       coutent peu et se voient encore un peu sur les silhouettes fines
       (bois du cerf, cordages, texte des cartes vues de loin). Le moteur
       clampe de lui-meme a la valeur maximale reellement supportee, donc la
       demande ne risque jamais un contexte invalide sur un GPU plus
       modeste mal detecte.

       Note technique : la profondeur est relue par la passe finale pour la
       profondeur de champ. Le moteur resout donc AUSSI le tampon de
       profondeur au moment du blit ; c'est pris en charge, mais c'est
       exactement le genre de chose a verifier plutot qu'a supposer, d'ou le
       controle dans build/audit.mjs. */
    this.echantillons = palier.nom === 'bas' ? 2 : palier.nom === 'haut' ? 8 : 4;
    this.rtScene.samples = this.echantillons;
    /* La profondeur est relue par la passe finale : il faut donc une vraie
       texture, pas le simple tampon de rendu. */
    this.profondeur = new THREE.DepthTexture(2, 2);
    this.profondeur.type = THREE.UnsignedIntType;
    this.rtScene.depthTexture = this.profondeur;

    this.rtA = new THREE.WebGLRenderTarget(2, 2, { ...commun, type: THREE.HalfFloatType });
    this.rtB = new THREE.WebGLRenderTarget(2, 2, { ...commun, type: THREE.HalfFloatType });
    // Scene floutee, pour la profondeur de champ.
    this.rtC = new THREE.WebGLRenderTarget(2, 2, { ...commun, type: THREE.HalfFloatType });
    // Les rais etires. Une cible a part : rtA porte le halo et rtC le flou de
    // profondeur de champ, tous deux encore necessaires a la composition.
    this.rtD = new THREE.WebGLRenderTarget(2, 2, { ...commun, type: THREE.HalfFloatType });

    this.matHaut = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_HAUT,
      /* Le seuil doit se situer AU-DESSUS de la neige eclairee, pas au-dessus
         du blanc nominal. En lineaire, un champ de neige au soleil depasse
         largement 1 : regle a 0,85, le halo prenait toute l'etendue enneigee
         et delavait l'image entiere en un voile laiteux. Seules les vraies
         sources — fenetres, lueur des cadeaux, cristaux — doivent passer. */
      uniforms: { uSrc: { value: null }, uSeuil: { value: 2.1 }, uDouceur: { value: 1.4 } },
      depthTest: false, depthWrite: false,
    });
    this.matFlou = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_FLOU,
      uniforms: { uSrc: { value: null }, uPas: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false,
    });

    /* LES RAIS. Deux passes, et le nombre d'echantillons suit le palier :
       c'est une boucle de lectures de texture, donc exactement le genre de
       chose qu'un telephone paie plein tarif. Douze suffisent a lire des
       faisceaux ; au-dela c'est la douceur du degrade qui gagne, pas la
       lisibilite. */
    this.matCiel = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_CIEL,
      uniforms: {
        uSrc: { value: null }, uProfondeur: { value: null },
        uSeuil: { value: 0.42 },
      },
      depthTest: false, depthWrite: false,
    });
    const nRais = palier.nom === 'haut' ? 32 : palier.nom === 'moyen' ? 20 : 12;
    this.matRais = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: fragRais(nRais),
      uniforms: {
        uSrc: { value: null },
        uLumiere: { value: new THREE.Vector2(0.5, 0.5) },
        /* La densite est la LONGUEUR du faisceau, en fraction de la distance
           qui separe le pixel de la lune : a 1, un rayon remonterait jusqu'a
           elle et l'image entiere se remplirait. On en prend les trois quarts,
           ce qui laisse les faisceaux se dissoudre avant d'atteindre leur
           source — c'est ce qui les fait lire comme de l'air, et non comme
           des traits. */
        uDensite: { value: 0.76 },
        uExtinction: { value: 0.965 },
        uPoids: { value: 1 / nRais },
      },
      depthTest: false, depthWrite: false,
    });

    const complet = palier.postfx === 'complet';
    this.matFinal = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_FINAL,
      // Demande la plus grande precision disponible : le tampon de profondeur
      // et le hasard du grain en dependent. Three.js la plafonne tout seul si
      // le materiel ne l'offre pas — la demande ne coute donc rien.
      precision: 'highp',
      uniforms: {
        uScene: { value: null }, uHalo: { value: null },
        uExpo: { value: 0.92 },
        uHaloForce: { value: 0.34 },
        uVignette: { value: 0.34 },
        /* Le grain casse les degrades de ciel, il ne doit pas les texturer.
           A 0,028 releve de moitie dans les ombres, il montait a huit niveaux
           sur deux cent cinquante-cinq dans la nuit — un sable visible sur
           toute la voute. Redescendu une seconde fois : voir plus bas, ou
           le renfort dans les ombres est lui aussi adouci. */
        uGrain: { value: 0.010 },
        uAberr: { value: complet ? 0.007 : 0.0 },
        uTemps: { value: 0 },
        uFlou: { value: null }, uProfondeur: { value: null },
        uNear: { value: 0.35 }, uFar: { value: 620 },
        // Large zone nette et flou plafonne : un flou marque ferait maquette.
        uFocus: { value: 10 }, uNet: { value: 10 }, uPlage: { value: 46 },
        /* La profondeur de champ etait a 0,58 hors du palier haut. Sur un
           telephone tenu a bout de bras, ou l'image fait dix centimetres, un
           flou d'arriere-plan de cette force ne se lit pas comme du cinema —
           il se lit comme une image pas nette. On le divise par deux la ou
           l'ecran est petit ; le palier haut, qui vise un moniteur, le
           garde. */
        uDof: { value: complet ? 0.72 : 0.28 },
        uTeinte: { value: new THREE.Color(0x5C0A0E) },
        uTeinteForce: { value: 0 },
        uRais: { value: null },
        uRaisForce: { value: 0 },
        /* L'etalonnage part NEUTRE et c'est le ciel qui l'accorde a chaque
           image (`accorderGrade`), exactement comme il accorde deja la
           lumiere et le brouillard. Neutre ici veut dire : aucun contraste
           ajoute, aucune saturation ajoutee, teintes grises — si le ciel ne
           branchait rien, l'image resterait celle d'avant. */
        uGrOmbres: { value: new THREE.Color(0x808080) },
        uGrHautes: { value: new THREE.Color(0x808080) },
        uGrContraste: { value: 1 },
        uGrSature: { value: 1 },
        uGrForce: { value: 0 },
      },
      depthTest: false, depthWrite: false,
    });

    /* Toujours une texture valide, meme quand les rais sont eteints : le
       branchement qui les saute vit dans le nuanceur, et un echantillonneur
       non lie reste un echantillonneur declare. */
    this.matFinal.uniforms.uRais.value = this.rtD.texture;

    this.l = 2; this.h = 2;
    // Les valeurs nominales, pour pouvoir y revenir apres un assombrissement.
    this._expoBase = this.matFinal.uniforms.uExpo.value;
    this._vignetteBase = this.matFinal.uniforms.uVignette.value;
    this._aberrBase = this.matFinal.uniforms.uAberr.value;
  }

  setSize(l, h, dpr) {
    const L = Math.max(2, Math.round(l * dpr));
    const H = Math.max(2, Math.round(h * dpr));
    if (L === this.l && H === this.h) return;
    this.l = L; this.h = H;
    this.rtScene.setSize(L, H);

    /* Demi-resolution pour le halo : personne ne voit la difference sur un
       flou, et ca divise le cout par quatre.

       MAIS PAS EN DESSOUS D'UN CERTAIN NOMBRE DE PIXELS. « Demi » est un
       rapport, et un rapport n'a pas de plancher : quand la densite baisse,
       ces tampons descendent avec elle, et le flou remonte a l'ecran en blocs
       — d'autant plus visibles qu'ils couvrent de grandes surfaces unies,
       c'est-a-dire le fond et le ciel. C'est ce qu'Antoine decrit comme « des
       sortes de carres au loin ».

       On borne donc le petit cote a 320 pixels. En dessous, on cesse de
       diviser : un flou de qualite mediocre coute moins cher qu'un flou qui
       se voit. */
    const PLANCHER = 320;
    const div = (Math.min(L, H) >> 1) >= PLANCHER ? 1 : 0;
    const fl = Math.max(2, L >> div), fh = Math.max(2, H >> div);
    this.rtA.setSize(fl, fh);
    this.rtB.setSize(fl, fh);
    this.rtC.setSize(fl, fh);
    this.rtD.setSize(fl, fh);
    this._flouL = fl; this._flouH = fh;
  }

  _passe(mat, cible) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(cible);
    this.renderer.render(this.scenePasse, this.cam);
  }

  /* Repli en rendu direct, quand la surveillance de cadence retrograde vers
     le palier bas.

     Le point critique est la courbe de tonalite. Tant que la chaine est
     active, c'est la passe finale qui l'applique, et le materiau ne doit
     donc PAS la faire (NoToneMapping). En repassant au rendu direct sans
     retablir ce reglage, plus personne ne l'applique : l'image part en
     lineaire brut et se retrouve entierement cramee. Le repli doit donc
     rendre au moteur ce que la chaine lui avait pris. */
  desactiver(renderer) {
    if (!this.actif) return;
    this.actif = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.matFinal.uniforms.uExpo.value;
    renderer.setRenderTarget(null);
  }

  /* Le sujet, donc le plan de mise au point. Suivi en continu : c'est ce qui
     evite qu'un changement de cadrage laisse le cerf dans le flou. */
  viser(distance) {
    const u = this.matFinal.uniforms;
    /* Borne de securite : une distance aberrante — sujet non encore place,
       teleportation de mise au point — figerait le plan de nettete hors du
       monde et noierait toute l'image dans le flou. */
    const d = Math.min(Math.max(distance, 2), 90);
    if (!isFinite(d)) return;
    u.uFocus.value += (d - u.uFocus.value) * 0.12;
  }

  /* L'ASSOMBRISSEMENT DRAMATIQUE. Une scene comme le duel de sabres a besoin
     de se sentir AILLEURS que dans la balade paisible qui l'entoure : on
     ferme l'exposition et on resserre la vignette, comme un objectif qui se
     bouche pendant qu'un autre univers prend toute la place. `force` vaut 0
     au repos et jusqu'a 1 en plein effet ; l'appelant le fait monter puis
     redescendre lui-meme au fil de la fenetre de la scene. Le lissage est
     ici, pas chez l'appelant, pour qu'aucun appel — meme un saut brutal de
     force — ne se voie comme une coupe. */
  assombrir(force, dt) {
    const u = this.matFinal.uniforms;
    const f = Math.min(Math.max(force, 0), 1);
    const expoCible = this._expoBase - f * 0.46;
    const vignetteCible = this._vignetteBase + f * 0.42;
    u.uExpo.value = damp(u.uExpo.value, expoCible, 2.2, dt);
    u.uVignette.value = damp(u.uVignette.value, vignetteCible, 2.2, dt);
  }

  /* UNE TEINTE PONCTUELLE, PAR-DESSUS L'IMAGE ENTIERE. Distincte de
     l'assombrissement : celui-ci ferme l'exposition, celle-la impose une
     couleur — le sang qui envahit l'ecran a l'ascenseur de Shining, par
     exemple. `couleur` n'est relue que lorsque `force` redevient notable :
     un flash qui s'eteint ne doit pas faire deriver la teinte cible vers du
     noir au passage. */
  teinter(couleur, force, dt) {
    const u = this.matFinal.uniforms;
    const f = Math.min(Math.max(force, 0), 1);
    if (f > 0.01 && couleur !== undefined) u.uTeinte.value.set(couleur);
    u.uTeinteForce.value = damp(u.uTeinteForce.value, f, 3.2, dt);
  }

  /* UNE DISTORSION PONCTUELLE — l'aberration chromatique poussee bien
     au-dela de son reglage discret habituel. Ecrite pour Gargantua : un
     trou noir courbe la lumiere qui passe pres de lui, et l'aberration
     chromatique — les canaux qui se decalent radialement — est exactement
     la texture visuelle de cette courbure, deja presente dans le moteur
     pour un tout autre usage (l'objectif). On ne l'ajoute donc pas, on la
     PLIE : au repos elle retombe sur son reglage normal (nul sur les
     paliers qui ne l'activent pas), jamais en dessous. */
  distordre(force, dt) {
    const u = this.matFinal.uniforms;
    const f = Math.min(Math.max(force, 0), 1);
    const cible = this._aberrBase + f * 0.032;
    u.uAberr.value = damp(u.uAberr.value, cible, 2.6, dt);
  }

  /* OU EST LA LUNE, A L'ECRAN ? C'est de ce point que partent les rais, et
     c'est la seule chose que la passe radiale a besoin de savoir.

     Deux garde-fous, et ils comptent autant que le calcul lui-meme :

     · QUAND ELLE EST DERRIERE, IL N'Y A PAS DE RAIS. Projeter un point situe
       derriere la camera renvoie des coordonnees miroir, parfaitement
       plausibles et completement fausses : on obtiendrait des faisceaux
       partant d'un coin de l'ecran, a l'oppose exact de la lumiere. On teste
       donc le sens AVANT de projeter, jamais le resultat de la projection.

     · QUAND ELLE SORT DU CADRE, ILS S'ETEIGNENT EN DOUCEUR. Sans cela, le
       jour ou la camera la perd d'un demi-degre, toute la trainee
       disparaitrait d'une image a l'autre — un clignotement, la pire chose
       qu'on puisse offrir a un plan-sequence. */
  reglerRais(camera, dirMonde, force = 1) {
    const u = this.matFinal.uniforms;
    if (!this.actif || !dirMonde) { u.uRaisForce.value = 0; return; }

    camera.getWorldDirection(_avant);
    const face = _avant.dot(dirMonde);
    if (face <= 0.05) { u.uRaisForce.value = 0; return; }

    _pt.copy(camera.position).addScaledVector(dirMonde, 900).project(camera);
    this.matRais.uniforms.uLumiere.value.set(_pt.x * 0.5 + 0.5, _pt.y * 0.5 + 0.5);

    const dx = Math.max(0, Math.abs(_pt.x) - 1);
    const dy = Math.max(0, Math.abs(_pt.y) - 1);
    const hors = Math.min(1, Math.hypot(dx, dy) / 0.8);
    u.uRaisForce.value = force * Math.min(1, face * 2.2) * (1 - hors);
  }

  /* L'etalonnage suit l'ambiance du ciel, au meme titre que la lumiere et le
     brouillard — c'est ce qui garantit qu'ils ne divergent jamais. */
  accorderGrade(a) {
    const u = this.matFinal.uniforms;
    if (a.grOmbres !== undefined) u.uGrOmbres.value.set(a.grOmbres);
    if (a.grHautes !== undefined) u.uGrHautes.value.set(a.grHautes);
    if (a.grContraste !== undefined) u.uGrContraste.value = a.grContraste;
    if (a.grSature !== undefined) u.uGrSature.value = a.grSature;
    if (a.grForce !== undefined) u.uGrForce.value = a.grForce;
  }

  rendre(scene, camera, temps) {
    const r = this.renderer;
    if (!this.actif) { r.setRenderTarget(null); r.render(scene, camera); return; }
    this.matFinal.uniforms.uNear.value = camera.near;
    this.matFinal.uniforms.uFar.value = camera.far;

    // 1. la scene, en flottant
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);

    // 2. hautes lumieres
    this.matHaut.uniforms.uSrc.value = this.rtScene.texture;
    this._passe(this.matHaut, this.rtA);

    // 3. flou separable, deux fois, avec un pas qui s'elargit
    const lw = this._flouL || Math.max(2, this.l >> 1);
    const lh = this._flouH || Math.max(2, this.h >> 1);
    for (const ecart of [1.0, 2.4]) {
      this.matFlou.uniforms.uSrc.value = this.rtA.texture;
      this.matFlou.uniforms.uPas.value.set(ecart / lw, 0);
      this._passe(this.matFlou, this.rtB);

      this.matFlou.uniforms.uSrc.value = this.rtB.texture;
      this.matFlou.uniforms.uPas.value.set(0, ecart / lh);
      this._passe(this.matFlou, this.rtA);
    }

    /* 4. la scene entiere, floutee. L'echantillonnage lineaire en
       demi-resolution fait office de reduction : pas besoin d'une passe
       dediee pour descendre en taille. */
    this.matFlou.uniforms.uSrc.value = this.rtScene.texture;
    this.matFlou.uniforms.uPas.value.set(2.0 / lw, 0);
    this._passe(this.matFlou, this.rtB);
    this.matFlou.uniforms.uSrc.value = this.rtB.texture;
    this.matFlou.uniforms.uPas.value.set(0, 2.0 / lh);
    this._passe(this.matFlou, this.rtC);

    /* 5. les rais. Deux passes, et SEULEMENT si la lune est effectivement
       dans le champ : quand elle est derriere la camera, l'etirement
       partirait d'un point situe hors de l'ecran et ne produirait qu'une
       bavure diagonale. `reglerRais` met alors la force a zero, et on
       economise les deux passes entieres plutot que de les calculer pour
       les multiplier par rien. */
    if (this.matFinal.uniforms.uRaisForce.value > 0.0001) {
      this.matCiel.uniforms.uSrc.value = this.rtScene.texture;
      this.matCiel.uniforms.uProfondeur.value = this.profondeur;
      this._passe(this.matCiel, this.rtB);

      this.matRais.uniforms.uSrc.value = this.rtB.texture;
      this._passe(this.matRais, this.rtD);
      this.matFinal.uniforms.uRais.value = this.rtD.texture;
    }

    // 6. composition a l'ecran
    this.matFinal.uniforms.uScene.value = this.rtScene.texture;
    this.matFinal.uniforms.uHalo.value = this.rtA.texture;
    this.matFinal.uniforms.uFlou.value = this.rtC.texture;
    this.matFinal.uniforms.uProfondeur.value = this.profondeur;
    this.matFinal.uniforms.uTemps.value = temps || 0;
    this._passe(this.matFinal, null);
  }
}
