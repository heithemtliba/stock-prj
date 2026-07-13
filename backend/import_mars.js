require("dotenv").config();
const db = require("./config/database");
const fs = require("fs");
const path = require("path");

const fichier = "../data/mars_2026.csv";
const content = fs.readFileSync(fichier, "utf8");
const lines = content.split("\n").filter(l => l.trim());

console.log("Total lignes CSV:", lines.length);
console.log("Header:", lines[0]);

// Detecter separateur
const sep = lines[0].includes(";") ? ";" : ",";
console.log("Separateur:", sep);

const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ""));
console.log("Colonnes:", headers);

// Supprimer donnees Mars existantes et reimporter
db.exec("DELETE FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03'");
console.log("Donnees Mars supprimees");

const insert = db.prepare(`
  INSERT INTO ventes (date_vente, store_id, code_article, reference_article, taille, couleur, saison, quantite, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'csv')
`);

let ok = 0, skip = 0;
const importAll = db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ""));
    const date_vente      = cols[headers.indexOf("date_vente")] || cols[0];
    const store_id        = cols[headers.indexOf("store_id")] || cols[1];
    const code_article    = cols[headers.indexOf("code_article")] || cols[2];
    const ref_article     = cols[headers.indexOf("reference_article")] || cols[3];
    const taille          = cols[headers.indexOf("taille")] || cols[4];
    const couleur         = cols[headers.indexOf("couleur")] || cols[5];
    const saison          = cols[headers.indexOf("saison")] || cols[6];
    const quantite        = parseFloat(cols[headers.indexOf("quantite")] || cols[7]) || 1;

    if (!date_vente || !store_id || !code_article) { skip++; continue; }
    insert.run(date_vente, store_id, code_article, ref_article, taille, couleur, saison, quantite);
    ok++;
  }
});

importAll();
console.log(`Import OK: ${ok} lignes | Ignorees: ${skip}`);

const apres = db.prepare("SELECT COUNT(*) as n FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03'").get();
const derniereDate = db.prepare("SELECT MAX(date_vente) as d FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03'").get();
console.log("Lignes Mars apres:", apres.n);
console.log("Derniere date Mars:", derniereDate.d);
