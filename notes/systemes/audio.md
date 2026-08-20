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

**Conséquence directe et vérifiée cette session** : si la méthode nommée
n'existe pas sur `ApparitionsSon`, l'appel `typeof s[quoi] === 'function'`
échoue silencieusement — pas d'erreur, pas de son, rien dans la console.
C'est exactement le bug documenté dans `../son/bruits-trex.md` : la scène
`jurassique()` appelle bien `emettre('pas')`, mais aucune méthode `pas(nom)`
n'existe dans `apparitionsSon.js`, donc rien ne se passe. **Le choc caméra,
lui, ne dépend pas de cette méthode** — mais `'pas'` est justement exclu du
choc générique, donc ce cas précis ne déclenche vraiment rien du tout.
Symétrique au bug des empreintes (`../son/empreintes-trex.md`), mais côté
son : le signal est émis, rien ne le reçoit.

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

- `pas(nom)` n'existe pas pour le T-Rex — voir `../son/bruits-trex.md`
  pour le diagnostic complet et les pistes (ne pas réutiliser telle
  quelle l'ancienne fonction de pas du cerf, retirée sur demande
  explicite d'Antoine plus tôt dans le projet).
- Aucun autre trou connu dans le dispatcher : toutes les autres scènes
  (`rugir`, `choc`, `sirene`, `bourdonnement`, `gerbe`, `ouverture`, etc.)
  ont une méthode correspondante vérifiée par `build/sonApparitions.mjs`.

## Idées non explorées

Le dispatcher générique n'a aucun mécanisme pour signaler à la construction
qu'un `emettre('xxx')` référence une méthode absente — l'erreur reste
silencieuse par design (une scène qui n'a pas encore de son ne doit pas
planter). Un script d'audit statique (grep de tous les `emettre('...')`
dans `apparitions.js`/`cinema.js`, comparé aux méthodes réellement
définies dans `apparitionsSon.js`) préviendrait ce genre de trou avant
qu'Antoine ne le remarque à l'oreille — pas écrit, `build/sonApparitions.mjs`
teste actuellement scène par scène plutôt que par nom d'événement.
