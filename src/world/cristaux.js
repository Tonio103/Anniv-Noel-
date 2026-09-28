/* LA POUDRE DE DIAMANT.

   Par nuit de grand froid, l'air sec se charge de cristaux de glace si fins
   qu'ils ne tombent presque pas : ils flottent. On ne les voit pas — sauf
   quand l'un d'eux, en tournant, presente une facette exactement entre la
   lune et l'oeil. Il s'allume alors une fraction de seconde, puis s'eteint,
   et un autre s'allume ailleurs. C'est le scintillement de l'air glace, la
   « poudre de diamant » des nuits a moins vingt.

   Ce n'est pas de la neige, et il ne faut surtout pas que ca s'y confonde :

   · AUCUNE CHUTE ou presque — une derive lente, quelques centimetres par
     seconde ; ce sont les flocons qui tombent, pas les cristaux ;
   · RIEN A VOIR tant qu'il n'y a pas de reflet — un voile de points
     infimes, a peine perceptible ;
   · un reflet est une REFLEXION, donc il depend de la geometrie : chaque
     cristal a sa facette, orientee au hasard, et il ne brille que si la
     direction de la lune, reflechie par cette facette, tombe dans l'oeil.
     Quand la camera bouge, ce ne sont donc pas les memes qui brillent :
     l'air scintille AU RYTHME DU MOUVEMENT, et s'immobilise quand on
     s'arrete — ce qu'aucun clignotement programme ne sait faire ;
   · la facette tourne lentement sur elle-meme : meme a l'arret, quelques
     eclats vont et viennent.

   Tout est calcule dans le nuanceur, comme la neige : chaque cristal
   connait sa graine et en deduit sa position, repliee autour de la camera.
   Il n'existe que par grand froid (voir `froid` dans les ambiances). */

import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute vec4 graine;      // xyz position, w phase
  attribute vec3 facette;     // normale de la facette, au repos
  uniform float uTemps, uEtendue, uPixels, uW;
  uniform vec3 uCam, uLune;
  varying float vEclat;
  varying float vVoile;
  varying float vTeinte;

  void main() {
    float S = uEtendue;
    vec3 p = graine.xyz * S;
    // Une derive a peine perceptible, portee par le meme vent que la neige.
    p.x += uW * 0.18 + sin(uTemps * 0.21 + graine.w * 6.28) * 0.35;
    p.y -= uTemps * 0.035;
    p.z += cos(uTemps * 0.17 + graine.w * 4.1) * 0.30;
    vec3 rel = mod(p - uCam + S * 0.5, S) - S * 0.5;
    vec3 monde = uCam + rel;

    /* La facette tourne lentement autour de la verticale : un cristal
       en suspension n'est jamais parfaitement immobile. */
    float a = uTemps * (0.25 + graine.w * 0.5) + graine.w * 17.0;
    float c = cos(a), s = sin(a);
    vec3 n = normalize(vec3(c * facette.x - s * facette.z, facette.y, s * facette.x + c * facette.z));

    /* LE REFLET. La lune, reflechie par la facette, doit tomber dans
       l'oeil. L'exposant regle la finesse du cone : a cent vingt, un cristal
       sur cinquante environ brille a un instant donne. */
    vec3 versOeil = normalize(uCam - monde);
    vec3 r = reflect(-uLune, n);
    float e = pow(max(dot(r, versOeil), 0.0), 120.0);

    vec4 mv = modelViewMatrix * vec4(monde, 1.0);
    float d = -mv.z;
    gl_Position = projectionMatrix * mv;

    // Ni trop pres (il boucherait l'objectif), ni trop loin (sous le pixel).
    float fondu = smoothstep(0.8, 2.2, d) * (1.0 - smoothstep(S * 0.34, S * 0.5, d));
    vEclat = e * fondu;
    vVoile = fondu;
    vTeinte = fract(graine.w * 7.31);
    // Un eclat est plus grand qu'un cristal eteint : c'est la lumiere qui
    // bave, pas le cristal qui grossit.
    gl_PointSize = clamp((1.2 + e * 5.0) * uPixels / 900.0, 1.0, 9.0);
  }
`;

const FRAG = /* glsl */ `
  varying float vEclat;
  varying float vVoile;
  varying float vTeinte;
  uniform float uFroid;

  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r = length(q);
    /* Une etoile a quatre branches pour l'eclat, un simple point pour le
       voile. Les branches, c'est la diffraction dans l'oeil : c'est ce qui
       fait lire « etincelle » et non « tache ». */
    float coeur = 1.0 - smoothstep(0.05, 0.22, r);
    float branches = max(1.0 - abs(q.x) * 14.0, 0.0) * (1.0 - smoothstep(0.1, 0.5, abs(q.y)))
                   + max(1.0 - abs(q.y) * 14.0, 0.0) * (1.0 - smoothstep(0.1, 0.5, abs(q.x)));
    float forme = coeur + branches * 0.55 * smoothstep(0.2, 0.6, vEclat);
    /* Le feu : un prisme de glace decompose un peu la lumiere. Chaque
       cristal a sa nuance, de l'ambre au bleu, tres peu saturee. */
    vec3 teinte = mix(vec3(1.0, 0.93, 0.84), vec3(0.82, 0.92, 1.0), vTeinte);
    float a = (vEclat * 1.6 + vVoile * 0.05) * forme * uFroid;
    if (a < 0.004) discard;
    gl_FragColor = vec4(teinte * a, a);
  }
`;

export class Cristaux {
  constructor(scene, palier) {
    const N = palier.nom === 'bas' ? 900 : palier.nom === 'moyen' ? 1600 : 2600;
    const graines = new Float32Array(N * 4);
    const facettes = new Float32Array(N * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      graines.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
      /* Des plaquettes, pour moitie a peu pres a plat (elles tombent en
         feuille morte, face vers le haut), le reste en tous sens. */
      if (Math.random() < 0.5) v.set((Math.random() - 0.5) * 0.5, 1, (Math.random() - 0.5) * 0.5);
      else v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      v.normalize();
      facettes.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('graine', new THREE.BufferAttribute(graines, 4));
    geo.setAttribute('facette', new THREE.BufferAttribute(facettes, 3));

    this.uniforms = {
      uTemps: { value: 0 },
      uEtendue: { value: 18 },
      uPixels: { value: 900 },
      uW: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uLune: { value: new THREE.Vector3(-0.45, 0.34, -0.83).normalize() },
      uFroid: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false,
      // De la lumiere qui s'ajoute : un eclat eclaire, il ne recouvre pas.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 11;
    scene.add(this.points);
    this._w = 0;
  }

  /* `froid` : 0 (rien) a 1 (nuit glaciale), lu dans l'ambiance du ciel.
     `lune` : la direction de la lumiere, la meme que celle du ciel. */
  maj(dt, temps, camera, renderer, froid, lune, rafale = 0) {
    this.points.visible = froid > 0.02;
    if (!this.points.visible) return;
    this._w += Math.max(0, Math.min(dt, 0.1)) * (1 + 2.4 * rafale);
    const u = this.uniforms;
    u.uTemps.value = temps;
    u.uCam.value.copy(camera.position);
    u.uPixels.value = renderer.domElement.height;
    u.uW.value = this._w;
    u.uFroid.value = froid;
    if (lune) u.uLune.value.copy(lune).normalize();
  }
}
