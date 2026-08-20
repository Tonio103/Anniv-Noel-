import * as THREE from 'three';
import { smoothstep } from '../../core/noise.js';
import { REPERES, construireCorps, nouvelleInstance, appliquerPose } from '../humanoide.js';
import { halo } from './communs.js';

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

/* L'ASTRONAUTE, EN VRAIE VOLUMETRIE. Antoine : « je veux plus d'elements
   aussi sur terre en reference a Interstellar ». Premiere version : un
   contour noir peint au canevas sur un panneau plat, force a toujours
   faire face a la camera (le meme defaut, au fond, que le velo d'E.T.
   avant sa refonte — voir `et.js`). Un panneau plat vu de trois quarts se
   fend en lame ; celui-ci ne s'y prete meme plus, puisque le drone tourne
   librement autour du chemin.

   La combinaison est batie sur le MEME squelette que tous les autres
   personnages de ce dossier (`construireCorps`/`humanoide.js`) — c'est ce
   squelette, pas un maillage special, qui porte la pose du bras leve. Un
   gabarit large et massif (la combinaison est bouffante, jamais ajustee),
   un casque en vraie sphere plutot qu'un cercle peint, et un sac a dos
   (PLSS) qui deborde reellement derriere les epaules : le genre de volume
   qu'un panneau plat ne peut tout simplement pas donner. */
const TEINTE_COMBI = new THREE.Color(0xD8D2C0);
const TEINTE_JOINT = new THREE.Color(0x2A2A2E);
const TEINTE_VISIERE = new THREE.Color(0x0C1420);

function teinteAstronaute(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG' || os === 'mainD' || os === 'mainG'
    || os === 'molletD' || os === 'molletG' || os === 'avantD' || os === 'avantG') {
    c.copy(TEINTE_JOINT);
    return;
  }
  if (os === 'tete') { c.copy(TEINTE_VISIERE); return; }
  c.copy(TEINTE_COMBI);
  void x; void y; void z;
}

let _corpsAstronaute = null;

