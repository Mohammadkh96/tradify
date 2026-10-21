const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  assertProductionUrl,
  assertNoLoopbackReferences,
  assertNoDevelopmentHostReferences,
  copyLocalManifestAssets,
  getDeploymentBaseUrl,
  makeBuildEnvironment,
  updateManifest,
  validateManifestConfiguration,
} = require("./build");

const config = {
  name: "Tradify Signals",
  slug: "tradify-signals",
  version: "1.0.0",
  scheme: "tradify-signals",
  userInterfaceStyle: "dark",
  sdkVersion: "57.0.0",
  ios: { bundleIdentifier: "com.tradify.signals" },
  android: { package: "com.tradifysignals.app" },
  plugins: [
    [
      "expo-splash-screen",
      {
        image: "./assets/images/icon.png",
        resizeMode: "contain",
        backgroundColor: "#101714",
      },
    ],
  ],
};

const publicHostConfig = {
  extra: {
    legal: {
      privacyPolicyUrl: "https://signals.replit.app/privacy-policy",
      termsOfServiceUrl: "https://signals.replit.app/terms-of-service",
    },
    legalUrls: {
      privacyPolicy: "https://signals.replit.app/api/legal/privacy",
      terms: "https://signals.replit.app/api/legal/terms",
      accountDeletion: "https://signals.replit.app/api/legal/account-deletion",
    },
  },
};

function makeManifest() {
  return {
    runtimeVersion: "exposdk:57.0.0",
    extra: {
      expoClient: {
        name: config.name,
        slug: config.slug,
        version: config.version,
        scheme: config.scheme,
        userInterfaceStyle: config.userInterfaceStyle,
        ios: { bundleIdentifier: config.ios.bundleIdentifier },
        android: { package: config.android.package },
        plugins: JSON.parse(JSON.stringify(config.plugins)),
      },
    },
    launchAsset: {
      url: "http://localhost:8081/index.bundle?platform=ios",
      key: "stale-bundle",
    },
  };
}

test("static manifest URLs use the injected production host or configured public origin, never the dev host", () => {
  assert.equal(
    getDeploymentBaseUrl(publicHostConfig, {
      EXPO_PUBLIC_DOMAIN: "workspace.replit.dev",
      REPLIT_DEV_DOMAIN: "workspace.replit.dev",
    }),
    "https://signals.replit.app",
  );
  assert.equal(
    getDeploymentBaseUrl(publicHostConfig, {
      EXPO_PUBLIC_DOMAIN: "custom-production.example",
    }),
    "https://custom-production.example",
  );
  assert.equal(
    getDeploymentBaseUrl(publicHostConfig, {
      STATIC_PUBLIC_URL: "https://preview.example",
    }),
    "https://preview.example",
  );
  assert.equal(
    makeBuildEnvironment("https://signals.replit.app", {}).EXPO_PUBLIC_API_URL,
    "https://signals.replit.app",
  );
  assert.throws(
    () =>
      getDeploymentBaseUrl(publicHostConfig, {
        STATIC_PUBLIC_URL: "https://workspace.replit.dev",
      }),
    /must not use a development or loopback host/,
  );
  assert.throws(
    () =>
      makeBuildEnvironment("https://signals.replit.app", {
        EXPO_PUBLIC_API_URL: "https://workspace.replit.dev",
      }),
    /EXPO_PUBLIC_API_URL must use a public HTTPS host/,
  );
  assert.throws(
    () =>
      assertProductionUrl(
        "https://workspace.replit.dev/manifest",
        "https://workspace.replit.dev",
        "",
        "test manifest",
      ),
    /configured public host/,
  );
  assert.throws(
    () =>
      getDeploymentBaseUrl(
        {
          extra: {
            legal: {
              privacyPolicyUrl: "https://one.example/privacy",
              termsOfServiceUrl: "https://two.example/terms",
            },
          },
        },
        {},
      ),
    /inconsistent public URL hosts/,
  );
});

test("manifest validation enforces the current Signals configuration for both platforms", () => {
  const appConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "app.json"), "utf8"),
  ).expo;
  assert.equal(appConfig.android.package, "com.tradifysignals.app");
  assert.equal(appConfig.ios.bundleIdentifier, "com.tradify.signals");
  assert.equal(appConfig.scheme, "tradify-signals");

  validateManifestConfiguration(makeManifest(), "ios", config);
  validateManifestConfiguration(makeManifest(), "android", config);

  const staleManifest = makeManifest();
  staleManifest.extra.expoClient.userInterfaceStyle = "automatic";
  assert.throws(
    () => validateManifestConfiguration(staleManifest, "ios", config),
    /userInterfaceStyle/,
  );

  const staleSplash = makeManifest();
  staleSplash.extra.expoClient.plugins[0][1].backgroundColor = "#0b1117";
  assert.throws(
    () => validateManifestConfiguration(staleSplash, "android", config),
    /splash backgroundColor/,
  );
});

test("manifest validation rejects loopback references anywhere in a platform manifest", () => {
  assert.doesNotThrow(() =>
    assertNoLoopbackReferences(
      { launchAsset: { url: "https://signals.replit.dev/bundle.js" } },
      "ios",
    ),
  );
  assert.throws(
    () =>
      assertNoLoopbackReferences(
        { extra: { expoClient: { iconUrl: "http://127.0.0.1:8081/icon.png" } } },
        "android",
      ),
    /loopback URL/,
  );
});

test("production manifests replace Expo client and Expo Go ports with the public host", () => {
  const manifest = makeManifest();
  manifest.extra.expoClient.hostUri = "signals.replit.app:35959";
  manifest.extra.expoGo = {
    hostUri: "signals.replit.app:35959",
    debuggerHost: "signals.replit.app:35959",
    packagerOpts: { dev: true },
  };

  const updated = updateManifest(manifest, "ios", {
    baseUrl: "https://signals.replit.app",
    basePath: "",
    timestamp: "1790862138980",
    iconUrl: "https://signals.replit.app/icon.png",
    config,
  });

  assert.equal(updated.extra.expoClient.hostUri, "signals.replit.app");
  assert.equal(updated.extra.expoGo.hostUri, "signals.replit.app");
  assert.equal(updated.extra.expoGo.debuggerHost, "signals.replit.app");
  assert.equal(updated.extra.expoGo.packagerOpts.dev, false);
  assert.doesNotThrow(() => assertNoDevelopmentHostReferences(updated, "ios"));
});

test("manifest validation rejects development-host references", () => {
  assert.throws(
    () =>
      assertNoDevelopmentHostReferences(
        { extra: { expoClient: { hostUri: "workspace.replit.dev:8081" } } },
        "android",
      ),
    /development host/,
  );
});

test("copies the local splash image to the relative path retained in the manifest", (context) => {
  const stagingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tradify-manifest-assets-"));
  context.after(() => fs.rmSync(stagingDirectory, { recursive: true, force: true }));

  const paths = copyLocalManifestAssets(stagingDirectory, {
    plugins: [["expo-splash-screen", { image: "./assets/images/icon.png" }]],
  });
  const relativePath = "assets/images/icon.png";

  assert.deepEqual([...paths], [relativePath]);
  assert.deepEqual(
    fs.readFileSync(path.join(stagingDirectory, relativePath)),
    fs.readFileSync(path.resolve(__dirname, "..", "assets", "images", "icon.png")),
  );
});
