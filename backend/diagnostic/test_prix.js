require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/database');

const articles = db.prepare(`
  SELECT v.code_article, SUM(v.quantite) as total, a.prix_detail
  FROM ventes v
  LEFT JOIN articles a ON a.code_article = v.code_article
  WHERE v.date_vente >= date('now', '-28 days')
  AND v.code_article IS NOT NULL
  GROUP BY v.code_article
  HAVING total >= 3
  ORDER BY total DESC
  LIMIT 100
`).all();

console.log("Top 5 articles les plus chers :\n");
articles.sort((a, b) => (b.prix_detail || 0) - (a.prix_detail || 0));
articles.slice(0, 5).forEach(a => {
  console.log(`  ${a.code_article} : ${a.total} ventes, prix=${a.prix_detail || 0} TND`);
});

console.log("\nTop 5 articles les moins chers :\n");
articles.sort((a, b) => (a.prix_detail || 0) - (b.prix_detail || 0));
articles.slice(0, 5).forEach(a => {
  console.log(`  ${a.code_article} : ${a.total} ventes, prix=${a.prix_detail || 0} TND`);
});