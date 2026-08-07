/* Les cabanes.

   Il en faut TRES peu — trois sur tout le parcours — et c'est justement leur
   rarete qui les rend precieuses. Une fenetre allumee apercue entre deux
   troncs, loin du chemin, en dit plus sur la solitude de la foret que
   n'importe quel effet : elle prouve qu'il y a un ailleurs, et que quelqu'un
   y attend.

   Elles ne sont donc jamais sur le passage. Elles se devinent a vingt ou
   trente metres, a demi mangees par la brume, et la lueur chaude de leurs
   fenetres tranche sur le bleu de la neige. C'est le seul point chaud du
   paysage avant la clairiere finale.

   Construction volontairement sobre : des volumes simples, une toiture
   enneigee, deux carreaux emissifs et un filet de fumee. Vues d'aussi loin,
   plus de detail ne se verrait pas.
*/

import * as THREE from 'three';
import { grainRond, lueurDiffuse } from '../core/dot.js';
import { rng } from '../core/noise.js';

/* La meme lueur diffuse que partout ailleurs : peinte pixel par pixel, sans
   arret de degrade, donc sans anneau de Mach et sans contour. */
function halo() {
  return lueurDiffuse();
}

function construireCabane(rand, palier, texHalo) {
  const g = new THREE.Group();

  const L = 3.8 + rand() * 1.3;          // largeur de facade
  const P = 3.2 + rand() * 0.9;          // profondeur
  const H = 2.2 + rand() * 0.4;          // hauteur des murs

  /* Le bois d'un chalet n'est pas noir : c'est un brun chaud, use, qui
     accroche la moindre lumiere. Un bois trop sombre transforme le chalet
     en cube d'ombre et annule tout l'interet — la cabane doit se lire comme
     un abri, donc comme quelque chose de chaud. */
  const bois = new THREE.MeshStandardMaterial({ color: 0x5A3D28, roughness: 0.93 });
  const boisSombre = new THREE.MeshStandardMaterial({ color: 0x3A2718, roughness: 0.95 });
  const neige = new THREE.MeshStandardMaterial({ color: 0xE8F0F8, roughness: 0.80 });

  /* --- LES MURS EN RONDINS ------------------------------------------------
     C'est ce qui fait un chalet plutot qu'une remise. Une facade lisse peut
     etre n'importe quel batiment ; des rondins empiles horizontalement, avec
     leurs BOUTS QUI SE CROISENT AUX ANGLES, ne peuvent etre qu'un chalet de
     montagne. Ce croisement aux angles est le detail le plus reconnaissable
     de tous, et il se voit encore a trente metres parce qu'il decoupe la
     silhouette au lieu de la texturer. */
  const rRondin = 0.13;
  const nRangs = Math.max(5, Math.round(H / (rRondin * 1.85)));
  for (let i = 0; i < nRangs; i++) {
    const y = rRondin + i * (H - rRondin * 2) / (nRangs - 1);
    // Rangs avant/arriere, puis gauche/droite : ils alternent, comme empiles.
    const paire = i % 2 === 0;
    const dep = paire ? rRondin * 1.7 : 0;

    for (const sgn of [1, -1]) {
      const av = new THREE.Mesh(
        new THREE.CylinderGeometry(rRondin, rRondin, L + (paire ? rRondin * 3.4 : 0), 6),
        i % 3 === 0 ? boisSombre : bois
      );
      av.rotation.z = Math.PI / 2;
      av.position.set(0, y, sgn * P / 2);
      av.castShadow = palier.ombres;
      g.add(av);

      const cot = new THREE.Mesh(
        new THREE.CylinderGeometry(rRondin, rRondin, P + (paire ? 0 : rRondin * 3.4), 6),
        i % 3 === 1 ? boisSombre : bois
      );
      cot.rotation.x = Math.PI / 2;
      cot.position.set(sgn * L / 2, y + rRondin * 0.9, 0);
      cot.castShadow = palier.ombres;
      g.add(cot);
    }
    void dep;
  }

  // Le pignon plein au-dessus des rondins, sous les rampants du toit.
  for (const sgn of [1, -1]) {
    const pignon = new THREE.Mesh(new THREE.BufferGeometry(), bois);
    const hp = P * 0.42;
    const v = new Float32Array([
      -L / 2, 0, 0, L / 2, 0, 0, 0, hp, 0,
    ]);
    pignon.geometry.setAttribute('position', new THREE.BufferAttribute(v, 3));
    pignon.geometry.computeVertexNormals();
    pignon.geometry.computeBoundingSphere();
    pignon.material = new THREE.MeshStandardMaterial({
      color: 0x4A3122, roughness: 0.94, side: THREE.DoubleSide,
    });
    pignon.rotation.y = sgn > 0 ? 0 : Math.PI;
    pignon.position.set(0, H, sgn * P / 2);
    g.add(pignon);
  }

  /* --- LE TOIT ------------------------------------------------------------
     Un toit de chalet DEBORDE largement — c'est ce qui protege les rondins de
     la pluie, et c'est aussi ce qui lui donne sa silhouette basse et
     accueillante. Un toit affleurant donnerait un cabanon de jardin.
     L'avancee vaut ici presque un metre de chaque cote. */
  const debord = 0.75;
  const hp = P * 0.42;
  const pan = Math.hypot(P / 2 + debord, hp);
  for (const sgn of [1, -1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(L + debord * 1.6, 0.10, pan * 2 * 0.5), boisSombre);
    t.position.set(0, H + hp / 2, sgn * (P / 2 + debord) / 2);
    t.rotation.x = sgn * Math.atan2(hp, P / 2 + debord) * -1;
    t.castShadow = palier.ombres;
    g.add(t);

    // La neige posee dessus, un peu plus large et decalee vers le haut.
    const n = new THREE.Mesh(
      new THREE.BoxGeometry(L + debord * 1.7, 0.13, pan * 2 * 0.5 * 0.96), neige
    );
    n.position.copy(t.position);
    n.position.y += 0.10;
    n.rotation.copy(t.rotation);
    n.castShadow = palier.ombres;
    g.add(n);
  }

  // Faitiere : elle cache la jointure des deux pans.
  const faite = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, L + debord * 1.7, 6), boisSombre
  );
  faite.rotation.z = Math.PI / 2;
  faite.position.set(0, H + hp + 0.06, 0);
  g.add(faite);

  /* --- LE BALCON ----------------------------------------------------------
     Une galerie sur la facade, avec sa balustrade a barreaux. C'est le second
     signe qui dit "chalet" au premier coup d'oeil, et il coute trois boites. */
  const dalle = new THREE.Mesh(new THREE.BoxGeometry(L * 0.92, 0.09, 0.85), bois);
  dalle.position.set(0, H * 0.62, P / 2 + 0.42);
  g.add(dalle);

  const rampe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.92, 0.08, 0.09), bois);
  rampe.position.set(0, H * 0.62 + 0.52, P / 2 + 0.82);
  g.add(rampe);
  const nb = 7;
  for (let i = 0; i < nb; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.05), bois);
    b.position.set((i / (nb - 1) - 0.5) * L * 0.86, H * 0.62 + 0.26, P / 2 + 0.82);
    g.add(b);
  }
  // Deux poteaux qui portent la galerie : sans eux elle flotte.
  for (const sgn of [1, -1]) {
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.10, H * 0.62, 0.10), bois);
    p2.position.set(sgn * L * 0.42, H * 0.31, P / 2 + 0.80);
    g.add(p2);
  }

  /* Fenetres : deux carreaux emissifs sur la facade, plus un halo qui deborde
     sur la nuit. C'est le halo qui porte l'effet a distance, pas le carreau.
     Bien au-dela du blanc : c'est ce qui fait passer la fenetre au-dessus du
     seuil du halo du post-traitement. */
  const chaud = new THREE.MeshBasicMaterial({ fog: true });
  chaud.color.setRGB(4.2, 2.4, 0.9);
  const matHalo = new THREE.SpriteMaterial({
    map: texHalo, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  matHalo.color.setRGB(2.6, 1.5, 0.6);

  for (const cx of [-L * 0.26, L * 0.26]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.76), chaud);
    f.position.set(cx, H * 0.60, P / 2 + 0.02);
    g.add(f);

    // Croisillon : une fenetre de chalet a des petits bois.
    for (const [w, h2] of [[0.70, 0.05], [0.05, 0.80]]) {
      const cr = new THREE.Mesh(new THREE.PlaneGeometry(w, h2), boisSombre);
      cr.position.set(cx, H * 0.60, P / 2 + 0.03);
      g.add(cr);
    }

    const h = new THREE.Sprite(matHalo);
    h.scale.setScalar(2.6);
    h.position.set(cx, H * 0.60, P / 2 + 0.30);
    g.add(h);
  }

  /* Porte, purement pour la silhouette. */
  const porte = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x2A1C13, roughness: 0.95 })
  );
  porte.position.set(0, 0.80, P / 2 + 0.02);
  g.add(porte);

  /* Cheminee en pierre et son filet de fumee. */
  const chem = new THREE.Mesh(
    new THREE.BoxGeometry(0.40, 1.1, 0.40),
    new THREE.MeshStandardMaterial({ color: 0x4A4640, roughness: 0.96, flatShading: true })
  );
  chem.position.set(L * 0.28, H + hp * 0.75, -P * 0.16);
  chem.castShadow = palier.ombres;
  g.add(chem);

  const N = palier.nom === 'bas' ? 14 : 26;
  const pos = new Float32Array(N * 3);
  const geoF = new THREE.BufferGeometry();
  geoF.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const fumee = new THREE.Points(geoF, new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02,
    color: 0xB8C4CE, size: 0.42, transparent: true, opacity: 0.16,
    depthWrite: false, sizeAttenuation: true,
  }));
  fumee.frustumCulled = false;
  fumee.userData = {
    vie: Float32Array.from({ length: N }, () => rand()),
    N,
    base: new THREE.Vector3(L * 0.28, H + hp * 0.75 + 0.6, -P * 0.16),
  };
  g.add(fumee);

  /* Un tas de neige au pied, qui pose la cabane sur le sol. */
  const tas = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), neige
  );
  tas.scale.set(L * 0.72, 0.30, P * 0.72);
  tas.position.y = 0.02;
  g.add(tas);

  return { groupe: g, fumee };
}

