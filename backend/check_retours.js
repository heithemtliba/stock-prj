require("dotenv").config();
const db = require("./config/database");

const stats = db.prepare("SELECT COUNT(*) as nb, SUM(quantite) as total FROM retours").get();
console.log("Total retours:", stats);

const parArticle = db.prepare(`
  SELECT r.code_article, a.libelle, a.famille,
         COUNT(*) as nb_transactions,
         SUM(r.quantite) as total_retours,
         COUNT(DISTINCT r.store_id) as nb_boutiques
  FROM retours r
  LEFT JOIN articles a ON a.code_article = r.code_article
  GROUP BY r.code_article
  ORDER BY total_retours DESC
  LIMIT 10
`).all();
console.log("\nTop 10 articles retournes:");
parArticle.forEach(r => console.log(` ${r.code_article} ${r.libelle||'?'} - ${r.famille||''}: ${r.total_retours} retours sur ${r.nb_boutiques} boutiques`));

const parBoutique = db.prepare(`
  SELECT store_id, COUNT(*) as nb, SUM(quantite) as total
  FROM retours GROUP BY store_id ORDER BY total DESC
`).all();
console.log("\nRetours par boutique:");
parBoutique.forEach(r => console.log(` Store ${r.store_id}: ${r.total} unites`));

const tauxRetour = db.prepare(`
  SELECT v.code_article,
         SUM(v.quantite) as ventes,
         COALESCE(r.total_retours, 0) as retours,
         ROUND(COALESCE(r.total_retours, 0) * 100.0 / SUM(v.quantite), 1) as taux_pct
  FROM ventes v
  LEFT JOIN (SELECT code_article, SUM(quantite) as total_retours FROM retours GROUP BY code_article) r
    ON r.code_article = v.code_article
  WHERE v.date_vente >= date('now', '-28 days')
  GROUP BY v.code_article
  HAVING retours > 0
  ORDER BY taux_pct DESC
  LIMIT 15
`).all();
console.log("\nTop taux de retour:");
tauxRetour.forEach(r => console.log(` ${r.code_article}: ${r.ventes} ventes, ${r.retours} retours = ${r.taux_pct}%`));
