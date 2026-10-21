import { pool } from "@workspace/db";

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, any>[]; rowCount?: number | null }>;
};

let schemaReady: Promise<void> | null = null;

export function ensureAdminAuditSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS tradigo_admin_audit_logs (
        id text PRIMARY KEY,
        actor_id text NOT NULL,
        actor_role text NOT NULL,
        action text NOT NULL,
        target_type text NOT NULL,
        target_id text NOT NULL,
        reason_code text NOT NULL,
        reason_text text NOT NULL,
        idempotency_key text NOT NULL UNIQUE,
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurred_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tradigo_admin_audit_logs_occurred_idx
        ON tradigo_admin_audit_logs(occurred_at DESC);
      CREATE INDEX IF NOT EXISTS tradigo_admin_audit_logs_target_idx
        ON tradigo_admin_audit_logs(target_type, target_id, occurred_at DESC);
    `).then(() => undefined);
  }
  return schemaReady;
}

export async function writeAdminAudit(
  queryable: Queryable,
  input: {
    id: string;
    actorId: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    reasonCode: string;
    reasonText: string;
    idempotencyKey: string;
    details?: Record<string, unknown>;
  },
): Promise<{ row: Record<string, any> | null; idempotent: boolean }> {
  const inserted = await queryable.query(
    `INSERT INTO tradigo_admin_audit_logs
      (id,actor_id,actor_role,action,target_type,target_id,reason_code,reason_text,idempotency_key,details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [
      input.id,
      input.actorId,
      input.actorRole,
      input.action,
      input.targetType,
      input.targetId,
      input.reasonCode,
      input.reasonText,
      input.idempotencyKey,
      input.details ?? {},
    ],
  );
  if (inserted.rows[0]) return { row: inserted.rows[0], idempotent: false };
  const existing = await queryable.query(
    "SELECT * FROM tradigo_admin_audit_logs WHERE idempotency_key=$1",
    [input.idempotencyKey],
  );
  return { row: existing.rows[0] ?? null, idempotent: true };
}