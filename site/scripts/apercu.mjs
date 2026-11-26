// Assemble l'aperçu autonome : une page (styles et script intégrés) + ses médias en chemins relatifs.
// Sert à montrer le site sans hébergement. Le formulaire n'y envoie rien : il n'y a pas de serveur.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist-apercu');
const assets = fs.readdirSync(path.join(dist, 'assets'));
const cssFile = assets.find((f) => f.endsWith('.css'));
const jsFiles = assets.filter((f) => f.endsWith('.js'));
if (!cssFile || jsFiles.length !== 1) throw new Error('Aperçu : un fichier CSS et un seul fichier JS attendus');

// Les adresses du CSS partaient de assets/ ; elles partent maintenant de la page.
const css = fs
  .readFileSync(path.join(dist, 'assets', cssFile), 'utf8')
  .replace(/url\((["']?)\.\.\//g, 'url($1')
  .replace(/url\((["']?)\.\//g, 'url($1assets/')
  .replace(/url\((["']?)(?!data:|assets\/|img\/|https?:)([\w-]+\.woff2?)/g, 'url($1assets/$2');
// Le script de garde (classe « js », rideau, filet de sécurité) vient de index.html : une seule source.
const guard = /<script>([\s\S]*?)<\/script>/.exec(fs.readFileSync(path.join(dist, 'index.html'), 'utf8'))?.[1];
if (!guard) throw new Error('Aperçu : script de garde introuvable dans index.html');
const js = fs.readFileSync(path.join(dist, 'assets', jsFiles[0]), 'utf8').replace(/<\/script/gi, '<\\/script');

const page = `<title>Amane</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#3B0C15">
<style>${css}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>
<script>${guard}</script>
<div id="root"></div>
<script type="module">${js}</script>
`;
fs.writeFileSync(path.join(dist, 'amane.html'), page);
for (const f of [cssFile, ...jsFiles, ...assets.filter((f) => f.endsWith('.woff'))])
  fs.rmSync(path.join(dist, 'assets', f));
fs.rmSync(path.join(dist, 'index.html'));

// Les passages sont des fichiers binaires, que l'aperçu ne peut pas héberger : les mêmes images, en JSON.
const passages = path.join(dist, 'passages');
for (const f of fs.existsSync(passages) ? fs.readdirSync(passages).filter((f) => f.endsWith('.bin')) : []) {
  const buf = fs.readFileSync(path.join(passages, f));
  const count = buf.readUInt32LE(0);
  let at = 4 + 4 * count;
  const images = [];
  for (let k = 0; k < count; k++) {
    const length = buf.readUInt32LE(4 + 4 * k);
    images.push(buf.subarray(at, at + length).toString('base64'));
    at += length;
  }
  fs.writeFileSync(path.join(passages, f.replace(/\.bin$/, '.json')), JSON.stringify(images));
  fs.rmSync(path.join(passages, f));
}

const files = [];
const walk = (d) =>
  fs.readdirSync(path.join(dist, d)).forEach((f) => {
    const rel = path.posix.join(d, f);
    if (fs.statSync(path.join(dist, rel)).isDirectory()) walk(rel);
    else if (rel !== 'amane.html') files.push(rel);
  });
walk('');
fs.writeFileSync(path.join(dist, 'fichiers.json'), JSON.stringify(files.filter((f) => f !== 'fichiers.json')));
console.log(`dist-apercu/amane.html ${(Buffer.byteLength(page) / 1024).toFixed(0)} Ko + ${files.length} fichiers`);
