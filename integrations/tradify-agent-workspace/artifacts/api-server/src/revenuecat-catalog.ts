import { env } from "@workspace/config";
import { ReplitConnectors, type ProxyOptions } from "@replit/connectors-sdk";

export interface RevenueCatCatalogProxy {
  proxy(service: string, path: string, init?: ProxyOptions): Promise<Response>;
}

export interface AdminRevenueCatIndicativePrice {
  amountMicros: string;
  currency: string;
  country: string | null;
}

export interface AdminRevenueCatPriceLine {
  packageId: string;
  packageName: string;
  productId: string;
  productDisplayName: string;
  storeType: string;
  storeName: string;
  storeProductIdentifier: string;
  productState: string | null;
  indicativePrice: AdminRevenueCatIndicativePrice | null;
  priceUnavailableReason: "STORE_CREDENTIALS_MISSING" | "PRICE_NOT_REPORTED" | null;
}

export interface AdminRevenueCatPriceSummary {
  fetchedAt: string;
  currentOffering: {
    id: string;
    displayName: string;
    lookupKey: string;
  } | null;
  products: AdminRevenueCatPriceLine[];
}

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RecordValue)
    : undefined;
}

function listItems(value: unknown): RecordValue[] {
  const items = asRecord(value)?.items;
  return Array.isArray(items)
    ? items.map(asRecord).filter((item): item is RecordValue => item !== undefined)
    : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function priceFrom(value: unknown): AdminRevenueCatIndicativePrice | null {
  const price = asRecord(value);
  if (!price) return null;

  const rawAmount = price.amount_micros;
  const amountMicros =
    typeof rawAmount === "string" && /^\d+$/.test(rawAmount)
      ? rawAmount
      : typeof rawAmount === "number" && Number.isSafeInteger(rawAmount) && rawAmount >= 0
        ? String(rawAmount)
        : undefined;
  const currency = stringValue(price.currency)?.toUpperCase();
  if (amountMicros === undefined || !currency || !/^[A-Z]{3}$/.test(currency)) return null;

  return {
    amountMicros,
    currency,
    country: stringValue(price.country) ?? null,
  };
}

async function getJson(proxy: RevenueCatCatalogProxy, path: string): Promise<unknown> {
  const response = await proxy.proxy("revenuecat", path, { method: "GET" });
  if (!response.ok) {
    throw new Error(`RevenueCat catalog request failed with status ${response.status}.`);
  }
  return (await response.json()) as unknown;
}

function storeCredentialsConfigured(
  app: RecordValue | undefined,
  storeType: string,
): boolean | undefined {
  if (!app) return undefined;
  const storeConfig = asRecord(app[storeType]);
  if (!storeConfig) return undefined;
  const flag =
    storeType === "app_store"
      ? storeConfig.app_store_connect_api_key_configured
      : storeType === "play_store"
        ? storeConfig.play_service_account_credentials_configured
        : undefined;
  return typeof flag === "boolean" ? flag : undefined;
}

export async function fetchAdminRevenueCatPriceSummary(
  client?: RevenueCatCatalogProxy,
  projectId = env.revenueCatProjectId,
  fetchedAt = new Date(),
): Promise<AdminRevenueCatPriceSummary> {
  if (!projectId) throw new Error("RevenueCat project is not configured.");
  const proxy = client ?? new ReplitConnectors();
  const basePath = `/v2/projects/${encodeURIComponent(projectId)}`;

  // Keep configuration reads sequential to avoid unnecessary bursts against
  // RevenueCat's project-configuration rate limit.
  const appsPayload = await getJson(proxy, `${basePath}/apps?limit=100`);
  const offeringsPayload = await getJson(
    proxy,
    `${basePath}/offerings?limit=100&expand=items.package.product`,
  );
  const appsById = new Map<string, RecordValue>();
  for (const app of listItems(appsPayload)) {
    const id = stringValue(app.id);
    if (id) appsById.set(id, app);
  }

  const offering = listItems(offeringsPayload).find((item) => item.is_current === true);
  if (!offering) {
    return { fetchedAt: fetchedAt.toISOString(), currentOffering: null, products: [] };
  }

  const offeringId = stringValue(offering.id);
  if (!offeringId) throw new Error("RevenueCat current offering is missing its identifier.");

  const packages = listItems(offering.packages);
  const products: AdminRevenueCatPriceLine[] = [];
  for (const pkg of packages) {
    const packageId = stringValue(pkg.id);
    if (!packageId) continue;
    const packageName = stringValue(pkg.display_name) ?? stringValue(pkg.lookup_key) ?? packageId;
    for (const packageProduct of listItems(pkg.products)) {
      const product = asRecord(packageProduct.product);
      if (!product) continue;
      const productId = stringValue(product.id);
      const storeProductIdentifier = stringValue(product.store_identifier);
      const appId = stringValue(product.app_id);
      if (!productId || !storeProductIdentifier) continue;

      const app = appId ? appsById.get(appId) : undefined;
      const storeType = stringValue(app?.type) ?? "unknown";
      const indicativePrice = priceFrom(product.indicative_price);
      const credentialsConfigured = storeCredentialsConfigured(app, storeType);

      products.push({
        packageId,
        packageName,
        productId,
        productDisplayName: stringValue(product.display_name) ?? storeProductIdentifier,
        storeType,
        storeName:
          stringValue(app?.name) ??
          (storeType === "app_store"
            ? "App Store"
            : storeType === "play_store"
              ? "Google Play"
              : "Unknown store"),
        storeProductIdentifier,
        productState: stringValue(product.state) ?? null,
        indicativePrice,
        priceUnavailableReason: indicativePrice
          ? null
          : credentialsConfigured === false
            ? "STORE_CREDENTIALS_MISSING"
            : "PRICE_NOT_REPORTED",
      });
    }
  }

  return {
    fetchedAt: fetchedAt.toISOString(),
    currentOffering: {
      id: offeringId,
      displayName:
        stringValue(offering.display_name) ?? stringValue(offering.lookup_key) ?? offeringId,
      lookupKey: stringValue(offering.lookup_key) ?? "",
    },
    products,
  };
}
