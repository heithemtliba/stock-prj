const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (lignes.length > 0) {') && 
      lines[i+1] && lines[i+1].includes('bonsTransfert.push')) {
    console.log('Trouve ligne', i+1);
    lines.splice(i, 0,
      "              // Filtrer selon seuil transport",
      "              const seuilBon = (['009','032'].includes(sug.deId) || ['009','032'].includes(sug.versId)) ? 8",
      "                : (['029'].includes(sug.deId) || ['029'].includes(sug.versId)) ? 5",
      "                : (['011'].includes(sug.deId) || ['011'].includes(sug.versId)) ? 5 : 1;",
      "              const totalBon = lignes.reduce((s,l) => s + l.quantite, 0);",
      "              if (totalBon < seuilBon) { /* skip - sous seuil */ } else"
    );
    // Maintenant "if (lignes.length > 0)" devient le else
    i += 6;
    lines[i] = lines[i].replace('if (lignes.length > 0) {', 'if (lignes.length > 0) {');
    count++;
    if (count >= 2) break;
  }
}

console.log('Corrections:', count);
fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK');
