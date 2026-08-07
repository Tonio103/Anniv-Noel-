/* LA NEIGE QUE LE CERF SOULEVE.

   Les empreintes disaient ou il etait passe. Il manquait ce qui se passe A
   L'INSTANT MEME du poser : dans une poudreuse de vingt centimetres, un sabot
   qui tombe projette de la neige. Sans cette projection, l'animal effleure une
   surface dure et toute la matiere du sol s'evanouit — on retombe sur un
   personnage qui glisse au-dessus d'un decor.

   Le systeme est volontairement minuscule et sans allocation : un seul nuage
   de points, une reserve fixe, et un curseur qui tourne. Un poser reveille
   une poignee de grains, rien de plus. C'est aussi ce qui permet de
   l'appeler depuis la boucle sans y penser.

   Trois choix qui font la difference entre de la neige et des etincelles :

   · MELANGE NORMAL, pas additif. De la poudreuse blanche sur un sol blanc
     n'eclaircit rien ; en additif, chaque grain deviendrait un point lumineux
     et la gerbe ressemblerait a une gerbe d'etincelles.
   · LA GRAVITE DOMINE. Une bouffee de neige retombe en moins d'une seconde.
     Au-dela, on lit de la fumee.
   · LE GRAIN GROSSIT EN MOURANT. La poudre se disperse ; un grain qui
     retrecit se lit comme une particule, un grain qui s'etale comme un nuage.
*/

import * as THREE from 'three';

