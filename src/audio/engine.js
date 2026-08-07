/* Le son.

   Aucun fichier audio n'est charge : tout est fabrique a la volee. Ce n'est
   pas seulement une contrainte de poids, c'est ce qui permet au son de SUIVRE
   la scene — le vent force quand le drone accelere, les sabots crissent
   exactement quand un sabot se pose, la neige etouffe les aigus.

   Pas de musique, c'est la consigne. On travaille donc en bruiteur : du bruit
   filtre plutot que des notes. Meme la floraison lumineuse d'un paquet qui
   s'ouvre est faite de partiels INHARMONIQUES, pour qu'on entende un
   scintillement et jamais un accord.

   Une reverberation commune place toutes les sources dans le meme lieu. Elle
   est courte et sombre, parce que la neige absorbe : une reverb longue et
   brillante sonnerait comme une cathedrale, pas comme une clairiere.
*/

import * as THREE from 'three';

/* Bruit rose : bien plus proche des bruits naturels que le bruit blanc, qui
   siffle. Huit secondes lues en boucle suffisent, l'oreille ne repere pas la
   periode sur une matiere aussi dense. */
function bruitRose(ctx, secondes) {
  const n = Math.floor(ctx.sampleRate * secondes);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

/* Reponse impulsionnelle synthetique. Duree courte, spectre assombri :
   c'est la signature d'un exterieur enneige. */
function reverbNeige(ctx) {
  const duree = 2.1;
  const n = Math.floor(ctx.sampleRate * duree);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const brut = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.1);
      // Un passe-bas progressif : les aigus meurent avant les graves.
      lp += (brut - lp) * (0.35 - t * 0.28);
      d[i] = lp;
    }
  }
  const cv = ctx.createConvolver();
  cv.buffer = buf;
  return cv;
}

export class Son {
  constructor() {
    this.pret = false;
    this.ctx = null;
    this.volume = 0.62;
    this.couches = { vent: true, grelots: false, neige: true };
  }

  /* Le contexte ne peut naitre que d'un geste de l'utilisateur : on l'ouvre
     au moment ou il franchit le seuil de la foret. */
  demarrer(camera) {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    THREE.AudioContext.setContext(this.ctx);

    const ctx = this.ctx;

    this.ecoute = new THREE.AudioListener();
    camera.add(this.ecoute);

    /* --- bus principal ---------------------------------------------------- */
    this.limiteur = ctx.createDynamicsCompressor();
    this.limiteur.threshold.value = -12;
    this.limiteur.ratio.value = 8;
    this.limiteur.attack.value = 0.004;
    this.limiteur.release.value = 0.22;

    this.maitre = ctx.createGain();
    this.maitre.gain.value = 0;
    this.maitre.connect(this.limiteur);
    this.limiteur.connect(ctx.destination);

    this.verb = reverbNeige(ctx);
    this.departVerb = ctx.createGain();
    this.departVerb.gain.value = 0.34;
    this.departVerb.connect(this.verb);
    const retour = ctx.createGain();
    retour.gain.value = 0.85;
    this.verb.connect(retour);
    retour.connect(this.maitre);

    this.rose = bruitRose(ctx, 8);

    this._construireVent();
    this._construireForet();

    // Montee douce : on ne demarre jamais le son a pleine puissance.
    this.maitre.gain.setValueAtTime(0, ctx.currentTime);
    this.maitre.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 3.2);

    this.pret = true;
  }

  _source(boucle = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.rose;
    s.loop = boucle;
    s.start();
    return s;
  }

  /* --- LE VENT ------------------------------------------------------------
     Trois couches. Le corps grave donne la masse d'air ; le sifflement de
     cime donne l'altitude et la foret ; les rafales font respirer le tout.
     Sans les rafales, le vent devient un bourdonnement de ventilateur. */
  _construireVent() {
    const ctx = this.ctx;
    this.vent = ctx.createGain();
    this.vent.gain.value = 0.34;
    this.vent.connect(this.maitre);
    this.vent.connect(this.departVerb);

    // corps grave
    const g1 = ctx.createGain(); g1.gain.value = 0.85;
    const f1 = ctx.createBiquadFilter();
    f1.type = 'lowpass'; f1.frequency.value = 240; f1.Q.value = 0.6;
    this._source().connect(f1); f1.connect(g1); g1.connect(this.vent);

    // sifflement de cime, balaye lentement
    const g2 = ctx.createGain(); g2.gain.value = 0.30;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass'; f2.frequency.value = 900; f2.Q.value = 1.5;
    this._source().connect(f2); f2.connect(g2); g2.connect(this.vent);
    this._f2 = f2;

    // rafales : un oscillateur tres lent module les deux couches
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.055;
    const prof = ctx.createGain(); prof.gain.value = 0.42;
    lfo.connect(prof);
    prof.connect(g1.gain);
    const prof2 = ctx.createGain(); prof2.gain.value = 0.26;
    lfo.connect(prof2); prof2.connect(g2.gain);
    lfo.start();

    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.019;
    const prof3 = ctx.createGain(); prof3.gain.value = 520;
    lfo2.connect(prof3); prof3.connect(f2.frequency);
    lfo2.start();

    this._gVentCorps = g1;
  }

  /* --- LA FORET -----------------------------------------------------------
     Un fond tres discret : de rares craquements de bois et le glissement
     d'un paquet de neige. Programmes au hasard, jamais reguliers. */
  _construireForet() {
    const ctx = this.ctx;
    this.foret = ctx.createGain();
    this.foret.gain.value = 0.5;
    this.foret.connect(this.maitre);
    this.foret.connect(this.departVerb);
    this._prochainCraquement = 6 + Math.random() * 12;
  }

  _craquement() {
    const ctx = this.ctx, t = ctx.currentTime;
    const s = this._source(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 320 + Math.random() * 900;
    f.Q.value = 5 + Math.random() * 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16 + Math.random() * 0.12, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.16 + Math.random() * 0.3);
    s.connect(f); f.connect(g); g.connect(this.foret);
    s.stop(t + 0.9);
  }

  /* Paquet de neige qui glisse d'une branche : un souffle mat. */
  _chuteNeige() {
    const ctx = this.ctx, t = ctx.currentTime;
    const s = this._source(false);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(320, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.62);
    s.connect(f); f.connect(g); g.connect(this.foret);
    s.stop(t + 1.0);
  }

  maj(dt, vitesseDrone) {
    if (!this.pret) return;
    const ctx = this.ctx;

    // Le vent force avec la vitesse : on entend qu'on avance.
    if (this._gVentCorps) {
      const cible = this.couches.vent ? 0.62 + Math.min(vitesseDrone / 9, 1) * 0.5 : 0;
      this.vent.gain.setTargetAtTime(cible * 0.34, ctx.currentTime, 0.4);
    }

    this._prochainCraquement -= dt;
    if (this._prochainCraquement <= 0) {
      this._prochainCraquement = 9 + Math.random() * 18;
      if (Math.random() < 0.55) this._craquement(); else this._chuteNeige();
    }
  }

  reglerVolume(v) {
    this.volume = v;
    if (this.pret) this.maitre.gain.setTargetAtTime(v, this.ctx.currentTime, 0.15);
  }

  basculer(nom, actif) {
    this.couches[nom] = actif;
    if (!this.pret) return;
    if (nom === 'vent') {
      this.vent.gain.setTargetAtTime(actif ? 0.34 : 0, this.ctx.currentTime, 0.3);
    }
  }
}
