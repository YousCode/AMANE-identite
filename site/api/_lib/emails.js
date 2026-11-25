// Construction des deux e-mails envoyés pour chaque demande :
//   - teamEmail(lead) : la demande complète, pour l'équipe (toujours en français) ;
//   - ackEmail(lead)  : l'accusé de réception, dans la langue du client.
// Chaque fonction renvoie { subject, html, text }.
//
// Aucune dépendance, aucune image distante, aucune police web : tableaux et
// styles en ligne uniquement, pour Gmail, Outlook et Apple Mail.
// Toute valeur venue du formulaire est échappée ici, même si elle a déjà été
// nettoyée en amont (lead-core.js).

const C = {
  bordeaux: '#5B1622',
  pierre: '#EFE7DA',
  fond: '#F6F1E8',
  texte: '#2A211E',
  filet: '#D9CFC0',
  or: '#B8955C',
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = 'Helvetica, Arial, sans-serif';

export const LANGUES = ['fr', 'en', 'es', 'ar'];

// Identifiants de service envoyés par le formulaire. Liste fermée : toute autre
// valeur est ramenée à « autre ».
export const SERVICES = [
  'voitures',
  'chauffeur',
  'van',
  'sejours',
  'immobilier',
  'tables',
  'evenements',
  'shopping',
  'esthetique',
  'conciergerie',
  'autre',
];

// Régions utilisées pour écrire la date dans la langue du client. En arabe :
// calendrier grégorien et chiffres latins, quelle que soit la région.
const LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', ar: 'ar-u-ca-gregory-nu-latn' };

// ---------------------------------------------------------------------------
// Textes de l'accusé de réception. « Amane » n'est jamais traduit.
// Les libellés français des services servent aussi à l'e-mail de l'équipe.
// ---------------------------------------------------------------------------
const TEXTES = {
  fr: {
    dir: 'ltr',
    sujet: 'Nous avons bien reçu votre demande — Amane',
    salut: 'Madame, Monsieur,',
    recu: 'Nous avons bien reçu votre demande.',
    delai: 'Votre interlocuteur vous répond sous vingt-quatre heures, souvent dans l’heure.',
    recap: 'Votre demande',
    champs: { service: 'Service', date: 'Date', passagers: 'Passagers' },
    services: {
      voitures: "Voitures d'exception",
      chauffeur: 'Chauffeur privé',
      van: 'Van VIP',
      sejours: 'Séjours clé en main',
      immobilier: 'Immobilier',
      tables: 'Tables & restaurants',
      evenements: 'Événements',
      shopping: 'Personal shopping',
      esthetique: 'Séjour esthétique',
      conciergerie: 'Conciergerie sur demande',
      autre: 'Autre demande',
    },
    deuxPoints: ' : ',
    signature: 'Amane — Conciergerie privée · Paris',
    note: 'Si vous n’êtes pas à l’origine de cette demande, il vous suffit d’ignorer ce message.',
  },
  en: {
    dir: 'ltr',
    sujet: 'We have received your request — Amane',
    salut: 'Dear Sir or Madam,',
    recu: 'We have received your request.',
    delai: 'Your personal contact will reply within twenty-four hours, often within the hour.',
    recap: 'Your request',
    champs: { service: 'Service', date: 'Date', passagers: 'Passengers' },
    services: {
      voitures: 'Exceptional cars',
      chauffeur: 'Private chauffeur',
      van: 'VIP van',
      sejours: 'Turnkey stays',
      immobilier: 'Real estate',
      tables: 'Tables & restaurants',
      evenements: 'Events',
      shopping: 'Personal shopping',
      esthetique: 'Aesthetic stay',
      conciergerie: 'Concierge on request',
      autre: 'Other request',
    },
    deuxPoints: ': ',
    signature: 'Amane — Private concierge · Paris',
    note: 'If you did not make this request, please disregard this message.',
  },
  es: {
    dir: 'ltr',
    sujet: 'Hemos recibido su solicitud — Amane',
    salut: 'Estimada señora, estimado señor:',
    recu: 'Hemos recibido su solicitud.',
    delai: 'Su interlocutor le responderá en un plazo de veinticuatro horas, a menudo en menos de una hora.',
    recap: 'Su solicitud',
    champs: { service: 'Servicio', date: 'Fecha', passagers: 'Pasajeros' },
    services: {
      voitures: 'Coches excepcionales',
      chauffeur: 'Chófer privado',
      van: 'Van VIP',
      sejours: 'Estancias llave en mano',
      immobilier: 'Inmobiliaria',
      tables: 'Mesas y restaurantes',
      evenements: 'Eventos',
      shopping: 'Personal shopping',
      esthetique: 'Estancia estética',
      conciergerie: 'Concierge a demanda',
      autre: 'Otra solicitud',
    },
    deuxPoints: ': ',
    signature: 'Amane — Conserjería privada · París',
    note: 'Si usted no ha realizado esta solicitud, puede ignorar este mensaje.',
  },
  ar: {
    dir: 'rtl',
    sujet: 'تلقّينا طلبكم — Amane',
    salut: 'تحية طيبة،',
    recu: 'لقد تلقّينا طلبكم.',
    delai: 'سيردّ عليكم مستشاركم الخاص خلال أربع وعشرين ساعة، وغالبًا خلال ساعة واحدة.',
    recap: 'طلبكم',
    champs: { service: 'الخدمة', date: 'التاريخ', passagers: 'عدد الركاب' },
    services: {
      voitures: 'سيارات استثنائية',
      chauffeur: 'سائق خاص',
      van: 'فان VIP',
      sejours: 'إقامات متكاملة',
      immobilier: 'العقارات',
      tables: 'المطاعم والحجوزات',
      evenements: 'الفعاليات',
      shopping: 'التسوّق الشخصي',
      esthetique: 'إقامة تجميلية',
      conciergerie: 'كونسيرج عند الطلب',
      autre: 'طلب آخر',
    },
    deuxPoints: ': ',
    signature: 'Amane — كونسيرج خاص · باريس',
    note: 'إذا لم تكونوا أصحاب هذا الطلب، يمكنكم تجاهل هذه الرسالة.',
  },
};

const NOMS_LANGUES = { fr: 'Français', en: 'Anglais', es: 'Espagnol', ar: 'Arabe' };

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

/** Échappe une valeur pour l'insérer dans du HTML (texte ou attribut). */
export function echapper(valeur) {
  return String(valeur ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

/** Coupe une chaîne sans laisser une demi-paire de substitution (émoji) au bout. */
export function couper(texte, max) {
  if (texte.length <= max) return texte;
  return texte.slice(0, max).replace(/[\uD800-\uDBFF]$/, '');
}

/**
 * Ramène une valeur à une seule ligne sûre pour un sujet ou un en-tête :
 * retours à la ligne et tabulations deviennent des espaces, les caractères de
 * contrôle (C0, C1, séparateurs Unicode, marques d'inversion du sens d'écriture)
 * disparaissent.
 */
export function uneLigne(valeur, max = 200) {
  if (typeof valeur === 'number' && Number.isFinite(valeur)) valeur = String(valeur);
  if (typeof valeur !== 'string') return '';
  const propre = valeur
    .replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
  return couper(propre, max).trim();
}

/** Identifiant de service de la liste fermée ; tout le reste (ou vide) devient « autre ». */
export function idService(valeur) {
  const id = uneLigne(valeur, 40).toLowerCase();
  return SERVICES.includes(id) ? id : 'autre';
}

function jourUtc(annee, mois, jour) {
  const d = new Date(0);
  d.setUTCFullYear(annee, mois - 1, jour);
  return d;
}

/** Date au format AAAA-MM-JJ, et qui existe au calendrier ; sinon chaîne vide. */
export function dateIso(valeur) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof valeur === 'string' ? valeur.trim() : '');
  if (!m) return '';
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (annee < 1) return '';
  const d = jourUtc(annee, mois, jour);
  const reelle = d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour;
  return reelle ? m[0] : '';
}

/** Nombre de passagers : « 1 » à « 7 » ou « 8+ » ; sinon chaîne vide. */
export function passagersValides(valeur) {
  const v = uneLigne(valeur, 8);
  return /^(?:[1-7]|8\+)$/.test(v) ? v : '';
}

/** Écrit une date AAAA-MM-JJ déjà validée dans la langue voulue (« 12 décembre 2026 »). */
function formaterDate(iso, langue) {
  const [annee, mois, jour] = iso.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(LOCALES[langue], { timeZone: 'UTC', dateStyle: 'long' }).format(
      jourUtc(annee, mois, jour),
    );
  } catch {
    return iso;
  }
}

