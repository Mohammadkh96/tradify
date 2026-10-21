const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ASSET_REFERENCE_PATTERN =
  /httpServerLocation:"([^"]+)"[^}]*?hash:"([^"]+)"[^}]*?name:"([^"]+)"[^}]*?type:"([^"]+)"/g;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{32}$/i;

function isWithinDirectory(directory, target) {
  const relativePath = path.relative(path.resolve(directory), path.resolve(target));
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function hashFile(filePath) {
  return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

function getExpoRuntimeAssetLocation(httpServerLocation) {
  if (typeof httpServerLocation !== "string" || !httpServerLocation.startsWith("/")) {
    throw new Error(`Invalid Metro asset location: ${httpServerLocation}`);
  }

  // This mirrors expo-asset's production AssetSourceResolver:
  // httpServerLocation.replace(/\.\.\//g, '_'), followed by URL normalization.
  const sanitizedLocation = httpServerLocation.replace(/\.\.\//g, "_");
  let normalizedPath;
  try {
    normalizedPath = new URL(sanitizedLocation, "https://expo-asset.invalid").pathname;
  } catch {
    throw new Error(`Malformed Metro asset location: ${httpServerLocation}`);
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  if (
    !normalizedPath.startsWith("/assets/") ||
    segments.some((segment) => segment === "." || segment === "..") ||
    normalizedPath.includes("\\") ||
    normalizedPath.includes("\0")
  ) {
    throw new Error(`Metro asset location is not safe to serve: ${httpServerLocation}`);
  }

  return normalizedPath;
}

function parseBundleAssetReferences(bundle, platform, assetMap) {
  const rawReferenceCount = (bundle.match(/httpServerLocation:"/g) || []).length;
  const matches = [...bundle.matchAll(new RegExp(ASSET_REFERENCE_PATTERN.source, "g"))];

  if (rawReferenceCount !== matches.length) {
    throw new Error(
      `${platform} bundle has ${rawReferenceCount} asset locations but only ${matches.length} parseable Expo asset descriptors`,
    );
  }
  if (matches.length === 0) {
    throw new Error(`${platform} bundle contains no Expo asset descriptors`);
  }

  return matches.map((match) => {
    const [, bundleLocation, hash, name, type] = match;
    const asset = assetMap[hash];
    if (!asset) {
      throw new Error(
        `${platform} bundle references asset group ${hash}, missing from Expo's asset map`,
      );
    }
    if (asset.name !== name || asset.type !== type) {
      throw new Error(
        `${platform} asset group ${hash} metadata does not match its bundle descriptor`,
      );
    }

    const expectedLocation = getExpoRuntimeAssetLocation(asset.httpServerLocation);
    if (bundleLocation !== expectedLocation) {
      throw new Error(
        `${platform} asset group ${hash} has an unexpected exported location: ${bundleLocation}`,
      );
    }

    return { hash, name, type, bundleLocation, asset };
  });
}

function runtimeAssetFilename(asset, variantIndex) {
  const scale = asset.scales[variantIndex];
  const scaleSuffix = scale === 1 ? "" : `@${scale}x`;
  const filename = `${asset.name}${scaleSuffix}.${asset.type}`;

  if (
    !Number.isFinite(scale) ||
    scale <= 0 ||
    path.posix.basename(filename) !== filename ||
    filename.includes("\0") ||
    filename.includes("\\")
  ) {
    throw new Error(`Unsafe Expo asset filename: ${filename}`);
  }

  return filename;
}

function validateAssetGroup(asset, hash) {
  if (!CONTENT_HASH_PATTERN.test(hash)) {
    throw new Error(`Invalid Expo asset group hash: ${hash}`);
  }
  if (
    !Array.isArray(asset.fileHashes) ||
    !Array.isArray(asset.files) ||
    !Array.isArray(asset.scales) ||
    asset.fileHashes.length === 0 ||
    asset.fileHashes.length !== asset.files.length ||
    asset.fileHashes.length !== asset.scales.length
  ) {
    throw new Error(`Expo asset group ${hash} has incomplete scale metadata`);
  }
  if (
    typeof asset.name !== "string" ||
    !asset.name ||
    path.posix.basename(asset.name) !== asset.name ||
    typeof asset.type !== "string" ||
    !/^[a-z0-9]+$/i.test(asset.type)
  ) {
    throw new Error(`Expo asset group ${hash} has an unsafe name or type`);
  }
}

function assetLocationUrl(baseUrl, basePath, timestamp, hash) {
  return `${baseUrl}${basePath}/${timestamp}/_expo/static/assets/${hash}`;
}

function rewriteBundleAssetLocations(bundle, platform, references, baseUrl, basePath, timestamp) {
  const referenceHashes = new Set(references.map((reference) => reference.hash));
  let rewrittenCount = 0;
  const rewrittenBundle = bundle.replace(
    new RegExp(ASSET_REFERENCE_PATTERN.source, "g"),
    (descriptor, oldLocation, hash) => {
      if (!referenceHashes.has(hash)) {
        throw new Error(`${platform} bundle contains an unmapped asset descriptor for ${hash}`);
      }
      const targetLocation = assetLocationUrl(baseUrl, basePath, timestamp, hash);
      const oldProperty = `httpServerLocation:${JSON.stringify(oldLocation)}`;
      if (!descriptor.includes(oldProperty)) {
        throw new Error(
          `${platform} bundle asset descriptor for ${hash} could not be rewritten safely`,
        );
      }
      rewrittenCount += 1;
      return descriptor.replace(
        oldProperty,
        `httpServerLocation:${JSON.stringify(targetLocation)}`,
      );
    },
  );

  if (rewrittenCount !== references.length) {
    throw new Error(
      `${platform} bundle rewrote ${rewrittenCount} of ${references.length} asset descriptors`,
    );
  }
  const rewrittenLocations = [...rewrittenBundle.matchAll(/httpServerLocation:"([^"]+)"/g)];
  const expectedLocations = new Set(
    references.map((reference) => assetLocationUrl(baseUrl, basePath, timestamp, reference.hash)),
  );
  if (
    rewrittenLocations.length !== references.length ||
    rewrittenLocations.some((match) => !expectedLocations.has(match[1]))
  ) {
    throw new Error(`${platform} bundle contains an unvalidated asset location`);
  }

  return rewrittenBundle;
}

function validatePlatformAssetMetadata(metadata, references, platform) {
  const platformMetadata = metadata?.fileMetadata?.[platform];
  if (!platformMetadata || !Array.isArray(platformMetadata.assets)) {
    throw new Error(`Expo export metadata is missing ${platform} asset records`);
  }

  const referencedFileHashes = new Set();
  for (const reference of references) {
    validateAssetGroup(reference.asset, reference.hash);
    for (const fileHash of reference.asset.fileHashes) {
      if (!CONTENT_HASH_PATTERN.test(fileHash)) {
        throw new Error(
          `${platform} asset group ${reference.hash} has invalid file hash ${fileHash}`,
        );
      }
      referencedFileHashes.add(fileHash);
    }
  }

  const exportedFileHashes = new Set();
  for (const record of platformMetadata.assets) {
    if (typeof record.path !== "string") {
      throw new Error(`${platform} export metadata contains an invalid asset path`);
    }
    const relativePath = record.path.replaceAll("\\", "/");
    if (!relativePath.startsWith("assets/")) {
      throw new Error(`${platform} export metadata contains a non-local asset: ${record.path}`);
    }
    const fileHash = path.posix.basename(relativePath);
    if (!CONTENT_HASH_PATTERN.test(fileHash)) {
      throw new Error(`${platform} export metadata contains an invalid asset hash: ${record.path}`);
    }
    exportedFileHashes.add(fileHash);
  }

  const missing = [...referencedFileHashes].filter((hash) => !exportedFileHashes.has(hash));
  const unexpected = [...exportedFileHashes].filter((hash) => !referencedFileHashes.has(hash));
  if (missing.length || unexpected.length) {
    throw new Error(
      `${platform} bundle/metadata asset mismatch (missing: ${missing.length}, unexpected: ${unexpected.length})`,
    );
  }

  return referencedFileHashes;
}

function copyReferencedAssetFiles({
  exportDirectory,
  stagingDirectory,
  timestamp,
  assetMap,
  referencesByPlatform,
  baseUrl,
  basePath,
}) {
  const copiedFiles = new Set();
  const copiedFileHashes = new Map();
  const emittedAssetUrls = new Set();
  const referencedGroups = new Map();

  for (const [platform, references] of Object.entries(referencesByPlatform)) {
    for (const reference of references) {
      const existing = referencedGroups.get(reference.hash);
      if (existing && JSON.stringify(existing.asset) !== JSON.stringify(reference.asset)) {
        throw new Error(`Expo asset group ${reference.hash} has conflicting platform metadata`);
      }
      referencedGroups.set(reference.hash, reference);

      const asset = assetMap[reference.hash];
      validateAssetGroup(asset, reference.hash);
      const groupLocation = assetLocationUrl(baseUrl, basePath, timestamp, reference.hash);

      for (let index = 0; index < asset.fileHashes.length; index += 1) {
        const fileHash = asset.fileHashes[index];
        const sourcePath = path.resolve(exportDirectory, "assets", fileHash);
        if (!isWithinDirectory(exportDirectory, sourcePath)) {
          throw new Error(`Expo asset file escaped the export directory: ${fileHash}`);
        }
        if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
          throw new Error(`Expo did not emit referenced asset file ${fileHash}`);
        }
        if (hashFile(sourcePath) !== fileHash.toLowerCase()) {
          throw new Error(`Expo asset file ${fileHash} failed its content hash check`);
        }

        let filename = runtimeAssetFilename(asset, index);
        let relativePath = path.posix.join(
          timestamp,
          "_expo",
          "static",
          "assets",
          reference.hash,
          filename,
        );
        const existingHash = copiedFileHashes.get(relativePath);
        if (existingHash && existingHash !== fileHash.toLowerCase()) {
          const sourceFilename = path.posix.basename(
            String(asset.files[index]).replaceAll("\\", "/"),
          );
          if (!sourceFilename || sourceFilename.includes("\0") || sourceFilename.includes("\\")) {
            throw new Error(`Expo asset group ${reference.hash} has an unsafe source filename`);
          }
          const extension = path.posix.extname(sourceFilename);
          const stem = extension ? sourceFilename.slice(0, -extension.length) : sourceFilename;
          filename = `${stem}-variant-${index + 1}-${fileHash.slice(0, 8)}${extension}`;
          relativePath = path.posix.join(
            timestamp,
            "_expo",
            "static",
            "assets",
            reference.hash,
            filename,
          );
        }
        const destinationPath = path.resolve(stagingDirectory, ...relativePath.split("/"));
        if (!isWithinDirectory(stagingDirectory, destinationPath)) {
          throw new Error(`Asset destination escaped staging: ${relativePath}`);
        }

        const destinationHash = copiedFileHashes.get(relativePath);
        if (destinationHash) {
          if (destinationHash !== fileHash.toLowerCase()) {
            throw new Error(`Conflicting exported asset at ${relativePath}`);
          }
        } else {
          fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
          fs.copyFileSync(sourcePath, destinationPath);
          copiedFiles.add(relativePath);
          copiedFileHashes.set(relativePath, fileHash.toLowerCase());
        }

        const assetUrl = new URL(`${groupLocation}/${filename}`);
        assetUrl.searchParams.set("platform", platform);
        assetUrl.searchParams.set("hash", reference.hash);
        emittedAssetUrls.add(assetUrl.toString());
      }
    }
  }

  return {
    copiedFiles,
    emittedAssetUrls,
    referencedGroups,
  };
}

module.exports = {
  assetLocationUrl,
  copyReferencedAssetFiles,
  getExpoRuntimeAssetLocation,
  isWithinDirectory,
  parseBundleAssetReferences,
  rewriteBundleAssetLocations,
  runtimeAssetFilename,
  validatePlatformAssetMetadata,
};
