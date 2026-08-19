import * as THREE from 'three';
import { grainRond } from '../../core/dot.js';
import { smoothstep } from '../../core/noise.js';
import {
  construireCorps, nouvelleInstance, appliquerPose, regarderVers,
} from '../humanoide.js';
import { creerCerf } from '../../deer/deerMesh.js';
import { halo } from './communs.js';

/* ==========================================================================
   7. LE PATRONUS

   Un second cerf, mais de lumiere : translucide, bleu-blanc, il surgit du
   sous-bois, court un moment a hauteur du notre, puis se defait.

   C'est la seule apparition qui DIALOGUE avec le sujet de la balade au lieu
   de simplement passer a cote — et c'est pour cela qu'elle est la premiere
   de cette serie. Un cerf de lumiere a cote d'un cerf de chair, c'est une
   image qui se passe de legende.

   Il est bati en capsules additives, sans eclairage : un fantome ne recoit
   pas la lumiere, il en emet. La silhouette suffit largement — a cette
   distance et a cette vitesse, personne ne cherchera le detail d'un bois.
   ========================================================================== */
/* LE CERF DE LUMIERE. Antoine : « le patronus n'est pas beau ». Il avait
   raison — trois capsules pour le corps et deux eventails de baguettes
   pour les bois ne composent pas un cerf, seulement son idee la plus
   grossiere. La foret, elle, en contient deja un vrai : un maillage lisse,
   extrait d'un champ implicite, corne et ramure comprises, construit avec
   tout le soin qu'on a mis a le rendre reconnaissable. Le patronus REPREND
   ce maillage plutot que d'en refaire un au rabais — meme squelette, meme
   silhouette, meme ramure detaillee — et le rend en lumiere plutot qu'en
   pelage : une seule matiere additive remplace toutes celles du vrai
   corps, l'ombre au sol et la buee des naseaux disparaissent (un fantome
   n'a ni l'une ni l'autre), et c'est tout. La beaute du sort tient a la
   qualite du corps qu'il anime, pas a un habillage special. */
function cerfDeLumiere(palier) {
  const corps = creerCerf(palier);
  const { racine, ombre, souffle } = corps;

  /* UN BLEU FRANC, PAS UN BLANC BLEUTE. Le patronus passe au-dessus d'une
     clairiere enneigee : une matiere additive presque blanche, ajoutee a du
     blanc, donne du blanc, et le cerf de lumiere disparaissait dans le sol.
     On charge donc le bleu bien au-dela de un — `setRGB` travaille en
     lineaire, rien n'empeche de depasser — et on vide le rouge. */
  const mat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  mat.color.setRGB(0.26, 0.80, 1.60);

  /* TOUTE PIECE RIGIDE DU VRAI CERF — mufle, oreilles, yeux, ramure —
     portait sa propre matiere de pelage. On les fait toutes basculer vers
     la meme lumiere additive, ce qui a aussi pour effet d'unifier la
     silhouette : plus aucun detail sombre ne casse le glow. */
  const pieces = [];
  racine.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.material = mat;
    o.castShadow = false;
    o.receiveShadow = false;
    pieces.push(o);
  });
  ombre.visible = false;
  souffle.visible = false;

  // Le halo qui l'enveloppe : c'est lui qui porte a distance.
  const aura = halo([0.55, 1.15, 1.9], 5.4);
  aura.position.set(0, 1.15, -0.1);
  racine.add(aura);

  racine.userData.pieces = pieces;
  racine.userData.aura = aura;
  return racine;
}

/* LE SORCIER. Antoine : « on doit voir Harry Potter qui tient sa baguette,
   qui fait un sort et qui invoque le patronus ». Le cerf de lumiere seul
   est un beau fantome, mais rien ne dit QUI l'a fait naitre. Une
   silhouette encapuchonnee, la baguette tendue vers la trajectoire du
   cerf, plantee la ou il surgit : c'est elle qui transforme l'apparition
   en sort lance, et non en hasard lumineux. */
const CAPE_SOMBRE = new THREE.Color(0x14161C);
const PEAU_HARRY = new THREE.Color(0xD8B48C);

function teinteHarry(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x0C0D10); return; }
  if (os === 'tete') { c.copy(PEAU_HARRY); return; }
  c.copy(CAPE_SOMBRE);
  void x; void y; void z;
}

let _corpsHarry = null;

