# Site Amane

Site public de la conciergerie : React 19 + Vite + TypeScript, pages pré-rendues en HTML pour quatre langues (`/`, `/en/`, `/es/`, `/ar/`), formulaire relié à l'e-mail par Brevo.

## Lancer

```bash
cd site
npm install
npm run dev        # http://localhost:5173 (et /en/, /es/, /ar/)
npm run build      # dist/ : pages HTML, plan du site, robots.txt
npm run preview    # sert dist/ sur http://localhost:4173
npm test           # tests de la fonction /api/lead
npm run apercu     # dist-apercu/ : page autonome, pour montrer le site sans hébergement
npm run format     # met en forme tout le code (Prettier)
```

## Contenu

| Chemin                                          | Rôle                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`, `src/components/`                | La page : chargement, ouverture (porte cochère), maison, dix services en films, rituel, flotte, jeu de cartes, questions, demande en trois étapes |
| `src/i18n-base.json`, `src/i18n.ts`             | Tous les textes, en français, anglais, espagnol et arabe                                                                                          |
| `src/styles.css`                                | Styles. La palette de l'édition 02 est dans le bloc `:root`, nulle part ailleurs                                                                  |
| `src/entry-server.tsx`, `scripts/prerender.mjs` | Pré-rendu : balises de référencement, données structurées, `sitemap.xml`, `robots.txt`                                                            |
| `api/lead.js`, `api/_lib/`                      | Fonction serveur du formulaire : e-mail à l'équipe et accusé de réception au client                                                               |
| `public/frames/`                                | Les 48 images de la porte qui s'ouvre au défilement                                                                                               |
| `public/video/`, `public/img/`                  | Films des services en 1080p (MP4 + WebM), affiches, photos de la flotte, motif Arcades                                                            |
| `public/cartes/`                                | Figures du jeu de cartes Amane, rendues depuis le générateur du jeu                                                                               |
| `scripts/encoder-films.sh`                      | Ré-encode les originaux Higgsfield pour le web                                                                                                    |
| `src/brand/`                                    | Logos copiés depuis `../logos/svg/` (couleur pilotée par le CSS)                                                                                  |

## Mise en ligne sur Vercel

1. vercel.com → **Add New… → Project** → importer ce dépôt.
2. **Root Directory : `site`**. Le reste est lu dans `site/vercel.json`.
3. Renseigner les variables d'environnement listées dans `.env.example`, puis **Deploy**.

Le formulaire répond « envoi impossible » tant que `BREVO_API_KEY`, `LEAD_TO_EMAIL` et `LEAD_FROM_EMAIL` ne sont pas renseignées.

### Brevo

1. Brevo → **Expéditeurs, domaines et IP dédiées** : ajouter et valider l'adresse d'expédition (`LEAD_FROM_EMAIL`), idéalement sur le domaine du site avec SPF et DKIM.
2. Brevo → **Clés SMTP et API** : créer une clé API et la coller dans `BREVO_API_KEY` sur Vercel. Ne jamais l'écrire dans le dépôt.
3. `LEAD_TO_EMAIL` : l'adresse qui reçoit les demandes (plusieurs possibles, séparées par des virgules).

## Les services

La liste est dans `src/i18n.ts` (`SERVICES`) et, côté serveur, dans `api/_lib/lead-core.js` : les deux doivent rester identiques.

Voitures d'exception · Chauffeur privé · Van VIP · Séjours clé en main · Immobilier · Tables & restaurants · Événements · Personal shopping · Séjour esthétique · Conciergerie sur demande.

Les cabinets esthétiques partenaires ne sont cités que si `CABINETS` est renseigné dans `src/config.ts`.

## Ce que fait le formulaire

- Trois étapes : l'occasion (service, message), le moment (date, passagers), le contact (nom, e-mail ou téléphone).
- L'équipe reçoit la demande par e-mail ; « Répondre » écrit directement au client.
- Si le client a donné un e-mail, il reçoit un accusé de réception dans sa langue. L'accusé ne reprend aucun texte libre : seulement le service, la date et le nombre de passagers.
- Protections : champ piège pour les robots, même origine seulement, 5 envois par heure et par adresse IP.

## Référencement

- Une page HTML complète par langue, lisible sans JavaScript.
- `canonical`, `hreflang` (fr, en, es, ar, x-default), Open Graph, image de partage `public/og.jpg`.
- Données structurées : `LocalBusiness` avec les six services, `WebSite`, `WebPage`, `FAQPage`.
- `sitemap.xml` et `robots.txt` écrits au build, à partir de `SITE_URL`.

## À compléter avant l'ouverture

- `SITE_URL`, `VITE_WHATSAPP_NUMBER`, `VITE_CONTACT_EMAIL` (voir `.env.example`).
- Mentions légales et politique de confidentialité : pages obligatoires en France, absentes pour l'instant.
- Relecture de l'arabe et de l'espagnol par un locuteur natif (textes du formulaire et de l'accusé de réception).
