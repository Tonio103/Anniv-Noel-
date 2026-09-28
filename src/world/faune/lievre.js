/* LE LIEVRE.

   Il est tapi au bord du chemin, un peu au-dela d'une halte. Quand le cerf
   arrive, il se dresse, oreilles droites ; quand le cerf s'arrete, il se
   TAPIT — le corps plaque au sol, les oreilles couchees sur le dos — et ne
   bouge plus. C'est la defense du lievre : il compte sur son immobilite, et
   ne part qu'au dernier moment. Quand le cerf se remet en marche, il se
   redresse une demi-seconde, puis DETALE en travers du chemin, droit devant
   l'animal, et disparait sous les sapins d'en face en laissant sa piste.

   LIEVRE D'EUROPE, ET NON LIEVRE VARIABLE. La premiere version etait un
   lievre variable, blanc l'hiver : l'animal des forets enneigees, dans les
   livres. Mais en France il ne vit qu'en haute montagne, au-dessus des
   forets ; celui qu'on croise dans un bois enneige, c'est le lievre
   d'Europe, qui reste FAUVE toute l'annee. Et la capture au format du
   telephone l'a confirme d'une autre facon : blanc sur blanc a vingt metres,
   il n'existait tout simplement pas. Le vrai animal est aussi celui qui se
   voit — brun chine sur la neige, le ventre clair, le dessus de la queue et
   le bout des oreilles noirs.

   CE QUI FAIT QU'ON Y CROIT :

   1. L'ALLURE. Un lievre ne court pas, il BONDIT. Les pattes avant se posent
      l'une derriere l'autre, le dos se ramasse, et les pattes arriere
      viennent se poser DEVANT les pattes avant, cote a cote — puis tout le
      corps se detend et repart en vol. C'est ce ramassement-extension, bien
      plus que la vitesse, qui fait lievre. Un quadrupede qui trotterait vite
      se lirait comme un chien.
   2. LA PISTE. Ce meme ordre de poser laisse la trace la plus reconnaissable
      de la neige : deux petites empreintes l'une derriere l'autre, et deux
      grandes cote a cote DEVANT elles. On la pose au sol, a sa taille.
   3. LE CROCHET. Un lievre poursuivi ne fuit jamais en ligne droite : il
      part, puis change brutalement de direction. Un seul crochet suffit a
      dire qu'on a affaire a une proie qui connait son affaire.
   4. L'IMMOBILITE D'ABORD. Il ne detale pas au premier bruit : il se dresse
      et se fige, ou se tapit. C'est le temps d'arret qui donne son poids a
      la fuite.

   COUT. Une dizaine de pieces articulees, dessinees seulement le temps de la
   rencontre ; rien ne tourne quand le cerf est loin. */

import * as THREE from 'three';
import { clamp, lerp, smoothstep, damp } from '../../core/noise.js';
import { tacheDouce } from '../../core/dot.js';

/* Le pelage. Le dos est CHINE — chaque poil est annele de brun, de fauve et
   de noir — ce qui donne a distance un brun gris un peu grene ; les flancs
   sont plus roux, le ventre et le dessous de la queue presque blancs. */
const DOS = 0x7E6245, FLANC = 0x9D7851, VENTRE = 0xE6DDCF, TETE = 0x8A6A4A;
const PATTE = 0x98774F, POINTE = 0x151210;

/* Un bruit de valeur par sommet, stable (sans Math.random) : c'est lui qui
   chine le dos. */
const grain = (x, y, z) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
const pelage = (c, x, y, z) => {
  if (y < -0.05) return c.setHex(VENTRE);
  // Des flancs roux vers le dos plus sombre, puis le grain des poils.
  c.setHex(FLANC).lerp(_dos.setHex(DOS), clamp((y + 0.03) / 0.11, 0, 1));
  return c.multiplyScalar(0.84 + grain(x, y, z) * 0.3);
};
const _dos = new THREE.Color();

