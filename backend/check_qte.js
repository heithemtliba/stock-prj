require("dotenv").config();
const db = require("./config/database");

// Verifier les quantites importees
const stats = db.prepare("SELECT quantite, COUNT(*) as n FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03' GROUP BY quantite ORDER BY n DESC LIMIT 5").all();
console.log("Quantites Mars:", stats);

// Verifier une ligne avec quantite > 1 dans le CSV original
const fs = require("fs");
const lines = fs.readFileSync("../data/mars_2026.csv", "utf8").split("\n").filter(l => l.trim());
// Chercher lignes avec quantite != 1
let diff = 0;
for (let i = 1; i < Math.min(lines.length, 100); i++) {
  const cols = lines[i].split(";");
  if (cols[8] && cols[8].trim() !== "1,00" && cols[8].trim() !== "") {
    console.log("Ligne", i+1, "qte:", cols[8], "| full:", lines[i]);
    diff++;
  }
}
console.log("Lignes avec qte != 1 (sur 100):", diff);
