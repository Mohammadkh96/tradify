import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  registerExpoPushDevice,
  revokeExpoPushDevice,
} from "@workspace/api-client-react";

const TOKEN_STORAGE_PREFIX = "tradify-signals-expo-push-token-v1:";

function nativePlatform(): "ios" | "android" {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error("Native push registration is available only on iOS and Android.");
  }
  return Platform.OS;
}

function tokenStorageKey(userId: string): string {
  return `${TOKEN_STORAGE_PREFIX}${userId}`;
}

export async function registerNativePushToken(userId: string, pushToken: string): Promise<void> {
  const platform = nativePlatform();
  await SecureStore.setItemAsync(tokenStorageKey(userId), pushToken);
  try {
    await registerExpoPushDevice({ pushToken, platform });
  } catch (error) {
    await SecureStore.deleteItemAsync(tokenStorageKey(userId));
    throw error;
  }
}

export async function revokeNativePushToken(userId: string): Promise<void> {
  const pushToken = await SecureStore.getItemAsync(tokenStorageKey(userId));
  if (!pushToken) return;
  await revokeExpoPushDevice({ pushToken, platform: nativePlatform() });
  await SecureStore.deleteItemAsync(tokenStorageKey(userId));
}
