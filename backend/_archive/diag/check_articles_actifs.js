require("dotenv").config();
const db = require("../config/database");

const stats = db.prepare(`
  SELECT COUNT(DISTINCT code_article) as nb_articles,
         COUNT(DISTINCT reference_article) as nb_eans
  FROM ventes
  WHERE date_vente >= date('now', '-28 days')
  AND quantite > 0
`).get();
console.log("Articles actifs 28 derniers jours:", stats);

// Par seuil de ventes
[1, 2, 5, 10].forEach(seuil => {
  const r = db.prepare(`
    SELECT COUNT(DISTINCT code_article) as n
    FROM ventes
    WHERE date_vente >= date('now', '-28 days')
    GROUP BY code_article
    HAVING SUM(quantite) >= ?
  `).all(seuil);
  console.log(`Articles avec >= ${seuil} ventes:`, r.length);
});
