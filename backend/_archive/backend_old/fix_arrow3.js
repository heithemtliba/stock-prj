const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('TOTAL BON') && lines[i].includes('donneur')) {
    console.log('Avant:', lines[i].trim());
    lines[i] = '    ct = ws8.cell(row=row, column=1, value=f"TOTAL BON #{bon_num:03d} -- {donneur} -> {receveur}")';
    console.log('Apres:', lines[i].trim());
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
