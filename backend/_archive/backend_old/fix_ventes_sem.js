const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('ROUND(SUM(quantite) * 1.0 / (') && lines[i].includes('ventes_semaine')) {
    console.log('Trouve ligne', i+1);
    // Remplacer par calcul simple : total_periode / (periode.jours / 7)
    const indent = lines[i].match(/^\s*/)[0];
    lines[i] = `${indent}       ROUND(SUM(quantite) * 7.0 / ${28}, 2) as ventes_semaine,`;
    // Supprimer la ligne suivante si c'est la suite de la sous-requete
    if (lines[i+1] && lines[i+1].includes('FROM ventes v2')) {
      lines.splice(i+1, 1);
      console.log('Ligne suivante supprimee');
    }
    count++;
    if (count >= 2) break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('Corrections:', count, 'OK');
