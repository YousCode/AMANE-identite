<?php

/**
 * Logique du formulaire de demande, pour l'hébergement OVH (Apache + PHP 8.1 à 8.3).
 * Version PHP de site/api/lead.js + site/api/_lib/lead-core.js : même contrat,
 * mêmes codes de réponse, mêmes e-mails, même envoi au CRM. Si l'une des deux
 * versions change, l'autre doit suivre.
 *
 * Tout ce qui vient de l'extérieur est passé en argument (corps, IP, en-têtes,
 * configuration, envoi HTTP, mail(), horloge, dossier de données), ce qui rend
 * ces fonctions testables sans réseau ni vrai e-mail.
 *
 *   - handleRequest(...) : la requête HTTP entière (méthode, taille du corps, IP) ;
 *   - processLead(...)   : le traitement d'une demande ;
 *   toutes deux renvoient [code HTTP, tableau JSON, en-têtes].
 *
 * Ce qui diffère de la version Vercel, parce que l'hébergement l'impose :
 *   - la configuration vient d'un fichier PHP placé au-dessus de www/ ;
 *   - sans clé Brevo, les e-mails partent par la fonction mail() de PHP ;
 *   - la limite de débit est tenue dans des fichiers, donc réellement partagée
 *     entre toutes les requêtes (la version Vercel ne la tient qu'en mémoire).
 *
 * Ce fichier ne fait que déclarer des fonctions : appelé directement par le
 * web, il n'affiche rien (et le .htaccess du dossier api/ en interdit l'accès).
 */

declare(strict_types=1);

namespace Amane\Lead;

require_once __DIR__ . '/emails.php';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const DELAI_BREVO_S = 8;

// Lien avec le CRM de la maison : chaque demande y est aussi envoyée, de serveur
// à serveur, signée avec un secret partagé (voir « Lien avec le CRM » plus bas).
const CRM_CHEMIN = '/api/lead';
const DELAI_CRM_S = 5;
const CRM_SECRET_MIN = 32; // en dessous, le CRM refuse toute signature

const TAILLE_MAX_CORPS = 16 * 1024; // 16 Ko

const TAILLES = [
    'nom' => 120,
    'email' => 200,
    'tel' => 40,
    'message' => 4000,
];

// Limite de débit : 5 envois par heure et par IP.
const LIMITE_ENVOIS = 5;
const LIMITE_FENETRE_S = 3600;

const CLES_CONFIG = [
    'BREVO_API_KEY',
    'LEAD_TO_EMAIL',
    'LEAD_FROM_EMAIL',
    'LEAD_FROM_NAME',
    'ALLOWED_ORIGINS',
    'CRM_URL',
    'CRM_SECRET',
];

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Lit la configuration : d'abord le fichier PHP (qui fait « return [...] »),
 * puis, pour chaque clé absente ou vide, la variable d'environnement du même nom.
 *
 * @return array<string, string> toutes les clés de CLES_CONFIG, toujours présentes
 */
function chargerConfig(string $fichier, ?callable $getenv = null, ?callable $journal = null): array
{
    $journal ??= 'error_log';
    $lu = [];
    if (is_file($fichier) && is_readable($fichier)) {
        // Le fichier ne doit rien afficher : on retient ce qu'il écrirait par erreur
        // (une ligne vide avant « <?php » suffirait à casser la réponse JSON).
        ob_start();
        try {
            $retour = require $fichier;
            if (is_array($retour)) {
                $lu = $retour;
            } else {
                $journal('[lead] configuration ignorée : le fichier ne renvoie pas un tableau');
            }
        } catch (\Throwable $erreur) {
            $journal('[lead] configuration illisible : ' . get_class($erreur));
        } finally {
            ob_end_clean();
        }
    }

    $getenv ??= static fn (string $cle) => getenv($cle);
    $config = [];
    foreach (CLES_CONFIG as $cle) {
        $valeur = isset($lu[$cle]) && is_scalar($lu[$cle]) ? trim((string) $lu[$cle]) : '';
        if ($valeur === '') {
            $env = $getenv($cle);
            $valeur = is_string($env) ? trim($env) : '';
        }
        $config[$cle] = $valeur;
    }

    return $config;
}

// ---------------------------------------------------------------------------
// Limite de débit, tenue dans des fichiers
//
// Un petit fichier JSON par adresse IP (nommé d'après son empreinte sha256) :
// la liste des horodatages des envois de la dernière heure. Le verrou flock()
// évite que deux requêtes simultanées se marchent dessus.
// ---------------------------------------------------------------------------

/**
 * Dossier où ranger les compteurs : celui demandé s'il est inscriptible (créé
 * au besoin), sinon le dossier temporaire du système. Null si rien n'est possible.
 */
