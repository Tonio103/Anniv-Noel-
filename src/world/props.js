/* Ce qui traine au sol.

   La neige etait impeccable et parfaitement vide, et c'est precisement ce qui
   la trahissait : une vraie foret est encombree. Des rochers affleurent, des
   souches restent d'anciennes coupes, des troncs pourrissent en travers, des
   buissons secs percent la croute. Sans eux, le sol est une nappe et l'oeil
   n'a aucun repere d'echelle entre le cerf et les arbres.

   Quatre familles, toutes instanciees et semees par rejet le long du chemin,
   avec les memes regles que la foret : jamais dans le couloir de marche,
   jamais dans une clairiere, densite croissante a mesure qu'on s'enfonce.

   Chaque objet pose au sol porte sa propre NEIGE, en geometrie separee et
   blanche. C'est ce qui les integre au paysage : un rocher gris pose sur de
   la neige a l'air d'un decor rapporte ; le meme rocher coiffe de blanc
   appartient a l'hiver.
*/

import * as THREE from 'three';
import { rng } from '../core/noise.js';

/* Bruite une geometrie : deplace chaque sommet le long de sa normale. C'est
   ce qui distingue un rocher d'un ballon a facettes. */
function bosseler(geo, rand, force) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (rand() - 0.5) * force;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/* --------------------------------------------------------------------------
   Les geometries de base. Une seule de chaque : c'est la matrice d'instance
   qui les varie en taille, en aplatissement et en orientation.
   -------------------------------------------------------------------------- */
function geoRocher(rand, detail) {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  bosseler(g, rand, 0.55);
  // Aplati : un rocher affleurant est plus large que haut.
  g.scale(1, 0.62, 1);
  return g;
}

/* Calotte de neige d'un rocher : la meme forme, un peu plus grosse, dont on
   ne garde que le dessus. Le reste est ecrase sous le sol. */
function geoNeigeRocher(rand, detail) {
  const g = new THREE.IcosahedronGeometry(0.53, detail);
  bosseler(g, rand, 0.42);
  g.scale(1, 0.62, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    // Tout ce qui est sous l'equateur est ramene au niveau du bord : il ne
    // reste qu'une coiffe posee dessus.
    if (p.getY(i) < 0.04) p.setY(i, 0.04);
  }
  g.computeVertexNormals();
  return g;
}

function geoSouche(rand) {
  const g = new THREE.CylinderGeometry(0.34, 0.44, 1, 9, 1, false);
  bosseler(g, rand, 0.16);
  g.translate(0, 0.5, 0);
  return g;
}

function geoTronc(rand) {
  const g = new THREE.CylinderGeometry(0.26, 0.33, 1, 8, 1, true);
  bosseler(g, rand, 0.14);
  g.rotateZ(Math.PI / 2);        // couche
  return g;
}

