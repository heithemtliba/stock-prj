const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('stock_reel  = stock_par_article.get(str(code), {})')) {
    console.log('Ligne', i+1, ':', JSON.stringify(lines[i]));
    lines[i] = "    stock_reel  = stock_par_article.get(str(code), {})";
    console.log('Corrige:', JSON.stringify(lines[i]));
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
