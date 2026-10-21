import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const expectedDevelopmentDatabase = "heliumdb";
const databaseUrl = process.env.DATABASE_URL;
const databaseName = `tradify_test_${process.pid}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with status ${code}`)),
    );
  });
}

function databaseUrlFor(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  url.searchParams.set("application_name", "tradify-test-suite");
  return url.toString();
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Tests refuse to run when NODE_ENV is production.");
  }
  if (!databaseUrl) throw new Error("DATABASE_URL is required to provision a disposable test database.");

  const provisioner = new Pool({ connectionString: databaseUrl, max: 1 });
  let databaseCreated = false;
  try {
    const { rows } = await provisioner.query(
      "SELECT current_database() AS name, pg_is_in_recovery() AS replica",
    );
    if (rows[0]?.name !== expectedDevelopmentDatabase || rows[0]?.replica) {
      throw new Error(`Tests require the verified development database ${expectedDevelopmentDatabase}; no database was changed.`);
    }
    if (process.env.PGDATABASE && process.env.PGDATABASE !== expectedDevelopmentDatabase) {
      throw new Error("PGDATABASE does not match the verified development database; no database was changed.");
    }

    await provisioner.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const testDatabaseUrl = databaseUrlFor(databaseName);
    const testEnv = {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      PGDATABASE: databaseName,
      NODE_ENV: "development",
    };
    delete testEnv.NEON_DATABASE_URL;
    delete testEnv.NEON_DEVELOPMENT_DATABASE_URL;

    await run("pnpm", ["--filter", "@workspace/db", "run", "push-force"], { env: testEnv });
    await run("pnpm", ["--filter", "@workspace/api-server", "run", "build"], { env: testEnv });

    const apiDir = path.join(root, "artifacts/api-server");
    const apiTests = (await import("node:fs/promises")).readdir;
    async function collectTests(directory) {
      const entries = await apiTests(directory, { withFileTypes: true });
      const files = [];
      for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await collectTests(target)));
        else if (entry.isFile() && entry.name.endsWith(".test.ts")) files.push(target);
      }
      return files;
    }
    const requested = process.argv.slice(2);
    const allFiles = (await collectTests(path.join(apiDir, "src"))).sort();
    const files = requested.length
      ? requested.map((name) => {
          const file = allFiles.find((candidate) => path.relative(root, candidate) === name);
          if (!file) throw new Error(`Unknown API test file: ${name}`);
          return file;
        })
      : allFiles;
    const tsxCli = path.join(
      root,
      "node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs",
    );
    for (const file of files) {
      console.log(`API test: ${path.relative(root, file)}`);
      await run(process.execPath, [tsxCli, file], { cwd: apiDir, env: testEnv });
    }

    if (!requested.length) {
      console.log("Admin tests");
      await run("pnpm", ["--filter", "@workspace/tradify-admin", "test"], { env: testEnv });
      console.log("Mobile tests");
      await run("pnpm", ["--filter", "@workspace/tradify-signals", "test"], { env: testEnv });
      console.log("Scripts tests");
      await run("pnpm", ["--filter", "@workspace/scripts", "test"], { env: testEnv });
    }
    console.log(`All suites passed. API test files: ${files.length}. API mutations used disposable database ${databaseName}.`);
  } finally {
    if (databaseCreated) {
      await provisioner.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [databaseName],
      );
      await provisioner.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }
    await provisioner.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Test suite failed.");
  process.exitCode = 1;
});
