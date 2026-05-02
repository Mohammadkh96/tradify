const fs = require('fs');
const path = require('path');
const keys = JSON.parse(fs.readFileSync(path.join(__dirname, '_diagrams_keys.json'), 'utf8'));
const langs = ['en','es','fr','de','zh','ar'];

function setNested(obj, dottedPath, value) {
  const parts = dottedPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

for (const lang of langs) {
  const file = path.join(__dirname, '..', 'client', 'src', 'locales', lang, 'common.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!j.widgets) j.widgets = {};
  if (!j.widgets.diagrams) j.widgets.diagrams = {};
  for (const [k, v] of Object.entries(keys[lang])) {
    setNested(j.widgets.diagrams, k, v);
  }
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
  console.log(`✓ ${lang}: merged ${Object.keys(keys[lang]).length} keys`);
}
