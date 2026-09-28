/* LES CRETES LOINTAINES.

   Au-dessus de la lisiere, il n'y avait que le ciel : le degrade descendait
   jusqu'aux cimes des derniers sapins, et derriere eux, plus rien. Une foret
   posee sur le bord du monde. Dans une clairiere — c'est-a-dire la ou le
   regard porte enfin — c'etait le plus visible : la balade entiere se
   deroulait sur un plateau sans horizon.

   Ce qui donne la PROFONDEUR a un paysage d'hiver, ce sont les plans
   successifs : des crêtes de plus en plus pales a mesure qu'elles
   s'eloignent, chacune un peu plus mangee par l'air que la precedente. La
   perspective aerienne, en peinture ; chaque plan est une marche, et c'est le
   nombre de marches qui fait la distance.

   Deux plans ici, en anneaux autour de la camera : trop loin pour qu'on
   percoive leur parallaxe, ils la suivent comme le dome du ciel. Leur profil
   est une somme de sinus a frequences ENTIERES en azimut — donc
   parfaitement periodique, sans couture a l'endroit ou l'anneau se referme.

   Leur couleur n'est pas celle du brouillard de la scene. A quatre cents
   metres, le brouillard exponentiel les rendrait exactement de sa couleur,
   c'est-a-dire invisibles — ce qui serait physiquement juste et
   picturalement vide. On les teinte donc entre l'horizon du ciel et une
   ombre bleue plus dense, a la maniere d'un peintre qui pose des lavis :
   le plan proche plus sombre, le plan lointain plus pres du ciel. Les
   sommets tournes vers la lune accrochent un peu de clarte — de la neige
   sur les aretes — et le pied de chaque plan se noie dans une brume de
   vallee. */

import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aHaut;      // 0 au pied, 1 a la crete
  attribute float aAzimut;
  varying float vHaut;
  varying float vAzimut;
  varying vec3 vDir;
  void main() {
    vHaut = aHaut;
    vAzimut = aAzimut;
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying float vHaut;
  varying float vAzimut;
  varying vec3 vDir;
  uniform vec3 uHorizon, uZenith, uLune;
  uniform vec3 uLuneDir;
  uniform float uPlan;        // 0 = lointain, 1 = proche

  void main() {
    vec3 d = normalize(vDir);
    /* Le ciel juste derriere, recalcule comme le fait sky.js (degrade et
       voile bas) : c'est vers LUI que l'air repousse chaque plan. Une
       premiere version melait l'horizon et le zenith sans en tenir compte :
       les crêtes sortaient plus claires que le ciel qu'elles masquaient, et
       se lisaient comme une bande pale et plate. */
    vec3 ciel = mix(uHorizon, uZenith, pow(clamp(d.y, 0.0, 1.0), 0.42));
    ciel = mix(ciel, uHorizon, smoothstep(0.24, -0.12, d.y) * 0.55);

    /* La montagne elle-meme depend de la lune. Face a elle — la ou regarde
       la camera pendant presque toute la balade, puisque la scene est en
       contre-jour —, on voit son versant a l'ombre : une silhouette sombre.
       Dos a elle, la neige des versants eclaires : un gris bleu pale. */
    float versLune = max(dot(normalize(vec3(d.x, 0.0, d.z)),
                             normalize(vec3(uLuneDir.x, 0.0, uLuneDir.z))), 0.0);
    vec3 sombre = uHorizon * 0.50 + uZenith * 0.30;
    vec3 clair = uHorizon * 0.92 + uLune * 0.07;
    vec3 col = mix(clair, sombre, smoothstep(-0.2, 0.7, versLune));

    /* Les aretes accrochent la lune, meme a contre-jour : un lisere fin
       sur la crete, haché par les ravines. */
    float ravines = 0.5 + 0.5 * sin(vAzimut * 210.0 + sin(vAzimut * 41.0) * 3.0);
    float arete = smoothstep(0.93, 1.0, vHaut) * (0.4 + 0.6 * ravines);
    col += uLune * arete * 0.05 * (0.4 + 0.6 * versLune);

    /* La perspective aerienne : le plan lointain est plus mange par l'air
       que le proche. C'est l'ecart entre les deux qui fait la distance. */
    col = mix(col, ciel, mix(0.55, 0.30, uPlan));
    // Et la brume de vallee noie le pied de chaque plan.
    col = mix(ciel, col, smoothstep(0.35, 0.75, vHaut));

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* Profil periodique d'un plan : des aretes, pas des collines. On somme des
   « sinus plies » (1 - |sin|, qui fait des pointes vers le haut) a des
   frequences entieres en azimut, donc sans couture. `rugosite` dose les
   dents fines : en portrait, le cadre ne montre qu'un dixieme de l'anneau,
   et ce sont elles seules qui s'y lisent. */
function profil(a, graine, rugosite) {
  let h = 0, amp = 1, somme = 0;
  const freqs = [3, 5, 8, 13, 21, 34, 55, 89];
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i];
    const pli = 1 - Math.abs(Math.sin(a * f * 0.5 + graine * (i + 1) * 1.7));
    h += pli * pli * amp;
    somme += amp;
    amp *= rugosite;
  }
  return h / somme;
}

