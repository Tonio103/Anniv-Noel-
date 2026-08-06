/* Assemble l'experience en un seul fichier HTML autonome.
   three.js, tous les modules et le CSS sont inlines : aucune requete reseau
   au moment de l'ouverture, ce qui est indispensable puisque le resultat
   final vit a l'interieur d'un payload chiffre. */

import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');

export async function build() {
  const bundle = await esbuild.build({
    entryPoints: [join(root, 'src/main.js')],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    minify: !dev,
    sourcemap: false,
    legalComments: 'none',
    loader: { '.glsl': 'text' },
    define: { __DEV__: String(dev) },
    write: false,
  });

  const js = bundle.outputFiles[0].text;
  const css = await readFile(join(root, 'src/styles.css'), 'utf8');
  const shell = await readFile(join(root, 'src/shell.html'), 'utf8');

  // Une balise </script> dans une chaine JS refermerait le bloc trop tot.
  const safeJs = js.replace(/<\/script>/gi, '<\\/script>');

  const html = shell
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => safeJs);

  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist/experience.html'), html);
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const html = await build();
  const kb = (n) => (n / 1024).toFixed(1) + ' Ko';
  console.log(`dist/experience.html — ${kb(Buffer.byteLength(html))}`);
}
