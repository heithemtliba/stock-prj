const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("stk_d = stock_reel.get(id_d,")) {
    console.log('Ligne', i+1, ':', lines[i].trim());
    lines[i] = "        stk_d = max(0, stock_reel.get(id_d, 0) if isinstance(stock_reel.get(id_d, 0), (int,float)) else 0)";
    console.log('Corrige');
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
