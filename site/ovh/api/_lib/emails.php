<?php

/**
 * Construction des deux e-mails envoyés pour chaque demande :
 *   - teamEmail($lead) : la demande complète, pour l'équipe (toujours en français) ;
 *   - ackEmail($lead)  : l'accusé de réception, dans la langue du client.
 * Chaque fonction renvoie ['subject' => …, 'html' => …, 'text' => …].
 *
 * Version PHP (hébergement OVH) de site/api/_lib/emails.js : mêmes textes, même
 * gabarit, mêmes règles. Si l'un des deux fichiers change, l'autre doit suivre.
 *
 * Aucune dépendance (ni Composer, ni extension intl), aucune image distante,
 * aucune police web : tableaux et styles en ligne uniquement, pour Gmail,
 * Outlook et Apple Mail. Toute valeur venue du formulaire est échappée ici,
 * même si elle a déjà été nettoyée en amont (lead.php).
 *
 * Ce fichier ne fait que déclarer des fonctions : appelé directement par le
 * web, il n'affiche rien (et le .htaccess du dossier api/ en interdit l'accès).
 */

declare(strict_types=1);

namespace Amane\Lead;

const COULEURS = [
    'bordeaux' => '#5B1622',
    'pierre' => '#EFE7DA',
    'fond' => '#F6F1E8',
    'texte' => '#2A211E',
    'filet' => '#D9CFC0',
    'or' => '#B8955C',
];

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = 'Helvetica, Arial, sans-serif';

const LANGUES = ['fr', 'en', 'es', 'ar'];

