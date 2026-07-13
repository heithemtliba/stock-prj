const fs = require('fs');
let lines = fs.readFileSync('./services/reassortService.js', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const bonusStatut = store.statut === \'OK\'') &&
      lines[i-2] && lines[i-2].includes('calculerScoreDonneur')) {
    console.log('Trouve ligne', i+1, ':', lines[i].trim());
    // DEPOT = meilleur donneur (2.0), OK = bon donneur (1.2), FAIBLE = donneur limite (0.6), CRITIQUE = mauvais donneur (0.1)
    lines[i] = "  const bonusStatut = store.statut === 'DEPOT' ? 2.0 : (store.statut === 'OK' ? 1.2 : (store.statut === 'FAIBLE' ? 0.6 : 0.1));";
    console.log('Corrige:', lines[i].trim());
    break;
  }
}

fs.writeFileSync('./services/reassortService.js', lines.join('\n'), 'utf8');
console.log('OK');
