# T-Rex (Jurassic Park)

## État actuel

Un théropode qui marche derrière la ligne d'arbres, sur sa propre « voie »
loin du chemin — visible entre les troncs par intention artistique
(« il ne résiste jamais à l'examen »), pas entièrement dégagé. Plusieurs
correctifs déjà passés (voie rapprochée de 22 m à 9 m, yeux agrandis et
éclaircis). **C'est la seule apparition avec trois plaintes actives non
corrigées** — voir les fiches dédiées, plus détaillées qu'une fiche
normale :

- [`../visuel/trex-visibilite.md`](../visuel/trex-visibilite.md) — « on le
  voit toujours pas », « il va dans les arbres »
- [`../son/empreintes-trex.md`](../son/empreintes-trex.md) — pas
  d'empreintes
- [`../son/bruits-trex.md`](../son/bruits-trex.md) — pas de bruit de pas

## Fichiers concernés

- `src/world/apparitions.js` — `jurassique(chemin, relief, palier)`
- `src/world/trex.js` — `creerTrex(palier)`, `marcheTrex(...)`

## Problèmes connus / à faire

Voir les trois fiches ci-dessus. Résumé : c'est une scène mobile
(`suitChemin`), donc exclue à la fois du contrôle de collision automatique
et du nouveau mécanisme d'arrêt du cerf — les deux systèmes ne savent gérer
qu'une scène qui reste sur place.

## Idées non explorées

Reconsidérer le parti pris « vu de loin, à travers les arbres » lui-même :
c'est peut-être ce choix artistique, plus que l'exécution, qui déçoit —
voir la discussion dans `../visuel/trex-visibilite.md`.
