/* Le relief enneige.

   Le sol est construit une fois pour toutes, avec les hauteurs calculees sur
   le processeur et cuites dans la geometrie. C'est volontaire : une grille
   qui suivrait la camera en echantillonnant une carte de hauteurs "nage"
   toujours un peu, et sur de la neige lisse ce glissement se voit. Ici la
   surface est parfaitement stable, et le calcul de hauteur cote JavaScript
   (pour poser les sabots du cerf et les cadeaux) est exactement celui de la
   geometrie affichee — pas d'objets qui flottent ou s'enfoncent.

   Le sol est decoupe en tuiles pour que l'elimination par le champ de vision
   fasse son travail : seules trois ou quatre tuiles sont dessinees a la fois.
*/

import * as THREE from 'three';
import { makeNoise2D, makeFbm, smoothstep, clamp } from '../core/noise.js';
import { creerNeige } from './snowMaterial.js';

export class Relief {
  constructor(chemin, palier, clairieres = []) {
    this.chemin = chemin;
    this.palier = palier;
    this.clairieres = clairieres;

    const bruit = makeNoise2D(1337);
    this._fbmLarge = makeFbm(bruit, { octaves: 4, gain: 0.52 });
    this._fbmMoyen = makeFbm(makeNoise2D(4242), { octaves: 3, gain: 0.5 });
    this._fbmFin = makeFbm(makeNoise2D(909), { octaves: 2, gain: 0.5 });

    /* Marge laterale : au-dela, le brouillard a tout mange de toute facon. */
    this.emprise = chemin.emprise(190);

    /* Hauteur du terrain le long du chemin, echantillonnee une fois.
       Elle sert a aplanir doucement le couloir de marche : le cerf ne doit
       pas escalader une butte, et la camera ne doit pas rentrer dedans. */
    this._echant = [];
    const N = 520;
    const p = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * chemin.longueur;
      chemin.point(s, p);
      this._echant.push({ x: p.x, z: p.z, h: this._brut(p.x, p.z) });
    }
    this._zDebut = this._echant[0].z;
    this._zFin = this._echant[N].z;

