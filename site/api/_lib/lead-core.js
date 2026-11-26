// Logique de traitement d'une demande, sans dépendance à Vercel ni au réseau :
// tout ce qui vient de l'extérieur (corps, IP, en-têtes, variables d'environnement,
// fetch, horloge) est passé en argument, ce qui rend la fonction testable.
//
// processLead(...) renvoie { status, json } (et parfois { headers }) ; le handler
// api/lead.js se contente de transmettre.

import { createHmac } from 'node:crypto';

import { ackEmail, teamEmail, uneLigne, couper, idService, dateIso, passagersValides, LANGUES } from './emails.js';

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
export const DELAI_BREVO_MS = 8000;

// Lien avec le CRM de la maison : chaque demande y est aussi envoyée, de serveur
// à serveur, signée avec un secret partagé (voir « Lien avec le CRM » plus bas).
export const CRM_CHEMIN = '/api/lead';
export const DELAI_CRM_MS = 5000;
export const CRM_SECRET_MIN = 32; // en dessous, le CRM refuse toute signature

export const TAILLES = {
  nom: 120,
  email: 200,
  tel: 40,
  message: 4000,
};

// ---------------------------------------------------------------------------
// Limite de débit : 5 envois par heure et par IP.
//
// ATTENTION : c'est une protection « au mieux ». La Map vit dans la mémoire
// d'une instance de la fonction. En serverless, chaque instance a la sienne,
// et elle repart de zéro à chaque démarrage à froid : un visiteur peut donc
// dépasser 5 envois si ses requêtes tombent sur plusieurs instances. Cela
// suffit à freiner un robot naïf ; pour une vraie limite, il faudrait un
// stockage partagé (Vercel KV, Upstash…) ou le pare-feu de Vercel.
// ---------------------------------------------------------------------------
export const LIMITE_ENVOIS = 5;
export const LIMITE_FENETRE_MS = 60 * 60 * 1000;
const LIMITE_CLES_MAX = 5000;

/** @type {Map<string, number[]>} IP → horodatages des envois de la dernière heure */
const envoisParIp = new Map();

/** Réservé aux tests : vide le compteur de débit. */
export function _viderLimite() {
  envoisParIp.clear();
}

function purgerLimite(t) {
  for (const [cle, dates] of envoisParIp) {
    if (!dates.some((d) => t - d < LIMITE_FENETRE_MS)) envoisParIp.delete(cle);
  }
  // Toujours trop d'entrées : on retire les plus anciennes (ordre d'insertion).
  for (const cle of envoisParIp.keys()) {
    if (envoisParIp.size <= LIMITE_CLES_MAX) break;
    envoisParIp.delete(cle);
  }
}

/** Compte une tentative d'envoi. Renvoie 0 si elle est acceptée, sinon le nombre de secondes à attendre. */
function compterEnvoi(ip, t) {
  const cle = uneLigne(ip, 64).toLowerCase() || 'inconnue';
  const recents = (envoisParIp.get(cle) || []).filter((d) => t - d < LIMITE_FENETRE_MS);
  if (recents.length >= LIMITE_ENVOIS) {
    envoisParIp.set(cle, recents);
    return Math.max(1, Math.ceil((recents[0] + LIMITE_FENETRE_MS - t) / 1000));
  }
  recents.push(t);
  envoisParIp.set(cle, recents);
  if (envoisParIp.size > LIMITE_CLES_MAX) purgerLimite(t);
  return 0;
}

// ---------------------------------------------------------------------------
// Nettoyage et validation
// ---------------------------------------------------------------------------

