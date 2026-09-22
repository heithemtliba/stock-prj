require("dotenv").config();
const db = require("../config/database");

const exemples = db.prepare(`
  SELECT code_article, store_id,
         MIN(date_vente) as premiere_vente,
         MAX(date_vente) as derniere_vente,
         SUM(quantite) as total_vendu,
         CAST(julianday('now') - julianday(MIN(date_vente)) AS INTEGER) as jours_exposition
  FROM ventes
  WHERE code_article IN ('22414', '22183', '22064')
  GROUP BY code_article, store_id
  ORDER BY code_article, store_id
`).all();

exemples.forEach(r => console.log(r));