function dossierLimite(?string $prefere): ?string
{
    $candidats = [$prefere, rtrim(sys_get_temp_dir(), '/\\') . '/amane-data'];
    foreach ($candidats as $dossier) {
        if ($dossier === null || $dossier === '') {
            continue;
        }
        $dossier = rtrim($dossier, '/\\');
        if (!is_dir($dossier)) {
            @mkdir($dossier, 0700, true);
        }
        if (is_dir($dossier) && is_writable($dossier)) {
            return $dossier;
        }
    }

    return null;
}

function fichierLimite(string $dossier, string $ip): string
{
    $cle = minuscules(uneLigne($ip, 64));

    return $dossier . '/ip-' . hash('sha256', $cle !== '' ? $cle : 'inconnue') . '.json';
}

/** Supprime les compteurs qui n'ont pas servi depuis plus d'une heure. Renvoie le nombre de fichiers retirés. */
function purgerLimite(string $dossier, int $t): int
{
    $retires = 0;
    foreach (glob($dossier . '/ip-*.json') ?: [] as $fichier) {
        $modifie = @filemtime($fichier);
        if ($modifie !== false && $t - $modifie >= LIMITE_FENETRE_S && @unlink($fichier)) {
            $retires++;
        }
    }

    return $retires;
}

/**
 * Compte une tentative d'envoi. Renvoie 0 si elle est acceptée, sinon le nombre
 * de secondes à attendre. Si le compteur ne peut pas être tenu (dossier non
 * inscriptible), la demande passe : mieux vaut un formulaire sans limite qu'un
 * formulaire en panne.
 */
function compterEnvoi(string $ip, int $t, ?string $dossier, ?callable $journal = null): int
{
    $journal ??= 'error_log';
    $dossier = dossierLimite($dossier);
    $flux = $dossier !== null ? @fopen(fichierLimite($dossier, $ip), 'c+') : false;
    if ($flux === false) {
        $journal('[lead] limite de débit indisponible : dossier de données non inscriptible');

        return 0;
    }

    try {
        if (!flock($flux, LOCK_EX)) {
            return 0;
        }
        $lu = json_decode((string) stream_get_contents($flux), true);
        $recents = [];
        foreach (is_array($lu) ? $lu : [] as $date) {
            // Les entrées de plus d'une heure sont purgées ici.
            if (is_int($date) && $t - $date < LIMITE_FENETRE_S) {
                $recents[] = $date;
            }
        }

        $attente = 0;
        if (count($recents) >= LIMITE_ENVOIS) {
            $attente = max(1, min($recents) + LIMITE_FENETRE_S - $t);
        } else {
            $recents[] = $t;
        }

        rewind($flux);
        ftruncate($flux, 0);
        fwrite($flux, (string) json_encode($recents));
        fflush($flux);
    } finally {
        flock($flux, LOCK_UN);
        fclose($flux);
    }

    // De temps en temps, on retire les compteurs des visiteurs qui ne sont pas revenus.
    // (Heure réelle, et non $t : la purge se fie à la date de modification des fichiers.)
    if (random_int(1, 50) === 1) {
        purgerLimite($dossier, time());
    }

    return $attente;
}

// ---------------------------------------------------------------------------
// Nettoyage et validation
// ---------------------------------------------------------------------------

/** Texte libre sur plusieurs lignes : on garde les retours à la ligne, rien d'autre d'invisible. */
function texteLibre(mixed $valeur, int $max): string
{
    if (!is_string($valeur) && !is_int($valeur) && !(is_float($valeur) && is_finite($valeur))) {
        return '';
    }
    $propre = chaine($valeur);
    $propre = preg_replace('/\r\n?|[\x0B\f\x{0085}\x{2028}\x{2029}]/u', "\n", $propre) ?? '';
    $propre = str_replace("\t", ' ', $propre);
    $propre = preg_replace(
        '/[\x{0000}-\x{0009}\x{000B}-\x{001F}\x{007F}-\x{009F}\x{200B}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u',
        '',
        $propre
    ) ?? '';
    $propre = preg_replace('/[ ]+\n/', "\n", $propre) ?? '';
    $propre = preg_replace('/\n{3,}/', "\n\n", $propre) ?? '';

    return rogner(couper(rogner($propre), $max));
}

function langueValide(mixed $valeur): string
{
    $l = preg_split('/[-_]/', minuscules(uneLigne($valeur, 16)))[0] ?? '';

    return in_array($l, LANGUES, true) ? $l : 'fr';
}

// Volontairement strict (ASCII) : l'adresse sert de Reply-To et de destinataire,
// et une adresse refusée par Brevo ou par mail() ferait échouer l'e-mail à l'équipe.
const RE_EMAIL = '/^[A-Za-z0-9!#$%&\'*+\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&\'*+\/=?^_`{|}~-]+)*'
    . '@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/D';

