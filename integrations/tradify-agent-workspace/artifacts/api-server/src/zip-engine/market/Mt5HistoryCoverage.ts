import type { BrokerTradingSessionSchedule } from "./MarketCatalog";
import { mt5ServerUtcOffsetSeconds } from "./CandleTime";

export interface MissingM15Interval {
  startUtc: number;
  endUtc: number;
}

export function isMt5SessionOpenAtUtc(
  utcTime: number,
  schedule: BrokerTradingSessionSchedule,
): boolean {
  const serverTime = utcTime + mt5ServerUtcOffsetSeconds(utcTime);
  const dayNumber = Math.floor(serverTime / 86_400);
  const dayOfWeek = ((dayNumber + 4) % 7 + 7) % 7;
  const secondsOfDay = serverTime - dayNumber * 86_400;
  const priorDayOfWeek = (dayOfWeek + 6) % 7;
  return schedule.sessions.some((session) => {
    if (session.dayOfWeek === dayOfWeek && session.toSeconds > session.fromSeconds) {
      return secondsOfDay >= session.fromSeconds && secondsOfDay < session.toSeconds;
    }
    if (session.dayOfWeek === dayOfWeek && session.toSeconds < session.fromSeconds) {
      return secondsOfDay >= session.fromSeconds;
    }
    return (
      session.dayOfWeek === priorDayOfWeek &&
      session.toSeconds < session.fromSeconds &&
      secondsOfDay < session.toSeconds
    );
  });
}

/**
 * Return broker-session M15 opens absent from a bounded UTC range.
 * The interval is half-open; a missing interval's end is the first open
 * following its last missing candle. This is a diagnostic/planning helper:
 * it never creates candle data.
 */
export function findMissingMt5M15Intervals(
  startUtc: number,
  endUtc: number,
  candleTimes: readonly number[],
  schedule: BrokerTradingSessionSchedule,
): MissingM15Interval[] {
  if (
    !Number.isSafeInteger(startUtc) ||
    !Number.isSafeInteger(endUtc) ||
    startUtc <= 0 ||
    endUtc <= startUtc ||
    startUtc % 900 !== 0 ||
    endUtc % 900 !== 0 ||
    endUtc - startUtc > 10 * 86_400 ||
    schedule.source !== "MT5_SYMBOL_INFO_SESSION_TRADE" ||
    schedule.serverUtcOffsetSeconds !== mt5ServerUtcOffsetSeconds(schedule.utcTime) ||
    !Number.isSafeInteger(schedule.serverTime) ||
    !Number.isSafeInteger(schedule.utcTime) ||
    schedule.serverTime - schedule.utcTime !== schedule.serverUtcOffsetSeconds ||
    schedule.sessions.length === 0 ||
    schedule.sessions.some(
      (session) =>
        !Number.isInteger(session.dayOfWeek) ||
        session.dayOfWeek < 0 ||
        session.dayOfWeek > 6 ||
        !Number.isInteger(session.fromSeconds) ||
        !Number.isInteger(session.toSeconds) ||
        session.fromSeconds < 0 ||
        session.fromSeconds >= 86_400 ||
        session.toSeconds < 0 ||
        session.toSeconds > 86_400 ||
        session.fromSeconds === session.toSeconds,
    )
  ) {
    throw new Error("Invalid M15 history range or unverified broker schedule.");
  }

  const present = new Set(
    candleTimes.filter(
      (time) =>
        Number.isSafeInteger(time) &&
        time >= startUtc &&
        time < endUtc &&
        time % 900 === 0,
    ),
  );
  const missing: number[] = [];
  const firstGridTime = Math.ceil(startUtc / 900) * 900;
  for (let utcTime = firstGridTime; utcTime < endUtc; utcTime += 900) {
    if (isMt5SessionOpenAtUtc(utcTime, schedule) && !present.has(utcTime)) missing.push(utcTime);
  }

  const intervals: MissingM15Interval[] = [];
  for (const time of missing) {
    const last = intervals.at(-1);
    if (last && last.endUtc === time) last.endUtc += 900;
    else intervals.push({ startUtc: time, endUtc: time + 900 });
  }
  return intervals;
}
