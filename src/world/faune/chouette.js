/* LA CHOUETTE HULOTTE.

   On l'entendait depuis le debut : le paysage sonore porte son cri, deux
   notes graves et soufflees, de loin en loin. On ne la voyait jamais. Elle
   est desormais la, perchee au sommet d'un arbre mort au bord du chemin,
   et son cri vient enfin de quelque part.

   CE QUI FAIT QU'ON Y CROIT, dans l'ordre :

   1. ELLE NOUS REGARDE. Quand le drone approche, elle tourne la tete — la
      tete seule, le corps ne bouge pas — et le fixe. C'est le geste le plus
      reconnaissable d'un rapace nocturne, et c'est le seul moment de toute
      la balade ou un animal regarde l'objectif. Il doit etre franc : la tete
      pivote d'un bloc, rapidement, puis s'immobilise. Une chouette ne suit
      pas du regard en continu comme une camera de surveillance ; elle se
      recale par a-coups.
   2. ELLE TRIANGULE. En decouvrant l'intrus, elle balance la tete de cote,
      deux ou trois fois — elle mesure la distance par la parallaxe, comme le
      font les rapaces nocturnes. C'est un geste bizarre, presque comique, et
      absolument caracteristique.
   3. ELLE VOLE SANS BRUIT. Le cerf passe, elle se laisse tomber de son
      perchoir, traverse le chemin en vol plane au ras de la neige, quelques
      battements amples et lents, puis disparait sous les arbres. Aucun son :
      le vol d'une chouette est silencieux, et c'est ce silence, a cote des
      bruits du cerf, qui fait son etrangete.

   Le perchoir est un CHICOT — un fut mort, casse net, sans aiguilles. Une
   chouette posee sur une branche de sapin serait noyee dans le feuillage ;
   sur un chicot elle se decoupe contre le ciel, et c'est d'ailleurs la ou
   l'on voit les chouettes en vrai. */

import * as THREE from 'three';
import { clamp, lerp, smoothstep, damp } from '../../core/noise.js';

/* Un plumage n'est jamais uni : on bruite la couleur par sommet, avec des
   stries verticales plus sombres. Rien de procedural complique — juste assez
   pour que ce ne soit pas une peluche. */
function plumage(geo, base, clair, bas = null) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color(), cc = new THREE.Color(clair);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    c.setHex(base);
    // Stries : des bandes sombres verticales, irregulieres.
    const strie = Math.sin(x * 90 + Math.sin(y * 40) * 2.0) * Math.sin(y * 23 + x * 7);
    c.multiplyScalar(0.82 + 0.22 * strie);
    if (bas && bas(x, y, z)) c.lerp(cc, 0.55);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function construireChicot(rand, hauteur, ombre) {
  /* Un fut mort : plus mince que les epiceas vivants, ecorce grise et lisse
     par endroits, sommet casse en biseau. Et une calotte de neige sur la
     cassure, sauf la ou la chouette se tient. */
  const g = new THREE.CylinderGeometry(0.13, 0.20, hauteur, 9, 6, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // Cassure en biseau au sommet, et fut legerement tordu.
    if (y > hauteur / 2 - 0.01) p.setY(i, y - (p.getX(i) + 0.13) * 0.9 * (0.6 + rand() * 0.5));
    const k = (y + hauteur / 2) / hauteur;
    p.setX(i, p.getX(i) + Math.sin(k * 3.1) * 0.06);
  }
  g.computeVertexNormals();
  g.translate(0, hauteur / 2, 0);
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    c.setHex(0x6E665D).multiplyScalar(0.8 + 0.3 * Math.sin(y * 7 + p.getX(i) * 30));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const fut = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 }));
  fut.castShadow = ombre; fut.receiveShadow = ombre;

  const neige = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.45),
    new THREE.MeshStandardMaterial({ color: 0xE9F0F7, roughness: 0.7 })
  );
  neige.scale.set(1, 0.32, 1);
  neige.position.set(0.06, hauteur - 0.06, 0.02);
  fut.add(neige);
  return fut;
}

