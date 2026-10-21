const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const {
  copyReferencedAssetFiles,
  isWithinDirectory,
  parseBundleAssetReferences,
  rewriteBundleAssetLocations,
  validatePlatformAssetMetadata,
} = require("./asset-pipeline");
const {
  createStagingDirectory,
  promoteStagedBuild,
  restorePreviousBuildIfMissing,
} = require("./build-transaction");

const projectRoot = path.resolve(__dirname, "..");
const staticBuildDirectory = path.resolve(
  process.env.STATIC_BUILD_DIR || path.join(projectRoot, "static-build"),
);
const platforms = ["ios", "android"];
const activeChildren = new Set();
let interruptedBy = null;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeBasePath(value) {
  const input = typeof value === "string" ? value.trim() : "/";
  if (!input || input === "/") return "";
  if (!input.startsWith("/") || input.includes("?") || input.includes("#")) {
    throw new Error(`Invalid BASE_PATH: ${input}`);
  }
  const segments = input.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Invalid BASE_PATH: ${input}`);
  }
  return `/${segments.join("/")}`;
}

function currentSourceCommit() {
  const result = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const commit = result.status === 0 ? result.stdout.trim() : "";
  if (!/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error(
      "Unable to determine the source Git commit. Build from a committed checkout so release.json can identify this artifact.",
    );
  }
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (status.status !== 0) {
    throw new Error("Unable to determine whether the release source tree is clean.");
  }
  const worktreeChanges = status.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((entry) => !entry.startsWith("?? attached_assets/"));
  return { commit: commit.toLowerCase(), dirty: worktreeChanges.length > 0 };
}

function writeReleaseMetadata(stagingDirectory, timestamp) {
  const source = currentSourceCommit();
  const release = {
    sourceCommit: source.commit,
    sourceDirty: source.dirty,
    buildTimestamp: timestamp,
    builtAt: new Date(Number(timestamp)).toISOString(),
  };
  fs.writeFileSync(
    path.join(stagingDirectory, "release.json"),
    `${JSON.stringify(release, null, 2)}\n`,
  );
}

function parsePublicHost(value, description) {
  let parsed;
  try {
    parsed = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw new Error(`${description} is not a valid host: ${value}`);
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${description} must be a host-only URL: ${value}`);
  }
  return `https://${parsed.host}`;
}

function isDevelopmentHostname(hostname) {
  const host = hostname.toLowerCase();
  return (
    host.endsWith(".replit.dev") ||
    host === "replit.dev" ||
    /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\])$/i.test(host)
  );
}

function getConfiguredAppOrigin(config) {
  const extra = config?.extra || {};
  const candidates = [
    extra.legal?.privacyPolicyUrl,
    extra.legal?.termsOfServiceUrl,
    ...Object.values(extra.legalUrls || {}),
  ].filter((value) => typeof value === "string" && value.trim());
  if (candidates.length === 0) {
    throw new Error(
      "Resolved Expo configuration has no public legal URL to identify the app host.",
    );
  }

  const origins = new Set();
  for (const value of candidates) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`Configured public URL is invalid: ${value}`);
    }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error(`Configured public URL is not a valid web URL: ${value}`);
    }
    origins.add(parsed.origin);
  }
  if (origins.size !== 1) {
    throw new Error(
      `Resolved Expo configuration has inconsistent public URL hosts: ${[...origins].join(", ")}`,
    );
  }
  const origin = origins.values().next().value;
  if (isDevelopmentHostname(new URL(origin).hostname)) {
    throw new Error(
      "Resolved Expo configuration public URLs point to a development or loopback host.",
    );
  }
  return origin;
}

function getDeploymentBaseUrl(config, environment = process.env) {
  const explicitUrl = environment.STATIC_PUBLIC_URL;
  if (typeof explicitUrl === "string" && explicitUrl.trim()) {
    const parsed = new URL(parsePublicHost(explicitUrl.trim(), "STATIC_PUBLIC_URL"));
    if (isDevelopmentHostname(parsed.hostname)) {
      throw new Error("STATIC_PUBLIC_URL must not use a development or loopback host.");
    }
    return parsed.origin;
  }

  const configuredOrigin = getConfiguredAppOrigin(config);
  const injectedDomain = environment.EXPO_PUBLIC_DOMAIN;
  if (typeof injectedDomain === "string" && injectedDomain.trim()) {
    const injectedUrl = new URL(parsePublicHost(injectedDomain.trim(), "EXPO_PUBLIC_DOMAIN"));
    if (!isDevelopmentHostname(injectedUrl.hostname)) return injectedUrl.origin;
  }

  return configuredOrigin;
}