/* Une piece : un ellipsoide colorie par sommet, avec son pivot a l'origine. */
function ellipsoide(rx, ry, rz, couleur, segs = [10, 8]) {
  const g = new THREE.SphereGeometry(1, segs[0], segs[1]);
  g.scale(rx, ry, rz);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    couleur(c, g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const uni = (hex) => (c) => c.setHex(hex);

function construire(palier) {
  /* Un pelage ne brille pas : rugosite forte, aucun metal. */
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const matOeil = new THREE.MeshStandardMaterial({ color: 0x0C0906, roughness: 0.18, metalness: 0 });
  const ombre = palier.ombres;
  const piece = (geo, m = mat) => {
    const me = new THREE.Mesh(geo, m);
    me.castShadow = ombre; me.receiveShadow = false;
    return me;
  };

  const racine = new THREE.Group();
  racine.name = 'lievre';
  const corps = new THREE.Group();
  racine.add(corps);

  // Le tronc : c'est lui qu'on etire et qu'on ramasse a chaque bond.
  const tronc = piece(ellipsoide(0.115, 0.118, 0.235, pelage));
  corps.add(tronc);

  const cou = new THREE.Group();
  cou.position.set(0, 0.06, -0.20);
  corps.add(cou);
  const tete = new THREE.Group();
  tete.position.set(0, 0.04, -0.04);
  cou.add(tete);
  tete.add(piece(ellipsoide(0.066, 0.064, 0.090, (c, x, y, z) => {
    // Les joues et le tour de l'oeil sont plus clairs que le front.
    c.setHex(TETE);
    if (y < 0.0 && Math.abs(x) > 0.035) c.lerp(_dos.setHex(0xC7AE8A), 0.6);
    return c.multiplyScalar(0.9 + grain(x, y, z) * 0.2);
  })));
  const museau = piece(ellipsoide(0.040, 0.036, 0.040, uni(0xB39676)));
  museau.position.set(0, -0.014, -0.075);
  tete.add(museau);
  const truffe = piece(ellipsoide(0.012, 0.010, 0.008, uni(0x6E5E5A), [6, 4]));
  truffe.position.set(0, -0.006, -0.112);
  tete.add(truffe);
  for (const s of [-1, 1]) {
    // L'oeil du lievre est grand, place haut et sur le cote : il voit presque
    // tout autour de lui.
    const oeil = piece(new THREE.SphereGeometry(0.0135, 8, 6), matOeil);
    oeil.position.set(s * 0.047, 0.014, -0.030);
    tete.add(oeil);
  }

  /* LES OREILLES : longues, et noires au bout. Le pivot est a la base, pour
     qu'elles puissent se coucher pendant la course et se dresser a l'arret. */
  const oreilles = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.030, 0.050, 0.020);
    tete.add(pivot);
    const geo = ellipsoide(0.026, 0.100, 0.011, (c, x, y) => c.setHex(y > 0.068 ? POINTE : TETE));
    geo.translate(0, 0.095, 0);
    const o = piece(geo);
    pivot.add(o);
    pivot.userData.cote = s;
    oreilles.push(pivot);
  }

  /* LES PATTES. Les posterieurs sont enormes — ce sont eux qui propulsent —
     et se terminent par un long pied plat, celui qui laisse la grande
     empreinte. Les anterieurs sont fins. Chaque patte pivote a sa hanche ou
     a son epaule. */
  const patte = (x, y, z, long, ep, pied) => {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    corps.add(p);
    const g = ellipsoide(ep, long * 0.5, ep * 1.25, uni(PATTE), [8, 6]);
    g.translate(0, -long * 0.5, 0);
    p.add(piece(g));
    if (pied) {
      const gp = ellipsoide(ep * 0.8, ep * 0.45, pied * 0.5, uni(0xB09878), [8, 5]);
      gp.translate(0, -long + ep * 0.3, -pied * 0.35);
      p.add(piece(gp));
    }
    return p;
  };
  const arriere = [patte(-0.075, -0.02, 0.13, 0.20, 0.040, 0.14), patte(0.075, -0.02, 0.13, 0.20, 0.040, 0.14)];
  const avant = [patte(-0.050, -0.05, -0.14, 0.15, 0.022, 0.05), patte(0.050, -0.05, -0.14, 0.15, 0.022, 0.05)];

  /* La queue : noire dessus, blanche dessous. En fuite, elle est rabattue
     vers le haut et c'est le blanc qu'on voit filer — le signal que le
     lievre adresse a ce qui le poursuit. */
  const queue = piece(ellipsoide(0.032, 0.030, 0.028, (c, x, y, z) => c.setHex(y > 0.004 && z < 0.012 ? 0x1C1712 : 0xF2EEE8), [8, 6]));
  queue.position.set(0, 0.04, 0.235);
  corps.add(queue);

  // L'ombre de contact : c'est elle qui le pose sur la neige, a l'arret.
  const ombreSol = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.78),
    new THREE.MeshBasicMaterial({ map: tacheDouce(), transparent: true, opacity: 0.42, depthWrite: false,
      color: 0x0A1622, fog: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14 })
  );
  ombreSol.rotation.x = -Math.PI / 2;
  ombreSol.position.y = 0.03;
  ombreSol.renderOrder = 2;
  racine.add(ombreSol);

  /* Un lievre d'Europe adulte mesure une soixantaine de centimetres : un
     peu plus que le modele, dessine aux proportions du lievre variable. */
  racine.scale.setScalar(1.12);

  return { racine, corps, tronc, cou, tete, oreilles, arriere, avant, queue, ombreSol };
}