function emailValide(mixed $email): bool
{
    if (!is_string($email) || strlen($email) > TAILLES['email']) {
        return false;
    }
    if (!preg_match(RE_EMAIL, $email)) {
        return false;
    }

    return strrpos($email, '@') <= 64;
}

function telValide(string $tel): bool
{
    // \p{Nd} : chiffres de toutes les écritures (un client peut saisir ٠١٢٣…).
    return preg_match_all('/\p{Nd}/u', $tel) >= 8;
}

/**
 * Ramène le corps reçu aux champs connus, nettoyés et bornés.
 * service, date et passagers ne sont pas du texte libre : identifiant d'une
 * liste fermée, date AAAA-MM-JJ réelle, « 1 » à « 7 » ou « 8+ ».
 *
 * @param array<string, mixed> $donnees
 * @return array<string, string>
 */
function nettoyerDemande(array $donnees = []): array
{
    return [
        'nom' => uneLigne($donnees['nom'] ?? null, TAILLES['nom']),
        'email' => uneLigne($donnees['email'] ?? null, TAILLES['email']),
        'tel' => uneLigne($donnees['tel'] ?? null, TAILLES['tel']),
        'service' => idService($donnees['service'] ?? null),
        'date' => dateIso($donnees['date'] ?? null),
        'passagers' => passagersValides($donnees['passagers'] ?? null),
        'langue' => langueValide($donnees['langue'] ?? null),
        'message' => texteLibre($donnees['message'] ?? null, TAILLES['message']),
    ];
}

/**
 * Accepte un tableau déjà décodé ou une chaîne JSON. Renvoie null si illisible,
 * ou si le JSON n'est pas un objet ({ … }).
 *
 * @return array<string, mixed>|null
 */
function lireDonnees(mixed $corps): ?array
{
    if ($corps === null || $corps === '') {
        return [];
    }
    if (is_array($corps)) {
        return $corps !== [] && array_is_list($corps) ? null : $corps;
    }
    if (!is_string($corps)) {
        return null;
    }
    if (rogner(chaine($corps)) === '') {
        return [];
    }
    // Sans le mode « tableau associatif », pour distinguer { … } de [ … ].
    $donnees = json_decode($corps, false);

    return $donnees instanceof \stdClass ? get_object_vars($donnees) : null;
}

function potDeMielRempli(mixed $valeur): bool
{
    if ($valeur === null || $valeur === false) {
        return false;
    }
    if (is_string($valeur)) {
        return rogner(chaine($valeur)) !== '';
    }

    return true;
}

// ---------------------------------------------------------------------------
// Origine
// ---------------------------------------------------------------------------

/**
 * Découpe « https://hote:port » ; null si ce n'est pas une origine http(s).
 * Comme un navigateur : hôte en minuscules, port par défaut retiré.
 *
 * @return array{origine: string, hote: string}|null
 */
function analyserOrigine(string $origine): ?array
{
    $motif = '~^(https?)://(\[[0-9a-f:.]+\]|[a-z0-9._-]+)(?::([0-9]{1,5}))?(?:[/?#].*)?$~iD';
    if (!preg_match($motif, trim($origine), $m)) {
        return null; // « null », valeur tronquée…
    }
    $schema = strtolower($m[1]);
    $hote = strtolower($m[2]);
    $port = $m[3] ?? '';
    if ($port !== '' && (int) $port !== ($schema === 'https' ? 443 : 80)) {
        $hote .= ':' . (int) $port;
    }

    return ['origine' => $schema . '://' . $hote, 'hote' => $hote];
}

/**
 * Même origine uniquement. Sans en-tête Origin (curl, certains outils), on
 * laisse passer. Avec, son hôte doit être celui de la requête (Host) ou figurer
 * dans ALLOWED_ORIGINS — chaque entrée étant soit une origine complète
 * (« https://amane.paris »), soit un hôte seul (« amane.paris »).
 */
function origineAutorisee(?string $origin, ?string $host, ?string $autorisees): bool
{
    if ($origin === null || $origin === '') {
        return true;
    }
    $url = analyserOrigine($origin);
    if ($url === null) {
        return false;
    }
    $hote = minuscules(trim((string) $host));
    if ($hote !== '' && $url['hote'] === $hote) {
        return true;
    }

    foreach (explode(',', (string) $autorisees) as $brute) {
        $entree = rtrim(minuscules(trim($brute)), '/');
        if ($entree === '') {
            continue;
        }
        if (str_contains($entree, '://')) {
            $autorisee = analyserOrigine($entree);
            if ($autorisee !== null && $autorisee['origine'] === $url['origine']) {
                return true;
            }
        } elseif ($entree === $url['hote']) {
            return true;
        }
    }

    return false;
}

// ---------------------------------------------------------------------------
// Envoi HTTP (curl) : API Brevo et CRM
// ---------------------------------------------------------------------------