function langueDe(lead) {
  const l = String(lead?.langue ?? '').toLowerCase();
  return LANGUES.includes(l) ? l : 'fr';
}

function lienMailto(email) {
  return 'mailto:' + encodeURIComponent(email).replace(/%40/g, '@');
}

function lienTel(tel) {
  const compact = String(tel).replace(/[^\d+]/g, '');
  return /^\+?\d{8,15}$/.test(compact) ? 'tel:' + compact : '';
}

// ---------------------------------------------------------------------------
// Gabarit HTML commun
// ---------------------------------------------------------------------------

const STYLE_LIEN = `color:${C.bordeaux};text-decoration:underline;`;

function valeurHtml({ value, kind }) {
  const v = echapper(value);
  if (kind === 'multi') return `<span dir="auto">${v.replace(/\n/g, '<br>')}</span>`;
  if (kind === 'email') {
    return `<a href="${echapper(lienMailto(value))}" style="${STYLE_LIEN}">${v}</a>`;
  }
  if (kind === 'tel') {
    const href = lienTel(value);
    const texte = `<span dir="ltr" style="unicode-bidi:embed;">${v}</span>`;
    return href ? `<a href="${echapper(href)}" style="${STYLE_LIEN}">${texte}</a>` : texte;
  }
  return `<span dir="auto">${v}</span>`;
}

