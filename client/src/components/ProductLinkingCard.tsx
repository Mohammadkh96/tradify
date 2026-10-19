import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, RefreshCw, ShieldCheck, Unlink2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API = "/api/v1/product-links/signals";
const CONTRACT_VERSION = "tradify-account-linking-v1";
const INITIATION_CONSENT_VERSION = "tradify-journal-link-initiation-v1";
const CONFIRMATION_CONSENT_VERSION = "tradify-journal-link-confirmation-v1";

type ProductLinkStatus = {
  state:
    | "unlinked"
    | "awaiting_signals_consent"
    | "awaiting_journal_confirmation"
    | "active"
    | "revocation_pending"
    | "revoked"
    | "expired"
    | "cancelled";
  linkId?: string;
  journalAttemptLabel?: string;
  signalsAttemptLabel?: string;
  expiresAt?: string;
  linkedAt?: string;
  revokedAt?: string;
  eventId?: string;
};

type Authorization = {
  code: string;
  journalAttemptLabel: string;
  expiresAt: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("request_failed");
  return response.json() as Promise<T>;
}

export function ProductLinkingCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [initiationConsent, setInitiationConsent] = useState(false);
  const [confirmationConsent, setConfirmationConsent] = useState(false);
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [showCancelAuthorization, setShowCancelAuthorization] = useState(false);

  const configuration = useQuery({
    queryKey: [API, "configuration"],
    queryFn: () => getJson<{ enabled: boolean }>(`${API}/configuration`),
    retry: false,
    staleTime: 30_000,
  });

  const enabled = configuration.data?.enabled === true;
  const status = useQuery({
    queryKey: [API, "status"],
    queryFn: () => getJson<ProductLinkStatus>(API),
    enabled,
    retry: false,
    staleTime: 0,
  });
  const csrf = useQuery({
    queryKey: [API, "csrf"],
    queryFn: () => getJson<{ csrfToken: string }>(`${API}/csrf`),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!authorization) return;
    const remaining = new Date(authorization.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setAuthorization(null);
      return;
    }
    const timer = window.setTimeout(() => setAuthorization(null), remaining);
    return () => window.clearTimeout(timer);
  }, [authorization]);

  async function mutateLink(
    url: string,
    method: "POST" | "DELETE",
    body?: Record<string, unknown>,
  ): Promise<any> {
    const csrfToken = csrf.data?.csrfToken;
    if (!csrfToken) throw new Error("csrf_unavailable");
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 204) return null;
    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      const code = responseBody?.error?.code;
      if (code === "AUTHORIZATION_EXPIRED") throw new Error("authorization_expired");
      if (code === "LINKING_DISABLED") throw new Error("linking_disabled");
      throw new Error("request_failed");
    }
    return responseBody;
  }

  const startMutation = useMutation({
    mutationFn: () =>
      mutateLink(`${API}/authorization`, "POST", {
        contractVersion: CONTRACT_VERSION,
        consent: true,
        consentVersion: INITIATION_CONSENT_VERSION,
      }),
    onSuccess: (result) => {
      setAuthorization({
        code: result.authorizationCode,
        journalAttemptLabel: result.journalAttemptLabel,
        expiresAt: result.expiresAt,
      });
      setInitiationConsent(false);
      void queryClient.invalidateQueries({ queryKey: [API, "status"] });
    },
  });

  const cancelAuthorizationMutation = useMutation({
    mutationFn: () => mutateLink(`${API}/authorization`, "DELETE"),
    onSuccess: () => {
      setAuthorization(null);
      setShowCancelAuthorization(false);
      void queryClient.invalidateQueries({ queryKey: [API, "status"] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!status.data?.linkId) throw new Error("link_missing");
      return mutateLink(`${API}/confirm`, "POST", {
        contractVersion: CONTRACT_VERSION,
        linkId: status.data.linkId,
        consent: true,
        consentVersion: CONFIRMATION_CONSENT_VERSION,
      });
    },
    onSuccess: () => {
      setConfirmationConsent(false);
      void queryClient.invalidateQueries({ queryKey: [API, "status"] });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => {
      if (!status.data?.linkId) throw new Error("link_missing");
      return mutateLink(`${API}/${encodeURIComponent(status.data.linkId)}`, "DELETE");
    },
    onSuccess: () => {
      setConfirmationConsent(false);
      void queryClient.invalidateQueries({ queryKey: [API, "status"] });
    },
  });

  if (configuration.isLoading || !enabled) return null;

  const currentStatus = status.data;
  const activeError = startMutation.error || confirmMutation.error || unlinkMutation.error ||
    cancelAuthorizationMutation.error || status.error || csrf.error;
  const errorText = activeError instanceof Error && activeError.message === "authorization_expired"
    ? t("profile.productLinkExpired")
    : t("profile.productLinkError");

  return (
    <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="product-linking-card">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Link2 size={20} className="text-emerald-500" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-foreground uppercase italic tracking-tight font-black">
              {t("profile.productLinkTitle")}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-1">
              {t("profile.productLinkSubtitle")}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("profile.productLinkRefresh")}
            onClick={() => void queryClient.invalidateQueries({ queryKey: [API, "status"] })}
            disabled={status.isFetching}
          >
            {status.isFetching
              ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              : <RefreshCw size={16} aria-hidden="true" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {status.isLoading && (
          <p className="text-sm text-muted-foreground" role="status">
            {t("profile.productLinkLoading")}
          </p>
        )}

        {status.isError && (
          <p className="text-sm text-destructive" role="alert">{t("profile.productLinkError")}</p>
        )}

        {activeError && !status.isError && (
          <p className="text-sm text-destructive" role="alert">{errorText}</p>
        )}

        {currentStatus?.state === "active" && (
          <div className="space-y-4" aria-live="polite">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
              <ShieldCheck size={17} aria-hidden="true" />
              {t("profile.productLinkActive")}
            </p>
            <div className="rounded-lg border border-border bg-background p-4 text-sm space-y-2">
              <p>{t("profile.productLinkJournalAccount")}</p>
              <p><span className="text-muted-foreground">{t("profile.productLinkJournalLabel")}: </span><span className="font-mono">{currentStatus.journalAttemptLabel}</span></p>
              <p>{t("profile.productLinkSignalsAccount")}</p>
              <p><span className="text-muted-foreground">{t("profile.productLinkSignalsLabel")}: </span><span className="font-mono">{currentStatus.signalsAttemptLabel}</span></p>
            </div>
            <p className="text-xs text-muted-foreground">{t("profile.productLinkSeparateAccounts")}</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={unlinkMutation.isPending}>
                  {unlinkMutation.isPending
                    ? <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
                    : <Unlink2 size={16} className="mr-2" aria-hidden="true" />}
                  {t("profile.productLinkDisconnect")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("profile.productLinkDisconnectTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("profile.productLinkDisconnectDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => unlinkMutation.mutate()}>
                    {t("profile.productLinkDisconnect")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {currentStatus?.state === "revocation_pending" && (
          <p className="text-sm text-amber-500" role="status" aria-live="polite">
            {t("profile.productLinkDisconnectPending")}
          </p>
        )}

        {currentStatus?.state === "awaiting_journal_confirmation" && (
          <div className="space-y-4" aria-live="polite">
            <p className="text-sm font-semibold text-amber-500" role="status">
              {t("profile.productLinkStatePending")}
            </p>
            <p className="text-sm font-semibold">{t("profile.productLinkPairReviewTitle")}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("profile.productLinkPairReviewDescription")}
            </p>
            <div className="rounded-lg border border-border bg-background p-4 text-sm space-y-2">
              <p>{t("profile.productLinkJournalAccount")}</p>
              <p><span className="text-muted-foreground">{t("profile.productLinkJournalLabel")}: </span><span className="font-mono">{currentStatus.journalAttemptLabel}</span></p>
              <p>{t("profile.productLinkSignalsAccount")}</p>
              <p><span className="text-muted-foreground">{t("profile.productLinkSignalsLabel")}: </span><span className="font-mono">{currentStatus.signalsAttemptLabel}</span></p>
              {currentStatus.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  {t("profile.productLinkExpiresAt", {
                    time: new Date(currentStatus.expiresAt).toLocaleString(i18n.resolvedLanguage || i18n.language),
                  })}
                </p>
              )}
            </div>
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                checked={confirmationConsent}
                onChange={(event) => setConfirmationConsent(event.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-600"
              />
              <span>{t("profile.productLinkFinalConsent")}</span>
            </label>
            <Button
              type="button"
              onClick={() => confirmMutation.mutate()}
              disabled={!confirmationConsent || confirmMutation.isPending || !csrf.data}
            >
              {confirmMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />}
              {t("profile.productLinkConfirm")}
            </Button>
          </div>
        )}

        {currentStatus?.state === "awaiting_signals_consent" && !authorization && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-amber-500" role="status">
              {t("profile.productLinkStateAwaitingSignalsConsent")}
            </p>
            <p className="text-sm text-muted-foreground">{t("profile.productLinkAuthorizationLost")}</p>
            <AlertDialog open={showCancelAuthorization} onOpenChange={setShowCancelAuthorization}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline">{t("profile.productLinkCancelRequest")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("profile.productLinkCancelTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("profile.productLinkCancelDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancelAuthorizationMutation.mutate()}>
                    {t("profile.productLinkCancelRequest")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {authorization && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-amber-500" role="status">
              {t("profile.productLinkStateAwaitingSignalsConsent")}
            </p>
            <p className="text-sm text-muted-foreground">{t("profile.productLinkTransferInstructions")}</p>
            <div className="rounded-lg border border-border bg-background p-4 text-sm space-y-2">
              <p>{t("profile.productLinkJournalAccount")}</p>
              <p><span className="text-muted-foreground">{t("profile.productLinkJournalLabel")}: </span><span className="font-mono">{authorization.journalAttemptLabel}</span></p>
              <p className="text-xs text-muted-foreground">
                {t("profile.productLinkExpiresAt", {
                  time: new Date(authorization.expiresAt).toLocaleString(i18n.resolvedLanguage || i18n.language),
                })}
              </p>
            </div>
            <label htmlFor="product-link-authorization-code" className="block text-sm font-semibold">
              {t("profile.productLinkCodeLabel")}
            </label>
            <input
              id="product-link-authorization-code"
              type="text"
              autoComplete="off"
              spellCheck={false}
              readOnly
              value={authorization.code}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              aria-describedby="product-link-code-help"
            />
            <p id="product-link-code-help" className="text-xs text-muted-foreground">
              {t("profile.productLinkCodeHelp")}
            </p>
            <AlertDialog open={showCancelAuthorization} onOpenChange={setShowCancelAuthorization}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={cancelAuthorizationMutation.isPending}>
                  {t("profile.productLinkCancelRequest")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("profile.productLinkCancelTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("profile.productLinkCancelDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancelAuthorizationMutation.mutate()}>
                    {t("profile.productLinkCancelRequest")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {(currentStatus?.state === "unlinked" ||
          currentStatus?.state === "revoked" ||
          currentStatus?.state === "expired" ||
          currentStatus?.state === "cancelled") && !authorization && (
          <div className="space-y-4">
            <p className="text-sm font-semibold" role="status">
              {currentStatus.state === "revoked"
                ? t("profile.productLinkStateDisconnected")
                : t("profile.productLinkStateNotConnected")}
            </p>
            {currentStatus.state === "expired" && (
              <p className="text-sm text-muted-foreground" role="status">
                {t("profile.productLinkExpired")}
              </p>
            )}
            <p className="text-sm font-semibold">{t("profile.productLinkJournalAccount")}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("profile.productLinkConsentDisclosure")}
            </p>
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                checked={initiationConsent}
                onChange={(event) => setInitiationConsent(event.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-600"
              />
              <span>{t("profile.productLinkInitiationConsent")}</span>
            </label>
            <Button
              type="button"
              onClick={() => startMutation.mutate()}
              disabled={!initiationConsent || startMutation.isPending || !csrf.data}
            >
              {startMutation.isPending
                ? <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
                : <Link2 size={16} className="mr-2" aria-hidden="true" />}
              {t("profile.productLinkStart")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
