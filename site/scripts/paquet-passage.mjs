// Réunit les 40 images d'un passage en un seul fichier : un téléchargement au lieu de quarante.
// Usage : node scripts/paquet-passage.mjs <dossier des images> <d|m> <fichier de sortie>
// Format : nombre d'images (uint32, petit-boutiste), la taille de chacune (uint32), puis les images WebP bout à bout.
// Il est relu par src/passages.ts.
import fs from 'node:fs';
import path from 'node:path';

const [dir, prefix, out] = process.argv.slice(2);
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith(`${prefix}-`) && f.endsWith('.webp'))
  .sort();
if (!files.length) throw new Error(`Aucune image ${prefix}-*.webp dans ${dir}`);
const images = files.map((f) => fs.readFileSync(path.join(dir, f)));
const head = Buffer.alloc(4 + 4 * images.length);
head.writeUInt32LE(images.length, 0);
images.forEach((b, i) => head.writeUInt32LE(b.length, 4 + 4 * i));
fs.writeFileSync(out, Buffer.concat([head, ...images]));
