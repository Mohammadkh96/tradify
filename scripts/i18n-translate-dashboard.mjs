import OpenAI from "openai";
import fs from "fs";
import path from "path";

const OPENAI_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
if (!OPENAI_API_KEY) {
  console.error("Missing AI_INTEGRATIONS_OPENAI_API_KEY");
  process.exit(1);
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL });

const LANG_NAMES = {
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Simplified Chinese",
  ar: "Arabic",
};

const LOCALES_DIR = "client/src/locales";

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

async function translateBatch(lang, keys, enValues) {
  const prompt = `You are a professional UI translator. Translate these UI strings from English to ${LANG_NAMES[lang]} for a trader's dashboard application called TRADIFY.

CRITICAL RULES:
1. Preserve placeholders EXACTLY: {{count}}, {{wins}}, {{losses}}, {{symbol}}, {{name}}, {{xp}}, {{level}}, {{account}}
2. Preserve symbols/punctuation: P&L, %, $, →, /, &
3. Keep brand names untranslated: TRADIFY, MT5, AI, PRO, FREE, XP
4. Use natural ${LANG_NAMES[lang]} for trading/finance domain
5. Keep translations concise — UI buttons need short text
6. Return ONLY a JSON object: {"key1":"translation1", ...}

Strings to translate:
${JSON.stringify(Object.fromEntries(keys.map((k, i) => [k, enValues[i]])), null, 2)}`;

  const resp = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.choices[0].message.content;
  return JSON.parse(text);
}

async function translateLang(lang, enDashboard) {
  console.log(`[${lang}] starting...`);
  const targetPath = path.join(LOCALES_DIR, lang, "common.json");
  const target = readJSON(targetPath);
  target.dashboard = target.dashboard || {};

  const keys = Object.keys(enDashboard);
  const enValues = keys.map((k) => enDashboard[k]);

  const translated = await translateBatch(lang, keys, enValues);

  for (const k of keys) {
    if (translated[k]) target.dashboard[k] = translated[k];
    else {
      console.warn(`[${lang}] missing: ${k}`);
      target.dashboard[k] = enDashboard[k];
    }
  }

  writeJSON(targetPath, target);
  console.log(`[${lang}] done — ${keys.length} keys`);
  return lang;
}

async function main() {
  const enDashboard = readJSON(path.join(LOCALES_DIR, "en", "common.json")).dashboard;
  const langs = ["es", "fr", "de", "zh", "ar"];
  await Promise.all(langs.map((l) => translateLang(l, enDashboard)));
  console.log("All languages translated.");
}

main().catch((e) => { console.error(e); process.exit(1); });
