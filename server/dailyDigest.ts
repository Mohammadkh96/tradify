import { pool } from "./db";
import { sendDailyAlertDigestEmail } from "./emailService";

const DIGEST_HOUR_DEFAULT = 8;
const DIGEST_HOUR = (() => {
  const raw = parseInt(process.env.DIGEST_LOCAL_HOUR || "", 10);
  return Number.isFinite(raw) && raw >= 0 && raw <= 23 ? raw : DIGEST_HOUR_DEFAULT;
})();
const TICK_MS = 15 * 60 * 1000;

// Known risk-alert notification types. The digest only summarizes these so
// future non-risk notifications added to the table never bleed in.
const RISK_ALERT_TYPES = [
  "daily_dd_warn",
  "daily_dd_critical",
  "max_dd_warn",
  "max_dd_critical",
  "revenge_trade",
  "overtrading",
  "strategy_deviation",
];

interface CandidateRow {
  user_id: string;
  digest_enabled: boolean | null;
  timezone: string | null;
}

function getLocalDateAndHour(tz: string): { date: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value || "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  let hour = parseInt(get("hour"), 10);
  if (!Number.isFinite(hour)) hour = 0;
  if (hour === 24) hour = 0;
  return { date, hour };
}

export async function runDailyDigestSweep(opts: { force?: boolean } = {}): Promise<{ checked: number; sent: number; skipped: number }> {
  let checked = 0;
  let sent = 0;
  let skipped = 0;
  try {
    const { rows } = await pool.query<CandidateRow>(`
      SELECT n.user_id,
             COALESCE(ap.digest_enabled, true) AS digest_enabled,
             (SELECT timezone FROM user_role ur WHERE ur.user_id = n.user_id LIMIT 1) AS timezone
      FROM notifications n
      LEFT JOIN alert_preferences ap ON ap.user_id = n.user_id
      WHERE n.created_at >= NOW() - INTERVAL '24 hours'
        AND n.type = ANY($1::text[])
      GROUP BY n.user_id, ap.digest_enabled
    `, [RISK_ALERT_TYPES]);

    for (const row of rows) {
      checked++;
      if (row.digest_enabled === false) { skipped++; continue; }

      const tz = row.timezone || "UTC";
      let local;
      try { local = getLocalDateAndHour(tz); }
      catch { local = getLocalDateAndHour("UTC"); }

      if (!opts.force && local.hour !== DIGEST_HOUR) { skipped++; continue; }

      const dedupeKey = `digest:${local.date}`;
      const dup = await pool.query(
        `SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'daily_digest' AND dedupe_key = $2 LIMIT 1`,
        [row.user_id, dedupeKey],
      );
      if ((dup.rowCount ?? 0) > 0) { skipped++; continue; }

      const agg = await pool.query<{ type: string; severity: string; count: string }>(`
        SELECT type, severity, COUNT(*)::int AS count
        FROM notifications
        WHERE user_id = $1
          AND created_at >= NOW() - INTERVAL '24 hours'
          AND type = ANY($2::text[])
        GROUP BY type, severity
        ORDER BY type, severity
      `, [row.user_id, RISK_ALERT_TYPES]);

      if ((agg.rowCount ?? 0) === 0) { skipped++; continue; }

      const groups = agg.rows.map(r => ({ type: r.type, severity: r.severity, count: Number(r.count) }));
      const total = groups.reduce((s, g) => s + g.count, 0);

      const ok = await sendDailyAlertDigestEmail(row.user_id, {
        date: local.date,
        total,
        groups,
      });

      if (!ok) { skipped++; continue; }

      try {
        await pool.query(
          `INSERT INTO notifications
             (user_id, type, severity, title, body, payload, channel_in_app, channel_email, email_sent, dedupe_key)
           VALUES ($1, 'daily_digest', 'low', $2, $3, $4, false, true, true, $5)`,
          [
            row.user_id,
            `Daily risk digest — ${total} alert${total === 1 ? "" : "s"}`,
            `Summary of risk events from the last 24 hours.`,
            JSON.stringify({ groups, total, date: local.date }),
            dedupeKey,
          ],
        );
      } catch (e) {
        console.error("[DailyDigest] failed to record digest marker:", e);
      }

      sent++;
    }
  } catch (e) {
    console.error("[DailyDigest] sweep error:", e);
  }
  return { checked, sent, skipped };
}

let started = false;
export function startDailyDigestScheduler() {
  if (started) return;
  started = true;
  setTimeout(async () => {
    try {
      const r = await runDailyDigestSweep();
      console.log(`[DailyDigest] initial sweep: checked=${r.checked} sent=${r.sent} skipped=${r.skipped}`);
    } catch {}
    setInterval(async () => {
      try {
        const r = await runDailyDigestSweep();
        if (r.sent > 0) {
          console.log(`[DailyDigest] sweep: checked=${r.checked} sent=${r.sent} skipped=${r.skipped}`);
        }
      } catch {}
    }, TICK_MS);
  }, 2 * 60 * 1000);
}
