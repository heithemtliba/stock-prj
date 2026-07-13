require("dotenv").config();
const db = require("./config/database");
const fs = require("fs");

db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    code_article TEXT PRIMARY KEY,
    libelle TEXT,
    famille TEXT,
    fournisseur TEXT,
    collection TEXT,
    prix_revient REAL,
    prix_detail REAL
  )
`);

const content = fs.readFileSync("../data/articles_mabrouk.csv", "latin1");
const lines = content.split("\n").filter(l => l.trim());
const sep = ";";

const insert = db.prepare(`
  INSERT OR REPLACE INTO articles (code_article, libelle, famille, fournisseur, collection, prix_revient, prix_detail)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

let ok = 0, skip = 0;
const importAll = db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const code = cols[2].trim();
    if (!code) { skip++; continue; }
    insert.run(
      code,
      cols[3].trim(),
      cols[4].trim(),
      cols[5].trim(),
      cols[6].trim(),
      parseFloat(cols[7]) || 0,
      parseFloat(cols[8]) || 0
    );
    ok++;
  }
});

importAll();
console.log(`Import termine : ${ok} articles importes, ${skip} lignes ignorees`);
console.log("Verification 22414:", db.prepare("SELECT * FROM articles WHERE code_article = '22414'").get());
console.log("Verification 22064:", db.prepare("SELECT * FROM articles WHERE code_article = '22064'").get());
