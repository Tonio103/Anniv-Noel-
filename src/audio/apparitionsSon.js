/* LE SON DES APPARITIONS.

   Elles etaient muettes, et c'est ce qui leur manquait le plus. Une voiture
   de police sans sirene est une voiture garee ; un sabre laser sans son
   bourdonnement est un tube fluorescent. Dans les deux cas, c'est le SON qui
   nomme la chose, bien avant l'image — on reconnait une sirene les yeux
   fermes, on ne reconnait pas un gyrophare sans le regarder.

   Trois contraintes, heritees du reste du projet et non negociables :

   · RIEN N'EST CHARGE. Tout est synthetise au Web Audio, comme le vent, les
     sabots et les grelots. Le fichier doit rester un seul HTML autonome ;
   · PAS DE MUSIQUE. Une sirene, un bourdonnement, un souffle : ce sont des
     signaux et des matieres, jamais une melodie. La regle tient ;
   · TOUT EST SPATIALISE. Chaque son est attache a l'objet qui le produit,
     donc il arrive du bon cote et decroit quand on s'eloigne. Une sirene au
     centre de la tete ruinerait l'effet de « quelque chose, la-bas ».

   Deux familles a distinguer, parce qu'elles se gerent differemment :

   · les CONTINUS (sirene, bourdonnement du sabre, souffle de la soucoupe)
     vivent tant que la scene est ouverte et doivent etre coupes proprement
     a la fermeture, sans quoi ils tournent pour toujours ;
   · les PONCTUELS (le tir de toile, le choc des lames, le bang de la
     DeLorean) se declenchent une fois et s'eteignent seuls.
*/

import * as THREE from 'three';

export class ApparitionsSon {
  constructor(son, sfx) {
    this.son = son;
    this.sfx = sfx;
    /* Une voix par apparition, creee a la demande : tant qu'une scene n'a
       jamais joue, elle ne coute pas un noeud audio. */
    this.voix = new Map();
    this.continus = new Map();
  }

  get ctx() { return this.son?.ctx || null; }
  get pret() { return !!(this.son && this.son.pret && this.ctx); }

  /* Le point d'emission, accroche a l'objet de la scene. On le fabrique au
     premier besoin — le contexte audio n'existe qu'apres le premier geste du
     visiteur, donc rien ne peut etre prepare au chargement. */
  _voix(nom, objet, portee) {
    if (!this.pret) return null;
    let v = this.voix.get(nom);
    if (!v) {
      v = this.sfx.ancrer(objet, portee || 60);
      if (!v) return null;
      this.voix.set(nom, v);
    }
    return v;
  }

