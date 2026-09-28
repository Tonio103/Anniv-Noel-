/* LA FAUNE.

   Jusqu'ici, la foret n'etait habitee que par le cerf et par des oiseaux
   lointains qui la survolaient sans jamais s'y poser. Un animal seul dans
   une foret vide, c'est un decor avec un personnage. On y ajoute donc ce
   qu'on croise VRAIMENT en suivant un cerf dans un bois enneige :

   · une troupe de bouvreuils qui picore au bord du chemin et s'envole ;
   · un lievre variable qui detale en travers, devant l'animal ;
   · une chouette hulotte sur un arbre mort, qui regarde passer le drone.

   Ce fichier ne fait que les placer et leur transmettre ce qui se passe —
   ou est le cerf, ou est l'objectif — puis relaie ce qu'ils produisent :
   des cris a sonoriser, des empreintes a poser, de la neige soulevee.
   Chaque animal vit dans son propre module.

   Les emplacements viennent de `sites.js` : chaque rencontre est attachee a
   une halte, la ou la camera s'attarde et ou rien d'autre ne se joue. */

import * as THREE from 'three';
import { rng, smoothstep } from '../../core/noise.js';
import { repartir } from './sites.js';
import { Passereaux } from './passereaux.js';
import { Lievre } from './lievre.js';
import { Chouette } from './chouette.js';

export class Faune {
  /* `options` : { foret, stations, obstacles } — les sapins (refuges et
     troncs a eviter), le contenu des haltes (pour trouver la bonne), et les
     objets plantes pres du chemin (lanternes) qu'aucun animal ne doit
     traverser ni recouvrir. */
  constructor(scene, chemin, relief, palier, { foret, stations = [], obstacles = [] } = {}) {
    this.chemin = chemin;
    this.relief = relief;
    const rand = rng(20261129);
    this.sites = repartir(chemin, stations);

    const p = new THREE.Vector3(), c = new THREE.Vector3();
    /* Un point a l'abscisse `s`, decale lateralement de `lat` metres (du cote
       `cote`), en monde. */
    const aCote = (s, lat) => {
      chemin.point(s, p); chemin.cote(s, c);
      return { x: p.x + c.x * lat, z: p.z + c.z * lat };
    };
    const arbres = foret?.arbres || [];
    /* Un point degage de tout tronc et de toute lanterne : on s'eloigne du
       chemin par pas de quarante centimetres jusqu'a trouver `rayon` metres
       de vide autour. Un arbre mort qui pousserait dans un sapin, ou un lievre
       assis dans le piquet d'une lanterne, ruinerait la rencontre des la
       premiere image. On ne s'eloigne que de quatre metres au plus : au-dela,
       l'animal sortirait du cadre portrait, et c'est tout le probleme que ce
       placement vient resoudre. */
    const libreEn = (q, rayon) => {
      for (const a of arbres) {
        if (Math.abs(a.x - q.x) < rayon && Math.abs(a.z - q.z) < rayon
            && Math.hypot(a.x - q.x, a.z - q.z) < rayon) return false;
      }
      for (const o of obstacles) {
        if (Math.hypot(o.x - q.x, o.z - q.z) < Math.max(1.6, rayon * 0.8)) return false;
      }
      return true;
    };
    const degage = (s, cote, lat0, rayon = 2.5) => {
      for (let lat = lat0; lat < lat0 + 4; lat += 0.4) {
        const q = aCote(s, cote * lat);
        if (libreEn(q, rayon)) return q;
      }
      // Rien de libre de ce cote : on glisse le long du chemin plutot que
      // de s'en eloigner.
      for (let ds = 1; ds < 6; ds++) {
        const q = aCote(s + ds, cote * lat0);
        if (libreEn(q, rayon)) return q;
      }
      return aCote(s, cote * lat0);
    };

    /* --- les troupes de bouvreuils ------------------------------------- */
    /* A deux metres du chemin et quelques : la troupe s'etale ensuite sur un
       metre et demi autour de ce centre, donc les plus hardis picorent au
       bord meme de la trace — la ou la neige, deja remuee, laisse voir des
       graines. */
    const troupes = [];
    for (const st of this.sites.filter((x) => x.espece === 'passereaux')) {
      const q = degage(st.s, st.cote, 2.0 + st.alea * 0.8, 1.2);
      chemin.cote(st.s, c);
      troupes.push({
        x: q.x, z: q.z, s: st.s, y0: relief.hauteur(q.x, q.z),
        // La direction qui s'eloigne du chemin, de leur cote.
        dx: c.x * st.cote, dz: c.z * st.cote,
      });
    }
    this.passereaux = new Passereaux(scene, palier, troupes, relief, arbres);

    /* --- les lievres ----------------------------------------------------- */
    this.lievres = [];
    for (const st of this.sites.filter((x) => x.espece === 'lievre')) {
      const depart = degage(st.s, st.cote, 2.4 + st.alea * 0.6, 1.2);
      /* Le trajet de fuite : il traverse le chemin juste devant l'endroit ou
         il etait assis, file un peu dans l'axe, puis CROCHETE et plonge sous
         les arbres d'en face. Les trois reperes sont exprimes par rapport au
         chemin, pour que la traversee reste une traversee si le trace
         change. */
      const site = {
        ...depart, cote: st.cote, alea: st.alea, s: st.s,
        traverse: aCote(st.s + 1.5, -st.cote * 1.8),
        crochet: aCote(st.s + 7.5, -st.cote * 5.5),
        sortie: aCote(st.s + 10, -st.cote * 27),
      };
      this.lievres.push(new Lievre(scene, palier, site, relief));
    }

    /* --- la chouette --------------------------------------------------------- */
    this.chouettes = [];
    for (const st of this.sites.filter((x) => x.espece === 'chouette')) {
      const q = degage(st.s, st.cote, 4.4 + st.alea * 0.8, 2.4);
      const site = {
        ...q, s: st.s, hauteur: 3.6 + st.alea * 0.8,
        traverse: aCote(st.s + 5, -st.cote * 2.5),
        sortie: aCote(st.s + 16, -st.cote * 30),
      };
      this.chouettes.push(new Chouette(scene, palier, site, relief, chemin, rand));
    }

    /* Un seul point d'emission sonore, deplace d'un evenement a l'autre : les
       rencontres ne se chevauchent jamais, donc un seul suffit. Il n'est
       relie au son qu'au premier evenement — le contexte audio n'existe
       qu'apres le premier geste du visiteur. */
    this.ancreSon = new THREE.Object3D();
    scene.add(this.ancreSon);
    this.voix = null;
    this.sfx = null;
    this.son = null;
  }

