# Le T-Rex ne se voit toujours pas bien, et traverse les arbres

Plainte d'Antoine, telle quelle : « de loin c'est le T-Rex on voit toujours
pas », « il va dans les arbres ». Non corrigé cette session sur consigne
explicite. Voir aussi `../apparitions/trex.md` pour le reste de la fiche
sur cette apparition (son, empreintes...) — ce fichier-ci se concentre sur
le problème de VISIBILITÉ précisément, parce qu'il a déjà été « corrigé »
une fois cette année et qu'il faut comprendre pourquoi ça n'a pas suffi.

## Fichiers concernés

- `src/world/apparitions.js` — fonction `jurassique(chemin, relief, palier)`
  (construit la scène, positionne la « voie » du théropode)
- `src/world/trex.js` — `creerTrex(palier)` (le corps), `marcheTrex(...)`
  (la démarche)

## Ce qui a déjà été tenté (sessions précédentes)

Le code contient une longue trace écrite de la première correction : la
voie était à 22 m du chemin (trop loin, l'animal passait à plus de 30° de
l'axe de la caméra, donc quasi jamais dans le champ), ramenée à 13 m puis à
9 m (voir `VOIE` dans `trex.js` et les commentaires dans `jurassique()`).
Les yeux ont aussi été agrandis et éclaircis pour se voir de loin dans le
sous-bois. Cette correction a été **mesurée** (script de diagnostic dédié à
l'époque, plus la caméra réelle simulée), donc le rapprochement en lui-même
est réel et vérifié — mais visiblement pas suffisant pour Antoine.

## Hypothèses à vérifier en premier (non testées cette session)

- **« De loin »** : la scène est délibérément conçue pour se voir *entre les
  troncs*, jamais entièrement dégagée — c'est écrit dans le commentaire
  d'en-tête de `jurassique()` (« il ne résiste jamais à l'examen »). Le
  choix artistique et la plainte d'Antoine sont peut-être simplement
  **contradictoires** : si on veut qu'il se voie clairement, il faut sans
  doute abandonner l'idée du « Jurassic Park caché dans les arbres » et le
  rapprocher encore, quitte à ce qu'il soit plus dégagé.
- **« Il va dans les arbres »** — à lire au sens propre : le théropode
  suit une « voie » calée sur la tangente du chemin, indépendante de
  l'emplacement réel des sapins (semés au hasard, voir `forest.js`). Rien
  dans le code ne vérifie que la trajectoire du T-Rex ne traverse pas
  visuellement un tronc — contrairement aux scènes statiques, qui ont
  chacune une zone dégagée d'arbres autour d'elles (`degage`, vérifié par
  `build/collisions.mjs`). Une scène mobile est explicitement **exclue**
  de cette vérification (voir le commentaire dans `collisions.mjs` :
  « les scènes mobiles ne se vérifient pas ainsi »). Concrètement : **il
  n'existe aujourd'hui aucune garantie que le T-Rex ne clipe pas à travers
  un sapin pendant sa marche.** C'est très probablement exactement ce
  qu'Antoine a vu.

## Pistes, non vérifiées

- Écrire un vrai contrôle de collision pour les scènes mobiles : échantillonner
  la position du T-Rex tout au long de sa marche simulée (comme le fait déjà
  `build/apparitions.mjs` pour trouver le meilleur instant de capture) et
  vérifier la distance aux troncs les plus proches sur cet intervalle, pas
  seulement à l'ancrage.
- Envisager de creuser une vraie « clairière mobile » : un couloir dégagé
  d'arbres le long de la voie du T-Rex plutôt qu'un semis complètement
  indifférent à son passage.
- Reconsidérer le parti pris artistique lui-même (vu de loin, à travers les
  arbres) à la lumière du retour d'Antoine — ce n'est peut-être pas un bug à
  corriger mais une intention à changer.
