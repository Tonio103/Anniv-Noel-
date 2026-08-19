import * as THREE from 'three';
import { grainRond, lueurDiffuse } from '../../core/dot.js';
import { smoothstep, clamp } from '../../core/noise.js';
import { delorean } from '../vehicules.js';
import { halo, epouserLeSol } from './communs.js';

/* ==========================================================================
   5. LA DELOREAN

   Elle est deja partie : il ne reste que les deux trainees de feu sur la
   neige, qui s'allument et s'eteignent. C'est LA façon de citer ce film sans
   modeliser une voiture — le plan de fin ne montre lui-meme que ca.
   ========================================================================== */
/* La matiere du feu au sol. La lueur ronde partagee ne convient PAS ici :
   son profil radial, etire sur une bande de vingt-six metres, ne laisse
   qu'un mince filament clair au milieu et du noir partout ailleurs — ce
   qu'on voyait, deux rayures palottes sur la neige. Il faut un degrade qui
   ne s'eteigne que dans la LARGEUR et reste plein sur toute la longueur,
   avec un coeur presque blanc borde d'orange : un pneu qui a brule laisse
   une marque chaude au centre et rougeoyante sur les bords. */
let _braise = null;
function texturebraise() {
  if (_braise) return _braise;
  const l = 8, h = 128;
  const cv = document.createElement('canvas');
  cv.width = l; cv.height = h;
  const c = cv.getContext('2d');
  const d = c.createLinearGradient(0, 0, l, 0);
  d.addColorStop(0.00, 'rgba(255,110,20,0)');
  d.addColorStop(0.22, 'rgba(255,140,40,0.55)');
  d.addColorStop(0.46, 'rgba(255,225,170,1)');
  d.addColorStop(0.54, 'rgba(255,225,170,1)');
  d.addColorStop(0.78, 'rgba(255,140,40,0.55)');
  d.addColorStop(1.00, 'rgba(255,110,20,0)');
  c.fillStyle = d;
  c.fillRect(0, 0, l, h);
  _braise = new THREE.CanvasTexture(cv);
  _braise.colorSpace = THREE.SRGBColorSpace;
  return _braise;
}

