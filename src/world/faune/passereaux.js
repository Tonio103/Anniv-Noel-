/* LES BOUVREUILS.

   Une petite troupe picore la neige au bord du chemin. Quand le cerf arrive,
   elle s'envole d'un coup et file se cacher dans les sapins voisins.

   C'est la rencontre la plus banale d'une foret d'hiver, et c'est
   precisement pour ca qu'elle compte : elle dit que la foret est HABITEE, et
   que ce qui l'habite a peur de ce qu'on suit. Le cerf n'est plus seulement
   un guide, il est un animal parmi d'autres, et les autres le fuient.

   Pourquoi des bouvreuils : poitrine rouge vif, calotte noire, dos gris,
   barre blanche sur l'aile. Sur la neige c'est l'oiseau d'hiver par
   excellence, et c'est la seule touche de rouge VIVANT de tout le decor —
   le reste du rouge est emballe.

   CE QUI FAIT QU'ON Y CROIT, dans l'ordre d'importance :

   1. L'ENVOL EST DECALE. Les oiseaux d'une troupe ne partent jamais tous a
      la meme image : le plus proche part le premier, les autres suivent en
      une fraction de seconde, comme une onde. Un envol synchrone se lit
      comme un effet declenche.
   2. LE VOL EST ONDULE. Un petit passereau ne vole pas comme un rapace : il
      bat des ailes par salves de trois ou quatre coups, puis les replie
      contre le corps et plane en perdant un peu d'altitude, puis recommence.
      C'est cette trajectoire en festons, et non le battement lui-meme, qui
      dit « petit oiseau » a cinquante metres.
   3. ILS DISPARAISSENT DANS LES BRANCHES. Ils ne sortent pas du cadre ni
      ne s'evanouissent en l'air : ils plongent dans le feuillage d'un sapin
      proche, la ou un vrai passereau se mettrait a l'abri.
   4. AU SOL, ILS NE SONT JAMAIS IMMOBILES : ils picorent, sautillent,
      relevent la tete pour guetter. Mais jamais en rythme.

   COUT. Un seul maillage instancie pour toutes les troupes, donc un seul
   appel de dessin, et quelques milliers de triangles. Le battement, le
   repli et le coup de bec sont faits dans le nuanceur, a partir de trois
   nombres par oiseau : le processeur ne touche jamais un sommet. Rien n'est
   mis a jour tant que le cerf est loin d'une troupe. */

import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../../core/noise.js';

/* --- la silhouette ---------------------------------------------------------

   Construite une fois, fusionnee en une seule geometrie. Chaque sommet porte,
   en plus de sa couleur :
   · `aAile`  — 0 sur le corps, de 0 a 1 de l'epaule au bout de l'aile ;
   · `aCote`  — -1 pour l'aile gauche, +1 pour la droite ;
   · `aTete`  — 1 pour la tete et le bec, qui pivotent au cou.
   Le museau (le bec) pointe vers -Z, comme le cerf : une seule convention
   pour tous les animaux du projet. */
const EPAULE_X = 0.028, EPAULE_Y = 0.016;
const COU = new THREE.Vector3(0, 0.020, -0.040);