/* Neige accumulee sur un tronc couche : une demi-gouttiere posee dessus. */
function geoNeigeTronc(rand) {
  const g = new THREE.CylinderGeometry(0.30, 0.37, 1, 8, 1, true, 0, Math.PI);
  bosseler(g, rand, 0.20);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* Buisson sec : quelques brindilles divergentes. On ne cherche pas le detail,
   seulement une silhouette griffue qui accroche la lumiere rasante. */
function geoBuisson(rand) {
  const pos = [], nor = [];
  const nb = 7;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + rand() * 0.6;
    const pente = 0.35 + rand() * 0.5;
    const h = 0.55 + rand() * 0.6;
    const ep = 0.014 + rand() * 0.012;
    const dx = Math.cos(a) * pente, dz = Math.sin(a) * pente;
    // Chaque brindille : un quad tres fin, croise pour rester visible de partout.
    for (const perp of [[1, 0], [0, 1]]) {
      const ox = perp[0] * ep, oz = perp[1] * ep;
      const q = [
        [-ox, 0, -oz], [ox, 0, oz],
        [dx * h + ox, h, dz * h + oz], [dx * h - ox, h, dz * h - oz],
      ];
      for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) {
        for (const k of [i0, i1, i2]) {
          pos.push(q[k][0], q[k][1], q[k][2]);
          nor.push(0, 1, 0);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

/* ========================================================================== */
export class Fouillis {
  constructor(chemin, relief, palier, clairieres) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'fouillis';
    this.palier = palier;

    const rand = rng(31415);
    const detail = palier.nom === 'bas' ? 0 : 1;

    const matRoche = new THREE.MeshStandardMaterial({
      color: 0x4A4E55, roughness: 0.95, metalness: 0, flatShading: true,
    });
    const matBois = new THREE.MeshStandardMaterial({
      color: 0x2A2018, roughness: 0.96, metalness: 0,
    });
    const matBrindille = new THREE.MeshStandardMaterial({
      color: 0x3A2C1E, roughness: 0.95, metalness: 0,
      side: THREE.DoubleSide,
    });
    const matNeige = new THREE.MeshStandardMaterial({
      color: 0xE6EEF8, roughness: 0.78, metalness: 0, flatShading: true,
    });

    /* Budget : le fouillis doit rester un assaisonnement. Trop d'objets et
       on ne voit plus la neige, qui est pourtant le sujet. */
    /* LE SOL ETAIT VIDE. Deux cent quatre-vingts objets repartis sur plus de
       sept cents metres de couloir, c'est un objet tous les deux metres et
       demi de parcours — donc rien du tout dans un cadre donne. Le fouillis
       etait pense comme un assaisonnement ; il faut qu'il devienne un
       sous-bois. On triple, et on autorise ces objets bien plus pres du
       passage : ce sont eux qui donnent au sol son echelle et qui empechent
       la neige d'etre une nappe. */
    const budget = palier.nom === 'bas' ? 320 : palier.nom === 'moyen' ? 620 : 1000;

    const semis = this._semer(rand, chemin, relief, clairieres, budget);

    const familles = [
      { clef: 'rocher', geo: geoRocher(rand, detail), mat: matRoche,
        neige: geoNeigeRocher(rand, detail) },
      { clef: 'souche', geo: geoSouche(rand), mat: matBois, neige: null },
      { clef: 'tronc', geo: geoTronc(rand), mat: matBois,
        neige: geoNeigeTronc(rand) },
      { clef: 'buisson', geo: geoBuisson(rand), mat: matBrindille, neige: null },
    ];

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const ech = new THREE.Vector3();
    const teinte = new THREE.Color();

    this.nb = 0;
    for (const f of familles) {
      const liste = semis.filter((o) => o.type === f.clef);
      if (!liste.length) continue;
      this.nb += liste.length;

      const mesh = new THREE.InstancedMesh(f.geo, f.mat, liste.length);
      const coiffe = f.neige
        ? new THREE.InstancedMesh(f.neige, matNeige, liste.length) : null;

      for (let i = 0; i < liste.length; i++) {
        const o = liste[i];
        e.set(o.penche, o.rot, o.roule);
        q.setFromEuler(e);
        v.set(o.x, o.y, o.z);
        ech.set(o.sx, o.sy, o.sz);
        m.compose(v, q, ech);
        mesh.setMatrixAt(i, m);
        if (coiffe) coiffe.setMatrixAt(i, m);

        // Variation de teinte : sans elle, tous les rochers sont freres.
        teinte.setHSL(0.58, 0.05 + o.t * 0.06, 0.24 + o.t * 0.16);
        mesh.setColorAt(i, teinte);
      }

      for (const im of [mesh, coiffe]) {
        if (!im) continue;
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = palier.ombres;
        im.receiveShadow = palier.ombres;
        im.computeBoundingSphere();
        this.groupe.add(im);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  _semer(rand, chemin, relief, clairieres, budget) {
    const em = relief.emprise;
    const out = [];
    let essais = 0;

    while (out.length < budget && essais < budget * 40) {
      essais++;
      const x = em.xmin + rand() * (em.xmax - em.xmin);
      const z = em.zmin + rand() * (em.zmax - em.zmin);

      const pr = chemin.proximite(x, z);
      // On ne peuple que ce qui sera reellement vu.
      if (pr.d > 70) continue;
      // Le couloir reste degage, mais moins large que pour les arbres : un
      // rocher au bord du passage est justement ce qu'on veut voir defiler.
      /* On les laisse venir jusqu'au bord du passage. Un caillou ou une
         touffe a un metre du chemin ne gene personne — le cerf marche au
         milieu — et c'est precisement la, au premier plan, qu'ils comptent. */
      if (pr.d < 1.6) continue;

      let dansClairiere = false;
      for (const c of clairieres) {
        if (Math.hypot(x - c.x, z - c.z) < c.r * 0.85) { dansClairiere = true; break; }
      }
      if (dansClairiere) continue;

      const avancee = pr.s / chemin.longueur;
      if (rand() > 0.35 + avancee * 0.5) continue;

      const y = relief.hauteur(x, z);
      const r = rand();
      let type, sx, sy, sz, penche = 0, roule = 0;

      if (r < 0.46) {
        /* Rocher : enfonce dans la neige, donc on le descend d'une bonne
           part de sa hauteur. Un rocher pose dessus flotte. */
        type = 'rocher';
        const t = 0.6 + rand() * 2.4;
        sx = t * (0.8 + rand() * 0.5); sy = t * (0.5 + rand() * 0.4); sz = t * (0.8 + rand() * 0.5);
        penche = (rand() - 0.5) * 0.3;
        roule = (rand() - 0.5) * 0.3;
      } else if (r < 0.64) {
        type = 'souche';
        const t = 0.45 + rand() * 0.55;
        sx = t; sz = t; sy = t * (0.5 + rand() * 0.9);
        penche = (rand() - 0.5) * 0.16;
      } else if (r < 0.80) {
        type = 'tronc';
        const lg = 2.4 + rand() * 4.5;
        sx = lg; sy = 0.5 + rand() * 0.45; sz = 0.5 + rand() * 0.45;
        roule = (rand() - 0.5) * 0.25;
      } else {
        type = 'buisson';
        const t = 0.6 + rand() * 1.1;
        sx = t; sy = t * (0.7 + rand() * 0.7); sz = t;
      }

      out.push({
        type, x, z, sx, sy, sz, penche, roule,
        rot: rand() * Math.PI * 2,
        t: rand(),
        // Enfoncement : chaque famille s'assoit differemment dans la neige.
        y: y - (type === 'rocher' ? sy * 0.42
              : type === 'tronc' ? sz * 0.30
              : type === 'souche' ? 0.10 : 0.06),
      });
    }
    return out;
  }
}
