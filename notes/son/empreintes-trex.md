# Le T-Rex ne laisse pas d'empreintes

Plainte d'Antoine, telle quelle : « y a pas d'empreinte de pas ». Le cerf,
lui, en laisse (visible dans toutes les captures d'écran de cette session) —
donc la plainte vise très probablement le T-Rex, qui n'en laisse aucune.
Non corrigé cette session sur consigne explicite.

## Fichiers concernés

- `src/world/footprints.js` — `class Empreintes`, notamment `ajouter(x, z,
  rotation, force)`
- `src/main.js` — ligne ~153 (`const empreintes = new Empreintes(...)`),
  ligne ~766 (seul appel à `empreintes.ajouter(...)`, dans la boucle du pas
  de simulation, alimenté par les poses du cerf)
- `src/world/apparitions.js` — `jurassique(chemin, relief, palier)`, et
  `src/world/trex.js` — `marcheTrex(...)` (la démarche, qui doit déjà savoir
  quand chaque patte touche le sol puisque c'est ce qui anime la marche)

## Diagnostic

`Empreintes` est un système générique (une seule instance globale,
`empreintes`, créée dans `main.js`) : n'importe qui peut lui dire
« pose une trace ici ». Mais dans tout le code, un seul appelant existe :
la boucle qui traite `cerf.posers` (les instants où un sabot touche le sol,
calculés par le rig du cerf) et appelle `empreintes.ajouter(...)` pour
chacun. **Rien dans `jurassique()` ou `marcheTrex()` n'appelle jamais
`empreintes.ajouter()` pour les pieds du théropode.** Ce n'est pas un bug
subtil — la fonctionnalité pour le T-Rex n'a simplement jamais été écrite.

## Pistes, non vérifiées

- Il faut d'abord savoir si `marcheTrex()` expose (ou peut exposer) les
  instants de pose de pied, comme le rig du cerf le fait via `cerf.posers` —
  sinon il faut d'abord ajouter cette détection au cycle de marche du
  théropode.
- Une fois les instants connus, appeler `empreintes.ajouter(x, z, rotation,
  force)` pour chaque pied, avec une `force` sans doute plus grande que
  celle du cerf (un théropode pèse infiniment plus lourd) — voir comment
  `force` influence la profondeur/la taille de l'empreinte dans
  `footprints.js` avant de choisir une valeur.
- Vérifier que le système supporte une empreinte de forme différente
  (le cerf laisse une trace de sabot fourchu ; un théropode laisse une
  empreinte tridactyle, bien plus grande) — si `Empreintes` suppose une
  seule forme fixe, il faudra l'étendre plutôt que de simplement l'appeler
  tel quel.
