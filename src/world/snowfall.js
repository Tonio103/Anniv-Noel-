/* La neige qui tombe.

   Tout se passe dans le shader : aucune position n'est recalculee sur le
   processeur. Chaque flocon connait sa graine, en deduit sa trajectoire en
   fonction du temps, et se replie autour de la camera par un modulo. On peut
   ainsi en tenir plusieurs milliers sans rien couter.

   Deux details comptent plus que le nombre :
   · les flocons PROCHES sont gros, flous et rapides, les lointains minuscules
     et lents. C'est ce contraste qui cree la profondeur ;
   · ils s'effacent quand ils s'approchent trop de l'objectif, sinon on
     traverse en permanence des taches blanches. */

import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute vec4 graine;      // xyz = position de base, w = taille relative
  uniform float uTemps;
  uniform vec3 uCam;
  uniform float uEtendue, uChute, uPixels;
  varying float vAlpha;

  void main(){
    float S = uEtendue;
    vec3 p = graine.xyz * S;

    // chute, plus rapide pour les gros flocons (ils sont plus proches)
    float vitesse = uChute * (0.55 + graine.w * 0.9);
    p.y -= uTemps * vitesse;

    // derive laterale : chaque flocon a sa propre phase
    float ph = graine.x * 61.0 + graine.z * 37.0;
    p.x += sin(uTemps * 0.62 + ph) * 0.85 + uTemps * 0.55;
    p.z += cos(uTemps * 0.47 + ph * 1.3) * 0.70;

    // repliement autour de la camera
    vec3 rel = mod(p - uCam + S * 0.5, S) - S * 0.5;
    vec3 monde = uCam + rel;

    vec4 mv = modelViewMatrix * vec4(monde, 1.0);
    float d = -mv.z;

    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.055 + graine.w * 0.16) * uPixels / max(d, 0.6);

    // Fondu aux deux extremites : trop pres l'ecran se bouche, trop loin
    // les flocons scintillent d'un pixel a l'autre.
    vAlpha = smoothstep(0.5, 2.6, d) * (1.0 - smoothstep(S * 0.30, S * 0.48, d));
  }
`;

const FRAG = /* glsl */ `
  varying float vAlpha;
  uniform vec3 uCouleur;
  void main(){
    // Disque adouci : un carre se voit immediatement.
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if(r > 0.25) discard;
    float a = (1.0 - smoothstep(0.06, 0.25, r)) * vAlpha;
    gl_FragColor = vec4(uCouleur, a * 0.85);
  }
`;

export class Neige {
  constructor(scene, palier) {
    const N = palier.flocons;
    const etendue = 92;

    const graines = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      graines[i * 4] = Math.random();
      graines[i * 4 + 1] = Math.random();
      graines[i * 4 + 2] = Math.random();
      // Beaucoup de petits, peu de gros : sinon l'image est mangee.
      graines[i * 4 + 3] = Math.pow(Math.random(), 2.4);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('graine', new THREE.BufferAttribute(graines, 4));

    this.uniforms = {
      uTemps: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uEtendue: { value: etendue },
      uChute: { value: 1.7 },
      uPixels: { value: 700 },
      uCouleur: { value: new THREE.Color(0xF2F8FF) },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  maj(dt, temps, camera, renderer) {
    this.uniforms.uTemps.value = temps;
    this.uniforms.uCam.value.copy(camera.position);
    // La taille a l'ecran doit suivre la resolution, sinon les flocons sont
    // minuscules sur un ecran haute densite et enormes sur un petit.
    this.uniforms.uPixels.value = renderer.domElement.height * 0.62;
  }

  /* La chute force dans les passages plus exposes. */
  intensite(v) { this.uniforms.uChute.value = v; }
}