  brancherSon(son, sfx) { this.son = son; this.sfx = sfx; }

  _emettre(pos, jouer) {
    if (!this.sfx || !this.son?.pret) return;
    if (!this.voix) this.voix = this.sfx.ancrer(this.ancreSon, 60);
    if (!this.voix) return;
    this.ancreSon.position.set(pos.x, pos.y, pos.z);
    this.ancreSon.updateMatrixWorld(true);
    jouer(this.voix.entree);
  }

  /* `drone` : facultatif. Quand il est la, chaque rencontre lui fait jeter
     un coup d'oeil vers l'animal pendant son moment — voir `_regarder`. */
  maj(dt, temps, cerf, camera, empreintes, poudre, drone) {
    this.passereaux.maj(dt, temps, cerf, camera);
    for (const e of this.passereaux.envols) this._emettre(e, (s) => this.sfx.envol(s, e.nombre));
    this.passereaux.envols.length = 0;

    for (const l of this.lievres) {
      if (!l.actif) continue;
      l.maj(dt, temps, cerf, camera);
      /* Ses posers deviennent sa piste, a sa taille ; ceux des posterieurs
         soulevent un peu de poudreuse, comme ceux du cerf, en plus fin. */
      for (const p of l.posers) {
        empreintes?.ajouter(p.x, p.z, p.cap, p.force, p.echelle);
        if (p.poudre && poudre) {
          poudre.poser(p.x, this.relief.hauteur(p.x, p.z), p.z,
            -Math.sin(p.cap), -Math.cos(p.cap), 0.3);
        }
      }
      l.posers.length = 0;
    }

    for (const ch of this.chouettes) {
      ch.maj(dt, temps, cerf, camera);
      if (ch.cris.length) ch.criDepuis = 0;
      for (const pos of ch.cris) this._emettre(pos, (s) => this.sfx.hululement(s));
      ch.cris.length = 0;
    }

    this._regarder(dt, drone, cerf);
  }

