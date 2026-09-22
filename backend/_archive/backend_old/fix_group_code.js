const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('SELECT reference_article, code_article, saison, SUM(quantite) as total')) {
    console.log('Trouve ligne', i+1);
    // Trouver la ligne GROUP BY reference_article
    for (let j = i; j < i + 10; j++) {
      if (lines[j].includes('GROUP BY reference_article')) {
        console.log('GROUP BY ligne', j+1, ':', lines[j]);
        // Garder une reference representative par code_article
        lines[i] = lines[i].replace(
          'SELECT reference_article, code_article, saison, SUM(quantite) as total',
          'SELECT MIN(reference_article) as reference_article, code_article, saison, SUM(quantite) as total'
        );
        lines[j] = lines[j].replace('GROUP BY reference_article', 'GROUP BY code_article');
        console.log('Corrige');
        count++;
        break;
      }
    }
  }
  if (count >= 2) break;
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('Total corrections:', count, 'OK');
