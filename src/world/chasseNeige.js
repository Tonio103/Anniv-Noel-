/* LE CHASSE-NEIGE.

   Quand une rafale se leve, les sapins se couchent, la neige qui tombe file
   a l'horizontale — et le sol, lui, ne bougeait pas. Or c'est au ras du sol
   que le vent se voit le mieux sur une neige poudreuse : il arrache la
   couche de surface et la fait courir en longues trainees basses, qui
   serpentent, s'enroulent autour des bosses et retombent un peu plus loin.
   Le « chasse-neige » des montagnards. Sans lui, la bourrasque n'est qu'un
   evenement du ciel ; avec lui, elle touche le monde.

   Ce sont des TRAINEES, pas des grains : chaque particule est un ruban
   etire dans le sens du vent, long d'un metre environ — la duree
   d'exposition de l'oeil sur un grain qui file a cinq metres par seconde.
   Un point rond, a cette vitesse, se lirait comme de la grele.

   Tout est sur le processeur, et c'est volontaire : il faut la hauteur du
   sol sous chaque trainee, et le relief ne se lit que la. On ne l'interroge
   donc qu'a la naissance d'une trainee puis toutes les quarts de seconde,
   par petits lots — une dizaine d'appels par image au plus. Les trainees ne
   naissent que dans la bande de terrain que la camera voit, devant elle. */

import * as THREE from 'three';

/* Un ruban doux : opaque au centre, fondu sur les bords et plus encore a la
   queue qu'a la tete. */