  /* Un souffle de bruit filtre : la brique de base de presque tout ce qui
     suit, exactement comme dans sfx.js. */
  _bruit(duree) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.son.rose;
    s.loop = true;
    s.playbackRate.value = 0.7 + Math.random() * 0.6;
    s.start(0, Math.random() * 6);
    if (duree) s.stop(this.ctx.currentTime + duree);
    return s;
  }

  /* ======================================================================
     LA SIRENE DE POLICE

     Deux notes qui alternent — c'est le « pin-pon » europeen, et c'est de
     tres loin le signal le plus reconnaissable de toute cette serie. On
     n'utilise pas un oscillateur nu : une sirene reelle passe par un pavillon
     qui colore fortement le son. On filtre donc en passe-bande etroite, ce
     qui lui donne son nasillement caracteristique.

     Le rythme est volontairement lent (un aller-retour par seconde et demie)
     et le volume tres bas : elle doit se deviner entre les arbres, pas
     traverser la foret. Une sirene trop forte casserait le calme de la
     balade, qui est tout de meme son sujet.
     ====================================================================== */
  _sirene(sortie) {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';

    /* Les deux hauteurs. On les programme d'avance, en creneaux, sur une
       longue duree : `setValueAtTime` en boucle coute beaucoup moins qu'un
       minuteur JavaScript, et le rythme reste rigoureusement regulier meme
       si l'onglet rame. */
    const BAS = 512, HAUT = 676, PERIODE = 0.78;
    for (let i = 0; i < 260; i++) {
      osc.frequency.setValueAtTime(i % 2 ? HAUT : BAS, t + i * PERIODE);
    }

    // Le pavillon : etroit, centre haut, c'est lui qui fait le nasillement.
    const bande = ctx.createBiquadFilter();
    bande.type = 'bandpass';
    bande.frequency.value = 1250;
    bande.Q.value = 2.6;

    // On coupe le bas : une sirene n'a aucune assise grave.
    const coupeBas = ctx.createBiquadFilter();
    coupeBas.type = 'highpass';
    coupeBas.frequency.value = 420;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.9);

    osc.connect(coupeBas); coupeBas.connect(bande); bande.connect(g);
    g.connect(sortie);
    osc.start(t);
    return { noeuds: [osc], gain: g };
  }

  /* ======================================================================
     LE BOURDONNEMENT DU SABRE

     Trois oscillateurs legerement desaccordes, un vibrato lent, et un
     passe-bas qui bouge : c'est la recette classique, et elle marche parce
     que ce qu'on entend d'un sabre laser n'est pas une note mais un
     BATTEMENT — l'interference entre des hauteurs presque egales.

     Le desaccord est donc le parametre essentiel : trop faible, on entend
     un bourdon d'insecte ; trop fort, deux notes distinctes.
     ====================================================================== */
  _sabre(sortie, grave) {
    const ctx = this.ctx, t = ctx.currentTime;
    const base = grave ? 84 : 112;
    const noeuds = [];
    const melange = ctx.createGain();
    melange.gain.value = 0.33;

    for (const ecart of [0, 1.006, 0.993]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = base * ecart;
      o.connect(melange);
      o.start(t);
      noeuds.push(o);
    }

    /* Le vibrato : une lente modulation de hauteur, sans laquelle le son est
       fige et se lit comme un ronflement de transformateur. */
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 2.4;
    lfo.connect(lfoG);
    for (const o of noeuds) lfoG.connect(o.frequency);
    lfo.start(t);
    noeuds.push(lfo);

    const passeBas = ctx.createBiquadFilter();
    passeBas.type = 'lowpass';
    passeBas.frequency.value = 900;
    passeBas.Q.value = 3.2;

    // Une deuxieme modulation, sur le filtre : le son « respire ».
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.7;
    const lfo2G = ctx.createGain();
    lfo2G.gain.value = 260;
    lfo2.connect(lfo2G); lfo2G.connect(passeBas.frequency);
    lfo2.start(t);
    noeuds.push(lfo2);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.5);

    melange.connect(passeBas); passeBas.connect(g); g.connect(sortie);
    return { noeuds, gain: g };
  }

  /* Le choc des lames : un eclat bref et brillant, plus un coup de grave.
     C'est un evenement ponctuel, il se detruit tout seul. */
  choc(nom) {
    const v = this.voix.get(nom);
    if (!this.pret || !v) return;
    const ctx = this.ctx, t = ctx.currentTime;

    const s = this._bruit(0.5);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(3800, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.28);
    f.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.26, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);
    s.connect(f); f.connect(g); g.connect(v.entree);
    s.stop(t + 0.5);

    // Le coup de grave, qui donne le poids du contact.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.22);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.14, t);
    og.gain.exponentialRampToValueAtTime(0.0006, t + 0.30);
    o.connect(og); og.connect(v.entree);
    o.start(t); o.stop(t + 0.35);
  }

  /* ======================================================================
     LE TIR DE TOILE

     Un « thwip » : une bouffee de bruit tres breve dont le filtre monte
     vite. Tout tient dans la duree — quarante millisecondes d'attaque, cent
     de chute. Plus long, cela devient un jet d'aerosol ; plus court, un clic.
     ====================================================================== */
  toile(nom) {
    const v = this.voix.get(nom);
    if (!this.pret || !v) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = this._bruit(0.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(5200, t + 0.09);
    f.Q.value = 1.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.19, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.16);
    s.connect(f); f.connect(g); g.connect(v.entree);
    s.stop(t + 0.4);
  }

  /* ======================================================================
     LE BANG DE LA DELOREAN

     Un bang supersonique : une detente de grave tres rapide, doublee d'une
     bouffee de bruit large. Il arrive APRES le passage, ce qui est
     physiquement juste et dramatiquement meilleur.
     ====================================================================== */
  bang(nom) {
    const v = this.voix.get(nom);
    if (!this.pret || !v) return;
    const ctx = this.ctx, t = ctx.currentTime;

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.34);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.30, t);
    og.gain.exponentialRampToValueAtTime(0.0006, t + 0.52);
    o.connect(og); og.connect(v.entree);
    o.start(t); o.stop(t + 0.6);

    const s = this._bruit(0.7);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(240, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.62);
    s.connect(f); f.connect(g); g.connect(v.entree);
    s.stop(t + 0.7);
  }

  /* ======================================================================
     LE SCINTILLEMENT DU PATRONUS

     Une matiere, pas un evenement : du bruit tres aigu, filtre etroit et
     module lentement, avec quelques partiels qui montent et se dissipent.
     C'est le son du givre qui se forme, transpose vers le haut.
     ====================================================================== */
  _scintillement(sortie) {
    const ctx = this.ctx, t = ctx.currentTime;
    const noeuds = [];
    const s = this._bruit(0);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 4200;
    f.Q.value = 4.0;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.42;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 1500;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    lfo.start(t);
    noeuds.push(s, lfo);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.075, t + 1.1);
    s.connect(f); f.connect(g); g.connect(sortie);
    return { noeuds, gain: g };
  }

  /* ======================================================================
     LE MOTEUR

     C'est le son le plus difficile de toute cette serie, et le plus payant :
     une poursuite sans moteur n'est qu'une sirene qui se promene.

     Un moteur n'est PAS une note. C'est une serie d'explosions regulieres,
     donc un peigne d'harmoniques dont le fondamental est le regime lui-meme
     — quarante hertz au ralenti, cent-vingt a fond. On empile donc quatre
     dents de scie sur des rapports entiers, plus un grondement d'admission
     en bruit passe-bas, et l'on ouvre un filtre global a mesure que le
     regime monte : c'est cette OUVERTURE, bien plus que la hauteur, qui
     s'entend comme « il accelere ».

     Tout est pilotable en continu depuis la scene, parce qu'un moteur qui
     tourne a regime constant pendant qu'une voiture double se lit comme un
     enregistrement plaque par-dessus l'image.
     ====================================================================== */
  _moteur(sortie, opts = {}) {
    const ctx = this.ctx, t = ctx.currentTime;
    const base = opts.base ?? 44;
    const noeuds = [];
    const oscs = [];

    const melange = ctx.createGain();
    melange.gain.value = 0.20;

    /* Les harmoniques. Les rapports ne sont pas tous entiers : un moteur
       reel a des cylindres qui ne s'allument pas exactement en phase, et ce
       leger desaccord est ce qui l'empeche de sonner comme un orgue. */
    for (const [mult, amp] of [[1, 1.0], [2, 0.58], [3.02, 0.34], [4.47, 0.20], [6.1, 0.10]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g); g.connect(melange);
      o.start(t);
      noeuds.push(o);
      oscs.push({ o, mult });
    }

    // Le grondement d'admission : du bruit tres grave, qui donne la masse.
    const air = this._bruit(0);
    const fAir = ctx.createBiquadFilter();
    fAir.type = 'lowpass'; fAir.frequency.value = 380; fAir.Q.value = 1.3;
    const gAir = ctx.createGain(); gAir.gain.value = 0.55;
    air.connect(fAir); fAir.connect(gAir); gAir.connect(melange);
    noeuds.push(air);

    /* Le filtre de corps. Ferme, on entend un moteur qui tourne au loin ;
       ouvert, on entend un moteur qui hurle. C'est le parametre le plus
       expressif de tout le module. */
    const corps = ctx.createBiquadFilter();
    corps.type = 'lowpass';
    corps.frequency.value = 620;
    corps.Q.value = 0.9;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.volume ?? 0.085, t + 0.45);

    melange.connect(corps); corps.connect(g); g.connect(sortie);
    return { noeuds, gain: g, oscs, base, corps, volume: opts.volume ?? 0.085 };
  }

  /* ======================================================================
     LE CREPITEMENT DU CONDENSATEUR

     Des arcs electriques : des bouffees de bruit tres breves, tres aigues,
     tres irregulieres. La regularite est ici le seul ennemi — un crepitement
     periodique se lit comme un moteur de mobylette. On programme donc les
     eclats a l'avance sur une longue duree, avec des ecarts tires au sort,
     ce qui coute infiniment moins qu'un minuteur JavaScript et reste
     irregulier.
     ====================================================================== */
  _crepitement(sortie) {
    const ctx = this.ctx, t = ctx.currentTime;
    const s = this._bruit(0);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3400;
    f.Q.value = 2.2;

    /* La porte : un gain qu'on ouvre par a-coups. Cinq cents eclats
       programmes d'avance couvrent une trentaine de secondes, largement de
       quoi tenir toute la scene. */
    const porte = ctx.createGain();
    porte.gain.setValueAtTime(0, t);
    let q = t + 0.05;
    for (let i = 0; i < 420 && q < t + 34; i++) {
      const d = 0.008 + Math.random() * 0.02;
      porte.gain.setValueAtTime(0.0001, q);
      porte.gain.linearRampToValueAtTime(0.55 + Math.random() * 0.45, q + 0.003);
      porte.gain.exponentialRampToValueAtTime(0.0001, q + d);
      q += 0.02 + Math.random() * 0.14;
    }

    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(f); f.connect(porte); porte.connect(g); g.connect(sortie);
    return { noeuds: [s], gain: g, porte };
  }

  /* ======================================================================
     LE SUB DE GARGANTUA

     Un trou noir ne fait aucun bruit, et c'est justement ce qui rend le
     choix interessant : ce qu'on met la n'est pas un son realiste mais une
     PRESENCE. Deux sinusoides tres graves, tres proches l'une de l'autre,
     qui battent lentement l'une contre l'autre — le battement est ce qui
     donne l'impression de masse. Plus un souffle sourd, tres filtre.

     Rien au-dessus de cent hertz : sur le haut-parleur d'un telephone on
     n'entendra presque rien, et c'est tres bien — au casque, en revanche,
     l'effet est saisissant, et c'est la qu'Antoine ecoutera.
     ====================================================================== */
  _sub(sortie) {
    const ctx = this.ctx, t = ctx.currentTime;
    const noeuds = [];
    const melange = ctx.createGain();
    melange.gain.value = 0.9;

    for (const f0 of [27.5, 28.9, 41.2]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0;
      const g = ctx.createGain();
      g.gain.value = f0 > 35 ? 0.35 : 1.0;
      o.connect(g); g.connect(melange);
      o.start(t);
      noeuds.push(o);
    }

    const s = this._bruit(0);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 140; f.Q.value = 0.7;
    const gs = ctx.createGain(); gs.gain.value = 0.8;
    s.connect(f); f.connect(gs); gs.connect(melange);
    noeuds.push(s);

    /* Une respiration tres lente : le niveau monte et descend sur une
       douzaine de secondes. C'est elle qui fait « quelque chose de vivant »
       plutot que « un bourdon de transformateur ». */
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.085;
    const prof = ctx.createGain();
    prof.gain.value = 0.30;
    lfo.connect(prof);
    lfo.start(t);
    noeuds.push(lfo);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.20, t + 3.0);
    prof.connect(g.gain);

    melange.connect(g); g.connect(sortie);
    return { noeuds, gain: g };
  }

  /* ======================================================================
     LE SOUFFLE FROID

     Pour Kill Bill : une rafale qui passe au moment ou elle se retourne.
     Du bruit passe-bande dont la frequence centrale monte puis redescend —
     c'est ce balayage, et lui seul, qui fait « rafale » plutot que
     « souffle continu ».
     ====================================================================== */
  _souffleFroid(sortie) {
    const ctx = this.ctx, t = ctx.currentTime;
    const s = this._bruit(0);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 1.1;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.19;
    const prof = ctx.createGain();
    prof.gain.value = 620;
    lfo.connect(prof); prof.connect(f.frequency);
    lfo.start(t);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.075, t + 1.4);
    s.connect(f); f.connect(g); g.connect(sortie);
    return { noeuds: [s, lfo], gain: g };
  }

  /* ======================================================================
     LA LAME QUI CHANTE

     Un katana qu'on degaine : un transitoire de frottement, puis une
     resonance tres haute et tres longue. Les partiels sont volontairement
     INHARMONIQUES — de l'acier, pas une corde — et ils s'eteignent a des
     vitesses differentes, ce qui est la signature du metal.
     ====================================================================== */
  lame(nom) {
    const v = this.voix.get(nom);
    if (!this.pret || !v) return;
    const ctx = this.ctx, t = ctx.currentTime;

    // Le frottement du fourreau : bref, mat, tres large.
    const s = this._bruit(0.5);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(5600, t + 0.16);
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.30);
    s.connect(f); f.connect(g); g.connect(v.entree);
    s.stop(t + 0.5);

    // La resonance de l'acier.
    const partiels = [2180, 3271, 4622, 6109];
    for (let i = 0; i < partiels.length; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = partiels[i] * (0.997 + Math.random() * 0.006);
      const og = ctx.createGain();
      const dep = 0.05 + i * 0.012;
      const dur = 1.9 - i * 0.34;
      og.gain.setValueAtTime(0, t + dep);
      og.gain.linearRampToValueAtTime(0.052 / (1 + i * 0.55), t + dep + 0.008);
      og.gain.exponentialRampToValueAtTime(0.0002, t + dep + dur);
      o.connect(og); og.connect(v.entree);
      o.start(t + dep); o.stop(t + dep + dur + 0.1);
    }
  }

  /* ======================================================================
     LE SAUT TEMPOREL

     Trois couches, et l'ordre compte : un souffle qui ASPIRE (filtre qui
     monte, volume qui monte), le claquement du depart, puis une queue de
     sub qui s'effondre. C'est la forme d'un depart, pas d'une explosion —
     une explosion commence fort, un depart se prepare.
     ====================================================================== */
  saut(nom) {
    const v = this.voix.get(nom);
    if (!this.pret || !v) return;
    const ctx = this.ctx, t = ctx.currentTime;

    // L'aspiration, qui precede legerement le claquement.
    const asp = this._bruit(0.9);
    const fa = ctx.createBiquadFilter();
    fa.type = 'bandpass'; fa.Q.value = 2.6;
    fa.frequency.setValueAtTime(320, t);
    fa.frequency.exponentialRampToValueAtTime(7200, t + 0.30);
    const ga = ctx.createGain();
    ga.gain.setValueAtTime(0.0008, t);
    ga.gain.exponentialRampToValueAtTime(0.30, t + 0.28);
    ga.gain.exponentialRampToValueAtTime(0.0006, t + 0.42);
    asp.connect(fa); fa.connect(ga); ga.connect(v.entree);
    asp.stop(t + 0.9);

    // Le claquement.
    const cl = this._bruit(0.6);
    const fc = ctx.createBiquadFilter();
    fc.type = 'highpass'; fc.frequency.value = 900;
    const gc = ctx.createGain();
    gc.gain.setValueAtTime(0, t + 0.29);
    gc.gain.linearRampToValueAtTime(0.42, t + 0.30);
    gc.gain.exponentialRampToValueAtTime(0.0006, t + 0.56);
    cl.connect(fc); fc.connect(gc); gc.connect(v.entree);
    cl.stop(t + 0.6);

    // La queue de sub, qui s'effondre.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t + 0.29);
    o.frequency.exponentialRampToValueAtTime(24, t + 0.95);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.34, t + 0.29);
    og.gain.exponentialRampToValueAtTime(0.0005, t + 1.10);
    o.connect(og); og.connect(v.entree);
    o.start(t + 0.29); o.stop(t + 1.2);
  }

  /* ======================================================================
     LE PAS DU THEROPODE

     Quatre tonnes qui retombent. C'est du SUB, presque uniquement : une
     sinusoide qui s'effondre de soixante hertz a quinze en un tiers de
     seconde, doublee d'un craquement mat pour la neige tassee. Rien
     au-dessus de deux cents hertz — un pas aigu ferait un cheval.

     C'est le son qui porte toute la premiere moitie de la scene, celle ou
     l'on ne voit encore rien : il faut donc qu'il soit reconnaissable seul.
     ====================================================================== */
  pas(nom) {
    const v = this.voix.get(nom);
    if (!this.pret || !v) return;
    const ctx = this.ctx, t = ctx.currentTime;

    // L'impact : une chute de hauteur tres rapide.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(62, t);
    o.frequency.exponentialRampToValueAtTime(15, t + 0.34);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.44, t + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0005, t + 0.52);
    o.connect(og); og.connect(v.entree);
    o.start(t); o.stop(t + 0.6);

    // La neige tassee : un craquement large et court.
    const s = this._bruit(0.4);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1900, t);
    f.frequency.exponentialRampToValueAtTime(230, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.20, t + 0.010);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.34);
    s.connect(f); f.connect(g); g.connect(v.entree);
    s.stop(t + 0.4);
  }

  /* ======================================================================
     LE RUGISSEMENT

     Le son le plus difficile a fabriquer sans echantillon, et celui qui
     rate le plus souvent. Ce qui fait un cri d'animal enorme n'est ni sa
     hauteur ni son volume, c'est sa STRUCTURE :

     · un fondamental TRES BAS, entre soixante et cent hertz, qui MODULE en
       hauteur pendant tout le cri — un cri a hauteur fixe est une sirene ;
     · un formant, c'est-a-dire un filtre resonant qui balaie, et qui est ce
       que l'oreille lit comme une gueule ouverte puis refermee ;
     · une couche de bruit RAUQUE par-dessus, parce qu'aucun larynx reel
       n'est pur ;
     · et une queue qui traine, parce qu'un cri de cette taille resonne dans
       une cage thoracique de trois metres.
     ====================================================================== */
  rugir(nom) {
    const v = this.voix.get(nom);
    if (!this.pret || !v) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const D = 2.3;

    const melange = ctx.createGain();
    melange.gain.value = 1;

    /* Le fondamental et ses harmoniques. La hauteur monte au debut du cri
       puis retombe : c'est la courbe d'un souffle qui s'epuise. */
    for (const [mult, amp, type] of [[1, 1.0, 'sawtooth'], [1.5, 0.45, 'sawtooth'],
                                     [2.02, 0.30, 'square'], [3.1, 0.16, 'sawtooth']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(58 * mult, t);
      o.frequency.linearRampToValueAtTime(96 * mult, t + 0.30);
      o.frequency.linearRampToValueAtTime(74 * mult, t + 1.10);
      o.frequency.exponentialRampToValueAtTime(38 * mult, t + D);
      const g = ctx.createGain();
      g.gain.value = amp * 0.16;
      o.connect(g); g.connect(melange);
      o.start(t); o.stop(t + D + 0.15);
    }

    /* Le rauque : du bruit passe-bande, module par un tremblement rapide.
       C'est lui qui fait la difference entre un cri et une corne de brume. */
    const s = this._bruit(D + 0.2);
    const fr = ctx.createBiquadFilter();
    fr.type = 'bandpass'; fr.Q.value = 1.6;
    fr.frequency.setValueAtTime(420, t);
    fr.frequency.linearRampToValueAtTime(900, t + 0.35);
    fr.frequency.exponentialRampToValueAtTime(220, t + D);
    const gs = ctx.createGain(); gs.gain.value = 0.55;
    s.connect(fr); fr.connect(gs); gs.connect(melange);

    /* LE FORMANT : un passe-bande large qui balaie du grave vers l'aigu
       puis redescend. C'est cette course, et elle seule, que l'oreille lit
       comme une gueule qui s'ouvre. */
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 0.9;
    formant.frequency.setValueAtTime(260, t);
    formant.frequency.linearRampToValueAtTime(1250, t + 0.40);
    formant.frequency.linearRampToValueAtTime(700, t + 1.30);
    formant.frequency.exponentialRampToValueAtTime(180, t + D);

    /* L'enveloppe : attaque franche mais pas instantanee — un animal prend
       de l'air — plateau, puis une longue queue. */
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.85, t + 0.14);
    g.gain.linearRampToValueAtTime(0.70, t + 1.20);
    g.gain.exponentialRampToValueAtTime(0.0006, t + D + 0.1);

    melange.connect(formant); formant.connect(g); g.connect(v.entree);

    /* Et un doublage tres grave, sans formant : c'est ce qu'on sent dans la
       poitrine plutot qu'on ne l'entend, et c'est ce qui donne la taille. */
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(31, t);
    sub.frequency.linearRampToValueAtTime(44, t + 0.35);
    sub.frequency.exponentialRampToValueAtTime(22, t + D);
    const gsub = ctx.createGain();
    gsub.gain.setValueAtTime(0, t);
    gsub.gain.linearRampToValueAtTime(0.34, t + 0.18);
    gsub.gain.exponentialRampToValueAtTime(0.0005, t + D);
    sub.connect(gsub); gsub.connect(v.entree);
    sub.start(t); sub.stop(t + D + 0.2);
  }

  /* ======================================================================
     PILOTAGE EN CONTINU

     Une scene qui bouge doit pouvoir parler a son son a chaque image. Le
     cas typique est le moteur : son regime, son ouverture et sa hauteur
     changent en permanence, et c'est precisement ce qui fait qu'on entend
     une voiture qui passe plutot qu'un moteur enregistre.

     `setTargetAtTime` plutot qu'une affectation directe : une valeur posee
     brutalement soixante fois par seconde produit des craquements
     d'escalier, un lissage exponentiel court n'en produit aucun.
     ====================================================================== */
  regler(nom, valeurs) {
    if (!this.pret) return;
    const c = this.continus.get(nom);
    if (!c || !c.moteurs) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < c.moteurs.length && i < valeurs.length; i++) {
      const m = c.moteurs[i], p = valeurs[i];
      if (!m || !p) continue;
      /* LE DECALAGE DOPPLER. Le Web Audio ne le fait plus depuis longtemps :
         on le calcule donc soi-meme a partir de la vitesse radiale, et on
         le passe ici. C'est lui qui donne le « nnnnn-iiiaaaaou » quand la
         voiture double, et sans lui un passage rapide sonne comme un
         passage lent. */
      const f = m.base * (1 + (p.regime ?? 0) * 1.9) * (1 + (p.doppler ?? 0));
      for (const { o, mult } of m.oscs) {
        try { o.frequency.setTargetAtTime(f * mult, t, 0.03); } catch { /* ferme */ }
      }
      try {
        m.corps.frequency.setTargetAtTime(520 + (p.regime ?? 0) * 2600, t, 0.05);
        m.gain.gain.setTargetAtTime(m.volume * (p.volume ?? 1), t, 0.05);
      } catch { /* ferme */ }
    }
    // Le crepitement du condensateur, s'il y en a un.
    if (c.crepite && valeurs.crepite !== undefined) {
      try { c.crepite.gain.gain.setTargetAtTime(valeurs.crepite * 0.13, t, 0.04); } catch { /* ferme */ }
    }
  }

  /* ======================================================================
     PILOTAGE

     `ouvrir` et `fermer` sont appeles par la classe Apparitions quand une
     scene entre et sort de sa fenetre. Toute la gestion du cycle de vie est
     ici, pour que les scenes elles-memes n'aient jamais a s'en soucier.
     ====================================================================== */
  ouvrir(nom, objet) {
    if (!this.pret || this.continus.has(nom)) return;
    /* La portee : jusqu'ou la source s'entend. Une poursuite doit
       s'entendre venir de tres loin — c'est tout son interet — la ou un
       duel n'a aucune raison de porter au-dela de la clairiere. Gargantua
       est un cas a part : il est a trois cents metres et doit pourtant se
       faire sentir, donc sa portee couvre tout. */
    const portee = nom === 'police' ? 170 : nom === 'gargantua' ? 600
                 : nom === 'delorean' ? 120 : nom === 'trex' ? 150 : 60;
    const v = this._voix(nom, objet, portee);
    if (!v) return;

    let c = null;
    if (nom === 'police') {
      /* DEUX MOTEURS ET UNE SIRENE. Le fuyard tourne plus haut et plus
         nerveux que la voiture de police : c'est une petite cylindree qui
         se fait poursuivre par une grosse, et cet ecart de hauteur suffit a
         faire entendre qu'ils sont deux. */
      const sir = this._sirene(v.entree);
      const mPolice = this._moteur(v.entree, { base: 40, volume: 0.085 });
      const mFuyard = this._moteur(v.entree, { base: 58, volume: 0.070 });
      c = {
        noeuds: [...sir.noeuds, ...mPolice.noeuds, ...mFuyard.noeuds],
        gains: [sir.gain, mPolice.gain, mFuyard.gain],
        moteurs: [mPolice, mFuyard],
      };
    } else if (nom === 'delorean') {
      /* Un seul moteur, tres tendu, et le crepitement du condensateur qui
         monte par-dessus jusqu'au saut. */
      const m = this._moteur(v.entree, { base: 62, volume: 0.080 });
      const cr = this._crepitement(v.entree);
      c = {
        noeuds: [...m.noeuds, ...cr.noeuds],
        gains: [m.gain, cr.gain],
        moteurs: [m], crepite: cr,
      };
    } else if (nom === 'sabres') {
      // Deux lames, deux hauteurs : c'est le duel qu'on entend, pas un sabre.
      const a = this._sabre(v.entree, false);
      const b = this._sabre(v.entree, true);
      c = { noeuds: [...a.noeuds, ...b.noeuds], gain: null, gains: [a.gain, b.gain] };
    } else if (nom === 'patronus') c = this._scintillement(v.entree);
    else if (nom === 'gargantua') c = this._sub(v.entree);
    else if (nom === 'killbill') c = this._souffleFroid(v.entree);
    if (c) this.continus.set(nom, c);

    // Les ponctuels d'entree de scene.
    if (nom === 'spider1' || nom === 'spider2') this.toile(nom);
  }

  fermer(nom) {
    const c = this.continus.get(nom);
    if (!c) return;
    this.continus.delete(nom);
    const ctx = this.ctx, t = ctx.currentTime;
    /* On DESCEND le gain avant d'arreter : couper net un oscillateur produit
       un clic franc, qui s'entend beaucoup plus que le son qu'on coupe. */
    const gains = c.gains || (c.gain ? [c.gain] : []);
    for (const g of gains) {
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0004, t + 0.45);
      } catch { /* un contexte ferme n'a pas a nous interrompre */ }
    }
    for (const n of c.noeuds) {
      try { n.stop(t + 0.5); } catch { /* deja arrete */ }
    }
  }

  /* Tout couper — au retour a la lisiere, quand la balade recommence. */
  toutFermer() {
    for (const nom of [...this.continus.keys()]) this.fermer(nom);
  }
}

void THREE;
