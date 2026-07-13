require("dotenv").config();
const db = require("./config/database");

const periode = { jours: 28 };

// Simuler exactement la requete de calculerReassortGlobal
const articles = db.prepare(`
  SELECT MIN(reference_article) as reference_article, code_article, saison, SUM(quantite) as total
  FROM ventes
  WHERE date_vente >= date('now', '-${periode.jours} days')
  GROUP BY code_article
  HAVING total >= 3
  ORDER BY total DESC
  LIMIT 500
`).all();

console.log('Articles retournes par SQL:', articles.length);
console.log('Codes uniques:', new Set(articles.map(a => a.code_article)).size);
console.log('Top 5:', articles.slice(0,5).map(a => `${a.code_article}(${a.total})`));
