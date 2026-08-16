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

    const cible = ap.s - ap.avant * 0.45;
    s.cerf.s = cible;
    s.cerf.placer(cible);
    s.drone.poser(s.cerf, s.boucle.t);
    for (let i = 0; i < 90; i++) {
      s.cerf.placer(cible);
      s.drone.maj(1 / 60, s.boucle.t, s.cerf);
      s.relief.maj(s.camera, s.ciel.actuel);
      s.foret.maj(s.camera);
      s.apparitions.maj(1 / 60, s.boucle.t + i / 60, cible, s.camera);
      void 0;
    }
    s.boucle.pause();

    // Est-elle effectivement dans le champ de la camera ?
    const o = s.apparitions.scenes.find((x) => x.nom === ap.nom).objet;
    s.camera.updateMatrixWorld();
    const fr = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(s.camera.projectionMatrix, s.camera.matrixWorldInverse));
    const b = new THREE.Box3().setFromObject(o);
    const centre = b.getCenter(new THREE.Vector3());
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
    /* OU, PRECISEMENT, DANS LE CADRE ? « Dans le champ » est une reponse par
       oui ou par non, et elle ne dit rien de la MARGE : une apparition qui
       frole le bord passe le test et se rate a l'oeil. On releve donc la
       position normalisee du centre — zero au milieu, un sur chaque bord. */
    const p = centre.clone().project(s.camera);
    return {
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
  console.log(`  ${marque.padEnd(4)} ${a.nom.padEnd(9)} a ${String(etat.distance).padStart(5)} m · centre a l'ecran x=${String(etat.x).padStart(5)} y=${String(etat.y).padStart(5)}`);
}
await nav.close();
