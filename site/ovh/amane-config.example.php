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

    // ───── Lien avec le CRM de la maison (facultatif) ─────
    //
    // Quand les deux clés ci-dessous sont remplies, chaque demande du formulaire
    // est aussi enregistrée dans le CRM (fiche client + nouvelle demande), en plus
    // des e-mails. Si l'e-mail tombe en panne, la demande est quand même dans le
    // CRM ; si le CRM est injoignable, l'e-mail part quand même.
    // Laissez les deux vides pour ne pas utiliser le CRM : rien ne change.

    // Adresse du CRM : seulement « https:// » et le nom de domaine, rien derrière
    // (par exemple https://crm.exemple.fr). Elle doit commencer par https://.
    'CRM_URL' => '',

    // Secret partagé entre le site et le CRM : il prouve au CRM que la demande
    // vient bien du site. Il doit être EXACTEMENT le même que la valeur
    // SITE_LEAD_SECRET réglée côté CRM, et faire au moins 32 caractères tirés au
    // hasard (ni mot, ni phrase, ni espace). Pour en fabriquer un, au choix :
    //   - dans un terminal :   openssl rand -hex 32
    //   - ou avec PHP :        php -r "echo bin2hex(random_bytes(32));"
    //   - ou le générateur de mots de passe de votre navigateur (40 caractères
    //     ou plus, lettres et chiffres).
    // Collez la même valeur ici et dans SITE_LEAD_SECRET du CRM. Ne l'envoyez
    // jamais par e-mail et ne l'écrivez jamais dans le dépôt.
    'CRM_SECRET' => '',
];
