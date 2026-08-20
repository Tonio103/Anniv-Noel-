# Le cerf et ses empreintes

## Fichiers concernés

- `src/deer/deerRig.js` — la démarche : cycle de marche, phases de poser
  de chaque sabot, `this.posers` (file d'événements consommée à
  l'extérieur)
- `src/deer/deerMesh.js` — `creerCerf(palier)` : le maillage (réutilisé
  aussi pour le cerf de lumière et le patronus-cerf, voir
  `../apparitions/patronus.md`)
- `src/world/footprints.js` — `class Empreintes` : la texture de traces
  au sol, lue par le shader de neige
- `src/main.js` (ligne ~153 : `new Empreintes(...)`, ligne ~766 : le seul
  appel à `empreintes.ajouter(...)`)

## Le cycle de marche et les posers

`deerRig.js` anime chaque patte selon des phases de cycle (fraction de
0 à 1). À chaque **front montant** d'un poser de sabot, il pousse un
événement dans `this.posers` :

```js
this.posers.push({ nom: mb.nom, pos: mb.sabotMonde.clone(), force: clamp(this.vitesse / 6, 0.25, 1) });
```

`force` dépend de la vitesse : un pas lent (approche d'une halte) marque
moins fort qu'un pas de croisière. `main.js` vide cette file à chaque pas
de simulation et appelle, pour chacun, `empreintes.ajouter(x, z, angle,
force)`.

Rappel déjà noté dans `camera-drone.md` : le **son** des pas du cerf a été
explicitement retiré sur demande d'Antoine plus tôt dans le projet (tâche
#7 de la liste). Les empreintes visuelles, elles, sont restées et
fonctionnent — ce sont deux systèmes distincts branchés sur la même source
(`this.posers`), et seul le son a été coupé.

## `Empreintes` : le principe de la fenêtre glissante

Une seule instance globale (`empreintes`, créée dans `main.js`) — n'importe
quel appelant peut lui dire « pose une trace ici » via `ajouter(x, z,
angle, force)`. Aujourd'hui, **un seul appelant existe** : la boucle qui
traite `cerf.posers`.

Les traces vivent dans une texture en coordonnées monde (`ETENDUE = 48`
mètres de côté, `1024` ou `2048` texels selon le palier), que le shader de
neige échantillonne pour assombrir/creuser la surface. Couvrir toute la
forêt (plus d'un kilomètre) d'un coup demanderait une texture absurde :
on garde donc une fenêtre glissante centrée sur le cerf. Quand elle se
déplace, l'ancienne texture est recopiée dans la nouvelle à sa vraie
position monde (`this.copie`), calée sur un multiple exact de texel — le
recopiage ne floute donc jamais les traces déjà posées.

Une empreinte est **un creux, pas un tampon posé dessus** — bug corrigé
avant cette session (voir les commentaires en tête du fichier : le halo
de neige repoussée faisait lire chaque pas comme une bosse claire au lieu
d'un trou). Le tampon dessine deux onglons en goutte, écartés en V vers
l'avant (lecture « cervide », distincte d'un sanglier ou d'un chien), plus
une amorce de bourrelet très faible à l'arrière — c'est l'assombrissement,
pas une forme ajoutée, qui porte toute la lecture visuelle.

Un **voile noir très faible** est repassé périodiquement sur toute la
fenêtre (constante de temps ≈ 50 s) : sans lui, le couloir finirait
labouré d'un bout à l'autre, ce qui est faux (la neige comble une trace en
quelques minutes) et efface justement l'information utile (les traces
fraîches sont juste derrière l'animal).

## Problèmes connus / à faire

**Le T-Rex ne laisse aucune empreinte.** `jurassique()` / `marcheTrex()`
(`src/world/apparitions.js`, `src/world/trex.js`) n'appellent jamais
`empreintes.ajouter()` — la fonctionnalité n'a simplement jamais été
écrite pour lui, alors que le système (`Empreintes`) est générique et
pourrait recevoir des traces de n'importe qui. Diagnostic complet et
pistes détaillées dans `../son/empreintes-trex.md` (le nom du fichier
trompe — c'est un problème visuel, classé sous `son/` par erreur
d'aiguillage éditorial ; le contenu, lui, est correct). Point non résolu
et à vérifier avant d'écrire le correctif : `Empreintes` suppose
aujourd'hui **une seule forme de tampon** (le sabot fourchu de cervide,
`tamponSabot()`) — une empreinte tridactyle de théropode, bien plus
grande, demandera d'étendre le système plutôt que de simplement
l'appeler tel quel avec une `force` plus élevée.

## Idées non explorées

- Exposer les instants de pose de pied depuis `marcheTrex()` sur le même
  modèle que `cerf.posers`, pour que `main.js` puisse traiter les deux
  sources de la même façon plutôt que d'écrire un second chemin de code
  dédié.
- `Empreintes` pourrait accepter un second tampon (texture) choisi par
  l'appelant plutôt qu'un tampon fixe construit une fois au constructeur
  — nécessaire pour distinguer visuellement sabot de cervide et empreinte
  de théropode dans la même fenêtre glissante.
