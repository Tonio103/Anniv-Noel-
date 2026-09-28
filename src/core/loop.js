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
    this._id = 0;
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
    this._demander();
  }

  /* UNE SEULE CHAINE D'IMAGES, TOUJOURS.

     `pause()` se contentait de lever un drapeau, sans annuler l'image deja
     demandee. Or un onglet masque ne JETTE pas ses demandes d'image : il les
     suspend. Au retour — changer d'appli puis revenir, sur un telephone, rien
     de plus courant — `reprendre()` en demandait une nouvelle, et l'ancienne,
     toujours en attente, se reveillait avec elle. Chacune redemandant la
     suivante, DEUX chaines tournaient desormais en parallele : deux pas de
     simulation par image, la balade accelerait d'environ trois quarts pour
     tout le reste de la visite, et rien ne le signalait.

     On garde donc la main sur la demande en cours : annulee a la pause,
     remplacee et jamais doublee a la reprise. */
  _demander() {
    if (this._id) cancelAnimationFrame(this._id);
    this._id = requestAnimationFrame(this._tick);
  }

  pause() {
    this.actif = false;
    if (this._id) { cancelAnimationFrame(this._id); this._id = 0; }
  }

  reprendre() {
    if (!this.actif) { this.dernier = performance.now(); this.demarrer(); }
  }

  _tick(now) {
    this._id = 0;
    if (!this.actif) return;
    this._demander();

    let dt = (now - this.dernier) / 1000;
    this.dernier = now;

    /* Bornage. On PLAFONNE au lieu de remettre a 1/60 : sur une machine
       lente, reinitialiser le pas revient a figer la balade (le temps simule
       avance moins vite que le temps reel et le cerf n'arrive jamais).
       Au-dela d'une seconde, on considere qu'il y a eu une vraie pause.

       ET PAR LE BAS. Le bornage n'existait que vers le haut. L'horodatage
       que le navigateur passe a une image est celui du DEBUT de cette image :
       il peut preceder le `performance.now()` pris juste avant par
       `demarrer()` ou `reprendre()`, et en navigateur sans ecran il l'a
       precede de plus d'une minute. Le pas negatif passait tel quel, et les
       amortissements l'extrapolaient au lieu d'interpoler — voir `damp`,
       dans noise.js, pour ce que cela a coute. Un pas negatif ou invalide
       vaut zero : il ne s'est rien passe. */
    if (!(dt > 0)) dt = 0;
    else if (dt > 1) dt = 1 / 60;
    else if (dt > 0.1) dt = 0.1;

    this.dtLisse += (dt - this.dtLisse) * 0.25;
    this.t += this.dtLisse;

    this.onFrame(this.dtLisse, this.t);
  }
}
