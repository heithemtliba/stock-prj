const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

// Trouver la boucle for art in faibles sans indentation
let startLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === 'for art in faibles:') {
    startLine = i;
    console.log('Trouve ligne', i+1);
    break;
  }
}

if (startLine > -1) {
  // Ajouter 4 espaces a toutes les lignes de cette boucle
  // La boucle se termine quand on trouve une ligne non indentee (apres la premiere)
  let i = startLine;
  lines[i] = '    ' + lines[i]; // for art in faibles
  i++;
  while (i < lines.length) {
    // Si ligne vide ou indentee de 4+ espaces -> fait partie de la boucle
    if (lines[i].trim() === '') { i++; continue; }
    if (lines[i].startsWith('    ')) {
      lines[i] = '    ' + lines[i]; // ajouter 4 espaces
      i++;
    } else {
      console.log('Fin boucle ligne', i+1, ':', lines[i].substring(0,40));
      break;
    }
  }
  console.log('Lignes corrigees jusqu\'a:', i);
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
