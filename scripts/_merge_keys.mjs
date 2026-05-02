import fs from "fs";
const ns = process.argv[2];
const keysFile = process.argv[3];
const target = "client/src/locales/en/common.json";
const j = JSON.parse(fs.readFileSync(target, "utf8"));
const incoming = JSON.parse(fs.readFileSync(keysFile, "utf8"));
j[ns] = { ...(j[ns] || {}), ...incoming };
fs.writeFileSync(target, JSON.stringify(j, null, 2) + "\n");
console.log(`Merged ${Object.keys(incoming).length} keys into '${ns}'`);
