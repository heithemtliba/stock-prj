require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/database');
const cegid = require('../services/cegidService');

(async () => {
  // Récupérer les 20 premiers articles
  const articles = db.prepare(`
    SELECT MIN(reference_article) as reference_article, code_article, saison, SUM(quantite) as total
    FROM ventes
    WHERE date_vente >= date('now', '-28 days')
    GROUP BY code_article
    HAVING total >= 3
    ORDER BY total DESC
    LIMIT 20
  `).all();

  console.log(`${articles.length} articles à tester\n`);

  for (const art of articles) {
    const refs = db.prepare(
      "SELECT DISTINCT reference_article FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL"
    ).all(art.code_article);

    console.log(`Article ${art.code_article} : ${refs.length} EAN`);

    for (const { reference_article } of refs) {
      const start = Date.now();
      try {
        const result = await cegid.getStockByStore(reference_article);
        const elapsed = Date.now() - start;
        if (elapsed > 3000) {
          console.log(`  ⚠️ EAN ${reference_article} : ${elapsed}ms (LENT)`);
        }
      } catch (e) {
        console.log(`  ❌ EAN ${reference_article} : ERREUR ${e.message}`);
      }
    }
  }

  console.log('\n✅ Test terminé');
})();