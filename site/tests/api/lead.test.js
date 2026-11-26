// Tests de /api/lead — à lancer avec : npm test (node --test tests/api/*.test.js)
// Aucune requête réseau : fetch est toujours simulé.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';

import handler from '../../api/lead.js';
import { processLead, _viderLimite, BREVO_URL } from '../../api/_lib/lead-core.js';
import { teamEmail, ackEmail, SERVICES } from '../../api/_lib/emails.js';

const CLE = 'xkeysib-cle-de-test-0123456789';
const ENV = {
  BREVO_API_KEY: CLE,
  LEAD_TO_EMAIL: 'equipe@amane.test',
  LEAD_FROM_EMAIL: 'bonjour@amane.test',
};
// Lien CRM actif : adresse et secret fictifs (le secret fait plus de 32 caractères).
const CRM_URL = 'https://crm.amane.test';
const CRM_SECRET = 'secret-fictif-pour-les-tests-0123456789';
const ENV_CRM = { ...ENV, CRM_URL, CRM_SECRET };
const DEMANDE = {
  nom: 'Jeanne Martin',
  email: 'jeanne.martin@example.com',
  tel: '+33 6 12 34 56 78',
  service: 'chauffeur',
  date: '2026-12-12',
  passagers: '2',
  langue: 'fr',
  message: 'Un transfert depuis Roissy.\nMerci.',
  a_laisser_vide: '',
};

/**
 * Faux fetch : enregistre les appels et répond selon `reponses`, une entrée par
 * appel (un code HTTP, ou une erreur à lever). Par défaut : 201.
 */
function fauxFetch(...reponses) {
  const appels = [];
  const fetchImpl = async (url, options) => {
    const n = appels.length;
    appels.push({ url, options, corps: JSON.parse(options.body) });
    const r = reponses[n] ?? 201;
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify({ messageId: `<test-${n}@brevo>` }), { status: r });
  };
  return { fetchImpl, appels };
}

function envoyer(surcharge = {}, options = {}) {
  const { fetchImpl, appels } = options.fetch ?? fauxFetch();
  const { fetch: _ignore, ...reste } = options;
  return processLead({
    body: { ...DEMANDE, ...surcharge },
    ip: '203.0.113.10',
    origin: 'https://amane.test',
    host: 'amane.test',
    env: ENV,
    fetchImpl,
    now: 1_800_000_000_000,
    ...reste,
  }).then((resultat) => ({ ...resultat, appels }));
}

/** Rend console.error muet le temps d'un test et renvoie ce qui y a été écrit. */
function capterErreurs(t) {
  const lignes = [];
  t.mock.method(console, 'error', (...args) => lignes.push(args.join(' ')));
  return lignes;
}

/** Même chose pour console.warn (signalement du pot de miel). */
function capterAlertes(t) {
  const lignes = [];
  t.mock.method(console, 'warn', (...args) => lignes.push(args.join(' ')));
  return lignes;
}

/** Texte visible d'un e-mail HTML, balises retirées. */
function sansBalises(html) {
  return html.replace(/<[^>]*>/g, ' ');
}

beforeEach(() => _viderLimite());

