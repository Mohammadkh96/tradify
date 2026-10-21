import { ReplitConnectors } from "@replit/connectors-sdk";

type RevenueCatList = {
  items?: unknown[];
  next_page?: string | null;
};

const projectId = process.env.REVENUECAT_PROJECT_ID;
if (!projectId) {
  throw new Error("REVENUECAT_PROJECT_ID is not configured.");
}

const connectors = new ReplitConnectors();

async function getList(path: string): Promise<RevenueCatList> {
  const response = await connectors.proxy("revenuecat", path, { method: "GET" });
  if (!response.ok) {
    throw new Error(`RevenueCat catalog request failed (${response.status}).`);
  }
  return (await response.json()) as RevenueCatList;
}

const basePath = `/v2/projects/${encodeURIComponent(projectId)}`;
const offerings = await getList(`${basePath}/offerings?limit=100&expand=items.package.product`);
console.log(JSON.stringify(offerings, null, 2));
