// Test croisé entre le site et le CRM : la signature que produit le site
// (api/_lib/lead-core.js) est-elle bien celle que le CRM accepte ?
//
// Le CRM vit dans un autre dépôt. S'il est présent sur la machine, on relit sa
// route /api/lead et on y confronte une vraie demande signée par le site ; s'il
// est absent, ces tests sont sautés : `npm test` ne dépend pas de l'autre dépôt.
//
// Par défaut, la route est cherchée dans /home/user/amane-crm ; la variable
// d'environnement AMANE_CRM_ROUTE permet d'indiquer un autre emplacement.
//
// Aucune requête réseau : fetch est simulé, et rien n'est écrit dans le dépôt du CRM.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { processLead, _viderLimite } from '../../api/_lib/lead-core.js';

const ROUTE_CRM = process.env.AMANE_CRM_ROUTE || '/home/user/amane-crm/apps/api/src/routes/lead.js';
const ABSENT = `dépôt du CRM absent (${ROUTE_CRM}) : test croisé sauté`;

// Valeurs fictives : aucun vrai secret ici.
const SECRET = 'secret-fictif-du-test-croise-0123456789';
const MAINTENANT = Date.parse('2026-11-26T12:00:00Z');
const DEMANDE = {
  nom: 'Zoé Lefèvre',
  email: 'zoe.lefevre@example.com',
  tel: '+33 6 12 34 56 78',
  service: 'voitures',
  date: '2026-12-05',
  passagers: '8+',
  langue: 'ar',
  message: 'Une berline pour la soirée — « merci » محمد 😀\nÀ bientôt.',
};

/** Fait traiter une demande par le site et renvoie l'appel qu'il adresse au CRM, tel quel. */
async function appelDuSite({ secret = SECRET, now = MAINTENANT } = {}) {
  _viderLimite();
  const appels = [];
  const fetchImpl = async (url, options) => {
    appels.push({ url, entete: options.headers['X-Amane-Signature'], brut: options.body });
    return new Response('{"ok":true}', { status: 200 });
  };
  // Sans configuration d'e-mail : la demande ne part qu'au CRM.
  const env = { CRM_URL: 'https://crm.amane.test', CRM_SECRET: secret };
  const r = await processLead({ body: DEMANDE, ip: '203.0.113.10', env, fetchImpl, now });
  assert.deepEqual(r.json, { ok: true, ack: false });
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, 'https://crm.amane.test/api/lead');
  return appels[0];
}

test('la signature du site est acceptée par la formule du CRM, recalculée avec node:crypto', async (t) => {
  if (!existsSync(ROUTE_CRM)) return t.skip(ABSENT);

  // La route du CRM applique-t-elle toujours la formule reprise ci-dessous ?
  const source = readFileSync(ROUTE_CRM, 'utf8');
  for (const repere of [
    "req.headers['x-amane-signature']",
    'process.env.SITE_LEAD_SECRET',
    'const SIGNATURE_RE = /^t=(\\d{1,12}),v1=([0-9a-f]{64})$/;',
    'const SIGNATURE_MAX_AGE_S = 300;',
    'secret.length < 32',
    "createHmac('sha256', secret).update(m[1] + '.').update(raw).digest()",
  ]) {
    assert.ok(source.includes(repere), `la route du CRM a changé (« ${repere} » introuvable) : revoir le protocole`);
  }

  /** La vérification du CRM (fonction signedBySite), reprise ligne pour ligne. */
  function accepteeParLeCrm({ entete, brut, secret = SECRET, maintenant = MAINTENANT }) {
    const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(entete);
    if (secret.length < 32 || !m) return false;
    if (Math.abs(maintenant / 1000 - Number(m[1])) > 300) return false;
    const attendu = createHmac('sha256', secret)
      .update(m[1] + '.')
      .update(Buffer.from(brut))
      .digest();
    return timingSafeEqual(attendu, Buffer.from(m[2], 'hex'));
  }

  const { entete, brut } = await appelDuSite();
  assert.ok(accepteeParLeCrm({ entete, brut }), 'signature du site acceptée');
  assert.ok(accepteeParLeCrm({ entete, brut, maintenant: MAINTENANT + 4 * 60 * 1000 }), 'quatre minutes plus tard');

  // Et tout ce que le CRM doit refuser l'est bien.
  assert.ok(!accepteeParLeCrm({ entete, brut: brut + ' ' }), 'corps modifié');
  assert.ok(!accepteeParLeCrm({ entete, brut, secret: SECRET + 'x' }), 'autre secret');
  assert.ok(!accepteeParLeCrm({ entete, brut, maintenant: MAINTENANT + 6 * 60 * 1000 }), 'six minutes plus tard');
  assert.ok(!accepteeParLeCrm({ entete, brut, maintenant: MAINTENANT - 6 * 60 * 1000 }), 'six minutes plus tôt');
});

