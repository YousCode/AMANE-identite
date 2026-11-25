import base from './i18n-base.json';

export const LANGS = ['fr', 'en', 'es', 'ar'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_META: Record<
  Lang,
  { name: string; short: string; path: string; locale: string; dir: 'ltr' | 'rtl' }
> = {
  fr: { name: 'Français', short: 'FR', path: '/', locale: 'fr_FR', dir: 'ltr' },
  en: { name: 'English', short: 'EN', path: '/en/', locale: 'en_GB', dir: 'ltr' },
  es: { name: 'Español', short: 'ES', path: '/es/', locale: 'es_ES', dir: 'ltr' },
  ar: { name: 'العربية', short: 'AR', path: '/ar/', locale: 'ar_AR', dir: 'rtl' },
};

export function langFromPath(pathname: string): Lang {
  const seg = pathname.split('/')[1];
  return (LANGS as readonly string[]).includes(seg) && seg !== 'fr' ? (seg as Lang) : 'fr';
}

type Triple = [string, string, string];
type Pair = [string, string];

/** Textes repris du site d'origine (src/i18n-base.json), relus dans les quatre langues. */
type Base = {
  n1: string;
  n2: string;
  n3: string;
  n4: string;
  cta: string;
  scroll: string;
  hk: string;
  h1: string;
  hs: string;
  mk: string;
  mt: string;
  mp: string;
  p1t: string;
  p1: string;
  p2t: string;
  p2: string;
  p3t: string;
  p3: string;
  sk: string;
  st: string;
  sn: string;
  s1: Triple;
  s2: Triple;
  s3: Triple;
  s4: Triple;
  s5: Triple;
  s6: Triple;
  rk: string;
  rt: string;
  steps: Pair[];
  fk: string;
  ft: string;
  fp: string;
  c1: Pair;
  c2: Pair;
  c3: Pair;
  c4: Pair;
  qk: string;
  qt: string;
  qa: Pair[];
  ak: string;
  at: string;
  ap: string;
  l1: string;
  l2: string;
  l3: string;
  l4: string;
  l6: string;
  fo1: string;
  fo2: string;
  it: string;
  ip: string;
  tags: string[];
  other: string;
  intl: string;
  menu: string;
  close: string;
  ask: string;
};

/** Textes propres à cette version : référencement, formulaire relié à l'e-mail, accessibilité. */
type Extra = {
  metaTitle: string;
  metaDesc: string;
  skip: string;
  langLabel: string;
  doorAlt: string;
  lEmail: string;
  lTel: string;
  contactHint: string;
  send: string;
  sending: string;
  okT: string;
  okP: string;
  okAck: string;
  again: string;
  errContact: string;
  errEmail: string;
  errTel: string;
  errSend: string;
  errRate: string;
  privacy: string;
  wa: string;
};

export type Dict = Base & Extra;

const extra: Record<Lang, Extra> = {
  fr: {
    metaTitle: 'Amane — Conciergerie privée à Paris | Voitures & chauffeurs',
    metaDesc:
      "Conciergerie privée à Paris : voitures d'exception, chauffeur privé, van VIP, personal shopping et séjours sur mesure. Un seul interlocuteur, sur rendez-vous.",
    skip: 'Aller au contenu',
    langLabel: 'Langue',
    doorAlt: "Porte cochère bordeaux d'un immeuble haussmannien, à Paris, la nuit",
    lEmail: 'E-mail',
    lTel: 'Téléphone',
    contactHint: 'Un e-mail ou un téléphone suffit.',
    send: 'Envoyer la demande',
    sending: 'Envoi en cours…',
    okT: 'Demande <em>reçue.</em>',
    okP: "Votre interlocuteur vous répond sous vingt-quatre heures, souvent dans l'heure.",
    okAck: 'Un accusé de réception vient de vous être envoyé par e-mail.',
    again: 'Faire une autre demande',
    errContact: 'Indiquez un e-mail ou un téléphone.',
    errEmail: 'Adresse e-mail invalide.',
    errTel: 'Numéro de téléphone invalide.',
    errSend: "L'envoi n'a pas abouti. Réessayez dans un instant.",
    errRate: 'Trop de demandes envoyées. Réessayez plus tard.',
    privacy: 'Vos coordonnées sont transmises à la maison Amane, uniquement pour vous répondre.',
    wa: 'Écrire sur WhatsApp',
  },
  en: {
    metaTitle: 'Amane — Private Concierge in Paris | Luxury Cars & Chauffeurs',
    metaDesc:
      'Private concierge in Paris: exceptional cars, private chauffeurs, VIP vans, personal shopping and tailor-made stays. A single point of contact, by appointment.',
    skip: 'Skip to content',
    langLabel: 'Language',
    doorAlt: 'Burgundy carriage door of a Haussmann building in Paris, at night',
    lEmail: 'Email',
    lTel: 'Phone',
    contactHint: 'An email or a phone number is enough.',
    send: 'Send the request',
    sending: 'Sending…',
    okT: 'Request <em>received.</em>',
    okP: 'Your contact will answer within twenty-four hours, often within the hour.',
    okAck: 'A confirmation has just been sent to you by email.',
    again: 'Make another request',
    errContact: 'Enter an email or a phone number.',
    errEmail: 'Invalid email address.',
    errTel: 'Invalid phone number.',
    errSend: 'The request could not be sent. Please try again in a moment.',
    errRate: 'Too many requests sent. Please try again later.',
    privacy: 'Your details are sent to the Amane house, only to answer you.',
    wa: 'Write on WhatsApp',
  },
  es: {
    metaTitle: 'Amane — Concierge privado en París | Coches y chóferes',
    metaDesc:
      'Concierge privado en París: coches excepcionales, chófer privado, van VIP, personal shopping y estancias a medida. Un único interlocutor, con cita previa.',
    skip: 'Ir al contenido',
    langLabel: 'Idioma',
    doorAlt: 'Portón burdeos de un edificio haussmanniano en París, de noche',
    lEmail: 'Correo electrónico',
    lTel: 'Teléfono',
    contactHint: 'Basta un correo o un teléfono.',
    send: 'Enviar la solicitud',
    sending: 'Enviando…',
    okT: 'Solicitud <em>recibida.</em>',
    okP: 'Su interlocutor le responderá en menos de veinticuatro horas, a menudo en menos de una hora.',
    okAck: 'Acabamos de enviarle un acuse de recibo por correo electrónico.',
    again: 'Hacer otra solicitud',
    errContact: 'Indique un correo o un teléfono.',
    errEmail: 'Correo electrónico no válido.',
    errTel: 'Número de teléfono no válido.',
    errSend: 'No se pudo enviar. Inténtelo de nuevo en un momento.',
    errRate: 'Demasiadas solicitudes. Inténtelo más tarde.',
    privacy: 'Sus datos se envían a la casa Amane, solo para responderle.',
    wa: 'Escribir por WhatsApp',
  },
  ar: {
    metaTitle: 'Amane — كونسيرج خاص في باريس | سيارات فاخرة وسائقون',
    metaDesc:
      'Amane، كونسيرج خاص في باريس: سيارات استثنائية، سائقون خاصون، فان VIP، تسوّق شخصي وإقامات متكاملة. جهة تواصل واحدة، بمواعيد مسبقة.',
    skip: 'انتقل إلى المحتوى',
    langLabel: 'اللغة',
    doorAlt: 'بوابة بلون النبيذ لمبنى هوسماني في باريس ليلاً',
    lEmail: 'البريد الإلكتروني',
    lTel: 'الهاتف',
    contactHint: 'يكفي بريد إلكتروني أو رقم هاتف.',
    send: 'إرسال الطلب',
    sending: 'جارٍ الإرسال…',
    okT: 'تم استلام <em>طلبك.</em>',
    okP: 'سيردّ عليك محاورك خلال أربع وعشرين ساعة، وغالباً خلال ساعة.',
    okAck: 'أرسلنا إليك للتوّ إشعاراً بالاستلام عبر البريد الإلكتروني.',
    again: 'تقديم طلب آخر',
    errContact: 'أدخل بريداً إلكترونياً أو رقم هاتف.',
    errEmail: 'عنوان البريد الإلكتروني غير صالح.',
    errTel: 'رقم الهاتف غير صالح.',
    errSend: 'تعذّر الإرسال. حاول مجدداً بعد لحظات.',
    errRate: 'عدد الطلبات كبير. حاول لاحقاً.',
    privacy: 'تُرسَل بياناتك إلى دار Amane، فقط للردّ عليك.',
    wa: 'راسلنا عبر واتساب',
  },
};

/** Typographie française : apostrophe courbe, espace insécable avant « : », fine insécable avant « ; ! ? ». */
const frTypo = (s: string) =>
  s
    .replace(/'/g, '\u2019')
    .replace(/ :/g, '\u00A0:')
    .replace(/ ([;!?])/g, '\u202F$1');

function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)])) as T;
  }
  return value;
}

