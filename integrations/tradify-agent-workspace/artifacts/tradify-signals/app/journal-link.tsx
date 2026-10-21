import Feather from "@expo/vector-icons/Feather";
import {
  claimJournalProductLink,
  getJournalProductLink,
  previewJournalProductLink,
  unlinkJournalProductLink,
  customFetch,
} from "@workspace/api-client-react";
import { PageMetadata } from "@/components/PageMetadata";
import { Header, PrimaryButton, Screen, SectionTitle, SurfaceCard } from "@/components/TradifyUI";
import { useColors } from "@/hooks/useColors";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTradify } from "@/lib/tradify-store";

type LinkStatus = {
  state?: string;
  linkId?: string;
  signalsAttemptLabel?: string;
  journalAttemptLabel?: string;
  expiresAt?: string;
};
type FeedStatus = {
  state?: string;
  feedId?: string;
  bridge?: {
    connected?: boolean;
    activeSymbols?: string[];
    status?: string;
  };
};
const CONTRACT = "tradify-account-linking-v1";
const CONSENT = "tradify-signals-link-consent-v1";
const FEED_CONSENT = "tradify-journal-mt5-feed-consent-v1";
const CONSENT_COPY_APPROVED = true;
const JOURNAL_LABEL_PATTERN = /^JRN-[A-Z2-7]{12}$/;
const SIGNALS_LABEL_PATTERN = /^SIG-[A-Z2-7]{12}$/;

function isReviewablePair(status: LinkStatus): boolean {
  const expiresAt = status.expiresAt ? Date.parse(status.expiresAt) : Number.NaN;
  return Boolean(
    status.journalAttemptLabel &&
      JOURNAL_LABEL_PATTERN.test(status.journalAttemptLabel) &&
      status.signalsAttemptLabel &&
      SIGNALS_LABEL_PATTERN.test(status.signalsAttemptLabel) &&
      Number.isFinite(expiresAt) &&
      expiresAt > Date.now(),
  );
}

function formatDeadline(value: string): string {
  return new Date(value).toLocaleString();
}

