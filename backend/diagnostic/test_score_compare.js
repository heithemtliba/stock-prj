require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/database');

// Chercher 2 articles avec des prix très différents
const articles = db.prepare(`
  SELECT v.code_article, v.saison, SUM(v.quantite) as total, a.prix_detail
  FROM ventes v
  LEFT JOIN articles a ON a.code_article = v.code_article
  WHERE v.date_vente >= date('now', '-28 days')
  AND v.code_article IS NOT NULL
  GROUP BY v.code_article
  HAVING total >= 5
  ORDER BY a.prix_detail DESC
  LIMIT 5
`).all();

console.log("Top 5 articles par prix :");
articles.forEach(a => {
  console.log(`  ${a.code_article} (${a.saison}) : ${a.total} ventes, prix=${a.prix_detail || 0} TND`);
});

console.log("\nArticles avec prix bas :");
const articlesBas = db.prepare(`
  SELECT v.code_article, v.saison, SUM(v.quantite) as total, a.prix_detail
  FROM ventes v
  LEFT JOIN articles a ON a.code_article = v.code_article
  WHERE v.date_vente >= date('now', '-28 days')
  AND v.code_article IS NOT NULL
  AND a.prix_detail > 0
  GROUP BY v.code_article
  HAVING total >= 5
  ORDER BY a.prix_detail ASC
  LIMIT 5
`).all();

articlesBas.forEach(a => {
  console.log(`  ${a.code_article} (${a.saison}) : ${a.total} ventes, prix=${a.prix_detail || 0} TND`);
});

console.log("\n→ Comparer les scores dans /reassort-global.");