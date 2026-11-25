<?php

/**
 * Tests de la version PHP de /api/lead (hébergement OVH).
 *
 *   php site/tests/php/lead_test.php        résumé
 *   php site/tests/php/lead_test.php -v     une ligne par test
 *
 * Petit harnais maison, sans dépendance. Aucun vrai e-mail ni vraie requête :
 * l'envoi HTTP (Brevo) et mail() sont toujours simulés. Code de sortie 1 au
 * moindre échec. Les cas reprennent ceux de site/tests/api/lead.test.js.
 */

declare(strict_types=1);

namespace Amane\Lead\Tests;

use function Amane\Lead\ackEmail;
use function Amane\Lead\adresseEntete;
use function Amane\Lead\chargerConfig;
use function Amane\Lead\compterEnvoi;
use function Amane\Lead\dateParis;
use function Amane\Lead\dossierLimite;
use function Amane\Lead\fichierLimite;
use function Amane\Lead\handleRequest;
use function Amane\Lead\ipDuVisiteur;
use function Amane\Lead\motsEncodes;
use function Amane\Lead\processLead;
use function Amane\Lead\purgerLimite;
use function Amane\Lead\teamEmail;

use const Amane\Lead\BREVO_URL;
use const Amane\Lead\SERVICES;
use const Amane\Lead\TAILLE_MAX_CORPS;

require dirname(__DIR__, 2) . '/ovh/api/_lib/lead.php';

// ---------------------------------------------------------------------------
// Harnais
// ---------------------------------------------------------------------------

/**
 * État du harnais : compteurs, groupe en cours, dossier de données du test en cours.
 */
function bilan(): \stdClass
{
    static $bilan = null;

    return $bilan ??= (object) [
        'tests' => 0,
        'echecs' => 0,
        'verifications' => 0,
        'bavard' => false,
        'groupe' => '',
        'dossier' => '',
        'aNettoyer' => [],
    ];
}

function groupe(string $nom): void
{
    bilan()->groupe = $nom;
    if (bilan()->bavard) {
        echo "\n$nom\n";
    }
}

/** Lance un test, dans un dossier de données neuf (compteurs de débit vierges). */
function test(string $nom, callable $corps): void
{
    bilan()->tests++;
    bilan()->dossier = nouveauDossier();
    try {
        $corps();
        if (bilan()->bavard) {
            echo "  ok    $nom\n";
        }
    } catch (\Throwable $erreur) {
        bilan()->echecs++;
        // Ligne du test où la vérification a échoué : l'appel fait depuis la fonction du test.
        $ligne = $erreur->getLine();
        foreach ($erreur->getTrace() as $appel) {
            if (str_contains($appel['function'], '{closure}')) {
                break;
            }
            $ligne = $appel['line'] ?? $ligne;
        }
        $ou = ' (ligne ' . $ligne . ')';
        echo '  ÉCHEC ' . bilan()->groupe . " › $nom$ou\n        " . get_class($erreur) . ' : '
            . str_replace("\n", "\n        ", $erreur->getMessage()) . "\n";
    }
}

function nouveauDossier(): string
{
    $dossier = sys_get_temp_dir() . '/amane-test-' . bin2hex(random_bytes(8));
    mkdir($dossier, 0700, true);
    bilan()->aNettoyer[] = $dossier;

    return $dossier;
}

/** Remet les compteurs de débit à zéro au milieu d'un test. */
function viderLimite(): void
{
    array_map('unlink', glob(bilan()->dossier . '/*') ?: []);
}

function montrer(mixed $valeur): string
{
    $texte = is_string($valeur)
        ? $valeur
        : (string) json_encode($valeur, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);

    return strlen($texte) > 400 ? substr($texte, 0, 400) . '…' : $texte;
}

function vrai(mixed $condition, string $message = ''): void
{
    bilan()->verifications++;
    if ($condition !== true) {
        throw new \AssertionError($message !== '' ? $message : 'condition fausse');
    }
}

function faux(mixed $condition, string $message = ''): void
{
    vrai($condition === false, $message !== '' ? $message : 'condition vraie');
}

/** Égalité stricte (types compris ; pour les tableaux, mêmes clés dans le même ordre). */
function egal(mixed $attendu, mixed $obtenu, string $message = ''): void
{
    bilan()->verifications++;
    if ($attendu !== $obtenu) {
        throw new \AssertionError(
            ($message !== '' ? $message . "\n" : '') . 'attendu : ' . montrer($attendu) . "\nobtenu  : " . montrer($obtenu)
        );
    }
}

function contient(string $botte, string $aiguille, string $message = ''): void
{
    bilan()->verifications++;
    if (!str_contains($botte, $aiguille)) {
        throw new \AssertionError(($message !== '' ? $message . ' : ' : '') . 'devrait contenir « ' . montrer($aiguille) . ' »');
    }
}

function absent(string $botte, string $aiguille, string $message = ''): void
{
    bilan()->verifications++;
    if (str_contains($botte, $aiguille)) {
        throw new \AssertionError(
            ($message !== '' ? $message . ' : ' : '') . 'ne devrait pas contenir « ' . montrer($aiguille) . ' »'
        );
    }
}

// ---------------------------------------------------------------------------
// Doublures et données
// ---------------------------------------------------------------------------

const CLE = 'xkeysib-cle-de-test-0123456789';

/** Configuration avec clé Brevo : envoi par l'API. */
const CONFIG = [
    'BREVO_API_KEY' => CLE,
    'LEAD_TO_EMAIL' => 'equipe@amane.test',
    'LEAD_FROM_EMAIL' => 'bonjour@amane.test',
];

/** Configuration sans clé Brevo : repli sur mail(). */
const CONFIG_MAIL = [
    'LEAD_TO_EMAIL' => 'equipe@amane.test',
    'LEAD_FROM_EMAIL' => 'bonjour@amane.test',
];

const DEMANDE = [
    'nom' => 'Jeanne Martin',
    'email' => 'jeanne.martin@example.com',
    'tel' => '+33 6 12 34 56 78',
    'service' => 'chauffeur',
    'date' => '2026-12-12',
    'passagers' => '2',
    'langue' => 'fr',
    'message' => "Un transfert depuis Roissy.\nMerci.",
    'a_laisser_vide' => '',
];

const T0 = 1_800_000_000; // 15 janvier 2027, 09:00 à Paris

/**
 * Faux envoi HTTP : enregistre les appels (dans ->appels) et répond selon
 * $reponses, une entrée par appel : un code HTTP, un code négatif pour une
 * panne réseau, ou une exception à lever. Par défaut : 201.
 */
function fauxHttp(int|\Throwable ...$reponses): object
{
    return new class (array_values($reponses)) {
        /** @var list<array{url: string, entetes: array<string, string>, brut: string, corps: array, delai: int}> */
        public array $appels = [];

        /** @param list<int|\Throwable> $reponses */
        public function __construct(private array $reponses)
        {
        }

        /** @param array<string, string> $entetes */
        public function __invoke(string $url, array $entetes, string $corps, int $delai): int
        {
            $n = count($this->appels);
            $this->appels[] = [
                'url' => $url,
                'entetes' => $entetes,
                'brut' => $corps,
                'corps' => json_decode($corps, true, 512, JSON_THROW_ON_ERROR),
                'delai' => $delai,
            ];
            $reponse = $this->reponses[$n] ?? 201;
            if ($reponse instanceof \Throwable) {
                throw $reponse;
            }

            return $reponse;
        }
    };
}

/**
 * Faux mail() : enregistre les appels (dans ->appels) et renvoie selon
 * $reponses, une entrée par appel (true par défaut).
 */
function fauxMail(bool|\Throwable ...$reponses): object
{
    return new class (array_values($reponses)) {
        /** @var list<array{to: string, subject: string, body: string, headers: array<string, string>, params: string}> */
        public array $appels = [];

        /** @param list<bool|\Throwable> $reponses */
        public function __construct(private array $reponses)
        {
        }

        /** @param array<string, string> $entetes */
        public function __invoke(string $a, string $sujet, string $corps, array $entetes, string $parametres): bool
        {
            $n = count($this->appels);
            $this->appels[] = [
                'to' => $a,
                'subject' => $sujet,
                'body' => $corps,
                'headers' => $entetes,
                'params' => $parametres,
            ];
            $reponse = $this->reponses[$n] ?? true;
            if ($reponse instanceof \Throwable) {
                throw $reponse;
            }

            return $reponse;
        }
    };
}

/**
 * Envoie une demande à processLead(). $surcharge modifie la demande type ;
 * $options : body (corps entier), ip, origin, host, config, http, mail, now.
 *
 * @param array<string, mixed> $surcharge
 * @param array<string, mixed> $options
 * @return array{status: int, json: array<string, mixed>, headers: array<string, string>, appels: array, mails: array, journal: list<string>}
 */
function demander(array $surcharge = [], array $options = []): array
{
    $http = $options['http'] ?? fauxHttp();
    $mail = $options['mail'] ?? fauxMail();
    $journal = new \ArrayObject();
    [$status, $json, $headers] = processLead(
        body: array_key_exists('body', $options) ? $options['body'] : array_merge(DEMANDE, $surcharge),
        ip: $options['ip'] ?? '203.0.113.10',
        origin: array_key_exists('origin', $options) ? $options['origin'] : 'https://amane.test',
        host: array_key_exists('host', $options) ? $options['host'] : 'amane.test',
        config: $options['config'] ?? CONFIG,
        http: $http,
        mail: $mail,
        now: $options['now'] ?? T0,
        dataDir: bilan()->dossier,
        journal: static function (string $ligne) use ($journal): void {
            $journal[] = $ligne;
        }
    );

    return [
        'status' => $status,
        'json' => $json,
        'headers' => $headers,
        'appels' => $http->appels,
        'mails' => $mail->appels,
        'journal' => $journal->getArrayCopy(),
    ];
}

/** Texte visible d'un e-mail HTML, balises retirées. */
function sansBalises(string $html): string
{
    return (string) preg_replace('/<[^>]*>/', ' ', $html);
}

/** Décode une suite de « mots encodés » =?UTF-8?B?…?= ; lève une exception si la forme est mauvaise. */
function decoderMots(string $entete): string
{
    if (!preg_match('/^=\?UTF-8\?B\?[A-Za-z0-9+\/=]+\?=(?: =\?UTF-8\?B\?[A-Za-z0-9+\/=]+\?=)*$/D', $entete)) {
        throw new \AssertionError('en-tête mal encodé : ' . montrer($entete));
    }
    $texte = '';
    foreach (explode(' ', $entete) as $mot) {
        if (strlen($mot) > 75) {
            throw new \AssertionError('mot encodé de plus de 75 caractères : ' . $mot);
        }
        $texte .= base64_decode(substr($mot, 10, -2), true);
    }

    return $texte;
}

/**
 * Décompose un e-mail construit pour mail() : vérifie la structure en deux
 * versions et renvoie les deux contenus décodés.
 *
 * @param array{to: string, subject: string, body: string, headers: array<string, string>, params: string} $mail
 * @return array{texte: string, html: string}
 */
