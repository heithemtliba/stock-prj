const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// Supprimer le nouveau bloc analyseRetours insere (qui reference parArticle etc)
let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Analyse retours') && lines[i+1] && lines[i+1].includes("const analyseRetours = {") && lines[i+2] && lines[i+2].includes('parArticle:')) {
    console.log('Trouve doublon ligne', i+1);
    // Supprimer les 7 lignes du nouveau bloc
    lines.splice(i, 7);
    count++;
    break;
  }
}

// Verifier analyseRetours dans JSON
const hasInJSON = lines.some(l => l.includes('analyseRetours,'));
console.log('analyseRetours dans JSON:', hasInJSON);
if (!hasInJSON) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('nomsArticles,') && lines[i+1] && lines[i+1].includes('prixArticles,')) {
      lines.splice(i, 0, lines[i].replace('nomsArticles,', 'analyseRetours,'));
      console.log('Ajoute dans JSON ligne', i+1);
      break;
    }
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('Suppressions:', count, '| OK');
