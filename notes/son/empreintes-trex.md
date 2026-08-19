# Le T-Rex ne laisse pas d'empreintes — corrigé cette session

Plainte d'Antoine, telle quelle : « y a pas d'empreinte de pas ». Le cerf,
lui, en laisse — donc la plainte visait le T-Rex, qui n'en laissait
aucune. Le diagnostic ci-dessous (rédigé une session plus tôt, non
corrigé alors « sur consigne explicite ») reste exact ; seule la
conclusion change : c'est fait.

## Diagnostic (toujours valable)

`Empreintes` (`src/world/footprints.js`) est un système générique — une
seule instance globale, créée dans `main.js` — mais un seul appelant
existait dans tout le code : la boucle qui traite les posers de sabot du
cerf. Rien dans `jurassique()` n'appelait jamais `empreintes.ajouter()`
pour les pieds du théropode.

Un second problème, identifié dans cette fiche AVANT d'être vérifié, s'est
confirmé à la lecture du code : le tampon existant (`tamponSabot`) est
peint une fois pour toutes sous la forme d'un sabot fourchu de cervide — y
poser la patte d'un théropode de plusieurs tonnes aurait laissé une trace
de sabot géante, fausse dans sa forme autant que dans son échelle. Il a
donc fallu étendre le système, pas seulement l'appeler.

## Ce qui a été fait

1. **Un second tampon**, `tamponTrex()` dans `footprints.js` : trois
   griffes en éventail depuis un talon commun (au lieu des deux onglons en
   V du cerf), et un talon bien plus massif — un pied digitigrade de
   plusieurs tonnes s'enfonce sur toute sa longueur, pas seulement à
   l'arrière comme un sabot léger.
2. **`Empreintes.ajouter(x, z, angle, force, type)`** accepte désormais un
   cinquième paramètre `type` (`'sabot'` par défaut, `'trex'` pour le
   théropode). Chaque maille de la réserve de tampons porte déjà sa PROPRE
   instance de matériau (jamais partagée) : lui faire changer de `map` à
   la demande, image par image, ne touche jamais les autres pas en
   attente. La taille de base suit aussi le type — un pied de théropode
   fait plus de soixante-dix centimètres, un rapport qu'aucun réglage de
   `force` seul n'aurait pu produire sans devenir absurde pour le cerf.
3. **`jurassique()` accepte un nouveau paramètre `deposerEmpreinte`**, une
   fermeture construite dans `Apparitions` (voir `index.js`,
   `brancherEmpreintes`) qui lit `this.empreintes` À L'APPEL et non à la
   construction — nécessaire parce que `Empreintes` est construite APRÈS
   les apparitions dans `main.js`, donc la référence n'existe pas encore
   au moment où `FABRIQUES.trex` capture la fermeture.
4. **Le déclenchement réutilise l'horloge du pas déjà existante** (le même
   bloc `if (neuf)` qui joue le son `'pas'`) plutôt qu'une horloge séparée
   — image, son et empreinte ne peuvent donc jamais dériver les uns des
   autres. La parité de `numero` dit sans ambiguïté quel pied
   (`os.piedD`/`os.piedG`) vient de se poser, parce que `marcheTrex`
   alterne les deux pattes sur exactement le même demi-tour de phase (voir
   `trex.js` : `dec=0` pour D, `dec=Math.PI` pour G). La position déposée
   est la VRAIE position monde du pied (`updateWorldMatrix` +
   `getWorldPosition` sur le bone), pas une approximation depuis le centre
   de la bête — à neuf mètres de voie et avec le roulis du bassin, les
   deux pattes ne sont jamais à la même distance du chemin.

## Fichiers concernés

- `src/world/footprints.js` — `tamponTrex()` (nouveau), `Empreintes`
  (réserve à deux textures, `ajouter(...,type)`, taille par type)
- `src/world/apparitions/index.js` — `Apparitions.brancherEmpreintes(...)`,
  la fermeture `deposerEmpreinte`
- `src/main.js` — `apparitions.brancherEmpreintes(empreintes)`, juste
  après la construction d'`Empreintes`
- `src/world/apparitions/jurassique.js` — `jurassique(chemin, relief,
  palier, deposerEmpreinte)`

## Vérifié

Marche complète simulée (`build/parcours.mjs`) : zéro erreur avec le
nouveau code branché de bout en bout — la fermeture tardive
(`Apparitions` construite avant `Empreintes`) ne casse rien.

## Idées non explorées

- Les empreintes du T-Rex ne varient pas leur profondeur avec le poids
  apparent du pas (l'appui est toujours pareil dans `marcheTrex`) — un
  raffinement possible mais non tenté, la variation naturelle de `alea`
  suffit déjà à casser l'effet de tampon répété.
