import { logger } from "./logger";
import { resolveDueNoShows, resolveDuePayouts } from "../routes/tradigo";

const DEFAULT_INTERVAL_MS = 60_000;

function workerIntervalMs(): number {
  const configured = Number(process.env.TRADIGO_NO_SHOW_WORKER_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 1_000 ? configured : DEFAULT_INTERVAL_MS;
}

export async function runNoShowWorker(): Promise<void> {
  try {
    const [noShowResult, payoutResult] = await Promise.all([
      resolveDueNoShows(),
      resolveDuePayouts(),
    ]);
    if (noShowResult.scanned > 0 || noShowResult.failed > 0 || payoutResult.scanned > 0 || payoutResult.failed > 0) {
      logger.info({ noShow: noShowResult, payouts: payoutResult }, "Tradigo settlement worker processed due work");
    }
  } catch (error) {
    logger.error({ err: error }, "Tradigo settlement worker run failed");
  }
}

export function startNoShowWorker(): NodeJS.Timeout {
  const interval = setInterval(() => {
    void runNoShowWorker();
  }, workerIntervalMs());
  interval.unref();
  void runNoShowWorker();
  logger.info({ intervalMs: workerIntervalMs() }, "No-show worker started");
  return interval;
}