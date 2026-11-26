import type { Lang } from './i18n';

/**
 * Les réalisations montrées dans la partie « Création & marketing » : films, visuels et sites.
 *
 * Pour en ajouter une : déposer l'image dans public/realisations/ (JPEG, 1440 px de large),
 * le film éventuel en MP4 dans public/video/, puis ajouter une ligne ci-dessous.
 *
 *  kind     0 film · 1 visuel · 2 site (les libellés traduits sont dans `wKinds`, src/i18n.ts)
 *  title    le nom de la réalisation, tel qu'il est signé (non traduit)
 *  client   pour qui elle a été faite. Ne citer un client qu'avec son accord écrit.
 *  roles    ce que la maison a fait, affiché en petites bulles. Clés traduites dans `wRoles`
 *           (da, film, montage, photo, identite, illustration, design, dev, seo, social) ;
 *           tout autre texte est affiché tel quel.
 *  note     une phrase sur le projet, par langue ; le français sert de repli.
 *  img      l'image de la tuile et de la visionneuse
 *  video    film lu au survol et dans la visionneuse
 *  href     adresse du site, ouverte dans un nouvel onglet
 *  format   place dans la grille : large (deux tiers), etroit (un tiers, en hauteur), tiers, demi
 */
export type Realisation = {
  id: string;
  kind: 0 | 1 | 2;
  title: string;
  client: string;
  year: string;
  roles: string[];
  note?: Partial<Record<Lang, string>>;
  img: string;
  video?: string;
  href?: string;
  format: 'large' | 'etroit' | 'tiers' | 'demi';
};

export const REALISATIONS: Realisation[] = [
  {
    id: 'film-table',
    kind: 0,
    title: 'La Table',
    client: 'Maison Amane',
    year: '2026',
    roles: ['da', 'film'],
    note: {
      fr: 'Le film du service Tables & restaurants.',
      en: 'The film for the Tables & restaurants service.',
      es: 'La película del servicio Mesas y restaurantes.',
      ar: 'فيلم خدمة الموائد والمطاعم.',
    },
    img: 'img/table-poster.jpg',
    video: 'video/table.mp4',
    format: 'large',
  },
  {
    id: 'jeu',
    kind: 1,
    title: 'Le jeu Amane',
    client: 'Maison Amane',
    year: '2026',
    roles: ['da', 'illustration'],
    note: {
      fr: 'Cinquante-quatre cartes dessinées pour la maison.',
      en: 'Fifty-four cards drawn for the house.',
      es: 'Cincuenta y cuatro cartas dibujadas para la casa.',
      ar: 'أربع وخمسون ورقة رُسمت للدار.',
    },
    img: 'realisations/jeu.jpg',
    format: 'etroit',
  },
  {
    id: 'identite',
    kind: 1,
    title: 'L’identité',
    client: 'Maison Amane',
    year: '2026',
    roles: ['identite', 'da'],
    note: {
      fr: 'Le logo : une arche, un A, une serrure.',
      en: 'The logo: an arch, an A, a keyhole.',
      es: 'El logotipo: un arco, una A, una cerradura.',
      ar: 'الشعار: قوس وحرف A وثقب مفتاح.',
    },
    img: 'realisations/identite.jpg',
    format: 'tiers',
  },
  {
    id: 'film-arrivee',
    kind: 0,
    title: 'L’Arrivée',
    client: 'Maison Amane',
    year: '2026',
    roles: ['da', 'film'],
    note: {
      fr: 'Le film de l’accueil à l’aéroport.',
      en: 'The film for the airport welcome.',
      es: 'La película de la recepción en el aeropuerto.',
      ar: 'فيلم الاستقبال في المطار.',
    },
    img: 'img/arrivee-poster.jpg',
    video: 'video/arrivee.mp4',
    format: 'tiers',
  },
  {
    id: 'brandbook',
    kind: 1,
    title: 'Le brand book',
    client: 'Maison Amane',
    year: '2026',
    roles: ['identite', 'design'],
    note: {
      fr: 'Les règles de la marque, de la couleur à la typographie.',
      en: 'The brand rules, from colour to typography.',
      es: 'Las reglas de la marca, del color a la tipografía.',
      ar: 'قواعد العلامة، من اللون إلى الخط.',
    },
    img: 'realisations/brandbook.jpg',
    format: 'tiers',
  },
  {
    id: 'site-amane',
    kind: 2,
    title: 'amane.paris',
    client: 'Maison Amane',
    year: '2026',
    roles: ['design', 'dev', 'seo'],
    note: {
      fr: 'Le site que vous lisez, en quatre langues.',
      en: 'The site you are reading, in four languages.',
      es: 'El sitio que está leyendo, en cuatro idiomas.',
      ar: 'الموقع الذي تتصفحونه، بأربع لغات.',
    },
    img: 'realisations/site-amane.jpg',
    href: 'https://amane.paris/',
    format: 'demi',
  },
  {
    id: 'film-cour',
    kind: 0,
    title: 'La Cour',
    client: 'Maison Amane',
    year: '2026',
    roles: ['da', 'film'],
    note: {
      fr: 'Le film de la conciergerie sur demande.',
      en: 'The film for concierge on request.',
      es: 'La película de la conserjería a medida.',
      ar: 'فيلم خدمة الكونسيرج عند الطلب.',
    },
    img: 'img/cour-poster.jpg',
    video: 'video/cour.mp4',
    format: 'demi',
  },
];
