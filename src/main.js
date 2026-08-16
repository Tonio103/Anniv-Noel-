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
import { clamp, lerp, smoothstep } from './core/noise.js';
import { Ciel } from './world/sky.js';
import { Lumieres } from './world/lighting.js';
import { Relief } from './world/terrain.js';
import { accorderNeige } from './world/snowMaterial.js';
import { Foret } from './world/forest.js';
import { Neige } from './world/snowfall.js';
import { Brume } from './world/mist.js';
import { Empreintes } from './world/footprints.js';
import { Details } from './world/details.js';
import { Apparitions } from './world/apparitions.js';
import { Cabanes } from './world/cabins.js';
import { Fouillis } from './world/props.js';
import { Poudre } from './world/puffs.js';
import { Ruisseau } from './world/stream.js';
import { Clairieres } from './world/clearing.js';
import { PostFX } from './core/postfx.js';
import { Chemin } from './camera/path.js';
import { Drone } from './camera/droneRig.js';
import { Cerf } from './deer/deerRig.js';
import { Halte, PHASES } from './gifts/station.js';
// Uniquement pour le prechauffage des nuanceurs : voir `prechauffer()`.
import { creerCadeau } from './gifts/giftMesh.js';
import { Son } from './audio/engine.js';
import { Bruitages } from './audio/sfx.js';
import { ApparitionsSon } from './audio/apparitionsSon.js';
import { Carte } from './ui/card.js';
import { Invite, Trace, PanneauSon, Fin, brancherSeuil } from './ui/hud.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

