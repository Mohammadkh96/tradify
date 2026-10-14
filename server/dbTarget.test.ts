import { describe, expect, it } from "vitest";
import { assertNotProductionDatabase } from "./dbTarget";

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
