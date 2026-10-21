/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with two special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → redirect to the customer PWA
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { restorePreviousBuildIfMissing } = require("../scripts/build-transaction");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");

function indexStaticFiles(directory, staticRoot, fileIndex) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.resolve(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      indexStaticFiles(filePath, staticRoot, fileIndex);
    } else if (entry.isFile()) {
      const relativePath = path.relative(staticRoot, filePath).split(path.sep).join("/");
      // Load the immutable build asset during startup so request data is never
      // used as a filesystem path later in the request lifecycle.
      fileIndex.set(`/${relativePath}`, fs.readFileSync(filePath));
    }
  }
}

const PRIVACY_POLICY_TEMPLATE_PATH = path.resolve(__dirname, "templates", "privacy-policy.html");
const TERMS_OF_SERVICE_TEMPLATE_PATH = path.resolve(
  __dirname,
  "templates",
  "terms-of-service.html",
);
const RISK_DISCLAIMER_TEMPLATE_PATH = path.resolve(
  __dirname,
  "templates",
  "risk-disclaimer.html",
);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function serveManifest(platform, res, fileIndex) {
  const manifestDirectory = platform === "ios" ? "ios" : platform === "android" ? "android" : null;
  if (!manifestDirectory) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Unsupported platform" }));
    return;
  }
  const manifest = fileIndex.get(`/${manifestDirectory}/manifest.json`);

  if (!manifest) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Manifest not found for platform: ${platform}` }));
    return;
  }

  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
    "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    pragma: "no-cache",
    expires: "0",
    vary: "expo-platform",
  });
  res.end(manifest);
}

function serveLandingPage(res, landingPageTemplate, basePath) {
  const appBasePath = `${basePath}/app`;
  const html = landingPageTemplate
    .replaceAll("SITE_BASE_PATH_PLACEHOLDER", basePath)
    .replaceAll("APP_BASE_PATH_PLACEHOLDER", appBasePath);

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    pragma: "no-cache",
    expires: "0",
    vary: "expo-platform",
  });
  res.end(html);
}

function serveLegalPage(res, templatePath, basePath) {
  const html = fs
    .readFileSync(templatePath, "utf-8")
    .replaceAll("SITE_BASE_PATH_PLACEHOLDER", basePath);
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=300",
  });
  res.end(html);
}

function acceptsEncoding(header, encoding) {
  if (typeof header !== "string") return false;
  const weights = new Map(
    header.split(",").map((part) => {
      const [name, ...params] = part.trim().toLowerCase().split(";");
      const quality = params.find((value) => value.trim().startsWith("q="));
      return [name, quality ? Number(quality.trim().slice(2)) : 1];
    }),
  );
  return (weights.get(encoding) ?? weights.get("*") ?? 0) > 0;
}

function createCompressedIndex(fileIndex) {
  const compressed = new Map();
  for (const [filePath, content] of fileIndex) {
    if (
      content.length < 1024 ||
      !/\.(?:js|css|json|html|svg|txt|xml|ttf|otf)$/i.test(filePath)
    ) {
      continue;
    }
    compressed.set(filePath, {
      br: zlib.brotliCompressSync(content),
      gzip: zlib.gzipSync(content, { level: zlib.constants.Z_BEST_SPEED }),
    });
  }
  return compressed;
}

function serveStaticFile(urlPath, req, res, fileIndex, compressedIndex) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }
  if (decodedPath.includes("\0") || decodedPath.includes("\\")) {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }

  const relativePath = decodedPath.replace(/^\/+/, "");
  if (relativePath.split("/").includes("..")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  let fileKey = `/${path.posix.normalize(relativePath)}`;
  let content = fileIndex.get(fileKey);

  if (
    !content &&
    fileIndex.has("/index.html") &&
    req.method === "GET" &&
    (req.headers.accept || "").includes("text/html") &&
    !urlPath.startsWith("/api/") &&
    urlPath !== "/api" &&
    !urlPath.startsWith("/tradify-admin/")
  ) {
    fileKey = "/index.html";
    content = fileIndex.get(fileKey);
  }

  if (!content) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.posix.extname(fileKey).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const compressed = compressedIndex.get(fileKey);
  const encoding = compressed && acceptsEncoding(req.headers["accept-encoding"], "br")
    ? "br"
    : compressed && acceptsEncoding(req.headers["accept-encoding"], "gzip")
      ? "gzip"
      : undefined;
  const assetIsImmutable = fileKey.includes("/_expo/static/");
  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": assetIsImmutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
    vary: "Accept-Encoding",
    ...(encoding ? { "content-encoding": encoding } : {}),
  });
  res.end(encoding ? compressed[encoding] : content);
}

function normalizeBasePath(value) {
  const input = typeof value === "string" ? value.trim() : "/";
  if (!input || input === "/") return "";
  if (!input.startsWith("/") || input.includes("?") || input.includes("#")) {
    throw new Error(`Invalid static-server base path: ${input}`);
  }
  const segments = input.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Invalid static-server base path: ${input}`);
  }
  return `/${segments.join("/")}`;
}

function createStaticServer(options = {}) {
  const staticRoot = path.resolve(
    options.staticRoot || process.env.STATIC_BUILD_DIR || STATIC_ROOT,
  );
  restorePreviousBuildIfMissing(staticRoot);
  const fileIndex = new Map();
  indexStaticFiles(staticRoot, staticRoot, fileIndex);
  const compressedIndex = createCompressedIndex(fileIndex);
  const basePath = normalizeBasePath(
    options.basePath === undefined ? process.env.BASE_PATH || "/" : options.basePath,
  );
  const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  return http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    } catch {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }

    let pathname = url.pathname;
    if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
      pathname = pathname.slice(basePath.length) || "/";
    }

    if (pathname === "/status" && req.method === "GET") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end("packager-status:running");
      return;
    }

    if (pathname === "/" || pathname === "/manifest") {
      const platform = req.headers["expo-platform"];
      if (platform === "ios" || platform === "android") {
        return serveManifest(platform, res, fileIndex);
      }

      if (pathname === "/") {
        res.writeHead(302, {
          location: `${basePath}/app/` || "/app/",
          "cache-control": "no-store",
          vary: "expo-platform",
        });
        res.end();
        return;
      }
    }

    if (pathname === "/open-in-expo" || pathname === "/open-in-expo/") {
      return serveLandingPage(res, landingPageTemplate, basePath);
    }

    if (pathname === "/privacy-policy" || pathname === "/privacy-policy/") {
      return serveLegalPage(res, PRIVACY_POLICY_TEMPLATE_PATH, basePath);
    }

    if (pathname === "/terms-of-service" || pathname === "/terms-of-service/") {
      return serveLegalPage(res, TERMS_OF_SERVICE_TEMPLATE_PATH, basePath);
    }

    if (pathname === "/risk-disclaimer" || pathname === "/risk-disclaimer/") {
      return serveLegalPage(res, RISK_DISCLAIMER_TEMPLATE_PATH, basePath);
    }

    serveStaticFile(pathname, req, res, fileIndex, compressedIndex);
  });
}

if (require.main === module) {
  const server = createStaticServer();
  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Serving static Expo build on port ${port}`);
  });
}

module.exports = { createStaticServer, indexStaticFiles, acceptsEncoding, createCompressedIndex };