function decoderMail(array $mail): array
{
    $type = $mail['headers']['Content-Type'] ?? '';
    if (!preg_match('/^multipart\/alternative; boundary="([^"\r\n]+)"$/D', $type, $m)) {
        throw new \AssertionError('Content-Type inattendu : ' . montrer($type));
    }
    $limite = $m[1];
    $parties = explode('--' . $limite, $mail['body']);
    egal(4, count($parties), 'deux parties attendues entre trois limites');
    egal('', $parties[0], 'rien avant la première limite');
    egal("--\r\n", $parties[3], 'limite de fin');
    $contenus = [];
    foreach ([1 => 'text/plain', 2 => 'text/html'] as $i => $mime) {
        [$entetes, $base64] = explode("\r\n\r\n", $parties[$i], 2);
        egal("\r\nContent-Type: $mime; charset=UTF-8\r\nContent-Transfer-Encoding: base64", $entetes);
        foreach (explode("\r\n", rtrim($base64, "\r\n")) as $ligne) {
            vrai(strlen($ligne) <= 76, 'ligne base64 de plus de 76 caractères');
        }
        $decode = base64_decode(str_replace("\r\n", '', $base64), true);
        vrai(is_string($decode) && mb_check_encoding($decode, 'UTF-8'), 'contenu décodé en UTF-8');
        $contenus[] = $decode;
    }

    return ['texte' => str_replace("\r\n", "\n", $contenus[0]), 'html' => $contenus[1]];
}

/** Aucun retour à la ligne dans ce qui devient un en-tête d'e-mail. */
function sansRetourLigne(array $mail): void
{
    foreach (array_merge([$mail['to'], $mail['subject'], $mail['params']], array_keys($mail['headers']), array_values($mail['headers'])) as $valeur) {
        vrai(preg_match('/[\r\n]/', $valeur) === 0, 'retour à la ligne dans un en-tête : ' . montrer($valeur));
    }
}

bilan()->bavard = in_array('-v', $argv, true) || in_array('--verbose', $argv, true);

// ---------------------------------------------------------------------------
groupe('pot de miel');

test('a_laisser_vide rempli → 200 {ok:true} sans aucun envoi, avec un signalement', function (): void {
    $r = demander(['a_laisser_vide' => 'https://spam.example']);
    egal(200, $r['status']);
    egal(['ok' => true], $r['json']);
    egal(0, count($r['appels']));
    egal(0, count($r['mails']));
    egal(['[lead] pot de miel'], $r['journal']);
});

test('le piège passe avant la validation et avant la configuration', function (): void {
    $r = demander(['a_laisser_vide' => 'x', 'email' => '', 'tel' => ''], ['config' => []]);
    egal(200, $r['status']);
    egal(['ok' => true], $r['json']);
    egal(0, count($r['appels']) + count($r['mails']));
});

test('le signalement ne contient aucune donnée de la demande', function (): void {
    $r = demander(['a_laisser_vide' => 'VALEUR-DU-ROBOT', 'message' => 'SECRET-DU-CLIENT']);
    egal(1, count($r['journal']));
    foreach (['VALEUR-DU-ROBOT', 'SECRET-DU-CLIENT', 'Jeanne', 'jeanne.martin@example.com', '+33', '203.0.113'] as $interdit) {
        absent($r['journal'][0], $interdit);
    }
});

test('a_laisser_vide vide ou fait d’espaces ne déclenche pas le piège', function (): void {
    $r = demander(['a_laisser_vide' => '   ']);
    egal(['ok' => true, 'ack' => true], $r['json']);
    egal(2, count($r['appels']));
    egal([], $r['journal']);
});

test('a_laisser_vide rempli d’autre chose qu’un texte (nombre, tableau, objet) déclenche le piège', function (): void {
    foreach ([1, 0, true, ['x'], '{"a_laisser_vide":{}}', '{"a_laisser_vide":[]}'] as $valeur) {
        $r = is_string($valeur)
            ? demander([], ['body' => $valeur])
            : demander(['a_laisser_vide' => $valeur]);
        egal(['ok' => true], $r['json'], montrer($valeur));
        egal(0, count($r['appels']));
    }
    foreach ([null, false] as $valeur) {
        viderLimite();
        egal(['ok' => true, 'ack' => true], demander(['a_laisser_vide' => $valeur])['json'], montrer($valeur));
    }
});

test('l’ancien champ « website » rempli n’empêche plus l’envoi', function (): void {
    $r = demander(['website' => 'https://www.exemple-du-client.fr']);
    egal(200, $r['status']);
    egal(['ok' => true, 'ack' => true], $r['json']);
    egal(2, count($r['appels']));
    egal([], $r['journal']);
    // … et sa valeur n'est reprise nulle part.
    foreach ($r['appels'] as $appel) {
        absent($appel['brut'], 'exemple-du-client');
    }
});

// ---------------------------------------------------------------------------
groupe('validation');

test('ni e-mail ni téléphone → 400 contact_requis avec un message', function (): void {
    $r = demander(['email' => '', 'tel' => '   ']);
    egal(400, $r['status']);
    egal('contact_requis', $r['json']['error']);
    vrai(is_string($r['json']['message']) && mb_strlen($r['json']['message']) > 10);
    egal(0, count($r['appels']));
});

test('corps vide → 400 contact_requis', function (): void {
    foreach ([[], '', '   ', '{}', null] as $body) {
        $r = demander([], ['body' => $body]);
        egal(400, $r['status'], montrer($body));
        egal('contact_requis', $r['json']['error']);
        egal(0, count($r['appels']));
    }
});

foreach (
    [
        'jeanne',
        'jeanne@',
        '@example.com',
        'jeanne@example',
        'jeanne martin@example.com',
        'jeanne@@example.com',
        'jeanne..martin@example.com',
        'jeanne@example.com, autre@example.com',
        '<jeanne@example.com>',
        'jeanne@exämple.com',
        'jéanne@example.com',
    ] as $email
) {
    test("e-mail invalide « $email » → 400 email_invalide", function () use ($email): void {
        $r = demander(['email' => $email]);
        egal(400, $r['status']);
        egal(['error' => 'email_invalide'], $r['json']);
        egal(0, count($r['appels']));
    });
}

test('e-mail invalide refusé même si le téléphone est bon', function (): void {
    $r = demander(['email' => 'pas-une-adresse', 'tel' => '+33 6 12 34 56 78']);
    egal(['error' => 'email_invalide'], $r['json']);
});

foreach (['1234567', '06 12 34', 'appelez-moi', '+33 (0)6'] as $tel) {
    test("téléphone invalide « $tel » → 400 tel_invalide", function () use ($tel): void {
        $r = demander(['tel' => $tel]);
        egal(400, $r['status']);
        egal(['error' => 'tel_invalide'], $r['json']);
        egal(0, count($r['appels']));
    });
}

test('téléphone à 8 chiffres accepté, quelle que soit la ponctuation', function (): void {
    $r = demander(['email' => '', 'tel' => '(01) 23.45-67 89']);
    egal(200, $r['status']);
});

test('chiffres arabes dans le téléphone : comptés comme des chiffres', function (): void {
    // ٠١٢٣٤٥٦٧٨٩ (arabes) et ۰۱۲۳۴۵۶۷ (persans) : 8 chiffres ou plus → accepté.
    foreach (['٠١٢٣٤٥٦٧٨٩', '+٩٦٦ ٥٠ ١٢٣ ٤٥٦٧', '۰۱۲۳۴۵۶۷'] as $tel) {
        viderLimite();
        $r = demander(['email' => '', 'tel' => $tel]);
        egal(200, $r['status'], $tel);
        egal(['ok' => true, 'ack' => false], $r['json']);
        contient($r['appels'][0]['corps']['textContent'], "Téléphone : $tel\n");
    }
    // Sept chiffres arabes seulement → refusé.
    $r = demander(['email' => '', 'tel' => '٠١٢٣٤٥٦']);
    egal(400, $r['status']);
    egal(['error' => 'tel_invalide'], $r['json']);
});

test('corps JSON illisible → 400 corps_invalide', function (): void {
    foreach (['{nom:', '[1,2]', '"texte"', 'null', '42', "{\"nom\":\"\xFF\"}", ['a', 'b'], 42, true] as $body) {
        $r = demander([], ['body' => $body]);
        egal(400, $r['status'], montrer($body));
        egal(['error' => 'corps_invalide'], $r['json']);
        egal(0, count($r['appels']));
    }
});

test('corps reçu en chaîne JSON', function (): void {
    $r = demander([], ['body' => json_encode(DEMANDE)]);
    egal(['ok' => true, 'ack' => true], $r['json']);
    egal(2, count($r['appels']));
});

test('tailles maximales et caractères de contrôle', function (): void {
    $r = demander([
        'nom' => '  ' . str_repeat('N', 300) . '  ',
        'tel' => str_repeat('0', 300),
        // NUL, BEL, puis U+202E (inversion du sens d'écriture), puis CR LF.
        'message' => "Bonjour\x00\x07 à vous\xE2\x80\xAE\r\n" . str_repeat('m', 6000),
    ]);
    egal(200, $r['status']);
    $equipe = $r['appels'][0]['corps'];
    contient($equipe['subject'], str_repeat('N', 120));
    absent($equipe['subject'], str_repeat('N', 121));
    $texte = $equipe['textContent'];
    contient($texte, str_repeat('0', 40));
    absent($texte, str_repeat('0', 41));
    contient($texte, "Bonjour à vous\n");
    absent($texte, str_repeat('m', 4000));
    contient($texte, str_repeat('m', 3900));
    $controle = '/[\x00-\x09\x0B-\x1F\x7F]|\xE2\x80\xAE/';
    egal(0, preg_match($controle, $texte));
    egal(0, preg_match($controle, $equipe['htmlContent']));
});

test('les tailles se comptent comme en JavaScript (un émoji = deux unités)', function (): void {
    $r = demander(['nom' => str_repeat('😀', 100)]);
    $sujet = $r['appels'][0]['corps']['subject'];
    egal('Nouvelle demande — Chauffeur privé — ' . str_repeat('😀', 60), $sujet);
    vrai(mb_check_encoding($sujet, 'UTF-8'), 'pas de demi-émoji au bout');
});

test('valeurs qui ne sont pas des chaînes : ignorées, sauf les nombres', function (): void {
    $r = demander(['nom' => ['a' => 1], 'service' => ['x'], 'passagers' => 3, 'message' => null]);
    egal(200, $r['status']);
    $equipe = $r['appels'][0]['corps'];
    egal('Nouvelle demande — Autre demande — Nom non précisé', $equipe['subject']);
    contient($equipe['textContent'], 'Passagers : 3');
    absent($equipe['htmlContent'], 'Array');
    absent($equipe['htmlContent'], '[object');
});

// ---------------------------------------------------------------------------
groupe('champs fermés : service, date, passagers');

const IDENTIFIANTS = [
    'voitures',
    'chauffeur',
    'van',
    'sejours',
    'immobilier',
    'tables',
    'evenements',
    'shopping',
    'esthetique',
    'creation',
    'conciergerie',
    'autre',
];

const LIBELLES = [
    'fr' => [
        "Voitures d'exception",
        'Chauffeur privé',
        'Van VIP',
        'Séjours clé en main',
        'Immobilier',
        'Tables & restaurants',
        'Événements',
        'Personal shopping',
        'Séjour esthétique',
        'Création & marketing',
        'Conciergerie sur demande',
        'Autre demande',
    ],
    'en' => [
        'Exceptional cars',
        'Private chauffeur',
        'VIP van',
        'Turnkey stays',
        'Real estate',
        'Tables & restaurants',
        'Events',
        'Personal shopping',
        'Aesthetic stay',
        'Creative & marketing',
        'Concierge on request',
        'Other request',
    ],
    'es' => [
        'Coches excepcionales',
        'Chófer privado',
        'Van VIP',
        'Estancias llave en mano',
        'Inmobiliaria',
        'Mesas y restaurantes',
        'Eventos',
        'Personal shopping',
        'Estancia estética',
        'Creación y marketing',
        'Concierge a demanda',
        'Otra solicitud',
    ],
    'ar' => [
        'سيارات استثنائية',
        'سائق خاص',
        'فان VIP',
        'إقامات متكاملة',
        'العقارات',
        'المطاعم والحجوزات',
        'الفعاليات',
        'التسوّق الشخصي',
        'إقامة تجميلية',
        'الإبداع والتسويق',
        'كونسيرج عند الطلب',
        'طلب آخر',
    ],
];

