/* LES APPARITIONS SE VOIENT-ELLES VRAIMENT ?

   Une apparition qui se declenche hors du champ, derriere la camera ou
   masquee par un tronc, n'existe pas. On ne se contente donc pas de verifier
   qu'elle s'allume : on se place au MILIEU de sa fenetre, on regarde la
   scene comme le drone la montre, et on photographie. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'] });
/* LE FORMAT DU TELEPHONE, PAS CELUI DE MON ECRAN.

   Antoine regarde cela en portrait sur un iPhone. En paysage large, le ciel
   occupe le haut du cadre et tout y tient ; en portrait, le drone pique
   vers le cerf et il ne reste qu'un bandeau de ciel — la silhouette d'E.T.
   frolait le bord haut sans que j'en sache rien. On cadre donc comme lui. */
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen',
                { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 180000 });
// Sans ce clic, l'ecran d'entree reste pose sur toute l'image et l'on
// photographie le titre au lieu de la scene.
await page.click('#enterBtn');
await page.waitForTimeout(400);

const liste = await page.evaluate(() => window.__scene.apparitions.scenes.map(
  (x) => ({ nom: x.nom, s: +x.s.toFixed(1), avant: x.avant, apres: x.apres })));
console.log(liste.map((x) => `${x.nom} @ s=${x.s}`).join('  ·  '));

