import { forwardRef } from "react";

export type MilestoneCardVariant = "achievement" | "challenge" | "streak";

export interface AchievementCardData {
  achievementName: string;
  achievementDescription: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
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
}

export interface MilestoneShareCardProps {
  variant: MilestoneCardVariant;
  userName?: string;
  data: AchievementCardData | ChallengeCardData | StreakCardData;
}

const TIER_COLORS: Record<string, string> = {
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
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 28,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="#00D9A3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="16 7 22 7 22 13" stroke="#00D9A3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.05em", color: "#ffffff", textTransform: "uppercase" as const }}>
          TradifyApp
        </span>
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" as const }}>
        tradifyapp.com
      </span>
    </div>
  );
}

function MiniStatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${accent ? "rgba(0,217,163,0.2)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 10,
      padding: "13px 15px",
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase" as const,
        color: accent ? "#00D9A3" : "rgba(255,255,255,0.35)",
        marginBottom: 7,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 20,
        fontWeight: 900,
        color: accent ? "#00D9A3" : "#ffffff",
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

function AchievementBody({ data, userName }: { data: AchievementCardData; userName?: string }) {
  const tierColor = TIER_COLORS[data.tier] || TIER_COLORS.bronze;
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: `${tierColor}20`, border: `1px solid ${tierColor}44`,
          borderRadius: 100, padding: "4px 12px", marginBottom: 10,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: tierColor }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: tierColor, textTransform: "uppercase" as const }}>
            {data.tier} achievement
          </span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em", lineHeight: 1.1, textTransform: "uppercase" as const, marginBottom: 6 }}>
          {data.achievementName}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
          {data.achievementDescription}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <MiniStatBox label="XP EARNED" value={`+${data.xpEarned}`} accent />
        <MiniStatBox label="TOTAL XP" value={data.totalXp.toLocaleString()} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <MiniStatBox label="LEVEL" value={`${data.levelNumber} · ${data.levelName}`} />
        {(data.complianceStreak ?? 0) > 0 && (
          <MiniStatBox label="COMPLIANCE" value={`${data.complianceStreak}d streak`} />
        )}
      </div>
      {userName && (
        <div style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
          Earned by {userName}
        </div>
      )}
    </>
  );
}

function ChallengeBody({ data, userName }: { data: ChallengeCardData; userName?: string }) {
  const sym = data.currency === "EUR" ? "€" : data.currency === "GBP" ? "£" : "$";
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(0,217,163,0.1)", border: "1px solid rgba(0,217,163,0.28)",
          borderRadius: 100, padding: "4px 12px", marginBottom: 10,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D9A3" }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#00D9A3", textTransform: "uppercase" as const }}>
            challenge passed
          </span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em", lineHeight: 1.1, textTransform: "uppercase" as const, marginBottom: 6 }}>
          {data.firmName}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          {data.challengeName} · {sym}{parseInt(data.accountSize).toLocaleString()}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <MiniStatBox label="PROFIT" value={`+${data.profitPercent.toFixed(2)}%`} accent />
        <MiniStatBox label="DD USED" value={`${data.drawdownUsedPercent.toFixed(1)}%`} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <MiniStatBox label="TRADING DAYS" value={`${data.tradingDays}d`} />
        <MiniStatBox label="ACCOUNT SIZE" value={`${sym}${parseInt(data.accountSize).toLocaleString()}`} />
      </div>
      {userName && (
        <div style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
          Achieved by {userName}
        </div>
      )}
    </>
  );
}

function StreakBody({ data, userName }: { data: StreakCardData; userName?: string }) {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.28)",
          borderRadius: 100, padding: "4px 12px", marginBottom: 10,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fb923c" }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#fb923c", textTransform: "uppercase" as const }}>
            streak milestone
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 52, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.04em", lineHeight: 1 }}>
            {data.currentStreak}
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>days</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" as const }}>
          {STREAK_LABELS[data.streakType]}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <MiniStatBox label="BEST STREAK" value={`${data.longestStreak}d`} />
        <MiniStatBox label="TOTAL XP" value={data.totalXp.toLocaleString()} accent />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <MiniStatBox label="LEVEL" value={`${data.levelNumber} · ${data.levelName}`} />
      </div>
      {userName && (
        <div style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
          Tracked by {userName}
        </div>
      )}
    </>
  );
}

const MilestoneShareCard = forwardRef<HTMLDivElement, MilestoneShareCardProps>(
  function MilestoneShareCard({ variant, userName, data }, ref) {
    return (
      <div
        ref={ref}
        data-testid="milestone-share-card"
        style={{
          width: 480,
          background: "#0A0F1E",
          borderRadius: 20,
          padding: 32,
          display: "flex",
          flexDirection: "column" as const,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          position: "relative" as const,
          overflow: "hidden",
          border: "1px solid rgba(0,217,163,0.12)",
          boxSizing: "border-box" as const,
        }}
      >
        <div style={{
          position: "absolute" as const, top: 0, left: 0, right: 0, height: 3,
          background: "#00D9A3",
        }} />
        <div style={{
          position: "absolute" as const, top: -100, right: -100,
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,217,163,0.05) 0%, transparent 70%)",
          pointerEvents: "none" as const,
        }} />

        <LogoRow />

        <div style={{ flex: 1 }}>
          {variant === "achievement" && <AchievementBody data={data as AchievementCardData} userName={userName} />}
          {variant === "challenge" && <ChallengeBody data={data as ChallengeCardData} userName={userName} />}
          {variant === "streak" && <StreakBody data={data as StreakCardData} userName={userName} />}
        </div>

        <div style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: "0.2em",
          color: "rgba(0,217,163,0.5)",
          textTransform: "uppercase" as const,
        }}>
          YOUR RULES. ENFORCED.
        </div>
      </div>
    );
  }
);

export default MilestoneShareCard;