function astronauteReel(palier) {
  const g = new THREE.Group();
  if (!_corpsAstronaute) {
    _corpsAstronaute = construireCorps(palier, {
      teinter: teinteAstronaute,
      // Une combinaison bouffante, jamais un corps ajuste : voila deux fois
      // la carrure normale et une masse plus genereuse encore.
      gabarit: { carrure: 1.30, masse: 1.55 },
      pas: palier.nom === 'bas' ? 0.034 : palier.nom === 'moyen' ? 0.026 : 0.021,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.72, metalness: 0.05,
    emissive: new THREE.Color(0x030405), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsAstronaute, mat, { ombres: palier.ombres });
  g.add(perso);
  const os = perso.userData.os;

  // Les jambes bien campees, un bras leve — le geste qui raconte a lui
  // seul toute la scene, repris tel quel de la silhouette d'origine.
  appliquerPose(os, {
    brasD: [-0.10, 0, 0.08], avantD: [0.12, 0, 0],
    brasG: [-2.55, 0, -0.30], avantG: [0.15, 0, 0],
    cuisseD: [-0.08, 0, 0.09], molletD: [0.06, 0, 0],
    cuisseG: [-0.08, 0, -0.09], molletG: [0.06, 0, 0],
  });

  /* LE CASQUE. Une vraie bulle, pas un rond peint — c'est le detail qui
     rend la silhouette reconnaissable entre toutes, et une sphere en fait
     bien plus qu'un cercle plat des qu'on la voit de profil ou de dos, ce
     qu'un plan fixe sur camera interdisait totalement. Elle englobe
     entierement l'os de la tete plutot que de le remplacer, exactement
     comme le capuchon des duellistes du sabre laser habille `os.tete` sans
     jamais retoucher le corps dessous (voir `encapuchonne.js`). */
  const casque = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 16, 12),
    new THREE.MeshStandardMaterial({ color: TEINTE_COMBI, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.28 })
  );
  casque.scale.set(1.05, 1.12, 1.1);
  casque.position.set(0, REPERES.crane - REPERES.menton + 0.01, 0.01);
  os.tete.add(casque);
  // La visiere, sombre, legerement teintee par le disque quand il brille.
  const visiere = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 14, 10, Math.PI * 0.62, Math.PI * 0.85, Math.PI * 0.18, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: TEINTE_VISIERE, roughness: 0.15, metalness: 0.4 })
  );
  visiere.scale.set(1.05, 1.12, 1.1);
  visiere.position.copy(casque.position);
  os.tete.add(visiere);
  // Le reflet du trou noir dans la visiere : un point chaud, discret, qui
  // ne s'allume que si la scene elle-meme est visible.
  const reflet = halo([1.0, 0.7, 0.35], 0.11);
  reflet.position.set(0.03, REPERES.crane - REPERES.menton + 0.02, -0.14);
  os.tete.add(reflet);

  /* LE SAC A DOS (PLSS). Une capsule qui deborde reellement derriere les
     epaules, accrochee a la poitrine pour suivre le buste — encore une
     fois le meme principe d'attache que la cape des duellistes et de
     Harry : jamais la racine, toujours l'os qui porte vraiment la piece. */
  const sac = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.155, 0.32, 4, 10),
    new THREE.MeshStandardMaterial({ color: 0xB8B0A0, roughness: 0.75, metalness: 0.05 })
  );
  sac.rotation.x = Math.PI / 2;
  sac.rotation.z = 0.08;
  sac.position.set(0, -0.02, 0.135);
  os.poitrine.add(sac);
  // Deux petites bouteilles d'oxygene, cote a cote sur le sac — le detail
  // qui distingue un sac a dos d'un simple coussin.
  for (const sx of [-1, 1]) {
    const bouteille = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.20, 8), new THREE.MeshStandardMaterial({ color: 0x8C9098, roughness: 0.5, metalness: 0.3 }));
    bouteille.rotation.x = Math.PI / 2;
    bouteille.position.set(sx * 0.06, -0.02, 0.19);
    os.poitrine.add(bouteille);
  }

  g.userData.os = os;
  g.userData.reflet = reflet;
  g.userData.pieces = [];
  perso.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) g.userData.pieces.push(o); });
  return g;
}

