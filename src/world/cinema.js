/* DEUX SCENES DE CINEMA DE PLUS.

   ANTOINE : « je veux du reve, genre une Kill Bill, une Interstellar, et
   faut que ce soit vraiment des scenes de films ».

   Les deux qu'il nomme sont, par chance, aux antipodes l'une de l'autre :
   l'une est une SILHOUETTE — une femme en survetement jaune avec un sabre,
   reconnaissable au premier coup d'oeil et a n'importe quelle distance —
   l'autre est un PHENOMENE, un disque noir cercle de feu qui occupe le ciel.
   Mises a une centaine de metres l'une de l'autre, elles ne se marchent pas
   dessus une seconde.

   Aucune des deux ne charge quoi que ce soit : la premiere reutilise le
   corps implicite de `humanoide.js`, la seconde tient entierement dans un
   nuanceur de dix-huit lignes.
*/

import * as THREE from 'three';
import { smoothstep, clamp } from '../core/noise.js';
import { REPERES, construireCorps, nouvelleInstance, piste, regarderVers } from './humanoide.js';

/* ==========================================================================
   1. GARGANTUA — INTERSTELLAR

   Le trou noir du film est l'une des images les plus reconnaissables du
   cinema recent, et elle se resume a trois choses :

   · UN DISQUE PARFAITEMENT NOIR au centre. Pas sombre : noir. C'est le seul
     endroit d'une image ou il n'y a rigoureusement rien ;
   · UN ANNEAU DE FEU vu par la tranche, qui passe devant en bas ;
   · ET SURTOUT, la partie du disque situee DERRIERE l'astre, que la gravite
     ramene par-dessus. C'est ce halo qui ceinture le noir de haut en bas et
     qui rend l'image impossible a confondre avec un anneau de Saturne.

   Tout cela se dessine analytiquement dans un fragment, sur un simple carre
   tourne vers la camera : pas une texture, pas un maillage, et une nettete
   parfaite a n'importe quelle taille d'ecran.
   ========================================================================== */
