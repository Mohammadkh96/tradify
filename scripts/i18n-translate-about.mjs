import OpenAI from "openai";
import fs from "node:fs/promises";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const newEnAbout = {
  badge: "Why We Exist",
  heroLine1: "Discipline is the",
  heroLine2: "edge.",
  heroSubtitle: "Most traders don't fail because of bad strategies — they fail because they can't stick to them. TradifyApp was built to solve that problem with data, rules, and accountability.",
  missionStatement: "To give every trader — from beginner to professional — the tools to understand their own performance, enforce their own rules, and improve through data instead of guesswork.",
  valueDiscFirstTitle: "Discipline First",
  valueDiscFirstDesc: "We don't sell signals, predictions, or shortcuts. TradifyApp is built around one principle: consistent execution of your own strategy leads to long-term results.",
  valueDataTitle: "Data Over Opinion",
  valueDataDesc: "Every insight on TradifyApp comes from your own trading data. We show you what happened, why it matters, and what patterns emerge — never what to do next.",
  valueEmpowerTitle: "Trader Empowerment",
  valueEmpowerDesc: "Our goal is to make you a better, more self-aware trader. We provide the mirror — you decide what to change. No dependency, no lock-in, no manipulation.",
  problemTitle: "The Problem We Saw",
  problemBody: "Most traders fail not because they lack strategy knowledge, but because they lack discipline. They overtrade, ignore their own rules, lose track of drawdowns, and make emotional decisions after losses. The tools available were either too complex, too expensive, or focused on the wrong things — like signals and predictions instead of self-improvement.",
  solutionTitle: "The Solution We Built",
  solutionBody: "TradifyApp is a discipline enforcement platform for traders who know their strategy works but struggle to follow it. Instead of telling you what to trade, we enforce the rules you already set. Instead of promising profits, we expose the behavioral patterns holding you back. Instead of complex setups, we auto-sync your trades from MT5 and do the analysis for you.",
  isNotTitle: "What TradifyApp Is NOT",
  isNot1: "Not a signal service or copy trading platform",
  isNot2: "Not an automated trading bot",
  isNot3: "Not a 'get rich quick' scheme",
  isNot4: "Not investment advice or financial guidance",
  isTitle: "What TradifyApp IS",
  is1: "A discipline enforcement platform with MT5 auto-sync",
  is2: "A rule validation and accountability system",
  is3: "A data-driven performance analytics tool",
  is4: "A prop firm challenge management system",
  philosophySubtitle: "Every design decision at TradifyApp is guided by these core principles.",
  phReadOnlyTitle: "Read-Only by Design",
  phReadOnlyDesc: "TradifyApp never accesses your broker credentials, never places trades, and never modifies orders. Our MT5 Expert Advisor is strictly read-only — it reads your trade data and nothing else. Your funds are never at risk from our platform.",
  phSecurityTitle: "Security First",
  phSecurityDesc: "We operate on a zero-trust architecture. User data is isolated, encrypted, and never shared with third parties. We don't store broker passwords. We don't have access to your trading capital. Period.",
  phAITitle: "Responsible AI",
  phAIDesc: "Our AI features analyze your historical performance data to surface patterns and insights. They never predict market direction, never recommend specific trades, and never make promises about future results. AI is explanatory, never directive.",
  phTransTitle: "Transparency Over Hype",
  phTransDesc: "We don't use fake testimonials, inflated statistics, or misleading marketing. Our pricing is clear, our features are honest, and our limitations are stated upfront. We believe trust is earned through transparency.",
  techTitle: "Technology &",
  techTitleHighlight: "Trust",
  techSubtitle: "Built with modern, reliable technology to ensure your data is always safe and your experience is always fast.",
  techCloud: "Cloud Infrastructure",
  techEncrypted: "Encrypted Data",
  techGlobal: "Global Access",
  techStack: "Modern Stack",
  commitmentTitle: "Our Commitment",
  commitmentBody: "TradifyApp is committed to providing accurate, unbiased, and reliable trading analytics. We will never compromise user data for profit, never sell trading signals disguised as analytics, and never make promises about trading outcomes. Our success is measured by how much more disciplined and self-aware our users become — not by how much they trade.",
  founderRole: "Founder & CEO",
  founderName: "TradifyApp Founder",
  founderTitleSub: "Trader & Technologist",
  founderBio1: "As a trader who experienced firsthand the frustration of inconsistent execution and lack of accountability tools, I built TradifyApp to solve the problems I faced every day. Too many platforms focus on giving traders signals and predictions — but the real edge comes from understanding your own behavior, enforcing your own rules, and learning from your own data.",
  founderBio2: "TradifyApp was born from the belief that trading success is a process, not a product. We're building the platform I wish existed when I started trading — one that respects traders' intelligence, protects their data, and helps them grow at their own pace.",
  founderQuote: "The best traders don't predict markets. They master themselves. TradifyApp is the tool that makes that mastery measurable.",
  ctaTitle: "Ready to trade with",
  ctaTitleHighlight: "discipline?",
  ctaSubtitle: "Join traders who are taking control of their performance with data-driven analytics, automated journaling, and real-time prop firm tracking.",
  ctaPrimary: "Start Free Now",
  ctaSecondary: "Explore Features",
};

const langMeta = {
  es: "Spanish (Spain)",
  fr: "French (France)",
  de: "German",
  zh: "Simplified Chinese",
  ar: "Arabic (Modern Standard, RTL)",
};

async function translateFor(lang) {
  const langName = langMeta[lang];
  const prompt = `You are a professional UI translator for a trading-discipline SaaS app called TradifyApp.
Translate the following English UI strings into ${langName}.

CRITICAL RULES:
1. Return ONLY a JSON object with the EXACT same keys as input.
2. Keep proper nouns ("TradifyApp", "MT5", "FTMO", "MyFundedFX", "AI", "P&L", "CSV") untranslated.
3. Preserve the tone: serious, expert, no-fluff, financial.
4. Keep punctuation feel (em-dashes, ellipses) where appropriate for the target language.
5. For very short labels (1-3 words), keep them concise.
6. Do not add quotation marks around values themselves.
${lang === "ar" ? "7. Arabic must read naturally right-to-left and use Arabic punctuation (e.g. comma '،')." : ""}

Source JSON:
${JSON.stringify(newEnAbout, null, 2)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });
  return [lang, JSON.parse(completion.choices[0].message.content)];
}

const langs = ["es", "fr", "de", "zh", "ar"];
console.log("Translating about.* into", langs.join(", "), "...");
const results = await Promise.all(langs.map(translateFor));
const translations = Object.fromEntries(results);

for (const [lang, obj] of results) {
  const missing = Object.keys(newEnAbout).filter((k) => !(k in obj));
  console.log(`  ${lang}: ${Object.keys(obj).length} keys, missing: ${missing.length}${missing.length ? " " + missing.join(",") : ""}`);
}

async function patchLocale(lang, addAbout) {
  const path = `client/src/locales/${lang}/common.json`;
  const json = JSON.parse(await fs.readFile(path, "utf8"));
  json.about = { ...json.about, ...addAbout };
  await fs.writeFile(path, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  wrote ${path}`);
}

await patchLocale("en", newEnAbout);
for (const lang of langs) {
  await patchLocale(lang, translations[lang]);
}
console.log("Done.");