test('la liste des identifiants est celle du formulaire, dans le même ordre', function (): void {
    egal(IDENTIFIANTS, SERVICES);
    egal(12, count(SERVICES));
    foreach (['fr', 'en', 'es', 'ar'] as $langue) {
        egal(count(SERVICES), count(LIBELLES[$langue]));
    }
});

test('chaque identifiant donne son libellé : français pour l’équipe, langue du client pour l’accusé', function (): void {
    foreach (SERVICES as $i => $service) {
        $equipe = teamEmail(array_merge(DEMANDE, ['service' => $service]));
        egal('Nouvelle demande — ' . LIBELLES['fr'][$i] . ' — Jeanne Martin', $equipe['subject']);
        contient($equipe['text'], 'Service : ' . LIBELLES['fr'][$i]);
        foreach (['fr', 'en', 'es', 'ar'] as $langue) {
            $accuse = ackEmail(array_merge(DEMANDE, ['service' => $service, 'langue' => $langue]));
            contient($accuse['text'], LIBELLES[$langue][$i], "$service / $langue (texte)");
            $echappe = str_replace(['&', "'"], ['&amp;', '&#39;'], LIBELLES[$langue][$i]);
            contient(sansBalises($accuse['html']), $echappe, "$service / $langue");
        }
    }
});

foreach (SERVICES as $i => $service) {
    foreach (['fr', 'en', 'es', 'ar'] as $langue) {
        $libelle = LIBELLES[$langue][$i];
        test(
            "service « $service », client $langue : libellé français pour l’équipe, « $libelle » dans l’accusé",
            function () use ($service, $langue, $libelle, $i): void {
                $r = demander(['service' => $service, 'langue' => $langue]);
                egal(['ok' => true, 'ack' => true], $r['json']);
                [$equipe, $accuse] = [$r['appels'][0]['corps'], $r['appels'][1]['corps']];
                $fr = LIBELLES['fr'][$i];
                $html = static fn (string $texte): string => str_replace(['&', "'"], ['&amp;', '&#39;'], $texte);

                egal("Nouvelle demande — $fr — Jeanne Martin", $equipe['subject']);
                contient($equipe['textContent'], "Service : $fr\n");
                contient($equipe['htmlContent'], '>' . $html($fr) . '</span>');

                contient($accuse['textContent'], $libelle);
                contient($accuse['htmlContent'], '>' . $html($libelle) . '</span>');
                if ($service !== 'autre') {
                    absent($accuse['textContent'], 'Autre demande');
                }
            }
        );
    }
}

foreach (
    [
        'tables' => ['fr' => 'Tables & restaurants', 'en' => 'Tables & restaurants'],
        'creation' => ['fr' => 'Création & marketing', 'en' => 'Creative & marketing'],
    ] as $service => $parLangue
) {
    test(
        "« & » du libellé de « $service » : échappé dans le HTML, intact dans le sujet et le texte",
        function () use ($service, $parLangue): void {
            foreach ($parLangue as $langue => $libelle) {
                viderLimite();
                $r = demander(['service' => $service, 'langue' => $langue]);
                [$equipe, $accuse] = [$r['appels'][0]['corps'], $r['appels'][1]['corps']];
                egal('Nouvelle demande — ' . $parLangue['fr'] . ' — Jeanne Martin', $equipe['subject']);
                foreach ([[$equipe, $parLangue['fr']], [$accuse, $libelle]] as [$corps, $attendu]) {
                    contient($corps['textContent'], $attendu);
                    absent($corps['textContent'], '&amp;');
                    contient($corps['htmlContent'], str_replace('&', '&amp;', $attendu));
                    absent($corps['htmlContent'], $attendu, 'aucun « & » nu dans le HTML');
                    // Aucun « & » du HTML qui ne soit le début d'une entité.
                    egal(0, preg_match('/&(?!(?:amp|lt|gt|quot|nbsp|#39);)/', $corps['htmlContent']));
                }
                contient($accuse['subject'], 'Amane');
            }
        }
    );
}

foreach (
    [
        'Location de yacht',
        'chauffeur privé',
        '<b>van</b>',
        "chauffeur\nSubject: gagné",
        '',
        null,
        42,
        ['van'],
    ] as $service
) {
    test('service inconnu ' . montrer($service) . ' → « autre »', function () use ($service): void {
        $r = demander(['service' => $service]);
        egal(200, $r['status']);
        [$equipe, $accuse] = [$r['appels'][0]['corps'], $r['appels'][1]['corps']];
        egal('Nouvelle demande — Autre demande — Jeanne Martin', $equipe['subject']);
        contient($equipe['textContent'], 'Service : Autre demande');
        contient($accuse['textContent'], 'Service : Autre demande');
        if (is_string($service) && trim($service) !== '') {
            $saisie = explode("\n", $service)[0];
            foreach ([$equipe, $accuse] as $corps) {
                absent($corps['subject'], $saisie);
                absent($corps['textContent'], $saisie, 'la valeur saisie n’est reprise nulle part');
            }
        }
    });
}

test('identifiant connu accepté quelle que soit la casse', function (): void {
    $r = demander(['service' => ' Van ']);
    egal('Nouvelle demande — Van VIP — Jeanne Martin', $r['appels'][0]['corps']['subject']);
});

foreach (
    [
        '12 décembre, 19 h',
        '12/12/2026',
        '2026-12-12T19:00',
        '2026-12-12 <b>soir</b>',
        '2026-1-5',
        '2026-02-30',
        '2025-02-29',
        '2026-13-01',
        '2026-00-10',
        '0000-01-01',
        "demain\nBcc: x@y.z",
        '٢٠٢٦-١٢-١٢',
        20261212,
        null,
    ] as $date
) {
    test('date invalide ' . montrer($date) . ' → ignorée', function () use ($date): void {
        $r = demander(['date' => $date]);
        egal(200, $r['status'], 'une date invalide ne bloque pas la demande');
        [$equipe, $accuse] = [$r['appels'][0]['corps'], $r['appels'][1]['corps']];
        contient($equipe['textContent'], 'Date : —');
        absent($accuse['textContent'], 'Date');
        absent(sansBalises($accuse['htmlContent']), 'Date');
        if (is_string($date)) {
            foreach ([$equipe, $accuse] as $corps) {
                absent($corps['textContent'], explode("\n", $date)[0]);
            }
        }
    });
}

test('date valide : écrite en toutes lettres, y compris un 29 février bissextile', function (): void {
    $r = demander(['date' => '2028-02-29']);
    contient($r['appels'][0]['corps']['textContent'], 'Date : 29 février 2028');
    contient($r['appels'][1]['corps']['textContent'], 'Date : 29 février 2028');
});

test('date entourée d’espaces : tolérée, comme dans la version JavaScript', function (): void {
    $r = demander(['date' => " 2026-12-12\n"]);
    contient($r['appels'][0]['corps']['textContent'], 'Date : 12 décembre 2026');
});

test('date écrite dans la langue du client, pour les douze mois', function (): void {
    $attendus = [
        'fr' => ['1 janvier 2027', '1 février 2027', '1 mars 2027', '1 avril 2027', '1 mai 2027', '1 juin 2027',
            '1 juillet 2027', '1 août 2027', '1 septembre 2027', '1 octobre 2027', '1 novembre 2027', '1 décembre 2027'],
        'en' => ['1 January 2027', '1 February 2027', '1 March 2027', '1 April 2027', '1 May 2027', '1 June 2027',
            '1 July 2027', '1 August 2027', '1 September 2027', '1 October 2027', '1 November 2027', '1 December 2027'],
        'es' => ['1 de enero de 2027', '1 de febrero de 2027', '1 de marzo de 2027', '1 de abril de 2027',
            '1 de mayo de 2027', '1 de junio de 2027', '1 de julio de 2027', '1 de agosto de 2027',
            '1 de septiembre de 2027', '1 de octubre de 2027', '1 de noviembre de 2027', '1 de diciembre de 2027'],
        'ar' => ['1 يناير 2027', '1 فبراير 2027', '1 مارس 2027', '1 أبريل 2027', '1 مايو 2027', '1 يونيو 2027',
            '1 يوليو 2027', '1 أغسطس 2027', '1 سبتمبر 2027', '1 أكتوبر 2027', '1 نوفمبر 2027', '1 ديسمبر 2027'],
    ];
    foreach ($attendus as $langue => $mois) {
        foreach ($mois as $i => $attendu) {
            $accuse = ackEmail(['langue' => $langue, 'date' => sprintf('2027-%02d-01', $i + 1)]);
            contient($accuse['text'], $attendu . "\n", "$langue, mois " . ($i + 1));
            contient($accuse['html'], '>' . $attendu . '</span>');
        }
    }
});

foreach (['0', '8', '9', '10', '12', '-1', '2.5', 'deux', '8 +', '99999999', '2 <b>', '٣', 0, 8, 2.5, null] as $passagers) {
    test('passagers invalides ' . montrer($passagers) . ' → ignorés', function () use ($passagers): void {
        $r = demander(['passagers' => $passagers]);
        egal(200, $r['status']);
        contient($r['appels'][0]['corps']['textContent'], 'Passagers : —');
        absent($r['appels'][1]['corps']['textContent'], 'Passagers');
    });
}

foreach (['1', '2', '3', '4', '5', '6', '7', '8+', 5] as $passagers) {
    test('passagers valides ' . montrer($passagers), function () use ($passagers): void {
        $r = demander(['passagers' => $passagers]);
        contient($r['appels'][0]['corps']['textContent'], "Passagers : $passagers\n");
        contient($r['appels'][1]['corps']['textContent'], "Passagers : $passagers\n");
    });
}

// ---------------------------------------------------------------------------
groupe('origine');

test('origine étrangère → 403 origine_refusee', function (): void {
    $r = demander([], ['origin' => 'https://pirate.example', 'host' => 'amane.test']);
    egal(403, $r['status']);
    egal(['error' => 'origine_refusee'], $r['json']);
    egal(0, count($r['appels']));
});

test('sous-domaine ou hôte qui ressemble → 403', function (): void {
    foreach (
        [
            'https://amane.test.pirate.example',
            'https://faux-amane.test',
            'null',
            'amane.test',
            'https://amane.test@pirate.example',
            'https://pirate.example/amane.test',
            'ftp://amane.test',
            'https://amane.test:8443',
        ] as $origin
    ) {
        $r = demander([], ['origin' => $origin, 'host' => 'amane.test']);
        egal(403, $r['status'], $origin);
        egal(0, count($r['appels']));
    }
});

test('origine égale à Host → acceptée (casse et port compris)', function (): void {
    egal(200, demander([], ['origin' => 'https://Amane.Test', 'host' => 'amane.test'])['status']);
    viderLimite();
    egal(200, demander([], ['origin' => 'http://localhost:3000', 'host' => 'localhost:3000'])['status']);
    viderLimite();
    egal(200, demander([], ['origin' => 'https://amane.test:443', 'host' => 'amane.test'])['status'], 'port par défaut');
    viderLimite();
    egal(200, demander([], ['origin' => 'https://amane.test', 'host' => 'AMANE.test'])['status']);
});