for (const a of liste) {
  const etat = await page.evaluate((ap) => {
    const s = window.__scene, THREE = window.__THREE;
    /* ON NE FAIT PAS MARCHER LA BALADE JUSQUE-LA : elle s'arrete a chaque
       halte et attend un geste qui ne vient pas, si bien que le cerf
       n'atteint jamais les distances lointaines. On place donc le cerf a
       l'abscisse voulue, on pose la camera derriere lui, et on met le monde
       a jour a la main — terrain et foret compris, sans quoi on photographie
       un sol qui n'a pas encore ete charge. */
    // On se place en pleine approche, la ou la scene doit se voir.
    /* La cinematique d'ouverture epingle la camera sur son plan : tant
       qu'elle joue, `drone.maj` ignore le cerf et tout placement manuel est
       sans effet. On la laisse donc se terminer avant de cadrer. */
    let secours = 0;
    while (s.drone.enCinematique && secours++ < 900) s.simuler(1 / 60);

    /* UNE HORLOGE A NOUS, ET C'EST INDISPENSABLE.

       Le drone porte un tremblement de main levee pilote par le temps. Ce
       banc lui passait `s.boucle.t` — l'heure qu'il etait au chargement de
       la page, donc une valeur differente a chaque execution, et de surcroit
       FIGEE pendant les quatre-vingt-dix images de convergence. Resultat :
       le meme decor, mesure deux fois de suite, donnait des positions a
       l'ecran ecartees de presque un demi-cadre — et j'en avais tire une
       conclusion sur un pretendu decentrage du drone qui n'existait pas.

       Une horloge fixe, qui avance d'un soixantieme par image, rend le banc
       reproductible. Sans reproductibilite, aucun reglage de cadrage ne veut
       rien dire. */
    const T0 = 120;
    /* LES SCENES QUI SUIVENT LE CHEMIN NE SE TESTENT PAS AU MEME POINT.

       « cible = s - avant*0.45 » suppose une scene POSEE une fois pour
       toutes, dont on regarde le milieu de fenetre. Une voiture de police ou
       un theropode, eux, ont leur PROPRE horaire a l'interieur de cette
       fenetre — `coursePoursuite` et `jurassique` placent le vehicule a une
       abscisse qui depend de `k`, une progression seconde, non lineaire par
       rapport a `u`. Au milieu de fenetre choisi ici, `k` peut tres bien
       valoir un instant ou la voiture est encore a trente metres DERRIERE
       le cerf — donc derriere la camera, qui regarde devant. Le test
       donnait alors des coordonnees ecran absurdes, non pas parce que la
       scene est fausse, mais parce que l'instant choisi ne l'est pas.

       Pour ces scenes-la, on BALAYE toute la fenetre et on retient l'instant
       ou l'objet est le plus proche de la camera : c'est necessairement la
       ou le passage doit se voir, quelle que soit la loi de mouvement
       interne. */
    const o0 = s.apparitions.scenes.find((x) => x.nom === ap.nom).objet;
    const mobile = !!o0.userData.suitChemin;
    const bornage = mobile
      ? Array.from({ length: 25 }, (_, i) => -ap.avant + (ap.avant + ap.apres) * (i / 24))
      : [-ap.avant * 0.45];

    let meilleur = null;
    for (const decalage of bornage) {
      const cible = ap.s + decalage;
      s.cerf.s = cible;
      s.cerf.placer(cible);
      s.drone.poser(s.cerf, T0);
      for (let i = 0; i < (mobile ? 20 : 90); i++) {
        s.cerf.placer(cible);
        s.drone.maj(1 / 60, T0 + i / 60, s.cerf);
        s.relief.maj(s.camera, s.ciel.actuel);
        s.foret.maj(s.camera);
        s.apparitions.maj(1 / 60, T0 + i / 60, s.cerf, s.camera, null, null, null);
      }
      const o = s.apparitions.scenes.find((x) => x.nom === ap.nom).objet;
      s.camera.updateMatrixWorld();
      const ancrage = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      const d = s.camera.position.distanceTo(ancrage);
      /* UN ECHANTILLON INVISIBLE NE DOIT JAMAIS GAGNER FACE A UN VISIBLE,
         MEME PLUS LOIN — sans quoi le tout premier essai, tire au hasard des
         trois temps de la scene, peut s'installer en "meilleur" et ne plus
         jamais ceder la place a un instant ou l'on voit vraiment quelque
         chose. On ne compare les distances qu'entre echantillons de meme
         visibilite ; un visible bat toujours un invisible. */
      const mieux = !meilleur
        || (o.visible && !meilleur.visible)
        || (o.visible === meilleur.visible && d < meilleur.d);
      if (mieux) meilleur = { cible, d, visible: o.visible };
      if (!mobile) break;
    }
    s.boucle.pause();

    // On refait le meilleur instant pour la photo et la mesure finales.
    const cible = meilleur.cible;
    s.cerf.s = cible;
    s.cerf.placer(cible);
    s.drone.poser(s.cerf, T0);
    for (let i = 0; i < 90; i++) {
      s.cerf.placer(cible);
      s.drone.maj(1 / 60, T0 + i / 60, s.cerf);
      s.relief.maj(s.camera, s.ciel.actuel);
      s.foret.maj(s.camera);
      s.apparitions.maj(1 / 60, T0 + i / 60, cible, s.camera);
    }

    // Est-elle effectivement dans le champ de la camera ?
    const o = s.apparitions.scenes.find((x) => x.nom === ap.nom).objet;
    s.camera.updateMatrixWorld();
    const fr = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(s.camera.projectionMatrix, s.camera.matrixWorldInverse));
    const b = new THREE.Box3().setFromObject(o);
    const centre = b.getCenter(new THREE.Vector3());
    s.postfx.rendre(s.scene, s.camera, T0 + 1.5);
    /* OU, PRECISEMENT, DANS LE CADRE ? « Dans le champ » est une reponse par
       oui ou par non, et elle ne dit rien de la MARGE : une apparition qui
       frole le bord passe le test et se rate a l'oeil. On releve donc la
       position normalisee — zero au milieu, un sur chaque bord.

       ON MESURE LE POINT D'ANCRAGE, PAS LE CENTRE DE LA BOITE. La voiture de
       police porte deux faisceaux de vingt et un metres qui TOURNENT : le
       centre de sa boite englobante se promene d'une image a l'autre et
       donnait des releves incoherents pour un objet parfaitement immobile.
       L'ancrage, lui, est le sujet de la scene. */
    const ancrage = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    const p = ancrage.project(s.camera);
    return {
      mobile,
      visible: o.visible,
      dansLeChamp: o.visible ? fr.intersectsBox(b) : false,
      distance: +s.camera.position.distanceTo(centre).toFixed(1),
      x: +p.x.toFixed(2), y: +p.y.toFixed(2),
    };
  }, a);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(root, `shots/app-${a.nom}.png`) });
  const ok = etat.visible && etat.dansLeChamp;
  const centre = Math.abs(etat.x) < 0.75 && Math.abs(etat.y) < 0.85;
  const marque = !ok ? 'KO ' : centre ? 'OK ' : 'BORD';
  const suffixe = etat.mobile ? '  (mobile : meilleur instant du passage)' : '';
  console.log(`  ${marque.padEnd(4)} ${a.nom.padEnd(9)} a ${String(etat.distance).padStart(5)} m · centre a l'ecran x=${String(etat.x).padStart(5)} y=${String(etat.y).padStart(5)}${suffixe}`);
}
await nav.close();
