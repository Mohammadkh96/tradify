import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams, type Href } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageMetadata } from "@/components/PageMetadata";
import { useRequestPasswordReset } from "@workspace/api-client-react";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { BrandMark, TradifyBrand } from "@/components/TradifyBrand";
import { authFlowPalette as palette, designTokens } from "@/constants/colors";
import { usePressMotion } from "@/hooks/useMotion";
import { useTradify, type RegistrationResult } from "@/lib/tradify-store";

type AuthMode = "signin" | "register";
type FieldName = "displayName" | "email" | "password" | "consent";
type FieldErrors = Partial<Record<FieldName, string>>;
type RegistrationContinuation = Pick<RegistrationResult, "role" | "recovery">;

const validReturnTargets: Record<string, Href> = {
  profile: "/profile",
  feed: "/",
  onboarding: "/",
  alerts: "/alerts",
  membership: "/membership",
  watchlist: "/watchlist",
  trades: "/trades",
  performance: "/performance",
  notifications: "/notifications",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeAuthError(error: unknown, mode: AuthMode) {
  const message = error instanceof Error ? error.message : "";
  if (/network|offline|failed to fetch|fetch failed|timed?\s*out|econn|connection/i.test(message)) {
    return "We could not reach the sign-in service. Check your connection and try again.";
  }
  if (/invalid_credentials|401/i.test(message)) {
    return "That email and password do not match. Check them and try again.";
  }
  if (/email_in_use|409/i.test(message) && mode === "register") {
    return "An account with this email already exists. Try logging in instead.";
  }
  return mode === "register"
    ? "We could not create your account. Check your details and try again."
    : "We could not sign you in. Check your details and try again.";
}

type FormFieldProps = {
  label: string;
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  error?: string;
  helper?: string;
  inputRef: React.Ref<TextInput>;
  keyboardType?: "default" | "email-address";
  autoComplete?: "name" | "email" | "current-password" | "new-password";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: "next" | "done";
  editable?: boolean;
  rightAction?: React.ReactNode;
};

function AuthForm({ children }: { children: React.ReactNode }) {
  if (Platform.OS === "web") {
    return React.createElement(
      "form",
      { onSubmit: (event: React.FormEvent<HTMLFormElement>) => event.preventDefault() },
      children,
    );
  }
  return <View>{children}</View>;
}

function FormField({
  label,
  testID,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  inputRef,
  keyboardType = "default",
  autoComplete,
  autoCapitalize,
  autoCorrect,
  secureTextEntry = false,
  onSubmitEditing,
  returnKeyType = "next",
  editable = true,
  rightAction,
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, error && styles.inputWrapError]}>
        <TextInput
          ref={inputRef}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          selectionColor={palette.gold}
          style={[styles.input, rightAction ? styles.inputWithAction : null]}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          spellCheck={false}
          secureTextEntry={secureTextEntry}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          accessibilityLabel={label}
          accessibilityHint={error ? `Error: ${error}` : helper}
          accessibilityState={{ disabled: !editable }}
        />
        {rightAction}
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.fieldError}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
}

function LegalLink({
  label,
  testID,
  onPress,
}: {
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.legalLink} testID={testID}>
      <Text style={styles.legalLinkText}>{label}</Text>
    </Pressable>
  );
}

