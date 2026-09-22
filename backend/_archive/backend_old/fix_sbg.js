const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('sty(ws5.cell(row=row, column=7, value=stock_total), bg=stock_bg')) {
    console.log('Trouve ligne', i+1);
    // Inserer definition stock_bg/fg avant cette ligne
    lines.splice(i, 0,
      "    stock_bg = RED_BG if stock_total > 50 else (ORANGE_BG if stock_total > 20 else GREEN_BG)",
      "    stock_fg = RED_FG if stock_total > 50 else (ORANGE_FG if stock_total > 20 else GREEN_FG)"
    );
    break;
  }
}

// Supprimer les lignes dupliquees apres
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('stock_bg = RED_BG if stock_total') && 
      lines[i+1] && lines[i+1].includes('stock_fg = RED_FG if stock_total') &&
      lines[i+2] && lines[i+2].includes('sty(c_stock')) {
    console.log('Supprime doublon ligne', i+1);
    lines.splice(i, 3);
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