function tableauRecap(rangees, dir) {
  const rtl = dir === 'rtl';
  const align = rtl ? 'right' : 'left';
  // Pas d'interlettrage ni de capitales en arabe : cela casse la ligature des lettres.
  const styleLabel = rtl
    ? 'font-size:13px;line-height:22px;'
    : 'font-size:11px;line-height:22px;letter-spacing:1.5px;text-transform:uppercase;';
  const margeLabel = rtl ? 'padding:10px 0 10px 12px;' : 'padding:10px 12px 10px 0;';
  const lignes = rangees
    .map(
      (r) => `<tr>
<td width="32%" valign="top" align="${align}" style="border-top:1px solid ${C.filet};${margeLabel}font-family:${SANS};${styleLabel}color:${C.bordeaux};">${echapper(r.label)}</td>
<td valign="top" align="${align}" style="border-top:1px solid ${C.filet};padding:10px 0;font-family:${SANS};font-size:15px;line-height:22px;color:${C.texte};word-break:break-word;">${valeurHtml(r)}</td>
</tr>`,
    )
    .join('\n');
  return `<table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-bottom:1px solid ${C.filet};">
${lignes}
</table>`;
}

/**
 * Enveloppe commune : fond pierre, bandeau bordeaux « AMANE », filet or,
 * contenu, signature. `contenu` est du HTML déjà échappé.
 */
