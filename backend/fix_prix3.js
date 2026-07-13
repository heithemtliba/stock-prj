const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const nomsArticles = getNomsArticles(db, codesRapport)') && count === 1) {
    console.log('Deuxieme occurrence ligne', i+1);
    lines.splice(i+1, 0,
      "      // Prix articles depuis table articles",
      "      const prixArticles = {};",
      "      for (const code of codesRapport) {",
      "        const a = db.prepare('SELECT prix_detail FROM articles WHERE code_article = ?').get(code);",
      "        if (a) prixArticles[code] = a.prix_detail;",
      "      }"
    );
    break;
  }
  if (lines[i].includes('const nomsArticles = getNomsArticles(db, codesRapport)')) count++;
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
