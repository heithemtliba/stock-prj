const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("prix_articles    = data.get('prixArticles'")) {
    lines[i] = "prix_articles    = data.get('prixArticles', {})  # Prix TTC par code article";
    console.log('Corrige ligne', i+1);
    break;
  }
}
fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
