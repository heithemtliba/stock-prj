const fs = require('fs');

// Fix Python : afficher 0 au lieu de valeurs negatives pour stock receveur
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  // Stock negatif -> 0 dans feuille 2 et 3
  if (lines[i].includes("stk_r = stock_reel.get(id_r,") && lines[i].includes("br.get('stock'")) {
    console.log('Ligne', i+1, ':', lines[i].trim());
    lines[i] = lines[i].replace(
      "stk_r = stock_reel.get(id_r, br.get('stock', '—') if br else '—')",
      "stk_r = max(0, stock_reel.get(id_r, 0) if isinstance(stock_reel.get(id_r, 0), (int,float)) else 0)"
    );
    lines[i] = lines[i].replace(
      "stk_d = stock_reel.get(id_d, bd.get('stock', '—') if bd else '—')",
      "stk_d = max(0, stock_reel.get(id_d, 0) if isinstance(stock_reel.get(id_d, 0), (int,float)) else 0)"
    );
    console.log('Corrige:', lines[i].trim());
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