function makeBuildEnvironment(baseUrl, environment = process.env) {
  const host = new URL(baseUrl).host;
  let apiUrl = environment.EXPO_PUBLIC_API_URL || baseUrl;
  if (environment.EXPO_PUBLIC_API_URL) {
    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(environment.EXPO_PUBLIC_API_URL);
    } catch {
      throw new Error("EXPO_PUBLIC_API_URL must be an absolute HTTPS URL.");
    }
    if (
      parsedApiUrl.protocol !== "https:" ||
      parsedApiUrl.username ||
      parsedApiUrl.password ||
      isDevelopmentHostname(parsedApiUrl.hostname)
    ) {
      throw new Error(
        "EXPO_PUBLIC_API_URL must use a public HTTPS host, not a development or loopback host.",
      );
    }
    apiUrl = parsedApiUrl.toString();
  }
  return {
    ...environment,
    CI: "1",
    EXPO_NO_INTERACTIVE: "1",
    EXPO_PUBLIC_DOMAIN: host,
    EXPO_PUBLIC_REPL_ID: environment.REPL_ID || environment.EXPO_PUBLIC_REPL_ID || "",
    EXPO_PUBLIC_API_URL: apiUrl,
    REACT_NATIVE_PACKAGER_HOSTNAME: new URL(baseUrl).hostname,
  };
}

