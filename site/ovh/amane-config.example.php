<?php

/**
 * Amane — configuration du formulaire de demande sur l'hébergement OVH.
 *
 * MODE D'EMPLOI
 *   1. Copiez ce fichier sous le nom « amane-config.php ».
 *   2. Déposez-le par FTP À CÔTÉ du dossier www/, pas dedans :
 *
 *        (dossier personnel)/
 *          amane-config.php   ← ici
 *          www/               ← le site
 *
 *      Placé là, il ne peut pas être lu depuis Internet.
 *   3. Remplissez les valeurs entre les apostrophes.
 *
 * Ne mettez jamais de vraie valeur dans le modèle (amane-config.example.php) :
 * il est versionné. Le vrai fichier, lui, ne doit jamais être versionné ni
 * déposé dans www/.
 *
 * Toute clé laissée vide est cherchée dans la variable d'environnement du même
 * nom, si l'hébergement en fournit.
 */

return [
    // Clé de l'API transactionnelle Brevo (Brevo → Paramètres → Clés SMTP et API).
    // Facultatif. Renseignée : les e-mails partent par Brevo (meilleure délivrabilité,
    // suivi des envois). Vide : ils partent par la fonction mail() de l'hébergement,
    // qui fonctionne d'office chez OVH.
    'BREVO_API_KEY' => '',

    // Adresse de l'équipe qui reçoit chaque demande.
    // Obligatoire. Plusieurs adresses possibles, séparées par des virgules.
    // Sans elle, le formulaire répond 503 « email_off ».
    'LEAD_TO_EMAIL' => '',

    // Adresse d'expédition des deux e-mails (demande et accusé de réception).
    // Obligatoire. Prenez une adresse du domaine du site (par exemple
    // demande@amane.paris), créée chez OVH et relevée : si le client répond à
    // l'accusé de réception, sa réponse arrive sur cette adresse.
    // Avec Brevo, elle doit aussi y être déclarée comme expéditeur validé.
    'LEAD_FROM_EMAIL' => '',

    // Nom d'expéditeur affiché dans la boîte de réception.
    // Facultatif. Par défaut : Amane
    'LEAD_FROM_NAME' => 'Amane',

    // Origines supplémentaires autorisées à appeler /api/lead, séparées par des virgules.
    // Facultatif. Par défaut, seul le domaine qui sert le site est accepté.
    // Chaque entrée est une origine complète (https://www.exemple.fr) ou un hôte
    // seul (www.exemple.fr).
    'ALLOWED_ORIGINS' => '',
];
