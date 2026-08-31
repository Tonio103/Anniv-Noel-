# Harry Potter — le patronus

## État actuel

Un cerf de lumière bondit à travers la clairière ; Harry, baguette tendue,
est planté là où il surgit (« rien ne dit QUI l'a fait naître » sans lui).
Deux correctifs majeurs cette session :

1. Harry a été ajouté (il manquait complètement — le sort n'avait pas de
   lanceur).
2. Le cerf de lumière, jusque-là trois capsules + deux éventails de
   baguettes pour les bois, **réutilise maintenant le vrai maillage lisse
   du cerf réel** (`creerCerf`, extrait du même champ implicite), rendu en
   lumière additive plutôt qu'en pelage — bien plus beau, vérifié par
   capture réelle (silhouette nette, bois détaillés).

## Fichiers concernés

- `src/world/apparitions.js` — `patronus(palier)`, `sorcierPatronus(palier)`,
  `cerfDeLumiere(palier)`, `teinteHarry(...)`
- `src/deer/deerMesh.js` — `creerCerf(palier)` (réutilisé, pas dupliqué)

## Problèmes connus / à faire

Aucun signalé depuis la reconstruction du corps.

## Idées non explorées

Le corps repris n'anime pas sa foulée (il garde la pose de liaison pendant
tout le bond) — seul le groupe entier rebondit. Un vrai cycle de galop
emprunté à `deerRig.js` n'a pas été tenté (jugé hors de portée raisonnable
pour un fantôme qu'on voit surtout en mouvement d'ensemble).
