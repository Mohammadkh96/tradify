import { Helmet } from 'react-helmet-async';

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
}

export function SEO({ 
  title = "TradifyApp - Rule-Based Trading Journal",
  description = "Enforce disciplined trading with TradifyApp. Auto-sync trades from MT5, validate strategies against rules, track performance with real-time analytics.",
  noindex = false,
  canonical,
  ogType = "website",
  ogImage = "https://tradifyapp.com/images/tradify-promo-1.png",
  article,
  structuredData
}: SEOProps) {
  const fullTitle = title.includes("TradifyApp") ? title : `${title} | TradifyApp`;
  const url = canonical || "https://tradifyapp.com";
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {canonical && <link rel="canonical" href={canonical} />}

      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="TradifyApp" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {article?.publishedTime && <meta property="article:published_time" content={article.publishedTime} />}
      {article?.author && <meta property="article:author" content={article.author} />}
      {article?.section && <meta property="article:section" content={article.section} />}
      {article?.tags?.map((tag, i) => <meta key={i} property="article:tag" content={tag} />)}

      {structuredData && Array.isArray(structuredData) ? (
        structuredData.map((data, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(data)}
          </script>
        ))
      ) : structuredData ? (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      ) : null}
    </Helmet>
  );
}

export function NoIndexSEO({ title }: { title?: string }) {
  return <SEO title={title} noindex={true} />;
}