function readResolvedExpoConfig(environment) {
  const result = spawnSync("pnpm", ["exec", "expo", "config", "--json"], {
    cwd: projectRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Could not resolve Expo app configuration: ${(result.stderr || result.stdout || "").trim()}`,
    );
  }

  let config;
  try {
    config = JSON.parse(result.stdout);
  } catch {
    throw new Error("Expo config --json did not return valid JSON.");
  }
  if (!config || typeof config !== "object" || !config.sdkVersion) {
    throw new Error("Resolved Expo configuration is missing sdkVersion.");
  }
  return config;
}

function startTrackedChild(command, args, environment, label) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  });
  child.buildLabel = label;
  activeChildren.add(child);
  child.once("error", (error) => {
    child.spawnError = error;
    activeChildren.delete(child);
  });
  child.once("exit", (code, signal) => {
    child.exitResult = { code, signal };
    activeChildren.delete(child);
  });
  return child;
}

function waitForChildExit(child) {
  if (child.spawnError) return Promise.reject(child.spawnError);
  if (child.exitResult) return Promise.resolve(child.exitResult);
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

function assertNotInterrupted() {
  if (interruptedBy) {
    throw new Error(`Build interrupted by ${interruptedBy}.`);
  }
}

async function runExpoExport(exportDirectory, environment) {
  fs.mkdirSync(exportDirectory, { recursive: true });
  const child = startTrackedChild(
    "pnpm",
    [
      "exec",
      "expo",
      "export",
      "--platform",
      "ios",
      "--platform",
      "android",
      "--no-bytecode",
      "--dump-assetmap",
      "--clear",
      "--max-workers",
      "2",
      "--output-dir",
      exportDirectory,
    ],
    environment,
    "Expo export",
  );
  const { code, signal } = await waitForChildExit(child);
  assertNotInterrupted();
  if (code !== 0) {
    throw new Error(
      `Expo export failed${signal ? ` after ${signal}` : ` with exit code ${code}`}.`,
    );
  }
}

async function runExpoWebExport(exportDirectory, environment) {
  fs.mkdirSync(exportDirectory, { recursive: true });
  const basePath = normalizeBasePath(environment.BASE_PATH || "/");
  const appBasePath = `${basePath}/app`.replace(/^\/+/, "");
  const webEnvironment = {
    ...environment,
    NODE_ENV: "production",
    EXPO_BASE_URL: appBasePath,
    EXPO_PUBLIC_APP_BASE_URL: appBasePath,
  };
  const child = startTrackedChild(
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
      exportDirectory,
    ],
    webEnvironment,
    "Expo web export",
  );
  const { code, signal } = await waitForChildExit(child);
  assertNotInterrupted();
  if (code !== 0) {
    throw new Error(
      `Expo web export failed${signal ? ` after ${signal}` : ` with exit code ${code}`}.`,
    );
  }
}

function copyExpoWebExport(webExportDirectory, stagingDirectory) {
  if (!fs.existsSync(path.join(webExportDirectory, "index.html"))) {
    throw new Error("Expo web export did not produce index.html.");
  }

  const copyTree = (source, destination) => {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (entry.name === "metadata.json" || entry.name === "assetmap.json") continue;
      const sourcePath = path.join(source, entry.name);
      const destinationPath = path.join(destination, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) copyTree(sourcePath, destinationPath);
      else if (entry.isFile()) fs.copyFileSync(sourcePath, destinationPath);
    }
  };
  copyTree(webExportDirectory, stagingDirectory);

  const indexPath = path.join(stagingDirectory, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  if (!/<\/head>/i.test(html)) throw new Error("Expo web index.html is missing </head>.");
  const tags = [
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<meta name="theme-color" content="#191F29">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="Tradify">',
    '<link rel="apple-touch-icon" href="/icons/tradify-192.png">',
    '<script defer src="/pwa-install.js"></script>',
    '<script>if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {}));</script>',
  ].join("\n");
  fs.writeFileSync(indexPath, html.replace(/<\/head>/i, `${tags}\n</head>`));
}

function copyPwaFiles(stagingDirectory) {
  const sourceDirectory = path.join(projectRoot, "server", "pwa");
  const files = [
    ["manifest.webmanifest", "manifest.webmanifest"],
    ["service-worker.js", "service-worker.js"],
    ["pwa-install.js", "pwa-install.js"],
    ["tradify-192.png", "icons/tradify-192.png"],
    ["tradify-512.png", "icons/tradify-512.png"],
  ];
  for (const [sourceName, destinationName] of files) {
    const sourcePath = path.join(sourceDirectory, sourceName);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Required PWA build file is missing: ${sourcePath}`);
    }
    const destinationPath = path.join(stagingDirectory, destinationName);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function readJsonFile(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${description}: ${error.message}`);
  }
}

function readExpoExport(exportDirectory) {
  const metadataPath = path.join(exportDirectory, "metadata.json");
  const assetMapPath = path.join(exportDirectory, "assetmap.json");
  const metadata = readJsonFile(metadataPath, "Expo export metadata");
  const assetMap = readJsonFile(assetMapPath, "Expo asset map");

  if (!metadata.fileMetadata || !assetMap || typeof assetMap !== "object") {
    throw new Error("Expo export did not emit complete metadata and asset map files.");
  }

  const bundles = new Map();
  const referencesByPlatform = {};
  for (const platform of platforms) {
    const platformMetadata = metadata.fileMetadata[platform];
    if (!platformMetadata || typeof platformMetadata.bundle !== "string") {
      throw new Error(`Expo export did not emit a ${platform} JavaScript bundle.`);
    }

    const bundlePath = path.resolve(exportDirectory, platformMetadata.bundle);
    if (
      !isWithinDirectory(exportDirectory, bundlePath) ||
      !fs.existsSync(bundlePath) ||
      !fs.statSync(bundlePath).isFile()
    ) {
      throw new Error(
        `${platform} bundle is missing or outside the Expo export directory: ${platformMetadata.bundle}`,
      );
    }

    const bundle = fs.readFileSync(bundlePath, "utf8");
    if (!bundle.trim()) throw new Error(`${platform} JavaScript bundle is empty.`);
    const references = parseBundleAssetReferences(bundle, platform, assetMap);
    validatePlatformAssetMetadata(metadata, references, platform);
    bundles.set(platform, bundle);
    referencesByPlatform[platform] = references;
  }

  const groupHashes = new Set(
    Object.values(referencesByPlatform).flatMap((references) =>
      references.map((reference) => reference.hash),
    ),
  );
  if (groupHashes.size === 0) {
    throw new Error("Expo export did not emit any referenced local assets.");
  }

  return { metadata, assetMap, bundles, referencesByPlatform, groupHashes };
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitForMetro(port, child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    assertNotInterrupted();
    if (child.spawnError) throw child.spawnError;
    if (child.exitResult) {
      throw new Error(
        `Expo manifest server exited before becoming ready (code ${child.exitResult.code ?? "none"}).`,
      );
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`, {
        signal: AbortSignal.timeout(1000),
      });
      const body = await response.text();
      if (response.ok && body.includes("packager-status:running")) return;
    } catch {
      // Metro can take several seconds to bind the selected free port.
    }
    await delay(300);
  }
  throw new Error("Expo manifest server did not become ready within 120 seconds.");
}

