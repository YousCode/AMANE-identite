// Image de partage (1200 × 630) : logo principal sur bordeaux, motif Arcades ton sur ton.
// Usage ponctuel : node scripts/og.mjs   (Playwright requis, voir ../source)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const logo = fs.readFileSync(path.join(root, 'src/brand/logo-principal.svg'), 'utf8');
const motif = fs.readFileSync(path.join(root, 'public/img/arcades.svg'), 'utf8');
const html = `<body style="margin:0;width:1200px;height:630px;background:#5B1622;display:grid;place-items:center;position:relative;overflow:hidden">
<div style="position:absolute;inset:0;background:url('data:image/svg+xml,${encodeURIComponent(motif)}') center/200px auto;opacity:.6"></div>
<div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 70% at 50% 50%,transparent 30%,rgba(59,12,21,.7))"></div>
<div style="position:relative;width:430px;height:500px;background:#5B1622;border:1px solid rgba(184,149,92,.45);display:grid;place-items:center;color:#EFE7DA;outline:1px solid rgba(184,149,92,.45);outline-offset:-12px">
<div style="width:300px">${logo}</div></div></body>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html);
await p.screenshot({ path: path.join(root, 'public/og.jpg'), type: 'jpeg', quality: 88 });
await b.close();
console.log('public/og.jpg');