test('la signature du site est acceptée par la fonction signedBySite du CRM elle-même', async (t) => {
  if (!existsSync(ROUTE_CRM)) return t.skip(ABSENT);

  // On extrait du fichier du CRM la fonction et ses deux constantes, pour les
  // exécuter telles qu'elles sont écrites — sans charger le reste du CRM (base
  // de données, Express…). Ce dont elles dépendent leur est fourni ici.
  const source = readFileSync(ROUTE_CRM, 'utf8');
  const morceaux = [
    /^const SIGNATURE_RE = .+;$/m,
    /^const SIGNATURE_MAX_AGE_S = .+;$/m,
    /^function signedBySite\(req, raw\) \{\n[\s\S]*?\n\}$/m,
  ].map((motif) => motif.exec(source)?.[0]);
  assert.ok(morceaux.every(Boolean), 'signedBySite introuvable dans la route du CRM : revoir ce test et le protocole');

  class HttpError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  /** signedBySite du CRM, avec son secret et son horloge. */
  function signedBySite({ secret = SECRET, maintenant = MAINTENANT } = {}) {
    const fabrique = new Function(
      'createHmac',
      'timingSafeEqual',
      'HttpError',
      'now',
      'process',
      `${morceaux.join('\n')}\nreturn signedBySite;`,
    );
    return fabrique(createHmac, timingSafeEqual, HttpError, () => maintenant, { env: { SITE_LEAD_SECRET: secret } });
  }
  const requete = ({ entete, brut }) => [{ headers: { 'x-amane-signature': entete } }, Buffer.from(brut)];
  const refusee = { status: 403, code: 'signature_refusee' };

  const appel = await appelDuSite();
  // Acceptée : signedBySite renvoie la signature (v1) ; refusée : elle lève une erreur 403.
  assert.equal(signedBySite()(...requete(appel)), appel.entete.split(',v1=')[1]);
  assert.equal(signedBySite({ maintenant: MAINTENANT + 4 * 60 * 1000 })(...requete(appel)).length, 64);

  assert.throws(() => signedBySite()(...requete({ ...appel, brut: appel.brut + ' ' })), refusee, 'corps modifié');
  assert.throws(() => signedBySite({ secret: SECRET + 'x' })(...requete(appel)), refusee, 'autre secret');
  assert.throws(
    () => signedBySite({ maintenant: MAINTENANT + 6 * 60 * 1000 })(...requete(appel)),
    refusee,
    'trop tard',
  );
  assert.throws(() => signedBySite({ maintenant: MAINTENANT - 6 * 60 * 1000 })(...requete(appel)), refusee, 'trop tôt');

  // Un secret de 32 caractères suffit de part et d'autre ; à 31, le site n'envoie rien.
  const secret32 = SECRET.slice(0, 32);
  const court = await appelDuSite({ secret: secret32 });
  assert.equal(signedBySite({ secret: secret32 })(...requete(court)).length, 64);
});
