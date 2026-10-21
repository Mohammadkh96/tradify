import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { PageMetadata } from "@/components/PageMetadata";
import { useColors } from "@/hooks/useColors";
import { Header, Screen } from "@/components/TradifyUI";
import { membershipPlan, membershipPlansFor, type MembershipTier } from "@/constants/membership";
import { useTradify } from "@/lib/tradify-store";
import { useSubscription } from "@/lib/revenuecat";
import {
  ApiError,
  RevenueCatBillingErrorError as RevenueCatBillingErrorCodes,
  type RevenueCatBillingError,
  type RevenueCatBillingErrorError,
} from "@workspace/api-client-react";

function planColor(plan: ReturnType<typeof membershipPlan>, colors: ReturnType<typeof useColors>) {
  return colors[plan.accent];
}

function billingErrorCode(error: unknown): RevenueCatBillingErrorError | null {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== "object") return null;
  const code = (error.data as Partial<RevenueCatBillingError>).error;
  const knownCodes = Object.values(RevenueCatBillingErrorCodes) as string[];
  return typeof code === "string" && knownCodes.includes(code)
    ? (code as RevenueCatBillingErrorError)
    : null;
}

export default function MembershipScreen() {
  const colors = useColors();
  const {
    profile,
    accessPolicy,
    billingStatus,
    billingExpiresAt,
    billingRecovery,
    retryBillingRecovery,
    syncMembershipStatus,
  } = useTradify();
  const { available, loading, purchasing, priceFor, purchase, restore } = useSubscription();
  const { width } = useWindowDimensions();
  const currentTier = profile.membership;
  const [selectedTier, setSelectedTier] = useState<MembershipTier>(
    currentTier === "Free" ? "Pro" : currentTier,
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<RevenueCatBillingErrorError | null>(null);
  const [retryingRecovery, setRetryingRecovery] = useState(false);
  const [retryingBilling, setRetryingBilling] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const plans = useMemo(() => membershipPlansFor(accessPolicy), [accessPolicy]);
  const selectedPlan = plans.find((plan) => plan.id === selectedTier) ?? plans[0];
  const currentPlan =
    plans.find((plan) => plan.id === currentTier) ?? membershipPlan(currentTier, accessPolicy);
  const selectedColor = planColor(selectedPlan, colors);
  const isCurrent = selectedTier === currentTier && billingStatus === "ACTIVE";
  const recoveryCopy =
    billingRecovery === "provider-deferred"
      ? "Your account is ready. Billing confirmation is waiting for provider access, so no paid access has been added yet."
      : billingRecovery === "recovered"
        ? "Billing recovery completed and your plan reflects server confirmation."
        : billingRecovery === "already-recovered"
          ? "Billing recovery was already complete. Your plan remains based on server confirmation."
          : null;

  const selectTier = (tier: MembershipTier) => {
    setNotice(null);
    setBillingError(null);
    setSelectedTier(tier);
  };

  const showBillingError = (
    error: unknown,
    fallback = "We could not update the membership. Your current access has not been changed; try again shortly.",
  ) => {
    const code = billingErrorCode(error);
    setBillingError(code);
    if (code === "AUTH_REQUIRED") {
      setNotice("Your billing session needs attention. Sign in again to verify your membership.");
    } else if (code === "USER_SUSPENDED") {
      setNotice("Your account is suspended. Contact Tradify support to restore billing access.");
    } else if (code === "BILLING_WEBHOOK_RETRY") {
      setNotice(
        "Billing confirmation is temporarily unavailable. Your current access has not been changed; try again shortly.",
      );
    } else {
      setNotice(fallback);
    }
  };

  const changeMembership = async () => {
    if (selectedTier === "Free" || isCurrent || saving || purchasing) return;
    setSaving(true);
    setNotice(null);
    setBillingError(null);
    try {
      await purchase(selectedTier);
      await syncMembershipStatus();
      setNotice(`${selectedPlan.id} is active after billing confirmation.`);
    } catch (error) {
      showBillingError(
        error,
        "We could not update the membership. Sign in with a server account and try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const selectedPrice = selectedTier === "Free" ? "$0" : priceFor(selectedTier);
  const retryRecovery = async () => {
    if (retryingRecovery) return;
    setRetryingRecovery(true);
    setNotice(null);
    try {
      const outcome = await retryBillingRecovery();
      setNotice(
        outcome === "provider-deferred"
          ? "The billing provider is still unavailable. We will not change your access until it confirms your subscription."
          : outcome === "recovered"
            ? "Billing recovery completed and your plan is now based on server confirmation."
            : "Billing recovery was already complete. Your plan remains based on server confirmation.",
      );
    } catch {
      setNotice(
        "We could not reach billing recovery right now. Your current access has not been changed; try again shortly.",
      );
    } finally {
      setRetryingRecovery(false);
    }
  };

  const retryBillingSync = async () => {
    if (retryingBilling) return;
    setRetryingBilling(true);
    try {
      await syncMembershipStatus();
      setBillingError(null);
      setNotice("Billing confirmation succeeded. Your plan now reflects server confirmation.");
    } catch (error) {
      showBillingError(error);
    } finally {
      setRetryingBilling(false);
    }
  };

  const restoreMembership = async () => {
    if (restoring) return;
    setRestoring(true);
    setNotice(null);
    setBillingError(null);
    try {
      await restore();
      setNotice("Purchases restored and verified by the server.");
    } catch (error) {
      showBillingError(
        error,
        "We could not restore purchases. Your current access has not been changed; try again shortly.",
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Screen>
      <PageMetadata
        title="Membership"
        description="Review membership access, current plan pricing, and billing options."
      />
      <Header eyebrow="membership · compare access" title="Signal Studio" />

      <View
        style={[styles.hero, { backgroundColor: colors.accent, borderColor: `${selectedColor}65` }]}
      >
        <View style={styles.heroTop}>
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: `${selectedColor}1c`, borderColor: `${selectedColor}55` },
            ]}
          >
            <Feather name={selectedPlan.icon} size={22} color={selectedColor} />
          </View>
          <View style={styles.heroStatus}>
            <Text style={[styles.heroStatusLabel, { color: colors.mutedForeground }]}>
              CURRENT PLAN
            </Text>
            <Text style={[styles.heroStatusValue, { color: colors.foreground }]}>
              {currentPlan.id}
            </Text>
          </View>
        </View>
        <Text style={[styles.heroEyebrow, { color: selectedColor }]}>{selectedPlan.eyebrow}</Text>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>{selectedPlan.tagline}</Text>
        <Text style={[styles.heroText, { color: colors.mutedForeground }]}>
          {selectedPlan.description}
        </Text>
        <View style={[styles.heroMeta, { borderTopColor: colors.border }]}>
          <View>
            <Text style={[styles.heroMetaLabel, { color: colors.mutedForeground }]}>SELECTED</Text>
            <Text style={[styles.heroMetaValue, { color: colors.foreground }]}>
              {selectedPlan.id}
            </Text>
          </View>
          <View style={[styles.heroMetaDivider, { backgroundColor: colors.border }]} />
          <View>
            <Text style={[styles.heroMetaLabel, { color: colors.mutedForeground }]}>BEST FOR</Text>
            <Text style={[styles.heroMetaValue, { color: colors.foreground }]}>
              {selectedPlan.bestFor}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>
            COMPARE MEMBERSHIPS
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            One radar. Three membership levels.
          </Text>
        </View>
        <Text style={[styles.sectionDetail, { color: colors.mutedForeground }]}>
          Review market, feature, and watchlist access for each membership.
        </Text>
      </View>

      <View style={[styles.planList, width >= 960 && styles.planListWide]}>
        {plans.map((plan) => {
          const active = plan.id === selectedTier;
          const current = plan.id === currentTier;
          const color = planColor(plan, colors);
          return (
            <Pressable
              key={plan.id}
              testID={`membership-plan-${plan.id.toLowerCase()}`}
              accessibilityRole="radio"
              accessibilityLabel={`${plan.id} membership, ${plan.id === "Free" ? "$0" : (priceFor(plan.id) ?? "price unavailable")}`}
              accessibilityState={{ selected: active }}
              onPress={() => selectTier(plan.id)}
              style={({ pressed }) => [
                styles.planCard,
                width >= 960 && styles.planCardWide,
                {
                  backgroundColor: colors.card,
                  borderColor: active ? `${color}9e` : colors.border,
                  opacity: pressed ? 0.86 : 1,
                },
                active && { backgroundColor: `${color}0d` },
              ]}
            >
              <View style={styles.planHeader}>
                <View style={styles.planIdentity}>
                  <View
                    style={[
                      styles.planIcon,
                      { backgroundColor: `${color}18`, borderColor: `${color}45` },
                    ]}
                  >
                    <Feather name={plan.icon} size={17} color={color} />
                  </View>
                  <View>
                    <View style={styles.planNameRow}>
                      <Text style={[styles.planName, { color: colors.foreground }]}>{plan.id}</Text>
                      {plan.id === "Pro" ? (
                        <Text
                          style={[
                            styles.popularPill,
                            {
                              color: colors.success,
                              backgroundColor: `${colors.success}18`,
                              borderColor: `${colors.success}45`,
                            },
                          ]}
                        >
                          POPULAR
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.planBestFor, { color: colors.mutedForeground }]}>
                      {plan.bestFor}
                    </Text>
                  </View>
                </View>
                <View style={styles.planPrice}>
                  <Text style={[styles.price, { color: colors.foreground }]}>
                    {plan.id === "Free" ? "$0" : (priceFor(plan.id) ?? "—")}
                  </Text>
                  <Text style={[styles.cadence, { color: colors.mutedForeground }]}>
                    {plan.cadence}
                  </Text>
                </View>
              </View>
              <Text style={[styles.planTagline, { color: colors.secondaryForeground }]}>
                {plan.tagline}
              </Text>
              <View style={[styles.planFooter, { borderTopColor: colors.border }]}>
                <Text
                  style={[styles.planAction, { color: active ? color : colors.mutedForeground }]}
                >
                  {current ? "CURRENT PLAN" : active ? "SELECTED" : "VIEW PLAN"}
                </Text>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: active ? color : colors.border,
                      backgroundColor: active ? color : "transparent",
                    },
                  ]}
                >
                  {active ? (
                    <Feather name="check" size={12} color={colors.primaryForeground} />
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.detailHeading}>
          <View>
            <Text style={[styles.sectionEyebrow, { color: selectedColor }]}>PLAN DETAILS</Text>
            <Text style={[styles.detailTitle, { color: colors.foreground }]}>
              {selectedPlan.id} includes
            </Text>
          </View>
          <Text style={[styles.detailPrice, { color: colors.foreground }]}>
            {selectedPrice ?? "Unavailable"}
            <Text style={[styles.detailPriceUnit, { color: colors.mutedForeground }]}>
              {" "}
              / {selectedPlan.cadence.replace("per ", "")}
            </Text>
          </Text>
        </View>
        <View style={styles.benefitList}>
          {selectedPlan.benefits.map((benefit) => (
            <View
              key={`${selectedPlan.id}-${benefit.label}`}
              style={[styles.benefitRow, { borderBottomColor: colors.border }]}
            >
              <View
                style={[
                  styles.benefitIcon,
                  { backgroundColor: benefit.included ? `${colors.success}18` : colors.secondary },
                ]}
              >
                <Feather
                  name={benefit.included ? "check" : "lock"}
                  size={13}
                  color={benefit.included ? colors.success : colors.mutedForeground}
                />
              </View>
              <View style={styles.benefitCopy}>
                <Text
                  style={[
                    styles.benefitLabel,
                    { color: benefit.included ? colors.foreground : colors.mutedForeground },
                  ]}
                >
                  {benefit.label}
                </Text>
                <Text style={[styles.benefitDetail, { color: colors.mutedForeground }]}>
                  {benefit.detail}
                </Text>
              </View>
              <Text
                style={[
                  styles.benefitState,
                  { color: benefit.included ? colors.success : colors.mutedForeground },
                ]}
              >
                {benefit.included ? "INCLUDED" : "LOCKED"}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {recoveryCopy ? (
        <View
          testID="billing-recovery-status"
          style={[
            styles.notice,
            { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}50` },
          ]}
        >
          <Feather
            name={billingRecovery === "provider-deferred" ? "clock" : "check-circle"}
            size={15}
            color={billingRecovery === "provider-deferred" ? colors.primary : colors.success}
          />
          <Text style={[styles.noticeText, { color: colors.foreground }]}>{recoveryCopy}</Text>
        </View>
      ) : null}
      {billingRecovery === "provider-deferred" ? (
        <Pressable
          testID="retry-billing-recovery"
          disabled={retryingRecovery}
          onPress={() => void retryRecovery()}
          style={({ pressed }) => [
            styles.recoveryRetry,
            { borderColor: colors.primary, opacity: pressed || retryingRecovery ? 0.72 : 1 },
          ]}
        >
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text style={[styles.recoveryRetryText, { color: colors.primary }]}>
            {retryingRecovery ? "Checking billing provider…" : "Try billing recovery again"}
          </Text>
        </Pressable>
      ) : null}
      {notice ? (
        <View
          testID="membership-notice"
          style={[
            styles.notice,
            { backgroundColor: `${selectedColor}12`, borderColor: `${selectedColor}50` },
          ]}
        >
          <Feather
            name={
              billingError
                ? "alert-triangle"
                : notice.includes("could not")
                  ? "alert-triangle"
                  : "check-circle"
            }
            size={15}
            color={billingError || notice.includes("could not") ? colors.warning : colors.success}
          />
          <Text style={[styles.noticeText, { color: colors.foreground }]}>{notice}</Text>
        </View>
      ) : null}
      {loading ? (
        <View
          testID="membership-billing-loading"
          accessibilityRole="progressbar"
          accessibilityLabel="Checking membership prices with the store"
          style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
            Checking store availability and current prices…
          </Text>
        </View>
      ) : null}
      {billingError === "AUTH_REQUIRED" ? (
        <Pressable
          testID="billing-sign-in"
          onPress={() => router.push("/auth")}
          style={({ pressed }) => [
            styles.recoveryRetry,
            { borderColor: colors.primary, opacity: pressed ? 0.72 : 1 },
          ]}
        >
          <Feather name="log-in" size={14} color={colors.primary} />
          <Text style={[styles.recoveryRetryText, { color: colors.primary }]}>Sign in again</Text>
        </Pressable>
      ) : null}
      {billingError === "BILLING_WEBHOOK_RETRY" ? (
        <Pressable
          testID="retry-billing-sync"
          disabled={retryingBilling}
          onPress={() => void retryBillingSync()}
          style={({ pressed }) => [
            styles.recoveryRetry,
            { borderColor: colors.primary, opacity: pressed || retryingBilling ? 0.72 : 1 },
          ]}
        >
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text style={[styles.recoveryRetryText, { color: colors.primary }]}>
            {retryingBilling ? "Checking billing provider…" : "Try billing confirmation again"}
          </Text>
        </Pressable>
      ) : null}

      <Text testID="billing-status" style={[styles.disclaimer, { color: colors.mutedForeground }]}>
        Billing: {billingStatus}
        {billingExpiresAt
          ? ` · access through ${new Date(billingExpiresAt).toLocaleDateString()}`
          : ""}
      </Text>
      <Pressable
        testID="upgrade-membership"
        accessibilityRole="button"
        accessibilityState={{
          disabled:
            isCurrent || selectedTier === "Free" || saving || loading || !available || !selectedPrice,
          busy: saving || purchasing,
        }}
        disabled={
          isCurrent || selectedTier === "Free" || saving || loading || !available || !selectedPrice
        }
        onPress={() => setConfirming(true)}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: isCurrent ? colors.secondary : selectedColor,
            borderColor: isCurrent ? colors.border : selectedColor,
            opacity: pressed || saving ? 0.72 : 1,
          },
        ]}
      >
        {saving ? (
          <ActivityIndicator
            size="small"
            color={isCurrent ? colors.mutedForeground : colors.primaryForeground}
          />
        ) : (
          <Feather
            name={isCurrent ? "check-circle" : "arrow-up-right"}
            size={16}
            color={isCurrent ? colors.mutedForeground : colors.primaryForeground}
          />
        )}
        <Text
          style={[
            styles.ctaText,
            { color: isCurrent ? colors.mutedForeground : colors.primaryForeground },
          ]}
        >
          {saving
            ? "Confirming billing…"
            : loading
              ? "Checking store availability…"
            : isCurrent
              ? `${currentTier} is active`
              : !available
                ? "Billing unavailable in preview"
                : `Continue with ${selectedTier}`}
        </Text>
      </Pressable>
      <Pressable
        testID="restore-membership"
        accessibilityRole="button"
        accessibilityState={{ disabled: restoring || purchasing, busy: restoring }}
        disabled={restoring || purchasing}
        onPress={() => void restoreMembership()}
        style={styles.back}
      >
        <Text style={[styles.backText, { color: colors.primary }]}>
          {restoring ? "Restoring purchases…" : "Restore purchases"}
        </Text>
      </Pressable>
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
        Paid access starts only after RevenueCat confirms the purchase. The server remains
        authoritative across devices.
      </Text>
      <Modal
        transparent
        visible={confirming}
        animationType="fade"
        onRequestClose={() => setConfirming(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: `${colors.background}CC` }]}>
          <View
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.detailTitle, { color: colors.foreground }]}>
              Confirm {selectedTier}
            </Text>
            <Text style={[styles.heroText, { color: colors.mutedForeground }]}>
              Continue to the store checkout for {selectedPrice ?? selectedTier} per month?
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirming(false)} style={styles.back}>
                <Text style={[styles.backText, { color: colors.mutedForeground }]}>Not now</Text>
              </Pressable>
              <Pressable
                testID="confirm-membership-purchase"
                onPress={() => {
                  setConfirming(false);
                  void changeMembership();
                }}
                style={[
                  styles.cta,
                  {
                    backgroundColor: selectedColor,
                    borderColor: selectedColor,
                    marginHorizontal: 0,
                    flex: 1,
                  },
                ]}
              >
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Pressable testID="membership-back" onPress={() => router.back()} style={styles.back}>
        <Text style={[styles.backText, { color: colors.primary }]}>Back to profile</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: 18, borderWidth: 1, borderRadius: 24, padding: 20, elevation: 2 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroStatus: { alignItems: "flex-end" },
  heroStatusLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  heroStatusValue: { fontSize: 17, fontWeight: "800", marginTop: 3 },
  heroEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 22 },
  heroTitle: { fontSize: 25, fontWeight: "800", marginTop: 6, letterSpacing: -0.7 },
  heroText: { fontSize: 12, lineHeight: 19, marginTop: 7 },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  heroMetaDivider: { width: 1, height: 24 },
  heroMetaLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  heroMetaValue: { fontSize: 12, fontWeight: "700", marginTop: 3 },
  sectionHeading: { marginHorizontal: 20, marginTop: 26, marginBottom: 13 },
  sectionEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, marginTop: 4 },
  sectionDetail: { fontSize: 11, lineHeight: 16, marginTop: 5 },
  planList: { gap: 10, marginHorizontal: 18 },
  planListWide: { flexDirection: "row", alignItems: "stretch" },
  planCard: { borderWidth: 1, borderRadius: 20, padding: 14 },
  planCardWide: { flex: 1 },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  planIdentity: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  planName: { fontSize: 16, fontWeight: "800" },
  popularPill: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  planBestFor: { fontSize: 10, marginTop: 2 },
  planPrice: { alignItems: "flex-end" },
  price: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  cadence: { fontSize: 9, marginTop: 1 },
  planTagline: { fontSize: 11, marginTop: 13 },
  planFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  planAction: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  radio: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCard: { margin: 18, marginTop: 22, borderWidth: 1, borderRadius: 22, padding: 16 },
  detailHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  detailTitle: { fontSize: 18, fontWeight: "800", marginTop: 4 },
  detailPrice: { fontSize: 18, fontWeight: "800" },
  detailPriceUnit: { fontSize: 10, fontWeight: "500" },
  benefitList: { marginTop: 12 },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  benefitIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitCopy: { flex: 1 },
  benefitLabel: { fontSize: 12, fontWeight: "700" },
  benefitDetail: { fontSize: 10, marginTop: 2 },
  benefitState: { fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
  notice: {
    marginHorizontal: 18,
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  recoveryRetry: {
    marginHorizontal: 18,
    marginTop: 10,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  recoveryRetryText: { fontSize: 12, fontWeight: "800" },
  cta: {
    marginHorizontal: 18,
    marginTop: 14,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { fontSize: 13, fontWeight: "800" },
  disclaimer: {
    marginHorizontal: 25,
    marginTop: 10,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 15,
  },
  back: { alignItems: "center", margin: 16, padding: 4 },
  backText: { fontSize: 12, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 24 },
  modalCard: { borderWidth: 1, borderRadius: 22, padding: 20 },
  modalActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18 },
});
