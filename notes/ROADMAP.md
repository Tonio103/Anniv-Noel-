# Feuille de route — La forêt du cerf

Ce dossier existe pour une raison précise : Antoine a dit qu'il reviendrait
dans deux mois, avec un modèle d'IA plus capable, et qu'il voulait retrouver
un projet **préparé** plutôt que de tout re-découvrir depuis zéro. Chaque
fichier ici couvre un seul sujet, précisément, pour qu'une future session
puisse ouvrir *un* fichier et attaquer directement — pas relire tout
l'historique de conversation pour comprendre où on en est.

## Comment naviguer

```
notes/
  ROADMAP.md            ← vous êtes ici
  visuel/                 problèmes d'image/texte qui ne sont pas liés à une
                           apparition précise
  son/                     ce qui manque côté audio
  apparitions/             un fichier par créature/scène (14) : état, limites,
                           idées non explorées
  systemes/                les briques transverses (caméra, cerf, postfx,
                           terrain, audio, cadeaux) — comment elles marchent,
                           ce qu'on peut y brancher
```

Chaque fichier de `apparitions/` et `systemes/` suit à peu près le même
squelette : **État actuel** → **Fichiers concernés** → **Problèmes connus /
à faire** → **Idées non explorées**. Ce n'est pas rigide, juste une habitude
pour qu'on ne cherche jamais l'information au mauvais endroit.

## État global au moment de l'écriture

Le projet est un plan-séquence 3D unique (aucune coupe, aucun fondu) : un
cerf avance dans une forêt enneigée, un drone le suit, et quatorze apparitions
(références cinéma et culture ado) ponctuent le trajet entre les neuf haltes-
cadeaux. Tout est généré par code — aucun modèle, aucune texture, aucun son
chargés depuis l'extérieur — et le tout est chiffré dans `index.html`
(mot de passe jamais présent dans le dépôt, voir `README.md` à la racine).

Ce qui a été construit et vérifié cette session (build → marche complète
simulée → collisions → fuites sonores → intégrité du chiffré, à chaque fois
avant de committer) :

- La caméra tourne vers l'apparition active, et **le cerf s'arrête** pour
  chacune (sauf les scènes mobiles et celle trop proche de la fin — voir
  `systemes/camera-drone.md`) : un vrai plan composé, pas un simple
  croisement.
- Un choc caméra générique (secousse + resserrement de champ) branché sur
  le canal sonore existant de chaque scène.
- Un point-tiré de mise au point vers la scène tenue.
- Assombrissement d'écran (duel de sabres), teinte rouge + ascenseur de sang
  (Shining), distorsion chromatique (Gargantua).
- Deux nouvelles apparitions non-cinéma : Luffy (One Piece) et les
  hamburgers volants.
- Le patronus reprend le vrai maillage du cerf au lieu de capsules.

Ce qu'Antoine a signalé comme **pas encore au niveau**, dans ses mots :
« sur PC le texte est moche », « de loin c'est le T-Rex on voit toujours
pas », « il va dans les arbres », « y a pas d'empreinte de pas », « y a pas
de bruit ». Ces points sont détaillés dans `visuel/` et `son/`, avec un
diagnostic (pas juste la plainte reformulée) là où j'ai pu creuser sans
casser ce qui marche.

## Ce qui n'a **pas** été fait exprès, cette session

Sur consigne explicite d'Antoine (« juste que tu fasses et que tu crées
[...] pour préparer »), aucun correctif visuel n'a été tenté sur les points
ci-dessus : le travail demandé était de **documenter et structurer**, pas de
corriger avec le niveau actuel. Voir `visuel/` et `son/` pour le détail —
et ne pas hésiter à attaquer directement ces fichiers si une session future
a les moyens de mieux faire.

## Rappels qui ne doivent jamais sauter

- Les adresses des invités ne doivent **jamais** apparaître dans le dépôt —
  ni dans le code, ni dans ces notes, ni dans un message de commit. Elles ne
  circulent que par la variable d'environnement `NOEL_EMAILS`, au moment du
  chiffrement, et le fichier publié n'en contient ni la valeur ni l'empreinte
  (voir `build/encrypt.mjs`). Vérifier avant tout commit, la variable étant
  déjà exportée dans le shell :

  ```bash
  for a in ${NOEL_EMAILS//,/ }; do grep -c "$a" index.html; done   # tout à 0
  ```

  L'ancien mécanisme reposait sur un mot de passe partagé, et la consigne qui
  interdisait de l'écrire le citait elle-même en toutes lettres, deux fois,
  dans ce fichier versionné et poussé : quiconque pouvait lire le dépôt
  pouvait lire le code. La porte était grande ouverte à côté de la serrure.
  C'est ce qui a décidé du passage aux adresses — le mot de passe divulgué a
  cessé d'être une clé, ce qui a réglé la fuite sans réécrire l'historique.
  Une règle qui s'énonce en se violant ne protège rien.

  Ne pas se méprendre sur ce que cela protège : une adresse e-mail est un
  nom, pas un secret. C'est une porte qui dit « c'est pour toi », et elle
  suffit ici ; il ne faut pas lui en demander plus.
- Chaîne de vérification avant de committer : `build/build.mjs` →
  `build/parcours.mjs` → `build/collisions.mjs` → `build/sonApparitions.mjs`
  → `build/verifs.mjs` → `build/profil.mjs` → `encrypt.mjs` →
  `verifier.mjs` → grep de fuite. Les scripts de diagnostic jetables vont
  dans `build/_tmp_*.mjs` et se suppriment après usage.
- Seule une vraie marche pilotée par `s.simuler()` est fiable pour vérifier
  un cadrage caméra — une reconstruction synthétique de la pose caméra a
  produit des résultats trompeurs à plusieurs reprises.
- Développer sur la branche `claude/3d-deer-forest-experience-n2fjic` ;
  `main` a été fusionnée (fast-forward) avec cette branche le 19 août 2026,
  donc les deux sont alignées pour l'instant — mais tout nouveau travail
  doit repartir de la branche de développement, pas de `main` directement.