const cache = new Map<Lang, Dict>();

export function dict(lang: Lang): Dict {
  let d = cache.get(lang);
  if (!d) {
    d = { ...(base as unknown as Record<Lang, Base>)[lang], ...extra[lang] };
    if (lang === 'fr') d = mapStrings(d, frTypo);
    cache.set(lang, d);
  }
  return d;
}

/** Les six services, dans l'ordre de la page. `id` sert d'ancre et de valeur envoyée au serveur. */
export const SERVICES = [
  { key: 's1', id: 'voitures', film: 'jour-montaigne', portrait: '' },
  { key: 's2', id: 'chauffeur', film: 'volant', portrait: 'm-chauffeur' },
  { key: 's3', id: 'van', film: 'van', portrait: 'm-van' },
  { key: 's4', id: 'shopping', film: 'shopping', portrait: '' },
  { key: 's5', id: 'sejours', film: 'salon', portrait: '' },
  { key: 's6', id: 'conciergerie', film: 'cour', portrait: '' },
] as const;

export const FLEET = [
  { key: 'c1', img: 'img/fleet-m5.jpg' },
  { key: 'c2', img: 'img/fleet-g63.jpg' },
  { key: 'c3', img: 'img/fleet-f296.jpg' },
  { key: 'c4', img: 'img/fleet-classev.jpg' },
] as const;

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Retire les balises d'emphase d'un texte du dictionnaire (balises meta, données structurées). */
export const plain = (s: string) => s.replace(/<\/?em>/g, '');
