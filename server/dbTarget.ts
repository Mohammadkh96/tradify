type DatabaseReference = {
  name: string;
  connectionString?: string;
};

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
