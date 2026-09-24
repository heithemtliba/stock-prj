const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Corriger la deuxieme occurrence
s = s.replace(
  'const analyseRetours = { retourStats, retourParBoutique, tauxRetour };',
  'const analyseRetours = { parArticle: retourStats, parBoutique: retourParBoutique, tauxRetour, total: db.prepare("SELECT COUNT(*) as nb, SUM(quantite) as total FROM retours").get() };'
);

// Verifier si analyseRetours est dans le second JSON rapport
const parts = s.split('const rapport = {');
console.log('Parties:', parts.length);
if (parts.length >= 3) {
  // Trouver le second rapport et verifier
  const hasInSecond = parts[2].includes('analyseRetours,');
  console.log('analyseRetours dans second JSON:', hasInSecond);
  if (!hasInSecond) {
    // Ajouter apres topArticles dans le second rapport
    s = s.replace(
      /(\s+topArticles,\s+articlesInactifs.*\n.*analyseRetours,\s+nomsArticles)/,
      '$1'
    );
    // Chercher le second "topArticles," et ajouter analyseRetours apres articlesInactifs
    const lines = s.split('\n');
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('analyseRetours,') ) count++;
      if (count === 1 && lines[i].includes('articlesInactifs:') && 
          lines[i+1] && !lines[i+1].includes('analyseRetours')) {
        if (count < 2) {
          lines.splice(i+1, 0, '            analyseRetours,');
          console.log('analyseRetours ajoute ligne', i+2);
          break;
        }
      }
    }
    s = lines.join('\n');
  }
}

fs.writeFileSync('server.js', s, 'utf8');
console.log('analyseRetours total:', (s.match(/analyseRetours,/g)||[]).length);
console.log('OK');
