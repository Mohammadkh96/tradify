import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, isRtl, normalizeLang } from '@/lib/i18n';

const OG_LOCALE: Record<string, string> = {
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
  zh: "zh_CN",
  ar: "ar_SA",
};

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface SEOProps {
  title?: string;
  description?: string;
  noindex?: boolean;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  article?: {
    publishedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
  structuredData?: object | object[];
  breadcrumbs?: BreadcrumbItem[];
}

const SITE_URL = "https://tradifyapp.com";

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TradifyApp",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  description:
    "Trading discipline platform that enforces your rules and auto-syncs MT5 trades for disciplined traders.",
  sameAs: [
    "https://x.com/tradifyapp",
    "https://www.linkedin.com/company/tradifyapp",
    "https://www.youtube.com/@tradifyapp",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: SITE_URL,
  },
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "TradifyApp",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export function SEO({
  title = "TradifyApp - Trading Discipline Platform",
  description = "80% of traders fail prop challenges because they break their own rules. TradifyApp enforces your trading rules, tracks drawdown in real time, and stops revenge trading before it starts.",
  noindex = false,
  canonical,
  ogType = "website",
  ogImage = "https://tradifyapp.com/images/tradify-promo-1.png",
  article,
  structuredData,
  breadcrumbs,
}: SEOProps) {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);
  const dir = isRtl(lang) ? "rtl" : "ltr";

  const fullTitle = title.includes("TradifyApp") ? title : `${title} | TradifyApp`;
  const url = canonical || SITE_URL;

  // Build hreflang URLs (?lang=xx) so search engines can discover language variants
  const hreflangBase = url.split("?")[0];
  const hreflangs = SUPPORTED_LANGUAGES.map((l) => ({
    code: l.code,
    href: `${hreflangBase}?lang=${l.code}`,
  }));

  const breadcrumbJsonLd =
    breadcrumbs && breadcrumbs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: item.url,
          })),
        }
      : null;

  return (
    <Helmet>
      <html lang={lang} dir={dir} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* hreflang alternates for international SEO */}
      {!noindex &&
        hreflangs.map((h) => (
          <link key={h.code} rel="alternate" hrefLang={h.code} href={h.href} />
        ))}
      {!noindex && <link rel="alternate" hrefLang="x-default" href={hreflangBase} />}

      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="TradifyApp" />
      <meta property="og:locale" content={OG_LOCALE[lang] || "en_US"} />
      {SUPPORTED_LANGUAGES.filter((l) => l.code !== lang).map((l) => (
        <meta
          key={l.code}
          property="og:locale:alternate"
          content={OG_LOCALE[l.code] || "en_US"}
        />
      ))}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@tradifyapp" />
      <meta name="twitter:creator" content="@tradifyapp" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {article?.publishedTime && (
        <meta property="article:published_time" content={article.publishedTime} />
      )}
      {article?.author && <meta property="article:author" content={article.author} />}
      {article?.section && <meta property="article:section" content={article.section} />}
      {article?.tags?.map((tag, i) => (
        <meta key={i} property="article:tag" content={tag} />
      ))}

      {/* Sitewide schemas: Organization + WebSite */}
      {!noindex && (
        <script type="application/ld+json">{JSON.stringify(ORG_SCHEMA)}</script>
      )}
      {!noindex && (
        <script type="application/ld+json">{JSON.stringify(WEBSITE_SCHEMA)}</script>
      )}

      {breadcrumbJsonLd && (
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      )}

      {structuredData && Array.isArray(structuredData)
        ? structuredData.map((data, i) => (
            <script key={i} type="application/ld+json">
              {JSON.stringify(data)}
            </script>
          ))
        : structuredData
        ? <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        : null}
    </Helmet>
  );
}

export function NoIndexSEO({ title }: { title?: string }) {
  return <SEO title={title} noindex={true} />;
}