export default function AuthScreen({ initialMode = "signin" }: { initialMode?: AuthMode } = {}) {
  const params = useLocalSearchParams<{ returnTo?: string | string[]; mode?: string | string[] }>();
  const returnTo = firstParam(params.returnTo);
  const browserMode =
    Platform.OS === "web" && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("mode") ?? undefined
      : undefined;
  const requestedMode = firstParam(params.mode) ?? browserMode;
  const { signIn, register, billingRecovery } = useTradify();
  const passwordResetRequest = useRequestPasswordReset();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>(
    requestedMode === "register" ? "register" : initialMode,
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [busy, setBusy] = useState<"signing-in" | "registering" | "requesting-reset" | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [registrationContinuation, setRegistrationContinuation] =
    useState<RegistrationContinuation | null>(null);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const consentRef = useRef<View>(null);
  const contentWidth = Math.min(width, 480);

  useEffect(() => {
    if (requestedMode === "signin" || requestedMode === "register") {
      setMode(requestedMode);
    }
  }, [requestedMode]);

  useEffect(() => {
    if (Platform.OS === "web" || mode !== "register" || registrationContinuation) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setMode("signin");
      setFieldErrors({});
      setFormError("");
      return true;
    });
    return () => subscription.remove();
  }, [mode, registrationContinuation]);

  const replaceWithCleanDestination = (destination: Href) => {
    router.dismissAll();
    router.replace(destination);
  };

  const leaveAuth = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    replaceWithCleanDestination("/");
  };

  const finishAuthenticatedFlow = (
    role: "user" | "admin",
    recovery?: RegistrationResult["recovery"],
  ) => {
    if (recovery === "provider-deferred") {
      replaceWithCleanDestination("/membership");
      return;
    }
    if (returnTo === "admin" || role === "admin") {
      replaceWithCleanDestination("/profile");
      return;
    }
    const destination = returnTo ? validReturnTargets[returnTo] : undefined;
    if (destination) {
      replaceWithCleanDestination(destination);
      return;
    }
    if (router.canGoBack()) router.back();
    else replaceWithCleanDestination("/");
  };

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError("");
    setPasswordResetSent(false);
  };

  const focusFirstInvalid = (errors: FieldErrors) => {
    if (errors.displayName) nameRef.current?.focus();
    else if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
    else if (errors.consent) consentRef.current?.focus();
  };

  const validate = (validatingMode: AuthMode) => {
    const nextErrors: FieldErrors = {};
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Enter your password.";
    } else if (password.length < 6) {
      nextErrors.password = "Use a password with at least six characters.";
    }
    if (validatingMode === "register") {
      if (!displayName.trim()) nextErrors.displayName = "Enter a display name.";
      if (!consentAccepted)
        nextErrors.consent = "Review the linked information and confirm your consent.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusFirstInvalid(nextErrors);
      return false;
    }
    return true;
  };

  const submitSignIn = async () => {
    if (busy || !validate("signin")) return;
    setBusy("signing-in");
    setFormError("");
    try {
      const role = await signIn(email.trim(), password);
      finishAuthenticatedFlow(role);
    } catch (error) {
      setFormError(safeAuthError(error, "signin"));
    } finally {
      setBusy(null);
    }
  };

  const submitPasswordResetRequest = async () => {
    if (busy) return;
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setFieldErrors((current) => ({ ...current, email: "Enter a valid email address." }));
      setFormError("");
      emailRef.current?.focus();
      return;
    }
    setBusy("requesting-reset");
    setFormError("");
    setPasswordResetSent(false);
    try {
      await passwordResetRequest.mutateAsync({ data: { email: cleanEmail } });
      setPasswordResetSent(true);
    } catch {
      setFormError("We could not request a reset link right now. Try again shortly.");
    } finally {
      setBusy(null);
    }
  };

  const submitRegistration = async () => {
    if (busy || !validate("register")) return;
    setBusy("registering");
    setFormError("");
    try {
      const registration = (await register(email.trim(), password, displayName.trim())) as
        RegistrationResult | "user" | "admin";
      const role = typeof registration === "string" ? registration : registration.role;
      const recovery =
        typeof registration === "string"
          ? (billingRecovery ?? "already-recovered")
          : registration.recovery;
      const profileUpdateFailed =
        typeof registration === "string" ? false : registration.profileUpdateFailed === true;
      if (profileUpdateFailed) {
        setRegistrationContinuation({ role, recovery });
        return;
      }
      finishAuthenticatedFlow(role, recovery);
    } catch (error) {
      setFormError(safeAuthError(error, "register"));
    } finally {
      setBusy(null);
    }
  };

  const openLegal = () => router.push("/legal");
  const continueAfterRegistration = () => {
    if (registrationContinuation) {
      finishAuthenticatedFlow(registrationContinuation.role, registrationContinuation.recovery);
    }
  };

  const screenTop =
    Platform.OS === "web" ? Math.max(insets.top + 8, 67) : Math.max(insets.top, 8) + 8;
  const screenBottom =
    Platform.OS === "web" ? Math.max(insets.bottom + 6, 34) : Math.max(insets.bottom, 8) + 6;
  const isRegistering = mode === "register";

  return (
    <View style={[styles.screen, { paddingTop: screenTop, paddingBottom: screenBottom }]}>
      <PageMetadata
        title="Sign in"
        description="Sign in or create a Tradify Signals account to manage your own market alerts and preferences."
      />
      <View style={[styles.shell, { width: contentWidth }]}>
        <View style={styles.topbar}>
          <TradifyBrand />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              registrationContinuation
                ? "Continue to Tradify Signals"
                : isRegistering
                  ? "Back to sign in"
                  : "Back"
            }
            onPress={() => {
              if (registrationContinuation) continueAfterRegistration();
              else if (isRegistering) {
                setMode("signin");
                setFieldErrors({});
                setFormError("");
              } else leaveAuth();
            }}
            style={styles.backButton}
            testID="auth-back"
          >
            {registrationContinuation ? (
              <Feather name="arrow-right" size={19} color={palette.text} />
            ) : (
              <Feather name="arrow-left" size={19} color={palette.text} />
            )}
          </Pressable>
        </View>
        <KeyboardAwareScrollViewCompat
          style={styles.formScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <View style={styles.authContent}>
            {registrationContinuation ? (
              <View style={styles.successState} testID="registration-profile-update-warning">
                <View style={styles.successMark}>
                  <Feather name="check" size={22} color={palette.gold} />
                </View>
                <Text style={styles.successEyebrow}>ACCOUNT CREATED</Text>
                <Text style={styles.headline}>You’re ready to continue.</Text>
                <Text style={styles.description}>
                  Your account is ready, but we couldn’t save your display name. You can update it
                  later in Settings.
                </Text>
                <AuthButton
                  label="Continue to Tradify Signals"
                  onPress={continueAfterRegistration}
                  testID="auth-registration-continue"
                />
              </View>
            ) : (
              <>
                {isRegistering ? (
                  <Text style={styles.eyebrow}>YOUR NEXT CHAPTER</Text>
                ) : (
                  <View style={styles.authSymbol}>
                    <BrandMark size={31} />
                  </View>
                )}
                <Text accessibilityRole="header" style={styles.headline}>
                  {isRegistering ? "Make room for\na clearer view." : "Welcome back."}
                </Text>
                <Text style={styles.description}>
                  {isRegistering
                    ? "Create your Tradify Signals account."
                    : "Your markets. Your plans. All here."}
                </Text>

                <AuthForm>
                  {isRegistering ? (
                    <FormField
                      label="Display name"
                      testID="auth-display-name"
                      inputRef={nameRef}
                      value={displayName}
                      onChangeText={(value) => {
                        setDisplayName(value.slice(0, 80));
                        clearFieldError("displayName");
                      }}
                      placeholder="How should we call you?"
                      error={fieldErrors.displayName}
                      autoComplete="name"
                      autoCapitalize="words"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      editable={!busy}
                    />
                  ) : null}
                  <FormField
                    label="Email address"
                    testID="auth-email"
                    inputRef={emailRef}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      clearFieldError("email");
                    }}
                    placeholder="you@example.com"
                    error={fieldErrors.email}
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    editable={!busy}
                  />
                  <FormField
                    label="Password"
                    testID="auth-password"
                    inputRef={passwordRef}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      clearFieldError("password");
                    }}
                    placeholder={isRegistering ? "Create a password" : "Enter your password"}
                    error={fieldErrors.password}
                    helper={isRegistering ? "Use at least six characters." : undefined}
                    autoComplete={isRegistering ? "new-password" : "current-password"}
                    autoCapitalize="none"
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (isRegistering) void submitRegistration();
                      else void submitSignIn();
                    }}
                    editable={!busy}
                    rightAction={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                        accessibilityState={{ selected: showPassword }}
                        onPress={() => setShowPassword((shown) => !shown)}
                        style={styles.revealButton}
                        testID="auth-password-toggle"
                      >
                        <Text style={styles.revealText}>{showPassword ? "Hide" : "Show"}</Text>
                      </Pressable>
                    }
                  />
                  {!isRegistering && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={Boolean(busy)}
                      onPress={() => {
                        void submitPasswordResetRequest();
                      }}
                      style={styles.forgotPasswordButton}
                      testID="auth-forgot-password"
                    >
                      <Text style={styles.linkText}>
                        {busy === "requesting-reset" ? "Sending reset link…" : "Forgot password?"}
                      </Text>
                    </Pressable>
                  )}
                  {isRegistering ? (
                    <>
                      <View style={styles.consentRow}>
                        <Pressable
                          ref={consentRef}
                          accessibilityRole="checkbox"
                          accessibilityLabel="Agree to Terms, Privacy Notice, and risk information"
                          accessibilityHint={fieldErrors.consent}
                          accessibilityState={{ checked: consentAccepted }}
                          onPress={() => {
                            setConsentAccepted((accepted) => !accepted);
                            clearFieldError("consent");
                          }}
                          style={styles.checkboxButton}
                          testID="auth-consent"
                        >
                          <View
                            style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}
                          >
                            {consentAccepted ? (
                              <Feather name="check" size={13} color={palette.ink} />
                            ) : null}
                          </View>
                        </Pressable>
                        <Text style={styles.consentCopy}>
                          I agree to the linked Terms and Privacy Notice, and acknowledge the risk
                          information.
                        </Text>
                      </View>
                      <View style={styles.inlineLegalLinks}>
                        <LegalLink label="Terms" testID="auth-legal-terms" onPress={openLegal} />
                        <Text style={styles.legalSeparator}>·</Text>
                        <LegalLink
                          label="Privacy"
                          testID="auth-legal-privacy"
                          onPress={openLegal}
                        />
                        <Text style={styles.legalSeparator}>·</Text>
                        <LegalLink label="Risk" testID="auth-legal-risk" onPress={openLegal} />
                      </View>
                      {fieldErrors.consent ? (
                        <Text
                          accessibilityRole="alert"
                          accessibilityLiveRegion="polite"
                          style={styles.fieldError}
                        >
                          {fieldErrors.consent}
                        </Text>
                      ) : null}
                    </>
                  ) : null}

                  {formError ? (
                    <Text
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      style={styles.formError}
                      testID="auth-status"
                    >
                      {formError}
                    </Text>
                  ) : null}
                  {passwordResetSent ? (
                    <Text
                      accessibilityRole="text"
                      accessibilityLiveRegion="polite"
                      style={styles.formSuccess}
                      testID="auth-reset-status"
                    >
                      If an active account matches that email, we’ll send a secure reset link. It
                      expires in 20 minutes.
                    </Text>
                  ) : null}
                  <AuthButton
                    label={
                      busy === "signing-in"
                        ? "Logging in…"
                        : busy === "registering"
                          ? "Creating account…"
                          : isRegistering
                            ? "Create account"
                            : "Log in"
                    }
                    onPress={() => {
                      if (isRegistering) void submitRegistration();
                      else void submitSignIn();
                    }}
                    testID="auth-submit"
                    disabled={Boolean(busy)}
                    loading={Boolean(busy)}
                  />
                  <View style={styles.accountPrompt}>
                    <Text style={styles.promptText}>
                      {isRegistering ? "Already have an account?" : "New to Tradify?"}
                    </Text>
                    <Pressable
                      accessibilityRole="link"
                      disabled={Boolean(busy)}
                      onPress={() => {
                        setMode(isRegistering ? "signin" : "register");
                        setFieldErrors({});
                        setFormError("");
                      }}
                      style={styles.accountLink}
                      testID={isRegistering ? "auth-login-link" : "auth-register-link"}
                    >
                      <Text style={styles.linkText}>
                        {isRegistering ? "Log in" : "Create account"}
                      </Text>
                    </Pressable>
                  </View>
                </AuthForm>
              </>
            )}
          </View>
          <View style={styles.authBottom}>
            <View style={styles.legalLinks}>
              <LegalLink label="Terms" testID="auth-footer-terms" onPress={openLegal} />
              <Text style={styles.legalSeparator}>·</Text>
              <LegalLink label="Privacy" testID="auth-footer-privacy" onPress={openLegal} />
              <Text style={styles.legalSeparator}>·</Text>
              <LegalLink label="Risk" testID="auth-footer-risk" onPress={openLegal} />
            </View>
            <Text style={styles.riskNote}>
              Trading involves risk. Signals support your decisions; they do not guarantee results.
            </Text>
          </View>
        </KeyboardAwareScrollViewCompat>
      </View>
    </View>
  );
}

