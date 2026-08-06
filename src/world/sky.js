/* Le ciel, et avec lui l'ambiance generale.

   Un degrade peint dans un shader plutot qu'une image : ca coute presque
   rien et ca permet de faire tomber la nuit progressivement au fil de la
   balade. On part d'un crepuscule bleu a la lisiere pour finir sur une
   nuit etoilee dans la clairiere.

   Les ambiances sont interpolees en continu — jamais de bascule nette,
   sinon on retombe dans l'effet "changement de diapositive". */

import * as THREE from 'three';
import { GLSL_NOISE } from '../core/noise.js';

/* Chaque ambiance : couleur du zenith, de l'horizon, lueur basse, densite
   de brouillard, et la teinte de la lumiere principale. */
export const AMBIANCES = {
  crepuscule: {
    zenith: 0x14304C, horizon: 0x4A6E88, lueur: 0xE8A75C,
    brouillard: 0x40607A, densite: 0.0092, etoiles: 0.12,
    soleil: 0xFFD2A0, force: 1.75, ciel: 0x7A9CBC, sol: 0x2E4258, ambiant: 0.62,
  },
  soir: {
    zenith: 0x0C1F38, horizon: 0x2E4C6E, lueur: 0xD08A54,
    brouillard: 0x2A4460, densite: 0.0108, etoiles: 0.45,
    soleil: 0xFFC79A, force: 1.25, ciel: 0x5C7FA4, sol: 0x22344A, ambiant: 0.52,
  },
  nuit: {
    zenith: 0x050E1E, horizon: 0x16304C, lueur: 0x2E5A7E,
    brouillard: 0x16283C, densite: 0.0126, etoiles: 1.0,
    soleil: 0xBFD8FF, force: 0.85, ciel: 0x3E6288, sol: 0x131F2E, ambiant: 0.46,
  },
  clairiere: {
    /* Le ciel s'ouvre : plus d'etoiles, moins de brume, on respire. */
    zenith: 0x04101F, horizon: 0x1B3A58, lueur: 0x4E86A8,
    brouillard: 0x18304A, densite: 0.0082, etoiles: 1.0,
    soleil: 0xD6E6FF, force: 1.05, ciel: 0x4E77A0, sol: 0x16243A, ambiant: 0.58,
  },
  maison: {
    /* Derniere clairiere : une maison eclairee au loin rechauffe tout. */
    zenith: 0x061224, horizon: 0x2A3E52, lueur: 0xE8B26A,
    brouillard: 0x22354A, densite: 0.0098, etoiles: 0.86,
    soleil: 0xFFD9A8, force: 1.15, ciel: 0x577FA6, sol: 0x2A2C34, ambiant: 0.66,
  },
};

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main(){
    vDir = position;
    // Le dome suit la camera : on ne peut jamais en sortir.
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w;   // toujours au fond
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uZenith, uHorizon, uLueur;
  uniform vec3 uSoleilDir;
  uniform float uEtoiles, uTemps;

  ${GLSL_NOISE}

  void main(){
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);

    // Degrade principal, resserre pres de l'horizon
    float t = pow(clamp(d.y, 0.0, 1.0), 0.42);
    vec3 col = mix(uHorizon, uZenith, t);

    // Lueur chaude la ou le soleil vient de se coucher. Elle doit lecher
    // l'horizon sur une large plage, pas former un disque : le soleil lui-meme
    // est deja passe derriere les arbres.
    float vers = max(dot(d, normalize(vec3(uSoleilDir.x, 0.0, uSoleilDir.z))), 0.0);
    float bas  = smoothstep(0.18, -0.10, d.y);
    col += uLueur * pow(vers, 2.6) * bas * 0.42;

    // Halo tres serre, juste de quoi suggerer d'ou vient la lumiere.
    float halo = pow(max(dot(d, normalize(uSoleilDir)), 0.0), 62.0);
    col += uLueur * halo * 0.30 * bas;

    // Etoiles : un semis fixe, scintillement tres leger
    if(uEtoiles > 0.01){
      vec3 p = d * 140.0;
      float n = vnoise(floor(p));
      float e = smoothstep(0.83, 0.995, n);
      float scint = 0.72 + 0.28 * sin(uTemps * 1.7 + n * 40.0);
      col += vec3(0.86, 0.92, 1.0) * e * scint * uEtoiles
             * smoothstep(-0.02, 0.34, d.y);
    }

    // Voile de brume tres haut : evite un ciel trop "propre"
    col = mix(col, uHorizon, smoothstep(0.24, -0.12, d.y) * 0.55);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Ciel {
  constructor(scene, palier) {
    this.scene = scene;
    this.uniforms = {
      uZenith:    { value: new THREE.Color(AMBIANCES.crepuscule.zenith) },
      uHorizon:   { value: new THREE.Color(AMBIANCES.crepuscule.horizon) },
      uLueur:     { value: new THREE.Color(AMBIANCES.crepuscule.lueur) },
      uSoleilDir: { value: new THREE.Vector3(-0.45, 0.34, -0.83).normalize() },
      uEtoiles:   { value: AMBIANCES.crepuscule.etoiles },
      uTemps:     { value: 0 },
    };

    const geo = new THREE.SphereGeometry(1, 32, 20);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: true,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    scene.fog = new THREE.FogExp2(AMBIANCES.crepuscule.brouillard, AMBIANCES.crepuscule.densite);

    /* Etat courant, interpole en continu vers la cible. */
    this.actuel = { ...AMBIANCES.crepuscule };
    this.cible = { ...AMBIANCES.crepuscule };
    this._c1 = new THREE.Color();
    this._c2 = new THREE.Color();
  }

  /* Change d'ambiance en douceur. Rien ne bascule d'un coup. */
  viser(nom) {
    if (AMBIANCES[nom]) this.cible = AMBIANCES[nom];
  }

  maj(dt, temps, camera) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uTemps.value = temps;

    // Interpolation lente : environ 4 secondes pour un changement complet.
    const k = 1 - Math.exp(-0.55 * dt);
    const a = this.actuel, c = this.cible;

    for (const clef of ['zenith', 'horizon', 'lueur', 'brouillard', 'soleil', 'ciel', 'sol']) {
      this._c1.set(a[clef]); this._c2.set(c[clef]);
      this._c1.lerp(this._c2, k);
      a[clef] = this._c1.getHex();
    }
    for (const clef of ['densite', 'etoiles', 'force', 'ambiant']) {
      a[clef] += (c[clef] - a[clef]) * k;
    }

    this.uniforms.uZenith.value.set(a.zenith);
    this.uniforms.uHorizon.value.set(a.horizon);
    this.uniforms.uLueur.value.set(a.lueur);
    this.uniforms.uEtoiles.value = a.etoiles;

    this.scene.fog.color.set(a.brouillard);
    this.scene.fog.density = a.densite;
  }

  /* Carte d'environnement pour les reflets — generee une seule fois.
     Elle sert surtout aux rubans satines des cadeaux et au vernis de glace. */
  environnement(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const scn = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 24, 16);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: THREE.UniformsUtils.clone(this.uniforms),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    scn.add(new THREE.Mesh(geo, mat));

    const cible = pmrem.fromScene(scn, 0, 0.1, 100);
    geo.dispose(); mat.dispose(); pmrem.dispose();
    return cible.texture;
  }
}