/** Texte libre sur plusieurs lignes : on garde les retours à la ligne, rien d'autre d'invisible. */
function texteLibre(valeur, max) {
  if (typeof valeur === 'number' && Number.isFinite(valeur)) valeur = String(valeur);
  if (typeof valeur !== 'string') return '';
  const propre = valeur
    .replace(/\r\n?|[\v\f\u0085\u2028\u2029]/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[ ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return couper(propre, max).trim();
}

function langueValide(valeur) {
  const l = uneLigne(valeur, 16).toLowerCase().split(/[-_]/)[0];
  return LANGUES.includes(l) ? l : 'fr';
}

// Volontairement strict (ASCII) : l'adresse sert de replyTo et de destinataire,
// et une adresse que Brevo refuserait ferait échouer l'e-mail à l'équipe.
const RE_EMAIL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function emailValide(email) {
  if (typeof email !== 'string' || email.length > TAILLES.email) return false;
  if (!RE_EMAIL.test(email)) return false;
  return email.lastIndexOf('@') <= 64;
}

export function telValide(tel) {
  // \p{Nd} : chiffres de toutes les écritures (un client peut saisir ٠١٢٣…).
  return (String(tel).match(/\p{Nd}/gu) || []).length >= 8;
}

/**
 * Ramène le corps reçu aux champs connus, nettoyés et bornés.
 * service, date et passagers ne sont pas du texte libre : identifiant d'une
 * liste fermée, date AAAA-MM-JJ réelle, « 1 » à « 7 » ou « 8+ ».
 */
export function nettoyerDemande(donnees = {}) {
  return {
    nom: uneLigne(donnees.nom, TAILLES.nom),
    email: uneLigne(donnees.email, TAILLES.email),
    tel: uneLigne(donnees.tel, TAILLES.tel),
    service: idService(donnees.service),
    date: dateIso(donnees.date),
    passagers: passagersValides(donnees.passagers),
    langue: langueValide(donnees.langue),
    message: texteLibre(donnees.message, TAILLES.message),
  };
}

/** Accepte un objet déjà décodé, une chaîne JSON ou un Buffer. Renvoie null si illisible. */
function lireDonnees(body) {
  let donnees = body;
  if (donnees === undefined || donnees === null || donnees === '') return {};
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(donnees)) donnees = donnees.toString('utf8');
  if (typeof donnees === 'string') {
    if (donnees.trim() === '') return {};
    try {
      donnees = JSON.parse(donnees);
    } catch {
      return null;
    }
  }
  if (typeof donnees !== 'object' || donnees === null || Array.isArray(donnees)) return null;
  return donnees;
}

function potDeMielRempli(valeur) {
  if (valeur === undefined || valeur === null || valeur === false) return false;
  if (typeof valeur === 'string') return valeur.trim() !== '';
  return true;
}

// ---------------------------------------------------------------------------
// Origine
// ---------------------------------------------------------------------------

/**
 * Même origine uniquement. Sans en-tête Origin (curl, certains outils), on
 * laisse passer. Avec, son hôte doit être celui de la requête (Host) ou figurer
 * dans ALLOWED_ORIGINS — chaque entrée étant soit une origine complète
 * (« https://amane.paris »), soit un hôte seul (« amane.paris »).
 */
export function origineAutorisee(origin, host, autorisees) {
  if (origin === undefined || origin === null || origin === '') return true;
  let url;
  try {
    url = new URL(String(origin));
  } catch {
    return false; // « null », valeur tronquée…
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const hoteOrigine = url.host.toLowerCase();
  const hote = String(host ?? '')
    .trim()
    .toLowerCase();
  if (hote && hoteOrigine === hote) return true;

  for (const brute of String(autorisees ?? '').split(',')) {
    const entree = brute.trim().toLowerCase().replace(/\/+$/, '');
    if (!entree) continue;
    if (entree.includes('://')) {
      try {
        if (new URL(entree).origin === url.origin) return true;
      } catch {
        /* entrée mal formée : ignorée */
      }
    } else if (entree === hoteOrigine) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Brevo
// ---------------------------------------------------------------------------

/** Renvoie true si Brevo a accepté l'e-mail. Ne journalise ni la clé ni le contenu. */
async function envoyerBrevo({ cleApi, message, fetchImpl, etiquette }) {
  try {
    const reponse = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': cleApi,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(DELAI_BREVO_MS),
    });
    const ok = reponse.status >= 200 && reponse.status < 300;
    // On libère la connexion sans lire le corps (il peut reprendre des données du message).
    try {
      await reponse.body?.cancel?.();
    } catch {
      /* sans importance */
    }
    if (!ok) console.error(`[lead] Brevo a refusé l'e-mail « ${etiquette} » : HTTP ${reponse.status}`);
    return ok;
  } catch (erreur) {
    const nature = erreur?.name === 'TimeoutError' ? 'délai dépassé' : 'erreur réseau';
    console.error(`[lead] Brevo injoignable pour l'e-mail « ${etiquette} » : ${nature}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Lien avec le CRM (de serveur à serveur, signé)
//
// Protocole, fixé avec le CRM (sa route /api/lead) :
//   POST <CRM_URL>/api/lead
//   Content-Type: application/json
//   X-Amane-Signature: t=<secondes Unix>,v1=<hexadécimal>
// où v1 est le HMAC-SHA256 de « <t>.<corps brut> » avec le secret partagé
// (CRM_SECRET ici, SITE_LEAD_SECRET côté CRM). Le CRM refuse (403) une
// signature fausse, ou un horodatage qui a plus de cinq minutes d'écart.
// ---------------------------------------------------------------------------

/**
 * Le lien n'est actif que si CRM_URL commence par « https:// » et si CRM_SECRET
 * fait au moins 32 caractères. Renvoie alors l'adresse d'envoi et le secret ;
 * sinon null. Aucune des deux clés renseignée : le lien n'est pas demandé, rien
 * n'est signalé. Une seule, ou une valeur invalide : c'est signalé au journal,
 * sans jamais y écrire la valeur.
 */
function lienCrm(url, secret) {
  if (!url && !secret) return null;
  const base = url.replace(/\/+$/, ''); // « https://crm.exemple.fr/ » → « https://crm.exemple.fr »
  const defauts = [];
  if (!url) defauts.push('CRM_URL manquante');
  else if (!/^https:\/\/[^/\s?#]+(?:\/[^\s?#]*)?$/.test(base)) {
    defauts.push('CRM_URL invalide (elle doit commencer par https://)');
  }
  if (!secret) defauts.push('CRM_SECRET manquant');
  else if (secret.length < CRM_SECRET_MIN) {
    defauts.push(`CRM_SECRET trop court (${CRM_SECRET_MIN} caractères minimum)`);
  }
  if (defauts.length > 0) {
    console.warn(`[lead] lien CRM inactif : ${defauts.join(' ; ')}`);
    return null;
  }
  return { url: base + CRM_CHEMIN, secret };
}

/**
 * Ce que le CRM reçoit : les valeurs déjà nettoyées par nettoyerDemande(), la
 * langue en majuscules. Ni l'adresse IP du visiteur, ni le champ piège.
 */
function demandeCrm(lead) {
  return {
    nom: lead.nom,
    tel: lead.tel,
    email: lead.email,
    langue: lead.langue.toUpperCase(),
    service: lead.service,
    date: lead.date,
    passagers: lead.passagers,
    message: lead.message,
  };
}

/** En-tête X-Amane-Signature : « t=<secondes>,v1=<HMAC-SHA256 de "<t>.<corps>", en hexadécimal> ». */
function signatureCrm(secret, t, corps) {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${corps}`).digest('hex')}`;
}

/**
 * Envoie la demande au CRM. Renvoie true s'il l'a acceptée (réponse 2xx).
 * Ne journalise ni le secret, ni l'adresse du CRM, ni le contenu de la demande ;
 * le corps de la réponse n'est pas lu.
 *
 * @param {object} p
 * @param {{url: string, secret: string}} p.lien voir lienCrm()
 * @param {object} p.lead                        voir nettoyerDemande()
 * @param {number} p.t                           horloge, en millisecondes
 * @param {typeof fetch} p.fetchImpl
 */
async function envoyerCrm({ lien, lead, t, fetchImpl }) {
  try {
    // Le JSON est produit une seule fois : ce qui est signé est, à l'octet près, ce qui est envoyé.
    const corps = JSON.stringify(demandeCrm(lead));
    const reponse = await fetchImpl(lien.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amane-Signature': signatureCrm(lien.secret, Math.floor(t / 1000), corps),
      },
      body: corps,
      redirect: 'manual', // comme la version PHP : une redirection est un échec, on ne la suit pas
      signal: AbortSignal.timeout(DELAI_CRM_MS),
    });
    const ok = reponse.status >= 200 && reponse.status < 300;
    // On libère la connexion sans lire le corps de la réponse.
    try {
      await reponse.body?.cancel?.();
    } catch {
      /* sans importance */
    }
    if (!ok) console.error(`[lead] CRM : HTTP ${reponse.status}`);
    return ok;
  } catch (erreur) {
    const nature = erreur?.name === 'TimeoutError' ? 'délai dépassé' : 'erreur réseau';
    console.error(`[lead] CRM injoignable : ${nature}`);
    return false;
  }
}

function dateParis(t) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(t));
  } catch {
    return new Date(t).toISOString();
  }
}

function instant(now) {
  const t = typeof now === 'function' ? now() : now;
  if (t instanceof Date) return t.getTime();
  return Number.isFinite(t) ? t : Date.now();
}

const rep = (status, json, headers) => (headers ? { status, json, headers } : { status, json });

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {unknown} p.body       corps de la requête (objet, chaîne JSON ou Buffer)
 * @param {string} [p.ip]        adresse IP du visiteur
 * @param {string} [p.origin]    en-tête Origin
 * @param {string} [p.host]      en-tête Host
 * @param {Record<string, string|undefined>} [p.env]
 * @param {typeof fetch} [p.fetchImpl] envoi HTTP (Brevo et CRM)
 * @param {number|Date|(() => number)} [p.now] horloge (millisecondes), pour les tests
 * @returns {Promise<{status: number, json: object, headers?: Record<string, string>}>}
 */
export async function processLead({
  body,
  ip,
  origin,
  host,
  env = process.env,
  fetchImpl = globalThis.fetch,
  now,
} = {}) {
  env = env || {};

  // 1. Même origine
  if (!origineAutorisee(origin, host, env.ALLOWED_ORIGINS)) {
    return rep(403, { error: 'origine_refusee' });
  }

  // 2. Corps
  const donnees = lireDonnees(body);
  if (!donnees) return rep(400, { error: 'corps_invalide' });

  // 3. Piège à robots : champ caché « a_laisser_vide », qu'un humain ne voit pas.
  // S'il est rempli, on répond comme si tout allait bien, sans rien envoyer.
  // (L'ancien nom « website » a été abandonné : un remplissage automatique du
  // navigateur pouvait le renseigner chez un vrai client.)
  if (potDeMielRempli(donnees.a_laisser_vide)) {
    console.warn('[lead] pot de miel');
    return rep(200, { ok: true });
  }

  // 4. Validation
  const lead = nettoyerDemande(donnees);
  if (!lead.email && !lead.tel) {
    return rep(400, {
      error: 'contact_requis',
      message: 'Indiquez un e-mail ou un numéro de téléphone pour que nous puissions vous répondre.',
    });
  }
  if (lead.email && !emailValide(lead.email)) return rep(400, { error: 'email_invalide' });
  if (lead.tel && !telValide(lead.tel)) return rep(400, { error: 'tel_invalide' });

  // 5. Configuration
  const cleApi = String(env.BREVO_API_KEY ?? '').trim();
  const destinataires = String(env.LEAD_TO_EMAIL ?? '')
    .split(/[,;]/)
    .map((a) => uneLigne(a, 200))
    .filter(Boolean);
  const expediteur = uneLigne(env.LEAD_FROM_EMAIL, 200);
  const emailsPrets = Boolean(cleApi && destinataires.length > 0 && expediteur);
  // Lien CRM : actif seulement si ses deux clés sont valides (voir lienCrm).
  const crm = lienCrm(String(env.CRM_URL ?? '').trim(), String(env.CRM_SECRET ?? '').trim());
  // Ni e-mail ni CRM : la demande n'a nulle part où aller.
  if (!emailsPrets && !crm) {
    return rep(503, {
      error: 'email_off',
      message: 'L’envoi des demandes n’est pas encore configuré. Merci de nous joindre par téléphone.',
    });
  }
  const sender = { name: uneLigne(env.LEAD_FROM_NAME, 80) || 'Amane', email: expediteur };

  // 6. Limite de débit (chaque tentative d'envoi compte, réussie ou non)
  const t = instant(now);
  const attente = compterEnvoi(ip, t);
  if (attente > 0) {
    return rep(429, { error: 'trop_de_demandes' }, { 'Retry-After': String(attente) });
  }

  // 7. CRM d'abord, puis les e-mails : une demande n'est perdue que si tout échoue.
  // Un échec du CRM est seulement journalisé tant que l'e-mail à l'équipe part.
  const crmOk = crm ? await envoyerCrm({ lien: crm, lead, t, fetchImpl }) : false;
  // Réponse quand l'e-mail à l'équipe n'est pas parti : la demande est tout de
  // même enregistrée si le CRM l'a prise (sans accusé de réception), perdue sinon.
  const sansEmail = crmOk ? rep(200, { ok: true, ack: false }) : rep(502, { error: 'envoi_impossible' });
  if (!emailsPrets) return sansEmail; // e-mails non configurés : la demande n'est partie qu'au CRM

  // 8. E-mail à l'équipe
  const equipe = teamEmail({ ...lead, recuLe: dateParis(t) });
  const messageEquipe = {
    sender,
    to: destinataires.map((email) => ({ email })),
    subject: equipe.subject,
    htmlContent: equipe.html,
    textContent: equipe.text,
  };
  if (lead.email) {
    messageEquipe.replyTo = lead.nom ? { email: lead.email, name: lead.nom } : { email: lead.email };
  }
  const equipeOk = await envoyerBrevo({ cleApi, message: messageEquipe, fetchImpl, etiquette: 'équipe' });
  if (!equipeOk) return sansEmail;

  // 9. Accusé de réception (seulement si le client a laissé un e-mail)
  if (!lead.email) return rep(200, { ok: true, ack: false });

  // Ni texte libre dans le contenu (voir ackEmail), ni nom affiché dans le
  // destinataire : rien de saisi librement ne part vers l'adresse du client.
  const accuse = ackEmail(lead);
  const ack = await envoyerBrevo({
    cleApi,
    fetchImpl,
    etiquette: 'accusé',
    message: {
      sender,
      to: [{ email: lead.email }],
      subject: accuse.subject,
      htmlContent: accuse.html,
      textContent: accuse.text,
    },
  });
  return rep(200, { ok: true, ack });
}
