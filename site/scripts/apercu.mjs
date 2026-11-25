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
const js = fs.readFileSync(path.join(dist, 'assets', jsFiles[0]), 'utf8').replace(/<\/script/gi, '<\\/script');

const page = `<title>Amane</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#3B0C15">
<style>${css}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>
<script>(function(h){h.classList.add('js');setTimeout(function(){if(!h.classList.contains('pret'))h.classList.remove('js')},7000)})(document.documentElement)</script>
<div id="root"></div>
<script type="module">${js}</script>
`;
fs.writeFileSync(path.join(dist, 'amane.html'), page);
for (const f of [cssFile, ...jsFiles, ...assets.filter((f) => f.endsWith('.woff'))])
  fs.rmSync(path.join(dist, 'assets', f));
fs.rmSync(path.join(dist, 'index.html'));

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
