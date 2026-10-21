import "./_group.css";
import {
  Activity,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  Compass,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  LifeBuoy,
  LogOut,
  Shield,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

const workspaceItems = [
  { icon: BarChart3, title: "Performance analytics", detail: "Win rate, expectancy and session edge" },
  { icon: Bell, title: "Notifications & alerts", detail: "Manage local signal notifications" },
  { icon: SlidersHorizontal, title: "Risk preferences", detail: "0.8% risk · 4 max trades" },
  { icon: CreditCard, title: "Membership", detail: "Pro plan · unlock deeper history" },
  { icon: FileText, title: "Data information", detail: "How market information is handled" },
];

function Brand() {
  return (
    <div className="flex items-center gap-[9px]" aria-label="Tradify Signals">
      <div className="flex h-8 w-8 -rotate-6 items-center justify-center gap-[2px] rounded-[10px] bg-[var(--signals-gold)]">
        <span className="h-[11px] w-[3px] rotate-[25deg] rounded-full bg-[var(--signals-ink)]" />
        <span className="h-5 w-[3px] rotate-[25deg] rounded-full bg-[var(--signals-ink)]" />
        <span className="h-[15px] w-[3px] rotate-[25deg] rounded-full bg-[var(--signals-ink)]" />
      </div>
      <div className="leading-none">
        <div className="text-[16px] font-medium tracking-[-.4px]">tradify</div>
        <div className="mt-[3px] text-[7px] font-semibold tracking-[2.2px] text-[var(--signals-muted)]">SIGNALS</div>
      </div>
    </div>
  );
}

function WorkspaceRow({ icon: Icon, title, detail }: { icon: typeof BarChart3; title: string; detail: string }) {
  return (
    <div className="flex min-h-[62px] items-center gap-3 border-b border-[var(--signals-border)] px-4 last:border-b-0">
      <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-xl bg-[var(--signals-raised)] text-[var(--signals-gold)]">
        <Icon size={16} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold leading-4">{title}</div>
        <div className="mt-[3px] text-[10px] leading-[14px] text-[var(--signals-muted)]">{detail}</div>
      </div>
      <ChevronRight size={17} className="shrink-0 text-[var(--signals-muted)]" />
    </div>
  );
}

export function ProductsProfile() {
  return (
    <div className="signals-products-root min-h-[100dvh] w-full">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[680px]">
        <main className="profile-content px-[18px] pb-[112px] pt-[max(28px,env(safe-area-inset-top))]">
          <header className="mb-[20px]">
            <div className="flex items-center justify-between">
              <Brand />
              <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--signals-border)] bg-[var(--signals-surface)] text-[var(--signals-muted)]">
                <UserRound size={18} />
              </div>
            </div>
            <div className="mt-[19px] text-[10px] font-semibold uppercase tracking-[1.25px] text-[var(--signals-muted)]">
              account &amp; preferences
            </div>
            <h1 className="mt-[5px] text-[28px] font-bold leading-[34px] tracking-[-1px]">Profile</h1>
          </header>

          <section aria-label="Profile details" className="flex items-center gap-3 rounded-lg border border-[var(--signals-border)] bg-[var(--signals-surface)] p-4">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[var(--signals-gold)] text-[25px] font-extrabold text-[var(--signals-ink)]">
              M
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[17px] font-bold tracking-[-.35px]">Morgan Ellis</div>
              <div className="mt-1 truncate text-[11px] text-[var(--signals-muted)]">morgan.ellis@example.com</div>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[rgba(85,180,144,.12)] px-2 py-[4px] text-[9px] font-bold tracking-[.55px] text-[var(--signals-teal)]">
                <Check size={10} strokeWidth={2.5} /> PRO MEMBER
              </span>
            </div>
            <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--signals-muted)]">
              <UserRound size={16} />
            </div>
          </section>

          <div className="mt-[14px] flex min-h-[62px] w-full items-center gap-3 rounded-lg border border-[var(--signals-border)] bg-[var(--signals-surface)] px-4 text-left">
            <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-xl bg-[rgba(235,178,45,.12)] text-[var(--signals-gold)]">
              <LogOut size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-bold">Log out</span>
              <span className="mt-[3px] block text-[10px] text-[var(--signals-muted)]">End this session on this device</span>
            </span>
            <ChevronRight size={17} className="text-[var(--signals-muted)]" />
          </div>

          <section className="mt-[14px] flex items-center gap-3 rounded-lg border border-[var(--signals-border)] bg-[var(--signals-surface)] p-3">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[rgba(85,180,144,.12)] text-[var(--signals-teal)]">
              <Activity size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold">Market connection</div>
              <div className="mt-1 text-[10px] text-[var(--signals-muted)]">Connected · live prices available</div>
            </div>
            <span className="rounded-full bg-[rgba(85,180,144,.12)] px-2 py-[5px] text-[9px] font-bold tracking-[.5px] text-[var(--signals-teal)]">LIVE FEED</span>
          </section>

          <div className="mb-[9px] mt-[19px] flex items-center justify-between">
            <h2 className="text-[14px] font-bold tracking-[-.15px]">Tradify Products</h2>
            <span className="text-[9px] font-semibold uppercase tracking-[1px] text-[var(--signals-muted)]">More from Tradify</span>
          </div>
          <section aria-label="Tradify Products" className="overflow-hidden rounded-lg border border-[var(--signals-border)] bg-[var(--signals-surface)]">
            <div aria-label="Tradify Journal, destination pending confirmation" className="flex min-h-[66px] items-center gap-3 px-4 py-3">
              <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-xl bg-[var(--signals-raised)] text-[var(--signals-gold)]">
                <FileText size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold">Tradify Journal</span>
                  <ExternalLink size={12} aria-label="External application" className="text-[var(--signals-muted)]" />
                </div>
                <p className="mt-[3px] text-[10px] leading-[14px] text-[var(--signals-muted)]">
                  A separate application. Sign in to each app separately.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-[var(--signals-border)] px-4 py-[9px]">
              <span className="h-[6px] w-[6px] rounded-full bg-[var(--signals-gold)]" />
              <span className="text-[9px] font-semibold tracking-[.2px] text-[var(--signals-gold)]">Destination pending confirmation</span>
            </div>
          </section>

          <div className="mb-[9px] mt-[19px] text-[14px] font-bold tracking-[-.15px]">Workspace</div>
          <section aria-label="Workspace" className="overflow-hidden rounded-lg border border-[var(--signals-border)] bg-[var(--signals-surface)]">
            {workspaceItems.map((item) => <WorkspaceRow key={item.title} {...item} />)}
          </section>

          <div className="mb-1 mt-[15px] flex items-center gap-2 text-[10px] text-[var(--signals-muted)]">
            <LifeBuoy size={13} />
            <span>Profile and settings are for this Signals account.</span>
          </div>
        </main>

        <nav aria-label="Main navigation" className="fixed bottom-[10px] left-1/2 z-10 flex h-[70px] w-[calc(100%-32px)] max-w-[648px] -translate-x-1/2 items-center justify-around rounded-[24px] border border-[var(--signals-border)] bg-[var(--signals-surface)] px-1 pt-1 shadow-[0_8px_24px_rgba(13,18,25,.35)]">
          {[
            { label: "Explore", icon: Compass },
            { label: "Watchlist", icon: Eye },
            { label: "Trades", icon: Shield },
            { label: "Stats", icon: BarChart3 },
            { label: "Alerts", icon: Bell },
          ].map(({ label, icon: Icon }) => (
            <div key={label} aria-label={label} className="nav-item flex h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-[4px] rounded-[17px] text-[var(--signals-muted)]">
              <Icon size={21} strokeWidth={1.9} />
              <span className="text-[9px] font-bold">{label}</span>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
