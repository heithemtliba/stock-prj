const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("stk_d = bd.get('stock', 0) if bd else 0")) {
    console.log('Fix ligne', i+1);
    lines[i] = "        stk_d = stock_reel.get(id_d, bd.get('stock', '—') if bd else '—')";
  }
  if (lines[i].includes("stk_r = br.get('stock', 0) if br else 0")) {
    console.log('Fix ligne', i+1);
    lines[i] = "        stk_r = stock_reel.get(id_r, br.get('stock', '—') if br else '—')";
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
