import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Storage } from "@google-cloud/storage";
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { getAuthenticatedActor, getApplicationIdentity, getModeratorIdentity } from "./tradigo";

const router: IRouter = Router();
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: "http://127.0.0.1:1106/token",
    type: "external_account",
    credential_source: {
      url: "http://127.0.0.1:1106/credential",
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateObjectDir(): string {
  return (process.env.PRIVATE_OBJECT_DIR ?? "").replace(/\/+$/, "");
}

function errorMessage(res: any, status: number, message: string): void {
  res.status(status).json({ error: { message } });
}

function documentContentType(prefix: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (prefix.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (prefix.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (prefix.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  return null;
}

function parseObjectPath(rawPath: string): { bucketName: string; objectName: string } | null {
  const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const privateDir = privateObjectDir();
  const fullPath = `${privateDir}${normalized.replace(/^\/objects/, "")}`;
  const parts = fullPath.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to sign object URL, status ${response.status}.`);
  }
  const body = await response.json() as { signed_url?: unknown };
  if (typeof body.signed_url !== "string" || !body.signed_url) {
    throw new Error("Object storage returned an invalid signed URL.");
  }
  return body.signed_url;
}

export async function verifyApplicationUpload(ownerId: string, objectPath: string): Promise<{ contentType: string; sizeBytes: number } | null> {
  const ownerHash = createHash("sha256").update(ownerId).digest("hex");
  const expectedPrefix = `/objects/uploads/${ownerHash}/`;
  const uploadId = objectPath.startsWith(expectedPrefix) ? objectPath.slice(expectedPrefix.length) : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadId)) return null;
  const parsed = parseObjectPath(objectPath);
  if (!parsed) return null;

  const file = storage.bucket(parsed.bucketName).file(parsed.objectName);
  const [metadata] = await file.getMetadata();
  const sizeBytes = Number(metadata.size ?? 0);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 10 * 1024 * 1024) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    return null;
  }
  const [prefix] = await file.download({ start: 0, end: 15 });
  const contentType = documentContentType(prefix);
  if (!contentType) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    return null;
  }
  return { contentType, sizeBytes };
}

router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  const identity = await getAuthenticatedActor(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }
  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 160) : "";
  const contentType = typeof req.body?.contentType === "string" ? req.body.contentType.trim().toLowerCase() : "";
  const size = Number(req.body?.size);
  const documentType = typeof req.body?.documentType === "string" ? req.body.documentType : "";
  if (!name || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024 || !contentType || !["application/pdf", "image/png", "image/jpeg"].includes(contentType)) {
    errorMessage(res, 400, "Upload a PDF, PNG, or JPEG document up to 10 MB."); return;
  }
  if (documentType === "IDENTITY" || documentType === "GOVERNMENT_ID") {
    errorMessage(res, 400, "Government identity documents must be verified by the payment provider and are not stored by Tradigo."); return;
  }
  const privateDir = privateObjectDir();
  const parts = privateDir.split("/").filter(Boolean);
  if (parts.length < 2) { errorMessage(res, 503, "Private document storage is not configured."); return; }
  try {
    const ownerHash = createHash("sha256").update(identity.id).digest("hex");
    const objectName = `${parts.slice(1).join("/")}/uploads/${ownerHash}/${randomUUID()}`;
    const uploadURL = await signObjectURL({ bucketName: parts[0], objectName, method: "PUT", ttlSec: 15 * 60 });
    res.json({ uploadURL, objectPath: `/objects/${objectName.slice(parts.slice(1).join("/").length + 1)}`, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Failed to generate application document upload URL");
    errorMessage(res, 500, "Unable to prepare the document upload.");
  }
});

router.get("/storage/objects/*path", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  const moderator = await getModeratorIdentity(req);
  if (!identity && !moderator) { errorMessage(res, 401, "Sign in is required."); return; }
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const rawPath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
  const objectPath = `/objects/${rawPath}`;
  const parsed = parseObjectPath(objectPath);
  if (!parsed) { errorMessage(res, 404, "Document not found."); return; }
  try {
    const linked = await pool.query(
      "SELECT 1 FROM tradigo_application_documents WHERE object_path=$1 LIMIT 1",
      [objectPath],
    );
    if (!linked.rowCount) { errorMessage(res, 404, "Document not found."); return; }

    const file = storage.bucket(parsed.bucketName).file(parsed.objectName);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    if (!Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) {
      errorMessage(res, 415, "This document is not an allowed application file.");
      return;
    }
    const [prefix] = await file.download({ start: 0, end: 15 });
    const contentType = documentContentType(prefix);
    if (!contentType) {
      errorMessage(res, 415, "This document is not an allowed application file.");
      return;
    }
    const extension = contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : "jpg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(metadata.size ?? 0));
    res.setHeader("Content-Disposition", `attachment; filename="application-document.${extension}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cache-Control", "private, no-store");
    Readable.from(file.createReadStream()).pipe(res);
  } catch (error) {
    req.log.error({ err: error }, "Failed to serve application document");
    errorMessage(res, 404, "Document not found.");
  }
});

export default router;