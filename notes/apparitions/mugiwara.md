# Luffy — One Piece

## État actuel

Ajoutée cette session, sur demande explicite (« je veux one piece »,
et que ce ne soit pas une référence cinéma). Luffy, chapeau de paille,
envoie un poing élastique qui s'étire jusqu'à la caméra (« Gomu Gomu no
Pistol »). Vérifiée visuellement (capture réelle, pas reconstruite) : le
bras se lit clairement en diagonale dans le cadre au pic du mouvement.

## Fichiers concernés

- `src/world/apparitions.js` — `mugiwara(palier)`, `chapeauPaille()`,
  `busteElastique(couleur)`, `tendreElastique(el, origine, cible)`,
  `teinteLuffy(...)`

## Comment marche le bras élastique

Ce n'est **pas** un os étiré (déformerait affreusement la peau skinnée
implicite) : c'est un cylindre séparé (`busteElastique`), redimensionné et
réorienté chaque image via `tendreElastique(el, origine, cible)` pour
relier un point fixe près de l'épaule à un poing qui s'éloigne selon une
courbe (`sin`) le temps du coup. Réutilisable tel quel si une autre scène
avait besoin d'un membre qui s'étire.

## Problèmes connus / à faire

Fenêtre de scène courte (8 m avant, 5 m après — glissée dans l'intervalle
entre spider1 et killbill), donc peu de marge de manœuvre si on veut
l'allonger sans toucher aux scènes voisines.

## Idées non explorées

Un deuxième temps (le poing qui revient en frappant quelque chose,
gerbe de neige à l'impact) n'a pas été tenté.
