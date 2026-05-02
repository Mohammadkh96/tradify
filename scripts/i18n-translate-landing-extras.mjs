import OpenAI from "openai";
import fs from "node:fs/promises";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const newEn = {
  notForYouBadge: "Honest disclaimer",
  notForYouH2Pre: "Tradify is",
  notForYouH2Highlight: "Not For You",
  notForYouH2Post: "If...",
  notForYouSub: "We'd rather lose a signup than have the wrong person frustrated. These aren't warnings — they're filters.",
  nfy1Head: "You trade without a defined strategy",
  nfy1Body: "Tradify enforces your rules. If you don't have rules yet, enforcement has nothing to work with. Build your edge first — then come back.",
  nfy2Head: "You plan to 'add discipline later'",
  nfy2Body: "Discipline that starts after the losses is damage control, not development. Tradify is for traders building the habit before they need it.",
  nfy3Head: "You want to override your rules mid-session",
  nfy3Body: "The platform is designed to hold you accountable, not negotiate with you. If you're looking for a system that bends, this isn't it.",
  nfy4Head: "You trade on impulse and consider it intuition",
  nfy4Body: "There's a difference between pattern recognition and gut-driven gambling. Tradify exists to help you tell them apart — only you can decide which one you're doing.",
  nfy5Head: "You want a journal that just logs entries",
  nfy5Body: "Tradify is not a logging tool. It's a behavioral system. If you want somewhere to write 'bought EURUSD, closed +20 pips', a spreadsheet will do.",
  nfy6Head: "You believe the problem is always the market",
  nfy6Body: "Markets are uncertain. Your process doesn't have to be. If you're not open to looking at your own behavior, no platform will move the needle for you.",
  ssDashboardAlt: "TradifyApp Dashboard — balance, win rate, rule compliance, equity curve, and prop challenge progress",
  ssPropFirmAlt: "Prop Firm Challenge Tracker — profit target, drawdown monitoring, consistency score, and days remaining",
  ssJournalAlt: "Trade Journal with rule validation — trade entries with emotion tracking and compliance status",
  ssAnalyticsAlt: "MT5 Analytics Bridge — multi-account sync, trade history, and performance metrics",
};

const langMeta = { es: "Spanish (Spain)", fr: "French (France)", de: "German", zh: "Simplified Chinese", ar: "Arabic (Modern Standard, RTL)" };

async function translateChunk(lang, payload) {
  const langName = langMeta[lang];
  const prompt = `Translate this UI JSON for TradifyApp into ${langName}. Return ONLY a JSON object with the SAME keys.
Rules: keep proper nouns ("TradifyApp", "Tradify", "MT5", "EURUSD", "FTMO", "Pro", "Elite") untranslated. Keep punctuation. Keep tone (serious, no-fluff, financial).
${lang === "ar" ? "Use Arabic punctuation '،' and natural RTL phrasing." : ""}
Source:
${JSON.stringify(payload, null, 2)}`;
  const r = await openai.chat.completions.create({
    model: "gpt-4o", response_format: { type: "json_object" }, temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(r.choices[0].message.content);
}

const langs = ["es", "fr", "de", "zh", "ar"];
const results = {};
await Promise.all(langs.map(async (l) => { results[l] = await translateChunk(l, newEn); }));
for (const l of langs) {
  const missing = Object.keys(newEn).filter(k => !(k in results[l]));
  console.log(`${l}: ${Object.keys(results[l]).length} keys, missing: ${missing.length}`);
}

async function patch(lang, add) {
  const path = `client/src/locales/${lang}/common.json`;
  const j = JSON.parse(await fs.readFile(path, "utf8"));
  j.landing = { ...j.landing, ...add };
  await fs.writeFile(path, JSON.stringify(j, null, 2) + "\n");
}
await patch("en", newEn);
for (const l of langs) await patch(l, results[l]);
console.log("Done");