/**
 * Transport HTTP par défaut : POST avec curl. Renvoie le code HTTP de la
 * réponse, ou un nombre négatif si la requête n'a pas abouti (l'opposé du code
 * d'erreur curl : -28 = délai dépassé).
 *
 * @param array<string, string> $entetes
 */
function envoiHttpCurl(string $url, array $entetes, string $corps, int $delai): int
{
    if (!function_exists('curl_init')) {
        return -1;
    }
    $lignes = [];
    foreach ($entetes as $nom => $valeur) {
        $lignes[] = $nom . ': ' . $valeur;
    }
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $corps,
        CURLOPT_HTTPHEADER => $lignes,
        CURLOPT_RETURNTRANSFER => true, // le corps de la réponse n'est ni affiché ni journalisé
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => $delai,
        CURLOPT_TIMEOUT => $delai,
    ]);
    $reponse = curl_exec($curl);
    if ($reponse === false) {
        return -max(1, curl_errno($curl));
    }

    return (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
}

/**
 * Renvoie true si Brevo a accepté l'e-mail. Ne journalise ni la clé ni le contenu.
 *
 * @param array<string, mixed> $message
 */
function envoyerBrevo(string $cleApi, array $message, callable $http, string $etiquette, callable $journal): bool
{
    $entetes = [
        'api-key' => $cleApi,
        'content-type' => 'application/json',
        'accept' => 'application/json',
    ];
    $corps = json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    try {
        $code = (int) $http(BREVO_URL, $entetes, (string) $corps, DELAI_BREVO_S);
    } catch (\Throwable $erreur) {
        $code = -1;
    }
    if ($code >= 200 && $code < 300) {
        return true;
    }
    if ($code > 0) {
        $journal("[lead] Brevo a refusé l'e-mail « $etiquette » : HTTP $code");
    } else {
        $nature = $code === -28 ? 'délai dépassé' : 'erreur réseau';
        $journal("[lead] Brevo injoignable pour l'e-mail « $etiquette » : $nature");
    }

    return false;
}

// ---------------------------------------------------------------------------
// Lien avec le CRM (de serveur à serveur, signé)
//
// Protocole, fixé avec le CRM (sa route /api/lead) :
//   POST <CRM_URL>/api/lead
//   Content-Type: application/json
//   X-Amane-Signature: t=<secondes Unix>,v1=<hexadécimal>
// où v1 est le HMAC-SHA256 de « <t>.<corps brut> » avec le secret partagé
// (CRM_SECRET ici, SITE_LEAD_SECRET côté CRM). Le CRM refuse (403) une
// signature fausse, ou un horodatage qui a plus de cinq minutes d'écart.
// ---------------------------------------------------------------------------

/** Longueur d'une chaîne en unités UTF-16 : la mesure de JavaScript, celle qu'applique le CRM au secret. */
function longueurJs(string $texte): int
{
    return intdiv(strlen(mb_convert_encoding($texte, 'UTF-16BE', 'UTF-8')), 2);
}

/**
 * Le lien n'est actif que si CRM_URL commence par « https:// » et si CRM_SECRET
 * fait au moins 32 caractères. Renvoie alors l'adresse d'envoi et le secret ;
 * sinon null. Aucune des deux clés renseignée : le lien n'est pas demandé, rien
 * n'est signalé. Une seule, ou une valeur invalide : c'est signalé au journal,
 * sans jamais y écrire la valeur.
 *
 * @return array{url: string, secret: string}|null
 */
function lienCrm(string $url, string $secret, callable $journal): ?array
{
    if ($url === '' && $secret === '') {
        return null;
    }
    $base = rtrim($url, '/'); // « https://crm.exemple.fr/ » → « https://crm.exemple.fr »
    $defauts = [];
    if ($url === '') {
        $defauts[] = 'CRM_URL manquante';
    } elseif (!preg_match('~^https://[^/\s?#]+(?:/[^\s?#]*)?$~D', $base)) {
        $defauts[] = 'CRM_URL invalide (elle doit commencer par https://)';
    }
    if ($secret === '') {
        $defauts[] = 'CRM_SECRET manquant';
    } elseif (longueurJs($secret) < CRM_SECRET_MIN) {
        $defauts[] = 'CRM_SECRET trop court (' . CRM_SECRET_MIN . ' caractères minimum)';
    }
    if ($defauts !== []) {
        $journal('[lead] lien CRM inactif : ' . implode(' ; ', $defauts));

        return null;
    }

    return ['url' => $base . CRM_CHEMIN, 'secret' => $secret];
}

/**
 * Ce que le CRM reçoit : les valeurs déjà nettoyées par nettoyerDemande(), la
 * langue en majuscules. Ni l'adresse IP du visiteur, ni le champ piège.
 *
 * @param array<string, string> $lead
 * @return array<string, string>
 */
