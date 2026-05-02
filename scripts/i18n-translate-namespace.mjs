import OpenAI from "openai";
import fs from "fs";
import path from "path";

const namespace = process.argv[2];
if (!namespace) {
  console.error("Usage: node scripts/i18n-translate-namespace.mjs <namespace>");
  process.exit(1);
}

const OPENAI_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
if (!OPENAI_API_KEY) { console.error("Missing OPENAI key"); process.exit(1); }

const client = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL });

const LANG_NAMES = { es: "Spanish", fr: "French", de: "German", zh: "Simplified Chinese", ar: "Arabic" };
const LOCALES_DIR = "client/src/locales";

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJSON = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n");

async function translateBatch(lang, keys, enValues) {
  const prompt = `Translate these UI strings from English to ${LANG_NAMES[lang]} for TRADIFY (a trader's MT5 analytics app).

CRITICAL RULES:
1. Preserve placeholders EXACTLY: {{count}}, {{wins}}, {{losses}}, {{symbol}}, {{name}}, {{xp}}, {{level}}, {{account}}, {{number}}, {{shown}}, {{total}}, {{percent}}, etc.
2. Preserve symbols: P&L, %, $, →, /, &, R:R
3. Keep brand names untranslated: TRADIFY, MT5, AI, PRO, FREE, ELITE, XP, FOMO, EA, MQL5, RR, Forex
4. Use natural ${LANG_NAMES[lang]} for trading/finance terminology
5. Keep translations concise — UI buttons/labels need short text
6. Return ONLY a JSON object: {"key1":"translation1", ...}

Strings:
${JSON.stringify(Object.fromEntries(keys.map((k, i) => [k, enValues[i]])), null, 2)}`;

  const resp = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(resp.choices[0].message.content);
}

const CHUNK_SIZE = 60;

async function translateLang(lang, enNs) {
  console.log(`[${lang}] starting...`);
  const targetPath = path.join(LOCALES_DIR, lang, "common.json");
  const target = readJSON(targetPath);
  target[namespace] = target[namespace] || {};
  const allKeys = Object.keys(enNs);
  // Only translate missing OR same-as-english (=untranslated) keys
  const todoKeys = allKeys.filter((k) => !target[namespace][k] || target[namespace][k] === enNs[k]);
  if (todoKeys.length === 0) { console.log(`[${lang}] already complete`); return; }
  console.log(`[${lang}] ${todoKeys.length}/${allKeys.length} keys need translation`);

  for (let i = 0; i < todoKeys.length; i += CHUNK_SIZE) {
    const batch = todoKeys.slice(i, i + CHUNK_SIZE);
    const enValues = batch.map((k) => enNs[k]);
    let translated = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        translated = await translateBatch(lang, batch, enValues);
        break;
      } catch (e) {
        console.warn(`[${lang}] chunk ${i} attempt ${attempt + 1} failed: ${e.message}`);
        if (attempt === 2) translated = {};
      }
    }
    for (const k of batch) {
      if (translated[k]) target[namespace][k] = translated[k];
      else { console.warn(`[${lang}] missing: ${k}`); target[namespace][k] = enNs[k]; }
    }
    writeJSON(targetPath, target);
    console.log(`[${lang}] chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(todoKeys.length / CHUNK_SIZE)} done`);
  }
  console.log(`[${lang}] done — ${todoKeys.length} keys`);
}

async function main() {
  const enNs = readJSON(path.join(LOCALES_DIR, "en", "common.json"))[namespace];
  if (!enNs) { console.error(`Namespace '${namespace}' not in en/common.json`); process.exit(1); }
  await Promise.all(["es","fr","de","zh","ar"].map((l) => translateLang(l, enNs)));
  console.log(`All languages translated for namespace '${namespace}'.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
