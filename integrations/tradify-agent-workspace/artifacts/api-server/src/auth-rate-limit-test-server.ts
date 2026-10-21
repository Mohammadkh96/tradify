import type { AddressInfo } from "node:net";
import app from "./app";
import { pool } from "@workspace/db";

const server = app.listen(0, () => {
  const address = server.address() as AddressInfo;
  console.log(`AUTH_RATE_LIMIT_TEST_SERVER_READY:${address.port}`);
});

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
}

process.once("SIGTERM", () => {
  void shutdown()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Auth rate-limit test server shutdown failed", error);
      process.exit(1);
    });
});

process.once("SIGINT", () => {
  void shutdown()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Auth rate-limit test server shutdown failed", error);
      process.exit(1);
    });
});
