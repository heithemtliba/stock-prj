require("dotenv").config();
const db = require("./config/database");
const fs = require("fs");

const content = fs.readFileSync("../data/mars_2026.csv", "utf8");
const lines = content.split("\n").filter(l => l.trim());
const sep = ";";

const iDate    = 0;
const iStore   = 1;
const iCode    = 2;
const iRef     = 3;
const iTaille  = 4;
const iCouleur = 5;
const iSaison  = 6;
const iQte     = 8;

db.exec("DELETE FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03'");

const insert = db.prepare(`
  INSERT INTO ventes (date_vente, store_id, code_article, reference_article, taille, couleur, saison, quantite, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'csv')
`);

let ok = 0, skip = 0, retours = 0;
db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ""));
    let date = cols[iDate] || "";
    if (date.includes("/")) {
      const [d, m, y] = date.split("/");
      date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const store = cols[iStore] || "";
    const code  = cols[iCode]  || "";
    if (!date || !store || !code) { skip++; continue; }
    const qte = parseFloat((cols[iQte] || "1").replace(",", ".")) || 1;
    if (qte < 0) { retours++; continue; }
    if (qte === 0) { skip++; continue; }
    insert.run(date, store, code, cols[iRef]||"", cols[iTaille]||"", cols[iCouleur]||"", cols[iSaison]||"", qte);
    ok++;
  }
})();

console.log(`OK: ${ok} | Retours exclus: ${retours} | Skip: ${skip}`);
const r = db.prepare("SELECT COUNT(*) as n, MAX(date_vente) as max, SUM(quantite) as total FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03'").get();
console.log("Mars:", r.n, "lignes | Total unites:", r.total, "| Derniere date:", r.max);
