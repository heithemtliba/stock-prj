require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/database');

// Chercher des articles avec prix > 0 et prix bas
const articles = db.prepare(`
  SELECT v.code_article, SUM(v.quantite) as total, a.prix_detail
  FROM ventes v
  INNER JOIN articles a ON a.code_article = v.code_article
  WHERE v.date_vente >= date('now', '-28 days')
  AND a.prix_detail > 0
  AND a.prix_detail < 50
  GROUP BY v.code_article
  HAVING total >= 3
  ORDER BY a.prix_detail ASC
  LIMIT 10
`).all();

console.log("Articles avec prix < 50 TND :\n");
articles.forEach(a => {
  console.log(`  ${a.code_article} : ${a.total} ventes, prix=${a.prix_detail} TND`);
});

console.log("\nArticles avec prix > 200 TND :\n");
const chers = db.prepare(`
  SELECT v.code_article, SUM(v.quantite) as total, a.prix_detail
  FROM ventes v
  INNER JOIN articles a ON a.code_article = v.code_article
  WHERE v.date_vente >= date('now', '-28 days')
  AND a.prix_detail > 200
  GROUP BY v.code_article
  HAVING total >= 3
  ORDER BY a.prix_detail DESC
  LIMIT 10
`).all();

chers.forEach(a => {
  console.log(`  ${a.code_article} : ${a.total} ventes, prix=${a.prix_detail} TND`);
});