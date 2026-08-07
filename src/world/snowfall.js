/* La neige qui tombe.

   Tout se passe dans le shader : aucune position n'est recalculee sur le
   processeur. Chaque flocon connait sa graine, en deduit sa trajectoire en
   fonction du temps, et se replie autour de la camera par un modulo. On peut
   ainsi en tenir des milliers sans rien couter.

   DEUX COUCHES, et c'est la clef. Une seule nappe uniforme ne se voit
   presque pas : repartis dans un grand volume, les flocons sont pour la
   plupart lointains, donc minuscules. On superpose donc :

   · le LOINTAIN — un grand volume, beaucoup de petits flocons, qui remplit
     l'air et donne la densite de la chute ;
   · le PROCHE — un petit volume autour de la camera, peu de flocons mais
     gros, flous et rapides, qui passent devant l'objectif.

   C'est le contraste entre les deux qui donne la profondeur, et c'est la
   couche proche qui fait qu'on SENT la neige plutot qu'on la devine.

   Un flocon trop pres de la lentille s'efface : sinon on traverse en
   permanence des taches blanches qui bouchent l'image.
*/

import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute vec4 graine;      // xyz = position de base, w = taille relative
  uniform float uTemps;
  uniform vec3 uCam;
  uniform float uEtendue, uChute, uPixels, uTaille, uDerive;
  varying float vAlpha;
  varying float vFlou;

  void main(){
    float S = uEtendue;
    vec3 p = graine.xyz * S;

    // Chute : les gros flocons tombent plus vite.
    float vitesse = uChute * (0.55 + graine.w * 0.95);
    p.y -= uTemps * vitesse;

    // Derive laterale, phase propre a chaque flocon, plus le vent d'ensemble.
    float ph = graine.x * 61.0 + graine.z * 37.0;
    p.x += sin(uTemps * 0.62 + ph) * 0.9 + uTemps * uDerive;
    p.z += cos(uTemps * 0.47 + ph * 1.3) * 0.75;
    // Voltige : un petit mouvement en huit, tres visible de pres.
    p.x += sin(uTemps * 1.9 + ph * 2.7) * 0.16 * graine.w;
    p.y += cos(uTemps * 1.6 + ph * 1.9) * 0.10 * graine.w;

    // Repliement autour de la camera : la nappe suit sans jamais se vider.
    vec3 rel = mod(p - uCam + S * 0.5, S) - S * 0.5;
    vec3 monde = uCam + rel;

    vec4 mv = modelViewMatrix * vec4(monde, 1.0);
    float d = -mv.z;

    gl_Position = projectionMatrix * mv;
    /* Plafond indispensable : sans lui, un flocon qui frole l'objectif couvre
       la moitie de l'ecran d'un disque blanc.

       Mais un plafond trop HAUT a son propre defaut, et c'est celui qu'on
       observait : la couche proche saturait, si bien que tous ses flocons
       sortaient a la meme taille maximale. L'image se couvrait alors d'une
       trentaine de disques blancs identiques, tous de trente pixels — on ne
       lisait plus de la neige mais des bulles. Abaisser le plafond ET la
       taille de base remet la couche proche a sa place : quelques passages
       flous devant l'objectif, pas un rideau. */
    gl_PointSize = min((0.030 + graine.w * uTaille) * uPixels / max(d, 0.7),
                       uPixels * 0.030);

    /* Fondu aux deux bouts : trop pres l'image se bouche, trop loin les
       flocons scintillent d'un pixel a l'autre. La borne proche est reculee —
       un flocon a quarante centimetres de la lentille n'a aucune raison
       d'etre net ni opaque. */
    vAlpha = smoothstep(0.60, 3.2, d) * (1.0 - smoothstep(S * 0.30, S * 0.48, d));
    // Les flocons proches sont hors de la profondeur de champ, donc flous.
    vFlou = 1.0 - smoothstep(1.5, 9.0, d);
  }
`;

const FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vFlou;
  uniform vec3 uCouleur;
  uniform float uOpacite;

  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if(r > 0.25) discard;
    // Le bord s'adoucit avec la proximite : un flocon proche est un halo,
    // un flocon lointain un point net.
    float bord = mix(0.20, 0.02, vFlou);
    float a = (1.0 - smoothstep(bord, 0.25, r)) * vAlpha;
    gl_FragColor = vec4(uCouleur, a * uOpacite);
  }
`;

function couche(N, etendue, taille, opacite, biais) {
  const graines = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    graines[i * 4] = Math.random();
    graines[i * 4 + 1] = Math.random();
    graines[i * 4 + 2] = Math.random();
    // Beaucoup de petits, peu de gros — sinon l'image est mangee.
    graines[i * 4 + 3] = Math.pow(Math.random(), biais);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('graine', new THREE.BufferAttribute(graines, 4));

  const uniforms = {
    uTemps: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uEtendue: { value: etendue },
    uChute: { value: 1.9 },
    uPixels: { value: 700 },
    uTaille: { value: taille },
    uDerive: { value: 0.6 },
    uOpacite: { value: opacite },
    uCouleur: { value: new THREE.Color(0xF4FAFF) },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 10;
  return { pts, uniforms };
}

export class Neige {
  constructor(scene, palier) {
    const N = palier.flocons;

    /* Le lointain remplit l'air ; le proche passe devant l'objectif.

       La couche proche est la plus delicate a doser : elle porte tout le
       sentiment de neige, et c'est aussi elle qui bouche l'image si on la
       laisse filer. Sa part tombe a un huitieme, sa taille de base de moitie,
       et son biais monte a 2,4 — donc beaucoup de petits, tres peu de gros.
       Ce qu'on veut, c'est qu'un flocon passe de temps en temps, pas qu'il y
       en ait toujours un devant l'oeil. */
    /* IL EN TOMBE NETTEMENT PLUS. Antoine en veut davantage, et c'est aussi
       la mesure la moins chere pour masquer ce qui reste d'apparition
       d'arbres au loin : un rideau de flocons occupe l'oeil et casse la
       lecture des silhouettes lointaines. Un flocon coute un point, donc
       presque rien en geometrie ; ce qui coute est le remplissage, d'ou une
       couche lointaine qui reste faite de tres petits grains.

       Le rapport entre les deux couches ne bouge pas : la couche proche est
       celle qui bouche l'image si on la laisse filer, et un flocon qui passe
       de temps en temps vaut mieux qu'un flocon toujours devant l'oeil. */
    this.loin = couche(Math.round(N * 0.90), 125, 0.100, 0.85, 2.8);
    this.pres = couche(Math.round(N * 0.10), 30, 0.16, 0.30, 2.4);

    scene.add(this.loin.pts);
    scene.add(this.pres.pts);
    this.couches = [this.loin, this.pres];
  }

  maj(dt, temps, camera, renderer) {
    // La taille a l'ecran doit suivre la resolution, sinon les flocons sont
    // minuscules sur un ecran haute densite et enormes sur un petit.
    const px = renderer.domElement.height * 0.62;
    for (const c of this.couches) {
      c.uniforms.uTemps.value = temps;
      c.uniforms.uCam.value.copy(camera.position);
      c.uniforms.uPixels.value = px;
    }
  }

  /* Fait forcir ou faiblir la chute — utile dans les clairieres exposees. */
  intensite(v) {
    this.loin.uniforms.uChute.value = 1.9 * v;
    this.pres.uniforms.uChute.value = 2.3 * v;
    this.loin.uniforms.uDerive.value = 0.6 * v;
    this.pres.uniforms.uDerive.value = 0.8 * v;
  }
}