export function traineesDeFeu(longueur, palier, relief) {
  const g = new THREE.Group();

  /* LA VOITURE ELLE-MEME, QUI MANQUAIT.

     Antoine : « il y a Retour vers le futur, ameliore-la ». Il n'y avait que
     les deux trainees de feu. C'est le plan de fin du film, et c'est joli,
     mais on ne cite pas un film en n'en montrant que la consequence.

     Elle arrive de loin derriere, monte en regime — les arcs bleus du
     condensateur se mettent a courir sur la caisse —, passe, et DISPARAIT
     dans un eclair a l'instant precis ou les trainees s'allument. La
     sequence entiere dure six secondes sur une fenetre qui en compte douze.

     Elle roule dans le repere LOCAL de la scene, le long de son axe Z. La
     scene est posee sur le chemin et orientee selon sa tangente : sur les
     quatre-vingts metres que la voiture parcourt, l'ecart avec la vraie
     courbe reste sous le metre, et a cette vitesse-la personne ne peut le
     voir. C'est le seul endroit du fichier ou l'on se permet cette
     approximation, et c'est parce qu'elle achete beaucoup de simplicite. */
  const auto = delorean();
  g.add(auto);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  flash.material.color.setRGB(3.6, 3.5, 3.2);
  flash.scale.setScalar(18);
  g.add(flash);
  const bandes = [];
  for (const sx of [-1, 1]) {
    /* Trente-deux tronçons dans la longueur : c'est ce qu'il faut pour que
       la bande suive les bosses au lieu de plonger dedans. */
    const geo = new THREE.PlaneGeometry(0.72, longueur, 1, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: texturebraise(), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    });
    mat.color.setRGB(2.2, 1.0, 0.42);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(sx * 0.78, 0.06, 0);
    m.renderOrder = 1;
    g.add(m);
    bandes.push(m);
  }
  const front = halo([3.6, 1.6, 0.5], 4.2);
  front.position.set(0, 0.7, -longueur / 2);
  g.add(front);

  /* LES BRAISES. Ce qui manquait pour que ce soit du feu et non deux
     marques au sol : des points qui montent et s'eteignent au-dessus des
     trainees. Le feu se lit a ce qui s'en echappe, pas a ce qui reste. */
  const N = 90;
  const pos = new Float32Array(N * 3);
  const geoBr = new THREE.BufferGeometry();
  geoBr.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const matBr = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xFFB059, size: 0.11,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const braises = new THREE.Points(geoBr, matBr);
  braises.frustumCulled = false;
  g.add(braises);
  // Chaque braise a sa propre avance, son cote et sa derive laterale.
  const vies = new Float32Array(N).map(() => Math.random());
  const cotes = new Float32Array(N).map((_, i) => (i % 2 ? 0.78 : -0.78));
  const dispersion = new Float32Array(N).map(() => (Math.random() - 0.5) * 0.55);
  const lelong = new Float32Array(N).map(() => Math.random());

  g.userData.poser = (relief) => {
    for (const b of bandes) epouserLeSol(b, relief, 0.07);
  };

  /* Le saut n'a lieu qu'une fois par passage. On remet tout a zero quand la
     fenetre se referme, pour que la voiture repasse si l'on refait la
     balade. */
  g.userData.reinit = () => { sautFait = false; zPrecedent = null; };

  /* Le trajet de la voiture, en metres le long de l'axe local. Elle part
     au-dela du brouillard et s'evanouit a l'extremite arriere des trainees,
     celle par laquelle elles commencent. */
  const Z0 = 58, Z1 = -longueur / 2 - 2;
  const _p = new THREE.Vector3();
  const SAUT = 0.30;                       // l'instant du flash, en fraction de fenetre
  let sautFait = false;
  let zPrecedent = null;

  g.userData.jouer = (u, t) => {
    /* --- LA VOITURE, jusqu'au saut. ------------------------------------- */
    const k = clamp(u / SAUT, 0, 1);
    /* LA COURBE DE POSITION, EN TROIS TEMPS. Antoine : « on ne reconnait
       pas la DeLorean ». Une pure acceleration (le carre du parcours) la
       laissait loin et minuscule presque tout le temps, puis elle jaillissait
       pres de nous une fraction de seconde avant le flash — jamais assez
       longtemps pour VOIR une voiture, seulement assez pour deviner qu'il y
       avait quelque chose de lumineux. On lui donne desormais un temps FORT
       au milieu : elle approche, se stabilise a bonne distance le temps
       qu'on la voie vraiment — carrosserie basse, reacteur, arcs bleus —
       puis elle s'elance pour de bon vers le point du saut. */
    let av;
    if (k < 0.38) {
      const p = k / 0.38;
      av = 0.78 * (p * p * (3 - 2 * p));
    } else if (k < 0.72) {
      av = 0.78;
    } else {
      const p = (k - 0.72) / 0.28;
      av = 0.78 + 0.22 * p * p;
    }
    const encoreLa = u < SAUT;
    auto.visible = encoreLa;
    if (encoreLa) {
      auto.position.z = Z0 + (Z1 - Z0) * av;
      /* ELLE ROULAIT SOUS LA NEIGE. La scene est posee a la hauteur du sol
         SOUS SON ANCRAGE, et la voiture parcourt plusieurs dizaines de
         metres a partir de la : sur cette distance le terrain monte et
         descend de plusieurs metres, si bien qu'elle etait enterree la
         moitie du temps et flottait le reste. Elle prend donc la hauteur du
         sol SOUS ELLE, a chaque image. C'est le meme oubli que pour les
         flaques de gyrophare, et il se manifeste ici en pire : la voiture
         disparaissait purement et simplement. */
      _p.set(0, 0, auto.position.z).applyMatrix4(g.matrixWorld);
      auto.position.y = relief.hauteur(_p.x, _p.z) - g.position.y;
      /* Les roues tournent au rythme du deplacement REEL, mesure d'une
         image a l'autre — indispensable maintenant que la vitesse n'est
         plus une simple derivee du carre : sur le palier du milieu, ou la
         voiture est stable, elles doivent cesser de tourner, pas continuer
         d'accelerer comme le laissait croire l'ancienne formule. */
      const dz = zPrecedent === null ? 0 : Math.abs(auto.position.z - zPrecedent);
      zPrecedent = auto.position.z;
      for (const r of auto.userData.roues) r.rotation.x -= dz / 0.32;
      const proche = smoothstep(0.35, 0.95, k);
      for (const p of auto.userData.phares) p.material.opacity = 0.9;
      for (const c of auto.userData.cones) c.material.opacity = 0.30;
      /* LES ARCS DU CONDENSATEUR. Ils n'apparaissent qu'a la toute fin de
         la montee en regime, et par a-coups tres brefs : c'est ce
         crepitement qui annonce le saut. */
      for (let i = 0; i < auto.userData.arcs.length; i++) {
        const bruit = Math.pow(Math.abs(Math.sin(t * 23 + i * 2.1)), 8);
        auto.userData.arcs[i].material.opacity = proche * bruit * 0.95;
      }
      /* Le son suit la montee en regime, et le crepitement du condensateur
         arrive avec les arcs — donc juste avant le saut. Sans cette montee,
         la disparition tombe sans prevenir. */
      const regler = [{ regime: 0.25 + av * 0.75, doppler: 0, volume: 1 }];
      regler.crepite = proche;
      g.userData.emettre?.('regler', regler);
    }

    /* --- L'ECLAIR, une seule fois. --------------------------------------- */
    const depuis = (u - SAUT) / 0.06;
    flash.material.opacity = u >= SAUT && depuis < 1
      ? Math.pow(1 - clamp(depuis, 0, 1), 2.2)
      : 0;
    _p.set(0, 0, Z1).applyMatrix4(g.matrixWorld);
    flash.position.set(0, relief.hauteur(_p.x, _p.z) - g.position.y + 0.9, Z1);
    if (!sautFait && u >= SAUT) {
      sautFait = true;
      /* LE SAUT, PAS UNE EXPLOSION. Une aspiration qui monte, le claquement,
         puis une queue de sub qui s'effondre : c'est la forme d'un depart.
         Et l'on coupe le moteur dans le meme geste — la voiture n'est plus
         la, son moteur ne peut pas continuer a tourner. */
      g.userData.emettre?.('saut');
      const eteint = [{ regime: 0, doppler: 0, volume: 0 }];
      eteint.crepite = 0;
      g.userData.emettre?.('regler', eteint);
    }

    /* --- LES TRAINEES. Elles ne s'allument qu'APRES le saut : ce sont
       elles qui restent quand la voiture n'est plus la. ------------------- */
    const allume = smoothstep(SAUT, SAUT + 0.05, u) * smoothstep(1, 0.62, u);
    const scint = 0.82 + Math.sin(t * 27) * 0.18;
    for (const b of bandes) b.material.opacity = allume * 1.15 * scint;
    /* Le halo de tete ne s'allume qu'au saut, avec les trainees : avant, la
       voiture est encore la et c'est ELLE qu'on regarde. */
    front.material.opacity = smoothstep(SAUT, SAUT + 0.03, u) * smoothstep(SAUT + 0.30, SAUT + 0.08, u) * 0.9;

    /* LA VISIBILITE DU GROUPE NE PEUT PAS DEPENDRE DES SEULES TRAINEES.

       Elle en dependait, et les trainees ne s'allument qu'APRES le saut :
       tout le groupe — donc la voiture, donc toute la premiere moitie de la
       scene — restait invisible pendant l'approche. On voyait le resultat
       sans jamais voir ce qui l'avait produit, ce qui est exactement le
       defaut qu'on cherchait a corriger. Le groupe vit tant que l'un OU
       l'autre a quelque chose a montrer. */
    g.visible = allume > 0.01 || encoreLa || flash.material.opacity > 0.01;

    /* Les braises montent, derivent, et s'eteignent d'autant plus vite que
       la trainee elle-meme faiblit. */
    matBr.opacity = allume * 0.85;
    for (let i = 0; i < N; i++) {
      vies[i] += 0.019;
      if (vies[i] > 1) vies[i] -= 1;
      const k = vies[i];
      pos[i * 3] = cotes[i] + dispersion[i] * k + Math.sin(t * 2.3 + i) * 0.10 * k;
      pos[i * 3 + 1] = 0.08 + k * k * 1.7;
      pos[i * 3 + 2] = (lelong[i] - 0.5) * longueur * 0.92 + k * 0.7;
    }
    geoBr.attributes.position.needsUpdate = true;
  };
  return g;
}
