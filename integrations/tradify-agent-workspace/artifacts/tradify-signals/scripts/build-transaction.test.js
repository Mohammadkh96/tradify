const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  createStagingDirectory,
  promoteStagedBuild,
  restorePreviousBuildIfMissing,
} = require("./build-transaction");

function makeDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tradify-build-transaction-"));
}

test("staging leaves the previous artifact in place until promotion", (context) => {
  const parent = makeDirectory();
  context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const target = path.join(parent, "static-build");
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "manifest.json"), "previous");

  const staging = createStagingDirectory(target);
  fs.writeFileSync(path.join(staging, "manifest.json"), "next");

  assert.equal(fs.readFileSync(path.join(target, "manifest.json"), "utf8"), "previous");
  assert.equal(fs.readFileSync(path.join(staging, "manifest.json"), "utf8"), "next");
});

test("promotion replaces a verified directory and removes its backup", (context) => {
  const parent = makeDirectory();
  context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const target = path.join(parent, "static-build");
  const staging = createStagingDirectory(target);
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "manifest.json"), "previous");
  fs.writeFileSync(path.join(staging, "manifest.json"), "verified");

  const result = promoteStagedBuild(staging, target, {
    now: () => 123,
    pid: 456,
  });

  assert.equal(fs.readFileSync(path.join(target, "manifest.json"), "utf8"), "verified");
  assert.equal(result.backupPath, null);
  assert.equal(fs.existsSync(path.join(parent, ".static-build.backup-123-456")), false);
});

test("failed promotion restores the previous artifact", (context) => {
  const parent = makeDirectory();
  context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const target = path.join(parent, "static-build");
  const staging = createStagingDirectory(target);
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "manifest.json"), "previous");
  fs.writeFileSync(path.join(staging, "manifest.json"), "next");

  const realRename = fs.renameSync;
  let renameCount = 0;
  const rename = (source, destination) => {
    renameCount += 1;
    if (renameCount === 2) throw new Error("simulated stage rename failure");
    realRename(source, destination);
  };

  assert.throws(
    () =>
      promoteStagedBuild(staging, target, {
        now: () => 789,
        pid: 456,
        rename,
      }),
    /simulated stage rename failure/,
  );
  assert.equal(fs.readFileSync(path.join(target, "manifest.json"), "utf8"), "previous");
  assert.equal(fs.existsSync(staging), true);
});

test("static server startup can recover a previous build after interrupted promotion", (context) => {
  const parent = makeDirectory();
  context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const target = path.join(parent, "static-build");
  const backup = path.join(parent, ".static-build.backup-123-456");
  fs.mkdirSync(backup);
  fs.writeFileSync(path.join(backup, "manifest.json"), "recovered");

  const restoredFrom = restorePreviousBuildIfMissing(target);

  assert.equal(restoredFrom, backup);
  assert.equal(fs.readFileSync(path.join(target, "manifest.json"), "utf8"), "recovered");
});
