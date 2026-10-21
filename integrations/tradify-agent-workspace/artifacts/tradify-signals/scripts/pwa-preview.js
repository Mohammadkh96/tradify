const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { copyExpoWebExport, copyPwaFiles, normalizeBasePath } = require("./build");
const { createStaticServer } = require("../server/serve");

const projectRoot = path.resolve(__dirname, "..");
const developmentHost = process.env.REPLIT_DEV_DOMAIN;

function getDevelopmentOrigin(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("REPLIT_DEV_DOMAIN is required for the isolated PWA preview.");
  }
  const host = value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!/^[a-z0-9.-]+\.replit\.dev$/i.test(host)) {
    throw new Error("The PWA preview API must use this project's .replit.dev development host.");
  }
  return { host, origin: `https://${host}` };
}

function exportWeb(outputDirectory, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "expo",
        "export",
        "--platform",
        "web",
        "--no-bytecode",
        "--max-workers",
        "2",
        "--output-dir",
        outputDirectory,
      ],
      { cwd: projectRoot, env: environment, stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`Expo web preview export failed${signal ? ` after ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

async function main() {
  const { host, origin } = getDevelopmentOrigin(developmentHost);
  const previewDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tradify-pwa-preview-"));
  const webExportDirectory = path.join(previewDirectory, "web-export");
  const staticDirectory = path.join(previewDirectory, "site");
  const environment = {
    ...process.env,
    CI: "1",
    EXPO_NO_INTERACTIVE: "1",
    NODE_ENV: "production",
    EXPO_PUBLIC_APP_BASE_URL: `${normalizeBasePath(process.env.BASE_PATH || "/")}/app`.replace(
      /^\/+/,
      "",
    ),
    EXPO_PUBLIC_API_URL: origin,
    EXPO_PUBLIC_DOMAIN: host,
    EXPO_PUBLIC_REPL_ID: process.env.REPL_ID || "",
    EXPO_BASE_URL: `${normalizeBasePath(process.env.BASE_PATH || "/")}/app`.replace(/^\/+/, ""),
    REACT_NATIVE_PACKAGER_HOSTNAME: host,
  };

  try {
    console.log(`Building the PWA preview against the isolated development API at ${origin}.`);
    await exportWeb(webExportDirectory, environment);
    copyExpoWebExport(webExportDirectory, staticDirectory);
    copyPwaFiles(staticDirectory);
    fs.rmSync(webExportDirectory, { recursive: true, force: true });

    const server = createStaticServer({
      staticRoot: staticDirectory,
      basePath: process.env.BASE_PATH || "/",
    });
    const port = Number.parseInt(process.env.PORT || "3000", 10);
    server.once("close", () => fs.rmSync(previewDirectory, { recursive: true, force: true }));
    server.listen(port, "0.0.0.0", () => {
      console.log(`Serving the Tradify Signals PWA preview on port ${port}; API: ${origin}/api.`);
    });
    const shutdown = () => server.close(() => process.exit(0));
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    fs.rmSync(previewDirectory, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(`PWA preview failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