export default function JournalLinkScreen() {
  const colors = useColors();
  const { authenticated } = useTradify();
  const [code, setCode] = useState("");
  const [consented, setConsented] = useState(false);
  const [status, setStatus] = useState<LinkStatus>({});
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking account-link availability…");
  const [feedStatus, setFeedStatus] = useState<FeedStatus>({});
  const [feedConsented, setFeedConsented] = useState(false);
  const [bridgeToken, setBridgeToken] = useState("");
  const [, setDeadlineRevision] = useState(0);

  useEffect(() => {
    const deadline = status.expiresAt ? Date.parse(status.expiresAt) : Number.NaN;
    if (!Number.isFinite(deadline)) return;
    const timer = setTimeout(
      () => setDeadlineRevision((revision) => revision + 1),
      Math.max(0, deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [status.expiresAt]);

  const pairIsReviewable =
    status.state === "awaiting_signals_consent" && isReviewablePair(status);
  const authorizationDeadline = pairIsReviewable
    ? formatDeadline(status.expiresAt!)
    : null;

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setMessage("Sign in to view your account-link status.");
      return;
    }
    try {
      const result = await getJournalProductLink();
      setStatus(result);
      setAvailable(true);
      setMessage("");
      if (result.state === "active") {
        try {
          const feed = await customFetch<FeedStatus>("/api/user/mt5-feed", { method: "GET" });
          setFeedStatus(feed);
        } catch {
          setFeedStatus({ state: "unavailable" });
        }
      } else {
        setFeedStatus({});
        setBridgeToken("");
      }
    } catch {
      setAvailable(false);
      setMessage("Account linking is not enabled while the two products complete technical review.");
    }
  }, [authenticated]);
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (action: "preview" | "claim" | "unlink") => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      let result: LinkStatus;
      if (action === "unlink" && status.linkId) {
        result = await unlinkJournalProductLink(status.linkId);
      } else {
        const body = { contractVersion: CONTRACT, authorizationCode: code.trim() } as const;
        result =
          action === "preview"
            ? await previewJournalProductLink(body)
          : consented
            ? await claimJournalProductLink({
              ...body,
              consent: true,
              consentVersion: CONSENT,
            })
            : status;
      }
      setStatus(result);
      setMessage(action === "preview"
        ? "Review both attempt labels below. Preview does not link accounts."
        : action === "claim"
          ? "Consent recorded. Journal confirmation is still required."
          : "Unlink requested. The connection stays unusable until revocation is acknowledged.");
      if (action !== "preview") setCode("");
    } catch {
      setMessage("The request could not be completed. No cross-service link was enabled; try again later.");
    } finally {
      setBusy(false);
      if (action !== "preview") await refresh();
    }
  };

  const enableCustomerFeed = async () => {
    if (!feedConsented || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await customFetch<FeedStatus & { bridgeToken?: string }>(
        "/api/user/mt5-feed/consent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent: true, consentVersion: FEED_CONSENT }),
        },
      );
      setFeedStatus(result);
      setBridgeToken(result.bridgeToken ?? "");
      setFeedConsented(false);
      setMessage("Your account-specific feed is authorized. Copy the feed token into MT5; it is shown only once.");
    } catch {
      setMessage("Feed authorization could not be completed. Confirm Journal is linked and try again.");
    } finally {
      setBusy(false);
    }
  };

  const revokeCustomerFeed = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await customFetch("/api/user/mt5-feed", { method: "DELETE" });
      setFeedStatus({ state: "revoked" });
      setBridgeToken("");
      setFeedConsented(false);
      setMessage("The customer feed token has been revoked.");
    } catch {
      setMessage("The feed could not be revoked. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageMetadata title="Tradify Journal account link" description="Review and manage your separate Tradify product account link." />
      <Header eyebrow="tradify products" title="Journal account link" />
      <SurfaceCard style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.heading}>
          <Feather name="link" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Separate accounts, optional connection</Text>
        </View>
        <Text style={[styles.copy, { color: colors.mutedForeground }]}>
          Linking does not merge accounts, share passwords, transfer subscriptions, or match accounts by email.
          You can unlink from either product. A pending unlink disables the connection until the other product confirms revocation.
        </Text>
        <Text accessibilityRole="text" testID="journal-link-status" style={[styles.status, { color: colors.foreground }]}>
          {status.state ? `Status: ${status.state.replaceAll("_", " ")}` : message}
        </Text>
        {pairIsReviewable ? (
          <View style={styles.labels}>
            <Text style={[styles.title, { color: colors.foreground }]}>Confirm these two accounts</Text>
            <Text style={[styles.copy, { color: colors.mutedForeground }]}>
              Compare both temporary pairing labels. They identify this request only; they do not reveal email addresses, internal account IDs, or other sensitive account details.
            </Text>
            <Text testID="journal-pair-label" style={[styles.label, { color: colors.foreground }]}>
              Journal: {status.journalAttemptLabel}
            </Text>
            <Text testID="signals-pair-label" style={[styles.label, { color: colors.foreground }]}>
              Signals: {status.signalsAttemptLabel}
            </Text>
            <Text testID="journal-pair-deadline" style={[styles.copy, { color: colors.mutedForeground }]}>
              Authorization expires {authorizationDeadline}. The original five-minute deadline is fixed; an expired request must be restarted in Journal.
            </Text>
          </View>
        ) : null}
      </SurfaceCard>
      <SectionTitle title="Start or review a link" />
      <SurfaceCard style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.copy, { color: colors.mutedForeground }]}>
          Enter the one-time authorization code created in Journal. Preview shows randomized pairing labels only; it does not create a link.
        </Text>
        <TextInput
          accessibilityLabel="Journal authorization code"
          testID="journal-link-code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          editable={available && !busy}
          placeholder="Paste the Journal code"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
        />
        <PrimaryButton label={busy ? "Working…" : "Preview account pairing"} testID="journal-link-preview" onPress={() => void run("preview")} disabled={!available || busy || !code.trim()} />
        {status.state === "awaiting_signals_consent" && !pairIsReviewable ? (
          <Text testID="journal-pair-invalid" style={[styles.copy, { color: colors.warning }]}>
            This pairing is missing a valid label or has expired. Start a new request in Journal.
          </Text>
        ) : null}
        {status.state === "awaiting_signals_consent" && pairIsReviewable ? (
          <>
            <Text testID="journal-link-consent-copy" style={[styles.copy, { color: colors.foreground }]}>
              By connecting these accounts, you authorize Journal and Signals to share only the temporary pairing labels, your consent record, link status, authorization deadline, and disconnect or revocation status needed to establish and manage this connection. You will continue signing in to each product separately, and subscriptions remain separate. This does not share passwords, email addresses, trading records, subscriptions, entitlements, or permissions. You can disconnect from either product; while disconnection is pending, the link is unusable until both products confirm revocation. This authorization expires at {authorizationDeadline}; if it expires, start again in Journal.
            </Text>
            <Pressable
              testID="journal-link-consent"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consented }}
              onPress={() => setConsented((value) => !value)}
              style={styles.consent}
            >
              <Feather name={consented ? "check-square" : "square"} size={19} color={colors.primary} />
              <Text style={[styles.copy, { color: colors.foreground }]}>
                I reviewed both pairing labels above and authorize connecting this account pair under these terms.
              </Text>
            </Pressable>
            <PrimaryButton label="Connect accounts" testID="journal-link-claim" onPress={() => void run("claim")} disabled={!CONSENT_COPY_APPROVED || !available || !consented || busy || !pairIsReviewable} />
          </>
        ) : null}
        {status.state === "active" ? (
          <>
            <PrimaryButton label="Unlink Journal account" testID="journal-link-revoke" onPress={() => void run("unlink")} disabled={!available || busy} />
            <SectionTitle title="Journal-linked MT5 feed" />
            <Text testID="customer-feed-status" style={[styles.copy, { color: colors.foreground }]}>
              {feedStatus.state === "active"
                ? `Feed ${feedStatus.feedId ?? "connected"} · ${feedStatus.bridge?.connected ? "connected" : "waiting for MT5"}`
                : "No customer MT5 feed is authorized for Signals."}
            </Text>
            {feedStatus.state === "active" ? (
              <>
                <Text style={[styles.copy, { color: colors.mutedForeground }]}>
                  This feed is dedicated to your linked account. Only your account can read its quotes, candles, and private evaluation previews. It cannot change Tradify’s shared reference feed or publish its previews as shared signals.
                </Text>
                {bridgeToken ? (
                  <Text
                    selectable
                    testID="customer-feed-token"
                    style={[styles.token, { color: colors.foreground, borderColor: colors.border }]}
                  >
                    FeedToken: {bridgeToken}
                  </Text>
                ) : null}
                <PrimaryButton
                  label="Revoke MT5 feed token"
                  testID="customer-feed-revoke"
                  onPress={() => void revokeCustomerFeed()}
                  disabled={busy}
                />
              </>
            ) : (
              <>
                <Text style={[styles.copy, { color: colors.mutedForeground }]}>
                  Authorize Signals to receive quotes and candles from the MT5 account connected to this Journal link. A separate token is created for this account, shown once, and never stored in readable form. It is not the shared bridge secret. You can revoke it at any time.
                </Text>
                <Pressable
                  testID="customer-feed-consent"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: feedConsented }}
                  onPress={() => setFeedConsented((value) => !value)}
                  style={styles.consent}
                >
                  <Feather name={feedConsented ? "check-square" : "square"} size={19} color={colors.primary} />
                  <Text style={[styles.copy, { color: colors.foreground }]}>
                    I authorize this Journal-linked MT5 feed for my Signals account.
                  </Text>
                </Pressable>
                <PrimaryButton
                  label={busy ? "Working…" : "Authorize customer feed"}
                  testID="customer-feed-authorize"
                  onPress={() => void enableCustomerFeed()}
                  disabled={!available || !feedConsented || busy}
                />
              </>
            )}
          </>
        ) : status.state === "revocation_pending" ? (
          <PrimaryButton label="Refresh revocation status" testID="journal-link-refresh" onPress={() => void refresh()} disabled={!available || busy} />
        ) : null}
        <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 13 },
  heading: { flexDirection: "row", alignItems: "center", gap: 9 },
  title: { fontSize: 15, fontWeight: "800" },
  copy: { fontSize: 12, lineHeight: 18 },
  status: { fontSize: 13, fontWeight: "700", lineHeight: 19 },
  labels: { gap: 6, padding: 10, borderRadius: 10, backgroundColor: "#14253a" },
  label: { fontSize: 12, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13 },
  consent: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  token: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 18 },
  message: { fontSize: 12, lineHeight: 18 },
});
