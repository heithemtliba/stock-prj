const fs = require('fs');
let sv = fs.readFileSync('server.js', 'utf8');

// Ajouter calcul retours dans le JSON rapport
const calcRetours = `
      // Analyse retours et annulations
      const retourStats = db.prepare(\`
        SELECT r.code_article, a.libelle, a.famille, a.prix_detail,
               SUM(r.quantite) as total_retours,
               COUNT(DISTINCT r.store_id) as nb_boutiques,
               COUNT(*) as nb_transactions
        FROM retours r
        LEFT JOIN articles a ON a.code_article = r.code_article
        GROUP BY r.code_article
        ORDER BY total_retours DESC
        LIMIT 30
      \`).all();

      const retourParBoutique = db.prepare(\`
        SELECT r.store_id,
               SUM(r.quantite) as total_retours,
               COUNT(DISTINCT r.code_article) as nb_articles
        FROM retours r
        GROUP BY r.store_id
        ORDER BY total_retours DESC
      \`).all();

      const tauxRetour = db.prepare(\`
        SELECT v.code_article, a.libelle, a.famille, a.prix_detail,
               SUM(v.quantite) as ventes,
               COALESCE(r.total_retours, 0) as retours,
               ROUND(COALESCE(r.total_retours, 0) * 100.0 / SUM(v.quantite), 1) as taux_pct
        FROM ventes v
        LEFT JOIN (SELECT code_article, SUM(quantite) as total_retours FROM retours GROUP BY code_article) r
          ON r.code_article = v.code_article
        LEFT JOIN articles a ON a.code_article = v.code_article
        WHERE v.date_vente >= date('now', '-28 days')
        GROUP BY v.code_article
        HAVING retours > 0 AND SUM(v.quantite) >= 3
        ORDER BY taux_pct DESC
        LIMIT 20
      \`).all();

      const analyseRetours = { retourStats, retourParBoutique, tauxRetour };
`;

// Inserer avant "const rapport = {" (deux occurrences)
let count = 0;
const lines = sv.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'const rapport = {') {
    lines.splice(i, 0, ...calcRetours.split('\n'));
    i += calcRetours.split('\n').length + 1;
    count++;
    if (count >= 2) break;
  }
}
sv = lines.join('\n');

// Ajouter analyseRetours dans le JSON
sv = sv.replace(
  /bonsTransfert,\s*\n(\s*)scoresMagasins/g,
  'bonsTransfert,\n$1analyseRetours,\n$1scoresMagasins'
);

console.log('analyseRetours dans JSON:', (sv.match(/analyseRetours,/g)||[]).length);
fs.writeFileSync('server.js', sv, 'utf8');
console.log('OK lignes:', sv.split('\n').length);
