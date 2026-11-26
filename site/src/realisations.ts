/**
 * Les réalisations montrées dans la partie « Création & marketing » : films, visuels et sites.
 *
 * Pour en ajouter une : déposer l'image dans public/realisations/ (JPEG, 1440 px de large),
 * le film éventuel en MP4 dans public/video/, puis ajouter une ligne ci-dessous.
 *
 *  kind     0 film · 1 visuel · 2 site (les libellés traduits sont dans `wKinds`, src/i18n.ts)
 *  title    le nom de la réalisation, tel qu'il est signé (non traduit)
 *  client   pour qui elle a été faite. Ne citer un client qu'avec son accord écrit.
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
    img: 'realisations/jeu.jpg',
    format: 'etroit',
  },
  {
    id: 'identite',
    kind: 1,
    title: 'L’identité',
    client: 'Maison Amane',
    year: '2026',
    img: 'realisations/identite.jpg',
    format: 'tiers',
  },
  {
    id: 'film-arrivee',
    kind: 0,
    title: 'L’Arrivée',
    client: 'Maison Amane',
    year: '2026',
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
    img: 'realisations/brandbook.jpg',
    format: 'tiers',
  },
  {
    id: 'site-amane',
    kind: 2,
    title: 'amane.paris',
    client: 'Maison Amane',
    year: '2026',
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
    img: 'img/cour-poster.jpg',
    video: 'video/cour.mp4',
    format: 'demi',
  },
];
