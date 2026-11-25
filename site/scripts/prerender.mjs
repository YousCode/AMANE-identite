// Écrit une page HTML complète par langue (/, /en/, /es/, /ar/), le plan du site et robots.txt.
// Lancé par `npm run build`, après les builds client et serveur de Vite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

// Adresse publique du site. Elle sert aux balises canoniques, hreflang, au plan du site et à robots.txt :
// même un déploiement d'aperçu doit désigner le domaine officiel. SITE_URL permet de la remplacer (tests locaux).
const site = (process.env.SITE_URL || 'https://amane.paris').replace(/\/+$/, '');

const { render, LANGS, LANG_META } = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href);
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!template.includes('<!--app-->') || !template.includes('<!--head-->'))
  throw new Error('Gabarit index.html : repères absents');

for (const lang of LANGS) {
  const { html, head, dir } = render(lang, site);
  const page = template
    .replace('<html lang="fr" dir="ltr">', `<html lang="${lang}" dir="${dir}">`)
    .replace('<!--head-->', head)
    .replace('<!--app-->', html);
  const out = path.join(dist, LANG_META[lang].path, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page);
  console.log(`${LANG_META[lang].path.padEnd(5)} ${(Buffer.byteLength(page) / 1024).toFixed(1)} Ko`);
}

const today = new Date().toISOString().slice(0, 10);
const alternates = LANGS.map(
  (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${site + LANG_META[l].path}"/>`,
).join('\n');
fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map(
  (l) => `  <url>
    <loc>${site + LANG_META[l].path}</loc>
    <lastmod>${today}</lastmod>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${site}/"/>
  </url>`,
).join('\n')}
</urlset>
`,
);
fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`,
);
fs.rmSync(path.join(root, 'dist-ssr'), { recursive: true, force: true });
console.log('sitemap.xml, robots.txt → ' + site);
