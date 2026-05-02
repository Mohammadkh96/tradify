import OpenAI from "openai";
import fs from "node:fs/promises";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const newEnAuth = {
  setPasswordTitle: "Set Your Password",
  setPasswordSubtitle: "Create a secure password for your account",
  newPasswordLabel: "New Password",
  confirmPasswordLabel: "Confirm Password",
  pwRule8: "At least 8 characters",
  pwRuleUpper: "1 uppercase letter",
  pwRuleLower: "1 lowercase letter",
  pwRuleNumber: "1 number",
  setPasswordButton: "Set Password & Continue",
  foundingSecured: "Founding Member Secured",
  foundingPerksLine: "You're locked in. 1 month free Pro + 30% off your subscription, forever.",
  perk1MonthFree: "1 Month Free Pro",
  perk30Discount: "30% Lifetime Discount",
  perkEarlyAccess: "Early Feature Access",
  perkBadge: "Founding Badge",
  verifyEmailTitle: "Verify Your Email",
  verifyEmailSentTo: "We've sent a link to",
  verifyEmailActivate: "Click the link to activate your account.",
  verifyDidntReceive: "Didn't receive the email?",
  resendSending: "Sending...",
  resendButton: "Resend Verification Email",
  backToLogin: "Back to Login",
  resetPasswordTitle: "Reset Password",
  resetPasswordSubtitle: "Enter your email to receive a recovery link",
  emailAddressLabel: "Email Address",
  enterEmailPlaceholder: "Enter your email",
  sendRecoveryLink: "Send Recovery Link",
  brandHeadline: "Professional MT5 analytics and disciplined trading.",
  brandSubheading: "No hype. Just deterministic rule-based intelligence for serious traders.",
  loginH3: "Welcome back",
  signupH3: "Create your account",
  loginP: "Log in to your trading dashboard.",
  signupP: "Professional MT5 analytics and disciplined trading — no hype.",
  passwordLabelShort: "Password",
  termsLine: "By logging in, you agree to our",
  termsTermsLink: "Terms",
  termsPrivacyLink: "Privacy",
  termsRiskLink: "Risk Disclaimer",
  termsAnd: "and acknowledge the",
  agreeTermsService: "Terms of Service",
  agreePrivacyPolicy: "Privacy Policy",
  agreeRiskDisclaimer: "Risk Disclaimer",
  agreeTermsLine: "I agree to the",
  agreeAndAcknowledge: ", and acknowledge the",
  agreeFinalDot: ".",
};

const newEnPricing = {
  freePlanLabel: "Free",
  proPlanLabel: "Pro",
  elitePlanLabel: "Elite",
  popularBadge: "Popular",
  eliteBadge: "Elite",
  perForever: "/ Forever",
  perMonth: "/ Month",
  yearSuffix: "/yr",
  saveSuffix: "Save",
  trustTitle: "Trust",
};

const langMeta = {
  es: "Spanish (Spain)",
  fr: "French (France)",
  de: "German",
  zh: "Simplified Chinese",
  ar: "Arabic (Modern Standard, RTL)",
};

async function translateFor(lang, payload, namespace) {
  const langName = langMeta[lang];
  const prompt = `You are a professional UI translator for a trading-discipline SaaS app called TradifyApp.
Translate the following English UI strings (namespace: ${namespace}) into ${langName}.

CRITICAL RULES:
1. Return ONLY a JSON object with the EXACT same keys as input.
2. Keep proper nouns ("TradifyApp", "MT5", "FTMO", "MyFundedFX", "AI", "P&L", "CSV", "Pro", "Elite") untranslated.
3. Preserve the tone: serious, expert, no-fluff, financial.
4. Keep punctuation feel (em-dashes, ellipses) for the target language.
5. For very short labels (1-3 words), keep them concise.
6. Do not add quotation marks around values themselves.
7. Slashes (e.g. "/ Month") are intentional — keep similar separator format.
${lang === "ar" ? "8. Arabic must read naturally right-to-left and use Arabic punctuation (e.g. comma '،')." : ""}

Source JSON:
${JSON.stringify(payload, null, 2)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });
  return [lang, JSON.parse(completion.choices[0].message.content)];
}

const langs = ["es", "fr", "de", "zh", "ar"];

console.log("Translating auth.* additions...");
const authResults = await Promise.all(langs.map((l) => translateFor(l, newEnAuth, "auth")));
console.log("Translating pricing.* additions...");
const pricingResults = await Promise.all(langs.map((l) => translateFor(l, newEnPricing, "pricing")));

for (const [lang, obj] of authResults) {
  const missing = Object.keys(newEnAuth).filter((k) => !(k in obj));
  console.log(`  auth ${lang}: ${Object.keys(obj).length} keys, missing: ${missing.length}`);
}
for (const [lang, obj] of pricingResults) {
  const missing = Object.keys(newEnPricing).filter((k) => !(k in obj));
  console.log(`  pricing ${lang}: ${Object.keys(obj).length} keys, missing: ${missing.length}`);
}

async function patchLocale(lang, addAuth, addPricing) {
  const path = `client/src/locales/${lang}/common.json`;
  const json = JSON.parse(await fs.readFile(path, "utf8"));
  json.auth = { ...json.auth, ...addAuth };
  json.pricing = { ...json.pricing, ...addPricing };
  await fs.writeFile(path, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  wrote ${path}`);
}

await patchLocale("en", newEnAuth, newEnPricing);
const authMap = Object.fromEntries(authResults);
const pricingMap = Object.fromEntries(pricingResults);
for (const lang of langs) {
  await patchLocale(lang, authMap[lang], pricingMap[lang]);
}
console.log("Done.");