function demandeCrm(array $lead): array
{
    return [
        'nom' => $lead['nom'],
        'tel' => $lead['tel'],
        'email' => $lead['email'],
        'langue' => strtoupper($lead['langue']),
        'service' => $lead['service'],
        'date' => $lead['date'],
        'passagers' => $lead['passagers'],
        'message' => $lead['message'],
    ];
}

/** En-tête X-Amane-Signature : « t=<secondes>,v1=<HMAC-SHA256 de "<t>.<corps>", en hexadécimal> ». */
function signatureCrm(string $secret, int $t, string $corps): string
{
    return 't=' . $t . ',v1=' . hash_hmac('sha256', $t . '.' . $corps, $secret);
}

/**
 * Envoie la demande au CRM. Renvoie true s'il l'a acceptée (réponse 2xx).
 * Ne journalise ni le secret, ni l'adresse du CRM, ni le contenu de la demande ;
 * le corps de la réponse n'est pas regardé.
 *
 * @param array{url: string, secret: string} $lien voir lienCrm()
 * @param array<string, string> $lead voir nettoyerDemande()
 */
function envoyerCrm(array $lien, array $lead, int $t, callable $http, callable $journal): bool
{
    // Le JSON est produit une seule fois : ce qui est signé est, à l'octet près, ce qui est envoyé.
    $corps = json_encode(demandeCrm($lead), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($corps)) {
        $journal('[lead] CRM : demande impossible à encoder');

        return false;
    }
    $entetes = [
        'Content-Type' => 'application/json',
        'X-Amane-Signature' => signatureCrm($lien['secret'], $t, $corps),
    ];
    try {
        $code = (int) $http($lien['url'], $entetes, $corps, DELAI_CRM_S);
    } catch (\Throwable $erreur) {
        $code = -1;
    }
    if ($code >= 200 && $code < 300) {
        return true;
    }
    if ($code > 0) {
        $journal("[lead] CRM : HTTP $code");
    } else {
        $nature = $code === -28 ? 'délai dépassé' : 'erreur réseau';
        $journal("[lead] CRM injoignable : $nature");
    }

    return false;
}

// ---------------------------------------------------------------------------
// Envoi par mail() (repli quand il n'y a pas de clé Brevo)
// ---------------------------------------------------------------------------

/**
 * Transport mail() par défaut. Les en-têtes sont passés en tableau : PHP refuse
 * alors lui-même tout en-tête contenant un retour à la ligne.
 *
 * @param array<string, string> $entetes
 */
function envoiMailPhp(string $a, string $sujet, string $corps, array $entetes, string $parametres): bool
{
    return $parametres !== ''
        ? \mail($a, $sujet, $corps, $entetes, $parametres)
        : \mail($a, $sujet, $corps, $entetes);
}

/**
 * Encode un texte en « mots encodés » (RFC 2047) : =?UTF-8?B?…?=
 * Chaque mot fait 75 caractères au plus ; les mots sont séparés par une espace,
 * jamais par un retour à la ligne.
 */
function motsEncodes(string $texte): string
{
    $mots = [];
    $morceau = '';
    foreach (mb_str_split(uneLigne($texte, 1000), 1, 'UTF-8') as $caractere) {
        if (strlen($morceau) + strlen($caractere) > 45) {
            $mots[] = '=?UTF-8?B?' . base64_encode($morceau) . '?=';
            $morceau = '';
        }
        $morceau .= $caractere;
    }
    if ($morceau !== '' || $mots === []) {
        $mots[] = '=?UTF-8?B?' . base64_encode($morceau) . '?=';
    }

    return implode(' ', $mots);
}

/** « Nom <adresse> » pour un en-tête From ou Reply-To, sans retour à la ligne possible. */
function adresseEntete(string $email, string $nom = ''): string
{
    $email = uneLigne($email, 200);
    $nom = uneLigne($nom, 120);
    if ($nom === '') {
        return $email;
    }
    // Lettres, chiffres et signes sans rôle particulier dans un en-tête : tel quel.
    if (preg_match('/^[A-Za-z0-9 !#$%&\'*+\/^_`{|}~-]+$/D', $nom)) {
        return $nom . ' <' . $email . '>';
    }
    // Autres caractères ASCII (virgule, point, guillemets…) : entre guillemets.
    if (!preg_match('/[^\x20-\x7E]/', $nom) && !str_contains($nom, '=?')) {
        return '"' . addcslashes($nom, '"\\') . '" <' . $email . '>';
    }

    return motsEncodes($nom) . ' <' . $email . '>';
}

/**
 * Traduit un message (même forme que pour Brevo) en arguments de mail() :
 * e-mail en deux versions (texte + HTML), en UTF-8, encodées en base64.
 *
 * @param array<string, mixed> $message
 * @return array{to: string, subject: string, body: string, headers: array<string, string>, params: string}
 */
