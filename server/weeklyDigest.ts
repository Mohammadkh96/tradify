import { pool } from "./db";
import { sendWeeklyPerformanceDigestEmail } from "./emailService";

const DIGEST_HOUR_DEFAULT = 9;
const DIGEST_HOUR = (() => {
  const raw = parseInt(process.env.WEEKLY_DIGEST_LOCAL_HOUR || "", 10);
  return Number.isFinite(raw) && raw >= 0 && raw <= 23 ? raw : DIGEST_HOUR_DEFAULT;
})();
const TICK_MS = 30 * 60 * 1000;

interface CandidateRow {
  user_id: string;
  email: string | null;
  weekly_digest_enabled: boolean | null;
  weekly_digest_email: boolean | null;
  timezone: string | null;
}

interface TradeRow {
  id: number;
  pair: string;
  outcome: string;
  net_pl: string | null;
  created_at: string;
  is_rule_compliant: boolean | null;
}

interface WeeklyStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  netPl: number;
  bestTrade: { pair: string; pl: number } | null;
  worstTrade: { pair: string; pl: number } | null;
  ruleComplianceRate: number;
  insight: string;
  weekLabel: string;
}

function getLocalDateAndHourAndDow(tz: string): { date: string; hour: number; dow: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "short",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value || "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  let hour = parseInt(get("hour"), 10);
  if (!Number.isFinite(hour)) hour = 0;
  if (hour === 24) hour = 0;
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[get("weekday")] ?? 0;
  return { date, hour, dow };
}

function buildInsight(s: { winRate: number; ruleComplianceRate: number; total: number; netPl: number }): string {
  if (s.total === 0) return "No trades logged this week — even one a day builds the habit.";
  if (s.ruleComplianceRate < 60) return `Only ${Math.round(s.ruleComplianceRate)}% of your trades followed your rules. Discipline is your biggest leak this week.`;
  if (s.winRate >= 60 && s.netPl > 0) return `Strong week — ${Math.round(s.winRate)}% win rate with positive P/L. Keep the same setup criteria next week.`;
  if (s.winRate < 40 && s.netPl < 0) return `Tough week. Review your worst trade in detail before the next session — pattern recognition compounds.`;
  if (s.netPl > 0 && s.winRate < 50) return `Profitable despite a sub-50% win rate — your R:R is doing the work. Protect that edge.`;
  return `Consistent week. Look at trade entries closest to your stop — small sizing tweaks can move your win rate.`;
}

async function computeWeeklyStats(userId: string): Promise<WeeklyStats | null> {
  const { rows } = await pool.query<TradeRow>(
    `SELECT id, pair, outcome, net_pl, created_at, is_rule_compliant
     FROM trade_journal
     WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC`,
    [userId],
  );
  if (rows.length === 0) return null;

  const total = rows.length;
  let wins = 0, losses = 0, netPl = 0, compliant = 0;
  let bestTrade: { pair: string; pl: number } | null = null;
  let worstTrade: { pair: string; pl: number } | null = null;

  for (const r of rows) {
    const pl = parseFloat(r.net_pl || "0") || 0;
    netPl += pl;
    if (r.outcome === "Win") wins++;
    else if (r.outcome === "Loss") losses++;
    if (r.is_rule_compliant !== false) compliant++;
    if (!bestTrade || pl > bestTrade.pl) bestTrade = { pair: r.pair, pl };
    if (!worstTrade || pl < worstTrade.pl) worstTrade = { pair: r.pair, pl };
  }

  const decided = wins + losses;
  const winRate = decided > 0 ? (wins / decided) * 100 : 0;
  const ruleComplianceRate = (compliant / total) * 100;
  const insight = buildInsight({ winRate, ruleComplianceRate, total, netPl });

  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = new Date();
  const weekLabel = `${start.toISOString().slice(5, 10)} → ${end.toISOString().slice(5, 10)}`;

  return { total, wins, losses, winRate, netPl, bestTrade, worstTrade, ruleComplianceRate, insight, weekLabel };
}