/* Duree des moments qui ne dependent pas du visiteur, en secondes. */
const DUREES = { fouille: 2.4, percee: 3.4, ouverture: 1.95 };

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

  /* Uniformes partages par tous les vegetaux : le temps et le vent, plus les
     deux couleurs de l'ambiance courante. Les mettre en commun garantit que la
     foret, le premier plan et les sapins des clairieres virent ENSEMBLE quand
     le ciel change — trois jeux separes finiraient par diverger. */
  const uniformsVent = {
    uTemps: { value: 0 },
    uVent: { value: new THREE.Vector2(0.85, 0.34) },
    uLuneCol: { value: new THREE.Color(0xFFD2A0) },
    uCielCol: { value: new THREE.Color(0x7A9CBC) },
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

  const fouillis = new Fouillis(chemin, relief, palier, clairieres);
  scene.add(fouillis.groupe);

  /* LE PREMIER PLAN A ETE RETIRE.

     J'avais ajoute des futs clairs pres du chemin et des branches basses,
     pour donner au travelling des reperes de vitesse. Sur mon banc d'essai
     ils passaient ; sur un vrai telephone ils se lisent comme des MATS
     D'ANTENNE et des planches flottantes — des traits sombres rectilignes
     posés sur la neige, sans base visible et sans rapport avec une foret.
     Ils rendaient la scene plus fausse, pas plus vivante.

     Le manque qu'ils devaient combler etait reel, mais je l'avais mal
     diagnostique : ce n'est pas d'objets pres de l'objectif qu'il manquait,
     c'est que la FORET ELLE-MEME se tenait a vingt metres. La marge du
     couloir est desormais proportionnelle a la taille de l'arbre, si bien
     que le sous-bois vient border le chemin. C'est la bonne reponse, et elle
     n'ajoute aucun objet etranger.

     Le fichier world/foreground.js reste dans le depot mais n'est plus
     instancie : il documente une piste essayee, mesuree sur l'appareil
     reel, et abandonnee pour cette raison. */

  /* Le ruisseau gele : le seul endroit ou la matiere du sol change. On le
     construit avant la neige qui tombe, pour qu'il soit dessine dessous. */
  const ruisseau = new Ruisseau(scene, chemin, relief, palier, clairieres);

  const neige = new Neige(scene, palier);
  const brume = new Brume(scene, palier);
  const details = new Details(scene, palier);
  const cabanes = new Cabanes(scene, chemin, relief, palier, clairieres);
  /* Les clins d'oeil semes le long du trajet. Ils ne dependent d'aucune
     phase : ils se declenchent a la distance parcourue, donc ils marchent
     aussi bien pendant un trajet que pendant une halte. */
  const apparitions = new Apparitions(scene, chemin, relief, palier);

  /* Les traces de sabots : une texture en coordonnees monde, echantillonnee
     par le shader de neige pour assombrir et creuser la surface. */
  const empreintes = new Empreintes(renderer, palier);
  relief.brancherEmpreintes(empreintes);

  /* Et la neige qu'il chasse a chaque poser. L'empreinte dit ou il est passe,
     la poudre dit qu'il passe MAINTENANT. */
  const poudre = new Poudre(scene, palier);
  const solPourPoudre = (x, z) => relief.hauteur(x, z);

  /* La taille d'un point est exprimee en pixels : elle doit suivre la hauteur
     reelle du canevas, sinon la poudre double de taille des qu'on tourne le
     telephone ou que la qualite retrograde. */
  const ajusterPoudre = () => {
    const h = renderer.domElement.clientHeight || window.innerHeight;
    poudre.redimensionner(h * renderer.getPixelRatio(), camera.fov);
  };
  ajusterPoudre();
  window.addEventListener('resize', () => setTimeout(ajusterPoudre, 150));
  window.addEventListener('orientationchange', () => setTimeout(ajusterPoudre, 300));

  /* Ce qui habite les clairieres : les jalons de dates et le sapin de la
     derniere halte. Ils reutilisent la silhouette d'arbre de la foret. */
  const habitants = new Clairieres(
    scene, chemin, relief, palier, STATIONS,
    foret.modele, foret.matFeuillage, foret.matNeige
  );

  scene.environment = ciel.environnement(renderer);
  scene.environmentIntensity = 0.32;

  /* Post-traitement. Quand il est actif, la scene part dans une cible
     flottante et c'est la passe finale qui applique la courbe ACES : le
     materiau ne doit donc plus la faire lui-meme, sous peine de l'appliquer
     deux fois et d'ecraser toutes les hautes lumieres. */
  const postfx = new PostFX(renderer, palier);
  if (postfx.actif) renderer.toneMapping = THREE.NoToneMapping;

  const ajusterTaille = brancherResize(renderer, camera, postfx, () => palier);

  /* --------------------------------------------------------- cerf, camera */
  // Abscisse de depart, partagee par le seuil et par le retour en fin de
  // balade : les deux doivent poser la camera au meme endroit degage.
  const DEPART = 26;

  const cerf = new Cerf(palier, chemin, relief);
  scene.add(cerf.racine);
  /* Le cerf ne demarre pas a la lisiere meme du chemin.

     La camera du seuil se tient douze metres DERRIERE lui. A s = 12, elle se
     retrouvait donc AVANT le debut du trace — une zone que la regle du
     couloir degage ne protege pas, puisque la distance au chemin y est
     mesuree jusqu'a son premier point. L'appareil demarrait a l'interieur
     d'un sapin et l'ecran d'accueil s'ouvrait sur un aplat noir. Le defaut
     etait masque tant que le cadrage large visait au-dessus des cimes ; il
     est apparu des qu'on l'a redescendu pour rendre le cerf visible. */
  cerf.s = DEPART;

  const drone = new Drone(camera, chemin, relief, palier);
  drone.cadrer('large');
  drone.poser(cerf, 0);

  /* LE PLAN D'OUVERTURE, compose et non subi.

     Le laisser au rig de suivi ne marchait pas. Ses derives lentes — celles
     qui font justement qu'en route le cadrage ne se repete jamais — placent
     la camera au petit bonheur : selon la seconde, elle se retrouvait dans
     un sapin, ou visant le ciel, ou avec le cerf hors champ. Or c'est la
     PREMIERE image, celle que toute la famille verra, et la seule qui doive
     tenir plusieurs dizaines de secondes sans bouger.

     On la pose donc explicitement, comme la derniere. La camera reste
     vivante — flottement de main levee, respiration de l'objectif, neige qui
     tombe, sapins qui travaillent — mais son cadre, lui, est choisi : le
     cerf dans le tiers bas et decale, la trouee du chemin derriere lui, et
     tout le centre libre pour le titre. */
  function poserSeuil() {
    const p0 = chemin.point(DEPART, new THREE.Vector3());
    const tan0 = chemin.tangente(DEPART, new THREE.Vector3());
    const cot0 = chemin.cote(DEPART, new THREE.Vector3());
    const sol0 = relief.hauteur(p0.x, p0.z);

    // En retrait sur l'axe du chemin : c'est le seul endroit dont on sache
    // qu'il est degage, puisque c'est le couloir de marche lui-meme.
    const poste = new THREE.Vector3(
      p0.x - tan0.x * 10.5 + cot0.x * 1.2,
      sol0 + 2.75,
      p0.z - tan0.z * 10.5 + cot0.z * 1.2
    );
    /* On vise A COTE du cerf et AU-DESSUS : viser l'animal lui-meme le
       ramenerait au centre, exactement derriere le titre. C'est la visee qui
       compose, jamais la position seule.

       LE DECALAGE NE PEUT PAS ETRE UN NOMBRE DE METRES. Il valait 5,4 m, ce
       qui compose correctement en paysage — et met le cerf HORS CHAMP en
       portrait, ou il ne restait de lui qu'une croupe collee au bord droit.
       La raison est arithmetique : a quinze metres, 5,4 m de decalage font
       dix-neuf degres, alors que la demi-ouverture horizontale d'un telephone
       tenu debout n'est que de quatorze. Le cadrage etait donc juste sur mon
       ecran et faux sur le sien, sans que rien dans le code ne le dise.

       On raisonne desormais en FRACTION DE LA DEMI-LARGEUR VISIBLE : le cerf
       se place a 58 % du bord, quel que soit le format. C'est la seule
       formulation qui veuille dire la meme chose sur les deux appareils. */
    const recul = 10.5, avance = 5;
    const demiOuverture = Math.atan(
      Math.tan(THREE.MathUtils.degToRad(drone.fov) / 2) * (camera.aspect || 1));

    /* EN PORTRAIT, ON NE DEGAGE PAS SUR LE COTE : ON DEGAGE VERS LE BAS.

       Ecarter le cerf lateralement fonctionne en paysage, ou le texte occupe
       une colonne centrale et laisse les bords libres. En portrait le bloc de
       titre traverse toute la largeur : meme pousse au bord, l'animal reste
       derriere du texte, et ses bois passent au travers des lettres.

       Le format donne pourtant lui-meme la solution — ce qu'un ecran debout a
       en abondance, c'est de la hauteur. On vise donc nettement plus haut, ce
       qui fait tomber le cerf dans le tiers bas, sous le bouton, la ou il n'y
       a rien. Les deux formats obtiennent ainsi la meme chose — un animal
       lisible et un texte lisible — par le degagement que chacun peut offrir. */
    const portrait = (camera.aspect || 1) < 1;
    const lateral = Math.tan(demiOuverture * (portrait ? 0.34 : 0.58)) * (recul + avance);
    const vise = new THREE.Vector3(
      p0.x + tan0.x * avance - cot0.x * lateral,
      sol0 + (portrait ? 6.6 : 3.05),
      p0.z + tan0.z * avance - cot0.z * lateral
    );
    drone.figer(vise, poste);
    drone.pos.copy(poste);
    drone.vise.copy(vise);
  }
  poserSeuil();

  const halte = new Halte(scene, palier, relief);

  /* ------------------------------------------------------------------ son */
  const son = new Son();
  const sfx = new Bruitages(son);
  /* Le son des apparitions. Il se branche ici et non a la construction des
     apparitions, parce que le contexte audio n'existe qu'apres le premier
     geste du visiteur : tant qu'il n'est pas ouvert, chaque appel se contente
     de ne rien faire. */
  const apparitionsSon = new ApparitionsSon(son, sfx);
  apparitions.brancherSon(apparitionsSon);
  const ancreCadeau = new THREE.Object3D();
  scene.add(ancreCadeau);
  let voixCerf = null, voixSabots = null, voixCadeau = null;

  /* --------------------------------------------------------------- ecrans */
  const invite = new Invite();
  const trace = new Trace(STATIONS.length - 1);
  const panneau = new PanneauSon(son);
  const carte = new Carte((revue) => fermerCarte(revue));

  /* Derniere carte lue, pour pouvoir la rouvrir. Sans cela, une carte
     refermee d'un doigt distrait est perdue jusqu'a ce qu'on refasse toute
     la balade — et c'est justement le contenu que la famille est venue lire. */
  let derniereCarte = null;
  const boutonRevoir = document.getElementById('recallBtn');
  boutonRevoir.addEventListener('click', () => {
    if (derniereCarte && !carte.visible) carte.ouvrir(derniereCarte, true);
  });
  const fin = new Fin(() => recommencer());
  /* Les evenements de la fin ne doivent se produire qu'une fois : la phase
     dure et son horloge repasse en boucle par les memes seuils. */
  const finBruits = { grelots: false, texte: false };

  /* ------------------------------------------------------- machine d'etat */
  let phase = PHASES.ROUTE;
  let index = 0;              // halte 0 = le seuil, on vise la 1
  let horloge = 0;            // temps ecoule dans la phase courante
  let demarree = false;
  const ancre = new THREE.Vector3();
  // Teinte de travail pour la lueur des cadeaux, allouee une fois.
  const teinteLueur = new THREE.Color();
  const BLANC_CHAUD = new THREE.Color(0xFFDCB4);

  function viser(i) {
    index = i;
    const st = STATIONS[i];
    if (st?.scene?.light) ciel.viser(st.scene.light);
  }

  /* Le sens de l'arc de camera, alterne d'une halte a l'autre. */
  const sensArc = () => (index % 2 === 0 ? 1 : -1);

  function entrerPhase(p) {
    phase = p;
    horloge = 0;

    switch (p) {
      case PHASES.ROUTE:
        /* IL ALLAIT TROP VITE. Six virgule deux metres par seconde, c'est
           vingt-deux kilometres a l'heure — un galop de fuite, pas la marche
           d'un guide. Le sol defilait sous la camera au point qu'on n'avait
           le temps de rien regarder, et l'ensemble se lisait comme une
           course. On redescend a une allure ou l'on peut suivre des yeux ce
           qui passe, et l'ecart entre les haltes a ete raccourci d'autant
           pour que la duree d'un trajet ne change pas.

           SECOND PALIER, 4,2 → 3,5. Antoine : « ses pattes bougent trop
           vite ». Le rythme des pas vaut la vitesse divisee par la foulee, et
           cette relation ne se negocie pas — c'est elle qui empeche les
           sabots de patiner. La foulee ayant du etre raccourcie pour que les
           pattes cessent de sur-tendre, la cadence s'etait envolee. On rend
           donc la moitie du chemin sur la foulee (voir deerRig) et l'autre
           moitie ici. */
        cerf.vitesseCible = 3.3;
        cerf.regard = 0;
        drone.cadrer('route');
        drone.regarder(null, 0);
        drone.arc(0, 0);
        panneau.attenuer(false);
        break;

      case PHASES.APPROCHE:
        cerf.vitesseCible = 2.3;
        drone.cadrer('approche');
        /* L'arc commence des l'approche, doucement, et son SENS ALTERNE d'une
           halte a l'autre. Sans cette alternance, les six haltes tournent
           toutes du meme cote et le procede se voit ; avec, chaque arrivee
           compose differemment sans qu'on sache pourquoi. */
        drone.arc(sensArc() * 0.045, 0.15);
        break;

      case PHASES.FOUILLE: {
        cerf.vitesseCible = 0;
        drone.cadrer('halte');
        const st = STATIONS[index];
        /* LE CADEAU SE POSE DU COTE DE LA CAMERA, TOUJOURS.

           Il alternait de part et d'autre du chemin pour varier. Mais la
           camera, elle, se tient d'un seul cote — celui du decalage lateral
           du drone. Une halte sur deux placait donc le cerf pile entre
           l'objectif et le paquet, et l'animal masquait exactement la chose
           qu'on venait voir sortir de la neige.

           La variete ne se perd pas pour autant : c'est desormais l'arc de
           camera qui tourne autour de la halte, dans un sens different a
           chaque fois. On compose avec le mouvement plutot qu'avec la
           position, ce qui est de toute facon plus juste. */
        const pose = halte.preparer(st, chemin, chemin.haltes[index].s + 1.5, 1);
        if (!pose) {
          // Rien d'enfoui ici : le cerf s'arrete, se retourne, et c'est tout.
          entrerPhase(PHASES.ATTENTE);
          break;
        }
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
        // Le paquet est sorti : on tourne un peu plus vite autour de lui.
        drone.arc(sensArc() * 0.085, 0.35);
        break;
      }

      case PHASES.OUVERTURE:
        sfx.ouverture(voixCadeau?.entree);
        cerf.regard = 0.5;
        // L'ouverture se regarde de face : l'arc se calme le temps du geste.
        drone.arc(sensArc() * 0.030, 0.25);
        break;

      case PHASES.LECTURE:
        drone.cadrer('lecture');
        /* Pendant la lecture, l'arc est a peine perceptible — mais il existe.
           C'est lui qui empeche la carte de se poser sur une image morte, et
           donc de ressembler a une diapositive. */
        drone.arc(sensArc() * 0.022, 0);
        panneau.attenuer(true);
        derniereCarte = STATIONS[index].card;
        boutonRevoir.hidden = false;
        carte.ouvrir(derniereCarte);
        break;

      case PHASES.REPRISE:
        trace.marquer(index - 1);
        cerf.regard = 0;
        cerf.vitesseCible = 3.3;
        drone.cadrer('route');
        drone.arc(0, 0);
        panneau.attenuer(false);
        break;
    }
  }

  function fermerCarte(revue) {
    // Une relecture ne fait pas avancer la balade.
    if (revue) return;
    if (phase !== PHASES.LECTURE) return;
    entrerPhase(PHASES.REPRISE);
  }

  /* On recommence SUR PLACE, sans recharger : la page est dechiffree en
     memoire et un rechargement redemanderait le code d'acces a la famille.
     Il suffit de ramener le cerf a la lisiere et de rendre la main au drone
     — la foret, elle, n'a pas bouge. */
  function recommencer() {
    finBruits.grelots = false;
    finBruits.texte = false;
    derniereCarte = null;
    boutonRevoir.hidden = true;
    halte.nettoyer();
    trace.effacer();
    /* Une sirene laissee derriere soi tournerait pour toujours : le cerf
       revient a la lisiere, mais les fenetres, elles, ne se referment pas
       toutes seules quand on saute en arriere. */
    apparitionsSon.toutFermer();
    for (const sc of apparitions.scenes) sc.ouverte = false;
    cerf.s = DEPART;
    cerf.regard = 0;
    cerf.grattage = 0;
    cerf.placer(cerf.s);
    drone.liberer();
    drone.cadrer('route');
    drone.poser(cerf, boucle.t);
    viser(1);
    entrerPhase(PHASES.ROUTE);
  }

  /* Un geste, n'importe ou : sur un telephone, exiger de viser le paquet
     serait penible et raterait souvent. L'anneau dit ou regarder ; le doigt
     peut tomber ou il veut. */
  function ouvrirCadeau() {
    if (phase !== PHASES.ATTENTE) return;
    const st = STATIONS[index];
    /* L'anneau se retire ICI, et non dans le cas OUVERTURE : les haltes
       sans paquet — les clairieres — sautent directement a la lecture, si
       bien que leur invite n'etait jamais rangee. Elle restait affichee
       jusqu'a la fin de la balade, y compris par-dessus l'image finale. */
    invite.cacher();
    entrerPhase(st.scene?.gift ? PHASES.OUVERTURE : PHASES.LECTURE);
  }

  canvas.addEventListener('pointerdown', ouvrirCadeau);
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ouvrirCadeau(); }
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

      /* LA FIN.

         Jusqu'ici il n'y en avait pas : la derniere carte se refermait, le
         cerf repartait, la camera le suivait, et ca s'arretait la. Une
         experience qui s'interrompt n'est pas une experience qui se termine.

         Elle est donc ecrite en quatre temps, minutes a la seconde :

           0 s   il ralentit — le voyage se relache ;
           2,6 s IL SE RETOURNE. C'est le seul geste qui compte. Il a jete des
                 coups d'oeil en arriere pendant toute la balade ; celui-ci
                 est le dernier, et il dure ;
           6,0 s LA CAMERA RENONCE A LE SUIVRE. Elle se pose et le laisse
                 partir. Tant qu'elle suit, il n'y a pas de fin : le sujet
                 reste centre et on attend la suite. C'est le renoncement de
                 l'appareil qui fait la fin, pas le depart de l'animal ;
           9,5 s le texte se pose en bas, sur la clairiere allumee.

         Rien ne recouvre l'image a aucun moment. */
      case PHASES.FIN: {
        const T = horloge;

        if (T < 2.6) {
          cerf.vitesseCible = lerp(4.6, 1.1, smoothstep(0, 2.6, T));
        } else if (T < 6.0) {
          // L'adieu. Il s'arrete franchement et nous regarde.
          cerf.vitesseCible = 0;
          cerf.regard = smoothstep(2.6, 3.5, T) * smoothstep(6.0, 5.2, T) * 0.95;
          if (!finBruits.grelots && T > 3.0) {
            finBruits.grelots = true;
            sfx.grelots(voixCerf?.entree, 0.8);
            sfx.naseaux(voixCerf?.entree);
          }
        } else {
          cerf.regard = 0;
          // Il repart, mais sans hate : ce n'est pas une fuite.
          cerf.vitesseCible = 3.0 * smoothstep(6.0, 7.4, T);
          if (cerf.s > chemin.longueur - 4) cerf.vitesseCible = 0;
        }

        if (T < 6.0) {
          drone.cadrer(T < 2.6 ? 'large' : 'lecture');
          cerf.ancre(ancre);
          drone.regarder(ancre, T < 2.6 ? 0 : 0.85);
        } else if (!drone.fige) {
          /* LA DERNIERE IMAGE, composee et non subie.

             Elle vise le sapin allume et les seize bougies, pas le cerf :
             c'est le decor qui doit rester dans le cadre quand l'animal en
             sort. Et la camera est POSEE a un endroit precis — en retrait,
             en hauteur, legerement de cote — parce que se figer sur place la
             laissait au hasard de sa derive, parfois au milieu meme de l'arc
             de bougies, qui remplissait alors l'ecran. */
          const sFin = chemin.haltes[STATIONS.length - 1].s;
          const p0 = chemin.point(sFin, new THREE.Vector3());
          const tanF = chemin.tangente(sFin, new THREE.Vector3());
          const cotF = chemin.cote(sFin, new THREE.Vector3());
          const sol0 = relief.hauteur(p0.x, p0.z);

          // Visee : entre les bougies et le sapin, un peu au-dessus du sol.
          ancre.set(
            p0.x + tanF.x * 8 + cotF.x * 2.5,
            sol0 + 2.6,
            p0.z + tanF.z * 8 + cotF.z * 2.5
          );
          const poste = new THREE.Vector3(
            p0.x - tanF.x * 13 - cotF.x * 4,
            sol0 + 6.2,
            p0.z - tanF.z * 13 - cotF.z * 4
          );
          drone.regarder(null, 0);
          drone.figer(ancre, poste);
        }

        if (T > 9.5 && !finBruits.texte) {
          finBruits.texte = true;
          fin.montrer();
        }
        break;
      }

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
        if (halte.cadeau) {
          drone.regarder(halte.ancre(ancre), 0.75);
          invite.ancrer(halte.ancre(ancre), camera);
        } else {
          // Sans paquet, l'anneau se pose sur le cerf lui-meme.
          cerf.ancre(ancre); ancre.y += 0.35;
          drone.regarder(ancre, 0.35);
          invite.ancrer(ancre, camera);
        }
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
            // Fin : elle est ecrite dans le cas PHASES.FIN, en quatre temps.
            drone.cadrer('large');
            drone.regarder(null, 0);
            cerf.vitesseCible = 4.6;
            finBruits.grelots = false;
            finBruits.texte = false;
            phase = PHASES.FIN;
            horloge = 0;
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
      /* LA COULEUR DU CADEAU EST DESATURÉE AVANT D'ECLAIRER.

         Une lumiere prend la teinte de sa source, mais une lampe rouge n'est
         pas rouge pur : elle est chaude et legerement rouge. En utilisant la
         couleur du paquet telle quelle, toute la neige a portee virait au
         rose ou au vert franc, et on ne lisait plus une lumiere posee sur le
         sol mais un calque de couleur pose sur l'image.

         On mele donc la teinte du paquet a un blanc chaud. L'intensite, elle,
         reste entiere — c'est la vivacite de la lueur qui plaisait, pas sa
         saturation, et les deux se reglent separement. La neige s'embrase
         donc autant qu'avant, mais elle reste de la neige. */
      if (g) {
        /* SOIXANTE-DEUX POUR CENT NE SUFFISAIENT PAS, ET LE RAISONNEMENT
           ETAIT INCOMPLET.

           J'avais melange la teinte du paquet a du blanc chaud, ce qui va
           dans le bon sens mais part d'une premisse fausse : que la lumiere
           qui sort d'un cadeau doive avoir la couleur de son papier. Elle n'a
           aucune raison de l'avoir. Ce qui brille la-dedans, c'est ce que le
           paquet contient et la petite lampe qu'on imagine avec — donc une
           lumiere CHAUDE, quelle que soit la couleur de l'emballage.

           Et la neige ne pardonne pas : avec un albedo de 0,85, elle restitue
           fidelement la moindre dominante. A 62 %, la teinte rose du paquet
           « deco » laissait encore une flaque franchement magenta sur le sol,
           tandis que le rouge et l'ambre passaient inapercus — non parce
           qu'ils etaient mieux regles, mais parce qu'ils ressemblent deja a
           du feu.

           On monte donc a 85 % : il reste juste ce qu'il faut de la couleur
           du paquet pour que deux haltes ne s'eclairent pas pareil, et plus
           assez pour teindre la neige. */
        teinteLueur.set(g.glow).lerp(BLANC_CHAUD, 0.85);
        lumieres.poserLueur(ancre, teinteLueur, halte.eclat());
      } else {
        lumieres.poserLueur(ancre, 0xFFC98A, halte.eclat());
      }
    } else {
      lumieres.poserLueur(null, undefined, 0);
    }

    cerf.maj(dt, t);

    /* Le son ET les traces se calent sur les posers reels, jamais sur une
       minuterie : le sabot marque la neige exactement ou il se pose. */
    /* Sur la glace, un sabot ne crisse pas : il CLAQUE. Sans cette bascule
       le ruisseau n'existerait que pour l'oeil, et on l'entendrait comme de
       la neige alors qu'on le voit comme de la glace — le genre de
       contradiction qui defait un decor sans qu'on sache pourquoi. */
    const surGlace = ruisseau.surGlace(cerf.s);
    for (const p of cerf.posers) {
      if (surGlace) sfx.sabotGlace(voixSabots?.entree, p.force);
      else sfx.sabot(voixSabots?.entree, p.force);
      /* PAS DE MUSIQUE — et les grelots en faisaient.

         Un poser sur deux declenchait un grelot. Au trot, cela fait douze
         posers par seconde, donc cinq carillons par seconde, chacun compose
         de cinq partiels tenus dans l'aigu. Le resultat n'etait plus un
         detail de collier : c'etait une nappe de clochettes continue,
         c'est-a-dire exactement la musique qu'on ne voulait pas. Le defaut ne
         s'entend pas en lisant le code — il nait du CROISEMENT entre une
         probabilite raisonnable et une cadence de pas elevee.

         Ils deviennent donc rares et discrets : environ un toutes les deux
         secondes de marche, et deux fois moins fort. On doit pouvoir douter
         de les avoir entendus. */
      if (Math.random() < 0.045) sfx.grelots(voixCerf?.entree, 0.3 + p.force * 0.25);
      /* PAS D'EMPREINTE SUR LA GLACE. Un sabot ne creuse pas une surface
         gelee — il glisse dessus. On continuait pourtant a y estampiller des
         traces creusees et assombries, ce qui donnait, au moment precis ou le
         cerf traverse, une piste de trous dans ce qui est cense etre de
         l'eau : c'est une bonne part du « on dirait que c'est bugge » que
         signale Antoine. Le son changeait deja a cet endroit (sabotGlace) ;
         c'est la meme condition, elle sert maintenant aux deux. */
      if (!surGlace) empreintes.ajouter(p.pos.x, p.pos.z, cerf.racine.rotation.y, p.force);
      /* La poudre part vers l'arriere de la marche. Le corps est modelise
         museau vers -Z, d'ou le signe : c'est la meme convention que dans
         placer(), et s'en ecarter enverrait la neige devant lui. */
      poudre.poser(
        p.pos.x, p.pos.y, p.pos.z,
        -Math.sin(cerf.racine.rotation.y), -Math.cos(cerf.racine.rotation.y),
        p.force
      );
    }
    cerf.posers.length = 0;
    poudre.maj(dt, solPourPoudre);
    fin.maj(dt);

    drone.maj(dt, t, cerf);

    ciel.maj(dt, t, camera);
    poudre.accorder(scene.fog);
    lumieres.accorder(ciel.actuel);
    // Le feuillage suit la meme ambiance que la lumiere et la neige.
    uniformsVent.uLuneCol.value.set(ciel.actuel.soleil);
    uniformsVent.uCielCol.value.set(ciel.actuel.ciel);
    lumieres.maj(camera, cerf.racine.position);
    accorderNeige(relief.materiau, ciel.actuel, lumieres.dir);
    if (cerf.materiau.userData.uniforms) {
      cerf.materiau.userData.uniforms.uLisereCol.value.set(ciel.actuel.soleil);
      cerf.materiau.userData.uniforms.uLisereDir.value.copy(lumieres.dir);
    }
    relief.maj(camera, ciel.actuel);
    foret.maj(camera);
    neige.maj(dt, t, camera, renderer);
    brume.maj(dt, t, camera, relief, ciel.actuel);
    details.maj(dt, t, camera, relief);
    cabanes.maj(dt);
    apparitions.maj(dt, t, cerf.s, camera);
    habitants.maj(t);
    relief.majEmpreintes();

    /* Mise au point sur le sujet — le cerf, ou le paquet quand il est sorti.
       Elle se met a jour ICI, dans le pas de simulation, et non dans la
       boucle de rendu : sinon elle ne converge pas quand le temps est
       avance sans dessiner, et le plan de nettete reste ou il etait. */
    postfx.viser(camera.position.distanceTo(
      halte.cadeau ? halte.ancre(ancre) : cerf.ancre(ancre)
    ));
    // Altitude reelle du drone au-dessus du terrain qu'il survole, pour
    // moduler le vent (voir Son.maj) — pas sa hauteur absolue, qui ne dirait
    // rien sur un terrain vallonne.
    son.maj(dt, cerf.vitesse, camera.position.y - relief.hauteur(camera.position.x, camera.position.z));
  }

  const vigie = new Vigie(palier, (p) => {
    renderer.setPixelRatio(p.dpr);
    renderer.shadowMap.enabled = p.ombres;

    /* Retrograder ne servait a rien tant que les postes les plus couteux
       restaient allumes : la chaine de post-traitement (sept passes plein
       ecran) et la cible des empreintes continuaient de tourner. Ce sont
       justement les deux premiers a couper sur une machine qui peine. */
    if (p.postfx === 'leger') postfx.desactiver(renderer);
    if (p.empreintes === false) empreintes.actif = false;

    /* On remplace la variable elle-meme : c'est elle que `brancherResize` va
       relire, et c'est ainsi que la densite de pixels baisse pour de bon. */
    palier = p;
    postfx.palier = p;
    /* Le compteur doit dire la VERITE sur la densite courante : c'est
       precisement le chiffre qui m'interesse quand Antoine me le lit. Sans
       cela il afficherait indefiniment la densite de depart, et une baisse
       automatique passerait inapercue — y compris de moi. */
    if (compteur) compteur.palier = p;
    ajusterTaille();
    ajusterPoudre();
  });

  /* Compteur d'images, uniquement sur `?fps=1`. C'est la seule mesure de ce
     projet que je ne peux pas faire moi-meme : je rends en logiciel, et le
     chiffre obtenu ici ne dit rien de ce que fait un telephone. Celui-ci
     mesure chez la personne qui regarde. */
  const compteur = params.has('fps')
    ? new (await import('./ui/compteur.js')).Compteur(renderer, palier)
    : null;

  const boucle = new Boucle((dt, t) => {
    vigie.tic(dt);
    pas(dt, t);
    // Les traces se dessinent dans leur propre cible avant la scene.
    empreintes.rendre(renderer, cerf.racine.position, dt);
    postfx.rendre(scene, camera, t);
    if (compteur) { compteur.maj(dt); compteur.apresRendu(); }
  });

  /* --- PRECHAUFFAGE DES NUANCEURS ----------------------------------------

     Antoine, deux fois : « les decors ont du mal a se generer ». J'avais lu
     ca comme une portee de dessin trop courte, et corrige la portee. Le profil
     dit autre chose : QUATRE PROGRAMMES sur trente-et-un se compilent encore
     pendant les premieres haltes. Or three.js ne compile un materiau que la
     premiere fois qu'il est REELLEMENT dessine : ce qui n'existe pas encore au
     demarrage — le paquet, sa lueur — attend d'entrer en scene pour compiler,
     et cette image-la dure le temps d'une compilation. Sur un telephone, c'est
     une saccade franche, et elle tombe exactement quand un nouveau decor
     apparait. Antoine decrivait tres precisement ce qu'il voyait.

     DEUX FAUSSES PISTES, TOUTES DEUX MESUREES.

     1. `renderer.compile()` en rendant toute la scene visible. Cinquante-quatre
        programmes compiles au lieu de vingt-sept, et les quatre retardataires
        toujours la : on fabriquait vingt-sept variantes inutiles — un materiau
        vu dans un etat ou il ne sera jamais dessine donne un autre programme —
        sans attraper celles qu'on visait.

     2. `renderer.compile()` tout court. Toujours cinquante-quatre. La raison
        est que `compile()` travaille contre la cible de rendu COURANTE, alors
        que la scene est dessinee dans la cible lineaire du post-traitement :
        chaque programme etait donc fabrique deux fois, une fois pour une
        sortie sRGB qui ne sert jamais, une fois pour de vrai — plus tard.

     La seule facon fiable de compiler exactement ce qui sera utilise est de le
     DESSINER, dans les memes conditions. On fabrique donc un paquet temoin, on
     le pose devant l'objectif, on dessine UNE image par la chaine normale, et
     on le retire. Le materiau reste en vie — le liberer supprimerait le
     programme qu'on vient d'obtenir — et il ne sera plus jamais dessine.

     Rien de tout cela ne change une image : on avance un travail qui aurait eu
     lieu de toute facon, a un moment ou personne ne regarde. */
  function prechauffer() {
    const modeleCadeau = STATIONS.find((st) => st.scene?.gift)?.scene?.gift;
    let temoin = null;
    const etats = [];
    try {
      /* TOUT VISIBLE, ET UNE VRAIE IMAGE. Les deux a la fois, et pas l'un sans
         l'autre : le premier essai rendait tout visible mais compilait avec
         `compile()`, donc dans le mauvais espace de sortie ; le second
         dessinait pour de bon mais seulement ce qui etait deja dans le cadre,
         donc il ratait tout ce que le champ de vision elimine au depart — les
         clairieres a jalons, les cabanes, les niveaux lointains. */
      scene.traverse((o) => { etats.push([o, o.visible]); o.visible = true; });

      if (modeleCadeau) {
        temoin = creerCadeau(modeleCadeau, palier);
        // Devant l'objectif : ailleurs, il serait elimine et ne compilerait rien.
        const devant = new THREE.Vector3(0, 0, -5).applyQuaternion(camera.quaternion);
        temoin.groupe.position.copy(camera.position).add(devant);
        scene.add(temoin.groupe);
      }

      /* Une camera a champ tres large, le temps d'une image : elle attrape ce
         qui est autour sans qu'on ait a deplacer quoi que ce soit. */
      const fov0 = camera.fov, loin0 = camera.far;
      camera.fov = 110; camera.far = Math.max(loin0, 900);
      camera.updateProjectionMatrix();

      /* SUR QUATRE PIXELS.

         Premiere tentative : une image complete, monde entier visible. Le
         chargement de la page a expire au bout de trente secondes — evidemment,
         puisque tout se recouvre et que le remplissage explose. Or la
         compilation d'un nuanceur ne depend pas du NOMBRE de pixels dessines :
         il suffit qu'un fragment passe. On limite donc le rendu a un carre de
         deux pixels sur deux. Toute la geometrie est soumise, tous les
         programmes sont donc fabriques, et il ne reste presque rien a peindre.

         On reproduit exactement la cible de rendu de la chaine normale — c'est
         la lecon de l'essai precedent : compiler contre une autre sortie ne
         sert a rien, le vrai programme sera fabrique plus tard de toute
         facon. */
      /* ET LES OMBRES ETEINTES. Le decoupage en ciseaux ne s'applique pas a la
         passe d'ombre : elle a son propre cadrage et redessine le monde entier
         dans la carte d'ombre. Avec tous les objets rendus visibles, cela
         suffisait a faire expirer le chargement de la page au palier moyen —
         trente secondes, mesurees. Les programmes de profondeur, eux, se
         compilent de toute facon a la premiere vraie image, qui a lieu
         derriere l'ecran de demarrage. */
      const ombres0 = renderer.shadowMap.enabled;
      renderer.shadowMap.enabled = false;
      renderer.setScissorTest(true);
      renderer.setScissor(0, 0, 2, 2);
      renderer.setRenderTarget(postfx.actif ? postfx.rtScene : null);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.shadowMap.enabled = ombres0;

      camera.fov = fov0; camera.far = loin0;
      camera.updateProjectionMatrix();
    } catch (e) {
      /* Le prechauffage est une optimisation, jamais une dependance : s'il
         echoue, la balade doit demarrer exactement comme avant. */
    }
    if (temoin) scene.remove(temoin.groupe);
    for (const [o, v] of etats) o.visible = v;
    prechauffer.temoin = temoin;   // garde les materiaux — et leurs programmes
  }

  /* ------------------------------------------------------------- le seuil */
  viser(0);
  prechauffer();
  boot.classList.add('out');
  setTimeout(() => { boot.hidden = true; }, 900);
  document.getElementById('entry').hidden = false;

  /* LE PLAN D'OUVERTURE.

     Trois reperes, traverses d'un seul mouvement continu. Ils ne sont pas
     ecrits en coordonnees absolues mais construits a partir du chemin, pour
     que le plan reste juste si le trace change.

     · AU-DESSUS DES CIMES. On ne voit d'abord que la foret et le ciel : le
       lieu avant le sujet. Un sapin adulte fait vingt metres, on passe donc a
       trente-deux ; la visee est loin devant, ce qui incline la camera vers
       l'avant et donne l'horizon.
     · LA DESCENTE. On plonge en glissant vers l'avant. C'est la que le cerf
       apparait, encore petit, en bas du cadre — on le TROUVE, on ne nous le
       montre pas.
     · LA PLACE. On finit derriere lui, a hauteur d'homme, exactement la ou le
       suiveur se serait mis. Le raccord ne se voit donc pas.

     Douze secondes en tout, dont la moitie pour la descente : c'est le temps
     qu'il faut pour qu'un mouvement de drone se lise comme un geste et non
     comme un deplacement. */
  function planOuverture() {
    const p0 = chemin.point(DEPART, new THREE.Vector3());
    const tan = chemin.tangente(DEPART, new THREE.Vector3());
    const cot = chemin.cote(DEPART, new THREE.Vector3());
    const sol = relief.hauteur(p0.x, p0.z);
    const V = (dTan, dCot, dY) => new THREE.Vector3(
      p0.x + tan.x * dTan + cot.x * dCot,
      sol + dY,
      p0.z + tan.z * dTan + cot.z * dCot
    );
    /* PAS TROP HAUT : LE MONDE A UN BORD.

       Ma premiere version partait a trente-deux metres. Le mouvement etait
       bon, mais a cette altitude on voit par-dessus l'emprise du terrain — la
       jupe plate a la couleur du brouillard qui la prolonge se lit alors
       comme une bande horizontale nette, et le decor avoue sa taille des la
       premiere image. Un plan d'ouverture doit faire croire que la foret
       continue, pas montrer ou elle s'arrete.

       Dix-neuf metres suffisent largement : on est au-dessus des cimes, donc
       on voit la foret d'en haut, et l'horizon reste ferme par les arbres. */
    /* CE QUI N'ALLAIT PAS : LE PLAN DESCENDAIT EN LIGNE DROITE.

       Les quatre reperes precedents etaient tous a peu pres sur le meme axe,
       derriere le cerf, et ne faisaient que baisser. Trois choses en
       decoulaient, visibles sur chaque image capturee :

       — aucune parallaxe. Rien ne passait devant rien : les arbres restaient
         a leur place dans le cadre et le decor se lisait comme un fond peint ;
       — la lisiere est une clairiere de trente metres, et on la traversait
         dans sa longueur. Le sujet du plan d'ouverture etait donc une plaine
         blanche vide, avec trois sapins au bord ;
       — le cerf etait la des la premiere image, gros comme un pouce, dans un
         coin. Il n'etait ni un decor ni un sujet.

       On remplace la descente par un CONTOURNEMENT. La camera part loin sur
       le cote, au-dessus des cimes, et regarde la foret devant elle — pas le
       cerf. Puis elle tourne, descend, et c'est ce mouvement qui AMENE le cerf
       dans le cadre : il n'est pas montre, il est trouve. Le contournement
       fait defiler les premiers plans, ce qui donne enfin de la profondeur, et
       il traverse la clairiere en travers au lieu de la remonter, donc on voit
       les arbres qui la bordent au lieu de son vide. */
    return [
      // 1. Au-dessus des cimes, loin sur le cote. On regarde OU L'ON VA.
      { pos: V(-26, 23, 17), vise: V(52, -2, 6.5), duree: 4.0, fov: 63, roll: 0.055 },
      // 2. Le contournement : on tourne et on descend, le cerf entre dans le cadre.
      { pos: V(-22, 12.5, 8.6), vise: V(17, 1.2, 3.0), duree: 4.4, fov: 59, roll: 0.038 },
      // 3. On arrive derriere lui, a hauteur d'animal.
      { pos: V(-12.5, 3.4, 3.4), vise: V(4.2, 0.3, 1.3), duree: 3.6, fov: 54, roll: 0.008 },
      /* 4. Le raccord : exactement la ou la poursuite prendra la main. Duree
            NULLE — chaque duree est celle du segment qui PART de ce repere,
            donc la derniere doit valoir zero ; lui en donner une, c'est
            terminer le plan sur une image arretee, et une image arretee au
            moment ou la balade commence, c'est le contraire de ce qu'on veut. */
      { pos: V(-8.0, 1.7, 3.0), vise: V(4.0, 0, 1.4), duree: 0, fov: 52, roll: 0 },
    ];
  }

  brancherSeuil(() => {
    son.demarrer(camera);
    voixCerf = sfx.ancrer(cerf.tete, 40);
    voixSabots = sfx.ancrer(cerf.racine, 34);
    demarree = true;

    /* Le cerf ATTEND pendant l'ouverture. S'il partait tout de suite, la
       camera passerait le plan a lui courir apres et on ne verrait ni la
       foret ni son depart — or c'est son depart qui donne le signal de
       suivre. Il se met en marche a la derniere seconde du plan. */
    cerf.vitesseCible = 0;
    drone.ouvrir(planOuverture(), () => {
      panneau.montrer();
      drone.liberer();
      drone.cadrer('route');
      viser(1);
      entrerPhase(PHASES.ROUTE);
    });
    /* Il s'ebranle une seconde avant la fin du plan, pas apres. C'est SON
       depart qui donne le signal de le suivre : si la camera se met en
       poursuite d'un animal immobile, on attend ; si elle arrive derriere lui
       au moment ou il s'en va, on part avec lui. Une seconde suffit — le
       temps de voir un sabot bouger.

       CE MINUTEUR NE FAIT QUE LE METTRE EN MARCHE. Ma premiere version lui
       faisait entrer la phase ROUTE, et la fin du plan sautait alors cette
       entree pour ne pas la rejouer. Or `phase` vaut deja ROUTE au demarrage :
       le garde etait donc toujours vrai, l'entree n'avait jamais lieu, et le
       cerf ne partait pas du tout — la balade restait bloquee a la lisiere.
       Le parcours complet est passe de neuf cartes a zero sans qu'aucune
       erreur ne soit levee. Une seule chose fait autorite sur l'etat, et c'est
       la fin du plan ; ce minuteur ne touche qu'a la vitesse. */
    setTimeout(() => { if (demarree && drone.enCinematique) cerf.vitesseCible = 3.3; }, 10800);
  });

  boucle.demarrer();

  window.__THREE = THREE;   // outils de mesure des scripts de controle
  window.__scene = {
    renderer, scene, camera, chemin, relief, foret, ciel, cerf, drone, halte,
    // Expose pour que les controles designent une halte par son CONTENU et
    // non par son rang : un rang change des qu'on ajoute ou retire une idee.
    stations: STATIONS,
    brume, details, cabanes, apparitions, empreintes, fouillis, habitants, postfx, boucle, palier,
    son, sfx, ruisseau,
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
      for (let acc = 0; acc < secondes; acc += h) {
        boucle.t += h; pas(h, boucle.t);
        // Les traces se posent au rendu : sans cet appel, une marche
        // simulee ne laisserait aucune empreinte derriere elle.
        empreintes.rendre(renderer, cerf.racine.position, h);
      }
    },
    phase: () => phase,
  };
}

demarrer().catch((e) => {
  console.error(e);
  import('./ui/fallback.js').then(({ afficherRepli }) => afficherRepli(e));
});
