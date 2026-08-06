/* La foret du cerf.

   Un cerf traverse une foret enneigee ; un drone le suit ; a chaque halte, un
   cadeau se deterre de la neige. Le tout en un seul plan, sans coupe.

   Ce fichier est le chef d'orchestre : il enchaine les moments de la balade
   et ne fait rien d'autre. Chaque piece (foret, cerf, camera, son, cartes)
   vit dans son propre module.
*/

import * as THREE from 'three';
import { STATIONS } from './content/stations.js';
import { detecterPalier, Vigie, PALIERS } from './core/quality.js';
import { creerRendu, brancherResize, webglDisponible } from './core/renderer.js';
import { Boucle } from './core/loop.js';
import { clamp, smoothstep } from './core/noise.js';
import { Ciel } from './world/sky.js';
import { Lumieres } from './world/lighting.js';
import { Relief } from './world/terrain.js';
import { accorderNeige } from './world/snowMaterial.js';
import { Foret } from './world/forest.js';
import { Neige } from './world/snowfall.js';
import { Chemin } from './camera/path.js';
import { Drone } from './camera/droneRig.js';
import { Cerf } from './deer/deerRig.js';
import { Halte, PHASES } from './gifts/station.js';
import { Son } from './audio/engine.js';
import { Bruitages } from './audio/sfx.js';
import { Carte } from './ui/card.js';
import { Invite, Trace, PanneauSon, brancherSeuil } from './ui/hud.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

/* Duree des moments qui ne dependent pas du visiteur, en secondes. */
const DUREES = { fouille: 2.4, percee: 3.4, ouverture: 1.35 };