function matiereTrouNoir() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    /* PAS D'ADDITION, ET C'EST TOUT LE PROBLEME D'UN TROU NOIR.

       Premiere version en melange additif : l'anneau de feu sortait
       parfaitement, et l'horizon — qui vaut zero — n'ajoutait rien du tout.
       On voyait donc la foret AU TRAVERS du trou noir, ce qui est
       exactement le contraire de ce qu'un trou noir fait. Le seul endroit
       d'une image ou il n'y a rigoureusement rien ne peut pas se peindre en
       ajoutant de la lumiere : il faut EN RETIRER, donc un melange normal,
       avec une opacite qui vaut un a l'interieur de l'horizon et qui suit
       la clarte ailleurs. */
    blending: THREE.NormalBlending,
    uniforms: { uTemps: { value: 0 }, uForce: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTemps;
      uniform float uForce;

      /* Une bande douce entre deux rayons. Bords en smoothstep pour qu'il
         n'y ait aucun arret de degrade : l'oeil lit une rupture de pente
         comme un contour, et un disque d'accretion cercle d'un trait est
         un anneau de Saturne. */
      float bande(float x, float a0, float a1, float b0, float b1) {
        return smoothstep(a0, a1, x) * (1.0 - smoothstep(b0, b1, x));
      }

      void main() {
        vec2 p = vUv;
        float r = length(p);

        /* LE DISQUE D'ACCRETION, vu presque par la tranche. On ecrase
           l'ordonnee d'un facteur six : c'est ce seul chiffre qui fait
           qu'on regarde un disque de biais et non un rond de fumee. C'est
           une BANDE PLEINE, du bord interne au bord externe, et non un
           trait — de la matiere, pas un cerceau. */
        float rd = length(vec2(p.x, p.y / 0.155));
        float disque = bande(rd, 0.34, 0.42, 0.72, 0.98) * 1.35;
        /* Il est bien plus brillant d'un cote : la matiere qui vient vers
           nous est amplifiee, celle qui s'eloigne s'eteint. C'est le
           faisceau relativiste, et c'est lui qui empeche l'anneau d'avoir
           l'air d'un decor symetrique. */
        disque *= 0.42 + 0.95 * smoothstep(-0.45, 0.55, -p.x);

        /* LE HALO LENSE : la face arriere du disque, que la gravite ramene
           par-dessus et par-dessous l'astre. Celui-la est CIRCULAIRE — la
           perspective a ete redressee — et il est d'autant plus fort qu'on
           s'ecarte de l'horizontale. */
        float arc = bande(r, 0.302, 0.318, 0.395, 0.475);
        arc *= 0.30 + 0.85 * abs(p.y) / max(r, 1e-3);
        arc *= 1.35;

        /* Un frisson lent dans la matiere. Sinus d'arguments modestes :
           rien qui puisse s'effondrer en precision moyenne sur telephone. */
        float grain = 0.86 + 0.14 * sin(atan(p.y, p.x) * 7.0 + uTemps * 0.9)
                            * sin(rd * 17.0 - uTemps * 1.7);

        float feu = (disque + arc) * grain;

        /* L'HORIZON. Noir franc, bord tres serre : c'est la nettete de ce
           bord qui donne l'echelle de la chose. */
        float noir = smoothstep(0.302, 0.288, r);
        /* MAIS LA FACE AVANT DU DISQUE PASSE DEVANT LUI. C'est le detail qui
           fait basculer l'image du gadget au plan de film : en bas, la
           matiere est entre nous et l'astre, donc elle n'est pas masquee. */
        float devant = disque * grain * smoothstep(0.03, -0.06, p.y);
        feu = max(feu * (1.0 - noir), devant);

        vec3 chaud = vec3(1.00, 0.66, 0.26);
        vec3 blanc = vec3(1.00, 0.95, 0.86);
        vec3 col = mix(chaud, blanc, clamp(feu * 0.75, 0.0, 1.0)) * feu;
        // Une lueur tres large, qui pose l'astre dans le ciel.
        float voile = exp(-pow((r - 0.44) / 0.30, 2.0)) * 0.05;
        col += chaud * voile;

        /* L'opacite : un a l'interieur de l'horizon, la clarte ailleurs.
           C'est elle qui creuse le ciel. */
        float a = max(noir, clamp(max(max(col.r, col.g), col.b), 0.0, 1.0));
        gl_FragColor = vec4(col, a * uForce);
      }
    `,
  });
  return mat;
}

/* LA SILHOUETTE AU SOL. Antoine : « je veux plus d'elements aussi sur
   terre en reference a Interstellar ». Le disque seul dans le ciel est un
   phenomene ; ce qui manque pour raconter le film, c'est quelqu'un qui le
   REGARDE depuis le sol — la combinaison bouffante, le casque en bulle, un
   bras leve vers ce qu'il montre, c'est la silhouette la plus citee de la
   science-fiction juste apres le vaisseau lui-meme. Meme technique que le
   velo d'E.T. : un contour noir peint au canevas, rien de plus. */
function siluetteAstronaute() {
  const n = 160;
  const cv = document.createElement('canvas');
  cv.width = n; cv.height = Math.round(n * 1.35);
  const c = cv.getContext('2d');
  c.fillStyle = '#000';

  // Les jambes, ecartees, ancrees au sol.
  c.beginPath();
  c.moveTo(58, 216); c.lineTo(48, 148); c.lineTo(66, 146); c.lineTo(74, 214);
  c.closePath(); c.fill();
  c.beginPath();
  c.moveTo(102, 216); c.lineTo(112, 148); c.lineTo(94, 146); c.lineTo(86, 214);
  c.closePath(); c.fill();

  // Le sac a dos (PLSS), qui deborde derriere les epaules.
  c.beginPath();
  c.ellipse(78, 96, 32, 24, 0, 0, Math.PI * 2); c.fill();
  // Le torse, large et arrondi : la combinaison est bouffante, pas ajustee.
  c.beginPath();
  c.ellipse(80, 110, 34, 44, 0, 0, Math.PI * 2); c.fill();

  // Les bras : un le long du corps, l'autre leve — il montre ce qu'il
  // regarde, geste qui a lui seul raconte toute la scene.
  c.lineWidth = 20; c.lineCap = 'round';
  c.beginPath(); c.moveTo(52, 92); c.lineTo(40, 152); c.stroke();
  c.beginPath(); c.moveTo(106, 92); c.lineTo(126, 38); c.stroke();

  // Le casque : une grande bulle ronde, le signe qui rend la silhouette
  // reconnaissable entre toutes, la tete renversee vers l'arriere.
  c.beginPath();
  c.arc(84, 46, 30, 0, Math.PI * 2); c.fill();

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: t, transparent: true, opacity: 0, color: 0x03050A,
    depthWrite: false, fog: true, side: THREE.DoubleSide,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1, cv.height / cv.width), mat);
  q.renderOrder = 1;
  return q;
}

export function trouNoir(relief) {
  const g = new THREE.Group();
  const mat = matiereTrouNoir();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  /* CENT UNITES A TROIS CENTS METRES, soit dix-neuf degres de large. A
     cent cinquante, il debordait franchement par le haut du cadre en
     portrait — on ne voyait que la moitie basse d'un anneau, ce qui ne se
     lit pas du tout. */
  quad.scale.setScalar(102);
  quad.renderOrder = 2;
  /* Le disque et l'astronaute sont chacun dans leur PROPRE sous-groupe : le
     premier suspendu dans le ciel, loin, le second pose au sol, pres — deux
     positions qui n'ont rien a voir, mais qui doivent toutes deux faire
     face a la camera (un panneau plat vu de travers se lit comme une
     lame). `g` lui-meme ne bouge jamais : voir plus bas pourquoi. */
  const discGroupe = new THREE.Group();
  discGroupe.add(quad);
  g.add(discGroupe);
  const astro = siluetteAstronaute();
  astro.scale.setScalar(2.3);
  const astroGroupe = new THREE.Group();
  astroGroupe.add(astro);
  g.add(astroGroupe);

  const avant = new THREE.Vector3();
  const cote = new THREE.Vector3();
  g.userData.suitCamera = true;

  /* ANTOINE : « les elements ciel bougent avec la camera, ca c'est
     problematique, il ne reste pas fixe dans le ciel ». C'etait exact :
     `g.position` etait recalcule CHAQUE IMAGE a partir de la direction
     courante de la camera, si bien que le trou noir suivait chaque virage
     du drone au lieu de rester un astre fixe dans le monde — un vrai objet
     lointain, lui, DERIVE dans le cadre quand on tourne, il ne s'y
     recentre pas tout seul.

     La position n'est donc plus recalculee qu'UNE FOIS, au moment precis
     ou la fenetre s'ouvre — a cet instant seulement, on a besoin de la
     direction de la camera pour etre sur que l'astre nait dans le cadre.
     Au-dela, elle reste fixe dans le monde comme le reste du decor : le
     drone peut tourner, le trou noir derive naturellement, exactement
     comme un vrai astre le ferait. */
  let fige = false;
  const posDisque = new THREE.Vector3();
  const posAstro = new THREE.Vector3();
  g.userData.reinit = () => { fige = false; };

  g.userData.jouer = (u, t, camera) => {
    /* Il se leve lentement et se retire de meme : un trou noir n'apparait
       pas d'un coup, il est LA et l'on finit par le voir. */
    const vis = smoothstep(0, 0.26, u) * smoothstep(1, 0.74, u);
    g.visible = vis > 0.005;
    if (!g.visible || !camera) return;
    mat.uniforms.uForce.value = vis;
    mat.uniforms.uTemps.value = t;
    astro.material.opacity = vis * 0.95;

    if (!fige) {
      /* Le meme placement que la lune d'E.T., et pour la meme raison
         mesuree : le drone pique vers le cerf, il ne reste qu'un bandeau
         de ciel au haut du cadre en portrait. Un peu plus loin et un peu
         plus haut que la lune, parce que l'objet est beaucoup plus grand. */
      const D = 300;
      camera.getWorldDirection(avant);
      avant.y = 0;
      if (avant.lengthSq() < 1e-6) avant.set(0, 0, -1);
      avant.normalize();
      cote.set(-avant.z, 0, avant.x);
      posDisque.copy(camera.position)
        .addScaledVector(avant, D).addScaledVector(cote, 22);
      /* Vingt-six metres a trois cents, soit cinq degres d'elevation : il
         se LEVE derriere la ligne d'arbres au lieu de flotter au zenith. */
      posDisque.y = camera.position.y + 26;

      /* L'astronaute, lui, est pres et au sol : trente metres devant, tres
         legerement de cote pour ne pas boucher exactement l'axe. */
      posAstro.copy(camera.position)
        .addScaledVector(avant, 30).addScaledVector(cote, -9);
      posAstro.y = relief.hauteur(posAstro.x, posAstro.z);

      fige = true;
    }
    discGroupe.position.copy(posDisque);
    discGroupe.lookAt(camera.position);
    astroGroupe.position.copy(posAstro);
    astroGroupe.lookAt(camera.position.x, posAstro.y + 1.2, camera.position.z);
  };
  return g;
}

/* ==========================================================================
   2. KILL BILL

   Une silhouette, et c'est tout ce qu'il faut : un survetement JAUNE avec
   sa bande noire le long des bras et des jambes, et un sabre japonais. Ces
   deux elements suffisent — personne n'a jamais eu besoin de voir un visage
   pour reconnaitre ce plan-la.

   La bande noire ne peut pas se decouper a l'abscisse : dans une pose en
   « A », les membres sont inclines et aucun seuil sur x ne separe le dehors
   du dedans. On se sert de la NORMALE de la surface, qui le dit exactement.
   ========================================================================== */
const JAUNE = new THREE.Color(0xC9A215);
const NOIR = new THREE.Color(0x0B0C10);

function teinteKillBill(x, y, z, c, os, nx, ny, nz) {
  // Les chaussures, jaunes elles aussi mais plus sombres.
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x8A6E0E); return; }
  /* La bande. Elle court sur le cote EXTERIEUR des membres : la normale y
     pointe lateralement, loin de l'axe du corps. On exige en plus que le
     point soit du bon cote, sans quoi la face interne de la cuisse opposee
     se retrouverait rayee elle aussi. */
  const limbe = os === 'brasD' || os === 'brasG' || os === 'avantD' || os === 'avantG'
             || os === 'cuisseD' || os === 'cuisseG' || os === 'molletD' || os === 'molletG';
  if (limbe) {
    const dehors = (x > 0 ? nx : -nx);
    if (dehors > 0.72) { c.copy(NOIR); return; }
  }
  // Le col, noir : il detache la tete du survetement.
  if (y > REPERES.baseCou - 0.02 && y < REPERES.menton - 0.03) { c.copy(NOIR); return; }
  // La tete : on ne modelise pas un visage, on suggere une chevelure sombre.
  if (os === 'tete' && (z > -0.02 || y > REPERES.crane + 0.02)) { c.setHex(0x2A2118); return; }
  if (os === 'tete') { c.setHex(0xC9A98A); return; }        // le visage, dans l'ombre
  c.copy(JAUNE);
  void ny; void nz;
}

/* Le sabre. Une lame LEGEREMENT COURBE et a dos plat : c'est cette asymetrie
   qui fait « katana » plutot que « epee ». On la construit en decalant les
   sommets d'une boite fine le long d'un arc, ce qui coute deux boucles. */
function katana() {
  const g = new THREE.Group();
  const L = 0.72, N = 14;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = t * L;
    // La courbure, tres faible : deux centimetres sur toute la lame.
    const cx = Math.sin(t * 0.55) * 0.028;
    // Elle s'affine vers la pointe, et le dos reste plus epais que le fil.
    const demi = 0.0155 * (1 - t * 0.35);
    const ep = 0.0055 * (1 - t * 0.45);
    pos.push(cx - demi, y, -ep, cx + demi, y, 0, cx - demi, y, ep);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 3, b = a + 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    idx.push(a + 2, b + 2, a, a, b + 2, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const lame = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xD8E2EE, roughness: 0.12, metalness: 0.95,
    emissive: 0x1A2230, emissiveIntensity: 1, side: THREE.DoubleSide,
  }));
  g.add(lame);

  // La garde ronde, puis la poignee tressee.
  const tsuba = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.008, 14),
    new THREE.MeshStandardMaterial({ color: 0x24282F, roughness: 0.45, metalness: 0.7 })
  );
  g.add(tsuba);
  const poignee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.019, 0.24, 8),
    new THREE.MeshStandardMaterial({ color: 0x14161B, roughness: 0.85 })
  );
  poignee.position.y = -0.13;
  g.add(poignee);
  return g;
}

let _corpsKB = null;

export function killBill(palier) {
  const g = new THREE.Group();
  if (!_corpsKB) {
    _corpsKB = construireCorps(palier, {
      teinter: teinteKillBill,
      /* Une charpente plus fine et moins large que celle de Spider-Man :
         c'est ce seul rapport qui fait lire une femme plutot qu'un homme en
         jaune, bien avant n'importe quel detail. */
      gabarit: { carrure: 0.90, masse: 0.90 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.66, metalness: 0.02,
    emissive: new THREE.Color(0x141008), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsKB, mat, { ombres: palier.ombres });
  g.add(perso);

  const os = perso.userData.os;
  const sabre = katana();
  /* Le sabre prolonge le poing : greffe sur l'os de la main, tout ce que
     fait l'epaule se propage jusqu'a la pointe. */
  sabre.rotation.x = -0.30;
  sabre.position.y = -0.02;
  os.mainD.add(sabre);

  /* LA QUEUE-DE-CHEVAL. Antoine : « on ne reconnait pas Kill Bill ». Le
     survetement jaune et le sabre suffisent en photo fixe, mais en
     mouvement, de loin et de nuit, ils se lisent comme n'importe quel
     escrimeur. La coiffure — stricte, tiree en arriere, qui fouette dans
     les coups — est le troisieme signe reconnaissable entre tous : c'est
     elle qui manquait. Une chaine de troncons coniques, comme la lame,
     greffee a l'arriere du crane. */
  const queue = new THREE.Group();
  const matCheveux = new THREE.MeshStandardMaterial({ color: 0x1C160E, roughness: 0.55 });
  const SEG = 5;
  for (let i = 0; i < SEG; i++) {
    const t0 = i / SEG;
    const l = 0.11 - t0 * 0.045;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028 * (1 - t0 * 0.55), 0.032 * (1 - t0 * 0.45), l, 6),
      matCheveux
    );
    seg.position.y = -t0 * 0.30 - l / 2;
    // Elle s'ecarte legerement du crane puis retombe, jamais tout a fait droite.
    seg.position.z = 0.05 + Math.sin(t0 * 2.4) * 0.05;
    queue.add(seg);
  }
  queue.position.set(0, REPERES.crane - 0.06, 0.05);
  os.tete.add(queue);

  /* LA SEQUENCE. Antoine : « elle doit bouger, elle doit avoir une
     choregraphie ». La pose de garde tenue jusqu'au bout etait un choix
     assume — mais assume a tort : sans coup porte, une femme en jaune
     immobile ne dit "Kill Bill" a personne. On garde l'arrivee en garde
     (le sursaut, le demi-tour) puis on enchaine deux coups tres differents
     l'un de l'autre, comme le duel au sabre l'a appris : un coup HAUT
     abattu de haut en bas, puis un REVERS remontant de l'autre cote. La
     garde ne revient qu'a la toute fin, desormais GAGNEE par l'action
     plutot que donnee d'emblee. */
  const POSE = {
    dos: {
      brasD: [0.20, 0, 0.22], avantD: [0.55, 0, 0], mainD: [0, 0, -0.3],
      brasG: [0.14, 0, -0.20], avantG: [0.42, 0, 0],
      cuisseD: [-0.06, 0, 0.10], molletD: [0.10, 0, 0],
      cuisseG: [0.10, 0, -0.12], molletG: [-0.18, 0, 0],
      colonne: [0.04, 0, 0], poitrine: [0.02, 0, 0],
    },
    alerte: {
      brasD: [0.30, 0, 0.26], avantD: [0.85, 0, 0], mainD: [0, 0, -0.3],
      brasG: [0.20, 0, -0.24], avantG: [0.60, 0, 0],
      cuisseD: [-0.14, 0, 0.12], molletD: [0.14, 0, 0],
      cuisseG: [0.18, 0, -0.14], molletG: [-0.26, 0, 0],
      colonne: [0.02, -0.28, 0], poitrine: [0, -0.34, 0],
      cou: [0, -0.30, 0], tete: [0, -0.34, 0],
    },
    /* LA GARDE. Le sabre tendu vers l'avant, presque a l'horizontale, les
       deux mains sur la poignee, le corps de trois quarts et le poids en
       arriere. C'est la pose la plus citee du film. */
    garde: {
      brasD: [-1.35, 0, 0.34], avantD: [0.72, 0, 0], mainD: [0.15, 0, 0],
      brasG: [-1.05, 0, -0.52], avantG: [1.05, 0, 0],
      cuisseD: [-0.52, 0, 0.20], molletD: [-0.30, 0, 0], piedD: [0.35, 0, 0],
      cuisseG: [0.46, 0, -0.26], molletG: [-0.42, 0, 0],
      bassin: [0, 0.34, 0], colonne: [0.08, 0.28, 0], poitrine: [0.04, 0.22, 0],
      cou: [-0.06, -0.42, 0], tete: [-0.04, -0.38, 0],
    },
    // LE COUP HAUT : la lame se leve loin derriere l'epaule...
    leve: {
      brasD: [-2.55, 0.30, 0.30], avantD: [0.25, 0, 0], mainD: [0.10, 0, 0],
      brasG: [-1.05, 0, -0.52], avantG: [1.05, 0, 0],
      cuisseD: [-0.30, 0, 0.16], molletD: [-0.20, 0, 0],
      cuisseG: [0.30, 0, -0.18], molletG: [-0.30, 0, 0],
      bassin: [0, 0.10, 0], colonne: [-0.10, 0.10, 0], poitrine: [-0.12, 0.06, 0],
      cou: [-0.04, -0.20, 0], tete: [-0.02, -0.18, 0],
    },
    // ...puis s'abat, le corps en fente, jusqu'au sol de l'autre cote.
    abattu: {
      brasD: [0.55, -0.85, 0.10], avantD: [0.95, 0, 0], mainD: [0.05, 0, 0],
      brasG: [-0.30, 0, -0.10], avantG: [0.40, 0, 0],
      cuisseD: [-0.85, 0, 0.30], molletD: [-0.55, 0, 0], piedD: [0.55, 0, 0],
      cuisseG: [0.15, 0, -0.10], molletG: [-0.15, 0, 0],
      bassin: [0, 0.55, 0], colonne: [0.20, 0.45, 0], poitrine: [0.10, 0.35, 0],
      cou: [-0.10, 0.10, 0], tete: [-0.06, 0.12, 0],
    },
    // LE REVERS : la lame revient bas, de l'autre cote...
    ramene: {
      brasD: [0.10, -0.20, -0.85], avantD: [1.10, 0, 0], mainD: [0, 0, 0.20],
      brasG: [-0.60, 0, -0.30], avantG: [0.70, 0, 0],
      cuisseD: [-0.35, 0, 0.15], molletD: [-0.25, 0, 0],
      cuisseG: [0.10, 0, -0.15], molletG: [-0.20, 0, 0],
      bassin: [0, -0.20, 0], colonne: [-0.05, -0.15, 0], poitrine: [-0.05, -0.10, 0],
    },
    // ...et remonte en un revers qui balaie jusqu'a l'epaule opposee.
    revers: {
      brasD: [-1.70, 0.50, 0.75], avantD: [0.35, 0, 0], mainD: [0.10, 0, 0],
      brasG: [-0.90, 0, -0.45], avantG: [0.85, 0, 0],
      cuisseD: [-0.10, 0, 0.10], molletD: [-0.10, 0, 0],
      cuisseG: [0.45, 0, -0.20], molletG: [-0.35, 0, 0], piedG: [-0.40, 0, 0],
      bassin: [0, -0.30, 0], colonne: [-0.15, -0.30, 0], poitrine: [-0.10, -0.20, 0],
      cou: [0.06, -0.30, 0], tete: [0.04, -0.28, 0],
    },
  };

  const sequence = piste([
    { t: 0.00, pose: POSE.dos },
    { t: 0.22, pose: POSE.dos },
    { t: 0.36, pose: POSE.alerte },
    { t: 0.46, pose: POSE.alerte },
    { t: 0.56, pose: POSE.garde },
    { t: 0.62, pose: POSE.leve },
    { t: 0.67, pose: POSE.abattu },
    { t: 0.70, pose: POSE.abattu },
    { t: 0.74, pose: POSE.ramene },
    { t: 0.78, pose: POSE.revers },
    { t: 0.81, pose: POSE.revers },
    { t: 0.88, pose: POSE.garde },
    { t: 1.00, pose: POSE.garde },
  ]);

  /* Elle commence DE DOS, tournee vers la foret. Le demi-tour se fait sur le
     groupe entier, parce qu'un corps qui pivote autour de sa colonne
     vertebrale sans deplacer ses appuis se lit comme une poupee sur un
     socle. */
  let lameFaite = false;
  g.userData.reinit = () => { lameFaite = false; };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    sequence(os, u);
    /* LA LAME CHANTE QUAND ELLE SE MET EN GARDE, juste avant le premier
       coup : c'est ce qui transforme la pose en un evenement qui annonce
       l'action a venir. Il ne se rejoue pas tant que la fenetre ne s'est
       pas refermee. */
    if (!lameFaite && u > 0.54) { lameFaite = true; g.userData.emettre?.('lame'); }
    // Le demi-tour, cale sur le deuxieme temps de la sequence.
    const tourne = smoothstep(0.28, 0.60, u);
    perso.rotation.y = Math.PI * (1 - tourne) + 0.35 * tourne;
    /* Elle vous suit du regard des qu'elle se met en garde — avant, elle ne
       vous a pas encore vu — et jusqu'au bout du combat : elle se bat pour
       vous, pas pour un adversaire qu'on ne voit jamais. */
    regarderVers(perso, os, camera, smoothstep(0.50, 0.60, u) * 0.85);

    /* Une respiration minuscule quand elle tient la garde, avant et apres
       les coups : sans elle, une pose tenue devient une statue ; avec,
       elle est immobile mais vivante, ce qui n'est pas la meme chose. */
    const tientGarde = smoothstep(0.90, 0.94, u) + (1 - smoothstep(0.58, 0.62, u)) * smoothstep(0.56, 0.58, u);
    const souffle = tientGarde * Math.sin(t * 1.4) * 0.022;
    os.poitrine.rotation.x += souffle;
    os.brasD.rotation.x += souffle * 0.8;
    os.brasG.rotation.x += souffle * 0.8;
    // La queue-de-cheval fouette avec un leger retard sur la tete.
    queue.rotation.x = Math.sin(t * 3.1) * 0.05 - os.tete.rotation.x * 0.35;
    queue.rotation.z = Math.cos(t * 2.3) * 0.04 - os.tete.rotation.y * 0.25;
    void clamp;
  };
  return g;
}

export function coutKillBill() {
  return _corpsKB ? { triangles: _corpsKB.triangles, sommets: _corpsKB.sommets } : null;
}
