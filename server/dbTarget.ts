type DatabaseReference = {
  name: string;
  connectionString?: string;
};

const EXPECTED_PRODUCTION_ENDPOINT_ID = "ep-sparkling-moon-ahtc0gbu";
const EXPECTED_PRODUCTION_DATABASE = "neondb";
const EXPECTED_PRODUCTION_ROLE = "tradify_app";

function normalizeConnectionString(value: string): URL {
  let cleaned = value.trim();
  if (cleaned.startsWith("psql ")) {
    cleaned = cleaned.replace(/^psql\s+['"]?/, "").replace(/['"]$/, "");
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error("Database URL is invalid; refusing to start.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Database URL must use PostgreSQL; refusing to start.");
  }
  return parsed;
}

export function assertProductionDatabaseTarget(connectionString: string): void {
  const url = normalizeConnectionString(connectionString);
  const labels = url.hostname.toLowerCase().split(".");
  const endpointLabel = labels[0];
  const hostDomain = labels.slice(1).join(".");
  const hostnameMatches =
    (endpointLabel === EXPECTED_PRODUCTION_ENDPOINT_ID ||
      endpointLabel === `${EXPECTED_PRODUCTION_ENDPOINT_ID}-pooler`) &&
    hostDomain.endsWith(".neon.tech");
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const role = decodeURIComponent(url.username);
  const mismatches: string[] = [];

  if (!hostnameMatches) mismatches.push("hostname");
  if (database !== EXPECTED_PRODUCTION_DATABASE) mismatches.push("database name");
  if (role !== EXPECTED_PRODUCTION_ROLE) mismatches.push("role");

  if (mismatches.length > 0) {
    throw new Error(
      `Production database target mismatch (${mismatches.join(", ")}); refusing to start.`,
    );
  }
}

function databaseIdentity(connectionString: string): string {
  const url = normalizeConnectionString(connectionString);
  const hostname = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
  const port = url.port || "5432";
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  return `${hostname}:${port}/${database}`;
}

export function assertNotProductionDatabase(
  candidateName: string,
  candidate: string | undefined,
  productionReferences: DatabaseReference[],
): void {
  if (!candidate) {
    throw new Error(`${candidateName} must be set. Refusing an unsafe database fallback.`);
  }

  const knownProductionTargets = productionReferences.filter(
    (reference): reference is DatabaseReference & { connectionString: string } =>
      Boolean(reference.connectionString),
  );

  if (knownProductionTargets.length === 0) {
    throw new Error(
      `${candidateName} cannot be verified as isolated because no production database URL is configured.`,
    );
  }

  const candidateIdentity = databaseIdentity(candidate);
  for (const reference of knownProductionTargets) {
    if (candidateIdentity === databaseIdentity(reference.connectionString)) {
      throw new Error(
        `${candidateName} resolves to the same database target as ${reference.name}. Refusing to start.`,
      );
    }
  }
}
