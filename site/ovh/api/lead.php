<?php

/**
 * POST /api/lead — formulaire de demande, version hébergement OVH (Apache + PHP).
 *
 * Reçoit le formulaire du site et envoie deux e-mails : la demande à l'équipe,
 * un accusé de réception au client. Toute la logique est dans _lib/lead.php ;
 * ce fichier ne fait que brancher la requête, la configuration et la réponse.
 *
 * Adresse : /api/lead (réécriture du .htaccess à la racine du site) ou,
 * directement, /api/lead.php.
 *
 * Disposition attendue sur l'hébergement :
 *
 *   (dossier personnel)/
 *     amane-config.php      configuration — au-dessus de www/, jamais servie par le web
 *     amane-data/           compteurs de la limite de débit — créé tout seul
 *     www/                  racine du site
 *       api/lead.php        ce fichier
 *       api/_lib/           le reste du code, inaccessible par le web
 */

declare(strict_types=1);

namespace Amane\Lead;

// Un avertissement PHP affiché dans la page casserait la réponse JSON : il va au journal.
ini_set('display_errors', '0');

require __DIR__ . '/_lib/lead.php';

// Deux niveaux au-dessus de www/api/ : le dossier qui contient www/.
$racine = dirname(__DIR__, 2);

try {
    [$status, $json, $entetes] = handleRequest(
        serveur: $_SERVER,
        corps: fopen('php://input', 'rb') ?: null,
        config: chargerConfig($racine . '/amane-config.php'),
        dataDir: $racine . '/amane-data'
    );
} catch (\Throwable $erreur) {
    // Jamais le détail : il pourrait contenir un extrait de la demande ou de la configuration.
    error_log('[lead] erreur inattendue : ' . get_class($erreur));
    [$status, $json, $entetes] = [500, ['error' => 'erreur_interne'], []];
}

repondre($status, $json, $entetes);
