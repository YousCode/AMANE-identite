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
  cta2: string;
  hk: string;
  h1: string;
  hs: string;
  mk: string;
  mt: string;
  mp: string;
  bp: string;
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
  /** Demande en trois étapes */
  stepNames: [string, string, string];
  next: string;
  back: string;
  cardTitle: string;
  cardEmpty: string;
  pax: (n: string) => string;
  /** Services ajoutés à ceux du site d'origine : immobilier, tables, événements, séjour esthétique, création */
  s7: Triple;
  s8: Triple;
  s9: Triple;
  s10: Triple;
  s11: Triple;
  /** Intitulé de la liste des cabinets partenaires, quand elle est renseignée */
  eList: string;
  /** Le récit : sept chapitres entre le prologue (la porte s'ouvre) et l'épilogue (elle se referme) */
  chap: string;
  chapters: [Pair, Pair, Pair, Pair, Pair, Pair, Pair];
  epK: string;
  epT: string;
  /** Fil du récit (colonne de droite) et invitation à défiler */
  prologue: string;
  recit: string;
  scroll: string;
  /** Jeu de cartes */
  jk: string;
  jt: string;
  jp: string;
  /** Rôles des quatre figures, puis noms des deux as. */
  jRoles: [string, string, string, string, string, string];
  jShuffle: string;
  jHint: string;
  /** Réalisations (partie Création & marketing) */
  wk: string;
  wt: string;
  wp: string;
  /** Filtres : tout, films, visuels, sites */
  wFilters: [string, string, string, string];
  /** Nature d'une réalisation : film, visuel, site */
  wKinds: [string, string, string];
  wVisit: string;
  wClose: string;
  wFor: string;
  wMore: string;
  wWith: string;
  /** Ce que la maison a fait sur une réalisation : les clés sont celles de `roles` dans src/realisations.ts. */
  wRoles: Record<string, string>;
};

export type Dict = Base & Extra;

