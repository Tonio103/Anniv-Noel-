# Retour vers le futur — la DeLorean

## État actuel

Une DeLorean qui arrive de loin, accélère, traînées de feu, disparaît dans
un éclair. Corrigée une fois pour qu'elle ne roule plus sur l'axe exact du
cerf (elle partageait sa ligne). Placée volontairement tout près de la fin
du parcours (« on garde le traîneau et la DeLorean pour la fin, quand on
approche de la clairière de Noël »).

## Fichiers concernés

- `src/world/apparitions.js` — `traineesDeFeu(longueur, palier, relief)`
- `src/world/vehicules.js` — `delorean()` (le véhicule lui-même)

## Problèmes connus / à faire

**N'obtient jamais l'arrêt du cerf**, contrairement à la plupart des
autres scènes — pas un bug, une conséquence de sa position : sa fenêtre
s'ouvre à `s ≈ 583`, juste avant la dernière halte-cadeau (`s ≈ 599`), et
son propre déclenchement d'arrêt tomberait à `s ≈ 615` — **après** que la
dernière halte a fini sa séquence, qui bascule directement en `PHASES.FIN`
(la fin choisie de l'expérience) plutôt que de revenir en marche normale.
Le mécanisme d'arrêt (`cadrageBase` dans `Apparitions.maj()`) est donc
`null` à ce moment-là et la scène joue en simple défilé, comme avant cette
session. Vérifié par une marche réelle complète : l'expérience se termine
correctement, rien n'est cassé — juste que cette scène-là ne profite pas du
nouveau traitement cinématique.

## Idées non explorées

Si on veut vraiment un arrêt sur la DeLorean, il faudrait soit la
rapprocher nettement de son ancrage actuel (risque de la coller trop près
de la dernière halte), soit repenser la toute fin pour laisser une marche
normale entre la dernière halte et la scène — pas tenté, parce que ça
toucherait à une séquence de fin déjà très chorégraphiée (voir
`../systemes/camera-drone.md`).
