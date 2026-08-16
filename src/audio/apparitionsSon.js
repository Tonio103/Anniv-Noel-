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
     PILOTAGE

     `ouvrir` et `fermer` sont appeles par la classe Apparitions quand une
     scene entre et sort de sa fenetre. Toute la gestion du cycle de vie est
     ici, pour que les scenes elles-memes n'aient jamais a s'en soucier.
     ====================================================================== */
  ouvrir(nom, objet) {
    if (!this.pret || this.continus.has(nom)) return;
    const v = this._voix(nom, objet, nom === 'police' ? 90 : 60);
    if (!v) return;

    let c = null;
    if (nom === 'police') c = this._sirene(v.entree);
    else if (nom === 'sabres') {
      // Deux lames, deux hauteurs : c'est le duel qu'on entend, pas un sabre.
      const a = this._sabre(v.entree, false);
      const b = this._sabre(v.entree, true);
      c = { noeuds: [...a.noeuds, ...b.noeuds], gain: null, gains: [a.gain, b.gain] };
    } else if (nom === 'patronus') c = this._scintillement(v.entree);
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
