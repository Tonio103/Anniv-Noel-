/* Les bruits ponctuels.

   Tous synthetises, tous spatialises : ils sortent d'un point precis de la
   scene et suivent donc la camera quand elle tourne autour du cerf ou du
   paquet. C'est ce qui empeche le son de "coller a l'ecran".

   Le crissement de la neige merite un mot. Ce n'est pas un choc mais un
   BROYAGE : des milliers de cristaux qui cassent. On l'obtient avec une
   bouffee de bruit passe-bande dans l'aigu, tres breve, doublee d'un coup
   sourd pour le poids de l'animal. La duree est ce qui compte : au-dela de
   120 ms, on entend du gravier ; en dessous de 40, un claquement sec. */

import * as THREE from 'three';

export class Bruitages {
  constructor(son) {
    this.son = son;
    this._dernierSabot = 0;
  }

  get ctx() { return this.son.ctx; }

  /* Cree un point d'emission attache a un objet de la scene. */
  ancrer(objet, portee = 34) {
    if (!this.son.pret) return null;
    const a = new THREE.PositionalAudio(this.son.ecoute);
    a.setRefDistance(3.2);
    a.setMaxDistance(portee);
    a.setDistanceModel('exponential');
    a.setRolloffFactor(1.4);
    // On veut piloter nous-memes ce qui entre dans le panoramique.
    const entree = this.ctx.createGain();
    a.setNodeSource(entree);
    objet.add(a);
    return { audio: a, entree };
  }

  _bruit(duree = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.son.rose;
    s.loop = false;
    s.playbackRate.value = 0.8 + Math.random() * 0.5;
    s.start(0, Math.random() * 6);
    s.stop(this.ctx.currentTime + duree);
    return s;
  }

  /* --- SABOT DANS LA NEIGE ------------------------------------------------ */
  sabot(sortie, force = 1) {
    if (!this.son.pret || !this.son.couches.neige || !sortie) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // Deux sabots trop rapproches se confondent en bouillie.
    if (t - this._dernierSabot < 0.045) return;
    this._dernierSabot = t;

    /* le broyage des cristaux */
    const s = this._bruit(0.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1700 + Math.random() * 1500;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    const d = 0.055 + Math.random() * 0.045;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.30 * force, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    s.connect(f); f.connect(g); g.connect(sortie);

    /* le poids de l'animal */
    const s2 = this._bruit(0.3);
    const f2 = ctx.createBiquadFilter();
    f2.type = 'lowpass'; f2.frequency.value = 180;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.20 * force, t + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0008, t + 0.11);
    s2.connect(f2); f2.connect(g2); g2.connect(sortie);
  }

  /* --- SABOT SUR LA GLACE -------------------------------------------------
     Tout l'inverse du crissement : la glace ne broie pas, elle RESONNE. Un
     transitoire tres bref, une resonance haute et courte, et pas la moindre
     trainee de bruit — c'est la brievete qui fait le dur. */
  sabotGlace(sortie, force = 1) {
    if (!this.son.pret || !this.son.couches.neige || !sortie) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (t - this._dernierSabot < 0.045) return;
    this._dernierSabot = t;

    // Le choc : une bouffee tres courte, filtree haut.
    const s = this._bruit(0.2);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.26 * force, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.045);
    s.connect(f); f.connect(g); g.connect(sortie);

    /* La resonance de la plaque. Deux partiels inharmoniques suffisent, et
       ils doivent mourir vite : une glace qui sonne longtemps devient un
       carillon, donc de la musique. */
    for (const [mult, amp] of [[1, 0.09], [2.37, 0.045]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = (1150 + Math.random() * 700) * mult;
      const og = ctx.createGain();
      const d = 0.09 + Math.random() * 0.07;
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(amp * force, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0004, t + d);
      o.connect(og); og.connect(sortie);
      o.start(t); o.stop(t + d + 0.03);
    }
  }

