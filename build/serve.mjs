/* Serveur de developpement : reconstruit a chaque rafraichissement et sert
   l'experience en clair, sans passer par le chiffrement. */

import { createServer } from 'node:http';
import { build } from './build.mjs';

const port = Number(process.env.PORT || 5173);

createServer(async (req, res) => {
  try {
    const html = await build();
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(html);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(err.stack || err));
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
