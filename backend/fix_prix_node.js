const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// Ajouter prixArticles dans le calcul nomsArticles
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const nomsArticles = getNomsArticles(db, codesRapport)')) {
    console.log('Trouve ligne', i+1);
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
}

// Ajouter prixArticles dans le JSON rapport
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('nomsArticles,') && lines[i+1] && lines[i+1].includes('stockParArticle')) {
    lines.splice(i+1, 0, "      prixArticles,");
    console.log('prixArticles dans JSON ligne', i+2);
    break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