const ASSIS = 0, DRESSE = 1, FUITE = 2, PARTI = 3;

/* --- le galop bondissant -----------------------------------------------------
   Une foulee, de phase 0 a 1 :
     0,00        les posterieurs poussent : le corps se detend et part en vol
     0,00 - 0,34 vol etendu, anterieurs lances en avant, posterieurs en arriere
     0,34 / 0,41 les anterieurs se posent, l'un derriere l'autre
     0,41 - 0,62 le dos se ramasse, les posterieurs passent SOUS le corps
     0,62        les posterieurs se posent, devant les anterieurs
     0,62 - 1,00 appui des posterieurs, qui repoussent
   Les angles sont en radians, positifs vers l'arriere (la patte recule). */
function galop(phi) {
  // Posterieurs : tendus en arriere a la poussee, lances en avant au ramasse.
  const post = phi < 0.40 ? lerp(0.95, 0.55, phi / 0.40)
    : phi < 0.62 ? lerp(0.55, -1.05, smoothstep(0.40, 0.62, phi))
    : lerp(-1.05, 0.95, (phi - 0.62) / 0.38);
  // Anterieurs : lances en avant en vol, balayent vers l'arriere a l'appui.
  const ant = phi < 0.34 ? lerp(0.35, -0.95, smoothstep(0.0, 0.34, phi))
    : phi < 0.62 ? lerp(-0.95, 0.85, (phi - 0.34) / 0.28)
    : lerp(0.85, 0.35, (phi - 0.62) / 0.38);
  // Etirement du dos : long en vol, court au ramasse.
  const etire = 1 + 0.13 * Math.cos((phi - 0.16) * Math.PI * 2);
  // Hauteur : un seul grand vol par foulee, apres la poussee.
  const vol = phi < 0.36 ? Math.sin((phi / 0.36) * Math.PI) : 0;
  // Tangage : le nez plonge a l'arrivee sur les anterieurs, remonte a la poussee.
  const tangage = -0.22 * Math.sin((phi - 0.30) * Math.PI * 2);
  return { post, ant, etire, vol, tangage };
}

