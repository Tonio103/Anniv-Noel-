/* Boucle de rendu.

   Deux precautions qui se voient tout de suite quand elles manquent :
   on borne le pas de temps (revenir sur l'onglet apres une minute ne doit
   pas telporter le cerf a l'autre bout de la foret), et on lisse legerement
   le delta pour que le mouvement de camera ne tremble pas quand le
   navigateur livre des trames irregulieres. */

export class Boucle {
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.t = 0;
    this.dernier = 0;
    this.dtLisse = 1 / 60;
    this.actif = false;
    this._tick = this._tick.bind(this);

    // Onglet masque : on suspend pour ne pas chauffer la batterie.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else this.reprendre();
    });
  }

  demarrer() {
    if (this.actif) return;
    this.actif = true;
    this.dernier = performance.now();
    requestAnimationFrame(this._tick);
  }

  pause() { this.actif = false; }

  reprendre() {
    if (!this.actif) { this.dernier = performance.now(); this.demarrer(); }
  }

  _tick(now) {
    if (!this.actif) return;
    requestAnimationFrame(this._tick);

    let dt = (now - this.dernier) / 1000;
    this.dernier = now;

    // Bornage. On PLAFONNE au lieu de remettre a 1/60 : sur une machine
    // lente, reinitialiser le pas revient a figer la balade (le temps simule
    // avance moins vite que le temps reel et le cerf n'arrive jamais).
    // Au-dela d'une seconde, on considere qu'il y a eu une vraie pause.
    if (dt > 1) dt = 1 / 60;
    else if (dt > 0.1) dt = 0.1;

    this.dtLisse += (dt - this.dtLisse) * 0.25;
    this.t += this.dtLisse;

    this.onFrame(this.dtLisse, this.t);
  }
}
