import Head from "expo-router/head";

export function PageMetadata({
  title,
  description,
  indexable = false,
}: {
  title: string;
  description: string;
  indexable?: boolean;
}) {
  const pageTitle = `${title} | Tradify Signals`;
  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={indexable ? "index, follow" : "noindex, nofollow"} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
    </Head>
  );
}
