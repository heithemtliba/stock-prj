const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === 'for art in faibles:') {
    console.log('Trouve ligne', i+1, ': "' + lines[i] + '"');
    // Corriger indentation de la boucle et tout son contenu
    lines[i] = 'for art in faibles:';
    // Verifier les lignes suivantes
    let j = i + 1;
    while (j < lines.length && (lines[j].startsWith('    ') || lines[j].trim() === '')) {
      j++;
    }
    console.log('Fin boucle ligne', j);
    break;
  }
}

// Afficher les lignes autour
const fs2 = require('fs');
const content = fs2.readFileSync('../scripts/exportRapportHebdo.py', 'utf8');
const allLines = content.split('\n');
for (let i = 0; i < allLines.length; i++) {
  if (allLines[i].includes('for art in faibles')) {
    console.log('Indentation exacte:', JSON.stringify(allLines[i].substring(0, 10)));
  }
}