function gabarit({ lang, dir, titreDoc, contenu, signature, note }) {
  const align = dir === 'rtl' ? 'right' : 'left';
  // Pas d'italique en arabe : l'écriture n'en a pas, le rendu serait un faux penché.
  const italique = dir === 'rtl' ? '' : 'font-style:italic;';
  const blocNote = note
    ? `
<tr><td align="${align}" style="padding:0 32px 28px 32px;font-family:${SANS};font-size:12px;line-height:18px;color:${C.texte};">${echapper(note)}</td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${echapper(titreDoc)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.fond};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.fond}" style="width:100%;background-color:${C.fond};">
<tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.fond}" style="width:100%;max-width:560px;background-color:${C.fond};border:1px solid ${C.filet};">
<tr><td dir="ltr" align="center" bgcolor="${C.bordeaux}" style="background-color:${C.bordeaux};padding:30px 24px 28px 33px;font-family:${SERIF};font-size:22px;line-height:28px;letter-spacing:9px;color:${C.pierre};">AMANE</td></tr>
<tr><td bgcolor="${C.or}" height="1" style="height:1px;line-height:1px;font-size:1px;background-color:${C.or};">&nbsp;</td></tr>
<tr><td align="${align}" style="padding:36px 32px 28px 32px;">
${contenu}
</td></tr>
<tr><td align="${align}" style="padding:0 32px 28px 32px;font-family:${SERIF};font-size:15px;line-height:22px;${italique}color:${C.bordeaux};">${echapper(signature)}</td></tr>${blocNote}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

function paragraphe(texte, { marge = '0 0 16px 0', serif = false, taille = 15, hauteur = 24, couleur = C.texte } = {}) {
  return `<p style="margin:${marge};font-family:${serif ? SERIF : SANS};font-size:${taille}px;line-height:${hauteur}px;font-weight:normal;color:${couleur};">${texte}</p>`;
}

function titreSection(texte, dir) {
  const style =
    dir === 'rtl'
      ? 'font-size:14px;line-height:22px;'
      : 'font-size:11px;line-height:18px;letter-spacing:2px;text-transform:uppercase;';
  return `<p style="margin:28px 0 10px 0;font-family:${SANS};${style}font-weight:bold;color:${C.bordeaux};">${echapper(texte)}</p>`;
}

function recapTexte(rangees, deuxPoints) {
  return rangees
    .map((r) =>
      r.kind === 'multi' ? `${r.label}${deuxPoints.trimEnd()}\n${r.value}` : `${r.label}${deuxPoints}${r.value}`,
    )
    .join('\n');
}

// ---------------------------------------------------------------------------
// E-mail à l'équipe
// ---------------------------------------------------------------------------

export function teamEmail(lead = {}) {
  const service = TEXTES.fr.services[idService(lead.service)];
  const nom = uneLigne(lead.nom, 120) || 'Nom non précisé';
  const subject = uneLigne(`Nouvelle demande — ${service} — ${nom}`, 240);
  const langue = langueDe(lead);
  const date = dateIso(lead.date);
  const vide = '—';

  const rangees = [
    { label: 'Nom', value: lead.nom || vide },
    lead.email ? { label: 'E-mail', value: lead.email, kind: 'email' } : { label: 'E-mail', value: vide },
    lead.tel ? { label: 'Téléphone', value: lead.tel, kind: 'tel' } : { label: 'Téléphone', value: vide },
    { label: 'Service', value: service },
    { label: 'Date', value: date ? formaterDate(date, 'fr') : vide },
    { label: 'Passagers', value: passagersValides(lead.passagers) || vide },
    { label: 'Langue', value: NOMS_LANGUES[langue] },
    { label: 'Message', value: lead.message || vide, kind: 'multi' },
  ];
  if (lead.recuLe) rangees.push({ label: 'Reçue le', value: `${lead.recuLe} (heure de Paris)` });

  const consigne = lead.email
    ? 'Répondre à ce message écrit directement au client.'
    : 'Le client n’a pas laissé d’e-mail : le joindre par téléphone.';

  const contenu = [
    `<h1 style="margin:0 0 6px 0;font-family:${SERIF};font-size:24px;line-height:32px;font-weight:normal;color:${C.bordeaux};">Nouvelle demande</h1>`,
    paragraphe(`${echapper(service)} — <span dir="auto">${echapper(nom)}</span>`, {
      marge: '0 0 24px 0',
    }),
    tableauRecap(rangees, 'ltr'),
    paragraphe(echapper(consigne), { marge: '20px 0 0 0', taille: 13, hauteur: 20 }),
  ].join('\n');

  const html = gabarit({
    lang: 'fr',
    dir: 'ltr',
    titreDoc: subject,
    contenu,
    signature: TEXTES.fr.signature,
  });

  const text = [
    'AMANE',
    '',
    'Nouvelle demande',
    `${service} — ${nom}`,
    '',
    recapTexte(rangees, ' : '),
    '',
    consigne,
    '',
    TEXTES.fr.signature,
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Accusé de réception au client
// ---------------------------------------------------------------------------

// L'accusé part vers une adresse saisie par un inconnu, qui n'est pas forcément
// la sienne. Il ne reprend donc AUCUN texte libre de la demande (ni nom, ni
// message, ni téléphone) : seulement des valeurs choisies dans des listes fermées
// — le libellé du service, la date, le nombre de passagers. Ainsi, personne ne
// peut se servir du formulaire pour faire envoyer son propre texte à un tiers
// sous l'en-tête Amane. Ne rien ajouter ici qui vienne tel quel du formulaire.
export function ackEmail(lead = {}) {
  const langue = langueDe(lead);
  const t = TEXTES[langue];
  const date = dateIso(lead.date);
  const passagers = passagersValides(lead.passagers);

  const rangees = [
    { label: t.champs.service, value: t.services[idService(lead.service)] },
    date && { label: t.champs.date, value: formaterDate(date, langue) },
    passagers && { label: t.champs.passagers, value: passagers },
  ].filter(Boolean);

  const blocs = [
    paragraphe(echapper(t.salut), { marge: '0 0 18px 0' }),
    paragraphe(echapper(t.recu), { marge: '0 0 12px 0', serif: true, taille: 22, hauteur: 30, couleur: C.bordeaux }),
    paragraphe(echapper(t.delai), { marge: '0' }),
  ];
  blocs.push(titreSection(t.recap, t.dir), tableauRecap(rangees, t.dir));

  const html = gabarit({
    lang: langue,
    dir: t.dir,
    titreDoc: t.sujet,
    contenu: blocs.join('\n'),
    signature: t.signature,
    note: t.note,
  });

  const lignes = ['AMANE', '', t.salut, '', `${t.recu} ${t.delai}`];
  lignes.push('', t.recap, '—', recapTexte(rangees, t.deuxPoints));
  lignes.push('', t.signature, '', t.note);

  return { subject: t.sujet, html, text: lignes.join('\n') };
}