async function startMetro(environment) {
  const port = await getFreePort();
  const child = startTrackedChild(
    "pnpm",
    ["exec", "expo", "start", "--no-dev", "--minify", "--localhost", "--port", String(port)],
    environment,
    "Expo manifest server",
  );
  await waitForMetro(port, child);
  return { child, port };
}

async function stopChild(child) {
  if (!child || child.exitResult || child.spawnError) return;
  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }
  const exited = await Promise.race([
    waitForChildExit(child).then(
      () => true,
      () => true,
    ),
    delay(4000).then(() => false),
  ]);
  if (exited) return;
  try {
    child.kill("SIGKILL");
  } catch {
    return;
  }
  await Promise.race([waitForChildExit(child).catch(() => undefined), delay(2000)]);
}

async function fetchManifest(port, platform) {
  const url = new URL(`http://127.0.0.1:${port}/`);
  url.searchParams.set("platform", platform);
  url.searchParams.set("dev", "false");
  url.searchParams.set("minify", "true");
  let lastError;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/expo+json, application/json",
          "expo-platform": platform,
          "expo-protocol-version": "1",
          "expo-sfv-version": "0",
        },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        throw new Error(`Manifest request returned HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      await delay(300);
    }
  }

  throw new Error(
    `Could not retrieve the ${platform} Expo manifest: ${lastError?.message || "unknown error"}`,
  );
}

function copyAppIcon(stagingDirectory, config) {
  if (typeof config.icon !== "string" || !config.icon) {
    throw new Error("Resolved Expo configuration does not declare an app icon.");
  }
  const sourcePath = path.resolve(projectRoot, config.icon);
  if (
    !isWithinDirectory(projectRoot, sourcePath) ||
    !fs.existsSync(sourcePath) ||
    !fs.statSync(sourcePath).isFile()
  ) {
    throw new Error(`Configured app icon is missing or outside the app: ${config.icon}`);
  }

  const destinationPath = path.join(stagingDirectory, "icon.png");
  fs.copyFileSync(sourcePath, destinationPath);
  if (fs.statSync(destinationPath).size === 0) {
    throw new Error("The copied app icon is empty.");
  }
  return destinationPath;
}

function copyLocalManifestAssets(stagingDirectory, config) {
  const splashPlugin = findPlugin(config.plugins, "expo-splash-screen");
  const imagePath = splashPlugin?.[1]?.image;
  if (typeof imagePath !== "string" || !imagePath) return new Set();

  // Remote and data URLs are not local static-build files.
  if (/^[a-z][a-z\d+.-]*:/i.test(imagePath) || imagePath.startsWith("//")) {
    return new Set();
  }

  const sourcePath = path.resolve(projectRoot, imagePath);
  if (
    !isWithinDirectory(projectRoot, sourcePath) ||
    !fs.existsSync(sourcePath) ||
    !fs.statSync(sourcePath).isFile()
  ) {
    throw new Error(`Configured splash image is missing or outside the app: ${imagePath}`);
  }

  const relativePath = path.relative(projectRoot, sourcePath);
  const destinationPath = path.resolve(stagingDirectory, ...relativePath.split(path.sep));
  if (!isWithinDirectory(stagingDirectory, destinationPath)) {
    throw new Error(`Splash image destination escaped staging: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);

  return new Set([relativePath.split(path.sep).join("/")]);
}

function getExpectedRuntimeVersion(config) {
  if (typeof config.runtimeVersion === "string") return config.runtimeVersion;
  if (
    config.runtimeVersion &&
    typeof config.runtimeVersion === "object" &&
    config.runtimeVersion.policy === "sdkVersion"
  ) {
    return `exposdk:${config.sdkVersion}`;
  }
  return `exposdk:${config.sdkVersion}`;
}

function findPlugin(plugins, name) {
  if (!Array.isArray(plugins)) return null;
  return plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === name) || null;
}