  /* --- GRELOTS AU COLLIER -------------------------------------------------
     De vrais grelots sont inharmoniques : plusieurs partiels sans rapport
     simple, qui s'eteignent a des vitesses differentes. Des sinusoides
     accordees sonneraient comme un carillon — donc comme de la musique. */
  grelots(sortie, force = 1) {
    if (!this.son.pret || !this.son.couches.grelots || !sortie) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const base = 2250 + Math.random() * 900;
    const rapports = [1, 1.47, 2.09, 2.71, 3.33];

    for (let i = 0; i < rapports.length; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * rapports[i] * (0.99 + Math.random() * 0.02);
      const g = ctx.createGain();
      const amp = (0.055 / (1 + i * 0.8)) * force;
      const d = (0.5 + Math.random() * 0.5) / (1 + i * 0.5);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0002, t + d);
      o.connect(g); g.connect(sortie);
      o.start(t); o.stop(t + d + 0.05);
    }
    // le petit choc du battant
    const s = this._bruit(0.1);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06 * force, t);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.03);
    s.connect(f); f.connect(g); g.connect(sortie);
  }

  /* --- SOUS LA NEIGE, QUELQUE CHOSE REMONTE -------------------------------
     Un grondement sub qui monte, quelques craquements de glace. Il commence
     AVANT que l'image ne bouge : c'est le son qui annonce, l'oeil qui
     confirme. */
  grondement(sortie, duree = 2.6) {
    if (!this.son.pret || !sortie) return;
    const ctx = this.ctx, t = ctx.currentTime;

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(26, t);
    o.frequency.exponentialRampToValueAtTime(58, t + duree * 0.8);
    const go = ctx.createGain();
    go.gain.setValueAtTime(0, t);
    go.gain.linearRampToValueAtTime(0.34, t + duree * 0.45);
    go.gain.exponentialRampToValueAtTime(0.001, t + duree);
    o.connect(go); go.connect(sortie);
    o.start(t); o.stop(t + duree + 0.1);

    const s = this._bruit(duree);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(120, t);
    f.frequency.exponentialRampToValueAtTime(900, t + duree * 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + duree * 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + duree);
    s.connect(f); f.connect(g); g.connect(sortie);

    // craquements de croute
    for (let i = 0; i < 7; i++) {
      const dt = duree * (0.28 + Math.random() * 0.6);
      const cs = this._bruit(0.2);
      const cf = ctx.createBiquadFilter();
      cf.type = 'bandpass';
      cf.frequency.value = 900 + Math.random() * 2600;
      cf.Q.value = 6 + Math.random() * 9;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0, t + dt);
      cg.gain.linearRampToValueAtTime(0.10 + Math.random() * 0.09, t + dt + 0.004);
      cg.gain.exponentialRampToValueAtTime(0.0005, t + dt + 0.09);
      cs.connect(cf); cf.connect(cg); cg.connect(sortie);
    }
  }

  /* --- LA GERBE DE POUDREUSE ---------------------------------------------- */
  gerbe(sortie) {
    if (!this.son.pret || !sortie) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = this._bruit(1.2);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(3400, t + 0.22);
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.40, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.95);
    s.connect(f); f.connect(g); g.connect(sortie);
  }

  /* --- LE PAQUET S'OUVRE --------------------------------------------------
     Une floraison, pas un accord : les partiels sont volontairement sans
     rapport harmonique entre eux, et un souffle ascendant les enveloppe.
     On entend de la lumiere, jamais une melodie.

     `force` (0,55 a 1,30) vient de la poigne — combien le spectateur a
     maintenu l'appui avant de relacher (voir `Halte.majOuverture`). Un tap
     instantane garde un evenement complet ; un appui tenu jusqu'au bout
     l'amplifie. Seuls le souffle et le scintillement en dependent : le
     frottement du couvercle, lui, reste fixe — un couvercle ne frotte pas
     plus fort parce qu'on a attendu plus longtemps pour l'ouvrir. */
  ouverture(sortie, force = 1) {
    if (!this.son.pret || !sortie) return;
    const ctx = this.ctx, t = ctx.currentTime;

    // frottement du couvercle
    const s = this._bruit(0.6);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.20, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);
    s.connect(f); f.connect(g); g.connect(sortie);

    // souffle ascendant
    const s2 = this._bruit(2.4);
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass'; f2.Q.value = 2.2;
    f2.frequency.setValueAtTime(500, t + 0.10);
    f2.frequency.exponentialRampToValueAtTime(5200, t + 1.5);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t + 0.10);
    g2.gain.linearRampToValueAtTime(0.20 * force, t + 0.45);
    g2.gain.exponentialRampToValueAtTime(0.0008, t + 1.9);
    s2.connect(f2); f2.connect(g2); g2.connect(sortie);

    // scintillement inharmonique
    const partiels = [1183, 1627, 2311, 3019, 4127, 5407];
    for (let i = 0; i < partiels.length; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = partiels[i] * (0.995 + Math.random() * 0.01);
      const og = ctx.createGain();
      const dep = 0.14 + i * 0.075 + Math.random() * 0.05;
      const dur = 1.1 + Math.random() * 0.9;
      og.gain.setValueAtTime(0, t + dep);
      og.gain.linearRampToValueAtTime((0.038 / (1 + i * 0.35)) * force, t + dep + 0.05);
      og.gain.exponentialRampToValueAtTime(0.0002, t + dep + dur);
      o.connect(og); og.connect(sortie);
      o.start(t + dep); o.stop(t + dep + dur + 0.1);
    }
  }

  /* --- SOUFFLE DU CERF ---------------------------------------------------- */
  naseaux(sortie) {
    if (!this.son.pret || !sortie) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = this._bruit(0.7);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.45);
    s.connect(f); f.connect(g); g.connect(sortie);
  }
}