// ---------------------------------------------------------------------------
describe('pot de miel', () => {
  test('a_laisser_vide rempli → 200 {ok:true} sans aucun envoi, avec un signalement', async (t) => {
    const alertes = capterAlertes(t);
    const r = await envoyer({ a_laisser_vide: 'https://spam.example' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
    assert.equal(r.appels.length, 0);
    assert.deepEqual(alertes, ['[lead] pot de miel']);
  });

  test('le piège passe avant la validation et avant la configuration', async (t) => {
    capterAlertes(t);
    const r = await envoyer({ a_laisser_vide: 'x', email: '', tel: '' }, { env: {} });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
    assert.equal(r.appels.length, 0);
  });

  test('le signalement ne contient aucune donnée de la demande', async (t) => {
    const alertes = capterAlertes(t);
    await envoyer({ a_laisser_vide: 'VALEUR-DU-ROBOT', message: 'SECRET-DU-CLIENT' });
    assert.equal(alertes.length, 1);
    for (const interdit of [
      'VALEUR-DU-ROBOT',
      'SECRET-DU-CLIENT',
      'Jeanne',
      'jeanne.martin@example.com',
      '+33',
      '203.0.113',
    ]) {
      assert.ok(!alertes[0].includes(interdit), interdit);
    }
  });

  test('a_laisser_vide vide ou fait d’espaces ne déclenche pas le piège', async (t) => {
    const alertes = capterAlertes(t);
    const r = await envoyer({ a_laisser_vide: '   ' });
    assert.deepEqual(r.json, { ok: true, ack: true });
    assert.equal(r.appels.length, 2);
    assert.equal(alertes.length, 0);
  });

  test('l’ancien champ « website » rempli n’empêche plus l’envoi', async (t) => {
    const alertes = capterAlertes(t);
    const r = await envoyer({ website: 'https://www.exemple-du-client.fr' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: true });
    assert.equal(r.appels.length, 2);
    assert.equal(alertes.length, 0);
    // … et sa valeur n'est reprise nulle part.
    for (const { corps } of r.appels) assert.ok(!JSON.stringify(corps).includes('exemple-du-client'));
  });
});

// ---------------------------------------------------------------------------
describe('validation', () => {
  test('ni e-mail ni téléphone → 400 contact_requis avec un message', async () => {
    const r = await envoyer({ email: '', tel: '   ' });
    assert.equal(r.status, 400);
    assert.equal(r.json.error, 'contact_requis');
    assert.equal(typeof r.json.message, 'string');
    assert.ok(r.json.message.length > 10);
    assert.equal(r.appels.length, 0);
  });

  test('corps vide → 400 contact_requis', async () => {
    const { fetchImpl, appels } = fauxFetch();
    const r = await processLead({ body: {}, ip: '203.0.113.11', env: ENV, fetchImpl });
    assert.equal(r.status, 400);
    assert.equal(r.json.error, 'contact_requis');
    assert.equal(appels.length, 0);
  });

  for (const email of [
    'jeanne',
    'jeanne@',
    '@example.com',
    'jeanne@example',
    'jeanne martin@example.com',
    'jeanne@@example.com',
    'jeanne..martin@example.com',
    'jeanne@example.com, autre@example.com',
    '<jeanne@example.com>',
  ]) {
    test(`e-mail invalide « ${email} » → 400 email_invalide`, async () => {
      const r = await envoyer({ email });
      assert.equal(r.status, 400);
      assert.deepEqual(r.json, { error: 'email_invalide' });
      assert.equal(r.appels.length, 0);
    });
  }

  test('e-mail invalide refusé même si le téléphone est bon', async () => {
    const r = await envoyer({ email: 'pas-une-adresse', tel: '+33 6 12 34 56 78' });
    assert.deepEqual(r.json, { error: 'email_invalide' });
  });

  for (const tel of ['1234567', '06 12 34', 'appelez-moi', '+33 (0)6']) {
    test(`téléphone invalide « ${tel} » → 400 tel_invalide`, async () => {
      const r = await envoyer({ tel });
      assert.equal(r.status, 400);
      assert.deepEqual(r.json, { error: 'tel_invalide' });
      assert.equal(r.appels.length, 0);
    });
  }

  test('téléphone à 8 chiffres accepté, quelle que soit la ponctuation', async () => {
    const r = await envoyer({ email: '', tel: '(01) 23.45-67 89' });
    assert.equal(r.status, 200);
  });

  test('corps JSON illisible → 400 corps_invalide', async () => {
    const { fetchImpl, appels } = fauxFetch();
    for (const body of ['{nom:', '[1,2]', '"texte"', 'null']) {
      const r = await processLead({ body, ip: '203.0.113.12', env: ENV, fetchImpl });
      assert.equal(r.status, 400, body);
      assert.deepEqual(r.json, { error: 'corps_invalide' });
    }
    assert.equal(appels.length, 0);
  });

  test('corps reçu en chaîne JSON ou en Buffer', async () => {
    const texte = JSON.stringify(DEMANDE);
    for (const body of [texte, Buffer.from(texte)]) {
      const { fetchImpl, appels } = fauxFetch();
      const r = await processLead({ body, ip: '203.0.113.13', env: ENV, fetchImpl });
      assert.deepEqual(r.json, { ok: true, ack: true });
      assert.equal(appels.length, 2);
      _viderLimite();
    }
  });

  test('tailles maximales et caractères de contrôle', async () => {
    const r = await envoyer({
      nom: '  ' + 'N'.repeat(300) + '  ',
      tel: '0'.repeat(300),
      message: 'Bonjour\u0000\u0007 à vous\u202E\r\n' + 'm'.repeat(6000),
    });
    assert.equal(r.status, 200);
    const [equipe] = r.appels;
    assert.ok(equipe.corps.subject.includes('N'.repeat(120)));
    assert.ok(!equipe.corps.subject.includes('N'.repeat(121)));
    const texte = equipe.corps.textContent;
    assert.ok(texte.includes('0'.repeat(40)) && !texte.includes('0'.repeat(41)));
    assert.ok(texte.includes('Bonjour à vous\n'));
    assert.ok(!texte.includes('m'.repeat(4000)));
    assert.ok(!/[\u0000-\u0009\u000B-\u001F\u007F\u202E]/.test(texte));
    assert.ok(!/[\u0000-\u0009\u000B-\u001F\u007F\u202E]/.test(equipe.corps.htmlContent));
  });

  test('valeurs qui ne sont pas des chaînes : ignorées, sauf les nombres', async () => {
    const r = await envoyer({ nom: { a: 1 }, service: ['x'], passagers: 3, message: null });
    assert.equal(r.status, 200);
    const [equipe] = r.appels;
    assert.equal(equipe.corps.subject, 'Nouvelle demande — Autre demande — Nom non précisé');
    assert.ok(equipe.corps.textContent.includes('Passagers : 3'));
    assert.ok(!equipe.corps.htmlContent.includes('[object Object]'));
  });
});

// ---------------------------------------------------------------------------
describe('champs fermés : service, date, passagers', () => {
  const LIBELLES = {
    fr: [
      "Voitures d'exception",
      'Chauffeur privé',
      'Van VIP',
      'Séjours clé en main',
      'Immobilier',
      'Tables & restaurants',
      'Événements',
      'Personal shopping',
      'Séjour esthétique',
      'Création & marketing',
      'Conciergerie sur demande',
      'Autre demande',
    ],
    en: [
      'Exceptional cars',
      'Private chauffeur',
      'VIP van',
      'Turnkey stays',
      'Real estate',
      'Tables & restaurants',
      'Events',
      'Personal shopping',
      'Aesthetic stay',
      'Creative & marketing',
      'Concierge on request',
      'Other request',
    ],
    es: [
      'Coches excepcionales',
      'Chófer privado',
      'Van VIP',
      'Estancias llave en mano',
      'Inmobiliaria',
      'Mesas y restaurantes',
      'Eventos',
      'Personal shopping',
      'Estancia estética',
      'Creación y marketing',
      'Concierge a demanda',
      'Otra solicitud',
    ],
    ar: [
      'سيارات استثنائية',
      'سائق خاص',
      'فان VIP',
      'إقامات متكاملة',
      'العقارات',
      'المطاعم والحجوزات',
      'الفعاليات',
      'التسوّق الشخصي',
      'إقامة تجميلية',
      'الإبداع والتسويق',
      'كونسيرج عند الطلب',
      'طلب آخر',
    ],
  };

  test('la liste des identifiants est celle du formulaire, dans le même ordre', () => {
    assert.deepEqual(SERVICES, [
      'voitures',
      'chauffeur',
      'van',
      'sejours',
      'immobilier',
      'tables',
      'evenements',
      'shopping',
      'esthetique',
      'creation',
      'conciergerie',
      'autre',
    ]);
    for (const langue of ['fr', 'en', 'es', 'ar']) assert.equal(LIBELLES[langue].length, SERVICES.length);
  });

  test('chaque identifiant donne son libellé : français pour l’équipe, langue du client pour l’accusé', () => {
    SERVICES.forEach((service, i) => {
      const equipe = teamEmail({ ...DEMANDE, service });
      assert.equal(equipe.subject, `Nouvelle demande — ${LIBELLES.fr[i]} — Jeanne Martin`);
      assert.ok(equipe.text.includes(`Service : ${LIBELLES.fr[i]}`));
      for (const langue of ['fr', 'en', 'es', 'ar']) {
        const accuse = ackEmail({ ...DEMANDE, service, langue });
        assert.ok(accuse.text.includes(LIBELLES[langue][i]), `${service} / ${langue} (texte)`);
        assert.ok(
          sansBalises(accuse.html).includes(LIBELLES[langue][i].replace('&', '&amp;').replace("'", '&#39;')),
          `${service} / ${langue}`,
        );
      }
    });
  });

  const NOUVEAUX = {
    immobilier: { fr: 'Immobilier', en: 'Real estate', es: 'Inmobiliaria', ar: 'العقارات' },
    tables: {
      fr: 'Tables & restaurants',
      en: 'Tables & restaurants',
      es: 'Mesas y restaurantes',
      ar: 'المطاعم والحجوزات',
    },
    evenements: { fr: 'Événements', en: 'Events', es: 'Eventos', ar: 'الفعاليات' },
    creation: {
      fr: 'Création & marketing',
      en: 'Creative & marketing',
      es: 'Creación y marketing',
      ar: 'الإبداع والتسويق',
    },
  };

  for (const [service, libelles] of Object.entries(NOUVEAUX)) {
    for (const langue of ['fr', 'en', 'es', 'ar']) {
      test(`service « ${service} », client ${langue} : libellé français pour l’équipe, « ${libelles[langue]} » dans l’accusé`, async () => {
        const r = await envoyer({ service, langue });
        assert.deepEqual(r.json, { ok: true, ack: true });
        const [equipe, accuse] = r.appels;
        const html = (texte) => texte.replace('&', '&amp;');

        assert.equal(equipe.corps.subject, `Nouvelle demande — ${libelles.fr} — Jeanne Martin`);
        assert.ok(equipe.corps.textContent.includes(`Service : ${libelles.fr}\n`));
        assert.ok(equipe.corps.htmlContent.includes(`>${html(libelles.fr)}</span>`));

        assert.ok(accuse.corps.textContent.includes(libelles[langue]));
        assert.ok(accuse.corps.htmlContent.includes(`>${html(libelles[langue])}</span>`));
        assert.ok(!accuse.corps.textContent.includes('Autre demande'));
      });
    }
  }

  for (const [service, parLangue] of [
    ['tables', { fr: 'Tables & restaurants', en: 'Tables & restaurants' }],
    ['creation', { fr: 'Création & marketing', en: 'Creative & marketing' }],
  ]) {
    test(`« & » du libellé de « ${service} » : échappé dans le HTML, intact dans le sujet et le texte`, async () => {
      for (const [langue, libelle] of Object.entries(parLangue)) {
        _viderLimite();
        const r = await envoyer({ service, langue });
        const [equipe, accuse] = r.appels;
        assert.equal(equipe.corps.subject, `Nouvelle demande — ${parLangue.fr} — Jeanne Martin`);
        for (const [corps, attendu] of [
          [equipe.corps, parLangue.fr],
          [accuse.corps, libelle],
        ]) {
          assert.ok(corps.textContent.includes(attendu));
          assert.ok(!corps.textContent.includes('&amp;'));
          assert.ok(corps.htmlContent.includes(attendu.replace('&', '&amp;')));
          assert.ok(!corps.htmlContent.includes(attendu), 'aucun « & » nu dans le HTML');
          // Aucun « & » du HTML qui ne soit le début d'une entité.
          assert.ok(!/&(?!(?:amp|lt|gt|quot|nbsp|#39);)/.test(corps.htmlContent));
        }
        assert.ok(accuse.corps.subject.includes('Amane'));
      }
    });
  }

  for (const service of [
    'Location de yacht',
    'chauffeur privé',
    '<b>van</b>',
    'chauffeur\nSubject: gagné',
    '',
    undefined,
    42,
    ['van'],
  ]) {
    test(`service inconnu ${JSON.stringify(service)} → « autre »`, async () => {
      const r = await envoyer({ service });
      assert.equal(r.status, 200);
      const [equipe, accuse] = r.appels;
      assert.equal(equipe.corps.subject, 'Nouvelle demande — Autre demande — Jeanne Martin');
      assert.ok(equipe.corps.textContent.includes('Service : Autre demande'));
      assert.ok(accuse.corps.textContent.includes('Service : Autre demande'));
      if (typeof service === 'string' && service.trim()) {
        const saisie = service.split('\n')[0];
        for (const { corps } of r.appels) {
          assert.ok(!corps.subject.includes(saisie));
          assert.ok(!corps.textContent.includes(saisie), 'la valeur saisie n’est reprise nulle part');
        }
      }
    });
  }

  test('identifiant connu accepté quelle que soit la casse', async () => {
    const r = await envoyer({ service: ' Van ' });
    assert.equal(r.appels[0].corps.subject, 'Nouvelle demande — Van VIP — Jeanne Martin');
  });

  for (const date of [
    '12 décembre, 19 h',
    '12/12/2026',
    '2026-12-12T19:00',
    '2026-12-12 <b>soir</b>',
    '2026-1-5',
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '2026-00-10',
    '0000-01-01',
    'demain\nBcc: x@y.z',
    20261212,
    null,
  ]) {
    test(`date invalide ${JSON.stringify(date)} → ignorée`, async () => {
      const r = await envoyer({ date });
      assert.equal(r.status, 200, 'une date invalide ne bloque pas la demande');
      const [equipe, accuse] = r.appels;
      assert.ok(equipe.corps.textContent.includes('Date : —'));
      assert.ok(!accuse.corps.textContent.includes('Date'));
      assert.ok(!sansBalises(accuse.corps.htmlContent).includes('Date'));
      if (typeof date === 'string') {
        for (const { corps } of r.appels) assert.ok(!corps.textContent.includes(date.split('\n')[0]));
      }
    });
  }

  test('date valide : écrite en toutes lettres, y compris un 29 février bissextile', async () => {
    const r = await envoyer({ date: '2028-02-29' });
    assert.ok(r.appels[0].corps.textContent.includes('Date : 29 février 2028'));
    assert.ok(r.appels[1].corps.textContent.includes('Date : 29 février 2028'));
  });

  for (const passagers of ['0', '8', '9', '10', '12', '-1', '2.5', 'deux', '8 +', '99999999', '2 <b>', 0, 8, null]) {
    test(`passagers invalides ${JSON.stringify(passagers)} → ignorés`, async () => {
      const r = await envoyer({ passagers });
      assert.equal(r.status, 200);
      const [equipe, accuse] = r.appels;
      assert.ok(equipe.corps.textContent.includes('Passagers : —'));
      assert.ok(!accuse.corps.textContent.includes('Passagers'));
    });
  }

  for (const passagers of ['1', '2', '3', '4', '5', '6', '7', '8+', 5]) {
    test(`passagers valides ${JSON.stringify(passagers)}`, async () => {
      const r = await envoyer({ passagers });
      const [equipe, accuse] = r.appels;
      assert.ok(equipe.corps.textContent.includes(`Passagers : ${passagers}\n`));
      assert.ok(accuse.corps.textContent.includes(`Passagers : ${passagers}\n`));
    });
  }
});

// ---------------------------------------------------------------------------
describe('origine', () => {
  test('origine étrangère → 403 origine_refusee', async () => {
    const r = await envoyer({}, { origin: 'https://pirate.example', host: 'amane.test' });
    assert.equal(r.status, 403);
    assert.deepEqual(r.json, { error: 'origine_refusee' });
    assert.equal(r.appels.length, 0);
  });

  test('sous-domaine ou hôte qui ressemble → 403', async () => {
    for (const origin of ['https://amane.test.pirate.example', 'https://faux-amane.test', 'null', 'amane.test']) {
      const r = await envoyer({}, { origin, host: 'amane.test' });
      assert.equal(r.status, 403, origin);
    }
  });

  test('origine égale à Host → acceptée (casse et port compris)', async () => {
    const a = await envoyer({}, { origin: 'https://Amane.Test', host: 'amane.test' });
    assert.equal(a.status, 200);
    _viderLimite();
    const b = await envoyer({}, { origin: 'http://localhost:3000', host: 'localhost:3000' });
    assert.equal(b.status, 200);
  });

  test('pas d’en-tête Origin → acceptée', async () => {
    const r = await envoyer({}, { origin: undefined });
    assert.equal(r.status, 200);
  });

  test('ALLOWED_ORIGINS : origine complète ou hôte seul', async () => {
    const env = { ...ENV, ALLOWED_ORIGINS: ' https://www.amane.test , apercu.amane.test,' };
    const a = await envoyer({}, { origin: 'https://www.amane.test', host: 'amane.test', env });
    assert.equal(a.status, 200);
    _viderLimite();
    const b = await envoyer({}, { origin: 'https://apercu.amane.test', host: 'amane.test', env });
    assert.equal(b.status, 200);
    _viderLimite();
    const c = await envoyer({}, { origin: 'http://www.amane.test', host: 'amane.test', env });
    assert.equal(c.status, 403, 'une origine complète impose aussi le protocole');
    const d = await envoyer({}, { origin: 'https://autre.example', host: 'amane.test', env });
    assert.equal(d.status, 403);
  });
});

// ---------------------------------------------------------------------------
describe('configuration', () => {
  for (const manquante of ['BREVO_API_KEY', 'LEAD_TO_EMAIL', 'LEAD_FROM_EMAIL']) {
    test(`sans ${manquante} → 503 email_off`, async () => {
      const env = { ...ENV, [manquante]: manquante === 'BREVO_API_KEY' ? undefined : '  ' };
      const r = await envoyer({}, { env });
      assert.equal(r.status, 503);
      assert.equal(r.json.error, 'email_off');
      assert.equal(typeof r.json.message, 'string');
      assert.equal(r.appels.length, 0);
    });
  }

  test('LEAD_FROM_NAME : « Amane » par défaut, sinon la valeur donnée', async () => {
    const a = await envoyer();
    assert.deepEqual(a.appels[0].corps.sender, { name: 'Amane', email: 'bonjour@amane.test' });
    _viderLimite();
    const b = await envoyer({}, { env: { ...ENV, LEAD_FROM_NAME: 'Amane Paris' } });
    assert.deepEqual(b.appels[1].corps.sender, { name: 'Amane Paris', email: 'bonjour@amane.test' });
  });
});

// ---------------------------------------------------------------------------
describe('envoi', () => {
  test('e-mail à l’équipe puis accusé de réception', async () => {
    const r = await envoyer();
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: true });
    assert.equal(r.appels.length, 2);

    for (const appel of r.appels) {
      assert.equal(appel.url, 'https://api.brevo.com/v3/smtp/email');
      assert.equal(appel.url, BREVO_URL);
      assert.equal(appel.options.method, 'POST');
      assert.equal(appel.options.headers['api-key'], CLE);
      assert.equal(appel.options.headers['content-type'], 'application/json');
      assert.ok(appel.options.signal instanceof AbortSignal, 'délai maximal par appel');
      assert.deepEqual(appel.corps.sender, { name: 'Amane', email: 'bonjour@amane.test' });
      assert.ok(appel.corps.htmlContent.startsWith('<!DOCTYPE html>'));
      assert.ok(appel.corps.textContent.length > 0);
      assert.ok(!/[\r\n]/.test(appel.corps.subject));
    }

    const [equipe, accuse] = r.appels;
    assert.deepEqual(equipe.corps.to, [{ email: 'equipe@amane.test' }]);
    assert.deepEqual(equipe.corps.replyTo, { email: 'jeanne.martin@example.com', name: 'Jeanne Martin' });
    assert.equal(equipe.corps.subject, 'Nouvelle demande — Chauffeur privé — Jeanne Martin');
    for (const valeur of [
      'Jeanne Martin',
      'jeanne.martin@example.com',
      '+33 6 12 34 56 78',
      'Chauffeur privé',
      '12 décembre 2026',
      'Un transfert depuis Roissy.',
    ]) {
      assert.ok(equipe.corps.htmlContent.includes(valeur), `HTML équipe : ${valeur}`);
      assert.ok(equipe.corps.textContent.includes(valeur), `texte équipe : ${valeur}`);
    }
    assert.ok(equipe.corps.htmlContent.includes('Un transfert depuis Roissy.<br>Merci.'));

    assert.deepEqual(
      accuse.corps.to,
      [{ email: 'jeanne.martin@example.com' }],
      'pas de nom saisi dans le destinataire',
    );
    assert.equal(accuse.corps.replyTo, undefined);
    assert.ok(accuse.corps.subject.includes('Amane'));
    assert.ok(accuse.corps.htmlContent.includes('Nous avons bien reçu votre demande.'));
    assert.ok(accuse.corps.textContent.includes('Nous avons bien reçu votre demande.'));
    for (const valeur of ['Service : Chauffeur privé', 'Date : 12 décembre 2026', 'Passagers : 2']) {
      assert.ok(accuse.corps.textContent.includes(valeur), `texte accusé : ${valeur}`);
    }
    for (const valeur of ['Chauffeur privé', '12 décembre 2026']) {
      assert.ok(accuse.corps.htmlContent.includes(valeur), `HTML accusé : ${valeur}`);
    }
  });

  test('téléphone seul : un seul e-mail, sans replyTo, ack:false', async () => {
    const r = await envoyer({ email: '' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: false });
    assert.equal(r.appels.length, 1);
    assert.equal('replyTo' in r.appels[0].corps, false);
    assert.deepEqual(r.appels[0].corps.to, [{ email: 'equipe@amane.test' }]);
  });

  test('e-mail seul, sans nom : replyTo et destinataire sans champ name', async () => {
    const r = await envoyer({ nom: '', tel: '' });
    assert.deepEqual(r.json, { ok: true, ack: true });
    assert.deepEqual(r.appels[0].corps.replyTo, { email: 'jeanne.martin@example.com' });
    assert.deepEqual(r.appels[1].corps.to, [{ email: 'jeanne.martin@example.com' }]);
    assert.equal(r.appels[0].corps.subject, 'Nouvelle demande — Chauffeur privé — Nom non précisé');
  });

  test('plusieurs destinataires dans LEAD_TO_EMAIL', async () => {
    const env = { ...ENV, LEAD_TO_EMAIL: 'a@amane.test, b@amane.test' };
    const r = await envoyer({}, { env });
    assert.deepEqual(r.appels[0].corps.to, [{ email: 'a@amane.test' }, { email: 'b@amane.test' }]);
  });

  test('échec de l’e-mail à l’équipe (HTTP 401) → 502, pas d’accusé', async (t) => {
    const journal = capterErreurs(t);
    const r = await envoyer({}, { fetch: fauxFetch(401) });
    assert.equal(r.status, 502);
    assert.deepEqual(r.json, { error: 'envoi_impossible' });
    assert.equal(r.appels.length, 1);
    assert.equal(journal.length, 1);
    assert.ok(journal[0].includes('401'));
  });

  test('échec de l’e-mail à l’équipe (fetch lève) → 502, pas d’accusé', async (t) => {
    capterErreurs(t);
    const r = await envoyer({}, { fetch: fauxFetch(new TypeError('fetch failed')) });
    assert.equal(r.status, 502);
    assert.deepEqual(r.json, { error: 'envoi_impossible' });
    assert.equal(r.appels.length, 1);
  });

  test('échec de l’accusé seul (HTTP 400) → 200 ack:false', async (t) => {
    capterErreurs(t);
    const r = await envoyer({}, { fetch: fauxFetch(201, 400) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: false });
    assert.equal(r.appels.length, 2);
  });

  test('échec de l’accusé seul (délai dépassé) → 200 ack:false', async (t) => {
    capterErreurs(t);
    const delai = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const r = await envoyer({}, { fetch: fauxFetch(201, delai) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: false });
  });

  test('le journal ne contient ni la clé API ni le contenu de la demande', async (t) => {
    const journal = capterErreurs(t);
    await envoyer({ message: 'SECRET-DU-CLIENT' }, { fetch: fauxFetch(500) });
    _viderLimite();
    await envoyer(
      { message: 'SECRET-DU-CLIENT' },
      { fetch: fauxFetch(201, new Error(`boum ${CLE} SECRET-DU-CLIENT`)) },
    );
    const tout = journal.join('\n');
    assert.equal(journal.length, 2);
    assert.ok(tout.includes('500'));
    for (const interdit of [CLE, 'SECRET-DU-CLIENT', 'jeanne.martin@example.com', 'Jeanne', '+33 6 12']) {
      assert.ok(!tout.includes(interdit), `le journal ne doit pas contenir « ${interdit} »`);
    }
  });
});

// ---------------------------------------------------------------------------
describe('accusé de réception', () => {
  const attendus = {
    fr: {
      dir: 'ltr',
      phrase: 'Nous avons bien reçu votre demande.',
      signature: 'Amane — Conciergerie privée · Paris',
      service: 'Chauffeur privé',
      date: '12 décembre 2026',
    },
    en: {
      dir: 'ltr',
      phrase: 'We have received your request.',
      signature: 'Amane — Private concierge · Paris',
      service: 'Private chauffeur',
      date: '12 December 2026',
    },
    es: {
      dir: 'ltr',
      phrase: 'Hemos recibido su solicitud.',
      signature: 'Amane — Conserjería privada · París',
      service: 'Chófer privado',
      date: '12 de diciembre de 2026',
    },
    ar: {
      dir: 'rtl',
      phrase: 'تلقّينا طلبكم',
      signature: 'Amane — ',
      service: 'سائق خاص',
      date: '12 ديسمبر 2026',
    },
  };

  for (const [langue, a] of Object.entries(attendus)) {
    test(`langue ${langue}`, async () => {
      const r = await envoyer({ langue });
      const accuse = r.appels[1].corps;
      assert.ok(accuse.htmlContent.includes(`<html lang="${langue}" dir="${a.dir}"`));
      assert.ok(accuse.htmlContent.includes(a.phrase));
      assert.ok(accuse.textContent.includes(a.phrase));
      assert.ok(accuse.htmlContent.includes(a.signature));
      assert.ok(accuse.textContent.includes(a.signature));
      for (const valeur of [a.service, a.date]) {
        assert.ok(accuse.htmlContent.includes(valeur), `HTML : ${valeur}`);
        assert.ok(accuse.textContent.includes(valeur), `texte : ${valeur}`);
      }
      assert.ok(accuse.subject.includes('Amane'), '« Amane » n’est jamais traduit');
      assert.equal(accuse.htmlContent.includes('dir="rtl"'), langue === 'ar');
      // L'e-mail à l'équipe reste en français, mais indique la langue du client.
      assert.ok(r.appels[0].corps.htmlContent.includes('<html lang="fr" dir="ltr"'));
    });
  }

  test('langue insensible à la casse, inconnue ou absente → fr', async () => {
    const cas = { EN: 'en', ' Ar ': 'ar', 'es-ES': 'es', de: 'fr', '': 'fr', 42: 'fr' };
    for (const [saisie, attendue] of Object.entries(cas)) {
      _viderLimite();
      const r = await envoyer({ langue: saisie });
      assert.ok(r.appels[1].corps.htmlContent.includes(`<html lang="${attendue}"`), `« ${saisie} » → ${attendue}`);
    }
    _viderLimite();
    const { langue: _sans, ...sansLangue } = DEMANDE;
    const { fetchImpl, appels } = fauxFetch();
    await processLead({ body: sansLangue, ip: '203.0.113.14', env: ENV, fetchImpl });
    assert.ok(appels[1].corps.htmlContent.includes('<html lang="fr"'));
  });

  test('ni prix ni promesse : aucun montant, aucune devise', () => {
    for (const langue of ['fr', 'en', 'es', 'ar']) {
      const { subject, html, text } = ackEmail({ langue, email: 'a@example.com' });
      const corps = html.replace(/<[^>]*>/g, ' ');
      for (const contenu of [subject, corps, text]) {
        assert.ok(!/[€$£]|\beur\b|\bprix\b|\btarif|\bprice|\bprecio/i.test(contenu), langue);
      }
    }
  });

  test('gabarit : marque, couleurs, largeur, aucune ressource distante', () => {
    for (const { html } of [teamEmail(DEMANDE), ackEmail(DEMANDE), ackEmail({ ...DEMANDE, langue: 'ar' })]) {
      assert.ok(html.includes('>AMANE</td>'));
      for (const couleur of ['#5B1622', '#EFE7DA', '#F6F1E8', '#2A211E', '#D9CFC0', '#B8955C']) {
        assert.ok(html.includes(couleur), couleur);
      }
      assert.ok(html.includes('max-width:560px'));
      assert.ok(html.includes("Georgia, 'Times New Roman', serif"));
      assert.ok(html.includes('Helvetica, Arial, sans-serif'));
      assert.ok(!/<img|<link|<script|<style|@import|url\(|@font-face/i.test(html));
      assert.ok(!/(?:src|href)="https?:/i.test(html));
    }
  });

  test('l’accusé ne contient ni le nom ni le message, même inoffensifs', async () => {
    const r = await envoyer({ nom: 'Camille Durand', message: 'Bonjour, une voiture pour samedi soir.' });
    assert.deepEqual(r.json, { ok: true, ack: true });
    const [equipe, accuse] = r.appels;
    // L'équipe, elle, reçoit tout.
    for (const valeur of ['Camille Durand', 'Bonjour, une voiture pour samedi soir.', '+33 6 12 34 56 78']) {
      assert.ok(equipe.corps.textContent.includes(valeur), `équipe : ${valeur}`);
      assert.ok(equipe.corps.htmlContent.includes(valeur), `équipe (HTML) : ${valeur}`);
    }
    const envoi = JSON.stringify(accuse.corps);
    for (const interdit of ['Camille', 'Durand', 'Bonjour', 'voiture pour samedi', 'samedi', '+33 6 12', '34 56 78']) {
      assert.ok(!envoi.includes(interdit), `l’accusé ne doit pas contenir « ${interdit} »`);
    }
    assert.deepEqual(accuse.corps.to, [{ email: 'jeanne.martin@example.com' }]);
    assert.deepEqual(Object.keys(accuse.corps).sort(), ['htmlContent', 'sender', 'subject', 'textContent', 'to']);
  });

  test('l’accusé est identique quels que soient le nom, le message et le téléphone', async () => {
    const a = await envoyer({ nom: 'A', message: 'un', tel: '+33 1 11 11 11 11' });
    _viderLimite();
    const b = await envoyer({ nom: 'Tout autre nom', message: 'https://pirate.example gagnez 1000 €', tel: '' });
    assert.deepEqual(a.appels[1].corps, b.appels[1].corps);
  });

  test('ackEmail appelée directement avec des valeurs brutes ne reprend rien de libre', () => {
    for (const langue of ['fr', 'en', 'es', 'ar']) {
      const { subject, html, text } = ackEmail({
        langue,
        nom: 'NOM-LIBRE',
        message: 'MESSAGE-LIBRE',
        tel: 'TEL-LIBRE',
        service: 'SERVICE-LIBRE',
        date: 'DATE-LIBRE',
        passagers: 'PASSAGERS-LIBRES',
        email: 'a@example.com',
      });
      assert.ok(!/LIBRE/.test(subject + html + text), langue);
    }
  });
});

// ---------------------------------------------------------------------------
describe('sécurité du contenu', () => {
  test('échappement HTML des valeurs saisies', async () => {
    const r = await envoyer({
      nom: 'Jean <b>Gras</b> & "Fils" l\'aîné',
      tel: '+33 6 12 34 56 78 <i>soir</i>',
      service: '<img src=x onerror=alert(1)>',
      date: '<svg onload=alert(1)>',
      passagers: '<u>2</u>',
      message: 'Bonjour <script>alert("xss")</script>\n<a href="https://pirate.example">cliquez</a>',
    });
    assert.equal(r.status, 200);
    const [equipe, accuse] = r.appels;
    for (const { corps } of r.appels) {
      const html = corps.htmlContent;
      assert.ok(!html.includes('<script'), 'pas de balise script');
      assert.ok(!html.includes('<img'), 'pas de balise img');
      assert.ok(!html.includes('<svg'), 'pas de balise svg');
      assert.ok(!html.includes('<b>Gras</b>'));
      assert.ok(!html.includes('<i>soir</i>'));
      assert.ok(!html.includes('<u>2</u>'));
      assert.ok(!html.includes('href="https://pirate.example"'));
    }
    const html = equipe.corps.htmlContent;
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
    assert.ok(html.includes('Jean &lt;b&gt;Gras&lt;/b&gt; &amp; &quot;Fils&quot; l&#39;aîné'));
    assert.ok(html.includes('&lt;i&gt;soir&lt;/i&gt;'));
    // La version texte de l'e-mail équipe, elle, garde la saisie telle quelle.
    assert.ok(equipe.corps.textContent.includes('<script>alert("xss")</script>'));
    // L'accusé ne reprend rien de tout cela, sous aucune forme.
    for (const interdit of ['script', 'Gras', 'pirate', 'onerror', 'onload', 'soir']) {
      assert.ok(!JSON.stringify(accuse.corps).includes(interdit), interdit);
    }
  });

  test('injection d’en-tête par le nom', async () => {
    const r = await envoyer({ nom: 'Jean Dupont\r\nBcc: pirate@example.com\r\n\r\nCorps forgé' });
    assert.equal(r.status, 200);
    const [equipe, accuse] = r.appels;
    assert.equal(
      equipe.corps.subject,
      'Nouvelle demande — Chauffeur privé — Jean Dupont Bcc: pirate@example.com Corps forgé',
    );
    for (const valeur of [equipe.corps.subject, equipe.corps.replyTo.name, accuse.corps.subject]) {
      assert.ok(!/[\r\n\u2028\u2029]/.test(valeur), JSON.stringify(valeur));
    }
    for (const { corps } of r.appels) {
      assert.deepEqual(
        Object.keys(corps).sort(),
        Object.keys(corps).includes('replyTo')
          ? ['htmlContent', 'replyTo', 'sender', 'subject', 'textContent', 'to']
          : ['htmlContent', 'sender', 'subject', 'textContent', 'to'],
      );
      assert.equal('bcc' in corps, false);
      assert.equal('cc' in corps, false);
    }
    assert.deepEqual(equipe.corps.to, [{ email: 'equipe@amane.test' }]);
    assert.deepEqual(accuse.corps.to, [{ email: 'jeanne.martin@example.com' }]);
    assert.ok(!JSON.stringify(accuse.corps).includes('pirate@example.com'));
  });

  test('injection d’en-tête par le service ou des séparateurs Unicode', async () => {
    const r = await envoyer({
      service: 'chauffeur\nSubject: gagné',
      nom: 'Jean\u2028Dupont\u0085fin\tici',
    });
    assert.equal(r.appels[0].corps.subject, 'Nouvelle demande — Autre demande — Jean Dupont fin ici');
  });

  test('injection d’en-tête par l’e-mail → 400 email_invalide', async () => {
    for (const email of [
      'jeanne@example.com\r\nBcc: pirate@example.com',
      'jeanne@example.com\nBcc:pirate@example.com',
      'jeanne@example.com%0ABcc:x@y.z',
    ]) {
      const r = await envoyer({ email });
      assert.equal(r.status, 400, JSON.stringify(email));
      assert.deepEqual(r.json, { error: 'email_invalide' });
      assert.equal(r.appels.length, 0);
    }
  });

  test('les champs inconnus du corps sont ignorés', async () => {
    const r = await envoyer({ bcc: 'pirate@example.com', to: 'pirate@example.com', htmlContent: '<script>1</script>' });
    assert.equal(r.status, 200);
    for (const { corps } of r.appels) {
      assert.ok(!JSON.stringify(corps).includes('pirate@example.com'));
      assert.ok(!corps.htmlContent.includes('<script'));
    }
  });
});

// ---------------------------------------------------------------------------
describe('limite de débit', () => {
  test('6e appel de la même IP → 429, une autre IP passe, la fenêtre se rouvre après une heure', async () => {
    const t0 = 1_800_000_000_000;
    for (let i = 1; i <= 5; i++) {
      const r = await envoyer({}, { ip: '198.51.100.7', now: t0 + i * 1000 });
      assert.equal(r.status, 200, `appel ${i}`);
    }
    const sixieme = await envoyer({}, { ip: '198.51.100.7', now: t0 + 6000 });
    assert.equal(sixieme.status, 429);
    assert.deepEqual(sixieme.json, { error: 'trop_de_demandes' });
    assert.equal(sixieme.appels.length, 0);
    assert.ok(Number(sixieme.headers['Retry-After']) > 0);

    const autre = await envoyer({}, { ip: '198.51.100.8', now: t0 + 6000 });
    assert.equal(autre.status, 200);

    const presqueUneHeure = await envoyer({}, { ip: '198.51.100.7', now: t0 + 59 * 60 * 1000 });
    assert.equal(presqueUneHeure.status, 429);

    const plusTard = await envoyer({}, { ip: '198.51.100.7', now: t0 + 1000 + 60 * 60 * 1000 });
    assert.equal(plusTard.status, 200);
  });

  test('les demandes refusées avant l’envoi ne consomment pas le quota', async (t) => {
    capterAlertes(t);
    for (let i = 0; i < 10; i++) {
      await envoyer({ email: 'invalide' }, { ip: '198.51.100.9' });
      await envoyer({ a_laisser_vide: 'robot' }, { ip: '198.51.100.9' });
    }
    const r = await envoyer({}, { ip: '198.51.100.9' });
    assert.equal(r.status, 200);
  });
});

// ---------------------------------------------------------------------------
describe('lien avec le CRM', () => {
  const versCrm = (appels) => appels.filter((appel) => appel.url !== BREVO_URL);
  const versBrevo = (appels) => appels.filter((appel) => appel.url === BREVO_URL);
  const T0 = 1_800_000_000; // l'horloge des tests, en secondes

  /** Recalcule la signature comme le fait le CRM : HMAC-SHA256 de « <t>.<corps brut> », en hexadécimal. */
  function signatureAttendue(brut, t = T0, secret = CRM_SECRET) {
    return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${brut}`).digest('hex')}`;
  }

  /**
   * Faux fetch qui distingue le CRM de Brevo par l'adresse appelée : à chacun sa
   * suite de réponses (un code HTTP, ou une erreur à lever). Par défaut : 200
   * pour le CRM, 201 pour Brevo. Tous les appels sont enregistrés, dans l'ordre.
   */
  function fauxReseau({ crm = [], brevo = [] } = {}) {
    const appels = [];
    const suites = { crm: [...crm], brevo: [...brevo] };
    const fetchImpl = async (url, options) => {
      const vers = url === BREVO_URL ? 'brevo' : 'crm';
      appels.push({ url, options, corps: JSON.parse(options.body) });
      const r = suites[vers].shift() ?? (vers === 'crm' ? 200 : 201);
      if (r instanceof Error) throw r;
      // Response n'accepte que les codes 200 à 599, et pas de corps pour un 204.
      if (r < 200) return { status: r };
      return new Response(r === 204 ? null : JSON.stringify({ ok: true }), { status: r });
    };
    return { fetchImpl, appels };
  }

  test('lien inactif (aucune clé) : aucun appel au CRM, rien ne change, rien au journal', async (t) => {
    const erreurs = capterErreurs(t);
    const alertes = capterAlertes(t);
    for (const env of [ENV, { ...ENV, CRM_URL: '', CRM_SECRET: '' }, { ...ENV, CRM_URL: '  ', CRM_SECRET: ' ' }]) {
      _viderLimite();
      const r = await envoyer({}, { env });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { ok: true, ack: true });
      assert.equal(versCrm(r.appels).length, 0);
      assert.equal(versBrevo(r.appels).length, 2);
    }
    assert.deepEqual([...erreurs, ...alertes], []);
  });

  const SECRET_31 = 'secret-fictif-de-31-caracteres-';

  const LIENS_INVALIDES = {
    'CRM_URL seule': [{ CRM_URL }, 'CRM_SECRET manquant'],
    'CRM_SECRET seul': [{ CRM_SECRET }, 'CRM_URL manquante'],
    'adresse en http://': [
      { CRM_URL: 'http://crm.amane.test', CRM_SECRET },
      'CRM_URL invalide (elle doit commencer par https://)',
    ],
    'adresse sans https://': [
      { CRM_URL: 'crm.amane.test', CRM_SECRET },
      'CRM_URL invalide (elle doit commencer par https://)',
    ],
    'adresse réduite à https://': [
      { CRM_URL: 'https://', CRM_SECRET },
      'CRM_URL invalide (elle doit commencer par https://)',
    ],
    'adresse avec des paramètres': [
      { CRM_URL: 'https://crm.amane.test/?cle=valeur', CRM_SECRET },
      'CRM_URL invalide (elle doit commencer par https://)',
    ],
    'secret de 31 caractères': [{ CRM_URL, CRM_SECRET: SECRET_31 }, 'CRM_SECRET trop court (32 caractères minimum)'],
    'adresse et secret invalides': [
      { CRM_URL: 'http://crm.amane.test', CRM_SECRET: 'secret-trop-court' },
      'CRM_URL invalide (elle doit commencer par https://) ; CRM_SECRET trop court (32 caractères minimum)',
    ],
  };

  for (const [cas, [cles, signalement]] of Object.entries(LIENS_INVALIDES)) {
    test(`lien inactif (${cas}) : aucun appel au CRM, comportement inchangé, un signalement sans valeur`, async (t) => {
      const erreurs = capterErreurs(t);
      const alertes = capterAlertes(t);
      const r = await envoyer({}, { env: { ...ENV, ...cles } });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { ok: true, ack: true });
      assert.equal(versCrm(r.appels).length, 0);
      assert.equal(versBrevo(r.appels).length, 2);
      assert.deepEqual(alertes, [`[lead] lien CRM inactif : ${signalement}`], 'une seule ligne par demande');
      assert.deepEqual(erreurs, []);
      for (const interdit of [CRM_SECRET, SECRET_31, 'secret-trop-court', 'crm.amane.test', 'cle=valeur']) {
        assert.ok(!alertes[0].includes(interdit), `le journal ne doit pas contenir « ${interdit} »`);
      }

      // E-mail à l'équipe en échec : 502, comme sans le lien.
      _viderLimite();
      const echec = await envoyer({}, { env: { ...ENV, ...cles }, fetch: fauxReseau({ brevo: [500] }) });
      assert.equal(echec.status, 502);
      assert.deepEqual(echec.json, { error: 'envoi_impossible' });
      assert.equal(versCrm(echec.appels).length, 0);

      // E-mail non configuré : 503, comme sans le lien, et sans entamer la limite de débit.
      _viderLimite();
      alertes.length = 0;
      for (let i = 0; i < 6; i++) {
        const off = await envoyer({}, { env: { ...ENV, ...cles, LEAD_TO_EMAIL: '' } });
        assert.equal(off.status, 503);
        assert.equal(off.json.error, 'email_off');
        assert.equal(off.appels.length, 0);
      }
      assert.deepEqual(alertes, Array(6).fill(`[lead] lien CRM inactif : ${signalement}`));
    });
  }

  test('secret de 32 caractères exactement : lien actif ; la longueur se compte comme le fait le CRM', async (t) => {
    const alertes = capterAlertes(t);
    assert.equal(SECRET_31.length, 31);
    const secret = SECRET_31 + 'y';
    const r = await envoyer({}, { env: { ...ENV_CRM, CRM_SECRET: secret } });
    const [appel] = versCrm(r.appels);
    assert.equal(versCrm(r.appels).length, 1);
    assert.equal(appel.options.headers['X-Amane-Signature'], signatureAttendue(appel.options.body, T0, secret));
    assert.deepEqual(alertes, []);

    // Vingt lettres accentuées : 40 octets, mais 20 caractères pour le CRM (JavaScript) → trop court.
    _viderLimite();
    const court = await envoyer({}, { env: { ...ENV_CRM, CRM_SECRET: 'é'.repeat(20) } });
    assert.equal(versCrm(court.appels).length, 0);
    assert.deepEqual(alertes, ['[lead] lien CRM inactif : CRM_SECRET trop court (32 caractères minimum)']);
  });

  test('lien actif : un seul appel à <CRM_URL>/api/lead, signé, avant les e-mails', async (t) => {
    const erreurs = capterErreurs(t);
    const alertes = capterAlertes(t);
    const delais = [];
    const delaiReel = AbortSignal.timeout.bind(AbortSignal);
    t.mock.method(AbortSignal, 'timeout', (ms) => (delais.push(ms), delaiReel(ms)));

    const r = await envoyer({}, { env: ENV_CRM });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: true });
    assert.deepEqual([...erreurs, ...alertes], []);

    assert.equal(versCrm(r.appels).length, 1);
    assert.equal(versBrevo(r.appels).length, 2);
    assert.deepEqual(
      r.appels.map((appel) => appel.url),
      ['https://crm.amane.test/api/lead', BREVO_URL, BREVO_URL],
      'le CRM d’abord, puis les deux e-mails',
    );

    const [appel] = versCrm(r.appels);
    assert.equal(appel.options.method, 'POST');
    assert.equal(typeof appel.options.body, 'string');
    assert.deepEqual(
      appel.options.headers,
      { 'Content-Type': 'application/json', 'X-Amane-Signature': signatureAttendue(appel.options.body) },
      'deux en-têtes, signature recalculée identique',
    );
    assert.match(appel.options.headers['X-Amane-Signature'], /^t=1800000000,v1=[0-9a-f]{64}$/);
    assert.equal(appel.options.redirect, 'manual', 'une redirection n’est pas suivie');
    assert.ok(appel.options.signal instanceof AbortSignal, 'délai maximal');
    assert.deepEqual(delais, [5000, 8000, 8000], 'délai maximal, en millisecondes : 5 s pour le CRM');
    // Les e-mails, eux, ne changent pas.
    assert.equal(versBrevo(r.appels)[0].options.headers['api-key'], CLE);
    assert.equal('X-Amane-Signature' in versBrevo(r.appels)[0].options.headers, false);
  });

  test('corps envoyé au CRM : exactement les huit champs, langue en majuscules, ni IP ni champ piège', async () => {
    const r = await envoyer(
      { a_laisser_vide: '  ', website: 'https://exemple-du-client.fr', bcc: 'pirate@example.com' },
      { env: ENV_CRM, ip: '203.0.113.77' },
    );
    const [appel] = versCrm(r.appels);
    assert.deepEqual(appel.corps, {
      nom: 'Jeanne Martin',
      tel: '+33 6 12 34 56 78',
      email: 'jeanne.martin@example.com',
      langue: 'FR',
      service: 'chauffeur',
      date: '2026-12-12',
      passagers: '2',
      message: 'Un transfert depuis Roissy.\nMerci.',
    });
    // À l'octet près, le même JSON que la version PHP.
    assert.equal(
      appel.options.body,
      '{"nom":"Jeanne Martin","tel":"+33 6 12 34 56 78","email":"jeanne.martin@example.com","langue":"FR",' +
        '"service":"chauffeur","date":"2026-12-12","passagers":"2","message":"Un transfert depuis Roissy.\\nMerci."}',
    );
    for (const interdit of ['203.0.113', 'a_laisser_vide', 'website', 'exemple-du-client', 'pirate@example.com']) {
      assert.ok(!appel.options.body.includes(interdit), interdit);
    }
  });

  test('le corps signé est exactement celui qui est envoyé : UTF-8, sans échappement inutile', async () => {
    const r = await envoyer(
      { nom: 'Zoé Lefèvre', message: 'Voir https://exemple.fr/séjour — dire "bonjour" \\ à محمد 😀' },
      { env: ENV_CRM },
    );
    const [appel] = versCrm(r.appels);
    const brut = appel.options.body;
    assert.equal(
      brut,
      '{"nom":"Zoé Lefèvre","tel":"+33 6 12 34 56 78","email":"jeanne.martin@example.com","langue":"FR",' +
        '"service":"chauffeur","date":"2026-12-12","passagers":"2",' +
        '"message":"Voir https://exemple.fr/séjour — dire \\"bonjour\\" \\\\ à محمد 😀"}',
    );
    assert.ok(!brut.includes('\\u00e9'));
    assert.ok(!brut.includes('\\/'));
    assert.equal(appel.options.headers['X-Amane-Signature'], signatureAttendue(brut));
    // Un octet de plus ou un autre secret, et la signature ne vaut plus rien.
    assert.notEqual(appel.options.headers['X-Amane-Signature'], signatureAttendue(brut + ' '));
    assert.notEqual(appel.options.headers['X-Amane-Signature'], signatureAttendue(brut, T0, CRM_SECRET + 'x'));
  });

  test('valeurs envoyées au CRM : celles de nettoyerDemande, rien de brut', async () => {
    const langues = { fr: 'FR', en: 'EN', es: 'ES', ar: 'AR', ' Ar ': 'AR', 'es-ES': 'ES', de: 'FR', '': 'FR' };
    for (const [saisie, attendue] of Object.entries(langues)) {
      _viderLimite();
      const r = await envoyer({ langue: saisie }, { env: ENV_CRM });
      assert.equal(versCrm(r.appels)[0].corps.langue, attendue, `« ${saisie} »`);
    }

    _viderLimite();
    const brute = await envoyer(
      {
        nom: '  Jean\r\nDupont  ',
        email: '',
        tel: '06 12 34 56 78',
        service: 'Location de yacht',
        date: '12/12/2026',
        passagers: 8,
        message: '  Bonjour\u0000\r\n\r\n\r\n\r\nà vous  ',
      },
      { env: ENV_CRM },
    );
    assert.deepEqual(versCrm(brute.appels)[0].corps, {
      nom: 'Jean Dupont',
      tel: '06 12 34 56 78',
      email: '',
      langue: 'FR',
      service: 'autre',
      date: '',
      passagers: '',
      message: 'Bonjour\n\nà vous',
    });

    _viderLimite();
    const propre = await envoyer({ service: ' Van ', passagers: '8+', date: ' 2028-02-29 ' }, { env: ENV_CRM });
    const { service, passagers, date } = versCrm(propre.appels)[0].corps;
    assert.deepEqual([service, passagers, date], ['van', '8+', '2028-02-29']);
    _viderLimite();
    const nombre = await envoyer({ passagers: 5 }, { env: ENV_CRM });
    assert.equal(versCrm(nombre.appels)[0].corps.passagers, '5', 'toujours une chaîne');
  });

  test('barre finale de CRM_URL retirée', async (t) => {
    const alertes = capterAlertes(t);
    const cas = {
      'https://crm.amane.test/': 'https://crm.amane.test/api/lead',
      'https://crm.amane.test//': 'https://crm.amane.test/api/lead',
      ' https://crm.amane.test/ ': 'https://crm.amane.test/api/lead',
      'https://crm.amane.test/crm/': 'https://crm.amane.test/crm/api/lead',
    };
    for (const [url, attendue] of Object.entries(cas)) {
      _viderLimite();
      const r = await envoyer({}, { env: { ...ENV_CRM, CRM_URL: url } });
      assert.equal(versCrm(r.appels).length, 1, url);
      assert.equal(versCrm(r.appels)[0].url, attendue, url);
    }
    assert.deepEqual(alertes, []);
  });

  test('horodatage de la signature : l’horloge de la demande, en secondes', async () => {
    const r = await envoyer({}, { env: ENV_CRM, now: (T0 + 1234) * 1000 + 999 });
    const [appel] = versCrm(r.appels);
    const signature = appel.options.headers['X-Amane-Signature'];
    assert.ok(signature.startsWith(`t=${T0 + 1234},v1=`));
    assert.equal(signature, signatureAttendue(appel.options.body, T0 + 1234));
  });

  test('e-mail envoyé, CRM en succès → 200 ack:true', async (t) => {
    const journal = capterErreurs(t);
    const r = await envoyer({}, { env: ENV_CRM, fetch: fauxReseau({ crm: [200], brevo: [201, 201] }) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: true });
    assert.deepEqual([versCrm(r.appels).length, versBrevo(r.appels).length], [1, 2]);
    assert.deepEqual(journal, []);
  });

  test('e-mail envoyé, CRM en échec → 200 comme sans le lien, l’échec est seulement journalisé', async (t) => {
    const journal = capterErreurs(t);
    const r = await envoyer({}, { env: ENV_CRM, fetch: fauxReseau({ crm: [500] }) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: true });
    assert.deepEqual([versCrm(r.appels).length, versBrevo(r.appels).length], [1, 2]);
    assert.deepEqual(journal, ['[lead] CRM : HTTP 500']);

    // Téléphone seul : ack:false comme sans le lien, que le CRM ait répondu ou non.
    _viderLimite();
    const tel = await envoyer({ email: '' }, { env: ENV_CRM, fetch: fauxReseau({ crm: [500] }) });
    assert.deepEqual(tel.json, { ok: true, ack: false });
    assert.deepEqual([versCrm(tel.appels).length, versBrevo(tel.appels).length], [1, 1]);
  });

  test('e-mail à l’équipe en échec, CRM en succès → 200 ack:false, sans tenter l’accusé', async (t) => {
    const journal = capterErreurs(t);
    const r = await envoyer({}, { env: ENV_CRM, fetch: fauxReseau({ brevo: [401] }) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: false });
    assert.equal(r.headers, undefined);
    assert.deepEqual(
      [versCrm(r.appels).length, versBrevo(r.appels).length],
      [1, 1],
      'un seul e-mail tenté : pas d’accusé',
    );
    assert.equal(journal.length, 1);
    assert.ok(journal[0].includes('« équipe » : HTTP 401'));
  });

  test('e-mail à l’équipe en échec, CRM en échec → 502 envoi_impossible', async (t) => {
    const journal = capterErreurs(t);
    const r = await envoyer({}, { env: ENV_CRM, fetch: fauxReseau({ crm: [500], brevo: [500] }) });
    assert.equal(r.status, 502);
    assert.deepEqual(r.json, { error: 'envoi_impossible' });
    assert.deepEqual([versCrm(r.appels).length, versBrevo(r.appels).length], [1, 1]);
    assert.equal(journal.length, 2);
    assert.equal(journal[0], '[lead] CRM : HTTP 500');
  });

  test('accusé de réception en échec, CRM en succès → 200 ack:false', async (t) => {
    capterErreurs(t);
    const r = await envoyer({}, { env: ENV_CRM, fetch: fauxReseau({ brevo: [201, 400] }) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, ack: false });
    assert.deepEqual([versCrm(r.appels).length, versBrevo(r.appels).length], [1, 2]);
  });

  test('tout code 2xx du CRM est un succès, tout autre un échec', async (t) => {
    capterErreurs(t);
    for (const code of [200, 201, 204, 299]) {
      _viderLimite();
      const r = await envoyer({}, { env: ENV_CRM, fetch: fauxReseau({ crm: [code], brevo: [500] }) });
      assert.deepEqual(r.json, { ok: true, ack: false }, String(code));
    }
    for (const code of [199, 300, 301, 404]) {
      _viderLimite();
      const r = await envoyer({}, { env: ENV_CRM, fetch: fauxReseau({ crm: [code], brevo: [500] }) });
      assert.equal(r.status, 502, String(code));
    }
  });

  // Ici, la clé Brevo fait partie de la configuration de l'e-mail (pas de repli sur mail()).
  for (const manquante of ['BREVO_API_KEY', 'LEAD_TO_EMAIL', 'LEAD_FROM_EMAIL']) {
    test(`e-mail non configuré (sans ${manquante}), CRM actif : la demande part au CRM seul`, async (t) => {
      const erreurs = capterErreurs(t);
      const alertes = capterAlertes(t);
      const env = { ...ENV_CRM, [manquante]: '' };

      const r = await envoyer({}, { env });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { ok: true, ack: false });
      assert.equal(versCrm(r.appels).length, 1);
      assert.equal(versBrevo(r.appels).length, 0, 'aucun e-mail');
      const [appel] = versCrm(r.appels);
      assert.equal(appel.options.headers['X-Amane-Signature'], signatureAttendue(appel.options.body));
      assert.deepEqual([...erreurs, ...alertes], []);

      _viderLimite();
      const echec = await envoyer({}, { env, fetch: fauxReseau({ crm: [500] }) });
      assert.equal(echec.status, 502);
      assert.deepEqual(echec.json, { error: 'envoi_impossible' });
      assert.equal(versCrm(echec.appels).length, 1);
      assert.equal(versBrevo(echec.appels).length, 0);
      assert.deepEqual(erreurs, ['[lead] CRM : HTTP 500']);
    });
  }

  test('e-mail non configuré, CRM actif : la limite de débit s’applique aussi', async () => {
    const env = { ...ENV_CRM, LEAD_TO_EMAIL: '' };
    for (let i = 1; i <= 5; i++) {
      const r = await envoyer({}, { env, now: T0 * 1000 + i * 1000 });
      assert.equal(r.status, 200);
    }
    const r = await envoyer({}, { env, now: T0 * 1000 + 6000 });
    assert.equal(r.status, 429);
    assert.equal(r.appels.length, 0);
  });

  test('CRM qui refuse (403), en panne (500), qui redirige, dépasse le délai ou reste injoignable : journal sans secret ni contenu', async (t) => {
    const journal = capterErreurs(t);
    const cas = [
      [403, '[lead] CRM : HTTP 403'],
      [500, '[lead] CRM : HTTP 500'],
      [301, '[lead] CRM : HTTP 301'],
      [
        new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
        '[lead] CRM injoignable : délai dépassé',
      ],
      [new TypeError('fetch failed'), '[lead] CRM injoignable : erreur réseau'],
      [
        new Error(`boum ${CRM_SECRET} SECRET-DU-CLIENT https://crm.amane.test/api/lead`),
        '[lead] CRM injoignable : erreur réseau',
      ],
    ];
    for (const [reponse, ligne] of cas) {
      _viderLimite();
      journal.length = 0;
      const r = await envoyer({ message: 'SECRET-DU-CLIENT' }, { env: ENV_CRM, fetch: fauxReseau({ crm: [reponse] }) });
      assert.equal(r.status, 200, ligne);
      assert.deepEqual(r.json, { ok: true, ack: true }, 'l’e-mail est parti : la demande n’est pas perdue');
      assert.deepEqual(journal, [ligne]);
      for (const interdit of [
        CRM_SECRET,
        'SECRET-DU-CLIENT',
        'crm.amane.test',
        'https://',
        'jeanne.martin@example.com',
        'Jeanne',
        '+33 6 12',
        '203.0.113',
      ]) {
        assert.ok(!journal[0].includes(interdit), `le journal ne doit pas contenir « ${interdit} »`);
      }
    }
  });

  test('le corps de la réponse du CRM n’est pas lu', async (t) => {
    capterErreurs(t);
    for (const status of [200, 403]) {
      _viderLimite();
      const acces = [];
      const reponse = {
        status,
        body: { cancel: async () => acces.push('cancel') },
        text: async () => acces.push('text'),
        json: async () => acces.push('json'),
        arrayBuffer: async () => acces.push('arrayBuffer'),
      };
      const { fetchImpl: brevo } = fauxFetch();
      const fetchImpl = (url, options) => (url === BREVO_URL ? brevo(url, options) : Promise.resolve(reponse));
      const r = await processLead({ body: DEMANDE, ip: '203.0.113.15', env: ENV_CRM, fetchImpl });
      assert.deepEqual(r.json, { ok: true, ack: true });
      assert.deepEqual(acces, ['cancel'], 'connexion libérée, corps jamais lu');
    }
  });

  test('le piège à robots, une demande invalide, une origine refusée et la limite de débit n’appellent pas le CRM', async (t) => {
    capterAlertes(t);
    const cas = [
      [{ a_laisser_vide: 'robot' }, {}, 200],
      [{ email: 'invalide' }, {}, 400],
      [{ email: '', tel: '' }, {}, 400],
      [{ tel: '12' }, {}, 400],
      [{}, { body: '{nom:' }, 400],
      [{}, { origin: 'https://pirate.example' }, 403],
    ];
    for (const [surcharge, options, status] of cas) {
      const r = await envoyer(surcharge, { ...options, env: ENV_CRM });
      assert.equal(r.status, status, JSON.stringify([surcharge, options]));
      assert.equal(r.appels.length, 0);
    }

    // Cinq demandes passent, avec un appel au CRM chacune ; la sixième est arrêtée avant le CRM.
    for (let i = 1; i <= 5; i++) {
      const r = await envoyer({}, { env: ENV_CRM, ip: '198.51.100.60', now: T0 * 1000 + i * 1000 });
      assert.equal(r.status, 200, `appel ${i}`);
      assert.equal(versCrm(r.appels).length, 1);
    }
    const sixieme = await envoyer({}, { env: ENV_CRM, ip: '198.51.100.60', now: T0 * 1000 + 6000 });
    assert.equal(sixieme.status, 429);
    assert.deepEqual(sixieme.json, { error: 'trop_de_demandes' });
    assert.equal(sixieme.appels.length, 0);
  });
});

