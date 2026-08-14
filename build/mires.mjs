/* MIRES DE NON-REGRESSION VISUELLE.

   Antoine : « sans changer d'un poil la qualite et les graphismes ». Toute
   l'optimisation repose sur une promesse — memes arbres, memes matrices,
   memes materiaux, seul change le paquetage envoye a la carte graphique. Une
   promesse ne vaut rien tant qu'on ne l'a pas verifiee.

   On capture donc une serie d'images a des etats RIGOUREUSEMENT reproductibles
   (position imposee, temps simule a pas fixe, camera posee), avant et apres la
   modification, et on les compare pixel par pixel.

   Usage : node build/mires.mjs <prefixe> */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const prefixe = process.argv[2] || 'mire';
const q = process.env.Q || 'bas';

await build();
const nav = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + `?debug=1&q=${q}`,
                { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

/* Des points repartis sur tout le parcours, y compris un regard lateral :
   c'est de cote que le decoupage en bandes serait le plus visible s'il
   changeait quoi que ce soit. */
const etats = [
  { nom: 'route1', halte: 1, t: 2.0, lacet: 0 },
  { nom: 'route3', halte: 3, t: 2.0, lacet: 0 },
  { nom: 'cote3', halte: 3, t: 2.0, lacet: 1.15 },
  { nom: 'route5', halte: 5, t: 2.0, lacet: 0 },
  { nom: 'cote5', halte: 5, t: 2.0, lacet: -0.9 },
  { nom: 'route7', halte: 7, t: 2.0, lacet: 0 },
];

/* LA BOUCLE VIVANTE RUINAIT LA MESURE.

   Premiere version : on posait l'etat, on dessinait une image, puis on
   attendait six cents millisecondes que la capture se fasse. Pendant cette
   attente, la boucle d'animation continuait de tourner — neige, vent, ciel,
   tremblement de l'objectif, ressort de la camera — et la capture montrait
   une image quelconque, plusieurs dizaines de trames plus loin.

   Le controle est sans appel : DEUX CAPTURES DU MEME CODE differaient sur
   98 % des pixels, avec un ecart maximal de 243 sur 255. Autrement dit la
   comparaison avant/apres ne mesurait rien d'autre que le passage du temps.
   J'ai failli en conclure que l'optimisation changeait l'image.

   On arrete donc la boucle avant toute chose. Plus rien n'avance sans qu'on
   le demande, `simuler` fait avancer le temps a pas fixe, et l'image capturee
   est exactement celle qu'on a dessinee. */
await page.evaluate(() => window.__scene.boucle.pause());

for (const e of etats) {
  await page.evaluate((s0) => {
    const s = window.__scene;
    s.boucle.pause();
    /* ET SURTOUT : ON IMPOSE L'HORLOGE.

       Deuxieme controle, apres avoir mis la boucle en pause : toujours 96 %
       de pixels differents entre deux captures du meme code. La cause etait
       plus simple encore — `boucle.t` valait 0,98 s dans un essai et 2,12 s
       dans l'autre, parce que la boucle avait tourne pendant un temps
       indetermine entre le chargement de la page et le moment ou je
       l'arretais. Or c'est cette horloge qui pilote le vent, la neige, la
       teinte du ciel, le grain et le tremble de l'objectif : deux valeurs
       differentes donnent deux images entierement differentes.

       Une mesure de non-regression n'a de sens que si TOUT ce qui n'est pas
       l'objet de la mesure est identique. On repart donc d'une horloge
       fixee. */
    s.boucle.t = 500;
    /* La neige qui tombe reste, elle, irreproductible : ses particules sont
       tirees au hasard a la creation. Trois pour cent de pixels differents,
       tres contrastes — un flocon est blanc sur fond sombre. Ce n'est pas ce
       qu'on mesure ici, et ca masquerait un vrai ecart : on l'eteint pendant
       la comparaison. C'est l'instrument qu'on regle, pas la scene. */
    s.scene.traverse((o) => { if (o.isPoints) o.visible = false; });
    s.aller(s0.halte, 'route');
    s.cerf.vitesseCible = 0;
    s.simuler(s0.t);
    s.drone.poser(s.cerf, s.boucle.t);
    s.simuler(0.5);
    if (s0.lacet) {
      // Panoramique impose : la camera est figee puis pivotee a la main.
      s.drone.fige = true;
      s.camera.rotation.y += s0.lacet;
      s.camera.updateMatrixWorld();
    }
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
  }, e);
  await page.waitForTimeout(400);
  // Un dernier rendu juste avant la capture : rien n'a bouge entre-temps,
  // mais le tampon doit etre a jour au moment ou l'image est prise.
  await page.evaluate(() => {
    const s = window.__scene;
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
  });
  await page.screenshot({ path: join(root, `shots/${prefixe}-${e.nom}.png`) });
  console.log('  →', `${prefixe}-${e.nom}.png`);
}
await nav.close();
