// Script to compare keys in en.json and es.json and print missing/extra keys
const fs = require('fs');

function flatten(obj, prefix = '') {
  let out = {};
  for (const k in obj) {
    const pre = prefix ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(out, flatten(obj[k], pre + k));
    } else {
      out[pre + k] = true;
    }
  }
  return out;
}

const en = JSON.parse(fs.readFileSync('src/app/[locale]/messages/en.json', 'utf8'));
const es = JSON.parse(fs.readFileSync('src/app/[locale]/messages/es.json', 'utf8'));

const enKeys = flatten(en);
const esKeys = flatten(es);

const missingInEn = Object.keys(esKeys).filter(k => !(k in enKeys));
const missingInEs = Object.keys(enKeys).filter(k => !(k in esKeys));

console.log('Missing in en.json:', missingInEn);
console.log('Missing in es.json:', missingInEs);
