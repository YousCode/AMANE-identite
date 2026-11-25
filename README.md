# AMANE — Identité de marque

Conciergerie · Paris — édition 02, novembre 2026.

Ce dépôt regroupe toute l'identité visuelle d'Amane : logos vectoriels, brand book, scripts de génération et archives de la première édition.

## Contenu

```
logos/
  svg/        20 fichiers vectoriels (source de vérité, à utiliser en priorité)
  png/        14 exports transparents en 2400 px
brandbook/
  index.html  Brand book complet (s'ouvre dans un navigateur, aucune dépendance)
source/       Scripts qui génèrent les logos et le brand book
site/         Site public (React + Vite, 4 langues, formulaire relié à l'e-mail) : voir site/README.md
archives/
  edition-01/ Première version (avant le passage au bordeaux)
```

## Les signes

| Fichier | Usage |
|---|---|
| `amane-logo-principal-*` | Couverture, signalétique, site |
| `amane-logo-horizontal-*` | En-têtes, signatures e-mail, factures |
| `amane-logotype-*` | AMANE seul, quand le symbole est déjà présent |
| `amane-monogramme-*` | Arche + A : cuir, avatar, favicon ≥ 32 px |
| `amane-A-*` | A seul : gaufrage, très petites tailles |
| `amane-sceau-*` | Cachet de cire, dorure, coffrets |
| `amane-motif-arcades-*` | Fonds, doublures, papier de soie (ton sur ton uniquement) |

Déclinaisons de couleur : `bordeaux`, `pierre`, `or`, `noir`, `lie`.

## Concept

**La porte cochère.** L'arche reprend le cintre d'une porte haussmannienne. Le A est un didone à fort contraste, et sa barre horizontale est un filet traversé par une serrure : Amane ouvre les portes de Paris.

Signature : *Toutes les portes de Paris.*

## Couleurs

| Nom | Hex | Rôle |
|---|---|---|
| Velours Garnier | `#5B1622` | Couleur maîtresse |
| Lie-de-vin | `#3B0C15` | Ton sur ton, ombres, cuir |
| Bordeaux clair | `#7A2232` | Motif, survols web |
| Pierre de Paris | `#EFE7DA` / `#F6F1E8` | Papier, texte sur bordeaux |
| Noir laqué | `#15110F` | Nuit, réseaux |
| Or Garnier | `#B8955C` | Dorure à chaud et laiton uniquement |

Dosage : bordeaux 57 %, pierre 28 %, noir 12 %, or 3 %.

## Typographies

- **Bodoni Moda** : titres. Capitales espacées de +16 %.
- **Jost** : labels en capitales espacées de +42 %, et texte courant en 300.

Les deux sont gratuites (Google Fonts, licence OFL).

Le logotype AMANE n'est pas une police tapée au clavier : il est vectorisé, et ses A sont dessinés sur mesure. Utilise toujours les fichiers du dépôt, ne le retape pas.

## Regénérer les fichiers

```bash
cd source
npm install
npm run build   # régénère logos/svg/ et brandbook/index.html
```

Les exports PNG se font avec `render.js` (Playwright) :

```bash
node render.js ../logos/svg/amane-sceau-or.svg sceau.png 2400
```

## À faire avant d'imprimer

1. **Antériorités** : vérifier « AMANE » sur data.inpi.fr et TMview, en classes 39 et 45, puis faire valider le dépôt par l'avocat.
2. **Sceau** : faire graver un cachet en laiton de 30 mm à partir de `amane-sceau-bordeaux.svg`, puis le tester sur une enveloppe crème.
3. **Épreuve physique des cartes** : la comparer au Pantone 7421 C. Cette correspondance avec le bordeaux est à confirmer.

---

© 2026 Amane. Tous droits réservés. Les fichiers de ce dépôt sont publics en consultation, mais leur réutilisation est interdite sans autorisation.
