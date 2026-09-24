const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "../../data/mabrouk_updated.db");
console.log(`📂 Ouverture de : ${dbPath}\n`);

const db = new Database(dbPath);

console.log("=== TABLES ===");
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
tables.forEach(t => console.log(" -", t.name));

console.log("\n=== NOMBRE DE LIGNES ===");
for (const t of tables) {
  if (t.name.startsWith("sqlite_")) continue;
  try {
    const r = db.prepare(`SELECT COUNT(*) as n FROM ${t.name}`).get();
    console.log(` ${t.name}: ${r.n}`);
  } catch(e) { console.log(` ${t.name}: ERREUR ${e.message}`); }
}

console.log("\n=== DATES ventes ===");
try {
  const d = db.prepare(`SELECT MIN(date_vente) as min, MAX(date_vente) as max FROM ventes`).get();
  console.log(` ${d.min} → ${d.max}`);
} catch(e) { console.log(" ERREUR:", e.message); }

console.log("\n=== COLONNES ventes ===");
try {
  const cols = db.prepare(`PRAGMA table_info(ventes)`).all();
  cols.forEach(c => console.log(` - ${c.name} (${c.type})`));
} catch(e) { console.log(" ERREUR:", e.message); }

console.log("\n=== SAISONS ===");
try {
  const s = db.prepare(`SELECT saison, COUNT(*) as n FROM ventes GROUP BY saison ORDER BY n DESC LIMIT 10`).all();
  s.forEach(x => console.log(` ${x.saison}: ${x.n}`));
} catch(e) { console.log(" ERREUR:", e.message); }

console.log("\n=== STORES ===");
try {
  const st = db.prepare(`SELECT DISTINCT store_id FROM ventes ORDER BY store_id`).all();
  console.log(` ${st.length} magasins : ${st.map(s => s.store_id).join(', ')}`);
} catch(e) { console.log(" ERREUR:", e.message); }