const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '# Prix depuis JSON articles') {
    console.log('Trouve ligne', i+1);
    // Supprimer les 3 lignes parasites: commentaire, pass, pass indenté, except
    let j = i;
    while (j < lines.length && (
      lines[j].trim() === '# Prix depuis JSON articles' ||
      lines[j].trim() === 'pass' ||
      lines[j].trim() === 'except: pass'
    )) {
      console.log('Supprime ligne', j+1, ':', lines[j]);
      lines.splice(j, 1);
    }
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
