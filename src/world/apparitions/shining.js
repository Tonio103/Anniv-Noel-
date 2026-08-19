import * as THREE from 'three';
import { grainRond, lueurDiffuse } from '../../core/dot.js';
import { smoothstep } from '../../core/noise.js';
import {
  REPERES, construireCorps, nouvelleInstance, regarderVers, appliquerPose,
} from '../humanoide.js';
import { tacheDeSang } from './communs.js';

/* ==========================================================================
   3. SHINING

   Antoine : « je veux aussi une reference a Shining ». L'image la plus
   citee du film n'est pas une action, c'est une IMMOBILITE : deux
   fillettes identiques, robe bleue, main dans la main, qui ne bougent pas
   et regardent. Aucune choregraphie ne pourrait la rendre plus inquietante
   — c'est le meme principe que le trio de Spider-Man qui pointait du
   doigt, pousse plus loin : ici, rien ne bouge JAMAIS, pas meme un souffle,
   jusqu'a ce qu'elles tournent la tete d'un seul mouvement, ensemble.

   Une flaque sombre grandit lentement a leurs pieds — jamais expliquee,
   jamais commentee, elle est juste LA, comme dans le couloir de l'hotel.
   ========================================================================== */
const ROBE_JUMELLE = new THREE.Color(0x8FA8C4);
const PEAU_JUMELLE = new THREE.Color(0xDCC0A6);
const CHEVEUX_JUMELLE = new THREE.Color(0x241C14);

function teinteJumelle(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG' || os === 'molletD' || os === 'molletG') {
    c.setHex(0xEDEDE8); // chaussettes et chaussures blanches
    return;
  }
  if (os === 'tete') {
    if (y > REPERES.crane - 0.06 || (z > 0.01 && y > REPERES.menton - 0.01)) {
      c.copy(CHEVEUX_JUMELLE);
      return;
    }
    c.copy(PEAU_JUMELLE);
    return;
  }
  c.copy(ROBE_JUMELLE);
  void x;
}

let _corpsJumelle = null;

function jumelle(palier) {
  if (!_corpsJumelle) {
    _corpsJumelle = construireCorps(palier, {
      teinter: teinteJumelle,
      // Une fillette, pas une adulte reduite : le rapport compte plus que
      // l'echelle qui suit.
      gabarit: { carrure: 0.74, masse: 0.68 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.80, metalness: 0.0,
    emissive: new THREE.Color(0x08090C), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsJumelle, mat, { ombres: palier.ombres });
  perso.scale.setScalar(0.70);
  const os = perso.userData.os;
  // Debout, bras le long du corps, les mains a peine tournees vers
  // l'interieur — la main dans la main, sans qu'on ait besoin de la
  // modeliser vraiment : la proximite suffit a le faire lire.
  appliquerPose(os, {
    brasD: [-0.06, 0, 0.06], avantD: [0.08, 0, 0],
    brasG: [-0.06, 0, -0.06], avantG: [0.08, 0, 0],
  });
  return perso;
}

/* L'ASCENSEUR. La seconde image la plus citee du film, et la plus demandee
   par Antoine : les portes en laiton s'ouvrent sur un noir complet, et le
   sang jaillit du sol par vagues plutot que par une seule gerbe — un
   DELUGE qui continue de couler tant que les portes restent ouvertes,
   pas une explosion ponctuelle comme celle de Kill Bill. Il se dresse
   derriere les jumelles : on les regarde d'abord, et c'est lui qui se
   revele une fois qu'elles ont fini de nous fixer. */
function ascenseurOverlook() {
  const g = new THREE.Group();
  const cage = new THREE.Group();
  cage.position.y = -3.6; // sous le sol, avant de monter
  g.add(cage);

  const matCadre = new THREE.MeshStandardMaterial({ color: 0x241A10, roughness: 0.62, metalness: 0.22 });
  const cadre = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.5, 0.24), matCadre);
  cadre.position.y = 1.75;
  cage.add(cadre);

  // Le noir du puits, derriere les portes — rien a y voir avant qu'elles
  // ne s'ecartent.
  const matNoir = new THREE.MeshBasicMaterial({ color: 0x030202 });
  const trou = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 3.05), matNoir);
  trou.position.set(0, 1.72, 0.09);
  cage.add(trou);

  // Deux vantaux de laiton qui coulissent horizontalement, comme au film.
  const matPorte = new THREE.MeshStandardMaterial({ color: 0xAD8A47, roughness: 0.30, metalness: 0.80 });
  const porteD = new THREE.Mesh(new THREE.BoxGeometry(1.08, 3.10, 0.10), matPorte);
  const porteG = porteD.clone();
  porteD.position.set(0.54, 1.72, -0.10);
  porteG.position.set(-0.54, 1.72, -0.10);
  cage.add(porteD, porteG);

  g.userData.cage = cage;
  g.userData.porteD = porteD;
  g.userData.porteG = porteG;
  return g;
}

