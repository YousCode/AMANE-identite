import type { Lang } from './i18n';

/**
 * Les réalisations montrées dans la partie « Création & marketing » : films, visuels et sites.
 *
 * Pour en ajouter une : déposer l'image dans public/realisations/ (JPEG, 1440 px de large),
 * le film éventuel en MP4 dans public/video/, puis ajouter une entrée ci-dessous.
 *
 *  kind     0 film · 1 visuel · 2 site (les libellés traduits sont dans `wKinds`, src/i18n.ts)
 *  title    le nom de la réalisation, tel qu'il est signé (non traduit)
 *  client   pour qui elle a été faite. Ne citer un client ou un partenaire qu'avec son accord.
 *           Seulement des travaux pour des clients : les créations de la maison pour elle-même n'y figurent pas.
 *  roles    ce que la maison a fait, affiché en petites bulles. Clés traduites dans `wRoles`
 *           (da, film, montage, photo, identite, illustration, design, dev, seo, social) ;
 *           tout autre texte est affiché tel quel.
 *  avec     avec qui le projet a été mené (partenaires, studios, agences), affiché en bulles « Avec … »
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
  avec?: string[];
  note?: Partial<Record<Lang, string>>;
  img: string;
  video?: string;
  href?: string;
  format: 'large' | 'etroit' | 'tiers' | 'demi';
};

export const REALISATIONS: Realisation[] = [
  {
    id: 'site-kiess',
    kind: 2,
    title: 'kiess.fr',
    client: 'Kiess',
    year: '2026',
    roles: ['design', 'dev'],
    note: {
      fr: 'Le site de préinscription d’une application de rencontre où la photo se mérite.',
      en: 'The pre-registration site of a dating app where the photo has to be earned.',
      es: 'El sitio de preinscripción de una aplicación de citas donde la foto se gana.',
      ar: 'موقع التسجيل المسبق لتطبيق تعارف تُكشف فيه الصورة تدريجياً.',
    },
    img: 'realisations/kiess.jpg',
    href: 'https://kiess.fr/',
    format: 'large',
  },
];
