/* Ce qui habite les clairieres.

   Deux promesses du plan restaient en souffrance, et ce sont justement les
   deux endroits ou la balade s'arrete le plus longtemps.

   LES LANTERNES. La clairiere du Black Friday parle de dates : cinq reperes
   entre le 19 novembre et le 25 decembre. Les planter dans la neige comme
   des jalons donne au texte un ancrage dans le decor — on lit une carte
   posee au sol, pas un tableau. Elles sont alignees sur la traversee de la
   clairiere, de la plus lointaine a la plus proche, dans l'ordre du
   calendrier : la derniere, celle de Noel, est celle qu'on frole.

   LE SAPIN DE LA FIN. Dans la derniere clairiere, un grand conifere porte
   des lumieres. C'est le seul objet franchement chaleureux de toute la
   balade, et il n'arrive qu'apres l'avoir meritee.

   Toutes les sources sont poussees BIEN AU-DELA DU BLANC. Sans cela elles
   ne franchissent pas le seuil du halo et restent des points colores plats ;
   au-dela, elles rayonnent vraiment sur la nuit.
*/

import * as THREE from 'three';
import { lueurDiffuse } from '../core/dot.js';
import { rng } from '../core/noise.js';

/* Toutes les sources de la clairiere partagent la meme lueur diffuse.
   Elle est peinte pixel par pixel dans core/dot.js : un degrade a arrets
   dessine des anneaux de Mach et donne a chaque lumiere un contour net, ce
   qui est exactement ce qu'on ne veut pas ici. */
function halo() {
  return lueurDiffuse();
}

/* Une lanterne sur son piquet : un montant sombre, une cage claire, un halo.
   C'est le halo qui porte l'effet a distance, la cage n'est qu'un point. */
/* Les cinq jalons ne sont pas interchangeables : ils portent cinq dates, et
   deux d'entre elles comptent vraiment. Leur donner la meme lanterne les
   reduit a une guirlande decorative ; les differencier en fait une frise
   qu'on lit en passant, sans qu'aucun texte n'ait a l'expliquer.

   Ordre de rencontre, qui est aussi l'ordre du calendrier :
     19 nov  sortie de GTA 6 sur consoles — une date subie, pas choisie
     27 nov  BLACK FRIDAY — la plus haute et la plus vive : c'est le conseil
             le plus utile de toute la balade
     30 nov  Cyber Monday — le rattrapage, donc discret
     fin nov L'ANNIVERSAIRE — teinte chaude, rosee, la seule qui ne parle pas
             d'achat mais de quelqu'un
     25 dec  NOEL — verte et blanche, la derniere, celle qu'on frole */
const JALONS = [
  { h: 1.35, verre: [1.9, 1.5, 0.9], halo: [1.0, 0.8, 0.5], taille: 0.95 },
  { h: 2.05, verre: [4.0, 2.4, 0.8], halo: [2.4, 1.4, 0.5], taille: 1.45 },
  { h: 1.30, verre: [1.8, 1.5, 1.0], halo: [0.95, 0.8, 0.55], taille: 0.90 },
  { h: 1.80, verre: [3.8, 1.8, 1.5], halo: [2.2, 1.0, 0.85], taille: 1.30 },
  { h: 1.95, verre: [2.2, 3.6, 2.2], halo: [1.2, 2.1, 1.3], taille: 1.35 },
];