test('pas d’en-tête Origin → acceptée', function (): void {
    egal(200, demander([], ['origin' => null])['status']);
    viderLimite();
    egal(200, demander([], ['origin' => ''])['status']);
});

test('ALLOWED_ORIGINS : origine complète ou hôte seul', function (): void {
    $config = CONFIG + ['ALLOWED_ORIGINS' => ' https://www.amane.test , apercu.amane.test,'];
    $essai = static fn (string $origin): int
        => demander([], ['origin' => $origin, 'host' => 'amane.test', 'config' => $config])['status'];
    egal(200, $essai('https://www.amane.test'));
    viderLimite();
    egal(200, $essai('https://apercu.amane.test'));
    viderLimite();
    egal(403, $essai('http://www.amane.test'), 'une origine complète impose aussi le protocole');
    egal(403, $essai('https://autre.example'));
});

// ---------------------------------------------------------------------------
groupe('configuration');

foreach (['LEAD_TO_EMAIL', 'LEAD_FROM_EMAIL'] as $manquante) {
    foreach (['Brevo' => CONFIG, 'mail()' => CONFIG_MAIL] as $mode => $base) {
        test("sans $manquante ($mode) → 503 email_off", function () use ($manquante, $base): void {
            foreach ([null, '', '  '] as $valeur) {
                $config = $base;
                if ($valeur === null) {
                    unset($config[$manquante]);
                } else {
                    $config[$manquante] = $valeur;
                }
                $r = demander([], ['config' => $config]);
                egal(503, $r['status']);
                egal('email_off', $r['json']['error']);
                vrai(is_string($r['json']['message']) && $r['json']['message'] !== '');
                egal(0, count($r['appels']) + count($r['mails']));
            }
        });
    }
}

test('sans aucune configuration → 503 email_off', function (): void {
    $r = demander([], ['config' => []]);
    egal(503, $r['status']);
    egal('email_off', $r['json']['error']);
    egal(0, count($r['appels']) + count($r['mails']));
});

test('sans BREVO_API_KEY : pas de 503, repli sur mail()', function (): void {
    foreach ([CONFIG_MAIL, CONFIG_MAIL + ['BREVO_API_KEY' => ''], CONFIG_MAIL + ['BREVO_API_KEY' => '   ']] as $config) {
        viderLimite();
        $r = demander([], ['config' => $config]);
        egal(200, $r['status']);
        egal(['ok' => true, 'ack' => true], $r['json']);
        egal(0, count($r['appels']), 'aucune requête vers Brevo');
        egal(2, count($r['mails']));
    }
});

test('avec BREVO_API_KEY : envoi par Brevo, mail() n’est pas appelé', function (): void {
    $r = demander();
    egal(2, count($r['appels']));
    egal(0, count($r['mails']));
});

test('LEAD_FROM_NAME : « Amane » par défaut, sinon la valeur donnée', function (): void {
    $a = demander();
    egal(['name' => 'Amane', 'email' => 'bonjour@amane.test'], $a['appels'][0]['corps']['sender']);
    viderLimite();
    $b = demander([], ['config' => CONFIG + ['LEAD_FROM_NAME' => 'Amane Paris']]);
    egal(['name' => 'Amane Paris', 'email' => 'bonjour@amane.test'], $b['appels'][1]['corps']['sender']);
});

test('chargerConfig : le fichier d’abord, puis la variable d’environnement pour chaque clé vide', function (): void {
    $fichier = bilan()->dossier . '/amane-config.php';
    file_put_contents($fichier, "<?php\nreturn ['BREVO_API_KEY' => ' cle-du-fichier ', 'LEAD_TO_EMAIL' => '', 'LEAD_FROM_NAME' => 'Amane'];\n");
    $env = [
        'BREVO_API_KEY' => 'cle-de-l-environnement',
        'LEAD_TO_EMAIL' => ' equipe@env.test ',
        'LEAD_FROM_EMAIL' => 'bonjour@env.test',
        'AUTRE' => 'ignorée',
    ];
    $config = chargerConfig($fichier, static fn (string $cle) => $env[$cle] ?? false);
    egal([
        'BREVO_API_KEY' => 'cle-du-fichier',
        'LEAD_TO_EMAIL' => 'equipe@env.test',
        'LEAD_FROM_EMAIL' => 'bonjour@env.test',
        'LEAD_FROM_NAME' => 'Amane',
        'ALLOWED_ORIGINS' => '',
    ], $config);
});

test('chargerConfig : fichier absent → variables d’environnement seules, sinon tout vide', function (): void {
    $absent = bilan()->dossier . '/pas-de-fichier.php';
    $config = chargerConfig($absent, static fn (string $cle) => $cle === 'LEAD_TO_EMAIL' ? 'equipe@env.test' : false);
    egal('equipe@env.test', $config['LEAD_TO_EMAIL']);
    egal('', $config['BREVO_API_KEY']);
    egal(['', '', '', '', ''], array_values(chargerConfig($absent, static fn (string $cle) => false)));
    egal(503, demander([], ['config' => chargerConfig($absent, static fn (string $cle) => false)])['status']);
});

test('chargerConfig : fichier défectueux → ignoré, sans rien afficher ni divulguer', function (): void {
    $cas = [
        'pas un tableau' => "<?php\nreturn 'SECRET-EN-CLAIR';\n",
        'erreur de syntaxe' => "<?php\nreturn ['BREVO_API_KEY' => 'SECRET-EN-CLAIR'\n",
        'exception' => "<?php\nthrow new RuntimeException('SECRET-EN-CLAIR');\n",
    ];
    foreach ($cas as $nom => $contenu) {
        $fichier = bilan()->dossier . '/config-' . md5($nom) . '.php';
        file_put_contents($fichier, $contenu);
        $journal = [];
        ob_start();
        $config = chargerConfig($fichier, static fn (string $cle) => false, function (string $l) use (&$journal): void {
            $journal[] = $l;
        });
        egal('', ob_get_clean(), $nom);
        egal(['', '', '', '', ''], array_values($config), $nom);
        egal(1, count($journal), $nom);
        absent($journal[0], 'SECRET-EN-CLAIR', $nom);
    }
});

test('chargerConfig : un fichier qui affiche quelque chose ne pollue pas la réponse', function (): void {
    $fichier = bilan()->dossier . '/config-bavarde.php';
    file_put_contents($fichier, "\n\n<?php\necho 'bonjour';\nreturn ['LEAD_TO_EMAIL' => 'equipe@amane.test'];\n");
    ob_start();
    $config = chargerConfig($fichier, static fn (string $cle) => false);
    egal('', ob_get_clean());
    egal('equipe@amane.test', $config['LEAD_TO_EMAIL']);
});

test('le modèle amane-config.example.php renvoie les cinq clés, sans aucune valeur réelle', function (): void {
    ob_start();
    $modele = require dirname(__DIR__, 2) . '/ovh/amane-config.example.php';
    egal('', ob_get_clean());
    egal(['BREVO_API_KEY', 'LEAD_TO_EMAIL', 'LEAD_FROM_EMAIL', 'LEAD_FROM_NAME', 'ALLOWED_ORIGINS'], array_keys($modele));
    egal(['', '', '', 'Amane', ''], array_values($modele));
    egal(503, demander([], ['config' => $modele])['status']);
});

// ---------------------------------------------------------------------------
groupe('envoi par Brevo');

test('e-mail à l’équipe puis accusé de réception', function (): void {
    $r = demander();
    egal(200, $r['status']);
    egal(['ok' => true, 'ack' => true], $r['json']);
    egal([], $r['headers']);
    egal(2, count($r['appels']));

    foreach ($r['appels'] as $appel) {
        egal('https://api.brevo.com/v3/smtp/email', $appel['url']);
        egal(BREVO_URL, $appel['url']);
        egal(CLE, $appel['entetes']['api-key']);
        egal('application/json', $appel['entetes']['content-type']);
        egal(8, $appel['delai'], 'délai maximal par appel, en secondes');
        egal(['name' => 'Amane', 'email' => 'bonjour@amane.test'], $appel['corps']['sender']);
        vrai(str_starts_with($appel['corps']['htmlContent'], '<!DOCTYPE html>'));
        vrai($appel['corps']['textContent'] !== '');
        egal(0, preg_match('/[\r\n]/', $appel['corps']['subject']));
    }

    [$equipe, $accuse] = [$r['appels'][0]['corps'], $r['appels'][1]['corps']];
    egal([['email' => 'equipe@amane.test']], $equipe['to']);
    egal(['email' => 'jeanne.martin@example.com', 'name' => 'Jeanne Martin'], $equipe['replyTo']);
    egal('Nouvelle demande — Chauffeur privé — Jeanne Martin', $equipe['subject']);
    foreach (
        [
            'Jeanne Martin',
            'jeanne.martin@example.com',
            '+33 6 12 34 56 78',
            'Chauffeur privé',
            '12 décembre 2026',
            'Un transfert depuis Roissy.',
        ] as $valeur
    ) {
        contient($equipe['htmlContent'], $valeur, 'HTML équipe');
        contient($equipe['textContent'], $valeur, 'texte équipe');
    }
    contient($equipe['htmlContent'], 'Un transfert depuis Roissy.<br>Merci.');
    contient($equipe['textContent'], 'Reçue le : 15 janvier 2027 à 09:00 (heure de Paris)');

    egal([['email' => 'jeanne.martin@example.com']], $accuse['to'], 'pas de nom saisi dans le destinataire');
    faux(array_key_exists('replyTo', $accuse));
    contient($accuse['subject'], 'Amane');
    contient($accuse['htmlContent'], 'Nous avons bien reçu votre demande.');
    contient($accuse['textContent'], 'Nous avons bien reçu votre demande.');
    foreach (['Service : Chauffeur privé', 'Date : 12 décembre 2026', 'Passagers : 2'] as $valeur) {
        contient($accuse['textContent'], $valeur, 'texte accusé');
    }
    foreach (['Chauffeur privé', '12 décembre 2026'] as $valeur) {
        contient($accuse['htmlContent'], $valeur, 'HTML accusé');
    }
});

test('le corps envoyé à Brevo est du JSON en UTF-8, sans échappement inutile', function (): void {
    $r = demander(['nom' => 'Zoé Lefèvre']);
    $brut = $r['appels'][0]['brut'];
    contient($brut, '"subject":"Nouvelle demande — Chauffeur privé — Zoé Lefèvre"');
    absent($brut, '\\u00e9');
    egal(['sender', 'to', 'subject', 'htmlContent', 'textContent', 'replyTo'], array_keys($r['appels'][0]['corps']));
    egal(['sender', 'to', 'subject', 'htmlContent', 'textContent'], array_keys($r['appels'][1]['corps']));
});

test('téléphone seul : un seul e-mail, sans replyTo, ack:false', function (): void {
    $r = demander(['email' => '']);
    egal(200, $r['status']);
    egal(['ok' => true, 'ack' => false], $r['json']);
    egal(1, count($r['appels']));
    faux(array_key_exists('replyTo', $r['appels'][0]['corps']));
    egal([['email' => 'equipe@amane.test']], $r['appels'][0]['corps']['to']);
    contient($r['appels'][0]['corps']['textContent'], 'Le client n’a pas laissé d’e-mail');
});

test('e-mail seul, sans nom : replyTo et destinataire sans champ name', function (): void {
    $r = demander(['nom' => '', 'tel' => '']);
    egal(['ok' => true, 'ack' => true], $r['json']);
    egal(['email' => 'jeanne.martin@example.com'], $r['appels'][0]['corps']['replyTo']);
    egal([['email' => 'jeanne.martin@example.com']], $r['appels'][1]['corps']['to']);
    egal('Nouvelle demande — Chauffeur privé — Nom non précisé', $r['appels'][0]['corps']['subject']);
});

