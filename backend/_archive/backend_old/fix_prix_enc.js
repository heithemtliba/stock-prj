const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("value=prix if prix else") ) {
    console.log('Ligne', i+1, ':', lines[i].trim());
    lines[i] = "    sty(ws5.cell(row=row, column=4, value=prix if prix else 0), bg=bg, center=True)";
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