function texTrainee() {
  const w = 64, h = 16;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const img = c.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1), v = y / (h - 1);
      const travers = Math.exp(-Math.pow((v - 0.5) / 0.22, 2));
      const long = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 1.4);
      const a = travers * long;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ChasseNeige {
  constructor(scene, palier, relief) {
    this.relief = relief;
    this.N = palier.nom === 'bas' ? 70 : palier.nom === 'moyen' ? 120 : 180;
    const N = this.N;
    this.pos = new Float32Array(N * 3);       // tete de la trainee
    this.vit = new Float32Array(N * 3);
    this.sol = new Float32Array(N);           // hauteur du sol, relue de temps en temps
    this.haut = new Float32Array(N);          // hauteur au-dessus du sol
    this.vie = new Float32Array(N);
    this.duree = new Float32Array(N);
    this.long = new Float32Array(N);
    this.larg = new Float32Array(N);
    this.relu = new Float32Array(N);
    this.phase = new Float32Array(N);

    const sommets = new Float32Array(N * 4 * 3);
    const uv = new Float32Array(N * 4 * 2);
    const coul = new Float32Array(N * 4 * 4);
    const idx = [];
    for (let i = 0; i < N; i++) {
      uv.set([0, 0, 0, 1, 1, 1, 1, 0], i * 8);
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(sommets, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(coul, 4));
    geo.setIndex(idx);
    this.geo = geo;

    const mat = new THREE.MeshBasicMaterial({
      map: texTrainee(), color: 0xEAF2FF, vertexColors: true, transparent: true,
      depthWrite: false, side: THREE.DoubleSide, fog: true,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);

    this._dir = new THREE.Vector2(1, 0);
    this._av = new THREE.Vector3();
    this._perp = new THREE.Vector3();
    this._vue = new THREE.Vector3();
    this._reserve = 0;
    this._curseur = 0;
  }

  _naitre(i, camera, rafale) {
    /* Dans la bande que la camera regarde : entre six et trente metres
       devant elle, sur une largeur qui s'ouvre avec la distance. */
    camera.getWorldDirection(this._av);
    this._av.y = 0; this._av.normalize();
    const loin = 6 + Math.random() * 24;
    const cote = (Math.random() - 0.5) * (4 + loin * 0.9);
    const x = camera.position.x + this._av.x * loin - this._av.z * cote;
    const z = camera.position.z + this._av.z * loin + this._av.x * cote;
    const sol = this.relief.hauteur(x, z);
    this.pos[i * 3] = x; this.pos[i * 3 + 2] = z;
    this.sol[i] = sol;
    // Tres bas surtout : la plupart rasent la neige, quelques-unes montent.
    this.haut[i] = 0.03 + Math.pow(Math.random(), 2.4) * 0.45;
    this.pos[i * 3 + 1] = sol + this.haut[i];
    const v = 3.2 + Math.random() * 2.5 + rafale * 3.5;
    this.vit[i * 3] = this._dir.x * v;
    this.vit[i * 3 + 2] = this._dir.y * v;
    this.vit[i * 3 + 1] = 0;
    this.duree[i] = 0.7 + Math.random() * 1.1;
    this.vie[i] = this.duree[i];
    this.long[i] = 0.5 + Math.random() * 1.1 + rafale * 0.6;
    this.larg[i] = 0.05 + Math.random() * 0.09;
    this.relu[i] = Math.random() * 0.25;
    this.phase[i] = Math.random() * 6.28;
  }

  /* `rafale` : 0 a 1, la meme valeur que lisent les sapins et la neige.
     `vent` : sa direction (uVent). */
  maj(dt, temps, camera, rafale, vent) {
    dt = dt > 0 ? Math.min(dt, 0.1) : 0;
    if (vent) this._dir.set(vent.x, vent.y).normalize();
    /* Rien sous une brise : le chasse-neige demande un vrai coup de vent. */
    const force = Math.max(0, (rafale - 0.28) / 0.72);
    this._reserve += dt * force * this.N * 1.1;

    let vivantes = 0;
    const N = this.N;
    for (let i = 0; i < N; i++) {
      if (this.vie[i] > 0) continue;
      if (this._reserve < 1) break;
      this._reserve -= 1;
      this._naitre(i, camera, rafale);
    }
    if (this._reserve > 3) this._reserve = 3;

    const P = this.geo.attributes.position.array;
    const C = this.geo.attributes.color.array;
    const cam = camera.position;
    let relectures = 0;
    for (let i = 0; i < N; i++) {
      const o = i * 12, oc = i * 16;
      if (this.vie[i] <= 0) {
        // Replie sur place, transparent : invisible et sans cout de pixel.
        for (let k = 0; k < 16; k++) C[oc + k] = 0;
        continue;
      }
      vivantes++;
      this.vie[i] -= dt;
      const x = this.pos[i * 3] + this.vit[i * 3] * dt;
      const z = this.pos[i * 3 + 2] + this.vit[i * 3 + 2] * dt;
      this.pos[i * 3] = x; this.pos[i * 3 + 2] = z;
      // Le sol, relu par lots : jamais plus d'une dizaine d'appels par image.
      this.relu[i] -= dt;
      if (this.relu[i] <= 0 && relectures < 10) {
        this.relu[i] = 0.25; relectures++;
        this.sol[i] = this.relief.hauteur(x, z);
      }
      // Elle ondule en courant : les trainees serpentent, elles ne volent pas droit.
      const ond = Math.sin(temps * 5.5 + this.phase[i]) * 0.04;
      const y = this.sol[i] + this.haut[i] + ond;
      this.pos[i * 3 + 1] = y;

      /* Le ruban, etire du point courant vers l'arriere du mouvement, et
         tourne face a la camera autour de son propre axe. */
      const L = this.long[i], W = this.larg[i];
      const ax = -this._dir.x, az = -this._dir.y;
      this._vue.set(cam.x - x, cam.y - y, cam.z - z).normalize();
      // perp = axe × vue
      this._perp.set(0 * this._vue.z - az * this._vue.y, az * this._vue.x - ax * this._vue.z, ax * this._vue.y - 0 * this._vue.x);
      if (this._perp.lengthSq() < 1e-6) this._perp.set(0, 1, 0);
      this._perp.normalize().multiplyScalar(W);
      const qx = x + ax * L, qz = z + az * L;
      P[o] = x - this._perp.x;  P[o + 1] = y - this._perp.y;  P[o + 2] = z - this._perp.z;
      P[o + 3] = x + this._perp.x; P[o + 4] = y + this._perp.y; P[o + 5] = z + this._perp.z;
      P[o + 6] = qx + this._perp.x; P[o + 7] = y + this._perp.y; P[o + 8] = qz + this._perp.z;
      P[o + 9] = qx - this._perp.x; P[o + 10] = y - this._perp.y; P[o + 11] = qz - this._perp.z;

      const u = 1 - this.vie[i] / this.duree[i];
      const a = Math.sin(Math.PI * u) * 0.34 * (0.5 + 0.5 * force);
      for (let k = 0; k < 4; k++) {
        C[oc + k * 4] = 1; C[oc + k * 4 + 1] = 1; C[oc + k * 4 + 2] = 1; C[oc + k * 4 + 3] = a;
      }
    }
    this.mesh.visible = vivantes > 0;
    if (vivantes) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }
}