export class Lievre {
  /* `site` : { x, z, cote, traverse: {x,z}, crochet: {x,z}, sortie: {x,z} },
     tout en coordonnees monde, prepare par l'orchestrateur a partir du
     chemin. */
  constructor(scene, palier, site, relief) {
    this.relief = relief;
    this.site = site;
    this.m = construire(palier);
    this.m.racine.visible = false;
    scene.add(this.m.racine);

    this.etat = ASSIS;
    this.pos = new THREE.Vector3(site.x, relief.hauteur(site.x, site.z), site.z);
    // Il regarde vers le chemin, de biais : c'est ainsi qu'il surveille.
    this.cap = Math.atan2(-(site.traverse.x - site.x), -(site.traverse.z - site.z)) + (site.alea - 0.5) * 0.8;
    this.vitesse = 0;
    this.phase = 0;
    this.reperes = [site.traverse, site.crochet, site.sortie];
    this.repere = 0;
    this.dresse = 0;
    this.nez = 0;
    this.oreille = [0, 0];
    this.prochainOreille = 1 + Math.random() * 2;
    this.fige = 0;
    /* Tapi : 0 dresse ou assis, 1 plaque au sol, oreilles couchees. `calme`
       compte depuis combien de temps le cerf ne bouge plus. */
    this.tapi = 0;
    this.calme = 0;
    // Evenements lus par l'orchestrateur : empreintes et bouffees de neige.
    this.posers = [];
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  get actif() { return this.etat !== PARTI; }

  maj(dt, temps, cerf, camera) {
    if (this.etat === PARTI) { this.m.racine.visible = false; return; }
    const cp = cerf.racine.position;
    const dCerf = Math.hypot(cp.x - this.pos.x, cp.z - this.pos.z);
    const dCam = Math.hypot(camera.position.x - this.pos.x, camera.position.z - this.pos.z);
    // Rien ne tourne tant que personne n'est assez pres pour le voir.
    const visible = dCam < 70 || dCerf < 60;
    this.m.racine.visible = visible;
    if (!visible && this.etat !== FUITE) return;

    if (this.etat === ASSIS && dCerf < 26) this.etat = DRESSE;
    if (this.etat === DRESSE) {
      /* LE CERF S'ARRETE : IL SE TAPIT. Un lievre qui a repere un danger et
         le voit s'immobiliser ne fuit pas — il se colle au sol, oreilles
         rabattues, et attend. Il resterait ainsi tant que dure la halte.
         Quand le cerf repart, il se redresse d'un coup : c'est ce
         redressement, suivi d'une demi-seconde d'arret, qui annonce la
         fuite. */
      const bouge = cerf.vitesse > 0.6;
      this.calme = bouge ? 0 : this.calme + dt;
      const tapir = this.calme > 2.5;
      if (tapir) this.fige = 0;
      else this.fige += dt;
      this.tapi = damp(this.tapi, tapir ? 1 : 0, tapir ? 1.6 : 9, dt);
      /* Il detale quand le cerf avance ET qu'il est a moins de sept metres —
         ou, quoi qu'il arrive, s'il vient a moins de quatre. Sans la
         condition de mouvement, un cerf arrete a sa distance de fuite le
         ferait partir au milieu de la halte, dans le dos de la camera. */
      if (this.fige > 0.5 && ((dCerf < 7 && bouge) || dCerf < 4)) this.etat = FUITE;
    }

    if (this.etat === FUITE) this._fuir(dt);
    else this._guetter(dt, temps);

    // Parti hors de vue : il a regagne le couvert, la rencontre est finie.
    if (this.etat === FUITE && this.repere >= this.reperes.length) this.etat = PARTI;
    if (this.etat === FUITE && dCam > 55 && this.repere >= 2) this.etat = PARTI;

    this._poser(temps);
  }

  /* A l'arret : le nez frémit par saccades, les oreilles pivotent chacune de
     son cote. Dresse, il se grandit et les oreilles se tendent. */
  _guetter(dt, temps) {
    const vise = this.etat === DRESSE ? 1 - this.tapi : 0;
    this.dresse = damp(this.dresse, vise, 5, dt);
    this.nez = Math.sin(temps * 38) * 0.018 * (Math.sin(temps * 1.3) > 0.3 ? 1 : 0);
    this.prochainOreille -= dt;
    if (this.prochainOreille <= 0) {
      this.prochainOreille = 0.7 + Math.random() * 2.5;
      this.oreille[Math.random() < 0.5 ? 0 : 1] = (Math.random() - 0.5) * 1.1;
    }
    this.oreille[0] = damp(this.oreille[0], 0, 2.5, dt);
    this.oreille[1] = damp(this.oreille[1], 0, 2.5, dt);
  }

  /* LA FUITE. Il vise ses reperes l'un apres l'autre — la traversee du
     chemin, le crochet, la sortie sous les sapins — avec un virage borne :
     un lievre vire sec, mais pas instantanement. La vitesse monte en moins
     d'une seconde jusqu'a huit metres par seconde, et la foulee suit la
     vitesse, comme pour le cerf. */
  _fuir(dt) {
    const cible = this.reperes[this.repere];
    if (!cible) return;
    const dx = cible.x - this.pos.x, dz = cible.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) { this.repere++; return; }

    const capVise = Math.atan2(-dx, -dz);
    const ecart = Math.atan2(Math.sin(capVise - this.cap), Math.cos(capVise - this.cap));
    // Virage borne a 5 rad/s : c'est ce qui dessine le crochet au sol.
    this.cap += clamp(ecart, -5 * dt, 5 * dt);

    this.vitesse = Math.min(8.2, this.vitesse + dt * 11);
    this.pos.x -= Math.sin(this.cap) * this.vitesse * dt;
    this.pos.z -= Math.cos(this.cap) * this.vitesse * dt;
    this.pos.y = this.relief.hauteur(this.pos.x, this.pos.z);
    this.dresse = damp(this.dresse, 0, 8, dt);
    this.tapi = damp(this.tapi, 0, 12, dt);

    /* La foulee : 1,6 m a pleine vitesse, plus courte aux premiers bonds,
       ce qui donne un demarrage en petits sauts rapides puis de grands
       bonds — l'acceleration d'un vrai lievre. */
    const longueur = lerp(0.7, 1.6, clamp(this.vitesse / 8.2, 0, 1));
    const avant = this.phase;
    this.phase = (this.phase + (this.vitesse / longueur) * dt) % 1;
    // Les posers, franchis dans cette image, deviennent des empreintes.
    const franchi = (p) => (avant <= this.phase ? avant < p && this.phase >= p : avant < p || this.phase >= p);
    const s = Math.sin(this.cap), c = Math.cos(this.cap);
    const posePoint = (avantArriere, lateral) => ({
      x: this.pos.x - s * avantArriere + c * lateral,
      z: this.pos.z - c * avantArriere - s * lateral,
    });
    if (franchi(0.34)) this.posers.push({ ...posePoint(0.10, 0.012), cap: this.cap, echelle: 0.30, force: 0.35 });
    if (franchi(0.41)) this.posers.push({ ...posePoint(-0.04, -0.012), cap: this.cap, echelle: 0.30, force: 0.35 });
    if (franchi(0.62)) {
      // Les posterieurs, cote a cote, DEVANT les anterieurs : la signature.
      this.posers.push({ ...posePoint(0.30, 0.062), cap: this.cap, echelle: 0.46, force: 0.55, poudre: true });
      this.posers.push({ ...posePoint(0.30, -0.062), cap: this.cap, echelle: 0.46, force: 0.55 });
    }
  }