export async function runWeeklyDigestSweep(opts: { force?: boolean } = {}): Promise<{ checked: number; sent: number; skipped: number }> {
  let checked = 0, sent = 0, skipped = 0;
  try {
    const { rows } = await pool.query<CandidateRow>(`
      SELECT ur.user_id,
             ur.user_id AS email,
             COALESCE(ap.weekly_digest_enabled, true) AS weekly_digest_enabled,
             COALESCE(ap.weekly_digest_email, true) AS weekly_digest_email,
             ur.timezone
      FROM user_role ur
      LEFT JOIN alert_preferences ap ON ap.user_id = ur.user_id
      WHERE ur.user_id LIKE '%@%'
        AND COALESCE(ur.email_unsubscribed, false) = false
        AND EXISTS (
          SELECT 1 FROM trade_journal tj
          WHERE tj.user_id = ur.user_id AND tj.created_at >= NOW() - INTERVAL '7 days'
        )
    `);

    // Bounded-concurrency sweep. Atomic dedupe-claim ordering preserved exactly:
    // every worker still does claim-INSERT FIRST, send second, mark-sent third.
    // p-limit only changes how many workers run in parallel.
    const pLimit = (await import("p-limit")).default;
    const limit = pLimit(Number(process.env.DIGEST_CONCURRENCY || 10));
    const counters = { sent: 0, skipped: 0 };

    await Promise.all(rows.map((row) => limit(async () => {
      if (row.weekly_digest_enabled === false || row.weekly_digest_email === false) { counters.skipped++; return; }

      const tz = row.timezone || "UTC";
      let local;
      try { local = getLocalDateAndHourAndDow(tz); }
      catch { local = getLocalDateAndHourAndDow("UTC"); }

      // Sundays only at configured hour
      if (!opts.force && (local.dow !== 0 || local.hour !== DIGEST_HOUR)) { counters.skipped++; return; }

      // Per-week dedupe via local date. We CLAIM the dedupe key atomically
      // BEFORE sending the email — this prevents (a) double-send when the
      // 30-min interval ticks twice within the 9am hour and (b) resends if
      // the marker INSERT fails after a successful email. Relies on the
      // partial unique index uq_notifications_dedupe on (user_id, type, dedupe_key).
      const dedupeKey = `weekly_digest:${local.date}`;
      const stats = await computeWeeklyStats(row.user_id);
      if (!stats) { counters.skipped++; return; }

      const claim = await pool.query(
        `INSERT INTO notifications
           (user_id, type, severity, title, body, payload, channel_in_app, channel_email, email_sent, dedupe_key)
         VALUES ($1, 'weekly_digest', 'low', $2, $3, $4, false, true, false, $5)
         ON CONFLICT (user_id, type, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          row.user_id,
          `Weekly performance — ${stats.total} trade${stats.total === 1 ? "" : "s"}`,
          `Win rate ${stats.winRate.toFixed(0)}%, net P/L ${stats.netPl >= 0 ? "+" : ""}${stats.netPl.toFixed(2)}.`,
          JSON.stringify(stats),
          dedupeKey,
        ],
      );
      if ((claim.rowCount ?? 0) === 0) { counters.skipped++; return; }

      const ok = await sendWeeklyPerformanceDigestEmail(row.email!, stats);
      if (ok) {
        await pool.query(`UPDATE notifications SET email_sent = true WHERE id = $1`, [claim.rows[0].id]).catch(() => {});
        counters.sent++;
      } else {
        // Email failed but we keep the marker — better to skip a week than spam.
        // Counted as skipped so observability reflects actual delivery, not claims.
        counters.skipped++;
      }
    })));
    checked = rows.length;
    sent = counters.sent;
    skipped = counters.skipped;
  } catch (e) {
    console.error("[WeeklyDigest] sweep error:", e);
  }
  return { checked, sent, skipped };
}

let started = false;
export function startWeeklyDigestScheduler() {
  if (started) return;
  started = true;
  setTimeout(async () => {
    try {
      const r = await runWeeklyDigestSweep();
      console.log(`[WeeklyDigest] initial sweep: checked=${r.checked} sent=${r.sent} skipped=${r.skipped}`);
    } catch {}
    setInterval(async () => {
      try {
        const r = await runWeeklyDigestSweep();
        if (r.sent > 0) console.log(`[WeeklyDigest] sweep: checked=${r.checked} sent=${r.sent} skipped=${r.skipped}`);
      } catch {}
    }, TICK_MS);
  }, 3 * 60 * 1000);
}
