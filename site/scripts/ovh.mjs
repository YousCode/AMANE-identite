// Prépare dist-ovh/ : le contenu exact du dossier www/ de l'hébergement OVH.
// = le site construit (dist/) + la configuration Apache + le formulaire en PHP.
// Lancé par `npm run ovh`, après `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ovh = path.join(root, 'ovh');
const out = path.join(root, 'dist-ovh');

const must = (p, what) => {
  if (!fs.existsSync(p)) throw new Error(`OVH : ${what} introuvable (${path.relative(root, p)})`);
};
must(path.join(dist, 'index.html'), 'le site construit — lancer `npm run build` avant');
must(path.join(ovh, '.htaccess'), 'la configuration Apache');
must(path.join(ovh, 'api', 'lead.php'), 'le formulaire PHP');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(dist, out, { recursive: true });
fs.copyFileSync(path.join(ovh, '.htaccess'), path.join(out, '.htaccess'));
fs.cpSync(path.join(ovh, 'api'), path.join(out, 'api'), { recursive: true });

// Le modèle de configuration et les secrets ne doivent jamais se retrouver dans www/.
const interdits = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/config|\.env|\.map$/i.test(f) && f !== '.htaccess') interdits.push(path.relative(out, p));
  }
};
walk(out);
if (interdits.length) throw new Error('OVH : fichiers à ne pas publier dans www/ : ' + interdits.join(', '));

let n = 0;
let octets = 0;
const count = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) count(p);
    else {
      n++;
      octets += s.size;
    }
  }
};
count(out);
console.log(`dist-ovh/ prêt pour www/ : ${n} fichiers, ${(octets / 1048576).toFixed(1)} Mo`);
