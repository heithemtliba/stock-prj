const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("SELECT store_id, CAST(julianday('now') - julianday(MIN(date_vente))")) {
    console.log('Trouve ligne', i+1);
    lines[i]   = "      const expoRows = db.prepare(`";
    lines[i+1] = "        SELECT store_id,";
    lines[i+2] = "          CASE WHEN COUNT(d.date_envoi) > 0";
    lines[i+3] = "               THEN CAST(julianday('now') - julianday(MIN(d.date_envoi)) AS INTEGER)";
    lines[i+4] = "               ELSE 999 END as jours";
    lines[i+5] = "        FROM (SELECT DISTINCT store_id FROM ventes WHERE code_article = ?) v";
    lines[i+6] = "        LEFT JOIN distributions d ON d.code_article = ? AND d.store_id = v.store_id";
    lines[i+7] = "        GROUP BY v.store_id";
    lines[i+8] = "      \`).all(article.code_article, article.code_article);";
    break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK');