test('plusieurs destinataires dans LEAD_TO_EMAIL', function (): void {
    $r = demander([], ['config' => ['LEAD_TO_EMAIL' => 'a@amane.test, b@amane.test;c@amane.test'] + CONFIG]);
    egal(
        [['email' => 'a@amane.test'], ['email' => 'b@amane.test'], ['email' => 'c@amane.test']],
        $r['appels'][0]['corps']['to']
    );
});

test('échec de l’e-mail à l’équipe (HTTP 401) → 502, pas d’accusé', function (): void {
    $r = demander([], ['http' => fauxHttp(401)]);
    egal(502, $r['status']);
    egal(['error' => 'envoi_impossible'], $r['json']);
    egal(1, count($r['appels']));
    egal(1, count($r['journal']));
    contient($r['journal'][0], '401');
});

test('échec de l’e-mail à l’équipe (l’envoi lève une exception) → 502, pas d’accusé', function (): void {
    $r = demander([], ['http' => fauxHttp(new \RuntimeException('connexion impossible'))]);
    egal(502, $r['status']);
    egal(['error' => 'envoi_impossible'], $r['json']);
    egal(1, count($r['appels']));
    egal(1, count($r['journal']));
});

test('échec de l’e-mail à l’équipe (panne réseau) → 502, pas d’accusé', function (): void {
    $r = demander([], ['http' => fauxHttp(-7)]);
    egal(502, $r['status']);
    egal(1, count($r['appels']));
    contient($r['journal'][0], 'erreur réseau');
});

test('échec de l’accusé seul (HTTP 400) → 200 ack:false', function (): void {
    $r = demander([], ['http' => fauxHttp(201, 400)]);
    egal(200, $r['status']);
    egal(['ok' => true, 'ack' => false], $r['json']);
    egal(2, count($r['appels']));
    contient($r['journal'][0], '400');
});

test('échec de l’accusé seul (délai dépassé) → 200 ack:false', function (): void {
    $r = demander([], ['http' => fauxHttp(201, -28)]);
    egal(200, $r['status']);
    egal(['ok' => true, 'ack' => false], $r['json']);
    contient($r['journal'][0], 'délai dépassé');
});

test('tout code hors 2xx est un échec (301, 0, 500), tout 2xx un succès', function (): void {
    foreach ([301, 0, 500, 199, 300] as $code) {
        viderLimite();
        egal(502, demander([], ['http' => fauxHttp($code)])['status'], (string) $code);
    }
    foreach ([200, 201, 202, 299] as $code) {
        viderLimite();
        egal(['ok' => true, 'ack' => true], demander([], ['http' => fauxHttp($code, $code)])['json'], (string) $code);
    }
});

test('le journal ne contient ni la clé API ni le contenu de la demande', function (): void {
    $a = demander(['message' => 'SECRET-DU-CLIENT'], ['http' => fauxHttp(500)]);
    viderLimite();
    $b = demander(
        ['message' => 'SECRET-DU-CLIENT'],
        ['http' => fauxHttp(201, new \RuntimeException('boum ' . CLE . ' SECRET-DU-CLIENT'))]
    );
    $journal = array_merge($a['journal'], $b['journal']);
    egal(2, count($journal));
    $tout = implode("\n", $journal);
    contient($tout, '500');
    foreach ([CLE, 'SECRET-DU-CLIENT', 'jeanne.martin@example.com', 'Jeanne', '+33 6 12'] as $interdit) {
        absent($tout, $interdit, 'journal');
    }
});

// ---------------------------------------------------------------------------
groupe('envoi par mail()');

test('e-mail à l’équipe puis accusé : destinataires, sujets encodés, From, Reply-To', function (): void {
    $r = demander([], ['config' => CONFIG_MAIL]);
    egal(200, $r['status']);
    egal(['ok' => true, 'ack' => true], $r['json']);
    egal(0, count($r['appels']));
    egal(2, count($r['mails']));
    [$equipe, $accuse] = $r['mails'];

    egal('equipe@amane.test', $equipe['to']);
    egal('Nouvelle demande — Chauffeur privé — Jeanne Martin', decoderMots($equipe['subject']));
    egal(
        ['From', 'Reply-To', 'MIME-Version', 'Content-Type'],
        array_keys($equipe['headers'])
    );
    egal('Amane <bonjour@amane.test>', $equipe['headers']['From']);
    egal('Jeanne Martin <jeanne.martin@example.com>', $equipe['headers']['Reply-To']);
    egal('1.0', $equipe['headers']['MIME-Version']);
    egal('-fbonjour@amane.test', $equipe['params']);

    egal('jeanne.martin@example.com', $accuse['to']);
    egal('Nous avons bien reçu votre demande — Amane', decoderMots($accuse['subject']));
    egal(['From', 'MIME-Version', 'Content-Type'], array_keys($accuse['headers']), 'pas de Reply-To sur l’accusé');
    egal('Amane <bonjour@amane.test>', $accuse['headers']['From']);

    foreach ($r['mails'] as $mail) {
        sansRetourLigne($mail);
    }
});

test('e-mail en deux versions (texte + HTML), UTF-8, identiques à ceux de Brevo', function (): void {
    $parMail = demander([], ['config' => CONFIG_MAIL]);
    viderLimite();
    $parBrevo = demander();
    foreach ([0, 1] as $i) {
        $contenu = decoderMail($parMail['mails'][$i]);
        egal($parBrevo['appels'][$i]['corps']['textContent'], $contenu['texte']);
        egal($parBrevo['appels'][$i]['corps']['htmlContent'], $contenu['html']);
        egal($parBrevo['appels'][$i]['corps']['subject'], decoderMots($parMail['mails'][$i]['subject']));
        // Corps du message : lignes courtes, fins de ligne CRLF, rien que de l'ASCII.
        egal(0, preg_match('/[^\x0A\x0D\x20-\x7E]/', $parMail['mails'][$i]['body']));
        egal(0, preg_match('/(?<!\r)\n|\r(?!\n)/', $parMail['mails'][$i]['body']));
    }
    contient(decoderMail($parMail['mails'][0])['texte'], 'Un transfert depuis Roissy.');
    contient(decoderMail($parMail['mails'][1])['html'], 'Chauffeur privé');
});

test('accusé en arabe : sujet encodé en mots de 75 caractères au plus, contenu en dir="rtl"', function (): void {
    $r = demander(['langue' => 'ar'], ['config' => CONFIG_MAIL]);
    $accuse = $r['mails'][1];
    egal('تلقّينا طلبكم — Amane', decoderMots($accuse['subject']));
    egal(0, preg_match('/[^\x20-\x7E]/', $accuse['subject']), 'sujet en ASCII pur');
    contient(decoderMail($accuse)['html'], '<html lang="ar" dir="rtl"');
});

test('sujet long et accentué : découpé sans couper un caractère', function (): void {
    $nom = str_repeat('Éléonore ', 12) . 'محمد 😀';
    $r = demander(['nom' => $nom], ['config' => CONFIG_MAIL]);
    $sujet = $r['mails'][0]['subject'];
    vrai(count(explode(' ', $sujet)) > 3, 'plusieurs mots encodés');
    egal("Nouvelle demande — Chauffeur privé — $nom", decoderMots($sujet));
    foreach (explode(' ', $sujet) as $mot) {
        vrai(mb_check_encoding((string) base64_decode(substr($mot, 10, -2), true), 'UTF-8'), 'chaque mot est de l’UTF-8 entier');
    }
    sansRetourLigne($r['mails'][0]);
    egal($nom, decoderMots(explode(' <', $r['mails'][0]['headers']['Reply-To'])[0]));
});

test('plusieurs destinataires dans LEAD_TO_EMAIL', function (): void {
    $r = demander([], ['config' => ['LEAD_TO_EMAIL' => 'a@amane.test, b@amane.test'] + CONFIG_MAIL]);
    egal('a@amane.test, b@amane.test', $r['mails'][0]['to']);
    egal('jeanne.martin@example.com', $r['mails'][1]['to']);
});

test('téléphone seul : un seul e-mail, sans Reply-To, ack:false', function (): void {
    $r = demander(['email' => ''], ['config' => CONFIG_MAIL]);
    egal(['ok' => true, 'ack' => false], $r['json']);
    egal(1, count($r['mails']));
    faux(array_key_exists('Reply-To', $r['mails'][0]['headers']));
});

test('e-mail seul, sans nom : Reply-To réduit à l’adresse', function (): void {
    $r = demander(['nom' => '', 'tel' => ''], ['config' => CONFIG_MAIL]);
    egal('jeanne.martin@example.com', $r['mails'][0]['headers']['Reply-To']);
});

test('LEAD_FROM_NAME : tel quel, entre guillemets ou encodé selon les caractères', function (): void {
    $de = static fn (string $nom): string
        => demander([], ['config' => CONFIG_MAIL + ['LEAD_FROM_NAME' => $nom]])['mails'][0]['headers']['From'];
    egal('Amane Paris <bonjour@amane.test>', $de('Amane Paris'));
    viderLimite();
    egal('"Amane, Paris" <bonjour@amane.test>', $de('Amane, Paris'));
    viderLimite();
    egal('"Amane \\"Paris\\"" <bonjour@amane.test>', $de('Amane "Paris"'));
    viderLimite();
    $accentue = $de('Amane — Conciergerie privée');
    egal('Amane — Conciergerie privée', decoderMots(explode(' <', $accentue)[0]));
    vrai(str_ends_with($accentue, ' <bonjour@amane.test>'));
    egal(0, preg_match('/[^\x20-\x7E]/', $accentue));
});

test('adresse de retour (-f) : seulement pour une adresse d’expédition simple', function (): void {
    $parametres = static fn (string $de): string
        => demander([], ['config' => ['LEAD_FROM_EMAIL' => $de] + CONFIG_MAIL])['mails'][0]['params'];
    egal('-fdemande@amane.paris', $parametres('demande@amane.paris'));
    viderLimite();
    egal('', $parametres("o'neil@amane.paris"));
    viderLimite();
    egal('', $parametres('demande@amane.paris -X/tmp/x'));
    viderLimite();
    egal('', $parametres('$(id)@amane.paris'));
});

test('mail() renvoie false pour l’équipe → 502, pas d’accusé', function (): void {
    $r = demander([], ['config' => CONFIG_MAIL, 'mail' => fauxMail(false)]);
    egal(502, $r['status']);
    egal(['error' => 'envoi_impossible'], $r['json']);
    egal(1, count($r['mails']));
    egal(1, count($r['journal']));
});

test('mail() lève une exception pour l’équipe → 502, pas d’accusé', function (): void {
    $r = demander([], ['config' => CONFIG_MAIL, 'mail' => fauxMail(new \ValueError('en-tête refusé'))]);
    egal(502, $r['status']);
    egal(1, count($r['mails']));
});

test('mail() renvoie false pour l’accusé seul → 200 ack:false', function (): void {
    $r = demander([], ['config' => CONFIG_MAIL, 'mail' => fauxMail(true, false)]);
    egal(200, $r['status']);
    egal(['ok' => true, 'ack' => false], $r['json']);
    egal(2, count($r['mails']));
});

test('le journal ne contient aucun contenu de la demande', function (): void {
    $r = demander(['message' => 'SECRET-DU-CLIENT'], ['config' => CONFIG_MAIL, 'mail' => fauxMail(false)]);
    egal(1, count($r['journal']));
    foreach (['SECRET-DU-CLIENT', 'jeanne.martin@example.com', 'Jeanne', '+33 6 12', 'equipe@amane.test'] as $interdit) {
        absent($r['journal'][0], $interdit);
    }
});