function messageMail(array $message): array
{
    $adresses = [];
    foreach ($message['to'] as $destinataire) {
        $adresses[] = uneLigne($destinataire['email'], 200);
    }
    $expediteur = uneLigne($message['sender']['email'], 200);

    $limite = '=_amane_' . bin2hex(random_bytes(12));
    $entetes = [
        'From' => adresseEntete($expediteur, (string) ($message['sender']['name'] ?? '')),
    ];
    if (isset($message['replyTo'])) {
        $entetes['Reply-To'] = adresseEntete(
            (string) $message['replyTo']['email'],
            (string) ($message['replyTo']['name'] ?? '')
        );
    }
    $entetes['MIME-Version'] = '1.0';
    $entetes['Content-Type'] = 'multipart/alternative; boundary="' . $limite . '"';

    $texte = preg_replace('/\r\n?|\n/', "\r\n", (string) $message['textContent']) ?? '';
    $corps = '--' . $limite . "\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($texte), 76, "\r\n")
        . '--' . $limite . "\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode((string) $message['htmlContent']), 76, "\r\n")
        . '--' . $limite . "--\r\n";

    // Adresse de retour (enveloppe) alignée sur l'expéditeur, pour SPF et les
    // messages d'erreur — seulement si l'adresse est assez simple pour être
    // passée sans risque à la commande d'envoi.
    $parametres = preg_match('/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/D', $expediteur) ? '-f' . $expediteur : '';

    return [
        'to' => implode(', ', $adresses),
        'subject' => motsEncodes((string) $message['subject']),
        'body' => $corps,
        'headers' => $entetes,
        'params' => $parametres,
    ];
}

/**
 * Renvoie true si mail() a accepté l'e-mail. Ne journalise aucun contenu.
 *
 * @param array<string, mixed> $message
 */
function envoyerMail(array $message, callable $mail, string $etiquette, callable $journal): bool
{
    try {
        $m = messageMail($message);
        $ok = $mail($m['to'], $m['subject'], $m['body'], $m['headers'], $m['params']) === true;
    } catch (\Throwable $erreur) {
        $ok = false;
    }
    if (!$ok) {
        $journal("[lead] mail() a refusé l'e-mail « $etiquette »");
    }

    return $ok;
}

// ---------------------------------------------------------------------------
// Horloge
// ---------------------------------------------------------------------------

/** « 25 novembre 2026 à 15:42 », heure de Paris. */
function dateParis(int $t): string
{
    $date = (new \DateTimeImmutable('@' . $t))->setTimezone(new \DateTimeZone('Europe/Paris'));

    return (int) $date->format('j') . ' ' . MOIS['fr'][(int) $date->format('n') - 1] . ' '
        . (int) $date->format('Y') . ' à ' . $date->format('H:i');
}

/** Heure courante en secondes ; $now (entier ou fonction) permet de la fixer dans les tests. */
function instant(mixed $now): int
{
    $t = is_callable($now) ? $now() : $now;

    return is_int($t) ? $t : time();
}

// ---------------------------------------------------------------------------
// Traitement d'une demande
// ---------------------------------------------------------------------------

/**
 * @param mixed $body tableau déjà décodé ou chaîne JSON
 * @param string $ip adresse IP du visiteur
 * @param string|null $origin en-tête Origin
 * @param string|null $host en-tête Host
 * @param array<string, mixed> $config voir chargerConfig()
 * @param callable|null $http envoi HTTP (Brevo et CRM) : fn(url, en-têtes, corps, délai) => code HTTP
 * @param callable|null $mail envoi par mail() : fn(à, sujet, corps, en-têtes, paramètres) => bool
 * @param int|callable|null $now horloge en secondes, pour les tests
 * @param string|null $dataDir dossier des compteurs de débit
 * @param callable|null $journal fn(string) : journal d'erreurs (error_log par défaut)
 * @return array{0: int, 1: array<string, mixed>, 2: array<string, string>} [code HTTP, JSON, en-têtes]
 */