    /* LA PENTE EN LONG N'ETAIT JAMAIS ADOUCIE.

       Une fois l'escalier corrige (voir `_prochePoint`), la marche du cerf
       restait genee par endroits : mesure faite, l'allonge demandee a une
       patte depassait jusqu'a 47 % de son maximum. La cause, cette fois, est
       reelle et pas un artefact — le bruit brut atteint localement des
       pentes de 25 a 30 % le long du chemin lui-meme. L'aplanissement de
       couloir gomme les bosses EN TRAVERS (`hauteur()` melange vers `pr.h`
       selon la distance laterale au chemin), mais rien ne gommait la pente
       EN LONG : `pr.h` suivait le bruit brut au centimetre pres, avec toute
       sa rugosite haute frequence.

       Un sentier, meme en foret, ne serpente pas au gre de chaque bosse : on
       le trace en amortissant les irregularites courtes tout en gardant le
       relief general. Le bruit brut environnant, lui, reste intact : cette
       passe ne touche que les hauteurs de centre-couloir qui alimentent
       `pr.h`.

       UN FLOU NE SUFFISAIT PAS. Une moyenne glissante ([1,2,1]/4, repetee)
       ne fait que DIFFUSER les ecarts, elle ne les BORNE jamais : la pente
       residuelle decroit en 1/racine(passes), donc chaque doublement du
       nombre de passes ne gagne qu'un peu. Mesure a l'appui : cinq passes
       laissaient 38 % de depassement, soixante 25 %, neuf cents encore 11 %
       — et neuf cents passes aplatissent deja le couloir presque a plat,
       sans meme garantir zero depassement.

       Ce qu'il faut n'est pas un flou, c'est une BORNE : la pente d'un
       echantillon a l'autre ne doit jamais depasser une valeur fixee. On
       resout ca directement en deux balayages (avant puis arriere), chacun
       ecretant l'ecart au voisin deja traite a la pente maximale autorisee —
       le procede classique pour aplanir un profil de terrain sous contrainte
       de pente. Contrairement au flou, il GARANTIT le resultat en un nombre
       de passes fixe, quelle que soit la rugosite du bruit de depart. Une
       legere diffusion finale arrondit seulement les angles vifs que le
       plafonnement laisse aux points de contact.

       SIX POUR CENT, PAS SEIZE. Meme borne a 16 %, le pire cas mesure sur le
       parcours entier restait a 27 % de depassement — la marge des pattes est
       si juste (voir ALLURES, dans deerRig.js) qu'une pente meme moderee,
       combinee au balayage de la foulee, suffit a saturer l'allonge. Descendu
       a 6 %, le pire cas tombe a 13 % de depassement (contre 65 % au tout
       depart) : ce qui reste vient desormais surtout de la geometrie de la
       foulee elle-meme, plus du tout du terrain. Le couloir garde une pente
       sensible — 6 % reste une vraie cote, pas un trottoir — la foret
       environnante, elle, n'est pas touchee par cette borne. */
    const segment = chemin.longueur / N;
    const penteMax = 0.06;             // 6 % : ce que l'allonge des pattes tolere
    const ecart = penteMax * segment;
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 1; i <= N; i++) {
        const h0 = this._echant[i - 1].h, h1 = this._echant[i].h;
        if (h1 > h0 + ecart) this._echant[i].h = h0 + ecart;
        else if (h1 < h0 - ecart) this._echant[i].h = h0 - ecart;
      }
      for (let i = N - 1; i >= 0; i--) {
        const h0 = this._echant[i + 1].h, h1 = this._echant[i].h;
        if (h1 > h0 + ecart) this._echant[i].h = h0 + ecart;
        else if (h1 < h0 - ecart) this._echant[i].h = h0 - ecart;
      }
    }
    // Trois passes legeres pour arrondir les points anguleux du plafonnement.
    for (let passe = 0; passe < 3; passe++) {
      const src = this._echant.map((e) => e.h);
      for (let i = 1; i < N; i++) {
        this._echant[i].h = (src[i - 1] + src[i] * 2 + src[i + 1]) * 0.25;
      }
    }

    this._creuserLits(chemin, clairieres);

    this.groupe = new THREE.Group();
    this.groupe.name = 'relief';
    this._construire();
  }

  /* --- relief avant aplanissement ---------------------------------------- */
  _brut(x, z) {
    let h = this._fbmLarge(x * 0.0042, z * 0.0042) * 7.2;      // grandes ondulations
    h += this._fbmMoyen(x * 0.017, z * 0.017) * 1.75;          // congeres
    h += this._fbmFin(x * 0.062, z * 0.062) * 0.34;            // grain
    return h;
  }

  /* --- hauteur finale, celle qui fait foi partout ------------------------ */
  hauteur(x, z) {
    let h = this._brut(x, z);

    // Aplanissement du couloir : on ramene vers la hauteur du chemin.
    const pr = this._prochePoint(x, z);
    if (pr.d < 46) {
      const k = smoothstep(46, 9, pr.d);          // 1 au centre, 0 au bord
      h = h + (pr.h - h) * k * 0.88;
      // Legere depression : le passage repete a tasse la neige.
      h -= smoothstep(14, 0, pr.d) * 0.32;
    }

    // Clairieres : on aplanit franchement pour degager la vue.
    for (const c of this.clairieres) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < c.r * 1.5) {
        const k = smoothstep(c.r * 1.5, c.r * 0.45, d);
        h = h + (c.h - h) * k * 0.94;
      }
    }

    /* Le lit du ruisseau se creuse EN DERNIER, apres l'aplanissement du
       couloir : applique avant, il serait rebouche par lui, puisque c'est
       precisement dans le couloir de marche qu'on veut le voir. */
    h += this._creux(x, z);
    return h;
  }

  /* --- le lit du ruisseau ------------------------------------------------
     Antoine, sur la traversee : « on dirait que c'est bugge, ca ne ressemble
     pas a de l'eau ». En mesurant, la cause etait sans appel : le ruban de
     glace etait POSE A PLAT sur la neige, a la meme altitude qu'elle, et
     j'avais essaye de lui fabriquer des berges avec un maillage a part. Le
     resultat, mesure en eteignant les objets un a un : le ruban etait
     purement invisible, et les berges — un materiau standard blanc a cote
     d'un shader de neige avec diffusion sous-surface — traversaient l'image
     en deux dalles grises. Du beton, pas de la neige.

     La lecon est generale : rien de blanc ne peut cotoyer cette neige sans
     etre fait de la meme matiere qu'elle. Donc on ne fabrique pas les berges,
     ON CREUSE. Le lit devient un accident du terrain lui-meme ; les berges
     sont alors de la vraie neige, eclairee par le vrai shader, et la glace
     se retrouve d'office EN CONTREBAS — ce qui est la seule chose qui fasse
     lire « de l'eau » plutot que « de la peinture ». Le cerf, qui echantillonne
     la meme fonction de hauteur, descend et remonte vraiment. */
  _creuserLits(chemin, clairieres) {
    this.lits = [];
    const p = new THREE.Vector3(), tan = new THREE.Vector3(), cot = new THREE.Vector3();

    for (const vise of [0.24, 0.68]) {
      /* Une traversee qui tombe dans une clairiere etait jusqu'ici purement
         SUPPRIMEE — d'ou un ruisseau annonce deux fois et vu une seule. On
         la decale plutot le long du chemin jusqu'a trouver de la place. */
      let frac = -1;
      for (let k = 0; k < 24 && frac < 0; k++) {
        const essai = vise + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.012;
        if (essai < 0.06 || essai > 0.94) continue;
        chemin.point(chemin.longueur * essai, p);
        let libre = true;
        for (const cl of clairieres) {
          if (Math.hypot(p.x - cl.x, p.z - cl.z) < cl.r * 1.35) { libre = false; break; }
        }
        if (libre) frac = essai;
      }
      if (frac < 0) continue;

      const s = chemin.longueur * frac;
      chemin.point(s, p);
      chemin.tangente(s, tan);
      chemin.cote(s, cot);
      this.lits.push({
        frac, s,
        px: p.x, pz: p.z,
        tx: tan.x, tz: tan.z,     // le long du chemin : la largeur du ruisseau
        cx: cot.x, cz: cot.z,     // en travers : la longueur du ruisseau
        demi: 27,                 // une traversee, pas un mur en travers du paysage
      });
    }
  }

  /* Profil en travers, applique a la fonction de hauteur. Un cours d'eau ne
     se creuse pas en V : il a un lit plat, deux talus, et un bourrelet de
     neige soufflee sur chaque levre — c'est ce bourrelet, plus que le creux,
     qui dessine la rive quand on la regarde de haut. */
  _creux(x, z) {
    if (!this.lits || !this.lits.length) return 0;
    let dh = 0;
    /* Le lit doit etre assez LARGE pour se voir. Depuis le drone — 1,85 m de
       haut, 6 m derriere — le rayon qui passe la levre descend d'environ 30 cm
       par metre : les deux premiers metres au-dela de la rive sont caches par
       la rive elle-meme. Un lit etroit ne montre donc que son talus, jamais sa
       glace. On l'ouvre a 4,3 m de fond plat, et on aplatit le bourrelet qui
       masquait le reste. */
    const LIT = 2.15, TALUS = 1.55, PROFOND = 0.46, LEVEE = 0.10;

    for (const l of this.lits) {
      const dx = x - l.px, dz = z - l.pz;
      const le = dx * l.cx + dz * l.cz;          // position le long du ruisseau
      if (Math.abs(le) > l.demi + 8) continue;
      const t = dx * l.tx + dz * l.tz;           // travers du ruisseau

      const u = le / (2 * l.demi) + 0.5;
      const derive = Math.sin(u * 6.1 + l.frac * 11) * 3.4 + Math.sin(u * 13.7) * 1.1;
      const q = Math.abs(t - derive);

      // Les extremites se referment, sinon le lit court a l'infini.
      const bout = smoothstep(l.demi + 8, l.demi - 4, Math.abs(le));

      const creux = -PROFOND * smoothstep(LIT + TALUS, LIT, q);
      // Bourrelet, centre sur la levre du talus.
      const b = Math.max(0, 1 - Math.abs(q - (LIT + TALUS + 0.55)) / 1.15);
      dh += (creux + LEVEE * b * b * (3 - 2 * b)) * bout;
    }
    return dh;
  }

  /* Point le plus proche SUR LE CHEMIN — pas le plus proche PARMI LES
     ECHANTILLONS. C'etait la meme chose en apparence, et ne l'etait pas.

     Antoine : la marche du cerf « bugue un peu dans les descentes montees et
     tout ». Mesure faite le long du trajet : la hauteur BRUTE du terrain
     (`_brut`) est parfaitement lisse — des pentes regulieres de quelques
     centimetres par decimetre. La hauteur FINALE, elle, saute de vingt a
     trente-cinq centimetres TOUS LES 1,29 METRE, pile l'ecart entre les cinq
     cent vingt echantillons du chemin (669 m / 520). La cause : cette
     fonction renvoyait `bh`, la hauteur du SEUL echantillon le plus proche,
     jamais interpolee avec son voisin. Dans le couloir de marche, ou ce
     terme pese jusqu'a 88 % du melange, le sol etait donc litteralement un
     ESCALIER — une marche a chaque fois que l'echantillon le plus proche
     changeait. Une patte ne peut pas suivre une marche de trente centimetres
     en dix centimetres de progression ; elle sature a son allonge maximale,
     et le corps entier, dont l'altitude suit la meme fonction sans lissage
     (voir `placer()`), saute avec elle. C'est exactement ce qui se lit comme
     un bug, et plus le terrain a une tendance generale — une montee, une
     descente — plus les marches de l'escalier sont hautes, donc plus le
     defaut saute aux yeux precisement la ou Antoine le signale.

     Le remede est d'interpoler : au lieu de retenir le SOMMET le plus
     proche, on retient le SEGMENT le plus proche et on y projette le point,
     comme on le ferait sur une vraie polyligne. La hauteur en decoule par
     interpolation lineaire entre les deux echantillons du segment — continue
     par construction, quelle que soit la densite d'echantillonnage. */
  _prochePoint(x, z) {
    const e = this._echant;
    const n = e.length;
    let i0 = Math.round(((this._zDebut - z) / (this._zDebut - this._zFin)) * (n - 1));
    i0 = clamp(i0, 0, n - 1);

    let best = Infinity, bh = 0;
    const marge = 30;
    // `b` reste EXCLUSIF et borne a n-1 : la boucle lit e[i+1], qui doit donc
    // toujours exister. Le depassement precedent (b pouvait valoir n) lisait
    // e[n], undefined, et faisait echouer toute la construction du relief.
    const a = Math.max(0, i0 - marge), b = Math.min(n - 1, i0 + marge);
    for (let i = a; i < b; i++) {
      const p0 = e[i], p1 = e[i + 1];
      const dx = p1.x - p0.x, dz = p1.z - p0.z;
      const L2 = dx * dx + dz * dz;
      // Projection du point sur le segment [p0, p1], parametre borne a [0,1].
      let t = L2 > 1e-9 ? ((x - p0.x) * dx + (z - p0.z) * dz) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = p0.x + dx * t, pz = p0.z + dz * t;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < best) { best = d; bh = p0.h + (p1.h - p0.h) * t; }
    }
    return { d: Math.sqrt(best), h: bh };
  }

  /* Normale analytique, par differences finies sur la fonction de hauteur.
     Comme elle vient de la meme fonction que les sommets, les tuiles se
     raccordent sans fissure ni cassure d'eclairage. */
  normale(x, z, cible = new THREE.Vector3()) {
    const e = 0.75;
    const hx = this.hauteur(x + e, z) - this.hauteur(x - e, z);
    const hz = this.hauteur(x, z + e) - this.hauteur(x, z - e);
    return cible.set(-hx, 2 * e, -hz).normalize();
  }

  _construire() {
    const em = this.emprise;
    const largeur = em.xmax - em.xmin;
    const profondeur = em.zmax - em.zmin;

    /* Taille de maille : le compromis entre finesse des congeres et nombre
       de sommets. Le relief fin est de toute facon ajoute par le shader. */
    const maille = this.palier.nom === 'bas' ? 2.9
                 : this.palier.nom === 'moyen' ? 2.1 : 1.7;

    /* DES TUILES PLUS PETITES, POUR QUE LE CULLING SERVE A QUELQUE CHOSE.

       Elles faisaient cent-dix-huit metres de cote. A cette taille, une tuile
       dont le centre est a deux cents metres a son coin le plus proche a cent
       dix-sept : on est donc oblige de garder un rayon large, et le culling
       ne retire presque rien. En les ramenant a une soixantaine de metres, le
       meme rayon ne conserve plus que le voisinage immediat — quatre fois
       moins de triangles de terrain, sans changer d'un pixel ce qu'on voit,
       puisque le rayon de securite, lui, n'a pas bouge.

       Le cout est un nombre d'appels de dessin un peu plus eleve. C'est le
       bon echange : un appel de dessin coute quelques microsecondes, cent
       mille triangles de plus coutent bien davantage sur un telephone. */
    const tuilesX = Math.max(2, Math.round(largeur / 62));
    const tuilesZ = Math.max(2, Math.round(profondeur / 62));
    const tw = largeur / tuilesX;
    const th = profondeur / tuilesZ;
    const sx = Math.max(2, Math.round(tw / maille));
    const sz = Math.max(2, Math.round(th / maille));

    this.materiau = creerNeige(this.palier, {
      empreintes: null,
      emprise: em,
    });

    const n = new THREE.Vector3();
    let sommets = 0;

    for (let tz = 0; tz < tuilesZ; tz++) {
      for (let tx = 0; tx < tuilesX; tx++) {
        const x0 = em.xmin + tx * tw;
        const z0 = em.zmin + tz * th;

        const nb = (sx + 1) * (sz + 1);
        const pos = new Float32Array(nb * 3);
        const nor = new Float32Array(nb * 3);
        const uv = new Float32Array(nb * 2);
        let k = 0, k2 = 0;

        for (let j = 0; j <= sz; j++) {
          const z = z0 + (j / sz) * th;
          for (let i = 0; i <= sx; i++) {
            const x = x0 + (i / sx) * tw;
            const y = this.hauteur(x, z);
            pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
            this.normale(x, z, n);
            nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
            uv[k2] = x * 0.05; uv[k2 + 1] = z * 0.05;
            k += 3; k2 += 2;
          }
        }

        const idx = new Uint32Array(sx * sz * 6);
        let m = 0;
        for (let j = 0; j < sz; j++) {
          for (let i = 0; i < sx; i++) {
            const a = j * (sx + 1) + i;
            const b = a + 1;
            const c = a + sx + 1;
            const d = c + 1;
            idx[m++] = a; idx[m++] = c; idx[m++] = b;
            idx[m++] = b; idx[m++] = c; idx[m++] = d;
          }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        geo.computeBoundingSphere();

        const tuile = new THREE.Mesh(geo, this.materiau);
        tuile.receiveShadow = this.palier.ombres;
        tuile.castShadow = false;
        tuile.matrixAutoUpdate = false;
        tuile.updateMatrix();
        this.groupe.add(tuile);
        sommets += nb;
      }
    }

    this.nbSommets = sommets;

    /* Au-dela de l'emprise : un disque plat a la couleur du brouillard, pour
       qu'on ne voie jamais le vide si la brume est fine. */
    const jupeGeo = new THREE.RingGeometry(
      Math.max(largeur, profondeur) * 0.42,
      Math.max(largeur, profondeur) * 1.4, 48, 1
    );
    jupeGeo.rotateX(-Math.PI / 2);
    this.jupe = new THREE.Mesh(
      jupeGeo,
      new THREE.MeshBasicMaterial({ color: 0x9FB6C8, fog: true, depthWrite: false })
    );
    this.jupe.position.y = -1.4;
    this.jupe.renderOrder = -900;
    this.groupe.add(this.jupe);
  }

  /* Branche la carte des traces. Sa fenetre se deplace avec le cerf, donc
     l'emprise ET la texture doivent etre rafraichies a chaque image : le
     rendu alterne entre deux cibles, et l'ancienne n'est plus valable. */
  brancherEmpreintes(emp) {
    const u = this.materiau.userData.uniforms;
    u.uEmpreintes.value = emp.texture;
    u.uAEmpreintes.value = 1;
    u.uEmpPas.value = 1.5 / emp.taille;
    this._emp = emp;
  }

  majEmpreintes() {
    if (!this._emp) return;
    const u = this.materiau.userData.uniforms;
    const e = this._emp.emprise();
    u.uEmpMin.value.set(e.xmin, e.zmin);
    u.uEmpTaille.value.set(e.xmax - e.xmin, e.zmax - e.zmin);
    u.uEmpreintes.value = this._emp.texture;
  }

  /* Fait suivre au disque de fond la position de la camera. */
  maj(camera, ambiance) {
    this.jupe.position.x = camera.position.x;
    this.jupe.position.z = camera.position.z;
    if (ambiance) this.jupe.material.color.set(ambiance.brouillard);

    /* LES TUILES LOINTAINES NE SONT PLUS DESSINEES.

       Le relief etait deja decoupe en tuiles de cent-dix-huit metres — mais
       toutes etaient envoyees a chaque image, sur toute la longueur du
       parcours. C'est le poste le plus lourd de la scene et personne ne le
       regardait : a lui seul il pesait environ la moitie des triangles, dont
       l'immense majorite derriere le brouillard.

       Le rayon est genereux — une tuile fait cent-dix-huit metres de cote,
       donc son centre peut etre loin alors qu'un de ses coins est sous nos
       pieds. Deux cents metres garantissent qu'on ne coupe jamais une tuile
       qu'on pourrait voir, tout en ecartant tout le reste du parcours.

       Le disque de brouillard qui suit la camera bouche l'horizon de toute
       facon : il n'y a aucun trou possible. */
    const p = camera.position;
    for (const t of this.groupe.children) {
      if (!t.geometry || !t.geometry.boundingSphere) continue;
      const c = t.geometry.boundingSphere.center;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      const vu = d < 200;
      if (t.visible !== vu) t.visible = vu;
    }
  }
}
