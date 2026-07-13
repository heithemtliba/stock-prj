require("dotenv").config();
const db = require("./config/database");
const fs = require("fs");

// Creer table retours
db.exec(`
  CREATE TABLE IF NOT EXISTS retours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_retour TEXT NOT NULL,
    store_id TEXT NOT NULL,
    code_article TEXT NOT NULL,
    reference_article TEXT,
    taille TEXT,
    couleur TEXT,
    saison TEXT,
    quantite REAL NOT NULL,
    source TEXT DEFAULT 'csv',
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_retours_code ON retours(code_article)");
db.exec("CREATE INDEX IF NOT EXISTS idx_retours_store ON retours(store_id)");

// Reimporter retours Mars
db.exec("DELETE FROM retours WHERE strftime('%Y-%m', date_retour) = '2026-03'");

const content = fs.readFileSync("../data/mars_2026.csv", "utf8");
const lines = content.split("\n").filter(l => l.trim());

const insert = db.prepare(`
  INSERT INTO retours (date_retour, store_id, code_article, reference_article, taille, couleur, saison, quantite)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let ok = 0;
db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";").map(c => c.trim().replace(/"/g, ""));
    let date = cols[0] || "";
    if (date.includes("/")) {
      const [d, m, y] = date.split("/");
      date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const qte = parseFloat((cols[8] || "1").replace(",", ".")) || 0;
    if (qte >= 0) continue; // garder seulement les negatifs
    if (!date || !cols[1] || !cols[2]) continue;
    insert.run(date, cols[1], cols[2], cols[3]||"", cols[4]||"", cols[5]||"", cols[6]||"", Math.abs(qte));
    ok++;
  }
})();

console.log(`Retours importes: ${ok}`);

// Stats retours
const stats = db.prepare(`
  SELECT code_article, COUNT(*) as nb_retours, SUM(quantite) as total_retours
  FROM retours
  GROUP BY code_article
  ORDER BY total_retours DESC
  LIMIT 10
`).all();
console.log("\nTop 10 articles retournes:");
stats.forEach(r => console.log(` ${r.code_article}: ${r.total_retours} retours`));