function processLead(
    mixed $body = null,
    string $ip = '',
    ?string $origin = null,
    ?string $host = null,
    array $config = [],
    ?callable $http = null,
    ?callable $mail = null,
    int|callable|null $now = null,
    ?string $dataDir = null,
    ?callable $journal = null
): array {
    $journal ??= 'error_log';
    $cfg = static fn (string $cle): string => is_scalar($config[$cle] ?? null) ? trim((string) $config[$cle]) : '';

    // 1. Même origine
    if (!origineAutorisee($origin, $host, $cfg('ALLOWED_ORIGINS'))) {
        return [403, ['error' => 'origine_refusee'], []];
    }

    // 2. Corps
    $donnees = lireDonnees($body);
    if ($donnees === null) {
        return [400, ['error' => 'corps_invalide'], []];
    }

    // 3. Piège à robots : champ caché « a_laisser_vide », qu'un humain ne voit pas.
    // S'il est rempli, on répond comme si tout allait bien, sans rien envoyer.
    if (potDeMielRempli($donnees['a_laisser_vide'] ?? null)) {
        $journal('[lead] pot de miel');

        return [200, ['ok' => true], []];
    }

    // 4. Validation
    $lead = nettoyerDemande($donnees);
    if ($lead['email'] === '' && $lead['tel'] === '') {
        return [400, [
            'error' => 'contact_requis',
            'message' => 'Indiquez un e-mail ou un numéro de téléphone pour que nous puissions vous répondre.',
        ], []];
    }
    if ($lead['email'] !== '' && !emailValide($lead['email'])) {
        return [400, ['error' => 'email_invalide'], []];
    }
    if ($lead['tel'] !== '' && !telValide($lead['tel'])) {
        return [400, ['error' => 'tel_invalide'], []];
    }

    // 5. Configuration.
    // E-mails : avec une clé Brevo, envoi par l'API ; sans, repli sur mail(). Dans
    // les deux cas, il faut savoir à qui écrire et de la part de qui.
    $cleApi = $cfg('BREVO_API_KEY');
    $destinataires = [];
    foreach (preg_split('/[,;]/', $cfg('LEAD_TO_EMAIL')) ?: [] as $adresse) {
        $adresse = uneLigne($adresse, 200);
        if ($adresse !== '') {
            $destinataires[] = ['email' => $adresse];
        }
    }
    $expediteur = uneLigne($cfg('LEAD_FROM_EMAIL'), 200);
    $emailsPrets = $destinataires !== [] && $expediteur !== '';
    // Lien CRM : actif seulement si ses deux clés sont valides (voir lienCrm).
    $crm = lienCrm($cfg('CRM_URL'), $cfg('CRM_SECRET'), $journal);
    // Ni e-mail ni CRM : la demande n'a nulle part où aller.
    if (!$emailsPrets && $crm === null) {
        return [503, [
            'error' => 'email_off',
            'message' => 'L’envoi des demandes n’est pas encore configuré. Merci de nous joindre par téléphone.',
        ], []];
    }
    $nomExpediteur = uneLigne($cfg('LEAD_FROM_NAME'), 80);
    $sender = ['name' => $nomExpediteur !== '' ? $nomExpediteur : 'Amane', 'email' => $expediteur];

    // 6. Limite de débit (chaque tentative d'envoi compte, réussie ou non)
    $t = instant($now);
    $attente = compterEnvoi($ip, $t, $dataDir, $journal);
    if ($attente > 0) {
        return [429, ['error' => 'trop_de_demandes'], ['Retry-After' => (string) $attente]];
    }

    $http ??= __NAMESPACE__ . '\\envoiHttpCurl';

    // 7. CRM d'abord, puis les e-mails : une demande n'est perdue que si tout échoue.
    // Un échec du CRM est seulement journalisé tant que l'e-mail à l'équipe part.
    $crmOk = $crm !== null && envoyerCrm($crm, $lead, $t, $http, $journal);
    // Réponse quand l'e-mail à l'équipe n'est pas parti : la demande est tout de
    // même enregistrée si le CRM l'a prise (sans accusé de réception), perdue sinon.
    $sansEmail = $crmOk
        ? [200, ['ok' => true, 'ack' => false], []]
        : [502, ['error' => 'envoi_impossible'], []];
    if (!$emailsPrets) {
        return $sansEmail; // e-mails non configurés : la demande n'est partie qu'au CRM
    }

    $envoyer = static function (array $message, string $etiquette) use ($cleApi, $http, $mail, $journal): bool {
        return $cleApi !== ''
            ? envoyerBrevo($cleApi, $message, $http, $etiquette, $journal)
            : envoyerMail($message, $mail ?? __NAMESPACE__ . '\\envoiMailPhp', $etiquette, $journal);
    };

    // 8. E-mail à l'équipe
    $equipe = teamEmail($lead + ['recuLe' => dateParis($t)]);
    $messageEquipe = [
        'sender' => $sender,
        'to' => $destinataires,
        'subject' => $equipe['subject'],
        'htmlContent' => $equipe['html'],
        'textContent' => $equipe['text'],
    ];
    if ($lead['email'] !== '') {
        $messageEquipe['replyTo'] = $lead['nom'] !== ''
            ? ['email' => $lead['email'], 'name' => $lead['nom']]
            : ['email' => $lead['email']];
    }
    if (!$envoyer($messageEquipe, 'équipe')) {
        return $sansEmail;
    }

    // 9. Accusé de réception (seulement si le client a laissé un e-mail)
    if ($lead['email'] === '') {
        return [200, ['ok' => true, 'ack' => false], []];
    }

    // Ni texte libre dans le contenu (voir ackEmail), ni nom affiché dans le
    // destinataire : rien de saisi librement ne part vers l'adresse du client.
    $accuse = ackEmail($lead);
    $ack = $envoyer([
        'sender' => $sender,
        'to' => [['email' => $lead['email']]],
        'subject' => $accuse['subject'],
        'htmlContent' => $accuse['html'],
        'textContent' => $accuse['text'],
    ], 'accusé');

    return [200, ['ok' => true, 'ack' => $ack], []];
}

