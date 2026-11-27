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
| `src/realisations.ts`, `public/realisations/`         | Réalisations montrées dans la partie Création & marketing : la liste, et leurs images                                                                                                                                                                                        |
| `public/cartes/jeu/`                                  | Les 54 cartes du jeu Amane et leur dos, rendues depuis le générateur du jeu                                                                                                                                                                                                  |
| `scripts/encoder-films.sh`                            | Ré-encode les originaux Higgsfield pour le web                                                                                                                                                                                                                               |
| `src/brand/`                                          | Logos copiés depuis `../logos/svg/` (couleur pilotée par le CSS)                                                                                                                                                                                                             |

## Mise en ligne sur OVH : amane.paris

Le site est servi par un **hébergement web OVH** (Apache + PHP). Les pages sont des fichiers statiques ; seul le formulaire tourne en PHP (`ovh/api/lead.php`).

Il faut, chez OVH : le nom de domaine `amane.paris` **et** une offre d'hébergement web (l'offre Perso suffit).

### Une fois pour toutes, dans l'espace client OVH

1. **Web Cloud → Hébergements → ton hébergement → Multisite** : ajouter `amane.paris` et `www.amane.paris`, dossier racine `www`, cocher **SSL**. Si le domaine est chez OVH, les enregistrements DNS se règlent tout seuls. Puis **Commander un certificat SSL** (Let's Encrypt, gratuit) s'il ne l'est pas déjà.
2. **Version PHP** : rien à faire. Le fichier `.ovhconfig` publié dans `www/` règle le dossier sur PHP 8.3.
3. **FTP-SSH** : noter le serveur FTP et l'identifiant, définir un mot de passe.
4. **E-mails** (Web Cloud → E-mails → amane.paris) : créer l'adresse d'expédition, par exemple `demande@amane.paris`. C'est elle qui envoie les demandes et reçoit les réponses des clients à l'accusé de réception.
5. **La configuration du formulaire**, dans le fichier `amane-config.php`, **à la racine de l'espace FTP, au-dessus de `www/`** (jamais dans `www/`). Deux façons :
   - **par GitHub (recommandé)** : renseigner les variables et secrets du formulaire listés sous « Publier » ; le déploiement écrit le fichier et le dépose au bon endroit ;
   - **à la main** : copier `ovh/amane-config.example.php` en `amane-config.php`, le remplir, puis l'envoyer avec FileZilla. Tant que la variable `LEAD_TO_EMAIL` n'est pas renseignée dans GitHub, le déploiement n'y touche jamais.
   - **Les e-mails.** Avec `LEAD_TO_EMAIL` et `LEAD_FROM_EMAIL`, ils partent par l'envoi intégré d'OVH ; ajouter `BREVO_API_KEY` les fait passer par Brevo (meilleure délivrabilité, voir plus bas).
   - **Le lien avec le CRM** (facultatif, voir « Ce que fait le formulaire »). Deux clés, à remplir ensemble :
     - `CRM_URL` : l'adresse du CRM, qui commence par `https://`, sans rien après le nom de domaine (par exemple `https://crm.exemple.fr`) ;
     - `CRM_SECRET` : le secret partagé avec le CRM. Il doit être **exactement le même** que `SITE_LEAD_SECRET` côté CRM, et faire au moins 32 caractères tirés au hasard. Pour en fabriquer un : `openssl rand -hex 32` dans un terminal, puis coller la même valeur des deux côtés. Ne jamais l'écrire dans le dépôt ni l'envoyer par e-mail.

     Les deux clés vides : le site n'envoie rien au CRM et tout fonctionne comme avant. Une seule remplie, une adresse qui ne commence pas par `https://` ou un secret trop court : le lien reste inactif et le journal d'erreurs PHP le signale à chaque demande (« lien CRM inactif »), sans jamais afficher de valeur.

### Publier

**Automatiquement (recommandé).** Le fichier `.github/workflows/deploy-ovh.yml` publie le site à chaque modification de `site/` sur `main`. Dans GitHub → **Settings → Secrets and variables → Actions**, renseigner :

| Type                  | Nom                | Valeur                                                           |
| --------------------- | ------------------ | ---------------------------------------------------------------- |
| Variable              | `OVH_FTP_SERVER`   | serveur FTP (ex. `ftp.cluster0XX.hosting.ovh.net`)               |
| Variable              | `OVH_FTP_USER`     | identifiant FTP                                                  |
| Secret                | `OVH_FTP_PASSWORD` | mot de passe FTP                                                 |
| Variable (facultatif) | `OVH_FTP_PROTOCOL` | `ftps` par défaut ; `ftp` si OVH refuse le chiffré               |
| Variable              | `LEAD_TO_EMAIL`    | adresse(s) qui reçoivent les demandes, séparées par des virgules |
| Variable              | `LEAD_FROM_EMAIL`  | adresse d'expédition, par exemple `demande@amane.paris`          |
| Variable (facultatif) | `LEAD_FROM_NAME`   | nom d'expéditeur (`Amane` par défaut)                            |
| Secret (facultatif)   | `BREVO_API_KEY`    | clé API Brevo ; vide, les e-mails partent par OVH                |
| Variable (facultatif) | `CRM_URL`          | adresse du CRM, en `https://`                                    |
| Secret (facultatif)   | `CRM_SECRET`       | le même secret que `SITE_LEAD_SECRET` côté CRM                   |

Puis **Actions → Déploiement OVH → Run workflow** pour la première mise en ligne. Les suivantes sont automatiques ; seuls les fichiers modifiés sont renvoyés.

**À la main.** `npm run ovh` construit `dist-ovh/`, qui est exactement le contenu de `www/` : l'envoyer avec FileZilla dans `www/` (fichiers cachés compris, pour `.htaccess`).

### Vérifier

- `https://amane.paris` affiche la porte ; `http://` et `www.` renvoient vers `https://amane.paris`.
- `https://amane.paris/sitemap.xml` liste les quatre langues.
- Une demande envoyée avec ta propre adresse arrive à `LEAD_TO_EMAIL`, et l'accusé de réception dans ta boîte.
- Si le lien avec le CRM est configuré, la même demande apparaît dans le CRM (nouvelle demande, source « site »). Sinon, regarder le journal d'erreurs PHP (espace client OVH → Statistiques et logs) : « CRM : HTTP 403 » veut dire que le secret n'est pas le même des deux côtés (ou que l'horloge d'un des deux serveurs est fausse de plus de cinq minutes) ; « CRM injoignable » que l'adresse est mauvaise ou que le CRM ne répond pas.

`ovh/.htaccess` règle la redirection HTTPS, l'adresse unique, la compression, le cache et la réécriture de `/api/lead` vers le script PHP.

### Autre hébergeur

`vercel.json` et `api/lead.js` permettent toujours de servir le même site sur Vercel (Root Directory : `site`, variables d'environnement de `.env.example`). Le lien avec le CRM s'y règle avec deux variables d'environnement de plus, `CRM_URL` et `CRM_SECRET`, aux mêmes conditions que sur OVH.

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
  - un chapitre s'ouvre sur le passage qui mène à son premier film ; quand le plan s'arrête, le titre se lit sur l'image immobile, puis s'efface avant que le film ne prenne le relais ;
  - à l'intérieur d'un chapitre, le second film arrive par son propre passage, puis la vidéo prend le relais.
- **Les images des passages.** Chaque passage est livré en 40 images réunies dans un seul fichier : `public/passages/pNN-d.bin` en 16:9 (1600×900) et `pNN-m.bin` recadré en 9:16 pour les téléphones. `scripts/passages.sh <dossier>` les découpe depuis les plans d'origine (`p01.mp4` à `p12.mp4`). Les images de départ et d'arrivée qui ont servi à générer les plans sont dans `../references/passages/`.
- **Le texte attend l'image.** Une scène reçoit la classe `ouvert` quand elle est presque en place : son titre se dévoile alors mot à mot, puis la phrase et le lien. Le texte d'une scène qui s'en va disparaît avant que la suivante ne se montre : jamais deux textes l'un sur l'autre.
- **Sans double image.** Un film reste sur sa première image, celle où s'arrête le passage, tant que le fondu n'est pas fini (classe `montre`), puis démarre.
- **Le fil du récit** (`src/components/Fil.tsx`, grand écran) : Prologue, chapitres I à VII, Épilogue, cliquables, avec le chapitre en cours en or.
- **Le sommaire** montre, au survol, l'image du chapitre dans une arche qui suit la souris.
- **Le grain.** Un grain de film léger (`public/img/grain.png`) vit sur tous les films.

Avec le réglage système « réduire les animations », la page redevient un défilement simple, tout le texte visible : les passages ne sont pas téléchargés, et chaque chapitre garde en fond l'affiche de son premier film.

## Les services

La liste est dans `src/i18n.ts` (`SERVICES`) et, côté serveur, dans `api/_lib/lead-core.js` : les deux doivent rester identiques.

Van VIP · Voitures d'exception · Chauffeur privé · Séjours clé en main · Immobilier · Tables & restaurants · Événements · Personal shopping · Séjour esthétique · Création & marketing · Conciergerie sur demande.

Les cabinets esthétiques partenaires ne sont cités que si `CABINETS` est renseigné dans `src/config.ts`.

## Les réalisations

Dans le chapitre « L'image », à la suite du film Création & marketing, une grille montre ce que la maison a créé : films, visuels et sites. Elle se filtre par nature, un film se lance au survol de sa tuile, et chaque tuile ouvre une visionneuse (flèches du clavier pour passer à la suivante, Échap pour fermer).

La liste est dans `src/realisations.ts`. Pour ajouter une réalisation :

1. déposer l'image dans `public/realisations/` (JPEG, 1440 px de large) ;
2. pour un film, déposer le MP4 dans `public/video/` ;
3. ajouter une entrée dans `REALISATIONS` : nature (film, visuel ou site), nom, client, année, rôles, une phrase de présentation, image, film ou adresse du site, et place dans la grille.

Chaque tuile porte de petites bulles : pour qui le projet a été fait (`client`), avec qui (`avec`), ce que la maison y a fait (`roles`) et l'année. Elles apparaissent au survol ; au doigt ou au clavier, le bouton « + » de la tuile les déplie. Les rôles courants sont traduits dans `wRoles` (`src/i18n.ts`) : `da`, `film`, `montage`, `photo`, `identite`, `illustration`, `design`, `dev`, `seo`, `social`. Tout autre texte est affiché tel quel.

La grille montre les créations faites pour Amane (films, jeu de cartes, site) et un site livré à un client : `kiess.fr`, capturé sur sa version en ligne. Un client ou un partenaire (`avec`) ne doit y être cité qu'avec son accord.

## Le jeu de cartes

`src/components/Jeu.tsx` pose une main de sept cartes sur un tapis. Les 54 cartes du jeu Amane sont dans `public/cartes/jeu/` (`H-V` = valet de cœur, `S-7` = sept de pique, `joker-1`…), rendues depuis le générateur du jeu (dépôt AMANE, `cartes/generateur/`) sans fond perdu.

- **La main.** Les quatre figures de la maison sont toujours là : le Voiturier (valet), la Parisienne (dame), le Gentleman (roi) et le Majordome (joker), chacune dans une couleur tirée au hasard. Trois cartes sont tirées au hasard dans le reste du jeu, et l'ordre est mélangé. Jamais deux fois de suite la même main.
- **La donne.** Quand le tapis arrive à l'écran, le paquet est distribué en éventail et les cartes se retournent une à une.
- **Le battage.** « Battre les cartes » ramasse la main, coupe le paquet en deux moitiés qui se cambrent, les fait retomber l'une dans l'autre carte après carte, fait le pont, puis distribue une nouvelle main.
- **Au pointeur.** Une carte se lève et s'incline vers la souris, un reflet doré la suit ; un trait de lumière passe régulièrement de carte en carte.
- **Le choix.** Un clic redresse la carte et l'avance, son nom s'affiche (« Le Voiturier — Valet », « Sept de cœur ») ; les autres s'effacent. Échap ou un second clic la repose.

Avec « réduire les animations », les cartes sont posées d'emblée et un battage change la main sans mouvement.

## Ce que fait le formulaire

- Trois étapes : l'occasion (service, message), le moment (date, passagers), le contact (nom, e-mail ou téléphone).
- L'équipe reçoit la demande par e-mail ; « Répondre » écrit directement au client.
- Si le client a donné un e-mail, il reçoit un accusé de réception dans sa langue. L'accusé ne reprend aucun texte libre : seulement le service, la date et le nombre de passagers.
- Protections : champ piège pour les robots, même origine seulement, 5 envois par heure et par adresse IP.
- Si le lien avec le CRM est configuré (`CRM_URL` et `CRM_SECRET`), chaque demande acceptée est aussi enregistrée dans le CRM de la maison : fiche client et nouvelle demande.

### Le lien avec le CRM

Le site envoie la demande au CRM directement, de serveur à serveur, avant les e-mails. L'envoi est signé avec un secret que seuls le site et le CRM connaissent : le CRM refuse tout ce qui n'est pas signé par le site, ou qui a plus de cinq minutes. Le site attend la réponse du CRM cinq secondes au plus.

Le CRM reçoit ce que le formulaire a recueilli, une fois nettoyé : nom, téléphone, e-mail, langue, service, date, passagers, message. Il ne reçoit ni l'adresse IP du visiteur ni le champ piège. Une demande arrêtée par une protection (robot, saisie invalide, trop d'envois) n'arrive jamais au CRM.

Le but : une demande n'est perdue que si tout échoue.

| E-mail à l'équipe | CRM                             | Ce que voit le client | Ce qui se passe                                                                                                            |
| ----------------- | ------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Envoyé            | Demande enregistrée             | La confirmation       | La demande est dans la boîte de l'équipe et dans le CRM. Le client reçoit son accusé de réception.                         |
| Envoyé            | En panne                        | La confirmation       | L'équipe a la demande par e-mail, le client son accusé de réception. La panne du CRM est notée dans le journal.            |
| En panne          | Demande enregistrée             | La confirmation       | La demande est dans le CRM. Le client ne reçoit pas d'accusé de réception. La panne de l'e-mail est notée dans le journal. |
| En panne          | En panne, ou lien non configuré | Un message d'erreur   | Rien n'a été enregistré : le client est invité à réessayer ou à joindre la maison autrement.                               |

Si l'e-mail n'est pas configuré du tout mais que le lien avec le CRM l'est, la demande part au CRM seul, sans accusé de réception ; si le CRM ne la prend pas, le client voit le message d'erreur.

Le journal ne contient jamais le secret, l'adresse du CRM ni le contenu d'une demande : seulement une ligne comme « CRM : HTTP 403 » ou « CRM injoignable : délai dépassé ».

## Référencement

- Une page HTML complète par langue, lisible sans JavaScript.
- `canonical`, `hreflang` (fr, en, es, ar, x-default), Open Graph, image de partage `public/og.jpg`.
- Données structurées : `LocalBusiness` avec les onze services, `WebSite`, `WebPage`, `FAQPage`.
- `sitemap.xml` et `robots.txt` écrits au build, pour `https://amane.paris`.

## À compléter avant l'ouverture

- Numéro WhatsApp et e-mail public affichés près du formulaire : variables `VITE_WHATSAPP_NUMBER` et `VITE_CONTACT_EMAIL` (dans GitHub → Variables pour la mise en ligne automatique).
- Mentions légales et politique de confidentialité : pages obligatoires en France, absentes pour l'instant.
- Relecture de l'arabe et de l'espagnol par un locuteur natif (textes du formulaire et de l'accusé de réception).