function lanterne(texHalo, matBois, hauteur, jalon) {
  const g = new THREE.Group();

  const piquet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, hauteur, 6), matBois
  );
  piquet.position.y = hauteur / 2;
  g.add(piquet);

  const matVerre = new THREE.MeshBasicMaterial({ fog: true });
  // Juste au-dessus du seuil du halo : plus haut, la lanterne devient une
  // tache blanche qui mange la clairiere.
  matVerre.color.setRGB(jalon.verre[0], jalon.verre[1], jalon.verre[2]);
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.24, 0.17), matVerre);
  cage.position.y = hauteur + 0.10;
  g.add(cage);

  const chapeau = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.10, 5), matBois);
  chapeau.position.y = hauteur + 0.27;
  g.add(chapeau);

  const matHalo = new THREE.SpriteMaterial({
    map: texHalo, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  matHalo.color.setRGB(jalon.halo[0], jalon.halo[1], jalon.halo[2]);
  const h = new THREE.Sprite(matHalo);
  h.scale.setScalar(jalon.taille);
  h.position.y = hauteur + 0.10;
  g.add(h);

  return g;
}

/* SEIZE BOUGIES.

   L'occasion est double — un anniversaire ET Noel — et jusqu'ici la balade
   ne racontait que la seconde : neige, sapins, paquets. Rien nulle part ne
   disait les seize ans.

   Une bougie ne se lit pas comme une lanterne : elle est plus petite, sa
   flamme est plus haute que large, et surtout elle VACILLE. C'est ce
   tremblement qui la designe comme une bougie et non comme un point lumineux
   de plus, donc il est anime plutot que fixe.

   Elles sont plantees en arc, face au chemin, devant le sapin : on arrive
   dessus, on les compte sans y penser. */
function bougies(texHalo, rand, nombre) {
  const g = new THREE.Group();
  const cire = new THREE.MeshStandardMaterial({ color: 0xE8DCC4, roughness: 0.72 });

  const matFlamme = new THREE.SpriteMaterial({
    map: texHalo, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  // Au-dela du blanc, pour franchir le seuil du halo du post-traitement.
  matFlamme.color.setRGB(4.6, 2.6, 0.9);

  const flammes = [];
  for (let i = 0; i < nombre; i++) {
    const t = i / (nombre - 1);
    // Arc ouvert vers le chemin, legerement irregulier : un alignement
    // parfait ferait guirlande electrique, pas bougies posees a la main.
    const a = (-0.62 + t * 1.24) + (rand() - 0.5) * 0.05;
    const r = 4.4 + (rand() - 0.5) * 0.5;
    const h = 0.30 + rand() * 0.12;

    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, h, 6), cire);
    c.position.set(Math.sin(a) * r, h / 2, Math.cos(a) * r);
    g.add(c);

    const f = new THREE.Sprite(matFlamme.clone());
    // La flamme est plus haute que large : c'est ce qui la distingue d'un
    // simple point lumineux.
    f.scale.set(0.16, 0.30, 1);
    f.position.set(c.position.x, h + 0.10, c.position.z);
    f.userData.phase = rand() * 6.28;
    f.userData.base = h + 0.10;
    g.add(f);
    flammes.push(f);
  }

  g.userData.flammes = flammes;
  return g;
}

/* Le sapin de la derniere clairiere : la meme silhouette que la foret, mais
   constellee de points chauds. */
/* LE SAPIN DE LA DERNIERE CLAIRIERE.

   C'est la derniere image de toute la balade, et il n'y avait dessus que des
   points lumineux vissés en helice sur une silhouette de foret ordinaire. Un
   sapin de Noel, ce n'est pas un conifere avec des lampes : c'est un arbre
   qu'on a DECORE, et ce qui le dit tient en quatre choses.

   · LA GUIRLANDE SUIT UNE VRAIE SPIRALE, en cordon continu, et non des
     points isoles. Un cordon se lit comme quelque chose qu'une main a
     enroulé ; des points epars se lisent comme un effet.
   · DES BOULES, plus grosses que les lumieres et non emissives : elles
     RENVOIENT la lumiere au lieu d'en produire. C'est ce contraste entre ce
     qui brille et ce qui reflete qui donne le relief d'un vrai sapin decore.
   · UNE ETOILE AU SOMMET. Aucun sapin de Noel n'en est depourvu, et c'est le
     seul element qui se detache sur le ciel.
   · DES PAQUETS AU PIED. Ils disent que l'arbre est le but du chemin.

   L'arbre lui-meme est aussi plus large et plus fourni que ceux de la foret :
   un sapin de fete est choisi trapu, pas elance.
*/
function sapinDeFete(modele, matFeuillage, matNeige, texHalo, rand, palier) {
  const g = new THREE.Group();
  const H = 7.2;

  const f = new THREE.Mesh(modele.feuillage, matFeuillage);
  f.scale.set(H * 1.18, H, H * 1.18);      // trapu, comme un vrai sapin de Noel
  f.castShadow = palier.ombres;
  g.add(f);
  const n = new THREE.Mesh(modele.neige, matNeige);
  n.scale.copy(f.scale);
  g.add(n);

  const matHalo = new THREE.SpriteMaterial({
    map: texHalo, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  const teintes = [[4.6, 2.2, 0.8], [4.2, 1.0, 0.9], [1.5, 3.8, 1.6], [4.4, 3.6, 1.2], [1.4, 2.2, 4.4]];

  /* --- la guirlande, en cordon continu ----------------------------------- */
  const nb = palier.nom === 'bas' ? 46 : 92;
  const tours = 5.5;
  for (let i = 0; i < nb; i++) {
    const t = i / (nb - 1);
    const y = 0.10 + t * 0.82;
    // Le rayon suit le profil du feuillage : la guirlande EPOUSE l'arbre au
    // lieu de flotter autour, ce qui est toute la difference.
    const r = (1 - t) * 0.33 * H * 1.18 + 0.06;
    const a = t * Math.PI * 2 * tours;
    const m = matHalo.clone();
    const c = teintes[(i + ((rand() * 1.4) | 0)) % teintes.length];
    m.color.setRGB(c[0], c[1], c[2]);
    const s = new THREE.Sprite(m);
    // Alternance de grosses et de petites : une guirlande n'est pas reguliere.
    const gros = i % 4 === 0;
    s.scale.setScalar((gros ? 0.52 : 0.30) + rand() * 0.10);
    s.position.set(Math.cos(a) * r, y * H, Math.sin(a) * r);
    g.add(s);
  }

  /* --- les boules : elles refletent, elles n'emettent pas ---------------- */
  const geoBoule = new THREE.SphereGeometry(1, 10, 8);
  const couleursBoule = [0xB4232B, 0xC9A227, 0xB8C6D4, 0x2E6E4A, 0x8E3B6B];
  const nbB = palier.nom === 'bas' ? 12 : 26;
  for (let i = 0; i < nbB; i++) {
    const t = 0.10 + rand() * 0.78;
    const r = (1 - t) * 0.33 * H * 1.18 + 0.05;
    const a = rand() * Math.PI * 2;
    const mat = new THREE.MeshStandardMaterial({
      color: couleursBoule[(rand() * couleursBoule.length) | 0],
      roughness: 0.16, metalness: 0.65,
      emissive: 0x140A04, emissiveIntensity: 1,
    });
    const b = new THREE.Mesh(geoBoule, mat);
    const taille = 0.11 + rand() * 0.07;
    b.scale.setScalar(taille);
    // Legerement pendantes : une boule accrochee tombe sous sa branche.
    b.position.set(Math.cos(a) * r, t * H - taille * 0.9, Math.sin(a) * r);
    g.add(b);
  }

  /* --- l'etoile ----------------------------------------------------------- */
  const etoile = new THREE.Group();
  const matEtoile = new THREE.MeshBasicMaterial({ fog: true });
  matEtoile.color.setRGB(3.8, 3.1, 1.3);
  // Deux tetraedres croises : de loin, une etoile a branches franches.
  for (const rot of [0, Math.PI / 4]) {
    const e = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), matEtoile);
    e.rotation.y = rot;
    e.scale.set(1, 1.45, 0.35);
    etoile.add(e);
  }
  const halo2 = new THREE.SpriteMaterial({
    map: texHalo, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  /* Le halo de l'etoile doit RESTER UNE ETOILE. A 3,2 il formait une boule
     lumineuse plus large que la cime et le sapin disparaissait derriere son
     propre sommet — on lisait un soleil pose sur un arbre. Il descend a 1,3,
     ce qui laisse voir les branches de l'etoile au lieu de les noyer. */
  halo2.color.setRGB(2.2, 1.8, 0.85);
  const hs = new THREE.Sprite(halo2);
  hs.scale.setScalar(1.3);
  etoile.add(hs);
  etoile.position.y = H * 1.02;
  g.add(etoile);
  g.userData.etoile = etoile;

  /* --- les paquets au pied ------------------------------------------------ */
  const couleursPaquet = [0x8E2E36, 0x2F5E43, 0x9A7B2E, 0x394C6B];
  const nbP = palier.nom === 'bas' ? 4 : 8;
  for (let i = 0; i < nbP; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.5 + rand() * 1.5;
    const c = 0.26 + rand() * 0.22;
    const boite = new THREE.Mesh(
      new THREE.BoxGeometry(c, c * (0.6 + rand() * 0.5), c * (0.8 + rand() * 0.4)),
      new THREE.MeshStandardMaterial({
        color: couleursPaquet[(rand() * couleursPaquet.length) | 0], roughness: 0.62,
      })
    );
    boite.position.set(Math.cos(a) * r, c * 0.32, Math.sin(a) * r);
    boite.rotation.y = rand() * 3;
    boite.castShadow = palier.ombres;
    g.add(boite);

    // Un ruban clair en croix : sans lui c'est un carton, pas un cadeau.
    const ruban = new THREE.Mesh(
      new THREE.BoxGeometry(c * 1.02, c * (0.6 + rand() * 0.5) * 1.02, c * 0.12),
      new THREE.MeshStandardMaterial({ color: 0xE8DCC4, roughness: 0.5 })
    );
    ruban.position.copy(boite.position);
    ruban.rotation.copy(boite.rotation);
    g.add(ruban);
  }

  return g;
}

export class Clairieres {
  constructor(scene, chemin, relief, palier, stations, modeleSapin, matFeuillage, matNeige) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'clairieres';
    const rand = rng(2026);
    const texHalo = halo();

    const matBois = new THREE.MeshStandardMaterial({ color: 0x241A12, roughness: 0.95 });
    const p = new THREE.Vector3();
    const c = new THREE.Vector3();
    const tan = new THREE.Vector3();

    for (let i = 0; i < stations.length; i++) {
      const st = stations[i];
      const s = chemin.haltes[i].s;
      chemin.point(s, p);
      chemin.cote(s, c);
      chemin.tangente(s, tan);

      if (st.scene?.lanterns) {
        /* Cinq jalons, alignes le long de la traversee et decales du chemin
           pour qu'on passe a cote plutot qu'au travers. */
        for (let k = 0; k < 5; k++) {
          const j = JALONS[k];
          const le = (k - 2) * 7.5;
          const x = p.x + tan.x * le + c.x * 4.6;
          const z = p.z + tan.z * le + c.z * 4.6;
          const l = lanterne(texHalo, matBois, j.h + rand() * 0.12, j);
          l.position.set(x, relief.hauteur(x, z) - 0.06, z);
          l.rotation.y = rand() * 0.6;
          this.groupe.add(l);
        }
      }

      if (st.scene?.tree) {
        /* Seize bougies, une par annee. Elles sont plantees devant le sapin,
           face a l'arrivee. */
        const b = bougies(texHalo, rand, 16);
        b.position.set(p.x, relief.hauteur(p.x, p.z), p.z);
        b.rotation.y = Math.atan2(tan.x, tan.z);
        this.groupe.add(b);
        this.bougies = b;
      }

      if (st.scene?.tree && modeleSapin) {
        /* Devant, dans l'axe de marche plutot que sur le cote : c'est le
           dernier objet de la balade, il doit etre dans le champ quand on
           arrive, pas derriere l'epaule. */
        const x = p.x + tan.x * 16 + c.x * 6;
        const z = p.z + tan.z * 16 + c.z * 6;
        const arbre = sapinDeFete(modeleSapin, matFeuillage, matNeige, texHalo, rand, palier);
        arbre.position.set(x, relief.hauteur(x, z) - 0.2, z);
        this.groupe.add(arbre);
        this.sapin = arbre;
      }
    }

    scene.add(this.groupe);
    this.nb = this.groupe.children.length;
  }

  /* Le vacillement des flammes. Deux frequences incommensurables et une
     phase propre a chaque bougie : sans ca, les seize battent ensemble et
     l'effet tombe a plat. */
  maj(temps) {
    /* L'etoile tourne tres lentement sur elle-meme. C'est le dernier objet du
       dernier plan : un mouvement infime suffit a le garder vivant pendant
       les dizaines de secondes ou l'image ne change plus. */
    if (this.sapin?.userData.etoile) {
      this.sapin.userData.etoile.rotation.y = temps * 0.14;
    }
    const f = this.bougies?.userData.flammes;
    if (!f) return;
    for (let i = 0; i < f.length; i++) {
      const s = f[i];
      const ph = s.userData.phase;
      const v = Math.sin(temps * 7.3 + ph) * 0.5 + Math.sin(temps * 11.9 + ph * 1.7) * 0.5;
      s.scale.set(0.15 + v * 0.02, 0.28 + v * 0.05, 1);
      s.position.y = s.userData.base + v * 0.012;
      s.material.opacity = 0.88 + v * 0.10;
    }
  }
}
