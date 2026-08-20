# Le T-Rex ne fait pas de bruit de pas — note obsolète, corrigée ci-dessous

Plainte d'Antoine, telle quelle : « y a pas de bruit ». Cette fiche
affirmait qu'aucune méthode `pas(nom)` n'existait dans
`apparitionsSon.js` et que le signal émis par la scène (`g.userData.
emettre?.('pas')`) tombait donc dans le vide. **Ce n'est plus vrai** : une
relecture complète du fichier son cette session (voir
`notes/son/README.md` et le reste de `notes/son/`) a trouvé `pas(nom)`
bel et bien défini dans `apparitionsSon.js` (un impact grave qui tombe de
62 à 15 Hz, plus un craquement de neige tassée) — la méthode a
manifestement été écrite entre le moment où cette fiche a été rédigée et
maintenant, sans que la fiche elle-même n'ait été mise à jour.

Le déclenchement côté scène (`jurassique.js`, dans `if (neuf) { ... if (u
> 0.02) g.userData.emettre?.('pas'); }`) est resté inchangé et fonctionne
donc désormais de bout en bout : le signal existe, la méthode existe, le
son se joue.

## Ce qui restait réellement à corriger cette session

Le vrai trou n'était pas le SON du pas, mais sa contrepartie VISUELLE :
le théropode ne laissait aucune empreinte dans la neige (voir
`notes/son/empreintes-trex.md`, également corrigée). Les deux sont
maintenant déclenchés au même instant, dans le même bloc `if (neuf)` de
`jurassique.js` — l'image et le son du pas ne peuvent donc plus dériver
l'un de l'autre, puisqu'ils partagent la même horloge.

## Fichiers concernés

- `src/world/apparitions/jurassique.js` — `jurassique(...)`
- `src/audio/apparitionsSon.js` — `pas(nom)` (méthode existante, non
  modifiée cette session)

## Leçon pour la suite

Une fiche de notes qui affirme qu'une fonction « n'existe pas » doit être
revérifiée avant d'être prise pour argent comptant, surtout si son
horodatage est incertain — le code a continué d'évoluer après coup. C'est
exactement ce que la tâche de cette session demandait explicitement de
faire avant d'agir.
