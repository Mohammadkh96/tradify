type ApiBaseUrlOptions = {
  platform: string;
  webOrigin?: string;
  configuredApiUrl?: string;
  configuredDomain?: string;
};

export function resolveApiBaseUrl({
  platform,
  webOrigin,
  configuredApiUrl,
  configuredDomain,
}: ApiBaseUrlOptions): string {
  if (platform === "web" && webOrigin) return webOrigin;
  if (configuredApiUrl) return configuredApiUrl;
  if (configuredDomain) return `https://${configuredDomain}`;
  return "https://tradify-signals.replit.app";
}
