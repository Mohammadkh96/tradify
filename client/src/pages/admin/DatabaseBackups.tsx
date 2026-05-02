import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Database, RefreshCw, CheckCircle2, AlertTriangle, Clock, HardDrive, Calendar, PlayCircle, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BackupRow {
  id: number;
  runAt: string;
  status: "success" | "failure";
  storageKey: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
  isMonthly: boolean;
  trigger: string;
  errorMessage: string | null;
  restoreVerifiedAt: string | null;
  restoreVerifiedStatus: "success" | "failure" | null;
  restoreVerifiedMessage: string | null;
}

interface VerifyResponse {
  backupId: number | null;
  status: "success" | "failure" | "skipped";
  message: string;
  storageKey: string | null;
}

interface BackupStatusResponse {
  latest: BackupRow | null;
  latestSuccess: BackupRow | null;
  latestFailure: BackupRow | null;
  consecutiveFailures: number;
  totalSuccessfulBackups: number;
  retention: { daily: number; monthly: number };
  recent: BackupRow[];
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
}

export default function DatabaseBackups() {
  const { toast } = useToast();
  const { data, isLoading, refetch, isFetching } = useQuery<BackupStatusResponse>({
    queryKey: ["/api/admin/backups/status"],
    refetchInterval: 60_000,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/backups/run");
      return res.json();
    },
    onSuccess: (result: BackupRow) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups/status"] });
      if (result.status === "success") {
        toast({
          title: "Backup completed",
          description: `Uploaded ${formatBytes(result.sizeBytes)} in ${formatDuration(result.durationMs)}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Backup failed",
          description: result.errorMessage || "Unknown error — check server logs.",
        });
      }
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Backup failed to start", description: err?.message || "Unknown error" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/backups/verify");
      return res.json() as Promise<VerifyResponse>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups/status"] });
      if (result.status === "success") {
        toast({ title: "Verification passed", description: result.message });
      } else if (result.status === "skipped") {
        toast({ title: "Verification skipped", description: result.message });
      } else {
        toast({
          variant: "destructive",
          title: "Verification FAILED",
          description: result.message,
        });
      }
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Verification failed to start", description: err?.message || "Unknown error" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <Skeleton className="h-32 w-full bg-slate-800" />
        <Skeleton className="h-64 w-full bg-slate-800" />
      </div>
    );
  }

  const latest = data?.latest ?? null;
  const latestSuccess = data?.latestSuccess ?? null;
  const consecutive = data?.consecutiveFailures ?? 0;
  const isHealthy = !!latestSuccess && consecutive === 0;
  const isStale = latestSuccess
    ? Date.now() - new Date(latestSuccess.runAt).getTime() > 36 * 60 * 60 * 1000
    : true;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
            <Database /> Database Backups
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">
            Daily Neon Snapshots · Off-Server Object Storage
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-backups"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            data-testid="button-verify-backup-now"
          >
            <ShieldCheck size={14} />
            {verifyMutation.isPending ? "Verifying..." : "Verify Now"}
          </Button>
          <Button
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            data-testid="button-run-backup-now"
          >
            <PlayCircle size={14} />
            {runMutation.isPending ? "Running..." : "Run Now"}
          </Button>
        </div>
      </div>

      {/* Health banner */}
      <Card
        className={
          isHealthy && !isStale
            ? "bg-emerald-500/5 border-emerald-500/30"
            : consecutive >= 2
            ? "bg-rose-500/10 border-rose-500/40"
            : "bg-amber-500/10 border-amber-500/40"
        }
      >
        <CardContent className="pt-6 flex items-center gap-4">
          {isHealthy && !isStale ? (
            <CheckCircle2 className="text-emerald-500 shrink-0" size={32} />
          ) : (
            <AlertTriangle className={consecutive >= 2 ? "text-rose-500 shrink-0" : "text-amber-500 shrink-0"} size={32} />
          )}
          <div data-testid="status-backup-health">
            {isHealthy && !isStale ? (
              <>
                <p className="font-bold text-foreground">Backups healthy</p>
                <p className="text-sm text-muted-foreground">
                  Last successful backup {formatRelative(latestSuccess!.runAt)} ({formatBytes(latestSuccess!.sizeBytes)}).
                </p>
              </>
            ) : consecutive >= 2 ? (
              <>
                <p className="font-bold text-rose-500">{consecutive} consecutive failures — production data at risk</p>
                <p className="text-sm text-muted-foreground">
                  Investigate immediately. Latest error: {data?.latestFailure?.errorMessage?.slice(0, 200) || "(see logs)"}
                </p>
              </>
            ) : isStale && latestSuccess ? (
              <>
                <p className="font-bold text-amber-500">Last successful backup is stale</p>
                <p className="text-sm text-muted-foreground">
                  More than 36 hours ago ({formatRelative(latestSuccess.runAt)}). The next scheduled run should restore health.
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-amber-500">No successful backups recorded yet</p>
                <p className="text-sm text-muted-foreground">
                  Click "Run Now" to capture the first snapshot, or wait for the next scheduled run (03:30 UTC daily).
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Clock size={12} /> Last Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground" data-testid="text-last-run">
              {latest ? formatRelative(latest.runAt) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {latest ? new Date(latest.runAt).toUTCString() : "No runs yet"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <CheckCircle2 size={12} /> Last Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latest ? (
              <Badge
                variant={latest.status === "success" ? "default" : "destructive"}
                className={latest.status === "success" ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" : ""}
                data-testid="badge-last-status"
              >
                {latest.status.toUpperCase()}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {latest?.trigger ?? ""} {latest?.isMonthly ? "· monthly" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <HardDrive size={12} /> Last Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground" data-testid="text-last-size">
              {formatBytes(latestSuccess?.sizeBytes ?? null)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {latestSuccess ? formatDuration(latestSuccess.durationMs) : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Calendar size={12} /> Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">
              {data?.totalSuccessfulBackups ?? 0}
              <span className="text-sm text-muted-foreground ml-2 font-normal">stored</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.retention.daily ?? 30} daily + {data?.retention.monthly ?? 12} monthly
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Restore verification banner */}
      {(() => {
        const v = latestSuccess?.restoreVerifiedStatus ?? null;
        const at = latestSuccess?.restoreVerifiedAt ?? null;
        const msg = latestSuccess?.restoreVerifiedMessage ?? null;
        const cls =
          v === "success"
            ? "bg-emerald-500/5 border-emerald-500/30"
            : v === "failure"
            ? "bg-rose-500/10 border-rose-500/40"
            : "bg-slate-500/5 border-slate-500/30";
        const Icon = v === "success" ? ShieldCheck : v === "failure" ? ShieldAlert : ShieldQuestion;
        const tone =
          v === "success"
            ? "text-emerald-500"
            : v === "failure"
            ? "text-rose-500"
            : "text-slate-400";
        return (
          <Card className={cls} data-testid="card-restore-verification">
            <CardContent className="pt-6 flex items-center gap-4">
              <Icon className={`${tone} shrink-0`} size={32} />
              <div className="flex-1">
                {v === "success" && at ? (
                  <>
                    <p className="font-bold text-foreground" data-testid="text-verification-status">
                      Latest backup verified restorable
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-verification-detail">
                      {formatRelative(at)} · {msg || "structural checks passed"}
                    </p>
                  </>
                ) : v === "failure" && at ? (
                  <>
                    <p className="font-bold text-rose-500" data-testid="text-verification-status">
                      Latest backup failed verification
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-verification-detail">
                      {formatRelative(at)} · {msg || "see logs"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-foreground" data-testid="text-verification-status">
                      Latest backup not yet verified
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-verification-detail">
                      Click "Verify Now" to validate, or wait for the weekly check (Sundays 04:30 UTC).
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Latest error */}
      {data?.latestFailure && (
        <Card className="bg-card border-border" data-testid="card-latest-error">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-rose-500 flex items-center gap-2">
              <AlertTriangle size={14} /> Latest Failure ({formatRelative(data.latestFailure.runAt)})
            </CardTitle>
            <CardDescription>{new Date(data.latestFailure.runAt).toUTCString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded-md text-rose-400 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
              {data.latestFailure.errorMessage || "(no error message)"}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Recent runs table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground">
            Recent Runs
          </CardTitle>
          <CardDescription>Last 10 backup attempts (scheduled and manual).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">When</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Status</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Trigger</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Size</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Duration</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Verified</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Storage Key</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.recent ?? []).map((row) => (
                <TableRow key={row.id} className="border-border hover:bg-muted/40" data-testid={`row-backup-${row.id}`}>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {new Date(row.runAt).toISOString().replace("T", " ").slice(0, 19)}Z
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.status === "success" ? "default" : "destructive"}
                      className={row.status === "success" ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" : ""}
                    >
                      {row.status}
                    </Badge>
                    {row.isMonthly && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        monthly
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.trigger}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatBytes(row.sizeBytes)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDuration(row.durationMs)}</TableCell>
                  <TableCell data-testid={`cell-verified-${row.id}`}>
                    {row.restoreVerifiedStatus === "success" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                        <ShieldCheck size={10} className="mr-1" /> verified
                      </Badge>
                    ) : row.restoreVerifiedStatus === "failure" ? (
                      <Badge variant="destructive" className="bg-rose-500/20 text-rose-500 border-rose-500/30">
                        <ShieldAlert size={10} className="mr-1" /> failed
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground break-all max-w-xs">
                    {row.storageKey || (row.errorMessage ? <span className="text-rose-400">{row.errorMessage.slice(0, 80)}</span> : "—")}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.recent?.length ?? 0) === 0 && (
                <TableRow className="border-border">
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic text-sm border-0">
                    No backup runs recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        Restoring a backup is intentionally a manual, server-side operation. See{" "}
        <code className="bg-muted px-1.5 py-0.5 rounded">docs/BACKUP_RESTORE.md</code> for the procedure.
      </p>
    </div>
  );
}
