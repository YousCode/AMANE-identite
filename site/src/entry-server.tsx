import { renderToString } from 'react-dom/server';
import { App } from './App';
import { LANGS, LANG_META, SERVICES, dict, plain, type Lang } from './i18n';
import { CONTACT_EMAIL, WHATSAPP } from './config';
import bodoni from '@fontsource/bodoni-moda/files/bodoni-moda-latin-400-normal.woff2?url';
import jost from '@fontsource/jost/files/jost-latin-400-normal.woff2?url';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function structuredData(lang: Lang, site: string) {
  const d = dict(lang);
  const url = site + LANG_META[lang].path;
  const business: Record<string, unknown> = {
    '@type': 'LocalBusiness',
    '@id': `${site}/#amane`,
    name: 'Amane',
    description: d.metaDesc,
    slogan: plain(d.h1),
    url,
    image: `${site}/og.jpg`,
    logo: `${site}/favicon.svg`,
    address: { '@type': 'PostalAddress', addressLocality: 'Paris', postalCode: '75008', addressCountry: 'FR' },
    areaServed: [{ '@type': 'City', name: 'Paris' }, { '@type': 'AdministrativeArea', name: 'Île-de-France' }],
    knowsLanguage: ['fr', 'en', 'es', 'ar'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: d.sk,
      itemListElement: SERVICES.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: d[s.key][0], description: d[s.key][1], url: `${url}#${s.id}`, areaServed: 'Paris' },
      })),
    },
  };
  if (CONTACT_EMAIL) business.email = CONTACT_EMAIL;
  if (WHATSAPP) business.telephone = `+${WHATSAPP}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      business,
      { '@type': 'WebSite', '@id': `${site}/#site`, url: `${site}/`, name: 'Amane', inLanguage: LANGS, publisher: { '@id': `${site}/#amane` } },
      { '@type': 'WebPage', '@id': `${url}#page`, url, name: d.metaTitle, description: d.metaDesc, inLanguage: lang, isPartOf: { '@id': `${site}/#site` }, about: { '@id': `${site}/#amane` } },
      { '@type': 'FAQPage', '@id': `${url}#faq`, inLanguage: lang, mainEntity: d.qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };
}

function head(lang: Lang, site: string) {
  const d = dict(lang);
  const url = site + LANG_META[lang].path;
  const tags = [
    `<title>${esc(d.metaTitle)}</title>`,
    `<meta name="description" content="${esc(d.metaDesc)}">`,
    `<link rel="canonical" href="${url}">`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site + LANG_META[l].path}">`),
    `<link rel="alternate" hreflang="x-default" href="${site}/">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Amane">`,
    `<meta property="og:title" content="${esc(d.metaTitle)}">`,
    `<meta property="og:description" content="${esc(d.metaDesc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${site}/og.jpg">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:locale" content="${LANG_META[lang].locale}">`,
    ...LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${LANG_META[l].locale}">`),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="preload" as="image" href="/frames/f_001.jpg" fetchpriority="high">`,
    ...(lang === 'ar' ? [] : [bodoni, jost].map((f) => `<link rel="preload" as="font" type="font/woff2" href="${f}" crossorigin>`)),
    `<script type="application/ld+json">${JSON.stringify(structuredData(lang, site)).replace(/</g, '\\u003c')}</script>`,
  ];
  return tags.join('\n');
}

export function render(lang: Lang, site: string) {
  return { html: renderToString(<App lang={lang} />), head: head(lang, site), dir: LANG_META[lang].dir };
}

export { LANGS, LANG_META };