  /* LE REGARD DU DRONE SUR LA FAUNE.

     La mesure au format du telephone (build/balade.mjs) etait sans appel :
     meme posee a deux ou trois metres du chemin, la faune passait l'essentiel
     de son moment HORS DU CADRE. A une halte, le drone regarde le cadeau ; en
     route, il regarde devant le cerf ; un lievre qui detale a trente degres
     de cet axe n'existe pas pour un cadre portrait qui n'en fait que seize de
     chaque cote. Le lievre n'etait a l'image qu'une seconde sur quatre, la
     chouette une demi-seconde sur six.

     Rapprocher encore les animaux n'y changeait rien : c'est le REGARD qui
     manquait. Un operateur qui suit un sujet tourne la tete vers ce qui
     bouge soudain a la lisiere de son champ, puis revient. On fait donc
     exactement cela, par le canal de second rang du drone (`coupDOeil`) : la
     tete se tourne pendant le moment de l'animal — l'envol, la fuite, le
     cri, la traversee — puis revient au cerf. Les forces sont moderees :
     l'animal doit ENTRER dans le cadre, pas en chasser le cerf. */
  /* LE CERF AUSSI LES REGARDE. Tout ce qui attire le drone attire d'abord
     l'animal, qui est bien plus pres : il tourne la tete vers l'envol, vers
     le lievre qui detale, vers la chouette qui traverse — et sursaute quand
     la chose surgit (force proche de 1). Voir deer/attitudes.js. Le cri de
     la chouette, lui, n'est qu'une curiosite : il tourne la tete, sans
     sursauter. */
  _regarder(dt, drone, cerf) {
    const v = this._vise || (this._vise = new THREE.Vector3());
    const regarder = (point, force, attention) => {
      if (drone && force > 0.001) drone.coupDOeil(point, force);
      if (cerf?.interesser && attention > 0.001) cerf.interesser(point, attention);
    };

    // Les bouvreuils : deux secondes sur la troupe qui s'envole.
    for (const tr of this.passereaux.troupes) {
      if (!tr.envolee) continue;
      tr.envolDepuis = (tr.envolDepuis ?? 0) + dt;
      const t = tr.envolDepuis;
      if (t > 2.4) continue;
      let n = 0;
      v.set(0, 0, 0);
      for (const o of tr.oiseaux) {
        if (o.etat === 2 || o.etat === 3) { v.add(o.pos); n++; }
      }
      if (!n) continue;
      v.divideScalar(n);
      regarder(v, 0.42 * smoothstep(0, 0.35, t) * (1 - smoothstep(1.7, 2.4, t)), t < 2.2 ? 1 : 0);
    }

    // Le lievre : toute sa fuite, jusqu'a ce qu'il atteigne le couvert.
    for (const l of this.lievres) {
      if (l.etat !== 2) continue;
      l.fuiteDepuis = (l.fuiteDepuis ?? 0) + dt;
      const t = l.fuiteDepuis;
      v.copy(l.pos); v.y += 0.25;
      regarder(v, 0.55 * smoothstep(0, 0.3, t) * (1 - smoothstep(2.4, 3.2, t)), t < 2.6 ? 1 : 0);
    }

    /* La chouette : un regard vers le cri — c'est le son qui nous la fait
       chercher — puis toute sa traversee. */
    for (const ch of this.chouettes) {
      if (ch.criDepuis !== undefined && ch.etat === 0) {
        ch.criDepuis += dt;
        const t = ch.criDepuis;
        if (t < 2.8) {
          v.copy(ch.pos); v.y += 0.3;
          // Plus leger que pour le vol : a trente metres, la chouette ne
          // merite pas qu'on sorte le cerf du cadre, juste qu'on la montre.
          regarder(v, 0.26 * smoothstep(0.25, 0.8, t) * (1 - smoothstep(2.0, 2.8, t)), t < 2.6 ? 0.6 : 0);
        }
      }
      if (ch.etat === 1) {
        ch.volDepuis = (ch.volDepuis ?? 0) + dt;
        const t = ch.volDepuis;
        regarder(ch.pos, 0.55 * smoothstep(0, 0.4, t) * (1 - smoothstep(2.6, 3.4, t)), t < 3 ? 0.95 : 0);
      }
    }
  }
}
