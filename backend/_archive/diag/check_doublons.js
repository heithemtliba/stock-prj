require("dotenv").config();
const db = require("../config/database");

// Verifier pourquoi 22414 apparait 2 fois
const refs = db.prepare("SELECT DISTINCT reference_article FROM ventes WHERE code_article = '22414'").all();
console.log("EANs 22414:", refs.length);

// Verifier ventes_semaine pour articles inactifs
const inactifs = db.prepare(`
  SELECT code_article, saison, SUM(quantite) as total_periode,
    ROUND(SUM(quantite) * 1.0 / (SELECT CAST(julianday('now') - julianday(MIN(date_vente)) AS INTEGER) / 7.0 
    FROM ventes v2 WHERE v2.code_article = ventes.code_article), 2) as ventes_semaine,
    CAST(julianday('now') - julianday(MAX(date_vente)) AS INTEGER) as jours_sans_vente
  FROM ventes
  WHERE date_vente >= date('now', '-28 days')
  AND code_article NOT IN (
    SELECT DISTINCT code_article FROM ventes WHERE date_vente >= date('now', '-7 days')
  )
  GROUP BY code_article
  HAVING total_periode >= 5
  ORDER BY total_periode DESC
  LIMIT 5
`).all();
console.log("\nInactifs avec ventes_semaine:");
inactifs.forEach(r => console.log(r));
