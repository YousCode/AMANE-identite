// POST /api/lead — fonction serverless Vercel (Node 20+, ESM, sans dépendance).
// Reçoit le formulaire de demande, le transmet au CRM de la maison (si CRM_URL et
// CRM_SECRET sont renseignées) et envoie deux e-mails via Brevo.
// Toute la logique est dans _lib/lead-core.js ; ce fichier ne fait que lire
// la requête et écrire la réponse.

import { processLead } from './_lib/lead-core.js';

const TAILLE_MAX_CORPS = 16 * 1024; // 16 Ko

class ErreurCorps extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function repondre(res, status, json, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [nom, valeur] of Object.entries(headers || {})) res.setHeader(nom, valeur);
  res.end(JSON.stringify(json));
}

function premier(valeur) {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}

function octets(valeur) {
  return Buffer.byteLength(typeof valeur === 'string' || Buffer.isBuffer(valeur) ? valeur : JSON.stringify(valeur));
}

/** Lit le flux de la requête sans dépasser la limite, et sans couper la connexion. */
function lireFlux(req) {
  return new Promise((resolve, reject) => {
    const morceaux = [];
    let taille = 0;
    const fin = () => {
      nettoyer();
      resolve(Buffer.concat(morceaux).toString('utf8'));
    };
    const donnees = (morceau) => {
      const tampon = Buffer.isBuffer(morceau) ? morceau : Buffer.from(String(morceau));
      taille += tampon.length;
      if (taille > TAILLE_MAX_CORPS) {
        nettoyer();
        req.resume?.(); // on laisse le reste s'écouler sans le garder
        reject(new ErreurCorps(413, 'corps_trop_grand'));
        return;
      }
      morceaux.push(tampon);
    };
    const erreur = () => {
      nettoyer();
      reject(new ErreurCorps(400, 'corps_invalide'));
    };
    function nettoyer() {
      req.off('data', donnees);
      req.off('end', fin);
      req.off('error', erreur);
      req.off('aborted', erreur);
    }
    req.on('data', donnees);
    req.on('end', fin);
    req.on('error', erreur);
    req.on('aborted', erreur);
  });
}

/** Renvoie le corps : l'objet déjà décodé par Vercel s'il existe, sinon le texte brut lu sur le flux. */
async function lireCorps(req) {
  const annonce = Number(premier(req.headers?.['content-length']));
  if (Number.isFinite(annonce) && annonce > TAILLE_MAX_CORPS) throw new ErreurCorps(413, 'corps_trop_grand');

  let deja;
  try {
    deja = req.body; // sur Vercel, cet accesseur lève une erreur si le JSON est mal formé
  } catch {
    throw new ErreurCorps(400, 'corps_invalide');
  }
  if (deja !== undefined && deja !== null) {
    if (typeof deja !== 'object' && typeof deja !== 'string') throw new ErreurCorps(400, 'corps_invalide');
    if (octets(deja) > TAILLE_MAX_CORPS) throw new ErreurCorps(413, 'corps_trop_grand');
    return deja;
  }
  if (req.readableEnded || req.destroyed || typeof req.on !== 'function') return '';
  return lireFlux(req);
}

function ipDuVisiteur(req) {
  const h = req.headers || {};
  // Sur Vercel, x-real-ip et x-forwarded-for sont réécrits par la plateforme.
  const reelle = premier(h['x-real-ip']);
  if (reelle) return String(reelle).trim();
  const relais = premier(h['x-forwarded-for']);
  if (relais) return String(relais).split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return repondre(res, 405, { error: 'methode_non_autorisee' }, { Allow: 'POST' });
  }
  try {
    const body = await lireCorps(req);
    const resultat = await processLead({
      body,
      ip: ipDuVisiteur(req),
      origin: premier(req.headers?.origin),
      host: premier(req.headers?.host),
      env: process.env,
    });
    return repondre(res, resultat.status, resultat.json, resultat.headers);
  } catch (erreur) {
    if (erreur instanceof ErreurCorps) return repondre(res, erreur.status, { error: erreur.code });
    // Jamais le détail : il pourrait contenir un extrait de la demande.
    console.error(`[lead] erreur inattendue : ${erreur?.name || 'Error'}`);
    return repondre(res, 500, { error: 'erreur_interne' });
  }
}