/* Un grain doux, dessine une fois. Un carre net ferait pixel. */
function texGrain() {
  const n = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.62)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Poudre {
  constructor(scene, palier) {
    this.N = palier.nom === 'bas' ? 90 : palier.nom === 'moyen' ? 220 : 380;
    this.parPoser = palier.nom === 'bas' ? 5 : palier.nom === 'moyen' ? 9 : 14;

    const pos = new Float32Array(this.N * 3);
    const taille = new Float32Array(this.N);
    const alpha = new Float32Array(this.N);
    // Hors champ tant qu'un grain n'a pas servi.
    for (let i = 0; i < this.N; i++) pos[i * 3 + 1] = -9999;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aTaille', new THREE.BufferAttribute(taille, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));

    /* Un shader minimal plutot qu'un PointsMaterial : il faut une taille ET
       une opacite PAR GRAIN, sinon toute la bouffee s'eteint d'un bloc et le
       nuage devient un clignotement. */
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: texGrain() },
        uEchelle: { value: 1 },
        uTeinte: { value: new THREE.Color(0xEFF6FF) },
        uBrume: { value: new THREE.Color(0x0A1622) },
        uDensite: { value: 0.012 },
      },
      vertexShader: `
        attribute float aTaille;
        attribute float aAlpha;
        varying float vAlpha;
        varying float vBrume;
        uniform float uEchelle;
        uniform float uDensite;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          /* aTaille est un RAYON EN METRES, pas un nombre de pixels : c'est la
             seule maniere qu'un grain garde la meme taille physique quelle que
             soit la resolution ou l'orientation de l'ecran. uEchelle porte la
             conversion (hauteur du canevas divisee par la tangente du demi
             champ), et la division par la profondeur donne la perspective.

             Le plafond n'est pas cosmetique : un grain qui frole l'objectif
             couvrirait sinon tout l'ecran d'un aplat blanc, ce qui est
             exactement ce qui arrivait quand aTaille etait exprime en pixels. */
          gl_PointSize = min(aTaille * uEchelle / max(-mv.z, 0.35), 110.0);
          // Meme loi de brouillard que la scene : sans elle, les grains
          // lointains restent nets et trahissent le systeme.
          float d = -mv.z;
          vBrume = 1.0 - exp(-uDensite * uDensite * d * d);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        uniform vec3 uTeinte;
        uniform vec3 uBrume;
        varying float vAlpha;
        varying float vBrume;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(mix(uTeinte, uBrume, clamp(vBrume, 0.0, 1.0)), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);

    this.mat = mat;
    this.geo = geo;
    this.pos = pos;
    this.taille = taille;
    this.alpha = alpha;
    this.vit = new Float32Array(this.N * 3);
    this.pic = new Float32Array(this.N);
    this.vie = new Float32Array(this.N);
    this.duree = new Float32Array(this.N);
    this.curseur = 0;
    this.vivants = 0;
  }

  /* Un sabot vient de se poser en (x, y, z). `dx, dz` est la direction de
     marche : la neige part surtout VERS L'ARRIERE, comme elle est chassee. */
  poser(x, y, z, dx, dz, force = 1) {
    const n = Math.max(2, Math.round(this.parPoser * (0.45 + force * 0.75)));
    for (let k = 0; k < n; k++) {
      const i = this.curseur;
      this.curseur = (this.curseur + 1) % this.N;

      /* Dispersion initiale plus large. Quatorze grains laches dans un rayon
         de neuf centimetres se recouvrent presque tous, et quatorze disques
         translucides empiles font un disque opaque : la gerbe sortait en
         boule de coton blanche collee au sabot, pas en poudre. On les etale,
         et on baisse l'opacite de chacun — c'est le meme defaut que la buee
         des naseaux, ou vingt-six couches a dix-huit pour cent faisaient une
         plaque. Une poudreuse se lit a la SOMME de grains distincts. */
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.19;
      this.pos[i * 3] = x + Math.cos(a) * r;
      this.pos[i * 3 + 1] = y + 0.02 + Math.random() * 0.09;
      this.pos[i * 3 + 2] = z + Math.sin(a) * r;

      /* Une composante radiale faible, une composante arriere forte, et de la
         hauteur. C'est ce desequilibre qui fait "chasse" plutot que
         "explosion" : une gerbe symetrique se lit comme un impact. */
      const haut = (0.85 + Math.random() * 1.35) * force;
      const lat = (Math.random() - 0.5) * 0.9 * force;
      const arr = (0.35 + Math.random() * 0.95) * force;
      this.vit[i * 3] = Math.cos(a) * Math.abs(lat) * Math.sign(lat || 1) - dx * arr;
      this.vit[i * 3 + 1] = haut;
      this.vit[i * 3 + 2] = Math.sin(a) * Math.abs(lat) * Math.sign(lat || 1) - dz * arr;

      this.duree[i] = 0.42 + Math.random() * 0.46;
      this.vie[i] = this.duree[i];
      // Rayon en metres : un flocon chasse fait quatre a douze centimetres.
      this.taille[i] = (0.030 + Math.random() * 0.055) * (0.7 + force * 0.5);
      /* Opacite MAXIMALE de ce grain-la. C'est une valeur par grain, et non
         une constante appliquee a tous, parce que maj() reecrit `alpha` a
         chaque image : fixer l'opacite au lancement ne servait a rien, elle
         etait ecrasee des la premiere frame par une courbe commune a 0,85. */
      this.pic[i] = 0.15 + Math.random() * 0.17;
      this.alpha[i] = this.pic[i];
    }
    this.vivants = 1;
  }

  maj(dt, sol) {
    if (!this.vivants) return;
    let reste = 0;
    for (let i = 0; i < this.N; i++) {
      if (this.vie[i] <= 0) continue;
      reste++;
      this.vie[i] -= dt;
      const u = 1 - this.vie[i] / this.duree[i];   // 0 au depart, 1 a la fin

      this.vit[i * 3 + 1] -= 6.4 * dt;             // la pesanteur mene
      const frein = 1 - 2.6 * dt;                  // l'air freine vite la poudre
      this.vit[i * 3] *= frein;
      this.vit[i * 3 + 2] *= frein;

      this.pos[i * 3] += this.vit[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vit[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vit[i * 3 + 2] * dt;

      // Le grain s'etale en s'eteignant : une poudre se disperse.
      this.taille[i] *= 1 + 0.9 * dt;
      this.alpha[i] = (1 - u) * (1 - u) * this.pic[i];

      // Retombee : il se couche au sol au lieu de le traverser.
      const y0 = sol ? sol(this.pos[i * 3], this.pos[i * 3 + 2]) : 0;
      if (this.pos[i * 3 + 1] < y0 + 0.012) {
        this.pos[i * 3 + 1] = y0 + 0.012;
        this.vit[i * 3 + 1] = 0;
        this.vit[i * 3] *= 0.5;
        this.vit[i * 3 + 2] *= 0.5;
      }

      if (this.vie[i] <= 0) {
        this.alpha[i] = 0;
        this.pos[i * 3 + 1] = -9999;
      }
    }
    this.vivants = reste;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aTaille.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  /* Conversion metres → pixels. Pour un champ vertical de 2·a, un objet de
     rayon r a la distance d couvre r·H/(d·tan a) pixels : uEchelle porte donc
     H/tan(a), et le shader se charge de la division par d. */
  redimensionner(hauteurPx, fovDeg = 58) {
    const a = (fovDeg * Math.PI) / 360;
    this.mat.uniforms.uEchelle.value = hauteurPx / Math.tan(a);
  }

  /* On reprend la couleur et la densite du brouillard de la scene : c'est la
     seule facon que la poudre lointaine se fonde comme le reste. */
  accorder(fog) {
    if (!fog) return;
    this.mat.uniforms.uBrume.value.copy(fog.color);
    this.mat.uniforms.uDensite.value = fog.density;
  }
}
