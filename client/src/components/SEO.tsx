import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  noindex?: boolean;
  canonical?: string;
}

export function SEO({ 
  title = "Tradify - Rule-Based Trading Journal",
  description = "Enforce disciplined trading with Tradify. Auto-sync trades from MT5, validate strategies against rules, track performance with real-time analytics.",
  noindex = false,
  canonical
}: SEOProps) {
  const fullTitle = title.includes("Tradify") ? title : `${title} | Tradify`;
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {canonical && <link rel="canonical" href={canonical} />}
    </Helmet>
  );
}

export function NoIndexSEO({ title }: { title?: string }) {
  return <SEO title={title} noindex={true} />;
}