function construireChouette(ombre) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const piece = (geo, m = mat) => { const me = new THREE.Mesh(geo, m); me.castShadow = ombre; return me; };

  const racine = new THREE.Group();
  racine.name = 'chouette';

  // Le corps : un oeuf, brun roux strie, le ventre plus clair.
  const gCorps = new THREE.SphereGeometry(1, 12, 10);
  gCorps.scale(0.135, 0.20, 0.125);
  plumage(gCorps, 0x7B5B3F, 0xC4A583, (x, y, z) => z < -0.02 && y < 0.08);
  const corps = piece(gCorps);
  corps.position.y = 0.19;
  racine.add(corps);

  const queue = piece(plumage(new THREE.BoxGeometry(0.10, 0.012, 0.14), 0x6A4C33, 0x6A4C33));
  queue.position.set(0, 0.04, 0.10);
  queue.rotation.x = 0.55;
  racine.add(queue);

  /* LA TETE : ronde, grosse, sans aigrettes (la hulotte n'en a pas). Le
     disque facial plus clair, bordé d'un anneau sombre, et deux grands yeux
     NOIRS et brillants — la hulotte a les yeux sombres, pas jaunes. C'est
     l'ecart entre ce disque pale et ces deux points noirs qui fait le
     regard. */
  const tete = new THREE.Group();
  tete.position.set(0, 0.38, -0.01);
  racine.add(tete);
  const gTete = new THREE.SphereGeometry(0.105, 12, 10);
  plumage(gTete, 0x76573C, 0xBFA07C, (x, y, z) => z < -0.045 && Math.hypot(x, y) < 0.085);
  tete.add(piece(gTete));

  const matOeil = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.05, metalness: 0 });
  const yeux = [];
  for (const s of [-1, 1]) {
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), matOeil);
    oeil.position.set(s * 0.037, 0.012, -0.090);
    tete.add(oeil);
    yeux.push(oeil);
  }
  const bec = piece(new THREE.ConeGeometry(0.012, 0.030, 6), new THREE.MeshStandardMaterial({ color: 0xB5AE8F, roughness: 0.5 }));
  bec.rotation.x = Math.PI / 2 + 0.6;
  bec.position.set(0, -0.018, -0.102);
  tete.add(bec);

  /* LES AILES, pour le vol seulement. Larges et arrondies — une hulotte a
     pres d'un metre d'envergure — et barrees de sombre. Au perchoir elles
     sont cachees : repliees, elles se confondent avec les flancs. */
  const ailes = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.10, 0.25, 0);
    racine.add(pivot);
    /* Le modele est DEBOUT (tete vers +Y). En vol il se couche de pres d'un
       quart de tour : son axe +Z devient la verticale du monde. L'aile doit
       donc etre mince selon Z et s'etendre selon X (l'envergure) et Y (la
       profondeur, le long du corps) — modelisee mince selon Y, elle se
       serait retrouvee VERTICALE en vol, comme une derive. */
    const g = new THREE.SphereGeometry(1, 12, 6);
    g.scale(0.26, 0.14, 0.018);
    g.translate(s * 0.25, -0.02, 0);
    plumage(g, 0x6E5036, 0xB09070, (x) => Math.abs(x) > 0.42);
    const a = piece(g);
    pivot.add(a);
    pivot.visible = false;
    pivot.userData.cote = s;
    ailes.push(pivot);
  }
  return { racine, corps, tete, yeux, ailes, queue };
}

const PERCHEE = 0, ENVOL = 1, PARTIE = 2;

export class Chouette {
  /* `site` : { x, z, hauteur, traverse: {x,z}, sortie: {x,z}, s } en monde. */
  constructor(scene, palier, site, relief, chemin, rand) {
    this.site = site;
    this.relief = relief;
    this.chemin = chemin;
    const sol = relief.hauteur(site.x, site.z);
    this.chicot = construireChicot(rand, site.hauteur, palier.ombres);
    this.chicot.position.set(site.x, sol - 0.2, site.z);
    this.chicot.rotation.y = rand() * Math.PI * 2;
    scene.add(this.chicot);

    this.m = construireChouette(palier.ombres);
    this.perchoir = new THREE.Vector3(site.x, sol - 0.2 + site.hauteur - 0.05, site.z);
    this.m.racine.position.copy(this.perchoir);
    scene.add(this.m.racine);

    this.etat = PERCHEE;
    // Posee face au chemin, a peu pres : c'est de la que vient le passage.
    this.capCorps = Math.atan2(-(site.traverse.x - site.x), -(site.traverse.z - site.z)) + (rand() - 0.5) * 0.6;
    this.teteLacet = 0;          // rotation de la tete autour du cou, relative au corps
    this.teteVise = 0;
    this.teteTangage = 0;
    this.prochainRegard = 1 + rand() * 2;
    this.triangule = 0;          // > 0 pendant les balancements de tete
    this.aVu = false;
    this.clin = 0; this.prochainClin = 2 + rand() * 4;
    this.cri = false;
    this.pos = this.perchoir.clone();
    this.vit = new THREE.Vector3();
    this.reperes = [site.traverse, site.sortie];
    this.repere = 0;
    this.battement = 0;
    this.aile = 0;
    this.envolDepuis = 0;
    // Evenement a sonoriser : son cri, a sa position.
    this.cris = [];
    this._v = new THREE.Vector3();
  }

