# Spider-Man — suspendu à un fil

## État actuel

Spider-Man suspendu par un fil à une branche, un tronc complet construit
autour de lui (pas juste une touffe) pour que l'accroche se lise bien.
La physique du pivot a été corrigée cette session-ci en amont (le fil
tournait autour du sol plutôt que de son point d'attache) — plus de
plainte dessus depuis.

## Fichiers concernés

- `src/world/apparitions.js` — `spiderSuspendu(palier)`, `troncAccroche()`,
  `touffeExtremite()`
- `src/world/spider.js` — `creerSpider(palier, opts)`, `POSES` (le corps
  générique, réutilisé aussi par `spider2`)

## Problèmes connus / à faire

Aucun signalé cette session.

## Idées non explorées

Rien d'identifié.