// ---------------------------------------------------------------------------
// Requête HTTP
// ---------------------------------------------------------------------------

/** Vrai pour une adresse privée, locale ou réservée (10.x, 192.168.x, 127.x, ::1, fc00::/7…). */
function ipPrivee(string $ip): bool
{
    return filter_var($ip, FILTER_VALIDATE_IP) !== false
        && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
}

/**
 * Adresse IP du visiteur : REMOTE_ADDR. X-Forwarded-For n'est écouté que si
 * REMOTE_ADDR est une adresse privée (relais interne de l'hébergeur) ; on y
 * prend alors la dernière adresse publique, celle que le relais a lui-même
 * ajoutée — les précédentes sont dictées par le visiteur et ne valent rien.
 *
 * @param array<string, mixed> $serveur $_SERVER
 */
function ipDuVisiteur(array $serveur): string
{
    $distante = trim((string) ($serveur['REMOTE_ADDR'] ?? ''));
    if ($distante !== '' && ipPrivee($distante)) {
        $relais = array_reverse(explode(',', (string) ($serveur['HTTP_X_FORWARDED_FOR'] ?? '')));
        foreach ($relais as $candidate) {
            $candidate = trim($candidate);
            if (filter_var($candidate, FILTER_VALIDATE_IP) !== false && !ipPrivee($candidate)) {
                return $candidate;
            }
        }
    }

    return $distante;
}

/**
 * Lit le corps (chaîne, ou flux tel que php://input) sans dépasser la limite.
 * Renvoie null s'il est trop grand.
 *
 * @param string|resource|null $corps
 */
function lireCorps(mixed $corps): ?string
{
    if (is_resource($corps)) {
        $corps = stream_get_contents($corps, TAILLE_MAX_CORPS + 1);
    }
    $corps = is_string($corps) ? $corps : '';

    return strlen($corps) > TAILLE_MAX_CORPS ? null : $corps;
}

/**
 * La requête entière : méthode, taille du corps, puis processLead().
 *
 * @param array<string, mixed> $serveur $_SERVER
 * @param string|resource|null $corps corps brut, ou flux à lire (php://input)
 * @param array<string, mixed> $config voir chargerConfig()
 * @return array{0: int, 1: array<string, mixed>, 2: array<string, string>} [code HTTP, JSON, en-têtes]
 */
function handleRequest(
    array $serveur,
    mixed $corps = null,
    array $config = [],
    ?callable $http = null,
    ?callable $mail = null,
    int|callable|null $now = null,
    ?string $dataDir = null,
    ?callable $journal = null
): array {
    $journal ??= 'error_log';
    if (($serveur['REQUEST_METHOD'] ?? '') !== 'POST') {
        return [405, ['error' => 'methode_non_autorisee'], ['Allow' => 'POST']];
    }

    try {
        $annonce = $serveur['CONTENT_LENGTH'] ?? $serveur['HTTP_CONTENT_LENGTH'] ?? null;
        if (is_numeric($annonce) && (int) $annonce > TAILLE_MAX_CORPS) {
            return [413, ['error' => 'corps_trop_grand'], []];
        }
        $brut = lireCorps($corps);
        if ($brut === null) {
            return [413, ['error' => 'corps_trop_grand'], []];
        }

        return processLead(
            body: $brut,
            ip: ipDuVisiteur($serveur),
            origin: isset($serveur['HTTP_ORIGIN']) ? (string) $serveur['HTTP_ORIGIN'] : null,
            host: isset($serveur['HTTP_HOST']) ? (string) $serveur['HTTP_HOST'] : null,
            config: $config,
            http: $http,
            mail: $mail,
            now: $now,
            dataDir: $dataDir,
            journal: $journal
        );
    } catch (\Throwable $erreur) {
        // Jamais le détail : il pourrait contenir un extrait de la demande.
        $journal('[lead] erreur inattendue : ' . get_class($erreur));

        return [500, ['error' => 'erreur_interne'], []];
    }
}

/**
 * Écrit la réponse HTTP : code, en-têtes, corps JSON.
 *
 * @param array<string, mixed> $json
 * @param array<string, string> $entetes
 */
function repondre(int $status, array $json, array $entetes = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    foreach ($entetes as $nom => $valeur) {
        header($nom . ': ' . $valeur);
    }
    echo json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