export function trouNoir(relief, chemin, palier) {
  const g = new THREE.Group();
  const mat = matiereTrouNoir();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  /* CENT UNITES A TROIS CENTS METRES, soit dix-neuf degres de large. A
     cent cinquante, il debordait franchement par le haut du cadre en
     portrait — on ne voyait que la moitie basse d'un anneau, ce qui ne se
     lit pas du tout. */
  quad.scale.setScalar(102);
  quad.renderOrder = 2;
  /* Le disque reste dans son PROPRE sous-groupe, oriente face a la camera a
     chaque image — un panneau plat vu de travers se lit comme une lame, et
     c'est justement pourquoi la lentille gravitationnelle ne PEUT etre
     qu'un panneau : elle est, par construction, la meme dans toutes les
     directions de vue. L'astronaute, lui, n'a plus besoin de ce traitement
     depuis qu'il est un vrai corps : on l'oriente UNE fois, vers l'astre
     qu'il montre, et le drone peut ensuite tourner librement autour de lui
     sans jamais le voir se fendre en lame. `g` lui-meme ne bouge jamais :
     voir plus bas pourquoi. */
  const discGroupe = new THREE.Group();
  discGroupe.add(quad);
  g.add(discGroupe);
  const astro = astronauteReel(palier);
  const astroGroupe = new THREE.Group();
  astroGroupe.add(astro);
  g.add(astroGroupe);

  const p = new THREE.Vector3(), tan = new THREE.Vector3(), cote = new THREE.Vector3();
  g.userData.suitCamera = true;

  /* ANTOINE, PUIS UNE SECONDE FOIS SUR LA LUNE D'E.T. — meme cause :
     `g.position` etait recalcule a partir de la direction INSTANTANEE de
     la camera au moment ou la fenetre s'ouvre, et cet instant tombe parfois
     en pleine transition de cadrage, ou cette direction n'est pas stable
     d'une image a l'autre : l'astre se figeait alors a un endroit
     legerement different selon l'image exacte du declenchement, ce qui, vu
     deux fois, se lit comme un saut plutot qu'une derive.

     LA VRAIE CORRECTION, appliquee ici comme sur la lune : on ne demande
     plus JAMAIS a la camera OU PLACER l'astre. Le CHEMIN — fixe, connu
     d'avance, identique a chaque image — donne un repere stable a
     l'endroit ou la scene s'ouvre. La camera ne sert plus qu'a orienter le
     disque face a elle. */
  let calcule = false;
  const posDisque = new THREE.Vector3();
  const posAstro = new THREE.Vector3();
  g.userData.reinit = () => { calcule = false; };

  g.userData.jouer = (u, t, camera, sAncre) => {
    /* Il se leve lentement et se retire de meme : un trou noir n'apparait
       pas d'un coup, il est LA et l'on finit par le voir. */
    const vis = smoothstep(0, 0.26, u) * smoothstep(1, 0.74, u);
    g.visible = vis > 0.005;
    if (!g.visible || !camera) return;
    mat.uniforms.uForce.value = vis;
    mat.uniforms.uTemps.value = t;
    // Le reflet du disque dans la visiere suit la meme montee/retrait que
    // le disque lui-meme : un reflet qui resterait allume alors que la
    // source a disparu ne pourrait pas se justifier.
    astro.userData.reflet.material.opacity = vis * 0.8;
    /* LA LUMIERE SE COURBE PRES DE LUI. L'aberration chromatique du moteur —
       jusqu'ici un simple reglage discret d'objectif — devient ici l'effet
       lui-meme : une vraie lentille gravitationnelle, pas une texture
       plaquee. Elle suit `vis` : nulle tant qu'on ne le voit pas, pleine
       quand il domine le cadre. */
    g.userData.distorsionDyn = vis * 0.85;

    if (!calcule) {
      /* Le meme placement que la lune d'E.T., et pour la meme raison
         mesuree : le drone pique vers le cerf, il ne reste qu'un bandeau
         de ciel au haut du cadre en portrait. Un peu plus loin et un peu
         plus haut que la lune, parce que l'objet est beaucoup plus grand. */
      chemin.point(sAncre, p);
      chemin.tangente(sAncre, tan);
      chemin.cote(sAncre, cote);
      const D = 300;
      posDisque.copy(p).addScaledVector(tan, D).addScaledVector(cote, 22);
      /* Vingt-six metres a trois cents, soit cinq degres d'elevation : il
         se LEVE derriere la ligne d'arbres au lieu de flotter au zenith.
         Le drone vole une dizaine de metres au-dessus du chemin : on part
         de la hauteur DU CHEMIN, stable, pas de celle de la camera. */
      posDisque.y = p.y + 36;

      /* L'astronaute, lui, est pres et au sol : trente metres devant, tres
         legerement de cote pour ne pas boucher exactement l'axe. */
      posAstro.copy(p).addScaledVector(tan, 30).addScaledVector(cote, -9);
      posAstro.y = relief.hauteur(posAstro.x, posAstro.z);

      /* La racine `g`, elle, ne bouge jamais — seuls ses deux sous-groupes
         sont positionnes. Sans ce repere, le mecanisme qui tourne la camera
         vers la scene active viserait l'origine du monde, tres loin derriere
         nous, au lieu du disque. */
      g.userData.pointRegard = posDisque;

      /* L'ORIENTATION DE L'ASTRONAUTE, UNE SEULE FOIS. Un vrai corps n'a
         plus besoin de pivoter face a la camera a chaque image — c'est
         justement tout l'interet d'en avoir fait un plutot que de garder
         le panneau plat. On le tourne, une fois pour toutes, vers l'astre
         qu'il montre : le bras leve pointe alors reellement vers le
         disque, quel que soit l'angle sous lequel le drone finit par le
         voir. */
      astroGroupe.position.copy(posAstro);
      astroGroupe.lookAt(posDisque.x, posAstro.y, posDisque.z);

      calcule = true;
    }
    discGroupe.position.copy(posDisque);
    discGroupe.lookAt(camera.position);
  };
  return g;
}