export class Cretes {
  constructor(scene, ciel) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'cretes';
    this.plans = [];
    /* [rayon, hauteur de base, hauteur des cretes, graine, rugosite]. Les
       angles au-dessus de l'oeil vont de 5 a 14 degres : assez pour passer
       au-dessus d'une lisiere vue depuis une clairiere, pas assez pour
       fermer le ciel. */
    const PLANS = [
      [540, 30, 120, 0.7, 0.72],
      [400, 12, 78, 2.9, 0.78],
    ];
    const N = 320;
    PLANS.forEach(([R, base, crete, graine, rug], k) => {
      const pos = new Float32Array((N + 1) * 2 * 3);
      const haut = new Float32Array((N + 1) * 2);
      const azi = new Float32Array((N + 1) * 2);
      const idx = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const x = Math.cos(a) * R, z = Math.sin(a) * R;
        const h = base + profil(a, graine, rug) * crete;
        // Pied bien sous l'horizon : il ne doit jamais laisser voir le ciel
        // par-dessous, quelle que soit la hauteur de la camera.
        pos.set([x, -60, z], (i * 2) * 3);
        pos.set([x, h, z], (i * 2 + 1) * 3);
        haut[i * 2] = 0; haut[i * 2 + 1] = 1;
        azi[i * 2] = a; azi[i * 2 + 1] = a;
        if (i < N) {
          const b = i * 2;
          idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aHaut', new THREE.BufferAttribute(haut, 1));
      geo.setAttribute('aAzimut', new THREE.BufferAttribute(azi, 1));
      geo.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG,
        uniforms: {
          // Les couleurs du ciel lui-meme : les crêtes changent avec lui.
          uHorizon: ciel.uniforms.uHorizon,
          uZenith: ciel.uniforms.uZenith,
          uLuneDir: ciel.uniforms.uSoleilDir,
          uLune: { value: new THREE.Color(0xDCE8FF) },
          uPlan: { value: k },
        },
        side: THREE.DoubleSide,
        depthWrite: true,
        fog: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      // Juste apres le ciel, avant tout le reste : les sapins passent devant.
      m.renderOrder = -900 + k;
      this.groupe.add(m);
      this.plans.push(m);
    });
    scene.add(this.groupe);
  }

  /* L'anneau suit la camera a l'horizontale ; en hauteur il reste pose sur
     le monde, sinon il monterait et descendrait avec chaque bosse. */
  maj(camera, solY = 0) {
    this.groupe.position.set(camera.position.x, solY, camera.position.z);
  }
}