// Identifiants de service envoyés par le formulaire. Liste fermée : toute autre
// valeur est ramenée à « autre ».
const SERVICES = [
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

// Noms des mois, pour écrire la date dans la langue du client sans dépendre de
// l'extension intl. En arabe : calendrier grégorien et chiffres latins.
const MOIS = [
    'fr' => [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
    ],
    'en' => [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ],
    'es' => [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ],
    'ar' => [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ],
];

// ---------------------------------------------------------------------------
// Textes de l'accusé de réception. « Amane » n'est jamais traduit.
// Les libellés français des services servent aussi à l'e-mail de l'équipe.
// ---------------------------------------------------------------------------
const TEXTES = [
    'fr' => [
        'dir' => 'ltr',
        'sujet' => 'Nous avons bien reçu votre demande — Amane',
        'salut' => 'Madame, Monsieur,',
        'recu' => 'Nous avons bien reçu votre demande.',
        'delai' => 'Votre interlocuteur vous répond sous vingt-quatre heures, souvent dans l’heure.',
        'recap' => 'Votre demande',
        'champs' => ['service' => 'Service', 'date' => 'Date', 'passagers' => 'Passagers'],
        'services' => [
            'voitures' => "Voitures d'exception",
            'chauffeur' => 'Chauffeur privé',
            'van' => 'Van VIP',
            'sejours' => 'Séjours clé en main',
            'immobilier' => 'Immobilier',
            'tables' => 'Tables & restaurants',
            'evenements' => 'Événements',
            'shopping' => 'Personal shopping',
            'esthetique' => 'Séjour esthétique',
            'creation' => 'Création & marketing',
            'conciergerie' => 'Conciergerie sur demande',
            'autre' => 'Autre demande',
        ],
        'deuxPoints' => ' : ',
        'signature' => 'Amane — Conciergerie privée · Paris',
        'note' => 'Si vous n’êtes pas à l’origine de cette demande, il vous suffit d’ignorer ce message.',
    ],
    'en' => [
        'dir' => 'ltr',
        'sujet' => 'We have received your request — Amane',
        'salut' => 'Dear Sir or Madam,',
        'recu' => 'We have received your request.',
        'delai' => 'Your personal contact will reply within twenty-four hours, often within the hour.',
        'recap' => 'Your request',
        'champs' => ['service' => 'Service', 'date' => 'Date', 'passagers' => 'Passengers'],
        'services' => [
            'voitures' => 'Exceptional cars',
            'chauffeur' => 'Private chauffeur',
            'van' => 'VIP van',
            'sejours' => 'Turnkey stays',
            'immobilier' => 'Real estate',
            'tables' => 'Tables & restaurants',
            'evenements' => 'Events',
            'shopping' => 'Personal shopping',
            'esthetique' => 'Aesthetic stay',
            'creation' => 'Creative & marketing',
            'conciergerie' => 'Concierge on request',
            'autre' => 'Other request',
        ],
        'deuxPoints' => ': ',
        'signature' => 'Amane — Private concierge · Paris',
        'note' => 'If you did not make this request, please disregard this message.',
    ],
    'es' => [
        'dir' => 'ltr',
        'sujet' => 'Hemos recibido su solicitud — Amane',
        'salut' => 'Estimada señora, estimado señor:',
        'recu' => 'Hemos recibido su solicitud.',
        'delai' => 'Su interlocutor le responderá en un plazo de veinticuatro horas, '
            . 'a menudo en menos de una hora.',
        'recap' => 'Su solicitud',
        'champs' => ['service' => 'Servicio', 'date' => 'Fecha', 'passagers' => 'Pasajeros'],
        'services' => [
            'voitures' => 'Coches excepcionales',
            'chauffeur' => 'Chófer privado',
            'van' => 'Van VIP',
            'sejours' => 'Estancias llave en mano',
            'immobilier' => 'Inmobiliaria',
            'tables' => 'Mesas y restaurantes',
            'evenements' => 'Eventos',
            'shopping' => 'Personal shopping',
            'esthetique' => 'Estancia estética',
            'creation' => 'Creación y marketing',
            'conciergerie' => 'Concierge a demanda',
            'autre' => 'Otra solicitud',
        ],
        'deuxPoints' => ': ',
        'signature' => 'Amane — Conserjería privada · París',
        'note' => 'Si usted no ha realizado esta solicitud, puede ignorar este mensaje.',
    ],
    'ar' => [
        'dir' => 'rtl',
        'sujet' => 'تلقّينا طلبكم — Amane',
        'salut' => 'تحية طيبة،',
        'recu' => 'لقد تلقّينا طلبكم.',
        'delai' => 'سيردّ عليكم مستشاركم الخاص خلال أربع وعشرين ساعة، وغالبًا خلال ساعة واحدة.',
        'recap' => 'طلبكم',
        'champs' => ['service' => 'الخدمة', 'date' => 'التاريخ', 'passagers' => 'عدد الركاب'],
        'services' => [
            'voitures' => 'سيارات استثنائية',
            'chauffeur' => 'سائق خاص',
            'van' => 'فان VIP',
            'sejours' => 'إقامات متكاملة',
            'immobilier' => 'العقارات',
            'tables' => 'المطاعم والحجوزات',
            'evenements' => 'الفعاليات',
            'shopping' => 'التسوّق الشخصي',
            'esthetique' => 'إقامة تجميلية',
            'creation' => 'الإبداع والتسويق',
            'conciergerie' => 'كونسيرج عند الطلب',
            'autre' => 'طلب آخر',
        ],
        'deuxPoints' => ': ',
        'signature' => 'Amane — كونسيرج خاص · باريس',
        'note' => 'إذا لم تكونوا أصحاب هذا الطلب، يمكنكم تجاهل هذه الرسالة.',
    ],
];

const NOMS_LANGUES = ['fr' => 'Français', 'en' => 'Anglais', 'es' => 'Espagnol', 'ar' => 'Arabe'];

// Espaces que JavaScript retire avec trim() : on retire les mêmes, pour que les
// deux versions nettoient une saisie exactement de la même façon.
const ESPACES = '\x09-\x0D\x20\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}';

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

/** Échappe une valeur pour l'insérer dans du HTML (texte ou attribut). */
function echapper(mixed $valeur): string
{
    return strtr(chaine($valeur), [
        '&' => '&amp;',
        '<' => '&lt;',
        '>' => '&gt;',
        '"' => '&quot;',
        "'" => '&#39;',
    ]);
}

/** Chaîne UTF-8 valide tirée d'une valeur quelconque (vide si ce n'est ni un texte ni un nombre). */
function chaine(mixed $valeur): string
{
    if (is_int($valeur) || (is_float($valeur) && is_finite($valeur))) {
        return (string) $valeur;
    }

    return is_string($valeur) ? mb_scrub($valeur, 'UTF-8') : '';
}

/** Retire les espaces en début et en fin de chaîne (équivalent du trim() de JavaScript). */
function rogner(string $texte): string
{
    return preg_replace('/^[' . ESPACES . ']+|[' . ESPACES . ']+$/uD', '', $texte) ?? '';
}

/** Minuscules, accents compris, quelle que soit la configuration régionale du serveur. */
function minuscules(string $texte): string
{
    return mb_strtolower($texte, 'UTF-8');
}

/**
 * Coupe une chaîne à $max unités UTF-16 — la mesure de JavaScript, pour que les
 * limites soient les mêmes dans les deux versions — sans laisser un demi-émoji au bout.
 */
function couper(string $texte, int $max): string
{
    if (strlen($texte) <= $max) {
        return $texte; // Jamais plus d'unités UTF-16 que d'octets UTF-8.
    }
    $utf16 = mb_convert_encoding($texte, 'UTF-16BE', 'UTF-8');
    if (strlen($utf16) <= $max * 2) {
        return $texte;
    }
    $utf16 = substr($utf16, 0, $max * 2);
    $derniere = unpack('n', substr($utf16, -2))[1];
    if ($derniere >= 0xD800 && $derniere <= 0xDBFF) {
        $utf16 = substr($utf16, 0, -2);
    }

    return mb_convert_encoding($utf16, 'UTF-8', 'UTF-16BE');
}

/**
 * Ramène une valeur à une seule ligne sûre pour un sujet ou un en-tête :
 * retours à la ligne et tabulations deviennent des espaces, les caractères de
 * contrôle (C0, C1, séparateurs Unicode, marques d'inversion du sens d'écriture)
 * disparaissent.
 */
function uneLigne(mixed $valeur, int $max = 200): string
{
    if (!is_string($valeur) && !is_int($valeur) && !(is_float($valeur) && is_finite($valeur))) {
        return '';
    }
    $propre = chaine($valeur);
    $propre = preg_replace('/[\t\n\x0B\f\r\x{0085}\x{2028}\x{2029}]+/u', ' ', $propre) ?? '';
    $propre = preg_replace(
        '/[\x{0000}-\x{001F}\x{007F}-\x{009F}\x{200B}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u',
        '',
        $propre
    ) ?? '';
    $propre = rogner(preg_replace('/ {2,}/', ' ', $propre) ?? '');

    return rogner(couper($propre, $max));
}

/** Identifiant de service de la liste fermée ; tout le reste (ou vide) devient « autre ». */
function idService(mixed $valeur): string
{
    $id = minuscules(uneLigne($valeur, 40));

    return in_array($id, SERVICES, true) ? $id : 'autre';
}

/** Date au format AAAA-MM-JJ, et qui existe au calendrier ; sinon chaîne vide. */
function dateIso(mixed $valeur): string
{
    if (!is_string($valeur) || !preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D', rogner(chaine($valeur)), $m)) {
        return '';
    }
    [$annee, $mois, $jour] = [(int) $m[1], (int) $m[2], (int) $m[3]];
    if ($annee < 1 || !checkdate($mois, $jour, $annee)) {
        return '';
    }

    return $m[0];
}

/** Nombre de passagers : « 1 » à « 7 » ou « 8+ » ; sinon chaîne vide. */
function passagersValides(mixed $valeur): string
{
    $v = uneLigne($valeur, 8);

    return preg_match('/^(?:[1-7]|8\+)$/D', $v) ? $v : '';
}

/** Écrit une date AAAA-MM-JJ déjà validée dans la langue voulue (« 12 décembre 2026 »). */
function formaterDate(string $iso, string $langue): string
{
    [$annee, $mois, $jour] = array_map('intval', explode('-', $iso));
    $nomMois = MOIS[$langue][$mois - 1] ?? '';
    if ($nomMois === '') {
        return $iso;
    }

    return $langue === 'es' ? "$jour de $nomMois de $annee" : "$jour $nomMois $annee";
}

function langueDe(array $lead): string
{
    $l = minuscules(chaine($lead['langue'] ?? ''));

    return in_array($l, LANGUES, true) ? $l : 'fr';
}

function lienMailto(string $email): string
{
    // Même encodage que encodeURIComponent() : ces cinq signes restent tels quels.
    $encode = strtr(rawurlencode($email), [
        '%40' => '@',
        '%21' => '!',
        '%2A' => '*',
        '%27' => "'",
        '%28' => '(',
        '%29' => ')',
    ]);

    return 'mailto:' . $encode;
}

function lienTel(string $tel): string
{
    $compact = preg_replace('/[^0-9+]/', '', $tel) ?? '';

    return preg_match('/^\+?[0-9]{8,15}$/D', $compact) ? 'tel:' . $compact : '';
}

// ---------------------------------------------------------------------------
// Gabarit HTML commun
// ---------------------------------------------------------------------------

/**
 * Valeur d'une rangée du récapitulatif, en HTML.
 *
 * @param array{label: string, value: string, kind?: string} $rangee
 */
function valeurHtml(array $rangee): string
{
    $valeur = $rangee['value'];
    $v = echapper($valeur);
    $styleLien = 'color:' . COULEURS['bordeaux'] . ';text-decoration:underline;';

    switch ($rangee['kind'] ?? '') {
        case 'multi':
            return '<span dir="auto">' . str_replace("\n", '<br>', $v) . '</span>';
        case 'email':
            return '<a href="' . echapper(lienMailto($valeur)) . '" style="' . $styleLien . '">' . $v . '</a>';
        case 'tel':
            $href = lienTel($valeur);
            $texte = '<span dir="ltr" style="unicode-bidi:embed;">' . $v . '</span>';

            return $href !== ''
                ? '<a href="' . echapper($href) . '" style="' . $styleLien . '">' . $texte . '</a>'
                : $texte;
        default:
            return '<span dir="auto">' . $v . '</span>';
    }
}

/**
 * @param list<array{label: string, value: string, kind?: string}> $rangees
 */
function tableauRecap(array $rangees, string $dir): string
{
    $rtl = $dir === 'rtl';
    $align = $rtl ? 'right' : 'left';
    $filet = COULEURS['filet'];
    $bordeaux = COULEURS['bordeaux'];
    $texte = COULEURS['texte'];
    $sans = SANS;
    // Pas d'interlettrage ni de capitales en arabe : cela casse la ligature des lettres.
    $styleLabel = $rtl
        ? 'font-size:13px;line-height:22px;'
        : 'font-size:11px;line-height:22px;letter-spacing:1.5px;text-transform:uppercase;';
    $margeLabel = $rtl ? 'padding:10px 0 10px 12px;' : 'padding:10px 12px 10px 0;';

    $lignes = [];
    foreach ($rangees as $r) {
        $label = echapper($r['label']);
        $valeur = valeurHtml($r);
        $lignes[] = <<<HTML
            <tr>
            <td width="32%" valign="top" align="{$align}" style="border-top:1px solid {$filet};{$margeLabel}font-family:{$sans};{$styleLabel}color:{$bordeaux};">{$label}</td>
            <td valign="top" align="{$align}" style="border-top:1px solid {$filet};padding:10px 0;font-family:{$sans};font-size:15px;line-height:22px;color:{$texte};word-break:break-word;">{$valeur}</td>
            </tr>
            HTML;
    }
    $corps = implode("\n", $lignes);

    return <<<HTML
        <table role="presentation" dir="{$dir}" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-bottom:1px solid {$filet};">
        {$corps}
        </table>
        HTML;
}

/**
 * Enveloppe commune : fond pierre, bandeau bordeaux « AMANE », filet or,
 * contenu, signature. $contenu est du HTML déjà échappé.
 */
function gabarit(
    string $lang,
    string $dir,
    string $titreDoc,
    string $contenu,
    string $signature,
    string $note = ''
): string {
    $c = COULEURS;
    $serif = SERIF;
    $sans = SANS;
    $align = $dir === 'rtl' ? 'right' : 'left';
    // Pas d'italique en arabe : l'écriture n'en a pas, le rendu serait un faux penché.
    $italique = $dir === 'rtl' ? '' : 'font-style:italic;';
    $titre = echapper($titreDoc);
    $sig = echapper($signature);
    $blocNote = '';
    if ($note !== '') {
        $blocNote = "\n" . '<tr><td align="' . $align . '" style="padding:0 32px 28px 32px;font-family:' . $sans
            . ';font-size:12px;line-height:18px;color:' . $c['texte'] . ';">' . echapper($note) . '</td></tr>';
    }

    return <<<HTML
        <!DOCTYPE html>
        <html lang="{$lang}" dir="{$dir}" xmlns="http://www.w3.org/1999/xhtml">
        <head>
        <meta charset="utf-8">
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="light">
        <meta name="supported-color-schemes" content="light">
        <title>{$titre}</title>
        </head>
        <body style="margin:0;padding:0;background-color:{$c['fond']};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
        <table role="presentation" dir="{$dir}" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{$c['fond']}" style="width:100%;background-color:{$c['fond']};">
        <tr><td align="center" style="padding:24px 12px;">
        <!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" dir="{$dir}" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{$c['fond']}" style="width:100%;max-width:560px;background-color:{$c['fond']};border:1px solid {$c['filet']};">
        <tr><td dir="ltr" align="center" bgcolor="{$c['bordeaux']}" style="background-color:{$c['bordeaux']};padding:30px 24px 28px 33px;font-family:{$serif};font-size:22px;line-height:28px;letter-spacing:9px;color:{$c['pierre']};">AMANE</td></tr>
        <tr><td bgcolor="{$c['or']}" height="1" style="height:1px;line-height:1px;font-size:1px;background-color:{$c['or']};">&nbsp;</td></tr>
        <tr><td align="{$align}" style="padding:36px 32px 28px 32px;">
        {$contenu}
        </td></tr>
        <tr><td align="{$align}" style="padding:0 32px 28px 32px;font-family:{$serif};font-size:15px;line-height:22px;{$italique}color:{$c['bordeaux']};">{$sig}</td></tr>{$blocNote}
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
        </td></tr>
        </table>
        </body>
        </html>
        HTML;
}

/**
 * Paragraphe. $texte est du HTML déjà échappé.
 *
 * @param array{marge?: string, serif?: bool, taille?: int, hauteur?: int, couleur?: string} $o
 */
function paragraphe(string $texte, array $o = []): string
{
    $marge = $o['marge'] ?? '0 0 16px 0';
    $police = ($o['serif'] ?? false) ? SERIF : SANS;
    $taille = $o['taille'] ?? 15;
    $hauteur = $o['hauteur'] ?? 24;
    $couleur = $o['couleur'] ?? COULEURS['texte'];

    return '<p style="margin:' . $marge . ';font-family:' . $police . ';font-size:' . $taille . 'px;line-height:'
        . $hauteur . 'px;font-weight:normal;color:' . $couleur . ';">' . $texte . '</p>';
}

function titreSection(string $texte, string $dir): string
{
    $style = $dir === 'rtl'
        ? 'font-size:14px;line-height:22px;'
        : 'font-size:11px;line-height:18px;letter-spacing:2px;text-transform:uppercase;';

    return '<p style="margin:28px 0 10px 0;font-family:' . SANS . ';' . $style . 'font-weight:bold;color:'
        . COULEURS['bordeaux'] . ';">' . echapper($texte) . '</p>';
}

/**
 * @param list<array{label: string, value: string, kind?: string}> $rangees
 */
function recapTexte(array $rangees, string $deuxPoints): string
{
    $lignes = [];
    foreach ($rangees as $r) {
        $lignes[] = ($r['kind'] ?? '') === 'multi'
            ? $r['label'] . rtrim($deuxPoints) . "\n" . $r['value']
            : $r['label'] . $deuxPoints . $r['value'];
    }

    return implode("\n", $lignes);
}

// ---------------------------------------------------------------------------
// E-mail à l'équipe
// ---------------------------------------------------------------------------

/**
 * @param array<string, mixed> $lead
 * @return array{subject: string, html: string, text: string}
 */
function teamEmail(array $lead = []): array
{
    $service = TEXTES['fr']['services'][idService($lead['service'] ?? '')];
    $nomSaisi = chaine($lead['nom'] ?? '');
    $nom = uneLigne($nomSaisi, 120);
    $nom = $nom !== '' ? $nom : 'Nom non précisé';
    $subject = uneLigne("Nouvelle demande — $service — $nom", 240);
    $langue = langueDe($lead);
    $date = dateIso($lead['date'] ?? '');
    $passagers = passagersValides($lead['passagers'] ?? '');
    $email = chaine($lead['email'] ?? '');
    $tel = chaine($lead['tel'] ?? '');
    $message = chaine($lead['message'] ?? '');
    $recuLe = chaine($lead['recuLe'] ?? '');
    $vide = '—';

    $rangees = [
        ['label' => 'Nom', 'value' => $nomSaisi !== '' ? $nomSaisi : $vide],
        $email !== ''
            ? ['label' => 'E-mail', 'value' => $email, 'kind' => 'email']
            : ['label' => 'E-mail', 'value' => $vide],
        $tel !== ''
            ? ['label' => 'Téléphone', 'value' => $tel, 'kind' => 'tel']
            : ['label' => 'Téléphone', 'value' => $vide],
        ['label' => 'Service', 'value' => $service],
        ['label' => 'Date', 'value' => $date !== '' ? formaterDate($date, 'fr') : $vide],
        ['label' => 'Passagers', 'value' => $passagers !== '' ? $passagers : $vide],
        ['label' => 'Langue', 'value' => NOMS_LANGUES[$langue]],
        ['label' => 'Message', 'value' => $message !== '' ? $message : $vide, 'kind' => 'multi'],
    ];
    if ($recuLe !== '') {
        $rangees[] = ['label' => 'Reçue le', 'value' => "$recuLe (heure de Paris)"];
    }

    $consigne = $email !== ''
        ? 'Répondre à ce message écrit directement au client.'
        : 'Le client n’a pas laissé d’e-mail : le joindre par téléphone.';

    $contenu = implode("\n", [
        '<h1 style="margin:0 0 6px 0;font-family:' . SERIF . ';font-size:24px;line-height:32px;font-weight:normal;color:'
            . COULEURS['bordeaux'] . ';">Nouvelle demande</h1>',
        paragraphe(
            echapper($service) . ' — <span dir="auto">' . echapper($nom) . '</span>',
            ['marge' => '0 0 24px 0']
        ),
        tableauRecap($rangees, 'ltr'),
        paragraphe(echapper($consigne), ['marge' => '20px 0 0 0', 'taille' => 13, 'hauteur' => 20]),
    ]);

    $html = gabarit('fr', 'ltr', $subject, $contenu, TEXTES['fr']['signature']);

    $text = implode("\n", [
        'AMANE',
        '',
        'Nouvelle demande',
        "$service — $nom",
        '',
        recapTexte($rangees, ' : '),
        '',
        $consigne,
        '',
        TEXTES['fr']['signature'],
    ]);

    return ['subject' => $subject, 'html' => $html, 'text' => $text];
}

// ---------------------------------------------------------------------------
// Accusé de réception au client
// ---------------------------------------------------------------------------

/**
 * L'accusé part vers une adresse saisie par un inconnu, qui n'est pas forcément
 * la sienne. Il ne reprend donc AUCUN texte libre de la demande (ni nom, ni
 * message, ni téléphone) : seulement des valeurs choisies dans des listes fermées
 * — le libellé du service, la date, le nombre de passagers. Ainsi, personne ne
 * peut se servir du formulaire pour faire envoyer son propre texte à un tiers
 * sous l'en-tête Amane. Ne rien ajouter ici qui vienne tel quel du formulaire.
 *
 * @param array<string, mixed> $lead
 * @return array{subject: string, html: string, text: string}
 */
function ackEmail(array $lead = []): array
{
    $langue = langueDe($lead);
    $t = TEXTES[$langue];
    $date = dateIso($lead['date'] ?? '');
    $passagers = passagersValides($lead['passagers'] ?? '');

    $rangees = [
        ['label' => $t['champs']['service'], 'value' => $t['services'][idService($lead['service'] ?? '')]],
    ];
    if ($date !== '') {
        $rangees[] = ['label' => $t['champs']['date'], 'value' => formaterDate($date, $langue)];
    }
    if ($passagers !== '') {
        $rangees[] = ['label' => $t['champs']['passagers'], 'value' => $passagers];
    }

    $blocs = [
        paragraphe(echapper($t['salut']), ['marge' => '0 0 18px 0']),
        paragraphe(echapper($t['recu']), [
            'marge' => '0 0 12px 0',
            'serif' => true,
            'taille' => 22,
            'hauteur' => 30,
            'couleur' => COULEURS['bordeaux'],
        ]),
        paragraphe(echapper($t['delai']), ['marge' => '0']),
        titreSection($t['recap'], $t['dir']),
        tableauRecap($rangees, $t['dir']),
    ];

    $html = gabarit($langue, $t['dir'], $t['sujet'], implode("\n", $blocs), $t['signature'], $t['note']);

    $lignes = [
        'AMANE',
        '',
        $t['salut'],
        '',
        $t['recu'] . ' ' . $t['delai'],
        '',
        $t['recap'],
        '—',
        recapTexte($rangees, $t['deuxPoints']),
        '',
        $t['signature'],
        '',
        $t['note'],
    ];

    return ['subject' => $t['sujet'], 'html' => $html, 'text' => implode("\n", $lignes)];
}