  maj(dt, temps, cerf, camera) {
    if (this.etat === PARTIE) { this.m.racine.visible = false; return; }
    const cam = camera.position;
    const dCam = Math.hypot(cam.x - this.pos.x, cam.z - this.pos.z);
    const visible = dCam < 80;
    this.m.racine.visible = visible;
    this.chicot.visible = dCam < 140;
    if (!visible && this.etat === PERCHEE) return;

    if (this.etat === PERCHEE) {
      this._regarder(dt, temps, camera, dCam);
      /* Elle part quand le cerf se remet en marche VERS elle — c'est le
         mouvement qui la fait partir, pas la distance : pendant toute la
         halte, le cerf immobile a huit metres ne l'inquietait pas. Elle
         traverse alors devant lui, dans l'axe ou regarde deja le drone ; la
         premiere version attendait que le cerf l'ait depassee, et c'est dans
         le dos de la camera qu'elle s'envolait. */
      if (cerf.vitesse > 1 && cerf.s > this.site.s - 6.5) this._envoler();
    } else if (this.etat === ENVOL) {
      this._voler(dt, dCam);
    }
    this._cligner(dt);
    this._poser();
  }

  /* LE REGARD. Hors de portee, elle balaie les alentours par a-coups : la
     tete pivote d'un bloc vers un nouvel angle, puis s'immobilise une a
     quatre secondes. A portee du drone, elle le fixe — et s'y recale encore
     par a-coups, jamais en continu. La premiere fois, elle triangule. */
  _regarder(dt, temps, camera, dCam) {
    const cam = camera.position;
    const vers = Math.atan2(-(cam.x - this.pos.x), -(cam.z - this.pos.z));
    const relatif = Math.atan2(Math.sin(vers - this.capCorps), Math.cos(vers - this.capCorps));
    const voit = dCam < 30;

    if (voit && !this.aVu) {
      this.aVu = true;
      this.triangule = 1.4;
      this.prochainRegard = 0;
      if (!this.cri) { this.cri = true; this.cris.push(this.pos.clone().setY(this.pos.y + 0.35)); }
    }

    this.prochainRegard -= dt;
    if (this.prochainRegard <= 0) {
      if (voit) {
        /* Une hulotte tourne la tete bien au-dela de ce qu'on croirait :
           jusqu'a deux cent soixante-dix degres. On s'arrete a cent soixante :
           au-dela, a l'image, on ne lit plus une chouette mais une tete
           devissee. */
        this.teteVise = clamp(relatif, -2.8, 2.8);
        this.prochainRegard = 0.6 + Math.random() * 1.1;
      } else {
        this.teteVise = (Math.random() - 0.5) * 3.2;
        this.prochainRegard = 1 + Math.random() * 3;
      }
    }
    // Pivot d'un bloc : tres rapide, puis arret net.
    const ecart = this.teteVise - this.teteLacet;
    this.teteLacet += clamp(ecart, -9 * dt, 9 * dt);

    // Le regard descend vers ce qu'elle fixe.
    const dy = cam.y - (this.pos.y + 0.38);
    const vise = voit ? clamp(Math.atan2(dy, Math.max(dCam, 1)), -0.6, 0.5) : 0;
    this.teteTangage = damp(this.teteTangage, vise, 6, dt);

    if (this.triangule > 0) this.triangule = Math.max(0, this.triangule - dt);
  }