const extra: Record<Lang, Extra> = {
  fr: {
    metaTitle: 'Amane — Conciergerie privée à Paris | Voitures & chauffeurs',
    metaDesc:
      "Conciergerie privée à Paris : voitures d'exception, chauffeur, séjours, immobilier, tables et événements. Un seul interlocuteur, sur rendez-vous.",
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
    stepNames: ['L’occasion', 'Le moment', 'Vous joindre'],
    next: 'Continuer',
    back: 'Retour',
    cardTitle: 'Votre demande',
    cardEmpty: 'Elle se compose à mesure que vous répondez.',
    pax: (n) => (n === '1' ? '1 passager' : `${n} passagers`),
    s7: [
      'Immobilier',
      "Des biens d'exception à Paris, proposés en toute confidentialité et présentés en visite privée.",
      'Paris · Visites privées',
    ],
    s8: [
      'Tables & restaurants',
      'La bonne table, au bon moment : des réservations dans les adresses les plus demandées de Paris.',
      'Dîners · Tables privées',
    ],
    s9: [
      'Événements',
      'Dîners privés, anniversaires, réceptions : nous trouvons le lieu, réunissons les prestataires et réglons chaque détail.',
      'Privés · Professionnels',
    ],
    s10: [
      'Séjour esthétique',
      "Pour les patients de nos cabinets partenaires de médecine esthétique : accueil à l'aéroport, chauffeur le jour du rendez-vous, hôtel au calme et retour serein.",
      'Cabinets partenaires · Paris',
    ],
    s11: [
      'Création & marketing',
      'Films de marque, contenus pour les réseaux, sites internet : nous concevons et produisons l’image de votre maison.',
      'Vidéo · Sites internet · Réseaux',
    ],
    eList: 'Cabinets partenaires',
    chap: 'Chapitre',
    chapters: [
      [
        'L’arrivée',
        'Vous atterrissez, on vous attend déjà. Les bagages sont pris, la portière est ouverte, Paris commence.',
      ],
      ['La route', 'La voiture qui vous ressemble, ou un chauffeur qui connaît chaque rue. Vous choisissez le rythme.'],
      ['L’adresse', 'Une suite pour quelques nuits, un appartement pour une saison, un bien pour la vie.'],
      ['La table', 'La table qu’on ne trouve plus, le dîner qu’on n’oublie pas. Nous réservons, nous composons.'],
      ['Le temps pour soi', 'Une matinée faubourg Saint-Honoré, un rendez-vous que personne n’a besoin de connaître.'],
      ['L’image', 'Un film, un site, une campagne : nous donnons à votre maison l’image qu’elle mérite.'],
      [
        'Tout le reste',
        'Ce qui n’entre dans aucune case. Demandez : c’est souvent là que l’histoire devient la vôtre.',
      ],
    ],
    epK: 'Épilogue',
    epT: 'La porte se referme. <em>L’histoire, elle, vous suit.</em>',
    prologue: 'Prologue',
    recit: 'Le récit',
    scroll: 'Défiler',
    jk: 'Le jeu Amane',
    jt: 'Quatre figures, <em>une seule maison.</em>',
    jp: 'Cinquante-quatre cartes dessinées pour Amane. Le Voiturier, la Parisienne, le Gentleman et le Majordome y tiennent les rôles du valet, de la dame, du roi et du joker.',
    jRoles: ['Valet', 'Dame', 'Roi', 'Joker', 'As de cœur', 'As de pique'],
    jShuffle: 'Battre les cartes',
    jHint: 'Choisissez une carte',
    wk: 'Réalisations',
    wt: 'Ce que nous <em>signons.</em>',
    wp: 'Films, visuels et sites : ce que nous faisons, ce que nous signons, et pour qui.',
    wFilters: ['Tout', 'Films', 'Visuels', 'Sites'],
    wKinds: ['Film', 'Visuel', 'Site'],
    wVisit: 'Voir le site',
    wClose: 'Fermer',
    wFor: 'Pour',
    wMore: 'Détails du projet',
    wWith: 'Avec',
    wRoles: {
      da: 'Direction artistique',
      film: 'Réalisation',
      montage: 'Montage',
      photo: 'Photographie',
      identite: 'Identité visuelle',
      illustration: 'Illustration',
      design: 'Design',
      dev: 'Développement',
      seo: 'Référencement',
      social: 'Réseaux sociaux',
    },
  },
  en: {
    metaTitle: 'Amane — Private Concierge in Paris | Luxury Cars & Chauffeurs',
    metaDesc:
      'Private concierge in Paris: exceptional cars, chauffeurs, stays, real estate, tables and events. A single point of contact, by appointment.',
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
    stepNames: ['The occasion', 'The moment', 'Reaching you'],
    next: 'Continue',
    back: 'Back',
    cardTitle: 'Your request',
    cardEmpty: 'It takes shape as you answer.',
    pax: (n) => (n === '1' ? '1 passenger' : `${n} passengers`),
    s7: [
      'Real estate',
      'Exceptional properties in Paris, offered in complete confidence and shown by private viewing.',
      'Paris · Private viewings',
    ],
    s8: [
      'Tables & restaurants',
      'The right table at the right time: reservations at the most sought-after addresses in Paris.',
      'Dinners · Private tables',
    ],
    s9: [
      'Events',
      'Private dinners, birthdays, receptions: we find the venue, bring the suppliers together and settle every detail.',
      'Private · Corporate',
    ],
    s10: [
      'Aesthetic stay',
      'For patients of our partner aesthetic medicine clinics: airport welcome, a chauffeur on the day of the appointment, a quiet hotel and a serene journey home.',
      'Partner clinics · Paris',
    ],
    s11: [
      'Creative & marketing',
      'Brand films, social content, websites: we design and produce the image of your house.',
      'Video · Websites · Social',
    ],
    eList: 'Partner clinics',
    chap: 'Chapter',
    chapters: [
      ['The arrival', 'You land; we are already waiting. Your luggage is taken, the door is open, Paris begins.'],
      ['The road', 'The car that suits you, or a chauffeur who knows every street. You set the pace.'],
      ['The address', 'A suite for a few nights, an apartment for a season, a property for life.'],
      ['The table', 'The table no one can get, the dinner no one forgets. We reserve, we compose.'],
      ['Time for yourself', 'A morning on the Faubourg Saint-Honoré, an appointment no one needs to know about.'],
      ['The image', 'A film, a website, a campaign: we give your house the image it deserves.'],
      ['Everything else', 'Whatever fits no category. Ask: that is often where the story becomes yours.'],
    ],
    epK: 'Epilogue',
    epT: 'The door closes. <em>The story stays with you.</em>',
    prologue: 'Prologue',
    recit: 'The story',
    scroll: 'Scroll',
    jk: 'The Amane deck',
    jt: 'Four figures, <em>one house.</em>',
    jp: 'Fifty-four cards drawn for Amane. Le Voiturier, la Parisienne, le Gentleman and le Majordome play the jack, the queen, the king and the joker.',
    jRoles: ['Jack', 'Queen', 'King', 'Joker', 'Ace of hearts', 'Ace of spades'],
    jShuffle: 'Shuffle the deck',
    jHint: 'Pick a card',
    wk: 'Our work',
    wt: 'What we <em>sign.</em>',
    wp: 'Films, visuals and websites: what we make, what we sign, and for whom.',
    wFilters: ['All', 'Films', 'Visuals', 'Websites'],
    wKinds: ['Film', 'Visual', 'Website'],
    wVisit: 'Visit the site',
    wClose: 'Close',
    wFor: 'For',
    wMore: 'Project details',
    wWith: 'With',
    wRoles: {
      da: 'Art direction',
      film: 'Film direction',
      montage: 'Editing',
      photo: 'Photography',
      identite: 'Visual identity',
      illustration: 'Illustration',
      design: 'Design',
      dev: 'Development',
      seo: 'SEO',
      social: 'Social media',
    },
  },
  es: {
    metaTitle: 'Amane — Concierge privado en París | Coches y chóferes',
    metaDesc:
      'Concierge privado en París: coches excepcionales, chóferes, estancias, inmobiliaria, mesas y eventos. Un único interlocutor, con cita previa.',
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
    stepNames: ['La ocasión', 'El momento', 'Su contacto'],
    next: 'Continuar',
    back: 'Atrás',
    cardTitle: 'Su solicitud',
    cardEmpty: 'Se compone a medida que usted responde.',
    pax: (n) => (n === '1' ? '1 pasajero' : `${n} pasajeros`),
    s7: [
      'Inmobiliaria',
      'Propiedades excepcionales en París, ofrecidas con total confidencialidad y presentadas en visita privada.',
      'París · Visitas privadas',
    ],
    s8: [
      'Mesas y restaurantes',
      'La mesa adecuada en el momento justo: reservas en las direcciones más solicitadas de París.',
      'Cenas · Mesas privadas',
    ],
    s9: [
      'Eventos',
      'Cenas privadas, cumpleaños, recepciones: encontramos el lugar, reunimos a los proveedores y cuidamos cada detalle.',
      'Privados · Profesionales',
    ],
    s10: [
      'Estancia estética',
      'Para los pacientes de nuestras clínicas asociadas de medicina estética: recepción en el aeropuerto, chófer el día de la cita, hotel tranquilo y regreso sereno.',
      'Clínicas asociadas · París',
    ],
    s11: [
      'Creación y marketing',
      'Películas de marca, contenidos para redes, sitios web: diseñamos y producimos la imagen de su casa.',
      'Vídeo · Sitios web · Redes',
    ],
    eList: 'Clínicas asociadas',
    chap: 'Capítulo',
    chapters: [
      ['La llegada', 'Usted aterriza y ya le esperamos. El equipaje está recogido, la puerta abierta, París empieza.'],
      ['El camino', 'El coche que va con usted, o un chófer que conoce cada calle. Usted marca el ritmo.'],
      [
        'La dirección',
        'Una suite para unas noches, un apartamento para una temporada, una propiedad para toda la vida.',
      ],
      ['La mesa', 'La mesa imposible, la cena inolvidable. Nosotros reservamos, nosotros componemos.'],
      ['Tiempo para usted', 'Una mañana en el Faubourg Saint-Honoré, una cita que nadie necesita conocer.'],
      ['La imagen', 'Una película, un sitio web, una campaña: damos a su casa la imagen que merece.'],
      ['Todo lo demás', 'Lo que no cabe en ninguna casilla. Pídalo: a menudo ahí la historia se vuelve suya.'],
    ],
    epK: 'Epílogo',
    epT: 'La puerta se cierra. <em>La historia le acompaña.</em>',
    prologue: 'Prólogo',
    recit: 'La historia',
    scroll: 'Desliza',
    jk: 'La baraja Amane',
    jt: 'Cuatro figuras, <em>una sola casa.</em>',
    jp: 'Cincuenta y cuatro cartas dibujadas para Amane. Le Voiturier, la Parisienne, le Gentleman y le Majordome hacen de jota, dama, rey y comodín.',
    jRoles: ['Jota', 'Dama', 'Rey', 'Comodín', 'As de corazones', 'As de picas'],
    jShuffle: 'Barajar',
    jHint: 'Elija una carta',
    wk: 'Trabajos',
    wt: 'Lo que <em>firmamos.</em>',
    wp: 'Películas, visuales y sitios web: lo que hacemos, lo que firmamos y para quién.',
    wFilters: ['Todo', 'Películas', 'Visuales', 'Sitios'],
    wKinds: ['Película', 'Visual', 'Sitio web'],
    wVisit: 'Ver el sitio',
    wClose: 'Cerrar',
    wFor: 'Para',
    wMore: 'Detalles del proyecto',
    wWith: 'Con',
    wRoles: {
      da: 'Dirección de arte',
      film: 'Realización',
      montage: 'Montaje',
      photo: 'Fotografía',
      identite: 'Identidad visual',
      illustration: 'Ilustración',
      design: 'Diseño',
      dev: 'Desarrollo',
      seo: 'SEO',
      social: 'Redes sociales',
    },
  },
  ar: {
    metaTitle: 'Amane — كونسيرج خاص في باريس | سيارات فاخرة وسائقون',
    metaDesc:
      'Amane، كونسيرج خاص في باريس: سيارات استثنائية، سائقون، إقامات، عقارات، مطاعم وفعاليات. جهة تواصل واحدة، بمواعيد مسبقة.',
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
    stepNames: ['المناسبة', 'الموعد', 'للتواصل معك'],
    next: 'متابعة',
    back: 'رجوع',
    cardTitle: 'طلبك',
    cardEmpty: 'يكتمل مع كل إجابة.',
    pax: (n) => (n === '1' ? 'راكب واحد' : `${n} ركّاب`),
    s7: ['العقارات', 'عقارات استثنائية في باريس، تُعرض بسرّية تامة وتُقدَّم في زيارات خاصة.', 'باريس · زيارات خاصة'],
    s8: [
      'المطاعم والحجوزات',
      'الطاولة المناسبة في الوقت المناسب: حجوزات في أكثر العناوين طلباً في باريس.',
      'عشاء · طاولات خاصة',
    ],
    s9: [
      'الفعاليات',
      'عشاء خاص، وأعياد ميلاد، وحفلات استقبال: نجد المكان، وننسّق مع المورّدين، ونعتني بكل التفاصيل.',
      'خاصة · مهنية',
    ],
    s10: [
      'إقامة تجميلية',
      'لمرضى عيادات الطب التجميلي الشريكة لنا: استقبال في المطار، وسائق يوم الموعد، وفندق هادئ، وعودة مطمئنة.',
      'العيادات الشريكة · باريس',
    ],
    s11: [
      'الإبداع والتسويق',
      'أفلام العلامة، ومحتوى شبكات التواصل، والمواقع الإلكترونية: نصمّم صورة دارك وننتجها.',
      'فيديو · مواقع إلكترونية · شبكات التواصل',
    ],
    eList: 'العيادات الشريكة',
    chap: 'الفصل',
    chapters: [
      ['الوصول', 'تهبط طائرتك ونحن في انتظارك. الحقائب في أيدٍ أمينة، والباب مفتوح، وباريس تبدأ.'],
      ['الطريق', 'السيارة التي تشبهك، أو سائق يعرف كل شارع. وأنت من يحدّد الإيقاع.'],
      ['العنوان', 'جناح لبضع ليالٍ، أو شقة لموسم، أو عقار للعمر.'],
      ['المائدة', 'الطاولة التي يصعب حجزها، والعشاء الذي لا يُنسى. نحن نحجز ونرتّب.'],
      ['وقت لك', 'صباح في فوبور سان أونوريه، وموعد لا يحتاج أحد إلى معرفته.'],
      ['الصورة', 'فيلم، أو موقع، أو حملة: نمنح دارك الصورة التي تستحقها.'],
      ['كل ما عدا ذلك', 'كل ما لا يندرج تحت أي خانة. اطلب: فهناك غالباً تصبح القصة قصتك.'],
    ],
    epK: 'الخاتمة',
    epT: 'يُغلق الباب. <em>والقصة ترافقك.</em>',
    prologue: 'المقدّمة',
    recit: 'القصة',
    scroll: 'مرّر',
    jk: 'ورق لعب Amane',
    jt: 'أربع شخصيات، <em>ودار واحدة.</em>',
    jp: 'أربع وخمسون ورقة رُسمت خصيصاً لـAmane. يؤدّي فيها Le Voiturier وLa Parisienne وLe Gentleman وLe Majordome أدوار الولد والملكة والملك والجوكر.',
    jRoles: ['الولد', 'الملكة', 'الملك', 'الجوكر', 'آس القلب', 'آس البستوني'],
    jShuffle: 'اخلط الأوراق',
    jHint: 'اختر ورقة',
    wk: 'أعمالنا',
    wt: 'ما <em>نوقّعه.</em>',
    wp: 'أفلام وصور ومواقع: ما نصنعه، وما نوقّعه، ولمن.',
    wFilters: ['الكل', 'أفلام', 'صور', 'مواقع'],
    wKinds: ['فيلم', 'صورة', 'موقع'],
    wVisit: 'زيارة الموقع',
    wClose: 'إغلاق',
    wFor: 'لصالح',
    wMore: 'تفاصيل المشروع',
    wWith: 'مع',
    wRoles: {
      da: 'الإدارة الفنية',
      film: 'الإخراج',
      montage: 'المونتاج',
      photo: 'التصوير',
      identite: 'الهوية البصرية',
      illustration: 'الرسم',
      design: 'التصميم',
      dev: 'التطوير',
      seo: 'تحسين الظهور في محركات البحث',
      social: 'وسائل التواصل',
    },
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

/**
 * La devise de la maison, en anglais dans toutes les langues : la première moitié ouvre le site, la seconde le referme.
 */
export const SLOGAN = ['Arrive as a <em>Guest.</em>', 'Leave with a <em>Story.</em>'] as const;

/**
 * Tout ce que fait Amane. `id` sert d'ancre et d'identifiant envoyé au serveur (la même liste est tenue
 * dans api/_lib/lead-core.js) ; `film` et `portrait` nomment les fichiers de public/video ;
 * `flip` place le texte du côté opposé au sujet de l'image.
 * `passage` nomme le plan de caméra (public/passages/) qui amène à ce film depuis le film précédent ;
 * vide quand le film suit une ouverture de chapitre, dont le passage se termine déjà sur sa première image.
 */

export const SERVICES = [
  { key: 's3', id: 'van', film: 'van', portrait: 'm-van', flip: false, passage: '' },
  { key: 's1', id: 'voitures', film: 'jour-montaigne', portrait: '', flip: true, passage: '' },
  { key: 's2', id: 'chauffeur', film: 'volant', portrait: 'm-chauffeur', flip: false, passage: 'p04' },
  { key: 's5', id: 'sejours', film: 'salon', portrait: '', flip: true, passage: '' },
  { key: 's7', id: 'immobilier', film: 'appartement', portrait: 'm-appartement', flip: false, passage: 'p06' },
  { key: 's8', id: 'tables', film: 'table', portrait: 'm-table', flip: true, passage: '' },
  { key: 's9', id: 'evenements', film: 'reception', portrait: '', flip: false, passage: 'p08' },
  { key: 's4', id: 'shopping', film: 'shopping', portrait: '', flip: false, passage: '' },
  { key: 's10', id: 'esthetique', film: 'clinique', portrait: 'm-clinique', flip: true, passage: 'p10' },
  { key: 's11', id: 'creation', film: 'tournage', portrait: '', flip: false, passage: '' },
  { key: 's6', id: 'conciergerie', film: 'cour', portrait: '', flip: false, passage: '' },
] as const;

export type ServiceId = (typeof SERVICES)[number]['id'];

/**
 * Le récit : chaque chapitre réunit un ou deux services. L'ordre suit `chapters` dans les dictionnaires.
 * Son titre est posé sur un passage : le plan de caméra qui quitte le film précédent et arrive
 * exactement sur la première image du premier film du chapitre.
 */
export const CHAPTERS: { id: string; services: ServiceId[]; passage: string }[] = [
  { id: 'arrivee', services: ['van'], passage: 'p01' },
  { id: 'route', services: ['voitures', 'chauffeur'], passage: 'p03' },
  { id: 'adresse', services: ['sejours', 'immobilier'], passage: 'p05' },
  { id: 'table', services: ['tables', 'evenements'], passage: 'p07' },
  { id: 'soi', services: ['shopping', 'esthetique'], passage: 'p09' },
  { id: 'image', services: ['creation'], passage: 'p11' },
  { id: 'reste', services: ['conciergerie'], passage: 'p12' },
];

export const FLEET = [
  { key: 'c1', img: 'img/fleet-m5.jpg' },
  { key: 'c2', img: 'img/fleet-g63.jpg' },
  { key: 'c3', img: 'img/fleet-f296.jpg' },
  { key: 'c4', img: 'img/fleet-classev.jpg' },
] as const;

/** Identifiants de service acceptés par /api/lead, dans l'ordre des choix du formulaire. */
export const REQUEST_IDS = [...SERVICES.map((s) => s.id), 'autre'] as const;

/** Figures du jeu de cartes : nom imprimé sur la carte (jamais traduit) et image. */
/**
 * Les cartes posées sur le tapis : les quatre figures, encadrées par les deux as.
 * `label` renvoie à `jRoles` : le rôle d'une figure (valet, dame, roi, joker) ou le nom d'un as.
 */
export const CARDS = [
  { id: 'as-coeur', name: '', img: 'cartes/as-coeur.webp', label: 4 },
  { id: 'voiturier', name: 'Le Voiturier', img: 'cartes/voiturier.webp', label: 0 },
  { id: 'parisienne', name: 'La Parisienne', img: 'cartes/parisienne.webp', label: 1 },
  { id: 'gentleman', name: 'Le Gentleman', img: 'cartes/gentleman.webp', label: 2 },
  { id: 'majordome', name: 'Le Majordome', img: 'cartes/majordome.webp', label: 3 },
  { id: 'as-pique', name: '', img: 'cartes/as-pique.webp', label: 5 },
] as const;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const AR_NUM = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠'];
/** Numérotation de la page : chiffres romains, chiffres arabes orientaux en arabe. */
export const numerals = (lang: Lang) => (lang === 'ar' ? AR_NUM : ROMAN);

/** Retire les balises d'emphase d'un texte du dictionnaire (balises meta, données structurées). */
export const plain = (s: string) => s.replace(/<\/?em>/g, '');
