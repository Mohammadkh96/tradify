import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { type PurchasesOffering, type PurchasesPackage } from "react-native-purchases";
import type { PaidMembershipTier } from "@/constants/membership";
import { useTradify } from "@/lib/tradify-store";
import { selectRevenueCatApiKey } from "@/lib/revenuecat-config";

interface SubscriptionContextValue {
  offering: PurchasesOffering | null;
  available: boolean;
  loading: boolean;
  purchasing: boolean;
  priceFor: (tier: PaidMembershipTier) => string | null;
  purchase: (tier: PaidMembershipTier) => Promise<void>;
  restore: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
let configured = false;

function apiKey() {
  return selectRevenueCatApiKey(Platform.OS, Boolean(Constants.expoGoConfig), {
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    testStore: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY,
  });
}

function packageFor(
  offering: PurchasesOffering | null,
  tier: PaidMembershipTier,
): PurchasesPackage | undefined {
  const identifier = tier === "Pro" ? "pro_monthly" : "vip_monthly";
  return offering?.availablePackages.find((item) => item.identifier === identifier);
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { authenticated, profile, syncMembershipStatus } = useTradify();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const key = apiKey();
  const available = authenticated && Boolean(key) && Platform.OS !== "web";

  useEffect(() => {
    if (!available || !key) {
      setOffering(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      if (!configured) {
        Purchases.configure({ apiKey: key });
        configured = true;
      }
      await Purchases.logIn(profile.id);
      const offerings = await Purchases.getOfferings();
      if (active) setOffering(offerings.current);
      await syncMembershipStatus();
    })()
      .catch(() => {
        if (active) setOffering(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [available, key, profile.id, syncMembershipStatus]);

  const purchase = useCallback(
    async (tier: PaidMembershipTier) => {
      const selectedPackage = packageFor(offering, tier);
      if (!selectedPackage) throw new Error("PLAN_UNAVAILABLE");
      setPurchasing(true);
      try {
        await Purchases.purchasePackage(selectedPackage);
        await syncMembershipStatus();
      } finally {
        setPurchasing(false);
      }
    },
    [offering, syncMembershipStatus],
  );

  const restore = useCallback(async () => {
    if (!available) throw new Error("BILLING_UNAVAILABLE");
    setPurchasing(true);
    try {
      await Purchases.restorePurchases();
      await syncMembershipStatus();
    } finally {
      setPurchasing(false);
    }
  }, [available, syncMembershipStatus]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      offering,
      available,
      loading,
      purchasing,
      priceFor: (tier) => packageFor(offering, tier)?.product.priceString ?? null,
      purchase,
      restore,
    }),
    [available, loading, offering, purchase, purchasing, restore],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("useSubscription must be used inside SubscriptionProvider");
  return value;
}