/* LE DELUGE. Contrairement a la gerbe d'un coup unique, chaque particule
   reboucle sur son propre cycle : le flot ne s'arrete jamais tant que
   l'enveloppe qui pilote son opacite reste ouverte, ce qui est exactement
   ce qu'un DELUGE doit faire et qu'une explosion ponctuelle ne peut pas. */
function delugeSang(N = 260) {
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0x9C0D12, size: 0.27,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const N_ = N;
  const phase = Float32Array.from({ length: N_ }, () => Math.random());
  const cycle = Float32Array.from({ length: N_ }, () => 0.55 + Math.random() * 0.45);
  const ox = Float32Array.from({ length: N_ }, () => (Math.random() - 0.5) * 1.9);
  const haut = Float32Array.from({ length: N_ }, () => 0.5 + Math.random() * 0.9);
  const portee = Float32Array.from({ length: N_ }, () => 3.4 + Math.random() * 4.2);
  pts.userData = { mat, phase, cycle, ox, haut, portee };
  return pts;
}

export function shining(palier) {
  const g = new THREE.Group();
  const gauche = jumelle(palier);
  const droite = jumelle(palier);
  gauche.position.x = -0.34;
  droite.position.x = 0.34;
  g.add(gauche, droite);
  const paires = [[gauche, gauche.userData.os], [droite, droite.userData.os]];

  // Une flaque qui grandit sous elles, sombre, jamais expliquee.
  const tache = tacheDeSang();
  tache.position.set(0, 0.02, 0.35);
  tache.scale.setScalar(0.55);
  g.add(tache);

  // L'ascenseur, plante derriere elles — on ne le decouvre qu'une fois
  // qu'elles ont fini de nous regarder.
  const ascenseur = ascenseurOverlook();
  ascenseur.position.set(0, 0, 2.35);
  g.add(ascenseur);
  const { cage, porteD, porteG } = ascenseur.userData;
  const PORTE_D_FERMEE = porteD.position.x, PORTE_D_OUVERTE = PORTE_D_FERMEE + 1.05;
  const PORTE_G_FERMEE = porteG.position.x, PORTE_G_OUVERTE = PORTE_G_FERMEE - 1.05;

  // Enfant de l'ascenseur, et non de la scene : il herite ainsi la
  // correction de sol de `poser` sans qu'on ait a la dupliquer.
  const deluge = delugeSang();
  deluge.position.set(0, 0, -0.10); // le seuil des portes
  ascenseur.add(deluge);

  // La mare qui grossit au pied de l'ascenseur — bien plus vaste que celle
  // des jumelles, puisque c'est elle qui recueille tout le deluge. Enfant
  // de l'ascenseur pour la meme raison que le deluge : elle herite sa
  // correction de sol au lieu d'en refaire une, approximative, a part.
  const flaqueAsc = tacheDeSang();
  flaqueAsc.position.set(0, 0.015, -0.55);
  flaqueAsc.scale.setScalar(0.4);
  ascenseur.add(flaqueAsc);

  g.userData.poser = (relief) => {
    const solIci = relief.hauteur(g.position.x, g.position.z) - g.position.y;
    tache.position.y = solIci + 0.02;
    ascenseur.position.y = solIci;
  };

  /* LE NEON QUI FAIBLIT. Une lumiere blanche et froide, au-dessus d'elles,
     qui vacille par a-coups irreguliers — jamais un clignotement
     mecanique et regulier, qui se lirait comme un defaut de rendu plutot
     que comme un tube qui va lacher. */
  const neon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  }));
  neon.material.color.setRGB(2.1, 2.3, 2.6);
  neon.scale.setScalar(2.4);
  neon.position.set(0, 2.5, -0.2);
  g.add(neon);

  let clacFait = false;
  g.userData.reinit = () => {
    clacFait = false;
    cage.position.y = -3.6;
    porteD.position.x = PORTE_D_FERMEE;
    porteG.position.x = PORTE_G_FERMEE;
    deluge.userData.mat.opacity = 0;
    for (const m of flaqueAsc.userData.taches) m.opacity = 0;
    flaqueAsc.scale.setScalar(0.4);
    g.userData.assombritDyn = 0;
    g.userData.teinteForceDyn = 0;
  };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.08, u) * smoothstep(1, 0.90, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    /* LE VACILLEMENT DU NEON. Une somme de sinus a des frequences non
       multiples les unes des autres ne se repete jamais a l'identique sur
       la duree de la scene — c'est ce qui empeche l'oeil de deviner le
       rythme, et donc de s'y habituer. */
    const tremble = Math.sin(t * 11) * Math.sin(t * 3.7) > 0.55 ? 0.15 : 1.0;
    neon.material.opacity = vis * 0.42 * tremble;

    // La flaque des jumelles grandit tout au long du passage, tres lentement.
    const etale = smoothstep(0, 1, u);
    for (const m of tache.userData.taches) m.opacity = vis * (0.20 + etale * 0.55);
    tache.scale.setScalar(0.4 + etale * 1.1);

    /* L'IMMOBILITE, JUSQU'AU REGARD. Rien ne bouge — ni respiration, ni
       balancement — jusqu'a ce battement bref ou les deux tournent la tete
       EXACTEMENT ensemble. C'est cette synchronisation parfaite, plus que
       le mouvement lui-meme, qui derange : deux individus ne font jamais
       exactement la meme chose au meme instant, sauf dans ce film. */
    const regarde = smoothstep(0.40, 0.48, u) * smoothstep(0.66, 0.58, u);
    for (const [racine, os] of paires) regarderVers(racine, os, camera, regarde);

    /* L'ASCENSEUR MONTE, LES PORTES S'OUVRENT. Juste apres que les jumelles
       ont fini de nous fixer : on n'a pas encore quitte des yeux leur
       regard qu'un bruit de mecanique se fait deja sentir derriere elles. */
    const monte = smoothstep(0.46, 0.58, u);
    cage.position.y = -3.6 * (1 - monte);
    const ouvre = smoothstep(0.58, 0.70, u);
    porteD.position.x = PORTE_D_FERMEE + (PORTE_D_OUVERTE - PORTE_D_FERMEE) * ouvre;
    porteG.position.x = PORTE_G_FERMEE + (PORTE_G_OUVERTE - PORTE_G_FERMEE) * ouvre;
    if (!clacFait && ouvre > 0.97) { clacFait = true; g.userData.emettre?.('choc', 1); }

    /* LE DELUGE. Il jaillit du seuil des portes et coule vers nous — pas
       une explosion instantanee, un FLOT continu tant que l'enveloppe
       reste ouverte. Chaque particule reboucle sur son propre cycle, donc
       le jet ne s'epuise ni ne se repete jamais a l'identique. */
    const gush = smoothstep(0.68, 0.78, u) * smoothstep(0.97, 0.85, u);
    deluge.userData.mat.opacity = vis * gush * 0.95;
    if (gush > 0.01) {
      const du = deluge.userData;
      const pos = deluge.geometry.attributes.position;
      for (let i = 0; i < du.phase.length; i++) {
        const cyc = ((t * 0.85) / du.cycle[i] + du.phase[i]) % 1;
        const x = du.ox[i] * (0.25 + 0.75 * cyc);
        const z = -cyc * du.portee[i];
        const y = Math.max(0.05, 0.20 + Math.sin(cyc * Math.PI) * 1.15 * du.haut[i] - cyc * cyc * 0.55);
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    // La mare de l'ascenseur, qui engloutit tout l'espace devant les portes.
    const etaleAsc = smoothstep(0.64, 1.0, u);
    for (const m of flaqueAsc.userData.taches) m.opacity = vis * (0.15 + etaleAsc * 0.78);
    flaqueAsc.scale.setScalar(0.4 + etaleAsc * 3.6);

    /* L'ECRAN LUI-MEME EST ENVAHI. La scene ecrit ces deux valeurs dans son
       propre userData ; c'est `Apparitions.maj` qui les relit et les
       transmet au post-traitement — voir la-bas pour le pourquoi de cette
       indirection. */
    g.userData.assombritDyn = smoothstep(0.70, 0.80, u) * smoothstep(0.97, 0.87, u) * 0.60 * vis;
    g.userData.teinteDyn = 0x6B0E12;
    g.userData.teinteForceDyn = smoothstep(0.72, 0.83, u) * smoothstep(0.97, 0.89, u) * 0.55 * vis;
  };
  return g;
}

export function coutJumelles() {
  return _corpsJumelle ? { triangles: _corpsJumelle.triangles, sommets: _corpsJumelle.sommets } : null;
}
