const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("stock_total if stock_total > 0 else") && lines[i].includes('ws5')) {
    console.log('Ligne', i+1, ':', lines[i].trim());
    lines[i] = "    sty(ws5.cell(row=row, column=7, value=stock_total), bg=stock_bg, fg=stock_fg, bold=True, center=True)";
    console.log('Corrige');
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
