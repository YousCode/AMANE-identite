# Site Amane

Site public de la conciergerie : React 19 + Vite + TypeScript, pages pré-rendues en HTML pour quatre langues (`/`, `/en/`, `/es/`, `/ar/`), formulaire relié à l'e-mail par Brevo.

## Lancer

```bash
cd site
npm install
npm run dev        # http://localhost:5173 (et /en/, /es/, /ar/)
npm run build      # dist/ : pages HTML, plan du site, robots.txt
npm run preview    # sert dist/ sur http://localhost:4173
npm test           # tests du formulaire (JavaScript et PHP)
npm run ovh        # dist-ovh/ : le contenu du dossier www/ d'OVH
npm run apercu     # dist-apercu/ : page autonome, pour montrer le site sans hébergement
npm run format     # met en forme tout le code (Prettier)
```

## Contenu

| Chemin                                                | Rôle                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`, `src/components/`                      | La page, racontée comme une histoire : prologue (la porte s'ouvre sur « Arrive as a Guest. »), la maison, sept chapitres de services en films, rituel, flotte, jeu de cartes, questions, épilogue (la porte se referme sur « Leave with a Story. »), demande en trois étapes |
| `src/i18n-base.json`, `src/i18n.ts`                   | Tous les textes, en français, anglais, espagnol et arabe                                                                                                                                                                                                                     |
| `src/styles.css`                                      | Styles. La palette de l'édition 02 est dans le bloc `:root`, nulle part ailleurs                                                                                                                                                                                             |
| `src/entry-server.tsx`, `scripts/prerender.mjs`       | Pré-rendu : balises de référencement, données structurées, `sitemap.xml`, `robots.txt`                                                                                                                                                                                       |
| `ovh/`                                                | Hébergement OVH : configuration Apache (`.htaccess`), formulaire en PHP (`ovh/api/`), modèle de configuration                                                                                                                                                                |
| `api/lead.js`, `api/_lib/`                            | Le même formulaire pour Vercel (Node)                                                                                                                                                                                                                                        |
| `scripts/ovh.mjs`, `.github/workflows/deploy-ovh.yml` | Assemblage du dossier `www/` et mise en ligne automatique sur OVH                                                                                                                                                                                                            |
| `public/passages/`, `scripts/passages.sh`             | Les passages : plans de caméra entre deux films, en images fixes jouées au défilement (un fichier par passage)                                                                                                                                                               |
| `public/frames/`                                      | Les 48 images de la porte qui s'ouvre au défilement                                                                                                                                                                                                                          |
| `public/video/`, `public/img/`                        | Films des services en 1080p (MP4 + WebM), affiches, photos de la flotte, motif Arcades                                                                                                                                                                                       |
| `public/cartes/`                                      | Figures du jeu de cartes Amane, rendues depuis le générateur du jeu                                                                                                                                                                                                          |
| `scripts/encoder-films.sh`                            | Ré-encode les originaux Higgsfield pour le web                                                                                                                                                                                                                               |
| `src/brand/`                                          | Logos copiés depuis `../logos/svg/` (couleur pilotée par le CSS)                                                                                                                                                                                                             |

## Mise en ligne sur OVH : amane.paris

Le site est servi par un **hébergement web OVH** (Apache + PHP). Les pages sont des fichiers statiques ; seul le formulaire tourne en PHP (`ovh/api/lead.php`).

Il faut, chez OVH : le nom de domaine `amane.paris` **et** une offre d'hébergement web (l'offre Perso suffit).

### Une fois pour toutes, dans l'espace client OVH

1. **Web Cloud → Hébergements → ton hébergement → Multisite** : ajouter `amane.paris` et `www.amane.paris`, dossier racine `www`, cocher **SSL**. Si le domaine est chez OVH, les enregistrements DNS se règlent tout seuls. Puis **Commander un certificat SSL** (Let's Encrypt, gratuit) s'il ne l'est pas déjà.
2. **Informations générales → Version PHP** : choisir **8.3** (8.1 minimum).
3. **FTP-SSH** : noter le serveur FTP et l'identifiant, définir un mot de passe.
4. **E-mails** (Web Cloud → E-mails → amane.paris) : créer l'adresse d'expédition, par exemple `demande@amane.paris`. C'est elle qui envoie les demandes et reçoit les réponses des clients à l'accusé de réception.
5. **La configuration du formulaire**, à déposer **à la racine de l'espace FTP, au-dessus de `www/`** (jamais dans `www/`) : copier `ovh/amane-config.example.php` en `amane-config.php`, le remplir, puis l'envoyer avec FileZilla. Avec `LEAD_TO_EMAIL` et `LEAD_FROM_EMAIL`, les e-mails partent par l'envoi intégré d'OVH ; ajouter `BREVO_API_KEY` les fait passer par Brevo (meilleure délivrabilité, voir plus bas).

### Publier

**Automatiquement (recommandé).** Le fichier `.github/workflows/deploy-ovh.yml` publie le site à chaque modification de `site/` sur `main`. Dans GitHub → **Settings → Secrets and variables → Actions**, renseigner :

| Type                  | Nom                | Valeur                                             |
| --------------------- | ------------------ | -------------------------------------------------- |
| Variable              | `OVH_FTP_SERVER`   | serveur FTP (ex. `ftp.cluster0XX.hosting.ovh.net`) |
| Variable              | `OVH_FTP_USER`     | identifiant FTP                                    |
| Secret                | `OVH_FTP_PASSWORD` | mot de passe FTP                                   |
| Variable (facultatif) | `OVH_FTP_PROTOCOL` | `ftps` par défaut ; `ftp` si OVH refuse le chiffré |

Puis **Actions → Déploiement OVH → Run workflow** pour la première mise en ligne. Les suivantes sont automatiques ; seuls les fichiers modifiés sont renvoyés.

**À la main.** `npm run ovh` construit `dist-ovh/`, qui est exactement le contenu de `www/` : l'envoyer avec FileZilla dans `www/` (fichiers cachés compris, pour `.htaccess`).

### Vérifier

- `https://amane.paris` affiche la porte ; `http://` et `www.` renvoient vers `https://amane.paris`.
- `https://amane.paris/sitemap.xml` liste les quatre langues.
- Une demande envoyée avec ta propre adresse arrive à `LEAD_TO_EMAIL`, et l'accusé de réception dans ta boîte.