  _poser(temps) {
    const m = this.m;
    m.racine.position.copy(this.pos);
    m.racine.rotation.y = this.cap;

    const enCourse = this.etat === FUITE && this.vitesse > 0.5;
    const g = galop(this.phase);
    const k = enCourse ? clamp(this.vitesse / 4, 0, 1) : 0;

    /* ASSIS : ramasse, le dos rond, le corps bas. DRESSE : grandi, l'avant
       leve. TAPI : plaque, a plat, plus bas encore qu'assis. EN COURSE : le
       galop, dont l'amplitude monte avec la vitesse. */
    const hauteurAssis = 0.105, hauteurDresse = 0.16, hauteurTapi = 0.082;
    const repos = lerp(lerp(hauteurAssis, hauteurDresse, this.dresse), hauteurTapi, this.tapi);
    m.corps.position.y = lerp(repos, 0.17, k) + g.vol * 0.20 * k;
    // Rotation POSITIVE = avant souleve (convention mesuree sur le cerf).
    m.corps.rotation.x = this.dresse * 0.38 + g.tangage * k + (1 - k) * 0.06 * (1 - this.tapi);
    // Tapi, le corps s'etale : un peu plus large, un peu plus plat.
    const plaque = this.tapi * (1 - k);
    m.tronc.scale.set(1 + plaque * 0.06,
      lerp(1, 0.94, k * (g.etire - 0.87) / 0.26) * (1 - plaque * 0.08),
      lerp(0.94, g.etire, k));

    // Pattes : repliees sous le corps a l'arret, le galop en course.
    const assiseAr = 0.95, assiseAv = 0.15;
    for (const p of m.arriere) p.rotation.x = lerp(assiseAr - this.dresse * 0.5 + this.tapi * 0.25, g.post, k);
    m.avant[0].rotation.x = lerp(assiseAv + this.tapi * 0.6, g.ant, k);
    m.avant[1].rotation.x = lerp(assiseAv + this.tapi * 0.6, lerp(g.ant, galop((this.phase + 0.93) % 1).ant, 0.6), k);

    // La tete reste a peu pres horizontale : elle defait le tangage du corps.
    // Tapi, elle s'allonge vers l'avant, le menton presque dans la neige.
    m.cou.rotation.x = -m.corps.rotation.x * 0.7 + this.nez * (1 - this.tapi) - this.tapi * 0.12;
    /* Les oreilles : dressees a l'arret, droites et un peu ouvertes quand il
       se fige, COUCHEES sur le dos pendant la course et quand il se tapit —
       c'est ce qui change le plus sa silhouette entre les etats.

       LE SIGNE. Rotation positive autour de X : le bout de l'oreille (+Y)
       part vers +Z, c'est-a-dire vers l'ARRIERE, puisque la tete regarde vers
       -Z. La premiere version couchait les oreilles avec un signe negatif —
       elles se rabattaient donc sur le museau, en visiere, pendant toute la
       course. build/faune.mjs mesure maintenant le bout d'oreille. */
    for (let i = 0; i < 2; i++) {
      const o = m.oreilles[i];
      const couche = k * 1.25 + (1 - k) * this.tapi * 1.2;
      o.rotation.x = couche + (1 - k) * (1 - this.tapi) * this.dresse * 0.12;
      o.rotation.z = o.userData.cote * ((1 - k) * (0.12 * (1 - this.tapi) + this.oreille[i] * 0.5 * (1 - this.tapi)) + k * 0.05);
    }
    // En fuite, la queue se releve : c'est son dessous blanc qu'on voit filer.
    m.queue.rotation.x = k * 0.9;
    m.queue.position.y = 0.04 + k * 0.02;
    // L'ombre de contact s'amenuise quand il est en l'air.
    m.ombreSol.material.opacity = 0.42 * (1 - g.vol * k * 0.55);
  }
}
