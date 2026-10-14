---
name: Isolated local PostgreSQL testing
description: Safe disposable PostgreSQL setup for integration tests in this Replit Nix environment.
---

Use a unique PostgreSQL cluster under `/tmp`, bind it only to `127.0.0.1`, and set `unix_socket_directories` to a directory inside the cluster. `/run/postgresql` may not exist in the container.

When the application pool enforces `ssl: { rejectUnauthorized: true }`, use a temporary local CA/server certificate and set `NODE_EXTRA_CA_CERTS` for the test process rather than weakening certificate verification. Run the server as a managed background process if it must survive between shell calls. Drop the disposable database and remove its cluster after tests.

**Why:** the default PostgreSQL socket path failed in this environment, and the application requires verified TLS. Relaxing TLS would make the integration test less representative.

**How to apply:** Use this only for disposable local tests with synthetic records and placeholder non-production URLs. Never use a shared development or production connection for writes.

For app integration tests, keep the test process environment allowlisted. `server/dbTarget.ts` refuses to certify a test URL when no production reference is configured, so use a synthetic `.invalid` `DATABASE_URL` only as the comparison reference; never load or pass real production credentials into the test process. Supply disposable `SESSION_SECRET` and only the mocked development flags required by the selected tests.

**Why:** The integration suite requires explicit proof that its loopback test target differs from production, and route registration also requires a session secret. A clean test environment otherwise stops before running tests.

**How to apply:** Pass `TEST_DATABASE_URL` only for the temporary loopback cluster; pass a non-routable fake production reference and synthetic test-only settings through `env -i`. Keep provider calls mocked.
