require("dotenv").config();
const db = require("./config/database");

// Verifier 27705 dans ventes
const info = db.prepare("SELECT code_article, saison, SUM(quantite) as total FROM ventes WHERE code_article = '27705' GROUP BY code_article, saison").all();
console.log("27705 dans ventes:", info);

// Verifier dans articles
const art = db.prepare("SELECT * FROM articles WHERE code_article = '27705'").get();
console.log("27705 dans articles:", art);

// Si absent, inserer avec info basique
if (!art) {
  db.prepare("INSERT OR IGNORE INTO articles (code_article, libelle, famille, collection) VALUES ('27705', 'ARTICLE INCONNU', '', '20H')").run();
  console.log("27705 insere");
}
