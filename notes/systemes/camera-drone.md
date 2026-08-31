# La caméra — le drone

## Fichiers concernés

- `src/camera/droneRig.js` — `class Drone` : tout le comportement caméra
- `src/world/apparitions.js` — `class Apparitions`, méthode `maj()` : c'est
  elle qui pilote le drone pendant les apparitions
- `src/main.js` — la machine à états des phases (`PHASES.ROUTE`,
  `APPROCHE`, `FOUILLE`, `PERCEE`, `ATTENTE`, `OUVERTURE`, `LECTURE`,
  `REPRISE`, `FIN`), qui reste l'autorité sur `cerf.vitesseCible` et les
  cadrages nommés en dehors des apparitions

## Les quatre principes du drone (déjà écrits en tête de `droneRig.js`)

Retard élastique (il rattrape le cerf, ne colle pas), dérive lente
(oscillations à périodes premières entre elles, le cadrage ne se répète
jamais), main levée (bruit continu, sans lui l'image est trop propre),
inclinaison en virage. Rien de tout ça n'a changé cette session — ce qui
suit s'ajoute par-dessus.

## L'arrêt pour une apparition (ajouté cette session)

Antoine : « je veux que ce soit vraiment une vraie scène de film, quitte à
ce que le cerf s'arrête ». Le cerf décélère et s'immobilise près de chaque
apparition qui le permet (voir plus bas les exceptions), pendant que la
caméra compose un plan (`drone.cadrer('apparition')`, un cadrage plus
large et plus décalé sur le côté que les cadrages de croisière) et orbite
lentement (`drone.arc(...)`, sens alterné d'une apparition à l'autre).

**Le point clé pour ne rien casser en y retouchant** : la chorégraphie de
chaque scène (position des personnages, minutage des coups, etc.) est
pilotée par `u`, calculé à partir d'une **abscisse effective** (`sc.sEff`)
et non de l'abscisse réelle du cerf. Tant que la scène n'est pas retenue,
`sEff` suit `sc` réel (comportement identique à avant). Dès qu'elle est
retenue, `sEff` avance tout seul à la même vitesse que le cerf aurait
marché (`this._vitesseVirtuelle = 3.3`, dans `Apparitions` — doit rester
proche de la vitesse de croisière réelle du cerf pour que le minutage de
chaque scène reste celui prévu). **Conséquence pratique** : aucune scène
n'a eu besoin d'être re-minutée pour cette fonctionnalité — c'est fait
exprès, ne pas re-régler les enveloppes de visibilité d'une scène en
pensant à un cerf qui bouge, elles n'ont jamais changé.

Déclenchement : `if (!sc.enArret && sReel >= sc.s - rayon) sc.enArret =
true;`, avec `rayon = Math.min(14, sc.avant * 0.5)` — jamais plus de 14 m
de piste de décélération, jamais plus de la moitié de l'amorce de la
scène (pour ne pas empiéter sur ce qui la précède). Fin : quand `sEff`
atteint `sc.s + sc.apres` (la scène a fini de jouer, en temps virtuel).

### Trois exceptions, chacune expliquée dans la fiche de la scène concernée

- **Scènes mobiles** (`police`, `trex`, marquées `suitChemin`) : les
  arrêter les laisserait s'éloigner dans le vide pendant que le cerf ne
  bouge plus — leur chorégraphie suppose un observateur qui avance.
- **`delorean`** : sa fenêtre tombe trop près de la dernière halte-cadeau ;
  son déclenchement d'arrêt arriverait après que la séquence de fin a
  déjà pris la main. Voir `../apparitions/delorean.md`.

### Le garde-fou ajouté dans `main.js`

Arrêter le cerf pour une apparition **pendant** l'approche d'une vraie
halte-cadeau (les deux zones peuvent se chevaucher, l'espacement est
serré) posait un risque réel : `PHASES.APPROCHE` déclenchait `FOUILLE`
(« le cerf est arrivé ») dès que `cerf.vitesse < 0.12`, sans vérifier la
distance — un arrêt pour une apparition, encore loin du cadeau, se lisait
donc à tort comme une arrivée. Corrigé en ajoutant une garde de distance
(`cerf.s > cible.s - 8`) à cette condition. **Ne pas retirer cette garde**
sans revérifier ce cas de figure.

## Le point d'intérêt (`drone.regarder`)

Mécanisme déjà existant (utilisé pour les cadeaux), généralisé cette
session à toutes les apparitions : `Apparitions.maj()` calcule une force
qui monte puis redescend sur la fenêtre de la scène (plus forte à l'arrêt
qu'en croisement simple) et appelle `drone.regarder(point, force)`, qui ne
déplace que la VISÉE — jamais la position de la caméra, qui continue de
suivre le cerf normalement. Le `point` visé est `sc.objet.userData.pointRegard
|| sc.objet.position` : la plupart des scènes n'ont besoin de rien de
spécial (leur racine est déjà à la bonne position), mais une scène
`suitCamera` dont les éléments sont positionnés indépendamment (voir
Gargantua, `../apparitions/gargantua.md`) doit exposer son propre
`pointRegard`, sous peine de viser l'origine du monde en silence.

## Le point-tiré de mise au point

`postfx.viser(distance)` (déjà existant, amorti en douceur) reçoit
désormais la distance à `apparitions.cibleFocus` quand une scène est
retenue, plutôt que toujours la distance au cerf — voir `postfx.md`.

## Le choc caméra (`drone.choc(force)`)

Secousse rapide (fréquences hautes, sans rapport entre elles pour éviter
l'effet de vibration régulière) + resserrement bref du champ, décroissance
exponentielle. Branché **génériquement** : `Apparitions` intercepte le
canal `emettre` déjà utilisé par chaque scène pour ses sons ponctuels
(voir `audio.md`) et appelle `drone.choc(...)` pour tout événement sauf
`'regler'` (paramètre continu) et `'pas'` (répété à chaque foulée, donnerait
une vibration permanente plutôt qu'un choc). Donc : ajouter un nouvel
`emettre('quelquechose')` dans une scène déclenche le choc caméra
automatiquement, sans rien connecter à la main.