export class Cabanes {
  constructor(scene, chemin, relief, palier, clairieres) {
    this.liste = [];
    const rand = rng(90210);

    /* Trois emplacements seulement, repartis sur le parcours et toujours
       ecartes du chemin. Le dernier est plus proche : c'est celui qu'on
       apercoit en arrivant vers la clairiere finale. */
    const places = [
      { t: 0.22, cote: -1, ecart: 30 },
      { t: 0.55, cote: 1, ecart: 34 },
      { t: 0.86, cote: -1, ecart: 24 },
    ];

    const texHalo = halo();
    const p = new THREE.Vector3();
    const c = new THREE.Vector3();

    for (const pl of places) {
      const s = pl.t * chemin.longueur;
      chemin.point(s, p);
      chemin.cote(s, c);
      const x = p.x + c.x * pl.cote * pl.ecart;
      const z = p.z + c.z * pl.cote * pl.ecart;

      // Jamais dans une clairiere : elles doivent rester degagees.
      let bloque = false;
      for (const cl of clairieres) {
        if (Math.hypot(x - cl.x, z - cl.z) < cl.r + 8) bloque = true;
      }
      if (bloque) continue;

      const cab = construireCabane(rand, palier, texHalo);
      cab.groupe.position.set(x, relief.hauteur(x, z) - 0.15, z);
      // Elle regarde vers le chemin : la facade eclairee doit etre visible.
      cab.groupe.rotation.y = Math.atan2(p.x - x, p.z - z);
      scene.add(cab.groupe);
      this.liste.push(cab);
    }
  }

  maj(dt) {
    for (const cab of this.liste) {
      const f = cab.fumee;
      const { vie, N, base } = f.userData;
      const arr = f.geometry.attributes.position.array;
      for (let i = 0; i < N; i++) {
        vie[i] += dt * 0.13;
        if (vie[i] > 1) {
          vie[i] -= 1;
          arr[i * 3] = base.x + (Math.random() - 0.5) * 0.1;
          arr[i * 3 + 1] = base.y;
          arr[i * 3 + 2] = base.z + (Math.random() - 0.5) * 0.1;
        }
        const v = vie[i];
        // Elle monte, s'elargit et se couche dans le vent.
        arr[i * 3] += (0.35 + v * 0.8) * dt;
        arr[i * 3 + 1] += (0.85 - v * 0.35) * dt;
        arr[i * 3 + 2] += (Math.random() - 0.5) * 0.25 * dt;
      }
      f.geometry.attributes.position.needsUpdate = true;
    }
  }
}
