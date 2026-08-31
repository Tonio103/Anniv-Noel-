# Le son des apparitions

## Fichiers concernés

- `src/audio/apparitionsSon.js` — `class ApparitionsSon` : une méthode par
  nom d'événement, tout synthétisé (rien n'est chargé), tout spatialisé
- `src/world/apparitions.js` — `Apparitions` (constructeur) : le
  dispatcher générique `emettre`, branché sur chaque scène
- `src/camera/droneRig.js` — `Drone.choc(force)` : consommateur générique
  du même canal `emettre` (voir `camera-drone.md`)

## Le principe : `emettre(quoi, valeur)`

Chaque scène reçoit, à sa construction, `o.userData.emettre = (quoi,
valeur) => {...}` — une fonction générique fabriquée une fois dans le
constructeur d'`Apparitions` et injectée dans toutes les scènes. Une scène
n'a donc jamais besoin de connaître le moteur son : elle appelle
`g.userData.emettre?.('rugir')` ou `g.userData.emettre?.('pas')` sans se
soucier de qui écoute.

Le dispatcher fait deux choses à chaque appel :

```js
const s = this.son;
if (s && typeof s[quoi] === 'function') s[quoi](d.nom, valeur);
if (quoi !== 'regler' && quoi !== 'pas') {
  this._droneCourant?.choc(typeof valeur === 'number' ? clamp(valeur, 0.35, 1) : 0.6);
}
```

1. il cherche une méthode du **même nom** sur `ApparitionsSon` et l'appelle
   avec `(nomDeLaScene, valeur)` ;
2. il déclenche **aussi**, génériquement, un choc caméra pour tout
   événement sauf `'regler'` (paramètre continu, pas un événement
   ponctuel) et `'pas'` (répété à chaque foulée — un choc à chaque pas
   donnerait une vibration permanente, pas un choc).

**Un piège vérifié cette session** : si la méthode nommée n'existe pas sur
`ApparitionsSon`, l'appel `typeof s[quoi] === 'function'` échoue
silencieusement — pas d'erreur, pas de son, rien dans la console. Une
scène peut donc émettre un événement dont personne, côté son, ne s'occupe
jamais, sans que rien ne le signale — le T-Rex (retiré du parcours cette
session) en avait fait les frais avec son signal `'pas'`. **Le choc
caméra, lui, ne dépend pas de cette méthode** — mais `'pas'` est
justement exclu du choc générique (foulée répétée, pas un choc ponctuel),
donc ce genre de cas ne déclenche vraiment rien du tout : un nom de scène
qui ne correspond à aucune méthode `ApparitionsSon` est à vérifier
manuellement, le mécanisme ne le signale jamais de lui-même.

## Continus vs ponctuels

Deux familles, gérées différemment dans `ApparitionsSon` :

- **continus** (sirène de police, bourdonnement de sabre, souffle de
  soucoupe) — vivent tant que la scène est ouverte, stockés dans
  `this.continus` (une `Map`), et **doivent être coupés explicitement** à
  la fermeture de la scène, sans quoi ils tournent pour toujours ;
- **ponctuels** (tir de toile, choc de lames, bang de la DeLorean,
  rugissement) — se déclenchent une fois et s'éteignent seuls.

Une voix par apparition est créée à la demande (`this.voix`, une `Map`) :
tant qu'une scène n'a jamais joué, elle ne coûte aucun nœud audio. Le
point d'émission est ancré sur l'objet de la scène via `sfx.ancrer(objet,
portee)` — c'est ce qui fait que chaque son arrive du bon côté et décroît
avec la distance (spatialisation 3D, `PositionalAudio`/`AudioListener`,
même principe que le vent et les sabots ambiants).

## Contraintes non négociables (héritées du reste du projet)

Rien n'est chargé (tout est synthétisé au Web Audio — le fichier doit
rester un HTML unique et autonome) ; pas de musique (des signaux et des
matières — sirène, bourdonnement, souffle — jamais une mélodie) ; tout est
spatialisé (un son au centre de la tête ruine l'effet « quelque chose,
là-bas »).

## Problèmes connus / à faire

Aucun trou connu dans le dispatcher : toutes les scènes actives
(`choc`, `sirene`, `bourdonnement`, `gerbe`, `ouverture`, etc.) ont une
méthode correspondante, vérifiée par `build/sonApparitions.mjs`. `pas` et
`rugir`, écrites pour le T-Rex, ont été retirées d'`apparitionsSon.js`
avec l'apparition elle-même cette session — plus aucun appelant.

## Idées non explorées

Le dispatcher générique n'a aucun mécanisme pour signaler à la construction
qu'un `emettre('xxx')` référence une méthode absente — l'erreur reste
silencieuse par design (une scène qui n'a pas encore de son ne doit pas
planter). Un script d'audit statique (grep de tous les `emettre('...')`
dans `apparitions.js`/`cinema.js`, comparé aux méthodes réellement
définies dans `apparitionsSon.js`) préviendrait ce genre de trou avant
qu'Antoine ne le remarque à l'oreille — pas écrit, `build/sonApparitions.mjs`
teste actuellement scène par scène plutôt que par nom d'événement.
