const UTM_STORAGE_KEY = "tradify_utm";
const UTM_EXPIRY_DAYS = 30;

interface UTMData {
  utm_source: string;
  utm_campaign: string;
  captured_at: number;
}

export function captureUTMParams(): void {
  const existing = getStoredUTM();
  if (existing) return;

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  const utmCampaign = params.get("utm_campaign");

  if (utmSource || utmCampaign) {
    const data: UTMData = {
      utm_source: utmSource || "",
      utm_campaign: utmCampaign || "",
      captured_at: Date.now(),
    };
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
  }
}

export function getStoredUTM(): { utm_source: string; utm_campaign: string } | null {
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;

    const data: UTMData = JSON.parse(raw);
    const expiryMs = UTM_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - data.captured_at > expiryMs) {
      localStorage.removeItem(UTM_STORAGE_KEY);
      return null;
    }

    return { utm_source: data.utm_source, utm_campaign: data.utm_campaign };
  } catch {
    return null;
  }
}
