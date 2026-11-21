// Rend des SVG en PNG : node render.js file.svg out.png width
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const jobs = [];
  for (let i = 2; i < process.argv.length; i += 3) jobs.push(process.argv.slice(i, i + 3));
  for (const [svg, png, w] of jobs) {
    const src = fs.readFileSync(svg, 'utf8');
    const vb = src.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const W = +w, H = Math.round(W * vb[3] / vb[2]);
    const p = await b.newPage({ viewport: { width: W, height: H } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${W}" height="${H}" `)}</body></html>`);
    await p.screenshot({ path: png, omitBackground: true });
    await p.close();
  }
  await b.close();
})();
