const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('stock_reel  = get_stock_article(code)') && 
      lines[i+1] && lines[i+1].includes('stock_total = sum')) {
    console.log('Trouve ligne', i+1);
    lines[i] = "      stock_reel  = stock_par_article.get(str(code), {})";
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
