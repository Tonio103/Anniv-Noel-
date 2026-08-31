# Police — poursuite

## État actuel

Une course-poursuite à trois véhicules : la voiture de tête (pare-chocs
poussoir, projecteur de recherche qui balaie, décalque « POLICE »), une
seconde voiture de renfort qui suit en léger décalage de phase sur son
gyrophare, et le fuyard. À mi-parcours, le fuyard manque de justesse une
congère hérissée d'une branche cassée — une embardée franche, freins à
fond, une gerbe de neige qui gicle de l'obstacle, et un choc caméra
générique (voir `../systemes/camera-drone.md`). Chaque véhicule est suivi
individuellement par le doppler audio.

Le renfort (et son gyrophare, sa gerbe de roues) est omis sur le palier
`bas` — c'est aussi le seul palier où le son ne construit que deux
moteurs plutôt que trois, piloté par un drapeau `renfortActif` que la
scène écrit sur son propre objet et que le moteur audio relit à
l'ouverture (voir `../systemes/audio.md`).

## Fichiers concernés

- `src/world/apparitions/police.js` — la scène complète : les trois
  véhicules, la congère, la gerbe de débris de l'embardée, tout le
  pilotage caméra/son
- `src/world/vehicules.js` — les briques partagées avec la DeLorean :
  `carrosserie()` (avec ses options `miroirs`/`antenne`/`conducteur`/
  `pareChocsAvant`/`decal`), `gyrophare()`, `projecteurRecherche()`,
  `gerbe()`/`majGerbe()`, le décalque `texturePolice()`
- `src/world/apparitions/index.js` — entrée `police` dans
  `planApparitions(L)` et `FABRIQUES`
- `src/audio/apparitionsSon.js` — `ouvrir('police', ...)` (siren + deux
  ou trois moteurs), `derapage(nom)` (le son de l'embardée sur neige —
  un raclement qui descend, pas le crissement d'asphalte d'un film
  policier urbain)

## Problèmes connus / à faire

Aucun signalé par Antoine. C'est une scène `suitChemin` (mobile) — elle
reste donc exclue du contrôle de collision automatique
(`build/collisions.mjs` ne vérifie que les scènes statiques) et exclue du
mécanisme d'arrêt du cerf (voir `../systemes/camera-drone.md`), pour la
même raison que le T-Rex : l'arrêter la laisserait s'éloigner dans le
vide pendant que le cerf ne bouge plus.

## Idées non explorées

- Une vraie trace de pneus persistante dans la neige derrière les
  véhicules (comme les empreintes du cerf, voir
  `../systemes/cerf-et-empreintes.md`) — évalué et écarté cette session :
  le système `Empreintes` actuel suppose une seule forme de tampon fixe
  (le sabot), et une bande qui suit un véhicule en mouvement continu sur
  toute la longueur du parcours n'aurait pas pu réutiliser cette fenêtre
  glissante sans une refonte plus large que ce que cette passe visait.
- Un dialogue radio (crachotement) synchronisé à l'embardée — le canal
  `emettre('derapage')` existe déjà et pourrait porter un second
  événement dédié si une future session veut l'ajouter.
