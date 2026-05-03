import { Client } from "@replit/object-storage";

const PREFIX = "trade-charts";
let client: Client | null = null;

function getClient(): Client {
  if (!client) client = new Client();
  return client;
}

export function buildChartKey(userId: string, tradeId: number, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `${PREFIX}/${userId}/${tradeId}-${Date.now()}.${safeExt}`;
}

export async function uploadChart(key: string, buf: Buffer): Promise<void> {
  const c = getClient();
  const r = await c.uploadFromBytes(key, buf);
  if (!r.ok) throw new Error(`Object storage upload failed: ${(r as any).error?.message || "unknown"}`);
}

export async function downloadChart(key: string): Promise<Buffer> {
  const c = getClient();
  const r = await c.downloadAsBytes(key);
  if (!r.ok) throw new Error(`Object storage download failed: ${(r as any).error?.message || "unknown"}`);
  const v = (r as any).value;
  return Buffer.isBuffer(v) ? v : Buffer.isBuffer(v?.[0]) ? v[0] : Buffer.from(v);
}

export async function deleteChart(key: string): Promise<void> {
  const c = getClient();
  try { await c.delete(key); } catch { /* ignore */ }
}

export function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

export function mimeFromKey(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
