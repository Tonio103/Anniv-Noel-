/* La brume basse.

   Le brouillard exponentiel de la scene teinte les lointains, mais il est
   parfaitement homogene : il ne se voit pas, il se subit. Ce qu'on percoit
   comme "de la brume", ce sont des NAPPES — des bancs irreguliers qui
   trainent au ras de la neige, s'effilochent entre les troncs et derivent
   lentement. C'est ce que fait ce module, et il ne fait que ca.

   Realisation : quelques grands plans horizontaux empiles a faible hauteur,
   qui suivent la camera. Chacun porte un bruit fractal anime, echantillonne
   en coordonnees MONDE et non ecran — sans quoi la brume collerait a
   l'objectif et trahirait le procede des le premier mouvement.

   Trois precautions, chacune indispensable :
   · la nappe s'efface a l'approche de l'objectif, sinon on traverse un mur
     laiteux a chaque pas ;
   · elle s'efface aussi au loin, ou le brouillard exponentiel prend le
     relais — les superposer donnerait une bouillie opaque ;
   · elle est plus dense en contrebas qu'en hauteur, comme de l'air froid
     qui stagne dans les creux.
*/

import * as THREE from 'three';
import { GLSL_NOISE } from '../core/noise.js';

const BLANC = new THREE.Color(0xFFFFFF);

const VERT = /* glsl */ `
  varying vec3 vMonde;
  void main(){
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMonde = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vMonde;
  uniform vec3 uCouleur;
  uniform float uTemps, uDensite, uEchelle, uHauteur, uPresProche, uPresLoin;

  ${GLSL_NOISE}

  void main(){
    // Bruit en coordonnees monde : la nappe reste accrochee au paysage.
    vec3 q = vec3(vMonde.x, vMonde.z, uHauteur) * uEchelle;
    q.x += uTemps * 0.035;                 // derive lente du banc
    q.y -= uTemps * 0.021;

    float n = fbm3(q) * 0.5 + 0.5;
    // Un seuil franc decoupe des bancs au lieu d'un voile uniforme.
    float banc = smoothstep(0.42, 0.86, n);

    vec3 versCam = cameraPosition - vMonde;
    float d = length(versCam);

    /* Attenuation par l'angle de vue. C'est LA correction qui rend la nappe
       utilisable : un plan horizontal regarde de biais offre une profondeur
       optique gigantesque, et se transforme en mur laiteux des qu'on abaisse
       le regard. On pondere donc par l'inclinaison — vue rasante, presque
       rien ; vue de dessus, densite nominale. */
    // L'exposant dose l'effet : trop eleve, la brume disparait a hauteur
    // d'oeil ; trop bas, elle redevient un mur des qu'on baisse le regard.
    float face = pow(clamp(abs(versCam.y) / max(d, 1e-3), 0.0, 1.0), 0.50);
    // Plancher : meme vue de biais, il reste un voile — sinon la nappe
    // n'existe qu'en plongee et la balade n'en voit jamais rien.
    face = max(face, 0.16);
    // Devant l'objectif : on s'efface, sinon on traverse un mur.
    float pres = smoothstep(uPresProche, uPresProche * 3.0, d);
    // Au loin : le brouillard exponentiel prend le relais.
    float loin = 1.0 - smoothstep(uPresLoin * 0.55, uPresLoin, d);

    float a = banc * uDensite * pres * loin * face;
    if(a < 0.004) discard;
    gl_FragColor = vec4(uCouleur, a);
  }
`;

export class Brume {
  constructor(scene, palier) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'brume';
    this.nappes = [];

    /* Peu de nappes, bien etagees. En empiler davantage ne rend pas la brume
       plus belle : ca la rend opaque et ca coute cher en remplissage. */
    const etages = palier.nom === 'bas'
      ? [{ h: 0.5, d: 0.40 }, { h: 1.6, d: 0.26 }]
      : [{ h: 0.35, d: 0.40 }, { h: 1.0, d: 0.30 }, { h: 1.9, d: 0.21 }, { h: 3.1, d: 0.13 }];

    const geo = new THREE.PlaneGeometry(190, 190, 1, 1);
    geo.rotateX(-Math.PI / 2);

    for (const e of etages) {
      const uniforms = {
        uCouleur: { value: new THREE.Color(0xC8D8E8) },
        uTemps: { value: 0 },
        uDensite: { value: e.d },
        uEchelle: { value: 0.021 },
        uHauteur: { value: e.h * 3.1 },     // decale le bruit d'un etage a l'autre
        uPresProche: { value: 6.0 },
        uPresLoin: { value: 96.0 },
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, uniforms,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      // Apres le decor, avant la neige qui tombe.
      m.renderOrder = 6;
      this.groupe.add(m);
      this.nappes.push({ mesh: m, uniforms, hauteur: e.h });
    }

    scene.add(this.groupe);
  }

  maj(dt, temps, camera, relief, ambiance) {
    const sol = relief ? relief.hauteur(camera.position.x, camera.position.z) : 0;
    for (const n of this.nappes) {
      n.mesh.position.set(camera.position.x, sol + n.hauteur, camera.position.z);
      n.uniforms.uTemps.value = temps;
      // La brume emprunte sa teinte au brouillard : les deux doivent parler
      // de la meme atmosphere, sinon la nappe se detache comme un calque.
      if (ambiance) n.uniforms.uCouleur.value.set(ambiance.brouillard).lerp(
        BLANC, 0.30
      );
    }
  }

  /* Epaissit ou allege la brume — les clairieres en portent moins. */
  densite(k) {
    for (let i = 0; i < this.nappes.length; i++) {
      const base = [0.40, 0.30, 0.21, 0.13][i] ?? 0.15;
      this.nappes[i].uniforms.uDensite.value = base * k;
    }
  }
}
