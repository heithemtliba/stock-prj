const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// Trouver "const nomsArticles = getNomsArticles" premiere occurrence
let found = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const nomsArticles = getNomsArticles(db, codesRapport)')) {
    found++;
    if (found === 1) {
      console.log('Insertion analyseRetours ligne', i+1);
      lines.splice(i, 0,
        "      // Analyse retours",
        "      const analyseRetours = {",
        "        parArticle: db.prepare(`SELECT r.code_article, a.libelle, a.famille, COUNT(*) as nb_transactions, SUM(r.quantite) as total_retours, COUNT(DISTINCT r.store_id) as nb_boutiques FROM retours r LEFT JOIN articles a ON a.code_article = r.code_article GROUP BY r.code_article ORDER BY total_retours DESC LIMIT 20`).all(),",
        "        parBoutique: db.prepare(`SELECT store_id, COUNT(*) as nb, SUM(quantite) as total FROM retours GROUP BY store_id ORDER BY total DESC`).all(),",
        "        tauxRetour: db.prepare(`SELECT v.code_article, a.libelle, SUM(v.quantite) as ventes, COALESCE(r.tr,0) as retours, ROUND(COALESCE(r.tr,0)*100.0/SUM(v.quantite),1) as taux_pct FROM ventes v LEFT JOIN articles a ON a.code_article=v.code_article LEFT JOIN (SELECT code_article, SUM(quantite) as tr FROM retours GROUP BY code_article) r ON r.code_article=v.code_article WHERE v.date_vente >= date('now','-28 days') GROUP BY v.code_article HAVING retours > 0 ORDER BY taux_pct DESC LIMIT 20`).all(),",
        "        total: db.prepare(`SELECT COUNT(*) as nb, SUM(quantite) as total FROM retours`).get()",
        "      };"
      );
      break;
    }
  }
}

// Ajouter dans JSON rapport
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('nomsArticles,') && lines[i+1] && lines[i+1].includes('prixArticles,')) {
    lines.splice(i, 0, lines[i].replace('nomsArticles,', 'analyseRetours,'));
    console.log('analyseRetours dans JSON ligne', i+1);
    break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('analyseRetours occurrences:', (lines.join('\n').match(/analyseRetours/g)||[]).length);
console.log('OK');
