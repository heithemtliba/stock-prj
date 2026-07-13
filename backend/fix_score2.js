const fs = require('fs');
let lines = fs.readFileSync('./services/reassortService.js', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("bonusStatut = store.statut === 'OK' ? 1.2 : (store.statut === 'FAIBLE' ? 0.8 : 0.3)")) {
    console.log('Trouve ligne', i+1);
    lines[i] = "  const bonusStatut = store.statut === 'DEPOT' ? 2.0 : (store.statut === 'OK' ? 1.2 : (store.statut === 'FAIBLE' ? 0.6 : 0.1));";
    console.log('Corrige');
    break;
  }
}

fs.writeFileSync('./services/reassortService.js', lines.join('\n'), 'utf8');
console.log('OK');