`ovh/.htaccess` règle la redirection HTTPS, l'adresse unique, la compression, le cache et la réécriture de `/api/lead` vers le script PHP.

### Autre hébergeur

`vercel.json` et `api/lead.js` permettent toujours de servir le même site sur Vercel (Root Directory : `site`, variables d'environnement de `.env.example`).

### Brevo (facultatif)

Sans Brevo, les e-mails partent par l'envoi intégré d'OVH. Brevo améliore leur délivrabilité.

1. Brevo → **Expéditeurs, domaines et IP dédiées → Domaines** : ajouter `amane.paris`. Brevo donne des enregistrements DNS (DKIM, DMARC) à créer dans la zone DNS d'OVH. Sans eux, les e-mails risquent d'arriver en indésirables.
2. Même page, **Expéditeurs** : ajouter l'adresse d'expédition, par exemple `demande@amane.paris` (`LEAD_FROM_EMAIL`). Si un client répond à l'accusé de réception, sa réponse arrive sur cette adresse : il faut qu'elle existe et soit relevée (OVH propose des adresses e-mail avec le domaine).
3. Brevo → **Clés SMTP et API** : créer une clé API et la coller dans `BREVO_API_KEY` (dans `amane-config.php` sur OVH). Ne jamais l'écrire dans le dépôt.
4. `LEAD_TO_EMAIL` : l'adresse qui reçoit les demandes (plusieurs possibles, séparées par des virgules).

## Le récit

La devise de la maison, « Arrive as a Guest. Leave with a Story. », structure la page : sa première moitié ouvre le site, la seconde le referme. Entre les deux, les services sont regroupés en sept chapitres (`CHAPTERS` dans `src/i18n.ts`) : l'arrivée, la route, l'adresse, la table, le temps pour soi, l'image, tout le reste.

## Le défilement

`src/scenes.ts` écrit à chaque image cinq variables CSS (`--enter`, `--e`, `--leave`, `--drift`, `--page`) ; tout le mouvement est décrit dans `src/styles.css`.

- **Les passages.** Les films et les ouvertures de chapitre sont des « scènes ». D'une scène à la suivante, il n'y a ni volet ni coupe : un plan de caméra, le passage, quitte la dernière image d'un film et arrive sur la première image du suivant. Il avance avec le défilement (`src/passages.ts`). Les douze passages sont listés dans `SERVICES` et `CHAPTERS` (`src/i18n.ts`) :
  - le titre d'un chapitre est posé sur le passage qui mène à son premier film ;
  - à l'intérieur d'un chapitre, le second film arrive par son propre passage, puis la vidéo prend le relais.
- **Les images des passages.** Chaque passage est livré en 40 images réunies dans un seul fichier : `public/passages/pNN-d.bin` en 16:9 et `pNN-m.bin` recadré en 9:16 pour les téléphones. `scripts/passages.sh <dossier>` les découpe depuis les plans d'origine (`p01.mp4` à `p12.mp4`). Les images de départ et d'arrivée qui ont servi à générer les plans sont dans `../references/passages/`.
- **Le texte attend l'image.** Une scène reçoit la classe `ouvert` quand elle est presque en place : son titre se dévoile alors mot à mot, puis la phrase et le lien.
- **Le fil du récit** (`src/components/Fil.tsx`, grand écran) : Prologue, chapitres I à VII, Épilogue, cliquables, avec le chapitre en cours en or.
- **Le sommaire** montre, au survol, l'image du chapitre dans une arche qui suit la souris.
- **Le grain.** Un grain de film léger (`public/img/grain.png`) vit sur tous les films.

Avec le réglage système « réduire les animations », la page redevient un défilement simple, tout le texte visible : les passages ne sont pas téléchargés, et chaque chapitre garde en fond l'affiche de son premier film.

## Les services

La liste est dans `src/i18n.ts` (`SERVICES`) et, côté serveur, dans `api/_lib/lead-core.js` : les deux doivent rester identiques.

Van VIP · Voitures d'exception · Chauffeur privé · Séjours clé en main · Immobilier · Tables & restaurants · Événements · Personal shopping · Séjour esthétique · Création & marketing · Conciergerie sur demande.

Les cabinets esthétiques partenaires ne sont cités que si `CABINETS` est renseigné dans `src/config.ts`.

## Ce que fait le formulaire

- Trois étapes : l'occasion (service, message), le moment (date, passagers), le contact (nom, e-mail ou téléphone).
- L'équipe reçoit la demande par e-mail ; « Répondre » écrit directement au client.
- Si le client a donné un e-mail, il reçoit un accusé de réception dans sa langue. L'accusé ne reprend aucun texte libre : seulement le service, la date et le nombre de passagers.
- Protections : champ piège pour les robots, même origine seulement, 5 envois par heure et par adresse IP.

## Référencement

- Une page HTML complète par langue, lisible sans JavaScript.
- `canonical`, `hreflang` (fr, en, es, ar, x-default), Open Graph, image de partage `public/og.jpg`.
- Données structurées : `LocalBusiness` avec les onze services, `WebSite`, `WebPage`, `FAQPage`.
- `sitemap.xml` et `robots.txt` écrits au build, pour `https://amane.paris`.

## À compléter avant l'ouverture

- Numéro WhatsApp et e-mail public affichés près du formulaire : variables `VITE_WHATSAPP_NUMBER` et `VITE_CONTACT_EMAIL` (dans GitHub → Variables pour la mise en ligne automatique).
- Mentions légales et politique de confidentialité : pages obligatoires en France, absentes pour l'instant.
- Relecture de l'arabe et de l'espagnol par un locuteur natif (textes du formulaire et de l'accusé de réception).
