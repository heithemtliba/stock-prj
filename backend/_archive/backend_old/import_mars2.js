require("dotenv").config();
const db = require("../../config/database");
const fs = require("fs");

const content = fs.readFileSync("../data/mars_2026.csv", "utf8");
const lines = content.split("\n").filter(l => l.trim());
const sep = ";";
const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ""));
console.log("Colonnes:", headers);
console.log("Ligne 2:", lines[1]);

// Map colonnes
const iDate   = headers.findIndex(h => h.includes("date"));
const iStore  = headers.findIndex(h => h.includes("etablissement"));
const iCode   = headers.findIndex(h => h === "code article");
const iRef    = headers.findIndex(h => h.includes("barres"));
const iTaille = headers.findIndex(h => h.includes("taille"));
const iCouleur= headers.findIndex(h => h.includes("couleur"));
const iSaison = headers.findIndex(h => h.includes("saison"));
console.log(`Indices: date=${iDate} store=${iStore} code=${iCode} ref=${iRef}`);

// Supprimer Mars existant
db.exec("DELETE FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03'");

const insert = db.prepare(`
  INSERT INTO ventes (date_vente, store_id, code_article, reference_article, taille, couleur, saison, quantite, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'csv')
`);

let ok = 0, skip = 0;
db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ""));
    // Convertir date DD/MM/YYYY -> YYYY-MM-DD
    let date = cols[iDate] || "";
    if (date.includes("/")) {
      const [d, m, y] = date.split("/");
      date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const store = cols[iStore] || "";
    const code  = cols[iCode]  || "";
    if (!date || !store || !code) { skip++; continue; }
    insert.run(date, store, code, cols[iRef]||"", cols[iTaille]||"", cols[iCouleur]||"", cols[iSaison]||"");
    ok++;
  }
})();

console.log(`OK: ${ok} | Skip: ${skip}`);
const r = db.prepare("SELECT COUNT(*) as n, MAX(date_vente) as max FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03'").get();
console.log("Mars apres:", r.n, "| Derniere date:", r.max);