function geometrieOiseau() {
  const pos = [], nor = [], col = [], aile = [], cote = [], tete = [];
  const c = new THREE.Color();

  const ajouter = (geo, couleur, { estTete = 0, ailePoids = null, coteVal = 0 } = {}) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      couleur(c, p.getX(i), p.getY(i), p.getZ(i));
      col.push(c.r, c.g, c.b);
      aile.push(ailePoids ? ailePoids(p.getX(i), p.getZ(i)) : 0);
      cote.push(coteVal);
      tete.push(estTete);
    }
  };

  /* LE CORPS. Un bouvreuil est rond, presque une boule : c'est ce qui le
     distingue d'une mesange, plus fine. Le rouge couvre la poitrine et le
     ventre, pas le dos — la frontiere suit a peu pres l'horizontale. */
  const corps = new THREE.SphereGeometry(1, 8, 6);
  corps.scale(0.040, 0.037, 0.064);
  ajouter(corps, (cc, x, y, z) => {
    if (y < 0.004 && z < 0.045) cc.setHex(0xC5463A);        // poitrine
    else if (z > 0.035 && y > -0.01) cc.setHex(0xE9E6E1);    // croupion blanc
    else cc.setHex(0x656B72);                                // dos gris
  });

  /* LA TETE. Calotte et menton noirs, joues rouges : c'est la tete noire sur
     la poitrine rouge qui fait le bouvreuil d'un coup d'oeil. */
  const t = new THREE.SphereGeometry(0.030, 8, 6);
  t.translate(0, 0.026, -0.058);
  ajouter(t, (cc, x, y) => {
    if (y > 0.032 || y < 0.012) cc.setHex(0x141414);
    else cc.setHex(0xC5463A);
  }, { estTete: 1 });

  // Le bec, court et epais : un bec de mangeur de graines.
  const bec = new THREE.ConeGeometry(0.010, 0.020, 5);
  bec.rotateX(-Math.PI / 2);
  bec.translate(0, 0.022, -0.094);
  ajouter(bec, (cc) => cc.setHex(0x1E1E1E), { estTete: 1 });

  // La queue, noire, un peu relevee.
  const queue = new THREE.PlaneGeometry(0.032, 0.070);
  queue.rotateX(-Math.PI / 2 + 0.22);
  queue.translate(0, 0.004, 0.095);
  ajouter(queue, (cc) => cc.setHex(0x161616));

  /* LES AILES. Un simple quadrilatere effile par aile, attache a l'epaule.
     Noires au bout, avec la barre blanche au milieu qui clignote quand
     l'oiseau bat des ailes — c'est le detail qu'on voit a trente metres. */
  for (const s of [-1, 1]) {
    const g = new THREE.BufferGeometry();
    const ep = EPAULE_X * s;
    const v = [
      [ep, EPAULE_Y, -0.022], [ep, EPAULE_Y, 0.048], [0.150 * s, EPAULE_Y, 0.030],
      [ep, EPAULE_Y, -0.022], [0.150 * s, EPAULE_Y, 0.030], [0.128 * s, EPAULE_Y, -0.006],
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
    g.computeVertexNormals();
    const envergure = 0.150 - EPAULE_X;
    ajouter(g, (cc, x) => {
      const u = (Math.abs(x) - EPAULE_X) / envergure;
      if (u > 0.30 && u < 0.52) cc.setHex(0xEDEBE6);   // barre alaire
      else if (u < 0.30) cc.setHex(0x565C63);
      else cc.setHex(0x151515);
    }, { ailePoids: (x) => clamp((Math.abs(x) - EPAULE_X) / envergure, 0, 1), coteVal: s });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aAile', new THREE.Float32BufferAttribute(aile, 1));
  geo.setAttribute('aCote', new THREE.Float32BufferAttribute(cote, 1));
  geo.setAttribute('aTete', new THREE.Float32BufferAttribute(tete, 1));
  return geo;
}

/* --- le nuanceur ------------------------------------------------------------
   Trois nombres par oiseau suffisent a tout animer :
   · `iBat`  — angle des ailes, positif vers le haut ;
   · `iPli`  — 0 ailes deployees, 1 ailes repliees contre le corps ;
   · `iBec`  — inclinaison de la tete, positive vers le sol (coup de bec). */
function materiauOiseau() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aAile;
        attribute float aCote;
        attribute float aTete;
        attribute float iBat;
        attribute float iPli;
        attribute float iBec;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        {
          float a = iBat * aCote * step(0.001, aAile);
          objectNormal.xy = mat2(cos(a), sin(a), -sin(a), cos(a)) * objectNormal.xy;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (aAile > 0.0) {
          /* Replier : l'aile se rabat contre le flanc et glisse vers
             l'arriere, comme une aile d'oiseau posee. */
          float px = transformed.x - aCote * ${EPAULE_X.toFixed(3)};
          px *= mix(1.0, 0.16, iPli);
          transformed.z += aAile * iPli * 0.040;
          /* Battre : rotation autour de l'axe du corps, a l'epaule. */
          float a = iBat * aCote;
          float py = transformed.y - ${EPAULE_Y.toFixed(3)};
          transformed.x = aCote * ${EPAULE_X.toFixed(3)} + px * cos(a) - py * sin(a);
          transformed.y = ${EPAULE_Y.toFixed(3)} + px * sin(a) + py * cos(a);
        }
        if (aTete > 0.0) {
          /* Le coup de bec : la tete pivote au cou, vers le bas. Une
             rotation positive de l'avant autour de X le RELEVE (mesure sur
             le cerf, meme convention ici) : on tourne donc de -iBec. */
          vec3 q = transformed - vec3(${COU.x.toFixed(3)}, ${COU.y.toFixed(3)}, ${COU.z.toFixed(3)});
          float b = -iBec;
          transformed = vec3(${COU.x.toFixed(3)}, ${COU.y.toFixed(3)}, ${COU.z.toFixed(3)})
            + vec3(q.x, q.y * cos(b) - q.z * sin(b), q.y * sin(b) + q.z * cos(b));
        }`);
  };
  return mat;
}

/* --- les etats d'un oiseau --------------------------------------------------- */
const SOL = 0, ALERTE = 1, ENVOL = 2, VOL = 3, CACHE = 4;

export class Passereaux {
  /* `troupes` : [{ x, z, s, cote, alea }], le centre de chaque place de
     picorage dans le monde. `arbres` : la liste des sapins de la foret, pour
     y choisir les refuges. */
  constructor(scene, palier, troupes, relief, arbres) {
    this.relief = relief;
    /* Six a neuf par troupe : c'est la taille d'une bande de bouvreuils en
       hiver, et c'est aussi ce qu'il faut pour qu'un envol vu a quinze metres
       — sept pixels par oiseau sur un telephone — se lise comme une troupe
       qui part, et non comme deux ou trois points qui bougent. */
    const parTroupe = palier.nom === 'bas' ? 6 : palier.nom === 'moyen' ? 8 : 9;
    this.troupes = [];
    this.oiseaux = [];

    const geo = geometrieOiseau();
    const total = Math.max(1, troupes.length * parTroupe);
    this.iBat = new THREE.InstancedBufferAttribute(new Float32Array(total), 1);
    this.iPli = new THREE.InstancedBufferAttribute(new Float32Array(total).fill(1), 1);
    this.iBec = new THREE.InstancedBufferAttribute(new Float32Array(total), 1);
    for (const a of [this.iBat, this.iPli, this.iBec]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iBat', this.iBat);
    geo.setAttribute('iPli', this.iPli);
    geo.setAttribute('iBec', this.iBec);

    this.mesh = new THREE.InstancedMesh(geo, materiauOiseau(), total);
    this.mesh.name = 'bouvreuils';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    /* Les troupes sont semees sur tout le parcours : leur sphere englobante
       couvrirait la foret entiere et ne servirait a rien. On eteint plutot le
       maillage tout entier tant qu'aucune troupe n'est a portee (voir maj). */
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.visible = false;
    scene.add(this.mesh);

    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this._zero = zero;
    let k = 0;
    for (const tr of troupes) {
      const refuges = this._refuges(tr, arbres);
      const troupe = { ...tr, oiseaux: [], refuges, active: false, envolee: false, cri: false };
      /* Des femelles dans la troupe : poitrine beige-rose au lieu de rouge.
         Une troupe toute rouge ferait decor de Noel ; le melange fait
         population. On le rend par une teinte d'instance. */
      for (let i = 0; i < parTroupe; i++) {
        const o = {
          index: k++, troupe,
          etat: SOL, pos: new THREE.Vector3(), vit: new THREE.Vector3(),
          cap: Math.random() * Math.PI * 2, capVise: 0,
          // Picorage : minuteurs de geste, jamais en phase entre oiseaux.
          geste: 'picore', resteGeste: Math.random() * 0.6,
          saut: 0, sautDe: new THREE.Vector3(), sautVers: new THREE.Vector3(),
          bec: 0, battement: Math.random() * 6.28, salve: 0, plane: 0,
          seuil: 5.5 + Math.random() * 2.5, retard: 0, refuge: null,
          taille: 0.92 + Math.random() * 0.18,
        };
        // Autour du centre, en grappe lache.
        const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 1.6;
        o.pos.set(tr.x + Math.cos(a) * r, 0, tr.z + Math.sin(a) * r);
        o.pos.y = relief.hauteur(o.pos.x, o.pos.z);
        o.refuge = refuges[i % refuges.length];
        troupe.oiseaux.push(o);
        this.oiseaux.push(o);
        this.mesh.setMatrixAt(o.index, zero);
        const femelle = i % 3 === 2;
        this.mesh.setColorAt(o.index, new THREE.Color(femelle ? 0xB9A89A : 0xFFFFFF));
      }
      this.troupes.push(troupe);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    /* La teinte d'instance MULTIPLIE la couleur de sommet : blanc pour un
       male, beige pour une femelle — le gris et le noir n'en souffrent
       presque pas, le rouge vire au rose poudre. C'est exactement la
       difference entre les deux sexes chez le bouvreuil. */

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._s = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._c = new THREE.Vector3();
    // Evenements a sonoriser, lus puis vides par l'orchestrateur.
    this.envols = [];
  }

  /* LES REFUGES : des points DANS le feuillage de sapins proches, du cote
     oppose au chemin. Un passereau effraye ne s'eloigne pas en plaine, il se
     jette dans la premiere cachette. On prend le tiers inferieur du houppier,
     a l'interieur de l'enveloppe des branches : c'est la que les aiguilles
     sont les plus denses et que l'oiseau disparait vraiment. */
  _refuges(tr, arbres) {
    /* Dans une clairiere, aucun sapin a moins de vingt-deux metres : la
       troupe file alors vers la lisiere, jusqu'a quarante-cinq. Plus loin
       encore, elle se perdrait dans le cadre avant d'arriver ; mieux vaut
       alors le repli vers le haut, plus bas. */
    const cands = [];
    for (const portee of [22, 45]) {
      for (const a of arbres || []) {
        const d = Math.hypot(a.x - tr.x, a.z - tr.z);
        if (d < 4 || d > portee || a.h < 6) continue;
        // Du cote oppose au chemin : on s'eloigne de celui qu'on fuit.
        const vx = a.x - tr.x, vz = a.z - tr.z;
        if (vx * tr.dx + vz * tr.dz < 0) continue;
        cands.push({ a, d });
      }
      if (cands.length) break;
    }
    cands.sort((p, q) => p.d - q.d);
    const refuges = cands.slice(0, 3).map(({ a }) => {
      /* Rayon des branches a cette hauteur : le profil de genererSapin, soit
         environ 0,28 de la hauteur a la base du houppier, qui decroit vers la
         cime. On se loge aux six dixiemes de ce rayon, du cote qui fait face
         a la troupe. */
      const hFrac = 0.30 + Math.random() * 0.18;
      const t = (hFrac - 0.12) / 0.82;
      const rayon = (Math.pow(1 - t, 0.72) * 0.34 + 0.014) * a.h * a.large * 0.6;
      const ang = Math.atan2(tr.z - a.z, tr.x - a.x) + (Math.random() - 0.5) * 0.9;
      return new THREE.Vector3(a.x + Math.cos(ang) * rayon, a.y + a.h * hFrac, a.z + Math.sin(ang) * rayon);
    });
    // Aucun sapin utilisable : on file vers le haut, loin du chemin.
    if (!refuges.length) {
      refuges.push(new THREE.Vector3(tr.x + tr.dx * 20, tr.y0 + 9, tr.z + tr.dz * 20));
    }
    return refuges;
  }

  maj(dt, temps, cerf, camera) {
    const cp = cerf.racine.position;
    let actif = false;
    for (const tr of this.troupes) {
      /* Une troupe ne vit que pres du cerf ou de l'objectif. Au-dela, rien
         ne tourne : ni geste, ni matrice. Et une troupe cachee dans les
         arbres a fini son role pour cette visite. */
      const dCerf = Math.hypot(cp.x - tr.x, cp.z - tr.z);
      const dCam = Math.hypot(camera.position.x - tr.x, camera.position.z - tr.z);
      tr.active = (dCerf < 70 || dCam < 70) && !tr.oiseaux.every((o) => o.etat === CACHE);
      if (!tr.active) {
        /* Une troupe qu'on laisse derriere soi en plein vol ne doit pas rester
           figee en l'air, dessinee par l'instance commune des qu'une autre
           troupe s'anime : ses oiseaux ont rejoint le couvert. */
        for (const o of tr.oiseaux) {
          if (o.etat === ENVOL || o.etat === VOL) { o.etat = CACHE; this.mesh.setMatrixAt(o.index, this._zero); }
        }
        continue;
      }
      actif = true;
      for (const o of tr.oiseaux) this._vivre(o, dt, temps, cerf, dCerf);
    }
    this.mesh.visible = actif;
    if (!actif) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.iBat.needsUpdate = true;
    this.iPli.needsUpdate = true;
    this.iBec.needsUpdate = true;
  }

  _vivre(o, dt, temps, cerf, dTroupe) {
    const cp = cerf.racine.position;
    const d = Math.hypot(cp.x - o.pos.x, cp.z - o.pos.z);

    /* --- la decision de fuir --------------------------------------------
       Chaque oiseau a son propre seuil (5,5 a 8 m) : le plus proche du cerf
       — ou le plus nerveux — part le premier, et l'onde traverse la troupe.
       Un oiseau qui voit partir un voisin part aussi, avec un temps de
       reaction d'un dixieme a un tiers de seconde.

       Les seuils etaient de 7,5 a 11 m. Le bouvreuil est pourtant un oiseau
       confiant, qui laisse approcher ; et a onze metres du cerf, donc a dix-
       sept de la camera, une troupe qui s'envole ne fait plus que six
       pixels par oiseau et quitte le cadre en une seconde. */
    if (o.etat === SOL || o.etat === ALERTE) {
      if (d < 17 && o.etat === SOL) { o.etat = ALERTE; o.resteGeste = 0; }
      const voisinParti = o.troupe.envolee;
      if (d < o.seuil || voisinParti) {
        if (o.retard <= 0) o.retard = voisinParti ? 0.08 + Math.random() * 0.26 : 0.001;
        o.retard -= dt;
        if (o.retard <= 0) this._decoller(o, cp);
      }
    }

    switch (o.etat) {
      case SOL: case ALERTE: this._auSol(o, dt, temps); break;
      case ENVOL: case VOL: this._enVol(o, dt, temps); break;
      default: break;
    }
    this._poser(o);
  }

  /* --- au sol ---------------------------------------------------------------
     Trois gestes tires au sort, jamais en rythme : picorer (la tete plonge
     et remonte, deux ou trois fois de suite), sautiller (un petit bond de dix
     a vingt centimetres), guetter (tete haute, le corps pivote). En alerte,
     on ne picore plus : on guette, et on sautille pour s'ecarter. */
  _auSol(o, dt, temps) {
    o.resteGeste -= dt;
    if (o.resteGeste <= 0) {
      const r = Math.random();
      if (o.etat === ALERTE) {
        o.geste = r < 0.7 ? 'guette' : 'saute';
      } else {
        o.geste = r < 0.55 ? 'picore' : r < 0.8 ? 'saute' : 'guette';
      }
      o.resteGeste = o.geste === 'picore' ? 0.5 + Math.random() * 0.9
        : o.geste === 'saute' ? 0.18 : 0.4 + Math.random() * 1.2;
      if (o.geste === 'saute') {
        o.saut = 1;
        o.sautDe.copy(o.pos);
        // Un bond court, dans une direction proche de celle ou il regarde.
        const a = o.cap + (Math.random() - 0.5) * 1.6;
        const L = 0.10 + Math.random() * 0.12;
        o.sautVers.set(o.pos.x - Math.sin(a) * L, 0, o.pos.z - Math.cos(a) * L);
        o.sautVers.y = this.relief.hauteur(o.sautVers.x, o.sautVers.z);
        o.capVise = a;
      } else if (o.geste === 'guette') {
        o.capVise = o.cap + (Math.random() - 0.5) * 2.2;
      }
    }

    if (o.saut > 0) {
      o.saut = Math.max(0, o.saut - dt / 0.16);
      const u = 1 - o.saut;
      o.pos.lerpVectors(o.sautDe, o.sautVers, u);
      o.pos.y += Math.sin(u * Math.PI) * 0.05;
    }
    o.cap += Math.atan2(Math.sin(o.capVise - o.cap), Math.cos(o.capVise - o.cap)) * clamp(dt * 9, 0, 1);

    /* Le coup de bec : trois plongees rapides par seconde pendant qu'il
       picore, la tete haute le reste du temps. En alerte, elle se releve
       franchement — le cou tendu d'un oiseau qui ecoute. */
    const vise = o.geste === 'picore' && o.etat === SOL
      ? Math.max(0, Math.sin(temps * 17 + o.index * 1.7)) * 0.95
      : o.etat === ALERTE ? -0.25 : 0;
    o.bec += (vise - o.bec) * clamp(dt * 22, 0, 1);
    this.iBec.setX(o.index, o.bec);
    this.iPli.setX(o.index, 1);
    this.iBat.setX(o.index, 0);
  }

  _decoller(o, cp) {
    o.etat = ENVOL;
    o.troupe.envolee = true;
    if (!o.troupe.cri) {
      o.troupe.cri = true;
      this.envols.push({ x: o.troupe.x, y: o.pos.y + 1, z: o.troupe.z, nombre: o.troupe.oiseaux.length });
    }
    /* Il part a l'oppose du cerf ET vers son refuge : la fuite commence
       dans la direction du danger, puis s'infléchit vers l'abri. */
    const fx = o.pos.x - cp.x, fz = o.pos.z - cp.z;
    const n = Math.hypot(fx, fz) || 1;
    o.vit.set((fx / n) * 2.6, 3.1 + Math.random() * 0.8, (fz / n) * 2.6);
    o.salve = 0.45;     // un premier battement long et rapide : l'arrachement
    o.plane = 0;
    o.bec = -0.2;
  }

  /* --- en vol ---------------------------------------------------------------
     Un pilotage simple : on vise le refuge avec une vitesse de croisiere
     bornee et un virage borne, et la gravite fait le reste. Le vol ondule
     parce que les salves de battements alternent avec des glissades ailes
     repliees, pendant lesquelles la gravite n'est plus compensee. */
  _enVol(o, dt, temps) {
    const r = o.refuge;
    const to = this._v.subVectors(r, o.pos);
    const dist = to.length();

    if (dist < 0.7) {
      // Il plonge dans les aiguilles : on ne le voit plus.
      o.etat = CACHE;
      return;
    }

    // Vitesse voulue : vers le refuge, en ralentissant a l'approche.
    const vCroisiere = Math.min(7.0, 1.6 + dist * 0.9);
    to.multiplyScalar(vCroisiere / dist);
    const reactivite = o.etat === ENVOL ? 1.8 : 3.4;
    o.vit.x += (to.x - o.vit.x) * clamp(dt * reactivite, 0, 1);
    o.vit.z += (to.z - o.vit.z) * clamp(dt * reactivite, 0, 1);

    /* Salves et glissades. Pendant une salve, les ailes portent : on
       rejoint la vitesse verticale voulue. Pendant une glissade, ailes
       repliees, seule la gravite agit — l'oiseau decroche de quelques
       dizaines de centimetres, et c'est ce feston qui fait le passereau. */
    if (o.salve > 0) {
      o.salve -= dt;
      o.vit.y += (to.y - o.vit.y) * clamp(dt * 5, 0, 1) + 3.2 * dt;
      o.battement += dt * (o.etat === ENVOL ? 26 : 19);
      this.iBat.setX(o.index, Math.sin(o.battement) * 1.05 + 0.15);
      this.iPli.setX(o.index, 0);
      if (o.salve <= 0) { o.plane = 0.12 + Math.random() * 0.16; o.etat = VOL; }
    } else {
      o.plane -= dt;
      o.vit.y -= 5.5 * dt;
      this.iBat.setX(o.index, 0.05);
      this.iPli.setX(o.index, 0.85);
      if (o.plane <= 0) o.salve = 0.16 + Math.random() * 0.12;
    }
    o.vit.y = clamp(o.vit.y, -3.5, 4.5);
    o.pos.addScaledVector(o.vit, dt);

    // Jamais sous la neige, meme en fin de glissade.
    const sol = this.relief.hauteur(o.pos.x, o.pos.z) + 0.08;
    if (o.pos.y < sol) { o.pos.y = sol; o.vit.y = Math.abs(o.vit.y) * 0.3; }

    o.cap = Math.atan2(-o.vit.x, -o.vit.z);
    o.bec += (-0.15 - o.bec) * clamp(dt * 8, 0, 1);
    this.iBec.setX(o.index, o.bec);
  }

  _poser(o) {
    if (o.etat === CACHE) {
      this.mesh.setMatrixAt(o.index, this._m.makeScale(0, 0, 0));
      return;
    }
    /* Au sol le corps est horizontal ; en vol il s'incline dans le sens de
       la vitesse verticale — rotation positive = avant releve, meme
       convention que le cerf. */
    const vh = Math.hypot(o.vit.x, o.vit.z);
    const tangage = o.etat === SOL || o.etat === ALERTE ? 0
      : clamp(Math.atan2(o.vit.y, Math.max(vh, 0.5)), -0.7, 0.7);
    this._e.set(tangage, o.cap, 0);
    this._q.setFromEuler(this._e);
    this._s.setScalar(o.taille);
    // Au sol, le ventre touche la neige : le corps fait 3,7 cm de demi-hauteur.
    this._c.copy(o.pos);
    if (o.etat === SOL || o.etat === ALERTE) this._c.y += 0.036 * o.taille;
    this._m.compose(this._c, this._q, this._s);
    this.mesh.setMatrixAt(o.index, this._m);
  }
}
