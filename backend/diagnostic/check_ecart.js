const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const csvPath = path.join(__dirname, '..', '..', 'data', 'articles_mabrouk.csv');
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.replace(/\r\n/g, '\n').split('\n').slice(1).filter(l => l.trim());

const codesCSV = new Set();
for (const line of lines) {
  const p = line.split(';');
  const code = (p[2] || '').trim();
  if (code) codesCSV.add(code);
}

const codesDB = new Set(
  db.prepare("SELECT code_article FROM articles").all().map(r => r.code_article)
);

console.log(`📊 CSV     : ${codesCSV.size} codes uniques`);
console.log(`📊 DB      : ${codesDB.size} codes uniques`);

const nouveauxCSV = [...codesCSV].filter(c => !codesDB.has(c));
const absentsDB  = [...codesDB].filter(c => !codesCSV.has(c));
const communs    = [...codesCSV].filter(c => codesDB.has(c));

console.log(`\n✅ Communs (CSV ∩ DB)     : ${communs.length}`);
console.log(`🆕 Nouveaux (dans CSV)     : ${nouveauxCSV.length}`);
console.log(`⚠️ Absents (dans DB seule) : ${absentsDB.length}`);

if (nouveauxCSV.length) {
  console.log(`\n🆕 Exemples nouveaux (5) :`);
  console.log(nouveauxCSV.slice(0, 5));
}
if (absentsDB.length) {
  console.log(`\n⚠️ Exemples absents (5) :`);
  console.log(absentsDB.slice(0, 5));
}

// Vérifier par collection
console.log('\n📅 Répartition par collection:');
const collCSV = {};
for (const line of lines) {
  const p = line.split(';');
  const coll = (p[6] || '').trim();
  if (coll) collCSV[coll] = (collCSV[coll] || 0) + 1;
}
console.log('CSV :', collCSV);
const collDB = db.prepare("SELECT collection, COUNT(*) as n FROM articles GROUP BY collection ORDER BY n DESC").all();
console.log('DB  :', collDB);