// Tests de /api/lead — à lancer avec : node --test site/tests/api/
// Aucune requête réseau : fetch est toujours simulé.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import handler from '../../api/lead.js';
import { processLead, _viderLimite, BREVO_URL } from '../../api/_lib/lead-core.js';
import { teamEmail, ackEmail } from '../../api/_lib/emails.js';

const CLE = 'xkeysib-cle-de-test-0123456789';
const ENV = {
  BREVO_API_KEY: CLE,
  LEAD_TO_EMAIL: 'equipe@amane.test',
  LEAD_FROM_EMAIL: 'bonjour@amane.test',
};
const DEMANDE = {
  nom: 'Jeanne Martin',
  email: 'jeanne.martin@example.com',
  tel: '+33 6 12 34 56 78',
  service: 'Chauffeur',
  date: '12 décembre, 19 h',
  passagers: '2',
  langue: 'fr',
  message: 'Un transfert depuis Roissy.\nMerci.',
  website: '',
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

beforeEach(() => _viderLimite());

// ---------------------------------------------------------------------------
describe('pot de miel', () => {
  test('website rempli → 200 {ok:true} sans aucun envoi', async () => {
    const r = await envoyer({ website: 'https://spam.example' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
    assert.equal(r.appels.length, 0);
  });

  test('le piège passe avant la validation et avant la configuration', async () => {
    const r = await envoyer({ website: 'x', email: '', tel: '' }, { env: {} });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
    assert.equal(r.appels.length, 0);
  });

  test('website vide ou fait d’espaces ne déclenche pas le piège', async () => {
    const r = await envoyer({ website: '   ' });
    assert.deepEqual(r.json, { ok: true, ack: true });
    assert.equal(r.appels.length, 2);
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
      service: 'S'.repeat(300),
      date: 'D'.repeat(300),
      passagers: '9'.repeat(30),
      message: 'Bonjour\u0000\u0007 à vous\u202E\r\n' + 'm'.repeat(6000),
    });
    assert.equal(r.status, 200);
    const [equipe] = r.appels;
    assert.ok(equipe.corps.subject.includes('N'.repeat(120)));
    assert.ok(!equipe.corps.subject.includes('N'.repeat(121)));
    assert.ok(equipe.corps.subject.includes('S'.repeat(80)));
    assert.ok(!equipe.corps.subject.includes('S'.repeat(81)));
    const texte = equipe.corps.textContent;
    assert.ok(texte.includes('D'.repeat(40)) && !texte.includes('D'.repeat(41)));
    assert.ok(texte.includes('9'.repeat(8)) && !texte.includes('9'.repeat(9)));
    assert.ok(texte.includes('Bonjour à vous\n'));
    assert.ok(!texte.includes('m'.repeat(4000)));
    assert.ok(!/[\u0000-\u0009\u000B-\u001F\u007F\u202E]/.test(texte));
    assert.ok(!/[\u0000-\u0009\u000B-\u001F\u007F\u202E]/.test(equipe.corps.htmlContent));
  });

  test('valeurs qui ne sont pas des chaînes : ignorées, sauf les nombres', async () => {
    const r = await envoyer({ nom: { a: 1 }, service: ['x'], passagers: 3, message: null });
    assert.equal(r.status, 200);
    const [equipe] = r.appels;
    assert.equal(equipe.corps.subject, 'Nouvelle demande — Service non précisé — Nom non précisé');
    assert.ok(equipe.corps.textContent.includes('Passagers : 3'));
    assert.ok(!equipe.corps.htmlContent.includes('[object Object]'));
  });
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
    assert.equal(equipe.corps.subject, 'Nouvelle demande — Chauffeur — Jeanne Martin');
    for (const valeur of [
      'Jeanne Martin',
      'jeanne.martin@example.com',
      '+33 6 12 34 56 78',
      'Chauffeur',
      '12 décembre, 19 h',
      'Un transfert depuis Roissy.',
    ]) {
      assert.ok(equipe.corps.htmlContent.includes(valeur), `HTML équipe : ${valeur}`);
      assert.ok(equipe.corps.textContent.includes(valeur), `texte équipe : ${valeur}`);
    }
    assert.ok(equipe.corps.htmlContent.includes('Un transfert depuis Roissy.<br>Merci.'));

    assert.deepEqual(accuse.corps.to, [{ email: 'jeanne.martin@example.com', name: 'Jeanne Martin' }]);
    assert.equal(accuse.corps.replyTo, undefined);
    assert.ok(accuse.corps.subject.includes('Amane'));
    assert.ok(accuse.corps.htmlContent.includes('Nous avons bien reçu votre demande.'));
    assert.ok(accuse.corps.textContent.includes('Nous avons bien reçu votre demande.'));
    assert.ok(accuse.corps.textContent.includes('Chauffeur'));
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
    assert.equal(r.appels[0].corps.subject, 'Nouvelle demande — Chauffeur — Nom non précisé');
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
    fr: { dir: 'ltr', phrase: 'Nous avons bien reçu votre demande.', signature: 'Amane — Conciergerie privée · Paris' },
    en: { dir: 'ltr', phrase: 'We have received your request.', signature: 'Amane — Private concierge · Paris' },
    es: { dir: 'ltr', phrase: 'Hemos recibido su solicitud.', signature: 'Amane — Conserjería privada · París' },
    ar: { dir: 'rtl', phrase: 'تلقّينا طلبكم', signature: 'Amane — ' },
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

  test('le message repris dans l’accusé est tronqué, pas celui de l’équipe', async () => {
    const r = await envoyer({ message: 'a'.repeat(3000) });
    assert.ok(r.appels[0].corps.textContent.includes('a'.repeat(3000)));
    assert.ok(r.appels[1].corps.textContent.includes('a'.repeat(1000) + '…'));
    assert.ok(!r.appels[1].corps.textContent.includes('a'.repeat(1001)));
  });
});

// ---------------------------------------------------------------------------
describe('sécurité du contenu', () => {
  test('échappement HTML des valeurs saisies', async () => {
    const r = await envoyer({
      nom: 'Jean <b>Gras</b> & "Fils"',
      service: '<img src=x onerror=alert(1)>',
      date: "12/12 <i>soir</i> l'après-midi",
      message: 'Bonjour <script>alert("xss")</script>\n<a href="https://pirate.example">cliquez</a>',
    });
    assert.equal(r.status, 200);
    for (const { corps } of r.appels) {
      const html = corps.htmlContent;
      assert.ok(!html.includes('<script'), 'pas de balise script');
      assert.ok(!html.includes('<img'), 'pas de balise img');
      assert.ok(!html.includes('<b>Gras</b>'));
      assert.ok(!html.includes('<i>soir</i>'));
      assert.ok(!html.includes('href="https://pirate.example"'));
      assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
      assert.ok(html.includes('Jean &lt;b&gt;Gras&lt;/b&gt; &amp; &quot;Fils&quot;'));
      assert.ok(html.includes('l&#39;après-midi'));
      // La version texte, elle, garde la saisie telle quelle.
      assert.ok(corps.textContent.includes('<script>alert("xss")</script>'));
    }
  });

  test('injection d’en-tête par le nom', async () => {
    const r = await envoyer({ nom: 'Jean Dupont\r\nBcc: pirate@example.com\r\n\r\nCorps forgé' });
    assert.equal(r.status, 200);
    const [equipe, accuse] = r.appels;
    assert.equal(
      equipe.corps.subject,
      'Nouvelle demande — Chauffeur — Jean Dupont Bcc: pirate@example.com Corps forgé',
    );
    for (const valeur of [
      equipe.corps.subject,
      equipe.corps.replyTo.name,
      accuse.corps.subject,
      accuse.corps.to[0].name,
    ]) {
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
    assert.equal(accuse.corps.to.length, 1);
  });

  test('injection d’en-tête par le service, la date ou des séparateurs Unicode', async () => {
    const r = await envoyer({
      service: 'Chauffeur\nSubject: gagné',
      nom: 'Jean\u2028Dupont\u0085fin\tici',
    });
    assert.equal(r.appels[0].corps.subject, 'Nouvelle demande — Chauffeur Subject: gagné — Jean Dupont fin ici');
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

  test('les demandes refusées avant l’envoi ne consomment pas le quota', async () => {
    for (let i = 0; i < 10; i++) {
      await envoyer({ email: 'invalide' }, { ip: '198.51.100.9' });
      await envoyer({ website: 'robot' }, { ip: '198.51.100.9' });
    }
    const r = await envoyer({}, { ip: '198.51.100.9' });
    assert.equal(r.status, 200);
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
    const noms = ['BREVO_API_KEY', 'LEAD_TO_EMAIL', 'LEAD_FROM_EMAIL', 'LEAD_FROM_NAME', 'ALLOWED_ORIGINS'];
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