test('injection d’en-tête par le nom : rien ne passe dans Reply-To ni dans le sujet', function (): void {
    $r = demander(
        ['nom' => "Jean Dupont\r\nBcc: pirate@example.com\r\n\r\nCorps forgé"],
        ['config' => CONFIG_MAIL]
    );
    egal(200, $r['status']);
    [$equipe, $accuse] = $r['mails'];
    foreach ($r['mails'] as $mail) {
        sansRetourLigne($mail);
        faux(array_key_exists('Bcc', $mail['headers']));
        faux(array_key_exists('Cc', $mail['headers']));
    }
    $reponse = $equipe['headers']['Reply-To'];
    $adresse = ' <jeanne.martin@example.com>';
    vrai(str_ends_with($reponse, $adresse));
    egal('Jean Dupont Bcc: pirate@example.com Corps forgé', decoderMots(substr($reponse, 0, -strlen($adresse))));
    egal(1, substr_count($reponse, '@'), 'une seule adresse dans Reply-To');
    egal('Nouvelle demande — Chauffeur privé — Jean Dupont Bcc: pirate@example.com Corps forgé', decoderMots($equipe['subject']));
    egal('equipe@amane.test', $equipe['to']);
    egal('jeanne.martin@example.com', $accuse['to']);
    // L'accusé ne porte aucune trace du nom saisi.
    absent(json_encode($accuse, JSON_UNESCAPED_UNICODE), 'pirate');
    absent(decoderMail($accuse)['texte'] . decoderMail($accuse)['html'], 'Dupont');
});

test('nom qui imite un mot encodé ou ferme les guillemets : neutralisé', function (): void {
    $r = demander(['nom' => '=?UTF-8?B?cGlyYXRl?='], ['config' => CONFIG_MAIL]);
    $reponse = $r['mails'][0]['headers']['Reply-To'];
    egal('=?UTF-8?B?cGlyYXRl?=', decoderMots(explode(' <', $reponse)[0]), 'ré-encodé, pas interprété');
    viderLimite();
    $r = demander(['nom' => 'Jean" <pirate@example.com>, "x'], ['config' => CONFIG_MAIL]);
    egal('"Jean\\" <pirate@example.com>, \\"x" <jeanne.martin@example.com>', $r['mails'][0]['headers']['Reply-To']);
    egal('Jean <jean@x.fr>', adresseEntete('jean@x.fr', 'Jean'));
    egal('jean@x.fr', adresseEntete("jean@x.fr\r\n", "\r\n"));
});

test('motsEncodes : forme, longueur, aucun retour à la ligne', function (): void {
    foreach (['Amane', 'é', str_repeat('é', 200), str_repeat('😀', 60), "Ligne\r\nBcc: x@y.z", 'تلقّينا طلبكم — Amane'] as $texte) {
        $encode = motsEncodes($texte);
        egal(0, preg_match('/[\r\n]/', $encode));
        egal((string) preg_replace('/[\r\n]+/', ' ', $texte), decoderMots($encode));
    }
});

// ---------------------------------------------------------------------------
groupe('accusé de réception');

const ATTENDUS = [
    'fr' => [
        'dir' => 'ltr',
        'phrase' => 'Nous avons bien reçu votre demande.',
        'delai' => 'Votre interlocuteur vous répond sous vingt-quatre heures, souvent dans l’heure.',
        'signature' => 'Amane — Conciergerie privée · Paris',
        'service' => 'Chauffeur privé',
        'date' => '12 décembre 2026',
    ],
    'en' => [
        'dir' => 'ltr',
        'phrase' => 'We have received your request.',
        'delai' => 'Your personal contact will reply within twenty-four hours, often within the hour.',
        'signature' => 'Amane — Private concierge · Paris',
        'service' => 'Private chauffeur',
        'date' => '12 December 2026',
    ],
    'es' => [
        'dir' => 'ltr',
        'phrase' => 'Hemos recibido su solicitud.',
        'delai' => 'Su interlocutor le responderá en un plazo de veinticuatro horas, a menudo en menos de una hora.',
        'signature' => 'Amane — Conserjería privada · París',
        'service' => 'Chófer privado',
        'date' => '12 de diciembre de 2026',
    ],
    'ar' => [
        'dir' => 'rtl',
        'phrase' => 'تلقّينا طلبكم',
        'delai' => 'سيردّ عليكم مستشاركم الخاص خلال أربع وعشرين ساعة، وغالبًا خلال ساعة واحدة.',
        'signature' => 'Amane — كونسيرج خاص · باريس',
        'service' => 'سائق خاص',
        'date' => '12 ديسمبر 2026',
    ],
];

foreach (ATTENDUS as $langue => $a) {
    test("langue $langue", function () use ($langue, $a): void {
        $r = demander(['langue' => $langue]);
        $accuse = $r['appels'][1]['corps'];
        contient($accuse['htmlContent'], '<html lang="' . $langue . '" dir="' . $a['dir'] . '"');
        foreach (['phrase', 'delai', 'signature', 'service', 'date'] as $cle) {
            contient($accuse['htmlContent'], $a[$cle], "HTML : $cle");
            contient($accuse['textContent'], $a[$cle], "texte : $cle");
        }
        contient($accuse['subject'], 'Amane', '« Amane » n’est jamais traduit');
        egal($langue === 'ar', str_contains($accuse['htmlContent'], 'dir="rtl"'));
        // L'e-mail à l'équipe reste en français, mais indique la langue du client.
        contient($r['appels'][0]['corps']['htmlContent'], '<html lang="fr" dir="ltr"');
        $noms = ['fr' => 'Français', 'en' => 'Anglais', 'es' => 'Espagnol', 'ar' => 'Arabe'];
        contient($r['appels'][0]['corps']['textContent'], 'Langue : ' . $noms[$langue]);
    });
}

test('langue insensible à la casse, inconnue ou absente → fr', function (): void {
    $cas = [['EN', 'en'], [' Ar ', 'ar'], ['es-ES', 'es'], ['en_GB', 'en'], ['de', 'fr'], ['', 'fr'], [42, 'fr'], [null, 'fr']];
    foreach ($cas as [$saisie, $attendue]) {
        viderLimite();
        $r = demander(['langue' => $saisie]);
        contient($r['appels'][1]['corps']['htmlContent'], '<html lang="' . $attendue . '"', montrer($saisie));
    }
    viderLimite();
    $sansLangue = DEMANDE;
    unset($sansLangue['langue']);
    $r = demander([], ['body' => $sansLangue]);
    contient($r['appels'][1]['corps']['htmlContent'], '<html lang="fr"');
});

test('ni prix ni promesse : aucun montant, aucune devise', function (): void {
    foreach (['fr', 'en', 'es', 'ar'] as $langue) {
        $accuse = ackEmail(['langue' => $langue, 'email' => 'a@example.com']);
        foreach ([$accuse['subject'], sansBalises($accuse['html']), $accuse['text']] as $contenu) {
            egal(0, preg_match('/[€$£]|\beur\b|\bprix\b|\btarif|\bprice|\bprecio/iu', $contenu), $langue);
        }
    }
});

test('gabarit : marque, couleurs, largeur, aucune ressource distante', function (): void {
    $emails = [teamEmail(DEMANDE), ackEmail(DEMANDE), ackEmail(['langue' => 'ar'] + DEMANDE)];
    foreach ($emails as $email) {
        $html = $email['html'];
        contient($html, '>AMANE</td>');
        foreach (['#5B1622', '#EFE7DA', '#F6F1E8', '#2A211E', '#D9CFC0', '#B8955C'] as $couleur) {
            contient($html, $couleur);
        }
        contient($html, 'max-width:560px');
        contient($html, "Georgia, 'Times New Roman', serif");
        contient($html, 'Helvetica, Arial, sans-serif');
        egal(0, preg_match('/<img|<link|<script|<style|@import|url\(|@font-face/i', $html));
        egal(0, preg_match('/(?:src|href)="https?:/i', $html));
        vrai(str_starts_with($html, '<!DOCTYPE html>') && str_ends_with($html, '</html>'));
    }
});

test('l’accusé ne contient ni le nom ni le message, même inoffensifs', function (): void {
    foreach (['Brevo' => CONFIG, 'mail()' => CONFIG_MAIL] as $mode => $config) {
        viderLimite();
        $r = demander(
            ['nom' => 'Camille Durand', 'message' => 'Bonjour, une voiture pour samedi soir.'],
            ['config' => $config]
        );
        egal(['ok' => true, 'ack' => true], $r['json']);
        if ($mode === 'Brevo') {
            [$equipe, $accuse] = [$r['appels'][0]['corps'], $r['appels'][1]['corps']];
            $envoi = $r['appels'][1]['brut'];
            egal([['email' => 'jeanne.martin@example.com']], $accuse['to']);
            egal(['sender', 'to', 'subject', 'htmlContent', 'textContent'], array_keys($accuse));
        } else {
            $decode = decoderMail($r['mails'][0]);
            $equipe = ['textContent' => $decode['texte'], 'htmlContent' => $decode['html']];
            $accuse = $r['mails'][1];
            $envoi = json_encode($accuse, JSON_UNESCAPED_UNICODE) . decoderMots($accuse['subject'])
                . implode('', decoderMail($accuse));
            egal('jeanne.martin@example.com', $accuse['to']);
        }
        // L'équipe, elle, reçoit tout.
        foreach (['Camille Durand', 'Bonjour, une voiture pour samedi soir.', '+33 6 12 34 56 78'] as $valeur) {
            contient($equipe['textContent'], $valeur, "$mode, équipe");
            contient($equipe['htmlContent'], $valeur, "$mode, équipe (HTML)");
        }
        foreach (['Camille', 'Durand', 'Bonjour', 'voiture pour samedi', 'samedi', '+33 6 12', '34 56 78'] as $interdit) {
            absent($envoi, $interdit, "$mode : l’accusé");
        }
    }
});

test('l’accusé est identique quels que soient le nom, le message et le téléphone', function (): void {
    $a = demander(['nom' => 'A', 'message' => 'un', 'tel' => '+33 1 11 11 11 11']);
    viderLimite();
    $b = demander(['nom' => 'Tout autre nom', 'message' => 'https://pirate.example gagnez 1000 €', 'tel' => '']);
    egal($a['appels'][1]['brut'], $b['appels'][1]['brut']);
});

test('ackEmail appelée directement avec des valeurs brutes ne reprend rien de libre', function (): void {
    foreach (['fr', 'en', 'es', 'ar'] as $langue) {
        $accuse = ackEmail([
            'langue' => $langue,
            'nom' => 'NOM-LIBRE',
            'message' => 'MESSAGE-LIBRE',
            'tel' => 'TEL-LIBRE',
            'service' => 'SERVICE-LIBRE',
            'date' => 'DATE-LIBRE',
            'passagers' => 'PASSAGERS-LIBRES',
            'email' => 'a@example.com',
        ]);
        absent($accuse['subject'] . $accuse['html'] . $accuse['text'], 'LIBRE', $langue);
    }
});

// ---------------------------------------------------------------------------
groupe('sécurité du contenu');