function validateManifestConfiguration(manifest, platform, config) {
  const expoClient = manifest?.extra?.expoClient;
  if (!expoClient) {
    throw new Error(`${platform} manifest is missing extra.expoClient.`);
  }

  const expected = {
    name: config.name,
    slug: config.slug,
    version: config.version,
    scheme: config.scheme,
    userInterfaceStyle: config.userInterfaceStyle,
  };
  for (const [key, value] of Object.entries(expected)) {
    const actual = expoClient[key];
    const matchesScheme =
      key === "scheme" && Array.isArray(actual) ? actual.includes(value) : actual === value;
    if (!matchesScheme) {
      throw new Error(
        `${platform} manifest ${key} is ${JSON.stringify(actual)}; expected ${JSON.stringify(value)}.`,
      );
    }
  }

  const expectedIdentifier =
    platform === "ios" ? config.ios?.bundleIdentifier : config.android?.package;
  const actualIdentifier =
    platform === "ios" ? expoClient.ios?.bundleIdentifier : expoClient.android?.package;
  if (actualIdentifier !== expectedIdentifier) {
    throw new Error(
      `${platform} manifest app identifier is ${JSON.stringify(actualIdentifier)}; expected ${JSON.stringify(expectedIdentifier)}.`,
    );
  }

  const expectedSplash = findPlugin(config.plugins, "expo-splash-screen");
  const actualSplash = findPlugin(expoClient.plugins, "expo-splash-screen");
  const expectedSplashOptions = expectedSplash?.[1] || {};
  const actualSplashOptions = actualSplash?.[1] || {};
  for (const key of ["backgroundColor", "resizeMode", "image"]) {
    if (actualSplashOptions[key] !== expectedSplashOptions[key]) {
      throw new Error(
        `${platform} manifest splash ${key} is ${JSON.stringify(actualSplashOptions[key])}; expected ${JSON.stringify(expectedSplashOptions[key])}.`,
      );
    }
  }

  const expectedRuntime = getExpectedRuntimeVersion(config);
  if (manifest.runtimeVersion !== expectedRuntime) {
    throw new Error(
      `${platform} manifest runtimeVersion is ${JSON.stringify(manifest.runtimeVersion)}; expected ${JSON.stringify(expectedRuntime)}.`,
    );
  }
}

function assertProductionUrl(value, baseUrl, basePath, description) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${description} is not an absolute URL: ${value}`);
  }
  const expectedOrigin = new URL(baseUrl).origin;
  if (url.origin !== expectedOrigin || isDevelopmentHostname(url.hostname)) {
    throw new Error(`${description} does not use the configured public host: ${value}`);
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (
    segments.some((segment) => segment === "." || segment === "..") ||
    (basePath && url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`))
  ) {
    throw new Error(`${description} contains an invalid or out-of-root path: ${value}`);
  }
  return url;
}

function assertNoLoopbackReferences(manifest, platform) {
  const serialized = JSON.stringify(manifest);
  const loopbackUrl =
    /(?:https?|wss?):\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\])(?::\d+)?/i.exec(serialized);
  if (loopbackUrl) {
    throw new Error(`${platform} manifest still contains a loopback URL: ${loopbackUrl[0]}`);
  }
}

function assertNoDevelopmentHostReferences(manifest, platform) {
  const developmentHost = /\b[a-z0-9.-]+\.replit\.dev(?::\d+)?\b/i.exec(JSON.stringify(manifest));
  if (developmentHost) {
    throw new Error(
      `${platform} manifest still contains a development host: ${developmentHost[0]}`,
    );
  }
}

function validateManifestHosts(manifest, platform, baseUrl) {
  const expectedHost = new URL(baseUrl).host;
  const expoClient = manifest?.extra?.expoClient;
  if (expoClient?.hostUri !== expectedHost) {
    throw new Error(
      `${platform} manifest extra.expoClient.hostUri is ${JSON.stringify(expoClient?.hostUri)}; expected ${JSON.stringify(expectedHost)}.`,
    );
  }

  const expoGo = manifest?.extra?.expoGo;
  for (const key of ["hostUri", "debuggerHost"]) {
    if (expoGo?.[key] !== undefined && expoGo[key] !== expectedHost) {
      throw new Error(
        `${platform} manifest extra.expoGo.${key} is ${JSON.stringify(expoGo[key])}; expected ${JSON.stringify(expectedHost)}.`,
      );
    }
  }
}

