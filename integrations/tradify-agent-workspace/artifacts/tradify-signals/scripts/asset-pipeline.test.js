const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  copyReferencedAssetFiles,
  getExpoRuntimeAssetLocation,
  parseBundleAssetReferences,
  rewriteBundleAssetLocations,
  validatePlatformAssetMetadata,
} = require("./asset-pipeline");

function md5(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

function makeFixture() {
  const firstContent = Buffer.from("fixture image scale 1");
  const secondContent = Buffer.from("fixture image scale 2");
  const groupHash = "a".repeat(32);
  const firstHash = md5(firstContent);
  const secondHash = md5(secondContent);
  const assetMap = {
    [groupHash]: {
      httpServerLocation: "/assets/../../node_modules/pkg/assets",
      name: "fixture",
      type: "png",
      scales: [1, 2],
      files: [
        "/workspace/node_modules/pkg/assets/fixture.png",
        "/workspace/node_modules/pkg/assets/fixture@2x.png",
      ],
      fileHashes: [firstHash, secondHash],
    },
  };
  const bundle = `var asset={httpServerLocation:"/assets/__node_modules/pkg/assets",hash:"${groupHash}",name:"fixture",type:"png",scales:[1,2]};`;
  return {
    assetMap,
    bundle,
    groupHash,
    firstContent,
    firstHash,
    secondContent,
    secondHash,
  };
}

test("asset pipeline maps Expo production paths and rewrites only descriptors", () => {
  const fixture = makeFixture();
  const references = parseBundleAssetReferences(fixture.bundle, "ios", fixture.assetMap);

  assert.equal(references.length, 1);
  assert.equal(
    getExpoRuntimeAssetLocation("/assets/../../node_modules/pkg/assets"),
    "/assets/__node_modules/pkg/assets",
  );

  const rewritten = rewriteBundleAssetLocations(
    fixture.bundle,
    "ios",
    references,
    "https://signals.replit.dev",
    "/signals",
    "12345",
  );
  assert.ok(
    rewritten.includes(
      `httpServerLocation:"https://signals.replit.dev/signals/12345/_expo/static/assets/${fixture.groupHash}"`,
    ),
  );
  assert.doesNotMatch(rewritten, /\.\.\//);
});

test("asset pipeline copies and verifies every emitted scale variant", (context) => {
  const fixture = makeFixture();
  const exportDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tradify-asset-export-"));
  const stagingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tradify-asset-stage-"));
  context.after(() => {
    fs.rmSync(exportDirectory, { recursive: true, force: true });
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  });

  fs.mkdirSync(path.join(exportDirectory, "assets"), { recursive: true });
  fs.writeFileSync(path.join(exportDirectory, "assets", fixture.firstHash), fixture.firstContent);
  fs.writeFileSync(path.join(exportDirectory, "assets", fixture.secondHash), fixture.secondContent);
  const references = parseBundleAssetReferences(fixture.bundle, "ios", fixture.assetMap);
  const copied = copyReferencedAssetFiles({
    exportDirectory,
    stagingDirectory,
    timestamp: "12345",
    assetMap: fixture.assetMap,
    referencesByPlatform: { ios: references },
    baseUrl: "https://signals.replit.dev",
    basePath: "/signals",
  });

  assert.equal(copied.copiedFiles.size, 2);
  assert.equal(copied.emittedAssetUrls.size, 2);
  assert.deepEqual(
    [...copied.copiedFiles].sort(),
    [
      `12345/_expo/static/assets/${fixture.groupHash}/fixture.png`,
      `12345/_expo/static/assets/${fixture.groupHash}/fixture@2x.png`,
    ].sort(),
  );
  for (const assetUrl of copied.emittedAssetUrls) {
    const pathname = new URL(assetUrl).pathname.replace(/^\/signals\//, "");
    assert.ok(fs.existsSync(path.join(stagingDirectory, pathname)));
  }
});

test("asset pipeline preserves distinct files assigned the same scale", (context) => {
  const firstContent = Buffer.from("default one-x");
  const secondContent = Buffer.from("explicit one-x");
  const groupHash = "c".repeat(32);
  const firstHash = md5(firstContent);
  const secondHash = md5(secondContent);
  const asset = {
    httpServerLocation: "/assets/router",
    name: "clear-icon",
    type: "png",
    scales: [1, 1],
    files: ["/workspace/router/clear-icon.png", "/workspace/router/clear-icon@1x.png"],
    fileHashes: [firstHash, secondHash],
  };
  const assetMap = { [groupHash]: asset };
  const bundle = `var asset={httpServerLocation:"/assets/router",hash:"${groupHash}",name:"clear-icon",type:"png"};`;
  const exportDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tradify-duplicate-scale-export-"));
  const stagingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tradify-duplicate-scale-stage-"));
  context.after(() => {
    fs.rmSync(exportDirectory, { recursive: true, force: true });
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  });

  fs.mkdirSync(path.join(exportDirectory, "assets"), { recursive: true });
  fs.writeFileSync(path.join(exportDirectory, "assets", firstHash), firstContent);
  fs.writeFileSync(path.join(exportDirectory, "assets", secondHash), secondContent);
  const references = parseBundleAssetReferences(bundle, "ios", assetMap);
  const copied = copyReferencedAssetFiles({
    exportDirectory,
    stagingDirectory,
    timestamp: "54321",
    assetMap,
    referencesByPlatform: { ios: references },
    baseUrl: "https://signals.replit.dev",
    basePath: "",
  });

  assert.equal(copied.copiedFiles.size, 2);
  assert.ok(copied.copiedFiles.has(`54321/_expo/static/assets/${groupHash}/clear-icon.png`));
  assert.ok(
    copied.copiedFiles.has(
      `54321/_expo/static/assets/${groupHash}/clear-icon@1x-variant-2-${secondHash.slice(0, 8)}.png`,
    ),
  );
});

test("asset metadata validation rejects incomplete or unreferenced export records", () => {
  const fixture = makeFixture();
  const references = parseBundleAssetReferences(fixture.bundle, "android", fixture.assetMap);

  assert.equal(
    validatePlatformAssetMetadata(
      {
        fileMetadata: {
          android: {
            assets: [
              { path: `assets/${fixture.firstHash}` },
              { path: `assets/${fixture.secondHash}` },
            ],
          },
        },
      },
      references,
      "android",
    ).size,
    2,
  );
  assert.throws(
    () =>
      validatePlatformAssetMetadata(
        {
          fileMetadata: {
            android: { assets: [{ path: `assets/${fixture.firstHash}` }] },
          },
        },
        references,
        "android",
      ),
    /asset mismatch/,
  );
});

test("asset pipeline refuses bundle locations not represented by Expo metadata", () => {
  const fixture = makeFixture();
  assert.throws(
    () =>
      parseBundleAssetReferences(
        fixture.bundle.replace(fixture.groupHash, "b".repeat(32)),
        "ios",
        fixture.assetMap,
      ),
    /missing from Expo.s asset map/,
  );
});
