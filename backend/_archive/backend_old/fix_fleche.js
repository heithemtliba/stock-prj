const fs = require('fs');
let lines = fs.readFileFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('\u2192')) {
    lines[i] = lines[i].split('\u2192').join('->');
    console.log('Corrige ligne', i+1);
  }
}
fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