test('échappement HTML des valeurs saisies', function (): void {
    $r = demander([
        'nom' => 'Jean <b>Gras</b> & "Fils" l\'aîné',
        'tel' => '+33 6 12 34 56 78 <i>soir</i>',
        'service' => '<img src=x onerror=alert(1)>',
        'date' => '<svg onload=alert(1)>',
        'passagers' => '<u>2</u>',
        'message' => "Bonjour <script>alert(\"xss\")</script>\n<a href=\"https://pirate.example\">cliquez</a>",
    ]);
    egal(200, $r['status']);
    [$equipe, $accuse] = [$r['appels'][0]['corps'], $r['appels'][1]['corps']];
    foreach ([$equipe, $accuse] as $corps) {
        $html = $corps['htmlContent'];
        absent($html, '<script', 'pas de balise script');
        absent($html, '<img', 'pas de balise img');
        absent($html, '<svg', 'pas de balise svg');
        absent($html, '<b>Gras</b>');
        absent($html, '<i>soir</i>');
        absent($html, '<u>2</u>');
        absent($html, 'href="https://pirate.example"');
    }
    $html = $equipe['htmlContent'];
    contient($html, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    contient($html, 'Jean &lt;b&gt;Gras&lt;/b&gt; &amp; &quot;Fils&quot; l&#39;aîné');
    contient($html, '&lt;i&gt;soir&lt;/i&gt;');
    // La version texte de l'e-mail équipe, elle, garde la saisie telle quelle.
    contient($equipe['textContent'], '<script>alert("xss")</script>');
    // L'accusé ne reprend rien de tout cela, sous aucune forme.
    foreach (['script', 'Gras', 'pirate', 'onerror', 'onload', 'soir'] as $interdit) {
        absent($r['appels'][1]['brut'], $interdit);
    }
});

test('injection d’en-tête par le nom', function (): void {
    $r = demander(['nom' => "Jean Dupont\r\nBcc: pirate@example.com\r\n\r\nCorps forgé"]);
    egal(200, $r['status']);
    [$equipe, $accuse] = [$r['appels'][0]['corps'], $r['appels'][1]['corps']];
    egal('Nouvelle demande — Chauffeur privé — Jean Dupont Bcc: pirate@example.com Corps forgé', $equipe['subject']);
    foreach ([$equipe['subject'], $equipe['replyTo']['name'], $accuse['subject']] as $valeur) {
        egal(0, preg_match('/[\r\n]|\xE2\x80[\xA8\xA9]/', $valeur), montrer($valeur));
    }
    egal(['sender', 'to', 'subject', 'htmlContent', 'textContent', 'replyTo'], array_keys($equipe));
    egal(['sender', 'to', 'subject', 'htmlContent', 'textContent'], array_keys($accuse));
    egal([['email' => 'equipe@amane.test']], $equipe['to']);
    egal([['email' => 'jeanne.martin@example.com']], $accuse['to']);
    absent($r['appels'][1]['brut'], 'pirate@example.com');
});

test('injection d’en-tête par le service ou des séparateurs Unicode', function (): void {
    $r = demander([
        'service' => "chauffeur\nSubject: gagné",
        // U+2028 (séparateur de ligne), U+0085 (ligne suivante), tabulation.
        'nom' => "Jean\xE2\x80\xA8Dupont\xC2\x85fin\tici",
    ]);
    egal('Nouvelle demande — Autre demande — Jean Dupont fin ici', $r['appels'][0]['corps']['subject']);
});

test('injection d’en-tête par l’e-mail → 400 email_invalide', function (): void {
    foreach (
        [
            "jeanne@example.com\r\nBcc: pirate@example.com",
            "jeanne@example.com\nBcc:pirate@example.com",
            'jeanne@example.com%0ABcc:x@y.z',
        ] as $email
    ) {
        foreach ([CONFIG, CONFIG_MAIL] as $config) {
            $r = demander(['email' => $email], ['config' => $config]);
            egal(400, $r['status'], montrer($email));
            egal(['error' => 'email_invalide'], $r['json']);
            egal(0, count($r['appels']) + count($r['mails']));
        }
    }
});

test('injection par la configuration : retours à la ligne retirés de l’expéditeur', function (): void {
    $config = [
        'LEAD_FROM_NAME' => "Amane\r\nBcc: pirate@example.com",
        'LEAD_FROM_EMAIL' => "bonjour@amane.test\r\nBcc: pirate@example.com",
    ] + CONFIG_MAIL;
    $r = demander([], ['config' => $config]);
    foreach ($r['mails'] as $mail) {
        sansRetourLigne($mail);
        faux(array_key_exists('Bcc', $mail['headers']));
    }
});

test('les champs inconnus du corps sont ignorés', function (): void {
    $r = demander(['bcc' => 'pirate@example.com', 'to' => 'pirate@example.com', 'htmlContent' => '<script>1</script>']);
    egal(200, $r['status']);
    foreach ($r['appels'] as $appel) {
        absent($appel['brut'], 'pirate@example.com');
        absent($appel['corps']['htmlContent'], '<script');
    }
});

// ---------------------------------------------------------------------------
groupe('limite de débit');

test('6e appel de la même IP → 429, une autre IP passe, la fenêtre se rouvre après une heure', function (): void {
    for ($i = 1; $i <= 5; $i++) {
        $r = demander([], ['ip' => '198.51.100.7', 'now' => T0 + $i]);
        egal(200, $r['status'], "appel $i");
    }
    $sixieme = demander([], ['ip' => '198.51.100.7', 'now' => T0 + 6]);
    egal(429, $sixieme['status']);
    egal(['error' => 'trop_de_demandes'], $sixieme['json']);
    egal(0, count($sixieme['appels']));
    egal(['Retry-After' => '3595'], $sixieme['headers']);

    $autre = demander([], ['ip' => '198.51.100.8', 'now' => T0 + 6]);
    egal(200, $autre['status']);

    $presqueUneHeure = demander([], ['ip' => '198.51.100.7', 'now' => T0 + 59 * 60]);
    egal(429, $presqueUneHeure['status']);
    egal('61', $presqueUneHeure['headers']['Retry-After']);

    $plusTard = demander([], ['ip' => '198.51.100.7', 'now' => T0 + 1 + 3600]);
    egal(200, $plusTard['status']);
});

test('la limite vaut aussi pour l’envoi par mail()', function (): void {
    for ($i = 1; $i <= 5; $i++) {
        egal(200, demander([], ['config' => CONFIG_MAIL, 'now' => T0 + $i])['status']);
    }
    $r = demander([], ['config' => CONFIG_MAIL, 'now' => T0 + 6]);
    egal(429, $r['status']);
    egal(0, count($r['mails']));
});

test('les demandes refusées avant l’envoi ne consomment pas le quota', function (): void {
    for ($i = 0; $i < 10; $i++) {
        demander(['email' => 'invalide'], ['ip' => '198.51.100.9']);
        demander(['a_laisser_vide' => 'robot'], ['ip' => '198.51.100.9']);
        demander([], ['ip' => '198.51.100.9', 'config' => []]);
        demander([], ['ip' => '198.51.100.9', 'origin' => 'https://pirate.example']);
    }
    egal([], glob(bilan()->dossier . '/*'), 'aucun compteur créé');
    egal(200, demander([], ['ip' => '198.51.100.9'])['status']);
});

test('les envois échoués comptent aussi (chaque tentative d’envoi)', function (): void {
    for ($i = 1; $i <= 5; $i++) {
        egal(502, demander([], ['http' => fauxHttp(500), 'now' => T0 + $i])['status']);
    }
    egal(429, demander([], ['now' => T0 + 6])['status']);
});

test('un fichier JSON par IP, nommé par son empreinte sha256, sans l’adresse en clair', function (): void {
    demander([], ['ip' => '198.51.100.20', 'now' => T0]);
    demander([], ['ip' => '198.51.100.20', 'now' => T0 + 10]);
    demander([], ['ip' => '2001:DB8::1', 'now' => T0 + 20]);
    $fichiers = glob(bilan()->dossier . '/*');
    egal(2, count($fichiers));
    $attendu = bilan()->dossier . '/ip-' . hash('sha256', '198.51.100.20') . '.json';
    egal($attendu, fichierLimite(bilan()->dossier, '198.51.100.20'));
    egal([T0, T0 + 10], json_decode((string) file_get_contents($attendu), true));
    egal(fichierLimite(bilan()->dossier, '2001:db8::1'), fichierLimite(bilan()->dossier, '2001:DB8::1'), 'casse ignorée');
    foreach ($fichiers as $fichier) {
        egal(1, preg_match('/^ip-[0-9a-f]{64}\.json$/D', basename($fichier)));
        absent($fichier . file_get_contents($fichier), '198.51.100');
    }
});

test('IP inconnue : un compteur commun', function (): void {
    for ($i = 1; $i <= 5; $i++) {
        egal(200, demander([], ['ip' => '', 'now' => T0 + $i])['status']);
    }
    egal(429, demander([], ['ip' => '', 'now' => T0 + 6])['status']);
    egal(fichierLimite(bilan()->dossier, 'inconnue'), fichierLimite(bilan()->dossier, ''));
});

test('les entrées de plus d’une heure sont purgées du fichier', function (): void {
    $dossier = bilan()->dossier;
    $fichier = fichierLimite($dossier, '198.51.100.30');
    file_put_contents($fichier, json_encode([T0 - 7200, T0 - 3600, T0 - 3599, T0 - 10]));
    egal(0, compterEnvoi('198.51.100.30', T0, $dossier));
    egal([T0 - 3599, T0 - 10, T0], json_decode((string) file_get_contents($fichier), true));
});

test('fichier de compteur abîmé : repart de zéro au lieu de bloquer', function (): void {
    $dossier = bilan()->dossier;
    $fichier = fichierLimite($dossier, '198.51.100.31');
    foreach (['{pas du json', '"texte"', '', '[1.5, "x", null, {}]'] as $contenu) {
        file_put_contents($fichier, $contenu);
        egal(0, compterEnvoi('198.51.100.31', T0, $dossier), $contenu);
        egal([T0], json_decode((string) file_get_contents($fichier), true));
    }
});

test('compterEnvoi : attente en secondes jusqu’à la sortie du plus ancien envoi', function (): void {
    $dossier = bilan()->dossier;
    foreach ([0, 100, 200, 300, 400] as $decalage) {
        egal(0, compterEnvoi('198.51.100.32', T0 + $decalage, $dossier));
    }
    egal(3600 - 500, compterEnvoi('198.51.100.32', T0 + 500, $dossier));
    egal(1, compterEnvoi('198.51.100.32', T0 + 3599, $dossier));
    egal(0, compterEnvoi('198.51.100.32', T0 + 3600, $dossier));
    egal(5, count(json_decode((string) file_get_contents(fichierLimite($dossier, '198.51.100.32')), true)));
});

test('purgerLimite : supprime les compteurs inutilisés depuis plus d’une heure', function (): void {
    $dossier = bilan()->dossier;
    $t = time();
    $vieux = fichierLimite($dossier, '198.51.100.40');
    $recent = fichierLimite($dossier, '198.51.100.41');
    file_put_contents($vieux, '[1]');
    file_put_contents($recent, '[1]');
    file_put_contents($dossier . '/autre-fichier.txt', 'à garder');
    touch($vieux, $t - 3601);
    touch($recent, $t - 3000);
    touch($dossier . '/autre-fichier.txt', $t - 99999);
    egal(1, purgerLimite($dossier, $t));
    faux(file_exists($vieux));
    vrai(file_exists($recent));
    vrai(file_exists($dossier . '/autre-fichier.txt'));
});

test('dossier de données : créé au besoin, repli sur le dossier temporaire s’il n’est pas inscriptible', function (): void {
    $voulu = bilan()->dossier . '/sous/dossier/amane-data';
    egal($voulu, dossierLimite($voulu . '/'));
    vrai(is_dir($voulu));

    // Un chemin impossible à créer (sous un fichier ordinaire) : repli.
    file_put_contents(bilan()->dossier . '/fichier', 'x');
    $repli = rtrim(sys_get_temp_dir(), '/') . '/amane-data';
    $existait = is_dir($repli);
    egal($repli, dossierLimite(bilan()->dossier . '/fichier/amane-data'));
    egal($repli, dossierLimite(null));
    egal(0, compterEnvoi('198.51.100.50', T0, bilan()->dossier . '/fichier/amane-data'));
    $compteur = fichierLimite($repli, '198.51.100.50');
    vrai(is_file($compteur), 'compteur écrit dans le dossier de repli');
    unlink($compteur);
    if (!$existait) {
        @rmdir($repli);
    }
});

// ---------------------------------------------------------------------------
groupe('adresse IP du visiteur');

test('REMOTE_ADDR publique : utilisée telle quelle, X-Forwarded-For ignoré', function (): void {
    egal('203.0.113.5', ipDuVisiteur(['REMOTE_ADDR' => '203.0.113.5']));
    egal('203.0.113.5', ipDuVisiteur(['REMOTE_ADDR' => '203.0.113.5', 'HTTP_X_FORWARDED_FOR' => '198.51.100.1']));
    egal('2a01:e0a:1::1', ipDuVisiteur(['REMOTE_ADDR' => '2a01:e0a:1::1', 'HTTP_X_FORWARDED_FOR' => '198.51.100.1']));
});

test('REMOTE_ADDR privée : dernière adresse publique de X-Forwarded-For', function (): void {
    foreach (['10.0.0.3', '192.168.1.1', '172.16.5.4', '127.0.0.1', '::1', 'fd00::1'] as $privee) {
        egal('198.51.100.1', ipDuVisiteur(['REMOTE_ADDR' => $privee, 'HTTP_X_FORWARDED_FOR' => '198.51.100.1']), $privee);
    }
    // La première adresse est dictée par le visiteur : on ne s'y fie pas.
    egal('198.51.100.1', ipDuVisiteur(['REMOTE_ADDR' => '10.0.0.3', 'HTTP_X_FORWARDED_FOR' => '1.2.3.4, 198.51.100.1']));
    egal('198.51.100.1', ipDuVisiteur(['REMOTE_ADDR' => '10.0.0.3', 'HTTP_X_FORWARDED_FOR' => ' 198.51.100.1 , 10.0.0.9']));
});

test('REMOTE_ADDR privée sans X-Forwarded-For exploitable : REMOTE_ADDR', function (): void {
    egal('10.0.0.3', ipDuVisiteur(['REMOTE_ADDR' => '10.0.0.3']));
    egal('10.0.0.3', ipDuVisiteur(['REMOTE_ADDR' => '10.0.0.3', 'HTTP_X_FORWARDED_FOR' => 'pas une adresse, 192.168.0.1']));
    egal('10.0.0.3', ipDuVisiteur(['REMOTE_ADDR' => '10.0.0.3', 'HTTP_X_FORWARDED_FOR' => '']));
    egal('', ipDuVisiteur([]));
    egal('', ipDuVisiteur(['HTTP_X_FORWARDED_FOR' => '198.51.100.1']));
});

// ---------------------------------------------------------------------------
groupe('requête HTTP');

/**
 * Appelle handleRequest() comme le ferait lead.php.
 *
 * @param array<string, mixed> $serveur
 * @param array<string, mixed> $options
 * @return array{status: int, json: array<string, mixed>, headers: array<string, string>, appels: array, mails: array, journal: list<string>}
 */
function requete(array $serveur = [], mixed $corps = null, array $options = []): array
{
    $http = $options['http'] ?? fauxHttp();
    $mail = fauxMail();
    $journal = new \ArrayObject();
    $serveur += [
        'REQUEST_METHOD' => 'POST',
        'HTTP_HOST' => 'amane.test',
        'HTTP_ORIGIN' => 'https://amane.test',
        'REMOTE_ADDR' => '192.0.2.44',
    ];
    [$status, $json, $headers] = handleRequest(
        serveur: $serveur,
        corps: $corps,
        config: $options['config'] ?? CONFIG,
        http: $http,
        mail: $mail,
        now: $options['now'] ?? T0,
        dataDir: bilan()->dossier,
        journal: static function (string $ligne) use ($journal): void {
            $journal[] = $ligne;
        }
    );

    return [
        'status' => $status,
        'json' => $json,
        'headers' => $headers,
        'appels' => $http->appels,
        'mails' => $mail->appels,
        'journal' => $journal->getArrayCopy(),
    ];
}

/** Flux en mémoire, pour imiter php://input. */
function flux(string $contenu)
{
    $flux = fopen('php://memory', 'w+b');
    fwrite($flux, $contenu);
    rewind($flux);

    return $flux;
}

foreach (['GET', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'post', ''] as $methode) {
    test("méthode « $methode » → 405 avec Allow: POST", function () use ($methode): void {
        $r = requete(['REQUEST_METHOD' => $methode], json_encode(DEMANDE));
        egal(405, $r['status']);
        egal(['Allow' => 'POST'], $r['headers']);
        vrai(is_string($r['json']['error']));
        egal(0, count($r['appels']));
    });
}

test('405 même sans REQUEST_METHOD', function (): void {
    [$status, , $entetes] = handleRequest([], '{}');
    egal(405, $status);
    egal(['Allow' => 'POST'], $entetes);
});

test('POST : corps lu sur le flux, deux e-mails, 200', function (): void {
    $r = requete([], flux((string) json_encode(DEMANDE)));
    egal(200, $r['status']);
    egal(['ok' => true, 'ack' => true], $r['json']);
    egal([], $r['headers']);
    egal(2, count($r['appels']));
    egal(CLE, $r['appels'][0]['entetes']['api-key']);
});

test('POST : corps reçu en chaîne', function (): void {
    $r = requete([], (string) json_encode(['email' => ''] + DEMANDE));
    egal(200, $r['status']);
    egal(['ok' => true, 'ack' => false], $r['json']);
    egal(1, count($r['appels']));
});

test('POST : JSON mal formé → 400', function (): void {
    $r = requete([], flux('{"nom": '));
    egal(400, $r['status']);
    egal(['error' => 'corps_invalide'], $r['json']);
    egal(0, count($r['appels']));
});

test('POST : corps vide → 400 contact_requis', function (): void {
    foreach ([null, '', flux('')] as $corps) {
        $r = requete([], $corps);
        egal(400, $r['status']);
        egal('contact_requis', $r['json']['error']);
    }
});

test('POST : corps de plus de 16 Ko → 413 (flux, Content-Length ou chaîne)', function (): void {
    $gros = (string) json_encode(['message' => str_repeat('x', 17 * 1024)] + DEMANDE);

    $parFlux = requete([], flux($gros));
    egal(413, $parFlux['status']);
    egal(['error' => 'corps_trop_grand'], $parFlux['json']);

    $parEntete = requete(['CONTENT_LENGTH' => '20000'], '{}');
    egal(413, $parEntete['status']);

    $parChaine = requete([], $gros);
    egal(413, $parChaine['status']);

    egal(0, count($parFlux['appels']) + count($parEntete['appels']) + count($parChaine['appels']));
});

test('POST : exactement 16 Ko → accepté', function (): void {
    $base = strlen((string) json_encode(['message' => ''] + DEMANDE));
    $corps = (string) json_encode(['message' => str_repeat('x', TAILLE_MAX_CORPS - $base)] + DEMANDE);
    egal(TAILLE_MAX_CORPS, strlen($corps));
    egal(200, requete(['CONTENT_LENGTH' => (string) TAILLE_MAX_CORPS], flux($corps))['status']);
    viderLimite();
    egal(413, requete([], flux($corps . ' '))['status']);
});

test('POST : origine étrangère → 403', function (): void {
    $r = requete(['HTTP_ORIGIN' => 'https://pirate.example'], json_encode(DEMANDE));
    egal(403, $r['status']);
    egal(['error' => 'origine_refusee'], $r['json']);
    egal(0, count($r['appels']));
});

test('POST : sans configuration → 503', function (): void {
    $r = requete([], json_encode(DEMANDE), ['config' => []]);
    egal(503, $r['status']);
    egal('email_off', $r['json']['error']);
    egal(0, count($r['appels']) + count($r['mails']));
});

test('POST : limite par IP lue dans REMOTE_ADDR, avec Retry-After', function (): void {
    $corps = (string) json_encode(['email' => ''] + DEMANDE);
    for ($i = 0; $i < 5; $i++) {
        egal(200, requete(['REMOTE_ADDR' => '192.0.2.99'], $corps)['status']);
    }
    $bloquee = requete(['REMOTE_ADDR' => '192.0.2.99'], $corps);
    egal(429, $bloquee['status']);
    egal(['error' => 'trop_de_demandes'], $bloquee['json']);
    vrai((int) $bloquee['headers']['Retry-After'] > 0);

    egal(200, requete(['REMOTE_ADDR' => '192.0.2.100'], $corps)['status']);
    // Changer X-Forwarded-For ne permet pas d'échapper à la limite.
    egal(429, requete(['REMOTE_ADDR' => '192.0.2.99', 'HTTP_X_FORWARDED_FOR' => '8.8.8.8'], $corps)['status']);
});

test('erreur inattendue → 500 erreur_interne, sans détail dans le journal', function (): void {
    $r = requete([], json_encode(DEMANDE), ['now' => static function (): int {
        throw new \LogicException('SECRET-INTERNE');
    }]);
    egal(500, $r['status']);
    egal(['error' => 'erreur_interne'], $r['json']);
    egal(1, count($r['journal']));
    contient($r['journal'][0], 'LogicException');
    absent($r['journal'][0], 'SECRET-INTERNE');
});

// ---------------------------------------------------------------------------
groupe('divers');

test('dateParis : heure de Paris, été comme hiver', function (): void {
    egal('15 janvier 2027 à 09:00', dateParis(T0));
    egal('2 juillet 2026 à 00:05', dateParis(gmmktime(22, 5, 0, 7, 1, 2026)));
    egal('1 janvier 2027 à 00:30', dateParis(gmmktime(23, 30, 0, 12, 31, 2026)));
});

test('les fichiers PHP n’affichent rien quand on les charge', function (): void {
    foreach (['ovh/api/_lib/lead.php', 'ovh/api/_lib/emails.php'] as $fichier) {
        $sortie = shell_exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(dirname(__DIR__, 2) . '/' . $fichier) . ' 2>&1');
        egal('', (string) $sortie, $fichier);
    }
});

// ---------------------------------------------------------------------------
// Ménage et bilan
// ---------------------------------------------------------------------------

/** Supprime un dossier de test et tout ce qu'il contient. */
function supprimer(string $chemin): void
{
    if (is_dir($chemin) && !is_link($chemin)) {
        foreach (array_diff(scandir($chemin) ?: [], ['.', '..']) as $entree) {
            supprimer($chemin . '/' . $entree);
        }
        @rmdir($chemin);
    } elseif (file_exists($chemin)) {
        @unlink($chemin);
    }
}

array_map(__NAMESPACE__ . '\\supprimer', bilan()->aNettoyer);

$passes = bilan()->tests - bilan()->echecs;
echo (bilan()->bavard ? "\n" : '') . 'lead_test.php : ' . bilan()->tests . ' tests, ' . $passes . ' passés, '
    . bilan()->echecs . ' échoués (' . bilan()->verifications . " vérifications)\n";

exit(bilan()->echecs > 0 ? 1 : 0);