function updateManifest(manifest, platform, { baseUrl, basePath, timestamp, iconUrl, config }) {
  validateManifestConfiguration(manifest, platform, config);
  if (!manifest.launchAsset || typeof manifest.launchAsset !== "object") {
    throw new Error(`${platform} manifest is missing launchAsset metadata.`);
  }
  const bundleUrl = `${baseUrl}${basePath}/${timestamp}/_expo/static/js/${platform}/bundle.js`;
  assertProductionUrl(bundleUrl, baseUrl, basePath, `${platform} bundle URL`);
  assertProductionUrl(iconUrl, baseUrl, basePath, `${platform} app icon URL`);

  manifest.launchAsset.url = bundleUrl;
  manifest.launchAsset.key = `bundle-${timestamp}-${platform}`;
  manifest.extra.expoClient.iconUrl = iconUrl;

  const publicHost = new URL(baseUrl).host;
  manifest.extra.expoClient.hostUri = publicHost;
  if (manifest.extra.expoClient.debuggerHost !== undefined) {
    manifest.extra.expoClient.debuggerHost = publicHost;
  }

  const expoGo = manifest.extra.expoGo;
  if (expoGo && typeof expoGo === "object") {
    expoGo.hostUri = publicHost;
    expoGo.debuggerHost = publicHost;
    if (expoGo.packagerOpts && typeof expoGo.packagerOpts === "object") {
      expoGo.packagerOpts.dev = false;
    }
  }

  assertProductionUrl(
    manifest.launchAsset.url,
    baseUrl,
    basePath,
    `${platform} manifest launchAsset.url`,
  );
  assertProductionUrl(
    manifest.extra.expoClient.iconUrl,
    baseUrl,
    basePath,
    `${platform} manifest extra.expoClient.iconUrl`,
  );
  validateManifestHosts(manifest, platform, baseUrl);
  assertNoLoopbackReferences(manifest, platform);
  assertNoDevelopmentHostReferences(manifest, platform);
  return manifest;
}