function AuthButton({
  label,
  onPress,
  testID,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const pressMotion = usePressMotion();
  return (
    <Animated.View style={[styles.authButtonMotion, pressMotion.animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: loading }}
        disabled={disabled}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        onPress={onPress}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && !disabled && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}
        testID={testID}
      >
        {loading ? <ActivityIndicator size="small" color={palette.ink} /> : null}
        <Text style={styles.primaryButtonText}>{label}</Text>
        {!loading ? <Feather name="arrow-right" size={18} color={palette.ink} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background, paddingHorizontal: 0 },
  shell: { flex: 1, alignSelf: "center" },
  topbar: {
    minHeight: designTokens.sizes.controlHeight,
    paddingHorizontal: designTokens.spacing.spacious,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: designTokens.sizes.touchTarget,
    height: designTokens.sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: designTokens.radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
  },
  formScroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: designTokens.spacing.spacious,
    paddingTop: designTokens.spacing.shell,
    paddingBottom: designTokens.spacing.xl,
  },
  authContent: { width: "100%", maxWidth: 432, alignSelf: "center", flexGrow: 1 },
  authSymbol: {
    width: 60,
    height: 60,
    borderRadius: designTokens.radii.card,
    backgroundColor: `${palette.gold}0D`,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    marginBottom: designTokens.spacing.spacious,
  },
  eyebrow: {
    color: palette.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 5,
    marginBottom: 13,
  },
  headline: {
    color: palette.text,
    fontFamily: "Inter_500Medium",
    fontSize: designTokens.typography.hero,
    lineHeight: designTokens.typography.heroLine,
    letterSpacing: -1.55,
  },
  description: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 11,
    marginBottom: 23,
  },
  field: { marginBottom: 15 },
  fieldLabel: {
    color: palette.muted,
    fontFamily: "Inter_500Medium",
    fontSize: designTokens.typography.meta,
    marginBottom: 7,
  },
  inputWrap: {
    minHeight: designTokens.sizes.inputHeight,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: designTokens.radii.input,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  inputWrapError: { borderColor: palette.error },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: palette.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  inputWithAction: { paddingRight: 0 },
  revealButton: {
    minWidth: 58,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  revealText: { color: palette.muted, fontFamily: "Inter_500Medium", fontSize: 10 },
  fieldError: {
    color: palette.error,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
  },
  helperText: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 6,
  },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 1 },
  checkboxButton: {
    minWidth: designTokens.sizes.touchTarget,
    minHeight: designTokens.sizes.touchTarget,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 3,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: designTokens.radii.tight,
    borderWidth: 1,
    borderColor: palette.reference,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: palette.gold, borderColor: palette.gold },
  consentCopy: {
    flex: 1,
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    lineHeight: 16,
    paddingTop: 3,
  },
  inlineLegalLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 44,
    marginTop: -1,
    marginBottom: 5,
  },
  legalLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  legalLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 2 },
  legalLinkText: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: designTokens.typography.caption,
    textDecorationLine: "underline",
    textDecorationColor: palette.muted,
  },
  legalSeparator: {
    color: palette.reference,
    fontFamily: "Inter_400Regular",
    fontSize: designTokens.typography.meta,
  },
  formError: {
    color: palette.error,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
    paddingVertical: 8,
  },
  formSuccess: {
    color: palette.teal,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
    paddingVertical: 8,
  },
  forgotPasswordButton: {
    minHeight: 44,
    alignSelf: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 3,
    marginTop: -7,
    marginBottom: 1,
  },
  authButtonMotion: { width: "100%" },
  primaryButton: {
    minHeight: designTokens.sizes.primaryButtonHeight,
    borderRadius: designTokens.radii.button,
    backgroundColor: palette.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  primaryButtonText: {
    color: palette.ink,
    fontFamily: "Inter_600SemiBold",
    fontSize: designTokens.typography.body,
  },
  buttonPressed: { opacity: 0.78 },
  buttonDisabled: { opacity: 0.68 },
  accountPrompt: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  promptText: { color: palette.muted, fontFamily: "Inter_400Regular", fontSize: 10 },
  accountLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 3 },
  linkText: {
    color: palette.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    textDecorationLine: "underline",
    textDecorationColor: palette.gold,
  },
  authBottom: {
    width: "100%",
    maxWidth: 432,
    alignSelf: "center",
    paddingTop: 16,
    paddingBottom: 2,
  },
  riskNote: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: designTokens.typography.caption,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 6,
  },
  successState: { flex: 1, justifyContent: "center", paddingBottom: 28 },
  successMark: {
    width: 52,
    height: 52,
    borderRadius: designTokens.radii.card,
    backgroundColor: `${palette.teal}14`,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 21,
  },
  successEyebrow: {
    color: palette.teal,
    fontFamily: "Inter_600SemiBold",
    fontSize: designTokens.typography.caption,
    letterSpacing: 1.8,
    marginBottom: 12,
  },
});