  _cligner(dt) {
    /* Une chouette cligne LENTEMENT, en fermant la paupiere superieure :
       trois dixiemes de seconde, pas le battement d'un oeil de mammifere. */
    this.prochainClin -= dt;
    if (this.prochainClin <= 0 && this.clin <= 0) { this.clin = 1; this.prochainClin = 2.5 + Math.random() * 5; }
    if (this.clin > 0) this.clin = Math.max(0, this.clin - dt / 0.32);
  }

  _envoler() {
    this.etat = ENVOL;
    this.envolDepuis = 0;
    // Elle se laisse TOMBER du perchoir : d'abord de la hauteur, avant le cap.
    this.vit.set(0, -1.5, 0);
    for (const a of this.m.ailes) a.visible = true;
  }

  /* LE VOL. Elle plonge du perchoir, prend de la vitesse en descendant,
     rase la neige a deux metres en traversant le chemin, puis remonte un
     peu et file sous les arbres. Quelques battements amples et lents, et
     de longues glissades. Aucun bruit. */
  _voler(dt, dCam) {
    this.envolDepuis += dt;
    const cible = this.reperes[this.repere];
    if (!cible) { this.etat = PARTIE; return; }
    const sol = this.relief.hauteur(this.pos.x, this.pos.z);
    const hVisee = this.repere === 0 ? sol + 2.0 : sol + 3.4;
    const to = this._v.set(cible.x - this.pos.x, hVisee - this.pos.y, cible.z - this.pos.z);
    const d = Math.hypot(to.x, to.z);
    if (d < 2.5) { this.repere++; return; }
    const vCroisiere = 7.5;
    to.multiplyScalar(vCroisiere / Math.max(to.length(), 0.001));
    const r = clamp(dt * 1.9, 0, 1);
    this.vit.lerp(to, r);
    this.pos.addScaledVector(this.vit, dt);
    if (this.pos.y < sol + 0.6) this.pos.y = sol + 0.6;

    // Battements amples et lents, par salves, puis glissade ailes tendues.
    const salve = this.envolDepuis < 0.9 || Math.sin(this.envolDepuis * 1.4) > 0.55;
    this.battement += dt * (salve ? 2.9 : 0) * Math.PI * 2;
    this.aile = salve ? Math.sin(this.battement) * 0.85 : damp(this.aile ?? 0, 0.08, 5, dt);

    if (dCam > 70 && this.repere >= 1) this.etat = PARTIE;
  }

  _poser() {
    const m = this.m;
    m.racine.position.copy(this.pos);
    if (this.etat === PERCHEE) {
      m.racine.rotation.set(0, this.capCorps, 0);
      /* La triangulation : un balancement lateral de la tete, trois allers
         et retours sur une seconde et demie, qui s'eteint. */
      const tri = this.triangule > 0 ? Math.sin(this.triangule * 13) * 0.05 * (this.triangule / 1.4) : 0;
      m.tete.position.x = tri;
      m.tete.rotation.set(this.teteTangage, this.teteLacet, tri * 2.5, 'YXZ');
    } else {
      const vh = Math.hypot(this.vit.x, this.vit.z);
      const cap = Math.atan2(-this.vit.x, -this.vit.z);
      // En vol, le corps se couche dans la direction du deplacement.
      /* Couchee presque a l'horizontale (la rotation NEGATIVE abaisse l'avant,
         convention mesuree sur le cerf), inclinee selon la pente de sa
         trajectoire ; la tete se redresse pour regarder devant. */
      m.racine.rotation.set(-1.35 + clamp(Math.atan2(this.vit.y, Math.max(vh, 0.5)), -0.4, 0.4), cap, 0, 'YXZ');
      m.tete.rotation.set(1.15, 0, 0, 'YXZ');
      m.tete.position.x = 0;
      /* Le battement tourne autour de l'axe LONGITUDINAL du corps, qui est
         +Y dans ce modele debout — pas autour de Z, qui une fois le corps
         couche est la verticale : les ailes auraient balaye d'avant en
         arriere au lieu de battre. Pour que le bout de l'aile monte, la
         rotation autour de Y est negative a droite, positive a gauche. */
      for (const a of m.ailes) a.rotation.y = -(this.aile ?? 0) * a.userData.cote;
    }
    const k = 1 - Math.sin(Math.min(1, 1 - this.clin) * Math.PI) * (this.clin > 0 ? 1 : 0);
    for (const y of m.yeux) y.scale.y = lerp(0.12, 1, k);
  }
}
