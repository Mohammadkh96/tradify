import { describe, expect, it } from "vitest";
import { assertNotProductionDatabase, assertProductionDatabaseTarget } from "./dbTarget";

describe("assertProductionDatabaseTarget", () => {
  it("accepts the verified Neon endpoint with the expected database and role", () => {
    expect(() =>
      assertProductionDatabaseTarget(
        "postgresql://tradify_app:synthetic-only@ep-sparkling-moon-ahtc0gbu-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ),
    ).not.toThrow();
  });

  it("rejects any target mismatch without echoing connection details", () => {
    const wrongUrl =
      "postgresql://wrong_role:synthetic-password@ep-other-endpoint.c-3.us-east-1.aws.neon.tech/otherdb";
    let errorMessage = "";
    try {
      assertProductionDatabaseTarget(wrongUrl);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorMessage).toBe(
      "Production database target mismatch (hostname, database name, role); refusing to start.",
    );
    expect(errorMessage).not.toContain("synthetic-password");
    expect(errorMessage).not.toContain("ep-other-endpoint");
  });

  it("rejects non-Neon hosts even if the endpoint label looks right", () => {
    expect(() =>
      assertProductionDatabaseTarget(
        "postgresql://tradify_app:synthetic-only@ep-sparkling-moon-ahtc0gbu.attacker.example/neondb",
      ),
    ).toThrow("Production database target mismatch (hostname); refusing to start.");
  });
});

describe("assertNotProductionDatabase", () => {
  const productionUrl = "postgresql://prod:secret@ep-main-pooler.c-1.aws.neon.tech/prod";

  it("rejects an identical production host and database even if credentials differ", () => {
    expect(() =>
      assertNotProductionDatabase(
        "DEV_DATABASE_URL",
        "postgresql://dev:other@ep-main.c-1.aws.neon.tech/prod",
        [{ name: "DATABASE_URL", connectionString: productionUrl }],
      ),
    ).toThrow(/same database target/);
  });

  it("allows a separate project and database", () => {
    expect(() =>
      assertNotProductionDatabase(
        "DEV_DATABASE_URL",
        "postgresql://dev:secret@ep-dev-pooler.c-1.aws.neon.tech/tradifyapp_dev",
        [{ name: "DATABASE_URL", connectionString: productionUrl }],
      ),
    ).not.toThrow();
  });

  it("fails closed when the production reference is unavailable", () => {
    expect(() =>
      assertNotProductionDatabase("DEV_DATABASE_URL", "postgresql://dev:secret@localhost/dev", []),
    ).toThrow(/no production database URL is configured/);
  });

  it("fails closed for malformed connection strings", () => {
    expect(() =>
      assertNotProductionDatabase("DEV_DATABASE_URL", "not-a-database-url", [
        { name: "DATABASE_URL", connectionString: productionUrl },
      ]),
    ).toThrow(/Database URL is invalid/);
  });
});