function sorcierPatronus(palier) {
  const g = new THREE.Group();
  if (!_corpsHarry) {
    _corpsHarry = construireCorps(palier, {
      teinter: teinteHarry,
      gabarit: { carrure: 0.86, masse: 0.84 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.85, metalness: 0.0,
    emissive: new THREE.Color(0x06070A), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsHarry, mat, { ombres: palier.ombres });
  g.add(perso);
  const os = perso.userData.os;

  // Le bras tendu, la baguette au bout du poing, le corps legerement en
  // fente vers l'avant — l'effort du sort, pas une pose de repos.
  appliquerPose(os, {
    brasD: [-1.15, 0.05, 0.35], avantD: [0.20, 0, 0], mainD: [0, 0, 0],
    brasG: [0.10, 0, -0.16], avantG: [0.35, 0, 0],
    cuisseD: [-0.16, 0, 0.10], molletD: [0.10, 0, 0],
    cuisseG: [0.10, 0, -0.10], molletG: [0.06, 0, 0],
    colonne: [0.05, 0, 0], poitrine: [0.04, 0, 0], cou: [0, 0, 0], tete: [0.02, 0, 0],
  });

  // La baguette : un fin fuseau de bois, greffe sur le poing.
  const baguette = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.016, 0.34, 5),
    new THREE.MeshStandardMaterial({ color: 0x3A2A18, roughness: 0.7 })
  );
  baguette.rotation.x = Math.PI / 2;
  baguette.position.set(0, 0, -0.20);
  os.mainD.add(baguette);

  // L'etincelle a la pointe : c'est elle qui vend le sort, au moment ou
  // le cerf de lumiere jaillit.
  const etincelle = halo([1.4, 2.2, 3.6], 1.3);
  etincelle.position.set(0, 0, -0.37);
  os.mainD.add(etincelle);

  g.userData.os = os;
  g.userData.etincelle = etincelle;
  return g;
}

export function patronus(palier) {
  const g = new THREE.Group();
  const bete = cerfDeLumiere(palier);
  g.add(bete);

  /* Harry se tient la ou le cerf de lumiere surgit — l'origine de son
     trajet local, voir plus bas — face a la trajectoire, un peu de cote
     pour ne jamais se trouver sur le passage de la bete. */
  const harry = sorcierPatronus(palier);
  harry.position.set(0.9, 0, -13);
  harry.rotation.y = Math.PI;
  g.add(harry);
  const osHarry = harry.userData.os;

  /* Une trainee de particules derriere lui : un patronus laisse toujours
     derriere soi un sillage qui se dissipe. Des points suffisent, la
     texture ronde partagee evite le carre disgracieux. */
  const N = 60;
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ptsMat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xAEDCFF, size: 0.16,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, ptsMat);
  pts.frustumCulled = false;
  g.add(pts);
  const vies = new Float32Array(N).map(() => Math.random());

  g.userData.jouer = (u, t, camera) => {
    /* Il surgit vite et se defait lentement : une apparition surnaturelle
       ne s'installe pas en fondu, elle EST la d'un coup. */
    const vis = smoothstep(0, 0.06, u) * smoothstep(1, 0.62, u);
    const scint = 0.78 + Math.sin(t * 5.5) * 0.12 + Math.sin(t * 13.1) * 0.10;
    for (const p of bete.userData.pieces) p.material.opacity = vis * 0.52 * scint;
    bete.userData.aura.material.opacity = vis * 0.34 * scint;
    ptsMat.opacity = vis * 0.7;
    g.visible = vis > 0.01;

    /* LE SORT. La pointe de la baguette s'embrase juste avant que le cerf
       ne jaillisse — c'est CE flash, et non une simple apparition de
       fantome, qui doit se lire en premier — puis retombe a une braise
       discrete qui tient pendant toute la course : Harry ne range pas sa
       baguette tant que le sort dure. */
    const jaillit = smoothstep(0, 0.05, u) * smoothstep(0.22, 0.09, u);
    const brasedure = smoothstep(0, 0.10, u) * smoothstep(1, 0.55, u);
    harry.userData.etincelle.material.opacity = vis * (brasedure * 0.28 + jaillit * 0.9);
    /* Le poignet accuse le coup au moment du sort : un petit recul suivi
       d'une tension qui tient tant que le sort dure — pas un mouvement
       continu, sinon on croirait qu'il agite betement sa baguette. */
    const kick = Math.max(0, 1 - Math.abs(u - 0.05) * 14);
    osHarry.avantD.rotation.x = 0.20 - kick * 0.55;
    osHarry.mainD.rotation.z = kick * 0.4;
    // Un bref regard vers vous, une fois le sort lance — pas plus, il
    // regarde surtout ou son cerf de lumiere s'en va.
    const regard = smoothstep(0.25, 0.35, u) * smoothstep(0.55, 0.45, u);
    regarderVers(harry, osHarry, camera, regard * 0.7);

    // Il avance le long de son axe local, et bondit.
    const av = (u - 0.5) * 26;
    bete.position.z = av;
    bete.position.y = Math.abs(Math.sin(t * 3.4)) * 0.22;
    bete.rotation.x = Math.sin(t * 3.4) * 0.06;

    for (let i = 0; i < N; i++) {
      vies[i] += 0.016;
      if (vies[i] > 1) vies[i] -= 1;
      const k = vies[i];
      // Le sillage nait au niveau du corps et retombe en s'etalant.
      pos[i * 3] = (Math.random() - 0.5) * 0.5 * k;
      pos[i * 3 + 1] = 1.0 + Math.sin(i * 2.1) * 0.35 - k * 0.7;
      pos[i * 3 + 2] = av + 0.6 + k * 5.5;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return g;
}