// ---------------------------------------------------------------------------
describe('handler Vercel', () => {
  function fausseRequete({ method = 'POST', headers = {}, corps, body } = {}) {
    const req = corps === undefined ? Readable.from([]) : Readable.from([Buffer.from(corps)]);
    req.method = method;
    req.headers = { host: 'amane.test', origin: 'https://amane.test', 'x-real-ip': '192.0.2.44', ...headers };
    req.socket = { remoteAddress: '127.0.0.1' };
    if (body !== undefined) req.body = body;
    return req;
  }

  function fausseReponse() {
    return {
      statusCode: 200,
      entetes: {},
      texte: undefined,
      setHeader(nom, valeur) {
        this.entetes[nom.toLowerCase()] = valeur;
      },
      end(texte) {
        this.texte = texte;
      },
      get json() {
        return JSON.parse(this.texte);
      },
    };
  }

  /** Remplace fetch et les variables d'environnement le temps d'un test. */
  function simuler(t, env = ENV, ...reponses) {
    const { fetchImpl, appels } = fauxFetch(...reponses);
    t.mock.method(globalThis, 'fetch', fetchImpl);
    const noms = [
      'BREVO_API_KEY',
      'LEAD_TO_EMAIL',
      'LEAD_FROM_EMAIL',
      'LEAD_FROM_NAME',
      'ALLOWED_ORIGINS',
      'CRM_URL',
      'CRM_SECRET',
    ];
    const avant = Object.fromEntries(noms.map((n) => [n, process.env[n]]));
    for (const n of noms) {
      if (env[n] === undefined) delete process.env[n];
      else process.env[n] = env[n];
    }
    t.after(() => {
      for (const n of noms) {
        if (avant[n] === undefined) delete process.env[n];
        else process.env[n] = avant[n];
      }
    });
    return appels;
  }

  function verifierEntetes(res) {
    assert.equal(res.entetes['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.entetes['cache-control'], 'no-store');
  }

  for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']) {
    test(`${method} → 405 avec Allow: POST`, async (t) => {
      const appels = simuler(t);
      const res = fausseReponse();
      await handler(fausseRequete({ method }), res);
      assert.equal(res.statusCode, 405);
      assert.equal(res.entetes.allow, 'POST');
      verifierEntetes(res);
      assert.equal(typeof res.json.error, 'string');
      assert.equal(appels.length, 0);
    });
  }

  test('POST : corps lu sur le flux, deux e-mails, 200', async (t) => {
    const appels = simuler(t);
    const res = fausseReponse();
    await handler(fausseRequete({ corps: JSON.stringify(DEMANDE) }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json, { ok: true, ack: true });
    verifierEntetes(res);
    assert.equal(appels.length, 2);
    assert.equal(appels[0].options.headers['api-key'], CLE);
  });

  test('POST : corps déjà décodé par Vercel (req.body objet)', async (t) => {
    const appels = simuler(t);
    const res = fausseReponse();
    await handler(fausseRequete({ body: { ...DEMANDE, email: '' } }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json, { ok: true, ack: false });
    assert.equal(appels.length, 1);
  });

  test('POST : JSON mal formé → 400', async (t) => {
    const appels = simuler(t);
    const res = fausseReponse();
    await handler(fausseRequete({ corps: '{"nom": ' }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json, { error: 'corps_invalide' });
    verifierEntetes(res);
    assert.equal(appels.length, 0);
  });

  test('POST : corps de plus de 16 Ko → 413 (flux, Content-Length ou objet)', async (t) => {
    const appels = simuler(t);
    const gros = JSON.stringify({ ...DEMANDE, message: 'x'.repeat(17 * 1024) });

    const parFlux = fausseReponse();
    await handler(fausseRequete({ corps: gros }), parFlux);
    assert.equal(parFlux.statusCode, 413);
    verifierEntetes(parFlux);

    const parEntete = fausseReponse();
    await handler(fausseRequete({ corps: '{}', headers: { 'content-length': '20000' } }), parEntete);
    assert.equal(parEntete.statusCode, 413);

    const parObjet = fausseReponse();
    await handler(fausseRequete({ body: JSON.parse(gros) }), parObjet);
    assert.equal(parObjet.statusCode, 413);

    assert.equal(appels.length, 0);
  });

  test('POST : origine étrangère → 403', async (t) => {
    const appels = simuler(t);
    const res = fausseReponse();
    await handler(
      fausseRequete({ corps: JSON.stringify(DEMANDE), headers: { origin: 'https://pirate.example' } }),
      res,
    );
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json, { error: 'origine_refusee' });
    assert.equal(appels.length, 0);
  });

  test('POST : sans configuration → 503', async (t) => {
    const appels = simuler(t, {});
    const res = fausseReponse();
    await handler(fausseRequete({ corps: JSON.stringify(DEMANDE) }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json.error, 'email_off');
    verifierEntetes(res);
    assert.equal(appels.length, 0);
  });

  test('POST : lien CRM actif → la demande part au CRM puis par e-mail, sans l’adresse IP du visiteur', async (t) => {
    const appels = simuler(t, ENV_CRM);
    const res = fausseReponse();
    const avant = Math.floor(Date.now() / 1000);
    await handler(fausseRequete({ corps: JSON.stringify(DEMANDE), headers: { 'x-real-ip': '192.0.2.55' } }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json, { ok: true, ack: true });
    assert.deepEqual(
      appels.map((appel) => appel.url),
      ['https://crm.amane.test/api/lead', BREVO_URL, BREVO_URL],
    );
    const { headers, body } = appels[0].options;
    const [, horodatage, v1] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(headers['X-Amane-Signature']);
    assert.ok(Number(horodatage) >= avant && Number(horodatage) <= avant + 5, 'horodatage : l’heure réelle');
    assert.equal(v1, createHmac('sha256', CRM_SECRET).update(`${horodatage}.${body}`).digest('hex'));
    assert.ok(!body.includes('192.0.2'));
  });

  test('POST : limite par IP lue dans x-real-ip, avec Retry-After', async (t) => {
    simuler(t);
    const corps = JSON.stringify({ ...DEMANDE, email: '' });
    for (let i = 0; i < 5; i++) {
      const res = fausseReponse();
      await handler(fausseRequete({ corps, headers: { 'x-real-ip': '192.0.2.99' } }), res);
      assert.equal(res.statusCode, 200);
    }
    const bloquee = fausseReponse();
    await handler(fausseRequete({ corps, headers: { 'x-real-ip': '192.0.2.99' } }), bloquee);
    assert.equal(bloquee.statusCode, 429);
    assert.deepEqual(bloquee.json, { error: 'trop_de_demandes' });
    assert.ok(Number(bloquee.entetes['retry-after']) > 0);

    const autre = fausseReponse();
    await handler(fausseRequete({ corps, headers: { 'x-real-ip': '192.0.2.100' } }), autre);
    assert.equal(autre.statusCode, 200);
  });
});