function writePlatformManifest(stagingDirectory, platform, manifest) {
  const manifestPath = path.join(stagingDirectory, platform, "manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function getRequestUrl(value, description) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${description} is not a valid URL: ${value}`);
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function assertHttpRequest(port, request) {
  const remoteUrl = getRequestUrl(request.url, request.description);
  const localUrl = new URL(`${remoteUrl.pathname}${remoteUrl.search}`, `http://127.0.0.1:${port}`);
  const response = await fetch(localUrl, {
    headers: request.headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 200) {
    const responseText = await response.text();
    throw new Error(
      `${request.description} returned HTTP ${response.status}: ${responseText.slice(0, 240)}`,
    );
  }
  const body = await response.arrayBuffer();
  if (body.byteLength === 0) {
    throw new Error(`${request.description} returned an empty response.`);
  }
  return Buffer.from(body);
}

async function assertBrowserRootRedirect(port, url, basePath) {
  const remoteUrl = getRequestUrl(url, "Browser root redirect");
  const localUrl = new URL(`${remoteUrl.pathname}${remoteUrl.search}`, `http://127.0.0.1:${port}`);
  const response = await fetch(localUrl, {
    redirect: "manual",
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(10_000),
  });
  const expectedLocation = `${basePath}/app/` || "/app/";
  if (
    response.status !== 302 ||
    response.headers.get("location") !== expectedLocation ||
    !/no-store/i.test(response.headers.get("cache-control") ?? "")
  ) {
    throw new Error(
      `Browser root must redirect to ${expectedLocation}; received HTTP ${response.status} with Location ${response.headers.get("location") ?? "(none)"}.`,
    );
  }
}

async function verifyWithProductionStaticServer({
  stagingDirectory,
  baseUrl,
  basePath,
  manifests,
  config,
  assetUrls,
  localManifestAssetPaths,
}) {
  const { createStaticServer } = require("../server/serve");
  const server = createStaticServer({
    staticRoot: stagingDirectory,
    basePath,
  });
  const port = await listen(server);
  const requests = [];

  try {
    await assertBrowserRootRedirect(port, `${baseUrl}${basePath}/`, basePath);
    for (const platform of platforms) {
      requests.push({
        url: `${baseUrl}${basePath}/manifest`,
        headers: { "expo-platform": platform },
        description: `${platform} production manifest route`,
      });
      requests.push({
        url: manifests[platform].launchAsset.url,
        description: `${platform} production JavaScript bundle`,
      });
      requests.push({
        url: manifests[platform].extra.expoClient.iconUrl,
        description: `${platform} production app icon`,
      });
    }
    requests.push(
      {
        url: `${baseUrl}${basePath}/app/`,
        headers: { accept: "text/html" },
        description: "PWA browser application shell",
      },
      { url: `${baseUrl}${basePath}/manifest.webmanifest`, description: "PWA web manifest" },
      { url: `${baseUrl}${basePath}/service-worker.js`, description: "PWA service worker" },
      { url: `${baseUrl}${basePath}/pwa-install.js`, description: "PWA install guidance" },
      { url: `${baseUrl}${basePath}/icons/tradify-192.png`, description: "PWA 192px icon" },
      { url: `${baseUrl}${basePath}/icons/tradify-512.png`, description: "PWA 512px icon" },
    );
    for (const url of assetUrls) {
      requests.push({
        url,
        description: `Expo asset ${new URL(url).pathname}`,
      });
    }
    for (const relativePath of localManifestAssetPaths) {
      const encodedPath = relativePath
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      const url = new URL(encodedPath, `${baseUrl}${basePath}/manifest`).toString();
      requests.push({
        url,
        description: `Manifest local asset ${relativePath}`,
      });
    }

    const batchSize = 16;
    for (let start = 0; start < requests.length; start += batchSize) {
      const batch = requests.slice(start, start + batchSize);
      await Promise.all(
        batch.map(async (request) => {
          const body = await assertHttpRequest(port, request);
          if (request.headers?.["expo-platform"]) {
            let servedManifest;
            try {
              servedManifest = JSON.parse(body.toString("utf8"));
            } catch {
              throw new Error(
                `${request.headers["expo-platform"]} manifest route did not return JSON.`,
              );
            }
            validateManifestConfiguration(servedManifest, request.headers["expo-platform"], config);
            validateManifestHosts(servedManifest, request.headers["expo-platform"], baseUrl);
            assertNoDevelopmentHostReferences(servedManifest, request.headers["expo-platform"]);
            if (
              servedManifest.launchAsset.url !==
              manifests[request.headers["expo-platform"]].launchAsset.url
            ) {
              throw new Error(
                `${request.headers["expo-platform"]} manifest route did not serve the staged manifest.`,
              );
            }
          }
        }),
      );
    }
  } finally {
    await closeServer(server);
  }

  return requests.length;
}

function writeBundle(stagingDirectory, timestamp, platform, bundle) {
  const relativePath = path.posix.join(timestamp, "_expo", "static", "js", platform, "bundle.js");
  const destinationPath = path.resolve(stagingDirectory, ...relativePath.split("/"));
  if (!isWithinDirectory(stagingDirectory, destinationPath)) {
    throw new Error(`${platform} bundle output escaped staging.`);
  }
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, bundle);
  if (fs.statSync(destinationPath).size === 0) {
    throw new Error(`${platform} JavaScript bundle was not written.`);
  }
}

function installSignalHandlers() {
  const onSignal = (signal) => {
    interruptedBy = signal;
    process.exitCode = signal === "SIGINT" ? 130 : 143;
    for (const child of activeChildren) {
      try {
        child.kill("SIGTERM");
      } catch {
        // The child may have exited between the set iteration and signal.
      }
    }
  };
  const onInterrupt = () => onSignal("SIGINT");
  const onTerminate = () => onSignal("SIGTERM");
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  return () => {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  };
}

async function main() {
  const removeSignalHandlers = installSignalHandlers();
  let stagingDirectory = null;
  let metroChild = null;

  try {
    const configurationEnvironment = {
      ...process.env,
      CI: "1",
      EXPO_NO_INTERACTIVE: "1",
    };
    const initialConfig = readResolvedExpoConfig(configurationEnvironment);
    const baseUrl = getDeploymentBaseUrl(initialConfig, configurationEnvironment);
    const basePath = normalizeBasePath(process.env.BASE_PATH || "/");
    const timestamp = Date.now().toString();
    const environment = makeBuildEnvironment(baseUrl);
    const config = readResolvedExpoConfig(environment);
    if (getDeploymentBaseUrl(config, environment) !== baseUrl) {
      throw new Error(
        "Resolved Expo configuration changed the configured public host during build setup.",
      );
    }

    restorePreviousBuildIfMissing(staticBuildDirectory);
    stagingDirectory = createStagingDirectory(staticBuildDirectory);
    const exportDirectory = path.join(stagingDirectory, ".expo-export");

    console.log("Generating iOS and Android Expo exports in isolated staging.");
    await runExpoExport(exportDirectory, environment);
    assertNotInterrupted();

    const expoExport = readExpoExport(exportDirectory);
    const copiedAssets = copyReferencedAssetFiles({
      exportDirectory,
      stagingDirectory,
      timestamp,
      assetMap: expoExport.assetMap,
      referencesByPlatform: expoExport.referencesByPlatform,
      baseUrl,
      basePath,
    });

    for (const platform of platforms) {
      const rewrittenBundle = rewriteBundleAssetLocations(
        expoExport.bundles.get(platform),
        platform,
        expoExport.referencesByPlatform[platform],
        baseUrl,
        basePath,
        timestamp,
      );
      writeBundle(stagingDirectory, timestamp, platform, rewrittenBundle);
    }

    const iconPath = copyAppIcon(stagingDirectory, config);
    const localManifestAssetPaths = copyLocalManifestAssets(stagingDirectory, config);
    const iconUrl = `${baseUrl}${basePath}/icon.png`;
    assertProductionUrl(iconUrl, baseUrl, basePath, "App icon URL");
    if (!fs.existsSync(iconPath)) throw new Error("Staged app icon is missing.");

    console.log("Starting an isolated Expo server to generate platform manifests.");
    const metro = await startMetro(environment);
    metroChild = metro.child;
    const manifests = {};
    try {
      for (const platform of platforms) {
        manifests[platform] = await fetchManifest(metro.port, platform);
        updateManifest(manifests[platform], platform, {
          baseUrl,
          basePath,
          timestamp,
          iconUrl,
          config,
        });
        writePlatformManifest(stagingDirectory, platform, manifests[platform]);
      }
    } finally {
      await stopChild(metroChild);
      metroChild = null;
    }

    const webExportDirectory = path.join(stagingDirectory, ".expo-web-export");
    console.log("Generating the browser application bundle.");
    await runExpoWebExport(webExportDirectory, environment);
    copyExpoWebExport(webExportDirectory, stagingDirectory);
    fs.rmSync(webExportDirectory, { recursive: true, force: true });
    copyPwaFiles(stagingDirectory);
    writeReleaseMetadata(stagingDirectory, timestamp);

    assertNotInterrupted();
    fs.rmSync(exportDirectory, { recursive: true, force: true });

    const httpRequests = await verifyWithProductionStaticServer({
      stagingDirectory,
      baseUrl,
      basePath,
      manifests,
      config,
      assetUrls: copiedAssets.emittedAssetUrls,
      localManifestAssetPaths,
    });
    assertNotInterrupted();

    const promotion = promoteStagedBuild(stagingDirectory, staticBuildDirectory);
    stagingDirectory = null;
    if (promotion.backupCleanupError) {
      console.error(
        `The new build is active, but the previous build backup could not be removed: ${promotion.backupPath}`,
      );
    }

    console.log(
      `Build verified and promoted. Referenced groups: ${expoExport.groupHashes.size}; copied asset variants: ${copiedAssets.copiedFiles.size}; HTTP requests returned 200: ${httpRequests}.`,
    );
  } finally {
    if (metroChild) await stopChild(metroChild);
    if (stagingDirectory && fs.existsSync(stagingDirectory)) {
      fs.rmSync(stagingDirectory, { recursive: true, force: true });
    }
    removeSignalHandlers();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Static Expo build failed: ${error.stack || error.message}`);
    process.exitCode = process.exitCode || 1;
  });
}

module.exports = {
  assertProductionUrl,
  getDeploymentBaseUrl,
  getExpectedRuntimeVersion,
  makeBuildEnvironment,
  main,
  normalizeBasePath,
  copyLocalManifestAssets,
  readResolvedExpoConfig,
  assertNoLoopbackReferences,
  assertNoDevelopmentHostReferences,
  updateManifest,
  copyExpoWebExport,
  copyPwaFiles,
  runExpoWebExport,
  validateManifestConfiguration,
  verifyWithProductionStaticServer,
};
