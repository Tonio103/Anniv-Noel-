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

/* --- composition finale --------------------------------------------------- */
const FRAG_FINAL = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uScene, uHalo, uFlou, uProfondeur;
  uniform float uExpo, uHaloForce, uVignette, uGrain, uAberr, uTemps;
  uniform float uNear, uFar, uFocus, uNet, uPlage, uDof;

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

  float bruit(vec2 p){
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
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
      vec2 d = depuisCentre * r2 * uAberr;
      col.r = texture2D(uScene, uv + d).r;
      col.g = texture2D(uScene, uv).g;
      col.b = texture2D(uScene, uv - d).b;
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

    col = aces(col * uExpo);

    // Vignettage doux — il recentre le regard sans qu'on le remarque.
    col *= 1.0 - uVignette * smoothstep(0.15, 0.75, r2);

    /* Grain. Il vient en dernier et se renforce dans les ombres : c'est la
       que le bruit d'un vrai capteur se voit, et c'est aussi la que les
       degrades de ciel ont besoin d'etre casses pour ne pas se strier. */
    float g = bruit(uv * 1024.0 + fract(uTemps) * 91.7) - 0.5;
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col += g * uGrain * (1.25 - lum);

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
    /* La profondeur est relue par la passe finale : il faut donc une vraie
       texture, pas le simple tampon de rendu. */
    this.profondeur = new THREE.DepthTexture(2, 2);
    this.profondeur.type = THREE.UnsignedIntType;
    this.rtScene.depthTexture = this.profondeur;

    this.rtA = new THREE.WebGLRenderTarget(2, 2, { ...commun, type: THREE.HalfFloatType });
    this.rtB = new THREE.WebGLRenderTarget(2, 2, { ...commun, type: THREE.HalfFloatType });
    // Scene floutee, pour la profondeur de champ.
    this.rtC = new THREE.WebGLRenderTarget(2, 2, { ...commun, type: THREE.HalfFloatType });

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

    const complet = palier.postfx === 'complet';
    this.matFinal = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_FINAL,
      uniforms: {
        uScene: { value: null }, uHalo: { value: null },
        uExpo: { value: 0.92 },
        uHaloForce: { value: 0.34 },
        uVignette: { value: 0.34 },
        /* Le grain casse les degrades de ciel, il ne doit pas les texturer.
           A 0,028 releve de moitie dans les ombres, il montait a huit niveaux
           sur deux cent cinquante-cinq dans la nuit — un sable visible sur
           toute la voute. */
        uGrain: { value: 0.017 },
        uAberr: { value: complet ? 0.007 : 0.0 },
        uTemps: { value: 0 },
        uFlou: { value: null }, uProfondeur: { value: null },
        uNear: { value: 0.35 }, uFar: { value: 620 },
        // Large zone nette et flou plafonne : un flou marque ferait maquette.
        uFocus: { value: 10 }, uNet: { value: 10 }, uPlage: { value: 46 },
        uDof: { value: complet ? 0.72 : 0.58 },
      },
      depthTest: false, depthWrite: false,
    });

    this.l = 2; this.h = 2;
  }

  setSize(l, h, dpr) {
    const L = Math.max(2, Math.round(l * dpr));
    const H = Math.max(2, Math.round(h * dpr));
    if (L === this.l && H === this.h) return;
    this.l = L; this.h = H;
    this.rtScene.setSize(L, H);
    // Demi-resolution pour le halo : personne ne voit la difference sur un
    // flou, et ca divise le cout par quatre.
    this.rtA.setSize(Math.max(2, L >> 1), Math.max(2, H >> 1));
    this.rtB.setSize(Math.max(2, L >> 1), Math.max(2, H >> 1));
    this.rtC.setSize(Math.max(2, L >> 1), Math.max(2, H >> 1));
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
    const lw = Math.max(2, this.l >> 1), lh = Math.max(2, this.h >> 1);
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

    // 5. composition a l'ecran
    this.matFinal.uniforms.uScene.value = this.rtScene.texture;
    this.matFinal.uniforms.uHalo.value = this.rtA.texture;
    this.matFinal.uniforms.uFlou.value = this.rtC.texture;
    this.matFinal.uniforms.uProfondeur.value = this.profondeur;
    this.matFinal.uniforms.uTemps.value = temps || 0;
    this._passe(this.matFinal, null);
  }
}
