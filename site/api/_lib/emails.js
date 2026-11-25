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

// Longueur maximale du message repris dans l'accusé. L'accusé part vers une
// adresse saisie par un inconnu : on évite d'en faire un relais de texte libre.
const MAX_MESSAGE_ACCUSE = 1000;

// ---------------------------------------------------------------------------
// Textes de l'accusé de réception. « Amane » n'est jamais traduit.
// ---------------------------------------------------------------------------
const TEXTES = {
  fr: {
    dir: 'ltr',
    sujet: 'Nous avons bien reçu votre demande — Amane',
    salut: 'Madame, Monsieur,',
    recu: 'Nous avons bien reçu votre demande.',
    delai: 'Votre interlocuteur vous répond sous vingt-quatre heures, souvent dans l’heure.',
    recap: 'Votre demande',
    champs: {
      nom: 'Nom',
      service: 'Service',
      date: 'Date',
      passagers: 'Passagers',
      tel: 'Téléphone',
      message: 'Message',
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
    champs: {
      nom: 'Name',
      service: 'Service',
      date: 'Date',
      passagers: 'Passengers',
      tel: 'Telephone',
      message: 'Message',
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
    champs: {
      nom: 'Nombre',
      service: 'Servicio',
      date: 'Fecha',
      passagers: 'Pasajeros',
      tel: 'Teléfono',
      message: 'Mensaje',
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
    champs: {
      nom: 'الاسم',
      service: 'الخدمة',
      date: 'التاريخ',
      passagers: 'عدد الركاب',
      tel: 'الهاتف',
      message: 'الرسالة',
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
  if (kind === 'ltr') return `<span dir="ltr" style="unicode-bidi:embed;">${v}</span>`;
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
  const service = uneLigne(lead.service, 80) || 'Service non précisé';
  const nom = uneLigne(lead.nom, 120) || 'Nom non précisé';
  const subject = uneLigne(`Nouvelle demande — ${service} — ${nom}`, 240);
  const langue = langueDe(lead);
  const vide = '—';

  const rangees = [
    { label: 'Nom', value: lead.nom || vide },
    lead.email ? { label: 'E-mail', value: lead.email, kind: 'email' } : { label: 'E-mail', value: vide },
    lead.tel ? { label: 'Téléphone', value: lead.tel, kind: 'tel' } : { label: 'Téléphone', value: vide },
    { label: 'Service', value: lead.service || vide },
    { label: 'Date', value: lead.date || vide },
    { label: 'Passagers', value: lead.passagers || vide },
    { label: 'Langue', value: NOMS_LANGUES[langue] },
    { label: 'Message', value: lead.message || vide, kind: 'multi' },
  ];
  if (lead.recuLe) rangees.push({ label: 'Reçue le', value: `${lead.recuLe} (heure de Paris)` });

  const consigne = lead.email
    ? 'Répondre à ce message écrit directement au client.'
    : 'Le client n’a pas laissé d’e-mail : le joindre par téléphone.';

  const contenu = [
    `<h1 style="margin:0 0 6px 0;font-family:${SERIF};font-size:24px;line-height:32px;font-weight:normal;color:${C.bordeaux};">Nouvelle demande</h1>`,
    paragraphe(`<span dir="auto">${echapper(service)}</span> — <span dir="auto">${echapper(nom)}</span>`, {
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

export function ackEmail(lead = {}) {
  const langue = langueDe(lead);
  const t = TEXTES[langue];

  let message = lead.message || '';
  if (message.length > MAX_MESSAGE_ACCUSE) message = couper(message, MAX_MESSAGE_ACCUSE).trimEnd() + '…';

  const rangees = [
    lead.nom && { label: t.champs.nom, value: lead.nom },
    lead.service && { label: t.champs.service, value: lead.service },
    lead.date && { label: t.champs.date, value: lead.date },
    lead.passagers && { label: t.champs.passagers, value: lead.passagers },
    lead.tel && { label: t.champs.tel, value: lead.tel, kind: 'ltr' },
    message && { label: t.champs.message, value: message, kind: 'multi' },
  ].filter(Boolean);

  const blocs = [
    paragraphe(echapper(t.salut), { marge: '0 0 18px 0' }),
    paragraphe(echapper(t.recu), { marge: '0 0 12px 0', serif: true, taille: 22, hauteur: 30, couleur: C.bordeaux }),
    paragraphe(echapper(t.delai), { marge: '0' }),
  ];
  if (rangees.length) blocs.push(titreSection(t.recap, t.dir), tableauRecap(rangees, t.dir));

  const html = gabarit({
    lang: langue,
    dir: t.dir,
    titreDoc: t.sujet,
    contenu: blocs.join('\n'),
    signature: t.signature,
    note: t.note,
  });

  const lignes = ['AMANE', '', t.salut, '', `${t.recu} ${t.delai}`];
  if (rangees.length) lignes.push('', t.recap, '—', recapTexte(rangees, t.deuxPoints));
  lignes.push('', t.signature, '', t.note);

  return { subject: t.sujet, html, text: lignes.join('\n') };
}
