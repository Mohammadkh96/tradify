import { forwardRef } from "react";

export type MilestoneCardVariant = "achievement" | "challenge" | "streak";
export type TierType = "bronze" | "silver" | "gold" | "platinum";

export function parseTier(value: string): TierType {
  if (value === "bronze" || value === "silver" || value === "gold" || value === "platinum") {
    return value;
  }
  return "bronze";
}

export interface AchievementCardData {
  achievementName: string;
  achievementDescription: string;
  tier: TierType;
  xpEarned: number;
  totalXp: number;
  levelName: string;
  levelNumber: number;
  complianceStreak?: number;
}

export interface ChallengeCardData {
  challengeName: string;
  firmName: string;
  profitPercent: number;
  drawdownUsedPercent: number;
  tradingDays: number;
  accountSize: string;
  currency?: string;
}

export interface StreakCardData {
  streakType: "journaling" | "trading" | "compliance";
  currentStreak: number;
  longestStreak: number;
  levelName: string;
  levelNumber: number;
  totalXp: number;
  complianceRate?: number;
  accountHealth?: "healthy" | "caution" | "needs-attention";
}

export interface MilestoneShareCardProps {
  variant: MilestoneCardVariant;
  userName?: string;
  data: AchievementCardData | ChallengeCardData | StreakCardData;
}

const TIER_ACCENT: Record<TierType, string> = {
  bronze: "#b45309",
  silver: "#94a3b8",
  gold: "#d97706",
  platinum: "#06b6d4",
};

const STREAK_LABELS: Record<string, string> = {
  journaling: "ACTIVITY STREAK",
  trading: "TRADING STREAK",
  compliance: "COMPLIANCE STREAK",
};

function LogoRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="#00D9A3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="16 7 22 7 22 13" stroke="#00D9A3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "0.05em", color: "#ffffff", textTransform: "uppercase" as const }}>
          TradifyApp
        </span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" as const }}>
        tradifyapp.com
      </span>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${accent ? "rgba(0,217,163,0.25)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 16,
      padding: "28px 32px",
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase" as const,
        color: accent ? "#00D9A3" : "rgba(255,255,255,0.35)",
        marginBottom: 14,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 34,
        fontWeight: 900,
        color: accent ? "#00D9A3" : "#ffffff",
        letterSpacing: "-0.03em",
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

function identityLabel(userName: string | undefined, action: string): string {
  if (userName) return `${action} ${userName}`;
  return `${action} Trader#anon`;
}

function AchievementBody({ data, userName }: { data: AchievementCardData; userName?: string }) {
  const accentColor = TIER_ACCENT[data.tier];
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, flex: 1 }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: `${accentColor}20`, border: `1px solid ${accentColor}44`,
        borderRadius: 100, padding: "8px 20px", marginBottom: 28, alignSelf: "flex-start",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: accentColor }} />
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: accentColor, textTransform: "uppercase" as const }}>
          {data.tier} achievement
        </span>
      </div>

      <div style={{ fontSize: 56, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.03em", lineHeight: 1.05, textTransform: "uppercase" as const, marginBottom: 20 }}>
        {data.achievementName}
      </div>
      <div style={{ fontSize: 20, color: "rgba(255,255,255,0.45)", lineHeight: 1.4, marginBottom: 48 }}>
        {data.achievementDescription}
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <StatBox label="XP Earned" value={`+${data.xpEarned}`} accent />
        <StatBox label="Total XP" value={data.totalXp.toLocaleString()} />
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <StatBox label="Level" value={`${data.levelNumber}`} />
        <StatBox label="Rank" value={data.levelName} />
        {(data.complianceStreak ?? 0) > 0 && (
          <StatBox label="Streak" value={`${data.complianceStreak}d`} />
        )}
      </div>

      <div style={{ marginTop: 40, fontSize: 15, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
        {identityLabel(userName, "Earned by")}
      </div>
    </div>
  );
}

function ChallengeBody({ data, userName }: { data: ChallengeCardData; userName?: string }) {
  const sym = data.currency === "EUR" ? "€" : data.currency === "GBP" ? "£" : "$";
  const acctNum = parseInt(data.accountSize.replace(/[^\d]/g, "")) || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, flex: 1 }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "rgba(0,217,163,0.1)", border: "1px solid rgba(0,217,163,0.3)",
        borderRadius: 100, padding: "8px 20px", marginBottom: 28, alignSelf: "flex-start",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00D9A3" }} />
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: "#00D9A3", textTransform: "uppercase" as const }}>
          challenge passed
        </span>
      </div>

      <div style={{ fontSize: 56, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.03em", lineHeight: 1.05, textTransform: "uppercase" as const, marginBottom: 14 }}>
        {data.firmName}
      </div>
      <div style={{ fontSize: 20, color: "rgba(255,255,255,0.4)", marginBottom: 48 }}>
        {data.challengeName} · {sym}{acctNum.toLocaleString()}
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <StatBox label="Profit" value={`+${data.profitPercent.toFixed(2)}%`} accent />
        <StatBox label="DD Used" value={`${data.drawdownUsedPercent.toFixed(1)}%`} />
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <StatBox label="Trading Days" value={`${data.tradingDays}`} />
        <StatBox label="Account" value={`${sym}${acctNum.toLocaleString()}`} />
      </div>

      <div style={{ marginTop: 40, fontSize: 15, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
        {identityLabel(userName, "Achieved by")}
      </div>
    </div>
  );
}

const HEALTH_LABEL: Record<string, { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "#00D9A3" },
  caution: { label: "Caution", color: "#f59e0b" },
  "needs-attention": { label: "Needs Attention", color: "#f87171" },
};

function StreakBody({ data, userName }: { data: StreakCardData; userName?: string }) {
  const health = data.accountHealth ? HEALTH_LABEL[data.accountHealth] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, flex: 1 }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)",
        borderRadius: 100, padding: "8px 20px", marginBottom: 28, alignSelf: "flex-start",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fb923c" }} />
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: "#fb923c", textTransform: "uppercase" as const }}>
          streak milestone
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 14 }}>
        <span style={{ fontSize: 120, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.05em", lineHeight: 1 }}>
          {data.currentStreak}
        </span>
        <span style={{ fontSize: 36, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>days</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.16em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, marginBottom: 48 }}>
        {STREAK_LABELS[data.streakType]}
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <StatBox label="Compliance %" value={data.complianceRate != null ? `${Math.round(data.complianceRate)}%` : "—"} accent />
        <StatBox label="Best Streak" value={`${data.longestStreak}d`} />
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <StatBox label="Level" value={`${data.levelNumber} · ${data.levelName}`} />
        {health && (
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${health.color}33`,
            borderRadius: 16,
            padding: "28px 32px",
            flex: 1,
            minWidth: 0,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
              Account Health
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: health.color, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {health.label}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 40, fontSize: 15, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
        {identityLabel(userName, "Tracked by")}
      </div>
    </div>
  );
}

const MilestoneShareCard = forwardRef<HTMLDivElement, MilestoneShareCardProps>(
  function MilestoneShareCard({ variant, userName, data }, ref) {
    return (
      <div
        ref={ref}
        data-testid="milestone-share-card"
        style={{
          width: 1080,
          height: 1080,
          background: "#0A0F1E",
          borderRadius: 0,
          padding: 80,
          display: "flex",
          flexDirection: "column" as const,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          position: "relative" as const,
          overflow: "hidden",
          boxSizing: "border-box" as const,
        }}
      >
        <div style={{
          position: "absolute" as const, top: 0, left: 0, right: 0, height: 6,
          background: "#00D9A3",
        }} />
        <div style={{
          position: "absolute" as const, top: -200, right: -200,
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,217,163,0.04) 0%, transparent 70%)",
          pointerEvents: "none" as const,
        }} />

        <LogoRow />

        <div style={{ flex: 1, display: "flex", flexDirection: "column" as const }}>
          {variant === "achievement" && <AchievementBody data={data as AchievementCardData} userName={userName} />}
          {variant === "challenge" && <ChallengeBody data={data as ChallengeCardData} userName={userName} />}
          {variant === "streak" && <StreakBody data={data as StreakCardData} userName={userName} />}
        </div>

        <div style={{
          marginTop: 40,
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.22em",
          color: "rgba(0,217,163,0.45)",
          textTransform: "uppercase" as const,
        }}>
          YOUR RULES. ENFORCED.
        </div>
      </div>
    );
  }
);

export default MilestoneShareCard;
