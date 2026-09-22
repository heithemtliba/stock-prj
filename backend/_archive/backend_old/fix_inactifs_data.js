const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Enrichir articlesInactifs avec jours_sans_vente et ventes_semaine
const oldInactifs = "const articlesInactifs = db.prepare(`";
const newInactifs = `const articlesInactifs = db.prepare(\``;

// Chercher la requete articlesInactifs et l enrichir
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('SELECT DISTINCT code_article, saison, SUM(quantite) as total_periode') &&
      lines[i-2] && lines[i-2].includes('articlesInactifs')) {
    console.log('Trouve ligne', i+1);
    // Remplacer la requete
    lines[i] = "        SELECT code_article, saison, SUM(quantite) as total_periode,";
    lines.splice(i+1, 0,
      "               ROUND(SUM(quantite) * 1.0 / (SELECT CAST(julianday('now') - julianday(MIN(date_vente)) AS INTEGER) / 7.0 FROM ventes v2 WHERE v2.code_article = v.code_article), 2) as ventes_semaine,",
      "               CAST(julianday('now') - julianday(MAX(date_vente)) AS INTEGER) as jours_sans_vente,"
    );
    break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
