const fs = require("fs");
const path = require("path");

function createStagingDirectory(targetDirectory) {
  const target = path.resolve(targetDirectory);
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  return fs.mkdtempSync(path.join(parent, `.${path.basename(target)}.stage-`));
}

function restorePreviousBuildIfMissing(
  targetDirectory,
  {
    exists = fs.existsSync,
    readDirectory = (directory) => fs.readdirSync(directory),
    stat = (filePath) => fs.statSync(filePath),
    rename = (source, destination) => fs.renameSync(source, destination),
  } = {},
) {
  const target = path.resolve(targetDirectory);
  if (exists(target)) return null;

  const parent = path.dirname(target);
  if (!exists(parent)) return null;

  const prefix = `.${path.basename(target)}.backup-`;
  const backups = readDirectory(parent)
    .filter((name) => name.startsWith(prefix))
    .map((name) => {
      const backupPath = path.join(parent, name);
      try {
        return {
          backupPath,
          modifiedAt: stat(backupPath).mtimeMs,
          createdAt: Number(name.slice(prefix.length).split("-")[0]) || 0,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.createdAt - left.createdAt || right.modifiedAt - left.modifiedAt);

  if (backups.length === 0) return null;
  rename(backups[0].backupPath, target);
  return backups[0].backupPath;
}

function promoteStagedBuild(
  stagingDirectory,
  targetDirectory,
  {
    exists = fs.existsSync,
    rename = (source, destination) => fs.renameSync(source, destination),
    remove = (target, options) => fs.rmSync(target, options),
    now = () => Date.now(),
    pid = process.pid,
  } = {},
) {
  const staging = path.resolve(stagingDirectory);
  const target = path.resolve(targetDirectory);
  const backup = path.join(
    path.dirname(target),
    `.${path.basename(target)}.backup-${now()}-${pid}`,
  );
  let movedPreviousBuild = false;

  if (!exists(staging)) {
    throw new Error(`Staged build does not exist: ${staging}`);
  }

  if (exists(target)) {
    rename(target, backup);
    movedPreviousBuild = true;
  }

  try {
    rename(staging, target);
  } catch (promotionError) {
    if (movedPreviousBuild && !exists(target)) {
      try {
        rename(backup, target);
      } catch (restoreError) {
        throw new AggregateError(
          [promotionError, restoreError],
          `Build promotion failed and the previous build could not be restored from ${backup}`,
        );
      }
    }
    throw promotionError;
  }

  let backupCleanupError = null;
  if (movedPreviousBuild) {
    try {
      remove(backup, { recursive: true, force: true });
    } catch (error) {
      backupCleanupError = error;
    }
  }

  return {
    backupPath: movedPreviousBuild && backupCleanupError ? backup : null,
    backupCleanupError,
  };
}

module.exports = {
  createStagingDirectory,
  promoteStagedBuild,
  restorePreviousBuildIfMissing,
};