async function demarrer() {
  const canvas = document.getElementById('gl');
  const boot = document.getElementById('boot');

  const gl = webglDisponible();
  if (!gl) {
    const { afficherRepli } = await import('./ui/fallback.js');
    boot.classList.add('out');
    afficherRepli();
    return;
  }

  let palier = detecterPalier(gl);
  const force = params.get('q');
  if (force && PALIERS[force]) {
    palier = { ...PALIERS[force], mobile: palier.mobile, force: true };
    palier.dpr = Math.min(palier.dpr, window.devicePixelRatio || 1);
  }
  if (DEBUG) console.log('palier', palier.nom, palier.gpu);

  const renderer = creerRendu(canvas, palier);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.35, 620);

  const uniformsVent = {
    uTemps: { value: 0 },
    uVent: { value: new THREE.Vector2(0.85, 0.34) },
  };

  /* ---------------------------------------------------------------- monde */
  const chemin = new Chemin(STATIONS.length, 7);

  const clairieres = [];
  for (let i = 0; i < STATIONS.length; i++) {
    const st = STATIONS[i];
    if (st.kind === 'clearing' || st.kind === 'final') {
      const p = chemin.haltes[i].pos;
      clairieres.push({ x: p.x, z: p.z, r: st.kind === 'final' ? 38 : 30, h: 0 });
    }
  }

  const ciel = new Ciel(scene, palier);
  const lumieres = new Lumieres(scene, palier);
  const relief = new Relief(chemin, palier, clairieres);
  scene.add(relief.groupe);
  for (const c of clairieres) c.h = relief.hauteur(c.x, c.z);

  const foret = new Foret(chemin, relief, palier, clairieres, uniformsVent);
  scene.add(foret.groupe);

  const neige = new Neige(scene, palier);

  scene.environment = ciel.environnement(renderer);
  scene.environmentIntensity = 0.32;

  brancherResize(renderer, camera, null, palier);

  /* --------------------------------------------------------- cerf, camera */
  const cerf = new Cerf(palier, chemin, relief);
  scene.add(cerf.racine);
  cerf.s = 12;

  const drone = new Drone(camera, chemin, relief, palier);
  drone.cadrer('large');
  drone.poser(cerf, 0);

  const halte = new Halte(scene, palier, relief);

  /* ------------------------------------------------------------------ son */
  const son = new Son();
  const sfx = new Bruitages(son);
  const ancreCadeau = new THREE.Object3D();
  scene.add(ancreCadeau);
  let voixCerf = null, voixSabots = null, voixCadeau = null;

  /* --------------------------------------------------------------- ecrans */
  const invite = new Invite();
  const trace = new Trace(STATIONS.length - 1);
  const panneau = new PanneauSon(son);
  const carte = new Carte(() => fermerCarte());

  /* ------------------------------------------------------- machine d'etat */
  let phase = PHASES.ROUTE;
  let index = 0;              // halte 0 = le seuil, on vise la 1
  let horloge = 0;            // temps ecoule dans la phase courante
  let demarree = false;
  const ancre = new THREE.Vector3();

  function viser(i) {
    index = i;
    const st = STATIONS[i];
    if (st?.scene?.light) ciel.viser(st.scene.light);
  }

  function entrerPhase(p) {
    phase = p;
    horloge = 0;

    switch (p) {
      case PHASES.ROUTE:
        cerf.vitesseCible = 6.2;
        cerf.regard = 0;
        drone.cadrer('route');
        drone.regarder(null, 0);
        panneau.attenuer(false);
        break;

      case PHASES.APPROCHE:
        cerf.vitesseCible = 2.3;
        drone.cadrer('approche');
        break;

      case PHASES.FOUILLE: {
        cerf.vitesseCible = 0;
        drone.cadrer('halte');
        const st = STATIONS[index];
        const cote = index % 2 === 0 ? 1 : -1;
        const pose = halte.preparer(st, chemin, chemin.haltes[index].s + 1.5, cote);
        if (pose) {
          ancreCadeau.position.copy(halte.centre);
          if (son.pret && !voixCadeau) voixCadeau = sfx.ancrer(ancreCadeau, 42);
          // Le son passe SOUS la neige avant que l'image ne montre quoi que
          // ce soit : c'est l'attente qui fait exister le moment.
          sfx.grondement(voixCadeau?.entree, DUREES.fouille + DUREES.percee * 0.5);
        }
        break;
      }

      case PHASES.PERCEE:
        cerf.grattage = 0;
        cerf.regard = 0.35;
        break;

      case PHASES.ATTENTE: {
        const st = STATIONS[index];
        invite.montrer(st.prompt || 'Touchez le cadeau');
        cerf.regard = 0.8;         // il se retourne et attend
        drone.cadrer('halte');
        break;
      }

      case PHASES.OUVERTURE:
        invite.cacher();
        sfx.ouverture(voixCadeau?.entree);
        cerf.regard = 0.5;
        break;

      case PHASES.LECTURE:
        drone.cadrer('lecture');
        panneau.attenuer(true);
        carte.ouvrir(STATIONS[index].card);
        break;

      case PHASES.REPRISE:
        trace.marquer(index - 1);
        cerf.regard = 0;
        cerf.vitesseCible = 6.2;
        drone.cadrer('route');
        panneau.attenuer(false);
        break;
    }
  }

  function fermerCarte() {
    if (phase !== PHASES.LECTURE) return;
    entrerPhase(PHASES.REPRISE);
  }

  /* Un geste, n'importe ou : sur un telephone, exiger de viser le paquet
     serait penible et raterait souvent. L'anneau dit ou regarder ; le doigt
     peut tomber ou il veut. */
  function toucher() {
    if (phase === PHASES.ATTENTE) {
      const st = STATIONS[index];
      entrerPhase(st.scene?.gift ? PHASES.OUVERTURE : PHASES.LECTURE);
    }
  }
  canvas.addEventListener('pointerdown', toucher);
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toucher(); }
  });

  /* ----------------------------------------------------------------- pas  */
  function pas(dt, t) {
    uniformsVent.uTemps.value = t;
    horloge += dt;

    const cible = chemin.haltes[index];

    switch (phase) {
      case PHASES.ROUTE:
        if (demarree && cible && cerf.s > cible.s - 24) entrerPhase(PHASES.APPROCHE);
        break;

      case PHASES.APPROCHE:
        if (cerf.s > cible.s - 1.2 || cerf.vitesse < 0.12) entrerPhase(PHASES.FOUILLE);
        break;

      case PHASES.FOUILLE:
        // Il gratte la neige : c'est ce geste qui declenche la sortie.
        cerf.grattage = clamp(horloge / DUREES.fouille, 0, 1);
        if (horloge > DUREES.fouille) {
          cerf.grattage = 0;
          entrerPhase(PHASES.PERCEE);
        }
        break;

      case PHASES.PERCEE: {
        const a = clamp(horloge / DUREES.percee, 0, 1);
        halte.majEmergence(dt, a, t);
        drone.regarder(halte.ancre(ancre), smoothstep(0.1, 0.6, a) * 0.75);
        if (halte.emergence._jaillieA >= 0 && !halte._gerbeJouee) {
          halte._gerbeJouee = true;
          sfx.gerbe(voixCadeau?.entree);
        }
        if (a >= 1) { halte._gerbeJouee = false; entrerPhase(PHASES.ATTENTE); }
        break;
      }

      case PHASES.ATTENTE:
        halte.majEmergence(dt, 1, t);
        drone.regarder(halte.ancre(ancre), 0.75);
        invite.ancrer(halte.ancre(ancre), camera);
        break;

      case PHASES.OUVERTURE:
        halte.majEmergence(dt, 1, t);
        halte.majOuverture(dt, t);
        drone.regarder(halte.ancre(ancre), 0.8);
        if (horloge > DUREES.ouverture) entrerPhase(PHASES.LECTURE);
        break;

      case PHASES.LECTURE:
        halte.majEmergence(dt, 1, t);
        halte.majOuverture(dt * 0.35, t);
        drone.regarder(halte.ancre(ancre), 0.55);
        carte.ancrer(halte.ancre(ancre), camera);
        break;

      case PHASES.REPRISE:
        halte.majEmergence(dt, 1, t);
        drone.regarder(halte.ancre(ancre), Math.max(0, 0.55 - horloge * 0.55));
        if (horloge > 1.4) {
          if (index >= STATIONS.length - 1) {
            // Fin : il s'eloigne dans la neige, la camera prend de la hauteur.
            drone.cadrer('large');
            phase = PHASES.ROUTE;
            index = STATIONS.length;
          } else {
            viser(index + 1);
            entrerPhase(PHASES.ROUTE);
          }
        }
        break;
    }

    /* La lueur du paquet eclaire vraiment la neige autour. */
    if (halte.cadeau) {
      halte.ancre(ancre);
      const g = STATIONS[index]?.scene?.gift;
      lumieres.poserLueur(ancre, g ? g.glow : 0xFFC98A, halte.eclat());
    } else {
      lumieres.poserLueur(null, undefined, 0);
    }

    cerf.maj(dt, t);

    /* Le son se cale sur les posers reels, jamais sur une minuterie. */
    for (const p of cerf.posers) {
      sfx.sabot(voixSabots?.entree, p.force);
      if (Math.random() < 0.42) sfx.grelots(voixCerf?.entree, 0.5 + p.force * 0.5);
    }
    cerf.posers.length = 0;

    drone.maj(dt, t, cerf);

    ciel.maj(dt, t, camera);
    lumieres.accorder(ciel.actuel);
    lumieres.maj(camera, cerf.racine.position);
    accorderNeige(relief.materiau, ciel.actuel, lumieres.dir);
    if (cerf.materiau.userData.uniforms) {
      cerf.materiau.userData.uniforms.uLisereCol.value.set(ciel.actuel.soleil);
      cerf.materiau.userData.uniforms.uLisereDir.value.copy(lumieres.dir);
    }
    relief.maj(camera, ciel.actuel);
    foret.maj(camera);
    neige.maj(dt, t, camera, renderer);
    son.maj(dt, cerf.vitesse);
  }

  const vigie = new Vigie(palier, (p) => {
    palier = p;
    renderer.setPixelRatio(p.dpr);
    renderer.shadowMap.enabled = p.ombres;
  });

  const boucle = new Boucle((dt, t) => {
    vigie.tic(dt);
    pas(dt, t);
    renderer.render(scene, camera);
  });

  /* ------------------------------------------------------------- le seuil */
  viser(0);
  boot.classList.add('out');
  setTimeout(() => { boot.hidden = true; }, 900);
  document.getElementById('entry').hidden = false;

  brancherSeuil(() => {
    son.demarrer(camera);
    voixCerf = sfx.ancrer(cerf.tete, 40);
    voixSabots = sfx.ancrer(cerf.racine, 34);
    panneau.montrer();
    demarree = true;
    viser(1);
    entrerPhase(PHASES.ROUTE);
  });

  boucle.demarrer();

  window.__scene = {
    renderer, scene, camera, chemin, relief, foret, ciel, cerf, drone, halte, boucle, palier,
    /* Outils de controle : placer la balade a une halte, avancer le temps. */
    aller(i, ph) {
      demarree = true;
      viser(Math.min(i, STATIONS.length - 1));
      cerf.s = chemin.haltes[index].s - (ph ? 2 : 30);
      entrerPhase(ph || PHASES.ROUTE);
      document.getElementById('entry').hidden = true;
      drone.poser(cerf, boucle.t);
    },
    simuler(secondes) {
      const h = 1 / 60;
      for (let acc = 0; acc < secondes; acc += h) { boucle.t += h; pas(h, boucle.t); }
    },
    phase: () => phase,
  };
}

demarrer().catch((e) => {
  console.error(e);
  import('./ui/fallback.js').then(({ afficherRepli }) => afficherRepli(e));
});
