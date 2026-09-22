const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('SELECT DISTINCT code_article, saison, SUM(quantite) as total_periode')) {
    console.log('Trouve ligne', i+1);
    lines[i] = lines[i].replace(
      'SELECT DISTINCT code_article, saison, SUM(quantite) as total_periode',
      `SELECT code_article, saison, SUM(quantite) as total_periode,
               ROUND(SUM(quantite) * 1.0 / (${lines[i].includes('          ') ? '          ' : '      '}SELECT CAST(julianday('now') - julianday(MIN(date_vente)) AS INTEGER) / 7.0 FROM ventes v2 WHERE v2.code_article = ventes.code_article), 2) as ventes_semaine,
               CAST(julianday('now') - julianday(MAX(date_vente)) AS INTEGER) as jours_sans_vente`
    );
    count++;
    if (count >= 2) break;
  }
}

console.log('Remplacements:', count);
fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK');
