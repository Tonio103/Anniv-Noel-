/* Le shader de la neige.

   C'est la surface qui occupe le plus de pixels : si elle est ratee, rien
   d'autre ne rattrape la scene. Quatre choses la rendent credible, et elles
   sont toutes indispensables :

   1. le SCINTILLEMENT — des micro-cristaux qui accrochent la lumiere selon
      l'angle de vue. C'est le detail qui, a lui seul, fait dire "neige"
      plutot que "plastique blanc" ;
   2. la DIFFUSION SOUS LA SURFACE — la neige laisse passer la lumiere, donc
      les zones a contre-jour ne sont jamais noires. On l'approche par un
      eclairage enveloppant, plus large que le simple N·L ;
   3. les OMBRES BLEUES — dans une ombre, la neige n'est eclairee que par le
      ciel. Elle vire donc au bleu, jamais au gris ;
   4. le RELIEF FIN — de petites ondulations sculptees par le vent, ajoutees
      par perturbation de la normale plutot qu'en geometrie.

   On part de MeshStandardMaterial et on l'augmente : on garde ainsi les
   ombres portees, le brouillard et l'exposition ACES sans les reecrire.
*/

import * as THREE from 'three';
import { GLSL_NOISE } from '../core/noise.js';

export function creerNeige(palier, { empreintes = null, emprise = null } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xE8F0F8,
    roughness: 0.86,
    metalness: 0.0,
    dithering: true,
  });

  const u = {
    uSoleilDir:  { value: new THREE.Vector3(-0.45, 0.34, -0.83).normalize() },
    uSoleilCol:  { value: new THREE.Color(0xFFD2A0) },
    uCielCol:    { value: new THREE.Color(0x7A9CBC) },
    uScintille:  { value: palier.nom === 'bas' ? 0.55 : 1.0 },
    uEmpreintes: { value: empreintes },
    uEmpMin:     { value: new THREE.Vector2(emprise ? emprise.xmin : 0, emprise ? emprise.zmin : 0) },
    uEmpTaille:  { value: new THREE.Vector2(
                    emprise ? emprise.xmax - emprise.xmin : 1,
                    emprise ? emprise.zmax - emprise.zmin : 1) },
    uAEmpreintes:{ value: empreintes ? 1.0 : 0.0 },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vMonde;
      `)
      .replace('#include <project_vertex>', `
        #include <project_vertex>
        vMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vMonde;
        uniform vec3 uSoleilDir, uSoleilCol, uCielCol;
        uniform float uScintille, uAEmpreintes;
        uniform sampler2D uEmpreintes;
        uniform vec2 uEmpMin, uEmpTaille;
        ${GLSL_NOISE}

        vec2 uvEmpreinte(vec3 p){
          return (p.xz - uEmpMin) / uEmpTaille;
        }
      `)

      /* --- relief fin et empreintes : on agit sur la normale ------------- */
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        {
          // Ondulations sculptees par le vent. Elles doivent rester DISCRETES :
          // trop marquees, la neige se met a ressembler a de l'eau. On les
          // attenue aussi avec la distance, sinon elles scintillent au loin.
          float distN = length(cameraPosition - vMonde);
          float pres = smoothstep(120.0, 14.0, distN);

          // Grande echelle : les congeres allongees par le vent dominant.
          // L'axe X est etire pour donner une direction au modele.
          float e = 0.5;
          vec3 q = vMonde * vec3(0.10, 0.30, 0.30);
          float h0 = fbm3(q);
          float hx = fbm3(q + vec3(e * 0.10, 0.0, 0.0));
          float hz = fbm3(q + vec3(0.0, 0.0, e * 0.30));
          vec3 ondul = vec3(h0 - hx, 0.0, h0 - hz) * 0.42;

          // Petite echelle : le grain de la croute, visible de pres seulement.
          vec3 q2 = vMonde * 2.1;
          float g0 = vnoise(q2);
          float gx = vnoise(q2 + vec3(0.26, 0.0, 0.0));
          float gz = vnoise(q2 + vec3(0.0, 0.0, 0.26));
          ondul += vec3(g0 - gx, 0.0, g0 - gz) * 0.20 * pres;

          normal = normalize(normal + ondul * pres);

          // Empreintes : la neige est tassee, donc plus sombre et inclinee
          // vers l'interieur du creux.
          if(uAEmpreintes > 0.5){
            vec2 fu = uvEmpreinte(vMonde);
            if(fu.x > 0.0 && fu.x < 1.0 && fu.y > 0.0 && fu.y < 1.0){
              float d = texture2D(uEmpreintes, fu).r;
              if(d > 0.002){
                vec2 px = 1.0 / uEmpTaille * 1.6;
                float dx = texture2D(uEmpreintes, fu + vec2(px.x, 0.0)).r - d;
                float dz = texture2D(uEmpreintes, fu + vec2(0.0, px.y)).r - d;
                normal = normalize(normal + vec3(dx, 0.0, dz) * 26.0);
                diffuseColor.rgb *= mix(1.0, 0.74, clamp(d, 0.0, 1.0));
              }
            }
          }
        }
      `)

      /* --- diffusion, ombres bleues et scintillement --------------------- */
      .replace('#include <opaque_fragment>', `
        {
          vec3 V = normalize(cameraPosition - vMonde);
          vec3 L = normalize(uSoleilDir);
          float dist = length(cameraPosition - vMonde);

          // 1. Diffusion sous la surface : eclairage enveloppant. Le terme
          //    deborde derriere le terminateur, comme dans la vraie neige.
          float nl = dot(normal, L);
          float envelop = clamp((nl + 0.62) / 1.62, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * uSoleilCol * pow(envelop, 1.7) * 0.30;

          // 2. Lumiere du ciel rasante : c'est elle qui bleuit les creux.
          float versCiel = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * uCielCol * versCiel * 0.16;

          // 3. Reflet satine aux angles rasants — la croute de neige tassee.
          float fres = pow(1.0 - clamp(dot(normal, V), 0.0, 1.0), 4.2);
          outgoingLight += uCielCol * fres * 0.11;

          // 4. Scintillement : chaque cellule porte un cristal oriente au
          //    hasard. Seule une minorite renvoie vers l'oeil, d'ou l'aspect
          //    granuleux et mouvant quand on se deplace.
          if(uScintille > 0.01){
            float att = smoothstep(78.0, 6.0, dist);
            if(att > 0.01){
              vec3 cell = floor(vMonde * 30.0);
              vec3 rnd = hash33(cell);
              float actif = step(0.58, rnd.z);
              vec3 nc = normalize(normal + rnd * 0.9);
              float sp = pow(max(dot(reflect(-V, nc), L), 0.0), 190.0);
              outgoingLight += uSoleilCol * sp * actif * att * 2.6 * uScintille;
            }
          }
        }
        #include <opaque_fragment>
      `);

    mat.userData.shader = shader;
  };

  // Force la recompilation si un parametre change de type.
  mat.customProgramCacheKey = () => 'neige' + (empreintes ? '-emp' : '');
  mat.userData.uniforms = u;
  return mat;
}

/* Tient le shader accorde a l'ambiance courante du ciel. */
export function accorderNeige(mat, ambiance, dirSoleil) {
  const u = mat.userData.uniforms;
  if (!u) return;
  u.uSoleilCol.value.set(ambiance.soleil);
  u.uCielCol.value.set(ambiance.ciel);
  if (dirSoleil) u.uSoleilDir.value.copy(dirSoleil);
}
