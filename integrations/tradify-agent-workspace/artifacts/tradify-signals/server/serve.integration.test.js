const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");
const { createStaticServer } = require("./serve");

test("production static server serves platform manifests and artifact files from a temporary root", async (context) => {
  const staticRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tradify-static-server-"));
  context.after(() => fs.rmSync(staticRoot, { recursive: true, force: true }));

  const icon = Buffer.from("icon");
  const bundle = Buffer.from("const app = () => true;\n".repeat(1024));
  const asset = Buffer.from("asset");
  fs.mkdirSync(path.join(staticRoot, "ios"), { recursive: true });
  fs.mkdirSync(path.join(staticRoot, "android"), { recursive: true });
  fs.mkdirSync(path.join(staticRoot, "release", "_expo", "static", "js", "ios"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(staticRoot, "release", "_expo", "static", "assets"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(staticRoot, "icon.png"), icon);
  fs.writeFileSync(
    path.join(staticRoot, "release.json"),
    JSON.stringify({
      sourceCommit: "a".repeat(40),
      sourceDirty: false,
      buildTimestamp: "1791975390783",
      builtAt: "2026-10-14T10:56:30.783Z",
    }),
  );
  fs.writeFileSync(
    path.join(staticRoot, "release", "_expo", "static", "js", "ios", "bundle.js"),
    bundle,
  );
  fs.writeFileSync(
    path.join(staticRoot, "release", "_expo", "static", "assets", "sample.png"),
    asset,
  );
  for (const platform of ["ios", "android"]) {
    fs.writeFileSync(
      path.join(staticRoot, platform, "manifest.json"),
      JSON.stringify({
        platform,
        launchAsset: { key: `bundle-test-${platform}` },
      }),
    );
  }

  const server = createStaticServer({
    staticRoot,
    basePath: "/signals",
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const baseUrl = `http://127.0.0.1:${server.address().port}/signals`;
  for (const platform of ["ios", "android"]) {
    for (const path of ["/", "/manifest"]) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { "expo-platform": platform },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        platform,
        launchAsset: { key: `bundle-test-${platform}` },
      });
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal(response.headers.get("vary"), "expo-platform");
    }
  }

  const customerHome = await fetch(`${baseUrl}/`, { redirect: "manual" });
  assert.equal(customerHome.status, 302);
  assert.equal(customerHome.headers.get("location"), "/signals/app/");
  assert.match(customerHome.headers.get("cache-control"), /no-store/);
  assert.equal(customerHome.headers.get("vary"), "expo-platform");

  const landingPage = await fetch(`${baseUrl}/open-in-expo`);
  assert.equal(landingPage.status, 200);
  assert.match(landingPage.headers.get("content-type"), /text\/html/);
  assert.match(landingPage.headers.get("cache-control"), /no-store/);
  assert.equal(landingPage.headers.get("vary"), "expo-platform");
  const landingHtml = await landingPage.text();
  assert.match(landingHtml, /Less noise\.<br \/>A <em>clearer plan\.<\/em>/);
  assert.match(landingHtml, /href="\/signals\/app\/auth\?mode=signin"/);
  assert.match(landingHtml, /href="\/signals\/app\/register"/);
  assert.match(landingHtml, /href="\/signals\/terms-of-service"/);
  assert.match(landingHtml, /href="\/signals\/privacy-policy"/);
  assert.match(landingHtml, /href="\/signals\/risk-disclaimer"/);
  assert.doesNotMatch(landingHtml, /PLACEHOLDER/);

  const riskDisclaimer = await fetch(`${baseUrl}/risk-disclaimer`);
  assert.equal(riskDisclaimer.status, 200);
  assert.match(await riskDisclaimer.text(), /Trading Risk Disclaimer/);
  const terms = await fetch(`${baseUrl}/terms-of-service`);
  assert.equal(terms.status, 200);
  assert.match(await terms.text(), /Terms of Service/);
  const privacy = await fetch(`${baseUrl}/privacy-policy`);
  assert.equal(privacy.status, 200);
  assert.match(await privacy.text(), /Privacy Policy/);

  const versionedRootManifest = await fetch(`${baseUrl}/?release=bundle-test`, {
    headers: { "expo-platform": "android" },
  });
  assert.equal(versionedRootManifest.status, 200);
  assert.deepEqual(await versionedRootManifest.json(), {
    platform: "android",
    launchAsset: { key: "bundle-test-android" },
  });

  for (const [encoding, decode] of [
    ["br", zlib.brotliDecompressSync],
    ["gzip", zlib.gunzipSync],
  ]) {
    const compressed = await new Promise((resolve, reject) => {
      const request = http.get(
        `${baseUrl}/release/_expo/static/js/ios/bundle.js`,
        { headers: { "accept-encoding": encoding } },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () =>
            resolve({
              headers: response.headers,
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      request.on("error", reject);
    });
    assert.equal(compressed.headers["content-encoding"], encoding);
    assert.match(compressed.headers["cache-control"], /immutable/);
    assert.equal(compressed.headers.vary, "Accept-Encoding");
    assert.deepEqual(decode(compressed.body), bundle);
  }

  for (const [url, expected] of [
    [`${baseUrl}/icon.png`, icon],
    [`${baseUrl}/release/_expo/static/js/ios/bundle.js`, bundle],
    [`${baseUrl}/release/_expo/static/assets/sample.png?hash=one`, asset],
  ]) {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  }

  const missing = await fetch(`${baseUrl}/release/not-found.png`);
  assert.equal(missing.status, 404);

  const releaseInfo = await fetch(`${baseUrl}/release.json`);
  assert.equal(releaseInfo.status, 200);
  assert.deepEqual(await releaseInfo.json(), {
    sourceCommit: "a".repeat(40),
    sourceDirty: false,
    buildTimestamp: "1791975390783",
    builtAt: "2026-10-14T10:56:30.783Z",
  });
});

test("serves the public overview, app routes, PWA assets, and native manifests", async (context) => {
  const staticRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tradify-pwa-server-"));
  context.after(() => fs.rmSync(staticRoot, { recursive: true, force: true }));
  const appShell = Buffer.from("<!doctype html><title>Tradify web app</title>");
  fs.writeFileSync(path.join(staticRoot, "index.html"), appShell);
  fs.writeFileSync(
    path.join(staticRoot, "manifest.webmanifest"),
    '{"name":"Tradify","id":"/app/","start_url":"/app/"}',
  );
  fs.writeFileSync(path.join(staticRoot, "service-worker.js"), "self.addEventListener('install',()=>{});");
  for (const platform of ["ios", "android"]) {
    fs.mkdirSync(path.join(staticRoot, platform), { recursive: true });
    fs.writeFileSync(
      path.join(staticRoot, platform, "manifest.json"),
      JSON.stringify({ launchAsset: { key: `bundle-test-${platform}` } }),
    );
  }

  const server = createStaticServer({ staticRoot });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const customerHome = await fetch(`${baseUrl}/`, { redirect: "manual" });
  assert.equal(customerHome.status, 302);
  assert.equal(customerHome.headers.get("location"), "/app/");

  for (const route of [
    "/app/",
    "/app/auth?mode=signin",
    "/app/register",
    "/app/profile",
    "/app/lab",
    "/app/signal/synthetic-signal",
    "/app/chart/EURUSD",
    "/app/settings/deep-link",
  ]) {
    const response = await fetch(`${baseUrl}${route}`, {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), appShell);
  }

  const webManifest = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(webManifest.status, 200);
  assert.match(webManifest.headers.get("content-type"), /application\/manifest\+json/);
  const manifestJson = await webManifest.json();
  assert.equal(manifestJson.start_url, "/app/");
  assert.equal(manifestJson.id, "/app/");
  const serviceWorker = await fetch(`${baseUrl}/service-worker.js`);
  assert.equal(serviceWorker.status, 200);
  assert.match(await serviceWorker.text(), /addEventListener/);

  const apiFallback = await fetch(`${baseUrl}/api/health`, {
    headers: { accept: "text/html" },
  });
  assert.equal(apiFallback.status, 404);

  const previewHealth = await fetch(`${baseUrl}/status`);
  assert.equal(previewHealth.status, 200);
  assert.equal(await previewHealth.text(), "packager-status:running");

  const nativeManifest = await fetch(`${baseUrl}/`, {
    headers: { "expo-platform": "ios" },
  });
  assert.equal(nativeManifest.status, 200);
  assert.deepEqual(await nativeManifest.json(), {
    launchAsset: { key: "bundle-test-ios" },
  });
});

test("starts a web-only PWA preview without native Expo manifests", async (context) => {
  const staticRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tradify-pwa-preview-"));
  context.after(() => fs.rmSync(staticRoot, { recursive: true, force: true }));
  const appShell = Buffer.from("<!doctype html><title>Tradify PWA preview</title>");
  fs.writeFileSync(path.join(staticRoot, "index.html"), appShell);
  fs.writeFileSync(
    path.join(staticRoot, "manifest.webmanifest"),
    '{"name":"Tradify Signals","id":"/app/","start_url":"/app/"}',
  );
  fs.writeFileSync(path.join(staticRoot, "service-worker.js"), "self.addEventListener('install',()=>{});");

  const server = createStaticServer({ staticRoot });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const customerHome = await fetch(`${baseUrl}/`, { redirect: "manual" });
  assert.equal(customerHome.status, 302);
  assert.equal(customerHome.headers.get("location"), "/app/");

  const app = await fetch(`${baseUrl}/app/`, {
    headers: { accept: "text/html" },
  });
  assert.equal(app.status, 200);
  assert.deepEqual(Buffer.from(await app.arrayBuffer()), appShell);

  const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get("content-type"), /application\/manifest\+json/);

  const api = await fetch(`${baseUrl}/api/health`, { headers: { accept: "text/html" } });
  assert.equal(api.status, 404);

  const nativeManifest = await fetch(`${baseUrl}/`, {
    headers: { "expo-platform": "android" },
  });
  assert.equal(nativeManifest.status, 404);
});
